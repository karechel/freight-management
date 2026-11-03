# Backend implementation plan

Status: **approved by the repository owner on 2026-11-03. Phase 0 is in progress** on `feature/backend-foundation`. Decisions on the formerly open items are in §7. The audit behind this plan is in the root `CLAUDE.md` (LOG-20261029-2146-backend-audit).

## 1. Decisions

| Topic | Decision |
|---|---|
| Development data | Fictional data only throughout development. No real client data in development databases, tests, screenshots or commits. |
| Client data | Importing the client's real data is a separate phase before production launch (§6, Phase 5). |
| Validation | `class-validator` and `class-transformer`, with NestJS's built-in `ValidationPipe` configured globally. Every incoming request is validated through a DTO. |
| Authentication | `@nestjs/jwt`, plus Node's built-in `crypto` for password hashing. Delivered in Phase 0. |
| Authorization | Guards on the backend enforce roles and permissions on protected endpoints. The UI hiding a button is never the control. |
| Customer ids | Numeric database ids in API URLs. Any customer reference code stays a separate field and is not part of this plan. No migration needed. |
| Reference formats | Configurable by an authorized administrator without code changes. Existing frontend formats are the defaults. Issued references never change and must be unique (§3). |

## 2. API conventions

- **Routes:** resources under `/api`, for example `/api/parties/12`. `GET /health` stays where it is. `GET /` is removed.
- **Errors:** one format: `{ statusCode, error, message, details[] }`, where `details` lists field-level problems.
  - Validation failure: 400.
  - Not signed in: 401.
  - Not permitted: 403.
  - Not found: 404.
  - Duplicate or conflicting state: 409 (PostgreSQL `23505`).
  - Linked record missing: 422 (PostgreSQL `23503`).
- **Money:** exact decimal strings such as `"1250.00"`. Totals and balances are summed in SQL, never with JavaScript floats.
- **Dates:** instants are ISO 8601 with offset. Calendar dates are `YYYY-MM-DD`, read on the Africa/Nairobi calendar.
- **Lists:** `limit` and `offset`, returning `{ items, total }`.
- **Contracts:** every endpoint is documented in `Frontend/frontend/docs/api-contracts.md` as its phase is delivered.

## 3. Configurable reference numbers

**Requirements (repository owner):** an authorized administrator can change prefixes and numbering formats without a code change; already-issued references stay as they are; references are unique.

**One schema addition is needed** (additive; approved, see §7): a `ReferenceFormat` table.

| Column | Purpose |
|---|---|
| `documentType` (unique) | shipment, quotation, invoice, booking, credit_note, payment, customs_entry |
| `template` | For example `FMS-{MODE}-{YYMM}-{SEQ:4}` |
| `resetPolicy` | `never`, `yearly` or `monthly`: when the running number restarts |
| `updatedById`, `updatedAt`, `createdAt` | Who changed it and when (each change is also written to `AuditLog`) |

`NumberSequence` is reused as it stands. `prefix` holds the document type, and `year` holds the counter's period: `0` for never, `2026` for yearly, `202611` for monthly.

**Starting formats:**

| Document | Template | Example | Source |
|---|---|---|---|
| Shipment | `FMS-{MODE}-{YYMM}-{SEQ:4}` | `FMS-SEA-2610-0041` | Existing frontend |
| Quotation | `QT-{YYMM}-{SEQ:4}` | `QT-2610-0057` | Existing frontend |
| Invoice | `INV-{YYMM}-{SEQ:4}` | `INV-2610-0112` | Existing frontend |
| Booking | `BKG-{YYMM}-{SEQ:4}` | `BKG-2611-0001` | Proposed, same pattern |
| Credit note | `CN-{YYMM}-{SEQ:4}` | `CN-2611-0001` | Proposed, same pattern |
| Payment receipt | `RCT-{YYMM}-{SEQ:4}` | `RCT-2611-0001` | Proposed, same pattern |
| Customs entry | `CE-{YYMM}-{SEQ:4}` | `CE-2611-0001` | Proposed, same pattern |

All start with `resetPolicy = never`, matching the frontend's description: "NNNN is a running number" that continues rather than restarting each month or for each mode.

**How generation works:**
1. The service reads the document type's current format.
2. Inside the same transaction that creates the record, it increments the counter in one atomic `UPDATE … RETURNING`, which also serializes concurrent requests. If the record fails to save, the increment rolls back with it, so no number is lost.
3. It renders the template. Date tokens use the Africa/Nairobi date. Numbers grow past their padding rather than being cut off (`9999`, then `10000`).
4. It stores the result as plain text on the record. Later format changes cannot alter it, because issued references are never recalculated.

**How uniqueness is guaranteed:**
- Each record's `reference` or `number` column already has a database unique constraint, which is the final guarantee.
- If a format change makes a new reference match an old one (for example after restarting a counter), the service takes the next number and retries, a limited number of times, then returns a 409. It never overwrites.

**Rules checked when an administrator saves a format:**
- Exactly one `{SEQ:n}`, with padding from 1 to 10.
- Only known tokens: `{YYYY}`, `{YY}`, `{MM}`, `{YYMM}`, plus `{MODE}` for shipments only.
- Literal text limited to `A–Z`, `0–9` and `-`. References appear in URLs such as `/shipments/FMS-SEA-2610-0041`, so `/` and spaces are not allowed.
- Rendered length of at most 40 characters.
- `yearly` needs a year token and `monthly` needs year and month tokens, so a restarted counter does not knowingly repeat references.

**Administration:**
- `GET /api/reference-formats`.
- `PATCH /api/reference-formats/:documentType`, which requires the `settings.references.manage` permission (admin only at first).
- `POST /api/reference-formats/preview`, which shows the next reference before saving.
- The read-only Numbering table on the Settings page becomes an editor, shown only to permitted users.

## 4. Authentication and authorization design

- **Passwords:** `crypto.scrypt` with a per-user random salt and N=2^17, r=8, p=1. The stored value (`User.passwordHash`) records its parameters, so they can be strengthened later and hashes upgraded at next login. Comparison uses `timingSafeEqual`. Minimum length 12 characters.
  - Node 24.20 also offers `crypto.argon2`. It's a newer API, so scrypt is the plan; the stored format leaves room to switch.
- **Tokens:** short-lived JWT (8 hours), signed with `JWT_SECRET` from the environment, which must be present and at least 32 characters at startup. No refresh tokens at first; users sign in again.
- **Every request:** a global guard makes endpoints protected by default; only `@Public()` routes (login, health) are open. It loads the user's status and permissions from the database, so disabling a user or changing a role applies immediately.
- **Permissions:** a `@RequirePermission('code')` decorator checks `Permission` and `RolePermission` rows, so the matrix stays adjustable data.
- **Browser session:** the token lives in an HttpOnly cookie, not reachable from page scripts.
  - Next.js server code reads the cookie and forwards the token.
  - Browser actions go through a same-origin Next.js route that adds it.
  - Exact Next.js APIs are confirmed against `node_modules/next/dist/docs/` first, as `Frontend/frontend/AGENTS.md` requires.
- **Login attempts:** a simple in-memory limit per email and IP in Phase 0. Added hardening (`helmet`, a shared rate limiter) is a separate dependency decision before launch.
- **Credit-limit override:** `credit.override` for finance, management and admin only, recorded in `CreditCheck`. Checked at booking (Phase 2) and at invoicing (Phase 4).

## 5. Data for development

- **Reference data (always needed):** roles, the permission matrix (`docs/database-design.md` §6), charge types, the 5-year retention policy and the default reference formats. An idempotent script, safe to re-run.
- **First admin:** created by the same script from environment variables. No password is committed.
- **Fictional business data (development only):**
  - A separate script based on the frontend's existing demo records, so pages look the same when they go live.
  - It uses `.example` emails and leaves KRA PINs empty, as the demo data does.
  - It records KES only and no M-Pesa, mapping or omitting demo values that conflict.
  - It sets counters to continue after seeded references.
  - It refuses to run when `NODE_ENV=production`.

## 6. Phases

Every phase: feature branch and PR; DTO validation; business rules in services and transactions; `AuditLog` entries for important changes; unit tests plus end-to-end tests; API contracts updated; frontend pages switched from demo to live through `lib/data` and the session store, keeping existing designs; `CLAUDE.md` updated.

**Phase 0: Backend foundation**
- Remove `GET /`. Add `CORS_ORIGINS` and `JWT_SECRET` to environment validation and `.env.example`. Declare `dotenv`. Close Prisma on shutdown. Fix the `supertest/types` type error.
- Global `ValidationPipe` and exception filter, including database error mapping.
- Authentication, guards and permissions (§4); `GET /api/auth/me`, login and logout.
- Shared services: audit log, reference generation and administration (§3), pagination, `updatedAt` handling.
- `ReferenceFormat` migration (after approval), seed scripts (§5).
- Frontend: POST, PATCH and DELETE in the API client with field errors, a login page, signed-out handling, the Numbering editor.
- Done when: unauthenticated and unpermitted requests are refused in end-to-end tests, concurrent reference generation produces no duplicates, and format changes leave issued references unchanged.

**Phase 1: Customers**
- `/api/parties?role=customer`: search, status filter, paging; `GET /:id` with contacts and calculated figures; create, update, archive, restore; contacts add, edit, remove.
- Rules: required name, valid email, KRA PIN format and uniqueness, payment terms 0–365, credit limit ≥ 0. Only finance, management and admin change terms or limits. Customers are archived, never deleted.
- Frontend: Customers list and detail go live; new create and edit forms from the existing form components.

**Phase 2: Quotations and bookings**
- Quotations: CRUD with lines saved in one transaction, server-calculated totals, editable only while draft or sent, status endpoints, expiry from the valid-until date, duplicate.
- Bookings: converting an accepted quotation creates the booking automatically (409 if one exists); standalone creation, confirm, cancel with a reason. Charge types read endpoint.
- Credit-limit check at booking: warning, then proceed or block. Only `credit.override` holders may proceed; every decision is recorded in `CreditCheck`.
- Frontend: quotation pages go live; KES only; a minimal booking list and detail.

**Phase 3: Shipments and tracking**
- Shipments from a booking or standalone (clearing-only). Server-side views: active, needs attention, arriving, customs, delayed.
- Milestones, delays with notes, containers, customs summary, history from `AuditLog`, current ETA from open delays. Status rules such as "delivered needs a delivery time".
- Frontend: shipment pages go live.

**Phase 4: Remaining modules (scope to be agreed)**
Documents with private storage, customs, finance (invoices, credit notes, payments, allocations, credit checks), tasks and notifications, reports, user management. Agents, suppliers and transporters reuse `/api/parties`.

**Phase 5: Client data import (before production launch)**
A separate, planned phase: source data review, mapping, validation and dry runs on a non-production copy, reconciliation with the client, handling of existing reference numbers and counters, then production security hardening and launch checks. Real data enters only here, on approved infrastructure.

## 7. Decided by the repository owner (2026-11-03)

1. **`ReferenceFormat` migration:** approved (additive).
2. **Test database:** a separate local test database is approved, with migrations applied to it.
3. **Seed scripts:** approved on the repository owner's local development database.
4. **Bookings:** converting a quotation creates the booking automatically; minimal booking pages are added.
5. **Credit-limit checks:** at booking and at invoicing.
6. **Start:** Phase 0 on `feature/backend-foundation`, branched from `main`.
7. **Documentation:** committed directly to `main` before Phase 0 starts.
