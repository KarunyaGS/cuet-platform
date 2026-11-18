# Custom domain: options only (18 November 2026)

Nothing was bought, no DNS record was changed, no Cloudflare setting was changed, and **no availability or price check was made** (that would send the product name to a registrar or a domain-search service, which has not been asked for). Names below are candidates, not facts about what is free.

## Why a domain is needed

| Needed for | Why the `cuet.ceo-3a7.workers.dev` address is not enough |
|---|---|
| Email (verification, receipts, "pass ends soon") | Email Sending can only be onboarded for a domain whose DNS is in the Cloudflare account. A `workers.dev` address cannot send |
| Razorpay live activation | Razorpay asks for the business website address; a `workers.dev` address looks like a test site |
| Trust and search | Students will not trust, and search engines will not rank, a `workers.dev` address |
| Cookies and sign-in | The app's cookies are tied to the host. Moving to a new host later signs everyone out, so the host should be chosen once |

## The options

| | Option | Cost | Good | Careful |
|---|---|---|---|---|
| **A** | **Its own domain**, for example `prepora.com`, `prepora.in` or `prepora.co.in` (names to be checked) | Registration fee, yearly renewal. Prices are the registrar's and must be read at the time; none is quoted here | Own brand, own email reputation, nothing shared with Alfanumrik, clean for Razorpay and for press | Needs a purchase approval; the name must be free; trademark not checked for "Prepora". Whether Cloudflare Registrar sells the chosen ending is unchecked: if not, buy elsewhere and point the nameservers to Cloudflare |
| **B** | **A subdomain of the Alfanumrik zone**, for example `prep.alfanumrik.com` or `cuet.alfanumrik.com` | None | Immediate; same Cloudflare account, so Email Sending onboarding is quick | Brand mismatch (Prepora under Alfanumrik); shared domain reputation (a spam complaint about one hurts the other); Alfanumrik's own move to Cloudflare is not finished, so its zone may change; hard to separate later without signing students out |
| **C** | **Stay on `workers.dev`** | None | Nothing to decide | No email, no live payments, not a launch address. Fine for internal testing only |

**Recommendation: A**, with `.com` first choice if free and `.in` as the alternative, and the sending address on a subdomain of it (`mail.<domain>`) so email reputation is kept apart from the website. Use **B only as a short-term stand-in** if email must be tested before a purchase is approved, accepting a later change of host.

## Where the staging and email names would sit (if A)

| Use | Name |
|---|---|
| Website | `<domain>` and `www.<domain>` (one redirects to the other) |
| Staging | `staging.<domain>`, behind access control, never indexed |
| Sending email | `mail.<domain>` (see `email-go-live.md`) |
| API | the same host (`/api/...`); no separate host needed |

## What to do once a domain is chosen (nothing here is done)

1. Approve the purchase (if A) and say who owns the registrar account. Add the domain to the Cloudflare account that holds the `cuet` Worker.
2. Production config in `backend/wrangler.jsonc`: a custom-domain route for the Worker, `PUBLIC_APP_URL`, and the email values in `email-go-live.md`.
3. Email Sending onboarding for `mail.<domain>`; SPF, DKIM and DMARC as listed in `email-go-live.md`.
4. Razorpay: the website address and the webhook address (`https://<domain>/api/public/payments/webhooks/razorpay`).
5. Keep `cuet.ceo-3a7.workers.dev` redirecting to the new host for a while so shared links keep working.
6. Re-check cookies and any hard-coded address (the notice reader's user agent, sitemap, canonical links) on the new host.

## Decision needed

Choose A, B or C. For A, give the name you want and I will check availability (this sends the name to a domain-search service, so I am asking first), then return the price and wait for the purchase approval.
