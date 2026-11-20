# Backend implementation roadmap (detailed proposal) — Freight Management

Written 2026-11-20 (LOG-20261120-1246-backend-roadmap in `CLAUDE.md` §13). Planning and documentation only: no code, schema, database or dependency was changed to write it.

> **Status of this document: PROPOSAL, awaiting review** by the collaborator, the repository owner and an independent reviewer.
> - `docs/backend-implementation-plan.md` (approved 2026-11-03) **stays authoritative** until the repository owner approves this roadmap or parts of it. Where they differ, the approved plan wins, and the difference is listed in §2.3.
> - `docs/IMPLEMENTATION_ROADMAP.md` is the short status summary. This file is the detailed version.
> - Nothing in a "proposed" section exists in the code. Proposed tables, columns, endpoints and permissions are suggestions for review.

## How to read this document

Every statement belongs to one of five kinds, marked like this:

| Mark | Meaning |
|---|---|
| **[Verified]** | Checked in the repository on 2026-11-20 (code, schema, tests, Git), or recorded as verified in `CLAUDE.md` §11 with evidence |
| **[Requirement]** | A business requirement from the project brief or the repository owner (`CLAUDE.md` §2, §9; `docs/database-design.md` §1) |
| **[Proposed]** | A suggestion in this roadmap. Not built and not approved |
| **[Decision needed]** | Something the repository owner (or the business) must decide. Listed again in §6 |
| **[External]** | Depends on an outside organisation, account, credential or provider. Not confirmed. Listed again in §7 |

Words a beginner may not know:
- **Endpoint:** one URL plus an HTTP method that the backend answers, for example `GET /api/shipments`.
- **DTO** (data transfer object): a class describing the shape of a request body. NestJS checks every request against it before any code runs.
- **Service / controller / module:** in NestJS, a controller receives HTTP requests, a service holds the business rules, and a module groups them.
- **Migration:** a reviewed, versioned change to the database structure. In this project it is made with Prisma 8's `migration plan`, never by hand (`docs/database-design.md` §8).
- **Transaction:** several database writes that either all succeed or all fail together.
- **Permission code:** a text code such as `shipments.manage`, stored in the `Permission` table and linked to roles. The backend checks it on every request.
- **Audit log:** the append-only `AuditLog` table recording who changed what and when.

## Contents

1. What exists today (verified facts)
2. Phase numbering, conventions every phase follows, and differences from the approved plan
3. Phase list and workflow coverage
4. The phases in detail (Phase 0 to Phase 18)
5. Overall development sequence
6. Decisions needed from the repository owner
7. External dependencies

---

## 1. What exists today (verified 2026-11-20 on `main` at `cbad567`)

### 1.1 Backend **[Verified]**
- NestJS 12 (ESM, TypeScript 6), Express, port 3001. Routes under `/api` except `GET /health`.
- Global `ValidationPipe` (`class-validator`, `class-transformer`); one error format `{ statusCode, error, message, details[] }`; PostgreSQL errors mapped (`23505` → 409, `23503` → 422) in `src/common/all-exceptions.filter.ts`.
- Authentication: `src/auth/` (login, scrypt password hashing, 8-hour JWT, global guard, `@Public()`, `@RequirePermission()`). Permissions are read from the database on each request.
- Audit: `src/audit/audit.service.ts` writes `AuditLog` rows.
- Reference numbers: `src/references/` (configurable templates, atomic counters, admin API).
- Customers: `src/parties/` (`/api/parties`). The DTO already accepts all five party roles: `customer`, `agent`, `supplier`, `carrier`, `transporter` (`parties.dto.ts`). The live frontend pages show customers only.
- Seeds: `src/seed/` creates roles, permissions, charge types, the retention policy, reference formats, the first admin; the demo seed adds 12 fictional companies (customers, three agents, two supplier/carriers, a transporter) and 4 fictional staff accounts.
- Tests: unit tests next to the code (`*.spec.ts`), end-to-end tests in `test/` (`app`, `auth`, `parties`, `references`, `seed`) against a separate `*_test` database.
- **Not present:** any endpoint for quotations, bookings, shipments, documents, customs, finance, tasks, notifications, reports, users or portals; file storage; scheduled jobs; email/SMS; logging configuration; `helmet`; a shared rate limiter; CI; deployment configuration.

### 1.2 Database **[Verified]**
`Backend/backend/src/prisma/contract.prisma` (Prisma 8 "contract" architecture, **not classic Prisma**): 34 tables including `User`. Migrations: `20261026T1925_baseline`, `20261026T1926_freight_core_schema`, `20261103T1857_add_reference_format`.

| Area | Tables that exist |
|---|---|
| Access and audit | `User`, `Role`, `UserRole`, `Permission`, `RolePermission`, `AuditLog`, `RetentionPolicy` |
| Parties | `Party`, `PartyRole`, `Contact` |
| Shared | `ChargeType`, `NumberSequence`, `ReferenceFormat` |
| Sales | `Quotation`, `QuotationLine`, `Booking` |
| Operations | `Shipment`, `Container`, `ShipmentMilestone`, `ShipmentIssue`, `TransportJob`, `Task`, `Note` |
| Documents | `Document` (metadata and a private `storageKey`; no file storage built) |
| Customs | `CustomsEntry`, `CustomsCharge` |
| Finance | `Invoice`, `InvoiceLine`, `CreditNote`, `CreditNoteLine`, `Payment`, `PaymentAllocation`, `Expense`, `CreditCheck` |

**Gaps found in the schema while writing this roadmap** (each is discussed in its phase; none has been changed):
- No **FCL/LCL** (load type) field on `Shipment` or `Booking`; only a free-text `equipment` column. **[Decision needed]**
- No `cancelled` value in `ShipmentStatus`, so a shipment job cannot be cancelled. **[Decision needed]**
- No shipper or consignee fields on `Shipment` (only `customerId`). **[Decision needed]**
- One `agentId` per shipment: an origin agent and a destination agent cannot both be recorded. **[Decision needed]**
- No `AgentRoute`, `CostEstimate`, notification, portal-invitation, company-settings or integration-log tables (`docs/database-design.md` §5 lists several as deliberately deferred).
- `Invoice` has no field marking a **supplementary** invoice, although the rule "one invoice per shipment, supplementary invoices allowed" needs one. **[Decision needed]**
- `CustomsEntry` has no item lines (HS code, customs value). **[Decision needed]**
- `Document` has no virus-scan status and no agent-visibility flag.
- `PaymentMethod` allows only `cheque` and `bank_transfer` (M-Pesa removed from scope on 2026-10-26).

### 1.3 Roles and permissions seeded **[Verified]** (`src/seed/setup-data.ts`)
- Roles: `admin`, `finance`, `operations`, `sales`, `management`, `customer`. There is **no** `documentation` role (the frontend prototype shows one) and **no** `agent` role.
- Permissions: `users.manage`, `settings.references.manage`, `credit.override`, `parties.view`, `parties.manage`, `parties.billing.view`, `parties.billing.manage`, `parties.status.manage`, `quotations.view`, `quotations.manage`, `shipments.view`, `shipments.manage`, `customs.view`, `customs.manage`, `invoices.view`, `invoices.manage`, `payments.view`, `payments.manage`, `charges.view`, `transactions.approve`, `reports.view`, `portal.own.view`.
- Admin holds every permission except `portal.own.view`. Operations: `shipments.manage`, `customs.manage`, view rights. Sales: `parties.manage`, `quotations.manage`. Finance: billing, invoices, payments, `credit.override`. Management: views, `parties.status.manage`, `transactions.approve`, `credit.override`, `reports.view`. Customer: `portal.own.view`.

### 1.4 Frontend **[Verified]**
- Next.js 16 App Router in `Frontend/frontend`. **Live** (backend) pages: `/login`, `/parties` (customers list, detail, new, edit), Settings › Numbering. Everything else reads fictional demo data via `lib/data/index.ts` and keeps edits in the tab's session store (`lib/data/session-store.tsx`).
- Pages that will use the APIs below: `/` (dashboard), `/shipments` (+ `new`, `[reference]`, `edit`, delays `new`/`edit`), `/quotations` (+ `new`, `[reference]`, `edit`), `/documents` (+ `upload`), `/customs`, `/agents` (+ `[id]`), `/expenses` (+ `new`), `/finance`, `/reports`, `/users`, `/settings`, `/notifications` (+ task pages).
- Validation rules the server must repeat: `lib/shipment-form.ts`, `lib/delay-form.ts`, `lib/shipment-changes.ts`, `lib/quotation-form.ts`, `lib/quotation-changes.ts`, `lib/quotations.ts`, `lib/money.ts`, `lib/document-upload.ts`, `lib/document-changes.ts`, `lib/expense-form.ts`, `lib/task-form.ts`, `lib/task-changes.ts`, `lib/notifications.ts`, `lib/profitability.ts`, `lib/reports.ts`, `lib/metrics.ts`, `lib/access.ts`.
- Proposed contracts: `Frontend/frontend/docs/api-contracts.md`. Several were written before the approved conventions and differ from them (§2.3).
- Known type differences to reconcile (`docs/database-design.md` §7): `USD` currency, `mpesa`, stored `booked` quotation status, integer-cent prices, a single customs entry per shipment, the `documentation` role, derived invoice statuses.
- No customer or agent portal UI, no booking pages, no invoice-creation pages and no transport-job pages exist.

---

## 2. Numbering, conventions and differences

### 2.1 Phase numbering **[Proposed]**
- **Phases 0 and 1 keep their numbers and meaning** (both done). **Phases 2 and 3 keep the approved meaning** (quotations and bookings; shipments and tracking). Phase 3 is split into **3A** and **3B**, delivered as two PRs.
- The approved plan's **Phase 4 ("remaining modules, scope to be agreed")** is split here into Phases 4 to 16.
- The approved plan's **Phase 5 (client data import)** becomes **Phase 17**, and deployment becomes **Phase 18**. This renumbering needs the repository owner's approval. Until then, "Phase 5" in older documents means client data import.

| Approved plan (2026-11-03) | This roadmap |
|---|---|
| Phase 0 Foundation | Phase 0 (unchanged, done) |
| Phase 1 Customers | Phase 1 (unchanged, done) |
| Phase 2 Quotations and bookings | Phase 2 (unchanged scope) |
| Phase 3 Shipments and tracking | Phase 3A Shipment jobs and containers; Phase 3B Milestones, delays and delivery |
| Phase 4 Remaining modules | Phases 4–16 |
| Phase 5 Client data import and launch | Phase 17 Client data import; Phase 18 Deployment and launch |

### 2.2 Rules every phase follows **[Verified as the approved practice, `docs/backend-implementation-plan.md` §2 and §6]**
- Explicit approval before the phase starts (repository owner's instruction relayed 2026-11-16: one phase at a time).
- Its own feature branch and PR into `main`; no commit or push without approval in the session.
- Every request validated by a DTO; business rules in services; multi-row writes in one transaction.
- Every endpoint protected by default; a `@RequirePermission()` code on each; permissions are data rows (new codes are added through the seed script, which is safe to re-run).
- `AuditLog` row for every create, update, status change, approval, review, download of a sensitive file, and permission change.
- Money as exact decimal strings (`"1250.00"`), summed in SQL; instants ISO 8601 with offset; calendar dates `YYYY-MM-DD` on the Africa/Nairobi calendar; lists use `limit`/`offset` and return `{ items, total }`.
- Error format `{ statusCode, error, message, details[] }` (400 validation, 401, 403, 404, 409 conflict, 422 missing linked record).
- References from the configured formats, generated inside the creating transaction.
- Archived customers cannot receive new work (quotations, bookings, shipments, invoices).
- Schema changes: edit `contract.prisma` → `prisma contract emit` → `prisma migration plan` → review with `migration show` and `migration check` → apply only with authorization. Never hand-edit generated files. Additive changes are preferred; no reset of any existing database.
- Tests: unit tests for rules, end-to-end tests for every endpoint (including 401/403 per role), browser checks for each page switched to live data. A phase is complete only when the checks have been **run and recorded** in `CLAUDE.md` §13, not when code is written.
- `Frontend/frontend/docs/api-contracts.md`, `docs/IMPLEMENTATION_ROADMAP.md`, this file and `CLAUDE.md` are updated at the end of the phase.
- Fictional data only until Phase 17.

### 2.3 Differences to resolve between documents **[Decision needed]**
| Topic | `api-contracts.md` (frontend proposal) | Approved plan / database | Proposal here |
|---|---|---|---|
| URL prefix | `/shipments`, `/quotations` | `/api/...` | `/api/...` (approved) |
| Validation errors | 422 with `{ errors: { field: message } }` | 400 with `details[]` | 400 with `details[]` (approved; already built) |
| Record identifiers in URLs | References (`/shipments/FMS-SEA-2610-0041`) | Customers use numeric ids | References for records that have one (shipments, quotations, bookings, invoices, payments, customs entries), numeric ids for the rest. Reference formats already forbid `/` and spaces for this reason. **Needs approval** |
| Editing a sent quotation | Never; duplicate instead | Editable while `draft` or `sent` | Follow the approved rule; confirm with the owner |
| Quotation → shipment | `POST /quotations/:ref/booking` creates or links a shipment | Quotation → booking → shipments | Approved flow (booking in between) |
| Money in requests | Integer minor units (cents) | Decimal strings | Decimal strings; the frontend converts |
| Stale updates | 409 with `updatedAt`/ETag | Customers: last save wins (2026-11-04) | Decide per record type; proposal: optimistic check (`updatedAt`) for shipments, quotations and invoices drafts |
| Currency | KES or USD | KES only | KES only (approved) |

---

## 3. Phase list and coverage

### 3.1 All phases

| # | Phase | Delivers (one line) | Status |
|---|---|---|---|
| 0 | Backend foundation | Validation, error format, sign-in, permission guard, audit, reference formats, seeds | **Verified**, on `main` |
| 1 | Customers | Live customer records, contacts, billing terms, archive | **Verified**, on `main` |
| 2 | Quotations and bookings | Priced quotations, status flow, conversion to a booking, credit check at booking | Not started; next |
| 3A | Shipment jobs and containers | Shipment jobs from a booking or standalone (clearing-only), all modes, FCL/LCL, containers, assignment, status rules, list views | Not started |
| 3B | Milestones, tracking, delays and delivery | Milestones, actual dates, delays with reasons and revised dates, current ETA, delivery date, history | Not started |
| 4 | Agents, carriers, suppliers and transporters | Live partner records, agent routes and assignments, partner archive rules | Not started |
| 5 | Documents and secure file storage | Private upload/download, review, required documents, paper originals, legal hold | Not started |
| 6 | Customs clearance, release and duties | Customs entries, lodging, assessment, duties and charges, release, manual iCMS workflow | Not started |
| 7 | Transport and delivery legs | Hired trucks (transport jobs), dispatch, proof of delivery | Not started |
| 8 | User management, roles, audit log and company settings | Staff accounts, role and permission editing, password changes, token revocation, audit-log viewer, company details | Not started |
| 9 | Expenses, cost estimates and job costing | Supplier costs per job, approval, paid status, estimates, profitability | Not started |
| 10 | Invoicing and credit notes | Draft and issue invoices, VAT, disbursements, credit notes, credit check at invoicing, manual eTIMS fields | Not started |
| 11 | Payments, allocation and reconciliation | Cheque and bank-transfer receipts, allocation to invoices, bounced cheques, reconciliation, statements | Not started |
| 12 | Tasks, notifications and reminders | Stored tasks and notes, server-generated notifications, read state, scheduled reminders | Not started |
| 13 | Reports, dashboards and analytics | Server-side dashboard figures and reports, CSV export | Not started |
| 14 | Customer and agent portals | Restricted logins for customers and agents, own records only | Not started |
| 15 | Security hardening, backups and operational readiness | `helmet`, rate limiting, logging, CI, backups and restore tests, retention, dependency review | Not started |
| 16 | External integrations | KRA eTIMS, KRA iCMS, email, SMS, bank data; M-Pesa only if reinstated | Not started; **not authorized**; each needs external access |
| 17 | Client data import | Mapping, validation, dry runs, reconciliation of the client's real data | Not started |
| 18 | Deployment and production launch | Hosting, environments, production database, go-live checklist | Not started; **not authorized** |

### 3.2 The business workflow, step by step **[Requirement]** → phase

| Step | Phase | Main tables |
|---|---|---|
| Quotation | 2 | `Quotation`, `QuotationLine`, `ChargeType` |
| Booking | 2 | `Booking`, `CreditCheck` |
| Shipment / job creation | 3A | `Shipment`, `Container` |
| Tracking, delays, delivery dates | 3B | `ShipmentMilestone`, `ShipmentIssue`, `Note` |
| Documents | 5 | `Document` |
| Customs clearance | 6 | `CustomsEntry`, `CustomsCharge` |
| Release | 6 (customs release), 3B (shipment status) | `CustomsEntry.releasedAt`, `Shipment.status` |
| Transport | 7 | `TransportJob` |
| Delivery | 3B (shipment delivered date), 7 (per truck), 5 (proof of delivery) | `Shipment.deliveredAt`, `TransportJob.actualDeliveryAt` |
| Invoicing | 10 | `Invoice`, `InvoiceLine`, `CreditNote` |
| Expenses | 9 | `Expense`, proposed `CostEstimate` |
| Payment | 11 | `Payment`, `PaymentAllocation` |
| Reconciliation | 11 | `Payment.reconciledAt`, proposed bank-statement tables |

### 3.3 Special requirements **[Requirement]** → phase
| Requirement | Where |
|---|---|
| Sea, air, road and rail | `TransportMode` exists; 2, 3A (mode-specific milestones and fields) |
| FCL and LCL | 3A (**schema gap**, proposed `loadType`) |
| Multiple customers and freight agents | 1 (done), 4 |
| Multiple shipments and documents per customer | 3A, 5 |
| Actual delivery dates, delays and reasons | 3B |
| Agent assignments and routes | 4 (proposed `AgentRoute`), 3A (agent on a shipment) |
| Customer billing details and service history | 1 (done: billing); 3B/8 (history from `AuditLog`); figures fill in with 10–11 |
| Secure document uploads and downloads | 5 |
| Customs declarations and duty information | 6 |
| Invoices, expenses, profitability, payments | 9, 10, 11 |
| M-Pesa and bank payments | 11 (bank and cheque); **M-Pesa removed from scope by the repository owner on 2026-10-26**, see Phase 11 and 16 |
| Customer and agent portals | 14 |
| Notifications, reminders, tasks | 12 |
| Reporting and analytics | 13 |

---

## 4. The phases in detail

Each phase has the same nine parts: **A** overview · **B** features · **C** database · **D** backend · **E** frontend · **F** security and reliability · **G** testing · **H** dependencies · **I** completion criteria.

Phases 0 and 1 are done, so their sections record what was built (verified) and what they leave for later.

---

### Phase 0 — Backend foundation · **[Verified]**, on `main` (PR #3)

**A. Overview.** A secure base for every later endpoint: every request validated, every route protected unless public, one error format, an audit trail and configurable reference numbers. The business needs it because customer, shipment and financial data must never be exposed to someone who has not signed in or lacks permission.

**B. Built.** Login and `GET /api/auth/me`; scrypt password hashing (minimum 12 characters); 8-hour JWT kept in an HttpOnly cookie by the Next.js app; global guard; `@RequirePermission()`; audit service; pagination DTO; reference formats with preview and an admin editor; seed scripts; removal of the unauthenticated `GET /`; `CORS_ORIGINS` and `JWT_SECRET` validation.

**C. Database.** One additive table, `ReferenceFormat` (migration `20261103T1857_add_reference_format`). Reuses `User`, `Role`, `UserRole`, `Permission`, `RolePermission`, `AuditLog`, `NumberSequence`.

**D. Backend.** Modules: `AuthModule`, `AuditModule`, `ReferencesModule`, `PrismaModule`. Endpoints: `POST /api/auth/login` (public), `GET /api/auth/me`, `GET /api/reference-formats`, `PATCH /api/reference-formats/:documentType`, `POST /api/reference-formats/preview`, `GET /health` (public).

**E. Frontend.** Login page, user menu, signed-out handling, same-origin `/api/backend/<path>` forwarding route, Numbering editor in Settings.

**F. Security (known limits carried forward).** Sign-out does not revoke the token (valid up to 8 hours unless the user is disabled) → Phase 8. The login limit is in memory, per process → Phase 15. Demo pages are open without signing in, so only fictional data may be used until each page goes live.

**G. Recorded checks (2026-11-03).** 37 unit tests, 34 end-to-end tests, 27 browser checks. Not re-run since 2026-11-04.

**H. Dependencies.** None before it. Every later phase depends on it.

**I. Completion.** All criteria in the approved plan were met and recorded (LOG-20261103-2218-phase0, archived).

---

### Phase 1 — Customers · **[Verified]**, on `main` (PR #4)

**A. Overview.** Customer records are the root of every quotation, shipment and invoice. Phase 1 made them live: list, search, details, contacts, billing terms and credit limits, archive and restore.

**B. Built.** `/api/parties` with search, status filter, paging; detail with contacts and calculated figures (zero until shipments and invoices exist); create, edit, archive, restore; contacts add, edit, remove; billing fields visible only with `parties.billing.view`; account status only with `parties.status.manage`.

**C. Database.** No change. Uses `Party`, `PartyRole`, `Contact`.

**D. Backend.** `PartiesModule` (`parties.controller.ts`, `parties.service.ts`, `party-rules.ts`), `ParseIdPipe`. Endpoints listed in `Frontend/frontend/docs/api-contracts.md`.

**E. Frontend.** Live `/parties`, `/parties/[id]`, `/parties/new`, `/parties/[id]/edit`.

**F. Security.** Field-level permission checks (403 and nothing saved if any field sent is not allowed); every change audited; archive refused while the customer has an undelivered shipment.

**G. Recorded checks (2026-11-04).** 70 unit tests, 112 end-to-end tests, 91 browser checks.

**H. Left for later phases.** New work for archived customers is not yet refused (Phases 2, 3A, 10 must check `archivedAt`). Agents, carriers and transporters stay on demo pages (Phase 4). Four decisions dated 2026-11-04 await the repository owner's review (`CLAUDE.md` §9). Customer service history needs the audit-log reader (Phase 3B/8).

**I. Completion.** Met and recorded (LOG-20261104-1056-phase1, archived).

---

### Phase 2 — Quotations and bookings · **Not started** (next; needs approval)

**A. Overview.**
- **What:** staff prepare priced quotations for a customer, send them (outside the system for now), record the customer's decision, and convert an accepted quotation into a booking. Bookings can also be created without a quotation.
- **Why the business needs it:** quotations are where revenue starts. Today they live only in the browser tab and disappear on reload. A booking is the confirmed commitment that operations will act on.
- **Problem solved:** one controlled, numbered, auditable record of what was offered, at what price, and what was agreed, with a credit-limit check before the company commits to work for a customer who already owes too much.
- **Finished phase achieves:** the quotation pages read and write the database; accepted quotations become bookings; every credit decision is recorded.

**B. Features.**
1. **Charge-type catalogue (read).** The list of standard charges (clearing fee, freight, transport, port charges, import duty, …) with their default tax category and rate, used to fill quotation lines quickly. Seeded already **[Verified]**; tax defaults need an accountant's review **[Decision needed]**.
2. **Create and edit quotations.** Customer, optional agent, mode (sea/air/road/rail), direction (import/export/transit), origin, destination, incoterm, cargo summary, packages, weight, volume, terms, internal note, issue date, valid-until date, and priced lines (description, quantity, unit price, tax category and rate). Lines are saved together with the header in one transaction.
3. **Server-calculated totals.** Net per line, tax per line, subtotal, tax total and total, calculated by the backend with exact decimals. The client's totals are ignored.
4. **Status flow.** `draft → sent → accepted | declined`, and `expired` once `validUntil` has passed while still `draft` or `sent`. Recording "sent" stores who it was sent to and when. Accepted quotations are locked.
5. **Duplicate.** Copy any quotation into a new draft (`duplicatedFromId`), for revisions and repeat customers.
6. **Convert to booking.** An accepted quotation becomes a booking automatically, copying route and cargo as a snapshot. A second conversion returns 409. "Booked" is derived from the booking's existence, not stored on the quotation.
7. **Standalone bookings.** For work agreed without a quotation.
8. **Booking actions.** Edit while `pending`; confirm (`confirmedAt`); cancel with a reason (`cancelledAt`, `cancellationReason`); `completed` once its shipments are delivered (Phase 3B can set it).
9. **Credit-limit check at booking.** If the customer has a limit and their exposure plus the booking value exceeds it, the backend returns a warning. Only users with `credit.override` (finance, management, admin) may proceed; everyone else can only stop. Every decision is a `CreditCheck` row with user, time, figures and reason.
10. **Archived and on-hold customers.** New quotations and bookings are refused for archived customers. Whether `on_hold` or `closed` also blocks them is **[Decision needed]** (proposal: `closed` blocks; `on_hold` triggers the same warning as the credit check).

**C. Database.**
- Existing tables used **[Verified]**: `Quotation`, `QuotationLine`, `Booking`, `ChargeType`, `CreditCheck`, `NumberSequence`, `ReferenceFormat`, `Party`, `AuditLog`.
- Important existing rules: `Quotation.reference` and `Booking.reference` unique; `Booking.quotationId` unique (one booking per quotation); `validUntil >= issueDate`; line quantity > 0, unit price ≥ 0, tax rate 0–100; a cancelled booking must have `cancelledAt`; `CreditCheck` needs a non-blank reason and at most one subject (booking or invoice).
- **No schema change is expected.** Possible additions, only if the owner wants them **[Decision needed]**:
  - `Booking.loadType` (FCL/LCL), if the load type should be known at booking (see Phase 3A).
  - Storing `expired` as a status change by a scheduled job versus deriving it on read. Proposal: derive on read in Phase 2 (no scheduler exists yet), store it later when Phase 12 adds scheduled jobs.
- **Credit exposure definition [Decision needed].** Until invoices exist (Phase 10), a customer's outstanding balance is zero, so the check at booking cannot trigger from invoices. Proposal: exposure = outstanding issued invoices (from Phase 10) + total value of open (pending or confirmed, not yet invoiced) bookings; attempted amount = the quotation's total (or a value entered for a standalone booking).

**D. Backend.**
- Modules: `ChargeTypesModule` (small, read only), `QuotationsModule`, `BookingsModule`, `CreditModule` (shared credit-check service, reused at invoicing in Phase 10).
- Endpoints **[Proposed]**:

| Method | Path | Permission | What it does |
|---|---|---|---|
| GET | `/api/charge-types` | signed in | Active charge types |
| GET | `/api/quotations?status=&customerId=&agentId=&q=&limit=&offset=` | `quotations.view` | List with derived status (`expired`, booked) and totals |
| GET | `/api/quotations/:reference` | `quotations.view` | Header, lines, totals, booking link, history |
| POST | `/api/quotations` | `quotations.manage` | Create draft with lines; assigns `QT-…` |
| PATCH | `/api/quotations/:reference` | `quotations.manage` | Edit header and replace lines; only `draft`/`sent`; 409 otherwise |
| POST | `/api/quotations/:reference/status` | `quotations.manage` | `{ status, sentAt?, sentTo?, decidedAt?, note? }`; checks the allowed transition |
| POST | `/api/quotations/:reference/duplicate` | `quotations.manage` | New draft copy |
| POST | `/api/quotations/:reference/convert` | `quotations.manage` (+ credit rules) | Creates the booking; 409 if one exists or not accepted |
| GET | `/api/bookings?status=&customerId=&q=` | `quotations.view` | List |
| GET | `/api/bookings/:reference` | `quotations.view` | Detail with quotation link and (from 3A) shipments |
| POST | `/api/bookings` | `quotations.manage` | Standalone booking; assigns `BKG-…` |
| PATCH | `/api/bookings/:reference` | `quotations.manage` | Edit while `pending` |
| POST | `/api/bookings/:reference/confirm` | **[Decision needed]** | Confirm |
| POST | `/api/bookings/:reference/cancel` | `quotations.manage` | `{ reason }`; refused if shipments exist that are not cancelled |

- **Credit check flow [Proposed].** `convert` and `POST /api/bookings` run the check. If over the limit and no decision was sent, return 409 with `error: "CREDIT_LIMIT_WARNING"` and `details` holding exposure, limit and attempted amount. The client then repeats the request with `creditDecision: { decision: "proceed" | "blocked", reason }`. `proceed` needs `credit.override` (403 otherwise). Both outcomes write a `CreditCheck` row, inside the same transaction as the booking when it proceeds.
- **Validation:** DTOs mirroring `lib/quotation-form.ts` (customer exists, holds the `customer` role and is not archived; agent holds the `agent` role; at least one line; quantities up to 3 decimals; prices up to 2 decimals; tax rate 0–100; dates valid and `validUntil ≥ issueDate`; status dates not in the future and not before issue; decision not before sending).
- **Rounding [Decision needed]:** the frontend rounds each line to the cent, half away from zero (`lib/money.ts` `lineAmounts`). Proposal: the same rule in SQL `numeric` arithmetic, confirmed by the accountant.
- **Booking confirmation permission [Decision needed]:** operations hold only `quotations.view`. Proposal: a new permission `bookings.manage` for operations, sales and admin, so operations can confirm bookings without editing prices.
- Background jobs: none.

**E. Frontend.**
- Pages switched to live data: `/quotations`, `/quotations/new`, `/quotations/[reference]`, `/quotations/[reference]/edit`; the quotation print layout keeps working from live data.
- Data layer: `getQuotations()`, `getQuotationFormOptions()` in `lib/data/index.ts`; session-store quotation mutations replaced by calls through `lib/api/browser.ts`.
- Conversions needed: `unitPriceMinor` (cents) ↔ decimal strings; `currency` removed or fixed to KES; `booked` derived from the booking.
- New, minimal pages: booking list and booking detail (approved 2026-11-03).
- Contracts to agree before coding: the quotation response shape (lines, totals, derived status), the credit-warning response, and identifier choice (reference in URL).

**F. Security and reliability.**
- Prices and margins are commercially sensitive: `quotations.view` only. Customers will see only their own quotations in Phase 14.
- Totals recalculated on every save; lines replaced in one transaction so a partial save cannot happen.
- References generated in the creating transaction (no lost or duplicate numbers).
- Conversion uses the unique `quotationId` constraint as the final guard against double conversion under concurrency.
- Every create, edit, status change, conversion and credit decision audited with before/after values.

**G. Testing.**
- Unit: totals and rounding (including half-cent cases), allowed and refused status transitions, expiry derivation on the Nairobi calendar, credit exposure calculation.
- End-to-end: 401 and 403 per role for every endpoint; create/edit/duplicate; editing an accepted quotation → 409; conversion and repeated conversion → 409; two concurrent conversions → exactly one booking; credit warning, proceed with and without `credit.override`, `CreditCheck` rows written; archived customer refused; unique references under concurrency.
- Browser: create, edit, send, accept, convert, open booking, cancel booking; print view; 390 px width.
- Seed: the demo seed gains fictional quotations and bookings with counters continuing after them.

**H. Dependencies.**
- Needs: Phases 0 and 1. Fictional agents exist via the demo seed, so Phase 4 is not required first.
- Needed by: 3A (shipments from bookings), 10 (credit check reused), 13 (sales reports).
- External: none. Owner decisions: on-hold behaviour, exposure definition, booking permission, editing sent quotations, rounding.

**I. Completion criteria.**
- [ ] All endpoints above exist, are documented in `api-contracts.md` and covered by end-to-end tests that pass.
- [ ] Quotation pages read and write live data; booking list and detail pages exist; demo banner gone on these pages.
- [ ] Credit warning and override work and are recorded; only `credit.override` holders can proceed.
- [ ] Archived customers are refused.
- [ ] Unit, end-to-end and browser checks run and recorded in `CLAUDE.md` §13; `tsc`, lint and builds pass in both apps.
- [ ] Migration check still passes (no schema change expected).

---

### Phase 3A — Shipment jobs and containers · **Not started**

**A. Overview.**
- **What:** the shipment (job) record that operations work on every day: who the customer is, which mode, which carrier and agent, which containers, who in the office is responsible, and its status from booked to delivered.
- **Why:** it is the centre of the business. Documents, customs, transport, expenses and invoices all hang off a shipment.
- **Problem solved:** jobs created from bookings or as clearing-only jobs get a unique `FMS-…` reference, consistent statuses and a single owner, instead of living in the browser tab.
- **Finished phase achieves:** the shipment list, detail, create and edit pages run on live data, with containers and server-side list views.

**B. Features.**
1. **Create from a booking.** A confirmed booking produces one or more shipments (a booking can be split, for example several containers sailing on different vessels). Route, mode, cargo and parties are copied; the user can adjust.
2. **Create standalone (clearing-only).** Customers who only need clearing: no quotation or booking.
3. **All four modes.** Mode-specific fields: sea (vessel, voyage, B/L number, containers), air (flight, AWB number), road (truck/CMR consignment note), rail (wagon/consignment number). All use `transportDocRef`, `vesselOrFlight`, `voyageNumber`.
4. **FCL and LCL [Decision needed — schema gap].** Record whether the cargo is a full container load, a less-than-container (groupage) load, or not containerised (air, loose road cargo). Proposal below.
5. **Containers.** Add, edit, remove container and seal numbers, type (20', 40', high cube, reefer, open top, flat rack), weight and packages. Container numbers are checked (4 letters + 7 digits, already a database rule). Removal is refused once a transport job uses the container (Phase 7).
6. **Assignment.** One responsible staff member (`assignedToId`), chosen from active staff accounts.
7. **Carrier and agent.** The shipping line/airline (a party with the `carrier` role) and the partner agent (a party with the `agent` role).
8. **Status and its rules.** `booked → in_transit → arrived → customs → released → out_for_delivery → delivered`, plus `on_hold` from any open status. Rules such as "delivered needs a delivery time", "arrival not before departure" (already database checks) and which jumps are allowed (service rules, from `lib/shipment-changes.ts`).
9. **List views.** Server-side filters matching the frontend views: `active`, `attention` (open issues, missing documents later), `arriving` (ETA within 7 days), `customs`, `delayed`; filters by mode, status, customer, agent, assignee, text search.
10. **Cancellation [Decision needed — schema gap].** `ShipmentStatus` has no `cancelled`. Proposal below.
11. **Archived customer refusal** for new shipments.

**C. Database.**
- Existing **[Verified]**: `Shipment` (all fields above, planned and actual dates, `bookingId` optional, `assignedToId`, `carrierId`, `agentId`), `Container` (unique per shipment and container number, format check), `Booking`, `Party`, `User`.
- **Proposed additive changes (each needs approval and a reviewed migration):**

| Change | Purpose |
|---|---|
| `Shipment.loadType` enum: `fcl`, `lcl`, `ftl` (full truck), `ltl` (part truck), `loose`, `breakbulk`, `not_applicable` (values to be confirmed) | FCL/LCL requirement; `equipment` stays as free text |
| `ShipmentStatus` value `cancelled` + `cancelledAt`, `cancellationReason` + a CHECK like the booking one | Cancelling a job without deleting it |
| Optional `shipperName`, `consigneeName` (text) or links to parties | Names printed on B/L and customs documents; **[Decision needed]** whether needed now |
| Optional second agent (`originAgentId`, `destinationAgentId`) or a `ShipmentAgent` link table | Jobs with agents at both ends; **[Decision needed]** |
| LCL consolidation: one container shared by several shipments | Today `Container` belongs to exactly one shipment. If the company consolidates LCL cargo itself, a `Consolidation` (master) table is needed. **[Decision needed]**; proposal: not in Phase 3A, record each LCL shipment's own cargo only |

- Default milestones per mode are created with the shipment (Phase 3B uses them). Proposal: a fixed list in code per mode, matching the frontend demo, moved to a data table later if the business wants to edit them **[Decision needed]**.

**D. Backend.**
- Modules: `ShipmentsModule` (controller, service, `shipment-rules.ts`), a small `StaffModule` or users-read service for the assignee list (full user management is Phase 8).
- Endpoints **[Proposed]**:

| Method | Path | Permission | What it does |
|---|---|---|---|
| GET | `/api/shipments?view=&mode=&status=&customerId=&agentId=&assignedToId=&q=&limit=&offset=` | `shipments.view` | List with current ETA and counts |
| GET | `/api/shipments/:reference` | `shipments.view` | Detail: parties, containers, milestones, open issues, customs summary (from Phase 6) |
| POST | `/api/shipments` | `shipments.manage` | Standalone (clearing-only) job; assigns `FMS-{MODE}-…`; creates default milestones |
| POST | `/api/bookings/:reference/shipments` | `shipments.manage` | Shipment from a confirmed booking |
| PATCH | `/api/shipments/:reference` | `shipments.manage` | Edit fields; `updatedAt` sent for a stale-update check (409) |
| POST | `/api/shipments/:reference/status` | `shipments.manage` | `{ status, at?, note? }`; checks transitions and required dates |
| POST | `/api/shipments/:reference/cancel` | `shipments.manage` | `{ reason }` (if `cancelled` is approved) |
| GET/POST | `/api/shipments/:reference/containers` | view / manage | List / add |
| PATCH/DELETE | `/api/shipments/:reference/containers/:id` | `shipments.manage` | Edit / remove (refused when used) |
| GET | `/api/users/assignable` | `shipments.manage` | `{ id, name }` of active staff |

- Business logic: customer must hold the `customer` role and not be archived; carrier and agent must hold their roles; booking must be `confirmed`; mode cannot change after milestones are recorded (proposal); `customs` status cannot be set before arrival for imports (proposal, to confirm); `delivered` requires `deliveredAt`; the booking becomes `completed` when all its non-cancelled shipments are delivered (proposal).
- Background jobs: none.

**E. Frontend.**
- Pages: `/shipments` (list and view tabs), `/shipments/new`, `/shipments/[reference]`, `/shipments/[reference]/edit`; the dashboard `/` counts (fully in Phase 13); the customer detail page shows real shipment counts.
- Data layer: `getShipments()`, `getShipment()`, `getShipmentFormOptions()`, `getStaff()`; session-store shipment mutations replaced.
- Type changes: `Shipment.customs` (single) becomes a summary of possibly several entries; `assignedTo` becomes `{ id, name }`; `agentName` becomes `agentId`; new `loadType`; containers listed separately from `equipment`.
- Contracts to agree: shipment detail shape, list view definitions (`matchesView` in `lib/metrics.ts`), status transition table.

**F. Security and reliability.**
- Shipments show customer names and cargo values: `shipments.view` only; portal scoping in Phase 14.
- Concurrency: reference generation in the creating transaction; stale-update check on edit.
- No hard delete; cancellation (if approved) keeps the record.
- Audit every create, edit, status change, container change.

**G. Testing.**
- Unit: status transitions, required dates per status, view definitions, container number rule.
- End-to-end: permissions per role; create standalone and from booking; booking not confirmed → 409; archived customer → refused; wrong party role → 400/422; container duplicate in one shipment → 409; stale update → 409; references unique under concurrency; customer archive now correctly blocked by an undelivered live shipment.
- Browser: create (each mode), edit, change status, add container, list views, 390 px.

**H. Dependencies.**
- Needs: Phase 2 (bookings). Standalone jobs need only Phase 1.
- Needed by: 3B, 5, 6, 7, 9, 10, 12, 13, 14.
- Owner decisions: load type values, cancellation, shipper/consignee, two agents, LCL consolidation, milestone templates, stale-update policy.

**I. Completion criteria.**
- [ ] Approved schema changes (if any) applied through a reviewed migration; `migration check` and `db verify` pass on the developer's database and the test database.
- [ ] All endpoints implemented, documented and covered by passing end-to-end tests.
- [ ] Shipment list, detail, create and edit pages on live data for all four modes, with containers.
- [ ] Archived-customer refusal and status rules enforced on the server.
- [ ] Checks run and recorded in `CLAUDE.md` §13.

---

### Phase 3B — Milestones, tracking, delays and delivery dates · **Not started**

**A. Overview.**
- **What:** recording what actually happened to a shipment: each checkpoint (departed, arrived, discharged, lodged, released, delivered), its planned and actual time, delays with reasons and revised dates, and the actual delivery date.
- **Why:** customers ask "where is my cargo and when will it arrive?" Management needs to see which jobs are late and why.
- **Problem solved:** a reliable timeline where the original plan is never overwritten, so delays can be measured and explained.
- **Finished phase achieves:** milestones, delays and the change history are live; the current ETA is calculated on the server.

**B. Features.**
1. **Milestones.** Default milestones per mode (from 3A); mark one done with its actual time and location; add an extra milestone; edit the planned time. Done/current/pending is derived from `actualAt`.
2. **Actual dates.** ATD, ATA and delivery time on the shipment; setting them completes the matching milestone (and the other way round), as the frontend does today.
3. **Delays.** Record a delay: reason (port congestion, border queue, carrier schedule, customs query, missing documents, permit pending, payment pending, equipment shortage, weather, other), the user's description, severity, affected milestone, original expected date, revised date (only when known; never estimated by the system), whether it changes the ETA, follow-up person, next action, status (open, monitoring, resolved), resolution.
4. **Other exceptions.** Damage, documentation problems, customs queries, other, using the same `ShipmentIssue` table.
5. **Action notes.** Manual "action taken" notes on a delay, plus automatic notes describing each change.
6. **Customer notification record.** Staff record whether and when they told the customer (`informed_manually`, `not_required`). The system does not send anything until Phase 12/16.
7. **Current ETA.** The revised date of the most recently identified open delay that affects the ETA, otherwise the planned ETA (rule from `lib/metrics.ts` `currentEta`).
8. **Change history.** A shipment timeline built from `AuditLog` (create, edits, status changes, milestones, delays; later documents, customs and expenses).
9. **Delayed and attention views** use open delays and issues.

**C. Database.**
- Existing **[Verified]**: `ShipmentMilestone` (unique sequence per shipment), `ShipmentIssue` (CHECKs: a delay needs a reason and an original date; resolved needs `resolvedAt`; "informed manually" needs a time), `Note` (exactly one parent: a task or an issue), `AuditLog`.
- No schema change expected. Note: the `IssueStatus` value `monitoring` and the frontend's `DelayStatus` already match.
- Rule kept from the database design: the revised date never overwrites the planned `Shipment.eta`.

**D. Backend.**
- Modules: `TrackingModule` (milestones, issues, notes) inside or beside `ShipmentsModule`; a reusable `HistoryService` reading `AuditLog` (also used for customer service history).
- Endpoints **[Proposed]**:

| Method | Path | Permission | What it does |
|---|---|---|---|
| POST | `/api/shipments/:reference/milestones` | `shipments.manage` | Add a milestone |
| PATCH | `/api/shipments/:reference/milestones/:id` | `shipments.manage` | `{ actualAt?, plannedAt?, location?, note? }`; chronology rules from `validateMilestoneUpdate` |
| GET | `/api/shipments/:reference/issues?status=&type=` | `shipments.view` | Delays and exceptions |
| POST | `/api/shipments/:reference/issues` | `shipments.manage` | Record a delay or exception; writes the first automatic note |
| PATCH | `/api/shipments/:reference/issues/:id` | `shipments.manage` | Update; an automatic note per change |
| POST | `/api/shipments/:reference/issues/:id/notes` | `shipments.manage` | Manual action note |
| GET | `/api/shipments/:reference/history` | `shipments.view` | Timeline from `AuditLog` |
| GET | `/api/parties/:id/history?from=&to=&kind=` | `parties.view` | Customer service history (quotations, shipments, later invoices and payments) |

- Validation: revised date later than the original; resolution and `resolvedAt` together; actual times not in the future (proposal: allow small clock differences); ATA ≥ ATD; delivered ≥ ATA (database checks back these up).
- Background jobs: none in this phase. Automatic delay detection (planned milestone passed with no actual time) is a notification rule in Phase 12.

**E. Frontend.**
- Pages: shipment detail timeline, milestones panel, delays panel; `/shipments/[reference]/delays/new`, `/shipments/[reference]/delays/[delayId]/edit`; delayed and attention views; dashboard delay counts.
- Rules in `lib/delay-form.ts`, `lib/shipment-changes.ts`, `lib/metrics.ts` stay as client-side help; the server is authoritative.
- Type changes: `Milestone` gains an `id`; `ShipmentDelay.milestone` (label) becomes `affectedMilestoneId`; `followUpBy` becomes a user id; `ShipmentEvent[]` comes from the history endpoint.

**F. Security and reliability.** Delay descriptions may contain customer-sensitive remarks: `shipments.view` only; whether customers see delays in the portal is a Phase 14 decision. Notes are append-only (no edit or delete endpoint). Every change audited.

**G. Testing.**
- Unit: current ETA (several delays, resolved delays, delays not affecting ETA), chronology rules, delay duration.
- End-to-end: milestone updates and their effect on ATD/ATA/delivery; delay CHECK rules surfaced as 400 with field details (not raw database errors); automatic notes written; history lists changes in order; permissions.
- Browser: record a delay, revise it, resolve it, add notes; complete milestones; delivered shipment.

**H. Dependencies.** Needs 3A. Needed by 12 (delay and arrival notifications), 13 (on-time performance), 14 (portal tracking).

**I. Completion criteria.**
- [ ] Milestones, actual dates, delays, notes and history are live and audited.
- [ ] Current ETA comes from the server and matches the frontend rule.
- [ ] The planned ETA is never overwritten (tested).
- [ ] Checks run and recorded.

---

### Phase 4 — Agents, carriers, suppliers and transporters · **Not started**

**A. Overview.**
- **What:** live records for every outside company the business works with: overseas and partner agents, shipping lines and airlines (carriers), suppliers that invoice the company (ports, warehouses, inspection), and the trucking companies hired for delivery (transporters, since the company owns no trucks **[Requirement]**).
- **Why:** shipments, expenses and transport jobs must point to real partner records; management needs to know which agents handle which routes and how many jobs.
- **Problem solved:** the `/agents` pages show demo data; partner details are scattered.
- **Finished phase achieves:** partners managed through the existing `/api/parties` API with role-specific views; agent routes recorded; agent assignments visible.

**B. Features.**
1. **Partner records** for the `agent`, `carrier`, `supplier` and `transporter` roles, reusing the Phase 1 API (one company can hold several roles **[Verified]**).
2. **Agent routes.** The lanes an agent handles (origin, destination, modes, services). Today they are derived from demo jobs and "are not agreements or rate cards" (`api-contracts.md`).
3. **Agent assignments.** Which shipments and quotations an agent supports; filters `?agentId=` on shipments and quotations; optionally the route used on a shipment (`agentRouteId`).
4. **Archive rules for partners.** The Phase 1 rule checks only shipments where the party is the customer. Proposal: refuse archiving an agent, carrier or transporter with an undelivered shipment or an open transport job **[Decision needed]**.
5. **Partner summary figures.** Active and total shipments per agent/carrier; open transport jobs per transporter; costs per supplier (after Phase 9).
6. **Agent charges and payables.** What the company owes an agent is recorded as an `Expense` with the agent as supplier (Phase 9). A full payables ledger is out of scope unless the owner asks **[Decision needed]**.

**C. Database.**
- Existing: `Party`, `PartyRole`, `Contact`; shipments, bookings and quotations already have `agentId`/`carrierId`; `TransportJob.transporterId`; `Expense.supplierId`.
- **Proposed additions:**

| Table / column | Fields | Purpose |
|---|---|---|
| `AgentRoute` | `id`, `partyId` → `Party` (must hold `agent`), `origin`, `destination`, `modes` (see note), `services`, `isActive`, `createdAt`, `updatedAt` | Agent lanes |
| `Shipment.agentRouteId` (nullable) | → `AgentRoute` | The route used on a job |

- Note: storing a list of modes may use a PostgreSQL array, a link table (`AgentRouteMode`) or one row per mode. Which Prisma 8 supports cleanly must be checked against the installed version before designing **[Decision needed]**.
- Rate cards (agreed agent prices per lane) are not proposed; add only if requested.

**D. Backend.**
- Module: extend `PartiesModule`; add `AgentRoutesController`.
- Endpoints **[Proposed]**: existing `/api/parties?role=agent|carrier|supplier|transporter` (no new list endpoint); `GET /api/parties/:id` gains `routes` for agents and role-specific counts; `GET/POST /api/parties/:id/routes`; `PATCH/DELETE /api/parties/:id/routes/:routeId` (delete only when unused; otherwise deactivate).
- Permissions: `parties.view`, `parties.manage` (existing). Billing fields (terms, limits) apply to customers only; whether supplier payment terms are needed is **[Decision needed]**.
- Validation: the route's party holds the `agent` role; `agentRouteId` on a shipment belongs to that shipment's agent (`validateShipmentForm` already checks this in the browser).

**E. Frontend.** `/agents`, `/agents/[id]` switch to live data; party create/edit forms allow partner roles; shipment and quotation forms list live agents, carriers and routes; `getParties(type)` and `getParty(id)` (routes) in `lib/data/index.ts`.

**F. Security and reliability.** Partner contacts are personal data (names, phones, emails): `parties.view` only. Agents will see only their own jobs in Phase 14. Audit all changes.

**G. Testing.** Unit: route validation. End-to-end: partner CRUD per role, route CRUD, route/agent mismatch refused, archive rules, permissions. Browser: agents list and detail, choosing an agent route on a shipment.

**H. Dependencies.** Needs Phase 1. Can run **in parallel** with Phases 2–3 (independent code), but the `agentRouteId` column touches `Shipment`, so merge order must be agreed. Needed by 7 (transporters), 9 (suppliers), 14 (agent portal).

**I. Completion criteria.**
- [ ] `/agents` pages live; partner roles managed through `/api/parties`.
- [ ] Agent routes stored, validated and shown; shipments filter by agent id.
- [ ] Partner archive rule enforced as decided.
- [ ] Migration (if approved) reviewed and applied; checks run and recorded.

---

### Phase 5 — Documents and secure file storage · **Not started**

**A. Overview.**
- **What:** uploading, storing, reviewing and downloading shipment documents: bill of lading, air waybill, road consignment note, packing list, commercial invoice, certificate of origin, import declaration form, release order, permits, proof of delivery.
- **Why:** clearance and delivery cannot happen without the right documents. They contain commercial and personal data and must be stored privately for at least 5 years **[Requirement]**.
- **Problem solved:** today files stay in the browser tab and vanish on reload.
- **Finished phase achieves:** files stored in private storage, downloaded only by permitted users through the backend, with review status, required-document checklists, paper-original tracking and legal hold.

**B. Features.**
1. **Upload** one or more files to a shipment (or a customer, quotation, booking, customs entry or invoice) with a document type, number, issue date, expiry date and note. Up to 10 files per upload, 10 MB each (current frontend limits; to confirm **[Decision needed]**).
2. **Server-side checks** of size, allowed format (PDF, JPEG, PNG, DOC/DOCX, XLS/XLSX), and that extension, declared type and file contents agree (the browser checks are only a convenience).
3. **Virus scanning** before a file can be downloaded: `pending → clean` or `infected/quarantined` **[Decision needed, External]** (scanner choice).
4. **Download** through an authorised endpoint that streams the file or returns a link valid for a few minutes.
5. **Required documents.** A checklist per shipment ("missing" rows); an upload fulfils the matching requirement.
6. **Review.** Verify, or reject with a reason; records reviewer and time.
7. **Expiry tracking** for permits, certificates and declarations (alerts in Phase 12).
8. **Paper originals.** Where the original B/L or other paper is held, when it was released and to whom (`originalStatus`, `originalLocation`, `originalReleasedTo`, `originalReleasedAt`) **[Requirement: paper originals tracked]**.
9. **Customer visibility flag** (`customerVisible`) for the portal (Phase 14).
10. **Legal hold** that blocks removal, with a reason.
11. **Soft removal** of a wrong file (`deletedAt`), refused after verification or under legal hold **[Decision needed]**.

**C. Database.**
- Existing **[Verified]** `Document`: type, category, status (missing/received/verified/rejected), number, dates, `storageKey` (unique), file name, MIME type, size, `sha256`, uploader, reviewer, rejection reason, paper-original fields, legal hold, `deletedAt`, and links to party/quotation/booking/shipment/customs entry/invoice (at least one required). CHECKs keep file fields together and require a rejection reason.
- `DocumentType` already includes `release_order`, `permit`, `proof_of_delivery`, `other`; the frontend type has only seven values (to extend).
- **Proposed additions:** `Document.scanStatus` (`pending`, `clean`, `infected`, `failed`) and `scannedAt`; `Document.agentVisible` (Boolean) for the agent portal; optionally `DocumentVersion` for replaced files (deferred in the database design). Download events go to `AuditLog`; no new table.
- Retention uses `RetentionPolicy` (5 years from the end of the reporting period). Nothing is deleted automatically **[Requirement]**.

**D. Backend.**
- Modules: `DocumentsModule` (controller, service, `document-rules.ts`), `StorageModule` with a **storage interface** (`put`, `getStream`, `signedUrl`, `remove`) and two adapters: local private folder outside the repository for development and tests, and the production provider **[Decision needed, External]**.
- File uploads: `@nestjs/platform-express` already depends on `multer` **[Verified in node_modules]**, so NestJS's file interceptor needs no new dependency. A cloud-storage SDK and a virus scanner would be new dependencies **[Decision needed]**.
- Endpoints **[Proposed]**:

| Method | Path | Permission | What it does |
|---|---|---|---|
| GET | `/api/documents?shipment=&customerId=&status=&type=&expiringBefore=` | `documents.view` | Metadata only, never a file URL |
| GET | `/api/documents/:id` | `documents.view` | Metadata |
| POST | `/api/shipments/:reference/documents` | `documents.manage` | `multipart/form-data`: `type`, `note?`, `files[]`; per-file results; 413 too large, 415 unsupported, 400 invalid |
| POST | `/api/shipments/:reference/documents/requirements` | `documents.manage` | Add a "missing" requirement |
| GET | `/api/documents/:id/file` | `documents.view` (+ category rules) | Stream (`Cache-Control: private, no-store`, safe `Content-Disposition`, `X-Content-Type-Options: nosniff`) or `{ url, expiresAt }` |
| POST | `/api/documents/:id/review` | `documents.review` | `{ decision, reason? }`; only from `received` and `clean` |
| PATCH | `/api/documents/:id` | `documents.manage` | Number, dates, note, visibility |
| POST | `/api/documents/:id/original` | `documents.manage` | Paper original status, location, released to |
| POST | `/api/documents/:id/legal-hold` | management/admin **[Decision needed]** | Set or clear with reason |
| DELETE | `/api/documents/:id/file` | `documents.manage` | Soft removal, rules above |

- **New permission codes [Proposed]:** `documents.view`, `documents.manage`, `documents.review`, and `documents.financial.view` (financial-category documents such as invoices for finance and management only). Today document access is implied by `customs.manage` ("Manage clearance records and documents") **[Verified]**. Whether to add the `documentation` role the frontend shows is **[Decision needed]**.
- Background job: virus scan after upload (in-process queue at first; a scheduler or worker if the scanner is slow).

**E. Frontend.** `/documents`, `/documents/upload`, the shipment detail documents panel, review buttons; `getDocuments()`; `lib/document-upload.ts` and `lib/document-changes.ts` stay as client-side help. The "Open" and "Download" buttons call the authorised endpoint instead of `blob:` URLs. A scan-status badge is new. Contracts to agree: per-file upload result shape, download mode (stream vs signed URL).

**F. Security and reliability.**
- **Never** in `public/` or any public URL; non-guessable keys (`documents/<uuid>`); encryption at rest (provider setting).
- Access check on every read and write; financial documents restricted; portal users limited to their own records later.
- Store `sha256` to detect corruption and duplicates.
- Write the file first, then the database row in a transaction; clean up orphans if the row fails (a cleanup job or a "pending" state).
- Audit uploads, downloads, reviews, original releases, legal holds, removals.
- Limits on request size to avoid exhausting memory or disk.

**G. Testing.** Unit: format sniffing, size limits, requirement fulfilment, review transitions. End-to-end (local storage adapter): upload single and multiple, partial failure reported per file, wrong type → 415, too large → 413, download headers, 403 for roles without access, financial documents hidden, rejected needs a reason, legal hold blocks removal, no file reachable without signing in. Browser: upload, open, download, verify, reject. Manual: confirm the production bucket is private (an unsigned request fails).

**H. Dependencies.** Needs 3A. Needed by 6 (customs documents), 7 (proof of delivery), 10 (invoice copies), 14 (portal downloads). **[Decision needed, External]:** storage provider, region, cost, scanner. Development can proceed with the local adapter before that decision.

**I. Completion criteria.**
- [ ] Files stored privately (local adapter in development; production adapter chosen and tested before launch).
- [ ] Server repeats every browser check; scan state enforced if a scanner is approved.
- [ ] Downloads only through the authorised endpoint, with correct headers.
- [ ] Review, requirements, paper originals and legal hold work and are audited.
- [ ] Checks run and recorded.

---

### Phase 6 — Customs clearance, release and duties · **Not started**

**A. Overview.**
- **What:** the clearing work: a customs entry per shipment (or several), its regime (import for home use, transit, export, re-export, temporary import), lodging with KRA, the official declaration number, the assessment of duties and taxes, payment, queries, and the release order.
- **Why:** clearing is a core service and a frequent cause of delay and cost. Duties paid on the customer's behalf must be re-billed **[Requirement: disbursements re-billed]**.
- **Problem solved:** the `/customs` page shows static demo data; duties and release dates are not tracked.
- **Finished phase achieves:** customs entries, statuses, assessed charges and release recorded in the system, with a **manual** workflow alongside KRA iCMS.

**B. Features.**
1. **Customs entry** per shipment with internal reference `CE-…`, regime, customs station, status.
2. **Status flow:** `not_started → documents_pending → lodged → assessed → duty_paid → released`, with `query` possible from lodged or assessed. Each step records its time; `lodged` records the official declaration number (unique when set **[Verified]**); `released` records the release order number and time.
3. **Assessed charges.** Each duty, tax or fee as a `CustomsCharge` line (charge type, amount, paid by company or customer, payment time and reference).
4. **Duty information.** The system **records** the amounts assessed by KRA. It does **not** calculate official duty: rates depend on tariff classification and are set by law and by KRA's assessment. An optional **estimate** from figures entered by staff (customs value, rates) may be added, clearly labelled as an estimate, with no rates hard-coded **[Decision needed]**.
5. **Queries.** Record query details and follow-up (also as a `ShipmentIssue` of type `customs_query` so it shows as a delay).
6. **Release.** Releasing the entry can move the shipment to `released` (rule to confirm).
7. **Documents.** Customs documents (import declaration form, release order, permits) linked to the entry (Phase 5).
8. **Legal hold** for entries under amended assessment or proceedings (retention rule).
9. **Manual iCMS workflow [Requirement: do not assume iCMS access].** Staff lodge and pay in KRA's systems directly, then record the declaration number, assessment lines, payment references and release order here. Integration is Phase 16.

**C. Database.**
- Existing **[Verified]**: `CustomsEntry` (reference unique, `declarationNumber` unique when set, regime, station, status, lodged/assessed/released times, release order number, query details, legal hold), `CustomsCharge` (charge type, amount ≥ 0, paid by, paid at, payment reference; cascades with its entry), `Expense.customsChargeId` (unique) linking a company-paid charge to its expense.
- **Proposed additions [Decision needed]:**
  - `CustomsEntryItem`: `customsEntryId`, `lineNumber`, `hsCode`, `description`, `quantity`, `unit`, `customsValue` (Money), `originCountry`, for declarations with several tariff lines. Only if the business wants item-level detail; otherwise the declaration document holds it.
  - An `isEstimate` flag on `CustomsCharge`, or a separate estimate table, if estimates are approved.

**D. Backend.**
- Module: `CustomsModule` (entries, charges, rules).
- Endpoints **[Proposed]**:

| Method | Path | Permission | What it does |
|---|---|---|---|
| GET | `/api/customs-entries?status=&shipment=&station=&q=` | `customs.view` | Customs worklist |
| GET | `/api/customs-entries/:reference` | `customs.view` | Detail with charges and documents |
| POST | `/api/shipments/:reference/customs-entries` | `customs.manage` | New entry; assigns `CE-…` |
| PATCH | `/api/customs-entries/:reference` | `customs.manage` | Regime, station, query details |
| POST | `/api/customs-entries/:reference/status` | `customs.manage` | `{ status, at, declarationNumber?, releaseOrderNumber?, queryDetails? }` |
| POST/PATCH/DELETE | `/api/customs-entries/:reference/charges[/:id]` | `customs.manage` | Assessed charges; delete only before paid |
| POST | `/api/customs-entries/:reference/charges/:id/paid` | `customs.manage` + finance rule **[Decision needed]** | Records payment; when paid by the company, creates the linked `Expense` (once Phase 9 exists) |

- Validation: status order; declaration number required from `lodged`; release requires time and release order number (proposal); amounts ≥ 0; charge types of category `customs`.
- Permissions follow the matrix: operations manage clearance records; finance views assessments and charges; sales only if required; customers later see only assessments on their shipments **[Verified matrix, `docs/database-design.md` §6]**.

**E. Frontend.** `/customs` switches to live data (worklist by status); shipment detail customs panel (several entries possible; the frontend type `Shipment.customs` is single and must change); new forms for status updates and charges (none exist today).

**F. Security and reliability.** Assessments are financial and tax data: restrict by permission; audit every change; declaration numbers unique; legal hold blocks changes after release (proposal). The UI must never show "submitted to KRA" without an integration confirming it.

**G. Testing.** Unit: status transitions, required fields per status. End-to-end: create entry, full status flow, duplicate declaration number → 409, charges add/pay, company-paid charge → expense link (with Phase 9), permissions per role (finance view-only), legal hold. Browser: customs worklist and entry detail.

**H. Dependencies.** Needs 3A, ideally 5 (documents). The expense link needs 9; build the entry and charges first and add the link when 9 lands, or schedule 9 before 6 **[Decision needed]**. Needed by 10 (disbursement lines on invoices), 13, 16 (iCMS). **[External]:** iCMS access for integration only, not for this phase.

**I. Completion criteria.**
- [ ] Customs entries, statuses, charges and release live and audited.
- [ ] Manual iCMS workflow documented for staff.
- [ ] No official duty calculation claimed; any estimate labelled.
- [ ] Checks run and recorded.

---

### Phase 7 — Transport and delivery legs · **Not started**

**A. Overview.**
- **What:** each hired truck or delivery leg after release: transporter, truck registration, driver, pickup and delivery places and times, status, and proof of delivery.
- **Why:** the company owns no trucks and subcontracts road transport **[Requirement]**; it must know which truck has which container and when it was delivered.
- **Finished phase achieves:** transport jobs recorded per shipment and container; delivery confirmation feeds the shipment's delivery date.

**B. Features.** Plan a transport job (transporter, container, locations, planned times); dispatch (truck, driver, actual pickup); deliver (actual delivery time, proof-of-delivery document); cancel; several jobs per shipment (one per truck); transporter cost recorded as an expense (Phase 9); optional rule: the shipment becomes `delivered` when all its jobs are delivered **[Decision needed]**.

**C. Database.** Existing **[Verified]** `TransportJob` (transporter required, optional container, truck, driver name and phone, locations, planned and actual times, status planned/dispatched/delivered/cancelled; delivered needs an actual delivery time). `Expense.transportJobId` exists. No change expected. Warehouse and storage operations are **not modelled** ("warehouse" is a deferred table in the database design) **[Decision needed]** whether they are in scope.

**D. Backend.** Module `TransportModule`. Endpoints **[Proposed]**: `GET/POST /api/shipments/:reference/transport-jobs`; `PATCH /api/transport-jobs/:id`; `POST /api/transport-jobs/:id/dispatch`, `/deliver`, `/cancel`; `GET /api/transport-jobs?status=&transporterId=&from=&to=` (dispatch board). Permission: `shipments.manage` / `shipments.view` (or a new `transport.manage` **[Decision needed]**). Validation: transporter holds the `transporter` role; container belongs to the shipment; delivery after pickup; no dispatch before customs release for imports (proposal, to confirm).

**E. Frontend.** No transport UI exists today. New: a transport section on the shipment detail page and possibly a dispatch list. Proof of delivery uses the Phase 5 upload.

**F. Security.** Driver names and phone numbers are personal data: visible to operations only; not shown in portals unless decided. Audit all changes.

**G. Testing.** Unit: status and time rules. End-to-end: job lifecycle, wrong role or container refused, delivered-without-time refused, shipment delivery rule, permissions. Browser: plan, dispatch, deliver.

**H. Dependencies.** Needs 3A, 4 (transporters), 5 (proof of delivery). Needed by 9 (transport costs), 13 (delivery performance).

**I. Completion criteria.** [ ] Transport jobs live and audited · [ ] delivery rule as decided · [ ] checks run and recorded.

---

### Phase 8 — User management, roles, audit log and company settings · **Not started**

**A. Overview.**
- **What:** administrators create staff accounts, assign roles, disable leavers, reset passwords, adjust which permissions each role has, read the audit log, and maintain company details printed on quotations and invoices.
- **Why:** today accounts are created only by seed scripts; the `/users` and audit-log pages are previews. Staff changes must not need a developer.
- **Finished phase achieves:** staff administration through the app, password changes, token revocation, an audit-log viewer and a company-settings record.

**B. Features.**
1. **Staff accounts:** list, invite/create, edit name and roles, disable and re-enable. A disabled user is refused immediately (already true in the guard **[Verified]**).
2. **Passwords:** users change their own password; an administrator sets a temporary one (manual, until email exists in Phase 16) and the user must change it at next sign-in **[Proposed]**.
3. **Token revocation:** sign-out and password change invalidate earlier tokens (closes the Phase 0 limit).
4. **Role and permission editing:** view the matrix; add or remove permissions from a role; possibly create roles such as `documentation` **[Decision needed]**.
5. **Safety rules:** at least one active admin always remains; users cannot remove their own admin role or disable themselves.
6. **Audit-log viewer:** filter by record, user, date and action; read-only.
7. **Company settings:** legal name, KRA PIN, VAT number, address, bank details for remittance, logo, default quotation terms (needed for printed quotations and invoices).
8. **Retention settings** view (and edit by admin) for `RetentionPolicy`.

**C. Database.**
- Existing: `User` (status `active`/`invited`/`disabled`, `passwordHash`, `lastLoginAt`), `Role`, `UserRole`, `Permission`, `RolePermission`, `AuditLog`, `RetentionPolicy`.
- **Proposed additions:**

| Change | Purpose |
|---|---|
| `User.tokenVersion` (Int, default 0), included in the JWT and checked by the guard | Revoke all of a user's tokens by incrementing it (simplest option; a `UserSession` table is the alternative) |
| `User.mustChangePassword` (Boolean) | Temporary passwords |
| `CompanySetting` (single row: legal name, KRA PIN, VAT number, address, phone, email, bank name, account name and number, logo document id, default terms, `updatedById`, `updatedAt`) | Printed documents and invoices |
| Optional `PasswordResetToken` (hashed token, user, expiry, used at) | Self-service reset once email exists |

**D. Backend.**
- Modules: `UsersModule`, `RolesModule`, `AuditLogModule` (reader), `SettingsModule`.
- Endpoints **[Proposed]**: `GET/POST /api/users`; `GET/PATCH /api/users/:id`; `POST /api/users/:id/disable`, `/enable`, `/reset-password`; `POST /api/auth/change-password`; `POST /api/auth/logout` (increments `tokenVersion`, or a "log out everywhere" option **[Decision needed]**); `GET /api/roles`; `GET /api/permissions`; `PUT /api/roles/:code/permissions`; `GET /api/audit-log?entityType=&entityId=&actorUserId=&action=&from=&to=`; `GET/PUT /api/settings/company`; `GET/PATCH /api/retention-policies`.
- Permissions: `users.manage` for users and roles; a new `audit.view` (management, admin) **[Proposed]**; a new `settings.company.manage` (admin) **[Proposed]**.

**E. Frontend.** `/users` and `/settings` (audit log and company details sections) go live; a change-password page; the role matrix in `lib/access.ts` is replaced by `GET /api/auth/me` permissions for showing or hiding buttons (the server remains the control).

**F. Security.** Privilege changes are the highest-risk admin actions: audit every one with before/after; rate-limit password endpoints; never return password hashes; minimum length 12; temporary passwords shown once. Permission edits take effect on the next request (already the design).

**G. Testing.** End-to-end: create, edit, disable (immediate 401), last-admin protection, self-disable refused, password change revokes old tokens, role-permission edits change access immediately, audit-log filters, non-admins 403. Browser: users page, settings.

**H. Dependencies.** Needs 0. Independent of 2–7; can run in parallel. Needed by 10 (company details on invoices), 14 (portal accounts).

**I. Completion criteria.** [ ] Staff administration without developer help · [ ] token revocation works · [ ] audit log readable · [ ] company settings stored · [ ] checks run and recorded.

---

### Phase 9 — Expenses, cost estimates and job costing · **Not started**

**A. Overview.**
- **What:** every cost the company incurs on a job (carrier freight, port charges, transport, handling, storage, customs duties paid on the customer's behalf, agent fees), its approval and payment, estimated costs per job, and profit per job.
- **Why:** the business must know whether each job made money, and must re-bill disbursements so nothing paid on a customer's behalf is forgotten.
- **Finished phase achieves:** expenses live with approval; cost estimates stored; costing calculated on the server.

**B. Features.**
1. **Record an expense** against a shipment, transport job or customs charge: supplier (or payee name), charge type, description, amount, date incurred, supplier invoice number, billable flag.
2. **Approval** by an authorised role; recording users cannot approve their own expense (proposal, **[Decision needed]**).
3. **Mark paid** with payment time and reference.
4. **Disbursements:** company-paid customs charges create expenses automatically (link from Phase 6); billable expenses are offered as invoice lines in Phase 10 and linked to the line that re-bills them (`Expense.invoiceLineId`, unique).
5. **Cost estimates** per job and category (budget before supplier bills arrive).
6. **Job costing:** quoted revenue, invoiced revenue (from Phase 10), estimated cost, actual cost, gross profit and margin per job, using the definitions in `lib/profitability.ts` (to confirm with the accountant, especially whether disbursements count as revenue and cost) **[Decision needed]**.

**C. Database.**
- Existing **[Verified]** `Expense` (CHECKs: amount > 0, payee required, approved fields, paid time), `ChargeType` (category gives the frontend's expense category).
- **Proposed:** `CostEstimate` (`id`, `shipmentId`, `chargeTypeId` or `category`, `estimatedAmount` Money ≥ 0, `note`, `createdById`, `updatedAt`; unique per shipment and category) — the frontend's `CostEstimate` type, deferred in the database design.

**D. Backend.** Modules `ExpensesModule`, `CostingModule`. Endpoints **[Proposed]**: `GET /api/expenses?shipment=&category=&status=&supplierId=&from=&to=`; `POST /api/shipments/:reference/expenses`; `PATCH /api/expenses/:id` (pending only); `POST /api/expenses/:id/approve` (`transactions.approve`); `POST /api/expenses/:id/mark-paid` (`payments.manage`); `GET /api/shipments/:reference/costing`; `PUT /api/shipments/:reference/cost-estimates`. Who may record expenses (operations for their jobs, finance) **[Decision needed]**; a new `expenses.manage` permission is proposed.

**E. Frontend.** `/expenses`, `/expenses/new`, shipment detail costing panel, `/finance` cost figures; `getExpenses()`, `getCostEstimates()`; `lib/expense-form.ts` and `lib/profitability.ts` become client-side helpers only. Approve and mark-paid buttons are new.

**F. Security.** Financial data: restrict views (operations see only jobs they handle **[Decision needed]**); approval separated from recording; paid expenses locked; amounts summed in SQL; audit every change.

**G. Testing.** Unit: costing formulas against worked examples from the accountant. End-to-end: record, approve, pay, locked after paid, self-approval refused (if decided), customs disbursement link unique, permissions. Browser: record expense, filters, costing panel.

**H. Dependencies.** Needs 3A, 4 (suppliers). Links to 6 and 7. Needed by 10 (re-billing), 13 (profitability reports).

**I. Completion criteria.** [ ] Expenses, approval and payment live · [ ] estimates stored · [ ] server costing matches agreed examples · [ ] checks run and recorded.

---

### Phase 10 — Invoicing and credit notes · **Not started**

**A. Overview.**
- **What:** billing the customer for each shipment: a draft invoice with service charges and re-billed disbursements, VAT per line, issue (which freezes it), and credit notes to correct an issued invoice.
- **Why:** this is how the business gets paid, and invoices are legal tax documents. The company is VAT-registered and invoices go through KRA eTIMS **[Requirement]**.
- **Problem solved:** invoices are demo data; outstanding and overdue balances cannot be trusted.
- **Finished phase achieves:** invoices and credit notes issued from the system with frozen totals, credit check at invoicing, and real balances on customer pages.

**B. Features.**
1. **Draft invoice** for a shipment, pre-filled from the quotation lines and the job's billable expenses (disbursements, marked `isDisbursement`).
2. **One invoice per shipment** plus supplementary invoices and credit notes **[Requirement]**.
3. **Lines** with charge type, description, quantity, unit price, tax category (standard, zero-rated, exempt, outside VAT) and tax rate; totals calculated by the server.
4. **Issue:** assigns the `INV-…` number (or at creation, **[Decision needed]**), sets issue and due dates (from the customer's payment terms), snapshots the customer name and KRA PIN, freezes subtotal, tax and total, and locks the invoice.
5. **Credit-limit check at invoicing** (approved 2026-11-03), reusing the Phase 2 service.
6. **Cancel a draft.** Issued invoices are never edited or deleted; they are corrected by credit notes **[Requirement]**.
7. **Credit notes** against an issued invoice: reason, lines (optionally linked to invoice lines), issue, `CN-…` number, frozen totals.
8. **Derived statuses:** part paid, paid, overdue (due date before today on the Nairobi calendar), calculated from allocations and credit notes **[Verified design]**.
9. **eTIMS fields, manual workflow:** until an integration exists, staff issue the invoice through KRA's eTIMS channel the company uses and record the eTIMS reference and status here. **How the company currently meets eTIMS (which KRA solution) is unknown [External, Decision needed].**
10. **Printable invoice** with company details (Phase 8): browser print first; a server PDF only if approved (new dependency) **[Decision needed]**.
11. **Legal hold** for invoices under dispute or review.

**C. Database.**
- Existing **[Verified]**: `Invoice` (number unique, shipment and customer, status draft/issued/cancelled, dates, customer snapshot, frozen totals, eTIMS fields, legal hold; CHECKs: issued invoices have all totals, total = subtotal + tax, due ≥ issue), `InvoiceLine` (tax category and rate, disbursement flag), `CreditNote`, `CreditNoteLine`, `CreditCheck`, `Expense.invoiceLineId`.
- **Proposed [Decision needed]:**
  - `Invoice.kind` (`standard`, `supplementary`) and a partial unique index allowing only one non-cancelled `standard` invoice per shipment. Without it the "one invoice per shipment" rule can only be enforced in the service.
  - Optional `EtimsSubmission` log table (request, response, time, status) for Phase 16.
- Rule: a credit note's total cannot exceed the invoice total minus earlier credit notes (enforced in the service under a row lock; a CHECK cannot sum across rows).

**D. Backend.**
- Modules: `InvoicesModule`, `CreditNotesModule`, shared `TaxService` (line maths, rounding) and the Phase 2 `CreditModule`.
- Endpoints **[Proposed]**:

| Method | Path | Permission | What it does |
|---|---|---|---|
| GET | `/api/invoices?status=&customerId=&shipment=&overdue=&from=&to=` | `invoices.view` | List with balances |
| GET | `/api/invoices/:number` | `invoices.view` | Detail, lines, allocations, credit notes, balance |
| POST | `/api/shipments/:reference/invoices` | `invoices.manage` | Draft, pre-filled; `{ kind? }` |
| PATCH | `/api/invoices/:number` | `invoices.manage` | Draft only; lines replaced in one transaction |
| POST | `/api/invoices/:number/issue` | `invoices.manage` (+ credit rules) | Freeze and lock |
| POST | `/api/invoices/:number/cancel` | `invoices.manage` | Draft only |
| POST | `/api/invoices/:number/etims` | `invoices.manage` | Record manual eTIMS reference and status |
| POST | `/api/invoices/:number/credit-notes` | `invoices.manage` | Draft credit note |
| PATCH | `/api/credit-notes/:number` | `invoices.manage` | Draft only |
| POST | `/api/credit-notes/:number/issue` | `invoices.manage` | Freeze |
| GET | `/api/parties/:id/account` | `parties.billing.view` | Already part of the Phase 1 `billing` block; becomes non-zero |

- Validation: customer not archived (proposal: closed accounts refused too); shipment belongs to the customer; at least one line; disbursement lines link to unbilled billable expenses; issued records refuse every change (409).
- VAT rules (rates per tax category, rounding per line or per invoice, disbursements outside VAT or not) **must be confirmed by the company's accountant** before issue is enabled **[Decision needed]**.

**E. Frontend.** `/finance` invoices list live; customer detail billing figures become real; new pages for invoice create/edit/issue and credit notes (none exist today); task links to invoices (Phase 12); `InvoiceStatus` derived values come from the API. Contracts to agree: invoice detail shape with balance and derived status.

**F. Security and reliability.**
- Highest financial and legal risk: issued invoices immutable (service rule plus tests; a database trigger could be added **[Decision needed]**); numbers unique and sequential with no gaps caused by failed saves (generated inside the issuing transaction).
- Only `invoices.manage` can issue; consider a second approver for credit notes above a threshold **[Decision needed]**.
- All totals in SQL `numeric`; never JavaScript floats.
- Audit every action with before/after.

**G. Testing.** Unit: line maths and rounding against the accountant's worked examples; credit-note limits. End-to-end: draft → issue → locked; second standard invoice refused; supplementary allowed; credit check at issue; credit note limits under concurrency; derived statuses (overdue on the Nairobi date boundary); permissions; disbursement expense linked once. Browser: create, issue, print, credit note.

**H. Dependencies.** Needs 3A, 8 (company details), 9 (disbursements); uses 2 (credit service). Needed by 11, 13, 14, 16 (eTIMS). **[External]:** eTIMS method; accountant's VAT review.

**I. Completion criteria.**
- [ ] Invoices and credit notes issued with frozen totals; issued records cannot change (tested).
- [ ] VAT rules signed off by the accountant; tax defaults reviewed.
- [ ] Credit check at invoicing works.
- [ ] Customer balances calculated in SQL and shown live.
- [ ] Checks run and recorded.

---

### Phase 11 — Payments, allocation and reconciliation · **Not started**

**A. Overview.**
- **What:** recording money received by cheque or bank transfer, allocating it to invoices (fully or partly), handling bounced cheques, reconciling against bank statements, and customer statements.
- **Why:** finance needs to know who has paid, who owes what, and whether recorded payments match the bank.
- **Finished phase achieves:** payments live, allocation safe under concurrency, bounced cheques reverse correctly, reconciliation tracked.

**B. Features.**
1. **Record a payment:** customer, method (`cheque` or `bank_transfer` **[Verified]**), amount, received time, bank reference, cheque number/bank/date, notes; `RCT-…` reference.
2. **Allocate** to one or more invoices; partial payments; unallocated amount remains as customer credit.
3. **Cheque lifecycle:** received → cleared, or bounced with reason (bounced and cancelled payments stop counting toward balances **[Requirement]**); re-opens the affected invoices.
4. **Reverse an allocation** (audited).
5. **Reconciliation:** mark a payment reconciled with time and user; optional bank-statement import (CSV) to match lines to payments **[Decision needed]**.
6. **Customer statement:** invoices, credit notes, payments and running balance for a period.
7. **M-Pesa:** **removed from scope** by the repository owner on 2026-10-26. The task brief for this roadmap lists M-Pesa, so this conflicts **[Decision needed]**. If reinstated: a new `PaymentMethod` value and M-Pesa fields (transaction code, payer phone), manual recording first, and the Safaricom integration in Phase 16 **[External]**. The frontend still offers `mpesa` (`lib/types.ts`), which must be removed or kept depending on the decision.
8. **Withholding deductions:** whether customers deduct withholding tax or withholding VAT from payments, and how to record it, is unknown **[Decision needed]** (ask the accountant).

**C. Database.**
- Existing **[Verified]**: `Payment` (CHECKs: amount > 0, cheque details required for cheques, cleared/bounced times; bank reference unique for non-cancelled transfers), `PaymentAllocation` (unique per payment and invoice, amount > 0).
- Rule from the design: under a row lock, allocations never exceed the payment amount or the invoice balance.
- **Proposed [Decision needed]:** `BankStatement` (account, period, imported by, file document) and `BankStatementLine` (date, amount, reference, matched payment id) for import-based reconciliation.

**D. Backend.** Module `PaymentsModule` (`AllocationService` using `SELECT … FOR UPDATE` on the payment and invoice rows inside one transaction). Endpoints **[Proposed]**: `GET /api/payments?customerId=&status=&method=&reconciled=&from=&to=`; `GET /api/payments/:reference`; `POST /api/payments`; `PATCH /api/payments/:reference` (before allocation); `POST /api/payments/:reference/allocations` `{ invoiceNumber, amount }`; `DELETE /api/payments/:reference/allocations/:id`; `POST /api/payments/:reference/clear`, `/bounce` `{ reason }`, `/cancel` `{ reason }`, `/reconcile`; `GET /api/parties/:id/statement?from=&to=`. Permissions: `payments.view`, `payments.manage`; management approval for reversals above a threshold **[Decision needed]**.

**E. Frontend.** `/finance` payments live; allocation and bounce actions (new UI); customer statement on the customer page; dashboard outstanding figures. Remove `mpesa` from the payment method list unless reinstated.

**F. Security and reliability.** Concurrency is the main risk (two staff allocating the same payment): row locks and tests. Duplicate bank references refused (unique index). No hard delete; cancellations need a reason. Audit everything. Bank account numbers shown masked except to finance (proposal).

**G. Testing.** Unit: balance formula (payments, allocations, credit notes, bounced cheques). End-to-end: allocate partially and fully; over-allocation refused; **parallel allocations** never exceed limits; bounce re-opens balances; duplicate bank reference → 409; statement totals; permissions. Browser: record, allocate, bounce, reconcile.

**H. Dependencies.** Needs 10. Needed by 13, 14. **[External]:** bank statement format (if import is chosen); M-Pesa only if reinstated.

**I. Completion criteria.** [ ] Payments and allocations live and safe under concurrency (tested) · [ ] bounced cheques handled · [ ] balances match the agreed formula · [ ] reconciliation process agreed and working · [ ] checks run and recorded.

---

### Phase 12 — Tasks, notifications and reminders · **Not started**

**A. Overview.**
- **What:** follow-up tasks for staff linked to shipments, quotations, documents or invoices; in-app notifications generated by the server (arrivals, delays, missing or expiring documents, quotations awaiting a decision, overdue invoices); reminders before and after due times.
- **Why:** freight work is deadline-driven; missed follow-ups cause storage charges, delays and unpaid invoices.
- **Finished phase achieves:** tasks stored; notifications generated by a scheduled job and stored with read state; reminders. **No email or SMS** until Phase 16.

**B. Features.**
1. **Tasks:** create, edit, assign, re-date, re-prioritise, change status (open, in progress, done, cancelled), notes (manual, max 300 characters, plus automatic change notes).
2. **Notifications:** generated with the same rules as `lib/notifications.ts`: arrivals within 7 days; open/monitored delays; missing or rejected documents (high priority once cargo has arrived); documents expiring within 14 days or expired; quotations sent and awaiting a decision (medium within 3 days of expiry), accepted but not booked, or still draft; unpaid invoices past due (high after 30 days). Filtered by role (finance sees invoice alerts; operations shipment alerts).
3. **Read state** per user; mark read/unread.
4. **Reminders:** due-soon and overdue task reminders to the assignee; escalation rules **[Decision needed]**.
5. **Preferences** per user (which kinds, later which channels).
6. **Quotation expiry stored** (optional move from derived to stored status).

**C. Database.**
- Existing **[Verified]**: `Task` (links to shipment, quotation, document, invoice; done needs `completedAt`), `Note`.
- **Proposed:** `Notification` (`id`, `userId`, `kind`, `priority`, `title`, `body`, `entityType`, `entityId`, `dedupeKey` unique per user so the scheduler never duplicates, `createdAt`, `readAt`, `resolvedAt`); `NotificationPreference` (`userId`, `kind`, `inApp`, `email`, `sms`); later `MessageOutbox` (channel, recipient, template, payload, status, attempts, provider id) for Phase 16.

**D. Backend.**
- Modules: `TasksModule`, `NotificationsModule`, `SchedulerModule`.
- **Scheduler [Decision needed]:** `@nestjs/schedule` (a new dependency) inside the API process, or an external cron calling a protected command. With more than one server process, a database lock is needed so only one runs each job.
- Endpoints **[Proposed]**: `GET /api/tasks?status=&assigneeId=&priority=&dueBefore=&shipment=&quotation=&document=&invoice=`; `POST /api/tasks`; `PATCH /api/tasks/:id`; `POST /api/tasks/:id/notes`; `GET /api/notifications?unread=&kind=`; `POST /api/notifications/read` `{ ids, read }`; `GET/PUT /api/notification-preferences`. Permission: new `tasks.view`/`tasks.manage` **[Proposed]**; users see their own notifications only.
- Validation: assignee is an active staff account; linked records exist and the user may see them.

**E. Frontend.** `/notifications`, `/notifications/tasks/new`, `/notifications/tasks/[id]`, `/notifications/tasks/[id]/edit`; top-bar notification count; `getTasks()`; `lib/task-form.ts`, `lib/task-changes.ts`, `lib/notifications.ts` become helpers. The UI must never say "sent" for email/SMS until Phase 16 confirms delivery.

**F. Security and reliability.** Notifications must not leak records a user may not see (generate per user with their permissions). The scheduler must be idempotent (dedupe keys) and safe to re-run. Audit task changes and read-state changes (as the contract asks).

**G. Testing.** Unit: each notification rule with fixed clocks (Nairobi time); dedupe. End-to-end: task CRUD and notes; notifications appear for the right roles only; read state; scheduler run twice creates no duplicates. Browser: notifications page, tasks.

**H. Dependencies.** Needs 3B, 5, 10 for all rules (rules can be added as each data source goes live). Needed by 14 (portal notices), 16 (delivery).

**I. Completion criteria.** [ ] Tasks live · [ ] server-generated notifications with read state, per role · [ ] scheduler approach approved, idempotent and tested · [ ] checks run and recorded.

---

### Phase 13 — Reports, dashboards and analytics · **Not started**

**A. Overview.** Management needs figures they can trust: active jobs, arrivals, delays and their reasons, on-time delivery, customs clearance times, quotation conversion, revenue, costs, profit per job/customer/mode, receivables ageing, and agent performance. Today `lib/reports.ts` and `lib/metrics.ts` compute these in the browser from demo data.

**B. Features.** Dashboard summary (counts and money totals); report endpoints with date, customer, mode and status filters; receivables ageing (0–30, 31–60, 61–90, 90+ days); delay analysis by reason; profitability; agent and carrier performance; CSV export from the server for large ranges; recent activity feed (from `AuditLog`). Scheduled or emailed reports later (Phase 16) **[Decision needed]**.

**C. Database.** No new tables expected. Indexes or database views if queries are slow (measure first). Each report's exact definition (for example "on time" = delivered before the planned ETA or before the planned delivery date) **[Decision needed]**.

**D. Backend.** Module `ReportsModule`, `DashboardModule`. Endpoints **[Proposed]**: `GET /api/dashboard/summary`; `GET /api/activity?limit=`; `GET /api/reports/:name?from=&to=&customerId=&mode=&status=` (names such as `shipments`, `delays`, `customs-times`, `quotations`, `revenue`, `profitability`, `receivables-ageing`, `agents`); `GET /api/reports/:name.csv`. Permissions: `reports.view`, plus financial reports require `invoices.view`/`payments.view` (proposal). All sums in SQL.

**E. Frontend.** `/reports` (filters and the six existing CSV downloads), `/` dashboard, `/finance` summary figures.

**F. Security.** Reports aggregate sensitive data: permission per report; CSV exports audited; no customer data in URLs beyond ids.

**G. Testing.** Unit/integration: each report on a fixed fictional dataset with expected figures agreed in advance; date boundaries (Nairobi). End-to-end: permissions per report; CSV matches JSON. Browser: reports page and dashboard. Performance check on a larger fictional dataset.

**H. Dependencies.** Each report needs its data phase (3B, 6, 9, 10, 11). Can be built incrementally after each phase.

**I. Completion criteria.** [ ] Dashboard and reports from the server · [ ] definitions agreed and figures match the test dataset · [ ] permissions enforced · [ ] checks run and recorded.

---

### Phase 14 — Customer and agent portals · **Not started**

**A. Overview.**
- **What:** separate, restricted sign-ins for customers (track their own shipments, download their documents, see their invoices, statements and payments) and for partner agents (see and update the shipments assigned to them, upload documents).
- **Why:** fewer phone calls and emails asking for status; faster document exchange with agents.
- **Problem solved:** today customers and agents depend on staff for every update.
- **Finished phase achieves:** portal users see only their own records; every query is scoped to their party.

**B. Features.** Customer portal: shipments list and tracking (milestones, current ETA, delays if allowed), documents marked `customerVisible`, invoices and statements, payment history, quotation view and acceptance (optional **[Decision needed]**). Agent portal: assigned shipments, milestone updates (optional **[Decision needed]**), document uploads, documents marked `agentVisible`. Portal user invitations and access removal by staff. Multiple users per customer company.

**C. Database.** Existing: `User.partyId` (set only for portal accounts **[Verified]**), `customer` role with `portal.own.view`, `Document.customerVisible`. **Proposed:** an `agent` role and `portal.agent.view`/`portal.agent.update` permissions (seed data); `Document.agentVisible` (Phase 5 proposal); optional `PortalInvitation` (party, email, hashed token, expiry, accepted at). Which delay details customers may see **[Decision needed]**.

**D. Backend.** Module `PortalModule` with **separate routes** `/api/portal/...` (for example `GET /api/portal/shipments`, `/api/portal/shipments/:reference`, `/api/portal/documents/:id/file`, `/api/portal/invoices`, `/api/portal/statement`) whose services always filter by the caller's `partyId` (customer: `customerId = partyId`; agent: `agentId = partyId`). Staff endpoints refuse portal users entirely (the guard checks for `partyId`). Staff endpoints to invite and remove portal users. Rate limiting on portal sign-in.

**E. Frontend.** No portal UI exists. A new area (for example `/portal`, with its own layout and sign-in) or a separate app **[Decision needed]**. Reuses components where possible.

**F. Security.** The highest data-exposure risk: one wrong filter shows one customer's data to another. Mitigations: dedicated portal services (never reuse staff queries without scoping), automated tests that try every portal endpoint with another party's ids (must return 404, not 403, to avoid revealing existence), minimal fields in responses (no internal notes, no costs or margins), audit portal downloads, review under the Kenya Data Protection Act 2019 (legal advice) **[External]**.

**G. Testing.** End-to-end: for each endpoint, own records visible, other parties' records invisible (by id guessing), staff endpoints 403/401 for portal users, hidden fields absent. Browser: customer and agent journeys. Manual security review before enabling for real users.

**H. Dependencies.** Needs 3B, 4, 5, 8 (accounts), 10, 11; 12 for portal notices; email (16) for invitations, or manual invitations first.

**I. Completion criteria.** [ ] Portals live on fictional data · [ ] cross-party access tests pass for every endpoint · [ ] security review done · [ ] checks run and recorded.

---

### Phase 15 — Security hardening, backups and operational readiness · **Not started**

**A. Overview.** Before real client data or real users arrive, the system must withstand attacks and mistakes, keep working, and be recoverable. Some items can be done earlier, between other phases.

**B. Features.**
1. **HTTP hardening:** security headers (`helmet`, a new dependency **[Decision needed]**), request size limits, strict CORS per environment (already configurable through `CORS_ORIGINS` **[Verified]**).
2. **Shared rate limiting** for login and portal endpoints (replacing the in-memory per-process limit) **[Decision needed]** on the library and store.
3. **Structured logging** with request ids, no secrets or personal data in logs, error alerts.
4. **Health and readiness:** `/health` extended to check the database (without exposing details).
5. **CI** (for example GitHub Actions: `tsc`, lint, unit tests, end-to-end tests against a throwaway PostgreSQL, builds) **[Decision needed]**.
6. **Repository hygiene:** `.gitattributes` for line endings (known Prettier drift, `CLAUDE.md` §12 item 9); `npm audit` review; decision on Prisma 8 RC versus stable and removal of the unused `@prisma/client` 7; removal or protection of the `deploy` script (`nest deploy`, possibly paid) **[Decision needed]**.
7. **Backups:** automated PostgreSQL backups, encrypted, off-site; object-storage backups or versioning; a **tested restore** procedure with recorded results.
8. **Retention and legal hold:** a documented process for the 5-year retention; no automatic deletion **[Requirement]**; legal-hold reports.
9. **Audit integrity:** `AuditLog` append-only (no update or delete endpoint; optionally database permissions that forbid it).
10. **Secrets management** for production (`JWT_SECRET`, database, storage, integrations), rotation procedure.
11. **Security review:** OWASP-style review of every endpoint, especially authorisation, file handling, portals and finance; dependency review.
12. **Data protection:** Kenya Data Protection Act 2019 obligations (lawful basis, data-subject requests, breach notification, possible registration with the Data Commissioner) — **needs legal advice [External]**.

**C. Database.** Possibly a dedicated read-only database role for reports and a restricted role for the application (no `DROP`, no `UPDATE/DELETE` on `AuditLog`). No business tables.

**D. Backend.** `LoggingModule`/interceptor, `helmet` and limiter setup in `src/app.setup.ts`, health indicator, CI workflow files, backup scripts or provider configuration (documented).

**E. Frontend.** Security headers and content security policy in Next.js (read `node_modules/next/dist/docs/` first); all remaining demo pages either live behind sign-in or removed from production.

**F. Security.** This phase is security.

**G. Testing.** Header checks, rate-limit tests, log redaction tests, a restore drill on a non-production copy (recorded), CI green on a PR, dependency audit with no unresolved high-severity issues (or documented exceptions).

**H. Dependencies.** Best after 0–11; must finish before 17 and 18. Parts (CI, `.gitattributes`, `deploy` script decision) can be done any time with approval.

**I. Completion criteria.** [ ] Hardening in place and tested · [ ] CI running · [ ] backup and restore drill recorded · [ ] security review findings fixed or accepted in writing · [ ] data-protection advice received.

---

### Phase 16 — External integrations · **Not started; not authorized**

**A. Overview.** Connecting to outside systems so staff stop retyping data. Each integration is a separate sub-phase with its own approval, because each needs accounts, credentials, legal or commercial agreements, and a sandbox. **None of these accounts or credentials are confirmed [External].** Every integration keeps the **manual workflow** from its base phase as the fallback.

**B. Integrations.**

| Integration | Purpose | Base phase and manual fallback | What is needed first |
|---|---|---|---|
| **KRA eTIMS** | Transmit invoices and credit notes to KRA and record the KRA reference | 10: staff use the company's current eTIMS channel and record the reference | Which eTIMS solution the company is registered for; KRA technical documentation and sandbox; credentials; possibly a certified integrator. **[External, Decision needed]** |
| **KRA iCMS** | Declarations, assessments and release status | 6: staff lodge in iCMS directly and record numbers and amounts | Whether any API or data exchange is available to the company as a licensed clearing agent; accreditation; credentials. Possibly not available at all. **[External]** |
| **Email** | Send quotations, invoices, statements, delay notices, portal invitations, password resets | Staff send from their own mail and record "sent" manually | Provider, sender domain with SPF/DKIM, templates, consent for customer messages. **[Decision needed]** |
| **SMS** | Short delay or arrival notices | Phone calls, recorded manually | Provider, sender ID registration, costs, consent. **[Decision needed]** |
| **Bank data** | Statement import or bank API for reconciliation | 11: manual reconciliation or CSV import | Bank, file format or API access. **[External]** |
| **M-Pesa (Safaricom Daraja)** | Customer payments via paybill/till | **Out of scope** (owner, 2026-10-26). Only if reinstated: manual recording first | Paybill or till number, Daraja credentials, a public HTTPS callback URL, reconciliation rules. **[Decision needed, External]** |

**C. Database.** **Proposed:** `IntegrationLog` (system, direction, entity, request summary, response summary, status, attempts, timestamps; no secrets); `MessageOutbox` (Phase 12 proposal) for email/SMS; `EtimsSubmission` (Phase 10 proposal); M-Pesa fields and a `PaymentMethod` value only if reinstated.

**D. Backend.** One module per integration behind an interface (`EtimsClient`, `IcmsClient`, `MailSender`, `SmsSender`, `BankImporter`), with a fake implementation for tests and development; an outbox with retries and back-off; webhook/callback endpoints (public but verified by signature or IP allow-list, idempotent by external id). Credentials only from environment or a secrets manager.

**E. Frontend.** Status shown from the integration's confirmed result only (never "sent" or "submitted" without it); retry buttons for failures.

**F. Security.** Credentials never committed or logged; callbacks verified; idempotency so a repeated callback cannot double-record a payment; audit every external submission.

**G. Testing.** Against fakes in CI; against the provider's sandbox manually, with recorded results; failure and retry scenarios; no production credentials in tests.

**H. Dependencies.** eTIMS needs 10; iCMS needs 6; email/SMS need 12; bank needs 11; M-Pesa needs 11 and a scope decision. All need external accounts.

**I. Completion criteria (per integration).** [ ] Access and credentials obtained legitimately · [ ] sandbox tests recorded · [ ] fallback still works · [ ] owner sign-off before enabling in production.

---

### Phase 17 — Client data import · **Not started** (approved plan's "Phase 5")

**A. Overview.** Moving the client's real records (customers, partners, open shipments, open invoices and balances, documents if any) into the system before launch. Real data enters **only** in this phase, on approved infrastructure **[Requirement]**.

**B. Features.** Source review (spreadsheets, old system exports); mapping to tables; validation reports (missing KRA PINs, duplicates, invalid container numbers); import scripts that are repeatable and idempotent; dry runs on a non-production copy; reconciliation with the client (record counts, opening balances agreed by finance); handling of existing reference numbers (imported as-is) and counters set to continue after them; document import into private storage.

**C. Database.** Possibly a temporary `ImportBatch` table (source, file, run time, counts, errors) and an `importedFrom` note on records **[Proposed]**. Opening balances: as imported invoices or a dedicated opening-balance record **[Decision needed]** with the accountant.

**D. Backend.** CLI scripts in `src/import/` (like the seed scripts), refusing to run against development or test databases by mistake; a validation-only mode.

**E. Frontend.** None, except an import report page if useful.

**F. Security.** Real personal and financial data: approved infrastructure only, encrypted transfer, no copies on laptops beyond what is approved, no real data in tests, screenshots or commits; access log of who handled the files.

**G. Testing.** Dry runs with full reconciliation reports; spot checks by the client; balances match the client's figures.

**H. Dependencies.** Needs every phase whose data is imported, Phase 15, and the production environment from 18 (or a staging copy).

**I. Completion criteria.** [ ] Dry run reconciled and signed off by the client · [ ] final import reconciled · [ ] counters continue correctly · [ ] source files handled as agreed.

---

### Phase 18 — Deployment and production launch · **Not started; not authorized**

**A. Overview.** Running the system for real users: hosting, a production database, private object storage, domain and TLS, monitoring, and a go-live plan.

**B. Features.** Hosting choice for the NestJS API and the Next.js app **[Decision needed]** (cost, region, data location, support); staging and production environments; managed PostgreSQL with backups; object storage; secrets; domain and HTTPS; applying migrations in production (`prisma db migrate`, reviewed); running `db:seed` for roles, permissions and the first admin (not the demo seed, which refuses production **[Verified]**); monitoring and alerts; runbook (start, stop, roll back, restore); user acceptance testing with the client; staff training; launch checklist; post-launch support.

**C. Database.** No schema change; a production database created and migrated from empty (path proven on the test database **[Verified, 2026-11-03]**).

**D. Backend.** Deployment configuration (container or platform files) **[Decision needed]**. **Never run `npm run deploy`** (`nest deploy`, NestJS Mau, possibly paid) unless the owner explicitly decides to use that service.

**E. Frontend.** Production build and environment variables (`NEXT_PUBLIC_API_URL`, backend URL), demo banner and demo data removed from production.

**F. Security.** Production access limited to named people; MFA on hosting accounts; no shared passwords; incident contact list.

**G. Testing.** Smoke tests on staging and production; user acceptance sign-off; restore drill on staging; load check with expected volumes.

**H. Dependencies.** Needs 15 and 17 (and all phases in the launch scope). Hosting accounts and budget **[External, Decision needed]**.

**I. Completion criteria.** [ ] Client sign-off of acceptance testing · [ ] production secured, monitored and backed up · [ ] rollback and restore procedures tested · [ ] go-live recorded in `CLAUDE.md`.

---

## 5. Overall development sequence

### 5.1 Why this order
1. **Records before the records that point to them.** Customers (1) → quotations and bookings (2) → shipments (3A) → tracking (3B). Every later module references a shipment.
2. **Operations before money.** Documents (5), customs (6) and transport (7) follow the physical workflow. Expenses (9) come before invoicing (10) because invoices re-bill disbursements; invoicing comes before payments (11) because payments are allocated to invoices.
3. **Administration in time for finance.** User management and company settings (8) are needed before invoices can carry the company's details, and before portals create accounts.
4. **Cross-cutting features last.** Notifications (12) and reports (13) need data from the earlier phases; portals (14) expose earlier data to outsiders, so they come once that data and its permissions are stable.
5. **Hardening, integrations, import and launch at the end,** because real data and real external systems are the most risky and need decisions and accounts that do not exist yet.
6. **This matches the approved plan** (0 → 1 → 2 → 3) and only adds detail and order to its Phase 4 and 5.

### 5.2 Can be done in parallel (independent code, with care over merge order)
- **Phase 4** (partners) alongside 2 or 3 (only `Shipment.agentRouteId` touches shared tables).
- **Phase 8** (users, settings, audit viewer) any time after 0.
- **Phase 15 items** (CI, `.gitattributes`, `deploy` script decision, logging) any time, with approval.
- **Phase 13** reports, one report at a time after each data phase.
- **Phase 5** storage adapter can start once its storage decision is made, alongside 3B.
- With two contributors, a sensible split is one on the main chain (2 → 3A → 3B → 5 → 6 …) and one on 4 and 8.

### 5.3 Must come first
0 and 1 (done), then 2 and 3A. Nothing operational can go live without shipments.

### 5.4 Phases with external integrations
Only **16** (eTIMS, iCMS, email, SMS, bank, M-Pesa if reinstated) and the production services in **5** (storage, scanner) and **18** (hosting). Phases 6, 10 and 11 are designed to work fully **without** integrations through manual workflows.

### 5.5 Most technically difficult
- **10 Invoicing:** tax rules, immutability, numbering, eTIMS alignment.
- **11 Payments:** allocation under concurrency, bounced-cheque reversal, reconciliation.
- **5 Documents:** streaming uploads, private storage, scanning, consistency between files and rows.
- **14 Portals:** correct scoping on every query.
- **16 Integrations:** external APIs, retries, idempotency, unclear access.
- **17 Data import:** messy source data and reconciliation.

### 5.6 Greatest security or financial risk
- **Financial:** 10, 11 (wrong balances, altered invoices, double allocation), 9 (unapproved costs), 2 and 10 (credit override abuse).
- **Data exposure:** 14 (cross-customer leaks), 5 (documents), 8 (privilege changes), 17 and 18 (real data, production access).

### 5.7 Minimum usable backend
- **Internal operations MVP — Phases 0–3B and 5:** staff sign in; manage customers; quote, book, open jobs in all modes; track milestones and delays; store documents. This replaces the browser-only demo for day-to-day operations.
- **Minimum for the full money cycle — add 6, 8, 9, 10, 11** (with manual iCMS and eTIMS workflows): customs, expenses, invoices, payments and balances.
- **Launch** additionally needs 15, 17 and 18.

### 5.8 Fully completed system
All phases 0–18: the whole workflow from quotation to reconciliation in one audited system; portals for customers and agents; server-generated notifications and reminders; management reports; integrations with eTIMS, iCMS (if available), email, SMS and the bank where approved; hardened, backed-up production hosting with the client's real data imported.

### 5.9 Recommended first phase to implement
**Phase 2 — Quotations and bookings**, once explicitly approved. Reasons: it is the next phase in the approved plan and the owner's 2026-11-16 instruction; it needs no schema change; it builds on Phases 0 and 1 directly; it closes Phase 1's archived-customer gap for new work; it creates the bookings that Phase 3A needs.

Before Phase 2 starts **[Proposed]**:
1. Set up the collaborator's clone for backend work (Node 24.20.0, `npm ci`, `.env` keys, local PostgreSQL, migrations, seeds; each database-writing step approved), and re-run the Phase 0/1 test suites to confirm a green baseline, recorded in `CLAUDE.md`.
2. Get answers to the Phase 2 decisions in §6 (at least: editing sent quotations, booking-confirmation permission, credit exposure definition, on-hold behaviour, rounding).
3. Agree the quotation and booking API shapes in `api-contracts.md`.

---

## 6. Decisions needed from the repository owner

Grouped by when they are needed. None has been answered yet.

**Before Phase 2**
1. Approve this roadmap (or parts), including the renumbering (old Phase 4 → 4–16, old Phase 5 → 17).
2. Review the four 2026-11-04 Phase 1 decisions (`CLAUDE.md` §9).
3. Can a `sent` quotation be edited, or must it be duplicated? (Approved plan: editable; frontend contract: not.)
4. Who confirms bookings? (Proposal: new `bookings.manage` for operations, sales, admin.)
5. Credit exposure definition at booking (proposal in Phase 2 §C).
6. Do `on_hold` or `closed` customers block new quotations and bookings?
7. Line rounding rule for VAT (accountant).
8. Identifiers in URLs: references for referenced records (proposal) versus numeric ids.
9. Stale-update policy (optimistic check versus last save wins) per record type.

**Before Phase 3A/3B**
10. FCL/LCL: add `loadType` and its values.
11. Add `cancelled` to shipment status.
12. Shipper and consignee fields.
13. One or two agents per shipment.
14. LCL consolidation in scope or not.
15. Default milestones: fixed in code or editable data.

**Before Phases 4–8**
16. Partner archive rules; supplier payment terms.
17. Storage provider, region and budget; virus scanner; file size limits; removal rules for wrong files.
18. A `documentation` role? New document permission codes.
19. Customs item lines (HS codes) and duty estimates: wanted or not.
20. Whether release by customs moves the shipment to `released` automatically; whether transport delivery sets the shipment `delivered`.
21. Warehouse/storage operations in scope or not.
22. Token revocation approach; temporary-password flow; who edits the permission matrix.

**Before Phases 9–11**
23. Profitability definitions (disbursements in or out of revenue and cost).
24. Expense recording and approval rights; self-approval rule.
25. Supplementary invoice flag (`Invoice.kind`); invoice numbering at creation or at issue.
26. VAT rules and tax defaults (accountant review — already open).
27. Server PDF generation (new dependency) or browser print.
28. Second approval for large credit notes or allocation reversals.
29. M-Pesa: stays out of scope (owner, 2026-10-26) or reinstated — the brief for this roadmap lists it.
30. Withholding tax/VAT deductions on customer payments.
31. Bank-statement import.

**Before Phases 12–18**
32. Scheduler approach (`@nestjs/schedule` or external cron); reminder escalation rules.
33. Report definitions (on-time, ageing buckets, profitability).
34. Portal scope: what customers and agents may see and do; portal UI inside the app or separate.
35. `helmet`, rate-limiter library and store; CI provider; Prisma RC versus stable; unused `@prisma/client` 7; the `deploy` script.
36. Hosting, environments and budget; email/SMS providers.
37. Opening balances approach for the data import.

## 7. External dependencies (all unconfirmed)

| Dependency | Needed for | Status |
|---|---|---|
| KRA eTIMS access, method and documentation | 10 (manual works without it), 16 | Unknown which eTIMS solution the company uses |
| KRA iCMS access or accreditation | 16 only (6 works manually) | Unknown; may not be available |
| Company accountant / tax adviser | 2, 9, 10, 11 (VAT, rounding, profitability, withholding, opening balances) | Not engaged in the project record |
| Private object storage provider | 5, 18 | Not chosen |
| Virus-scanning service or engine | 5 | Not chosen |
| Email provider and sender domain | 12, 14, 16 | Not chosen |
| SMS provider and sender ID | 16 | Not chosen |
| Bank statement format or API | 11, 16 | Unknown |
| Safaricom Daraja (M-Pesa) | Only if M-Pesa is reinstated | Removed from scope 2026-10-26 |
| Legal advice on the Kenya Data Protection Act 2019 | 14, 15, 17 | Not obtained |
| Hosting account and budget | 18 | Not chosen; deployment not authorized |
| The client's source data | 17 | Not received (fictional data only until then) |
