import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import type { StackConfig } from '../config';

export interface AuthStackProps extends cdk.StackProps {
  config: StackConfig;
}

/**
 * AuthStack — STUB (Phase 0)
 *
 * Will contain (Phase 3):
 * - Cognito UserPool (email/password + Google OIDC + Apple OIDC)
 * - UserPoolClients (web + mobile)
 * - UserPoolDomain (hosted UI OAuth)
 * - IdentityPool (temporary AWS creds for S3 direct upload)
 * - Post-confirmation Lambda trigger (creates User record in DB)
 *
 * Outputs: UserPoolId, WebClientId, MobileClientId, IdentityPoolId
 */
export class AuthStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: AuthStackProps) {
    super(scope, id, props);

    // TODO Phase 3: Cognito UserPool + social login providers
  }
}
