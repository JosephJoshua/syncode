import { Card } from '../../components/ui/Card.tsx';

type ServiceStatus = 'healthy' | 'degraded' | 'down';

interface Service {
  name: string;
  status: ServiceStatus;
  responseTime: string;
  lastChecked: string;
}

const services: Service[] = [
  { name: 'PostgreSQL', status: 'healthy', responseTime: '12ms', lastChecked: '2 min ago' },
  { name: 'Redis', status: 'healthy', responseTime: '3ms', lastChecked: '2 min ago' },
  { name: 'S3 Storage', status: 'healthy', responseTime: '45ms', lastChecked: '2 min ago' },
  { name: 'Execution Engine', status: 'healthy', responseTime: '120ms', lastChecked: '2 min ago' },
  { name: 'AI Service', status: 'degraded', responseTime: '850ms', lastChecked: '1 min ago' },
  { name: 'Collab Server', status: 'healthy', responseTime: '18ms', lastChecked: '2 min ago' },
];

const statusConfig: Record<ServiceStatus, { color: string; label: string; textColor: string }> = {
  healthy: { color: 'bg-[var(--success)]', label: 'Healthy', textColor: 'text-[var(--success)]' },
  degraded: { color: 'bg-[var(--accent)]', label: 'Degraded', textColor: 'text-[var(--accent)]' },
  down: { color: 'bg-[var(--error)]', label: 'Down', textColor: 'text-[var(--error)]' },
};

export function AdminSystem() {
  return (
    <div className="space-y-6">
      <h1 className="font-display text-xl font-bold">System Health</h1>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {services.map((service) => {
          const config = statusConfig[service.status];
          return (
            <Card key={service.name}>
              <div className="flex items-center justify-between mb-3">
                <span className="font-medium text-[var(--text-primary)]">{service.name}</span>
                <div className="relative">
                  <span className={`block w-4 h-4 rounded-full ${config.color}`} />
                  {service.status === 'healthy' && (
                    <span
                      className={`absolute inset-0 rounded-full ${config.color} opacity-40`}
                      style={{ animation: 'pulse-ring 2s ease-in-out infinite' }}
                    />
                  )}
                </div>
              </div>
              <span className={`text-sm font-medium ${config.textColor}`}>{config.label}</span>
              <div className="mt-2 space-y-0.5">
                <p className="text-sm text-[var(--text-tertiary)]">
                  Response: {service.responseTime}
                </p>
                <p className="text-xs text-[var(--text-tertiary)]">
                  Last checked: {service.lastChecked}
                </p>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
