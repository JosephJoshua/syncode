export function selectUser(users, vuIndex) {
  if (users.length === 0) {
    return null;
  }
  return users[vuIndex % users.length];
}

export async function runSmokeIteration(client) {
  await client.request('GET', 'health', {
    label: 'GET /api/health',
  });
}

export async function runBrowseIteration(client, { user }) {
  await ensureLoggedIn(client, user);
  await client.request('GET', 'users/me');
  await client.request('GET', 'problems/tags');
  const problems = await client.request('GET', 'problems', {
    query: {
      limit: 20,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    },
  });

  const firstProblem = problems?.data?.[0];
  if (firstProblem?.id) {
    await client.request('GET', `problems/${firstProblem.id}`, {
      label: 'GET problems/:id',
    });
  }

  await client.request('GET', 'sessions', {
    query: {
      limit: 20,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    },
  });
}

export async function runRoomIteration(client, { user, cleanupRooms = true }) {
  await ensureLoggedIn(client, user);
  const room = await createPrivateRoom(client);

  await client.request('GET', `rooms/${room.roomId}`, {
    label: 'GET rooms/:id',
  });
  await client.request('POST', `rooms/${room.roomId}/collab/ensure`, {
    expectedStatuses: [200, 201],
    label: 'POST rooms/:id/collab/ensure',
  });
  await client.request('GET', 'rooms', {
    query: { limit: 20 },
  });
  await client.request('GET', 'rooms/public', {
    query: { limit: 20 },
  });

  if (cleanupRooms) {
    await destroyRoom(client, room.roomId);
  }
}

export async function runExecutionIteration(
  client,
  { user, cleanupRooms = true, pollTimeoutMs = 30_000, pollIntervalMs = 1_000 },
) {
  await ensureLoggedIn(client, user);
  const room = await createPrivateRoom(client);

  try {
    const run = await client.request('POST', `rooms/${room.roomId}/run`, {
      expectedStatuses: [202],
      body: {
        language: 'python',
        code: 'print("syncode stress execution")',
        stdin: '',
        timeoutMs: 5_000,
        memoryMb: 128,
      },
      label: 'POST rooms/:id/run',
    });

    await pollUntil({
      timeoutMs: pollTimeoutMs,
      intervalMs: pollIntervalMs,
      fetchStatus: () =>
        client.request('GET', `execution/${run.jobId}/status`, {
          label: 'GET execution/:jobId/status',
        }),
      isDone: (status) => status?.status === 'completed',
      isFailed: (status) => status?.status === 'failed',
      failureMessage: 'Execution job failed',
      timeoutMessage: 'Timed out waiting for execution job',
    });
  } finally {
    if (cleanupRooms) {
      await destroyRoom(client, room.roomId);
    }
  }
}

export async function runAiHintIteration(
  client,
  { user, cleanupRooms = true, pollTimeoutMs = 30_000, pollIntervalMs = 1_000 },
) {
  await ensureLoggedIn(client, user);
  const room = await createPrivateRoom(client);

  try {
    const hint = await client.request('POST', `rooms/${room.roomId}/ai/hint`, {
      expectedStatuses: [202],
      body: {
        code: [
          'def two_sum(nums, target):',
          '    seen = {}',
          '    for i, value in enumerate(nums):',
          '        need = target - value',
          '        if need in seen:',
          '            return [seen[need], i]',
          '        seen[value] = i',
          '    return []',
        ].join('\n'),
        language: 'python',
        hintLevel: 'subtle',
      },
      label: 'POST rooms/:id/ai/hint',
    });

    await pollUntil({
      timeoutMs: pollTimeoutMs,
      intervalMs: pollIntervalMs,
      fetchStatus: () =>
        client.request('GET', `rooms/${room.roomId}/ai/hint/${hint.jobId}`, {
          label: 'GET rooms/:id/ai/hint/:jobId',
        }),
      isDone: (status) => status?.status === 'ready',
      isFailed: (status) => status?.status === 'failed',
      failureMessage: 'AI hint job failed',
      timeoutMessage: 'Timed out waiting for AI hint job',
    });
  } finally {
    if (cleanupRooms) {
      await destroyRoom(client, room.roomId);
    }
  }
}

async function createPrivateRoom(client) {
  const problems = await client.request('GET', 'problems', {
    query: {
      limit: 1,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    },
  });
  const firstProblem = problems?.data?.[0];

  return client.request('POST', 'rooms', {
    expectedStatuses: [200, 201],
    body: {
      mode: 'peer',
      name: `Stress private room ${Date.now()}`,
      ...(firstProblem?.id ? { problemId: firstProblem.id } : {}),
      language: 'python',
      config: {
        maxParticipants: 2,
        maxDuration: 30,
        isPrivate: true,
      },
    },
  });
}

async function destroyRoom(client, roomId) {
  await client.request('DELETE', `rooms/${roomId}`, {
    expectedStatuses: [200, 204],
    label: 'DELETE rooms/:id',
  });
}

export async function runScenarioIteration(client, options) {
  if (options.scenario === 'smoke') {
    await runSmokeIteration(client);
    return;
  }

  const user = options.user;
  if (!user) {
    throw new Error(`Scenario "${options.scenario}" requires --users-file credentials`);
  }

  if (options.scenario === 'browse') {
    await runBrowseIteration(client, { user });
    return;
  }

  if (options.scenario === 'rooms') {
    await runRoomIteration(client, { user, cleanupRooms: options.cleanupRooms });
    return;
  }

  if (options.scenario === 'execution') {
    await runExecutionIteration(client, {
      user,
      cleanupRooms: options.cleanupRooms,
      pollTimeoutMs: options.pollTimeoutMs,
      pollIntervalMs: options.pollIntervalMs,
    });
    return;
  }

  if (options.scenario === 'ai-hint') {
    await runAiHintIteration(client, {
      user,
      cleanupRooms: options.cleanupRooms,
      pollTimeoutMs: options.pollTimeoutMs,
      pollIntervalMs: options.pollIntervalMs,
    });
    return;
  }

  if (Math.random() < 0.7) {
    await runBrowseIteration(client, { user });
    return;
  }

  await runRoomIteration(client, { user, cleanupRooms: options.cleanupRooms });
}

async function pollUntil({
  timeoutMs,
  intervalMs,
  fetchStatus,
  isDone,
  isFailed,
  failureMessage,
  timeoutMessage,
}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() <= deadline) {
    const status = await fetchStatus();
    if (isDone(status)) {
      return status;
    }
    if (isFailed(status)) {
      throw new Error(failureMessage);
    }
    await sleep(intervalMs);
  }
  throw new Error(timeoutMessage);
}

async function ensureLoggedIn(client, user) {
  if (client.isAuthenticated || client.loggedIn) {
    return;
  }
  if (!user) {
    throw new Error('A user credential is required for authenticated scenarios');
  }
  await client.login(user);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
