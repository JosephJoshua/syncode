import type { ExecutionDetailsResponse } from '@syncode/contracts';
import { useCallback, useEffect, useState } from 'react';
import type * as Y from 'yjs';
import type {
  CaseRunState,
  MultiRunState,
  SubmitState,
} from '@/components/room-workspace-utils.js';

const EXECUTION_MAP_KEY = 'execution';

// JSON-serializable version of CaseRunState (same shape, no Map)
export type SerializedCaseRunState = CaseRunState;

export interface SharedRunEntry {
  userId: string;
  userName: string;
  status: 'running' | 'completed' | 'idle';
  results: Record<string, SerializedCaseRunState>;
}

export interface SharedSubmitEntry {
  userId: string;
  userName: string;
  status: 'idle' | 'submitting' | 'polling' | 'completed' | 'request-error';
  submissionId?: string;
  details?: ExecutionDetailsResponse;
  message?: string;
}

export interface SharedExecutionState {
  run: SharedRunEntry | null;
  submit: SharedSubmitEntry | null;
}

export function useSharedExecution(
  doc: Y.Doc | null,
  currentUserId: string | null,
  userName: string,
) {
  const [sharedState, setSharedState] = useState<SharedExecutionState>({
    run: null,
    submit: null,
  });

  // Observe Y.Map changes
  useEffect(() => {
    if (!doc) return;
    const yMap = doc.getMap(EXECUTION_MAP_KEY);

    const observer = () => {
      setSharedState({
        run: (yMap.get('run') as SharedRunEntry | undefined) ?? null,
        submit: (yMap.get('submit') as SharedSubmitEntry | undefined) ?? null,
      });
    };

    yMap.observe(observer);
    observer(); // read initial state

    return () => {
      yMap.unobserve(observer);
    };
  }, [doc]);

  // Publish local run state to Y.Map
  const publishRunState = useCallback(
    (multiRunState: MultiRunState) => {
      if (!doc || !currentUserId) return;
      const yMap = doc.getMap(EXECUTION_MAP_KEY);

      if (multiRunState.status === 'idle' || multiRunState.status === 'request-error') {
        // Only clear if WE are the current publisher
        const current = yMap.get('run') as SharedRunEntry | undefined;
        if (current?.userId === currentUserId) {
          yMap.delete('run');
        }
        return;
      }

      const results: Record<string, CaseRunState> = {};
      for (const [key, value] of multiRunState.results) {
        results[key] = value;
      }

      yMap.set('run', {
        userId: currentUserId,
        userName,
        status: multiRunState.status === 'running' ? 'running' : 'completed',
        results,
      } satisfies SharedRunEntry);
    },
    [doc, currentUserId, userName],
  );

  // Publish local submit state to Y.Map
  const publishSubmitState = useCallback(
    (submitState: SubmitState) => {
      if (!doc || !currentUserId) return;
      const yMap = doc.getMap(EXECUTION_MAP_KEY);

      if (submitState.status === 'idle') {
        const current = yMap.get('submit') as SharedSubmitEntry | undefined;
        if (current?.userId === currentUserId) {
          yMap.delete('submit');
        }
        return;
      }

      const entry: SharedSubmitEntry = {
        userId: currentUserId,
        userName,
        status: submitState.status,
      };

      if (submitState.status === 'polling' || submitState.status === 'completed') {
        entry.submissionId = submitState.submissionId;
      }
      if (submitState.status === 'completed') {
        entry.details = submitState.details;
      }
      if (submitState.status === 'request-error') {
        entry.message = submitState.message;
      }

      yMap.set('submit', entry);
    },
    [doc, currentUserId, userName],
  );

  const isRemoteRun = sharedState.run !== null && sharedState.run.userId !== currentUserId;
  const isRemoteSubmit = sharedState.submit !== null && sharedState.submit.userId !== currentUserId;

  return {
    sharedState,
    isRemoteRun,
    isRemoteSubmit,
    publishRunState,
    publishSubmitState,
  };
}
