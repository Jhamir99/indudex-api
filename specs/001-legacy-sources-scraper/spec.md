# Spec 001 — Legacy sources scraper

Status: draft. Written from the initial idea and five clarifying answers.

## 1. Context and goal

Indudex publishes job adverts for engineers and technicians in Europe. The adverts come from many public sources: employment services, ATS APIs, employers' career pages and partner feeds. The legacy project (`JustJans/indudex`) already collects them with about fifty source-specific collectors, but its structure is poor: much of the code is repeated between sources and it is hard to follow.

**Goal:** bring every source of the legacy project into this backend as a scraper that is polite, resilient and consistent, and that hands clean adverts to the rest of the pipeline. Where the legacy code is repetitive, the common behaviour is expressed once instead of per source.

**Why:** without sources there is no pile to serve. A consistent scraper lets new sources be added cheaply and keeps every source's licence and attribution attached to its adverts, as the product promises.

## 2. Users

- **Operator** (the maintainer): runs and monitors the scraper, enables sources, stops it, answers takedown requests.
- **Pile build** (downstream process): consumes the validated adverts to gate, deduplicate, translate and publish them.
- **Visitor** (indirect): sees adverts and the attribution each source requires, without ever being tracked.

## 3. User stories

- As the operator, I want every source of the legacy project available so that the pile is as complete as it was before.
- As the operator, I want one source's failure not to affect the others so that a single broken site never stops the run.
- As the operator, I want to see the status of each source, and why it failed or is disabled, so that I know what needs attention.
- As the operator, I want to stop all scraping at once so that I can react to a complaint or an incident.
- As the pile build, I want adverts in one common validated format so that I do not need to know about each source.
- As a visitor, I want the required attribution (for example "Jobs by Adzuna") shown with each advert so that sources are credited as their licence requires.

## 4. Functional requirements

**FR-1 — Coverage.**
The scraper shall support every source present in the legacy project.
_Acceptance:_ For each legacy source there is a corresponding source here, each one verified against a saved sample of that source's real response. (Sources whose code the legacy project keeps for several sites, such as career pages and portals, count as one source per site.)

**FR-2 — Delivery in waves.**
The sources shall be delivered in ordered waves: first the shared behaviour with one reference source, then the remaining sources in groups.
The waves, in order, group sources by type:

1. The shared behaviour plus one reference public employment-service feed.
2. The remaining public employment-service feeds and open-data feeds.
3. Sources that need credentials (delivered disabled until the credentials exist, see FR-11).
4. Job portals.
5. Employers' career sites and applicant-tracking platforms.

_Acceptance:_ When a wave is completed, then all its sources meet FR-3 to FR-12 and the next wave may start. The spec is complete when all waves are complete.

**FR-3 — Common advert format.**
When a source returns an advert, the scraper shall convert it to the common advert format and validate it.
_Acceptance:_ While an advert fails validation, the scraper shall not store it and shall record the reason against its source.

**FR-4 — Attribution and licence.**
When the scraper stores an advert, it shall store with it the licence and the required attribution of its source.
_Acceptance:_ Every stored advert exposes its source's licence and attribution text, or an explicit "none required".

**FR-5 — Failure isolation.**
If a source fails (network error, error response, changed format, blocked access), then the scraper shall mark that source as failed with the reason, and shall continue with the other sources.
If a source keeps failing, then the scraper shall wait longer before each new attempt and, after repeated failures, shall park the source for a long period instead of retrying it every run.
_Acceptance:_ A failing source never prevents another source from running, and the run finishes. A parked source makes no request until its waiting period ends. The waiting periods start from the legacy project's values (about 1, 3 and 7 days between attempts, parked for about a month after 6 consecutive failures).

**FR-6 — Keep previous adverts on failure.**
If a source fails, then the scraper shall keep the adverts already stored from it until each one expires (by its own date, or 2 years after it was posted when it has none).
_Acceptance:_ After a failed run, adverts from before the failure are still present and unchanged.

**FR-7 — Politeness.**
The scraper shall obey each site's `robots.txt` and shall limit the request rate per host.
_Acceptance:_ The per-host limits are configurable and start from the legacy project's values (about 5 seconds between requests to one server, one request at a time, and a slower pace for hosting providers that block in bulk). The limits also cap the total number of simultaneous connections and the rate of new connections. If `robots.txt` forbids a page, then the scraper shall not request it and shall record the source or page as disallowed. Requests to one host never exceed that host's configured rate.

**FR-8 — Cadence.**
Each source shall have its own run cadence.
Cadence is configurable per source and starts from the legacy project's value for that source (one run a day by default, shorter where a source's terms require it, longer for sources that rarely change). A source that comes back unchanged waits longer before its next run, up to a limit, and returns to its normal cadence as soon as it changes.
_Acceptance:_ When a source is not yet due, the scraper shall skip it; when it is due, the scraper shall run it.

**FR-9 — Manual stop.**
When the operator activates the stop switch, the scraper shall stop starting new requests and shall not begin new source runs until it is released.
_Acceptance:_ After activation, no new request leaves the scraper; stored data is not corrupted.

**FR-10 — Takedowns.**
While a takedown is registered for a source, company or advert, the scraper shall neither collect nor keep what it covers.
_Acceptance:_ Adverts covered by a takedown are absent from the output after the next run.

**FR-11 — Credentials and disabled sources.**
Where a source needs credentials that are missing, the scraper shall keep the source disabled and shall report in the status that its credentials are missing.
_Acceptance:_ A disabled source makes no request. When the credentials are provided, the source becomes enabled without any other change. No credential is ever stored in the repository or exposed in logs or output.

**FR-12 — Source status.**
The scraper shall record, for each source, its state (enabled, disabled, failed, disallowed), the time of its last run and the number of adverts obtained.
_Acceptance:_ The operator can read the status of every source after a run.

**FR-13 — Boundary with the pile build.**
The scraper shall stop at validated, stored adverts. Gate, deduplication, translation and shard generation are not part of it.
_Acceptance:_ The scraper's output is consumable by those later stages through the common advert format alone.

**FR-14 — Consistency instead of repetition.**
Behaviour shared by sources (fetching politely, retrying, error handling, validation, attribution) shall exist once and be shared.
_Acceptance:_ Adding a new source requires describing only what is specific to that source.

## 5. Non-functional requirements

- **Privacy:** the scraper shall handle only public advert data and shall never collect or store anything about visitors.
- **Legality:** only documented public APIs, employers' own pages and partner feeds whose terms allow republishing are used. No LinkedIn and no commercial job boards.
- **Testability:** every source is covered by tests that run offline against saved sample responses; no test needs the network.
- **Observability:** logs shall describe what happened per source (state, counts, reasons) and shall not contain credentials.
- **Resilience:** a run shall always finish, even if every source fails.
- **Maintainability:** the structure is easier to follow than the legacy one. The structuring pattern is decided in the plan.

## 6. Edge cases

- A source changes its format without notice: its adverts fail validation, the source is marked failed, previous adverts are kept.
- A source returns zero adverts: this is reported and does not delete previous adverts.
- A source is slow or never answers: the request ends after a limit and counts as a failure.
- An advert has no expiry date: it is treated as expiring 2 years after its posted date (after the date it was first seen, if the source gives no posted date).
- The same advert appears in two sources: both are stored; removing duplicates belongs to the pile build.
- A site forbids scraping in `robots.txt` after we started collecting from it: the source becomes disallowed at the next run.
- A required credential is revoked or expires: the source is marked failed (not silently disabled) and previous adverts are kept.
- The stop switch is activated during a run: in-flight work finishes cleanly or is discarded without corrupting stored data.
- A legacy source no longer works at all: it is ported anyway, disabled and flagged, so the operator can decide whether to drop it.

## 7. Out of scope

- Gate (occupation, geography and expiry filtering), deduplication, translation and shard or index generation.
- Serving adverts over HTTP and any frontend behaviour.
- Choosing the long-term storage technology.
- Obtaining API keys or partner agreements.
- Any feature about the user (profiles, CVs, accounts, tracking).
- New sources that do not exist in the legacy project.

## 8. Completion criteria

- Every legacy source exists here, enabled or, if it lacks credentials, disabled with a clear status.
- Every source passes its offline test against a saved sample.
- A run with a deliberately broken source finishes and keeps that source's previous adverts.
- The stop switch, takedowns, `robots.txt` and rate limits are demonstrated by tests.
- The common advert format is documented in the API contract so the pile build can rely on it.
- No credential appears in the repository.

## 9. Open questions

- None at the moment.
