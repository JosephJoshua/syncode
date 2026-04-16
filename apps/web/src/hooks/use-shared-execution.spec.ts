import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Awareness } from 'y-protocols/awareness';
import * as Y from 'yjs';
import { useSharedExecution } from './use-shared-execution.js';

// Mock the API client — we don't want real HTTP calls
vi.mock('@/lib/api-client.js', () => ({
  api: vi.fn(),
}));

function createAwarenessFixture() {
  const doc = new Y.Doc();
  const awareness = new Awareness(doc);
  return {
    doc,
    awareness,
    destroy: () => {
      awareness.destroy();
      doc.destroy();
    },
  };
}

describe('useSharedExecution', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('GIVEN null awareness WHEN rendered THEN returns null remote state and no-op functions', () => {
    const { result } = renderHook(() => useSharedExecution(null, null));

    expect(result.current.remoteRun).toBeNull();
    expect(result.current.remoteSubmit).toBeNull();
    expect(typeof result.current.broadcastRun).toBe('function');
    expect(typeof result.current.broadcastSubmit).toBe('function');
  });

  it('GIVEN awareness WHEN broadcastRun is called THEN sets execution field on local awareness state', () => {
    const { doc, awareness, destroy } = createAwarenessFixture();

    const { result } = renderHook(() => useSharedExecution(awareness, doc));

    act(() => {
      result.current.broadcastRun('Alice', [
        { caseId: 'c1', jobId: 'j1', label: 'Case 1', expectedOutput: '42' },
      ]);
    });

    const localState = awareness.getLocalState();
    expect(localState?.execution).toEqual({
      type: 'run',
      userName: 'Alice',
      cases: [{ caseId: 'c1', jobId: 'j1', label: 'Case 1', expectedOutput: '42' }],
    });

    destroy();
  });

  it('GIVEN awareness WHEN broadcastSubmit is called THEN sets execution field with submit type', () => {
    const { doc, awareness, destroy } = createAwarenessFixture();

    const { result } = renderHook(() => useSharedExecution(awareness, doc));

    act(() => {
      result.current.broadcastSubmit('Bob', 'sub-123');
    });

    const localState = awareness.getLocalState();
    expect(localState?.execution).toEqual({
      type: 'submit',
      userName: 'Bob',
      submissionId: 'sub-123',
    });

    destroy();
  });

  it('GIVEN awareness WHEN clearExecution is called THEN removes execution field from awareness', () => {
    const { doc, awareness, destroy } = createAwarenessFixture();

    const { result } = renderHook(() => useSharedExecution(awareness, doc));

    act(() => {
      result.current.broadcastRun('Alice', [
        { caseId: 'c1', jobId: 'j1', label: 'Case 1', expectedOutput: null },
      ]);
    });
    expect(awareness.getLocalState()?.execution).toBeDefined();

    act(() => {
      result.current.clearExecution();
    });
    expect(awareness.getLocalState()?.execution).toBeNull();

    destroy();
  });

  it('GIVEN two awareness instances WHEN remote user broadcasts run THEN hook detects remote run state', async () => {
    // Create "local" client
    const localDoc = new Y.Doc();
    const localAwareness = new Awareness(localDoc);

    // Create "remote" client
    const remoteDoc = new Y.Doc();
    const remoteAwareness = new Awareness(remoteDoc);

    // Cross-connect awareness: when remote changes, apply to local
    remoteAwareness.on(
      'update',
      ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }) => {
        const changedClients = added.concat(updated, removed);
        const encoded =
          Awareness.prototype.constructor === Awareness
            ? // Use the awareness protocol to encode and apply
              (() => {
                const {
                  encodeAwarenessUpdate,
                  applyAwarenessUpdate,
                } = require('y-protocols/awareness');
                const update = encodeAwarenessUpdate(remoteAwareness, changedClients);
                applyAwarenessUpdate(localAwareness, update, null);
              })()
            : undefined;
      },
    );

    const { result } = renderHook(() => useSharedExecution(localAwareness, localDoc));

    // Simulate remote user setting execution awareness
    await act(async () => {
      // Directly apply a remote awareness update to local
      const { encodeAwarenessUpdate, applyAwarenessUpdate } = await import('y-protocols/awareness');
      remoteAwareness.setLocalStateField('execution', {
        type: 'run',
        userName: 'RemoteUser',
        cases: [{ caseId: 'c1', jobId: 'j1', label: 'Case 1', expectedOutput: null }],
      });
      const update = encodeAwarenessUpdate(remoteAwareness, [remoteDoc.clientID]);
      applyAwarenessUpdate(localAwareness, update, null);
    });

    // The hook should have detected the remote run
    expect(result.current.remoteRun).not.toBeNull();
    expect(result.current.remoteRun?.userName).toBe('RemoteUser');

    localAwareness.destroy();
    localDoc.destroy();
    remoteAwareness.destroy();
    remoteDoc.destroy();
  });

  it('GIVEN active remote run WHEN remote awareness clears THEN remoteRun resets to null', async () => {
    const localDoc = new Y.Doc();
    const localAwareness = new Awareness(localDoc);
    const remoteDoc = new Y.Doc();
    const remoteAwareness = new Awareness(remoteDoc);

    const { result } = renderHook(() => useSharedExecution(localAwareness, localDoc));

    const { encodeAwarenessUpdate, applyAwarenessUpdate, removeAwarenessStates } = await import(
      'y-protocols/awareness'
    );

    // Set remote run
    await act(async () => {
      remoteAwareness.setLocalStateField('execution', {
        type: 'run',
        userName: 'RemoteUser',
        cases: [{ caseId: 'c1', jobId: 'j1', label: 'Case 1', expectedOutput: null }],
      });
      const update = encodeAwarenessUpdate(remoteAwareness, [remoteDoc.clientID]);
      applyAwarenessUpdate(localAwareness, update, null);
    });

    expect(result.current.remoteRun).not.toBeNull();

    // Simulate remote disconnect (remove awareness state)
    await act(async () => {
      removeAwarenessStates(remoteAwareness, [remoteDoc.clientID], null);
      const update = encodeAwarenessUpdate(remoteAwareness, [remoteDoc.clientID]);
      applyAwarenessUpdate(localAwareness, update, null);
    });

    expect(result.current.remoteRun).toBeNull();

    localAwareness.destroy();
    localDoc.destroy();
    remoteAwareness.destroy();
    remoteDoc.destroy();
  });
});
