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
import { type S3Config, S3ConfigSchema } from '../config';

@Injectable()
export class S3StorageAdapter implements IStorageService, OnModuleDestroy {
  private readonly logger = new Logger(S3StorageAdapter.name);
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: S3Config) {
    const validatedConfig = S3ConfigSchema.parse(config);

    this.bucket = validatedConfig.bucket;
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
    const deleted: string[] = [];
    const failed: Array<{ key: string; error: string }> = [];

    if (keys.length === 0) {
      return { deleted, failed };
    }

    // Handle 1000-key limit per DeleteObjects request.
    const chunks = this.chunkArray(keys, 1000);

    for (const chunk of chunks) {
      try {
        const command = new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: {
            Objects: chunk.map((key) => ({ Key: key })),
            Quiet: false,
          },
        });

        const result = await this.client.send(command);

        if (result.Deleted) {
          for (const obj of result.Deleted) {
            if (obj.Key) {
              deleted.push(obj.Key);
            }
          }
        }

        if (result.Errors) {
          for (const error of result.Errors) {
            if (error.Key) {
              failed.push({
                key: error.Key,
                error: error.Message ?? 'Unknown error',
              });
            }
          }
        }
      } catch (error) {
        this.logger.error('S3 deleteMany chunk failed:', error);
        for (const key of chunk) {
          failed.push({
            key,
            error: error instanceof Error ? error.message : 'Chunk deletion failed',
          });
        }
      }
    }

    if (failed.length > 0) {
      this.logger.warn(
        `deleteMany completed with ${failed.length} failures out of ${keys.length} keys`,
      );
    }

    return { deleted, failed };
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

    return getSignedUrl(this.client, command, {
      expiresIn: options.expiresInSeconds,
    });
  }

  async getDownloadUrl(key: string, expiresInSeconds: number): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return getSignedUrl(this.client, command, {
      expiresIn: expiresInSeconds,
    });
  }

  async shutdown(): Promise<void> {
    this.logger.log('Shutting down S3 storage adapter...');
    this.client.destroy();
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
}
