import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  runAiHintIteration,
  runBrowseIteration,
  runExecutionIteration,
  runRoomIteration,
  selectUser,
} from './workloads.mjs';

describe('selectUser', () => {
  it('rotates through provided credentials by virtual-user index', () => {
    const users = [
      { identifier: 'alice@example.com', password: 'password123' },
      { identifier: 'bob@example.com', password: 'password123' },
    ];

    assert.deepEqual(selectUser(users, 0), users[0]);
    assert.deepEqual(selectUser(users, 1), users[1]);
    assert.deepEqual(selectUser(users, 2), users[0]);
  });
});

describe('runBrowseIteration', () => {
  it('logs in once and exercises read-heavy student browsing paths', async () => {
    const client = new FakeClient();

    await runBrowseIteration(client, {
      user: { identifier: 'alice@example.com', password: 'password123' },
    });

    assert.deepEqual(client.calls, [
      'login:alice@example.com',
      'GET users/me',
      'GET problems/tags',
      'GET problems',
      'GET problems/problem-1',
      'GET sessions',
    ]);
  });
});

describe('runRoomIteration', () => {
  it('creates a private room, ensures collaboration, and cleans up the room', async () => {
    const client = new FakeClient();

    await runRoomIteration(client, {
      user: { identifier: 'alice@example.com', password: 'password123' },
      cleanupRooms: true,
    });

    assert.deepEqual(client.calls, [
      'login:alice@example.com',
      'GET problems',
      'POST rooms',
      'GET rooms/room-1',
      'POST rooms/room-1/collab/ensure',
      'GET rooms',
      'GET rooms/public',
      'DELETE rooms/room-1',
    ]);
  });
});

describe('runExecutionIteration', () => {
  it('creates a room, submits a bounded code run, polls execution status, and cleans up', async () => {
    const client = new FakeClient();

    await runExecutionIteration(client, {
      user: { identifier: 'alice@example.com', password: 'password123' },
      cleanupRooms: true,
      pollTimeoutMs: 1000,
      pollIntervalMs: 1,
    });

    assert.deepEqual(client.calls, [
      'login:alice@example.com',
      'GET problems',
      'POST rooms',
      'POST rooms/room-1/run',
      'GET execution/exec-job-1/status',
      'DELETE rooms/room-1',
    ]);
  });
});

describe('runAiHintIteration', () => {
  it('creates a room, requests an AI hint, polls hint status, and cleans up', async () => {
    const client = new FakeClient();

    await runAiHintIteration(client, {
      user: { identifier: 'alice@example.com', password: 'password123' },
      cleanupRooms: true,
      pollTimeoutMs: 1000,
      pollIntervalMs: 1,
    });

    assert.deepEqual(client.calls, [
      'login:alice@example.com',
      'GET problems',
      'POST rooms',
      'POST rooms/room-1/ai/hint',
      'GET rooms/room-1/ai/hint/ai-job-1',
      'DELETE rooms/room-1',
    ]);
  });
});

class FakeClient {
  calls = [];
  loggedIn = false;

  async login(user) {
    this.calls.push(`login:${user.identifier}`);
    this.loggedIn = true;
    return { id: 'user-1' };
  }

  async request(method, path, options = {}) {
    this.calls.push(`${method} ${path}`);

    if (path === 'problems') {
      return { data: [{ id: 'problem-1' }], pagination: { nextCursor: null, hasMore: false } };
    }
    if (path === 'rooms' && method === 'POST') {
      assert.equal(options.body.config.isPrivate, true);
      return { roomId: 'room-1' };
    }
    if (path === 'rooms/room-1/run' && method === 'POST') {
      return { jobId: 'exec-job-1' };
    }
    if (path === 'execution/exec-job-1/status') {
      return { status: 'completed' };
    }
    if (path === 'rooms/room-1/ai/hint' && method === 'POST') {
      return { jobId: 'ai-job-1', hintId: 'hint-1', phase: 'initial' };
    }
    if (path === 'rooms/room-1/ai/hint/ai-job-1') {
      return {
        status: 'ready',
        jobId: 'ai-job-1',
        hintId: 'hint-1',
        phase: 'initial',
        hint: 'Hint',
      };
    }
    return {};
  }
}
