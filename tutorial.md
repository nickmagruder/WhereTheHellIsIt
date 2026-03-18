# Building "Where the Hell Is It?": A Cross-Platform Item Tracker

> A step-by-step tutorial for building a full-stack mobile and web application for tracking physical items and their locations, with photo support.

## What We're Building

**Where the Hell Is It?** is a cross-platform app for tracking physical items — gear, tools, equipment — and where you left them. You can assign items to locations, attach photos, and share a space with family members or teammates who each have their own role (owner, editor, or viewer).

The stack is a TypeScript monorepo with a React Native + Expo mobile app, a Next.js web app, an AWS AppSync GraphQL API backed by Lambda resolvers, Aurora Serverless v2 (PostgreSQL), S3 + CloudFront for photos, and AWS Cognito for authentication with Google and Apple sign-in. Infrastructure is managed with AWS CDK and deployed via GitHub Actions.

---

## Phase 0: Architecture Planning

Before writing a single line of code, we spent time designing the architecture. This phase documents those decisions and the reasoning behind them.

### Why plan first?

Cross-platform apps with mobile, web, a GraphQL API, a database, file storage, and auth have a lot of moving parts. Making the wrong call early — the wrong database model, the wrong auth approach, the wrong API style — can cost weeks of rework later. We used a structured requirements-gathering session to nail down the key decisions before touching the repo.

### Requirements gathered

Through a series of questions, we locked in the following:

**Who is this for?** Small teams and families (2–20 users) with role-based access: owner, editor, and viewer roles per shared space.

**Offline?** Online-only for the MVP. Full offline CRUD (for cataloging in a basement, for example) is noted as a future enhancement.

**Platforms:** React Native with Expo for iOS and Android; Next.js for the web.

**Cloud:** AWS.

**API:** GraphQL.

**Auth:** AWS Cognito with Google and Apple as social login providers.

**CI/CD:** GitHub Actions + AWS CDK.

**Theme:** Violet, shared across both platforms via a single `global.css` token file.

---

### Key architectural decisions

#### GraphQL: AWS AppSync (not Apollo Server on Lambda)

The two main options were running Apollo Server inside a Lambda function (with API Gateway in front) or using AWS AppSync, AWS's managed GraphQL service.

We chose **AppSync** for three reasons:

1. **Cognito auth is automatic.** AppSync validates Cognito JWTs against the JWKS endpoint without any custom middleware. With Apollo Server, you write and maintain that validation code yourself.

2. **Real-time subscriptions are included.** AppSync manages WebSocket connections, fan-out, and filtering out of the box. With Apollo Server, you need a separate API Gateway WebSocket API, connection management in DynamoDB, and fan-out logic.

3. **The offline path is paved.** Full offline CRUD is noted as a future requirement. AWS Amplify DataStore is designed specifically for AppSync — when we're ready, adding `@model` directives to the schema and switching to `Amplify.DataStore` is the entire migration. With Apollo Server, offline sync is a blank canvas.

AppSync resolvers run in a JavaScript sandbox (not full Node.js), so any complex business logic lives in a Lambda function used as a data source. AppSync handles auth and routing; Lambda handles logic.

#### Database: Aurora Serverless v2 (PostgreSQL 16) + RDS Proxy

The two main options were DynamoDB (AppSync has native direct resolvers) and Aurora Serverless v2 (managed PostgreSQL that auto-scales).

We chose **Aurora Serverless v2** because the data model is inherently relational. Users, items, spaces, locations, and roles all have many-to-many relationships. Role-based filtering across those entities is trivially expressed in SQL JOINs but requires complex DynamoDB GSI design and Lambda resolvers for every query.

Aurora Serverless v2 auto-scales from 0.5 to 128 ACUs and can be paused in dev/staging to control costs. We also enable the `pg_trgm` and `ltree` PostgreSQL extensions for fuzzy text search and location hierarchy queries.

> ⚠️ **Cost note:** Aurora Serverless v2 does not truly scale to zero — the minimum is 0.5 ACU (≈ $0.12/hr). Enable auto-pause on non-production environments. For local development, [Neon](https://neon.tech) is a drop-in PostgreSQL alternative with true scale-to-zero.

Lambda functions connect to Aurora through **RDS Proxy**, which pools connections and prevents the database from being overwhelmed by Lambda's potentially large concurrency.

#### ORM: Drizzle (not Prisma)

Prisma is the more well-known choice, but it ships a ~30–45MB Rust binary (the Query Engine) alongside your code. This binary adds significant cold start overhead to Lambda functions — especially VPC Lambdas, which are already slower to start due to ENI attachment.

**Drizzle ORM** is pure TypeScript with no binary. It works with the standard `node-postgres` (`pg`) driver, which means RDS Proxy connection pooling just works with no extra configuration. Drizzle's SQL-like query syntax is also easier to read in CloudWatch logs when debugging.

#### Web framework: Next.js 15 (App Router)

We chose **Next.js 15** over a plain React SPA primarily for `next/image`, which provides automatic WebP conversion and responsive image optimization. For a photo-heavy app this is a meaningful accessibility and performance win. Future "shareable item link" features also benefit from SSR.

The web app is hosted on AWS via `@opennextjs/aws` (OpenNext) — static assets go to S3 + CloudFront, dynamic routes go to a Lambda Function URL.

#### UI components: React Native Reusables + shadcn/ui, shared Violet theme

Rather than using separate component philosophies on each platform, we aligned on the same **copy-paste ownership model** for both:

- **Mobile:** [React Native Reusables](https://reactnativereusables.com/) + NativeWind v4. Built on `rn-primitives` (a Radix UI port for React Native), styled with Tailwind class names via NativeWind. Same accessible primitive pattern as the web.
- **Web:** [shadcn/ui](https://ui.shadcn.com/) + Tailwind v4. Unstyled Radix UI primitives with Tailwind styling.

Both use the same CSS variable naming convention. We define the design tokens once in `packages/tokens/global.css` — web consumes them via Tailwind v4's `@theme`, mobile via NativeWind's `vars()` utility. The web is styled to match the mobile app visually, not the default shadcn neutral aesthetic.

The chosen theme is **Violet** (`--primary: 262.1 83.3% 57.8%`). The full token set is committed to `packages/tokens/global.css`.

#### Mobile E2E testing: Maestro (not Detox)

Detox is the more established React Native E2E framework, but it requires the Expo bare workflow or a custom dev client build — neither of which is compatible with Expo managed workflow without significant overhead.

**Maestro** works directly with Expo Go. Its YAML-based test DSL is straightforward to write and sufficient for the MVP test scenarios (add item, capture photo, search for item). It can be reconsidered post-MVP if complex gesture testing becomes necessary.

---

### Project structure

The repo is a Turborepo monorepo with `pnpm` workspaces:

```text
where-the-hell-is-it/
├── apps/
│   ├── web/       Next.js 15
│   └── mobile/    Expo SDK 52+ (managed workflow)
├── packages/
│   ├── graphql/   schema.graphql + codegen output
│   ├── db/        Drizzle schema + migrations
│   ├── api/       AppSync resolver Lambda
│   ├── auth/      Cognito utilities
│   ├── tokens/    global.css — Violet theme (shared)
│   ├── ui-web/    shadcn/ui components
│   ├── ui-mobile/ React Native Reusables components
│   ├── config/    Zod env validation
│   └── test-utils/ MSW handlers, test factories
└── infra/         AWS CDK (6 stacks)
```

---

### Implementation phases

With the architecture locked, the plan is to build in eight phases:

| Phase | Focus |
| --- | --- |
| **0** | Monorepo setup, DB schema, CDK stacks deployed to dev, CI green |
| **1** | AppSync resolvers, spaces + items CRUD, RBAC, integration tests |
| **2** | Next.js web app — auth flow, items list/create/search, Playwright E2E |
| **3** | Photo upload — pre-signed URLs, Sharp thumbnails, CloudFront signed URLs |
| **4** | Expo mobile app — auth, camera capture, Maestro E2E, TestFlight |
| **5** | Location hierarchy, invite/role management UI |
| **6** | Full-text search, tag filters, WCAG 2.1 AA audit |
| **7** | Production hardening — CloudWatch dashboards, WAF tuning, security review |

---

---

## Phase 0: Monorepo Scaffold + CI

**Goal:** Turn an empty repo into a green CI pipeline — `pnpm turbo lint type-check test` passes across all packages, and `cdk synth` validates the CDK setup — before writing any application code.

The motto here is **structure before substance**: get the build system, tooling, and deploy pipeline working first so that every subsequent change is tested automatically.

### Step 1: Choose a monorepo tool

We're using **Turborepo** (v2.x) with **pnpm workspaces**. The combination gives us:

- Task caching — Turborepo hashes inputs and skips tasks when nothing changed
- Correct build ordering — `^build` dependency means dependencies always build before dependents
- A single `pnpm install` installs everything across all packages

### Step 2: Root package.json and pnpm-workspace.yaml

Create `package.json` at the repo root:

```json
{
  "name": "where-the-hell-is-it",
  "private": true,
  "packageManager": "pnpm@9.15.4",
  "scripts": {
    "lint": "turbo lint",
    "type-check": "turbo type-check",
    "test": "turbo test",
    "build": "turbo build"
  },
  "devDependencies": {
    "turbo": "^2.3.3",
    "typescript": "^5.7.3",
    "eslint": "^8.57.1",
    ...
  }
}
```

And `pnpm-workspace.yaml` to tell pnpm where the workspace packages live:

```yaml
packages:
  - "apps/*"
  - "packages/*"
  - "infra"
```

### Step 3: Turborepo task pipeline (turbo.json)

Turborepo v2 uses `"tasks"` (not `"pipeline"` which was the v1 key):

```json
{
  "$schema": "https://turborepo.dev/schema.json",
  "tasks": {
    "build":      { "dependsOn": ["^build"], "outputs": [".next/**", "dist/**"] },
    "lint":       {},
    "type-check": { "dependsOn": ["^type-check"] },
    "test":       { "outputs": ["coverage/**"] },
    "dev":        { "cache": false, "persistent": true }
  }
}
```

Key design decisions:

- `lint` has no dependencies — it runs in parallel across all packages immediately
- `type-check` depends on `^type-check` (dependencies type-check first) but NOT on `build` — faster CI, avoids needing compiled output
- `test` has no dependencies — unit tests run in parallel, don't need build artifacts
- `build` has `^build` — dependencies must be built before dependents

### Step 4: Strict TypeScript baseline (tsconfig.base.json)

All packages extend this:

```json
{
  "compilerOptions": {
    "strict": true,
    "exactOptionalPropertyTypes": true,
    "moduleResolution": "bundler",
    "target": "ES2022",
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

`exactOptionalPropertyTypes` is the strict-mode extra that catches `{ foo?: string }` being assigned `{ foo: undefined }` — real bugs that TypeScript's base strict mode misses.

`moduleResolution: "bundler"` is the modern setting for apps that use bundlers (Next.js, Vite, esbuild). The CDK/Lambda `infra` package overrides this to `"node10"` since CDK is a Node.js CommonJS environment.

### Step 5: ESLint setup

The strategy: one shared base config (`.eslintrc.base.js`) that packages can extend when they need extra rules (e.g., `eslint-plugin-react-hooks` for web, React Native rules for mobile). The root `.eslintrc.js` sets `root: true` to stop traversal and applies the base config to all TypeScript files.

ESLint 8 (legacy `.eslintrc` format) with `@typescript-eslint` v7. ESLint 9's flat config is cleaner but `jsx-a11y` plugin v6 doesn't yet have a full flat config implementation — sticking with legacy format for now.

### Step 6: Package stubs

Each of the 9 shared packages and 2 apps gets:

- `package.json` — name, version, scripts (lint/type-check/test/build), and real dependencies
- `tsconfig.json` — extends `../../tsconfig.base.json`, sets rootDir/outDir
- `src/index.ts` — `export {}` placeholder (type-check needs at least one file to compile)
- `vitest.config.ts` — with `passWithNoTests: true` (so `vitest run` exits 0 when no tests exist yet)

The `passWithNoTests: true` option is critical for Phase 0: without it, `vitest run` exits with code 1 when there are no test files, which would fail CI.

### Step 7: Environment config package (packages/config)

Before any other package writes code, we define the complete set of environment variables the app needs. This package exports:

1. `envSchema` — a Zod schema documenting every variable
2. `validateEnv()` — call this at Lambda cold-start or Next.js startup (not on import!)

**Why not validate on import?** If the module auto-validates at import time, every test and type-check would fail unless all 15 env vars are set. Lazy validation (call it explicitly at startup) means tests can import the module without triggering validation.

### Step 8: CDK project init (infra/)

The CDK project uses `tsx` as the TypeScript runner (faster than `ts-node`, no separate tsconfig needed for execution):

```json
// infra/cdk.json
{ "app": "tsx bin/app.ts" }
```

`bin/app.ts` instantiates all 6 stacks immediately — even though they're empty stubs. This establishes the stack naming convention (`WhereTheHellIsIt-{env}-Auth`, etc.) and wires up:

1. **cdk-nag `AwsSolutionsChecks`** — security checks attached as a CDK Aspect at the app level. Zero findings now (no resources), but every resource added in Phase 3+ is checked on the spot.

2. **Cost tags** — `Project` and `Environment` tags on all stacks from day one.

3. **Confirmation guards** — if `env=prod`, stateful resources (database, storage) get a `DeletionPolicy: Retain` tag as a reminder.

The stub stacks all `extend cdk.Stack` with empty constructors. `cdk synth` produces valid (empty) CloudFormation for each stack — this validates CDK versions, TypeScript config, and the CDK app entry point all work correctly.

### Step 9: GitHub Actions CI

Three workflows:

**ci.yml** — runs on every PR and push to main:

1. `pnpm install --frozen-lockfile`
2. `pnpm turbo lint`
3. `pnpm turbo type-check`
4. `pnpm turbo test`
5. `cd infra && npx cdk synth` (validates CDK compiles)
6. `pnpm audit --audit-level=high`

**deploy-staging.yml** — triggers on merge to main, currently `if: false` (disabled). Will be enabled in Phase 3 when the CDK stacks have real resources to deploy.

**deploy-prod.yml** — manual trigger (`workflow_dispatch`) with a confirmation input. Requires the user to type `deploy-prod` to confirm. Currently `if: false`. Will be enabled in Phase 11.

The CI uses OIDC (not long-lived access keys) for AWS credentials — `aws-actions/configure-aws-credentials` with a role ARN. No secrets stored in GitHub that don't rotate.

### Running it locally

After all files are created:

```bash
# Install all workspace dependencies
pnpm install

# Verify the pipeline works
pnpm turbo lint
pnpm turbo type-check
pnpm turbo test

# Verify CDK compiles
cd infra && npx cdk synth
```

**Phase 0 is done when:** All of the above pass with no errors.

> **Next up:** Phase 1 — Drizzle schema, migrations, and integration test scaffold against local PostgreSQL (Docker Compose).
