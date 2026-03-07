import { type ReactNode, useCallback, useEffect } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function Modal({ open, onClose, title, children, footer }: ModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-[var(--bg-overlay)] border border-[var(--border-default)] rounded-lg shadow-xl max-w-lg w-full mx-auto mt-[15vh] h-fit animate-[modal-slide-up_200ms_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="px-5 pt-5 pb-0">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">{title}</h2>
          </div>
        )}
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="px-5 pb-5 pt-0 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}
