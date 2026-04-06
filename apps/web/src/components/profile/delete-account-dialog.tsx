import { Button, Input, Label } from '@syncode/ui';
import { LoaderCircle } from 'lucide-react';
import { Dialog } from 'radix-ui';

interface DeleteAccountDialogProps {
  confirmationEmail: string;
  isPending: boolean;
  isValid: boolean;
  open: boolean;
  profileEmail: string | null | undefined;
  onConfirmationEmailChange: (value: string) => void;
  onDelete: () => void;
  onOpenChange: (open: boolean) => void;
}

export function DeleteAccountDialog({
  confirmationEmail,
  isPending,
  isValid,
  open,
  profileEmail,
  onConfirmationEmailChange,
  onDelete,
  onOpenChange,
}: DeleteAccountDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Button
        type="button"
        variant="destructive"
        disabled={isPending}
        onClick={() => {
          onOpenChange(true);
        }}
      >
        Delete account
      </Button>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-[28px] bg-card p-6 shadow-[0_28px_80px_-32px_oklch(0.12_0.02_260/0.7)] ring-1 ring-border/60">
          <Dialog.Title className="text-xl font-semibold tracking-tight text-foreground">
            Delete account
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-sm leading-6 text-muted-foreground">
            This will soft-delete your account, sign you out immediately, and prevent future access.
            Your historical records may still remain on the platform.
          </Dialog.Description>

          <div className="mt-5 rounded-2xl bg-muted/60 p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Confirmation required</p>
            <p className="mt-2">
              Type <span className="font-semibold text-foreground">{profileEmail}</span> exactly to
              confirm deletion.
            </p>
          </div>

          <div className="mt-5 space-y-2">
            <Label htmlFor="delete-confirmation-email">Email confirmation</Label>
            <Input
              id="delete-confirmation-email"
              autoComplete="off"
              value={confirmationEmail}
              onChange={(event) => {
                onConfirmationEmailChange(event.target.value);
              }}
            />
          </div>

          <div className="mt-6 flex items-center justify-end gap-3">
            <Dialog.Close asChild>
              <Button type="button" variant="ghost" disabled={isPending}>
                Cancel
              </Button>
            </Dialog.Close>
            <Button
              type="button"
              variant="destructive"
              disabled={!isValid || isPending}
              onClick={onDelete}
            >
              {isPending ? (
                <span className="inline-flex items-center gap-2">
                  <LoaderCircle className="size-4 animate-spin" />
                  Deleting...
                </span>
              ) : (
                'Delete permanently'
              )}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
