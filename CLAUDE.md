# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Read `AGENTS.md` first.** It holds the product context, the scope of this repo, the privacy and crawling rules, the contract with the future API and the open decisions. This file only adds Claude Code specifics and does not repeat them.

## Status

Scrapper of Indudex (repo `indudex-scrapper`, formerly `indudex-api`), rewritten from the monolith [`JustJans/indudex`](https://github.com/JustJans/indudex). It collects adverts and stores them as JSON; the future `indudex-api` will read them and serve the frontend.

The code is still the Hono starter (`src/index.ts`, `src/app.ts`, `GET /health`, port `PORT` or 4000, Dockerfile and `docker-compose.yml` with the web). It is a leftover from when this repo was the API: the scrapper is a process, not a server, and that starter is meant to move to `indudex-api` when it is created. Update this file as real architecture emerges.

## Core conventions

Full rules are in `AGENTS.md`. The ones to keep in mind on every change:

- Code, comments and docs in English.
- Simple code, descriptive names, comments only where they add something.
- Read `MEMORY.md` at the start of a task and update it at the end (see "Memory" in `AGENTS.md`).

## Commands

```bash
pnpm install
pnpm dev        # tsx watch src/index.ts
pnpm build      # tsc -p tsconfig.build.json → dist/ (src only, no tests)
pnpm start      # node dist/index.js
pnpm typecheck  # tsc --noEmit over src, test and config files
pnpm test       # vitest in watch mode
pnpm test:run   # vitest once (use this to verify a change)
pnpm vitest run src/app.test.ts   # a single test file
pnpm lint       # oxlint --deny-warnings
pnpm format     # prettier --write .   (format:check in CI)
docker compose up --build   # starter leftover: API on :4000 + web on :3000 (moves to indudex-api)
```

Before calling a change done, run what CI runs: `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test:run && pnpm build`.

TypeScript config is split: `tsconfig.json` type-checks everything and emits nothing; `tsconfig.build.json` extends it and compiles only `src/` (excluding `*.test.ts`) into `dist/`.

Tests live next to the code they test (`src/**/*.test.ts`). Saved source responses for adapter tests go in `test/fixtures/`. Test routes with `app.request(...)` on the app from `src/app.ts`; never start a server in tests.

pnpm is pinned via `packageManager` in `package.json`. Node 25+ no longer bundles corepack, so pnpm is installed globally with `npm i -g pnpm`. Never use `npm install` here: it would create a `package-lock.json` next to `pnpm-lock.yaml`.

Tooling:

- **Linter: oxlint** (`.oxlintrc.json`), not ESLint. typescript-eslint does not support TypeScript 7 (its peer range is `<6.1`), and ESLint cannot read TypeScript without it. oxlint does not depend on the `typescript` package. It has no type-aware rules; `pnpm typecheck` covers types.
- **Prettier** with default options (double quotes, semicolons), the same style as indudex-web.
- **Pre-commit hook** (husky + lint-staged, config in `package.json`): runs oxlint and Prettier on staged files. Never bypass it with `--no-verify`.
- **CI** (`.github/workflows/ci.yml`): lint, format check, typecheck, tests and build on every push to `main` and every PR. Node version from `.nvmrc`, pnpm from `packageManager`.
- **Docker**: `Dockerfile` builds `dist/` and runs it with production dependencies only. `docker-compose.yml` still runs the starter together with indudex-web; it lives here only until `indudex-api` exists, then it moves there. Env vars: see `.env.example` (`PORT`, `CORS_ORIGIN`).

Planned, not created yet: separate entry points for the crawler and the pile build. Add them here when they exist.

## Stack

- Node, **TypeScript 7** (strict, ESM / `NodeNext`, `verbatimModuleSyntax`), `tsx` for development. Only `tsc` (TypeScript 7.0.2, the single copy in the tree) checks types: `tsx` and Vitest strip types without checking them, so run `pnpm typecheck` to verify a change. Keep `typescript` on `^7`; dependencies must not pull in an older copy (`pnpm why typescript` shows one version).
- Hono 4 served by `@hono/node-server` (starter leftover, see Status).
- Vitest 5 for tests (`vitest.config.ts`, Node environment).
- Zod 4 + `@hono/zod-openapi` 1 (the adverts' Zod schemas are the contract with the future API; the OpenAPI part is starter leftover). Import `z` from `@hono/zod-openapi` (it adds `.openapi()`), not from `zod`. `src/app.ts` is an `OpenAPIHono` app: routes are `createRoute` + `app.openapi(...)`, schemas are named with `.openapi('Name')` so they land in `components.schemas`, and `app.doc31('/openapi.json', ...)` serves the spec. Current routes: `GET /health`, `GET /openapi.json`.

## Intended structure

Target layout; only `index.ts` and `app.ts` (the starter, to move out) exist so far. Adjust here when it changes:

```
src/
  schemas/          # shared Zod schemas: advert, source (with licence), source state
  crawler/
    adapters/       # one adapter per source: fetch + parse, nothing else
    run.ts          # scrapper process entry: runs the sources that are due
  catalogues/       # what the scrapper needs to tag adverts (ISCO/ESCO, countries, ...)
  storage/          # the only module that touches files (future: DB); the future API reads what it writes
  config/           # source lists, cadences, takedowns
test/
  fixtures/         # saved source responses for offline parser tests
```

## Legacy reference

When reproducing behavior, check the legacy repo rather than guessing:

- `builder/adapters/*.mjs`: one adapter per source. Port them one at a time, each with a fixture-based test.
- `builder/crawl.mjs`, `builder/config/crawl.yml`: crawl cadence and state.
- `builder/gate.mjs`, `builder/dedupe.mjs`, `builder/build-pile.mjs`: pile rules (not in the scrapper's scope for now, see `AGENTS.md` open decisions).
- `builder/isco-esco.mjs`, `catalogues/`: occupation scope and catalogues.
- `packages/published-data`: the published data shape the old web read. Start from it when writing the Zod schemas.
- `builder/config/takedowns.yml`, `companies*.yml`, `careers*.yml`, `vendors.yml`: source lists and takedowns.
- `docs/CRAWLING.md`: crawling research and sources.
- `builder/mt/`: the legacy machine translation. It is the reference for producing translated adverts; how translation is done in the rewrite is still an open decision (see `AGENTS.md`).
