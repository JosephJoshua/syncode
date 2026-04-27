import type { RoomDetail } from '@syncode/contracts';

type ReadinessParticipant = Pick<
  RoomDetail['participants'][number],
  'role' | 'isActive' | 'isReady'
>;

export function requiredReadyRoles(mode: RoomDetail['mode']): Array<'interviewer' | 'candidate'> {
  return mode === 'peer' ? ['interviewer', 'candidate'] : ['candidate'];
}

export function allRequiredPeersReady(
  participants: ReadonlyArray<ReadinessParticipant>,
  mode: RoomDetail['mode'],
): boolean {
  const required: ReadinessParticipant['role'][] = requiredReadyRoles(mode);
  const relevant = participants.filter((p) => p.isActive && required.includes(p.role));
  return relevant.length > 0 && relevant.every((p) => p.isReady);
}
