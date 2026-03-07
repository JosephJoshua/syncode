import {
  ArrowLeft,
  Eye,
  Mic,
  MicOff,
  Monitor,
  PanelLeftOpen,
  PanelRightOpen,
  Settings,
  SkipForward,
  Video,
  VideoOff,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Avatar } from '../../components/ui/Avatar';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { CodeEditorPanel } from './panels/CodeEditorPanel';
import { OutputPanel } from './panels/OutputPanel';
import { ProblemPanel } from './panels/ProblemPanel';
import { SidePanel } from './panels/SidePanel';

// ─── Stage Types ────────────────────────────────────────────────────────────

type Stage = 'waiting' | 'warmup' | 'coding' | 'wrapup' | 'finished';

const STAGE_ORDER: Stage[] = ['waiting', 'warmup', 'coding', 'wrapup', 'finished'];

const STAGE_DESCRIPTIONS: Partial<Record<Stage, string>> = {
  warmup: '// read the problem, prepare your approach',
  coding: '// write your solution',
  wrapup: '// review and discuss',
  finished: '// session complete',
};

const STAGE_BADGE_VARIANT: Record<Stage, 'info' | 'warning' | 'success' | 'neutral' | 'error'> = {
  waiting: 'neutral',
  warmup: 'warning',
  coding: 'info',
  wrapup: 'warning',
  finished: 'success',
};

const STAGE_STATUS_TEXT: Record<Stage, string> = {
  waiting: 'Waiting to start',
  warmup: 'Read the problem',
  coding: 'Ctrl+Enter to run',
  wrapup: 'Session ending...',
  finished: 'Session complete',
};

// ─── Stage Overlay ──────────────────────────────────────────────────────────

function StageOverlay({ stage, onDone }: { stage: Stage; onDone?: () => void }) {
  const [visible, setVisible] = useState(false);
  const [show, setShow] = useState(true);

  useEffect(() => {
    // Fade in
    requestAnimationFrame(() => setVisible(true));

    // Start fade out after 2.5s
    const fadeTimer = setTimeout(() => setVisible(false), 2500);

    // Remove from DOM after fade out completes
    const removeTimer = setTimeout(() => {
      setShow(false);
      onDone?.();
    }, 2700);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  if (!show) return null;

  const description = STAGE_DESCRIPTIONS[stage];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-200"
      style={{ opacity: visible ? 1 : 0 }}
    >
      {/* Background */}
      <div className="absolute inset-0 bg-[var(--bg-base)]/90" />
      <div className="absolute inset-0 dot-grid-lg opacity-10" />

      {/* Content */}
      <div className="relative text-center">
        <h1 className="font-display text-6xl font-bold text-[var(--text-primary)] tracking-tight">
          {stage.charAt(0).toUpperCase() + stage.slice(1)}
        </h1>
        {description && (
          <p className="font-mono text-sm text-[var(--accent)] mt-3">{description}</p>
        )}
      </div>
    </div>
  );
}

// ─── Finished Card ──────────────────────────────────────────────────────────

function FinishedCard() {
  const categories = [
    { label: 'Problem Solving', score: 88 },
    { label: 'Code Quality', score: 82 },
    { label: 'Communication', score: 85 },
  ];

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center">
      <div className="absolute inset-0 bg-[var(--bg-base)]/60" />
      <div className="relative bg-[var(--bg-overlay)] border border-[var(--border-default)] rounded-lg shadow-xl p-8 max-w-sm w-full">
        <h2 className="font-display text-xl font-bold text-[var(--text-primary)] text-center">
          Session Complete
        </h2>

        {/* Score */}
        <div className="text-center mt-4">
          <span className="font-mono text-4xl text-[var(--accent)]">85</span>
          <span className="text-sm text-[var(--text-tertiary)]"> / 100</span>
        </div>

        {/* Category bars */}
        <div className="mt-6 space-y-2">
          {categories.map((cat) => (
            <div key={cat.label}>
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-[var(--text-tertiary)]">
                  {cat.label}
                </span>
                <span className="font-mono text-[10px] text-[var(--text-secondary)]">
                  {cat.score}%
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-[var(--bg-subtle)] mt-1">
                <div
                  className="h-full rounded-full bg-[var(--accent)] transition-all duration-700"
                  style={{
                    width: mounted ? `${cat.score}%` : '0%',
                    transitionDelay: '300ms',
                    transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Buttons */}
        <div className="flex gap-2 mt-6">
          <Link to="/dashboard/sessions/s1" className="flex-1">
            <Button variant="secondary" size="sm" className="w-full">
              View Review
            </Button>
          </Link>
          <Link to="/dashboard" className="flex-1">
            <Button variant="primary" size="sm" className="w-full">
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Resize Divider ─────────────────────────────────────────────────────────

type DividerDirection = 'col' | 'row';

interface ResizeDividerProps {
  direction: DividerDirection;
  onResize: (delta: number) => void;
}

function ResizeDivider({ direction, onResize }: ResizeDividerProps) {
  const [dragging, setDragging] = useState(false);
  const draggingRef = useRef(false);
  const lastPos = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      draggingRef.current = true;
      setDragging(true);
      lastPos.current = direction === 'col' ? e.clientX : e.clientY;

      const handleMouseMove = (ev: MouseEvent) => {
        if (!draggingRef.current) return;
        const current = direction === 'col' ? ev.clientX : ev.clientY;
        const delta = current - lastPos.current;
        lastPos.current = current;
        onResize(delta);
      };

      const handleMouseUp = () => {
        draggingRef.current = false;
        setDragging(false);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = direction === 'col' ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';
    },
    [direction, onResize],
  );

  const isCol = direction === 'col';

  return (
    <div
      onMouseDown={handleMouseDown}
      className={`${isCol ? 'w-1 cursor-col-resize' : 'h-1 cursor-row-resize'} flex-none group relative`}
    >
      <div
        className={`absolute ${
          isCol
            ? 'top-0 bottom-0 left-1/2 -translate-x-1/2 w-0.5'
            : 'left-0 right-0 top-1/2 -translate-y-1/2 h-0.5'
        } ${
          dragging ? 'bg-[var(--accent)]' : 'bg-transparent group-hover:bg-[var(--accent)]'
        } transition-colors duration-100`}
      />
    </div>
  );
}

// ─── Interview Room ─────────────────────────────────────────────────────────

export function InterviewRoom() {
  // Panel widths / heights
  const [leftWidth, setLeftWidth] = useState(300);
  const [rightWidth, setRightWidth] = useState(320);
  const [outputHeight, setOutputHeight] = useState(200);

  // Panel collapse
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  // Header controls
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [stage, setStage] = useState<Stage>('coding');
  const [overlayStage, setOverlayStage] = useState<Stage | null>(null);
  const [spectatorMode, setSpectatorMode] = useState(false);

  // Clamp helpers
  const clamp = (val: number, min: number, max: number) => Math.min(max, Math.max(min, val));

  const handleLeftResize = useCallback((delta: number) => {
    setLeftWidth((w) => clamp(w + delta, 200, 500));
  }, []);

  const handleRightResize = useCallback((delta: number) => {
    setRightWidth((w) => clamp(w - delta, 250, 500));
  }, []);

  const handleOutputResize = useCallback((delta: number) => {
    setOutputHeight((h) => clamp(h - delta, 100, 400));
  }, []);

  // Advance stage
  const advanceStage = useCallback(() => {
    setStage((current) => {
      const idx = STAGE_ORDER.indexOf(current);
      const next = STAGE_ORDER[(idx + 1) % STAGE_ORDER.length];
      // Show overlay for non-waiting stages
      if (next !== 'waiting') {
        setOverlayStage(next);
      }
      return next;
    });
  }, []);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-[var(--bg-base)]">
      {/* ── Mobile Breakpoint Overlay ────────────────────────────── */}
      <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-[var(--bg-base)] md:hidden">
        <Monitor size={48} className="text-[var(--text-tertiary)]" />
        <h2 className="font-display text-lg font-bold text-[var(--text-primary)] mt-4">
          Desktop Recommended
        </h2>
        <p className="text-sm text-[var(--text-secondary)] mt-2 text-center max-w-xs">
          This interview room is designed for desktop screens.
        </p>
        <Link
          to="/dashboard"
          className="font-mono text-sm text-[var(--accent)] hover:underline mt-4"
        >
          Back to Dashboard
        </Link>
      </div>

      {/* ── Stage Overlay ──────────────────────────────────────────── */}
      {overlayStage && (
        <StageOverlay
          key={overlayStage}
          stage={overlayStage}
          onDone={() => setOverlayStage(null)}
        />
      )}

      {/* ── Finished Card ──────────────────────────────────────────── */}
      {stage === 'finished' && !overlayStage && <FinishedCard />}

      {/* ── Header Bar ─────────────────────────────────────────────── */}
      <header className="h-10 flex items-center px-3 border-b border-[var(--border-default)] bg-[var(--bg-raised)] flex-none">
        {/* Left section */}
        <div className="flex items-center gap-2">
          <Link to="/rooms">
            <Button variant="ghost" size="sm" className="p-1">
              <ArrowLeft size={16} />
            </Button>
          </Link>
          <span className="font-mono text-xs text-[var(--text-tertiary)]">ROOM01</span>
          <Badge variant={STAGE_BADGE_VARIANT[stage]}>
            {stage.charAt(0).toUpperCase() + stage.slice(1)}
          </Badge>
          <Button variant="ghost" size="sm" className="p-1" onClick={advanceStage}>
            <SkipForward size={14} />
          </Button>
          {spectatorMode && <Badge variant="neutral">Spectating</Badge>}
        </div>

        {/* Center section — Timer */}
        <div className="flex-1 flex justify-center">
          <span className="font-mono text-lg font-semibold text-[var(--success)]">24:37</span>
        </div>

        {/* Right section */}
        <div className="flex items-center gap-1.5">
          {/* Avatar stack */}
          <div className="flex items-center mr-2">
            <Avatar name="Alice Chen" size="xs" className="z-30 ring-2 ring-[var(--bg-raised)]" />
            <Avatar
              name="Bob Kim"
              size="xs"
              className="-ml-2 z-20 ring-2 ring-[var(--bg-raised)]"
            />
            <Avatar
              name="Carol Wu"
              size="xs"
              className="-ml-2 z-10 ring-2 ring-[var(--bg-raised)]"
            />
          </div>

          <Button variant="ghost" size="sm" className="p-1" onClick={() => setMicOn(!micOn)}>
            {micOn ? <Mic size={16} /> : <MicOff size={16} />}
          </Button>

          <Button variant="ghost" size="sm" className="p-1" onClick={() => setCameraOn(!cameraOn)}>
            {cameraOn ? <Video size={16} /> : <VideoOff size={16} />}
          </Button>

          <Button variant="ghost" size="sm" className="p-1" onClick={() => {}}>
            <Settings size={16} />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-[var(--error)] hover:bg-[rgba(239,68,68,0.1)]"
            onClick={() => {
              setOverlayStage('finished');
              setStage('finished');
            }}
          >
            End Session
          </Button>
        </div>
      </header>

      {/* ── Three-Panel Layout ─────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel (Problem) */}
        {leftCollapsed ? (
          <div className="w-10 flex-none border-r border-[var(--border-default)] bg-[var(--bg-base)] flex flex-col items-center pt-2">
            <Button
              variant="ghost"
              size="sm"
              className="p-1"
              onClick={() => setLeftCollapsed(false)}
            >
              <PanelLeftOpen size={16} />
            </Button>
            <span className="font-mono text-xs text-[var(--text-tertiary)] mt-4 [writing-mode:vertical-lr] rotate-180">
              Problem
            </span>
          </div>
        ) : (
          <div
            className="flex-none border-r border-[var(--border-default)] overflow-hidden bg-[var(--bg-base)]"
            style={{ width: leftWidth }}
          >
            <ProblemPanel onCollapse={() => setLeftCollapsed(true)} />
          </div>
        )}

        {/* Left divider */}
        {!leftCollapsed && <ResizeDivider direction="col" onResize={handleLeftResize} />}

        {/* Center Panel (Editor + Output) */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Editor area */}
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-[var(--bg-base)]">
            <CodeEditorPanel stage={stage} spectatorMode={spectatorMode} />
          </div>

          {/* Horizontal divider */}
          <ResizeDivider direction="row" onResize={handleOutputResize} />

          {/* Output area */}
          <div
            className="flex-none border-t border-[var(--border-default)] overflow-hidden bg-[var(--bg-base)]"
            style={{ height: outputHeight }}
          >
            <OutputPanel />
          </div>
        </div>

        {/* Right divider */}
        {!rightCollapsed && <ResizeDivider direction="col" onResize={handleRightResize} />}

        {/* Right Panel (Side) */}
        {rightCollapsed ? (
          <div className="w-10 flex-none border-l border-[var(--border-default)] bg-[var(--bg-base)] flex flex-col items-center pt-2">
            <Button
              variant="ghost"
              size="sm"
              className="p-1"
              onClick={() => setRightCollapsed(false)}
            >
              <PanelRightOpen size={16} />
            </Button>
            <span className="font-mono text-xs text-[var(--text-tertiary)] mt-4 [writing-mode:vertical-lr]">
              Side Panel
            </span>
          </div>
        ) : (
          <div
            className="flex-none border-l border-[var(--border-default)] overflow-hidden bg-[var(--bg-base)]"
            style={{ width: rightWidth }}
          >
            <SidePanel
              onCollapse={() => setRightCollapsed(true)}
              stage={stage}
              spectatorMode={spectatorMode}
            />
          </div>
        )}
      </div>

      {/* ── Status Bar ─────────────────────────────────────────────── */}
      <footer className="h-7 flex items-center px-3 border-t border-[var(--border-default)] bg-[var(--bg-raised)] flex-none text-[10px]">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)]" />
            <span className="font-mono text-[var(--text-tertiary)]">Connected</span>
          </span>
          <span className="text-[var(--text-tertiary)]">|</span>
          <span className="font-mono text-[var(--text-tertiary)]">3 participants</span>
        </div>

        <div className="ml-auto flex items-center gap-3">
          {/* Spectator toggle */}
          <button
            type="button"
            onClick={() => setSpectatorMode(!spectatorMode)}
            className={`flex items-center gap-1 font-mono cursor-pointer transition-colors ${
              spectatorMode
                ? 'text-[var(--accent)]'
                : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
            }`}
          >
            <Eye size={12} />
            {spectatorMode ? 'Spectating' : 'Spectate'}
          </button>

          <span className="font-mono text-[var(--text-tertiary)]">
            {stage.charAt(0).toUpperCase() + stage.slice(1)} &middot; 24:37 elapsed
          </span>
          <span className="font-mono text-[var(--accent)]">{STAGE_STATUS_TEXT[stage]}</span>
        </div>
      </footer>
    </div>
  );
}
