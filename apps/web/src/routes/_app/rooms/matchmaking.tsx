import { CONTROL_API } from '@syncode/contracts';
import {
  PROBLEM_DIFFICULTIES,
  type ProblemDifficulty,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@syncode/ui';
import { useMutation, useQuery } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { CheckCircle2, Loader2, Radio, Search, SlidersHorizontal } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { LANGUAGE_VERSIONED_LABELS } from '@/components/language-selector.data.js';
import { LanguageSelector } from '@/components/language-selector.js';
import { api, readApiError } from '@/lib/api-client.js';
import { resolveJoinError } from '@/lib/join-errors.js';

export const Route = createFileRoute('/_app/rooms/matchmaking')({
  component: MatchmakingPage,
});

type QueueStatus = 'idle' | 'searching' | 'matched';

const MATCHMAKING_PAGE_SIZE = 5;
const MATCHMAKING_SCAN_INTERVAL_MS = 3000;
const languages = SUPPORTED_LANGUAGES;
const difficulties = PROBLEM_DIFFICULTIES;

function MatchmakingPage() {
  const { t } = useTranslation('rooms');
  const navigate = useNavigate();
  const [language, setLanguage] = useState<SupportedLanguage>('python');
  const [difficulty, setDifficulty] = useState<ProblemDifficulty>('medium');
  const [status, setStatus] = useState<QueueStatus>('idle');
  const [matchedRoomId, setMatchedRoomId] = useState<string | null>(null);
  const [skippedRoomIds, setSkippedRoomIds] = useState<ReadonlySet<string>>(() => new Set());
  const [queueAttempt, setQueueAttempt] = useState(0);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [scanCycle, setScanCycle] = useState(0);
  const [scanComplete, setScanComplete] = useState(false);
  const activeQueueAttemptRef = useRef(0);

  const searchParams = useMemo(
    () => ({
      limit: MATCHMAKING_PAGE_SIZE,
      cursor,
      language,
      difficulty,
      status: 'waiting' as const,
    }),
    [cursor, difficulty, language],
  );

  const browseQuery = useQuery({
    queryKey: ['matchmaking', queueAttempt, scanCycle, searchParams],
    enabled: status === 'searching' && !scanComplete,
    queryFn: () => api(CONTROL_API.ROOMS.BROWSE_PUBLIC, { searchParams }),
  });

  const joinMutation = useMutation({
    mutationFn: (roomId: string) =>
      api(CONTROL_API.ROOMS.JOIN, { params: { id: roomId }, body: {} }),
  });

  useEffect(() => {
    if (status !== 'searching' || joinMutation.isPending || matchedRoomId) {
      return;
    }

    const room = browseQuery.data?.data.find(
      (candidate) => !candidate.isParticipant && !skippedRoomIds.has(candidate.roomId),
    );
    if (!room) {
      return;
    }

    const attempt = queueAttempt;
    setMatchedRoomId(room.roomId);
    setStatus('matched');
    joinMutation
      .mutateAsync(room.roomId)
      .then(() => {
        if (activeQueueAttemptRef.current !== attempt) {
          return;
        }
        toast.success(t('matchmaking.toastMatched'));
        navigate({ to: '/rooms/$roomId', params: { roomId: room.roomId } }).catch(() => undefined);
      })
      .catch(async (error) => {
        if (activeQueueAttemptRef.current !== attempt) {
          return;
        }
        const apiError = await readApiError(error);
        toast.error(resolveJoinError(apiError, t, 'matchmaking.joinFailed'));
        setSkippedRoomIds((previous) => new Set(previous).add(room.roomId));
        setMatchedRoomId(null);
        setStatus('searching');
      });
  }, [
    browseQuery.data,
    joinMutation,
    matchedRoomId,
    navigate,
    queueAttempt,
    skippedRoomIds,
    status,
    t,
  ]);

  useEffect(() => {
    if (status !== 'searching') {
      return;
    }

    const intervalId = window.setInterval(() => {
      setCursor(undefined);
      setScanComplete(false);
      setScanCycle((previous) => previous + 1);
    }, MATCHMAKING_SCAN_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [status]);

  useEffect(() => {
    if (status !== 'searching' || browseQuery.isFetching || matchedRoomId || scanComplete) {
      return;
    }

    const hasAvailableCandidate =
      browseQuery.data?.data.some(
        (candidate) => !candidate.isParticipant && !skippedRoomIds.has(candidate.roomId),
      ) ?? false;
    const nextCursor = browseQuery.data?.pagination.nextCursor;

    if (!hasAvailableCandidate && nextCursor) {
      setCursor(nextCursor);
      return;
    }

    if (!hasAvailableCandidate && browseQuery.data) {
      setScanComplete(true);
    }
  }, [
    browseQuery.data,
    browseQuery.isFetching,
    matchedRoomId,
    scanComplete,
    skippedRoomIds,
    status,
  ]);

  useEffect(() => {
    if (status !== 'searching' || !browseQuery.isError) {
      return;
    }

    toast.error(t('matchmaking.searchFailed'));
    setStatus('idle');
  }, [browseQuery.isError, status, t]);

  const startQueue = () => {
    const nextAttempt = activeQueueAttemptRef.current + 1;
    activeQueueAttemptRef.current = nextAttempt;
    setQueueAttempt(nextAttempt);
    setSkippedRoomIds(new Set());
    setCursor(undefined);
    setScanCycle((previous) => previous + 1);
    setScanComplete(false);
    setMatchedRoomId(null);
    setStatus('searching');
  };

  const stopQueue = () => {
    const nextAttempt = activeQueueAttemptRef.current + 1;
    activeQueueAttemptRef.current = nextAttempt;
    setQueueAttempt(nextAttempt);
    setSkippedRoomIds(new Set());
    setCursor(undefined);
    setScanComplete(false);
    setMatchedRoomId(null);
    setStatus('idle');
  };

  const availableRoomCount =
    browseQuery.data?.data.filter(
      (candidate) => !candidate.isParticipant && !skippedRoomIds.has(candidate.roomId),
    ).length ?? 0;
  const isQueued = status !== 'idle';
  const canCancel = status === 'searching';

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
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <span className="block text-sm font-medium text-foreground">
                {t('matchmaking.languageLabel')}
              </span>
              <LanguageSelector
                value={language}
                onValueChange={setLanguage}
                languages={languages}
                labelOverrides={LANGUAGE_VERSIONED_LABELS}
                disabled={isQueued}
                ariaLabel={t('matchmaking.languageLabel')}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="match-difficulty">
                {t('matchmaking.difficultyLabel')}
              </label>
              <Select
                value={difficulty}
                onValueChange={(value) => setDifficulty(value as ProblemDifficulty)}
                disabled={isQueued}
              >
                <SelectTrigger id="match-difficulty">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {difficulties.map((item) => (
                    <SelectItem key={item} value={item}>
                      {t(`matchmaking.difficulty.${item}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              className="gap-2 shadow-[0_0_25px_hsl(var(--primary)/0.3)] hover:shadow-[0_0_35px_hsl(var(--primary)/0.5)]"
              disabled={status !== 'idle'}
              onClick={startQueue}
            >
              <Search className="size-4" />
              {t('matchmaking.start')}
            </Button>
            <Button variant="outline" disabled={!canCancel} onClick={stopQueue}>
              {t('matchmaking.cancel')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-border/50 bg-card/80 py-0 backdrop-blur-sm">
        <CardHeader className="px-5 pt-6 pb-4 sm:px-6">
          <CardTitle className="flex items-center gap-2">
            <Radio className="size-5 text-primary" />
            {t('matchmaking.statusTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 px-5 pb-6 sm:px-6">
          <output
            className="flex items-center justify-between rounded-lg border border-border/50 bg-background/55 p-4"
            aria-live="polite"
          >
            <div>
              <p className="font-medium text-foreground">{t(`matchmaking.status.${status}`)}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {status === 'searching'
                  ? t('matchmaking.searchingDescription')
                  : status === 'matched'
                    ? t('matchmaking.matchedDescription')
                    : t('matchmaking.idleDescription')}
              </p>
            </div>
            {status === 'matched' ? (
              <CheckCircle2 className="size-6 text-success" />
            ) : status === 'searching' ? (
              <Loader2 className="size-6 animate-spin text-primary" />
            ) : (
              <Search className="size-6 text-muted-foreground" />
            )}
          </output>

          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{LANGUAGE_VERSIONED_LABELS[language]}</Badge>
            <Badge variant="outline">{t(`matchmaking.difficulty.${difficulty}`)}</Badge>
            {browseQuery.data ? (
              <Badge variant="secondary">
                {t('matchmaking.availableRooms', { count: availableRoomCount })}
              </Badge>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export { MatchmakingPage };
