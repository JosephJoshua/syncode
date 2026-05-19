import {
  type AiInterviewCodeContext,
  type AiInterviewExecutionSummary,
  type AiInterviewInteractionSignals,
  type AiInterviewProactiveReason,
  type AiInterviewRequestTrigger,
  type ChatAttachment,
  type ChatMessage,
  type ChatReactToggleEventData,
  type ChatSendEventData,
  CONTROL_API,
  ERROR_CODES,
  type ExecutionDetailsResponse,
  type ExecutionResultResponse,
  type GetRoomAiHintResultResponse,
  type GetRoomAiInterviewResultResponse,
  type JobStatusResponse,
  type ProblemDetail,
  type RoomDetail,
} from '@syncode/contracts';
import type { RoomRole, RoomStatus, SupportedLanguage } from '@syncode/shared';
import { Avatar, AvatarFallback, AvatarImage, Badge, Button, cn } from '@syncode/ui';
import {
  Bot,
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
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
import { useInlineComments } from '@/hooks/use-inline-comments.js';
import { useSharedExecution } from '@/hooks/use-shared-execution.js';
import type { CollabConnectionStatus } from '@/hooks/use-yjs-collab.js';
import { api, readApiError, resolveErrorMessage } from '@/lib/api-client.js';
import {
  MOCK_INLINE_COMMENTS,
  MOCK_WORKSPACE_CODE,
  MOCK_WORKSPACE_PROBLEM,
  MOCK_WORKSPACE_TEST_CASES,
} from '@/lib/mock-workspace.js';
import { allRequiredPeersReady } from '@/lib/participant-readiness.js';
import { buildInviteLink } from '@/lib/room-stage.js';
import { authorColor } from '@/lib/whiteboard-author-color.js';
import { codeTextKey } from '@/lib/yjs-collab-provider.js';
import { CollaborativeEditor, type EditorCodeContext } from './collaborative-editor.js';
import { ExecutionDetailsPanel } from './execution-details-panel.js';
import { FloatingWhiteboardPanel } from './floating-whiteboard-panel.js';
import { HostControlPanel } from './host-control-panel.js';
import { InviteLinkInline } from './invite-link-inline.js';
import { LanguagePicker } from './language-picker.js';
import { LANGUAGE_VERSIONED_LABELS } from './language-selector.data.js';
import { type AiInterviewMessage, RoomAiInterviewPanel } from './room-ai-interview-panel.js';
import { RoomChatPanel } from './room-chat-panel.js';
import { RoomHeaderBar } from './room-header-bar.js';
import { type Participant, RoomParticipantCard } from './room-participant-card.js';
import { type ProblemData, type RoomHintItem, RoomProblemPanel } from './room-problem-panel.js';
import { RoomStatusBar } from './room-status-bar.js';
import { shouldEnableWhiteboardKeyboardShortcuts } from './room-whiteboard-keyboard.js';
import { RoomWhiteboardPanel } from './room-whiteboard-panel.js';
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
import { SubmissionPreviewModal } from './submission-preview-modal.js';
import { TestCaseEditor } from './testcase-editor.js';

interface RoomWorkspaceProps {
  room: RoomDetail;
  currentUserId: string | null;
  roomId: string;
  doc: Y.Doc | null;
  awareness: Awareness | null;
  chatMessages: ChatMessage[];
  chatReadAtByUserId: Record<string, number>;
  onSendChatMessage: (data: ChatSendEventData) => void;
  onToggleChatReaction: (data: ChatReactToggleEventData) => void;
  onMarkChatRead: (upTo?: number) => void;
  onUploadChatMedia: (file: File) => Promise<ChatAttachment>;
  elapsedMs: number;
  isTransitioning: boolean;
  isLockingEditor: boolean;
  isUnlockingEditor: boolean;
  onTransition: (targetStatus: RoomStatus) => Promise<void>;
  onLockEditor: () => void;
  onUnlockEditor: () => void;
  onRoomUpdated: (room: RoomDetail) => void;
  onParticipantRoleChange: (userId: string, role: RoomRole) => Promise<void>;
  onTransferOwnership: (userId: string, displayName: string) => void;
  onRemoveParticipant: (userId: string, displayName: string) => void;
  isUpdatingRole: string | null;
  isTransferringOwnership: string | null;
  isRemovingParticipant: string | null;
  collabStatus: CollabConnectionStatus;
  currentUserName: string;
  isMockPreview?: boolean;
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

interface CasePollDeps {
  readonly caseId: string;
  readonly jobId: string;
  readonly expectedOutput: string | null;
  readonly token: { cancelled: boolean };
  readonly setMultiRunState: React.Dispatch<React.SetStateAction<MultiRunState>>;
  readonly t: (key: string) => string;
}

async function executeCasePoll(deps: CasePollDeps): Promise<void> {
  const { caseId, jobId, expectedOutput, token, setMultiRunState, t } = deps;
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
        if (!token.cancelled) executeCasePoll(deps).catch(() => undefined);
      }, EXECUTION_POLL_INTERVAL_MS);
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
}

export function RoomWorkspace({
  room,
  currentUserId,
  roomId,
  doc,
  awareness,
  chatMessages,
  chatReadAtByUserId,
  onSendChatMessage,
  onToggleChatReaction,
  onMarkChatRead,
  onUploadChatMedia,
  elapsedMs,
  isTransitioning,
  isLockingEditor,
  isUnlockingEditor,
  onTransition,
  onLockEditor,
  onUnlockEditor,
  onRoomUpdated,
  onParticipantRoleChange,
  onTransferOwnership,
  onRemoveParticipant,
  isUpdatingRole,
  isTransferringOwnership,
  isRemovingParticipant,
  collabStatus,
  currentUserName,
  isMockPreview = false,
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
  const [activeProblemTab, setActiveProblemTab] = useState<'problem' | 'hints'>('problem');
  const [hintHistory, setHintHistory] = useState<RoomHintItem[]>([]);
  const [hintLoading, setHintLoading] = useState(false);
  const [hintFollowUpLoadingHintId, setHintFollowUpLoadingHintId] = useState<string | null>(null);
  const [hintError, setHintError] = useState<string | null>(null);

  const [aiInterviewMessages, setAiInterviewMessages] = useState<AiInterviewMessage[]>([]);
  const [aiInterviewLoading, setAiInterviewLoading] = useState(false);
  const [aiInterviewError, setAiInterviewError] = useState<string | null>(null);
  const [unreadInterviewCount, setUnreadInterviewCount] = useState(0);
  const [editorCodeContext, setEditorCodeContext] = useState<EditorCodeContext | null>(null);
  const [latestRunSummary, setLatestRunSummary] = useState<AiInterviewExecutionSummary | null>(
    null,
  );
  const previousRoomIdRef = useRef(roomId);
  const aiInterviewRequestSeqRef = useRef(0);
  const aiInterviewInFlightRef = useRef(false);
  const aiInterviewLastProactiveAtRef = useRef(0);
  const aiInterviewLastHintCountRef = useRef(0);
  const aiInterviewLastUserMessageAtRef = useRef<number | null>(null);
  const aiInterviewLastAssistantMessageAtRef = useRef<number | null>(null);
  const aiInterviewLastEditorActivityAtRef = useRef<number | null>(null);
  const aiInterviewRecentEditorChangesRef = useRef(0);
  const aiInterviewSeenMessageIdsRef = useRef<Set<string>>(new Set());
  const aiInterviewToastInitializedRef = useRef(false);
  const aiInterviewReadMessageIdsRef = useRef<Set<string>>(new Set());

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
  const [submissionPreviewCode, setSubmissionPreviewCode] = useState<string | null>(null);
  const [activeBottomTab, setActiveBottomTab] = useState<'testcases' | 'output' | 'results'>(
    'testcases',
  );
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [rightNarrow, setRightNarrow] = useState(false);
  const [activeRightTab, setActiveRightTab] = useState<'participants' | 'chat' | 'interview'>(
    'participants',
  );

  useEffect(() => {
    if (room.mode !== 'ai' && activeRightTab === 'interview') {
      setActiveRightTab('participants');
    }
  }, [activeRightTab, room.mode]);

  const cancelAiInterviewPolling = useCallback(() => {
    aiInterviewRequestSeqRef.current += 1;
    aiInterviewInFlightRef.current = false;
  }, []);

  useLayoutEffect(() => {
    if (previousRoomIdRef.current === roomId) {
      return;
    }

    previousRoomIdRef.current = roomId;
    cancelAiInterviewPolling();
    setAiInterviewLoading(false);
    setAiInterviewError(null);
    setAiInterviewMessages([]);
    setUnreadInterviewCount(0);
    setEditorCodeContext(null);
    setLatestRunSummary(null);
    aiInterviewLastProactiveAtRef.current = 0;
    aiInterviewLastHintCountRef.current = 0;
    aiInterviewLastUserMessageAtRef.current = null;
    aiInterviewLastAssistantMessageAtRef.current = null;
    aiInterviewLastEditorActivityAtRef.current = null;
    aiInterviewRecentEditorChangesRef.current = 0;
    aiInterviewSeenMessageIdsRef.current.clear();
    aiInterviewReadMessageIdsRef.current.clear();
    aiInterviewToastInitializedRef.current = false;
  }, [cancelAiInterviewPolling, roomId]);

  useLayoutEffect(() => {
    return () => {
      cancelAiInterviewPolling();
    };
  }, [cancelAiInterviewPolling]);

  useLayoutEffect(() => {
    if (room.mode === 'ai' && AI_INTERVIEW_ALLOWED_STATUSES.has(room.status)) {
      return;
    }

    cancelAiInterviewPolling();
    setAiInterviewLoading(false);
    setAiInterviewError(null);
    setAiInterviewMessages([]);
    setEditorCodeContext(null);
  }, [cancelAiInterviewPolling, room.mode, room.status]);

  const [bottomCollapsed, setBottomCollapsed] = useState(false);
  const [activeCenterTab, setActiveCenterTab] = useState<'code' | 'whiteboard'>('code');
  const [whiteboardViewMode, setWhiteboardViewMode] = useState<'tab' | 'floating'>('tab');
  const [inlineWhiteboardHost, setInlineWhiteboardHost] = useState<HTMLDivElement | null>(null);
  const [floatingWhiteboardHost, setFloatingWhiteboardHost] = useState<HTMLDivElement | null>(null);
  const [whiteboardParkingHost, setWhiteboardParkingHost] = useState<HTMLDivElement | null>(null);
  const [isCodeEditorFocused, setIsCodeEditorFocused] = useState(false);
  const [whiteboardHasKeyboardFocus, setWhiteboardHasKeyboardFocus] = useState(false);
  const [_activeCommentLine, _setActiveCommentLine] = useState(1);
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
  const isWhiteboardKeyboardActive = shouldEnableWhiteboardKeyboardShortcuts({
    activeCenterTab,
    whiteboardViewMode,
    isCodeEditorFocused,
    whiteboardHasKeyboardFocus,
  });
  const markWhiteboardKeyboardFocus = useCallback(() => {
    setWhiteboardHasKeyboardFocus(true);
    setIsCodeEditorFocused(false);
  }, []);

  useEffect(() => {
    const sourceCases = problem?.testCases ?? (isMockPreview ? MOCK_WORKSPACE_TEST_CASES : null);
    if (!sourceCases) return;

    const entries: TestCaseEntry[] = sourceCases.map((tc, i) => ({
      id: `problem-${i}`,
      input: tc.input,
      expectedOutput: tc.expectedOutput,
      label: t('workspace.testcaseTab', { index: i + 1 }),
      fromProblem: true,
    }));
    setTestCases(entries);
    if (entries.length > 0) setActiveCaseId(entries[0]?.id ?? '');
  }, [isMockPreview, problem, t]);

  useEffect(() => {
    return () => {
      cancelSubmitPollRef.current?.();
      for (const cancel of cancelMultiRunRef.current.values()) cancel();
    };
  }, []);

  const { comments, commentLineNumbers, addComment } = useInlineComments(doc, language);
  const seededMockCodeRef = useRef(false);
  const seededMockCommentsRef = useRef(false);

  useEffect(() => {
    if (!doc || !isMockPreview || seededMockCodeRef.current) {
      return;
    }

    const codeText = doc.getText(codeTextKey(language));
    if (codeText.length === 0) {
      doc.transact(() => {
        codeText.insert(0, MOCK_WORKSPACE_CODE);
      });
    }

    seededMockCodeRef.current = true;
  }, [doc, isMockPreview, language]);

  useEffect(() => {
    if (!doc || !isMockPreview || seededMockCommentsRef.current || comments.length > 0) {
      return;
    }

    for (const comment of MOCK_INLINE_COMMENTS) {
      addComment({
        authorId: 'mock-reviewer',
        authorName: 'Mock Interviewer',
        content: comment.content,
        lineNumber: comment.lineNumber,
      });
    }

    seededMockCommentsRef.current = true;
  }, [addComment, comments.length, doc, isMockPreview]);

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
  const canChangePhase = room.myCapabilities.includes('room:change-phase');
  const canControlEditorLock = canChangePhase;
  const canRunCode = !isMockPreview && room.myCapabilities.includes('code:run');
  const canEditCode = room.myCapabilities.includes('code:edit');
  const canSendChat = room.myCapabilities.includes('chat:send');
  const canRequestHint = room.myCapabilities.includes('ai:request-hint');
  const canSendInterviewMessage =
    canRequestHint && room.mode === 'ai' && AI_INTERVIEW_ALLOWED_STATUSES.has(room.status);
  const canManageParticipants = room.myCapabilities.includes('participant:assign-role');
  const isEditorReadOnly = !canEditCode || room.editorLocked || room.status === 'finished';

  const participants = useMemo(
    () => room.participants.filter((p: Participant) => p.isActive),
    [room.participants],
  );
  const participantsById = useMemo(
    () => new Map(participants.map((participant) => [participant.userId, participant])),
    [participants],
  );
  const inviteLink = room.roomCode
    ? buildInviteLink(roomId, room.roomCode)
    : globalThis.window.location.href;

  const canSubmitCode =
    !isMockPreview && room.myCapabilities.includes('code:submit') && !!room.problemId;

  const currentUserReadAt = currentUserId ? (chatReadAtByUserId[currentUserId] ?? 0) : 0;
  const unreadChatCount = useMemo(
    () =>
      currentUserId
        ? chatMessages.filter(
            (message) => message.userId !== currentUserId && message.createdAt > currentUserReadAt,
          ).length
        : 0,
    [chatMessages, currentUserId, currentUserReadAt],
  );
  const seenChatMessageIdsRef = useRef<Set<string>>(new Set());
  const chatToastInitializedRef = useRef(false);
  const chatDingAudioContextRef = useRef<AudioContext | null>(null);

  const playIncomingChatDing = useCallback(() => {
    const AudioContextCtor =
      window.AudioContext ??
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) {
      return;
    }

    const context = chatDingAudioContextRef.current ?? new AudioContextCtor();
    chatDingAudioContextRef.current = context;

    if (context.state === 'suspended') {
      void context.resume();
    }

    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(1046.5, now);
    oscillator.frequency.exponentialRampToValueAtTime(880, now + 0.12);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.09, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.22);
  }, []);

  useEffect(() => {
    if (!currentUserId || activeRightTab !== 'chat') {
      return;
    }

    const latestIncoming = chatMessages.reduce((latest, message) => {
      if (message.userId === currentUserId) {
        return latest;
      }
      return Math.max(latest, message.createdAt);
    }, 0);

    if (latestIncoming > currentUserReadAt) {
      onMarkChatRead(latestIncoming);
    }
  }, [activeRightTab, chatMessages, currentUserId, currentUserReadAt, onMarkChatRead]);

  useEffect(() => {
    return () => {
      const context = chatDingAudioContextRef.current;
      if (!context) {
        return;
      }

      void context.close();
      chatDingAudioContextRef.current = null;
    };
  }, []);

  useEffect(() => {
    const seen = seenChatMessageIdsRef.current;
    if (!chatToastInitializedRef.current) {
      for (const message of chatMessages) {
        seen.add(message.messageId);
      }
      chatToastInitializedRef.current = true;
      return;
    }

    const newMessages = chatMessages.filter((message) => {
      if (seen.has(message.messageId)) {
        return false;
      }
      seen.add(message.messageId);
      return true;
    });

    if (newMessages.length === 0 || activeRightTab === 'chat') {
      return;
    }

    const incomingFromOthers = newMessages.filter(
      (message) => currentUserId && message.userId !== currentUserId,
    );
    if (incomingFromOthers.length > 0) {
      playIncomingChatDing();
    }

    for (const message of incomingFromOthers) {
      if (!currentUserId || message.userId === currentUserId) {
        continue;
      }

      const sender = participantsById.get(message.userId);
      const senderName =
        sender?.displayName ?? sender?.username ?? t('workspace.chatUnknownSender');
      const preview = message.text.trim() || t('workspace.chatAttachmentOnly');
      toast(
        <div className="flex min-w-0 items-start gap-2">
          <Avatar className="size-7 shrink-0">
            {sender?.avatarUrl ? <AvatarImage src={sender.avatarUrl} /> : null}
            <AvatarFallback className="bg-primary/20 text-[10px] text-primary">
              {senderName.slice(0, 1).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-primary">{senderName}</p>
            <p className="line-clamp-1 text-xs text-foreground">{preview}</p>
          </div>
        </div>,
        {
          duration: 3000,
          className:
            'chat-notification-toast !bg-muted !border-border !text-foreground !opacity-100',
          style: {
            background: 'var(--muted)',
            color: 'var(--foreground)',
            border: '1px solid var(--border)',
          },
        },
      );
    }
  }, [activeRightTab, chatMessages, currentUserId, participantsById, playIncomingChatDing, t]);

  useEffect(() => {
    const read = aiInterviewReadMessageIdsRef.current;
    if (activeRightTab === 'interview') {
      for (const [index, message] of aiInterviewMessages.entries()) {
        if (message.role !== 'assistant') {
          continue;
        }
        if (message.isStreaming) {
          continue;
        }
        read.add(getAiInterviewMessageStableId(message, index));
      }
      setUnreadInterviewCount(0);
      return;
    }

    const unreadCount = aiInterviewMessages.reduce((count, message, index) => {
      if (message.role !== 'assistant') {
        return count;
      }
      if (message.isStreaming) {
        return count;
      }
      return read.has(getAiInterviewMessageStableId(message, index)) ? count : count + 1;
    }, 0);
    setUnreadInterviewCount(unreadCount);
  }, [activeRightTab, aiInterviewMessages]);

  useEffect(() => {
    const seen = aiInterviewSeenMessageIdsRef.current;
    if (!aiInterviewToastInitializedRef.current) {
      for (const [index, message] of aiInterviewMessages.entries()) {
        seen.add(getAiInterviewMessageStableId(message, index));
      }
      aiInterviewToastInitializedRef.current = true;
      return;
    }

    const newAssistantMessages = aiInterviewMessages.filter((message, index) => {
      const id = getAiInterviewMessageStableId(message, index);
      if (message.isStreaming) {
        return false;
      }
      if (seen.has(id)) {
        return false;
      }
      seen.add(id);
      return message.role === 'assistant';
    });

    if (newAssistantMessages.length === 0) {
      return;
    }

    if (activeRightTab === 'interview') {
      return;
    }

    playIncomingChatDing();
    for (const message of newAssistantMessages) {
      toast(
        <div className="flex min-w-0 items-start gap-2">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/20">
            <Bot className="size-3.5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-primary">
              {t('workspace.aiInterviewHeading')}
            </p>
            <p className="line-clamp-2 text-xs text-foreground">
              {message.content.trim() || t('workspace.aiInterviewSending')}
            </p>
          </div>
        </div>,
        {
          duration: 3500,
          className:
            'chat-notification-toast !bg-muted !border-border !text-foreground !opacity-100',
          style: {
            background: 'var(--muted)',
            color: 'var(--foreground)',
            border: '1px solid var(--border)',
          },
        },
      );
    }
  }, [activeRightTab, aiInterviewMessages, playIncomingChatDing, t]);

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
  const isSubmissionPreviewOpen = submissionPreviewCode !== null;

  const getCode = useCallback(() => {
    return doc?.getText(codeTextKey(language)).toString() ?? '';
  }, [doc, language]);

  useEffect(() => {
    if (!doc || room.mode !== 'ai') {
      return;
    }
    const text = doc.getText(codeTextKey(language));
    const observer = () => {
      aiInterviewLastEditorActivityAtRef.current = Date.now();
      aiInterviewRecentEditorChangesRef.current += 1;
    };
    text.observe(observer);
    return () => {
      text.unobserve(observer);
    };
  }, [doc, language, room.mode]);

  const handleRunCode = async () => {
    if (testCases.length === 0) return;

    for (const cancel of cancelMultiRunRef.current.values()) cancel();
    cancelMultiRunRef.current.clear();
    setActiveBottomTab('output');
    setLatestRunSummary(createPendingInterviewExecutionSummary(testCases.length));

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
    executeCasePoll({ caseId, jobId, expectedOutput, token, setMultiRunState, t }).catch(
      () => undefined,
    );
  };

  const pollSubmission = useCallback(
    (submissionId: string) => {
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

          // Still pending/running — keep polling until the submission reaches a terminal state
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
    },
    [t],
  );

  const handleSubmitCode = useCallback(
    async (codeOverride?: string) => {
      cancelSubmitPollRef.current?.();
      setSubmitState({ status: 'submitting' });
      setActiveBottomTab('results');

      try {
        const response = await api(CONTROL_API.ROOMS.SUBMIT, {
          params: { id: roomId },
          body: { language, code: codeOverride ?? getCode() },
        });

        setSubmitState({ status: 'polling', submissionId: response.submissionId });
        cancelSubmitPollRef.current = pollSubmission(response.submissionId);
        broadcastSubmit(currentUserName, response.submissionId);
      } catch (error) {
        const apiError = await readApiError(error);
        const message = resolveErrorMessage(
          apiError,
          SUBMIT_ERROR_KEYS,
          'workspace.submitFailed',
          t,
        );
        setSubmitState({ status: 'request-error', message });
        toast.error(message);
      }
    },
    [broadcastSubmit, currentUserName, getCode, language, pollSubmission, roomId, t],
  );

  const requestSubmitCode = useCallback(() => {
    if (submitDisabled) return;
    setSubmissionPreviewCode(getCode());
  }, [getCode, submitDisabled]);

  const closeSubmissionPreview = useCallback(() => {
    setSubmissionPreviewCode(null);
  }, []);

  const confirmSubmitPreview = useCallback(() => {
    if (submitDisabled || submissionPreviewCode === null) return;

    const codeSnapshot = submissionPreviewCode;
    setSubmissionPreviewCode(null);
    void handleSubmitCode(codeSnapshot);
  }, [submissionPreviewCode, submitDisabled, handleSubmitCode]);

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

    setLatestRunSummary(createPendingInterviewExecutionSummary(1));
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
  const requestSubmitCodeRef = useRef(requestSubmitCode);
  requestSubmitCodeRef.current = requestSubmitCode;

  // Show remote results when local user is idle
  const multiRunResults = pickMultiRunResults(multiRunState, remoteRun?.multiRunState);

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

  useEffect(() => {
    if (multiRunState.status !== 'completed') {
      return;
    }

    setLatestRunSummary(buildRunInterviewExecutionSummary(multiRunState.results));
  }, [multiRunState]);

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
  const displayProblemPanelData =
    problemPanelData ?? (isMockPreview ? MOCK_WORKSPACE_PROBLEM : null);
  const showProblemPanel = Boolean(displayProblemPanelData);

  const handleRequestHint = useCallback(async () => {
    setHintLoading(true);
    setHintError(null);
    setActiveProblemTab('hints');

    try {
      const submission = await api(CONTROL_API.ROOMS.AI_HINT, {
        params: { id: roomId },
        body: {
          code: getCode() || ' ',
          language,
          hintLevel: 'subtle',
        },
      });

      const result = await pollAiHintResult(roomId, submission.jobId);

      setHintHistory((prev) => [
        {
          id: result.hintId,
          hint: result.hint,
          suggestedApproach: result.suggestedApproach,
          reflectionPrompt: result.reflectionPrompt,
          createdAt: Date.now(),
        },
        ...prev,
      ]);
    } catch (error) {
      if (error instanceof AiHintTimeoutError || error instanceof AiHintFailedError) {
        const message = t('workspace.hintUnavailable');
        setHintError(message);
        toast.error(message);
      } else {
        const apiError = await readApiError(error);
        const message = resolveErrorMessage(apiError, HINT_ERROR_KEYS, 'workspace.hintFailed', t);
        setHintError(message);
        toast.error(message);
      }
    } finally {
      setHintLoading(false);
    }
  }, [getCode, language, roomId, t]);

  const handleSubmitHintReflection = useCallback(
    async (hintId: string, reflectionResponse: string | null) => {
      setHintFollowUpLoadingHintId(hintId);
      setHintError(null);
      setActiveProblemTab('hints');

      try {
        const submission = await api(CONTROL_API.ROOMS.AI_HINT, {
          params: { id: roomId },
          body: {
            code: getCode() || ' ',
            language,
            hintLevel: 'subtle',
            followUpToHintId: hintId,
            reflectionResponse: reflectionResponse ?? undefined,
            noReply: reflectionResponse == null,
          },
        });

        const result = await pollAiHintResult(roomId, submission.jobId);

        setHintHistory((prev) =>
          prev.map((hint) =>
            hint.id === hintId
              ? {
                  ...hint,
                  reflectionResponse: reflectionResponse ?? t('problem.hintNoReply'),
                  followUpHint: result.hint,
                  suggestedApproach: result.suggestedApproach ?? hint.suggestedApproach,
                }
              : hint,
          ),
        );
      } catch (error) {
        if (error instanceof AiHintTimeoutError || error instanceof AiHintFailedError) {
          const message = t('workspace.hintUnavailable');
          setHintError(message);
          toast.error(message);
        } else {
          const apiError = await readApiError(error);
          const message = resolveErrorMessage(
            apiError,
            HINT_ERROR_KEYS,
            'workspace.hintFollowUpFailed',
            t,
          );
          setHintError(message);
          toast.error(message);
        }
      } finally {
        setHintFollowUpLoadingHintId(null);
      }
    },
    [getCode, language, roomId, t],
  );

  const buildInterviewSignals = useCallback(
    (reason: AiInterviewProactiveReason): AiInterviewInteractionSignals => {
      const now = Date.now();
      const signals: AiInterviewInteractionSignals = {
        reason,
        roomStatus: room.status,
        elapsedSeconds: Math.max(0, Math.floor(elapsedMs / 1000)),
        recentEditorChanges: aiInterviewRecentEditorChangesRef.current,
        hintCount: hintHistory.length,
      };

      if (aiInterviewLastUserMessageAtRef.current != null) {
        signals.secondsSinceLastUserMessage = Math.max(
          0,
          Math.floor((now - aiInterviewLastUserMessageAtRef.current) / 1000),
        );
      }
      if (aiInterviewLastAssistantMessageAtRef.current != null) {
        signals.secondsSinceLastAssistantMessage = Math.max(
          0,
          Math.floor((now - aiInterviewLastAssistantMessageAtRef.current) / 1000),
        );
      }
      if (aiInterviewLastEditorActivityAtRef.current != null) {
        signals.secondsSinceLastEditorActivity = Math.max(
          0,
          Math.floor((now - aiInterviewLastEditorActivityAtRef.current) / 1000),
        );
      }

      return signals;
    },
    [elapsedMs, hintHistory.length, room.status],
  );

  const streamInterviewAssistantMessage = useCallback(
    async (
      message: Extract<GetRoomAiInterviewResultResponse, { status: 'ready' }>,
      isCurrentRequest: () => boolean,
    ): Promise<boolean> => {
      if (!message.message?.trim()) {
        return true;
      }

      const fullText = message.message.trim();
      const messageId = createAiInterviewMessageId('assistant');
      const chunks = splitInterviewMessageChunks(fullText);
      const firstChunk = chunks[0] ?? fullText;
      let streamed = firstChunk;

      setAiInterviewMessages((prev) => [
        ...prev,
        {
          id: messageId,
          createdAt: Date.now(),
          role: 'assistant',
          content: firstChunk,
          isStreaming: chunks.length > 1,
          codeContext: message.codeContext,
          codeAnnotations: message.codeAnnotations,
          audioUrl: message.audioUrl,
        },
      ]);

      for (const chunk of chunks.slice(1)) {
        if (!isCurrentRequest()) {
          return false;
        }
        streamed = `${streamed} ${chunk}`;
        setAiInterviewMessages((prev) =>
          prev.map((entry) =>
            entry.id === messageId
              ? {
                  ...entry,
                  content: streamed,
                }
              : entry,
          ),
        );
        await sleep(AI_INTERVIEW_STREAM_CHUNK_DELAY_MS);
      }

      if (!isCurrentRequest()) {
        return false;
      }

      setAiInterviewMessages((prev) =>
        prev.map((entry) =>
          entry.id === messageId
            ? {
                ...entry,
                content: fullText,
                isStreaming: false,
                followUpQuestion: message.followUpQuestion,
              }
            : entry,
        ),
      );
      aiInterviewLastAssistantMessageAtRef.current = Date.now();
      return true;
    },
    [],
  );

  const finishInterviewRequest = useCallback((errorMessage: string | null) => {
    if (errorMessage) {
      setAiInterviewError(errorMessage);
    } else {
      setAiInterviewError(null);
    }
    setAiInterviewLoading(false);
    aiInterviewInFlightRef.current = false;
  }, []);

  const failInterviewRequest = useCallback(
    (trigger: AiInterviewRequestTrigger, message: string) => {
      clearPendingAiInterviewJob(roomId, currentUserId);
      finishInterviewRequest(trigger === 'proactive' ? null : message);
    },
    [currentUserId, finishInterviewRequest, roomId],
  );

  const handleReadyInterviewResult = useCallback(
    async (
      result: Extract<GetRoomAiInterviewResultResponse, { status: 'ready' }>,
      reason: AiInterviewProactiveReason | undefined,
      isCurrentRequest: () => boolean,
    ): Promise<boolean> => {
      if (result.shouldRespond && result.message) {
        const streamed = await streamInterviewAssistantMessage(result, isCurrentRequest);
        if (!streamed) {
          return false;
        }
      }

      clearPendingAiInterviewJob(roomId, currentUserId);

      if (reason === 'hint_used') {
        aiInterviewLastHintCountRef.current = hintHistory.length;
      }

      finishInterviewRequest(null);
      aiInterviewRecentEditorChangesRef.current = 0;
      return true;
    },
    [
      currentUserId,
      finishInterviewRequest,
      hintHistory.length,
      roomId,
      streamInterviewAssistantMessage,
    ],
  );

  const handleInterviewPollingFailure = useCallback(
    async (error: unknown, trigger: AiInterviewRequestTrigger) => {
      clearPendingAiInterviewJob(roomId, currentUserId);
      const apiError = await readApiError(error);
      const message = resolveErrorMessage(
        apiError,
        INTERVIEW_ERROR_KEYS,
        'workspace.aiInterviewUnavailable',
        t,
      );
      finishInterviewRequest(trigger === 'proactive' ? null : message);
    },
    [currentUserId, finishInterviewRequest, roomId, t],
  );

  const pollInterviewJob = useCallback(
    async (
      jobId: string,
      requestSeq: number,
      trigger: AiInterviewRequestTrigger,
      reason?: AiInterviewProactiveReason,
    ) => {
      const isCurrentRequest = () => aiInterviewRequestSeqRef.current === requestSeq;
      let polls = 0;
      let transientErrors = 0;

      while (isCurrentRequest() && polls < AI_INTERVIEW_MAX_POLLS) {
        polls += 1;
        try {
          const result = await api(CONTROL_API.ROOMS.AI_INTERVIEW_RESULT, {
            params: { id: roomId, jobId },
          });
          if (!isCurrentRequest()) {
            return;
          }

          if (result.status === 'pending') {
            await sleep(AI_INTERVIEW_POLL_INTERVAL_MS);
            continue;
          }

          if (result.status === 'failed') {
            failInterviewRequest(trigger, t('workspace.aiInterviewFailed'));
            return;
          }

          await handleReadyInterviewResult(result, reason, isCurrentRequest);
          return;
        } catch (error) {
          if (!isCurrentRequest()) {
            return;
          }

          transientErrors += 1;
          if (transientErrors > AI_INTERVIEW_MAX_RETRY_ERRORS) {
            await handleInterviewPollingFailure(error, trigger);
            return;
          }

          await sleep(AI_INTERVIEW_POLL_INTERVAL_MS * transientErrors);
        }
      }

      if (aiInterviewRequestSeqRef.current === requestSeq) {
        failInterviewRequest(trigger, t('workspace.aiInterviewFailed'));
      }
    },
    [failInterviewRequest, handleInterviewPollingFailure, handleReadyInterviewResult, roomId, t],
  );

  const submitInterviewRequest = useCallback(
    async ({
      trigger,
      userMessage,
      reason,
      pendingJobId,
    }: {
      trigger: AiInterviewRequestTrigger;
      userMessage?: string;
      reason?: AiInterviewProactiveReason;
      pendingJobId?: string;
    }) => {
      if (!canSendInterviewMessage || aiInterviewInFlightRef.current) {
        return;
      }

      aiInterviewInFlightRef.current = true;
      aiInterviewRequestSeqRef.current += 1;
      const requestSeq = aiInterviewRequestSeqRef.current;

      const isUserTriggered = trigger === 'user_message';
      setAiInterviewError(null);
      setAiInterviewLoading(isUserTriggered);

      if (isUserTriggered && userMessage?.trim()) {
        aiInterviewLastUserMessageAtRef.current = Date.now();
        setAiInterviewMessages((prev) => [
          ...prev,
          {
            id: createAiInterviewMessageId('user'),
            createdAt: Date.now(),
            role: 'user',
            content: userMessage,
          },
        ]);
      }

      if (pendingJobId) {
        await pollInterviewJob(pendingJobId, requestSeq, trigger, reason);
        return;
      }

      const currentCode = getCode();
      const codeContext = buildInterviewCodeContext(editorCodeContext, currentCode, language);
      const history = buildInterviewConversationHistory(
        aiInterviewMessages,
        AI_INTERVIEW_HISTORY_LIMIT,
      );

      try {
        const submission = await api(CONTROL_API.ROOMS.AI_INTERVIEW, {
          params: { id: roomId },
          body: {
            trigger,
            userMessage: userMessage?.trim() || undefined,
            conversationHistory: history,
            currentCode,
            codeContext,
            latestExecutionSummary: pickLatestInterviewExecutionSummary(
              latestRunSummary,
              buildLatestInterviewSubmissionSummary(submitState),
            ),
            interactionSignals: reason ? buildInterviewSignals(reason) : undefined,
          },
        });

        storePendingAiInterviewJob(roomId, currentUserId, {
          jobId: submission.jobId,
          trigger,
          userMessage: userMessage?.trim() || undefined,
          reason,
        });
        if (trigger === 'proactive') {
          aiInterviewLastProactiveAtRef.current = Date.now();
        }
        await pollInterviewJob(submission.jobId, requestSeq, trigger, reason);
      } catch (error) {
        if (aiInterviewRequestSeqRef.current !== requestSeq) {
          return;
        }
        const apiError = await readApiError(error);
        const message = resolveErrorMessage(
          apiError,
          INTERVIEW_ERROR_KEYS,
          'workspace.aiInterviewUnavailable',
          t,
        );
        if (trigger !== 'proactive') {
          setAiInterviewError(message);
        }
        setAiInterviewLoading(false);
        aiInterviewInFlightRef.current = false;
      }
    },
    [
      aiInterviewMessages,
      buildInterviewSignals,
      canSendInterviewMessage,
      currentUserId,
      editorCodeContext,
      getCode,
      language,
      latestRunSummary,
      pollInterviewJob,
      roomId,
      submitState,
      t,
    ],
  );

  const handleSendInterviewMessage = useCallback(
    (userMessage: string): boolean => {
      if (!canSendInterviewMessage || aiInterviewInFlightRef.current) {
        const message = t('workspace.aiInterviewBusy');
        setAiInterviewError(message);
        return false;
      }

      void submitInterviewRequest({ trigger: 'user_message', userMessage });
      return true;
    },
    [canSendInterviewMessage, submitInterviewRequest, t],
  );

  useEffect(() => {
    if (!canSendInterviewMessage || room.mode !== 'ai') {
      return;
    }
    const pending = loadPendingAiInterviewJob(roomId, currentUserId);
    if (!pending || aiInterviewInFlightRef.current) {
      return;
    }
    void submitInterviewRequest({
      trigger: pending.trigger,
      userMessage: pending.userMessage,
      reason: pending.reason,
      pendingJobId: pending.jobId,
    });
  }, [canSendInterviewMessage, currentUserId, room.mode, roomId, submitInterviewRequest]);

  const previousAiInterviewStageRef = useRef<RoomStatus | null>(null);
  useEffect(() => {
    if (room.mode !== 'ai') {
      previousAiInterviewStageRef.current = null;
      return;
    }
    if (!AI_INTERVIEW_ALLOWED_STATUSES.has(room.status)) {
      previousAiInterviewStageRef.current = room.status;
      return;
    }

    const previous = previousAiInterviewStageRef.current;
    previousAiInterviewStageRef.current = room.status;
    if (previous == null) {
      return;
    }
    if (previous === room.status) {
      return;
    }

    if (
      Date.now() - aiInterviewLastProactiveAtRef.current <
      AI_INTERVIEW_PROACTIVE_MIN_INTERVAL_MS
    ) {
      return;
    }

    void submitInterviewRequest({
      trigger: 'proactive',
      reason: 'stage_changed',
    });
  }, [room.mode, room.status, submitInterviewRequest]);

  useEffect(() => {
    if (!canSendInterviewMessage || room.mode !== 'ai') {
      return;
    }

    if (aiInterviewMessages.length > 0) {
      return;
    }

    if (
      Date.now() - aiInterviewLastProactiveAtRef.current <
      AI_INTERVIEW_PROACTIVE_MIN_INTERVAL_MS
    ) {
      return;
    }

    void submitInterviewRequest({
      trigger: 'proactive',
      reason: 'session_joined',
    });
  }, [aiInterviewMessages.length, canSendInterviewMessage, room.mode, submitInterviewRequest]);

  useEffect(() => {
    if (!canSendInterviewMessage || room.mode !== 'ai') {
      return;
    }

    const timer = setInterval(() => {
      if (aiInterviewInFlightRef.current) {
        return;
      }

      const now = Date.now();
      const sinceLastProactive = now - aiInterviewLastProactiveAtRef.current;
      if (sinceLastProactive < AI_INTERVIEW_PROACTIVE_MIN_INTERVAL_MS) {
        return;
      }

      if (hintHistory.length > aiInterviewLastHintCountRef.current) {
        void submitInterviewRequest({
          trigger: 'proactive',
          reason: 'hint_used',
        });
        return;
      }

      const sinceLastEditorActivity =
        aiInterviewLastEditorActivityAtRef.current == null
          ? Number.POSITIVE_INFINITY
          : now - aiInterviewLastEditorActivityAtRef.current;
      const sinceLastUserMessage =
        aiInterviewLastUserMessageAtRef.current == null
          ? Number.POSITIVE_INFINITY
          : now - aiInterviewLastUserMessageAtRef.current;

      if (
        sinceLastEditorActivity >= AI_INTERVIEW_IDLE_EDITOR_MS &&
        sinceLastUserMessage >= AI_INTERVIEW_IDLE_USER_MESSAGE_MS
      ) {
        void submitInterviewRequest({
          trigger: 'proactive',
          reason: 'user_idle',
        });
      }
    }, AI_INTERVIEW_PROACTIVE_TICK_MS);

    return () => clearInterval(timer);
  }, [canSendInterviewMessage, hintHistory.length, room.mode, submitInterviewRequest]);

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
        {showProblemPanel ? (
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
                  problem={displayProblemPanelData}
                  loading={problemLoading}
                  error={problemError}
                  hasProblem={showProblemPanel}
                  activeTab={activeProblemTab}
                  onTabChange={setActiveProblemTab}
                  hints={hintHistory}
                  hintLoading={hintLoading}
                  hintError={hintError}
                  onRequestHint={() => {
                    void handleRequestHint();
                  }}
                  onSubmitHintReflection={(hintId, reflectionResponse) => {
                    void handleSubmitHintReflection(hintId, reflectionResponse);
                  }}
                  followUpLoadingHintId={hintFollowUpLoadingHintId}
                  canRequestHint={canRequestHint}
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
        <ResizablePanel defaultSize={showProblemPanel ? 50 : 75} minSize={20}>
          <ResizablePanelGroup orientation="vertical">
            {/* Editor panel */}
            <ResizablePanel defaultSize={55} minSize={20}>
              <div className="flex h-full flex-col">
                {isMockPreview ? (
                  <div className="flex h-7 shrink-0 items-center border-b border-border bg-primary/5 px-3 font-mono text-[10px] uppercase tracking-widest text-primary/80">
                    {t('workspace.mockPreviewBanner')}
                  </div>
                ) : null}
                {/* Editor toolbar */}
                <div className="flex h-9 shrink-0 items-center justify-between border-b border-border bg-card px-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      role="tablist"
                      aria-label="Center workspace tabs"
                      className="flex items-center"
                    >
                      <button
                        type="button"
                        role="tab"
                        aria-selected={activeCenterTab === 'code'}
                        onClick={() => setActiveCenterTab('code')}
                        className={cn(
                          'flex items-center gap-1.5 rounded-t-md border border-b-0 px-2.5 py-1 font-mono text-[11px] transition-colors',
                          activeCenterTab === 'code'
                            ? 'border-border bg-background text-foreground/80'
                            : 'border-transparent bg-transparent text-muted-foreground hover:text-foreground',
                        )}
                      >
                        <span className="size-2 rounded-full bg-primary/60" />
                        solution.{languageExtension(language)}
                      </button>
                      {room.myCapabilities.includes('whiteboard:view') ? (
                        <button
                          type="button"
                          role="tab"
                          aria-selected={activeCenterTab === 'whiteboard'}
                          onClick={() => setActiveCenterTab('whiteboard')}
                          className={cn(
                            'ml-1 flex items-center gap-1.5 rounded-t-md border border-b-0 px-2.5 py-1 font-mono text-[11px] transition-colors',
                            activeCenterTab === 'whiteboard'
                              ? 'border-border bg-background text-foreground/80'
                              : 'border-transparent bg-transparent text-muted-foreground hover:text-foreground',
                          )}
                        >
                          <span className="size-2 rounded-full bg-amber-400/70" />
                          {t('tabs.whiteboard')}
                        </button>
                      ) : null}
                    </div>
                    {isEditorReadOnly && activeCenterTab === 'code' ? (
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
                        onClick={() => void requestSubmitCodeRef.current()}
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

                {/* Editor / whiteboard surface — kept mounted to preserve
                    each subtree's local state across tab switches. */}
                <div className="relative flex-1 overflow-hidden">
                  <div
                    className={cn(
                      'absolute inset-0',
                      activeCenterTab === 'code' ? 'visible' : 'invisible',
                    )}
                  >
                    {doc && awareness && collabStatus === 'connected' ? (
                      <CollaborativeEditor
                        key={doc.clientID}
                        doc={doc}
                        awareness={awareness}
                        language={monacoLanguage}
                        readOnly={isEditorReadOnly}
                        comments={comments}
                        commentLineNumbers={commentLineNumbers}
                        canAddComments={Boolean(currentUserId) || isMockPreview}
                        onAddComment={(lineNumber, content) => {
                          addComment({
                            authorId: currentUserId ?? 'mock-user',
                            authorName: currentUserName || 'Mock User',
                            content,
                            lineNumber,
                          });
                        }}
                        onRunCode={() => void handleRunCodeRef.current()}
                        onSubmitCode={() => void requestSubmitCodeRef.current()}
                        onCodeContextChange={setEditorCodeContext}
                        onFocusChange={setIsCodeEditorFocused}
                      />
                    ) : (
                      EDITOR_LOADING
                    )}
                  </div>
                  <div
                    ref={setInlineWhiteboardHost}
                    data-testid="inline-whiteboard-host"
                    className={cn(
                      'absolute inset-0',
                      activeCenterTab === 'whiteboard' && whiteboardViewMode === 'tab'
                        ? 'visible'
                        : 'invisible',
                    )}
                  >
                    {/* The whiteboard subtree is portaled into this div from
                        the workspace top-level mount so it survives switching
                        between the docked tab and the floating PiP without
                        remounting (preserves tldraw editor state). */}
                  </div>
                  {/* Placeholder shown in the tab area when popped out, so
                      the user knows where the whiteboard went and can dock
                      it back without going looking for the floating window. */}
                  {activeCenterTab === 'whiteboard' && whiteboardViewMode === 'floating' ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-muted/20">
                      <div className="flex flex-col items-center gap-2 text-center">
                        <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                          {t('whiteboard.poppedOut')}
                        </span>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => setWhiteboardViewMode('tab')}
                        >
                          {t('whiteboard.dockBack')}
                        </Button>
                      </div>
                    </div>
                  ) : null}
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

            <WorkspaceBottomPanel
              bottomPanelRef={bottomPanelRef}
              setBottomCollapsed={setBottomCollapsed}
              activeBottomTab={activeBottomTab}
              setActiveBottomTab={setActiveBottomTab}
              testCases={testCases}
              activeCaseId={activeCaseId}
              setActiveCaseId={setActiveCaseId}
              handleCaseInputChange={handleCaseInputChange}
              handleAddCase={handleAddCase}
              handleRemoveCase={handleRemoveCase}
              isEditorReadOnly={isEditorReadOnly}
              multiRunState={multiRunState}
              handleRunSingleCase={handleRunSingleCase}
              submitState={submitState}
              canSubmitCode={canSubmitCode}
              isSubmitBusy={isSubmitBusy}
              t={t}
            />
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
              className="flex h-full min-w-0 flex-col overflow-hidden bg-card/80 backdrop-blur-sm"
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
                    canChangePhase={!isMockPreview && canChangePhase}
                    canControlEditorLock={canControlEditorLock}
                    isPending={isTransitioning}
                    isLockingEditor={isLockingEditor}
                    isUnlockingEditor={isUnlockingEditor}
                    allRequiredReady={allRequiredReady}
                    onTransition={(targetStatus) => {
                      void onTransition(targetStatus);
                    }}
                    onLockEditor={onLockEditor}
                    onUnlockEditor={onUnlockEditor}
                  />
                </div>
              </motion.div>

              {dockedVideoPanel}

              <motion.div
                className="flex min-h-0 flex-1 flex-col"
                initial={rightMountedRef.current ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
              >
                <div
                  className={`border-b border-border ${rightNarrow ? 'px-2 py-2' : 'px-3 py-2.5'}`}
                >
                  <div
                    className={`grid gap-1 rounded-md border border-border/70 bg-background/40 p-1 ${room.mode === 'ai' ? 'grid-cols-3' : 'grid-cols-2'}`}
                  >
                    <button
                      type="button"
                      onClick={() => setActiveRightTab('participants')}
                      className={cn(
                        'rounded px-2 py-1 text-xs font-medium transition-colors',
                        activeRightTab === 'participants'
                          ? 'bg-primary/20 text-primary'
                          : 'text-muted-foreground hover:bg-background/70 hover:text-foreground',
                      )}
                    >
                      {t('workspace.participantsHeading')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveRightTab('chat')}
                      className={cn(
                        'flex items-center justify-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors',
                        activeRightTab === 'chat'
                          ? 'bg-primary/20 text-primary'
                          : 'text-muted-foreground hover:bg-background/70 hover:text-foreground',
                      )}
                    >
                      <span>{t('workspace.chatHeading')}</span>
                      {unreadChatCount > 0 ? (
                        <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">
                          {unreadChatCount}
                        </span>
                      ) : null}
                    </button>
                    {room.mode === 'ai' ? (
                      <button
                        type="button"
                        onClick={() => setActiveRightTab('interview')}
                        className={cn(
                          'flex items-center justify-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors',
                          activeRightTab === 'interview'
                            ? 'bg-primary/20 text-primary'
                            : 'text-muted-foreground hover:bg-background/70 hover:text-foreground',
                        )}
                      >
                        <span>{t('workspace.aiInterviewHeading')}</span>
                        {unreadInterviewCount > 0 ? (
                          <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">
                            {unreadInterviewCount}
                          </span>
                        ) : null}
                      </button>
                    ) : null}
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto">
                  {activeRightTab === 'participants' ? (
                    <div className={`space-y-2 ${rightNarrow ? 'p-2' : 'p-3'}`}>
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                          {rightNarrow
                            ? `${participants.length}`
                            : t('workspace.participantsHeading')}
                        </span>
                        {!rightNarrow ? (
                          <span className="font-mono text-[10px] text-muted-foreground/60">
                            {participants.length}
                          </span>
                        ) : null}
                      </div>
                      <div className="space-y-0.5">
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
                              participantMediaControls?.videoHiddenSet.has(participant.userId) ??
                              false
                            }
                            localVolume={participantMediaControls?.volumeMap.get(
                              participant.userId,
                            )}
                            isSelfMicrophoneEnabled={selfMicrophoneEnabled}
                            onSelfMicrophoneToggle={onSelfMicrophoneToggle}
                            onLocalMuteToggle={
                              participantMediaControls
                                ? (muted) =>
                                    participantMediaControls.setMuted(participant.userId, muted)
                                : undefined
                            }
                            onLocalVolumeChange={
                              participantMediaControls
                                ? (vol) =>
                                    participantMediaControls.setVolume(participant.userId, vol)
                                : undefined
                            }
                            onVideoHiddenToggle={
                              participantMediaControls
                                ? (hidden) =>
                                    participantMediaControls.setVideoHidden(
                                      participant.userId,
                                      hidden,
                                    )
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
                    </div>
                  ) : activeRightTab === 'chat' ? (
                    <div className="h-full p-2">
                      <RoomChatPanel
                        currentUserId={currentUserId}
                        participants={participants}
                        messages={chatMessages}
                        onSendMessage={onSendChatMessage}
                        onToggleReaction={onToggleChatReaction}
                        onUploadMedia={onUploadChatMedia}
                        disabled={!canSendChat}
                        showHeader={false}
                        readAt={currentUserReadAt}
                      />
                    </div>
                  ) : (
                    <RoomAiInterviewPanel
                      messages={aiInterviewMessages}
                      isLoading={aiInterviewLoading}
                      error={aiInterviewError}
                      onSendMessage={handleSendInterviewMessage}
                      canSendMessage={canSendInterviewMessage}
                      currentUser={
                        currentUserId ? (participantsById.get(currentUserId) ?? null) : null
                      }
                    />
                  )}
                </div>
              </motion.div>
              {/* Invite link */}
              {!rightNarrow ? (
                <motion.div
                  className="border-t border-border p-3"
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

      <SubmissionPreviewModal
        open={isSubmissionPreviewOpen}
        code={submissionPreviewCode ?? ''}
        language={monacoLanguage}
        fileExtension={languageExtension(language)}
        confirmDisabled={submitDisabled}
        onOpenChange={(open) => {
          if (!open) closeSubmissionPreview();
        }}
        onCancel={closeSubmissionPreview}
        onConfirm={confirmSubmitPreview}
      />

      {doc && awareness && currentUserId && room.myCapabilities.includes('whiteboard:view') ? (
        <>
          {whiteboardViewMode === 'floating' ? (
            <FloatingWhiteboardPanel
              persistKey={`${roomId}:${currentUserId}`}
              title={t('tabs.whiteboard')}
              onClose={() => setWhiteboardViewMode('tab')}
              bodyRef={setFloatingWhiteboardHost}
            />
          ) : null}

          {/* Off-screen "parking" container that's always present in the DOM.
              Used as a fallback portal target during the tab <-> floating
              transition, when the destination host's ref hasn't attached yet.
              Without this, WhiteboardPortal would briefly receive null and
              unmount the entire RoomWhiteboardPanel subtree (destroying the
              tldraw store, undo manager, and any in-flight Yjs observers). */}
          <div
            ref={setWhiteboardParkingHost}
            aria-hidden="true"
            className="pointer-events-none fixed left-[-9999px] top-[-9999px] h-px w-px overflow-hidden"
          />

          {/* Single mounted whiteboard panel — its DOM is portaled into
              either the inline tab host or the floating panel body, swapping
              targets without ever unmounting the tldraw subtree. */}
          <WhiteboardPortal
            target={resolveWhiteboardTarget(
              whiteboardViewMode,
              inlineWhiteboardHost,
              floatingWhiteboardHost,
              whiteboardParkingHost,
            )}
          >
            <div
              className="h-full"
              onFocusCapture={markWhiteboardKeyboardFocus}
              onPointerDownCapture={markWhiteboardKeyboardFocus}
            >
              <RoomWhiteboardPanel
                doc={doc}
                awareness={awareness}
                roomId={roomId}
                userId={currentUserId}
                userName={currentUserName}
                userColor={authorColor(currentUserId)}
                canDraw={room.myCapabilities.includes('whiteboard:draw')}
                canAnnotate={room.myCapabilities.includes('whiteboard:annotate')}
                participantNames={
                  new Map(
                    // Use displayName when set, otherwise the user's @username
                    // — never the raw userId UUID, which leaks an identifier
                    // and isn't human-readable. Include even inactive
                    // participants so historical authors still show up in
                    // the legend with their proper name.
                    room.participants.map((p) => [p.userId, p.displayName ?? p.username] as const),
                  )
                }
                onPopOut={
                  whiteboardViewMode === 'tab' ? () => setWhiteboardViewMode('floating') : undefined
                }
                onDock={
                  whiteboardViewMode === 'floating' ? () => setWhiteboardViewMode('tab') : undefined
                }
                keyboardShortcutsEnabled={isWhiteboardKeyboardActive}
              />
            </div>
          </WhiteboardPortal>
        </>
      ) : null}
    </div>
  );
}

function WhiteboardPortal({
  target,
  children,
}: {
  target: HTMLElement | null;
  children: React.ReactNode;
}) {
  if (!target) return null;
  return createPortal(children, target);
}

// Pick the live portal target for the whiteboard subtree. Prefers the
// destination matching the current view mode, but falls back to the parking
// host whenever the destination's callback ref hasn't attached yet — the
// alternative is briefly returning null to the portal, which would unmount
// the entire tldraw subtree and discard editor state.
function resolveWhiteboardTarget(
  viewMode: 'tab' | 'floating',
  inlineHost: HTMLElement | null,
  floatingHost: HTMLElement | null,
  parkingHost: HTMLElement | null,
): HTMLElement | null {
  if (viewMode === 'floating') {
    return floatingHost ?? parkingHost ?? inlineHost;
  }
  return inlineHost ?? parkingHost ?? floatingHost;
}

type ExecutionPollResponse = ExecutionResultResponse | JobStatusResponse;

function WorkspaceBottomPanel({
  bottomPanelRef,
  setBottomCollapsed,
  activeBottomTab,
  setActiveBottomTab,
  testCases,
  activeCaseId,
  setActiveCaseId,
  handleCaseInputChange,
  handleAddCase,
  handleRemoveCase,
  isEditorReadOnly,
  multiRunState,
  handleRunSingleCase,
  submitState,
  canSubmitCode,
  isSubmitBusy,
  t,
}: {
  readonly bottomPanelRef: ReturnType<typeof usePanelRef>;
  readonly setBottomCollapsed: (collapsed: boolean) => void;
  readonly activeBottomTab: 'testcases' | 'output' | 'results';
  readonly setActiveBottomTab: (tab: 'testcases' | 'output' | 'results') => void;
  readonly testCases: TestCaseEntry[];
  readonly activeCaseId: string;
  readonly setActiveCaseId: (id: string) => void;
  readonly handleCaseInputChange: (id: string, input: string) => void;
  readonly handleAddCase: () => void;
  readonly handleRemoveCase: (id: string) => void;
  readonly isEditorReadOnly: boolean;
  readonly multiRunState: MultiRunState;
  readonly handleRunSingleCase: (id: string) => void;
  readonly submitState: SubmitState;
  readonly canSubmitCode: boolean;
  readonly isSubmitBusy: boolean;
  readonly t: (key: string) => string;
}) {
  return (
    <ResizablePanel
      panelRef={bottomPanelRef}
      defaultSize={35}
      minSize={8}
      collapsible
      collapsedSize={0}
      onResize={() => setBottomCollapsed(bottomPanelRef.current?.isCollapsed() ?? false)}
    >
      <div className="flex h-full flex-col bg-card">
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
              {isSubmitBusy ? <Loader2 className="size-2.5 animate-spin text-primary" /> : null}
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

        <div className="relative flex-1 overflow-auto bg-background p-3">
          <BottomTabContent
            activeBottomTab={activeBottomTab}
            testCases={testCases}
            activeCaseId={activeCaseId}
            setActiveCaseId={setActiveCaseId}
            handleCaseInputChange={handleCaseInputChange}
            handleAddCase={handleAddCase}
            handleRemoveCase={handleRemoveCase}
            isEditorReadOnly={isEditorReadOnly}
            multiRunState={multiRunState}
            handleRunSingleCase={handleRunSingleCase}
            submitState={submitState}
          />
        </div>
      </div>
    </ResizablePanel>
  );
}

function isExecutionResultPayload(
  response: ExecutionPollResponse,
): response is ExecutionResultResponse {
  return 'stdout' in response;
}

function pickMultiRunResults(
  localState: MultiRunState,
  remoteState: MultiRunState | undefined,
): Map<string, CaseRunState> | null {
  if (localState.status === 'running' || localState.status === 'completed') {
    return localState.results;
  }
  if (remoteState?.status === 'running' || remoteState?.status === 'completed') {
    return remoteState.results;
  }
  return null;
}

function BottomTabContent({
  activeBottomTab,
  testCases,
  activeCaseId,
  setActiveCaseId,
  handleCaseInputChange,
  handleAddCase,
  handleRemoveCase,
  isEditorReadOnly,
  multiRunState,
  handleRunSingleCase,
  submitState,
}: {
  readonly activeBottomTab: 'testcases' | 'output' | 'results';
  readonly testCases: TestCaseEntry[];
  readonly activeCaseId: string;
  readonly setActiveCaseId: (id: string) => void;
  readonly handleCaseInputChange: (id: string, input: string) => void;
  readonly handleAddCase: () => void;
  readonly handleRemoveCase: (id: string) => void;
  readonly isEditorReadOnly: boolean;
  readonly multiRunState: MultiRunState;
  readonly handleRunSingleCase: (id: string) => void;
  readonly submitState: SubmitState;
}) {
  if (activeBottomTab === 'testcases') {
    return (
      <TestCaseEditor
        cases={testCases}
        activeCaseId={activeCaseId}
        onActiveCaseChange={setActiveCaseId}
        onCaseInputChange={handleCaseInputChange}
        onAddCase={handleAddCase}
        onRemoveCase={handleRemoveCase}
        readOnly={isEditorReadOnly}
      />
    );
  }
  if (activeBottomTab === 'output') {
    return (
      <RunResultsPanel
        multiRunState={multiRunState}
        cases={testCases}
        onRunCase={handleRunSingleCase}
      />
    );
  }
  return <SubmissionOutput submitState={submitState} />;
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

function buildInterviewCodeContext(
  editorContext: EditorCodeContext | null,
  currentCode: string,
  language: SupportedLanguage,
): AiInterviewCodeContext {
  const fallback = buildFallbackEditorCodeContext(currentCode);
  const context = editorContext?.codeSnippet.trim() ? editorContext : fallback;

  return {
    language,
    file: `solution.${languageExtension(language)}`,
    codeSnippet: context.codeSnippet || ' ',
    startLine: context.startLine,
    endLine: context.endLine,
    startColumn: context.startColumn,
    endColumn: context.endColumn,
    cursorLine: context.cursorLine,
    cursorColumn: context.cursorColumn,
    questionType: editorContext?.codeSnippet.trim() ? 'correctness' : 'other',
    reason: editorContext?.codeSnippet.trim()
      ? 'Candidate selected or cursor-adjacent code context.'
      : 'Fallback context from the current solution snapshot.',
  };
}

function buildFallbackEditorCodeContext(currentCode: string): EditorCodeContext {
  const lines = currentCode.split('\n');
  const snippetLines = lines.slice(0, Math.min(5, Math.max(1, lines.length)));

  return {
    codeSnippet: snippetLines.join('\n').trim() || ' ',
    startLine: 1,
    endLine: Math.max(1, snippetLines.length),
    cursorLine: 1,
    cursorColumn: 1,
  };
}

function createPendingInterviewExecutionSummary(
  totalTestCases: number,
): AiInterviewExecutionSummary {
  return {
    status: 'running',
    passedTestCases: 0,
    totalTestCases,
    failedTestCases: 0,
    errorTestCases: 0,
    allTestsPassed: false,
    submittedAt: new Date().toISOString(),
  };
}

function buildRunInterviewExecutionSummary(
  results: Map<string, CaseRunState>,
): AiInterviewExecutionSummary {
  let passedTestCases = 0;
  let failedTestCases = 0;
  let errorTestCases = 0;

  for (const result of results.values()) {
    if (result.status === 'request-error') {
      errorTestCases += 1;
      continue;
    }

    if (result.status === 'failed') {
      errorTestCases += 1;
      continue;
    }

    if (result.status === 'completed') {
      if (result.passed === true) {
        passedTestCases += 1;
      } else if (result.passed === false) {
        failedTestCases += 1;
      }
    }
  }

  const totalTestCases = results.size;
  return {
    status: errorTestCases > 0 ? 'failed' : 'completed',
    passedTestCases,
    totalTestCases,
    failedTestCases,
    errorTestCases,
    allTestsPassed:
      totalTestCases > 0 &&
      passedTestCases === totalTestCases &&
      failedTestCases === 0 &&
      errorTestCases === 0,
    submittedAt: new Date().toISOString(),
  };
}

function buildLatestInterviewSubmissionSummary(
  submitState: SubmitState,
): AiInterviewExecutionSummary | undefined {
  if (submitState.status !== 'completed') {
    return undefined;
  }

  const details = submitState.details;
  return {
    status: details.status,
    passedTestCases: details.passedTestCases,
    totalTestCases: details.totalTestCases,
    failedTestCases: details.failedTestCases,
    errorTestCases: details.errorTestCases,
    allTestsPassed:
      details.status === 'completed' &&
      details.totalTestCases > 0 &&
      details.passedTestCases === details.totalTestCases &&
      details.failedTestCases === 0 &&
      details.errorTestCases === 0,
    submittedAt: details.submittedAt,
  };
}

function pickLatestInterviewExecutionSummary(
  latestRunSummary: AiInterviewExecutionSummary | null,
  latestSubmissionSummary: AiInterviewExecutionSummary | undefined,
): AiInterviewExecutionSummary | undefined {
  if (!latestRunSummary) {
    return latestSubmissionSummary;
  }

  if (!latestSubmissionSummary) {
    return latestRunSummary;
  }

  return latestRunSummary.submittedAt > latestSubmissionSummary.submittedAt
    ? latestRunSummary
    : latestSubmissionSummary;
}

const SUBMIT_ERROR_KEYS: Partial<Record<string, string>> = {
  [ERROR_CODES.ROOM_EDITOR_LOCKED]: 'workspace.editorLockedError',
  [ERROR_CODES.ROOM_PERMISSION_DENIED]: 'workspace.permissionDenied',
  [ERROR_CODES.ROOM_ACCESS_DENIED]: 'workspace.permissionDenied',
  [ERROR_CODES.PROBLEM_NOT_FOUND]: 'workspace.problemNotFound',
  [ERROR_CODES.PROBLEM_NO_TEST_CASES]: 'workspace.noProblemTestCases',
};

const HINT_ERROR_KEYS: Partial<Record<string, string>> = {
  [ERROR_CODES.ROOM_PERMISSION_DENIED]: 'workspace.hintPermissionDenied',
  [ERROR_CODES.ROOM_ACCESS_DENIED]: 'workspace.hintPermissionDenied',
  [ERROR_CODES.PROBLEM_NOT_FOUND]: 'workspace.problemNotFound',
  [ERROR_CODES.AI_HINT_RATE_LIMIT]: 'workspace.hintRateLimited',
  [ERROR_CODES.AI_SERVICE_UNAVAILABLE]: 'workspace.hintUnavailable',
};

const INTERVIEW_ERROR_KEYS: Partial<Record<string, string>> = {
  [ERROR_CODES.ROOM_PERMISSION_DENIED]: 'workspace.hintPermissionDenied',
  [ERROR_CODES.ROOM_ACCESS_DENIED]: 'workspace.hintPermissionDenied',
  [ERROR_CODES.ROOM_NOT_AI_MODE]: 'workspace.aiInterviewUnavailable',
  [ERROR_CODES.PROBLEM_NOT_FOUND]: 'workspace.problemNotFound',
  [ERROR_CODES.AI_SERVICE_UNAVAILABLE]: 'workspace.aiInterviewUnavailable',
};

const HINT_POLL_INTERVAL_MS = 750;
const HINT_POLL_TIMEOUT_MS = 30_000;
const AI_INTERVIEW_POLL_INTERVAL_MS = 1500;
const AI_INTERVIEW_MAX_POLLS = 40;
const AI_INTERVIEW_HISTORY_LIMIT = 40;
const AI_INTERVIEW_MAX_RETRY_ERRORS = 3;
const AI_INTERVIEW_STREAM_CHUNK_DELAY_MS = 32;
const AI_INTERVIEW_PROACTIVE_TICK_MS = 12_000;
const AI_INTERVIEW_PROACTIVE_MIN_INTERVAL_MS = 45_000;
const AI_INTERVIEW_IDLE_EDITOR_MS = 90_000;
const AI_INTERVIEW_IDLE_USER_MESSAGE_MS = 75_000;
const AI_INTERVIEW_PENDING_STORAGE_KEY_PREFIX = 'syncode:ai-interview-pending:';
const AI_INTERVIEW_ALLOWED_STATUSES = new Set<RoomStatus>(['warmup', 'coding', 'wrapup']);

interface PendingAiInterviewJob {
  jobId: string;
  trigger: AiInterviewRequestTrigger;
  userMessage?: string;
  reason?: AiInterviewProactiveReason;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let aiInterviewMessageIdCounter = 0;

function createAiInterviewMessageId(prefix: 'user' | 'assistant'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = crypto.getRandomValues(new Uint8Array(8));
    const token = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    return `${prefix}-${Date.now()}-${token}`;
  }

  aiInterviewMessageIdCounter += 1;
  return `${prefix}-${Date.now()}-${aiInterviewMessageIdCounter}`;
}

function splitInterviewMessageChunks(text: string): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) {
    return words;
  }

  const chunks: string[] = [];
  for (let index = 0; index < words.length; index += 3) {
    chunks.push(words.slice(index, index + 3).join(' '));
  }
  return chunks;
}

function buildInterviewConversationHistory(messages: AiInterviewMessage[], limit: number) {
  return messages.slice(-limit).map((message) => ({
    role: message.role,
    content:
      message.role === 'assistant' && message.followUpQuestion
        ? `${message.content}\n\nFollow-up question: ${message.followUpQuestion}`
        : message.content,
  }));
}

function getAiInterviewMessageStableId(message: AiInterviewMessage, index: number): string {
  if (message.id) {
    return message.id;
  }
  return `${message.role}:${message.createdAt ?? 0}:${index}:${message.content.slice(0, 36)}`;
}

function pendingAiInterviewStorageKey(roomId: string, userId: string | null): string | null {
  if (!userId) {
    return null;
  }
  return `${AI_INTERVIEW_PENDING_STORAGE_KEY_PREFIX}${roomId}:${userId}`;
}

function storePendingAiInterviewJob(
  roomId: string,
  userId: string | null,
  value: PendingAiInterviewJob,
): void {
  const key = pendingAiInterviewStorageKey(roomId, userId);
  if (!key) {
    return;
  }
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function loadPendingAiInterviewJob(
  roomId: string,
  userId: string | null,
): PendingAiInterviewJob | null {
  const key = pendingAiInterviewStorageKey(roomId, userId);
  if (!key) {
    return null;
  }
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<PendingAiInterviewJob>;
    if (!parsed.jobId || (parsed.trigger !== 'user_message' && parsed.trigger !== 'proactive')) {
      return null;
    }
    return {
      jobId: parsed.jobId,
      trigger: parsed.trigger,
      ...(parsed.userMessage ? { userMessage: parsed.userMessage } : {}),
      ...(parsed.reason ? { reason: parsed.reason } : {}),
    };
  } catch {
    return null;
  }
}

function clearPendingAiInterviewJob(roomId: string, userId: string | null): void {
  const key = pendingAiInterviewStorageKey(roomId, userId);
  if (!key) {
    return;
  }
  try {
    sessionStorage.removeItem(key);
  } catch {}
}

class AiHintTimeoutError extends Error {
  constructor() {
    super('AI hint poll timed out');
    this.name = 'AiHintTimeoutError';
  }
}

class AiHintFailedError extends Error {
  constructor() {
    super('AI hint job failed');
    this.name = 'AiHintFailedError';
  }
}

async function pollAiHintResult(
  roomId: string,
  jobId: string,
): Promise<Extract<GetRoomAiHintResultResponse, { status: 'ready' }>> {
  const deadline = Date.now() + HINT_POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const result = await api(CONTROL_API.ROOMS.AI_HINT_RESULT, {
      params: { id: roomId, jobId },
    });
    if (result.status === 'ready') {
      return result;
    }
    if (result.status === 'failed') {
      throw new AiHintFailedError();
    }
    await new Promise((resolve) => setTimeout(resolve, HINT_POLL_INTERVAL_MS));
  }
  throw new AiHintTimeoutError();
}
