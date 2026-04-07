import { zodResolver } from '@hookform/resolvers/zod';
import { CONTROL_API } from '@syncode/contracts';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '@syncode/shared';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  cn,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@syncode/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Check, ChevronDown, Code2, Copy, FileCode2, Globe, Lock } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useClipboard } from '@/hooks/use-clipboard.js';
import { api, readApiError } from '@/lib/api-client.js';
import { requireAuth } from '@/lib/auth.js';
import i18n from '@/lib/i18n.js';
import { useAuthStore } from '@/stores/auth.store.js';

export const Route = createFileRoute('/rooms/create')({
  beforeLoad: requireAuth,
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

const DIFFICULTY_KEYS: Record<string, string> = {
  easy: 'problems:detail.easy',
  medium: 'problems:detail.medium',
  hard: 'problems:detail.hard',
};

const createRoomFormSchema = z.object({
  problemId: z.string().min(1),
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
  const { t } = useTranslation('rooms');
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate({ to: '/login' }).catch(() => {});
    }
  }, [isAuthenticated, navigate]);

  const problemsQuery = useQuery({
    queryKey: ['problems', 'list-for-room'],
    queryFn: () => api(CONTROL_API.PROBLEMS.LIST, { searchParams: { limit: 100 } }),
  });

  const availableProblems = useMemo(() => {
    return (problemsQuery.data?.data ?? []).map((p) => ({
      value: p.id,
      label: `${p.title} (${DIFFICULTY_KEYS[p.difficulty] != null ? i18n.t(DIFFICULTY_KEYS[p.difficulty] as string) : p.difficulty})`,
    }));
  }, [problemsQuery.data]);

  const comboboxRef = useRef<HTMLDivElement>(null);

  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [createdRoomId, setCreatedRoomId] = useState<string | null>(null);
  const [createdRoomCode, setCreatedRoomCode] = useState<string | null>(null);
  const { copied, copy } = useClipboard();
  const [problemInput, setProblemInput] = useState('');
  const [isProblemMenuOpen, setIsProblemMenuOpen] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [submittedData, setSubmittedData] = useState<CreateRoomFormData | null>(null);

  const filteredProblems = useMemo(() => {
    return availableProblems.filter((problem) => matchesProblemQuery(problem.label, problemInput));
  }, [availableProblems, problemInput]);

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

        const selectedProblem = availableProblems.find(
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
  }, [availableProblems, isProblemMenuOpen, selectedProblemId]);

  const createRoomMutation = useMutation({
    mutationFn: (data: CreateRoomFormData) =>
      api(CONTROL_API.ROOMS.CREATE, {
        body: {
          mode: 'peer',
          name: `${availableProblems.find((problem) => problem.value === data.problemId)?.label ?? 'Interview'} Room`,
          problemId: data.problemId,
          language: data.language,
          config: {
            maxParticipants: 2,
            maxDuration: 120,
            isPrivate: !data.isPublic,
          },
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['rooms'] });
    },
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
      setSubmissionError(apiError?.message ?? t('create.createFailed'));
    }
  };

  const copyToClipboard = () => {
    if (inviteLink) {
      copy(inviteLink);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:py-10 lg:py-12">
      <motion.section
        className="max-w-3xl"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {t('create.heading')}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground sm:text-base">{t('create.sub')}</p>
      </motion.section>

      <motion.div
        className="mt-8 max-w-2xl"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
      >
        {!inviteLink ? (
          <Card className="border border-border/50 bg-card/80 p-6 backdrop-blur-sm sm:p-8">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-7">
              <div>
                <Label className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('create.problemLabel')}
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
                      placeholder={t('create.problemPlaceholder')}
                      role="combobox"
                      aria-expanded={isProblemMenuOpen}
                      aria-controls="problem-listbox"
                      aria-autocomplete="list"
                      aria-haspopup="listbox"
                      className="pl-11"
                    />
                    <ChevronDown
                      className="pointer-events-none absolute right-3 top-3.5 text-muted-foreground"
                      size={18}
                    />

                    {isProblemMenuOpen && (
                      <div
                        id="problem-listbox"
                        role="listbox"
                        className="absolute z-20 mt-2 max-h-56 w-full overflow-auto rounded-lg border border-border bg-popover p-1.5 shadow-2xl"
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
                            {t('create.noMatchingProblems')}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {errors.problemId && (
                  <p className="mt-1.5 pl-1 text-xs text-destructive">
                    {t('create.problemRequired')}
                  </p>
                )}
              </div>

              <div>
                <Label className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('create.languageLabel')}
                </Label>
                <Controller
                  name="language"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger
                        className={cn(errors.language && 'border-destructive ring-destructive/20')}
                      >
                        <div className="flex items-center gap-2.5">
                          <Code2 size={18} className="text-muted-foreground" />
                          <SelectValue placeholder={t('create.languagePlaceholder')} />
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

              <div>
                <Label className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('create.visibilityLabel')}
                </Label>
                <Controller
                  name="isPublic"
                  control={control}
                  render={({ field }) => (
                    <label
                      htmlFor="isPublic"
                      className="flex cursor-pointer items-center gap-4 rounded-lg border border-border p-4 transition-colors hover:bg-muted/30"
                    >
                      <Checkbox
                        id="isPublic"
                        checked={field.value}
                        onCheckedChange={(checked) => field.onChange(checked === true)}
                      />
                      <div className="flex flex-1 flex-col">
                        <span className="text-sm font-semibold text-foreground">
                          {t('create.publicRoom')}
                        </span>
                        <span className="mt-0.5 text-xs text-muted-foreground">
                          {t('create.publicRoomDescription')}
                        </span>
                      </div>
                      {field.value ? (
                        <Globe className="text-muted-foreground/60" size={20} />
                      ) : (
                        <Lock className="text-muted-foreground/60" size={20} />
                      )}
                    </label>
                  )}
                />
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  size="lg"
                  disabled={isSubmitting || createRoomMutation.isPending}
                  className="w-full shadow-[0_0_25px_hsl(var(--primary)/0.4)] hover:shadow-[0_0_35px_hsl(var(--primary)/0.6)]"
                >
                  {isSubmitting || createRoomMutation.isPending
                    ? t('create.provisioning')
                    : t('create.button')}
                </Button>
                {submissionError && (
                  <p className="mt-2 text-sm text-destructive" role="alert">
                    {submissionError}
                  </p>
                )}
              </div>
            </form>
          </Card>
        ) : (
          <Card className="border border-border/50 bg-card/80 p-6 backdrop-blur-sm sm:p-8">
            <motion.div
              className="space-y-7"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="space-y-3.5 rounded-lg border border-border p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('success.details')}
                </p>
                <div className="flex flex-wrap gap-2.5 pt-1">
                  <Badge variant="outline" className="gap-2 px-4 py-1.5 text-sm">
                    <FileCode2 size={16} className="text-primary" />
                    {availableProblems.find((problem) => problem.value === submittedData?.problemId)
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
                    {submittedData?.isPublic ? t('success.publicAccess') : t('success.private')}
                  </Badge>
                </div>
              </div>

              <div className="h-px w-full bg-border/60" />

              <div>
                <div className="mb-3.5 flex items-center gap-2.5 text-xl font-bold text-primary drop-shadow-[0_0_12px_hsl(var(--primary)/0.6)]">
                  <Check size={24} />
                  <span>{t('success.provisioned')}</span>
                </div>
                <p className="mb-3.5 pl-1 text-sm text-muted-foreground">
                  {t('success.shareLink')}
                </p>

                <div className="relative flex items-center rounded-lg border border-border bg-background p-1.5 transition-all duration-300 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
                  <Input
                    type="text"
                    readOnly
                    value={inviteLink ?? ''}
                    className="flex-1 border-none bg-transparent font-mono text-sm shadow-none focus-visible:ring-0"
                  />
                  <div className="pointer-events-none absolute right-14 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent" />
                  <button
                    type="button"
                    onClick={copyToClipboard}
                    className="flex shrink-0 items-center justify-center rounded-md bg-muted p-3 text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
                    title={t('common:copyLink')}
                  >
                    {copied ? <Check size={18} className="text-primary" /> : <Copy size={18} />}
                  </button>
                </div>
              </div>

              <div className="flex gap-4 pt-3">
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full"
                  onClick={() => {
                    setInviteLink(null);
                    setCreatedRoomId(null);
                    setCreatedRoomCode(null);
                    reset();
                    setProblemInput('');
                    setSubmissionError(null);
                    setSubmittedData(null);
                  }}
                >
                  {t('success.setupNew')}
                </Button>
                <Button
                  size="lg"
                  className="w-full"
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
                  {t('success.enterWorkspace')}
                </Button>
              </div>
            </motion.div>
          </Card>
        )}
      </motion.div>
    </div>
  );
}
