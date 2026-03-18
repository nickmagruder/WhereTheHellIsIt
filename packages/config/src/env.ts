import { z } from 'zod';

/**
 * Zod schema for all environment variables used across the stack.
 * Validated at startup by API Lambda and Next.js app — not on import.
 *
 * Copy .env.example → .env and fill in values for local development.
 * In AWS, these come from Secrets Manager / Lambda environment variables.
 */
export const envSchema = z.object({
  // Database — Aurora Serverless v2 via RDS Proxy
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid PostgreSQL connection URL'),
  DATABASE_SECRET_ARN: z.string().optional(), // Used in Lambda to fetch credentials at runtime

  // Cognito
  COGNITO_USER_POOL_ID: z.string().min(1, 'COGNITO_USER_POOL_ID is required'),
  COGNITO_CLIENT_ID_WEB: z.string().min(1, 'COGNITO_CLIENT_ID_WEB is required'),
  COGNITO_CLIENT_ID_MOBILE: z.string().min(1, 'COGNITO_CLIENT_ID_MOBILE is required'),

  // AppSync
  APPSYNC_ENDPOINT: z.string().url('APPSYNC_ENDPOINT must be a valid URL'),
  APPSYNC_REGION: z.string().min(1, 'APPSYNC_REGION is required'),

  // S3
  S3_PHOTOS_BUCKET: z.string().min(1, 'S3_PHOTOS_BUCKET is required'),
  S3_THUMBNAILS_BUCKET: z.string().min(1, 'S3_THUMBNAILS_BUCKET is required'),

  // CloudFront
  CLOUDFRONT_DOMAIN: z.string().min(1, 'CLOUDFRONT_DOMAIN is required'),
  CLOUDFRONT_KEY_PAIR_ID: z.string().min(1, 'CLOUDFRONT_KEY_PAIR_ID is required'),
  CLOUDFRONT_PRIVATE_KEY_SECRET_ARN: z
    .string()
    .min(1, 'CLOUDFRONT_PRIVATE_KEY_SECRET_ARN is required'),

  // AWS
  AWS_REGION: z.string().default('us-east-1'),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validate and return typed environment variables.
 * Call this once at Lambda cold-start or Next.js startup — not at module load.
 *
 * @throws {Error} if required environment variables are missing or invalid
 */
export function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const formatted = result.error.errors
      .map((e) => `  ${e.path.join('.')}: ${e.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${formatted}`);
  }
  return result.data;
}
