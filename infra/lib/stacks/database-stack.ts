import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import type { StackConfig } from '../config';

export interface DatabaseStackProps extends cdk.StackProps {
  config: StackConfig;
}

/**
 * DatabaseStack — STUB (Phase 0)
 *
 * Will contain (Phase 3):
 * - VPC (2 AZs, private subnets for DB + Lambda; no NAT in dev)
 * - Aurora Serverless v2 (PostgreSQL 16, 0.5–16 ACU, auto-pause in dev)
 * - SecretsManager Secret (DB credentials, auto-rotated)
 * - RDS Proxy (connection pooling for Lambda; IAM auth enabled)
 * - Security groups (DB → Proxy → Lambda chain, port 5432 only)
 *
 * Outputs: ProxyEndpoint, SecretArn, VpcId, LambdaSecurityGroupId
 */
export class DatabaseStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id, props);

    // TODO Phase 3: Aurora Serverless v2 + RDS Proxy + VPC
  }
}
