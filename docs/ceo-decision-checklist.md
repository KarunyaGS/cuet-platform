# CEO decision checklist: plans, pricing and payments

Prepared 16 November 2026. **Update 16 Nov 2026: the CEO approved all seven recommendations below as written (see `docs/completion/APPROVED-DECISIONS.md`). Items 1, 3, 5, 6 and 7 are implemented locally; GST (item 2) waits for finance; item 4 is enforced by keeping paid plans off.**
Nothing in the product has been changed: prices, usage limits, subscription rules, refund logic and payment settings are exactly as they were. Paid plans are switched off (priced at ₹0), and payments are off in production.

How to use this page: for each item, mark **Approve**, **Change** (write the change) or **Reject**, then date it. The "Needs finance" lines are for the finance team to confirm before anything is built.

| # | Decision | Recommended | CEO decision |
|---|---|---|---|
| 1 | Prices and validity | Free ₹0; Monthly ₹149 (30 days); Quarterly ₹299 (90 days); Yearly ₹599 (365 days) | **Approved 16 Nov 2026** |
| 2 | GST | Company is GST-registered; show prices GST-inclusive; issue tax invoices | **Approved 16 Nov 2026** |
| 3 | Usage limits | See the table in item 3 | **Approved 16 Nov 2026** |
| 4 | Subjects required before paid launch | Sell only subjects whose content is ready; start with Physics if ready; no "all subjects" claim | **Approved 16 Nov 2026** |
| 5 | Abandoned tests | Only submitted tests count against a limit; unfinished tests can be resumed | **Approved 16 Nov 2026** |
| 6 | Tests in progress at expiry | A started test can be finished; no new paid tests after expiry | **Approved 16 Nov 2026** |
| 7 | Partial refunds | A partial refund adjusts validity proportionally; a full refund revokes; a duplicate-payment refund leaves a valid pass alone | **Approved 16 Nov 2026** |

---

## 1. Prices and validity

**Recommended:** Free ₹0, no expiry. Monthly ₹149 for 30 days. Quarterly ₹299 for 90 days. Yearly ₹599 for 365 days. Passes are prepaid and do not renew by themselves.

**Today:** the plan table holds the three paid plans at ₹0, switched off, with 30, 90 and 365 days. A price change applies to new orders only; existing orders keep the price they were made at. A paid plan cannot be switched on at ₹0, and the smallest order is ₹1.

**Technical:** the prices are data, so entering them needs no code change. The consequence of item 2 (invoices) does need code.

**Financial:**
- About ₹149 a month, ₹100 a month and ₹50 a month. Yearly saves 66% against paying monthly, quarterly saves 33%.
- Yearly is 20% under the Testbook ₹749 pass in the market comparison.
- Razorpay charges 2% plus GST on its fee, about ₹3.50 on ₹149, ₹7 on ₹299 and ₹14 on ₹599. Whether the fee is returned on a refund must be confirmed with Razorpay (I assume it is not).
- Content cost, not infrastructure, is the main cost. I have no figure for it, so I cannot give a break-even point.

**Open questions:** none beyond items 2 to 4.

## 2. GST

**Recommended (CEO note):** the company is GST-registered, so the pricing display, invoices and payment calculations must account for GST. Finance to confirm the treatment before implementation.

**Today:** the system stores one amount per order and has no tax fields, no invoice, no invoice number and no credit note. The gateway invoices only its own fee to the company. The docs list GST invoices as not built.

**Technical (new work):**
- Store the taxable value, GST rate and GST amount on each order, and the company's GSTIN, legal name, address and SAC code in configuration.
- Issue a tax invoice for each captured payment, with a gap-free number sequence per financial year, created once even if a webhook is repeated. Email it and show it on the student's billing page. Admins need to be able to download it.
- Issue a credit note for each refund, matching the refund amount.
- Place of supply decides CGST and SGST versus IGST. The app does not collect the student's state, so either it must be collected at checkout, or finance must approve a rule that avoids it.
- Order amount stays the GST-inclusive total, so the checkout amount, the signature check and the exact-amount rule do not change.

**Financial (assuming 18%, which finance must confirm):**

| Plan | Price paid | Taxable value | GST | Gateway fee (2% + GST) | Left after both |
|---|---|---|---|---|---|
| Monthly | ₹149 | ₹126.27 | ₹22.73 | ₹3.52 | ₹122.75 |
| Quarterly | ₹299 | ₹253.39 | ₹45.61 | ₹7.06 | ₹246.33 |
| Yearly | ₹599 | ₹507.63 | ₹91.37 | ₹14.14 | ₹493.49 |

- GST on the gateway fee may be claimable as input credit; finance to confirm. That adds about ₹0.54, ₹1.08 and ₹2.16.
- If prices were instead ex-GST, the student would pay ₹175.82, ₹352.82 and ₹706.82, which breaks the price points above. Showing inclusive prices is the usual way to keep them.

**Needs finance:** GST rate and SAC code, whether prices are shown inclusive, invoice series format, place-of-supply rule for students in other states, credit-note practice, and who files returns.

## 3. Usage limits

**Recommended:**

| Feature | Free | Paid (per 30 days) |
|---|---|---|
| Practice sets | 10 | 300 |
| Topic tests | 4 | 60 |
| Mock tests | 1 | 12 |
| Revision cards | 25 active | Unlimited |
| Bookmarks and notes | 50 | Unlimited |

**Today:** only practice sets, topic tests and mock tests are enforced, over a rolling 30 days, at the point a test or practice set starts. The free plan has no limits at all, so every student has full access. Revision cards, bookmarks and notes are not limited anywhere.

**Technical:**
- The first three limits are plan data and need no code.
- Revision cards, bookmarks and notes need new limit types and checks where each is created. These are totals, not 30-day windows, so they need their own counting rule.
- Decide what happens to students who already hold more than 25 cards or 50 bookmarks when the limit starts (keep what they have and block new ones is the least harmful), and to a paid student who goes back to Free with more than the free limit.
- Students need to see their usage and what blocks them, so the profile or plans page changes.

**Financial:** the limits protect running cost only a little, since it is small. Their main job is to make paid worth buying. Introducing free limits will change access for every existing student, so announce it first.

**Note:** the "300 practice sets" cap is fair use, not a promise of unlimited. Today the question bank is small, so the real ceiling is content.

## 4. Subjects required before paid launch

**Recommended:** launch paid access only for subjects with enough verified and published questions, explanations, topic tests and mock tests. Start with Physics if its content is ready. Expand as other subjects become ready. Do not advertise all-subject access early.

**Today:**
- 787 Physics questions are approved but none is published to students. The approval was a management bulk approval, not an individual expert check, so it must not be described as "verified by experts".
- 31 lessons exist. The in-app past-paper library is empty, and in-app viewing of official papers is off pending NTA permission. I have not confirmed how many complete mock tests exist.
- Plans are not tied to a subject. A paid plan today lifts the counters across everything.

**Technical:** no change is needed to sell "Physics" now, as long as the plan description says exactly what is available. Selling per subject later needs a new entitlement structure.

**Financial and launch dependencies:** the paid launch is blocked on more than content:
- content publishing (a separate approval);
- production migrations (production has only the early ones; the local database is at 0032);
- a Razorpay account and its checks;
- a public domain for webhooks;
- GST invoices (item 2);
- a decision on the email domain.

**Needs CEO:** the objective test for "ready", for example the number of published questions, the share with explanations, the number of topic tests and the number of full mocks. I have not set numbers.

## 5. Abandoned tests

**Recommended:** only submitted tests count against a limit. Students can resume a test interrupted by a dropped connection or an accidental exit.

**Today:** every test or practice set that is started counts, including unfinished ones. Answers are saved as the student goes, and an unfinished session can be reopened. A timed test that has passed its deadline is submitted automatically the next time it is opened. A test never opened again stays unfinished.

**Technical:**
- Counting only submitted sessions is a small change to the usage query.
- It opens a gap: a student can start many sessions and view the questions without ever submitting, getting unlimited viewing. Free students could read the bank without being limited.
- Mitigations to choose from: limit how many unfinished sessions a student can hold at once; count a session once the student has answered a set number of questions; auto-submit sessions after a time limit.
- Untimed practice sets have no deadline, so they stay open indefinitely.

**Financial:** only a small risk. Hard to quantify. Scraping the question bank is the real exposure.

## 6. Tests in progress when a pass ends

**Recommended:** a student may finish a test they started while subscribed, but cannot start a new paid test after expiry.

**Today:** this is already how it behaves. The plan is checked only when a session starts, never when answers are saved or the test is submitted. A pass ending during a test does not interrupt it.

**Technical:** no change is needed. It should be confirmed with a test, which is one of the planned security tests.

**Edge case to decide:** an untimed practice set has no deadline, so one started the day before expiry could be finished or resumed indefinitely. Consider a finishing window such as the test's own time limit, or a fixed number of days.

**Financial:** negligible, apart from that edge case.

## 7. Partial refunds

**Recommended:**
- A partial refund does not end the whole pass. Validity is reduced in proportion to the amount refunded.
- A full refund revokes the pass tied to that payment.
- A refund of a duplicate payment does not affect an otherwise valid pass.

**Today:**
- Any refund, of any size, ends the whole pass.
- Refunds are made in the Razorpay dashboard and arrive by webhook, or an admin records them by hand. Nothing checks a recorded refund against the gateway.
- Passes stack: a new pass starts when the current one ends. If the first of two stacked passes is refunded, the second keeps its later start date, leaving a gap.

**Technical (new work):**
- Track the total refunded per order. One order can have several refunds, and each refund id must still count only once.
- Pick the proportional rule (see below) and apply it, shortening the pass and moving any later stacked pass.
- Recalculate stacked passes whenever one is shortened or revoked, so no gaps or overlaps appear.
- Recognise a duplicate payment, meaning two payments for one purchase, and keep the pass it did not create.
- Add refunds started from the admin console through Razorpay (not built), or keep recording by hand. Add the credit note from item 2.
- Tests for every refund case, including repeated and delayed refund events.

**Rule to decide:** "proportional" has two common meanings.
1. Shorten the pass by the refunded share of the whole price. A ₹299 pass with ₹100 refunded loses about 30 of 90 days.
2. Refund the unused part only, so the refund depends on how much time is left.

I recommend rule 1 for partial refunds because it is simple to explain and to audit.

**Financial:**
- A refunded sale returns GST through a credit note. Razorpay's fee is probably not returned, so each refunded sale loses its fee.
- There is no refund policy yet (for example a window in days or the reasons accepted). One is needed.

---

## Other decisions already waiting
- Whether I may create a Razorpay test-mode account, or you supply test keys. No account exists.
- Whether refunds are started from the admin console or stay manual.
- Which sending domain CUET uses for email (a subdomain of the Alfanumrik domain is recommended); DNS changes and live sending are not approved.
- Which of the nine proposed admissions sources to approve. None is approved.
- Production deployment and production migrations: on hold, not approved.
- Publishing the 786 approved Physics questions to students: a separate approval, not given.

## What was not changed
No code, database, plan configuration, price, limit, subscription rule, refund logic or payment setting was changed to prepare this page. The existing configuration stays until these decisions are approved.
