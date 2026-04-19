import {
  BROWSEABLE_ROOM_STATUSES,
  type BrowseableRoomStatus,
  CONTROL_API,
  type PublicRoomSummary,
} from '@syncode/contracts';
import {
  PROBLEM_DIFFICULTIES,
  type ProblemDifficulty,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from '@syncode/shared';
import {
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  cn,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@syncode/ui';
import { useMutation, useQuery } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { ChevronDown, Code2, Compass, Loader2, Search, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { LANGUAGE_SELECTOR_METADATA } from '@/components/language-selector.data.js';
import { BrowseEmptyState } from '@/components/rooms-browse/browse-empty-state.js';
import { PublicRoomCard } from '@/components/rooms-browse/public-room-card.js';
import { api, readApiError } from '@/lib/api-client.js';
import { ROOM_STATUS_KEYS } from '@/lib/room-stage.js';
import { useAuthStore } from '@/stores/auth.store.js';

const DIFFICULTY_KEYS: Record<ProblemDifficulty, string> = {
  easy: 'problems:detail.easy',
  medium: 'problems:detail.medium',
  hard: 'problems:detail.hard',
};

export const Route = createFileRoute('/_app/rooms/browse')({
  component: BrowseRoomsPage,
});

export { BrowseRoomsPage };

const BROWSE_PAGE_SIZE = 12;

type BrowseFilters = {
  search: string;
  language: SupportedLanguage | null;
  difficulty: ProblemDifficulty | null;
  status: BrowseableRoomStatus | null;
};

const emptyFilters: BrowseFilters = {
  search: '',
  language: null,
  difficulty: null,
  status: null,
};

function BrowseRoomsPage() {
  const { t } = useTranslation('rooms');
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate({ to: '/login' }).catch(() => {});
    }
  }, [isAuthenticated, navigate]);

  const [filters, setFilters] = useState<BrowseFilters>(emptyFilters);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [accumulated, setAccumulated] = useState<PublicRoomSummary[]>([]);
  const [isLanguageOpen, setIsLanguageOpen] = useState(false);

  const deferredSearch = useDeferredValue(filters.search);
  const normalizedSearch = deferredSearch.trim();

  // biome-ignore lint/correctness/useExhaustiveDependencies: filter changes are the intended trigger
  useEffect(() => {
    setAccumulated([]);
    setCursor(undefined);
  }, [normalizedSearch, filters.language, filters.difficulty, filters.status]);

  const searchParams = useMemo(
    () => ({
      limit: BROWSE_PAGE_SIZE,
      cursor,
      language: filters.language ?? undefined,
      difficulty: filters.difficulty ?? undefined,
      status: filters.status ?? undefined,
      search: normalizedSearch.length > 0 ? normalizedSearch : undefined,
    }),
    [cursor, filters.difficulty, filters.language, filters.status, normalizedSearch],
  );

  const browseQuery = useQuery({
    queryKey: ['rooms', 'browse', searchParams],
    queryFn: () => api(CONTROL_API.ROOMS.BROWSE_PUBLIC, { searchParams }),
    placeholderData: (previous) => previous,
  });

  useEffect(() => {
    const data = browseQuery.data;
    if (!data) return;

    setAccumulated((previous) => {
      if (cursor === undefined) {
        return data.data;
      }
      const seen = new Set(previous.map((room) => room.roomId));
      const next = data.data.filter((room) => !seen.has(room.roomId));
      return next.length === 0 ? previous : [...previous, ...next];
    });
  }, [browseQuery.data, cursor]);

  const hasMore = browseQuery.data?.pagination.hasMore === true;
  const nextCursor = browseQuery.data?.pagination.nextCursor ?? null;

  const joinMutation = useMutation({
    mutationFn: (roomId: string) =>
      api(CONTROL_API.ROOMS.JOIN, { params: { id: roomId }, body: {} }),
  });

  const handleJoin = async (roomId: string) => {
    try {
      await joinMutation.mutateAsync(roomId);
      toast.success(t('browse.joinSuccess'));
      void navigate({ to: '/rooms/$roomId', params: { roomId } }).catch(() => {});
    } catch (error) {
      const apiError = await readApiError(error);
      toast.error(apiError?.message ?? t('browse.joinFailed'));
    }
  };

  const handleClearFilters = () => {
    setFilters(emptyFilters);
  };

  const isFiltered =
    filters.language !== null ||
    filters.difficulty !== null ||
    filters.status !== null ||
    normalizedSearch.length > 0;

  const isInitialLoading = browseQuery.isPending && accumulated.length === 0;
  const resultCount = accumulated.length;

  return (
    <div className="relative">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 flex justify-center overflow-hidden"
      >
        <div className="h-[320px] w-[520px] rounded-full bg-primary/10 blur-[120px]" />
      </div>

      <motion.section
        className="mb-6 flex flex-wrap items-center justify-between gap-3"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border/60 bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur-sm">
          <Sparkles size={13} className="text-primary" />
          {t('browse.subheading')}
        </div>
        <p className="text-sm text-muted-foreground">
          {isInitialLoading ? t('browse.loading') : t('browse.resultCount', { count: resultCount })}
        </p>
      </motion.section>

      <motion.div
        className="sticky top-2 z-20 mb-8"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="rounded-2xl border border-border/50 bg-card/70 p-4 shadow-[0_8px_32px_-16px_color-mix(in_oklch,var(--background)_60%,transparent)] backdrop-blur-xl sm:p-5">
          <div className="flex flex-col gap-4">
            <div className="relative">
              <Search
                size={16}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60"
              />
              <Input
                type="text"
                value={filters.search}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, search: event.target.value }))
                }
                placeholder={t('browse.filters.search')}
                aria-label={t('browse.filters.search')}
                className="h-11 pl-10 text-sm"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  {t('browse.filters.difficulty')}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  <FilterPill
                    active={filters.difficulty === null}
                    onClick={() => setFilters((prev) => ({ ...prev, difficulty: null }))}
                  >
                    {t('browse.filters.difficultyAll')}
                  </FilterPill>
                  {PROBLEM_DIFFICULTIES.map((difficulty) => (
                    <FilterPill
                      key={difficulty}
                      active={filters.difficulty === difficulty}
                      onClick={() =>
                        setFilters((prev) => ({
                          ...prev,
                          difficulty: prev.difficulty === difficulty ? null : difficulty,
                        }))
                      }
                    >
                      {t(DIFFICULTY_KEYS[difficulty])}
                    </FilterPill>
                  ))}
                </div>
              </div>

              <div className="mx-1 h-5 w-px bg-border/60" />

              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  {t('browse.filters.status')}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  <FilterPill
                    active={filters.status === null}
                    onClick={() => setFilters((prev) => ({ ...prev, status: null }))}
                  >
                    {t('browse.filters.statusAll')}
                  </FilterPill>
                  {BROWSEABLE_ROOM_STATUSES.map((status) => (
                    <FilterPill
                      key={status}
                      active={filters.status === status}
                      onClick={() =>
                        setFilters((prev) => ({
                          ...prev,
                          status: prev.status === status ? null : status,
                        }))
                      }
                    >
                      {t(ROOM_STATUS_KEYS[status])}
                    </FilterPill>
                  ))}
                </div>
              </div>

              <div className="ml-auto flex items-center gap-2">
                <Popover open={isLanguageOpen} onOpenChange={setIsLanguageOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      role="combobox"
                      aria-expanded={isLanguageOpen}
                      aria-label={t('browse.filters.language')}
                      className="inline-flex h-9 items-center gap-2 rounded-lg border border-input bg-background px-3 text-sm font-medium transition-colors hover:border-ring/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                    >
                      <Code2 size={14} className="text-muted-foreground" />
                      <span className={cn(filters.language === null && 'text-muted-foreground')}>
                        {filters.language === null
                          ? t('browse.filters.languageAll')
                          : LANGUAGE_SELECTOR_METADATA[filters.language].label}
                      </span>
                      <ChevronDown size={14} className="text-muted-foreground" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0" align="end">
                    <Command>
                      <CommandInput placeholder={t('browse.filters.language')} />
                      <CommandList>
                        <CommandEmpty>{t('browse.filters.languageAll')}</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="__all__"
                            onSelect={() => {
                              setFilters((prev) => ({ ...prev, language: null }));
                              setIsLanguageOpen(false);
                            }}
                          >
                            {t('browse.filters.languageAll')}
                          </CommandItem>
                          {SUPPORTED_LANGUAGES.map((language) => (
                            <CommandItem
                              key={language}
                              value={LANGUAGE_SELECTOR_METADATA[language].label}
                              onSelect={() => {
                                setFilters((prev) => ({ ...prev, language }));
                                setIsLanguageOpen(false);
                              }}
                            >
                              {LANGUAGE_SELECTOR_METADATA[language].label}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>

                {isFiltered && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleClearFilters}
                    className="text-xs"
                  >
                    {t('browse.emptyState.clearFilters')}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {isInitialLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={28} className="animate-spin text-primary/60" />
        </div>
      ) : accumulated.length === 0 ? (
        <BrowseEmptyState isFiltered={isFiltered} onClearFilters={handleClearFilters} />
      ) : (
        <>
          <ul
            aria-label={t('browse.heading')}
            className="grid list-none gap-4 p-0 sm:grid-cols-2 xl:grid-cols-3"
          >
            {accumulated.map((room, index) => (
              <PublicRoomCard
                key={room.roomId}
                room={room}
                index={index}
                onJoin={handleJoin}
                isJoining={joinMutation.isPending && joinMutation.variables === room.roomId}
              />
            ))}
          </ul>

          {hasMore && nextCursor !== null && (
            <div className="mt-10 flex justify-center">
              <Button
                variant="outline"
                size="lg"
                disabled={browseQuery.isFetching}
                onClick={() => setCursor(nextCursor)}
                className="gap-2"
              >
                {browseQuery.isFetching ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Compass size={16} />
                )}
                {t('browse.loadMore')}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex h-7 items-center rounded-full px-3 text-xs font-medium transition-colors',
        active
          ? 'bg-primary/10 text-primary ring-1 ring-primary/25'
          : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}
