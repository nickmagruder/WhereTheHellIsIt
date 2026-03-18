import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import type { StackConfig } from '../config';

export interface StorageStackProps extends cdk.StackProps {
  config: StackConfig;
}

/**
 * StorageStack — STUB (Phase 0)
 *
 * Will contain (Phase 3):
 * - S3 Bucket (photos) — block all public; CORS for PUT; lifecycle rules
 * - S3 Bucket (thumbnails) — block all public
 * - CloudFront Distribution — serves both via signed URLs only
 * - OriginAccessControl — S3 buckets inaccessible except via CloudFront
 * - SecretsManager Secret — CloudFront private key (PEM) + key pair ID
 *
 * Outputs: PhotosBucketName, ThumbnailsBucketName, CloudFrontDomain, KeyPairId, PrivateKeySecretArn
 */
export class StorageStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: StorageStackProps) {
    super(scope, id, props);

    // TODO Phase 3: S3 + CloudFront + signed URLs
  }
}
