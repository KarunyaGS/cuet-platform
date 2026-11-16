# Email go-live: exact requirements (nothing here has been done)

Prepared 16 November 2026. No domain was bought, no DNS record changed, no Cloudflare setting changed, no email sent. Everything below needs the owner's approval, in the order shown.

## 1. What the platform already does (verified locally, all with the test sender)
Registration confirmation, password reset, password-changed notice, welcome (once), study reminder (daily), exam countdown (30, 7, 1 days), revision reminder (daily), official-notice alerts (daily digest), payment and plan-ending notices (only when payments are on). Failed sends are retried at 5 min, 30 min, 2 h, 12 h and 24 h (study reminders for 6 h, notice alerts for 24 h, account notices for 48 h; password-reset and confirmation messages are never kept or retried). Duplicates are blocked by a duplicate key. A hard bounce or spam complaint blocks the address and turns reminders off. Unsubscribe works in one click, with the `List-Unsubscribe` headers. Staff see failures, retries and opt-ins in Admin, Email, and can preview or send a test to their own address.

## 2. The sending subdomain (decision needed)
CUET has no domain of its own yet, so the subdomain cannot be named. Pick one of these and tell me:
- **A (recommended):** a subdomain of the CUET domain once it exists, for example `mail.<cuet-domain>`. It keeps CUET's complaints and bounces apart from Alfanumrik's reputation.
- **B:** a subdomain of the Alfanumrik zone, for example `cuet.alfanumrik.com` (same Cloudflare account, so onboarding is quick). Alfanumrik's existing sender is `notify.alfanumrik.com` (enabled since 3 Nov 2026; its DNS passes SPF, MX, DKIM and DMARC `p=reject`); it must not be reused as CUET's From address.

`<S>` below means the chosen sending subdomain.

## 3. DNS records (Cloudflare creates them when the subdomain is onboarded under Email Service; add them by hand only if the zone is elsewhere)
| Type | Name | Content |
|---|---|---|
| MX | `cf-bounce.<S>` | `route1.mx.cloudflare.net` (priority 91), `route2.mx.cloudflare.net` (30), `route3.mx.cloudflare.net` (25) |
| TXT | `cf-bounce.<S>` | `"v=spf1 include:_spf.mx.cloudflare.net ~all"` |
| TXT | `cf-bounce._domainkey.<S>` | `"v=DKIM1; h=sha256; k=rsa; p=<public key Cloudflare issues at onboarding>"` |
| TXT | `_dmarc.<S>` | `"v=DMARC1; p=reject; rua=mailto:<a mailbox you read>"` (start with `p=none` for two weeks if you prefer) |

The DKIM key cannot be known before onboarding; `wrangler email sending dns get <S>` prints it afterwards. These match what was read from the working `notify.alfanumrik.com` setup. Check with `node backend/scripts/check-email-dns.mjs <S>`; it must say READY.

## 4. Cloudflare configuration
In `backend/wrangler.jsonc`, the `production` section (it currently has `"triggers": { "crons": [] }` and no email settings):
```jsonc
"send_email": [{ "name": "EMAIL" }],
"triggers": { "crons": ["30 13 * * *", "*/30 * * * *"] },   // daily jobs, and the 30-minute retry and notice reader
"queues": { "consumers": [{ "queue": "cuet-email-events" }] },
"vars": {
  "EMAIL_FROM": "no-reply@<S>",
  "EMAIL_FROM_NAME": "CUET Prep",
  "PUBLIC_APP_URL": "https://<the app's public address>"   // from configuration, never from a request
}
```
Note: `docs/email.md` step 3 lists only the daily cron. **Both** crons are needed: the 30-minute one runs the retries.
Cloudflare side: create the queue `cuet-email-events`; in Email Sending, subscribe it to `message.delivered`, `message.bounced`, `message.complained` and `message.failed` for `<S>`.
Optional standby provider: `wrangler secret put RESEND_API_KEY --env production` and `RESEND_WEBHOOK_SECRET`, with a Resend webhook to `/api/public/email/webhooks/resend`.
Production database: apply migrations 0013, 0030 and 0032 (and everything before them; see the deployment sequence) before enabling.

## 5. Verification after enabling (one real inbox only, the owner's own)
1. Admin, Email: readiness panel all green.
2. "Send this test to me" for each of the eight messages; read them on a phone and a desktop.
3. Register with the owner's own second address; confirm the link works once and not twice; reset a password.
4. Send to a deliberately invalid address you control the domain of, and confirm the bounce arrives and the address is blocked.
5. Check `List-Unsubscribe` works from a mail program.

## 6. Safe to switch off again
Remove `EMAIL_FROM` (or the binding): every send then records `NOT_CONFIGURED` and nothing is sent. No data is lost.

## 7. What is still required from you
The CUET domain and sending subdomain; permission to onboard it and add its DNS records; permission to change the production config and create the queue; a mailbox for DMARC reports; one real inbox to test with.
