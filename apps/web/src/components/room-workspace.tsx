import Editor from '@monaco-editor/react';
import { CONTROL_API } from '@syncode/contracts';
import type { RoomRole, RoomStatus } from '@syncode/shared';
import { Badge, Button } from '@syncode/ui';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Loader2,
  Minus,
  Play,
  X,
  XCircle,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Separator as ResizableHandle,
  Panel as ResizablePanel,
  Group as ResizablePanelGroup,
} from 'react-resizable-panels';
import { toast } from 'sonner';
import { api, readApiError } from '@/lib/api-client.js';
import { buildInviteLink, isPeerRoleConfigurationValid } from '@/lib/room-stage.js';
import { HostControlPanel } from './host-control-panel.js';
import { InviteLinkInline } from './invite-link-inline.js';
import { RoomHeaderBar } from './room-header-bar.js';
import { type Participant, RoomParticipantCard } from './room-participant-card.js';
import { type ProblemData, RoomProblemPanel } from './room-problem-panel.js';
import { RoomStatusBar } from './room-status-bar.js';
import {
  EDITOR_LOADING,
  EDITOR_OPTIONS_BASE,
  EXECUTION_POLL_INTERVAL_MS,
  ExecutionOutput,
  getDefaultCode,
  handleEditorWillMount,
  languageExtension,
  type RunState,
} from './room-workspace-utils.js';
import { StageTransitionOverlay } from './stage-transition-overlay.js';

type RoomDetail = Awaited<ReturnType<typeof api<typeof CONTROL_API.ROOMS.GET>>>;
type ProblemDetail = Awaited<ReturnType<typeof api<typeof CONTROL_API.PROBLEMS.GET_BY_ID>>>;
type ExecutionPollResponse = Awaited<
  ReturnType<typeof api<typeof CONTROL_API.EXECUTION.GET_RESULT>>
>;

interface RoomWorkspaceProps {
  room: RoomDetail;
  currentUserId: string | null;
  roomId: string;
  elapsedMs: number;
  isTransitioning: boolean;
  onTransition: (targetStatus: RoomStatus) => Promise<void>;
  onParticipantRoleChange: (userId: string, role: RoomRole) => Promise<void>;
  onTransferOwnership: (userId: string, displayName: string) => Promise<void>;
  isUpdatingRole: string | null;
  isTransferringOwnership: string | null;
}

export function RoomWorkspace({
  room,
  currentUserId,
  roomId,
  elapsedMs,
  isTransitioning,
  onTransition,
  onParticipantRoleChange,
  onTransferOwnership,
  isUpdatingRole,
  isTransferringOwnership,
}: RoomWorkspaceProps) {
  const { t } = useTranslation('rooms');

  const [problem, setProblem] = useState<ProblemDetail | null>(null);
  const [problemLoading, setProblemLoading] = useState(!!room.problemId);
  const [problemError, setProblemError] = useState<string | null>(null);
  const codeInitializedRef = useRef(false);

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
  const [workspaceCode, setWorkspaceCode] = useState(() => getDefaultCode(language));
  const [workspaceInput, setWorkspaceInput] = useState('');
  const [runState, setRunState] = useState<RunState>({ status: 'idle' });
  const [stdinExpanded, setStdinExpanded] = useState(false);
  const cancelPollRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (codeInitializedRef.current || !problem) return;
    const starterCode = problem.starterCode?.[language];
    if (starterCode) {
      setWorkspaceCode(starterCode);
      codeInitializedRef.current = true;
    }
  }, [problem, language]);

  useEffect(() => {
    return () => {
      cancelPollRef.current?.();
    };
  }, []);

  const amHost = Boolean(currentUserId && room.hostId === currentUserId);
  const canRunCode = room.myCapabilities.includes('code:run');
  const canEditCode = room.myCapabilities.includes('code:edit');
  const canManageParticipants = room.myCapabilities.includes('participant:assign-role');
  const isEditorReadOnly = !canEditCode || room.editorLocked || room.status === 'finished';

  const participants = useMemo(
    () => room.participants.filter((p: Participant) => p.isActive),
    [room.participants],
  );
  const isRoomValid = useMemo(() => isPeerRoleConfigurationValid(participants), [participants]);

  const inviteLink = room.roomCode ? buildInviteLink(roomId, room.roomCode) : window.location.href;

  const isRunBusy =
    runState.status === 'submitting' ||
    runState.status === 'queued' ||
    runState.status === 'running';
  const runDisabled = !canRunCode || isEditorReadOnly || isRunBusy;

  const editorOptions = useMemo(
    () => ({ ...EDITOR_OPTIONS_BASE, readOnly: isEditorReadOnly }),
    [isEditorReadOnly],
  );

  const handleEditorChange = useCallback((value: string | undefined) => {
    if (value !== undefined) setWorkspaceCode(value);
  }, []);

  const handleRunCode = async () => {
    cancelPollRef.current?.();
    setRunState({ status: 'submitting' });

    try {
      const response = await api(CONTROL_API.ROOMS.RUN, {
        params: { id: roomId },
        body: {
          language,
          code: workspaceCode,
          stdin: workspaceInput || undefined,
        },
      });

      setRunState({ status: 'queued', jobId: response.jobId });
      cancelPollRef.current = pollExecution(response.jobId);
    } catch (error) {
      const apiError = await readApiError(error);
      setRunState({
        status: 'request-error',
        message: apiError?.message ?? t('workspace.runFailed'),
      });
      toast.error(apiError?.message ?? t('workspace.runFailed'));
    }
  };

  const pollExecution = (jobId: string) => {
    let cancelled = false;

    const poll = async () => {
      try {
        const response = await api(CONTROL_API.EXECUTION.GET_RESULT, {
          params: { jobId },
        });

        if (cancelled) return;

        if (isExecutionResultPayload(response)) {
          setRunState({
            status: response.status,
            jobId,
            stdout: response.stdout,
            stderr: response.stderr,
            exitCode: response.exitCode,
            durationMs: response.durationMs,
            error: response.error,
          });
          return;
        }

        if (response.status === 'queued' || response.status === 'running') {
          setRunState({ status: response.status, jobId });
          setTimeout(() => {
            if (!cancelled) void poll();
          }, EXECUTION_POLL_INTERVAL_MS);
          return;
        }

        setRunState({ status: 'request-error', message: t('workspace.runFailed') });
      } catch (error) {
        const apiError = await readApiError(error);
        if (!cancelled) {
          setRunState({
            status: 'request-error',
            message: apiError?.message ?? t('workspace.runFailed'),
          });
        }
      }
    };

    void poll();

    return () => {
      cancelled = true;
    };
  };

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
      />

      {/* Main resizable 3-panel area */}
      <ResizablePanelGroup orientation="horizontal" style={{ flex: 1 }}>
        {/* Left: Problem Panel */}
        {room.problemId ? (
          <>
            <ResizablePanel defaultSize={25} minSize={10} collapsible collapsedSize={3}>
              <RoomProblemPanel
                problem={problemPanelData}
                loading={problemLoading}
                error={problemError}
                hasProblem
              />
            </ResizablePanel>
            <ResizableHandle className="w-1 bg-border transition-colors hover:bg-primary/40 active:bg-primary/60" />
          </>
        ) : null}

        {/* Center: Editor + Output (vertically resizable) */}
        <ResizablePanel defaultSize={room.problemId ? 50 : 75} minSize={20}>
          <ResizablePanelGroup orientation="vertical">
            {/* Editor panel */}
            <ResizablePanel defaultSize={65} minSize={20}>
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
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/50">
                      {language}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      disabled={runDisabled}
                      onClick={() => void handleRunCode()}
                      className={`h-7 gap-1.5 px-3 text-xs font-medium ${runDisabled ? '' : 'run-glow'}`}
                    >
                      {isRunBusy ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <Play className="size-3 fill-current" />
                      )}
                      {t('workspace.runCode')}
                    </Button>
                  </div>
                </div>

                {/* Monaco editor */}
                <div className="flex-1 overflow-hidden">
                  <Editor
                    height="100%"
                    language={language}
                    value={workspaceCode}
                    onChange={handleEditorChange}
                    theme="syncode-dark"
                    beforeMount={handleEditorWillMount}
                    options={editorOptions}
                    loading={EDITOR_LOADING}
                  />
                </div>

                {/* Collapsible stdin */}
                <div className="border-t border-border bg-card">
                  <button
                    type="button"
                    onClick={() => setStdinExpanded((prev) => !prev)}
                    className="flex h-7 w-full items-center gap-1.5 px-3 text-[10px] font-medium uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {stdinExpanded ? <ChevronDown size={10} /> : <ChevronUp size={10} />}
                    {t('workspace.stdinHeading')}
                  </button>
                  {stdinExpanded ? (
                    <div className="border-t border-border/60">
                      <textarea
                        value={workspaceInput}
                        onChange={(e) => setWorkspaceInput(e.target.value)}
                        spellCheck={false}
                        rows={3}
                        className="w-full resize-none bg-transparent px-3 py-2 font-mono text-xs text-foreground outline-none placeholder:text-muted-foreground/50"
                        placeholder={t('workspace.stdinPlaceholder')}
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            </ResizablePanel>

            <ResizableHandle className="h-1 bg-border transition-colors hover:bg-primary/40 active:bg-primary/60" />

            {/* Output panel */}
            <ResizablePanel defaultSize={35} minSize={10}>
              <div className="flex h-full flex-col">
                {/* Terminal header */}
                <div className="flex h-8 shrink-0 items-center gap-2 border-b border-border bg-card px-3">
                  <div className="flex items-center gap-1.5">
                    <Circle className="size-2.5 fill-destructive/60 text-destructive/60" />
                    <Minus className="size-2.5 text-warning/60" />
                    <X className="size-2.5 text-muted-foreground/40" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <TerminalSquare className="size-3 text-muted-foreground/60" />
                    <span className="font-mono text-[10px] text-muted-foreground/60">
                      {t('workspace.outputHeading')}
                    </span>
                  </div>
                  {runState.status === 'completed' || runState.status === 'failed' ? (
                    <div className="ml-auto flex items-center gap-2 text-[10px]">
                      {runState.status === 'completed' ? (
                        <span className="flex items-center gap-1 text-success">
                          <CheckCircle2 size={11} />
                          {t('workspace.executionComplete')}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-destructive">
                          <XCircle size={11} />
                          {t('workspace.executionFailed')}
                        </span>
                      )}
                      <span className="font-mono text-muted-foreground/50">
                        exit {runState.exitCode} &middot; {runState.durationMs}ms
                      </span>
                    </div>
                  ) : null}
                </div>

                <div className="relative flex-1 overflow-auto bg-background p-3">
                  <div className="pointer-events-none absolute inset-0 scan-lines" />
                  <ExecutionOutput runState={runState} />
                </div>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>

        <ResizableHandle className="w-1 bg-border transition-colors hover:bg-primary/40 active:bg-primary/60" />

        {/* Right: Session Sidebar */}
        <ResizablePanel defaultSize={25} minSize={15}>
          <motion.div
            className="flex h-full flex-col overflow-y-auto bg-card/80 backdrop-blur-sm"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Host control section */}
            <motion.div
              className="border-b border-border p-3"
              initial={{ opacity: 0, y: 8 }}
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
                  isRoomValid={isRoomValid}
                  isPending={isTransitioning}
                  onTransition={(targetStatus) => {
                    void onTransition(targetStatus);
                  }}
                />
              </div>
            </motion.div>

            {/* Participants */}
            <motion.div
              className="flex-1 border-b border-border p-3"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {t('workspace.participantsHeading')}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground/60">
                  {participants.length}
                </span>
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
                    onRoleChange={(uid, role) => {
                      void onParticipantRoleChange(uid, role);
                    }}
                    onTransferOwnership={(uid, name) => {
                      void onTransferOwnership(uid, name);
                    }}
                    compact
                  />
                ))}
              </div>
            </motion.div>

            {/* Invite link */}
            <motion.div
              className="p-3"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <InviteLinkInline inviteLink={inviteLink} />
            </motion.div>
          </motion.div>
        </ResizablePanel>
      </ResizablePanelGroup>

      <RoomStatusBar
        status={room.status}
        myRole={room.myRole}
        elapsedMs={elapsedMs}
        editorLocked={room.editorLocked}
        participantCount={participants.length}
      />
    </div>
  );
}

function isExecutionResultPayload(
  response: ExecutionPollResponse,
): response is Extract<ExecutionPollResponse, { stdout: string }> {
  return 'stdout' in response;
}
