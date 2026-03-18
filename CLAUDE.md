# Where the Hell Is It? — Architecture Reference

> This is the living architecture document for this project. Update it as decisions evolve.

---

## Working Rules

- **Git is handled by the user.** Do not run any git commands (commit, push, branch, etc.).

**At the end of every task, Claude MUST:**

1. Add an entry to the README changelog (newest at top — this also serves as the git commit message)
2. Check for problems in the work just done
3. Update CLAUDE.md, README.md, ARCHITECTURE.md, and tutorial.md as needed
4. Update memory files if anything relevant changed

---

## Context

Greenfield cross-platform application for tracking physical items and their locations, with photo support. Target users: small teams and families (2–20 users) with role-based access (owner/editor/viewer). The architecture must prioritize accessibility (WCAG 2.1 AA), security, and TDD. Built by a solo TypeScript developer on AWS. Online-only for MVP; full offline CRUD is a noted future enhancement.

**Decisions locked in via requirements gathering:**

- Mobile: React Native + Expo (cross-platform)
- Cloud: AWS
- API style: GraphQL
- Backend compute: Lambda (serverless)
- Auth: AWS Cognito + Google + Apple social login
- CI/CD: GitHub Actions + AWS CDK
- Data scale: Design for growth (unknown)

---

## Architecture Decision Records (ADRs)

### ADR-001: GraphQL Layer — ⭐ AWS AppSync (not custom Apollo Server)

**Apollo Server on Lambda:**

- Full TypeScript control; cold start issues in VPC; subscriptions need separate WebSocket infra; auth is custom work

**AWS AppSync (managed GraphQL):**

- Zero-cost Cognito integration (automatic JWT validation)
- Real-time subscriptions via WebSocket out of the box
- Future offline sync path via Amplify DataStore (maps directly to noted future requirement)
- JavaScript resolvers (not VTL) keep TypeScript familiarity
- Pipeline resolvers: `[auth-check fn] → [business logic fn]` per mutation

**Decision: AppSync** — saves weeks of infrastructure work; offline path is paved; Cognito wired automatically.

---

### ADR-002: Database — ⭐ Aurora Serverless v2 (PostgreSQL) + RDS Proxy

**DynamoDB:** Infinite scale, AppSync direct resolvers — but complex RBAC JOINs require Lambda; single-table design has high upfront risk for solo developer.

**Aurora Serverless v2 (PostgreSQL 16):**

- Auto-scales 0.5–128 ACU; pause-able in dev (mitigates cost)
- Full SQL JOINs for role-based filtering across users/items/spaces
- `ltree` extension for location hierarchy; `pg_trgm` + `tsvector` for search
- Drizzle ORM connects via standard `pg` driver through RDS Proxy

**Decision: Aurora Serverless v2** — relational model dramatically reduces design risk; scales as needed.

> ⚠️ **Cost note:** Min 0.5 ACU ≈ $0.12/hr. Enable auto-pause on dev/staging. For dev, evaluate Neon (serverless PostgreSQL, true scale-to-zero) as a drop-in alternative.

---

### ADR-003: ORM — ⭐ Drizzle ORM (not Prisma)

**Prisma:** Great DX but ~30MB binary engine increases Lambda cold starts; Prisma Accelerate needed for connection pooling.

**Drizzle ORM v0.36+:**

- Zero binary engine — Lambda bundle stays lean
- SQL-like TypeScript syntax, easy to debug in Lambda logs
- Works natively with `pg` driver; RDS Proxy connection pooling just works

**Decision: Drizzle** — Lambda cold start performance and RDS Proxy compatibility win.

---

### ADR-004: Web Framework — ⭐ Next.js 15 (App Router)

**React SPA (Vite):** Simpler; easy S3+CloudFront static hosting.

**Next.js 15 App Router:**

- `next/image` provides automatic WebP + responsive images (critical for photo-heavy app)
- Server Components reduce client JS bundle (accessibility: faster semantic HTML)
- Future "shareable item links" benefit from SSR
- Hosted via OpenNext (`@opennextjs/aws`) — static assets to S3+CloudFront, dynamic routes to Lambda Function URL

**Decision: Next.js 15** — photo optimization and future SSR justify the complexity.

---

### ADR-005: UI Components — ⭐ React Native Reusables (mobile) + shadcn/ui (web), shared design tokens

**Mobile:** React Native Reusables + NativeWind v4

- Copy-paste model (owned code, no version lock-in) — same philosophy as shadcn/ui
- `rn-primitives` (Radix UI port) — Radix-equivalent accessible primitives on mobile
- NativeWind v4 — Tailwind classes in React Native; uses same CSS variable naming as shadcn/ui

**Web:** shadcn/ui + Tailwind v4 — styled to **mirror the mobile app's visual design** (not default shadcn neutral theme)

**Shared design tokens (`packages/tokens/global.css`) — Violet theme:**

- Single `global.css` defines all CSS variables (colors, radius, spacing, typography scale)
- Web consumes via Tailwind v4's `@theme` — no config duplication
- Mobile consumes via NativeWind v4's `vars()` utility
- One color palette decision propagates to both platforms automatically

```css
/* packages/tokens/global.css — single source of truth — Violet theme */
:root {
  --background: 0 0% 100%;
  --foreground: 224 71.4% 4.1%;
  --card: 0 0% 100%;
  --card-foreground: 224 71.4% 4.1%;
  --popover: 0 0% 100%;
  --popover-foreground: 224 71.4% 4.1%;
  --primary: 262.1 83.3% 57.8%;
  --primary-foreground: 210 20% 98%;
  --secondary: 220 14.3% 95.9%;
  --secondary-foreground: 220.9 39.3% 11%;
  --muted: 220 14.3% 95.9%;
  --muted-foreground: 220 8.9% 46.1%;
  --accent: 220 14.3% 95.9%;
  --accent-foreground: 220.9 39.3% 11%;
  --destructive: 0 72.2% 50.6%;
  --destructive-foreground: 210 20% 98%;
  --border: 220 13% 91%;
  --input: 220 13% 91%;
  --ring: 262.1 83.3% 57.8%;
  --radius: 0.5rem;
}
.dark {
  --background: 224 71.4% 4.1%;
  --foreground: 210 20% 98%;
  --card: 224 71.4% 4.1%;
  --card-foreground: 210 20% 98%;
  --popover: 224 71.4% 4.1%;
  --popover-foreground: 210 20% 98%;
  --primary: 263.4 70% 50.4%;
  --primary-foreground: 210 20% 98%;
  --secondary: 215 27.9% 16.9%;
  --secondary-foreground: 210 20% 98%;
  --muted: 215 27.9% 16.9%;
  --muted-foreground: 217.9 10.6% 64.9%;
  --accent: 215 27.9% 16.9%;
  --accent-foreground: 210 20% 98%;
  --destructive: 0 62.8% 30.6%;
  --destructive-foreground: 210 20% 98%;
  --border: 215 27.9% 16.9%;
  --input: 215 27.9% 16.9%;
  --ring: 263.4 70% 50.4%;
}
```

**No universal component library (not Tamagui)** — component implementations differ per platform; tokens are shared, not component trees.

---

### ADR-006: Mobile E2E — ⭐ Maestro (not Detox)

**Detox:** Mature but requires Expo bare workflow or custom dev client (breaks managed workflow).

**Maestro:** Works with Expo Go; YAML-based DSL sufficient for MVP; no extra build required for test authoring.

**Decision: Maestro** — Expo managed workflow compatibility is decisive.

---

## Project Directory Structure

```text
where-the-hell-is-it/
├── .github/workflows/
│   ├── ci.yml                  # lint, type-check, test on every PR
│   ├── deploy-staging.yml      # CDK deploy to staging on merge to main
│   └── deploy-prod.yml         # CDK deploy to prod (manual trigger)
├── turbo.json                  # Turborepo pipeline config
├── tsconfig.base.json          # strict: true, exactOptionalPropertyTypes: true
├── .eslintrc.base.js           # eslint-plugin-jsx-a11y included
│
├── apps/
│   ├── web/                    # Next.js 15
│   │   └── src/
│   │       ├── app/
│   │       │   ├── (auth)/login/
│   │       │   └── (dashboard)/
│   │       │       ├── items/[id]/
│   │       │       ├── spaces/
│   │       │       └── settings/
│   │       ├── components/ui/  # shadcn/ui (owned code)
│   │       └── lib/
│   │           ├── appsync-client.ts
│   │           ├── auth.ts         # httpOnly cookie token storage
│   │           └── photo-upload.ts
│   │
│   └── mobile/                 # Expo SDK 52+ managed workflow
│       └── src/
│           ├── screens/        # ItemList, ItemDetail, AddItem, Spaces
│           ├── navigation/     # Expo Router v3 (file-based)
│           └── lib/
│               ├── appsync-client.ts
│               ├── auth.ts     # expo-auth-session + expo-secure-store
│               └── photo-upload.ts
│
├── packages/
│   ├── graphql/                # schema.graphql + graphql-codegen output
│   │   ├── src/schema.graphql  # ← SOURCE OF TRUTH
│   │   ├── src/generated/      # types.ts, hooks.ts (do not edit)
│   │   └── src/operations/     # items.graphql, spaces.graphql, users.graphql
│   │
│   ├── db/                     # Drizzle schema + migrations
│   │   ├── src/schema/
│   │   │   ├── users.ts
│   │   │   ├── spaces.ts
│   │   │   ├── items.ts        # includes tsvector GENERATED column
│   │   │   ├── locations.ts    # includes ltree path column
│   │   │   ├── photos.ts
│   │   │   └── space_members.ts
│   │   ├── migrations/
│   │   └── drizzle.config.ts
│   │
│   ├── api/                    # AppSync resolver Lambda + business logic
│   │   └── src/
│   │       ├── resolvers/items/, resolvers/spaces/, resolvers/photos/
│   │       ├── middleware/rbac.ts     # ← SECURITY CRITICAL
│   │       ├── middleware/validate.ts # Zod input validation
│   │       └── services/
│   │           ├── photo.service.ts  # pre-signed URLs + CloudFront signed URLs
│   │           └── search.service.ts
│   │
│   ├── auth/                   # Cognito JWT utilities, role guards
│   ├── tokens/                 # global.css — Violet theme tokens (shared)
│   ├── ui-web/                 # shadcn/ui components (web)
│   ├── ui-mobile/              # React Native Reusables components (mobile)
│   ├── config/                 # Zod env schema validation
│   └── test-utils/             # MSW handlers, test factories (fishery), render helpers
│
├── infra/                      # AWS CDK
│   └── lib/stacks/
│       ├── auth-stack.ts       # Cognito User Pool + Google/Apple providers
│       ├── database-stack.ts   # Aurora Serverless v2 + RDS Proxy + VPC
│       ├── api-stack.ts        # AppSync API + resolver Lambda    ← CORE
│       ├── storage-stack.ts    # S3 + CloudFront (photos CDN)
│       ├── lambda-stack.ts     # Photo processor (Sharp)
│       └── web-stack.ts        # Next.js via OpenNext (CloudFront + Lambda)
│
└── scripts/
    ├── migrate.ts
    ├── codegen.ts
    └── seed.ts
```

---

## AWS Infrastructure (CDK Stacks)

### AuthStack

- `Cognito::UserPool` — email/password + Google OIDC + Apple OIDC
- `Cognito::UserPoolClient` — one per app surface (web, mobile)
- `Cognito::UserPoolDomain` — hosted UI OAuth flow
- `Cognito::IdentityPool` — issues temporary AWS creds for direct S3 upload
  - IAM role policy: `s3:PutObject` scoped to `uploads/{cognito-identity-id}/*` only
- Post-confirmation Lambda trigger — creates User record in DB on first sign-up

### DatabaseStack

- `RDS::DBCluster` (Aurora Serverless v2, PostgreSQL 16, min 0.5 ACU / max 16 ACU)
- `SecretsManager::Secret` — DB credentials (auto-rotated)
- `RDS::DBProxy` — connection pooling for Lambda; IAM auth enabled
- VPC with private subnets — DB + Proxy unreachable from public internet
- Security groups: Lambda SG → Proxy SG on port 5432 only

### StorageStack

- `S3::Bucket` (photos) — block all public access; CORS for PUT; lifecycle to S3-IA (90d) → Glacier (365d)
- `S3::Bucket` (thumbnails) — same access pattern
- `CloudFront::Distribution` — serves both buckets via **signed URLs only**
- `CloudFront::OriginAccessControl` — S3 bucket inaccessible except via CloudFront

### ApiStack

- `AppSync::GraphQLApi` — Cognito User Pools primary auth; full CloudWatch logging
- `AppSync::GraphQLSchema` — uploaded from `packages/graphql/src/schema.graphql`
- `Lambda::Function` (appsync-resolver) — VPC-enabled; Secrets Manager for DB credentials; bundled with esbuild
- Pipeline resolvers per mutation: `checkRbac → executeMutation`

### LambdaStack

- `Lambda::Function` (photo-processor) — triggered by S3 PUT on photos bucket
  - Generates: thumbnail (400×400 WebP cover crop) + medium (1200px WebP)
  - Writes to thumbnails bucket; updates photo record status to `ready`

### WebStack

- `Lambda::Function` (nextjs-ssr) — via `@opennextjs/aws` adapter; Function URL
- `S3::Bucket` (web-assets) — static `/_next/static/` files
- `CloudFront::Distribution` — pages → SSR Lambda; static assets → S3
- `WAFv2::WebACL` — rate limiting (100 req/min per IP) + OWASP Core Rule Set

---

## Data Model

```sql
users
  id            uuid PK DEFAULT gen_random_uuid()
  cognito_id    text UNIQUE NOT NULL   -- Cognito sub claim
  email         text UNIQUE NOT NULL
  display_name  text NOT NULL
  avatar_url    text
  created_at    timestamptz DEFAULT now()

spaces
  id            uuid PK
  name          text NOT NULL
  description   text
  owner_id      uuid → users(id)

space_members                          -- RBAC junction table
  id            uuid PK
  space_id      uuid → spaces(id) CASCADE
  user_id       uuid → users(id) CASCADE
  role          text CHECK IN ('owner','editor','viewer')
  invited_by    uuid → users(id)
  UNIQUE (space_id, user_id)

items
  id            uuid PK
  space_id      uuid → spaces(id) CASCADE
  name          text NOT NULL
  description   text
  tags          text[]                 -- GIN indexed
  location_id   uuid → locations(id) SET NULL
  primary_photo_id uuid
  created_by    uuid → users(id)
  updated_by    uuid → users(id)
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('english', name || ' ' || COALESCE(description,'') || ' ' || array_to_string(tags,' '))
  ) STORED                             -- GIN indexed

locations
  id            uuid PK
  space_id      uuid → spaces(id) CASCADE
  name          text NOT NULL
  parent_id     uuid → locations(id) SET NULL
  path          ltree                  -- GIST indexed; enables subtree queries

photos
  id            uuid PK
  item_id       uuid → items(id) CASCADE
  s3_key        text NOT NULL          -- uploads/{cognito-identity-id}/{uuid}.jpg
  thumbnail_key text                   -- thumbnails/{uuid}_thumb.webp
  medium_key    text
  upload_status text CHECK IN ('pending','processing','ready','failed')
  sort_order    int DEFAULT 0
  created_by    uuid → users(id)
```

**Key indexes:** `items_search_idx` (GIN on search_vector), `items_tags_idx` (GIN on tags), `locations_path_idx` (GIST on path), `space_members_user_id_idx`.

---

## GraphQL Schema (Key Types)

```graphql
# Core types
type Space { id, name, items(filter, pagination), locations, myRole: Role!, members }
type Item  { id, name, tags, location, photos, primaryPhoto, space }
type Photo { id, url: String!, thumbnailUrl, mediumUrl, uploadStatus }  # urls = signed CloudFront
type Location { id, name, parent, children, path }

# Photo upload flow
type PhotoUploadIntent {
  photoId: ID!
  uploadUrl: String!    # Pre-signed S3 PUT URL (15 min expiry)
}

# Key mutations
createItem / updateItem / deleteItem
requestPhotoUpload(itemId, mimeType, fileSizeBytes) → PhotoUploadIntent
confirmPhotoUpload(photoId) → Photo    # called after S3 PUT succeeds
inviteMember(spaceId, email, role) → SpaceMembership
searchItems(filter: { query, tags, locationId }) → ItemConnection

# Subscriptions (AppSync managed WebSocket)
onItemCreated(spaceId: ID!): Item
onItemUpdated(spaceId: ID!): Item
```

---

## Security Architecture

### Auth Flow

1. User taps "Sign in with Google/Apple" → Cognito Hosted UI handles OAuth
2. Cognito issues: ID Token + Access Token (1hr) + Refresh Token (30 days)
   - Mobile: tokens stored in `expo-secure-store` (device keychain)
   - Web: stored in httpOnly cookies via Next.js middleware (not accessible to JS)
3. AppSync request: `Authorization: Bearer <access-token>`
4. AppSync validates token against Cognito JWKS automatically
5. Resolver receives `context.identity.sub` → RBAC check via `requirePermission()`

### RBAC Enforcement (`packages/api/src/middleware/rbac.ts`)

```typescript
const ROLE_PERMISSIONS = {
  owner:  ['item:create','item:update','item:delete','item:read','space:manage','member:invite','member:remove'],
  editor: ['item:create','item:update','item:delete','item:read'],
  viewer: ['item:read'],
};

// Called at the top of every mutation resolver
export async function requirePermission(db, cognitoSub, spaceId, permission): Promise<void>
// Throws GraphQLError 'FORBIDDEN' if not authorized
```

Every mutation uses AppSync pipeline resolver: `[checkRbac fn] → [business logic fn]`.

### Photo Access Control

- Photos **never** served directly from S3 — always via CloudFront signed URLs
- Signed URL generated at resolve time (1hr expiry), using CloudFront key pair from Secrets Manager
- Upload: pre-signed S3 PUT URL (15 min) scoped to caller's `cognito-identity-id` prefix
- IAM Identity Pool role: `s3:PutObject` only, only to `uploads/{own-identity-id}/*`

### Input Validation

All GraphQL inputs validated with Zod before any DB call:

```typescript
const CreateItemSchema = z.object({
  spaceId: z.string().uuid(),
  name: z.string().min(1).max(200).trim(),
  tags: z.array(z.string().max(50).trim()).max(20).optional(),
});
```

### Additional Controls

- WAF (CloudFront): rate limiting + OWASP CRS
- All secrets in Secrets Manager (no Lambda env var secrets)
- DB in private VPC subnets; inaccessible from public internet
- `cdk-nag` in CDK pipeline for AWS security benchmark compliance
- OWASP ZAP baseline scan in `deploy-staging.yml`

---

## Testing Strategy

```text
                [E2E ~10-15 paths]
          Playwright (web) + Maestro (mobile)

        [Integration ~40-60 tests]
      Vitest + real PostgreSQL (Docker Compose)
      Resolver Lambda tests; full upload flow

    [Unit ~200+ tests]
  Vitest — all packages
  RBAC matrix, validators, photo service, auth utils

[Accessibility]
jest-axe per component (web); Playwright axe-core per page
Mobile: VoiceOver + TalkBack manual checklist per release
```

### Key test patterns

- **RBAC matrix**: every mutation × every role (owner/editor/viewer/non-member) = explicit test
- **Integration isolation**: each test wrapped in a DB transaction, rolled back after
- **Test factories**: `fishery` library for typed test data in `packages/test-utils`
- **API mocking**: MSW handlers in `packages/test-utils/msw/` for web/mobile unit tests
- **Accessibility**: `expect(await axe(container)).toHaveNoViolations()` in every component test

### CI gates (GitHub Actions)

- PR: `pnpm turbo lint type-check test`
- Staging deploy: integration tests + Playwright E2E + OWASP ZAP scan
- `npm audit` blocks on high severity

---

## Accessibility Implementation

### Web

- **Semantic HTML**: `<main>`, `<nav>`, correct heading hierarchy, `<button>` not `<div onClick>`
- **Focus**: skip-to-content link, visible `:focus-visible` ring (3:1 contrast), Radix UI Dialog focus trap, focus restored after item deletion
- **Color**: text 4.5:1 contrast, UI elements 3:1, never color-only information, dark mode via Tailwind `dark:` variants
- **Images**: alt text on all item photos (`"Cordless Drill, photo 1 of 3"`), `alt=""` for decorative
- **Live regions**: `aria-live="polite"` for search result count, `role="alert"` for errors, `role="status"` for success
- **Forms**: every input has `<label>`, errors linked via `aria-describedby`, `aria-required`

### Mobile

- `accessibilityLabel` on every interactive element
- `accessibilityRole="button"` / `"image"` / `"header"` appropriately set
- Minimum touch target: 44×44 logical pixels
- `accessible={true}` + `accessibilityViewIsModal={true}` on modals
- `allowFontScaling={true}` on all Text (RN Reusables default)
- Manual VoiceOver (iOS) + TalkBack (Android) test session each release

---

## Implementation Phases

| Phase | Focus | Key Deliverable |
| --- | --- | --- |
| **0** | Foundation | Turborepo, DB schema, CDK stacks to dev, CI green |
| **1** | API Core | AppSync resolvers, spaces + items CRUD, RBAC, integration tests |
| **2** | Web App | Next.js auth flow, items list/create/search, Playwright E2E |
| **3** | Photo Upload | Pre-signed URLs, Sharp thumbnails, CloudFront signed URLs |
| **4** | Mobile App | Expo auth, camera capture, Maestro E2E, TestFlight |
| **5** | Locations + Members | Location hierarchy, invite/role management UI |
| **6** | Search + Polish | Full-text search, tag filters, full WCAG audit |
| **7** | Prod Hardening | Prod CDK env, CloudWatch dashboards, security review |

---

## Key Risks & Mitigations

| Risk | Mitigation |
| --- | --- |
| AppSync JS resolver sandbox limitations | Use Lambda data sources for all complex logic; AppSync only handles auth routing |
| Aurora min cost in dev (~$87/mo at 0.5 ACU) | Enable auto-pause on dev/staging; evaluate Neon for local dev |
| CloudFront signed URL key management | Private key in Secrets Manager, rotated every 90 days; test URL expiry in integration tests |
| Expo managed workflow camera limits | `expo-camera` + `expo-image-picker` cover MVP; document bare workflow migration path |
| VPC Lambda cold starts | VPC cold starts improved since 2022 (Hyperplane ENI reuse); provisioned concurrency for prod if needed |
| Solo dev bus factor | ADRs documented; runbook.md in repo; all secrets in Secrets Manager |
| React Native a11y inconsistency | Manual VoiceOver/TalkBack per release; RN Reusables + rn-primitives a11y; strict checklist as PR gate |

---

## Critical Files

- [infra/lib/stacks/api-stack.ts](infra/lib/stacks/api-stack.ts) — AppSync + Lambda resolver wiring
- [packages/db/src/schema/index.ts](packages/db/src/schema/index.ts) — Drizzle schema (source of truth for all table definitions)
- [packages/api/src/middleware/rbac.ts](packages/api/src/middleware/rbac.ts) — All mutation security flows through here
- [packages/graphql/src/schema.graphql](packages/graphql/src/schema.graphql) — GraphQL schema (drives codegen for all clients + AppSync)
- [packages/api/src/services/photo.service.ts](packages/api/src/services/photo.service.ts) — Photo upload + signed URL logic
- [packages/tokens/global.css](packages/tokens/global.css) — Violet theme tokens (single source of truth for all styling)

---

## Agent Skills

The following skills from [skills.sh](https://skills.sh) are installed in `.agents/skills/` and symlinked to Claude Code. They provide in-context expert guidance for the libraries in our stack:

| Skill | Source | Covers |
| --- | --- | --- |
| `turborepo` | `vercel/vercel-plugin` | Turborepo v2.8 — pipeline config, remote caching, `--affected` builds, monorepo dependency graph |
| `nextjs` | `vercel/vercel-plugin` | Next.js App Router — Server/Client Components, Server Actions, caching strategies, image optimization |
| `shadcn` | `vercel/vercel-plugin` | shadcn/ui CLI, component composition, CSS variable theming, custom registries |

To add more skills: `npx skills add https://github.com/vercel/vercel-plugin --skill <name> -y`
To browse available skills: [skills.sh/vercel/vercel-plugin](https://skills.sh/vercel/vercel-plugin)

---

## Tutorial / Blog Post

- `tutorial.md` — Running draft of a step-by-step tutorial following this project from start to finish, intended for an eventual blog post
- When completing significant steps (new tool setup, config changes, infrastructure deployments, etc.), update `tutorial.md` with clear step-by-step instructions explaining what was done and why
- Write in a tutorial tone — assume the reader is following along and building the project from scratch

---

## Future: Offline CRUD (Noted for Later)

The AppSync + Cognito stack maps directly to **AWS Amplify DataStore** for offline sync. When ready:

- Add `@model` directives to GraphQL schema
- Replace direct AppSync client with `Amplify.DataStore`
- DataStore handles conflict resolution, sync queue, local SQLite storage
- No infrastructure changes required — AppSync is already the backbone

This was the primary reason AppSync was chosen over a custom Apollo Server.
