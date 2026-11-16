# CUET Prep platform: security and technical audit (read-only)

Date: 2026-11-16. Scope: D:/cuet-platform (backend/src Hono Worker, D1 migrations, R2 handling, frontend, wrangler.jsonc, git tree).
Method: static code reading plus `npm audit --omit=dev`. No file in the repo was changed, no remote system or database was touched, no secret value was printed. `backend/.dev.vars` defines one variable name only: `ADMIN_API_TOKEN` (64 characters; git-ignored at .gitignore:164; never present in git history, only `.dev.vars.example` is tracked).
Paths below are relative to `D:/cuet-platform/backend/src` unless stated. Line numbers are from the files as they stand today.

Legend: PASS = I read the code that enforces it. FINDING = a problem. NOT VERIFIED = cannot be proven from code or needs the live system.

---------------------------------------------------------------------

## 1. Findings table

| ID | Severity | File:line | What is wrong | Exploit or failure scenario | Recommended fix | Type |
|---|---|---|---|---|---|---|
| F-01 | High | routes/public.ts:18-19; services/questions.ts:211-241 | `POST /api/public/questions/:id/evaluate` needs no sign-in and returns `correctOptionPositions`, `correctNumericAnswer` and the full explanation for every PUBLISHED question. `GET /api/public/topics/:id/content` (public.ts ~20-27) lists question ids. The frontend never calls this endpoint (grep of frontend/src: no match). | Anyone can script the whole answer key and explanations without an account. A free student bypasses the plan limits (assertWithinPlan counts sessions only). A student in a timed MOCK_TEST can look up answers from another tab, because question ids are in the session payload. Content theft by a competitor. | Remove the public evaluate route, or require sign-in and an active IN_PROGRESS practice session that contains the question (and only in PRACTICE mode). Keep `getQuestionPublic` only if it is needed. | SAFE_LOCAL_FIX (confirm no external consumer) |
| F-02 | High | services/accounts.ts:48-62 (login); routes/student.ts:59-64 | No login throttling or lockout of any kind. No rate-limit code exists anywhere in backend/src, and wrangler.jsonc declares no rate-limit binding. Each login also costs one PBKDF2 run. | Credential stuffing or password guessing against any email with unlimited attempts; CPU cost amplification (100k-iteration PBKDF2 per request). | Add a D1 counter per (email) and per IP (`cf-connecting-ip`) with a short lockout, plus a Cloudflare WAF rate-limit rule on /api/auth/*. Code part is SAFE_LOCAL_FIX; the Cloudflare rule is external. | SAFE_LOCAL_FIX (code) / NEEDS_APPROVAL (Cloudflare rule) |
| F-03 | High | index.ts:24; lib/auth.ts:19-34; routes/admin.ts (all) | `/api/admin/*` is protected only by one shared static secret (`ADMIN_API_TOKEN`), on the public workers.dev URL, with no IP restriction, no throttle and no per-person identity. With that token one can: grant SUPER_ADMIN to any account (`POST /api/admin/users/roles`, admin.ts:93), create a password-reset link for any account including admins (`POST /api/admin/users/reset-link`, admin.ts:92, the link is returned in the response), create, edit and delete questions and lessons, change publishing state, upload files. The audit actor is `admin:<self-declared x-admin-actor>` (auth.ts:31). docs/security.md itself says production needs Cloudflare Access in front; nothing in the repo enforces it. | If the token leaks (CLI logs, shell history, a laptop) or is guessed, the attacker owns every account and all content with no per-person trail. If the production secret is unset the route answers 503 (safe default). I could not check whether it is set in production. | Put `/api/admin/*` behind Cloudflare Access (service token) or disable the route in production by a switch (for example `ADMIN_API_ENABLED=off` default) and enable it only during an approved import window; rotate the token after each window; add throttling. | NEEDS_APPROVAL (external config and operating decision) |
| F-04 | Medium | frontend/ (no `_headers` file; grep found none); index.ts (no secureHeaders) | No security headers on the app or API: no Content-Security-Policy, no X-Frame-Options or frame-ancestors, no X-Content-Type-Options, no Referrer-Policy, no Permissions-Policy. Only the media and official PDF routes set some (learning.ts:232, practice-centre.ts:645). | The site (sign-in, plans/checkout, admin console) can be framed and clickjacked. No CSP means any future XSS has no second line of defence. | Add `frontend/public/_headers` and Hono `secureHeaders` for /api: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `frame-ancestors 'none'` (and X-Frame-Options DENY), a tested CSP (needs Razorpay checkout script and KaTeX styles allowed), HSTS on the custom domain. | SAFE_LOCAL_FIX |
| F-05 | Medium | routes/console.ts:155, 150-152, 91-92, 94-112, 116-124, 163-168, 178; services/admin-console.ts:195-215 | Many console routes have only the generic gate (any of users:manage, content:write, content:publish, console.ts:38) and no permission check of their own: audit activity feed, reviewer assignments (list, add, remove check in service), notices, admissions lists, past-papers, mock-paper lists, content lists. The activity feed returns `entityLabel` = the student's email for USER entities (admin-console.ts:200-203). | An EDITOR (content:write only) or CONTENT_ADMIN can read the audit log with student emails and staff activity, which they do not need. Not a student-facing leak, but a least-privilege gap that grows with every staff account. | Give each GET its own `needPermission` (activity and assignments: users:manage). | SAFE_LOCAL_FIX |
| F-06 | Medium | services/billing.ts:350-362 | The webhook writes a row to `payment_events` for every request, including ones with a bad signature, keyed by an attacker-chosen `x-razorpay-event-id` (or a hash of the body). Only active when a gateway is ready (production is PAYMENTS_MODE=off, so it answers 404 today). | Once payments are on, anyone can POST unlimited junk with unique event ids and grow the table and D1 write usage. | Verify the signature first; log invalid attempts only in aggregate, or cap them (one row per hour). | SAFE_LOCAL_FIX |
| F-07 | Medium | services/accounts.ts:34; routes/student.ts:53-58 | Account enumeration on sign-up: 409 "An account with this email already exists". Also an address can be registered by someone else, because email verification is not required to use the account. Login (accounts.ts:48-56), forgot-password (student.ts:72-78) are uniform and are fine. | Anyone can test whether a given email has an account. | Answer sign-up uniformly and send an "already registered" email, or accept the risk. It needs email to be on first, and it changes the sign-up experience. | NEEDS_APPROVAL |
| F-08 | Low | services/accounts.ts:14 | PBKDF2-SHA256 with 100,000 iterations, 16-byte random salt per user (accounts.ts:37). OWASP guidance for PBKDF2-SHA256 is 600,000. Cloudflare Workers documents a 100,000-iteration cap for PBKDF2 (NOT VERIFIED here). The `iterations` column is stored per user, so an upgrade path exists, but there is no rehash-on-login code. | Faster offline cracking if the D1 table ever leaks. | Keep, or move to a memory-hard hash (scrypt or Argon2 via WASM) and rehash on successful login. Add a breached-password or common-password check (policy today: 10 to 200 characters only). | NEEDS_APPROVAL |
| F-09 | Low | services/accounts.ts:112-119 (reset); services/email.ts:286-295 (verify) | Reset and verification tokens are SELECTed as unused, then marked used in a later statement without `AND used_at IS NULL` on the UPDATE. | Two parallel requests with the same valid token can both succeed. Needs possession of the token, so impact is small. | Make the first batch statement `UPDATE ... SET used_at=? WHERE id=? AND used_at IS NULL` and abort when `changes()` is 0. | SAFE_LOCAL_FIX |
| F-10 | Low | routes/student.ts (all mutating routes); lib/http.ts:12-20 | CSRF protection rests only on `SameSite=Lax` (student.ts:62). There is no Origin or Sec-Fetch-Site check, and `readJson` accepts any content type (text/plain bodies are parsed). | Today's risk is low, since Lax blocks cross-site POSTs and workers.dev is on the public suffix list. It weakens if the app moves to a domain with sibling subdomains. | Reject mutating requests whose `Origin` is not the app origin and require `content-type: application/json`. | SAFE_LOCAL_FIX |
| F-11 | Low | services/accounts.ts:57-62; no purge code (grep: no `DELETE FROM user_sessions`) | Sessions: fixed 168-hour life, no idle timeout, unlimited concurrent sessions per user, expired and revoked rows never deleted. | Slow table growth; a stolen cookie works for the full 7 days unless the password is changed. | Add a daily purge to the cron; cap sessions per user; optional "sign out everywhere". | SAFE_LOCAL_FIX |
| F-12 | Low | index.ts:18-23 | `/api/health` returns `env` (production or development); `/api/health/db` runs a DB query for anyone, unthrottled. | Information about the environment; free requests that use D1 read quota. | Return `{ok:true}` only; protect or drop `/health/db` (or cache). | SAFE_LOCAL_FIX |
| F-13 | Low | routes/admin.ts:129-131, 141, 147, 149-155 | These routes call `c.req.json()` directly. A malformed body throws a SyntaxError, which the global handler (lib/errors.ts:30-31) turns into a generic 500 and an error log. Token-only routes. | Noise and misleading errors, not a leak. | Use `readJson` or catch parse errors and return 400. | SAFE_LOCAL_FIX |
| F-14 | Low | services/storage.ts:9; routes/admin.ts:56-68 | SVG uploads are allowed and not sanitised; the admin file GET route (admin.ts:62-68) serves them without the CSP sandbox and nosniff headers that the public media route adds. The upload reads the whole body into memory before the size check (admin.ts:60). | Only the token holder can upload, and the public media route is safe (learning.ts:232 sets `sandbox` CSP and nosniff). Remaining risk: script in an SVG opened directly from the admin file URL. | Add the same CSP and nosniff headers to admin.ts:67; check `content-length` before reading. | SAFE_LOCAL_FIX |
| F-15 | Low | services/gov-notices.ts:60, 266-268, 104-111; frontend/src/pages/Updates.tsx:58,77 | Notice fetcher: (a) the NTA allowlist is any `*.gov.in` or `*.nic.in` host; (b) `redirect: 'follow'` makes the request to the redirect target and only then checks `res.url`; (c) scraped hrefs are turned into absolute URLs without an https check, then rendered as `<a href>`. Non-official or non-https links are demoted to NEEDS_REVIEW (gov-notices.ts:334), so a person must approve them. NOTICE_FETCH is off in production. | (a)(b) Blind request to another https host through an open redirect on a gov.in site; the response is not returned, so impact is minimal. (c) A `javascript:` href could reach students only if a reviewer approves it by mistake. | Use `redirect: 'manual'` and re-check each hop; narrow the allowlist to the listed source hosts; reject non-https `documentUrl` in `absolute()` and in the frontend. | SAFE_LOCAL_FIX |
| F-16 | Low | services/practice.ts:19; routes/student.ts:149-153 | (a) `count` allows up to 200 questions, but D1 allows 100 bound variables per statement; `getSession` binds all ids in one `IN (...)` (practice.ts ~120-123), so a large session may be created and consume plan quota but then fail to load (NOT VERIFIED at runtime). (b) `assertWithinPlan` then insert is not atomic. | (a) A student who asks for count 150 gets a broken session. (b) Parallel requests can start a few sessions above the free limit. | (a) Cap `count` at 90 or chunk the queries. (b) Accept, or insert and re-count in one batch. | SAFE_LOCAL_FIX |
| F-17 | Low | services/billing.ts:200-230 | `createOrder` has no throttle. A request without a recent open order inserts a `payment_orders` row and calls Razorpay each time it is not de-duplicated (de-dup needs the same plan and an order that already has a gateway id). Failed attempts leave FAILED rows. | Once payments are on, a signed-in user can spam order rows and gateway calls. | Per-user limit (for example 10 orders per hour). | SAFE_LOCAL_FIX |
| F-18 | Low | services/billing.ts:~395-410 (applyRefund) | Any `refund.processed` webhook for a paid order ends the whole pass and marks the order REFUNDED, even for a partial refund amount. | A partial goodwill refund removes the student's access. | Business rule: compare refund amount to order amount, or only end access on a full refund. | NEEDS_APPROVAL |
| F-19 | Low | services/billing.ts:350-367; routes/public.ts:61 | The webhook accepts any correctly signed body with no timestamp check. Replays are harmless because processing is idempotent (event id unique, `changes()` guard, unique `order_id` on subscriptions). | None found. | None needed; documented for completeness. | Info |
| F-20 | Low | services/accounts.ts (login/logout), services/practice.ts, routes/student.ts | Audit logging covers admin actions well (about 17 services write `audit_logs`), but not sign-in success or failure, sign-up, logout, order creation or session revocation. The audit actor for token calls is self-declared. | After an account takeover there is no sign-in history to investigate. | Log LOGIN_FAILED and LOGIN_OK (without the password), with IP hash, to `audit_logs` or Workers logs. | SAFE_LOCAL_FIX |
| F-21 | Low | package-lock / frontend katex | `npm audit --omit=dev`: 0 critical, 0 high, 0 moderate, 1 low: katex 0.11.0 to 0.18.1, "prototype pollution can bypass trust restrictions" (GHSA-238p-pmpm-9mq7). The app renders with `trust:false` (frontend/src/rich.tsx:10). Fix is katex 0.19.1 (breaking). | Needs a separate way to pollute prototypes first. | Upgrade katex and re-test rendering of lessons. | SAFE_LOCAL_FIX |
| F-22 | Low | services/email.ts:346-352; email.ts:~392 | The unsubscribe token is stored in plain text and appears in a query string in the List-Unsubscribe header. It can only switch off reminder emails. | Negligible. | Optional: hash at rest. | Info |
| F-23 | Info | wrangler.jsonc:90-97 | Production `CONTENT_PREVIEW=true` (owner decision 2026-11-12) shows unreviewed machine-verified and AI-assisted content to students without labels. This is a content-quality risk, not a security one, but note that student sessions then include non-published questions (practice.ts uses `VISIBLE_CONTENT`). | Wrong answers or wording shown to students. | Business decision already recorded. | NEEDS_APPROVAL |
| F-24 | Info | services/billing.ts:32; wrangler.jsonc:19 | The mock payment gateway is allowed whenever `PAYMENTS_MODE=mock` and `APP_ENV=development`. If the top-level (dev) configuration were ever deployed instead of `env.production`, simulated payments would grant free paid access. Guarded by: dev D1 id is a placeholder, and predeploy-check.mjs requires env.production values. | Operator error only. | Keep the guard. Consider also refusing mock when the Worker has a real `RAZORPAY_*` or `PUBLIC_APP_URL` set. | Info |
| F-25 | Info | wrangler.jsonc | `workers_dev: true` in production means the Worker is reachable on the shared workers.dev URL and, with it, `/api/admin`. Production `observability` is set only at top level; whether it is inherited by `env.production` and whether log retention or alerts exist is NOT VERIFIED (needs the dashboard). | See F-03. | Confirm in the dashboard; add alerting on 5xx and webhook failures. | NEEDS_APPROVAL |

---------------------------------------------------------------------

## 2. Checklist results (PASS / FINDING / NOT VERIFIED)

### 1. Authentication

| Item | Result | Evidence |
|---|---|---|
| Password hashing algorithm and parameters | PASS with note (F-08) | accounts.ts:14 `const ITERATIONS = 100_000;` and :19-23 PBKDF2 SHA-256 256 bits; random 16-byte salt per user (:37, `crypto.getRandomValues(new Uint8Array(16))`); `iterations` stored per row |
| Hash comparison constant time | PASS | accounts.ts:55 `crypto.subtle.timingSafeEqual(fromB64(hash), fromB64(row.password_hash))` |
| Session token generation | PASS | accounts.ts:57 32 random bytes from `crypto.getRandomValues`, base64url |
| Hashed at rest | PASS | accounts.ts:60 stores `sha256Hex(token)` in `user_sessions.token_hash`; unique index `user_sessions_token_hash_key` (migration 0004:91); lookup hashes the cookie value (accounts.ts:~147) |
| Cookie flags | PASS | routes/student.ts:62 `httpOnly: true, sameSite: 'Lax', secure: c.env.APP_ENV !== 'development', path: '/'`, maxAge = TTL. No `__Host-` prefix (Info). |
| Session expiry and revocation | PASS | `expires_at > now AND revoked_at IS NULL` in userFromToken; logout revokes (accounts.ts:~127); password change revokes all other sessions (:80); reset revokes all (:121); suspension revokes (admin-console.ts:146-150). Disabled users are refused (`status !== 'ACTIVE'`). No idle timeout or purge (F-11). |
| Login throttling | FINDING | F-02. None. |
| Enumeration: login | PASS | accounts.ts:48-56 same 401 for unknown, disabled or wrong; a dummy PBKDF2 runs for unknown emails, so timing is equalised |
| Enumeration: forgot-password | PASS | routes/student.ts:72-78 same answer, work is done after the response (`later`); `available:false` only says email is off |
| Enumeration: register | FINDING | F-07 |
| Reset token | PASS with note (F-09) | 32 random bytes, only SHA-256 stored, 60-minute expiry, older links invalidated on new request, marked used, all sessions revoked (accounts.ts:96-121; email.ts:236-247). Token travels in the URL fragment (`/reset-password#token`), so it is not sent to the server in page requests; the frontend clears it (Reset.tsx:116). |
| Email verification token | PASS with note (F-09) | email.ts:268-295: random, hashed, 48 h, single use, per-address cap of 3 per hour counted from `email_messages` (:225-229) |
| x-admin-token comparison | PASS (compare), FINDING (power) | auth.ts:10-14 compares SHA-256 digests with `timingSafeEqual`; missing secret gives 503. The actor header is sanitised to `[\w@.-]` and prefixed `admin:` (auth.ts:31), so it cannot impersonate `user:<id>`. What it can reach: all of /api/admin (see F-03). |

### 2. Authorisation: every route

Global: `/api/*` runs the Prisma middleware; `/api/admin/*` is guarded by `adminAuth` (index.ts:24). `app.notFound` returns JSON 404. No CORS middleware exists, so browsers get no cross-origin read access (PASS).

#### /api/health (index.ts)
| Method | Path | Requires |
|---|---|---|
| GET | /api/health | none (F-12) |
| GET | /api/health/db | none (F-12) |

#### /api/auth (routes/student.ts)
| Method | Path | Requires |
|---|---|---|
| POST | /register | none (creates STUDENT role only, accounts.ts:41) |
| POST | /login | none |
| POST | /reset-password | one-time token |
| POST | /forgot-password | none (uniform answer) |
| GET | /email-status | none |
| POST | /verify-email | one-time token |
| POST | /logout | cookie or bearer (no failure if absent) |
| GET | /me | cookie or bearer (returns null user if absent) |

#### /api/learn (routes/student.ts:94-145), all GET, no sign-in, published content only
/exams, /exams/:exam/subjects, /subjects/:paperId, /topics/:nodeId, /resources/:id, /media/:id, /official-papers, /official-directory, /official-directory/sessions, /official-documents/:id, /mock-papers, /past-papers, /past-papers/:id, /search, /pyq, /pyq/documents/:id/file, /pyq/documents/:id, /pyq/:year/:slug, /topics/:nodeId/revision.
Checked: the data functions filter on PUBLISHED, `VISIBLE_CONTENT`, or `shownSql(...)`; media refuses REJECTED or unpublished unless CONTENT_PREVIEW (learning.ts:226-228). PASS.

#### /api/student (all routes behind `studentAuth`, student.ts:148; every handler passes `c.get('user').id`)
| Method | Path | Notes |
|---|---|---|
| POST | /practice | assertWithinPlan then startSession |
| GET | /practice/:id | owner check `WHERE id=? AND user_id=?` (practice.ts:101) |
| POST | /practice/:id/answers | owner check via loadSession |
| PUT | /practice/:id/marks | owner check |
| POST | /practice/:id/submit | owner check |
| GET | /progress | by user id |
| POST | /practice/daily | assertWithinPlan(PRACTICE) |
| GET | /official-documents/:id/file | signed-in; 403 unless in-app viewing is cleared |
| POST | /mock-papers/:id/start | assertWithinPlan(input.mode) |
| POST | /past-papers/:id/start | assertWithinPlan(input.mode) |
| GET | /billing | by user id |
| POST | /billing/orders | createOrder (F-17) |
| POST | /billing/orders/:id/confirm | `WHERE id=? AND user_id=?` (billing.ts:307) |
| POST | /billing/orders/:id/simulate | refuses unless mock gateway (billing.ts:324) |
| GET, PUT | /profile | by user id |
| POST | /password | needs current password |
| GET, PUT | /email | by user id |
| POST | /email/verification | by user id |
| GET | /dashboard, /goals, /bookmarks, /bookmarks/state, /annotations, /flashcards, /flashcards/summary, /flashcards/topic/:nodeId, /flashcards/queue, /preferences, /report/weekly, /reminders, /recent, /plan | by user id |
| PUT | /goals, /annotations, /preferences | by user id |
| POST | /activity, /bookmarks, /bookmarks/remove, /flashcards/state, /flashcards, /flashcards/questions, /flashcards/questions/state, /flashcards/import, /flashcards/:id/review, /reminders/dismiss, /plan | by user id |
| PATCH | /annotations/:id, /plan/:id | `AND user_id = ?` |
| DELETE | /annotations/:id, /flashcards/:id, /plan/:id | `AND user_id = ?` |

#### /api/public (routes/public.ts), no sign-in
| Method | Path | Notes |
|---|---|---|
| GET | /questions/:id | published, no keys |
| POST | /questions/:id/evaluate | **F-01** returns answer key and explanation to anyone |
| GET | /resources/:id | published only (getResource with public flag) |
| GET | /topics/:id/content | lists ids |
| GET | /notices, /notices/:id | published notices |
| GET | /info/:exam, /admissions/filters, /admissions/programmes, /admissions/programmes/:id, /admissions/universities/:slug, /universities | published facts |
| POST | /email/unsubscribe | token (256-bit) |
| POST | /email/webhooks/resend | Svix signature, 404 if secret unset (email.ts:~608) |
| GET | /plans | active plans, ids stripped |
| POST | /payments/webhooks/razorpay | HMAC signature; 404 unless razorpay gateway ready (billing.ts:349) |

#### /api/review (routes/review.ts): `reviewerAuth` on all routes (lib/reviewer.ts:15-23) = signed in AND `curriculum:read` AND (`content:review` OR `curriculum:write`)
GET /me, /dashboard, /content, /content/papers, /questions/audit, /content/QUESTION/:id, /content/LEARNING_RESOURCE/:id, /queue, /papers/:paperId, /sources/:sourceId/file (original PDF from private R2), /history, /mock-papers, /mock-papers/:id, /bulk-approval/summary, /bulk-approval/batches/:id.
POST /nodes/:id/edit, /nodes/:id/move, /versions/:id/rows, /mock-papers/:id/approve, /bulk-approval/preview, /bulk-approval/confirm, /bulk-approval/withdraw, /decide, /versions/:id/sign-off. The services re-check specific permissions (for example practice-centre.ts:343 `content:review`, :349 `content:publish`). PASS.

#### /api/console (routes/console.ts): `consoleAuth` = signed in AND one of users:manage, content:write, content:publish (:34-42). Per-route permission as shown.
| Route | Own permission check |
|---|---|
| GET /me, /overview | none (gate only) |
| GET /email, /email/templates, /email/preview/:template, POST /email/test | users:manage (test goes only to the caller's own address) |
| GET /students, /students/:id; POST /students/:id/status, /students/reset-link | users:manage |
| GET /notices/overview, /notices/queue, /notices, /notices/:id/history, /registry, /official-papers, /mock-papers, /mock-papers/readiness/:paperId, /mock-papers/:id, /past-papers, /past-papers/:id, /admissions/overview, /admissions/sources, /admissions/facts, /admissions/programmes, /admissions/outdated, /assignments, /activity, /coverage, /content, /content/papers, /questions/:id, /resources/:id, /content/history | **none beyond the gate (F-05)** |
| POST /admissions/sources, /admissions/sources/load-reviewed, /admissions/facts, /admissions/facts/import, /admissions/programmes, /admissions/programmes/import | content:write |
| POST /admissions/sources/:id/decision, /admissions/facts/:id/decision, /admissions/programmes/:id/decision, /notices/fetch, /notices/:id/decision, /official-papers/:id/status, /past-papers/:id/status | content:publish |
| POST /mock-papers/build/:paperId | content:write |
| POST /mock-papers/:id/status | checked inside the service (content:review for approve, content:publish for publish, practice-centre.ts:343-349) |
| GET/POST/PUT billing routes (/billing, /billing/plans, /billing/subscriptions, /billing/orders*, /billing/reconcile) | billing:manage (SUPER_ADMIN only, migration 0014:129) |
| GET /staff; POST /roles | users:manage (SUPER_ADMIN only per migration 0002 role map); a super admin cannot remove their own role (console.ts:147) |
| POST /assignments, DELETE /assignments/:id | users:manage, checked in service (admin-console.ts:306, 322) |
| PUT, DELETE /questions/:id; PUT, DELETE /resources/:id | content:write |
| POST /content/workflow | content:write for SUBMITTED, content:publish otherwise; VERIFIED, CHANGES_REQUESTED, REJECTED refused |
Result: no console mutation is unprotected; read routes need tightening (F-05). Console routes do require a signed-in user (PASS, console.ts:35-36).

#### /api/admin (routes/admin.ts), shared token only (F-03)
GET /overview, /exams, /papers, /papers/:id, /syllabus-versions/:id/nodes, /jobs, /files/*, /sources, /coverage, /coverage/papers, /coverage/papers/:id/topics, /review/history, /questions, /questions/:id, /past-papers, /official-papers, /native-papers/draft, /resources, /resources/:id.
PATCH /nodes/:id. PUT /files/:prefix, /page-checks, /page-texts, /source-issues, /source-figures, /content/resources/:key, /content/questions/:key, /content/media/:key, /official-info/:exam, /questions/:id, /resources/:id.
POST /registry/papers, /jobs/report, /imports/syllabus, /users/reset-link, /users/roles, /nodes/:id/machine-correction, /syllabus-versions/:id/machine-verify, /review, /questions, /questions/:id/preview-evaluate, /past-papers, /native-papers, /pyq-index, /official-papers, /official-directory, /official-question-papers, /resources.
DELETE /questions/:id, /resources/:id.
Note: VERIFIED is refused for token actors (review.ts:65-68), PASS.

Role model: roles and permissions come from `user_roles` and `role_permissions` (reviewer.ts:15-19, joined per request, not cached in the session). Sign-up grants only `role_student` (accounts.ts:41). No path lets a student reach staff permissions except `/api/admin/users/roles` (token) and `/api/console/roles` (users:manage). PASS.

### 3. Student data isolation: PASS
Read in code, every one filters or guards by the signed-in user id:
- Practice sessions, answers, marks, submit: practice.ts:101 `WHERE id = ? AND user_id = ?` (all four route handlers go through `loadSession`); `practice_answers` are reached only via an owned session; `question_ids_json` check stops answering foreign questions (practice.ts ~187).
- Bookmarks: student-tools.ts:58, 74, 87 (user_id in every query; the entity table lookup at :49 checks existence of shared content, not ownership, which is correct).
- Annotations: annotations.ts:122, 134, 177, 218, 221, 227. The batch upsert `ON CONFLICT (id) DO UPDATE ... WHERE annotations.user_id = excluded.user_id AND surface...` (annotations.ts:169-171) means a student cannot overwrite another user's row by sending its id. Verified.
- Flashcards and reviews: flashcards.ts:275, 315, 335, 430, 442, 522, 536-537, 546, 556, 562 (all `user_id = ?`).
- Goals, plan, activity: student-tools.ts:133, 154, 161, 173, 176, 183.
- Preferences, reminders, weekly report, recent: student-portal.ts:52, 74-96, 153-159.
- Billing orders: billing.ts:307 (confirm), :325 (simulate), :351+ summary `WHERE o.user_id = ?`; admin order lookups are console only.
- Email settings: email.ts getEmailSettings and setEmailSettings take the session user id only; no id from the body.
- Profile and password: by session user id.
No IDOR found.

### 4. API security and validation

| Item | Result | Evidence |
|---|---|---|
| Zod coverage | PASS (mostly) | Every student mutation uses `readJson(c, schema)` (lib/http.ts:12-20) with max lengths. Exceptions: student.ts:241-245 and 255-259 parse JSON by hand but filter and cap (`.slice(0,400)` and `.slice(0,200)` in flashcards.ts:~503, 311); admin token routes use raw `c.req.json()` (F-13). |
| Body size limits | FINDING / NOT VERIFIED | No explicit cap on JSON bodies; only field-level Zod maxima after the whole body is parsed. Cloudflare's own request limit applies. Upload cap `MAX_UPLOAD_BYTES` 25 MB is checked after buffering (storage.ts:27, admin.ts:60). Low. |
| JSON parse errors | PASS for student routes (becomes a 400 validation error via `body = undefined`), FINDING for admin routes (F-13) |
| Pagination limits | PASS | `pagination()` caps at MAX_PAGE_SIZE 100 (http.ts:5-10); public queries have `.max(100)` on limit and `offset` max 5000 (admissions.ts:585-586, gov-notices.ts:499-500); flashcard limits max 1000. |
| SQL by string concatenation | PASS | Every `${}` inside SQL that I found interpolates only: `?` placeholder lists, column or table names chosen from fixed maps (`TABLE[input.kind]` student-tools.ts:49 with a Zod enum; review.ts:136 `cfg.table`; email.ts:351 `sets` from a fixed enum; syllabus-review.ts:473), or numeric values already validated by Zod (`LIMIT ${q.limit}` flashcards.ts:430, 442 where limit is `z.coerce.number().int().min(1).max(1000)`). User text is always bound. LIKE searches bind the term but do not escape `%` and `_` (wildcard only, cost only). No `queryRawUnsafe` anywhere. |
| Error responses | PASS | lib/errors.ts:30-31: unknown errors return `{"code":"INTERNAL","message":"Unexpected server error"}` and log server side; no stack traces. Zod issues (field paths and messages) are returned with 400, acceptable. |
| CORS | PASS | No CORS headers are emitted, so only same-origin browsers can read responses. |
| CSRF | FINDING (Low) | F-10 |
| Security headers | FINDING | F-04 |
| Open redirects | PASS | No server-side redirect endpoint exists. Emailed links are built from `PUBLIC_APP_URL`; the request origin is used only when `APP_ENV === 'development'` (email.ts:69-73). |
| SSRF | PASS with note (F-15) | Only fixed hosts are fetched: api.razorpay.com (billing.ts:63), api.resend.com (email.ts:41), allow-listed official hosts for notices and PDFs (gov-notices.ts:63-70, practice-centre.ts:28-36); official PDF proxy uses `redirect: 'manual'` (practice-centre.ts:640). No user-supplied URL is fetched. |
| File upload validation | PASS (admin token only) | storage.ts:19-32: type allow-list, empty and size checks, `%PDF-` signature check, content-addressed key `<prefix>/<sha256>.<ext>`, prefix restricted to `sources` or `media` (admin.ts:58). SVG caveat F-14. No student upload exists. |
| R2 key handling and access | PASS | Keys come from DB rows or are content hashes; admin read path enforces `^(sources|media)/[0-9a-f]{64}\.\w+$` (admin.ts:64). Bucket is private (wrangler.jsonc comment) and served only through the Worker: media only when PUBLISHED (learning.ts:226-228), official source PDFs only to reviewers (syllabus-review.ts:205-211), PYQ files only when the document is "shown" (pyq.ts:236-239). Public media sends `cache-control: public` for published items only. |
| XSS | PASS | The only `dangerouslySetInnerHTML` is KaTeX output with `trust:false` (frontend/src/rich.tsx:10-14); all other text is rendered as React text. katex advisory is F-21. |

### 5. Payment security

| Item | Result | Evidence |
|---|---|---|
| Webhook signature, raw body, constant-time | PASS | public.ts:61 passes `await c.req.text()` (raw); billing.ts:352 HMAC-SHA256 of the raw body, `sameText` uses `timingSafeEqual` on equal-length bytes (:50-54); invalid gives 401 (:358-361) |
| Replay and duplicates | PASS | unique `(gateway, event_id)` insert returns `changes()` (billing.ts:356-366); applyPaymentReport uses `UPDATE ... WHERE status IN (...)`, `changes()=1` guard and `ON CONFLICT (order_id)` on subscriptions (billing.ts:275-283), `payment_transactions.gateway_id` unique. A thrown error deletes the event row so the gateway can retry (:~385). |
| Amount verification | PASS | billing.ts:249-256: a CAPTURED report whose amount differs from `order.amount_paise` is recorded as AMOUNT_MISMATCH and gives no access; amount is copied onto the order at creation (:216-218) and the browser never sends it |
| Checkout confirm | PASS | billing.ts:306-318: owner check, HMAC of `gateway_order_id|payment_id` compared constant-time, then the gateway's own API is asked for status, order id and amount |
| Mock or simulate reachable in production | PASS | `gatewayState` allows mock only if `APP_ENV === 'development'` (billing.ts:32); `simulatePayment` returns 404 unless the active gateway is mock (:324); production vars `PAYMENTS_MODE: "off"`, `APP_ENV: "production"` (wrangler.jsonc env.production). See F-24 for the operator-error case. |
| Live keys safety | PASS | billing.ts:33-39: key prefix must match mode and `PAYMENTS_LIVE_APPROVED === 'yes'` for live |
| Order creation abuse | FINDING (Low) | F-17 |
| assertWithinPlan at every start | PASS with note | Called before every session creation: student.ts:151 (practice), :160 (daily), :170 (mock), :177 (past paper). `createSession` has no other callers (grep). Mode mapping in billing.ts:149. Race and count issue F-16. |
| Any way to get paid access without verified payment | PASS | Subscriptions are inserted in only three places: applyPaymentReport after a verified CAPTURED report of the exact amount (billing.ts:277-279), `grantAccess` (console only, needs billing:manage, audited, billing.ts:~560), and nothing else (grep `INTO subscriptions`). CONTENT is not paywalled except session counts, so the real bypass is F-01. |
| Refund handling | FINDING (Low) | F-18 |

### 6. Rate limiting and abuse prevention

Result: FINDING. There is none in code or config (grep for rate, throttle, limiter across backend/src returned nothing relevant; wrangler.jsonc has no ratelimit binding). The only throttles are per-address email caps (email.ts:225-229, 3 per hour for reset and verification) and a test-email cap (email.ts:495).

| Endpoint | Throttled? |
|---|---|
| POST /api/auth/login | No (F-02) |
| POST /api/auth/register | No (account creation and an email per sign-up, unlimited) |
| POST /api/auth/forgot-password | Only 3 emails per hour per address; no per-IP limit |
| POST /api/student/email/verification (resend) | 3 per hour per address |
| POST /api/student/billing/orders | No (F-17) |
| POST /api/student/practice, /practice/daily, /mock-papers/:id/start, /past-papers/:id/start | Plan limits only (session counts per 30 days; free plan limits are data in `plans`) |
| POST /api/public/email/unsubscribe | No (256-bit token, so guessing is infeasible) |
| GET /api/learn/search, /api/public/* search and list | No; unauthenticated LIKE scans (cost only) |
| POST /api/public/questions/:id/evaluate | No (F-01) |
| POST /api/console/email/test | Yes, capped and own-address only |
| POST /api/public/payments/webhooks/razorpay | No (F-06) |
| GET /api/health/db | No (F-12) |

Recommendation: Cloudflare rate-limiting rules (WAF) on /api/auth/*, /api/public/*, /api/student/billing/*, plus Turnstile on sign-up and forgot-password. NEEDS_APPROVAL for the Cloudflare side; code-side counters are SAFE_LOCAL_FIX.

### 7. Secrets and configuration

| Item | Result | Evidence |
|---|---|---|
| Secrets committed in tracked files or history | PASS | Pattern search (Razorpay `rzp_*`, Resend `re_*`, `whsec_*`, AWS, private key blocks, `sk-*`, GitHub tokens) over the working tree excluding node_modules, dist and .wrangler: 0 matches. `git ls-files` contains `.dev.vars.example` only. History search for `ADMIN_API_TOKEN=` found only the example file (commit ce2dac2), and its value is a placeholder. |
| .dev.vars handling | PASS | git-ignored (.gitignore:164), only the variable name `ADMIN_API_TOKEN` (64 chars) |
| wrangler.jsonc vars | PASS | Contains no secrets. The D1 `database_id` is not secret. |
| Local versus production differences | Documented | Local: APP_ENV development, PAYMENTS_MODE mock, NOTICE_FETCH on, PYQ_IN_APP_VIEWING on, EMAIL binding on, crons on. Production: APP_ENV production, PAYMENTS_MODE off, NOTICE_FETCH off, PYQ_IN_APP_VIEWING off, no crons, no `send_email`, `preview_urls: false`, `workers_dev: true`. CONTENT_PREVIEW true in both (F-23). |
| Safety switches | PASS | APP_ENV gates the secure cookie flag, mock gateway and request-origin links; PAYMENTS_MODE and PAYMENTS_LIVE_APPROVED gate payments; `predeploy-check.mjs` blocks deploy unless env.production is complete and `CUET_DEPLOY_APPROVED=yes` |
| Secrets actually set in production (ADMIN_API_TOKEN, RAZORPAY_*, RESEND_*) | NOT VERIFIED | Needs `wrangler secret list --env production` (remote access, not allowed in this audit) |

### 8. Error handling and monitoring readiness

| Item | Result | Evidence |
|---|---|---|
| Global error handler | PASS | index.ts:16 `app.onError(errorHandler)`; maps ApiError, ZodError, Prisma codes, else a generic 500 |
| Sensitive data in logs | PASS | Logged: `Unhandled error` with the error object, payment mismatch with order id only (billing.ts:254), email failures with kind, provider and code only (email.ts:106), `(e as Error).message` elsewhere. No passwords, tokens or request bodies are logged. Minor: unhandled error objects may include SQL text from D1. |
| Audit logging for admin actions | PASS with gaps | Plans, grants, cancellations, refunds, roles, resets, suspensions, content edits, publishing, bulk approvals, imports all write `audit_logs` (about 17 services). Gaps: F-20; token actor is self-declared. |
| Health endpoint | PASS with note | /api/health and /api/health/db exist (F-12). |
| Observability | NOT VERIFIED | `observability: { enabled: true }` at top level (wrangler.jsonc:14). No alerting, Logpush, Sentry or uptime check is configured in the repo. Whether `env.production` inherits observability needs checking in the dashboard (F-25). |
| Cron safety | PASS | Production `crons: []`; every scheduled task no-ops while its feature switch is off (index.ts:37-54) |

### 9. Dependencies

`npm audit --omit=dev` (run with TEMP, TMP and npm cache on D:): 1 low severity vulnerability; 0 moderate, 0 high, 0 critical.
- katex 0.11.0 to 0.18.1: "Existing prototype pollution can bypass trust restrictions" (GHSA-238p-pmpm-9mq7). Fix is katex 0.19.1 (major bump). The app sets `trust:false`. See F-21.
Dev dependencies were not audited (the command omits them).

---------------------------------------------------------------------

## 3. What I could not check
- Production secrets, Cloudflare Access, WAF or rate-limit rules, dashboard observability: need the live account.
- Runtime behaviour of PBKDF2 CPU time on the Workers plan in use, and the D1 100-variable error in F-16 (read from code only).
- Frontend code beyond grep (no full review of every page).
- content-ingestion/ was only checked for how it sends the admin token (header, local file or env var; no token is embedded in code). The token travels over HTTPS to the API URL set by the operator.

## 4. Summary

Counts by severity (25 items): Critical 0, High 3 (F-01, F-02, F-03), Medium 4 (F-04, F-05, F-06, F-07), Low 13, Info 5 (F-19, F-22, F-23, F-24, F-25; the severity column in the table shows "Low" for F-19, F-22, F-23 to F-25 where the type is Info, treat them as Info). Dependencies: 1 low, no high or critical.

Strong areas (PASS): password and session design (hashed tokens, HttpOnly, revocation), uniform login and forgot-password answers, reset and verification tokens, student data isolation (no IDOR found), payment verification (raw-body HMAC, constant-time, idempotent, amount check, mock locked to development), SQL (all user values bound), SSRF (fixed hosts only), file upload and R2 access, no secrets in the tree or git history.

Top 5 findings:
1. F-01 Public unauthenticated answer-key endpoint (`/api/public/questions/:id/evaluate`) leaks every published answer and explanation, bypassing plan limits and mock-test integrity. The frontend does not use it.
2. F-02 No login throttling or rate limiting anywhere (also F-17, F-06, F-12).
3. F-03 The shared `/api/admin` token can mint SUPER_ADMIN, reset any account's password and rewrite content, on a public URL, with no network restriction.
4. F-04 No security headers (no CSP, no frame protection) on the app.
5. F-05 Console read routes lack their own permission checks (student emails visible to editors via the activity feed).

Report path: D:/tmp/audit/security-audit.md
