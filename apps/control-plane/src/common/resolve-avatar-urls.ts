import type { IStorageService } from '@syncode/shared/ports';

export const AVATAR_PRESIGNED_URL_EXPIRY = 86400; // 24 hours — long-lived since avatars aren't sensitive

/**
 * Resolves S3 avatar keys to presigned download URLs for a list of items.
 * Items without an avatarUrl are returned unchanged.
 */
export async function resolveAvatarUrls<T extends { avatarUrl: string | null }>(
  items: T[],
  storageService: IStorageService,
): Promise<T[]> {
  return Promise.all(
    items.map(async (item) => {
      if (!item.avatarUrl || item.avatarUrl.startsWith('http')) return item;
      return {
        ...item,
        avatarUrl: await storageService.getDownloadUrl(item.avatarUrl, AVATAR_PRESIGNED_URL_EXPIRY),
      };
    }),
  );
}
