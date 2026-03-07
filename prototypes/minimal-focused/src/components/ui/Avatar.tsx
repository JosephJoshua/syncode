type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface AvatarProps {
  src?: string;
  name?: string;
  size?: AvatarSize;
  online?: boolean;
  className?: string;
}

const sizeStyles: Record<AvatarSize, string> = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-lg',
};

const dotSizes: Record<AvatarSize, string> = {
  xs: 'h-1.5 w-1.5',
  sm: 'h-2 w-2',
  md: 'h-2.5 w-2.5',
  lg: 'h-3 w-3',
  xl: 'h-4 w-4',
};

function getInitials(name?: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?';
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({ src, name, size = 'md', online, className = '' }: AvatarProps) {
  return (
    <div className={`relative inline-flex shrink-0 ${className}`}>
      {src ? (
        <img
          src={src}
          alt={name || 'Avatar'}
          className={`rounded-full object-cover ${sizeStyles[size]}`}
        />
      ) : (
        <div
          className={`rounded-full flex items-center justify-center font-medium bg-[var(--accent-muted)] text-[var(--accent)] ${sizeStyles[size]}`}
        >
          {getInitials(name)}
        </div>
      )}
      {online && (
        <span
          className={`absolute bottom-0 right-0 rounded-full bg-green-500 border-2 border-[var(--bg-base)] ${dotSizes[size]}`}
        />
      )}
    </div>
  );
}
