import { Button, Input, Label } from '@syncode/ui';
import { LoaderCircle } from 'lucide-react';
import { Dialog } from 'radix-ui';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation('profile');

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
        {t('deleteDialog.title')}
      </Button>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-[28px] bg-card p-6 shadow-[0_28px_80px_-32px_oklch(0.12_0.02_260/0.7)] ring-1 ring-border/60">
          <Dialog.Title className="text-xl font-semibold tracking-tight text-foreground">
            {t('deleteDialog.title')}
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-sm leading-6 text-muted-foreground">
            {t('deleteDialog.description')}
          </Dialog.Description>

          <div className="mt-5 rounded-2xl bg-muted/60 p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">{t('deleteDialog.confirmationRequired')}</p>
            <p className="mt-2">{t('deleteDialog.typeEmail', { email: profileEmail })}</p>
          </div>

          <div className="mt-5 space-y-2">
            <Label htmlFor="delete-confirmation-email">{t('deleteDialog.emailConfirmation')}</Label>
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
                {t('deleteDialog.cancel')}
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
                  {t('deleteDialog.deleting')}
                </span>
              ) : (
                t('deleteDialog.deletePermanently')
              )}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
