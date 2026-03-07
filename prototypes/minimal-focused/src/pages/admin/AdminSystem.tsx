import { Card } from '../../components/ui/Card';
import { staggeredEntrance } from '../../lib/animations';

type ServiceStatus = 'healthy' | 'degraded' | 'down';

interface ServiceInfo {
  name: string;
  status: ServiceStatus;
  responseTime: string;
  lastChecked: string;
}

const services: ServiceInfo[] = [
  { name: 'Queue', status: 'healthy', responseTime: '12ms', lastChecked: '2 min ago' },
  { name: 'Cache', status: 'healthy', responseTime: '3ms', lastChecked: '2 min ago' },
  { name: 'Storage', status: 'healthy', responseTime: '45ms', lastChecked: '2 min ago' },
  { name: 'Execution', status: 'healthy', responseTime: '89ms', lastChecked: '2 min ago' },
  { name: 'AI', status: 'degraded', responseTime: '1,240ms', lastChecked: '1 min ago' },
  { name: 'Collab', status: 'down', responseTime: '--', lastChecked: '30 sec ago' },
];

const statusConfig: Record<ServiceStatus, { dotClass: string; textClass: string; label: string }> =
  {
    healthy: {
      dotClass: 'bg-[var(--success)] animate-pulse',
      textClass: 'text-[var(--success)]',
      label: 'Healthy',
    },
    degraded: {
      dotClass: 'bg-[var(--warning)]',
      textClass: 'text-[var(--warning)]',
      label: 'Degraded',
    },
    down: {
      dotClass: 'bg-[var(--error)]',
      textClass: 'text-[var(--error)]',
      label: 'Down',
    },
  };

export function AdminSystem() {
  return (
    <div>
      {/* Header */}
      <span className="font-mono text-xs tracking-widest uppercase text-[var(--accent)]">
        // system_health
      </span>
      <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--text-primary)] mt-1">
        System Health
      </h1>

      {/* Service Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
        {services.map((service, i) => {
          const config = statusConfig[service.status];
          return (
            <Card
              key={service.name}
              padding="p-4"
              className={`relative overflow-hidden ${service.status === 'healthy' ? '' : ''}`}
              style={staggeredEntrance(i)}
            >
              {/* Subtle dot-grid on healthy cards */}
              {service.status === 'healthy' && (
                <div
                  className="absolute inset-0 dot-grid pointer-events-none"
                  style={{ opacity: 0.03 }}
                />
              )}
              <div className="relative">
                <div className="flex items-center justify-between">
                  <span className="font-display text-sm font-semibold text-[var(--text-primary)]">
                    {service.name}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${config.dotClass}`} />
                    <span className={`text-xs font-mono ${config.textClass}`}>{config.label}</span>
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="font-mono text-xs text-[var(--text-secondary)]">
                    {service.responseTime}
                  </span>
                  <span className="font-mono text-[10px] text-[var(--text-tertiary)]">
                    {service.lastChecked}
                  </span>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
