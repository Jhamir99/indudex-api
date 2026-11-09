# Plan 001 — Legacy sources scraper

Implements `spec.md` (FR-1 to FR-14). Status: approved, decisions confirmed. Nothing here is implemented yet.

## 1. Constitution and spec check

- The spec rules: every item below maps to an FR; anything not in the spec is listed in "Decisions to confirm".
- Tests as a gate: Vitest, offline, run with `pnpm test:run`; no wave is closed with a red test.

## 2. What the legacy project does (reference, not code to copy)

- Each source is one module that exports its `id`, its `kind` (feed, careers, portal…), its `licence` (name, short name, url, licence text, credit line, whether it needs a key) and `fetchAll(ctx)`, an async generator that yields adverts. Parsing is split into pure functions that tests feed with saved responses.
- An advert carries: source, source id, title, company, location, country, city, remote flag and mode, url, description (length-capped), posted and expiry dates, occupation codes and language.
- Shared pieces live next to the sources (HTTP with pacing, `robots.txt`, entity decoding, page text cleanup), but each adapter still repeats its own XML/JSON picking, date parsing, "robots check then fetch then throw if empty" sequence and field mapping.
- The scheduler (`crawl.mjs`) decides which sources are due, with cadences, backoff, parking and budgets from `crawl.yml`, and pacing per server and per hosting provider.
- Person data in feeds (a named contact with an e-mail) is dropped on purpose.

## 3. Architecture: ports and adapters

Dependencies point inward only: infrastructure → application → domain. The domain imports nothing from the other layers, and nothing outside `storage/` touches files.

| Layer          | Holds                                                                                                                                      | Knows about      |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------- |
| Domain         | Advert, source definition, source state, the rules of "is due", backoff and parking (pure functions)                                       | nothing else     |
| Ports          | `SourceAdapter` (what a source must offer), `AdvertStore` (save, read, drop adverts and source state), `HttpClient`, `Clock`, `StopSwitch` | domain           |
| Application    | The runner: pick due sources, pace and budget requests, call adapters, validate, store, isolate failures, record status                    | domain, ports    |
| Infrastructure | Source adapters grouped by family, the polite HTTP client, file storage, config loading, the entry point                                   | everything above |

The runner never knows a source's site; an adapter never decides when it runs or how fast. That is what removes the repetition (FR-14).

## 4. Proposed layout

```
src/
  schemas/
    advert.ts            # Zod: the common advert (FR-3), licence and credit (FR-4)
    source.ts            # Zod: source definition, state (FR-12)
  crawler/
    domain/              # due, backoff and parking rules, pure
    ports.ts             # SourceAdapter, HttpClient, Clock, StopSwitch
    runner.ts            # application: one run over the due sources
    run.ts               # process entry: wires everything and calls the runner
    status.ts            # prints the status of every source (FR-12)
    http/                # polite client: robots, per-host/server/provider pacing, retries, timeouts, error budget
    kit/                 # shared helpers: entity decoding, text cleanup, date parsing, feed/XML/JSON picking
    families/            # one module per family of sources, built by composition
      public-feed.ts     # feed and open-data sources (waves 1 and 2)
      credentialed.ts    # sources behind a key (wave 3)
      portal.ts          # job portals (wave 4)
      career-site.ts     # sitemap + schema.org JobPosting, and ATS platforms (wave 5)
    adapters/            # one folder per source: adapter + its fixtures-based test
  storage/               # the only module that touches files: AdvertStore implementation
  config/                # sources, cadences, limits, takedowns (data, not code)
test/fixtures/<source>/  # saved responses
```

This matches the target layout already in `CLAUDE.md`; `domain/`, `http/`, `kit/` and `families/` are new sub-folders of `crawler/`.

## 5. Contracts

**SourceAdapter** (port). Each source provides: an id; its kind; its licence data (name, short name, url, licence text, credit line); whether it needs credentials and which; and a way to produce adverts from its site through the injected `HttpClient`. Parsing is a pure function from a saved response to raw adverts, so tests need no network.

**Advert** (Zod, the single source of truth): source id, stable advert id derived from source and source-specific id, title, company, location, country, city, remote flag and mode, url, description (length-capped), posted date, expiry date (optional), occupation codes, original language, and the licence and credit of its source. No person data. The shape is exposed in the OpenAPI contract when the HTTP layer needs it, so the pile build can rely on it (completion criteria).

**Source state**: enabled, disabled (missing credentials or flagged as broken), failed (with reason), disallowed (by `robots.txt`), parked (until a date); time of last run; adverts obtained; consecutive failures; next due time.

**Run result**: per source, the outcome, the counts, the rejected adverts with their reasons.

## 6. Behaviour of the runner

- **Due selection (FR-8):** a source is due when its last pass is older than its cadence; unchanged sources wait longer, up to a limit, and go back to normal when they change. Cadence per source starts from the legacy `crawl.yml` values.
- **Politeness (FR-7):** `robots.txt` is checked before the first request to a host and cached; pacing per host, per server and per hosting provider; caps on simultaneous and new connections; a small budget of error answers per server in a time window. Defaults and per-source overrides come from `config/`.
- **Failure isolation (FR-5, FR-6):** every source runs inside its own failure boundary; a failure records the reason, schedules the next try with growing waits and parks the source after repeated failures. Stored adverts are only replaced after a source finished a valid read, so a failed or empty read never deletes anything.
- **Validation (FR-3):** every raw advert is parsed with the Zod schema; invalid ones are counted with a reason and not stored.
- **Stop switch (FR-9):** checked between requests and between sources; activating it stops new work and leaves stored data untouched. (file flag, see section 10).
- **Takedowns (FR-10):** loaded from `config/`; applied when collecting and when keeping, so a takedown also removes what is already stored on the next run.
- **Credentials (FR-11):** read from environment variables only; a source with missing keys is disabled and reported; keys are listed in `.env.example` and never logged.
- **Status (FR-12):** a command prints state, last run and counts for every source.
- **Boundary (FR-13):** the runner ends at "validated adverts stored"; no gate, dedupe, translation or shards.

## 7. Storage

Behind `AdvertStore`: adverts and source state kept as files, one set per source, written atomically (write to a temporary file, then rename). Because the spec keeps adverts without expiry forever, the store never deletes by age; it only replaces a source's set after a valid read or removes it by takedown. A database can replace the implementation later without touching the runner.

## 8. Waves (FR-2) and tasks

1. **Core + reference feed.** Schemas, ports, domain rules, runner, polite client, file storage, status command, stop switch, takedowns, plus one open-data feed as the reference adapter with its fixture test.
2. **Public employment-service feeds.** One adapter per feed on the `public-feed` family; each with a fixture test. Ported in small batches grouped by response format (XML, JSON, paged HTML).
3. **Credentialed sources.** Ported with tests, delivered disabled until the key exists.
4. **Job portals.** `portal` family: many pages per run, backlog handling.
5. **Career sites and ATS platforms.** `career-site` family driven by the source lists (data, not one module per employer); platform groups share one host, so they use the per-server pacing.

Each wave ends with: all its adapters pass offline tests, `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test:run && pnpm build` is green, `MEMORY.md` is updated.

## 9. Test strategy

- Per adapter: parser tests over saved responses in `test/fixtures/<source>/`, plus a check that a changed or empty response is reported as a failure.
- One shared contract test that every registered adapter must pass: valid licence data, valid adverts, no person data.
- Runner tests with a fake clock and a fake `HttpClient`: due selection, backoff and parking, failure isolation, keeping previous adverts, stop switch, takedowns, disabled sources, `robots.txt`, pacing.
- Storage tests on a temporary folder: atomic writes and replacement rules.
- No test touches the network.

## 10. Decisions (confirmed)

- **Config format:** YAML for the lists ported from the legacy repo (source lists, cadences, limits, takedowns), validated with Zod on load. Needs a small YAML dependency.
- **Parsing approach:** one well-known HTML/XML parsing library instead of hand-written extraction, to avoid the repetition of the legacy adapters.
- **Stop switch:** a file flag next to the stored state, so it works across processes without a restart.
- **Entry points:** `pnpm crawl` (a run), `pnpm crawl:status`, and a way to run a single source for debugging.
- **Scheduling:** same as the legacy: the process is started every hour by an external scheduler (cron in the container) and decides what is due.
- **Career sites:** the thousands of employers' sites are ported as data (lists), not as one module per employer.

## 11. Documentation updates when implemented

- `AGENTS.md`: nothing permanent changes except, if approved, a short rule that adapters only fetch and parse and that all shared behaviour lives in the runner and the kit.
- `CLAUDE.md`: new commands (`crawl`, `crawl:status`), the real layout and the new dependencies.
- `MEMORY.md`: state per wave, the decisions of section 10 with their why, mistakes found.
- `.env.example`: one entry per credentialed source.
