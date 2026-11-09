# MEMORY

Working memory of indudex-api. Rules for keeping it: see "Memory" in `AGENTS.md`. Last updated: 2026-11-09.

## Current state

**Built**

- Hono 4 app on Node (`src/app.ts`, entry `src/index.ts`, port `PORT` or 4000) as an `OpenAPIHono`; CORS limited to `GET` and the origins in `CORS_ORIGIN`.
- Routes: `GET /health` and `GET /openapi.json` (OpenAPI 3.1, the contract the frontend generates its client from).
- Tooling: Vitest (`src/app.test.ts`), oxlint, Prettier, husky + lint-staged, GitHub Actions CI, Dependabot, Dockerfile and `docker-compose.yml` (API + web), licence, README.

**Not built yet**

- Everything in the product scope: crawler and adapters, pile build, catalogues, storage module, shard/advert/source/catalogue endpoints and their Zod schemas, separate crawler/pile entry points.

**Next**

- Start with T001 of `specs/001-legacy-sources-scraper/tasks.md` (62 tasks over 5 waves; wave 1 = core + reference feed).

## Decisions

- Spec 001 (`specs/001-legacy-sources-scraper/spec.md`) is drafted, not approved: all legacy sources by waves, failures isolated with previous adverts kept, scraper stops at validated stored adverts, sources without credentials ported but disabled. No-expiry adverts are kept unlimited; broken legacy sources are ported disabled and flagged. Waves are by source type; cadence, rate limits and backoff start from the legacy `crawl.yml` values, configurable per source. No open questions left; ready to approve.
- Tests use Vitest; the `node --test` line in the constitution was a copy-paste slip and was removed.
- Plan 001 approved: ports and adapters (MVVM rejected: no view in a backend), YAML config validated with Zod, one parsing library, stop switch as a file flag, career sites as data lists, hourly external cron.
- Linter is oxlint, not ESLint: typescript-eslint does not support TypeScript 7.
- Routes use `createRoute` + `app.openapi(...)`; plain `app.get` is invisible to the frontend's generated client.
- Package manager is pnpm only; `npm install` would create a stray `package-lock.json`.

## Mistakes to avoid

- Never bypass the pre-commit hook with `--no-verify`.
- `tsx` and Vitest do not type-check: run `pnpm typecheck` to verify a change.
