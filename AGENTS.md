# Indudex API — agent guide

## What this is

Indudex is a free, public job portal for **engineers and technicians in Europe** (engineering, technical and IT occupations). This repository is **the backend** (`indudex-api`). The frontend is a separate repo, `indudex-web` (Next.js), a sibling of this one.

Both are a rewrite of the monolith [`JustJans/indudex`](https://github.com/JustJans/indudex), which mixed the web app, the crawler/pile builder and ops scripts in one poorly structured codebase. Use the legacy repo as the **behavioral reference** (sources, gate rules, dedupe, data shape), not as code to copy: it is being restructured precisely because its structure is bad.

## Scope of this repo

In scope:

1. **HTTP API** (Hono on Node) that the frontend consumes.
2. **Crawler**: one adapter per source (public employment services, ATS APIs, employers' careers sites, partner feeds), each on its own cadence.
3. **Pile build**: normalise → gate (keep only in-scope occupations in Europe, drop expired) → dedupe → translate → shards + index + metadata.
4. **Translated adverts**: every advert is stored and served **already translated into every supported locale** (`en`, `es`, `cat`, the same locales as the frontend), so the client never waits for a translation. Adverts are text only, so keeping one copy per locale is cheap.
5. **Catalogues**: occupations (ISCO-08 groups and their ESCO occupations/titles), countries, towns, languages, degrees, vetoes.
6. **Storage access** for adverts and crawler state (see "Storage").

Out of scope:

- **Anything about the user.** See the privacy rules below.
- UI copy and locale routing (that is the frontend).

## Non-negotiable rules

### Privacy

The product has no accounts, no email and stores nothing about the user. The CV is parsed in the browser and the filter profile (the "plate") lives in the URL hash. Therefore:

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

## API shape: hybrid

The frontend does the fine-grained matching **on the client**, so the API serves:

- **The pile as shards** (JSON split by **locale**, occupation family and country) + an index + metadata (e.g. when it was last rebuilt). The client downloads only the shards of its current locale and filters locally.
- **Regular endpoints** for catalogues, advert detail, sources and their licences, pile status, health.

Do not add server-side search that would require the full user profile (see Privacy).

## Contract with the frontend

- The single source of truth is **Zod schemas declared through `@hono/zod-openapi`**. They validate requests/responses at runtime, give the backend its TS types and generate the **OpenAPI** spec.
- The spec is served by the API (planned: `GET /openapi.json`). The frontend generates its types and client from it (`openapi-typescript` + `openapi-fetch`). There is no shared types package.
- Shard and index files are also described as schemas in the spec.
- An advert has the **same id and the same non-text fields in every locale**; only the translatable text (title, description, …) differs. A plate or a link must point to the same advert whatever the language.
- Breaking changes to the contract need a version bump of the affected route or shard format. Never change the shape of a published field silently.

## Storage

**Undecided long-term.** For now, adverts and crawler state are stored in **files** on disk (as the legacy store did), with **one set of advert files per locale**. A database may replace this later. Keep all storage access behind a small repository module so it can be swapped for a database later. Routes, adapters and the pipeline must never touch the filesystem layout directly.

## Conventions

- **English everywhere**: code, identifiers, comments, docs, commit messages, PR descriptions.
- **Simple code**: prefer the plainest solution that works; no abstractions until a second real use needs them. Use descriptive names (no cryptic abbreviations). Comment only where it adds something the code cannot say, such as *why* a non-obvious decision was made, never *what* the next line does.
- TypeScript strict, ESM (`"type": "module"`, `NodeNext`, `verbatimModuleSyntax`: use `import type` for types and `.js` extensions in relative imports).
- Package manager: **pnpm**.
- Validation with **Zod**, at the edges: HTTP input/output and data coming from every source.
- Tests with **Vitest**, without network: adapter parsers run against saved fixtures; gate, dedupe and schemas get unit tests.
- Default port **4000**, overridable with `PORT` (the frontend's Next dev server uses 3000).
- Deployment: **Docker on a self-hosted server**. API and crawler run as separate processes (the crawler/pile build on a schedule) sharing the same code and storage.

## Open decisions

Do not assume an answer to these; ask or leave a clear TODO.

- Long-term storage (database or not, which one).
- How shards are served: from the API process or as static files behind a reverse proxy.
- The environment variable the frontend uses for the API base URL.
- How adverts get translated: which engine (legacy used its own MT in `builder/mt`) and whether it runs in this repo or as a separate service. Either way, the result is stored here as described above.
- Whether the original-language text is kept and shown too, and how missing translations fall back (e.g. to English).
