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

## Overview

```
User                Frontend           API                  Stripe              DB
 |                     |                |                     |                  |
 |---click subscribe-->|                |                     |                  |
 |                     |--POST checkout-session-------------->|                  |
 |                     |                |--computeYearsOut    |                  |
 |                     |                |--create session---->|                  |
 |                     |<---checkout URL---------------------|                  |
 |<--redirect----------|                |                     |                  |
 |---complete payment on Stripe's page->|                     |                  |
 |                                      |<--subscription.created webhook--------|
 |                                      |--upsert billingSubscriptions--------->|
 |                                      |                     |                  |
 |     ... (days before renewal) ...    |                     |                  |
 |                                      |<--invoice.upcoming webhook------------|
 |                                      |--computeYearsOut    |                  |
 |                                      |--update quantity--->|                  |
 |                                      |--write billingSyncLog---------------->|
 |                                      |                     |                  |
 |                                      |<--invoice.created webhook-------------|
 |                                      |--sync monthlyAmount----------------->|
 |                                      |                     |                  |
 |                                      |<--invoice.paid webhook---------------|
 |                                      |--create subscriptionPayments-------->|
```

---

## 1. Checkout

The user clicks "Subscribe". The frontend calls `POST /api/billing/checkout-session`.

```
User          Frontend              API                        Stripe
 |               |                   |                           |
 |--subscribe--->|                   |                           |
 |               |--POST /checkout-session------------------->  |
 |               |                   |--getById(userId)          |
 |               |                   |  → users (graduationYear) |
 |               |                   |--getByUserId              |
 |               |                   |  → billingCustomers       |
 |               |                   |    (or create customer)-->|
 |               |                   |--computeYearsOut()        |
 |               |                   |--create checkout session->|
 |               |<----{ url } ------|-----------------------<--|
 |<--redirect----|                   |                           |
 |------complete payment on Stripe's hosted page--------------->|
```

**What the API does:**
1. Authenticates the user (Bearer token → Supabase JWT)
2. Looks up graduation year from `users`
3. Looks up or creates a Stripe customer in `billingCustomers`
4. Calls `computeYearsOut(graduationYear, currentYear)` to get the quantity
5. Creates a Stripe Checkout Session with price `STRIPE_PRICE_ID`, quantity = yearsOut, `proration_behavior: 'none'`
6. Returns the Checkout URL

**Relevant code:** `src/services/billing/checkoutSession.handler.ts`

---

## 2. Subscription Created

After the user completes checkout, Stripe fires `customer.subscription.created`.

```
Stripe                    API                              DB
  |                        |                               |
  |--subscription.created->|                               |
  |                        |--getById(stripeEventId)       |
  |                        |  → stripeEvents (idempotency) |
  |                        |--getByStripeCustomerId        |
  |                        |  → billingCustomers (userId)  |
  |                        |--upsert billingSubscriptions->|
  |                        |  (status, monthlyAmount,      |
  |                        |   currentPeriodEnd)           |
  |                        |--markProcessed stripeEvents-->|
  |<---------- 200 --------|                               |
```

**What the webhook does:**
1. Checks `stripeEvents` — skips if already processed (idempotency)
2. Resolves user ID from the Stripe customer ID via `billingCustomers`
3. Creates a row in `billingSubscriptions` with status, `monthlyAmount`, and `currentPeriodEnd`
4. Marks the event as `processed`

**Relevant code:** `src/services/webhooks/stripeWebhook.handler.ts`

---

## 3. Monthly Renewal — Quantity Update

A few days before each billing cycle, Stripe fires `invoice.upcoming`. This is the trigger for updating the subscription quantity so the invoice reflects the correct amount.

```
Stripe                    API                              Stripe           DB
  |                        |                                 |               |
  |--invoice.upcoming----->|                                 |               |
  |                        |--idempotency check ------------>|               |
  |                        |--getByStripeCustomerId          |               |
  |                        |  → billingCustomers (userId)    |               |
  |                        |--getById(userId)                |               |
  |                        |  → users (graduationYear)       |               |
  |                        |--computeYearsOut()              |               |
  |                        |                                 |               |
  |                        |  [if quantity changed]          |               |
  |                        |--updateSubscriptionQuantity---->|               |
  |                        |   proration_behavior: 'none'    |               |
  |                        |                                 |               |
  |                        |--create billingSyncLog------------------------->|
  |                        |  (computedYearsOut,             |               |
  |                        |   expectedQuantity,             |               |
  |                        |   previousQuantity,             |               |
  |                        |   actionTaken)                  |               |
  |                        |--markProcessed stripeEvents---->|               |
  |<---------- 200 --------|                                 |               |
  |                        |                                 |               |
  | [Stripe generates invoice and charges the updated amount]|               |
```

**`actionTaken` values logged to `billingSyncLog`:**

| Value | Meaning |
|---|---|
| `updated_quantity` | Quantity changed; Stripe subscription updated |
| `no_change` | Quantity unchanged; nothing to do |
| `skipped_not_active` | Subscription is not active; skipped |
| `missing_mapping` | No user found for this Stripe customer |
| `error` | Unexpected failure during processing |

**Relevant code:** `src/services/webhooks/stripeWebhook.handler.ts`, `src/repos/billingSyncLog.repo.ts`

---

## 4. Invoice Created

When Stripe finalises the invoice, it fires `invoice.created`. This syncs the local `billingSubscriptions.monthlyAmount` to match what was actually invoiced.

```
Stripe                    API                              DB
  |                        |                               |
  |--invoice.created------>|                               |
  |                        |--idempotency check            |
  |                        |--getByStripeSubscriptionId    |
  |                        |  → billingSubscriptions       |
  |                        |--updateById                   |
  |                        |  (monthlyAmount = invoiced)-->|
  |                        |--markProcessed stripeEvents-->|
  |<---------- 200 --------|                               |
```

**Relevant code:** `src/services/webhooks/stripeWebhook.handler.ts`

---

## 5. Invoice Paid

When Stripe collects payment, it fires `invoice.paid`. This creates a permanent payment record used for class totals and future receipt display.

```
Stripe                    API                              DB
  |                        |                               |
  |--invoice.paid--------->|                               |
  |                        |--idempotency check            |
  |                        |--getByStripeCustomerId        |
  |                        |  → billingCustomers (userId)  |
  |                        |--getById(userId)              |
  |                        |  → users (graduationYear)     |
  |                        |--create subscriptionPayments->|
  |                        |  (userId, graduationYear,     |
  |                        |   stripeInvoiceId,            |
  |                        |   amountCents, paidAt)        |
  |                        |--markProcessed stripeEvents-->|
  |<---------- 200 --------|                               |
```

**Relevant code:** `src/services/webhooks/stripeWebhook.handler.ts`, `src/repos/subscriptionPayments.repo.ts`

---

## 6. Subscription Updated / Deleted

```
Stripe                         API                         DB
  |                             |                           |
  |--subscription.updated------>|                           |
  |   (or .deleted)             |--idempotency check        |
  |                             |--getByStripeSubscriptionId|
  |                             |  → billingSubscriptions   |
  |                             |--updateById               |
  |                             |  (status, monthlyAmount,  |
  |                             |   currentPeriodEnd,       |
  |                             |   cancelAtPeriodEnd)----->|
  |                             |--markProcessed----------->|
  |<---------- 200 -------------|                           |
```

- `customer.subscription.updated` — syncs status, `monthlyAmount`, `currentPeriodEnd`, and `cancelAtPeriodEnd`
- `customer.subscription.deleted` — sets status to `canceled`

**Relevant code:** `src/services/webhooks/stripeWebhook.handler.ts`

---

## 7. Customer Portal

Subscribers can manage their subscription (cancel, reactivate, view invoices) via the Stripe Customer Portal.

```
User          Frontend              API                    Stripe
 |               |                   |                       |
 |--manage sub-->|                   |                       |
 |               |--POST /portal-session------------------>  |
 |               |                   |--getByUserId          |
 |               |                   |  → billingCustomers   |
 |               |                   |--create portal sess-->|
 |               |<----{ url } ------|<----------------------|
 |<--redirect----|                   |                       |
 |------manage subscription on Stripe's hosted page-------->|
```

**Relevant code:** `src/services/billing/portalSession.handler.ts`

---

## Idempotency

Every webhook event is recorded in `stripeEvents` on arrival. Before processing, the handler checks whether the event ID already has `processingStatus = 'processed'`. If so, it returns 200 immediately without reprocessing. Stripe retries are therefore safe.

---

## Audit Trail

Every `invoice.upcoming` execution — whether or not the quantity changed — is logged to `billingSyncLog`. This makes it possible to audit exactly what happened before any invoice was generated.
