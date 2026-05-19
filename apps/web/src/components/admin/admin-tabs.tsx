import { cn } from '@syncode/ui';
import { Link } from '@tanstack/react-router';

type AdminTab = 'users' | 'problems' | 'auditLogs';

const tabs: Array<{ key: AdminTab; to: '/admin/users' | '/admin/problems' | '/admin/audit-logs' }> =
  [
    { key: 'users', to: '/admin/users' },
    { key: 'problems', to: '/admin/problems' },
    { key: 'auditLogs', to: '/admin/audit-logs' },
  ];

interface AdminTabsProps {
  active: AdminTab;
  labels: Record<AdminTab, string>;
}

export function AdminTabs({ active, labels }: AdminTabsProps) {
  return (
    <nav
      aria-label="Admin sections"
      className="inline-flex h-11 shrink-0 items-center rounded-lg border border-border bg-muted/30 p-1"
    >
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          to={tab.to}
          aria-current={active === tab.key ? 'page' : undefined}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground',
            active === tab.key && 'bg-background text-foreground shadow-sm',
          )}
        >
          {labels[tab.key]}
        </Link>
      ))}
    </nav>
  );
}
