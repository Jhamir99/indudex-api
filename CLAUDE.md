# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Read `AGENTS.md` first.** It holds the product context, the scope of this repo, the privacy and crawling rules, the API shape, the contract with the frontend and the open decisions. This file only adds Claude Code specifics and does not repeat them.

## Status

Backend of Indudex, rewritten from the monolith [`JustJans/indudex`](https://github.com/JustJans/indudex). The repo is still the Hono starter (`src/index.ts` with one `GET /`). Update this file as real architecture emerges.

The server listens on `PORT` (default 4000).

## Core conventions

Full rules are in `AGENTS.md`. The ones to keep in mind on every change:

- Code, comments and docs in English.
- Simple code, descriptive names, comments only where they add something.

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
```

TypeScript config is split: `tsconfig.json` type-checks everything and emits nothing; `tsconfig.build.json` extends it and compiles only `src/` (excluding `*.test.ts`) into `dist/`.

Tests live next to the code they test (`src/**/*.test.ts`). Saved source responses for adapter tests go in `test/fixtures/`. Test routes with `app.request(...)` on the app from `src/app.ts`; never start a server in tests.

pnpm is pinned via `packageManager` in `package.json`. Node 25+ no longer bundles corepack, so pnpm is installed globally with `npm i -g pnpm`. Never use `npm install` here: it would create a `package-lock.json` next to `pnpm-lock.yaml`.

Planned, not created yet: separate entry points for the crawler and the pile build. Add them here when they exist.

## Stack

- Node, **TypeScript 7** (strict, ESM / `NodeNext`, `verbatimModuleSyntax`), `tsx` for development. Only `tsc` (TypeScript 7.0.2, the single copy in the tree) checks types: `tsx` and Vitest strip types without checking them, so run `pnpm typecheck` to verify a change. Keep `typescript` on `^7`; dependencies must not pull in an older copy (`pnpm why typescript` shows one version).
- Hono 4 served by `@hono/node-server`.
- Vitest 5 for tests (`vitest.config.ts`, Node environment).
- Zod 4 + `@hono/zod-openapi` 1. Import `z` from `@hono/zod-openapi` (it adds `.openapi()`), not from `zod`. `src/app.ts` is an `OpenAPIHono` app: routes are `createRoute` + `app.openapi(...)`, schemas are named with `.openapi('Name')` so they land in `components.schemas`, and `app.doc31('/openapi.json', ...)` serves the spec. Current routes: `GET /health`, `GET /openapi.json`.

## Intended structure

Target layout; only `index.ts` and `app.ts` exist so far. Adjust here when it changes:

```
src/
  index.ts          # API process entry: builds the app, serves it on PORT
  app.ts            # OpenAPIHono app: routes mounted here, spec at /openapi.json; tests call app.request
  routes/           # one file per resource; Zod/OpenAPI route definitions
  schemas/          # shared Zod schemas: advert, shard, index, catalogue, source
  crawler/
    adapters/       # one adapter per source: fetch + parse, nothing else
    run.ts          # crawler process entry: runs the sources that are due
  pile/             # normalise → gate → dedupe → translate → shards/index per locale
  catalogues/       # ISCO/ESCO, countries, towns, languages, degrees
  storage/          # the only module that touches files (future: DB)
  config/           # source lists, cadences, takedowns
test/
  fixtures/         # saved source responses for offline parser tests
```

## Legacy reference

When reproducing behavior, check the legacy repo rather than guessing:

- `builder/adapters/*.mjs`: one adapter per source. Port them one at a time, each with a fixture-based test.
- `builder/crawl.mjs`, `builder/config/crawl.yml`: crawl cadence and state.
- `builder/gate.mjs`, `builder/dedupe.mjs`, `builder/build-pile.mjs`: pile rules.
- `builder/isco-esco.mjs`, `catalogues/`: occupation scope and catalogues.
- `packages/published-data`: the published data shape the old web read. Start from it when writing the Zod schemas.
- `builder/config/takedowns.yml`, `companies*.yml`, `careers*.yml`, `vendors.yml`: source lists and takedowns.
- `docs/CRAWLING.md`: crawling research and sources.
- `builder/mt/`: the legacy machine translation. It is the reference for producing translated adverts; how translation is done in the rewrite is still an open decision (see `AGENTS.md`).
