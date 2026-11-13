# Plans and payments

Status on 13 November 2026: built and tested locally with a built-in test gateway. **Off in production.** No gateway account exists, no price has been set, and no money can move.

## The model

Prepaid passes. A student pays once and gets a fixed number of days. Nothing renews by itself and no payment mandate is stored, so the RBI rules for recurring payments do not come into play. Buying again adds days after the current end date.

"Renewal" therefore means the student buys again. Three days before a pass ends, the student gets one email saying so (once email is switched on).

## What is configurable without code

All of this is in the `plans` table and edited in the admin console under **Plans and payments**:

| Setting | Notes |
|---|---|
| Price | In rupees on screen, stored in paise. A change applies to new orders only |
| Length in days | Per plan |
| On offer or not | A paid plan cannot be offered while its price is 0 |
| Limits per 30 days | Mock tests, topic tests, practice sets. Empty means no limit |
| "What students get" lines | Shown on the plan card |

The database starts with the free plan and three paid plans as drafts (1, 3 and 12 months) with **no price**. Nothing is offered to students until the owner sets a price and switches a plan on. The free plan starts with no limits, so nothing changes for students until a limit is set.

## Proposed gateway and pricing structure (for approval)

- **Gateway:** Razorpay, with Cashfree as the fallback if onboarding stalls. Razorpay charges 2% per payment and no setup or annual fee (read 13 November 2026; see `docs/provider-and-source-research-2026-11-13.md`).
- **Structure:** Free, 1 month, 3 months, 12 months. Prices are the owner's decision and are not set anywhere.
- **Not included:** GST invoices to students. The gateway invoices only its own fee, so customer invoices need a decision and a tax registration detail.

## Safety rules built in

- The amount is copied onto the order when it is created. Only that exact amount is accepted; a different amount is recorded as failed and gives no access.
- Access is given only after the gateway's signature is verified (browser return or webhook), or after the gateway's own records confirm a captured payment (reconciliation). The browser is never trusted on its own.
- Each gateway payment id, refund id and webhook event id is stored once, so a repeated webhook or a double click cannot give a second pass.
- Webhooks are checked against the raw request body with HMAC-SHA256 before anything in them is read. A bad signature is refused and logged.
- Only the platform's own order reference is sent to the gateway when an order is created. No card, bank or UPI detail is ever stored.
- Every price change, hand-given pass, cancellation and refund is written to the activity log under the administrator's account.

## Modes

Set by the `PAYMENTS_MODE` variable.

| Mode | Where | What happens |
|---|---|---|
| `off` | Production today; the default | No order can be created. Plans are shown without a pay button |
| `mock` | Local development only | Built-in test gateway with "payment succeeds" and "payment fails" buttons. Refused outside development |
| `test` | Any environment, with Razorpay **test** keys | Real Razorpay checkout in test mode; no money |
| `live` | Production, after approval | Needs live keys **and** `PAYMENTS_LIVE_APPROVED=yes`. Without both, payments stay off |

## Where the code is

| Part | File |
|---|---|
| Plans, access, orders, gateway calls, webhook, reconciliation, admin actions | `backend/src/services/billing.ts` |
| Student routes | `backend/src/routes/student.ts` (`/api/student/billing`, `.../orders`, `.../confirm`, `.../simulate`) |
| Public routes | `backend/src/routes/public.ts` (`/api/public/plans`, `/api/public/payments/webhooks/razorpay`) |
| Admin routes | `backend/src/routes/console.ts` (`/api/console/billing/*`, permission `billing:manage`) |
| Daily job | `backend/src/index.ts`: matches unpaid orders with the gateway and sends "ends soon" notices |
| Tables | migration `0014_plans_payments.sql`: `plans`, `subscriptions`, `payment_orders`, `payment_transactions`, `payment_events` |
| Screens | `frontend/src/pages/Plans.tsx`, `frontend/src/admin/Billing.tsx` |
| Tests | `backend/test/billing.test.ts` (13 tests), 13 checks in `backend/scripts/integration-trace.mjs` |

## What happens in each case

| Case | Result |
|---|---|
| Payment succeeds | Order paid, pass created, receipt email, plan page shows the end date |
| Payment fails | Order marked failed with the bank's reason, no access, the student can try again |
| Student closes the payment window | Order stays "waiting"; the daily job asks the gateway and closes it after a day if unpaid |
| Paid, but the browser never returned | The webhook pays the order; if that is also lost, reconciliation does |
| Refund made in the gateway dashboard | The webhook (or an administrator recording it) marks the order refunded and ends that pass |
| Limit reached on the free plan | The test does not start; the student sees the limit and a link to the plans page |

## To test with Razorpay (needs the owner's go-ahead to create the account)

1. Create a Razorpay account and take the **test** key id and secret.
2. Create a webhook in the Razorpay dashboard for `payment.captured`, `payment.failed`, `order.paid` and `refund.processed`, pointing at `/api/public/payments/webhooks/razorpay`, and note its secret. A webhook needs a public address, so this step needs a deployed environment or a tunnel.
3. Put `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET` in `backend/.dev.vars` (never in Git) and set `PAYMENTS_MODE=test`.

## Not built yet

- Refunds started from the admin console. Today a refund is made in the gateway dashboard and arrives by webhook, or is recorded by hand.
- GST invoices.
- Auto-renewing subscriptions (deliberately left out for launch).
- Coupons and discounts.
