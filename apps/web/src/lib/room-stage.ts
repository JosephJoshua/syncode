import type { RoomParticipant, RoomRole, RoomStatus } from '@syncode/shared';

export const ROLE_LABEL_KEYS: Record<RoomRole, string> = {
  candidate: 'role.candidate',
  interviewer: 'role.interviewer',
  observer: 'role.observer',
};

export const ROOM_STATUS_KEYS: Record<RoomStatus, string> = {
  waiting: 'status.waiting',
  warmup: 'status.warmup',
  coding: 'status.coding',
  wrapup: 'status.wrapup',
  finished: 'status.finished',
};

export const STAGE_THEME: Record<RoomStatus, { text: string; bg: string; glow: string }> = {
  waiting: {
    text: 'text-muted-foreground',
    bg: 'bg-muted-foreground',
    glow: 'oklch(0.704 0.01 286 / 0.15)',
  },
  warmup: { text: 'text-warning', bg: 'bg-warning', glow: 'oklch(0.76 0.16 75 / 0.25)' },
  coding: { text: 'text-primary', bg: 'bg-primary', glow: 'oklch(0.82 0.18 165 / 0.3)' },
  wrapup: { text: 'text-fuchsia-400', bg: 'bg-fuchsia-400', glow: 'oklch(0.7 0.15 320 / 0.25)' },
  finished: { text: 'text-cyan-400', bg: 'bg-cyan-400', glow: 'oklch(0.75 0.12 200 / 0.25)' },
};

export function isWorkspaceStage(status: RoomStatus): boolean {
  return status !== 'waiting';
}

export function formatTimer(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function buildInviteLink(roomId: string, roomCode: string): string {
  return `${window.location.origin}/rooms/${roomId}?code=${roomCode}`;
}

export function computeRoomElapsedMs({
  status,
  elapsedMs,
  currentPhaseStartedAt,
  timerPaused,
  now,
}: {
  status: RoomStatus;
  elapsedMs: number;
  currentPhaseStartedAt: string | null;
  timerPaused: boolean;
  now: number;
}): number {
  if (status !== 'coding' || !currentPhaseStartedAt || timerPaused) {
    return elapsedMs;
  }

  return elapsedMs + Math.max(0, now - new Date(currentPhaseStartedAt).getTime());
}

export function countActiveRoleConfiguration(
  participants: Array<Pick<RoomParticipant, 'isActive' | 'role'>>,
) {
  return participants.reduce(
    (summary, participant) => {
      if (!participant.isActive) {
        return summary;
      }

      summary.activeCount += 1;

      if (participant.role === 'interviewer') {
        summary.interviewerCount += 1;
      } else if (participant.role === 'candidate') {
        summary.candidateCount += 1;
      } else {
        summary.observerCount += 1;
      }

      return summary;
    },
    {
      activeCount: 0,
      interviewerCount: 0,
      candidateCount: 0,
      observerCount: 0,
    },
  );
}

export function isPeerRoleConfigurationValid(
  participants: Array<Pick<RoomParticipant, 'isActive' | 'role'>>,
): boolean {
  const counts = countActiveRoleConfiguration(participants);
  return counts.interviewerCount === 1 && counts.candidateCount === 1;
}
