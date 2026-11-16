# Payments and subscriptions: audit, GST requirements and implementation plan

Prepared 16 November 2026. Payments are OFF in production and nothing was activated. No Razorpay account, key or money was used: the gateway calls are replaced in tests. No business rule was changed. The seven CEO decisions are still recommendations awaiting approval (`docs/ceo-decision-checklist.md`).

## 1. What was verified (tests that run in `npm run check`)
| Area | Evidence | Result |
|---|---|---|
| Order creation | The amount comes from the plan and is copied onto the order; fields the browser adds (amount, price, duration, mode, gateway) are ignored; only our own order reference goes to Razorpay; a double click returns the same open order | PASS (`billing.test.ts`, `billing-security.test.ts`) |
| Payment verification | The signature must match order and payment; the gateway's own record gives status and amount; a genuine payment for a different order is refused; a made-up payment is refused | PASS |
| Webhooks | Raw-body HMAC checked before anything is read; no signature, wrong signature and mock mode all refused; each event id processed once; the same payment never buys two passes | PASS |
| Delayed and out-of-order events | A late "failed" does not remove access; a capture after the order expired still gives access once; a refund before the payment is ignored and the payment is still recorded | PASS |
| Missing webhook | Reconciliation finds a captured payment nobody reported, and closes stale orders after 24 h | PASS |
| Subscription activation and stacking | One pass per paid order, days added after the current end, buying ahead gives an UPCOMING pass | PASS |
| Expiry and usage | Plan limits are enforced when a limited test starts; a pass that ends in the middle of a test does not interrupt it, and a new limited test is then refused (402) | PASS |
| Unauthorised access | A student cannot see or confirm another student's order; every billing console route refuses a student and a reviewer (403) and a signed-out caller (401) | PASS |
| Payment bypass from the browser | Not possible in the paths tested: access follows a verified gateway record only; the simulate endpoint is a 404 unless the mock gateway is configured (development only) | PASS |
| Modes | `off` is the default; `mock` needs `APP_ENV=development`; `test` needs `rzp_test_` keys; `live` needs `rzp_live_` keys AND `PAYMENTS_LIVE_APPROVED=yes` | PASS |

Test counts: 13 existing billing tests plus 14 new security and audit tests, all passing.

## 2. Findings (all local; none changes behaviour until the CEO decides)
| ID | Finding | Why it matters | Fix (needs which decision) |
|---|---|---|---|
| P1 | A refund of any amount ends the whole pass (test: "a refund of any amount ends the whole pass") | A ₹100 goodwill refund removes a month of access | Decision 7 |
| P2 | Refunding the first of two stacked passes leaves a gap: the second keeps its later start date | A paying student can have no access now | Decision 7 (rebuild the chain) |
| P3 | Reconciliation looks only at orders still `CREATED`; a payment captured on a `FAILED` order is found only if its webhook or checkout confirmation arrives | A lost webhook for such an order is not recovered | Safe local fix (see 4) |
| P4 | An amount mismatch is written to the order and a server log line only; no flag for staff | Staff may not notice a wrong-amount payment that gave no access | Safe local fix (see 4) |
| P5 | Order creation has no rate limit beyond reusing an open order for 20 minutes | Bulk creation of gateway orders | Safe local fix once rate limiting exists (see the security audit) |
| P6 | The usage check and the insert that follows are two steps | A burst of simultaneous starts can overshoot a limit by a few | Low; document |
| P7 | Abandoned tests count toward limits | Students lose allowance by leaving a screen | Decision 5 |
| P8 | Razorpay capture mode is not set in code (account setting) | If the account is on manual capture, payments stay "authorized" and are auto-refunded, giving no access | Confirm automatic capture in the Razorpay dashboard (credential-holder) |
| P9 | No invoices or credit notes exist | GST-registered company must issue them | Decision 2 |
| P10 | Billing emails use a plainer layout than other mail | Consistency only | Optional |

## 3. GST invoice and credit-note requirements (finance to confirm every item marked ?)
The company is GST-registered, so each paid order needs a tax invoice and each refund a credit note.
**Data the system must hold (new):** supplier legal name, address, GSTIN, state code; SAC code (?); tax rate (assumed 18%, ?); invoice number series per financial year, consecutive and unique (no gaps, 16 characters or fewer, ?); for every invoice: number, date, student name, place of supply (the student's state, because it decides CGST plus SGST against IGST, ?), description (plan and period), taxable value, tax by head, total, and a reference to the order and payment.
**Prices:** shown GST-inclusive; stored amounts stay the inclusive total in paise, so checkout, signature and exact-amount checks do not change. Taxable value = total ÷ 1.18, tax = total − taxable (rounded to paise, in a way finance approves).
**Credit notes:** one per refund, for the refunded share of taxable value and tax, with its own number series and a reference to the original invoice.
**To confirm with finance:** SAC and rate; whether the supply is treated as online information and database access or retrieval services; place-of-supply rule when the student's state is unknown; whether e-invoicing applies at the company's turnover; how Razorpay's fee and its GST are booked; invoice format (HTML page, emailed, or PDF).
**Technical work:** migration 0034 (`invoices`, `invoice_counters`, `credit_notes`, tax settings); `invoices.ts` service that creates the invoice in the same transaction that marks the order paid (so a repeated webhook cannot make two); email and billing-page links; admin download; checkout asks for the state (a select) unless finance approves another rule; tests for numbering, rounding, repeat events, refunds and credit notes.

## 4. Safe local fixes made or ready in this sprint
- New tests (14) pinning current behaviour; no business rule changed.
- Ready, small, and not business rules: (P3) let reconciliation also check `FAILED` orders from the last 7 days; (P4) show amount-mismatch orders as a flagged list on the admin billing page. They are listed in the checklist; see the report for what was applied.

## 5. Technical plan for the seven CEO decisions (nothing started; order of work)
1. **Prices (decision 1):** data entry in Admin, Plans; no code. Test: price floor ₹1, "inclusive of GST" shown on the plan card.
2. **GST (decision 2):** section 3. Needs finance answers first. Largest item (migration, service, email, screens, tests).
3. **Limits (decision 3):** add limit types for revision cards and bookmarks/notes (totals, not 30-day windows); enforce where each is created (`flashcards.ts`, bookmarks and annotations routes); show usage on the plans and profile pages; policy for existing students over the new free limit (keep what they have, block new). Data-only for the three existing limits.
4. **Launch criteria (decision 4):** an admin "launch readiness" panel counting published questions, explanations, topic tests and full mocks per subject against thresholds the CEO sets; paid plans cannot be switched on while it is red. Needs the thresholds.
5. **Abandoned tests (decision 5):** usage counts submitted sessions only, plus a cap on unfinished sessions at once and automatic submission after the time limit; tests for the viewing-without-submitting loophole.
6. **Expiry mid-test (decision 6):** already true; add an optional finishing window for untimed sets (days to be chosen); tests exist.
7. **Refunds (decision 7):** migration 0035 (`refunded_paise` on orders, refund records); rule (a) shorten the pass by the refunded share; rebuild stacked passes after any shortening or revocation; recognise a duplicate payment; refunds started from the console through Razorpay (test mode first); credit note per refund; refund policy text; tests for every case including repeated and delayed events.
Cross-cutting: rate limiting on order creation; admin list of flagged payments; alert when a webhook fails repeatedly.

## 6. What is missing, and who must supply it
| Item | From |
|---|---|
| Razorpay account with KYC done, **test** key id and key secret, **test** webhook secret | Owner (company details) |
| A public address for the webhook (needs staging or a tunnel; the webhook cannot reach a local machine) | Owner approves staging |
| Confirmation of automatic capture in the dashboard | Owner |
| GSTIN, legal name, registered address, state code, SAC, rate, invoice series, e-invoicing position | Finance |
| Refund policy (window, reasons, partial rule, who may approve) | CEO |
| Prices, limits, launch thresholds, finishing window | CEO |
| Live keys and `PAYMENTS_LIVE_APPROVED=yes` | Only after test-mode sign-off; not now |

## 7. What was NOT done
Payments were not activated. No Razorpay account or key was created or used. No price, limit, refund rule or subscription rule was changed. Nothing was deployed.
