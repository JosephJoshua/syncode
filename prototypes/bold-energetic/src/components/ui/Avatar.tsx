type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface AvatarProps {
  size?: AvatarSize;
  name?: string;
  src?: string;
  online?: boolean;
  className?: string;
}

const sizeMap: Record<AvatarSize, number> = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 48,
  xl: 64,
};

const textSizeMap: Record<AvatarSize, string> = {
  xs: 'text-[10px]',
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
  xl: 'text-xl',
};

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

export function Avatar({ size = 'md', name, src, online, className = '' }: AvatarProps) {
  const px = sizeMap[size];

  return (
    <div className={`relative inline-flex shrink-0 ${className}`} style={{ width: px, height: px }}>
      {src ? (
        <img
          src={src}
          alt={name ?? 'avatar'}
          className="rounded-full object-cover"
          style={{ width: px, height: px }}
        />
      ) : name ? (
        <div
          className={`gradient-brand rounded-full flex items-center justify-center text-white font-semibold ${textSizeMap[size]}`}
          style={{ width: px, height: px }}
        >
          {getInitials(name)}
        </div>
      ) : (
        <div className="bg-[var(--bg-subtle)] rounded-full" style={{ width: px, height: px }} />
      )}

      {online && (
        <span
          className="absolute bottom-0 right-0 block rounded-full bg-[var(--success)] border-2 border-white"
          style={{
            width: 8,
            height: 8,
            animation: 'pulse-ring 2s ease-in-out infinite',
          }}
        />
      )}
    </div>
  );
}
