import type { ExecutionDetailsResponse } from '@syncode/contracts';
import { CONTROL_API } from '@syncode/contracts';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Awareness } from 'y-protocols/awareness';
import type * as Y from 'yjs';
import type {
  CaseRunState,
  MultiRunState,
  SubmitState,
} from '@/components/room-workspace-utils.js';
import {
  EXECUTION_POLL_INTERVAL_MS,
  SUBMISSION_POLL_INTERVAL_MS,
} from '@/components/room-workspace-utils.js';
import { api } from '@/lib/api-client.js';

interface RemoteCaseInfo {
  caseId: string;
  jobId: string;
  label: string;
  expectedOutput: string | null;
}

interface RunAwareness {
  type: 'run';
  userName: string;
  cases: RemoteCaseInfo[];
}

interface SubmitAwareness {
  type: 'submit';
  userName: string;
  submissionId: string;
}

type ExecutionAwareness = RunAwareness | SubmitAwareness;

export interface RemoteRunState {
  userName: string;
  multiRunState: MultiRunState;
}

export interface RemoteSubmitState {
  userName: string;
  submitState: SubmitState;
}

function isExecutionResult(response: { status: string }): response is {
  status: 'completed' | 'failed';
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  memoryUsageMb?: number;
  timedOut: boolean;
  error?: string;
} {
  return response.status === 'completed' || response.status === 'failed';
}

export function useSharedExecution(awareness: Awareness | null, doc: Y.Doc | null) {
  const [remoteRun, setRemoteRun] = useState<RemoteRunState | null>(null);
  const [remoteSubmit, setRemoteSubmit] = useState<RemoteSubmitState | null>(null);

  // Track which remote execution we're currently polling for (to avoid re-polling)
  const activeRemoteRunRef = useRef<string | null>(null); // serialized key to detect changes
  const activeRemoteSubmitRef = useRef<string | null>(null);
  const cancelRemoteRunRef = useRef<(() => void) | null>(null);
  const cancelRemoteSubmitRef = useRef<(() => void) | null>(null);

  const broadcastRun = useCallback(
    (userName: string, cases: RemoteCaseInfo[]) => {
      awareness?.setLocalStateField('execution', {
        type: 'run',
        userName,
        cases,
      } satisfies RunAwareness);
    },
    [awareness],
  );

  const broadcastSubmit = useCallback(
    (userName: string, submissionId: string) => {
      awareness?.setLocalStateField('execution', {
        type: 'submit',
        userName,
        submissionId,
      } satisfies SubmitAwareness);
    },
    [awareness],
  );

  const clearExecution = useCallback(() => {
    awareness?.setLocalStateField('execution', null);
  }, [awareness]);

  useEffect(() => {
    if (!awareness || !doc) return;

    function updateRunState(results: Map<string, CaseRunState>, userName: string) {
      let allDone = true;
      for (const s of results.values()) {
        if (s.status === 'queued' || s.status === 'running') {
          allDone = false;
          break;
        }
      }
      setRemoteRun({
        userName,
        multiRunState: { status: allDone ? 'completed' : 'running', results: new Map(results) },
      });
    }

    function pollCase(
      caseInfo: RemoteCaseInfo,
      results: Map<string, CaseRunState>,
      userName: string,
      isCancelled: () => boolean,
    ) {
      const poll = async () => {
        if (isCancelled()) return;
        try {
          const response = await api(CONTROL_API.EXECUTION.GET_RESULT, {
            params: { jobId: caseInfo.jobId },
          });
          if (isCancelled()) return;

          if (isExecutionResult(response)) {
            const passed =
              caseInfo.expectedOutput != null
                ? response.stdout.trim() === caseInfo.expectedOutput.trim()
                : null;
            results.set(caseInfo.caseId, {
              status: response.status,
              jobId: caseInfo.jobId,
              stdout: response.stdout,
              stderr: response.stderr,
              exitCode: response.exitCode,
              durationMs: response.durationMs,
              memoryUsageMb: response.memoryUsageMb,
              timedOut: response.timedOut,
              error: response.error,
              passed,
            });
          } else if (response.status === 'running') {
            results.set(caseInfo.caseId, { status: 'running', jobId: caseInfo.jobId });
            setTimeout(() => void poll(), EXECUTION_POLL_INTERVAL_MS);
            updateRunState(results, userName);
            return;
          } else {
            setTimeout(() => void poll(), EXECUTION_POLL_INTERVAL_MS);
            return;
          }
        } catch {
          results.set(caseInfo.caseId, { status: 'request-error', message: 'Poll failed' });
        }
        updateRunState(results, userName);
      };
      void poll();
    }

    function pollSubmission(submissionId: string, userName: string, isCancelled: () => boolean) {
      const poll = async () => {
        if (isCancelled()) return;
        try {
          const details: ExecutionDetailsResponse = await api(
            CONTROL_API.EXECUTION.GET_SUBMISSION_DETAILS,
            { params: { submissionId } },
          );
          if (isCancelled()) return;

          if (details.status === 'completed' || details.status === 'failed') {
            setRemoteSubmit({
              userName,
              submitState: { status: 'completed', submissionId, details },
            });
            return;
          }
          setTimeout(() => void poll(), SUBMISSION_POLL_INTERVAL_MS);
        } catch {
          setRemoteSubmit({
            userName,
            submitState: { status: 'request-error', message: 'Poll failed' },
          });
        }
      };
      void poll();
    }

    const onAwarenessChange = () => {
      let foundRun: RunAwareness | null = null;
      let foundSubmit: SubmitAwareness | null = null;
      let runSourceClientId: number | null = null;
      let submitSourceClientId: number | null = null;

      awareness.getStates().forEach((state, clientID) => {
        if (clientID === doc.clientID) return;
        const exec = state.execution as ExecutionAwareness | undefined | null;
        if (!exec) return;

        if (exec.type === 'run' && !foundRun) {
          foundRun = exec;
          runSourceClientId = clientID;
        } else if (exec.type === 'submit' && !foundSubmit) {
          foundSubmit = exec;
          submitSourceClientId = clientID;
        }
      });

      const runKey = foundRun
        ? `${runSourceClientId}:${(foundRun as RunAwareness).cases.map((c) => c.jobId).join(',')}`
        : null;

      if (runKey && runKey !== activeRemoteRunRef.current && foundRun) {
        activeRemoteRunRef.current = runKey;
        cancelRemoteRunRef.current?.();

        const run = foundRun as RunAwareness;
        let cancelled = false;
        cancelRemoteRunRef.current = () => {
          cancelled = true;
        };

        const results = new Map<string, CaseRunState>();
        for (const c of run.cases) {
          results.set(c.caseId, { status: 'queued' });
        }
        setRemoteRun({
          userName: run.userName,
          multiRunState: { status: 'running', results: new Map(results) },
        });

        for (const caseInfo of run.cases) {
          pollCase(caseInfo, results, run.userName, () => cancelled);
        }
      } else if (!runKey && activeRemoteRunRef.current) {
        activeRemoteRunRef.current = null;
        cancelRemoteRunRef.current?.();
        setRemoteRun(null);
      }

      const submitKey = foundSubmit
        ? `${submitSourceClientId}:${(foundSubmit as SubmitAwareness).submissionId}`
        : null;

      if (submitKey && submitKey !== activeRemoteSubmitRef.current && foundSubmit) {
        activeRemoteSubmitRef.current = submitKey;
        cancelRemoteSubmitRef.current?.();

        const submit = foundSubmit as SubmitAwareness;
        let cancelled = false;
        cancelRemoteSubmitRef.current = () => {
          cancelled = true;
        };

        setRemoteSubmit({
          userName: submit.userName,
          submitState: { status: 'polling', submissionId: submit.submissionId },
        });
        pollSubmission(submit.submissionId, submit.userName, () => cancelled);
      } else if (!submitKey && activeRemoteSubmitRef.current) {
        activeRemoteSubmitRef.current = null;
        cancelRemoteSubmitRef.current?.();
        setRemoteSubmit(null);
      }
    };

    awareness.on('change', onAwarenessChange);
    onAwarenessChange();

    return () => {
      awareness.off('change', onAwarenessChange);
      cancelRemoteRunRef.current?.();
      cancelRemoteSubmitRef.current?.();
    };
  }, [awareness, doc]);

  return {
    remoteRun,
    remoteSubmit,
    broadcastRun,
    broadcastSubmit,
    clearExecution,
  };
}
