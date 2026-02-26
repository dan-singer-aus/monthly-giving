# API Reference

This document covers all implemented API endpoints. It is the authoritative reference for request and response shapes.

> **Keep this file up to date.** Whenever a route under `app/api/` is added, changed, or removed, update this file to match.

---

## Endpoints

### `GET /api/health`

Health check. Verifies the API server and database are reachable.

**Auth:** None

**Request:** No body or parameters.

**Responses:**

| Status | Body              | When                      |
| ------ | ----------------- | ------------------------- |
| 200    | `{ "ok": true }`  | Server and DB are healthy |
| 503    | `{ "ok": false }` | DB ping failed            |

---

### `GET /api/me`

Returns the authenticated user's profile. Always returns 200 — use the `authenticated` field to distinguish logged-in from anonymous sessions.

**Auth:** User session (Supabase; session cookie read from request headers)

**Request:** No body or parameters.

**Responses:**

| Status | Body                                         | When                                              |
| ------ | -------------------------------------------- | ------------------------------------------------- |
| 200    | `{ "authenticated": false }`                 | No valid session, or session user not found in DB |
| 200    | `{ "authenticated": true, "user": { ... } }` | Valid session with matching user record           |

**Authenticated response shape:**

```json
{
  "authenticated": true,
  "user": {
    "id": "uuid",
    "email": "string",
    "firstName": "string",
    "lastName": "string",
    "graduationYear": 2010,
    "role": "user" | "admin"
  }
}
```

---

### `POST /api/billing/checkout-session`

Creates a Stripe Checkout session for the authenticated user to start a subscription.
If the user does not yet have a Stripe customer record, one is created automatically.

**Auth:** User session (Supabase)

**Request body:**

```json
{
  "successUrl": "string (URL)",
  "cancelUrl": "string (URL)"
}
```

**Responses:**

| Status | Body                                     | When                                                 |
| ------ | ---------------------------------------- | ---------------------------------------------------- |
| 200    | `{ "url": "string" }`                    | Checkout session created — redirect user to this URL |
| 400    | `{ "error": "...", "details": { ... } }` | Invalid request body                                 |
| 401    | `{ "error": "Unauthorized" }`            | No valid session                                     |
| 404    | `{ "error": "User not found" }`          | Session user not in DB                               |
| 500    | `{ "error": "Internal server error" }`   | Stripe error or misconfiguration                     |

---

### `POST /api/webhooks/stripe`

Receives Stripe webhook events. Verifies the request signature, records the event for idempotency, and processes subscription lifecycle changes.

**Auth:** Stripe webhook signature — verified via the `stripe-signature` header using `STRIPE_WEBHOOK_SECRET`.

**Request body:** Raw Stripe event payload (JSON). Must be read as raw bytes for signature verification — do not pre-parse.

**Responses:**

| Status | Body                   | When                                         |
| ------ | ---------------------- | -------------------------------------------- |
| 200    | `{ "received": true }` | Event received and processed (or ignored)    |
| 400    | `{ "error": "..." }`   | Missing or invalid `stripe-signature` header |
| 500    | `{ "error": "..." }`   | `STRIPE_WEBHOOK_SECRET` env var not set      |

> After signature verification, the handler **always returns 200** — even on processing errors. This prevents Stripe from retrying events that failed due to internal issues. Processing failures are recorded in `stripeEvents` with `processingStatus: 'failed'`.

**Handled events:**

| Event type                      | Action                                                                       |
| ------------------------------- | ---------------------------------------------------------------------------- |
| `customer.subscription.created` | Creates a `billingSubscriptions` record linking the user to the subscription |
| `customer.subscription.updated` | Updates `status`, `currentPeriodEnd`, and `cancelAtPeriodEnd`                |
| `customer.subscription.deleted` | Updates `status` to `canceled`                                               |
| All others                      | Recorded in `stripeEvents` with `processingStatus: 'ignored'`                |

**Idempotency:** Every event is checked against the `stripeEvents` table by `stripeEventId` before processing. If the event has already been `processed` or `ignored`, the handler returns 200 immediately without re-processing.

---

### `POST /api/billing/portal-session`

Creates a Stripe Customer Portal session so the authenticated user can manage their
subscription (update payment method, cancel, view invoices, etc.).

**Auth:** User session (Supabase)

**Request body:**

```json
{
  "returnUrl": "string (URL)"
}
```

**Responses:**

| Status | Body                                          | When                                               |
| ------ | --------------------------------------------- | -------------------------------------------------- |
| 200    | `{ "url": "string" }`                         | Portal session created — redirect user to this URL |
| 400    | `{ "error": "...", "details": { ... } }`      | Invalid request body                               |
| 401    | `{ "error": "Unauthorized" }`                 | No valid session                                   |
| 404    | `{ "error": "No billing customer found..." }` | User has no subscription yet                       |
| 500    | `{ "error": "Internal server error" }`        | Stripe error                                       |
