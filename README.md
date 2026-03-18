# Where the Hell Is It?

A cross-platform app for tracking physical items and their locations, with photo support. Built for small teams and families.

**Stack:** React Native (Expo) + Next.js · AWS AppSync (GraphQL) · Aurora Serverless v2 (PostgreSQL) · AWS Cognito · AWS CDK

See `tutorial.md` for a step-by-step build log and `CLAUDE.md` for the full architecture reference.

---

## Changelog

> Newest entries at top.

### 2026-03-17 (5)

Fix CI: remove redundant `version: 9` from all three workflow pnpm setup steps — `pnpm/action-setup@v4` reads the version from `packageManager` in `package.json` automatically; specifying both causes `ERR_PNPM_BAD_PM_VERSION`

### 2026-03-17 (4)

Phase 1.1: Docker Compose for Local Dev

- Created `docker-compose.yml` — PostgreSQL 16 Alpine with `pg_trgm` loaded via `shared_preload_libraries`; matches `DATABASE_URL` in `.env.example` (dev:dev@localhost:5432/wherethehellistit)
- Named volume `pgdata` for persistent local data between restarts
- `ltree` and `pg_trgm` extensions enabled in migrations via `CREATE EXTENSION IF NOT EXISTS` (bundled with PostgreSQL 16, no extra install needed)
- Start with: `docker compose up -d`

### 2026-03-17 (3)

Phase 0: Foundation — Monorepo, Tooling, CI scaffolded

- Created root `package.json` (pnpm workspaces, turbo scripts), `pnpm-workspace.yaml`, `turbo.json` (v2 "tasks" format: lint → type-check → test → build)
- Created `tsconfig.base.json` (strict: true, exactOptionalPropertyTypes: true, moduleResolution: bundler)
- Created `.eslintrc.base.js` + `.eslintrc.js` (ESLint 8, @typescript-eslint v7, jsx-a11y, prettier)
- Created `.prettierrc`, `.gitignore`, `.nvmrc` (Node 22), `.env.example`
- Scaffolded all 9 packages with package.json + tsconfig.json + src/index.ts + vitest.config.ts (passWithNoTests: true): tokens, config, db, graphql, auth, api, ui-web, ui-mobile, test-utils
- Scaffolded apps/web (Next.js 15) and apps/mobile (Expo SDK 52) stubs
- Implemented `packages/config/src/env.ts` — Zod schema + validateEnv() for all 15 environment variables
- Created `infra/` CDK project: cdk.json (tsx runner), bin/app.ts (all 6 stacks + cdk-nag AwsSolutionsChecks + cost tags), lib/config.ts, 6 stub stacks (AuthStack, DatabaseStack, StorageStack, ApiStack, LambdaStack, WebStack)
- Created `.github/workflows/ci.yml` (lint + type-check + test + cdk synth + pnpm audit), deploy-staging.yml (disabled until Phase 3), deploy-prod.yml (manual trigger, disabled until Phase 11)

### 2026-03-17 (2)

- Added working rules to `CLAUDE.md`: user handles git; Claude must update changelog, docs, and memory at end of every task

### 2026-03-17

- Initialized repository
- Completed architecture planning phase (ADRs 001–006)
- Created `CLAUDE.md` architecture reference
- Created `tutorial.md` build log
