import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import type { StackConfig } from '../config';

export interface LambdaStackProps extends cdk.StackProps {
  config: StackConfig;
}

/**
 * LambdaStack — STUB (Phase 0)
 *
 * Will contain (Phase 6):
 * - Lambda function (photo-processor) — Node.js 22.x
 *   - Triggered by S3 PUT event on photos bucket
 *   - Uses sharp (compiled for Lambda Linux) to generate WebP thumbnails
 *   - Writes thumbnail + medium to thumbnails bucket
 *   - Updates photos record status to 'ready'
 *   - VPC-enabled; same security group as resolver Lambda
 *
 * Depends on: StorageStack (photos bucket), DatabaseStack (DB proxy + secret)
 */
export class LambdaStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: LambdaStackProps) {
    super(scope, id, props);

    // TODO Phase 6: photo-processor Lambda (sharp thumbnails)
  }
}
