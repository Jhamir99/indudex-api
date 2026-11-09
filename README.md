# Indudex API

Backend of [Indudex](https://indudex.com/), a free, public job portal for engineers and technicians in Europe.

It collects job adverts from public employment services, employers' own careers pages and documented job-board APIs, keeps the technical ones in Europe, removes duplicates, translates them into English, Spanish and Catalan, and serves them to [indudex-web](https://github.com/Jhamir99/indudex-web).

- **Nothing about users.** No accounts, no CVs, no profiles: the frontend matches adverts in the browser.
- **Polite crawling.** It obeys `robots.txt`, uses only sources whose terms allow republishing, and credits each source.

This is a rewrite of [JustJans/indudex](https://github.com/JustJans/indudex), split into a backend (this repo) and a frontend.

## Stack

Node 26, TypeScript 7, Hono with `@hono/zod-openapi` (the OpenAPI 3.1 contract is served at `/openapi.json`), Zod, Vitest, oxlint, Prettier, pnpm.

## Running it

Requires Node 26 (see `.nvmrc`) and pnpm (`npm i -g pnpm`).

```bash
pnpm install
cp .env.example .env   # PORT, CORS_ORIGIN
pnpm dev               # http://localhost:4000/health
```

| Command                     | What it does                        |
| --------------------------- | ----------------------------------- |
| `pnpm build` / `pnpm start` | Compile to `dist/` and run it       |
| `pnpm lint` / `pnpm format` | oxlint / Prettier                   |
| `pnpm typecheck`            | `tsc` over source, tests and config |
| `pnpm test:run`             | Unit tests (Vitest)                 |

A pre-commit hook lints and formats staged files, and CI runs all checks on every push and pull request.

### With Docker

`docker-compose.yml` runs this API and [indudex-web](https://github.com/Jhamir99/indudex-web) together. Clone both repos side by side, then:

```bash
docker compose up --build   # API on :4000, web on :3000
```

Set `WEB_ORIGIN` and `PUBLIC_API_URL` (for example in a `.env` file) for a real domain.

## Licence

Source-available, not open source: you may read the code, but not run, copy or build on it. See [LICENSE](LICENSE). Third-party data (ESCO, GeoNames, job adverts) keeps its own terms.
