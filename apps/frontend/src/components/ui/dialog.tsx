import { cn } from '@babylon/shared';
import { useEffect, useRef, type ReactNode } from 'react';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}

/**
 * Dialog component using native dialog element.
 */
export function Dialog({ open, onOpenChange, children }: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      onOpenChange(false);
    };

    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, [onOpenChange]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    const dialog = dialogRef.current;
    if (dialog && e.target === dialog) {
      onOpenChange(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 m-0 h-full max-h-full w-full max-w-full bg-transparent p-0 backdrop:bg-black/50"
      onClick={handleBackdropClick}
    >
      {children}
    </dialog>
  );
}

interface DialogContentProps {
  children: ReactNode;
  className?: string;
}

/**
 * Dialog content wrapper.
 */
export function DialogContent({ children, className }: DialogContentProps) {
  return (
    <div className="flex min-h-full items-center justify-center p-4">
      <div
        className={cn(
          'relative w-full max-w-lg rounded-lg border border-border bg-background shadow-lg',
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
