import { Button, Input } from '@syncode/ui';
import { Check, Copy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useClipboard } from '@/hooks/use-clipboard.js';

interface InviteLinkInlineProps {
  inviteLink: string;
  className?: string;
}

export function InviteLinkInline({ inviteLink, className = '' }: InviteLinkInlineProps) {
  const { t } = useTranslation('common');
  const { copied, copy } = useClipboard();

  return (
    <div className={className}>
      <label
        htmlFor="invite-link"
        className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground"
      >
        {t('copyLink')}
      </label>
      <div className="mt-2 flex items-center gap-2">
        <Input
          id="invite-link"
          type="text"
          readOnly
          value={inviteLink}
          className="font-mono text-xs"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={t('copyLink')}
          onClick={() => copy(inviteLink)}
        >
          {copied ? <Check size={16} className="text-primary" /> : <Copy size={16} />}
        </Button>
      </div>
    </div>
  );
}
