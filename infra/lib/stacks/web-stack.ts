import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import type { StackConfig } from '../config';

export interface WebStackProps extends cdk.StackProps {
  config: StackConfig;
}

/**
 * WebStack — STUB (Phase 0)
 *
 * Will contain (Phase 5):
 * - Lambda function (nextjs-ssr) via @opennextjs/aws adapter — Function URL
 * - S3 Bucket (web-assets) — static /_next/static/ files
 * - CloudFront Distribution — SSR Lambda URL + static S3 origin
 * - WAFv2 WebACL — rate limiting (100 req/min/IP) + AWS Managed Rules CRS
 *
 * Depends on: AuthStack (Cognito client IDs), ApiStack (AppSync endpoint)
 */
export class WebStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: WebStackProps) {
    super(scope, id, props);

    // TODO Phase 5: Next.js via OpenNext + CloudFront + WAF
  }
}
