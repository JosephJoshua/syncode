import { z } from 'zod';

export const RedisConfigSchema = z.object({
  url: z.string().min(1, 'Redis URL cannot be empty'),
  maxRetriesPerRequest: z.number().int().nonnegative().nullable().optional(),
  retryStrategy: z.custom<(times: number) => number | undefined | null>().optional(),
  connectTimeout: z.number().int().positive().optional(),
  commandTimeout: z.number().int().positive().optional(),
});

export const S3ConfigSchema = z.object({
  endpoint: z.string().min(1, 'S3 endpoint cannot be empty'),
  region: z.string().min(1, 'S3 region cannot be empty'),
  accessKeyId: z.string().min(1, 'S3 access key ID cannot be empty'),
  secretAccessKey: z.string().min(1, 'S3 secret access key cannot be empty'),
  bucket: z.string().min(1, 'S3 bucket cannot be empty'),
  forcePathStyle: z.boolean().optional(),
  maxAttempts: z.number().int().positive().optional(),
});

export const LiveKitConfigSchema = z.object({
  url: z.string().min(1, 'LiveKit URL cannot be empty'),
  apiKey: z.string().min(1, 'LiveKit API key cannot be empty'),
  apiSecret: z.string().min(1, 'LiveKit API secret cannot be empty'),
});

export type RedisConfig = z.infer<typeof RedisConfigSchema>;
export type S3Config = z.infer<typeof S3ConfigSchema>;
export type LiveKitConfig = z.infer<typeof LiveKitConfigSchema>;
