# Implementation roadmap — Freight Management

Written 2026-11-16 (LOG-20261116-1554-docs-restructure in `CLAUDE.md` §13), from Git history, the code on `main` at `d966e35`, and the documents below.

- **Authoritative source:** `docs/backend-implementation-plan.md` (approved by the repository owner on 2026-11-03). This file summarises it and adds status. If they disagree, the approved plan wins; record the difference in `CLAUDE.md` §13.
- **Business rules and schema:** `docs/database-design.md`.
- **API contracts:** `Frontend/frontend/docs/api-contracts.md`.
- **Detailed backend roadmap (proposal, 2026-11-20, awaiting review):** `docs/BACKEND_IMPLEMENTATION_ROADMAP.md`. It details every phase from 0 to 18. It splits Phase 3 into 3A and 3B and Phase 4 below into Phases 4–16. Phase 5 below becomes Phase 17 (client data import), and deployment becomes Phase 18. Until the repository owner approves it, the numbering in this file stays in effect.

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

### Phase 2 — Quotations and bookings · **Complete and verified (2026-11-26); owner decisions answered and implemented; pushed on `feature/quotations-phase2`; awaiting the PR (opened in the browser by a contributor), review and merge**
- **Owner decisions implemented (2026-11-26, LOG-20261126-1725-phase2-owner-decisions in `CLAUDE.md`):**
  - The repository owner answered every question in `CLAUDE.md` §17 and approved the credit rule, the credit-approval workflow, the permission matrix, one booking per quotation, no booking edits and last-save-wins.
  - Built: on-hold and closed customers blocked from new quotations and bookings; archiving refused while a customer has undelivered shipments, pending or confirmed bookings, or open quotations; admin-editable charge-type tax settings (new admin-only permission `settings.tax.manage`, no schema change); the browser checks committed as `Frontend/frontend/scripts/browser-checks.mjs` (26 checks, no new dependency).
  - Checks: 137 unit, 168 end-to-end, 26/26 browser; `tsc`, lint and builds pass.
  - **Still provisional:** the tax categories and rates have **not** been reviewed by the company's accountant. Admins can change them in Settings › Tax settings. This does not block Phase 2.
  - **Future, not Phase 2:** an admin-configurable KRA PIN format (needs a settings store and a schema change).
  - Closes when the PR is reviewed and merged by the repository owner. *Sequencing changed by the user on 2026-11-26 (19:16): Phase 3 is built first on its own branch, and Phase 2 is merged after Phase 3 is complete.*
- **Completion status (2026-11-20, LOG-20261120-1543-phase2-complete):**
  - Every item in the approved Phase 2 scope is built and tested, plus the audit's fixes and the credit-approval step.
  - Final checks: 112 unit, 158 end-to-end, 22/22 browser; builds pass.
  - Phase 2 is **not yet closed**: the PR has not been opened (no `gh` on this machine) or merged, and the owner decisions are listed in `CLAUDE.md` §17. Some of those answers may need further changes.
- **Status update (2026-11-20, LOG-20261120-1412-phase2-done in `CLAUDE.md`):**
  - Built after the operator's authorization. The as-built notes are in `docs/backend-implementation-plan.md` §6.
  - Checks recorded: 104 unit tests, 142 end-to-end tests (30 of them new), 14 headless-browser checks; `tsc`, lint and builds pass in both apps.
  - Committed as `ec5c760` on `feature/quotations-phase2` and pushed (LOG-20261120-1417-phase2-commit). Re-verified on the branch: the same results (LOG-20261120-1425-phase2-reconcile). Not merged into `main`; the PR awaits the repository owner.
  - Still open: the repository owner's review of the credit rule decided on 2026-11-20, and the permission matrix (only admin can both book and override). Fictional quotations are not yet in the demo seed. *(Update 2026-11-20, LOG-20261120-1501-phase2-batch1: remediation batch 1 is done but not committed. It fixed the issue-date bug, the open-quotation count, the cancelled-booking display, the badge on demo fallback pages and the customer link; added carrier details to the convert form and fictional quotations and bookings to the seed. Checks: 108 unit, 145 end-to-end, 18/18 browser. Still open: the owner decisions listed in `CLAUDE.md` §14; the PR.)* *(Update 2026-11-20, LOG-20261120-1514-credit-approval: a credit-approval step was added at the operator's instruction (Sales request approval, Finance or Management approve or reject); not committed. Checks: 112 unit, 152 end-to-end, 21/21 browser.)*
- The original plan text follows, unchanged.

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

### Phase 3 — Shipments and tracking · **Built and verified (2026-11-26) on `feature/shipments-phase3`, branched from the Phase 2 head `ab2962b`; not merged**
- **Sequencing (user, 2026-11-26 19:16):** Phase 3 is built before Phase 2 is merged; both are merged after Phase 3 is complete, only with the repository owner's approval. This replaces "after the Phase 2 merge".
- **Status (LOG-20261126-1952-phase3-shipments in `CLAUDE.md`):**
  - Backend `src/shipments/`: list with views and counts, detail, create (from a confirmed booking or standalone), edit, status changes, milestones, delays and issues with actions, containers, customs summary (read only), history from the audit log; the booking view lists its shipments and a booking with shipments cannot be cancelled. No schema change, no new permission (`shipments.view`, `shipments.manage` as seeded). 11 fictional demo shipments in `db:seed:demo`.
  - Frontend: `/shipments`, `/shipments/[reference]`, `/shipments/new`, `/shipments/[reference]/edit` are live; unknown references open the demo record.
  - Checks: 155 unit, 186 end-to-end, 36/36 browser (against the `*_test` database).
  - Demonstration preparation (2026-11-26 evening, LOG-20261126-2017-demo-prep): development database seeded with the 11 demo shipments (authorized); 49/49 browser checks against the development database, including the connected quotation → booking → shipment → delivery workflow; all other checks re-run and passing.
- **Completion criteria applied** (the plan states none; proposed by Claude Code, awaiting confirmation in `CLAUDE.md` §17 question 22): every item in the plan's Phase 3 scope has an endpoint and a live page; the status, date, milestone, delay and container rules are enforced by the API and covered by unit and end-to-end tests; permissions per role are tested; browser checks cover the main flows and 390 px width; API contracts and these documents are updated; no schema change.
- **Phase 3 audit (2026-11-26 late evening, LOG-20261126-2330-phase3-audit):** compared with the plan item by item. Two gaps fixed: delay notes were stored but not shown or editable on the live pages (and severity and description could not be corrected), and the customer page had no link to its live shipments (the list now filters by customer). Checks: 155 unit, 187 end-to-end, 50/50 browser (against the `*_test` database). **The applied completion criteria are met**; their confirmation is still §17 question 22.
- **Repository-owner decisions of 2026-11-27 (`CLAUDE.md` §17, LOG-20261127-0010-owner-decisions):** the applied completion criteria are **approved** (question 22.1). Built on this branch: confirmed bookings of on-hold or closed customers cannot become shipments (question 19); a booking becomes `completed` automatically when all its shipments are delivered (question 20.2). Confirmed unchanged: no cancelling a booking with shipments, delivered is final, planned ETA required, ETA from open delays (questions 20.1 and 21). Phase 2's decisions (questions 17 and 18) are on `feature/quotations-phase2`. Separate PRs: Phase 2 → `main`; Phase 3 → `feature/quotations-phase2`, retargeted to `main` after the Phase 2 merge (question 22.2). Checks: 155 unit, 193 end-to-end, 52/52 browser (test database). Question 16, answered later the same day: tax settings stay administrator-only (Finance does not receive `settings.tax.manage`; no permission change).
- **Remaining / not in Phase 3:** documents, customs entries, expenses and invoices for live shipments (Phase 4); dashboard, documents, customs and finance pages still on demo data; automatic booking completion (question 20); seeding the development database with the demo shipments (needs authorization).
- The original plan text follows, unchanged.
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
