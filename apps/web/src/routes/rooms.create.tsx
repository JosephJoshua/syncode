import { zodResolver } from '@hookform/resolvers/zod';
import { CONTROL_API } from '@syncode/contracts';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '@syncode/shared';
import { useMutation } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import {
  Check,
  ChevronDown,
  Code2,
  Copy,
  FileCode2,
  Globe,
  Lock,
  type LucideIcon,
} from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { type FieldError, useForm } from 'react-hook-form';
import { z } from 'zod';
import { RoomCard } from '@/components/rooms/room-card';
import { api, readApiError } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth.store';

export const Route = createFileRoute('/rooms/create')({
  component: CreateRoomPage,
});

// ─── 1. Validation Schema ───────────────────────────────────────
const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  python: 'Python 3.12',
  javascript: 'JavaScript (Node.js 20)',
  typescript: 'TypeScript (TSX)',
  java: 'Java 21',
  cpp: 'C++ (GCC 13)',
  c: 'C (GCC 13)',
  go: 'Go 1.22',
  rust: 'Rust 1.77',
};

const LANGUAGE_OPTIONS = SUPPORTED_LANGUAGES.map((lang) => ({
  value: lang,
  label: LANGUAGE_LABELS[lang],
}));

// TODO: Replace with useQuery against CONTROL_API.PROBLEMS.LIST
// Values are placeholder slugs — backend expects UUIDs for problemId
const ROOM_PROBLEMS = [
  { value: 'two-sum', label: 'Two Sum (Easy)' },
  { value: 'valid-parentheses', label: 'Valid Parentheses (Medium)' },
  { value: 'lru-cache', label: 'LRU Cache (Hard)' },
] as const;

const createRoomFormSchema = z.object({
  problemId: z.string().min(1, 'Please select a problem'),
  language: z.enum(SUPPORTED_LANGUAGES),
  isPublic: z.boolean(),
});
type CreateRoomFormData = z.infer<typeof createRoomFormSchema>;

function matchesProblemQuery(label: string, query: string) {
  const normalizedLabel = label.toLowerCase();
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  // Support subsequence matching: e.g. "ts" can match "Two Sum".
  let queryIndex = 0;
  for (let i = 0; i < normalizedLabel.length && queryIndex < normalizedQuery.length; i++) {
    if (normalizedLabel[i] === normalizedQuery[queryIndex]) {
      queryIndex++;
    }
  }

  return queryIndex === normalizedQuery.length;
}

// ─── 2. UI Components ──────────────────────────────────────────
const Label = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <p
    className={`block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2 ${className}`}
  >
    {children}
  </p>
);

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
};

const Button = ({ children, variant = 'primary', type = 'button', ...props }: ButtonProps) => {
  const baseStyle =
    'w-full font-semibold py-3 px-6 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 text-sm';
  const variants = {
    // Green neon button with glow effect
    primary:
      'bg-[oklch(0.82_0.18_165)] hover:bg-[oklch(0.88_0.18_165)] text-zinc-950 shadow-[0_0_25px_oklch(0.82_0.18_165/0.4)] hover:shadow-[0_0_35px_oklch(0.82_0.18_165/0.6)] active:scale-[0.98]',
    secondary:
      'bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700 active:scale-[0.98]',
  };
  return (
    <button type={type} className={`${baseStyle} ${variants[variant]}`} {...props}>
      {children}
    </button>
  );
};

const Badge = ({ children, icon: Icon }: { children: React.ReactNode; icon?: LucideIcon }) => (
  <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-zinc-900 border border-zinc-700 text-zinc-200 text-sm font-medium">
    {/* Badge icon color using green neon */}
    {Icon && <Icon size={16} className="text-[oklch(0.82_0.18_165)]" />}
    {children}
  </span>
);

type SelectOption = {
  value: string;
  label: string;
};

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  icon?: LucideIcon;
  options: readonly SelectOption[];
  error?: FieldError;
  placeholder?: string;
};

// Custom Select wrapper component to fix display and unify styling
const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ icon: Icon, options, error, placeholder, ...props }, ref) => (
    <div>
      <div className="relative">
        {Icon && <Icon size={18} className="absolute left-3.5 top-3.5 text-zinc-500" />}
        <select
          ref={ref}
          className={`w-full bg-zinc-900 border ${error ? 'border-red-500' : 'border-zinc-700/80'} ${Icon ? 'pl-11' : 'pl-4'} pr-11 py-3 text-zinc-100 rounded-xl appearance-none outline-none transition-all duration-150 focus:border-[oklch(0.45_0.18_165)] focus:shadow-[0_0_15px_oklch(0.88_0.18_165/0.6)] text-sm`}
          {...props}
        >
          {placeholder && (
            <option value="" disabled className="bg-zinc-900 text-zinc-500">
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-zinc-900 text-zinc-100">
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="absolute right-3 top-3.5 text-zinc-500 pointer-events-none"
          size={18}
        />
      </div>
      {error && <p className="text-red-400 text-xs mt-1.5 pl-1">{error.message}</p>}
    </div>
  ),
);
Select.displayName = 'Select';

// ─── 3. Main Page Component ───────────────────────────────────────
function CreateRoomPage() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate({ to: '/login' }).catch(() => {});
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) {
        clearTimeout(copiedTimerRef.current);
      }
    };
  }, []);

  const comboboxRef = useRef<HTMLDivElement>(null);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [problemInput, setProblemInput] = useState('');
  const [isProblemMenuOpen, setIsProblemMenuOpen] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [submittedData, setSubmittedData] = useState<CreateRoomFormData | null>(null);

  const filteredProblems = useMemo(() => {
    return ROOM_PROBLEMS.filter((problem) => matchesProblemQuery(problem.label, problemInput));
  }, [problemInput]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateRoomFormData>({
    resolver: zodResolver(createRoomFormSchema),
    defaultValues: { isPublic: true },
  });

  const selectedProblemId = watch('problemId');

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (comboboxRef.current && !comboboxRef.current.contains(event.target as Node)) {
        setIsProblemMenuOpen(false);

        const selectedProblem = ROOM_PROBLEMS.find(
          (problem) => problem.value === selectedProblemId,
        );

        if (selectedProblem) {
          setProblemInput(selectedProblem.label);
        }
      }
    }

    if (isProblemMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isProblemMenuOpen, selectedProblemId]);

  const createRoomMutation = useMutation({
    mutationFn: (data: CreateRoomFormData) =>
      api(CONTROL_API.ROOMS.CREATE, {
        body: {
          mode: 'peer',
          name: `${ROOM_PROBLEMS.find((problem) => problem.value === data.problemId)?.label ?? 'Interview'} Room`,
          language: data.language,
          config: {
            maxParticipants: 2,
            maxDuration: 120,
            isPrivate: !data.isPublic,
          },
        },
      }),
  });

  const onSubmit = async (data: CreateRoomFormData) => {
    setSubmissionError(null);

    try {
      const room = await createRoomMutation.mutateAsync(data);
      setSubmittedData(data);
      setInviteLink(`${window.location.origin}/rooms/${room.roomId}`);
    } catch (error) {
      const apiError = await readApiError(error);
      setSubmissionError(apiError?.message ?? 'Failed to create room. Please try again.');
    }
  };

  const copyToClipboard = async () => {
    if (inviteLink) {
      try {
        await navigator.clipboard.writeText(inviteLink);
        setCopied(true);

        if (copiedTimerRef.current) {
          clearTimeout(copiedTimerRef.current);
        }

        copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);
      } catch {
        // Clipboard API not available
      }
    }
  };

  return (
    // Main page background
    <div className="min-h-screen bg-[#050505] text-zinc-100 py-16 px-4 flex justify-center items-start">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="mb-10 text-center">
          {/* Page title in green neon */}
          <h1 className="text-4xl font-extrabold tracking-tighter text-[oklch(0.82_0.18_165)] mb-2.5">
            Create Workspace
          </h1>
          <p className="text-zinc-500 text-base">Setup your shared real-time coding environment</p>
        </div>

        <RoomCard className="p-8">
          {/* Show form if not yet submitted */}
          {!inviteLink ? (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-7">
              {/* Problem Selector */}
              <div>
                <Label>Problem to Solve</Label>
                <input type="hidden" {...register('problemId')} />

                <div ref={comboboxRef}>
                  <div className="relative">
                    <FileCode2
                      className="pointer-events-none absolute left-3.5 top-3.5 text-zinc-500"
                      size={18}
                    />
                    <input
                      type="text"
                      value={problemInput}
                      onFocus={() => setIsProblemMenuOpen(true)}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        setProblemInput(nextValue);
                        setIsProblemMenuOpen(true);

                        // Clear selected value while user is actively typing.
                        setValue('problemId', '', { shouldValidate: true });
                      }}
                      placeholder="Type to search and select a problem"
                      role="combobox"
                      aria-expanded={isProblemMenuOpen}
                      aria-controls="problem-listbox"
                      aria-autocomplete="list"
                      aria-haspopup="listbox"
                      className="w-full rounded-xl border border-zinc-700/80 bg-zinc-900 py-3 pr-11 pl-11 text-sm text-zinc-100 outline-none transition-all duration-150 placeholder:text-zinc-500 focus:border-[oklch(0.45_0.18_165)] focus:shadow-[0_0_15px_oklch(0.88_0.18_165/0.4)]"
                    />
                    <ChevronDown
                      className="pointer-events-none absolute right-3 top-3.5 text-zinc-500"
                      size={18}
                    />

                    {isProblemMenuOpen && (
                      <div
                        id="problem-listbox"
                        role="listbox"
                        className="absolute z-20 mt-2 max-h-56 w-full overflow-auto rounded-xl border border-zinc-700 bg-zinc-900 p-1.5 shadow-2xl"
                      >
                        {filteredProblems.length > 0 ? (
                          filteredProblems.map((problem) => (
                            <button
                              key={problem.value}
                              type="button"
                              role="option"
                              onClick={() => {
                                setValue('problemId', problem.value, { shouldValidate: true });
                                setProblemInput(problem.label);
                                setIsProblemMenuOpen(false);
                              }}
                              className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-zinc-200 transition-colors hover:bg-zinc-800"
                            >
                              {problem.label}
                            </button>
                          ))
                        ) : (
                          <p className="px-3 py-2 text-sm text-zinc-500">No matching problems</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {errors.problemId && (
                  <p className="mt-1.5 pl-1 text-xs text-red-400">{errors.problemId.message}</p>
                )}
              </div>

              {/* Language Picker */}
              <div>
                <Label>Coding Language</Label>
                <Select
                  icon={Code2}
                  error={errors.language}
                  {...register('language')}
                  defaultValue=""
                  placeholder="Select a language"
                  options={LANGUAGE_OPTIONS}
                />
              </div>

              {/* Visibility Toggle */}
              <div>
                <Label>Visibility</Label>
                <div className="flex items-center gap-4 p-4 rounded-xl border border-zinc-800 bg-zinc-900/40">
                  <input
                    {...register('isPublic')}
                    type="checkbox"
                    id="isPublic"
                    className="h-5 w-5 rounded border-zinc-700 bg-zinc-800 text-[oklch(0.82_0.18_165)] focus:ring-[oklch(0.45_0.18_165)/0.5] focus:ring-offset-[#0a0a0a]"
                  />
                  <label htmlFor="isPublic" className="flex flex-col cursor-pointer flex-1">
                    <span className="text-sm font-semibold text-zinc-200">Public Room</span>
                    <span className="text-xs text-zinc-500 mt-0.5">
                      Anyone with the link can join directly
                    </span>
                  </label>
                  <Globe className="text-zinc-600" size={20} />
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <Button type="submit" disabled={isSubmitting || createRoomMutation.isPending}>
                  {isSubmitting || createRoomMutation.isPending
                    ? 'Provisioning Workspace...'
                    : 'Create Collaborative Room'}
                </Button>
                {submissionError && (
                  <p className="mt-2 text-sm text-red-400" role="alert">
                    {submissionError}
                  </p>
                )}
              </div>
            </form>
          ) : (
            /* Show success section after submission */
            <div className="space-y-7 animate-in fade-in slide-in-from-bottom-5 duration-500">
              {/* Workspace configuration summary */}
              <div className="space-y-3.5 p-5 bg-zinc-900/40 rounded-xl border border-zinc-800">
                <Label className="mb-0">Selected Workspace Details</Label>
                <div className="flex flex-wrap gap-2.5 pt-1">
                  {/* Display selected options with friendly names */}
                  <Badge icon={FileCode2}>
                    {ROOM_PROBLEMS.find((problem) => problem.value === submittedData?.problemId)
                      ?.label ?? submittedData?.problemId}
                  </Badge>
                  <Badge icon={Code2}>
                    {LANGUAGE_OPTIONS.find((language) => language.value === submittedData?.language)
                      ?.label ?? submittedData?.language}
                  </Badge>
                  <Badge icon={submittedData?.isPublic ? Globe : Lock}>
                    {submittedData?.isPublic ? 'Public Access' : 'Private'}
                  </Badge>
                </div>
              </div>

              <div className="h-px w-full bg-zinc-800/80" />

              {/* Invite link section */}
              <div>
                <div className="text-[oklch(0.82_0.18_165)] flex items-center gap-2.5 mb-3.5 text-xl font-bold drop-shadow-[0_0_12px_oklch(0.82_0.18_165/0.6)]">
                  <Check size={24} />
                  <span>Room Provisioned Successfully!</span>
                </div>
                <p className="text-sm text-zinc-400 mb-3.5 pl-1">
                  Share this invite link with collaborators:
                </p>

                {/* Invite link input with green focus state */}
                <div className="flex items-center bg-zinc-950 border border-zinc-700 rounded-xl p-1.5 focus-within:border-[oklch(0.45_0.18_165)] focus-within:shadow-[0_0_15px_oklch(0.88_0.18_165/0.6)] transition-all duration-300">
                  <input
                    type="text"
                    readOnly
                    value={inviteLink}
                    className="flex-1 bg-transparent border-none outline-none text-zinc-100 text-sm px-3.5 w-full"
                  />
                  <button
                    type="button"
                    onClick={copyToClipboard}
                    className="p-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors flex items-center justify-center shrink-0"
                    title="Copy link"
                  >
                    {/* Copy button icon changes to green when copied */}
                    {copied ? (
                      <Check size={18} className="text-[oklch(0.82_0.18_165)]" />
                    ) : (
                      <Copy size={18} />
                    )}
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 pt-3">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setInviteLink(null);
                    reset();
                    setProblemInput('');
                    setSubmissionError(null);
                    setSubmittedData(null);
                  }}
                >
                  Setup New Room
                </Button>
                {/* TODO: Navigate to room workspace when implemented */}
                <Button disabled className="opacity-50 cursor-not-allowed">
                  Enter Workspace
                </Button>
              </div>
            </div>
          )}
        </RoomCard>
      </div>
    </div>
  );
}
