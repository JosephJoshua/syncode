import { Button } from '@syncode/ui';
import { Dialog } from 'radix-ui';
import { useCallback, useState } from 'react';
import type { Area } from 'react-easy-crop';
import Cropper from 'react-easy-crop';
import { useTranslation } from 'react-i18next';
import { cropImage } from '@/lib/crop-image.js';

interface AvatarCropModalProps {
  imageSrc: string | null;
  open: boolean;
  isPending: boolean;
  onClose: () => void;
  onConfirm: (blob: Blob) => void;
}

export function AvatarCropModal({
  imageSrc,
  open,
  isPending,
  onClose,
  onConfirm,
}: AvatarCropModalProps) {
  const { t } = useTranslation('profile');
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleConfirm = async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    const blob = await cropImage(imageSrc, croppedAreaPixels);
    onConfirm(blob);
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      onClose();
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-1.5rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-[28px] bg-card p-5 shadow-[0_28px_80px_-32px_oklch(0.12_0.02_260/0.7)] ring-1 ring-border/60 sm:w-[calc(100vw-2rem)] sm:p-6">
          <Dialog.Title className="text-xl font-semibold tracking-tight text-foreground">
            {t('avatar.cropTitle')}
          </Dialog.Title>

          <div className="relative mt-4 aspect-square w-full overflow-hidden rounded-xl bg-black">
            {imageSrc ? (
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            ) : null}
          </div>

          <div className="mt-4 flex items-center gap-3 px-1">
            <span className="text-xs text-muted-foreground">{t('avatar.zoom')}</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 accent-primary"
            />
          </div>

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
            <Dialog.Close asChild>
              <Button
                type="button"
                variant="ghost"
                disabled={isPending}
                className="w-full sm:w-auto"
              >
                {t('button.cancel')}
              </Button>
            </Dialog.Close>
            <Button
              type="button"
              disabled={isPending || !croppedAreaPixels}
              className="w-full sm:w-auto"
              onClick={() => {
                void handleConfirm();
              }}
            >
              {isPending ? t('avatar.uploading') : t('avatar.save')}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
