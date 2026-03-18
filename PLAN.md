# Implementation Plan — Where the Hell Is It?

> Living document. Update phase status and task completion as work progresses.
> Created: 2026-03-17 | Status: Phase 0 — ✅ Complete → Phase 1 — DB Schema next

## Completed Pre-work

- [x] `CLAUDE.md` — architecture reference + ADRs written
- [x] `PLAN.md` — this implementation plan
- [x] Agent skills installed: `turborepo`, `nextjs`, `shadcn` (via `vercel/vercel-plugin`)

---

## Quick Reference: Critical Path

```text
Monorepo setup → DB schema → GraphQL schema → Codegen
                                    ↓                ↓
                              CDK infra ──→ API resolvers + RBAC
                                    ↓                ↓
                              Auth stack ──→ Web app ──→ Photos
                                                 ↓
                                           Mobile app
```

---

## Phase 0: Foundation — Monorepo, Tooling, CI

**Goal:** Empty repo → green CI pipeline with working TypeScript across all packages.
**Completion criteria:** `pnpm turbo lint type-check test` passes in CI with no code yet to test; CDK synth succeeds for dev environment.

### 0.1 Monorepo Scaffold

**Create in order:**

1. `package.json` (root) — pnpm workspaces, scripts
2. `pnpm-workspace.yaml` — `apps/*`, `packages/*`, `infra`
3. `turbo.json` — pipeline: lint → type-check → test → build (correct dependency order)
4. `tsconfig.base.json` — `strict: true`, `exactOptionalPropertyTypes: true`, `moduleResolution: bundler`
5. `.eslintrc.base.js` — `eslint-plugin-jsx-a11y`, `@typescript-eslint`, accessibility rules
6. `.prettierrc`
7. `.gitignore` — node_modules, .next, dist, .turbo, .env*, cdk.out
8. `.nvmrc` / `.node-version` — pin Node version

**Packages to scaffold (empty, with package.json + tsconfig.json only):**

```text
packages/tokens/
packages/config/
packages/db/
packages/graphql/
packages/auth/
packages/api/
packages/ui-web/
packages/ui-mobile/
packages/test-utils/
apps/web/
apps/mobile/
infra/
```

**Dependencies to decide per package** (each package.json lists only what it needs — no hoisting abuse):

- All packages: `typescript`, `vitest` (devDeps)
- `packages/db`: `drizzle-orm`, `pg`, `drizzle-kit` (devDep)
- `packages/api`: `zod`, `@aws-sdk/client-secrets-manager`
- `packages/graphql`: `graphql`, `@graphql-codegen/cli` (devDep)
- `apps/web`: `next`, `react`, `react-dom`, `tailwindcss`
- `apps/mobile`: `expo`, `react-native`
- `infra`: `aws-cdk-lib`, `constructs`, `cdk-nag`

### 0.2 Environment Config Package

**Files:** `packages/config/src/env.ts`

```text
packages/config/
  src/
    env.ts         # Zod schema for all env vars (DB_URL, COGNITO_*, APPSYNC_*, etc.)
    index.ts
  package.json
  tsconfig.json
```

This package is imported by `packages/api` and `apps/web` — define it early so all downstream packages have typed env validation. Document every variable in a `.env.example` at the repo root.

**Env vars to define now:**

- `DATABASE_URL`, `DATABASE_SECRET_ARN`
- `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID_WEB`, `COGNITO_CLIENT_ID_MOBILE`
- `APPSYNC_ENDPOINT`, `APPSYNC_REGION`
- `S3_PHOTOS_BUCKET`, `S3_THUMBNAILS_BUCKET`
- `CLOUDFRONT_DOMAIN`, `CLOUDFRONT_KEY_PAIR_ID`, `CLOUDFRONT_PRIVATE_KEY_SECRET_ARN`
- `AWS_REGION`

### 0.3 CDK Project Init

**Files:**

```text
infra/
  bin/app.ts              # CDK App entry; instantiates stacks
  lib/stacks/
    auth-stack.ts         # STUB — empty for now
    database-stack.ts     # STUB
    api-stack.ts          # STUB
    storage-stack.ts      # STUB
    lambda-stack.ts       # STUB
    web-stack.ts          # STUB
  lib/config.ts           # Stack config (account IDs, region, env names)
  cdk.json
  package.json
  tsconfig.json
```

**Goal at this point:** `cdk synth` produces valid CloudFormation with no resources yet. This validates CDK setup and dependency versions before you build anything.

Install `cdk-nag` and attach `AwsSolutionsChecks` immediately — easier to fix security findings as you add resources than retroactively.

### 0.4 GitHub Actions CI

**Files:**

```text
.github/workflows/
  ci.yml           # On PR: pnpm install → turbo lint type-check test
  deploy-staging.yml  # On merge to main: cdk deploy dev (disabled until CDK stacks exist)
  deploy-prod.yml     # Manual trigger (disabled until prod stack exists)
```

`ci.yml` tasks:

- Cache: pnpm store + turbo cache
- `pnpm turbo lint`
- `pnpm turbo type-check`
- `pnpm turbo test` (nothing to test yet — vitest exits 0 with no test files)
- `cd infra && npx cdk synth` (validates CDK compiles)
- `npm audit --audit-level=high` on root

**Phase 0 is done when:** CI is green on a PR with the empty scaffold.

---

## Phase 1: Data Layer — DB Schema + Drizzle

**Goal:** Full Drizzle schema with migrations runnable against local PostgreSQL (Docker).
**Completion criteria:** `pnpm db:migrate` applies all migrations to a fresh Docker PostgreSQL; Drizzle Studio can browse the schema; integration test scaffold connects and runs a transaction-wrapped test.

### 1.1 Docker Compose for Local Dev

**File:** `docker-compose.yml` (repo root)

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: wherethehellistit
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: dev
    ports: ["5432:5432"]
    volumes: [pgdata:/var/lib/postgresql/data]
    command: ["postgres", "-c", "shared_preload_libraries=pg_trgm"]
volumes:
  pgdata:
```

Note: `ltree` and `pg_trgm` are bundled with PostgreSQL — no extra install needed, but must be enabled with `CREATE EXTENSION`.

### 1.2 Drizzle Schema

**Files in `packages/db/src/schema/`:**

Create in this order (respects FK dependencies):

1. `users.ts` — no FKs
2. `spaces.ts` — FK → users
3. `space_members.ts` — FK → spaces, users
4. `locations.ts` — FK → spaces, self-referential parent_id
5. `items.ts` — FK → spaces, locations, users; tsvector GENERATED column
6. `photos.ts` — FK → items, users
7. `index.ts` — re-exports all schemas

**Important implementation notes:**

- `items.search_vector`: Drizzle doesn't natively support `GENERATED ALWAYS AS` for tsvector. Use a raw SQL column type: `customType` or a migration SQL string — document this quirk.
- `locations.path`: `ltree` is a PostgreSQL extension type. Use `customType` in Drizzle with raw SQL for the column + index.
- `space_members.role`: Define as a Drizzle `pgEnum` (`owner`, `editor`, `viewer`) — enforced at DB level, not just check constraint.
- All `uuid` PKs: use `uuid('id').primaryKey().defaultRandom()`.

**Schema file:** `packages/db/drizzle.config.ts`

```typescript
// Points to schema/index.ts; outputs migrations to migrations/; connects via DATABASE_URL env
```

### 1.3 First Migration

```text
packages/db/migrations/
  0001_initial_schema.sql   # generated by drizzle-kit generate
```

**Add to migration:** `CREATE EXTENSION IF NOT EXISTS ltree; CREATE EXTENSION IF NOT EXISTS pg_trgm;`

This extension SQL must run before the table definitions that use those types — prefix it in the migration file or create a `0000_extensions.sql`.

**Scripts (root package.json):**

```json
"db:generate": "drizzle-kit generate",
"db:migrate": "drizzle-kit migrate",
"db:studio": "drizzle-kit studio",
"db:seed": "tsx scripts/seed.ts"
```

### 1.4 Integration Test Scaffold

**Files:**

```text
packages/test-utils/
  src/
    db.ts           # Creates test DB connection; wraps each test in a transaction + rollback
    factories/
      user.factory.ts
      space.factory.ts
      item.factory.ts
      photo.factory.ts
      location.factory.ts
  vitest.config.ts  # integration preset — longer timeout, no mocking
```

**Pattern:**

```typescript
// db.ts
export async function withTestDb<T>(fn: (db: DrizzleDb) => Promise<T>): Promise<T> {
  // Begin transaction, run fn, always rollback
}
```

Each integration test calls `withTestDb` — nothing persists between tests. This is the pattern all future integration tests use.

**Phase 1 is done when:** Schema migrations apply cleanly; `withTestDb` test helper works; factories can create test data.

---

## Phase 2: GraphQL Contract — Schema + Codegen

**Goal:** Complete GraphQL schema defined; codegen produces typed hooks for web and mobile; schema is registered in AppSync (via CDK).
**Completion criteria:** `pnpm codegen` produces `packages/graphql/src/generated/types.ts` with no errors; schema validates with `graphql --validate`.

### 2.1 GraphQL Schema

**File:** `packages/graphql/src/schema.graphql`

Define all types from the architecture (Space, Item, Photo, Location, User, Role enum, PhotoUploadIntent). Define all queries, mutations, and subscriptions. Add `@aws_cognito_user_pools` directives on all protected operations.

**Define operations in separate files:**

```text
packages/graphql/src/operations/
  spaces.graphql    # GetSpace, ListSpaces, CreateSpace
  items.graphql     # GetItem, ListItems, CreateItem, UpdateItem, DeleteItem, SearchItems
  photos.graphql    # RequestPhotoUpload, ConfirmPhotoUpload
  members.graphql   # InviteMember, UpdateMemberRole, RemoveMember
  locations.graphql # GetLocation, CreateLocation, MoveLocation
```

### 2.2 Codegen Config

**File:** `packages/graphql/codegen.ts`

Configure `@graphql-codegen/typescript` + `@graphql-codegen/typescript-operations` + `@graphql-codegen/typescript-react-apollo` (or `typescript-urql` depending on client choice — Apollo is standard for AppSync).

Output targets:

- `packages/graphql/src/generated/types.ts` — shared TypeScript types (used by API resolvers too)
- `packages/graphql/src/generated/operations.ts` — typed operation hooks for web/mobile

**Script:** `"codegen": "graphql-codegen --config packages/graphql/codegen.ts"`

Add codegen output to `.gitignore`? Decision: **commit generated files** so CI doesn't need codegen to run — but add a CI check that generated files are up to date (`codegen && git diff --exit-code`).

### 2.3 AppSync Schema Upload (CDK)

**Update:** `infra/lib/stacks/api-stack.ts`

```typescript
const api = new appsync.GraphqlApi(this, 'Api', {
  name: `wherethehellistit-${props.env}`,
  definition: appsync.Definition.fromFile('../../packages/graphql/src/schema.graphql'),
  authorizationConfig: {
    defaultAuthorization: {
      authorizationType: appsync.AuthorizationType.USER_POOL,
      userPoolConfig: { userPool: props.userPool },
    },
  },
  logConfig: { fieldLogLevel: appsync.FieldLogLevel.ALL },
});
```

**Phase 2 is done when:** Codegen runs cleanly; CDK synth includes the AppSync API with the schema.

---

## Phase 3: Infrastructure — CDK Stacks

**Goal:** All CDK stacks deployable to a dev AWS account.
**Completion criteria:** `cdk deploy --all` in dev succeeds; can hit the AppSync endpoint; can sign up via Cognito hosted UI; S3 buckets exist.

> These stacks can be built mostly in parallel once the schema is done.

### 3.1 AuthStack

**File:** `infra/lib/stacks/auth-stack.ts`

Resources:

- `cognito.UserPool` — self-sign-up disabled (invite only for MVP), email verification, password policy
- `cognito.UserPoolIdentityProviderGoogle` — Google OIDC (client ID/secret from Secrets Manager)
- `cognito.UserPoolIdentityProviderApple` — Apple OIDC
- `cognito.UserPoolClient` (web) — implicit/auth code flow, Cognito hosted UI
- `cognito.UserPoolClient` (mobile) — public client, PKCE
- `cognito.UserPoolDomain` — hosted UI domain
- `cognito.CfnIdentityPool` — issues temporary AWS credentials for S3 direct upload
- IAM roles: authenticated role with `s3:PutObject` scoped to `uploads/${cognito-identity.amazonaws.com:sub}/*`
- Post-confirmation Lambda trigger — stub for now (Phase 4 wires real DB insert)

**Outputs:** UserPool ID, web/mobile client IDs, Identity Pool ID — consumed by ApiStack and web/mobile apps.

### 3.2 DatabaseStack

**File:** `infra/lib/stacks/database-stack.ts`

Resources:

- `ec2.Vpc` — 2 AZs; private subnets for DB/Lambda; no NAT gateway in dev (cost); NAT in prod
- `rds.DatabaseCluster` (Aurora Serverless v2, PostgreSQL 16)
  - `serverlessV2MinCapacity: 0.5`, `serverlessV2MaxCapacity: 16`
  - `enableDataApi: false` (using direct connection via RDS Proxy)
  - Auto-pause: `scalingConfiguration` with `SecondsUntilAutoPause: 300` in dev
- `secretsmanager.Secret` — DB credentials (auto-generated, auto-rotated)
- `rds.DatabaseProxy` — IAM auth enabled; connection pooling for Lambda
- Security groups:
  - `dbSg` — inbound 5432 from `proxySg` only
  - `proxySg` — inbound 5432 from `lambdaSg` only
  - `lambdaSg` — no inbound; outbound to `proxySg:5432` + Secrets Manager endpoint

**Outputs:** Proxy endpoint, secret ARN, VPC, security group IDs — consumed by ApiStack and LambdaStack.

### 3.3 StorageStack

**File:** `infra/lib/stacks/storage-stack.ts`

Resources:

- `s3.Bucket` (photos) — block all public; CORS `[PUT]` from app origins; lifecycle: IA after 90d, Glacier after 365d
- `s3.Bucket` (thumbnails) — block all public; no CORS needed
- `cloudfront.Distribution` — two origins (photos + thumbnails buckets)
  - `cloudfront.TrustedSigners` / key group for signed URLs
  - Viewer protocol: HTTPS only
- `cloudfront.OriginAccessControl` — S3 buckets inaccessible except via CloudFront
- `secretsmanager.Secret` — CloudFront private key (PEM); key pair ID

**Outputs:** CloudFront domain, key pair ID, private key secret ARN — consumed by ApiStack.

### 3.4 LambdaStack (Photo Processor)

**File:** `infra/lib/stacks/lambda-stack.ts`

Resources:

- `lambda.Function` (photo-processor)
  - Runtime: Node.js 22.x
  - Handler: `packages/api/src/lambdas/photo-processor/index.handler`
  - Trigger: S3 event on photos bucket (PUT)
  - Layers or bundled: `sharp` (must be compiled for Lambda Linux — use `sharp` npm with `--platform=linux --arch=x64`)
  - Env vars: thumbnails bucket name, DB proxy endpoint, secret ARN
  - VPC: same VPC/security group as resolver Lambda

### 3.5 ApiStack

**File:** `infra/lib/stacks/api-stack.ts`

Resources:

- `appsync.GraphqlApi` (with schema from Phase 2)
- `lambda.Function` (appsync-resolver) — VPC-enabled; bundled with esbuild
  - All resolver handlers live here; AppSync routes to the same Lambda
- AppSync data source pointing to resolver Lambda
- Pipeline resolvers: for each mutation, wire `checkRbac` fn → `businessLogic` fn
- Query resolvers: direct Lambda invocation
- Subscription resolvers: AppSync managed WebSockets (no extra work needed)
- `logs.LogGroup` — API access logs; Lambda execution logs

### 3.6 WebStack

**File:** `infra/lib/stacks/web-stack.ts`

Resources:

- `@opennextjs/aws` adapter output → Lambda Function URL (SSR) + S3 (static assets)
- `cloudfront.Distribution` — SSR Lambda URL + static S3 origin
- `wafv2.CfnWebACL` — rate limit (100 req/min/IP) + `AWSManagedRulesCommonRuleSet`
- Associate WAF with CloudFront

**Phase 3 is done when:** `cdk deploy --all` succeeds in dev; Cognito hosted UI is reachable; AppSync Console can execute an introspection query.

---

## Phase 4: API Core — Resolvers, RBAC, Business Logic

**Goal:** Full CRUD for spaces and items via AppSync; all mutations RBAC-protected; integration tests green.
**Completion criteria:** RBAC matrix tests pass (every mutation × every role); items CRUD works end-to-end through AppSync console.

### 4.1 RBAC Middleware

**File:** `packages/api/src/middleware/rbac.ts`

```typescript
export const ROLE_PERMISSIONS = { owner: [...], editor: [...], viewer: [...] };

export async function requirePermission(
  db: DrizzleDb,
  cognitoSub: string,
  spaceId: string,
  permission: Permission
): Promise<SpaceMember>
// Throws GraphQLError('FORBIDDEN') if not authorized
```

**Tests (write FIRST — TDD):**

```text
packages/api/src/middleware/__tests__/rbac.test.ts
```

Test matrix: 4 roles (owner/editor/viewer/non-member) × 7 permissions = 28 unit tests minimum. Use `withTestDb` from `packages/test-utils`.

### 4.2 Input Validation Middleware

**File:** `packages/api/src/middleware/validate.ts`

Zod schemas for every mutation input. Validated before DB call, after auth check (fail fast on auth, then validate).

```typescript
export const CreateItemSchema = z.object({ ... });
export const UpdateItemSchema = z.object({ ... });
// ... one schema per mutation input type
```

### 4.3 Lambda Entry Point + AppSync Event Types

**File:** `packages/api/src/lambda.ts`

AppSync invokes a single Lambda with a structured event. Wire a router:

```typescript
export const handler = async (event: AppSyncResolverEvent<any>) => {
  const resolver = resolverMap[`${event.info.parentTypeName}.${event.info.fieldName}`];
  return resolver(event);
};
```

### 4.4 Resolvers

**Create in order (each depends on RBAC + validate being done):**

```text
packages/api/src/resolvers/
  spaces/
    createSpace.ts
    getSpace.ts
    listSpaces.ts
    updateSpace.ts
    deleteSpace.ts
  items/
    createItem.ts
    getItem.ts
    listItems.ts
    updateItem.ts
    deleteItem.ts
    searchItems.ts     # uses tsvector full-text search
  members/
    inviteMember.ts
    updateMemberRole.ts
    removeMember.ts
  locations/
    createLocation.ts
    getLocation.ts
    moveLocation.ts    # updates ltree path for subtree
  photos/
    requestPhotoUpload.ts  # generates pre-signed S3 PUT URL
    confirmPhotoUpload.ts  # marks photo as processing
```

### 4.5 Post-Confirmation Lambda (Cognito Trigger)

**File:** `packages/api/src/lambdas/cognito-post-confirmation/index.ts`

Inserts a `users` row from the Cognito event attributes (`sub`, `email`, `name`). Wire to `AuthStack` trigger.

### 4.6 Integration Tests for API

**Files:**

```text
packages/api/src/resolvers/**/__tests__/
  createItem.integration.test.ts
  updateItem.integration.test.ts
  deleteItem.integration.test.ts
  searchItems.integration.test.ts
  inviteMember.integration.test.ts
  # ... etc.
```

Use `withTestDb` — no mocking, real DB, transaction-wrapped. Each test: create test data via factories, call resolver function directly (not through AppSync), assert DB state.

**Phase 4 is done when:** All resolver integration tests pass; RBAC matrix is 100% covered; `cdk deploy` updates AppSync with real resolvers.

---

## Phase 5: Web App — Next.js

**Goal:** Working web app: sign in, list/create/search items, view item detail.
**Completion criteria:** Playwright E2E tests for happy path (sign in → create item → search → find it) pass in CI.

### 5.1 Next.js App Scaffold

```text
apps/web/
  src/
    app/
      layout.tsx              # Root layout — providers, fonts
      (auth)/
        login/page.tsx        # Sign in with Google/Apple buttons
        callback/page.tsx     # OAuth callback handler
      (dashboard)/
        layout.tsx            # Auth guard; sidebar nav
        items/
          page.tsx            # Item list with search
          [id]/page.tsx       # Item detail
          new/page.tsx        # Create item form
        spaces/
          page.tsx
          [id]/page.tsx
        settings/
          page.tsx
    components/
      ui/                     # shadcn/ui components (copy-paste)
      item-card.tsx
      item-form.tsx
      search-bar.tsx
      location-picker.tsx
      photo-gallery.tsx
      member-list.tsx
    lib/
      appsync-client.ts       # Apollo Client configured for AppSync + Cognito auth
      auth.ts                 # httpOnly cookie token storage; middleware
      photo-upload.ts         # S3 direct upload using pre-signed URL
    middleware.ts             # Next.js middleware — redirects unauthenticated users
  tailwind.config.ts
  next.config.ts
```

### 5.2 Design Tokens Integration

**File:** `apps/web/tailwind.config.ts`

Import `packages/tokens/global.css` via Tailwind v4's `@import` and `@theme`. Violet theme CSS variables become Tailwind utility classes (`bg-primary`, `text-foreground`, etc.).

**File:** `packages/tokens/global.css` — create the full Violet theme CSS (as defined in CLAUDE.md ADR-005).

### 5.3 Auth Integration

**File:** `apps/web/src/lib/auth.ts`

- Redirect to Cognito Hosted UI OAuth endpoint
- Handle callback: exchange code for tokens; store in httpOnly cookies via Next.js API route
- `middleware.ts`: check cookie on every protected route; redirect to `/login` if missing/expired
- Token refresh: check expiry on each request; refresh silently if within 5 minutes of expiry

### 5.4 AppSync Client

**File:** `apps/web/src/lib/appsync-client.ts`

Apollo Client with:

- HTTP link to AppSync endpoint
- Auth link: reads access token from cookie (server) or memory (client)
- WebSocket link for subscriptions (AppSync real-time endpoint)
- Error link: handle FORBIDDEN errors (redirect to login/403 page)

### 5.5 shadcn/ui Components

Copy-paste from shadcn/ui registry (do not npm install shadcn components):

- Button, Input, Label, Textarea — forms
- Dialog, Sheet — modals
- DropdownMenu — actions
- Badge — tags
- Card — item cards
- Skeleton — loading states
- Toast — success/error notifications
- Command + Popover — search with tags filter

### 5.6 Accessibility Implementation

Per component, add:

- Semantic HTML (no `div onClick`)
- `aria-label`, `aria-describedby`, `aria-live` where needed
- `jest-axe` test: `expect(await axe(container)).toHaveNoViolations()`
- Skip-to-content link in root layout
- Visible `:focus-visible` ring on all interactive elements

### 5.7 Playwright E2E

**File:** `apps/web/e2e/`

```text
e2e/
  auth.spec.ts          # Sign in, sign out
  items.spec.ts         # Create, view, edit, delete item
  search.spec.ts        # Full-text search, tag filter
  spaces.spec.ts        # Create space, invite member
  a11y.spec.ts          # axe-core scan of each page
```

**Phase 5 is done when:** Happy-path Playwright tests pass; sign-in flow works against real Cognito dev; items CRUD works against real AppSync dev.

---

## Phase 6: Photo Upload

**Goal:** Upload photos to items; see thumbnails; CloudFront signed URLs protecting all images.
**Completion criteria:** Photo upload flow works end-to-end (mobile camera → S3 → Lambda processor → thumbnail → item detail shows WebP thumbnail via signed URL).

### 6.1 Photo Service

**File:** `packages/api/src/services/photo.service.ts`

```typescript
// requestPhotoUpload: generate pre-signed S3 PUT URL; insert Photo record (status: 'pending')
// confirmPhotoUpload: mark Photo status as 'processing'
// generateSignedUrl(s3Key): CloudFront signed URL (1hr expiry); read key from Secrets Manager
// generateUploadUrl(mimeType, sizeBytes): pre-signed S3 PUT URL (15min)
```

**Important:** CloudFront private key lives in Secrets Manager. Fetch once on Lambda warm start; cache in module scope (don't fetch per request).

### 6.2 Photo Processor Lambda

**File:** `packages/api/src/lambdas/photo-processor/index.ts`

Triggered by S3 PUT on photos bucket:

1. Read original from S3
2. Use `sharp`: generate thumbnail (400×400 WebP, cover crop) + medium (1200px wide WebP)
3. Write both to thumbnails bucket
4. Update `photos` record: set `thumbnail_key`, `medium_key`, `upload_status = 'ready'`

**Test:** Integration test that uploads a real JPEG to local MinIO (Docker), triggers handler, asserts DB state + thumbnail file exists.

### 6.3 Web Photo Upload UI

**Files:**

- `apps/web/src/lib/photo-upload.ts` — client-side: call `requestPhotoUpload` mutation → PUT to pre-signed URL → call `confirmPhotoUpload` mutation
- `apps/web/src/components/photo-gallery.tsx` — grid of thumbnails; drag-to-reorder sort_order; delete button (owner/editor only)
- `apps/web/src/components/photo-uploader.tsx` — file input with drag-and-drop; progress bar; error state

**Phase 6 is done when:** Full photo upload flow works in dev; thumbnails appear in item detail; signed URLs expire correctly (test with a 1-minute expiry in dev).

---

## Phase 7: Mobile App — Expo

**Goal:** Feature-complete mobile app (parity with web for MVP features).
**Completion criteria:** Maestro E2E tests pass for happy path; TestFlight build submitted.

### 7.1 Expo Project

```text
apps/mobile/
  src/
    app/                    # Expo Router v3 (file-based)
      _layout.tsx           # Root — auth provider, navigation
      (auth)/
        index.tsx           # Sign in screen
      (tabs)/
        _layout.tsx         # Tab bar: Items, Spaces, Settings
        index.tsx           # Item list
        spaces.tsx
        settings.tsx
      items/
        [id].tsx            # Item detail
        new.tsx             # Create item
      spaces/
        [id].tsx
    components/             # React Native Reusables (copy-paste)
      ui/
    screens/                # Complex screen components
    navigation/
    lib/
      appsync-client.ts     # Apollo Client for AppSync
      auth.ts               # expo-auth-session + expo-secure-store
      photo-upload.ts       # expo-camera + expo-image-picker + S3 upload
```

### 7.2 NativeWind + Design Tokens

**File:** `apps/mobile/global.css` — imports `packages/tokens/global.css`

Configure NativeWind v4 in `babel.config.js` and `metro.config.js`. Map CSS variables to NativeWind's `vars()` utility. Violet theme applied to mobile automatically via shared tokens.

### 7.3 Auth on Mobile

**File:** `apps/mobile/src/lib/auth.ts`

- `expo-auth-session`: launches Cognito Hosted UI in system browser (PKCE flow)
- `expo-secure-store`: stores tokens in device keychain (not AsyncStorage)
- Token refresh: background task checks expiry; silently refreshes

### 7.4 Camera + Photo Upload

**File:** `apps/mobile/src/lib/photo-upload.ts`

```typescript
// capturePhoto(): expo-camera or expo-image-picker
// uploadPhoto(itemId, uri): requestPhotoUpload mutation → fetch PUT to presigned URL → confirmPhotoUpload
```

Permission handling: request camera + photo library permissions; show appropriate error if denied.

### 7.5 Accessibility on Mobile

Per screen:

- `accessibilityLabel` on every touchable
- `accessibilityRole` set appropriately
- Minimum 44×44 touch targets (check with Accessibility Inspector)
- `accessible + accessibilityViewIsModal` on modals
- Manual VoiceOver/TalkBack test session per screen

### 7.6 Maestro E2E

```text
apps/mobile/e2e/
  auth.yaml
  items.yaml
  search.yaml
  photos.yaml
```

**Phase 7 is done when:** Maestro happy-path tests pass on iOS simulator; TestFlight build is live.

---

## Phase 8: Location Hierarchy

**Goal:** Create/navigate location hierarchy; assign items to locations.
**Completion criteria:** Can create nested locations (House → Garage → Top Shelf); move an item to a location; filter items by location (including sub-locations via ltree subtree query).

### 8.1 Location Resolvers

**Files:** `packages/api/src/resolvers/locations/`

- `createLocation.ts` — inserts location; computes `ltree` path from parent
- `getLocation.ts` — returns location with children
- `moveLocation.ts` — updates path for location AND all descendants (ltree `subpath` + `text2ltree`)
- `getItemsByLocation.ts` — uses `path <@ parent_path` ltree operator to include subtree

### 8.2 Location UI (Web)

- `apps/web/src/components/location-picker.tsx` — tree-view dropdown for assigning items to locations
- `apps/web/src/app/(dashboard)/spaces/[id]/locations/` — location management page

### 8.3 Location UI (Mobile)

- Location picker bottom sheet
- Location tree navigation screen

**Phase 8 is done when:** Full location hierarchy CRUD works; subtree item queries return correct results; ltree integration test covers `moveLocation` subtree update.

---

## Phase 9: Member Management + Invitations

**Goal:** Space owners can invite users, assign roles, remove members.
**Completion criteria:** Invite flow works (owner sends invite → invitee signs up/signs in → access granted); role changes are immediate; removals revoke access instantly.

### 9.1 Invitation Flow

For MVP: invitation by email. Options:

- **Simple:** Add member by email if they already have an account. (Recommended for MVP.)
- **Full:** Send invite email (SES); create pending invitation record; activate on sign-up.

Decision: Start with simple (existing users only). Add SES invite flow in post-MVP.

### 9.2 Member Resolvers

Already scaffolded in Phase 4. Wire and test:

- `inviteMember` — checks owner permission; looks up user by email; inserts space_members row
- `updateMemberRole` — owner can change editor↔viewer; cannot demote self
- `removeMember` — owner can remove anyone except self (must transfer ownership first)

### 9.3 Settings UI

- `apps/web/src/app/(dashboard)/settings/page.tsx` — member list, invite form, role dropdowns
- Mobile: `settings.tsx` screen

**Phase 9 is done when:** Owner can invite/manage members; RBAC is enforced in all post-invite operations.

---

## Phase 10: Search + Polish

**Goal:** Full-text search with tag filters; accessible UI polished to WCAG 2.1 AA.
**Completion criteria:** OWASP ZAP baseline scan passes; full axe-core audit passes; search returns relevant results.

### 10.1 Search Resolver

**File:** `packages/api/src/resolvers/items/searchItems.ts`

```sql
SELECT * FROM items
WHERE space_id = $spaceId
  AND ($query IS NULL OR search_vector @@ plainto_tsquery('english', $query))
  AND ($locationId IS NULL OR location_id IN (
    SELECT id FROM locations WHERE path <@ (SELECT path FROM locations WHERE id = $locationId)
  ))
  AND ($tags IS NULL OR tags @> $tags)
ORDER BY
  CASE WHEN $query IS NOT NULL THEN ts_rank(search_vector, plainto_tsquery('english', $query)) END DESC,
  updated_at DESC
LIMIT $limit OFFSET $offset;
```

### 10.2 Search UI

- `apps/web/src/components/search-bar.tsx` — debounced input (300ms); `aria-live="polite"` result count
- Tag filter: multi-select combobox (Command + Popover); filters combined with text search
- Location filter: location picker (from Phase 8); filters combined

### 10.3 Full Accessibility Audit

- Run `jest-axe` on every component; fix violations
- Playwright axe-core scan of every page
- Manual keyboard navigation test (tab order, focus trap in modals)
- Color contrast audit (use browser DevTools)
- VoiceOver (iOS) + TalkBack (Android) manual checklist

### 10.4 Performance Baseline

- Lighthouse CI in GitHub Actions (score ≥ 90 on performance, accessibility, best practices)
- Lambda cold start measurement; add provisioned concurrency if p95 > 1s

**Phase 10 is done when:** OWASP ZAP passes; axe passes; Lighthouse ≥ 90; search is fast (< 200ms p95 on dev).

---

## Phase 11: Production Hardening

**Goal:** Production CDK environment; monitoring; security review.
**Completion criteria:** Production deploy succeeds; CloudWatch alarms are set; security checklist complete.

### 11.1 Production CDK Environment

- Add `prod` environment to `infra/lib/config.ts`
- Aurora: `serverlessV2MaxCapacity: 128`; no auto-pause; Multi-AZ
- NAT Gateway (needed for Lambda VPC egress in prod)
- Enable RDS Proxy IAM auth
- `cdk-nag` suppressions documented with justification

### 11.2 Monitoring

- CloudWatch dashboards: AppSync error rate, Lambda duration/errors, RDS ACU usage, CloudFront cache hit rate
- CloudWatch Alarms: AppSync p99 > 2s, Lambda error rate > 1%, RDS ACU > 80%
- SNS topic → email for alarms

### 11.3 Security Review

- `npm audit` — 0 high/critical
- OWASP ZAP scan against prod URL
- Rotate all secrets in Secrets Manager
- Verify CloudFront signed URL expiry is enforced
- Verify S3 bucket public access is blocked
- Review IAM roles — least privilege

### 11.4 Runbook

**File:** `runbook.md`

- How to deploy (staging, prod)
- How to run migrations in prod
- How to rotate CloudFront key pair
- How to debug a Lambda resolver
- How to check RDS slow query logs

**Phase 11 is done when:** Production is live; runbook is complete; all alarms are confirmed working (test by triggering them).

---

## Critical Path Summary

The absolute blockers, in order:

1. **Monorepo setup** (everything else depends on this)
2. **DB schema** (resolvers can't be written without typed schema)
3. **GraphQL schema** (codegen + AppSync setup)
4. **CDK: AuthStack + DatabaseStack** (needed to run anything end-to-end)
5. **RBAC middleware** (every mutation is blocked without this)
6. **Item/Space resolvers** (core feature)

After step 6, web, mobile, and photo pipeline can proceed in parallel.

---

## Parallel Work Opportunities

Once Phase 4 is complete, these tracks are **independent and can overlap:**

| Track A | Track B | Track C |
| --- | --- | --- |
| Web app (Phase 5) | Mobile app (Phase 7) | Photo processor Lambda (Phase 6.2) |
| Web photo UI (Phase 6.3) | Mobile camera (Phase 7.4) | CloudFront signed URL logic (Phase 6.1) |
| Web location UI (Phase 8.2) | Mobile location UI (Phase 8.3) | Location resolvers (Phase 8.1) |

CDK stacks (Phase 3) can also proceed in parallel with GraphQL schema work (Phase 2) once the schema type definitions are stable.

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| `ltree` custom type in Drizzle is awkward | High | Medium | Prototype Drizzle `customType` for ltree early in Phase 1; fallback is raw SQL migration with typed access via separate query helper |
| `tsvector GENERATED` column in Drizzle | High | Medium | Use raw SQL in migration file; Drizzle select can still query the column; document workaround clearly |
| Sharp on Lambda (must be Linux binary) | Medium | High | Use `sharp` npm with `--platform=linux --arch=x64` at install time; test locally with Docker Lambda image before deploy |
| AppSync JS resolver sandbox limits | Medium | High | Resolver functions: keep thin (auth routing only); all logic in Lambda data source — never put complex business logic in AppSync JS resolvers |
| Aurora cold start after auto-pause | High (dev) | Low | Expected in dev; document the 30-60s first-request delay; prod has no auto-pause |
| Cognito Hosted UI OAuth callback in Expo Go | Medium | High | Use `expo-auth-session` with proper redirect URI; test with Expo Go before bare workflow; document known limitations |
| CloudFront signed URL key rotation | Low | High | Automate rotation in Secrets Manager (90-day); rotation Lambda updates the key pair; integration test covers URL expiry |
| NAT Gateway cost in dev | Medium | Medium | Use VPC Endpoints for Secrets Manager + S3 in dev (avoids NAT); add NAT only for prod |
| Solo developer: no PR review | N/A | Medium | Rely on CI gates (types, tests, lint, audit, axe); ADRs document decisions; runbook covers operations |

---

## MVP vs. Full Feature Scope

### MVP (Phases 0–7 + basic search from Phase 10)

- Sign in (Google + Apple)
- Create spaces, add items with photos
- Assign items to locations (flat list — no hierarchy yet)
- Full-text search
- Web + mobile apps
- Owner/editor/viewer roles
- Photo upload + thumbnails

### Post-MVP (defer these)

- Location hierarchy (ltree, Phase 8) — flat locations work for MVP
- Member invitations via email (SES flow, Phase 9)
- Offline CRUD (Amplify DataStore — noted in ADR-001)
- Drag-to-reorder photo sort order
- Shareable item links (public, no auth required)
- Export/import (CSV or JSON)
- Notification subscriptions (AppSync real-time already enabled)

---

## Definition of Done (Per Feature)

A feature is complete when:

- [ ] Unit tests written and passing (TDD: write tests first)
- [ ] Integration tests written and passing (real DB, no mocks)
- [ ] RBAC matrix tests cover all roles for any mutation
- [ ] `jest-axe` passes for any new UI component
- [ ] TypeScript compiles with `strict: true` — no `any` escapes
- [ ] `pnpm turbo lint type-check test` passes locally
- [ ] CI is green on the PR
- [ ] `tutorial.md` is updated with what was done and why

---

## File Creation Order — Absolute Minimum to First End-to-End Test

If you want to reach the fastest possible "it actually works" moment:

1. `pnpm-workspace.yaml` + root `package.json` + `turbo.json`
2. `tsconfig.base.json`
3. `docker-compose.yml`
4. `packages/db/` — schema + migration
5. `packages/graphql/src/schema.graphql`
6. `packages/config/src/env.ts`
7. `packages/api/src/middleware/rbac.ts` + tests
8. `packages/api/src/resolvers/spaces/createSpace.ts` + `listSpaces.ts`
9. `packages/api/src/resolvers/items/createItem.ts` + `listItems.ts`
10. `infra/` — AuthStack + DatabaseStack (deploy to dev)
11. `infra/` — ApiStack (deploy resolver Lambda + AppSync)
12. AppSync Console → run `createSpace` mutation → see it in DB

At step 12, the system is working end-to-end. Everything after that is building on a proven foundation.
