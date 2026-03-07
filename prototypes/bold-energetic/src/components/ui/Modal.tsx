import type { ReactNode } from 'react';
import { useEffect } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function Modal({ open, onClose, title, children, footer }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
      onKeyDown={() => {}}
      role="presentation"
    >
      <div
        className="bg-[var(--bg-card)] rounded-2xl shadow-[var(--shadow-xl)] max-w-md w-full mx-4 p-6"
        style={{ animation: 'modal-scale-in 0.2s ease-out' }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={() => {}}
        role="dialog"
      >
        {title && (
          <h2 className="font-display text-lg font-semibold text-[var(--text-primary)] mb-4">
            {title}
          </h2>
        )}
        <div>{children}</div>
        {footer && (
          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[var(--border-default)]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
