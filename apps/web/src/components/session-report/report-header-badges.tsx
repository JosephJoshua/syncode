import type { SessionReport } from '@syncode/contracts';
import { Badge } from '@syncode/ui';
import type { ReactNode } from 'react';
import { formatSessionDuration } from '@/lib/dashboard-session-history.js';

export function buildHeaderBadges(
  t: (key: string, options?: Record<string, unknown>) => string,
  viewerRole: string | null,
  report: SessionReport | null,
  durationSeconds: number,
) {
  const badges: ReactNode[] = [
    <Badge key="duration" variant="outline">
      {formatSessionDuration(durationSeconds)}
    </Badge>,
  ];

  if (viewerRole) {
    badges.push(
      <Badge key="role" variant={getRoleBadgeVariant(viewerRole)}>
        {t(`role.${viewerRole}`)}
      </Badge>,
    );
  }

  if (typeof report?.overallScore === 'number') {
    badges.push(
      <Badge
        key="score"
        variant={report.overallScore >= 60 ? 'success' : 'warning'}
      >{`${Math.round(report.overallScore)} / 100`}</Badge>,
    );
  }

  return badges;
}

function getRoleBadgeVariant(role: string) {
  if (role === 'candidate') {
    return 'candidate';
  }

  if (role === 'interviewer') {
    return 'interviewer';
  }

  return 'neutral';
}
