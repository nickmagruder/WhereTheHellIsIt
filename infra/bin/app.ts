#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { Aspects } from 'aws-cdk-lib';
import { AwsSolutionsChecks } from 'cdk-nag';

import { getConfig } from '../lib/config';
import { AuthStack } from '../lib/stacks/auth-stack';
import { DatabaseStack } from '../lib/stacks/database-stack';
import { StorageStack } from '../lib/stacks/storage-stack';
import { ApiStack } from '../lib/stacks/api-stack';
import { LambdaStack } from '../lib/stacks/lambda-stack';
import { WebStack } from '../lib/stacks/web-stack';

const app = new cdk.App();
const config = getConfig(app);

// Security checks via cdk-nag — attached early so every resource added is checked immediately.
// All stacks are stubs in Phase 0 so there are no findings yet.
// When resources are added in Phase 3+, fix nag findings before suppressing them.
Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));

// Stack instantiation order follows dependency direction:
// Auth → (Database, Storage) → Api → Lambda → Web
const auth = new AuthStack(app, `${config.prefix}-Auth`, {
  config,
  env: config.cdkEnv,
  description: 'Cognito UserPool + social login + Identity Pool for S3 direct upload',
});

const database = new DatabaseStack(app, `${config.prefix}-Database`, {
  config,
  env: config.cdkEnv,
  description: 'Aurora Serverless v2 + RDS Proxy + VPC',
});

const storage = new StorageStack(app, `${config.prefix}-Storage`, {
  config,
  env: config.cdkEnv,
  description: 'S3 photo buckets + CloudFront CDN with signed URLs',
});

const api = new ApiStack(app, `${config.prefix}-Api`, {
  config,
  env: config.cdkEnv,
  description: 'AppSync GraphQL API + resolver Lambda',
});

const lambda = new LambdaStack(app, `${config.prefix}-Lambda`, {
  config,
  env: config.cdkEnv,
  description: 'Photo processor Lambda (Sharp thumbnails)',
});

const web = new WebStack(app, `${config.prefix}-Web`, {
  config,
  env: config.cdkEnv,
  description: 'Next.js 15 via OpenNext + CloudFront + WAF',
});

// Prevent accidental deletion of stateful resources in production
if (config.env === 'prod') {
  cdk.Tags.of(database).add('DeletionPolicy', 'Retain');
  cdk.Tags.of(storage).add('DeletionPolicy', 'Retain');
}

// Tag all stacks for cost tracking
for (const stack of [auth, database, storage, api, lambda, web]) {
  cdk.Tags.of(stack).add('Project', 'WhereTheHellIsIt');
  cdk.Tags.of(stack).add('Environment', config.env);
}
