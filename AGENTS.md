# Indudex scrapper — agent guide

## What this is

Indudex is a free, public job portal for **engineers and technicians in Europe** (engineering, technical and IT occupations). It is made of **four components in three repos**:

| Component     | Kind                   | Runs                      | Repo                                 |
| ------------- | ---------------------- | ------------------------- | ------------------------------------ |
| **Scrapper**  | batch process          | host cron, hourly         | `indudex-scrapper` (this repo)       |
| **Processor** | batch process          | host cron, every 1 to 3 h | `indudex-scrapper` (second entry)    |
| **API**       | HTTP server, read-only | always on                 | `indudex-api` (not created yet)      |
| **Web**       | Next.js                | always on                 | `indudex-web` (sibling of this repo) |

```
sources ──► SCRAPPER ──► store/                    (one JSON file per source: validated, unfiltered)
                            │
                            ▼
                       PROCESSOR ──► published/<version>/ + "current" pointer   (ready to serve)
                                            │
                                            ▼
                                   API (read-only) ──HTTP/JSON (OpenAPI)──► WEB
```

- **Scrapper and processor talk only through files**, never over the network. Each writes its output atomically; the next one reads it. No queues: cron plus files is enough.
- The **processor publishes versions**: it writes a whole `published/<version>/` folder and only then moves the `current` pointer, so the API never reads half a build. A build that looks wrong (e.g. the pile shrinks by a third, as the legacy guard did) does not move the pointer.
- **The web talks only to the API.** Neither batch process ever talks to the web.
- The scrapper and processor share one repo because they share the advert schemas, the catalogues and the storage module. They stay separate processes, each with its own cron, and the processor can move to its own repo later if it grows.
- Cron runs **on the host** for now (as the legacy did); moving it into Docker is a later decision.
- A database may replace the files later: the scrapper and processor write, the API only reads, and the boundaries stay the same.

All of it is a rewrite of the monolith [`JustJans/indudex`](https://github.com/JustJans/indudex), which mixed the web app, the crawler/pile builder and ops scripts in one poorly structured codebase. Use the legacy repo as the **behavioral reference** (sources, gate rules, dedupe, data shape), not as code to copy: it is being restructured precisely because its structure is bad.

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

**Scrapper** (collect):

- Scheduler: a cadence per source, longer waits for sources that do not change, backoff and parking for failing ones; per-source status and CLI.
- One adapter per source (public employment services, ATS APIs, employers' careers sites via sitemap + schema.org `JobPosting`, partner feeds, portals).
- Polite crawling (see below), Zod validation of every advert with its source's licence and credit attached, takedowns, closed-advert detection.
- **Expiry**: an advert without an expiry date expires 2 years after its posted date (first-seen date if the source gives none).
- Source discovery (legacy hunter and scouts) as separate CLI tools.

**Processor** (prepare, from the store only, never the network):

- Normalise and enrich: stable id, country/town (GeoNames, NUTS), work mode, contract and working time, pay (only as stated, converted with ECB rates), years of experience, required degrees and languages, company names and agencies, all-caps titles.
- Gate (in-scope occupations via ISCO/ESCO, Europe only) and hygiene; dedupe.
- **Title translation** into every supported locale with an engine run on our own server (legacy: Bergamot, Aina for Catalan), cached per title. It runs as its own process with its own cron because it needs a lot of memory.
- Incremental builds and `--explain` (why each advert was dropped).
- Output, the published dataset: shards, index, word index, latest adverts, company directory and cards, exported catalogues, metadata (build time, counts, sources and licences).
- **Owns the catalogues** (occupations, countries, towns, languages, degrees, vetoes); the API serves the copy the processor publishes.

Out of scope:

- **Serving anything over HTTP**: that is `indudex-api`. This repo has no HTTP surface.
- **Anything about the user.** See the privacy rules below.
- UI copy and locale routing (that is the frontend).

### Advert text

As in the legacy: **the advert's own text is never published nor translated.** The site shows the title, the employer and the place, and links to the source page for the rest. The store keeps the description (length-capped) only so the processor can read requirements, pay and closed notices from it; it never reaches the published dataset. Only titles are translated; the original title is kept next to its translations and is the fallback when one is missing.

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

## Contracts

- **Scrapper → processor: the store.** One JSON file per source plus source state, declared once as **Zod schemas** (advert, source with licence and credit, source state). Every advert is validated before it is stored.
- **Processor → API: the published dataset** (`published/<version>/` + `current`). Its files are also declared as Zod schemas in this repo; `indudex-api` serves them and describes them in its OpenAPI spec.
- **API → web: OpenAPI** (`@hono/zod-openapi`, `GET /openapi.json`; the web generates its client with `openapi-typescript`). That contract lives in `indudex-api`.
- An advert has a **stable id** derived from its source and the source's own id, the same in every locale.
- Breaking changes to the store or the published dataset need a version bump of the format. Never change the shape of a stored or published field silently.

## Storage

**Undecided long-term.** For now everything is **JSON files** on disk (as the legacy did): the store, the processor's caches (translations, incremental build) and the published dataset. A database may replace this later. Keep all storage access behind a small repository module so it can be swapped. Adapters, the runner and the processor's steps must never touch the filesystem layout directly. In Docker, the scrapper and processor mount the shared volume read-write and the API mounts it **read-only**.

## Conventions

- **Licence**: source-available (see `LICENSE`). Every file holding third-party data (ESCO, GeoNames, company lists, …) must credit its source and licence in a header, as `LICENSE` promises.
- **English everywhere**: code, identifiers, comments, docs, commit messages, PR descriptions.
- **Simple code**: prefer the plainest solution that works; no abstractions until a second real use needs them. Use descriptive names (no cryptic abbreviations). Comment only where it adds something the code cannot say, such as _why_ a non-obvious decision was made, never _what_ the next line does.
- TypeScript strict, ESM (`"type": "module"`, `NodeNext`, `verbatimModuleSyntax`: use `import type` for types and `.js` extensions in relative imports).
- Package manager: **pnpm**.
- Validation with **Zod**, at the edges: data coming from every source and data written to storage.
- Tests with **Vitest**, without network: adapter parsers run against saved fixtures; schemas, the runner, gate and dedupe get unit tests.
- Deployment: **self-hosted server**. The scrapper, the processor and the translator are started by the **host's cron** (hourly; the scrapper decides which sources are due), each with its own lock so a slow run is skipped rather than stacked. Docker for these is a later decision.
- Linting with **oxlint** (ESLint's TypeScript support does not cover TypeScript 7), formatting with **Prettier**. A pre-commit hook and CI enforce both.

## Decided for the other repos

- **Shards reach the browser through the API, with a CDN in front.** `indudex-api` declares the shard routes in its OpenAPI spec and serves them under versioned paths with immutable cache headers; Cloudflare caches them on the API's domain. The web only ever talks to the API's domain.
- **Matching rules are copied, for now.** The legacy Argus title rules are needed by the processor's gate and by the web's search and CV reader. Each repo keeps its own copy; when one changes, change the other in the same way, or a CV will tick occupations the gate classified differently. Moving them into a versioned shared package is pending (see `MEMORY.md`).

## Open decisions

Do not assume an answer to these; ask or leave a clear TODO.

- Long-term storage (database or not, which one).
- Moving the cron jobs from the host into Docker.
