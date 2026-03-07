import Editor from '@monaco-editor/react';
import {
  ArrowLeft,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Mic,
  Monitor,
  Send,
  Sparkles,
  Users,
  Video,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Avatar } from '../../components/ui/Avatar.tsx';
import { Badge } from '../../components/ui/Badge.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Card } from '../../components/ui/Card.tsx';
import { ProgressRing } from '../../components/ui/ProgressRing.tsx';
import { problems } from '../../data/problems.ts';
import { users } from '../../data/users.ts';
import { StageBar } from './StageBar.tsx';

type Stage = 'waiting' | 'warmup' | 'coding' | 'wrapup' | 'finished';

const problem = problems[0]; // Two Sum

const mockCode = `def two_sum(nums, target):
    seen = {}
    for i, num in enumerate(nums):
        complement = target - num
        if complement in seen:
            return [seen[complement], i]
        seen[num] = i
    return []`;

type ProblemTab = 'description' | 'examples' | 'hints';
type RightTab = 'ai' | 'chat' | 'participants';
type OutputTab = 'output' | 'testcases';

const chatMessages = [
  {
    id: 1,
    sender: 'u2',
    name: 'Bob Kim',
    text: 'Should we start with the brute force approach?',
    own: false,
  },
  {
    id: 2,
    sender: 'u1',
    name: 'Alice Chen',
    text: "Good idea, let's think about O(n) first though",
    own: true,
  },
  {
    id: 3,
    sender: 'system',
    name: 'System',
    text: 'Stage advanced to coding',
    own: false,
    system: true,
  },
  { id: 4, sender: 'u2', name: 'Bob Kim', text: 'Hash map approach looks clean here', own: false },
  { id: 5, sender: 'u1', name: 'Alice Chen', text: "Agreed, I'll implement it now", own: true },
  { id: 6, sender: 'u3', name: 'Carol Wu', text: "Don't forget the edge cases!", own: false },
];

interface SessionStageProps {
  stage: Stage;
  onAdvance: () => void;
  onEnd: () => void;
}

export function SessionStage({ stage, onAdvance, onEnd }: SessionStageProps) {
  const [problemTab, setProblemTab] = useState<ProblemTab>('description');
  const [rightTab, setRightTab] = useState<RightTab>('ai');
  const [outputTab, setOutputTab] = useState<OutputTab>('output');
  const [hintsUsed, setHintsUsed] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [testsPassed, setTestsPassed] = useState(false);
  const [showOutput, setShowOutput] = useState(false);

  // Reset flash after animation
  useEffect(() => {
    if (testsPassed) {
      const timer = setTimeout(() => setTestsPassed(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [testsPassed]);

  const handleRequestHint = () => {
    if (hintsUsed < 3) {
      setHintsUsed((prev) => prev + 1);
      setShowHint(true);
    }
  };

  const handleRunCode = () => {
    setShowOutput(true);
    setOutputTab('output');
  };

  const handleSubmit = () => {
    setShowOutput(true);
    setOutputTab('testcases');
    setTestsPassed(true);
  };

  const rightTabs: { key: RightTab; icon: typeof Sparkles; label: string }[] = [
    { key: 'ai', icon: Sparkles, label: 'AI' },
    { key: 'chat', icon: MessageCircle, label: 'Chat' },
    { key: 'participants', icon: Users, label: 'Participants' },
  ];

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-[var(--bg-base)]">
      {/* Mobile overlay */}
      <div className="fixed inset-0 z-50 flex items-center justify-center gradient-brand lg:hidden">
        <div className="text-center text-white px-8">
          <Monitor size={48} className="mx-auto mb-4 opacity-80" />
          <h2 className="font-display text-xl font-bold mb-2">Desktop Recommended</h2>
          <p className="text-white/80 text-sm mb-6">
            The interview room works best on a larger screen.
          </p>
          <Link
            to="/dashboard"
            className="inline-flex items-center justify-center rounded-xl bg-white text-[var(--primary)] text-sm font-semibold px-5 h-10"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>

      {/* Top Bar */}
      <div className="h-12 flex items-center bg-[var(--bg-card)] border-b border-[var(--border-default)] px-4 shrink-0">
        {/* Left */}
        <div className="flex items-center gap-2 min-w-0">
          <Link to="/rooms/join">
            <button
              type="button"
              className="p-1.5 rounded-lg hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer text-[var(--text-secondary)]"
            >
              <ArrowLeft size={16} />
            </button>
          </Link>
          <span className="text-sm font-mono text-[var(--text-secondary)]">ROOM01</span>
        </div>

        {/* Center */}
        <div className="flex-1 flex items-center justify-center gap-4">
          <StageBar currentStage={stage} onAdvance={onAdvance} compact />
          <span className="font-mono text-lg font-bold text-[var(--success)]">24:35</span>
        </div>

        {/* Right */}
        <div className="flex items-center gap-2">
          {/* Avatar stack */}
          <div className="flex items-center">
            {[users[0], users[1], users[2]].map((user, i) => (
              <div key={user.id} style={{ marginLeft: i > 0 ? -8 : 0, zIndex: 3 - i }}>
                <Avatar size="xs" name={user.name} />
              </div>
            ))}
          </div>

          <button
            type="button"
            className="p-1.5 rounded-lg hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer text-[var(--text-secondary)]"
          >
            <Mic size={16} />
          </button>
          <button
            type="button"
            className="p-1.5 rounded-lg hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer text-[var(--text-secondary)]"
          >
            <Video size={16} />
          </button>
          <Button variant="danger" size="sm" onClick={onEnd}>
            End Session
          </Button>
        </div>
      </div>

      {/* Floating video strip — always visible */}
      <FloatingVideoStrip />

      {/* Three Panel Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel — Problem */}
        {!leftCollapsed && (
          <div className="w-80 flex-shrink-0 bg-[var(--bg-card)] border-r border-[var(--border-default)] overflow-y-auto flex flex-col">
            {/* Panel header with collapse */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-default)]">
              <div className="flex gap-1">
                {(['description', 'examples', 'hints'] as ProblemTab[]).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setProblemTab(tab)}
                    className={`px-2.5 py-1 rounded-md text-xs transition-colors cursor-pointer ${
                      problemTab === tab
                        ? 'bg-[var(--primary-muted)] text-[var(--primary)] font-medium'
                        : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                    }`}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setLeftCollapsed(true)}
                className="p-1 rounded hover:bg-[var(--bg-subtle)] cursor-pointer text-[var(--text-tertiary)]"
              >
                <ChevronLeft size={14} />
              </button>
            </div>

            <div className="p-4 flex-1">
              {problemTab === 'description' && (
                <div style={{ animation: 'fadeIn 0.2s ease-out' }}>
                  <h3 className="font-display text-base font-bold text-[var(--text-primary)] mb-1">
                    {problem.title}
                  </h3>
                  <Badge variant="easy" className="mb-3">
                    Easy
                  </Badge>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-line">
                    {problem.description}
                  </p>
                  {problem.constraints.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-2">
                        Constraints
                      </h4>
                      <ul className="space-y-1">
                        {problem.constraints.map((c) => (
                          <li key={c} className="text-xs text-[var(--text-secondary)]">
                            <code className="bg-[var(--bg-subtle)] px-1 rounded">{c}</code>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {problemTab === 'examples' && (
                <div className="space-y-3" style={{ animation: 'fadeIn 0.2s ease-out' }}>
                  {problem.examples.map((ex, i) => (
                    <div key={i} className="bg-[var(--bg-subtle)] rounded-lg p-3">
                      <p className="text-xs font-semibold text-[var(--text-tertiary)] mb-1">
                        Example {i + 1}
                      </p>
                      <div className="font-mono text-sm text-[var(--text-primary)]">
                        <p>
                          <span className="text-[var(--text-tertiary)]">Input:</span> {ex.input}
                        </p>
                        <p>
                          <span className="text-[var(--text-tertiary)]">Output:</span> {ex.output}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {problemTab === 'hints' && (
                <div className="space-y-3" style={{ animation: 'fadeIn 0.2s ease-out' }}>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleRequestHint}
                    disabled={hintsUsed >= 3}
                  >
                    Request Hint
                  </Button>
                  <div className="flex items-center gap-1.5">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="w-2 h-2 rounded-full"
                        style={{
                          backgroundColor: i < hintsUsed ? 'var(--primary)' : 'var(--bg-subtle)',
                        }}
                      />
                    ))}
                    <span className="text-xs text-[var(--text-tertiary)] ml-1">
                      {hintsUsed} of 3 used
                    </span>
                  </div>
                  {showHint && (
                    <Card
                      className="border-l-4"
                      style={{ borderLeftColor: '#2D3A8C', animation: 'fadeInUp 0.3s ease-out' }}
                    >
                      <p className="text-sm text-[var(--text-secondary)]">
                        Consider using a hash map to store values you've already seen. For each
                        number, check if its complement (target - num) exists in the map.
                      </p>
                    </Card>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Collapse expand button */}
        {leftCollapsed && (
          <button
            type="button"
            onClick={() => setLeftCollapsed(false)}
            className="w-6 flex-shrink-0 bg-[var(--bg-card)] border-r border-[var(--border-default)] flex items-center justify-center cursor-pointer hover:bg-[var(--bg-subtle)] transition-colors text-[var(--text-tertiary)]"
          >
            <ChevronRight size={14} />
          </button>
        )}

        {/* Center — Code Editor */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Editor header */}
          <div className="h-9 bg-[var(--bg-raised)] border-b border-[var(--border-default)] flex items-center px-3 shrink-0">
            <div className="bg-[var(--bg-card)] px-3 py-1 rounded-t text-sm text-[var(--text-primary)] border border-[var(--border-default)] border-b-0 -mb-px">
              solution.py
            </div>
            <Badge variant="neutral" className="ml-3">
              Python
            </Badge>
            <div className="ml-auto flex items-center gap-1.5 text-xs text-[var(--text-tertiary)]">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>2 editors</span>
            </div>
          </div>

          {/* Monaco + simulated cursors */}
          <div className="flex-1 min-h-0 relative">
            <Editor
              height="100%"
              language="python"
              value={mockCode}
              theme="vs-dark"
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                padding: { top: 12 },
                scrollBeyondLastLine: false,
              }}
            />

            {/* Simulated cursor 1 — Bob */}
            <div
              className="absolute pointer-events-none"
              style={{
                top: 86,
                left: 180,
                transition: 'top 0.3s, left 0.3s',
              }}
            >
              <div className="w-0.5 h-[18px] bg-blue-500" />
              <span className="absolute top-[-18px] left-0 bg-blue-500 text-white text-[10px] px-1 rounded whitespace-nowrap">
                Bob K.
              </span>
            </div>

            {/* Simulated cursor 2 — Carol */}
            <div
              className="absolute pointer-events-none"
              style={{
                top: 148,
                left: 240,
                transition: 'top 0.3s, left 0.3s',
              }}
            >
              <div className="w-0.5 h-[18px] bg-emerald-500" />
              <span className="absolute top-[-18px] left-0 bg-emerald-500 text-white text-[10px] px-1 rounded whitespace-nowrap">
                Carol W.
              </span>
            </div>
          </div>

          {/* Output / Test Cases section */}
          {showOutput && (
            <div className="h-40 border-t border-[var(--border-default)] bg-[var(--bg-card)] flex flex-col shrink-0">
              <div className="flex items-center gap-1 px-3 py-1 border-b border-[var(--border-default)]">
                {(['output', 'testcases'] as OutputTab[]).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setOutputTab(tab)}
                    className={`px-2.5 py-1 rounded text-xs cursor-pointer transition-colors ${
                      outputTab === tab
                        ? 'bg-[var(--primary-muted)] text-[var(--primary)] font-medium'
                        : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                    }`}
                  >
                    {tab === 'output' ? 'Output' : 'Test Cases'}
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-y-auto p-3 font-mono text-xs">
                {outputTab === 'output' && (
                  <pre className="text-[var(--text-secondary)]">
                    {`>>> two_sum([2, 7, 11, 15], 9)
[0, 1]
>>> two_sum([3, 2, 4], 6)
[1, 2]`}
                  </pre>
                )}
                {outputTab === 'testcases' && (
                  <div className="space-y-2">
                    {testsPassed && (
                      <div
                        className="flex items-center gap-2 text-[var(--success)] font-semibold mb-2"
                        style={{ animation: 'fadeInUp 0.3s ease-out' }}
                      >
                        <CheckCircle size={16} />
                        All Tests Passed!
                      </div>
                    )}
                    {[
                      { input: '[2,7,11,15], 9', expected: '[0,1]', actual: '[0,1]', pass: true },
                      { input: '[3,2,4], 6', expected: '[1,2]', actual: '[1,2]', pass: true },
                      { input: '[3,3], 6', expected: '[0,1]', actual: '[0,1]', pass: true },
                    ].map((tc, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${tc.pass ? 'bg-[var(--success)]' : 'bg-[var(--error)]'}`}
                        />
                        <span className="text-[var(--text-secondary)]">
                          Test {i + 1}: {tc.input} → {tc.actual}
                        </span>
                        <Badge variant={tc.pass ? 'success' : 'error'}>
                          {tc.pass ? 'Pass' : 'Fail'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Run/Submit Bar */}
          <div className="h-12 bg-[var(--bg-card)] border-t border-[var(--border-default)] flex items-center justify-between px-4 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--text-secondary)] font-medium">Python</span>
              <span className="text-xs text-[var(--text-tertiary)] font-mono">
                Ctrl+Enter to run
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={handleRunCode}>
                Run Code
              </Button>
              <Button variant="primary" size="sm" onClick={handleSubmit}>
                Submit
              </Button>
            </div>
          </div>
        </div>

        {/* Right Panel */}
        <div className="w-80 flex-shrink-0 bg-[var(--bg-card)] border-l border-[var(--border-default)] flex flex-col">
          {/* Icon tab bar */}
          <div className="h-10 flex border-b border-[var(--border-default)] shrink-0">
            {rightTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = rightTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setRightTab(tab.key)}
                  className={`flex-1 flex items-center justify-center cursor-pointer transition-colors ${
                    isActive
                      ? 'text-[var(--primary)] border-b-2 border-[var(--primary)]'
                      : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                  }`}
                  title={tab.label}
                >
                  <Icon size={16} />
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-4">
            {rightTab === 'ai' && <AiTab hintsUsed={hintsUsed} onRequestHint={handleRequestHint} />}
            {rightTab === 'chat' && <ChatTab />}
            {rightTab === 'participants' && <ParticipantsTab onAdvance={onAdvance} />}
          </div>
        </div>
      </div>
    </div>
  );
}

/* === Sub-components for right panel tabs === */

function AiTab({ hintsUsed, onRequestHint }: { hintsUsed: number; onRequestHint: () => void }) {
  return (
    <div className="space-y-5" style={{ animation: 'fadeIn 0.2s ease-out' }}>
      {/* Hints */}
      <div>
        <h4 className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-2">
          Hints
        </h4>
        <Button variant="secondary" size="sm" onClick={onRequestHint} disabled={hintsUsed >= 3}>
          Get Hint
        </Button>
        <div className="flex items-center gap-1.5 mt-2">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: i < hintsUsed ? 'var(--primary)' : 'var(--bg-subtle)' }}
            />
          ))}
          <span className="text-xs text-[var(--text-tertiary)] ml-1">{hintsUsed} of 3 used</span>
        </div>
        {hintsUsed > 0 && (
          <Card
            className="mt-3 border-l-4"
            style={{ borderLeftColor: '#2D3A8C', animation: 'fadeInUp 0.3s ease-out' }}
          >
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Use a hash map to store each number's index as you iterate. Check if the complement
              exists before adding.
            </p>
          </Card>
        )}
      </div>

      {/* AI Review */}
      <div>
        <h4 className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-3">
          AI Review
        </h4>
        <div className="flex justify-center mb-3">
          <ProgressRing value={85} size={80} strokeWidth={6} />
        </div>
        <div className="space-y-2">
          {[
            { label: 'Problem Solving', value: 90 },
            { label: 'Code Quality', value: 82 },
            { label: 'Communication', value: 84 },
          ].map((cat) => (
            <div key={cat.label}>
              <div className="flex justify-between mb-0.5">
                <span className="text-xs text-[var(--text-secondary)]">{cat.label}</span>
                <span className="text-xs font-medium">{cat.value}</span>
              </div>
              <div className="h-1.5 rounded-full bg-[var(--bg-subtle)]">
                <div
                  className="h-1.5 rounded-full gradient-brand"
                  style={{ width: `${cat.value}%`, transition: 'width 800ms ease-out' }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ChatTab() {
  const [message, setMessage] = useState('');

  return (
    <div className="flex flex-col h-full" style={{ animation: 'fadeIn 0.2s ease-out' }}>
      <div className="flex-1 space-y-3 overflow-y-auto">
        {chatMessages.map((msg) => {
          if (msg.system) {
            return (
              <div key={msg.id} className="text-center">
                <span className="text-xs text-[var(--text-tertiary)] italic">{msg.text}</span>
              </div>
            );
          }

          const isOwn = msg.own;
          return (
            <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] ${isOwn ? 'order-2' : ''}`}>
                {!isOwn && (
                  <span className="text-[10px] text-[var(--text-tertiary)] mb-0.5 block">
                    {msg.name}
                  </span>
                )}
                <div
                  className={`px-3 py-2 text-sm ${
                    isOwn
                      ? 'bg-[var(--primary-muted)] text-[var(--text-primary)] rounded-2xl rounded-br-none'
                      : 'bg-[var(--bg-card)] shadow-xs text-[var(--text-primary)] rounded-2xl rounded-bl-none border border-[var(--border-default)]'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Chat input */}
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[var(--border-default)]">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 h-9 rounded-full bg-[var(--bg-subtle)] border-none px-4 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:ring-2 focus:ring-[var(--primary)]/50"
        />
        <button
          type="button"
          className="w-9 h-9 rounded-full gradient-brand flex items-center justify-center text-white cursor-pointer shrink-0"
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}

function ParticipantsTab({ onAdvance }: { onAdvance: () => void }) {
  const participants = [
    { user: users[0], role: 'interviewer', isHost: true },
    { user: users[1], role: 'candidate', isHost: false },
    { user: users[2], role: 'spectator', isHost: false },
  ];

  return (
    <div className="space-y-3" style={{ animation: 'fadeIn 0.2s ease-out' }}>
      {participants.map((p) => (
        <Card key={p.user.id} padding="p-3">
          <div className="flex items-center gap-3">
            <Avatar size="sm" name={p.user.name} online />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                {p.user.name}
                {p.isHost && (
                  <span className="text-[10px] text-[var(--text-tertiary)] ml-1">(host)</span>
                )}
              </p>
              <Badge
                variant={
                  p.role === 'candidate' ? 'info' : p.role === 'interviewer' ? 'neutral' : 'warning'
                }
              >
                {p.role}
              </Badge>
            </div>
            <span className="w-2 h-2 rounded-full bg-[var(--success)]" />
          </div>
        </Card>
      ))}

      <Button variant="primary" size="sm" className="w-full mt-4" onClick={onAdvance}>
        Advance Stage
      </Button>
    </div>
  );
}

function useDrag(elRef: React.RefObject<HTMLElement | null>) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const state = useRef({ startX: 0, startY: 0, posX: 0, posY: 0 });

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Don't drag from buttons
      if ((e.target as HTMLElement).closest('button')) return;
      e.preventDefault();
      state.current = { startX: e.clientX, startY: e.clientY, posX: pos.x, posY: pos.y };
      setDragging(true);

      const onMouseMove = (ev: MouseEvent) => {
        let nx = state.current.posX + (ev.clientX - state.current.startX);
        let ny = state.current.posY + (ev.clientY - state.current.startY);

        // Bounds clamping — keep element within viewport
        const el = elRef.current;
        if (el) {
          const rect = el.getBoundingClientRect();
          const baseX = rect.left - nx;
          const baseY = rect.top - ny;
          const minX = -baseX + 8;
          const maxX = window.innerWidth - rect.width - baseX - 8;
          const minY = -baseY + 8;
          const maxY = window.innerHeight - rect.height - baseY - 8;
          nx = Math.max(minX, Math.min(maxX, nx));
          ny = Math.max(minY, Math.min(maxY, ny));
        }

        setPos({ x: nx, y: ny });
      };

      const onMouseUp = () => {
        setDragging(false);
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      document.body.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';
    },
    [pos, elRef],
  );

  return { pos, dragging, onMouseDown };
}

function FloatingVideoStrip() {
  const [minimized, setMinimized] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { pos, dragging, onMouseDown } = useDrag(containerRef);
  const videoUsers = [users[0], users[1], users[2]];

  if (minimized) {
    return (
      <button
        type="button"
        onClick={() => setMinimized(false)}
        className="fixed bottom-4 right-[340px] z-40 flex items-center gap-2 px-3 py-2 rounded-full bg-[#1a1a2e]/95 shadow-lg border border-white/10 cursor-pointer hover:bg-[#1a1a2e] transition-colors"
        style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
      >
        <Video size={14} className="text-white/70" />
        <div className="flex -space-x-2">
          {videoUsers.map((u) => (
            <div
              key={u.id}
              className="w-6 h-6 rounded-full bg-[var(--bg-subtle)] border-2 border-[#1a1a2e] overflow-hidden flex items-center justify-center"
            >
              <span className="text-[8px] font-bold text-[var(--text-secondary)]">
                {u.name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')}
              </span>
            </div>
          ))}
        </div>
        <span className="text-[10px] text-white/60">{videoUsers.length}</span>
      </button>
    );
  }

  return (
    <div
      ref={containerRef}
      onMouseDown={onMouseDown}
      className={`fixed bottom-4 right-[340px] z-40 flex items-center gap-1.5 px-2 py-1.5 rounded-xl bg-[#1a1a2e]/95 shadow-lg border border-white/10 backdrop-blur-sm ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
    >
      {videoUsers.map((user, i) => (
        <div
          key={user.id}
          className="relative rounded-lg overflow-hidden"
          style={{
            width: 80,
            height: 60,
            backgroundColor: '#252540',
            border: i === 1 ? '2px solid var(--primary)' : '2px solid transparent',
          }}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <Avatar size="xs" name={user.name} />
          </div>
          <div className="absolute bottom-0.5 left-0.5">
            <span className="text-[9px] text-white bg-black/60 rounded px-1 py-0.5 leading-none">
              {user.name.split(' ')[0]}
            </span>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => setMinimized(true)}
        className="ml-0.5 p-1 rounded-md hover:bg-white/10 cursor-pointer text-white/50 hover:text-white/80 transition-colors"
        title="Minimize video"
      >
        <ChevronDown size={12} />
      </button>
    </div>
  );
}
