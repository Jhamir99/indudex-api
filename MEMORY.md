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

- Port the first adapter with a fixture-based test, then the shared Zod schemas (advert, shard, index) starting from legacy `packages/published-data`.

## Decisions

- Linter is oxlint, not ESLint: typescript-eslint does not support TypeScript 7.
- Routes use `createRoute` + `app.openapi(...)`; plain `app.get` is invisible to the frontend's generated client.
- Package manager is pnpm only; `npm install` would create a stray `package-lock.json`.

## Mistakes to avoid

- Never bypass the pre-commit hook with `--no-verify`.
- `tsx` and Vitest do not type-check: run `pnpm typecheck` to verify a change.
