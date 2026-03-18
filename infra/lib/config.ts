import * as cdk from 'aws-cdk-lib';

export interface StackConfig {
  /** Short name for this environment, used as a stack name prefix */
  env: string;
  /** Full stack name prefix, e.g. "WhereTheHellIsIt-dev" */
  prefix: string;
  /** CDK environment (account + region) */
  cdkEnv: cdk.Environment;
}

/**
 * Resolve stack configuration from CDK context.
 *
 * Usage: `cdk synth --context env=dev`
 *        `cdk deploy --context env=prod`
 *
 * Falls back to "dev" if env context is not set.
 */
export function getConfig(app: cdk.App): StackConfig {
  const envName = (app.node.tryGetContext('env') as string | undefined) ?? 'dev';

  // exactOptionalPropertyTypes + readonly: must omit the key when undefined, not set it to
  // undefined. Use spread so the object is constructed atomically (no post-construction assign).
  const cdkEnv: cdk.Environment = {
    ...(process.env.CDK_DEFAULT_ACCOUNT !== undefined
      ? { account: process.env.CDK_DEFAULT_ACCOUNT }
      : {}),
    region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1',
  };

  return {
    env: envName,
    prefix: `WhereTheHellIsIt-${envName}`,
    cdkEnv,
  };
}
