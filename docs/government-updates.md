# Government updates: official CUET notices

**Date:** 13 November 2026. Local development only; nothing is deployed, and fetching is off in the production configuration.

## What it does

A scheduled job reads NTA's public notice pages, stores each notice's title, date, category and official addresses, and shows them to students under "Latest government updates". Documents are never copied or hosted: every link opens NTA's own website.

## Sources connected

| Source | Address | What is read |
|---|---|---|
| NTA, CUET (UG) public notices | `https://cuet.nta.nic.in/document-category/public-notice/` (and its page 2) | The notices table |
| NTA, CUET (PG) website | `https://exams.nta.nic.in/cuet-pg/` | The notice links on the home page |
| NTA notice board | `https://nta.ac.in/NoticeBoardArchive` | Rows that mention CUET; other exams are ignored |
| UGC, notices on the home page | `https://www.ugc.gov.in/` | Every entry of the three blocks, with its printed date (authority UGC) |
| UGC, notices archive | `https://www.ugc.gov.in/Notices` | The archive's rows, read from the page's own data call (see below) |
| UGC, circulars archive | `https://www.ugc.gov.in/Circulars` | Same, for circulars |
| UGC DEB, notice board | `https://deb.ugc.ac.in/Notices/Index` | The Distance Education Bureau's notice board (open, distance and online programmes) |

None of these sites offers an API or a working feed (the CUET site's feed answers 503 and its REST interface says "REST API is disabled"), so the public pages are read. Each site's robots rules allow these pages (`nta.ac.in` has no robots file). The job names itself honestly (`cuet-prep-notice-monitor`), reads four pages per run (plus the three UGC data calls when they are due), and works around nothing.

**UGC (added 16 November 2026).** UGC's home page, `https://www.ugc.gov.in/`, lists its Notices, Circulars and International Cooperation items, each with a link to a PDF on `ugc.gov.in` and a printed date ("Published on : DD/MM/YYYY"). It is the only confirmed feed: the "Read More" archive pages (`/Notices`, `/Circulars`) return empty tables to a plain page read (probably filled in by script), and `deb.ugc.ac.in` showed no entries, so neither is read. UGC has no robots.txt (the address returns a web page). UGC says its official notifications appear only on `ugc.gov.in` and, for distance and online programmes, `deb.ugc.ac.in`. The reader keeps the newest ~20 per block that the page shows; older items than 400 days are dropped.

**UGC archives and the Distance Education Bureau (added 18 November 2026).** The archive pages are empty tables until the page's own script asks the site for the rows (`POST /Notices/Fill_Notices`, `POST /Circulars/Fill_Circulars`; for the DEB board `POST /Notices/Select_AllNotification`). The reader makes the same call and takes the same rows. Neither site has a robots file or a public API; these calls are undocumented, so a change of format is reported as a failed source, never as "no notices". Facts from the first read: the notices archive holds about 2,900 entries (about 140 in the last 400 days); the circulars archive's newest entry is from November 2024, so it adds nothing recent; the DEB board has 185 entries (about 26 recent).

- The archives are read at most once a day (the notices answer is about 3 MB); the DEB board every 12 hours.
- **The source that finds a notice first keeps it.** The home page is read first, and the archive never rewrites a notice the home page found, so two listings that word a title differently cannot flip it back and forth.
- An archive entry with no date (UGC marks it 1900-01-01) is not collected. Several files under one entry: the first file is the notice, the others are named in its description.
- DEB dates are printed ("31 August 2026") and each file name carries its upload date. A notice is often dated before it was uploaded, but never after, so a printed date more than 7 days after the upload, or more than 180 days before it (for example a wrong year), is treated as unreadable and the notice waits for a person. A DEB row with no file, and its sub-notices, are not read.
- Auto-publish rules are unchanged: https, the document on `ugc.gov.in` or `ugc.ac.in`, a readable date, a real title. Old `http://www.ugc.ac.in/...` addresses in the archive therefore go to **Awaiting verification**.

UGC notices are not examination notices: they have an **authority** (`UGC`) and no exam. The home page prints entries with unquoted `href` attributes, which the reader handles.

## Schedule

- A cron trigger runs every 30 minutes and checks which sources are due.
- Each source is read every `NOTICE_FETCH_MINUTES` (default 180; allowed 15 to 1440).
- A source that fails is tried again after 15 minutes, then 30, 60 and so on up to a day. One failing source never stops the others. A page that loads but no longer has the expected layout counts as a failure, never as "no notices".
- `NOTICE_FETCH` must be `on`. It is `on` in local development and `off` in the production configuration, where no cron is set either.
- On a local machine cron triggers do not fire by themselves. Use **Check now** in the admin console, or call `/cdn-cgi/handler/scheduled` on the local server.

## Rules, all fixed (no AI)

| Question | Rule |
|---|---|
| Is it about CUET? | The two CUET sites: always. The NTA board: the title must name CUET |
| Which exam? | From the site it was listed on; on the NTA board, from "(UG)" or "(PG)" in the title |
| Category | Keywords in the title: admit card, result, answer key, exam schedule, exam city, application, syllabus, advisory; otherwise general |
| Published date | NTA: the date stamped in its own file name (its pages print no date). UGC: the date printed beside each entry |
| Same notice again | One row per official document address. The same title and date found on a second official page is recorded as a duplicate and not shown |
| Changed notice | Same address, different title: the row is updated and marked "Updated" |
| Old notices | Older than 400 days are not collected |

**Published automatically** only when all of these hold:

1. it came from one of the pages above;
2. its document is on the issuing authority's **own** website, over https: NTA's (`nta.ac.in`, `*.nta.nic.in`, `*.gov.in`, `*.nic.in`) for an NTA notice, UGC's (`ugc.gov.in`, `ugc.ac.in`) for a UGC notice (a `gov.in` address is not accepted for UGC);
3. the authority is known and, for NTA, so is the exam (UGC has no exam);
4. its date could be read (NTA: stamped in the file name; UGC: printed beside the entry; a date that does not exist is not guessed);
5. its title is a real title (at least 8 characters and 6 letters; not "Click here", "Read more" or a bare file name).

Anything else goes to **Awaiting verification** in the admin console with the reasons recorded, where a member of staff with publishing rights chooses the exam (NTA) and publishes or rejects it. Staff cannot publish a notice whose title is a link label or whose document is on the wrong website.

**Changes at the source are checked again.** A notice the reader published on its own is run through the same rules whenever its listing changes; if it no longer passes, it goes back to the queue with the reason and leaves the student page. A notice a person published is left to that person.

**Categories.** NTA notices use the examination keywords above. UGC notices use a shorter list of their own (admission, scholarship, regulation, application, advisory, otherwise general), because words such as "challenge" or "fee" mean something different in a UGC letter.

## Where it shows

- Students: `/updates` (filters for NTA and UGC, CUET UG, CUET PG and category; each notice shows its authority, a link to the original document and a link to the official page it was listed on), the dashboard section "Latest government updates", the main menu, and an icon in the header on phones.
- Staff: Admin, "Government updates": last successful fetch, next scheduled fetch, notices collected, new in 7 days, duplicates, failed source checks, awaiting verification, each source's state, and "Check now".

## Parts

| Part | File |
|---|---|
| Tables | migration `0021_gov_notices.sql` (`gov_notices`, `gov_notice_sources`); additive |
| Fetch, rules, lists | `backend/src/services/gov-notices.ts` |
| Schedule | `backend/src/index.ts` (`scheduled`), `backend/wrangler.jsonc` |
| Routes | `GET /api/public/notices`; `/api/console/notices/overview`, `/queue`, `/fetch`, `/:id/decision` |
| Screens | `frontend/src/pages/Updates.tsx`, `frontend/src/admin/Notices.tsx` |
| Tests | `backend/test/gov-notices.test.ts` (the official pages are replaced by fixtures; tests never reach the real sites) |

## Limits to know

- A notice whose file is replaced under the same address with the same title is not detected as changed; only the listing is compared, files are not downloaded.
- The same notice can carry slightly different dates on two NTA pages; then it is shown twice.
- If NTA changes a page's layout, that source reports a failure in the admin console until the reader is adjusted.
- NTA's website says prior permission is required before another site links to it. The existing exam-information pages already link NTA's notices; this feature links more of them. The permission letter is still an open decision.

## Version history, corrigenda and staff actions (migration 0031)

- Every notice keeps its versions (`gov_notice_versions`) and an event trail (`gov_notice_events`): found, changed at the source, taken off show by the reader, published, rejected, flagged, withdrawn. Each event names who did it.
- A title that says corrigendum, addendum, extension, rescheduled, amendment or revised is marked, and linked to the notice it corrects when that notice is held. When the original is not held, the notice says so and links to nothing.
- Each notice records why it counts as official (secure link, document on the authority's own host).
- Staff can publish, reject, flag or withdraw any notice. Flag and withdraw need a reason. A withdrawn notice is never brought back by a later read; only a person can publish it again.
- Admin console: Updates, All notices (filters, history). Sources page (`/admin/registry`) lists every notice source with data type, reliability, update frequency and last check.
- Students see a "Corrigendum" mark, a link to the notice it corrects, a note on the original that it was changed later, and the version history.
