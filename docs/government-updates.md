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

None of these sites offers an API or a working feed (the CUET site's feed answers 503 and its REST interface says "REST API is disabled"), so the public pages are read. Each site's robots rules allow these pages (`nta.ac.in` has no robots file). The job names itself honestly (`cuet-prep-notice-monitor`), reads four pages per run, and works around nothing.

**Not connected:** UGC. The addresses tried on `ugc.gov.in` returned its error page, and no stable public list of notices was found. CUET-specific notices are issued by NTA, which is covered.

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
| Published date | The date stamped in NTA's own file name. The pages print no date |
| Same notice again | One row per official document address. The same title and date found on a second official page is recorded as a duplicate and not shown |
| Changed notice | Same address, different title: the row is updated and marked "Updated" |
| Old notices | Older than 400 days are not collected |

**Published automatically** only when the notice came from one of these pages, its document is on an official host (`nta.ac.in`, `*.nta.nic.in`, `*.gov.in`, `*.nic.in`, over https), its exam is certain and its date could be read. Anything else goes to **Awaiting verification** in the admin console, where a member of staff with publishing rights chooses the exam and publishes or rejects it.

## Where it shows

- Students: `/updates` (filters for CUET UG, CUET PG and category), the dashboard section "Latest government updates", the main menu, and an icon in the header on phones.
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
