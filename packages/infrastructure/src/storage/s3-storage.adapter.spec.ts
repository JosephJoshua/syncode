import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { describe, expect, it, vi } from 'vitest';
import { S3StorageAdapter } from './s3-storage.adapter.js';

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn(),
}));

function createAdapter(publicEndpoint?: string) {
  return new S3StorageAdapter({
    endpoint: 'http://seaweedfs:8333',
    publicEndpoint,
    region: 'us-east-1',
    accessKeyId: 'syncode',
    secretAccessKey: 'syncode-secret',
    bucket: 'syncode',
    forcePathStyle: true,
  });
}

describe('S3StorageAdapter presigned URLs', () => {
  it('GIVEN public endpoint has a path prefix WHEN upload URL is signed THEN prefix is added after signing', async () => {
    vi.mocked(getSignedUrl).mockResolvedValueOnce(
      'https://syncode.example/syncode/whiteboard/image.webp?X-Amz-Signature=abc',
    );
    const adapter = createAdapter('https://syncode.example/storage');

    const url = await adapter.getUploadUrl('whiteboard/image.webp', {
      expiresInSeconds: 60,
      contentType: 'image/webp',
    });

    expect(url).toBe(
      'https://syncode.example/storage/syncode/whiteboard/image.webp?X-Amz-Signature=abc',
    );
  });

  it('GIVEN public endpoint has no path prefix WHEN download URL is signed THEN URL is unchanged', async () => {
    vi.mocked(getSignedUrl).mockResolvedValueOnce(
      'https://syncode.example/syncode/avatar.webp?X-Amz-Signature=abc',
    );
    const adapter = createAdapter('https://syncode.example');

    const url = await adapter.getDownloadUrl('avatar.webp', 60);

    expect(url).toBe('https://syncode.example/syncode/avatar.webp?X-Amz-Signature=abc');
  });
});
