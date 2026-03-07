import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../../components/ui/Button.tsx';
import { Card } from '../../components/ui/Card.tsx';
import { Combobox } from '../../components/ui/Combobox.tsx';
import { Input } from '../../components/ui/Input.tsx';
import { Select } from '../../components/ui/Select.tsx';
import { problems } from '../../data/problems.ts';

const problemOptions = problems.map((p) => ({
  value: p.id,
  label: p.title,
  secondary: `${p.difficulty} · ${p.tags.join(', ')}`,
}));

const STEPS = ['Details', 'Settings', 'Confirm'] as const;
const MAX_PARTICIPANT_OPTIONS = [2, 3, 4, 5, 6];
const TIME_LIMITS = [
  { value: '15', label: '15 minutes' },
  { value: '30', label: '30 minutes' },
  { value: '45', label: '45 minutes' },
  { value: '60', label: '60 minutes' },
];
const LANGUAGES = ['JavaScript', 'Python', 'TypeScript', 'Go', 'Rust'];

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {STEPS.map((label, i) => {
        const stepNum = i + 1;
        const isCompleted = stepNum < currentStep;
        const isCurrent = stepNum === currentStep;
        const isFuture = stepNum > currentStep;

        return (
          <div key={label} className="flex items-center">
            {i > 0 && (
              <div
                className="w-12 sm:w-20 h-0.5 mx-1"
                style={{
                  background: isCompleted ? 'var(--gradient-brand)' : 'var(--bg-subtle)',
                }}
              />
            )}
            <div className="flex flex-col items-center gap-1.5">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-200"
                style={{
                  background:
                    isCompleted || isCurrent ? 'var(--gradient-brand)' : 'var(--bg-subtle)',
                  color: isCompleted || isCurrent ? '#fff' : 'var(--text-tertiary)',
                }}
              >
                {isCompleted ? (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  stepNum
                )}
              </div>
              <span
                className="text-xs font-medium whitespace-nowrap"
                style={{
                  color: isFuture ? 'var(--text-tertiary)' : 'var(--primary)',
                }}
              >
                {label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function CreateRoom() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);

  // Step 1
  const [roomName, setRoomName] = useState('');
  const [problemId, setProblemId] = useState(problems[0].id);

  // Step 2
  const [maxParticipants, setMaxParticipants] = useState(4);
  const [timeLimit, setTimeLimit] = useState('30');
  const [aiInterviewer, setAiInterviewer] = useState(false);
  const [language, setLanguage] = useState('JavaScript');

  const selectedProblem = problems.find((p) => p.id === problemId);

  function handleNext() {
    if (currentStep < 3) setCurrentStep((s) => s + 1);
  }

  function handleBack() {
    if (currentStep > 1) setCurrentStep((s) => s - 1);
  }

  function handleCreate() {
    navigate('/rooms/ROOM01/');
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-start justify-center py-10 px-4">
      <div className="w-full max-w-lg">
        <h1 className="font-display text-2xl font-bold text-[var(--text-primary)] text-center mb-2">
          Create Room
        </h1>
        <p className="text-sm text-[var(--text-secondary)] text-center mb-8">
          Set up a new practice session
        </p>

        <StepIndicator currentStep={currentStep} />

        {/* Step 1 — Details */}
        {currentStep === 1 && (
          <Card padding="p-6" className="animate-[fadeInUp_0.3s_ease-out]">
            <h2 className="font-display text-lg font-semibold text-[var(--text-primary)] mb-5">
              Room Details
            </h2>
            <div className="space-y-4">
              <Input
                label="Room Name"
                placeholder="My Practice Room"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
              />
              <Combobox
                label="Problem"
                placeholder="Search problems..."
                options={problemOptions}
                value={problemId}
                onChange={(v) => setProblemId(v)}
              />
            </div>
          </Card>
        )}

        {/* Step 2 — Settings */}
        {currentStep === 2 && (
          <Card padding="p-6" className="animate-[fadeInUp_0.3s_ease-out]">
            <h2 className="font-display text-lg font-semibold text-[var(--text-primary)] mb-5">
              Session Settings
            </h2>
            <div className="space-y-5">
              {/* Max Participants */}
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                  Max Participants
                </label>
                <div className="flex gap-2">
                  {MAX_PARTICIPANT_OPTIONS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setMaxParticipants(n)}
                      className="h-10 w-10 rounded-full text-sm font-semibold transition-all duration-200 cursor-pointer"
                      style={{
                        background:
                          maxParticipants === n ? 'var(--gradient-brand)' : 'var(--bg-subtle)',
                        color: maxParticipants === n ? '#fff' : 'var(--text-primary)',
                      }}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Time Limit */}
              <Select
                label="Time Limit"
                value={timeLimit}
                onChange={(e) => setTimeLimit(e.target.value)}
              >
                {TIME_LIMITS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>

              {/* AI Interviewer Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)]">
                    AI Interviewer
                  </label>
                  <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                    Enable AI-powered interview guidance
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={aiInterviewer}
                  onClick={() => setAiInterviewer((v) => !v)}
                  className="relative w-11 h-6 rounded-full transition-all duration-200 cursor-pointer"
                  style={{
                    background: aiInterviewer ? 'var(--gradient-brand)' : 'var(--bg-subtle)',
                  }}
                >
                  <span
                    className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200"
                    style={{
                      transform: aiInterviewer ? 'translateX(20px)' : 'translateX(0)',
                    }}
                  />
                </button>
              </div>

              {/* Language */}
              <Select
                label="Language"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
              >
                {LANGUAGES.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </Select>
            </div>
          </Card>
        )}

        {/* Step 3 — Confirm */}
        {currentStep === 3 && (
          <Card padding="p-6" className="animate-[fadeInUp_0.3s_ease-out]">
            <h2 className="font-display text-lg font-semibold text-[var(--text-primary)] mb-5">
              Confirm Room
            </h2>
            <div className="space-y-3">
              <SummaryRow label="Room Name" value={roomName || 'Untitled Room'} />
              <SummaryRow label="Problem" value={selectedProblem?.title ?? '—'} />
              <SummaryRow label="Max Participants" value={String(maxParticipants)} />
              <SummaryRow label="Time Limit" value={`${timeLimit} minutes`} />
              <SummaryRow label="AI Interviewer" value={aiInterviewer ? 'Enabled' : 'Disabled'} />
              <SummaryRow label="Language" value={language} />
            </div>
          </Card>
        )}

        {/* Navigation */}
        <div className="flex gap-3 mt-6">
          {currentStep > 1 && (
            <Button variant="secondary" className="flex-1" onClick={handleBack}>
              Back
            </Button>
          )}
          {currentStep < 3 ? (
            <Button className="flex-1" onClick={handleNext}>
              Next
            </Button>
          ) : (
            <Button className="flex-1 h-12" onClick={handleCreate}>
              Create Room
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-[var(--border-default)] last:border-0">
      <span className="text-sm text-[var(--text-secondary)]">{label}</span>
      <span className="text-sm font-medium text-[var(--text-primary)]">{value}</span>
    </div>
  );
}
