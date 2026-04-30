import { CONTROL_API } from '@syncode/contracts';
import type { ProblemDifficulty, SupportedLanguage } from '@syncode/shared';
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
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { LANGUAGE_VERSIONED_LABELS } from '@/components/language-selector.data.js';
import { api, readApiError } from '@/lib/api-client.js';
import { resolveJoinError } from '@/lib/join-errors.js';

export const Route = createFileRoute('/_app/rooms/matchmaking')({
  component: MatchmakingPage,
});

type QueueStatus = 'idle' | 'searching' | 'matched';

const languages: SupportedLanguage[] = ['python', 'javascript', 'typescript', 'java', 'cpp'];
const difficulties: ProblemDifficulty[] = ['easy', 'medium', 'hard'];

function MatchmakingPage() {
  const { t } = useTranslation('rooms');
  const navigate = useNavigate();
  const [language, setLanguage] = useState<SupportedLanguage>('python');
  const [difficulty, setDifficulty] = useState<ProblemDifficulty>('medium');
  const [status, setStatus] = useState<QueueStatus>('idle');
  const [matchedRoomId, setMatchedRoomId] = useState<string | null>(null);

  const searchParams = useMemo(
    () => ({
      limit: 1,
      language,
      difficulty,
      status: 'waiting' as const,
    }),
    [difficulty, language],
  );

  const browseQuery = useQuery({
    queryKey: ['matchmaking', searchParams],
    enabled: status === 'searching',
    queryFn: () => api(CONTROL_API.ROOMS.BROWSE_PUBLIC, { searchParams }),
    refetchInterval: status === 'searching' ? 3000 : false,
  });

  const joinMutation = useMutation({
    mutationFn: (roomId: string) =>
      api(CONTROL_API.ROOMS.JOIN, { params: { id: roomId }, body: { requestedRole: 'candidate' } }),
  });

  useEffect(() => {
    if (status !== 'searching' || joinMutation.isPending || matchedRoomId) {
      return;
    }

    const room = browseQuery.data?.data[0];
    if (!room) {
      return;
    }

    setMatchedRoomId(room.roomId);
    setStatus('matched');
    joinMutation
      .mutateAsync(room.roomId)
      .then(() => {
        toast.success(t('matchmaking.toastMatched'));
        navigate({ to: '/rooms/$roomId', params: { roomId: room.roomId } }).catch(() => undefined);
      })
      .catch(async (error) => {
        const apiError = await readApiError(error);
        toast.error(resolveJoinError(apiError, t, 'matchmaking.joinFailed'));
        setMatchedRoomId(null);
        setStatus('searching');
      });
  }, [browseQuery.data, joinMutation, matchedRoomId, navigate, status, t]);

  useEffect(() => {
    if (status !== 'searching' || !browseQuery.isError) {
      return;
    }

    toast.error(t('matchmaking.searchFailed'));
    setStatus('idle');
  }, [browseQuery.isError, status, t]);

  const startQueue = () => {
    setMatchedRoomId(null);
    setStatus('searching');
  };

  const stopQueue = () => {
    setMatchedRoomId(null);
    setStatus('idle');
  };

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
              <label className="text-sm font-medium text-foreground" htmlFor="match-language">
                {t('matchmaking.languageLabel')}
              </label>
              <Select
                value={language}
                onValueChange={(value) => setLanguage(value as SupportedLanguage)}
              >
                <SelectTrigger id="match-language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {languages.map((item) => (
                    <SelectItem key={item} value={item}>
                      {LANGUAGE_VERSIONED_LABELS[item]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="match-difficulty">
                {t('matchmaking.difficultyLabel')}
              </label>
              <Select
                value={difficulty}
                onValueChange={(value) => setDifficulty(value as ProblemDifficulty)}
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
            <Button variant="outline" disabled={status === 'idle'} onClick={stopQueue}>
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
          <div className="flex items-center justify-between rounded-lg border border-border/50 bg-background/55 p-4">
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
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{LANGUAGE_VERSIONED_LABELS[language]}</Badge>
            <Badge variant="outline">{t(`matchmaking.difficulty.${difficulty}`)}</Badge>
            {browseQuery.data ? (
              <Badge variant="secondary">
                {t('matchmaking.availableRooms', { count: browseQuery.data.data.length })}
              </Badge>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
