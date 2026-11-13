# Provider and Source Research

**Date read:** 13 November 2026. Web research only. Nothing was bought, enabled or imported.
Prices are from the vendors' own pages on that date unless marked otherwise. Items marked "not verified" could not be confirmed from an official page.

## 1. Email provider

**Proposed: Cloudflare Email Sending as primary, Resend as standby.**

| Provider | Free allowance | 10k / 50k / 100k emails a month (USD) | How a Worker calls it | Bounce and complaint events | Effort |
|---|---|---|---|---|---|
| Cloudflare Email Sending (public beta since 16 April 2026) | 3,000 a month inside Workers Paid | 2.45 / 16.45 / 33.95 ($0.35 per 1,000 above 3,000) | `send_email` binding, no API key | Delivered to Cloudflare Queues; automatic suppression list | Low |
| Resend | 100 a day, 3,000 a month | 20 / 20 / 35 | HTTPS call | Signed webhooks (Svix headers) | Low |
| Amazon SES | none fixed | 1 / 5 / 10 | HTTPS with SigV4 signing | SNS notifications | High; needs an AWS account |
| Postmark | 100 a month | 15 / 87 / 177 | HTTPS call | Webhooks, no HMAC signature | Low |
| MailerSend | 500 a month | 35 / 35 / 68 | HTTPS call | Signed webhooks | Low |
| Brevo | 300 a day | not verified | HTTPS call | Webhooks, no body signature | Low to medium |
| ZeptoMail (Zoho) | 10,000 once | about 2.50 / 12.50 / 25, third-party figure only | HTTPS call | Signed webhooks | Low to medium |

Expected cost on top of the existing Workers Paid plan: **$0** at 3,000 a month, **$2.45** at 10,000, **$33.95 to $53.95** at 100,000 (the higher figure if the Resend standby is moved to its $20 plan).

Why this pair: no secret to store, DNS is already on Cloudflare, and it is the cheapest option that needs no second cloud account. Cloudflare's service is still in beta, so password resets should not depend on it alone; Resend is one HTTPS call away.

Not verified: Cloudflare's starting daily quota and any SLA; INR billing or GST invoices for any vendor; Brevo and ZeptoMail official prices; independent deliverability data.

Sources: developers.cloudflare.com/email-service (pricing, limits, changelog, event-subscriptions), resend.com/pricing, aws.amazon.com/ses/pricing, postmarkapp.com/pricing, mailersend.com/pricing, zoho.com/zeptomail/pricing.html, brevo.com/pricing.

## 2. Payment gateway

**Proposed: Razorpay as primary, Cashfree as fallback, and prepaid term passes (no auto-renewal) at launch.**

| | Razorpay | Cashfree | PhonePe PG | PayU India | Stripe |
|---|---|---|---|---|---|
| Domestic fee | 2% (UPI, cards, netbanking) | 1.95% | 1.99% headline | 2%; UPI "varies" | 2% cards; not open to new Indian businesses |
| Setup / annual fee | ₹0 / ₹0 | ₹0 / not stated | ₹0 / ₹0 | none | n/a |
| Settlement | T+1 on pricing page, T+2 in docs | T+2 | not stated | T+2 | n/a |
| Activation | about 3–4 business days | about 24 working hours | not found | not checked | invite-only |
| Webhook check | HMAC-SHA256 of raw body, `X-Razorpay-Signature` | HMAC-SHA256 of timestamp + body, `x-webhook-signature` | weak public docs | hash field in a form body | n/a |
| Plain HTTPS from a Worker | Yes | Yes | Likely | Possible, more work | n/a |

Recurring payments fall under the RBI e-mandate framework (RBI/DPSS/2026-27/396, 21 April 2026): the mandate and first debit need extra authentication, later debits up to ₹15,000 do not, and a notice must go out at least 24 hours before each debit. A one-time payment that the customer authorises each time involves no mandate. That reading is an inference from the framework's scope, not an RBI statement.

Why prepaid passes first: no mandate setup or failed-debit handling to build, a clear one-off UPI payment for a parent, and auto-renewal can be added later.

Not verified: GST invoicing by any gateway (assume the platform issues customer invoices itself); Razorpay UPI Autopay pricing; Razorpay settlement time; refund API details.

Sources: razorpay.com/pricing, razorpay.com/docs/webhooks/validate-test, cashfree.com/payment-gateway-charges, cashfree.com/docs, business.phonepe.com/payment-gateway/pricing, payu.in/pricing, support.stripe.com/questions/stripe-accounts-are-invite-only-in-india, rbi.org.in/Scripts/BS_ViewMasDirections.aspx?id=13374.

## 3. Previous-year papers: source list

**Main finding: NTA publishes answer keys, but not the question papers.**

- The final answer keys are public PDFs. They hold only a 12-digit question ID and the correct option ID, grouped by date, shift and subject. They contain no question text.
- Question papers are shown only to each candidate after login ("View Question Paper"). No public per-subject CUET paper was found on any NTA page that could be opened.
- NTA's copyright policy (cuet.nta.nic.in/copyright-policy/) says material "may be reproduced free of charge after taking proper permission from National Testing Agency (NTA)", with the source acknowledged. nta.ac.in carries "© All Rights Reserved".

| Source | URL | Contains | Years | Checked |
|---|---|---|---|---|
| CUET-UG site | cuet.nta.nic.in | Notices, bulletin, syllabus | 2026, 2025 archive | Opened |
| UG 2026 final answer key | cdnbbsr.s3waas.gov.in/s3d1a21da7bca4abff8b0b61b87597de73/uploads/2026/06/202606231857909583.pdf | Question ID to option ID; dropped questions | 2026 | Opened, 334 pages |
| PG 2025 final answer key | nta.ac.in/Download/Notice/Notice_20250506192138.pdf | Same, per subject code | 2025 | Opened, 159 pages |
| UG 2025 final key | nta.ac.in/Download/Notice/Notice_20250701201050.pdf | Listed on the NTA home page | 2025 | Link seen, not opened |
| PG 2022 final key | cdnbbsr.s3waas.gov.in/…/uploads/2022/09/2022092772.pdf | Listed on the archive page | 2022 | Link seen, not opened |
| PG 2026 final key | not found | | | Not found |
| UG 2022; UG and PG 2023, 2024 keys | not found on a live official page | | | Not found |
| NTA downloads archive | nta.ac.in/Downloads | Claimed past-paper archive | unknown | Could not be opened |

Storage facts: one subject has many shifts; a question can have two correct options or be dropped (marks to all); keys come as provisional then final.

The Copyright Act points commonly raised (section 52(1)(i) on examination questions, fair dealing, section 17(d) on government works) do not settle commercial republication of full papers. This is not legal advice.

## 4. Admissions and cut-offs: source list

| Source | URL | Contains | Format | Checked |
|---|---|---|---|---|
| NTA participating universities (UG) | cuet.nta.nic.in/participating-universities/ | 49 central universities and others, each with a programme and eligibility PDF | HTML + PDF | Opened |
| NTA participating universities (PG) | exams.nta.nic.in/cuet-pg/ | not located | | Sub-pages refused |
| Delhi University | admission.uod.ac.in | Bulletins, seat matrix, round-wise minimum allocation scores, 2023–2026 | PDF tables | Index opened |
| BHU | admission.bhu.ac.in (cut-offs under /en/cutoff/UG/2026 and /PG/2026) | Bulletins, round allocations, cut-off pages | HTML + PDF | Home opened |
| JNU | jnuee.jnu.ac.in (JNUCutoff2026.html) | Cut-off score and rank PDFs, 2024–2026 | PDF | Opened |
| Jamia Millia Islamia | admission.jmi.ac.in | Per-programme selection lists; contain candidate names | PDF | Not verified |
| University of Allahabad | allduniv.ac.in/admission | Many per-programme, per-round notices | PDF | Not verified |
| University of Hyderabad | acad.uohyd.ac.in | Programmes and minimum qualifications; no cut-offs found | HTML + PDF | Opened |
| AMU | amucontrollerexams.com | Guide to Admissions | unknown | Not verified |

Limits: NTA publishes no cut-offs. Formats differ by university and change every round. University sites say "all rights reserved" and give no reuse licence. Lists with candidate names or roll numbers must not be stored.
