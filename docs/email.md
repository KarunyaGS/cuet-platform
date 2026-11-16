# Email

Status on 13 November 2026: built and tested locally. **Off in production.** Nothing is sent, and no paid service is enabled, until the owner approves it.

## What it does

| Email | When | Notes |
|---|---|---|
| Password reset link | A student asks on "Forgot your password?" | Works once, expires in one hour. At most 3 per address per hour. The answer is the same whether or not the address has an account |
| Confirm your email | At sign-up, and on request from the profile page | Works once, expires in 48 hours. Signing in does not wait for it |
| Password changed notice | After a reset or a change from the profile page | Tells the owner in case it was not them |
| Study reminder | Once a day at 19:00 India time | Only for students who turned it on and confirmed their address, and only when something is open (unfinished test, planned tasks, daily goal, weak topic). Every reminder has a one-click stop link |

Delivery failures: a hard bounce or a spam complaint puts the address on a block list, turns its reminders off, and stops all later emails to it. Each attempt is recorded in `email_messages` (address, type, subject, result). The message body is never stored, because it can hold a one-time link.

## Providers

1. **Cloudflare Email Sending** through the `EMAIL` binding. No API key. 3,000 emails a month are included in Workers Paid, then $0.35 per 1,000. Public beta.
2. **Resend** as standby, used only if `RESEND_API_KEY` is set and the first provider fails. Free up to 3,000 a month (100 a day).

Details and sources: `docs/provider-and-source-research-2026-11-13.md`.

## Where the code is

| Part | File |
|---|---|
| Sending, templates, reset, confirmation, reminders, delivery events | `backend/src/services/email.ts` |
| Routes | `backend/src/routes/student.ts` (`/api/auth/forgot-password`, `/api/auth/verify-email`, `/api/auth/email-status`, `/api/student/email`), `backend/src/routes/public.ts` (`/api/public/email/unsubscribe`, `/api/public/email/webhooks/resend`), `backend/src/routes/console.ts` (`/api/console/email`) |
| Daily job and delivery-event consumer | `backend/src/index.ts` (`scheduled`, `queue`) |
| Tables | migration `0013_email.sql`: `email_messages`, `email_suppressions`, `email_verification_tokens`, two columns on `student_preferences`, one on `users` |
| Screens | `frontend/src/pages/Reset.tsx` (forgot password, confirm email, stop reminders), `frontend/src/pages/Profile.tsx` (Email section) |
| Tests | `backend/test/email.test.ts` (8 tests) |

Locally, Wrangler simulates the binding: nothing is sent and each message is written to a file under `backend/.wrangler/tmp/email`.

## Switching it on in production (each step needs the owner's approval)

Email needs a domain the platform owns. The app has no custom domain yet, so that decision comes first.

1. Choose the domain and onboard it in the Cloudflare dashboard under Email Service (adds SPF and DKIM records).
2. Apply migration 0013 to `cuet-db` (adds tables and columns only).
3. In `backend/wrangler.jsonc`, production section: add `"send_email": [{ "name": "EMAIL" }]`, set `EMAIL_FROM` (for example `no-reply@<domain>`), `EMAIL_FROM_NAME` and `PUBLIC_APP_URL`, and set `"triggers": { "crons": ["30 13 * * *", "*/30 * * * *"] }` (the 30-minute run does the retries). The full, current checklist is `docs/completion/email-go-live.md`.
4. Create a queue, subscribe it to the sending domain's `message.bounced`, `message.complained`, `message.delivered` and `message.failed` events, and add it as a queue consumer of the Worker.
5. Optional standby: create a Resend account, verify the same domain, then `wrangler secret put RESEND_API_KEY --env production` and `RESEND_WEBHOOK_SECRET`, and point a Resend webhook at `/api/public/email/webhooks/resend`.
6. Deploy, then send one reset email to the owner's own address and confirm it arrives and the link works.

## Not built yet

- An admin screen for the email log. The data is available at `/api/console/email`.
- Emails for subscription and payment events. They will use the same service once that module exists.
- Requiring a confirmed address before sign-in. Today it is required only for reminders.

## Welcome, exam countdown, revision reminders and staff previews (migration 0032, local only)

- **Welcome email:** sent once, right after the student confirms the address (`WELCOME`, duplicate key `welcome:<user>`). It promises only what the app does and says reminders are off until switched on.
- **Exam countdown:** the student may enter the day of their own exam on the profile page. With study reminders switched on, an email goes out 30, 7 and 1 days before that date, once each. The date is never filled in by us, and the email says it is the student's own date and sends them to the NTA website for the real schedule.
- **Revision reminders:** a separate opt-in. At most one email a day, only when the student has revision cards due that they can open (the shared `questionVisible` rule).
- **Unsubscribe:** the "reminders" scope stops study reminders, the exam countdown and revision reminders. "Notices" stops official-notice alerts. Every reminder carries a one-click header and a link.
- **Templates:** all messages are built in `backend/src/services/email-templates.ts`. The same code sends, previews and tests, so staff see what students get.
- **Staff:** Admin, Email has "Preview every message" (desktop and phone width, sample data, nothing sent) and "Send test to me". A test goes only to the signed-in staff member's own address, is marked `[Test]`, and is capped at 24 an hour. There is no way to name another recipient.
- **Daily job:** the 13:30 UTC cron now also runs the exam countdown and revision reminders.
- **Not built:** an email-changed notice (there is no change-email flow yet); billing emails still use their own plain layout.

### Reusing the Alfanumrik sending setup (checked read-only on 2026-11-16)

The Cloudflare account that holds this Worker also holds Email Sending for `notify.alfanumrik.com` (enabled, DKIM selector `cf-bounce`) and `wisca.io`. The DNS checker reports `notify.alfanumrik.com` READY (SPF, MX, DKIM, DMARC p=reject). CUET should use its own subdomain (for example `cuet.<domain>` or `mail.cuet.<domain>`), not Alfanumrik's address, so complaints about one product never harm the other's reputation. Onboarding it, adding DNS records and enabling the binding in production all need the owner's approval and have not been done.
