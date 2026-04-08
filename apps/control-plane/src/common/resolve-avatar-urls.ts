import type { IStorageService } from '@syncode/shared/ports';

export const AVATAR_PRESIGNED_URL_EXPIRY = 3600; // 1 hour

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
      if (!item.avatarUrl) return item;
      return {
        ...item,
        avatarUrl: await storageService.getDownloadUrl(item.avatarUrl, AVATAR_PRESIGNED_URL_EXPIRY),
      };
    }),
  );
}
