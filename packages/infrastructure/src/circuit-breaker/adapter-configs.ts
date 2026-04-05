import type { AdapterCircuitConfig } from './proxy.js';

export const S3_ADAPTER_CIRCUIT_CONFIG: AdapterCircuitConfig = {
  upload: { circuitName: 's3-upload' },
  download: { circuitName: 's3-download' },
  delete: { circuitName: 's3-delete' },
  deleteMany: { circuitName: 's3-delete' },
  getUploadUrl: { circuitName: 's3-presigned-url' },
  getDownloadUrl: { circuitName: 's3-presigned-url' },
  exists: { circuitName: 's3-exists' },
  getMetadata: { circuitName: 's3-metadata' },
  list: { circuitName: 's3-list' },
  copy: { circuitName: 's3-copy' },
} as const;

export const REDIS_ADAPTER_CIRCUIT_CONFIG: AdapterCircuitConfig = {
  get: { circuitName: 'redis-get' },
  set: { circuitName: 'redis-set' },
  incrBy: { circuitName: 'redis-incrby' },
  setIfNotExists: { circuitName: 'redis-set-if-not-exists' },
  exists: { circuitName: 'redis-exists' },
  del: { circuitName: 'redis-del' },
  delByPattern: { circuitName: 'redis-del-pattern' },
  getTtl: { circuitName: 'redis-get-ttl' },
  expire: { circuitName: 'redis-expire' },
} as const;

export const LIVEKIT_ADAPTER_CIRCUIT_CONFIG: AdapterCircuitConfig = {
  generateToken: { circuitName: 'livekit-generate-token' },
  createRoom: { circuitName: 'livekit-create-room' },
  deleteRoom: { circuitName: 'livekit-delete-room' },
} as const;

export const BULLMQ_ADAPTER_CIRCUIT_CONFIG: AdapterCircuitConfig = {
  enqueue: { circuitName: 'bullmq-enqueue' },
  enqueueBulk: { circuitName: 'bullmq-enqueue-bulk' },
  getJob: { circuitName: 'bullmq-get-job' },
  getQueueStats: { circuitName: 'bullmq-get-stats' },
} as const;

/** Collab HTTP client CB config */
export const COLLAB_CLIENT_CIRCUIT_CONFIG: AdapterCircuitConfig = {
  createDocument: { circuitName: 'collab-http-create' },
  destroyDocument: { circuitName: 'collab-http-destroy' },
  kickUser: { circuitName: 'collab-http-kick' },
} as const;
