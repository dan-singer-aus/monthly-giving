# Billing Flow

This document explains how billing works end-to-end — from a user subscribing to their amount being updated each month.

---

## Core Concept

Alumni are charged based on how many years have passed since they graduated:

```
monthly_amount = max(current_year - graduation_year, 1) × $1
```

This is implemented as a Stripe subscription with a **quantity** equal to `yearsOut` and a **unit price of $1/month**. The quantity is recalculated and updated automatically before each billing cycle — no cron jobs.

**Relevant code:** `src/domain/billing.ts` — `computeYearsOut()` and `computeMonthlyAmount()`

---

## Subscription Lifecycle

### 1. Checkout

The user clicks "Subscribe" on the frontend. The frontend calls `POST /api/billing/checkout-session`, which:

1. Looks up the user's graduation year from the `users` table
2. Looks up or creates a Stripe customer in `billingCustomers`
3. Calls `computeYearsOut(graduationYear, currentYear)` to get the quantity
4. Creates a Stripe Checkout Session with:
   - Price: `STRIPE_PRICE_ID` ($1/month recurring)
   - Quantity: `yearsOut`
   - `proration_behavior: 'none'`
5. Returns the Checkout URL — the frontend redirects the user there

The user completes payment on Stripe's hosted page.

**Relevant code:** `src/services/billing/checkoutSession.handler.ts`

---

### 2. Subscription Created Webhook

After successful checkout, Stripe fires `customer.subscription.created`. The webhook handler:

1. Checks `stripeEvents` for idempotency — skips if already processed
2. Looks up the user via `billingCustomers` (Stripe customer ID → user ID)
3. Creates or updates a row in `billingSubscriptions` with status, `monthlyAmount`, and `currentPeriodEnd`
4. Marks the event as `processed` in `stripeEvents`

**Relevant code:** `src/services/webhooks/stripeWebhook.handler.ts`

---

### 3. Monthly Renewal — Quantity Update

A few days before each billing cycle, Stripe fires `invoice.upcoming`. This is the trigger for updating the subscription quantity:

1. Checks idempotency
2. Resolves the user from the billing customer mapping
3. Calls `computeYearsOut(graduationYear, currentYear)` — yearsOut increases by 1 each year
4. Compares the new quantity to the current Stripe subscription quantity
5. If different: updates the Stripe subscription quantity via the Stripe API (`proration_behavior: 'none'`)
6. Writes a row to `billingSyncLog` recording: `computedYearsOut`, `expectedQuantity`, `previousQuantity`, and the `actionTaken` (`updated_quantity`, `no_change`, `skipped_not_active`, `missing_mapping`, or `error`)

After this webhook, Stripe generates the invoice with the updated quantity and charges the user.

**Relevant code:** `src/services/webhooks/stripeWebhook.handler.ts`

#### `syncAction` values

| Value | Meaning |
|---|---|
| `updated_quantity` | Quantity was different; Stripe subscription updated |
| `no_change` | Quantity unchanged; nothing to do |
| `skipped_not_active` | Subscription is not active; skipped |
| `missing_mapping` | No user found for this Stripe customer; logged as error |
| `error` | Unexpected failure during processing |

---

### 4. Invoice Created / Paid

When Stripe finalises an invoice, it fires `invoice.created`. The handler syncs `billingSubscriptions.monthlyAmount` to match the actual invoiced amount.

When Stripe collects payment, it fires `invoice.paid`. The handler creates a row in `subscriptionPayments` recording: `userId`, `graduationYear`, `stripeInvoiceId`, `amountCents`, and `paidAt`. This is used for the class-totals endpoint and future receipt display.

---

### 5. Subscription Updated / Deleted

- `customer.subscription.updated` — syncs status, `monthlyAmount`, `currentPeriodEnd`, and `cancelAtPeriodEnd` to `billingSubscriptions`
- `customer.subscription.deleted` — sets status to `canceled` in `billingSubscriptions`

---

## Customer Portal

Subscribers can manage their subscription (cancel, reactivate, view invoices) via the Stripe Customer Portal. The frontend calls `POST /api/billing/portal-session`, which returns a Stripe-hosted portal URL.

**Relevant code:** `src/services/billing/portalSession.handler.ts`

---

## Subscription Status

`GET /api/subscription` returns the current subscription state for the authenticated user:

- `{ subscribed: false }` — no subscription on record
- `{ subscribed: true, status, monthlyAmount, currentPeriodEnd, cancelAtPeriodEnd }` — active subscription details

**Relevant code:** `src/services/subscription/subscription.handler.ts`

---

## Receipts

`GET /api/receipts` fetches the last 100 paid invoices directly from the Stripe API (not from the local DB) and returns them with amount, dates, and a hosted invoice URL.

**Relevant code:** `src/services/receipts/receipts.handler.ts`

---

## Idempotency

Every webhook event is recorded in `stripeEvents` on arrival. Before processing, the handler checks whether the event ID already has a `processed` status. If so, it returns 200 immediately without reprocessing. This ensures Stripe retries are safe.

---

## Audit Trail

Every quantity recalculation triggered by `invoice.upcoming` is logged to `billingSyncLog`, whether or not the quantity actually changed. This makes it possible to audit exactly what happened before any invoice was generated.

---

## Sequence Diagram

```
User                Frontend           API                  Stripe              DB
 |                     |                |                     |                  |
 |---click subscribe-->|                |                     |                  |
 |                     |--POST checkout-session-------------->|                  |
 |                     |                |--computeYearsOut--> |                  |
 |                     |                |--create session---->|                  |
 |                     |<---checkout URL--------------------- |                  |
 |<--redirect----------|                |                     |                  |
 |---complete checkout on Stripe------->|                     |                  |
 |                                      |--subscription.created webhook-------->|
 |                                      |                     |--upsert billingSubscriptions
 |                                      |                     |                  |
 |     ... (days before renewal) ...    |                     |                  |
 |                                      |<--invoice.upcoming webhook------------|
 |                                      |--computeYearsOut    |                  |
 |                                      |--update subscription quantity-------->|
 |                                      |--write billingSyncLog---------------->|
 |                                      |                     |                  |
 |                                      |<--invoice.created webhook-------------|
 |                                      |--sync monthlyAmount----------------->|
 |                                      |                     |                  |
 |                                      |<--invoice.paid webhook---------------|
 |                                      |--create subscriptionPayments-------->|
```
