# Tasks 001 — Legacy sources scraper

Generated from `spec.md` and `plan.md`. Tasks are ordered by dependency, name the functional requirements (FR) they cover and have a verifiable "Done when". Tick the box only when the "Done when" is true. Small steps were merged to keep the list short, so some tasks take 40-60 minutes and each adapter batch about 75; split a task if it does not fit in one sitting.

**Adapter task.** Porting one legacy source means: read its legacy module for behaviour, save real responses under `test/fixtures/<id>/` (for credentialed sources, build them from the provider's documented response), write the adapter under `src/crawler/adapters/<id>/` on its family, and register it with its cadence in `config/`. The **standard adapter check** is: (A) `pnpm vitest run src/crawler/adapters/<id>` passes — the fixture parses into valid adverts and an empty or changed response is reported as a failure; (B) the shared contract test passes with it registered; (C) `pnpm lint && pnpm typecheck` is clean.

**Batches.** The wave 2 batches are grouped by region as a starting point. When reading the legacy modules, regroup them by response format (XML, JSON, paged HTML) and move any source that needs a key to wave 3 or is a portal to wave 4.

**Dependencies.** Waves are sequential; inside a wave, tasks follow the "Depends" order.

## Wave 1 — Core and reference feed

- [ ] **T001 — Choose and install the YAML and HTML/XML libraries** · FR: — (enabler)
      Done when: the two libraries are named in `MEMORY.md` with the reason for each, you approved them, and `pnpm install && pnpm build` and `pnpm why typescript` (one version) are still green.
- [ ] **T002 — Schemas: advert, source definition and source state** · FR: FR-3, FR-4, FR-11, FR-12 · Depends: T001
      Done when: `src/schemas/*.test.ts` pass: a complete advert is accepted; missing title, non-HTTPS url, bad date and missing licence/credit are rejected with a reason; the advert has no field for a contact person or e-mail; a source definition without licence data or credentials flag is rejected; the state accepts enabled, disabled, failed, disallowed and parked with last-run time, advert count, consecutive failures, next-due time and a reason.
- [ ] **T003 — Ports: SourceAdapter, AdvertStore, HttpClient, Clock, StopSwitch** · FR: FR-14 · Depends: T002
      Done when: `src/crawler/ports.ts` compiles under `pnpm typecheck`, and an in-memory fake of each port exists under `test/` and type-checks.
- [ ] **T004 — Domain rules: due, unchanged wait, backoff and parking** · FR: FR-5, FR-8 · Depends: T002
      Done when: pure-function tests with a fake clock pass for: never run or older than cadence → due, newer → not due; each unchanged pass lengthens the wait up to the limit and a change resets it; waits of 24, 72 and 168 h after consecutive failures; parked for about a month after 6 failures; a success resets the count.
- [ ] **T005 — Kit: text cleanup, date parsing and XML/JSON picking** · FR: FR-14 · Depends: T001
      Done when: `src/crawler/kit/*.test.ts` pass: entities decoded, tags stripped, text capped at the description limit; the legacy date formats (ISO, `dd.mm.yyyy`, with time) parse and invalid input returns nothing; repeated elements and fields are picked from sample XML (with CDATA) and JSON, with missing fields handled.
- [ ] **T006 — Config loader: YAML read and validated with Zod** · FR: FR-7, FR-8 · Depends: T001
      Done when: tests pass: a valid file loads; an unknown key or wrong type fails with the path of the error; no file is read outside `config/`.
- [ ] **T007 — Config: default cadence, backoff and limits from the legacy values** · FR: FR-5, FR-7, FR-8 · Depends: T006
      Done when: `config/crawl.yml` holds the legacy defaults (daily cadence, 1 h for NAV, 24/72/168 h backoff, park after 6, 5 s per server, 3 s per provider, 16 connections, 2 new a second) with a header crediting the legacy project, and a test loads it successfully.
- [ ] **T008 — Config: takedowns loader** · FR: FR-10 · Depends: T006
      Done when: tests pass: takedowns for a source, a company and an advert are loaded and matched against sample adverts.
- [ ] **T009 — Storage: atomic file writer** · FR: FR-6
      Done when: `src/storage/atomic.test.ts` passes on a temporary folder: a write either completes or leaves the old file intact (simulated failure between temp write and rename).
- [ ] **T010 — Storage: AdvertStore and source state persistence** · FR: FR-6, FR-12, FR-13 · Depends: T003, T009
      Done when: tests pass: saving replaces that source's set; an empty or failed read leaves it unchanged; other sources are untouched; an advert without expiry date is kept until 2 years after its posted date (first-seen date if none) and then dropped; an advert with an expiry date is dropped after it; a failed or empty read deletes nothing; state is written and read back for several sources; a corrupt file is reported, not silently reset.
- [ ] **T011 — HTTP client: timeout, retries, error classification** · FR: FR-5 · Depends: T003
      Done when: tests with a fake server pass: a slow response times out, a 5xx is retried a limited number of times, a 4xx is not retried, each ends as a typed failure.
- [ ] **T012 — HTTP client: robots.txt check with cache** · FR: FR-7 · Depends: T011
      Done when: tests pass: a disallowed path is never requested and is reported as disallowed; robots.txt is fetched once per host per run.
- [ ] **T013 — HTTP client: per-host, per-server and per-provider pacing** · FR: FR-7 · Depends: T011
      Done when: tests with a fake clock pass: consecutive requests to one host are at least the configured gap apart; different hosts do not wait for each other; hosts on one server share one gap and one request at a time; providers on the configured list are paced together.
- [ ] **T014 — HTTP client: connection caps and error budget** · FR: FR-7 · Depends: T013
      Done when: tests pass: never more than the configured simultaneous and new-per-second connections; a server that answers more 4xx than its budget in the window is asked nothing more until the window passes.
- [ ] **T015 — Stop switch: file flag** · FR: FR-9 · Depends: T003
      Done when: tests pass on a temporary folder: creating the flag file makes the switch read as active, removing it releases; the flag is read without restarting anything.
- [ ] **T016 — Credentials from the environment; disabled state; .env.example** · FR: FR-11 · Depends: T002
      Done when: tests pass: a source with a missing variable reports disabled with the variable's name (never its value); `.env.example` lists every credentialed source's variable; a grep for key-like strings in the repo finds none.
- [ ] **T017 — Runner: run one source, validate, store** · FR: FR-3, FR-13 · Depends: T003, T002, T010
      Done when: tests with fakes pass: valid adverts are stored; an invalid one is counted with its reason and not stored; the runner calls nothing beyond store.
- [ ] **T018 — Runner: failure isolation and keeping previous adverts** · FR: FR-5, FR-6 · Depends: T017
      Done when: tests pass: a throwing source is marked failed with its reason; the next source still runs; previous adverts remain unchanged; a read of zero adverts is reported and deletes nothing.
- [ ] **T019 — Runner: scheduling (due sources, backoff and parking)** · FR: FR-5, FR-8 · Depends: T018, T004
      Done when: tests with a fake clock pass: only due sources run, in a stable order, the others without a request; a failed source gets the next wait; a parked source makes no request until its period ends.
- [ ] **T020 — Runner: gates (takedowns, stop switch, disabled and disallowed sources)** · FR: FR-7, FR-9, FR-10, FR-11 · Depends: T017, T008, T015, T012, T016
      Done when: tests pass: adverts covered by a takedown are neither collected nor kept, including stored ones; after the flag appears no new request or source run starts and stored data is unchanged; a disabled source makes zero requests; a source blocked by robots.txt ends as disallowed.
- [ ] **T021 — Runner: a run always finishes** · FR: FR-5 · Depends: T019, T020
      Done when: a test where every source fails ends with all of them marked failed and the run returning normally.
- [ ] **T022 — Status command** · FR: FR-12 · Depends: T010, T019
      Done when: `pnpm crawl:status` prints, for each source, state, last run, advert count and reason, and a test covers the formatter with a mix of states.
- [ ] **T023 — Entry point `crawl` with single-source option** · FR: FR-8 · Depends: T021, T022
      Done when: `pnpm crawl -- --source <id>` runs only that source on fakes in an integration test, and `pnpm crawl` is wired in `package.json` (documented in `CLAUDE.md`).
- [ ] **T024 — Shared contract test for adapters** · FR: FR-3, FR-4, FR-14 · Depends: T002
      Done when: a test iterates over every registered adapter and checks valid licence data, valid adverts from its fixture and no e-mail or contact field in any advert.
- [ ] **T025 — Family `public-feed` extracted from the reference feed** · FR: FR-14 · Depends: T005, T012
      Done when: the family offers robots check, fetch, empty-feed failure and field mapping once, and a source using it only provides its url, licence and field mapping.
- [ ] **T026 — Reference adapter: brz (open-data feed)** · FR: FR-1, FR-3, FR-4 · Depends: T025, T024
      Done when: the standard adapter check passes for it (see "Adapter task" above).
- [ ] **T027 — Close wave 1** · FR: FR-2 · Depends: T026, T023
      Done when: `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test:run && pnpm build` is green; `MEMORY.md`, `CLAUDE.md` (commands, layout) and `.env.example` are updated; each of FR-3 to FR-12 has a test that names it.

## Wave 2 — Public employment-service and open-data feeds

- [ ] **T028 — Port adapters: nav, jobindex, island** · FR: FR-1, FR-3, FR-4 · Depends: T027
      Done when: the standard adapter check passes for each adapter (see "Adapter task" above). NAV cadence is 1 h in its config entry (its terms retire inactive ads at once). `jobindex` cadence is 1 h.
- [ ] **T029 — Port adapters: kuntarekry, valtiolle, jobtech** · FR: FR-1, FR-3, FR-4 · Depends: T027
      Done when: the standard adapter check passes for each adapter (see "Adapter task" above).
- [ ] **T030 — Port adapters: infopraca, solidjobs, mpsv** · FR: FR-1, FR-3, FR-4 · Depends: T027
      Done when: the standard adapter check passes for each adapter (see "Adapter task" above).
- [ ] **T031 — Port adapters: nva, upsvr, hungary** · FR: FR-1, FR-3, FR-4 · Depends: T027
      Done when: the standard adapter check passes for each adapter (see "Adapter task" above). `hungary` reads one category per pass, about a dozen requests.
- [ ] **T032 — Port adapters: hzz, anofm, cyprus** · FR: FR-1, FR-3, FR-4 · Depends: T027
      Done when: the standard adapter check passes for each adapter (see "Adapter task" above).
- [ ] **T033 — Port adapters: iefp, netempregos, sef** · FR: FR-1, FR-3, FR-4 · Depends: T027
      Done when: the standard adapter check passes for each adapter (see "Adapter task" above).
- [ ] **T034 — Port adapters: sne, spin, ttvic** · FR: FR-1, FR-3, FR-4 · Depends: T027
      Done when: the standard adapter check passes for each adapter (see "Adapter task" above).
- [ ] **T035 — Port adapters: brandenburg, bund, karrierenrw** · FR: FR-1, FR-3, FR-4 · Depends: T027
      Done when: the standard adapter check passes for each adapter (see "Adapter task" above). `bund` waits 30 s between pages (its robots.txt asks for it).
- [ ] **T036 — Port adapters: linz, ooe, ifgat** · FR: FR-1, FR-3, FR-4 · Depends: T027
      Done when: the standard adapter check passes for each adapter (see "Adapter task" above).
- [ ] **T037 — Port adapters: actiris, forem, vdab** · FR: FR-1, FR-3, FR-4 · Depends: T027
      Done when: the standard adapter check passes for each adapter (see "Adapter task" above).
- [ ] **T038 — Port adapters: emilia, trento, brescia** · FR: FR-1, FR-3, FR-4 · Depends: T027
      Done when: the standard adapter check passes for each adapter (see "Adapter task" above).
- [ ] **T039 — Port adapters: bolzano, uzt, lanbide** · FR: FR-1, FR-3, FR-4 · Depends: T027
      Done when: the standard adapter check passes for each adapter (see "Adapter task" above).
- [ ] **T040 — Port adapters: sae, madrid, jcyl** · FR: FR-1, FR-3, FR-4 · Depends: T027
      Done when: the standard adapter check passes for each adapter (see "Adapter task" above).
- [ ] **T041 — Port adapters: clm, emcan, gencat** · FR: FR-1, FR-3, FR-4 · Depends: T027
      Done when: the standard adapter check passes for each adapter (see "Adapter task" above).
- [ ] **T042 — Port adapters: feinaactiva, escoladeltreball** · FR: FR-1, FR-3, FR-4 · Depends: T027
      Done when: the standard adapter check passes for each adapter (see "Adapter task" above).
- [ ] **T043 — Close wave 2** · FR: FR-2 · Depends: all wave 2 batches
      Done when: every wave 2 adapter passes the contract test and the CI command is green; the list of ported sources in `MEMORY.md` is up to date.

## Wave 3 — Sources that need credentials (delivered disabled)

- [ ] **T044 — Family `credentialed`: key check and disabled reporting** · FR: FR-11, FR-14 · Depends: T043, T016
      Done when: a source on this family with a missing variable reports disabled and makes zero requests (fake HttpClient counts calls); with a fake value set in the test, it runs.
- [ ] **T045 — Port adapters: adzuna, jooble, francetravail (disabled until keyed)** · FR: FR-1, FR-3, FR-4, FR-11 · Depends: T044
      Done when: the standard adapter check passes for each adapter (see "Adapter task" above), and with no key each source is reported disabled. `francetravail` cadence is 1 h, a seventh of its listings per pass.
- [ ] **T046 — Move any other keyed legacy source found while porting into this wave** · FR: FR-1, FR-11 · Depends: T044
      Done when: every adapter that turned out to need a key is on the `credentialed` family and covered by the disabled-without-key test (or the task is closed with "none found").
- [ ] **T047 — Close wave 3** · FR: FR-2 · Depends: T045, T046
      Done when: status shows every credentialed source as disabled when no key is set; the CI command is green; `.env.example` is complete.

## Wave 4 — Job portals

- [ ] **T048 — Family `portal`: many pages per run, backlog, per-page pacing** · FR: FR-7, FR-8, FR-14 · Depends: T047
      Done when: tests pass: a portal with pages left to read is due again in the next run; the page budget per run and per site is respected; pacing is a page a second per host.
- [ ] **T049 — Import the legacy portal list as data** · FR: FR-1, FR-14 · Depends: T048
      Done when: `config/portals.yml` loads and validates; its header credits the legacy project; each entry runs through the family against a fixture in a test.
- [ ] **T050 — Port adapters: boards, jobfeed, remote (classify first)** · FR: FR-1, FR-3, FR-4 · Depends: T048
      Done when: each legacy file was read and the task notes whether it belongs to this wave or another; the standard adapter check passes for each adapter (see "Adapter task" above).
- [ ] **T051 — Close wave 4** · FR: FR-2 · Depends: T049, T050
      Done when: every portal source passes the contract test and the CI command is green.

## Wave 5 — Employers' career sites and ATS platforms

- [ ] **T052 — Family `career-site`: sitemap discovery honouring robots.txt** · FR: FR-7, FR-14 · Depends: T051
      Done when: tests pass on a sample sitemap: URLs are discovered, disallowed ones are skipped, and a per-site page cap per pass is respected.
- [ ] **T053 — Career-site extraction of schema.org JobPosting** · FR: FR-3, FR-14 · Depends: T052
      Done when: fixture pages with one and several JobPosting blocks produce valid adverts; a page without one is counted as barren and the site's cadence becomes the barren one (weekly).
- [ ] **T054 — Import employers' source lists as data** · FR: FR-1, FR-14 · Depends: T053
      Done when: `config/careers.yml` and `config/companies.yml` load and validate; headers credit the legacy project; a test covers a sample of entries; the number of loaded entries matches the legacy lists.
- [ ] **T055 — Cap on never-read sources per run** · FR: FR-7, FR-8 · Depends: T054
      Done when: a test with many new sources shows only the configured number are first-read in one run.
- [ ] **T056 — ATS platform groups sharing one host** · FR: FR-7, FR-14 · Depends: T054
      Done when: tests pass: sources of one platform share the in-flight limit and the per-server gap; a group limit such as eight calls an hour is respected.
- [ ] **T057 — Port ATS platforms: hrmanager, join, manatal** · FR: FR-1, FR-3, FR-4 · Depends: T056
      Done when: the standard adapter check passes for each adapter (see "Adapter task" above), and each platform's group limit from `crawl.yml` is applied.
- [ ] **T058 — Port remaining platforms and vendors from the legacy lists** · FR: FR-1 · Depends: T056
      Done when: every platform in the legacy platform and vendor lists has an entry, an adapter or an explicit "disabled and flagged" status, and the list is checked in a test.
- [ ] **T059 — Flag broken legacy sources** · FR: FR-1 · Depends: T054
      Done when: every legacy source that no longer works is registered disabled with the flag shown in `crawl:status`.
- [ ] **T060 — End-to-end run on fixtures** · FR: FR-5, FR-6, FR-9, FR-10 · Depends: T057, T058, T059
      Done when: one integration test runs sources of every family on fakes with a broken source, a takedown and the stop flag, and the run finishes with the expected states and stored adverts.
- [ ] **T061 — Close wave 5 and verify the spec** · FR: FR-1 to FR-14 · Depends: T060, T055
      Done when: each completion criterion of the spec is checked: every legacy source present, offline tests green, broken-source run keeps adverts, stop switch/takedowns/robots/limits demonstrated, common advert format documented, no credential in the repo (grep).
- [ ] **T062 — Final documentation update** · FR: — · Depends: T061
      Done when: `AGENTS.md` (adapter rule), `CLAUDE.md` (commands, layout, dependencies) and `MEMORY.md` (state, decisions, mistakes; under ~50 lines) are updated.
