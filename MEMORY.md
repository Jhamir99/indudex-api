# MEMORY

Working memory of indudex-scrapper. Rules for keeping it: see "Memory" in `AGENTS.md`. Last updated: 2026-11-11.

## Current state

**Built**

- Hono 4 starter on Node (to move to `indudex-api`) (`src/app.ts`, entry `src/index.ts`, port `PORT` or 4000) as an `OpenAPIHono`; CORS limited to `GET` and the origins in `CORS_ORIGIN`.
- Starter routes: `GET /health` and `GET /openapi.json`.
- Tooling: Vitest (`src/app.test.ts`), oxlint, Prettier, husky + lint-staged, GitHub Actions CI, Dependabot, Dockerfile and `docker-compose.yml` (API + web), licence, README.

**Not built yet**

- Everything in the scrapper's scope: crawler and adapters, advert/source Zod schemas, storage module, catalogues it needs, crawler entry point. The API, shards and pile build are not here.

**Next**

- Start with T001 of `specs/001-legacy-sources-scraper/tasks.md` (62 tasks over 5 waves; wave 1 = core + reference feed).

## Decisions

- 2026-11-11: split into three components. This repo is now `indudex-scrapper` (was `indudex-api`): collects adverts and stores JSON (DB maybe later). `indudex-api` will be a new repo that reads that storage and serves `indudex-web`. The stored JSON, validated by Zod schemas, is the contract between them. Why: the scrapper is a scheduled process, not a server, and the API should not own crawling. The Hono starter here is a leftover to move to `indudex-api`. Open: where gate/dedupe/translate/shards live, and who owns the catalogues.

- Spec 001 (`specs/001-legacy-sources-scraper/spec.md`) is drafted, not approved: all legacy sources by waves, failures isolated with previous adverts kept, scraper stops at validated stored adverts, sources without credentials ported but disabled. Adverts without an expiry date last 2 years (from posted date, else first-seen date); broken legacy sources are ported disabled and flagged. Waves are by source type; cadence, rate limits and backoff start from the legacy `crawl.yml` values, configurable per source. No open questions left; ready to approve.
- Tests use Vitest; the `node --test` line in the constitution was a copy-paste slip and was removed.
- Plan 001 approved: ports and adapters (MVVM rejected: no view in a backend), YAML config validated with Zod, one parsing library, stop switch as a file flag, career sites as data lists, hourly external cron.
- Linter is oxlint, not ESLint: typescript-eslint does not support TypeScript 7.
- Routes use `createRoute` + `app.openapi(...)`; plain `app.get` is invisible to the frontend's generated client.
- Package manager is pnpm only; `npm install` would create a stray `package-lock.json`.

## Mistakes to avoid

- Never bypass the pre-commit hook with `--no-verify`.
- `tsx` and Vitest do not type-check: run `pnpm typecheck` to verify a change.
