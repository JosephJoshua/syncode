import type { ReactNode } from 'react';

export function RoomCard({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-[#0a0a0a] border border-zinc-800/80 rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.7)] ${className}`}
    >
      {children}
    </div>
  );
}
