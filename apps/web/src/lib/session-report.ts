import {
  CONTROL_API,
  ERROR_CODES,
  type SessionReport,
  sessionReportSchema,
} from '@syncode/contracts';
import type { ApiErrorResult } from '@/lib/api-client.js';
import { api, readApiError } from '@/lib/api-client.js';

export type SessionReportQueryResult =
  | {
      state: 'pending';
    }
  | {
      state: 'ready';
      report: SessionReport;
    };

export async function fetchSessionReport(sessionId: string): Promise<SessionReportQueryResult> {
  try {
    const response = await api(CONTROL_API.SESSIONS.REPORT, {
      params: { sessionId },
    });

    return {
      state: 'ready',
      report: sessionReportSchema.parse(response),
    };
  } catch (error) {
    const apiError = await readApiError(error);

    if (isPendingSessionReportError(apiError)) {
      return { state: 'pending' };
    }

    throw error;
  }
}

export function isPendingSessionReportError(apiError: ApiErrorResult) {
  return apiError?.statusCode === 404 && apiError.code === ERROR_CODES.SESSION_REPORT_NOT_READY;
}
