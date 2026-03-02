export const STORAGE_SERVICE = Symbol.for('STORAGE_SERVICE');

export interface StorageUploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
}

export interface StorageListOptions {
  prefix?: string;
  maxKeys?: number;
  continuationToken?: string;
}

export interface StorageListResult {
  keys: string[];
  continuationToken?: string;
  isTruncated: boolean;
}

export interface StorageObjectMetadata {
  contentType?: string;
  contentLength: number;
  lastModified: Date;
  metadata?: Record<string, string>;
}

export interface IStorageService {
  upload(
    key: string,
    body: Buffer | Uint8Array | string,
    options?: StorageUploadOptions,
  ): Promise<void>;
  download(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  deleteMany(keys: string[]): Promise<void>;
  exists(key: string): Promise<boolean>;
  getMetadata(key: string): Promise<StorageObjectMetadata | null>;
  list(options?: StorageListOptions): Promise<StorageListResult>;
  copy(sourceKey: string, destinationKey: string): Promise<void>;
  getUploadUrl(
    key: string,
    options: { expiresInSeconds: number; contentType?: string },
  ): Promise<string>;
  getDownloadUrl(key: string, expiresInSeconds: number): Promise<string>;
  shutdown(): Promise<void>;
}
