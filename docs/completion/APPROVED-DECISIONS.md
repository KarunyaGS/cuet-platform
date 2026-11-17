# Approved decisions – recorded 16 Nov 2026

**Source of approval:** the CEO's message of 16 Nov 2026 ("All the proposed CUET product, business and engineering decisions in the approval checklist are approved"). The message did not restate the values, so what is recorded here is **the recommendation written in `docs/ceo-decision-checklist.md` and the proposals in `docs/completion/CUET-COMPLETION-REPORT.md` (section 7)**, exactly as they stood. Where a proposal left a detail open, the detail is listed under "Interpretation" and stays open until confirmed. If any value below differs from what the CEO intended, say so and it is a data change (prices, limits) or a small code change.

Approval does **not** cover: production deployment, production migrations, pushing commits, live payments, real email sending, DNS or domain actions, publication of content or admissions facts, creation of Cloudflare or Razorpay credentials, or reliance on NTA papers. Those stay gated.

## A. Plans, pricing and payments (checklist items 1–7)
| # | Decision (approved) | Interpretation / still open |
|---|---|---|
| 1 | Free ₹0 no expiry; Monthly ₹149/30 days; Quarterly ₹299/90 days; Yearly ₹599/365 days. Prepaid passes, no auto-renewal. | Paid plans stay **switched off** (decision 4). |
| 2 | Company is GST-registered; prices shown GST-inclusive; tax invoices and credit notes to be issued. | **Pending finance:** GST rate, SAC code, GSTIN/legal name/address, invoice series format, place-of-supply rule, credit-note practice, who files returns. Nothing is invented; the ₹ tables in the checklist assume 18% for illustration only. Invoices are not built. |
| 3 | Limits. Free: 10 practice sets, 4 topic tests, 1 mock test, 25 revision cards, 50 bookmarks and notes. Paid per 30 days: 300 practice sets, 60 topic tests, 12 mock tests; cards, bookmarks and notes unlimited. | Cards and bookmarks are totals; existing items are kept and only new ones are blocked. "Notes" are enforced with bookmarks only where they are bookmarks; highlight/annotation notes are **not yet counted** (see remaining work). Students must be told before the free limits start (announcement is a business task). |
| 4 | Sell only subjects whose content is ready; start with Physics when ready; no "all subjects" claim. | The objective test for "ready" (numbers of published questions, explanations, topic tests, mocks) was **not set** – still to be defined. Until then paid plans cannot be switched on while the content preview is on. |
| 5 | Only submitted tests count; unfinished tests can be resumed. | No limit on unfinished sessions (changed 17 Nov 2026 by the CEO: the earlier cap of 3 per kind was removed). Starting a test never blocks, submits or cancels another. |
| 6 | A started test can be finished after the pass ends; no new paid tests after expiry. | Already the behaviour; covered by a test. Edge case (untimed practice left open for days) not limited. |
| 7 | Partial refund shortens the pass in proportion (**rule 1**: refunded share of the price × the length paid for); full refund revokes; refund of a duplicate payment leaves a valid pass alone. | No refund policy (window, accepted reasons) was written; whether Razorpay returns its fee is unconfirmed. Refunds are still started in the Razorpay dashboard or recorded by hand. |

## B. Other items from the checklist ("Other decisions already waiting")
| Item | Recorded as |
|---|---|
| Razorpay test-mode account | Approved in principle; **no account or key is created by this work.** Test keys must be supplied (or an account opened by the CEO). |
| Admin-console refunds | Not built; manual recording stays. |
| Email sending domain | Option A, `mail.<cuet-domain>` (or a subdomain of the existing domain) as in `email-go-live.md`; DNS changes and live sending not done. The exact domain is still to be named. |
| Admissions sources (nine proposed) | Approved for **review and use as references only**. Nothing is imported or published without verification; NTA PG and Jamia stay NOT VERIFIED. |
| Production deployment / migrations | Still on hold. |
| Publishing the 786 approved Physics questions | Not part of this approval. Bulk approval was an automated format check, not expert verification, and must not be described as such. |

## C. Security and engineering proposals (completion report, section 7)
| Proposal | Recorded as |
|---|---|
| Role-based access | Least privilege: the email log, email preview/test and reviewer-assignment list need the account-management permission; content editors keep content, notice and admissions screens. Further narrowing of console reads is possible later. |
| Registration privacy | Sign-up answers identically for a new and an existing address and creates nothing for an existing one. Email confirmation before first use is **not** enforced yet (needs the email service). |
| Content preview | Preview stays as the owner decided on 12 Nov, **but** a paid plan cannot be switched on while it is on. Showing a "not yet expert reviewed" label to students was not requested and is not built. |
| NTA official papers | Stay disabled (`OFFICIAL_IN_APP_VIEWING=off`, `PYQ_IN_APP_VIEWING=off` in production) until written permission or official clarification. No permission is assumed. |
| Push / deploy | Not approved by this message. |
