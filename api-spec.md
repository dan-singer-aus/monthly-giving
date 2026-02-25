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
