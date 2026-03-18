import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import type { StackConfig } from '../config';

export interface ApiStackProps extends cdk.StackProps {
  config: StackConfig;
}

/**
 * ApiStack — STUB (Phase 0)
 *
 * Will contain (Phase 3):
 * - AppSync GraphQL API (Cognito UserPools auth; CloudWatch logging)
 * - AppSync schema from packages/graphql/src/schema.graphql
 * - Lambda function (appsync-resolver) — VPC-enabled; bundled with esbuild
 * - AppSync data source → resolver Lambda
 * - Pipeline resolvers: checkRbac fn → businessLogic fn per mutation
 * - CloudWatch LogGroup
 *
 * Outputs: AppSyncEndpoint, AppSyncApiId
 */
export class ApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    // TODO Phase 3: AppSync API + resolver Lambda
  }
}
