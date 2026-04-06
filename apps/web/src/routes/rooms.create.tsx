import { zodResolver } from '@hookform/resolvers/zod';
import { CONTROL_API } from '@syncode/contracts';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '@syncode/shared';
import {
  Badge,
  Button,
  Card,
  cn,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@syncode/ui';
import { useMutation } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Check, ChevronDown, Code2, Copy, FileCode2, Globe, Lock } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { api, readApiError } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth.store';

export const Route = createFileRoute('/rooms/create')({
  component: CreateRoomPage,
});

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

  let queryIndex = 0;
  for (let i = 0; i < normalizedLabel.length && queryIndex < normalizedQuery.length; i++) {
    if (normalizedLabel[i] === normalizedQuery[queryIndex]) {
      queryIndex++;
    }
  }

  return queryIndex === normalizedQuery.length;
}

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
  const [createdRoomId, setCreatedRoomId] = useState<string | null>(null);
  const [createdRoomCode, setCreatedRoomCode] = useState<string | null>(null);
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
    control,
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
      setCreatedRoomId(room.roomId);
      setCreatedRoomCode(room.roomCode);
      setInviteLink(`${window.location.origin}/rooms/${room.roomId}?code=${room.roomCode}`);
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
    <div className="flex min-h-screen items-start justify-center bg-background px-4 py-16 text-foreground">
      <div className="w-full max-w-lg">
        <div className="mb-10 text-center">
          <h1 className="mb-2.5 text-4xl font-extrabold tracking-tighter text-primary">
            Create Workspace
          </h1>
          <p className="text-base text-muted-foreground">
            Setup your shared real-time coding environment
          </p>
        </div>

        <Card className="rounded-2xl border-border/60 bg-card/95 p-8 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.7)]">
          {!inviteLink ? (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-7">
              {/* Problem Selector */}
              <div>
                <Label className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Problem to Solve
                </Label>
                <input type="hidden" {...register('problemId')} />

                <div ref={comboboxRef}>
                  <div className="relative">
                    <FileCode2
                      className="pointer-events-none absolute left-3.5 top-3.5 text-muted-foreground"
                      size={18}
                    />
                    <Input
                      type="text"
                      value={problemInput}
                      onFocus={() => setIsProblemMenuOpen(true)}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        setProblemInput(nextValue);
                        setIsProblemMenuOpen(true);
                        setValue('problemId', '', { shouldValidate: true });
                      }}
                      placeholder="Type to search and select a problem"
                      role="combobox"
                      aria-expanded={isProblemMenuOpen}
                      aria-controls="problem-listbox"
                      aria-autocomplete="list"
                      aria-haspopup="listbox"
                      className="rounded-xl pl-11"
                    />
                    <ChevronDown
                      className="pointer-events-none absolute right-3 top-3.5 text-muted-foreground"
                      size={18}
                    />

                    {isProblemMenuOpen && (
                      <div
                        id="problem-listbox"
                        role="listbox"
                        className="absolute z-20 mt-2 max-h-56 w-full overflow-auto rounded-xl border border-border bg-popover p-1.5 shadow-2xl"
                      >
                        {filteredProblems.length > 0 ? (
                          filteredProblems.map((problem) => (
                            <button
                              key={problem.value}
                              type="button"
                              role="option"
                              aria-selected={problem.value === selectedProblemId}
                              onClick={() => {
                                setValue('problemId', problem.value, { shouldValidate: true });
                                setProblemInput(problem.label);
                                setIsProblemMenuOpen(false);
                              }}
                              className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted"
                            >
                              {problem.label}
                            </button>
                          ))
                        ) : (
                          <p className="px-3 py-2 text-sm text-muted-foreground">
                            No matching problems
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {errors.problemId && (
                  <p className="mt-1.5 pl-1 text-xs text-destructive">{errors.problemId.message}</p>
                )}
              </div>

              {/* Language Picker */}
              <div>
                <Label className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Coding Language
                </Label>
                <Controller
                  name="language"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger
                        className={cn(
                          'rounded-xl',
                          errors.language && 'border-destructive ring-destructive/20',
                        )}
                      >
                        <div className="flex items-center gap-2.5">
                          <Code2 size={18} className="text-muted-foreground" />
                          <SelectValue placeholder="Select a language" />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        {LANGUAGE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.language && (
                  <p className="mt-1.5 pl-1 text-xs text-destructive">{errors.language.message}</p>
                )}
              </div>

              {/* Visibility Toggle */}
              <div>
                <Label className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Visibility
                </Label>
                <div className="flex items-center gap-4 rounded-xl border border-border p-4">
                  <input
                    {...register('isPublic')}
                    type="checkbox"
                    id="isPublic"
                    className="size-5 rounded border-input bg-background text-primary focus:ring-ring/50 focus:ring-offset-background"
                  />
                  <label htmlFor="isPublic" className="flex flex-1 cursor-pointer flex-col">
                    <span className="text-sm font-semibold text-foreground">Public Room</span>
                    <span className="mt-0.5 text-xs text-muted-foreground">
                      Anyone with the link can join directly
                    </span>
                  </label>
                  <Globe className="text-muted-foreground/60" size={20} />
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <Button
                  type="submit"
                  size="lg"
                  disabled={isSubmitting || createRoomMutation.isPending}
                  className="w-full rounded-xl shadow-[0_0_25px_hsl(var(--primary)/0.4)] hover:shadow-[0_0_35px_hsl(var(--primary)/0.6)]"
                >
                  {isSubmitting || createRoomMutation.isPending
                    ? 'Provisioning Workspace...'
                    : 'Create Collaborative Room'}
                </Button>
                {submissionError && (
                  <p className="mt-2 text-sm text-destructive" role="alert">
                    {submissionError}
                  </p>
                )}
              </div>
            </form>
          ) : (
            <div className="animate-in fade-in slide-in-from-bottom-5 space-y-7 duration-500">
              <div className="space-y-3.5 rounded-xl border border-border p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Selected Workspace Details
                </p>
                <div className="flex flex-wrap gap-2.5 pt-1">
                  <Badge variant="outline" className="gap-2 px-4 py-1.5 text-sm">
                    <FileCode2 size={16} className="text-primary" />
                    {ROOM_PROBLEMS.find((problem) => problem.value === submittedData?.problemId)
                      ?.label ?? submittedData?.problemId}
                  </Badge>
                  <Badge variant="outline" className="gap-2 px-4 py-1.5 text-sm">
                    <Code2 size={16} className="text-primary" />
                    {LANGUAGE_OPTIONS.find((language) => language.value === submittedData?.language)
                      ?.label ?? submittedData?.language}
                  </Badge>
                  <Badge variant="outline" className="gap-2 px-4 py-1.5 text-sm">
                    {submittedData?.isPublic ? (
                      <Globe size={16} className="text-primary" />
                    ) : (
                      <Lock size={16} className="text-primary" />
                    )}
                    {submittedData?.isPublic ? 'Public Access' : 'Private'}
                  </Badge>
                </div>
              </div>

              <div className="h-px w-full bg-border/60" />

              <div>
                <div className="mb-3.5 flex items-center gap-2.5 text-xl font-bold text-primary drop-shadow-[0_0_12px_hsl(var(--primary)/0.6)]">
                  <Check size={24} />
                  <span>Room Provisioned Successfully!</span>
                </div>
                <p className="mb-3.5 pl-1 text-sm text-muted-foreground">
                  Share this invite link with collaborators:
                </p>

                <div className="flex items-center rounded-xl border border-border bg-background p-1.5 transition-all duration-300 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
                  <Input
                    type="text"
                    readOnly
                    value={inviteLink ?? ''}
                    className="flex-1 border-none bg-transparent shadow-none focus-visible:ring-0"
                  />
                  <button
                    type="button"
                    onClick={copyToClipboard}
                    className="flex shrink-0 items-center justify-center rounded-lg bg-muted p-3 text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
                    title="Copy link"
                  >
                    {copied ? <Check size={18} className="text-primary" /> : <Copy size={18} />}
                  </button>
                </div>
              </div>

              <div className="flex gap-4 pt-3">
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full rounded-xl"
                  onClick={() => {
                    setInviteLink(null);
                    setCreatedRoomId(null);
                    setCreatedRoomCode(null);
                    reset();
                    setProblemInput('');
                    setSubmissionError(null);
                    setSubmittedData(null);
                    setCopied(false);
                  }}
                >
                  Setup New Room
                </Button>
                <Button
                  size="lg"
                  className="w-full rounded-xl"
                  onClick={() => {
                    if (!createdRoomId) {
                      return;
                    }

                    if (createdRoomCode) {
                      window.location.assign(`/rooms/${createdRoomId}?code=${createdRoomCode}`);
                      return;
                    }

                    void navigate({
                      to: '/rooms/$roomId',
                      params: { roomId: createdRoomId },
                    });
                  }}
                  disabled={!createdRoomId}
                >
                  Enter Workspace
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
