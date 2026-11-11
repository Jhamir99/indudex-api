# Indudex scrapper — agent guide

## What this is

Indudex is a free, public job portal for **engineers and technicians in Europe** (engineering, technical and IT occupations). This repository is **the scrapper** (`indudex-scrapper`): the component that collects the adverts and stores them as JSON (a database may follow later). Indudex has three components, each in its own repo:

- **`indudex-scrapper`** (this repo): collects adverts from the sources and writes them to storage.
- **`indudex-api`** (does not exist yet, to be created): the backend. It reads the adverts the scrapper stored and serves them to the frontend.
- **`indudex-web`** (Next.js, a sibling of this repo): the frontend.

The scrapper never talks to the frontend. Its only output is the stored adverts; the API's only input from it is that storage.

All three are a rewrite of the monolith [`JustJans/indudex`](https://github.com/JustJans/indudex), which mixed the web app, the crawler/pile builder and ops scripts in one poorly structured codebase. Use the legacy repo as the **behavioral reference** (sources, gate rules, dedupe, data shape), not as code to copy: it is being restructured precisely because its structure is bad.

## Memory

`MEMORY.md` (repo root) is the project's working memory: current state, decisions taken and mistakes to avoid.

- At the start of a task, read `MEMORY.md` to learn the state of the project and the decisions already taken.
- At the end of a task, update it: current state, important decisions (with their why) and mistakes to avoid. Do it in the same commit as the change.
- Keep it short (about 50 lines at most): summarise or delete whatever no longer adds anything.
- If something becomes a permanent rule, propose moving it to `AGENTS.md` instead of leaving it in the memory.
- Never store sensitive data in it (keys, tokens, personal data).

## Rules

- Read `docs/constitution.md` and the active spec (`specs/NNN-*/`) before touching code.

## Scope of this repo

In scope:

1. **Crawler**: one adapter per source (public employment services, ATS APIs, employers' careers sites, partner feeds), each on its own cadence.
2. **Validated adverts in one common format** (a Zod schema), with each source's licence and credit attached.
3. **Expiry**: an advert without an expiry date expires 2 years after its posted date (first-seen date if the source gives none).
4. **Storage access** for adverts and crawler state (see "Storage").
5. **Catalogues** the scrapper needs to tag adverts (occupations, countries, …). Who owns the catalogues the API also needs is an open decision.

Out of scope:

- **Serving anything over HTTP** and everything the frontend consumes (shards, indexes, catalogue and advert endpoints, OpenAPI): that is the future `indudex-api`.
- **Anything about the user.** See the privacy rules below.
- UI copy and locale routing (that is the frontend).

Undecided, see "Open decisions": where the rest of the legacy pile build lives (gate, dedupe, translate, shards + index + metadata). Spec 001 stops at validated stored adverts.

## Non-negotiable rules

### Privacy

The scrapper handles no user data at all. The rules below bind the product and the future API, and the scrapper must never be the way around them. The product has no accounts, no email and stores nothing about the user. The CV is parsed in the browser and the filter profile (the "plate") lives in the URL hash. Therefore:

- Never add endpoints that receive a CV, CV text or a full plate/profile.
- No user tables, sessions, cookies, analytics or third-party tracking.
- Do not log query strings or bodies in a way that could rebuild a profile. Request logs keep method, route, status and timing.

### Crawling

Carried over from the legacy project:

- Obey `robots.txt`. Use only documented public APIs, employers' own pages (sitemap + schema.org `JobPosting`) and partner feeds whose terms allow republishing.
- No LinkedIn and no commercial job boards.
- Keep each source's **licence and required attribution** (e.g. "Jobs by Adzuna") with its adverts, so the frontend can show it.
- Honour takedown requests (legacy `builder/config/takedowns.yml`).
- Be polite: per-host rate limits, a cadence per source, and a manual stop switch.
- API keys and credentials live only in `.env` (never committed); keep an up-to-date `.env.example`.

## Contract with the API

- The contract between the scrapper and the future `indudex-api` is **the stored JSON**: its shape is declared once as **Zod schemas** (advert, source with licence and credit, source state) and every advert is validated against them before it is stored.
- An advert has a **stable id** derived from its source and the source's own id, so the API can link to it whatever else changes.
- Breaking changes to the stored shape need a version bump of the format. Never change the shape of a stored field silently; the API depends on it.
- The OpenAPI contract with the frontend (`@hono/zod-openapi`, `GET /openapi.json`, `openapi-typescript` on the frontend side) belongs to the future `indudex-api`. This repo has no HTTP surface of its own.

## Storage

**Undecided long-term.** For now, adverts and crawler state are stored as **JSON files** on disk (as the legacy store did), one set per source. A database may replace this later. Keep all storage access behind a small repository module so it can be swapped for a database later. Adapters and the runner must never touch the filesystem layout directly. The future API reads this storage, so the layout is part of the contract above.

## Conventions

- **Licence**: source-available (see `LICENSE`). Every file holding third-party data (ESCO, GeoNames, company lists, …) must credit its source and licence in a header, as `LICENSE` promises.
- **English everywhere**: code, identifiers, comments, docs, commit messages, PR descriptions.
- **Simple code**: prefer the plainest solution that works; no abstractions until a second real use needs them. Use descriptive names (no cryptic abbreviations). Comment only where it adds something the code cannot say, such as _why_ a non-obvious decision was made, never _what_ the next line does.
- TypeScript strict, ESM (`"type": "module"`, `NodeNext`, `verbatimModuleSyntax`: use `import type` for types and `.js` extensions in relative imports).
- Package manager: **pnpm**.
- Validation with **Zod**, at the edges: data coming from every source and data written to storage.
- Tests with **Vitest**, without network: adapter parsers run against saved fixtures; schemas and the runner get unit tests.
- Deployment: **Docker on a self-hosted server**. The scrapper runs as its own process on a schedule (an hourly external cron decides what is due) and writes to storage shared with the future API.
- Linting with **oxlint** (ESLint's TypeScript support does not cover TypeScript 7), formatting with **Prettier**. A pre-commit hook and CI enforce both.

## Open decisions

Do not assume an answer to these; ask or leave a clear TODO.

- Long-term storage (database or not, which one).
- Where the rest of the pile build lives (gate, dedupe, translate, shards + index + metadata): a later stage of the scrapper or the future `indudex-api`.
- Who owns the catalogues (ISCO/ESCO, countries, towns, languages, degrees) when both the scrapper and the API need them.
- How shards are served (API process or static files behind a reverse proxy): an `indudex-api` decision.
- How adverts get translated: which engine (legacy used its own MT in `builder/mt`) and whether it runs in this repo, in the API or as a separate service.
- Whether the original-language text is kept and shown too, and how missing translations fall back (e.g. to English).
