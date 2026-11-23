# Where the Hell Is It?

> Cross-platform app for tracking physical items and their locations, with
> photos, for small teams and families.

## Shared standards (clankers)

Check clankers first. Universal standards, skills and agents come from the
**clankers** repo (<https://github.com/nickmagruder/clankers>, local:
`~/.claude/clankers`) and load globally: git, PRs, AI review, issues and docs
follow `~/.claude/clankers/standards/` here as in every repo. This file holds
only facts specific to this project and doesn't restate or override those
rules; this project's only exceptions are the ones listed for it under
"Exceptions to clankers standards" in `~/.claude/clankers/registry/PROJECTS.md`
(none today).

## Stack

- **Apps:** web (`apps/web`, Next.js) and mobile (`apps/mobile`, React Native + Expo), in a pnpm + Turborepo monorepo with shared `packages/`
- **Backend/API:** AWS AppSync (GraphQL) with Lambda resolvers; Cognito auth
- **Data:** Aurora Serverless v2 (PostgreSQL) via RDS Proxy, Drizzle ORM
- **Hosting/CI:** AWS CDK (`infra/`), GitHub Actions

The full architecture reference and ADRs are in `CLAUDE.md` below its imports; read it before architecture work.

## Working rules

- **Git, PRs and AI review:** clankers `standards/git.md`. This repo's
  facts: PRs squash-merge (enforced once #5 lands), and Nick merges. CI
  (`ci.yml`) runs on every PR; for its `pnpm audit` failure see #11.
- **This repo is public:** keep secrets, personal details and local
  settings out of every tracked file, `AGENTS.md`, `CLAUDE.md` and
  `memory/` included.
- **Deploys:** both deploy jobs are disabled (`if: false`):
  `deploy-staging.yml` would run on every push to `main` once enabled
  (Phase 3+), and `deploy-prod.yml` is a manual `workflow_dispatch` (Phase
  11). Never dispatch `deploy-prod` or enable either job unless Nick asks.
- **Tracking:** clankers `standards/github.md`. Issues go on the
  [Where the Hell Is it? board](https://github.com/users/nickmagruder/projects/4)
  (`gh project item-add 4 --owner nickmagruder --url <url>`).
- **End of every task:** clankers `global/AGENTS.md` "End of every task".
  This repo's specifics: the README changelog is newest at top; update
  `CLAUDE.md` (the architecture reference), `README.md` and `tutorial.md`
  where affected; in `PLAN.md`, mark completed sub-steps ✅ and newly
  started or incomplete ones ⬜.

## Memory

- `memory/MEMORY.md`: this project's memory index (clankers
  `global/AGENTS.md` "Memory"); `memory/local/` is gitignored, for facts
  that mustn't be committed. Read both indexes at the start of a session
  (`CLAUDE.md` imports them), and write new memories there, never in a
  tool's own store.

## Key files

- `README.md`: overview, changelog (newest at top)
- `CLAUDE.md`: architecture reference and ADRs
- `PLAN.md`: phased build plan with ✅/⬜ marks
- `tutorial.md`: step-by-step build log
- `memory/MEMORY.md`: agent memory index
- `infra/`: AWS CDK stacks
- `.agents/skills/`: shared agent skills
- `.github/workflows/`: `ci.yml` (lint, type-check, test, CDK synth, audit), `deploy-staging.yml`, `deploy-prod.yml` (both deploys disabled)
