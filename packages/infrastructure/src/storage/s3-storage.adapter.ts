import {
  CopyObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  NotFound,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { OnModuleDestroy } from '@nestjs/common';
import { Injectable, Logger } from '@nestjs/common';
import type {
  IStorageService,
  StorageListOptions,
  StorageListResult,
  StorageObjectMetadata,
  StorageUploadOptions,
} from '@syncode/shared';
import { type S3Config, S3ConfigSchema } from '../config.js';

@Injectable()
export class S3StorageAdapter implements IStorageService, OnModuleDestroy {
  private readonly logger = new Logger(S3StorageAdapter.name);
  private readonly client: S3Client;
  private readonly presignClient: S3Client;
  private readonly publicPathPrefix: string;
  private readonly bucket: string;

  constructor(config: S3Config) {
    const validatedConfig = S3ConfigSchema.parse(config);

    this.bucket = validatedConfig.bucket;
    const publicEndpoint = validatedConfig.publicEndpoint
      ? new URL(validatedConfig.publicEndpoint)
      : null;
    this.publicPathPrefix = publicEndpoint
      ? normalizePublicPathPrefix(publicEndpoint.pathname)
      : '';
    const presignEndpoint = publicEndpoint
      ? `${publicEndpoint.protocol}//${publicEndpoint.host}`
      : validatedConfig.endpoint;
    const clientConfig: S3ClientConfig = {
      endpoint: validatedConfig.endpoint,
      region: validatedConfig.region,
      credentials: {
        accessKeyId: validatedConfig.accessKeyId,
        secretAccessKey: validatedConfig.secretAccessKey,
      },
      forcePathStyle: validatedConfig.forcePathStyle ?? true,
      maxAttempts: validatedConfig.maxAttempts ?? 3,
    };

    this.client = new S3Client(clientConfig);

    // Presigned URLs need a browser-reachable host. If the public URL includes
    // a routing prefix like /storage, sign against the origin path and add the
    // prefix after signing so nginx can strip it before S3 validates SigV4.
    if (publicEndpoint && presignEndpoint !== validatedConfig.endpoint) {
      this.presignClient = new S3Client({
        ...clientConfig,
        endpoint: presignEndpoint,
      });
    } else {
      this.presignClient = this.client;
    }
  }

  async upload(
    key: string,
    body: Buffer | Uint8Array | string,
    options?: StorageUploadOptions,
  ): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentType: options?.contentType,
      Metadata: options?.metadata,
    });

    await this.client.send(command);
  }

  async download(key: string): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    const response = await this.client.send(command);

    if (!response.Body) {
      throw new Error(`No body in response for key: ${key}`);
    }

    const bytes = await response.Body.transformToByteArray();
    return Buffer.from(bytes);
  }

  async delete(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    await this.client.send(command);
  }

  async deleteMany(keys: string[]): Promise<{
    deleted: string[];
    failed: Array<{ key: string; error: string }>;
  }> {
    if (keys.length === 0) return { deleted: [], failed: [] };

    const deleted: string[] = [];
    const failed: Array<{ key: string; error: string }> = [];

    // Handle 1000-key limit per DeleteObjects request.
    for (const chunk of this.chunkArray(keys, 1000)) {
      const result = await this.deleteChunk(chunk);
      deleted.push(...result.deleted);
      failed.push(...result.failed);
    }

    if (failed.length > 0) {
      this.logger.warn(
        `deleteMany completed with ${failed.length} failures out of ${keys.length} keys`,
      );
    }

    return { deleted, failed };
  }

  private async deleteChunk(chunk: string[]): Promise<{
    deleted: string[];
    failed: Array<{ key: string; error: string }>;
  }> {
    try {
      const command = new DeleteObjectsCommand({
        Bucket: this.bucket,
        Delete: {
          Objects: chunk.map((key) => ({ Key: key })),
          Quiet: false,
        },
      });
      const result = await this.client.send(command);
      const deleted =
        result.Deleted?.map((obj) => obj.Key).filter((k): k is string => Boolean(k)) ?? [];
      const failed =
        result.Errors?.filter((e): e is typeof e & { Key: string } => Boolean(e.Key)).map(
          (error) => ({
            key: error.Key,
            error: error.Message ?? 'Unknown error',
          }),
        ) ?? [];
      return { deleted, failed };
    } catch (error) {
      this.logger.error('S3 deleteMany chunk failed:', error);
      return {
        deleted: [],
        failed: chunk.map((key) => ({
          key,
          error: error instanceof Error ? error.message : 'Chunk deletion failed',
        })),
      };
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.client.send(command);
      return true;
    } catch (error) {
      if (error instanceof NotFound || (error as { name?: string }).name === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  async getMetadata(key: string): Promise<StorageObjectMetadata | null> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const response = await this.client.send(command);

      return {
        contentType: response.ContentType,
        contentLength: response.ContentLength ?? 0,
        lastModified: response.LastModified ?? new Date(),
        metadata: response.Metadata,
      };
    } catch (error) {
      if (error instanceof NotFound || (error as { name?: string }).name === 'NotFound') {
        return null;
      }
      throw error;
    }
  }

  async list(options?: StorageListOptions): Promise<StorageListResult> {
    const command = new ListObjectsV2Command({
      Bucket: this.bucket,
      Prefix: options?.prefix,
      MaxKeys: options?.maxKeys,
      ContinuationToken: options?.continuationToken,
    });

    const response = await this.client.send(command);

    return {
      keys: (response.Contents ?? [])
        .map((obj) => obj.Key)
        .filter((key): key is string => key !== undefined),
      continuationToken: response.NextContinuationToken,
      isTruncated: response.IsTruncated ?? false,
    };
  }

  async copy(sourceKey: string, destinationKey: string): Promise<void> {
    const command = new CopyObjectCommand({
      Bucket: this.bucket,
      CopySource: `${this.bucket}/${sourceKey}`,
      Key: destinationKey,
    });

    await this.client.send(command);
  }

  async getUploadUrl(
    key: string,
    options: { expiresInSeconds: number; contentType?: string },
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: options.contentType,
    });

    const signedUrl = await getSignedUrl(this.presignClient, command, {
      expiresIn: options.expiresInSeconds,
    });
    return this.withPublicPathPrefix(signedUrl);
  }

  async getDownloadUrl(key: string, expiresInSeconds: number): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    const signedUrl = await getSignedUrl(this.presignClient, command, {
      expiresIn: expiresInSeconds,
    });
    return this.withPublicPathPrefix(signedUrl);
  }

  async shutdown(): Promise<void> {
    this.logger.log('Shutting down S3 storage adapter...');
    this.client.destroy();
    if (this.presignClient !== this.client) {
      this.presignClient.destroy();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.shutdown();
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private withPublicPathPrefix(signedUrl: string): string {
    if (!this.publicPathPrefix) {
      return signedUrl;
    }

    const url = new URL(signedUrl);
    url.pathname = `${this.publicPathPrefix}${url.pathname.startsWith('/') ? url.pathname : `/${url.pathname}`}`;
    return url.toString();
  }
}

function normalizePublicPathPrefix(pathname: string): string {
  const normalized = pathname.replace(/\/+$/g, '');
  if (!normalized || normalized === '/') {
    return '';
  }
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
}
