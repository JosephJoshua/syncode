import type {
  ExecutionDetailsResponse,
  ExecutionResultResponse,
  JobStatusResponse,
  ProblemDetail,
  RoomDetail,
} from '@syncode/contracts';
import { CONTROL_API, ERROR_CODES } from '@syncode/contracts';
import type { RoomRole, RoomStatus } from '@syncode/shared';
import { Badge, Button } from '@syncode/ui';
import {
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Play,
  Send,
  TerminalSquare,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Separator as ResizableHandle,
  Panel as ResizablePanel,
  Group as ResizablePanelGroup,
  usePanelRef,
} from 'react-resizable-panels';
import { toast } from 'sonner';
import type { Awareness } from 'y-protocols/awareness';
import type * as Y from 'yjs';
import { useSharedExecution } from '@/hooks/use-shared-execution.js';
import type { CollabConnectionStatus } from '@/hooks/use-yjs-collab.js';
import { api, readApiError, resolveErrorMessage } from '@/lib/api-client.js';
import { allRequiredPeersReady } from '@/lib/participant-readiness.js';
import { buildInviteLink } from '@/lib/room-stage.js';
import { codeTextKey } from '@/lib/yjs-collab-provider.js';
import { CollaborativeEditor } from './collaborative-editor.js';
import { ExecutionDetailsPanel } from './execution-details-panel.js';
import { HostControlPanel } from './host-control-panel.js';
import { InviteLinkInline } from './invite-link-inline.js';
import { LanguagePicker } from './language-picker.js';
import { LANGUAGE_VERSIONED_LABELS } from './language-selector.data.js';
import { RoomHeaderBar } from './room-header-bar.js';
import { type Participant, RoomParticipantCard } from './room-participant-card.js';
import { type ProblemData, RoomProblemPanel } from './room-problem-panel.js';
import { RoomStatusBar } from './room-status-bar.js';
import {
  type CaseRunState,
  countPassed,
  EDITOR_LOADING,
  EXECUTION_POLL_INTERVAL_MS,
  languageExtension,
  type MultiRunState,
  SUBMISSION_POLL_INTERVAL_MS,
  type SubmitState,
  type TestCaseEntry,
  tabClassName,
  toMonacoLanguage,
} from './room-workspace-utils.js';
import { RunResultsPanel } from './run-results-panel.js';
import { StageTransitionOverlay } from './stage-transition-overlay.js';
import { TestCaseEditor } from './testcase-editor.js';

interface RoomWorkspaceProps {
  room: RoomDetail;
  currentUserId: string | null;
  roomId: string;
  doc: Y.Doc | null;
  awareness: Awareness | null;
  elapsedMs: number;
  isTransitioning: boolean;
  onTransition: (targetStatus: RoomStatus) => Promise<void>;
  onRoomUpdated: (room: RoomDetail) => void;
  onParticipantRoleChange: (userId: string, role: RoomRole) => Promise<void>;
  onTransferOwnership: (userId: string, displayName: string) => void;
  onRemoveParticipant: (userId: string, displayName: string) => void;
  isUpdatingRole: string | null;
  isTransferringOwnership: string | null;
  isRemovingParticipant: string | null;
  collabStatus: CollabConnectionStatus;
  currentUserName: string;
  speakingMap?: ReadonlyMap<string, boolean>;
  mediaControls?: React.ReactNode;
  mediaConnectedSet?: ReadonlySet<string>;
  mediaMutedMap?: ReadonlyMap<string, boolean>;
  connectionQualityMap?: ReadonlyMap<string, unknown>;
  participantMediaControls?: {
    setVolume: (identity: string, volume: number) => void;
    setMuted: (identity: string, muted: boolean) => void;
    setVideoHidden: (identity: string, hidden: boolean) => void;
    volumeMap: ReadonlyMap<string, number>;
    muteSet: ReadonlySet<string>;
    videoHiddenSet: ReadonlySet<string>;
  };
  selfMicrophoneEnabled?: boolean;
  onSelfMicrophoneToggle?: () => void;
  dockedVideoPanel?: React.ReactNode;
}

export function RoomWorkspace({
  room,
  currentUserId,
  roomId,
  doc,
  awareness,
  elapsedMs,
  isTransitioning,
  onTransition,
  onRoomUpdated,
  onParticipantRoleChange,
  onTransferOwnership,
  onRemoveParticipant,
  isUpdatingRole,
  isTransferringOwnership,
  isRemovingParticipant,
  collabStatus,
  currentUserName,
  speakingMap,
  mediaControls,
  mediaConnectedSet,
  mediaMutedMap,
  connectionQualityMap,
  participantMediaControls,
  selfMicrophoneEnabled,
  onSelfMicrophoneToggle,
  dockedVideoPanel,
}: RoomWorkspaceProps) {
  const { t } = useTranslation('rooms');

  const { remoteRun, remoteSubmit, broadcastRun, broadcastSubmit } = useSharedExecution(
    awareness,
    doc,
  );

  const allRequiredReady = useMemo(
    () => allRequiredPeersReady(room.participants, room.mode),
    [room.participants, room.mode],
  );

  const [problem, setProblem] = useState<ProblemDetail | null>(null);
  const [problemLoading, setProblemLoading] = useState(!!room.problemId);
  const [problemError, setProblemError] = useState<string | null>(null);

  useEffect(() => {
    if (!room.problemId) return;
    let cancelled = false;
    setProblemLoading(true);
    setProblemError(null);

    api(CONTROL_API.PROBLEMS.GET_BY_ID, { params: { id: room.problemId } })
      .then((data) => {
        if (!cancelled) setProblem(data);
      })
      .catch(() => {
        if (!cancelled) setProblemError(t('problem.loadFailed'));
      })
      .finally(() => {
        if (!cancelled) setProblemLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [room.problemId, t]);

  const language = room.language ?? 'python';
  const monacoLanguage = toMonacoLanguage(language);
  const bottomPanelRef = usePanelRef();
  const leftPanelRef = usePanelRef();
  const rightPanelRef = usePanelRef();
  const [submitState, setSubmitState] = useState<SubmitState>({ status: 'idle' });
  const [activeBottomTab, setActiveBottomTab] = useState<'testcases' | 'output' | 'results'>(
    'testcases',
  );
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [rightNarrow, setRightNarrow] = useState(false);
  const [bottomCollapsed, setBottomCollapsed] = useState(false);
  const rightMountedRef = useRef(false);
  const rightContentRef = useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: rightCollapsed triggers re-attach when the panel DOM changes between collapsed/expanded states
  useEffect(() => {
    const el = rightContentRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setRightNarrow(entry.contentRect.width < 200);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [rightCollapsed]);
  const cancelSubmitPollRef = useRef<(() => void) | null>(null);

  const [testCases, setTestCases] = useState<TestCaseEntry[]>([]);
  const [activeCaseId, setActiveCaseId] = useState('');
  const [multiRunState, setMultiRunState] = useState<MultiRunState>({ status: 'idle' });
  const cancelMultiRunRef = useRef(new Map<string, () => void>());
  const nextCustomId = useRef(1);

  useEffect(() => {
    if (!problem) return;
    const entries: TestCaseEntry[] = problem.testCases.map((tc, i) => ({
      id: `problem-${i}`,
      input: tc.input,
      expectedOutput: tc.expectedOutput,
      label: t('workspace.testcaseTab', { index: i + 1 }),
      fromProblem: true,
    }));
    setTestCases(entries);
    if (entries.length > 0) setActiveCaseId(entries[0]?.id ?? '');
  }, [problem, t]);

  useEffect(() => {
    return () => {
      cancelSubmitPollRef.current?.();
      for (const cancel of cancelMultiRunRef.current.values()) cancel();
    };
  }, []);

  const handleLanguageChanged = useCallback(
    (updated: RoomDetail) => {
      const previousLanguage = room.language;
      const nextLanguage = updated.language;
      if (
        nextLanguage &&
        nextLanguage !== previousLanguage &&
        problem &&
        !problem.starterCode?.[nextLanguage]
      ) {
        toast.info(
          t('workspace.noStarterForLanguage', {
            language: LANGUAGE_VERSIONED_LABELS[nextLanguage],
          }),
        );
      }
      onRoomUpdated(updated);
    },
    [onRoomUpdated, problem, room.language, t],
  );

  const amHost = Boolean(currentUserId && room.hostId === currentUserId);
  const canRunCode = room.myCapabilities.includes('code:run');
  const canEditCode = room.myCapabilities.includes('code:edit');
  const canManageParticipants = room.myCapabilities.includes('participant:assign-role');
  const isEditorReadOnly = !canEditCode || room.editorLocked || room.status === 'finished';

  const participants = useMemo(
    () => room.participants.filter((p: Participant) => p.isActive),
    [room.participants],
  );
  const inviteLink = room.roomCode ? buildInviteLink(roomId, room.roomCode) : window.location.href;

  const canSubmitCode = room.myCapabilities.includes('code:submit') && !!room.problemId;

  const handleAddCase = useCallback(() => {
    const idx = nextCustomId.current++;
    const id = `custom-${idx}`;
    const entry: TestCaseEntry = {
      id,
      input: '',
      expectedOutput: null,
      label: t('workspace.customCaseTab', { index: idx }),
      fromProblem: false,
    };
    setTestCases((prev) => [...prev, entry]);
    setActiveCaseId(id);
  }, [t]);

  const handleRemoveCase = useCallback((id: string) => {
    setTestCases((prev) => {
      const next = prev.filter((c) => c.id !== id);
      // If we removed the active case, select the first remaining
      setActiveCaseId((activeId) => (activeId === id ? (next[0]?.id ?? '') : activeId));
      return next;
    });
  }, []);

  const handleCaseInputChange = useCallback((id: string, input: string) => {
    setTestCases((prev) => prev.map((c) => (c.id === id ? { ...c, input } : c)));
  }, []);

  const isMultiRunBusy = multiRunState.status === 'running';
  const isSubmitBusy = submitState.status === 'submitting' || submitState.status === 'polling';
  const isRemoteRunActive = remoteRun?.multiRunState.status === 'running' && !isMultiRunBusy;
  const isRemoteSubmitActive =
    (remoteSubmit?.submitState.status === 'polling' ||
      remoteSubmit?.submitState.status === 'submitting') &&
    !isSubmitBusy;
  const runDisabled = !canRunCode || isEditorReadOnly || isMultiRunBusy || isRemoteRunActive;
  const submitDisabled = !canSubmitCode || isEditorReadOnly || isSubmitBusy || isRemoteSubmitActive;

  const getCode = useCallback(() => {
    return doc?.getText(codeTextKey(language)).toString() ?? '';
  }, [doc, language]);

  const handleRunCode = async () => {
    if (testCases.length === 0) return;

    for (const cancel of cancelMultiRunRef.current.values()) cancel();
    cancelMultiRunRef.current.clear();
    setActiveBottomTab('output');

    const initialResults = new Map<string, CaseRunState>();
    for (const tc of testCases) {
      initialResults.set(tc.id, { status: 'queued' });
    }
    setMultiRunState({ status: 'running', results: initialResults });

    const code = getCode();
    const results = await Promise.all(
      testCases.map(async (tc) => {
        const jobId = await runCase(tc, code);
        return jobId
          ? { caseId: tc.id, jobId, label: tc.label, expectedOutput: tc.expectedOutput }
          : null;
      }),
    );
    const jobs = results.filter(
      (j): j is { caseId: string; jobId: string; label: string; expectedOutput: string | null } =>
        j !== null,
    );

    if (jobs.length > 0) {
      broadcastRun(currentUserName, jobs);
    }
  };

  const pollCaseExecution = (
    caseId: string,
    jobId: string,
    expectedOutput: string | null,
    token: { cancelled: boolean },
  ) => {
    const poll = async () => {
      try {
        const response = await api(CONTROL_API.EXECUTION.GET_RESULT, { params: { jobId } });
        if (token.cancelled) return;

        if (isExecutionResultPayload(response)) {
          const passed =
            expectedOutput != null ? response.stdout.trim() === expectedOutput.trim() : null;

          setMultiRunState((prev) => {
            if (prev.status !== 'running' && prev.status !== 'completed') return prev;
            const next = new Map(prev.results);
            next.set(caseId, {
              status: response.status,
              jobId,
              stdout: response.stdout,
              stderr: response.stderr,
              exitCode: response.exitCode,
              durationMs: response.durationMs,
              memoryUsageMb: response.memoryUsageMb,
              timedOut: response.timedOut,
              error: response.error,
              passed,
            });

            let allDone = true;
            for (const s of next.values()) {
              if (s.status === 'queued' || s.status === 'running') {
                allDone = false;
                break;
              }
            }

            return { status: allDone ? 'completed' : 'running', results: next } as MultiRunState;
          });
          return;
        }

        if (response.status === 'queued' || response.status === 'running') {
          setMultiRunState((prev) => {
            if (prev.status !== 'running' && prev.status !== 'completed') return prev;
            const current = prev.results.get(caseId);
            if (current?.status === response.status) return prev;
            const next = new Map(prev.results);
            next.set(
              caseId,
              response.status === 'queued' ? { status: 'queued' } : { status: 'running', jobId },
            );
            return { ...prev, results: next };
          });
          setTimeout(() => {
            if (!token.cancelled) void poll();
          }, EXECUTION_POLL_INTERVAL_MS);
          return;
        }
      } catch (error) {
        const apiError = await readApiError(error);
        if (!token.cancelled) {
          setMultiRunState((prev) => {
            if (prev.status !== 'running' && prev.status !== 'completed') return prev;
            const next = new Map(prev.results);
            next.set(caseId, {
              status: 'request-error',
              message: apiError?.message ?? t('workspace.runFailed'),
            });
            return { ...prev, results: next };
          });
        }
      }
    };

    void poll();
  };

  const handleSubmitCode = async () => {
    cancelSubmitPollRef.current?.();
    setSubmitState({ status: 'submitting' });
    setActiveBottomTab('results');

    try {
      const response = await api(CONTROL_API.ROOMS.SUBMIT, {
        params: { id: roomId },
        body: { language, code: getCode() },
      });

      setSubmitState({ status: 'polling', submissionId: response.submissionId });
      cancelSubmitPollRef.current = pollSubmission(response.submissionId);
      broadcastSubmit(currentUserName, response.submissionId);
    } catch (error) {
      const apiError = await readApiError(error);
      const message = resolveErrorMessage(apiError, SUBMIT_ERROR_KEYS, 'workspace.submitFailed', t);
      setSubmitState({ status: 'request-error', message });
      toast.error(message);
    }
  };

  const pollSubmission = (submissionId: string) => {
    let cancelled = false;

    const poll = async () => {
      try {
        const details: ExecutionDetailsResponse = await api(
          CONTROL_API.EXECUTION.GET_SUBMISSION_DETAILS,
          { params: { submissionId } },
        );

        if (cancelled) return;

        if (details.status === 'completed' || details.status === 'failed') {
          setSubmitState({ status: 'completed', submissionId, details });
          return;
        }

        // Still pending/running — update with latest partial results and keep polling
        setSubmitState({ status: 'polling', submissionId });
        setTimeout(() => {
          if (!cancelled) void poll();
        }, SUBMISSION_POLL_INTERVAL_MS);
      } catch (error) {
        const apiError = await readApiError(error);
        if (!cancelled) {
          setSubmitState({
            status: 'request-error',
            message: apiError?.message ?? t('workspace.submitFailed'),
          });
        }
      }
    };

    void poll();

    return () => {
      cancelled = true;
    };
  };

  const runCase = async (tc: TestCaseEntry, code?: string): Promise<string | null> => {
    cancelMultiRunRef.current.get(tc.id)?.();
    const token = { cancelled: false };
    cancelMultiRunRef.current.set(tc.id, () => {
      token.cancelled = true;
    });

    try {
      const response = await api(CONTROL_API.ROOMS.RUN, {
        params: { id: roomId },
        body: { language, code: code ?? getCode(), stdin: tc.input || undefined },
      });

      if (token.cancelled) return null;

      setMultiRunState((prev) => {
        if (prev.status !== 'running' && prev.status !== 'completed') return prev;
        const next = new Map(prev.results);
        next.set(tc.id, { status: 'running', jobId: response.jobId });
        return { ...prev, results: next };
      });

      pollCaseExecution(tc.id, response.jobId, tc.expectedOutput, token);
      return response.jobId;
    } catch (error) {
      if (token.cancelled) return null;
      const apiError = await readApiError(error);
      setMultiRunState((prev) => {
        if (prev.status !== 'running' && prev.status !== 'completed') return prev;
        const next = new Map(prev.results);
        next.set(tc.id, {
          status: 'request-error',
          message: apiError?.message ?? t('workspace.runFailed'),
        });
        return { ...prev, results: next };
      });
      return null;
    }
  };

  const handleRunSingleCase = async (caseId: string) => {
    const tc = testCases.find((c) => c.id === caseId);
    if (!tc) return;

    setMultiRunState((prev) => {
      const results =
        prev.status === 'running' || prev.status === 'completed'
          ? new Map(prev.results)
          : new Map<string, CaseRunState>();
      results.set(caseId, { status: 'queued' });
      return { status: 'running', results };
    });

    await runCase(tc);
  };

  const handleRunCodeRef = useRef(handleRunCode);
  handleRunCodeRef.current = handleRunCode;
  const handleSubmitCodeRef = useRef(handleSubmitCode);
  handleSubmitCodeRef.current = handleSubmitCode;

  // Show remote results when local user is idle
  const multiRunResults =
    multiRunState.status === 'running' || multiRunState.status === 'completed'
      ? multiRunState.results
      : remoteRun?.multiRunState.status === 'running' ||
          remoteRun?.multiRunState.status === 'completed'
        ? remoteRun.multiRunState.results
        : null;

  // Auto-switch tabs when remote execution starts
  const prevRemoteRunRef = useRef(isRemoteRunActive);
  const prevRemoteSubmitRef = useRef(isRemoteSubmitActive);
  useEffect(() => {
    if (isRemoteRunActive && !prevRemoteRunRef.current) setActiveBottomTab('output');
    if (isRemoteSubmitActive && !prevRemoteSubmitRef.current) setActiveBottomTab('results');
    prevRemoteRunRef.current = isRemoteRunActive;
    prevRemoteSubmitRef.current = isRemoteSubmitActive;
  }, [isRemoteRunActive, isRemoteSubmitActive]);

  const prevMultiRunStatus = useRef(multiRunState.status);
  useEffect(() => {
    if (
      prevMultiRunStatus.current !== 'completed' &&
      multiRunState.status === 'completed' &&
      multiRunResults
    ) {
      const { passed, total } = countPassed(multiRunResults);
      if (passed === total && total > 0) {
        toast.success(t('workspace.runResultsSummary', { passed, total }));
      } else {
        toast(t('workspace.runResultsSummary', { passed, total }));
      }
    }
    prevMultiRunStatus.current = multiRunState.status;
  }, [multiRunState.status, multiRunResults, t]);

  const problemPanelData: ProblemData | null = useMemo(
    () =>
      problem
        ? {
            title: problem.title,
            difficulty: problem.difficulty,
            tags: problem.tags,
            description: problem.description,
            constraints: problem.constraints,
            examples: problem.examples,
          }
        : null,
    [problem],
  );

  return (
    <div className="fixed inset-0 z-40 flex flex-col overflow-hidden bg-background">
      <StageTransitionOverlay status={room.status} />

      <RoomHeaderBar
        roomName={room.name}
        status={room.status}
        myRole={room.myRole}
        isHost={amHost}
        elapsedMs={elapsedMs}
        participants={participants}
        speakingMap={speakingMap}
        mediaControls={mediaControls}
        mediaConnectedSet={mediaConnectedSet}
        mediaMutedMap={mediaMutedMap}
      />

      {/* Main resizable 3-panel area */}
      <ResizablePanelGroup orientation="horizontal" style={{ flex: 1 }}>
        {/* Left: Problem Panel */}
        {room.problemId ? (
          <>
            <ResizablePanel
              panelRef={leftPanelRef}
              defaultSize={25}
              minSize={10}
              collapsible
              collapsedSize="2.25rem"
              onResize={() => setLeftCollapsed(leftPanelRef.current?.isCollapsed() ?? false)}
            >
              {leftCollapsed ? (
                <button
                  type="button"
                  onClick={() => leftPanelRef.current?.expand()}
                  className="flex h-full w-full cursor-pointer flex-col items-center justify-center gap-2 border-r border-border bg-card/80 transition-colors hover:bg-primary/5"
                >
                  <ChevronRight size={14} className="text-muted-foreground/40" />
                  <span className="rotate-180 font-mono text-[11px] font-medium uppercase tracking-widest text-muted-foreground/60 [writing-mode:vertical-lr]">
                    {t('problem.heading')}
                  </span>
                </button>
              ) : (
                <RoomProblemPanel
                  problem={problemPanelData}
                  loading={problemLoading}
                  error={problemError}
                  hasProblem
                />
              )}
            </ResizablePanel>
            <ResizableHandle className="group relative w-1 bg-border transition-colors hover:bg-primary/40 active:bg-primary/60">
              <button
                type="button"
                onClick={() =>
                  leftCollapsed ? leftPanelRef.current?.expand() : leftPanelRef.current?.collapse()
                }
                className="absolute top-1/2 -translate-y-1/2 -left-2.5 z-10 flex size-5 items-center justify-center rounded-full border border-border bg-card text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
              >
                {leftCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
              </button>
            </ResizableHandle>
          </>
        ) : null}

        {/* Center: Editor + Output (vertically resizable) */}
        <ResizablePanel defaultSize={room.problemId ? 50 : 75} minSize={20}>
          <ResizablePanelGroup orientation="vertical">
            {/* Editor panel */}
            <ResizablePanel defaultSize={55} minSize={20}>
              <div className="flex h-full flex-col">
                {/* Editor toolbar */}
                <div className="flex h-9 shrink-0 items-center justify-between border-b border-border bg-card px-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex items-center gap-1.5 rounded-t-md border border-b-0 border-border bg-background px-2.5 py-1">
                      <span className="size-2 rounded-full bg-primary/60" />
                      <span className="font-mono text-[11px] text-foreground/80">
                        solution.{languageExtension(language)}
                      </span>
                    </div>
                    {isEditorReadOnly ? (
                      <Badge variant="neutral" size="sm" className="text-[10px]">
                        {t('workspace.readOnly')}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <LanguagePicker
                      roomId={roomId}
                      currentLanguage={room.language}
                      myCapabilities={room.myCapabilities}
                      onLanguageChanged={handleLanguageChanged}
                      className="h-7 min-w-[8rem]"
                    />
                    <Button
                      type="button"
                      size="sm"
                      disabled={runDisabled}
                      onClick={() => void handleRunCodeRef.current()}
                      className={`h-7 gap-1.5 px-3 text-xs font-medium ${runDisabled ? '' : 'run-glow'}`}
                    >
                      {isMultiRunBusy ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <Play className="size-3 fill-current" />
                      )}
                      {t('workspace.runCode')}
                    </Button>
                    {canSubmitCode ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={submitDisabled}
                        onClick={() => void handleSubmitCodeRef.current()}
                        className="h-7 gap-1.5 px-3 text-xs font-medium"
                      >
                        {isSubmitBusy ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <Send className="size-3" />
                        )}
                        {t('workspace.submitCode')}
                      </Button>
                    ) : null}
                  </div>
                </div>

                {/* Remote execution indicator */}
                {isRemoteRunActive && remoteRun ? (
                  <div className="flex h-6 shrink-0 items-center gap-1.5 border-b border-border bg-primary/5 px-3 font-mono text-[10px] text-primary">
                    <Loader2 className="size-3 animate-spin" />
                    {t('workspace.remoteRunning', { name: remoteRun.userName })}
                  </div>
                ) : null}
                {isRemoteSubmitActive && remoteSubmit ? (
                  <div className="flex h-6 shrink-0 items-center gap-1.5 border-b border-border bg-amber-500/5 px-3 font-mono text-[10px] text-amber-400">
                    <Loader2 className="size-3 animate-spin" />
                    {t('workspace.remoteSubmitting', { name: remoteSubmit.userName })}
                  </div>
                ) : null}

                {/* Monaco editor */}
                <div className="flex-1 overflow-hidden">
                  {doc && awareness ? (
                    <CollaborativeEditor
                      key={doc.clientID}
                      doc={doc}
                      awareness={awareness}
                      language={monacoLanguage}
                      readOnly={isEditorReadOnly}
                      onRunCode={() => void handleRunCodeRef.current()}
                      onSubmitCode={() => void handleSubmitCodeRef.current()}
                    />
                  ) : (
                    EDITOR_LOADING
                  )}
                </div>

                {/* Expand bar shown when bottom panel is collapsed */}
                {bottomCollapsed ? (
                  <button
                    type="button"
                    onClick={() => bottomPanelRef.current?.expand()}
                    className="flex h-6 shrink-0 cursor-pointer items-center justify-center gap-1 border-t border-border bg-card font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 transition-colors hover:bg-primary/10 hover:text-foreground"
                  >
                    <TerminalSquare size={10} />
                    {t('workspace.outputTab')}
                  </button>
                ) : null}
              </div>
            </ResizablePanel>

            {/* Thin drag handle between editor and bottom panel */}
            <ResizableHandle className="h-1 bg-border transition-colors hover:bg-primary/40 active:bg-primary/60" />

            {/* Bottom panel: test cases + output + results */}
            <ResizablePanel
              panelRef={bottomPanelRef}
              defaultSize={35}
              minSize={8}
              collapsible
              collapsedSize={0}
              onResize={() => setBottomCollapsed(bottomPanelRef.current?.isCollapsed() ?? false)}
            >
              <div className="flex h-full flex-col bg-card">
                {/* Integrated tab bar */}
                <div className="flex h-8 shrink-0 items-center border-b border-border">
                  <button
                    type="button"
                    onClick={() => setActiveBottomTab('testcases')}
                    className={tabClassName(activeBottomTab === 'testcases')}
                  >
                    <TerminalSquare className="size-3" />
                    {t('workspace.inputLabel')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveBottomTab('output')}
                    className={tabClassName(activeBottomTab === 'output')}
                  >
                    <TerminalSquare className="size-3" />
                    {t('workspace.outputTab')}
                  </button>
                  {canSubmitCode ? (
                    <button
                      type="button"
                      onClick={() => setActiveBottomTab('results')}
                      className={tabClassName(activeBottomTab === 'results')}
                    >
                      <CheckCircle2 className="size-3" />
                      {t('workspace.resultsTab')}
                      {isSubmitBusy ? (
                        <Loader2 className="size-2.5 animate-spin text-primary" />
                      ) : null}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => bottomPanelRef.current?.collapse()}
                    className="ml-auto mr-2 flex items-center text-muted-foreground/40 transition-colors hover:text-foreground"
                  >
                    <ChevronDown size={14} />
                  </button>
                </div>

                {/* Tab content */}
                <div className="relative flex-1 overflow-auto bg-background p-3">
                  {activeBottomTab === 'testcases' ? (
                    <TestCaseEditor
                      cases={testCases}
                      activeCaseId={activeCaseId}
                      onActiveCaseChange={setActiveCaseId}
                      onCaseInputChange={handleCaseInputChange}
                      onAddCase={handleAddCase}
                      onRemoveCase={handleRemoveCase}
                      readOnly={isEditorReadOnly}
                    />
                  ) : activeBottomTab === 'output' ? (
                    <RunResultsPanel
                      multiRunState={multiRunState}
                      cases={testCases}
                      onRunCase={handleRunSingleCase}
                    />
                  ) : (
                    <SubmissionOutput submitState={submitState} />
                  )}
                </div>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>

        <ResizableHandle className="group relative w-1 bg-border transition-colors hover:bg-primary/40 active:bg-primary/60">
          <button
            type="button"
            onClick={() =>
              rightCollapsed ? rightPanelRef.current?.expand() : rightPanelRef.current?.collapse()
            }
            className="absolute top-1/2 -translate-y-1/2 -right-2.5 z-10 flex size-5 items-center justify-center rounded-full border border-border bg-card text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
          >
            {rightCollapsed ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
          </button>
        </ResizableHandle>

        {/* Right: Session Sidebar */}
        <ResizablePanel
          panelRef={rightPanelRef}
          defaultSize={25}
          minSize={15}
          collapsible
          collapsedSize="2.25rem"
          onResize={() => setRightCollapsed(rightPanelRef.current?.isCollapsed() ?? false)}
        >
          {rightCollapsed ? (
            <button
              type="button"
              onClick={() => rightPanelRef.current?.expand()}
              className="flex h-full w-full cursor-pointer flex-col items-center justify-center gap-2 border-l border-border bg-card/80 transition-colors hover:bg-primary/5"
            >
              <ChevronLeft size={14} className="text-muted-foreground/40" />
              <span className="rotate-180 font-mono text-[11px] font-medium uppercase tracking-widest text-muted-foreground/60 [writing-mode:vertical-lr]">
                {t('workspace.sessionHeading')}
              </span>
            </button>
          ) : (
            <motion.div
              ref={rightContentRef}
              className="flex h-full min-w-0 flex-col overflow-y-auto bg-card/80 backdrop-blur-sm"
              initial={rightMountedRef.current ? false : { opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              onAnimationComplete={() => {
                rightMountedRef.current = true;
              }}
            >
              <motion.div
                className={`border-b border-border ${rightNarrow ? 'p-2' : 'p-3'}`}
                initial={rightMountedRef.current ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
              >
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {t('hostControl.heading')}
                </span>
                <div className="mt-2">
                  <HostControlPanel
                    currentStatus={room.status}
                    elapsedMs={elapsedMs}
                    timerPaused={room.timerPaused}
                    editorLocked={room.editorLocked}
                    canChangePhase={room.myCapabilities.includes('room:change-phase')}
                    isPending={isTransitioning}
                    allRequiredReady={allRequiredReady}
                    onTransition={(targetStatus) => {
                      void onTransition(targetStatus);
                    }}
                  />
                </div>
              </motion.div>

              {dockedVideoPanel}

              <motion.div
                className={`shrink-0 border-b border-border ${rightNarrow ? 'p-2' : 'p-3'}`}
                initial={rightMountedRef.current ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    {rightNarrow ? `${participants.length}` : t('workspace.participantsHeading')}
                  </span>
                  {!rightNarrow ? (
                    <span className="font-mono text-[10px] text-muted-foreground/60">
                      {participants.length}
                    </span>
                  ) : null}
                </div>
                <div className="mt-2 space-y-0.5">
                  {participants.map((participant: Participant) => (
                    <RoomParticipantCard
                      key={participant.userId}
                      participant={participant}
                      currentUserId={currentUserId}
                      roomHostId={room.hostId}
                      canManageParticipants={canManageParticipants}
                      isUpdatingRole={isUpdatingRole === participant.userId}
                      isTransferringOwnership={isTransferringOwnership === participant.userId}
                      isRemovingParticipant={isRemovingParticipant === participant.userId}
                      isSpeaking={speakingMap?.get(participant.userId) ?? false}
                      isMediaConnected={mediaConnectedSet?.has(participant.userId) ?? false}
                      isMediaMuted={mediaMutedMap?.get(participant.userId) ?? false}
                      connectionQuality={
                        connectionQualityMap?.get(participant.userId) as string | undefined
                      }
                      isLocallyMuted={
                        participantMediaControls?.muteSet.has(participant.userId) ?? false
                      }
                      isVideoHidden={
                        participantMediaControls?.videoHiddenSet.has(participant.userId) ?? false
                      }
                      localVolume={participantMediaControls?.volumeMap.get(participant.userId)}
                      isSelfMicrophoneEnabled={selfMicrophoneEnabled}
                      onSelfMicrophoneToggle={onSelfMicrophoneToggle}
                      onLocalMuteToggle={
                        participantMediaControls
                          ? (muted) => participantMediaControls.setMuted(participant.userId, muted)
                          : undefined
                      }
                      onLocalVolumeChange={
                        participantMediaControls
                          ? (vol) => participantMediaControls.setVolume(participant.userId, vol)
                          : undefined
                      }
                      onVideoHiddenToggle={
                        participantMediaControls
                          ? (hidden) =>
                              participantMediaControls.setVideoHidden(participant.userId, hidden)
                          : undefined
                      }
                      onRoleChange={(uid, role) => {
                        void onParticipantRoleChange(uid, role);
                      }}
                      onTransferOwnership={onTransferOwnership}
                      onRemoveParticipant={onRemoveParticipant}
                      compact
                    />
                  ))}
                </div>
              </motion.div>

              {/* Invite link */}
              {!rightNarrow ? (
                <motion.div
                  className="p-3"
                  initial={rightMountedRef.current ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
                >
                  <InviteLinkInline inviteLink={inviteLink} />
                </motion.div>
              ) : null}
            </motion.div>
          )}
        </ResizablePanel>
      </ResizablePanelGroup>

      <RoomStatusBar
        status={room.status}
        myRole={room.myRole}
        elapsedMs={elapsedMs}
        editorLocked={room.editorLocked}
        participantCount={participants.length}
        collabStatus={collabStatus}
      />
    </div>
  );
}

type ExecutionPollResponse = ExecutionResultResponse | JobStatusResponse;

function isExecutionResultPayload(
  response: ExecutionPollResponse,
): response is ExecutionResultResponse {
  return 'stdout' in response;
}

function SubmissionOutput({ submitState }: { submitState: SubmitState }) {
  const { t } = useTranslation('rooms');

  if (submitState.status === 'idle') {
    return (
      <div className="relative flex flex-col items-center justify-center py-8 text-center">
        <div className="pointer-events-none dot-grid absolute inset-0 opacity-[0.03]" />
        <CheckCircle2 className="relative mb-2 size-5 text-muted-foreground/20" />
        <p className="relative font-mono text-xs text-muted-foreground/40">
          {t('workspace.noOutput')}
        </p>
      </div>
    );
  }

  if (submitState.status === 'submitting') {
    return (
      <div className="flex items-center gap-2">
        <Loader2 className="size-3 animate-spin text-primary" />
        <span className="font-mono text-xs text-muted-foreground">{t('workspace.submitting')}</span>
      </div>
    );
  }

  if (submitState.status === 'polling') {
    return (
      <div className="flex items-center gap-2">
        <Loader2 className="size-3 animate-spin text-primary" />
        <span className="font-mono text-xs text-primary/80">
          {t('workspace.submissionPolling')}
        </span>
        <span className="terminal-cursor" />
      </div>
    );
  }

  if (submitState.status === 'request-error') {
    return <p className="font-mono text-xs text-destructive">{submitState.message}</p>;
  }

  return <ExecutionDetailsPanel details={submitState.details} />;
}

const SUBMIT_ERROR_KEYS: Partial<Record<string, string>> = {
  [ERROR_CODES.ROOM_EDITOR_LOCKED]: 'workspace.editorLockedError',
  [ERROR_CODES.ROOM_PERMISSION_DENIED]: 'workspace.permissionDenied',
  [ERROR_CODES.ROOM_ACCESS_DENIED]: 'workspace.permissionDenied',
  [ERROR_CODES.PROBLEM_NOT_FOUND]: 'workspace.problemNotFound',
  [ERROR_CODES.PROBLEM_NO_TEST_CASES]: 'workspace.noProblemTestCases',
};
