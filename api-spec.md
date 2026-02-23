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

| Status | Body            | When                     |
| ------ | --------------- | ------------------------ |
| 200    | `{ "ok": true }` | Server and DB are healthy |
| 503    | `{ "ok": false }` | DB ping failed            |

---

### `GET /api/me`

Returns the authenticated user's profile. Always returns 200 — use the `authenticated` field to distinguish logged-in from anonymous sessions.

**Auth:** User session (Supabase; session cookie read from request headers)

**Request:** No body or parameters.

**Responses:**

| Status | Body | When |
| ------ | ---- | ---- |
| 200 | `{ "authenticated": false }` | No valid session, or session user not found in DB |
| 200 | `{ "authenticated": true, "user": { ... } }` | Valid session with matching user record |

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
