# Implementation roadmap — Freight Management

Written 2026-11-16 (LOG-20261116-1554-docs-restructure in `CLAUDE.md` §13), from Git history, the code on `main` at `d966e35`, and the documents below.

- **Authoritative source:** `docs/backend-implementation-plan.md` (approved by the repository owner on 2026-11-03). This file summarises it and adds status. If they disagree, the approved plan wins; record the difference in `CLAUDE.md` §13.
- **Business rules and schema:** `docs/database-design.md`.
- **API contracts:** `Frontend/frontend/docs/api-contracts.md`.

Status labels: **Verified** (checks run and recorded) · **In progress** · **Not started** · **Scope to be agreed**.

## Phase numbering: read this first

The project has used "phase" for three different things. In current instructions, **"Phase N" means the backend phases (0–5) below.**

| Name used | What it was | When |
|---|---|---|
| Commit "Phase 0: fix stale tests, add env validation…" (`42ae8a8`) | Early test and env fixes, before any plan existed. **Not** backend Phase 0 | 2026-10-09 |
| Frontend "phases 1–3" | Demo-data UI work: shipments and delays; quotations, customers and agents; document uploads | 2026-10-20 – 10-21 |
| **Backend Phases 0–5** | The approved plan below | From 2026-11-03 |

## Work completed before the backend plan

| Work | Status | Evidence |
|---|---|---|
| Frontend on fictional demo data: shell, dashboard, shipments, delays, quotations, customers, agents, documents, expenses, reports, users, settings and audit-log preview, notifications and tasks | **Verified** (build, logic tests, headless-browser runs, 2026-10-21); merged by PR #1 (`f663dd2`, 2026-10-29) | `docs/activity-log.md` Part C, LOG-20261019… to LOG-20261022… |
| Database schema: 33 tables, two migrations; Node 24.20.0 pinned | **Verified** on the repository owner's local DB (2026-10-26); merged by PR #2 (`293a951`, 2026-10-29) | LOG-20261026-2215-database-schema; `docs/database-design.md` |

## Backend phases

Every phase, per the approved plan:
- a feature branch and a PR into `main`
- DTO validation, with business rules in services and transactions
- `AuditLog` entries for important changes
- unit and end-to-end tests
- `api-contracts.md` updated
- the matching frontend pages switched from demo to live data, keeping their design
- `CLAUDE.md` updated

### Phase 0 — Backend foundation · **Verified**, on `main` (PR #3, `af73edf` → `ff7d6fb`)
- **Objective:** a secure base for every later endpoint.
- **Built:**
  - `GET /` removed.
  - `/api` prefix and global `ValidationPipe`; one error format, with database-error mapping.
  - `CORS_ORIGINS` and `JWT_SECRET` validation.
  - Sign-in with scrypt and an 8-hour JWT in an HttpOnly cookie; a guard that protects every route by default; permissions read from the database on each request.
  - Audit service and pagination DTO.
  - Configurable reference formats: generation, preview and admin API.
  - Seed scripts (setup data and first admin; fictional demo data).
  - Frontend: login page, user menu, Numbering editor.
- **Schema:** additive `ReferenceFormat` table (migration `20261103T1857_add_reference_format`).
- **Dependencies:** `class-validator`, `class-transformer`, `@nestjs/jwt`; `dotenv` declared.
- **Recorded checks (2026-11-03):** 37 unit, 34 end-to-end and 27 browser checks pass. Not re-run since.
- **Known limits:**
  - Sign-out does not revoke the token.
  - The login limit is held in memory.
  - Demo pages are open without sign-in.
  - The `documentation` role is not seeded.

### Phase 1 — Customers · **Verified**, on `main` (PR #4, `94a575f` → `d966e35`)
- **Depends on:** Phase 0.
- **Built:**
  - `/api/parties` (customers): search, status filter and paging; detail with contacts and calculated figures; create, update, archive and restore; add, edit and remove contacts.
  - Billing details hidden from roles without permission; every change audited.
  - Live `/parties` list, detail, new and edit pages.
- **Schema:** none. **Dependencies:** none.
- **After pulling:** existing databases must run `npm run db:seed` to add the new `parties.status.manage` permission.
- **Recorded checks (2026-11-04):** 70 unit, 112 end-to-end and 91 browser checks pass. Not re-run since.
- **Gaps carried forward:**
  - Agents, carriers and transporters are still demo data (Phase 4).
  - Live customers show zero shipment and invoice figures until Phases 2–3.
  - Nothing yet blocks new work for an archived customer (Phases 2–3 must check `archivedAt`).
  - Four decisions dated 2026-11-04 (`CLAUDE.md` §9) came from a session whose operator was not confirmed, and await the repository owner's review.

### Phase 2 — Quotations and bookings · **Not started** (awaiting explicit approval)
- **Depends on:** Phases 0 and 1 (customers, reference formats, permissions, audit).
- **Schema:** none expected. `Quotation`, `QuotationLine`, `Booking`, `ChargeType`, `CreditCheck` and `NumberSequence` already exist. Confirm against `contract.prisma` before starting; any change needs approval and a reviewed migration.
- **Backend:**
  - Quotations: CRUD with lines saved in one transaction; totals calculated on the server as exact decimals; editable only while draft or sent; status endpoints; expiry from the valid-until date; duplicate.
  - Bookings: converting an accepted quotation creates the booking automatically (409 if one exists); standalone creation; confirm; cancel with a reason.
  - Charge-types read endpoint.
  - Credit-limit check at booking: a warning, then proceed only with `credit.override`; every decision recorded in `CreditCheck`.
  - References from the configured formats (`QT-…`, `BKG-…`).
  - New quotations and bookings refused for archived customers.
- **Frontend:** quotation pages go live (KES only); a minimal booking list and detail.
- **Tests needed:**
  - Unit: totals and rounding, status transitions, expiry.
  - End-to-end: permissions per role, conversion and its 409, credit warning and override, the archived-customer refusal, unique references under concurrency.
  - Browser: create, send, accept, convert, booking.
- **Done when** (proposed; the approved plan states no explicit criteria for this phase):
  - All of the above pass, and quotation pages read and write live data.
  - API contracts are updated.
  - Phase 1's archived-customer gap is closed for quotations and bookings.

### Phase 3 — Shipments and tracking · **Not started**
- **Depends on:** Phase 2 (bookings); clearing-only shipments can be created standalone.
- **Schema:** none expected (`Shipment`, `Container`, `ShipmentMilestone`, `ShipmentIssue`, `CustomsEntry` exist).
- **Backend:**
  - Shipments from a booking or standalone.
  - Server-side views: active, needs attention, arriving, customs, delayed.
  - Milestones; delays with notes; containers; customs summary.
  - History from `AuditLog`; current ETA from open delays.
  - Status rules, for example "delivered needs a delivery time".
  - New shipments refused for archived customers.
- **Frontend:** shipment pages go live.
- **Tests needed:** status and date rules, views, delay and ETA calculation, permissions, browser flows. **Done when:** not stated in the plan; to be agreed before the phase starts.

### Phase 4 — Remaining modules · **Scope to be agreed**
- **Candidates in the plan:**
  - documents with private storage
  - customs
  - finance (invoices, credit notes, payments, allocations, the credit check at invoicing)
  - tasks and notifications
  - reports
  - user management
  - agents, suppliers and transporters through `/api/parties`
- **Business rules that apply** (`docs/database-design.md` §1): KES only; KRA eTIMS (issued invoices locked, credit notes for corrections); one invoice per shipment; cheque and bank transfer only (**M-Pesa removed from scope** 2026-10-26).
- **Before starting:** the repository owner agrees the scope and order; this may split into several phases. Private document storage and any KRA iCMS or eTIMS integration need separate decisions; integrations are not authorized.

### Phase 5 — Client data import and launch · **Not started**
- Review and map the source data; validate; dry runs on a non-production copy; reconcile with the client; handle existing reference numbers and counters.
- Then production security hardening (`helmet`, a shared rate limiter, logging, token revocation) and launch checks.
- Real client data enters only in this phase, on approved infrastructure. Deployment is not authorized; never run `npm run deploy`.

## Open items affecting the roadmap
- Explicit approval to start each phase. The repository owner's 2026-11-16 instruction is "Phase 2, then Phase 3 and Phase 4, one phase at a time".
- Phase 3 and Phase 4 completion criteria; Phase 4 scope.
- The repository owner's review of the 2026-11-04 Phase 1 decisions.
- Prisma 8 RC vs stable, and the unused `@prisma/client` 7; the `deploy` script; KRA iCMS access.
- Seeded tax defaults need an accountant's review.

## Superseded plans (kept for history)

**Former `CLAUDE.md` §6 recommendation list (written 2026-10-15; moved here unchanged on 2026-11-16).** It was superseded by the approved plan. Items 2 and 4 were done in backend Phase 0. M-Pesa was later removed from scope.

1. Write requirements + phase plan into the repo; define what "Phase 0" covers (commit `42ae8a8` is titled "Phase 0" but no definition exists).
2. Phase 0 hygiene: remove/protect `GET /`; declare `dotenv`; fix `supertest/types` type error; `.gitattributes` + Prettier; handle `deploy` script; CORS/env fallback.
3. Decide Prisma direction (stay on 8 RC vs stable; remove unused `@prisma/client` 7); document migration workflow on a disposable local DB.
4. Auth + roles, global validation and exception handling.
5. CI (lint, type-check, unit tests).
6. Core domain: customers → shipments/jobs → documents (private storage) → tracking.
7. Finance, then integrations (M-Pesa sandbox first; KRA iCMS once access is confirmed).

**Earlier proposal (2026-10-29 backend audit, LOG-20261029-2146-backend-audit):** foundation and customer CRUD, then quotations and bookings, then shipments and tracking. It became the approved plan's Phases 0–3.
