import { CONTROL_API, type SessionDetail, sessionDetailSchema } from '@syncode/contracts';
import { api } from '@/lib/api-client.js';

export async function fetchSessionDetail(sessionId: string): Promise<SessionDetail> {
  const response = await api(CONTROL_API.SESSIONS.GET, {
    params: { id: sessionId },
  });

  return sessionDetailSchema.parse(response);
}
