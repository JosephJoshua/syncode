import { CONTROL_API, type TagInfo } from '@syncode/contracts';
import {
  JOINABLE_ROLES,
  PROBLEM_DIFFICULTIES,
  type ProblemDifficulty,
  type RoomRole,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from '@syncode/shared';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  cn,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@syncode/ui';
import { useMutation, useQuery } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Check, CheckCircle2, ChevronDown, Loader2, Search, SlidersHorizontal } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { LANGUAGE_VERSIONED_LABELS } from '@/components/language-selector.data.js';
import { api, readApiError } from '@/lib/api-client.js';
import { resolveJoinError } from '@/lib/join-errors.js';
import { useAuthStore } from '@/stores/auth.store.js';

export const Route = createFileRoute('/_app/rooms/matchmaking')({
  component: MatchmakingPage,
});

type QueueStatus = 'idle' | 'searching' | 'matched';
type MatchFilterKey = 'languages' | 'roles' | 'problems';

const FILTER_OPTIONS: Array<{ key: MatchFilterKey; labelKey: string }> = [
  { key: 'languages', labelKey: 'matchmaking.languageLabel' },
  { key: 'roles', labelKey: 'matchmaking.roleLabel' },
  { key: 'problems', labelKey: 'matchmaking.problemLabel' },
];

const STATUS_POLL_MS = 2_500;

type ProblemOption = {
  id: string;
  title: string;
  difficulty: ProblemDifficulty;
  tags: string[];
};

function MatchmakingPage() {
  const { t } = useTranslation('rooms');
  const navigate = useNavigate();
  const currentUserId = useAuthStore((state) => state.user?.id ?? null);

  const [enabledFilters, setEnabledFilters] = useState<MatchFilterKey[]>(['languages', 'problems']);
  const [selectedLanguages, setSelectedLanguages] = useState<SupportedLanguage[]>(['python']);
  const [selectedRoles, setSelectedRoles] = useState<RoomRole[]>([]);
  const [selectedDifficulties, setSelectedDifficulties] = useState<ProblemDifficulty[]>([]);
  const [selectedProblemIds, setSelectedProblemIds] = useState<string[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [queueStatus, setQueueStatus] = useState<QueueStatus>('idle');
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  const [activeQueueRequestId, setActiveQueueRequestId] = useState<string | null>(null);
  const matchedRoomIdRef = useRef<string | null>(null);
  const queueStatusRef = useRef<QueueStatus>('idle');
  const isMountedRef = useRef(true);
  const updateQueueStatus = useCallback((status: QueueStatus) => {
    queueStatusRef.current = status;
    setQueueStatus(status);
  }, []);

  const problemsQuery = useQuery({
    queryKey: ['matchmaking-problems'],
    queryFn: () => api(CONTROL_API.PROBLEMS.LIST, { searchParams: { limit: 50 } }),
  });
  const topicOptionsQuery = useQuery({
    queryKey: ['matchmaking-topics'],
    queryFn: () => api(CONTROL_API.PROBLEMS.TAGS),
  });

  const problems = useMemo<ProblemOption[]>(
    () =>
      problemsQuery.data?.data.map((problem) => ({
        id: problem.id,
        title: problem.title,
        difficulty: problem.difficulty,
        tags: problem.tags,
      })) ?? [],
    [problemsQuery.data],
  );
  const topicOptions = useMemo<ReadonlyArray<TagInfo>>(
    () => topicOptionsQuery.data?.data ?? [],
    [topicOptionsQuery.data],
  );
  const topicNameBySlug = useMemo(
    () => new Map(topicOptions.map((topic) => [topic.slug, topic.name])),
    [topicOptions],
  );

  const selectedProblems = useMemo(
    () => problems.filter((problem) => selectedProblemIds.includes(problem.id)),
    [problems, selectedProblemIds],
  );

  const preferences = useMemo(
    () => ({
      languages: enabledFilters.includes('languages') ? selectedLanguages : [],
      roles: enabledFilters.includes('roles') ? selectedRoles : [],
      difficulties: enabledFilters.includes('problems') ? selectedDifficulties : [],
      problemIds: enabledFilters.includes('problems') ? selectedProblemIds : [],
      topics: enabledFilters.includes('problems') ? selectedTopics : [],
    }),
    [
      enabledFilters,
      selectedDifficulties,
      selectedLanguages,
      selectedProblemIds,
      selectedRoles,
      selectedTopics,
    ],
  );

  const enterQueueMutation = useMutation({
    mutationFn: () => api(CONTROL_API.MATCHMAKING.ENTER_QUEUE, { body: preferences }),
  });

  const leaveQueueMutation = useMutation({
    mutationFn: () => api(CONTROL_API.MATCHMAKING.LEAVE_QUEUE),
  });

  const queueStatusQuery = useQuery({
    queryKey: ['matchmaking-queue-status', activeQueueRequestId],
    queryFn: () => api(CONTROL_API.MATCHMAKING.GET_QUEUE_STATUS),
    enabled: queueStatus === 'searching' && Boolean(activeQueueRequestId),
    retry: false,
    refetchInterval: queueStatus === 'searching' ? STATUS_POLL_MS : false,
  });

  useEffect(
    () => {
      isMountedRef.current = true;
      return () => {
        isMountedRef.current = false;
        if (queueStatusRef.current !== 'searching') {
          return;
        }
        api(CONTROL_API.MATCHMAKING.LEAVE_QUEUE).catch(() => undefined);
      };
    },
    [],
  );

  useEffect(() => {
    if (queueStatus === 'idle') {
      return;
    }

    const status = queueStatusQuery.data;
    if (!status) {
      return;
    }

    if (status.status === 'idle') {
      updateQueueStatus('idle');
      matchedRoomIdRef.current = null;
      setQueuePosition(null);
      setActiveQueueRequestId(null);
      return;
    }

    if (status.status === 'searching') {
      updateQueueStatus('searching');
      setQueuePosition(status.queuePosition);
      setActiveQueueRequestId(status.requestId);
      return;
    }

    updateQueueStatus('matched');
    setQueuePosition(null);
    setActiveQueueRequestId(null);
    if (matchedRoomIdRef.current === status.roomId) {
      return;
    }

    matchedRoomIdRef.current = status.roomId;
    toast.success(t('matchmaking.toastMatched'));
    navigate({ to: '/rooms/$roomId', params: { roomId: status.roomId } }).catch(() => undefined);
  }, [navigate, queueStatus, queueStatusQuery.data, t, updateQueueStatus]);

  useEffect(() => {
    if (!queueStatusQuery.isError) {
      return;
    }
    toast.error(t('matchmaking.searchFailed'));
    setQueuePosition(null);
    setActiveQueueRequestId(null);
    updateQueueStatus('idle');
  }, [queueStatusQuery.isError, t, updateQueueStatus]);

  const isQueued = queueStatus !== 'idle';

  const startQueue = async () => {
    try {
      const joinedExistingRoom = await tryJoinCompatiblePublicRoom();
      if (joinedExistingRoom) {
        return;
      }

      const response = await enterQueueMutation.mutateAsync();

      if (!isMountedRef.current) {
        if (response.status === 'searching') {
          await api(CONTROL_API.MATCHMAKING.LEAVE_QUEUE).catch(() => undefined);
        }
        return;
      }

      updateQueueStatus(response.status);
      if (response.status === 'matched') {
        setQueuePosition(null);
        setActiveQueueRequestId(null);
        matchedRoomIdRef.current = response.roomId;
        toast.success(t('matchmaking.toastMatched'));
        navigate({ to: '/rooms/$roomId', params: { roomId: response.roomId } }).catch(
          () => undefined,
        );
      } else {
        setQueuePosition(response.queuePosition);
        setActiveQueueRequestId(response.requestId);
      }
    } catch (error) {
      const apiError = await readApiError(error);
      toast.error(resolveJoinError(apiError, t, 'matchmaking.searchFailed'));
      setQueuePosition(null);
      setActiveQueueRequestId(null);
      updateQueueStatus('idle');
    }
  };

  const tryJoinCompatiblePublicRoom = async (): Promise<boolean> => {
    const selectedProblemTitles = new Set(
      problems
        .filter((problem) => preferences.problemIds.includes(problem.id))
        .map((problem) => problem.title.toLowerCase()),
    );

    const browseResult = await api(CONTROL_API.ROOMS.BROWSE_PUBLIC, {
      searchParams: { limit: 100 },
    });

    const candidates = browseResult.data
      .filter((room) => {
        if (preferences.languages.length > 0) {
          if (!room.language || !preferences.languages.includes(room.language)) {
            return false;
          }
        }

        if (preferences.difficulties.length > 0) {
          if (
            !room.problemDifficulty ||
            !preferences.difficulties.includes(room.problemDifficulty)
          ) {
            return false;
          }
        }

        if (room.participantCount <= 0) {
          return false;
        }

        if (currentUserId && room.hostId === currentUserId) {
          return false;
        }

        if (selectedProblemTitles.size > 0) {
          if (!room.problemTitle) {
            return false;
          }
          if (!selectedProblemTitles.has(room.problemTitle.toLowerCase())) {
            return false;
          }
        }

        if (preferences.topics.length > 0) {
          if (!room.problemTitle) {
            return false;
          }
          const normalizedRoomProblemTitle = room.problemTitle.toLowerCase();
          const matchedProblem = problems.find(
            (problem) => problem.title.toLowerCase() === normalizedRoomProblemTitle,
          );
          if (!matchedProblem) {
            return false;
          }
          if (!preferences.topics.some((topic) => matchedProblem.tags.includes(topic))) {
            return false;
          }
        }

        return true;
      })
      .sort((left, right) => {
        const waitingFirst = Number(left.status !== 'waiting') - Number(right.status !== 'waiting');
        if (waitingFirst !== 0) {
          return waitingFirst;
        }

        const dateDiff = Date.parse(left.createdAt) - Date.parse(right.createdAt);
        if (dateDiff !== 0) {
          return dateDiff;
        }
        return left.roomId.localeCompare(right.roomId);
      });

    const preferredRoles = preferences.roles;

    for (const room of candidates) {
      try {
        if (room.isParticipant) {
          toast.success(t('browse.joinSuccess'));
          await navigate({ to: '/rooms/$roomId', params: { roomId: room.roomId } });
          return true;
        }

        const requestedRoles: Array<RoomRole | null> =
          room.status === 'waiting'
            ? preferredRoles.length > 0
              ? [...preferredRoles]
              : [null]
            : ['observer' as RoomRole];

        for (const requestedRole of requestedRoles) {
          try {
            await api(CONTROL_API.ROOMS.JOIN, {
              params: { id: room.roomId },
              body: requestedRole ? { requestedRole } : {},
            });
            toast.success(t('browse.joinSuccess'));
            await navigate({ to: '/rooms/$roomId', params: { roomId: room.roomId } });
            return true;
          } catch {
            // Requested role was unavailable or room changed; try next role/room.
          }
        }
      } catch {
        // Room may have changed between browse and join; continue to the next candidate.
      }
    }

    return false;
  };

  const stopQueue = async () => {
    try {
      await leaveQueueMutation.mutateAsync();
    } catch {}
    matchedRoomIdRef.current = null;
    setQueuePosition(null);
    setActiveQueueRequestId(null);
    updateQueueStatus('idle');
  };

  const toggleFilter = (key: MatchFilterKey) => {
    setEnabledFilters((previous) => {
      if (previous.includes(key)) {
        return previous.filter((item) => item !== key);
      }
      return [...previous, key];
    });
  };

  const selectedPreferenceCount =
    preferences.languages.length +
    preferences.roles.length +
    preferences.difficulties.length +
    preferences.problemIds.length +
    preferences.topics.length;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <Card className="border border-border/50 bg-card/80 py-0 backdrop-blur-sm">
        <CardHeader className="px-5 pt-6 pb-4 sm:px-6">
          <CardTitle className="flex items-center gap-2">
            <SlidersHorizontal className="size-5 text-primary" />
            {t('matchmaking.preferencesTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 px-5 pb-6 sm:px-6">
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">
              {t('matchmaking.filterTypeLabel')}
            </p>
            <div className="flex flex-wrap gap-2">
              {FILTER_OPTIONS.map((item) => {
                const enabled = enabledFilters.includes(item.key);
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => toggleFilter(item.key)}
                    disabled={isQueued}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors',
                      enabled
                        ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200'
                        : 'border-border/60 bg-background/50 text-muted-foreground',
                    )}
                  >
                    {enabled ? <Check className="size-3.5" /> : null}
                    {t(item.labelKey)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-4">
            {enabledFilters.includes('languages') ? (
              <PreferenceMultiSelect
                label={t('matchmaking.languageLabel')}
                disabled={isQueued}
                options={SUPPORTED_LANGUAGES.map((language) => ({
                  id: language,
                  label: LANGUAGE_VERSIONED_LABELS[language],
                }))}
                selectedIds={selectedLanguages}
                onToggle={(language) =>
                  setSelectedLanguages((previous) => toggleSelection(previous, language))
                }
                emptyText={t('matchmaking.anyLanguage')}
              />
            ) : null}

            {enabledFilters.includes('roles') ? (
              <PreferencePillSelector
                label={t('matchmaking.roleLabel')}
                disabled={isQueued}
                options={JOINABLE_ROLES.map((role) => ({
                  id: role,
                  label: t(`role.${role}`),
                }))}
                selectedIds={selectedRoles}
                onToggle={(role) => setSelectedRoles((previous) => toggleSelection(previous, role))}
              />
            ) : null}

            {enabledFilters.includes('problems') ? (
              <div className="space-y-4">
                <PreferencePillSelector
                  label={t('matchmaking.difficultyLabel')}
                  disabled={isQueued}
                  options={PROBLEM_DIFFICULTIES.map((difficulty) => ({
                    id: difficulty,
                    label: t(`matchmaking.difficulty.${difficulty}`),
                  }))}
                  selectedIds={selectedDifficulties}
                  onToggle={(difficulty) =>
                    setSelectedDifficulties((previous) => toggleSelection(previous, difficulty))
                  }
                />

                <PreferenceMultiSelect
                  label={t('matchmaking.problemLabel')}
                  disabled={isQueued}
                  options={problems.map((problem) => ({
                    id: problem.id,
                    label: `${problem.title} · ${t(`matchmaking.difficulty.${problem.difficulty}`)}`,
                  }))}
                  selectedIds={selectedProblemIds}
                  onToggle={(problemId) =>
                    setSelectedProblemIds((previous) => toggleSelection(previous, problemId))
                  }
                  emptyText={t('matchmaking.anyProblem')}
                  loading={problemsQuery.isLoading}
                />

                <PreferenceMultiSelect
                  label={t('matchmaking.topicLabel')}
                  disabled={isQueued}
                  options={topicOptions.map((topic) => ({
                    id: topic.slug,
                    label: `${topic.name} (${topic.count})`,
                  }))}
                  selectedIds={selectedTopics}
                  onToggle={(topicSlug) =>
                    setSelectedTopics((previous) => toggleSelection(previous, topicSlug))
                  }
                  emptyText={t('matchmaking.anyTopic')}
                  loading={topicOptionsQuery.isLoading}
                />
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              className="gap-2 shadow-[0_0_25px_hsl(var(--primary)/0.3)] hover:shadow-[0_0_35px_hsl(var(--primary)/0.5)]"
              disabled={isQueued || enterQueueMutation.isPending}
              onClick={startQueue}
            >
              {enterQueueMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Search className="size-4" />
              )}
              {t('matchmaking.start')}
            </Button>
            <Button
              variant="outline"
              disabled={!isQueued || leaveQueueMutation.isPending}
              onClick={stopQueue}
            >
              {leaveQueueMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                t('matchmaking.cancel')
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-border/50 bg-card/80 py-0 backdrop-blur-sm">
        <CardHeader className="px-5 pt-6 pb-4 sm:px-6">
          <CardTitle className="flex items-center gap-2">
            <Search className="size-5 text-primary" />
            {t('matchmaking.statusTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 px-5 pb-6 sm:px-6">
          <output
            className="flex items-center justify-between rounded-lg border border-border/50 bg-background/55 p-4"
            aria-live="polite"
          >
            <div>
              <p className="font-medium text-foreground">
                {t(`matchmaking.status.${queueStatus}`)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {queueStatus === 'searching'
                  ? t('matchmaking.searchingDescription')
                  : queueStatus === 'matched'
                    ? t('matchmaking.matchedDescription')
                    : t('matchmaking.idleDescription')}
              </p>
              {queueStatus === 'searching' && queuePosition ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('matchmaking.queuePosition', { position: queuePosition })}
                </p>
              ) : null}
            </div>
            {queueStatus === 'matched' ? (
              <CheckCircle2 className="size-6 text-success" />
            ) : queueStatus === 'searching' ? (
              <Loader2 className="size-6 animate-spin text-primary" />
            ) : (
              <Search className="size-6 text-muted-foreground" />
            )}
          </output>

          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {t('matchmaking.selectedFiltersTitle')}
            </p>
            <div className="flex flex-wrap gap-2">
              {selectedPreferenceCount === 0 ? (
                <Badge variant="outline">{t('matchmaking.noPreference')}</Badge>
              ) : (
                <>
                  {preferences.languages.map((language) => (
                    <Badge key={language} variant="outline">
                      {LANGUAGE_VERSIONED_LABELS[language]}
                    </Badge>
                  ))}
                  {preferences.difficulties.map((difficulty) => (
                    <Badge key={difficulty} variant="outline">
                      {t(`matchmaking.difficulty.${difficulty}`)}
                    </Badge>
                  ))}
                  {preferences.roles.map((role) => (
                    <Badge key={role} variant="outline">
                      {t(`role.${role}`)}
                    </Badge>
                  ))}
                  {selectedProblems.map((problem) => (
                    <Badge key={problem.id} variant="secondary">
                      {problem.title}
                    </Badge>
                  ))}
                  {preferences.topics.map((topicSlug) => (
                    <Badge key={topicSlug} variant="secondary">
                      {topicNameBySlug.get(topicSlug) ?? topicSlug}
                    </Badge>
                  ))}
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

type PreferenceMultiSelectProps<T extends string> = Readonly<{
  label: string;
  disabled: boolean;
  options: Array<{ id: T; label: string }>;
  selectedIds: T[];
  onToggle: (id: T) => void;
  emptyText: string;
  loading?: boolean;
}>;

function PreferenceMultiSelect<T extends string>({
  label,
  disabled,
  options,
  selectedIds,
  onToggle,
  emptyText,
  loading = false,
}: PreferenceMultiSelectProps<T>) {
  const { t } = useTranslation('rooms');
  const selectedCount = selectedIds.length;
  const selectedLabelById = useMemo(() => {
    return new Map(options.map((option) => [option.id, option.label]));
  }, [options]);

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className="h-auto min-h-10 w-full justify-between gap-3 py-2"
          >
            <span className="flex min-w-0 items-center gap-2 overflow-hidden">
              <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
              <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                {selectedCount > 0 ? (
                  <>
                    {selectedIds.slice(0, 3).map((id) => (
                      <span
                        key={id}
                        className="max-w-44 truncate rounded-full border border-emerald-400/25 bg-emerald-500/8 px-2 py-0.5 text-xs text-emerald-100"
                      >
                        {selectedLabelById.get(id)}
                      </span>
                    ))}
                    {selectedCount > 3 ? (
                      <span className="rounded-full border border-border/60 px-2 py-0.5 text-xs text-muted-foreground">
                        +{selectedCount - 3}
                      </span>
                    ) : null}
                  </>
                ) : (
                  <span className="truncate text-muted-foreground">{emptyText}</span>
                )}
              </span>
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {t('matchmaking.selectedCount', { count: selectedCount })}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[420px] max-w-[calc(100vw-2rem)] p-0"
          align="start"
          sideOffset={8}
        >
          <Command>
            <CommandInput placeholder={label} />
            <CommandList>
              <CommandEmpty>
                {loading ? t('matchmaking.selectorLoading') : t('matchmaking.selectorEmpty')}
              </CommandEmpty>
              <CommandGroup>
                {options.map((option) => {
                  const selected = selectedIds.includes(option.id);
                  return (
                    <CommandItem
                      key={option.id}
                      value={option.label}
                      onSelect={() => onToggle(option.id)}
                      className="flex items-center justify-between"
                    >
                      <span className="truncate">{option.label}</span>
                      <span
                        className={cn(
                          'flex size-5 items-center justify-center rounded-full border',
                          selected
                            ? 'border-emerald-400/30 bg-emerald-500 text-white'
                            : 'border-border/60 bg-background text-transparent',
                        )}
                      >
                        <Check className="size-3.5" />
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

type PreferencePillSelectorProps<T extends string> = Readonly<{
  label: string;
  disabled: boolean;
  options: Array<{ id: T; label: string }>;
  selectedIds: T[];
  onToggle: (id: T) => void;
}>;

function PreferencePillSelector<T extends string>({
  label,
  disabled,
  options,
  selectedIds,
  onToggle,
}: PreferencePillSelectorProps<T>) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = selectedIds.includes(option.id);
          return (
            <button
              key={option.id}
              type="button"
              disabled={disabled}
              onClick={() => onToggle(option.id)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors',
                selected
                  ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200'
                  : 'border-border/60 bg-background/50 text-muted-foreground',
              )}
            >
              {selected ? <Check className="size-3.5" /> : null}
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function toggleSelection<T extends string>(current: T[], value: T): T[] {
  return current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
}

export { MatchmakingPage };
