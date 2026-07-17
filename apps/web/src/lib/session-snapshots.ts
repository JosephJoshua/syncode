import { CONTROL_API, type CodeSnapshot, codeSnapshotsResponseSchema } from '@syncode/contracts';
import { api } from '@/lib/api-client.js';

export async function fetchSessionSnapshots(sessionId: string): Promise<CodeSnapshot[]> {
  const response = await api(CONTROL_API.SESSIONS.SNAPSHOTS, {
    params: { sessionId },
  });

  return codeSnapshotsResponseSchema.parse(response).data;
}
