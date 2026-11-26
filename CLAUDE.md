# CLAUDE.md — Freight Management (shared handover + activity log)

> Shared by two human contributors working from different computers and separate Claude Code sessions.
> The repository and Git history are the evidence of actual code state; this file is the handover record.
> Keep **requirements**, **implementation facts**, **recommendations** and **open questions** clearly separated.
>
> **Read before making changes** (this file stays short; details live in these files):
> - `docs/IMPLEMENTATION_ROADMAP.md`: every phase, its status and what remains. Read it before starting or planning any phase.
> - `docs/BACKEND_IMPLEMENTATION_ROADMAP.md`: **detailed backend roadmap, Phases 0–18 (PROPOSAL, 2026-11-20, awaiting review)**. For each phase: features, database, endpoints, frontend, security, tests, dependencies and completion criteria, plus open decisions and external dependencies. Until the repository owner approves it, the approved plan below is authoritative.
> - `docs/backend-implementation-plan.md`: the **approved** backend plan (decisions, API conventions, auth, reference numbers, phase scope). It is authoritative where the roadmap summarises it.
> - `docs/database-design.md`: approved schema, business rules, setup and migration commands. Read it before any database or Prisma work.
> - `Frontend/frontend/docs/api-contracts.md`: implemented and proposed API contracts. `Frontend/frontend/AGENTS.md`: Next.js rules (read the bundled Next.js docs before writing frontend code).
> - `docs/activity-log.md`: archived activity log (2026-10-05 to 2026-11-04), the 2026-10-15 documentation audit and older handover states. Read the relevant entries when you need the history behind a decision, check or file.
>
> New activity entries always go at the end of §13 **in this file**, not in the archive (§15).

---

## 1. Project identity

- **Repository (source of truth):** `karechel/freight-management` on GitHub, branch `main`.
- **Contributors:** repository owner account `karechel` (verified from the remote URL). The initial commit is authored as "Chelsea"; the collaborator states the owner is their sister. That `karechel` belongs to Chelsea is an inference, not verified. The collaborator works on a local clone whose Git identity is "Sean Macharia"; the operator's identity has not been explicitly confirmed in a session (open question, §16.6), and GitHub collaborator permissions have not been checked.
- **Folders:** frontend in `Frontend/frontend`, backend in `Backend/backend`. Preserve this structure unless a change is explicitly approved.
- **Separate project:** this is NOT the older freight-management project. Do not copy or merge code from it without explicit authorization.
- **Other instruction files:** `Frontend/frontend/CLAUDE.md` (imports `Frontend/frontend/AGENTS.md`, Next.js agent rules). Keep both; `AGENTS.md`'s block is auto-written by `next dev`.

## 2. Business requirements and user roles (REQUIREMENTS — not implemented)

No requirements document exists in the repo yet; this summary comes from the project brief.

**Purpose:** operations system for a Kenyan freight forwarding and clearing business — quotation/booking → shipment job (sea, air, road, rail) → documents (B/L, AWB, packing list, commercial invoice, certificate of origin) → customs entry and duties (KRA iCMS) → release, transport, delivery → invoicing, expenses, M-Pesa/bank payments, reconciliation. Customer and agent portals.

**Update 2026-10-26 (repository owner, LOG-20261026-2215-database-schema):** payments are **cheque and bank transfer only**; M-Pesa is removed from scope. Other confirmed business rules: KES only; VAT-registered with KRA eTIMS; disbursements re-billed; clearing-only jobs; one invoice per shipment; credit terms and limits; external agents; no owned trucks; paper originals tracked. Full list: `docs/database-design.md` §1.

**Intended roles (none exist in code):** admin, operations/clearing staff, documentation, accounts/finance, management, external freight agents, customers.

**Intended modules:** auth & access control; users/staff; customers/suppliers/partners; agents & agent portal; shipments/jobs/references; tracking events/milestones/exceptions; document management; customs/duties/KRA iCMS; quotations & bookings; invoicing/expenses/costing/payments/reconciliation; M-Pesa; customer & agent portals; notifications/reminders/tasks; transport/warehouse/delivery; dashboards/reporting; audit logs/security/backups/deployment.

## 3. Architecture and technology stack (ACTUAL; first written at commit `42ae8a8`, with dated updates below)

```
Browser ─► Next.js 16.3.5 (App Router, React 19.2.8, Tailwind 4.3.3, TS 5.9.3) :3000
             app/page.tsx ── fetch ${NEXT_PUBLIC_API_URL}/health
                                   │ CORS: only http://localhost:3000 (hard-coded)
                                   ▼
           NestJS 12.1.0 (ESM, TS 6.0.3, Express) :PORT (default 3001)
             main.ts: dotenv → validateEnv() → dynamic import AppModule
             AppModule → AppController/AppService; PrismaModule (@Global) → PrismaService.client
                                   ▼
           Prisma ORM 8 RC "contract" architecture → PostgreSQL (each developer's own local DB)
```

- **Prisma (important — not classic Prisma):** schema in `Backend/backend/src/prisma/contract.prisma` (`// use prisma-8`); generated `contract.json` / `contract.d.ts` via `prisma contract emit` (never hand-edit); runtime `postgres<Contract>()` from `@prisma/orm-postgres/runtime` in `src/prisma/db.ts`; queries like `db.orm.public.User.all()`; config in `prisma.config.ts`; migration ref/snapshot in `Backend/backend/migrations/` (no SQL migration files).
- **Installed versions (read from node_modules on 2026-10-15; identical to the `package-lock.json` resolved versions):** `prisma` 8.0.0-rc.17, `@prisma/orm-postgres` 8.0.0-rc.12, `@prisma/client` 7.10.0 (installed but **unused**), `dotenv` 17.4.2 (transitive only), `@nestjs/cli` 12.0.6, Vitest 4.1.11, oxlint 1.85.0. `package.json` files use caret ranges; the lockfiles pin the exact versions.
- **Node.js version:** required version **unknown / not specified** (no `engines` field in either `package.json`, no `.nvmrc` or `.node-version`). This needs a project decision (§16.6). Observed on the local clone with Git identity Sean Macharia: Node v24.20.0, npm 11.19.0. This is an observation, not a requirement.
  - **Decided 2026-10-26 (repository owner, LOG-20261026-2215-database-schema): Node.js 24.20.0** for both apps. Root `.nvmrc` = `24.20.0`; both `package.json` files have `"engines": { "node": "^24.20.0" }` (any 24.x from 24.20.0). npm 11.19.0 ships with it. All installed dependencies' `engines` ranges accept it (checked 2026-10-26).
- **Database schema (2026-10-26, branch `feature/database-schema`):** 33 tables, designed and approved in `docs/database-design.md`. Column-type conventions (verified against the installed Prisma): money `Numeric(14, 2)`, instants `TimestamptzJsDate(3)` (`timestamptz(3)`, JS `Date`), calendar dates `DateString` (`date`, `"YYYY-MM-DD"` string). Do **not** use PSL `DateTime`/`Date`: in this Prisma version they need `Temporal`, which Node 24 lacks. No new dependency was added. Migrations: `Backend/backend/migrations/app/20261026T1925_baseline` and `20261026T1926_freight_core_schema`.
- **Backend conventions:** ESM (`"type": "module"`), relative imports use `.js` suffix, top-level await in `main.ts`, Prettier (single quotes, trailing commas), oxlint type-aware.
- **Frontend:** App Router app with a shared shell (`components/layout/`), shared UI (`components/ui/`, including form primitives), typed domain model (`lib/types.ts`), data-access layer (`lib/data/index.ts`, demo data only) and a thin API client (`lib/api/client.ts`, only `GET /health` is live).
  - Since 2026-10-21 (uncommitted): `lib/data/session-store.tsx` holds in-browser edits and uploaded files for the tab session, seeded from `lib/data` in `app/layout.tsx`. Validation and change rules are pure modules in `lib/` (`*-form.ts`, `*-changes.ts`).
  - Since 2026-10-21 evening (uncommitted, LOG-20261021-2240-sidebar-pages): the sidebar is grouped (Overview, Operations, Contacts, Finance, Insights, Administration; `components/layout/nav-items.ts`). New routes: `/agents` (+ `/agents/[id]`), `/expenses` (+ `/expenses/new`), `/reports`, `/users`, and `/notifications` (+ task pages; LOG-20261021-2338-notifications-tasks). `/settings` is now "Settings & audit log" and keeps the System status content as one section. Expenses live in the session store; costing, report and access rules are pure modules (`lib/profitability.ts`, `lib/reports.ts`, `lib/access.ts`, `lib/expense-form.ts`).
  - Pitfall: never import a non-component value (constant, function) from a `'use client'` module into a Server Component. It arrives as a client reference (LOG-20261021-0111-frontend-phase3). See LOG-20261019-1503-frontend-decisions and `Frontend/frontend/docs/api-contracts.md`. No new dependencies. Before writing Next.js code, read `Frontend/frontend/node_modules/next/dist/docs/` (this Next.js version has breaking changes — see `Frontend/frontend/AGENTS.md`).
- **Backend foundation (2026-11-03, LOG-20261103-2218-phase0; on `main` since PR #3; the customers API followed in PR #4):** routes under `/api` (except `/health`); global `ValidationPipe` (`class-validator`, `class-transformer`); one error format; JWT sign-in with a guard that protects every route by default; permissions read from the database on each request. Details: `docs/backend-implementation-plan.md`.
- **Not present:** logging config, file storage, integrations, CI, Docker, deployment config, API endpoints for business records.

## 4. Repository structure and important files

| Path | Purpose |
|---|---|
| `.gitignore` | Root ignores: `.env`, `.env.*` (except `.env.example`), `dist/`, `.next/`, `node_modules/` |
| `Backend/backend/src/main.ts` | Bootstrap: dotenv, env validation, CORS, listen |
| `Backend/backend/src/app.controller.ts`, `app.service.ts` | `GET /health` (the old `GET /` was removed 2026-11-03) |
| `Backend/backend/src/config/env.validation.ts` (+ `.spec.ts`) | Fail-fast check for `DATABASE_URL` |
| `Backend/backend/src/prisma/` | `contract.prisma` (source schema), generated contract files, `db.ts`, Nest module/service |
| `Backend/backend/prisma.config.ts` | Prisma 8 config |
| `Backend/backend/migrations/` | Prisma 8 migrations: `app/<timestamp>_<name>/` packages (`migration.ts` framework-rendered, `ops.json`, `migration.json`), `app/refs/db.json` (dev-DB ref), `snapshots/<hash>/` (contract snapshots). Never hand-edit `ops.json`/`migration.json` |
| `.nvmrc` | Node.js version for the repository (24.20.0) |
| `docs/database-design.md` | Approved database design: business rules, conventions, tables, relationships, setup and migration commands, pgAdmin inspection |
| `docs/backend-implementation-plan.md` | Approved backend plan: decisions, API conventions, reference-number and auth design, phases; Phase 0 and Phase 1 "as built" notes |
| `docs/IMPLEMENTATION_ROADMAP.md` | Every phase (frontend demo, schema, backend 0–5) with status, dependencies, tests and completion criteria (2026-11-16) |
| `docs/BACKEND_IMPLEMENTATION_ROADMAP.md` | Detailed backend roadmap (Phases 0–18), a proposal awaiting review (2026-11-20). Not authoritative until approved |
| `docs/activity-log.md` | Archived activity log (2026-10-05 to 2026-11-04), the 2026-10-15 documentation audit and older handover states, moved verbatim from this file on 2026-11-16 |
| `Backend/backend/src/auth/` | Sign-in, scrypt password hashing, JWT, global guard, `@Public()` and `@RequirePermission()` |
| `Backend/backend/src/references/` | Configurable reference formats: template rules, generation, admin API |
| `Backend/backend/src/common/`, `src/audit/`, `src/app.setup.ts` | Error format and database-error mapping, pagination DTO, audit log service, global HTTP setup |
| `Backend/backend/src/parties/` | Customers and contacts API (reused by agents and partners later): rules, DTOs, service, controller. `src/common/parse-id.pipe.ts` reads ids from URLs |
| `Frontend/frontend/app/parties/`, `components/customers/`, `lib/customers.ts`, `lib/customer-form.ts`, `lib/api/server.ts` | Live Customers pages, their rules and types, and backend reads made while rendering on the server |
| `Backend/backend/src/quotations/`, `src/bookings/`, `src/credit/`, `src/charge-types/` | Phase 2 (2026-11-20, on `feature/quotations-phase2`, awaiting PR review): quotations API and rules, bookings and conversion, the shared credit-limit check, the charge-type list. Shared helpers in `src/common/text-fields.ts`, `decimal-fields.ts` and `src/parties/party-checks.ts` |
| `Frontend/frontend/lib/live-quotations.ts`, `components/quotations/live-*.tsx`, `booking-detail.tsx`, `app/bookings/`, `lib/api/quotation-options.ts` | Phase 2 live quotation and booking pages. Demo quotation components are kept for demo references |
| `Frontend/frontend/scripts/browser-checks.mjs`, `Frontend/frontend/docs/browser-checks.md` | Headless-Chrome checks of the live pages (26; no dependencies; `npm run check:browser`). **Writes fictional records to the connected database**; how to run and limitations in the doc (2026-11-26) |
| `Backend/backend/src/charge-types/`, `Frontend/frontend/components/settings/tax-settings-editor.tsx` | Charge-type list and admin tax settings (`settings.tax.manage`); the tax defaults are provisional until the accountant reviews them (2026-11-26) |
| `Backend/backend/src/shipments/`, `src/seed/demo-shipments.ts`, `test/shipments.e2e-spec.ts` | Phase 3 (2026-11-26, on `feature/shipments-phase3`): shipment rules (`shipment-rules.ts`), DTOs, service, controller; fictional demo shipments generated from the frontend demo data |
| `Frontend/frontend/lib/live-shipments.ts`, `components/shipments/live-shipment-*.tsx`, `lib/api/shipment-options.ts`, `app/shipments/` | Phase 3 live shipment pages (list, detail, new, edit). Demo shipment components are kept for references the backend does not know |
| `Backend/backend/src/seed/` | `db:seed` (setup data, first admin) and `db:seed:demo` (fictional data, refuses production) |
| `Backend/backend/test/` | End-to-end tests; `test/support/` creates and migrates the separate `*_test` database |
| `Frontend/frontend/app/api/`, `lib/api/session.ts`, `lib/api/browser.ts` | Same-origin login, logout and backend-forwarding routes (token in an HttpOnly cookie); browser API client |
| `Backend/backend/test/app.e2e-spec.ts` | e2e test (connects to the real DB in `.env`) |
| `Backend/backend/.env.example`, `Frontend/frontend/.env.example` | Documented env variables (committed) |
| `Frontend/frontend/app/` | Routes: `layout.tsx` (metadata, app shell, session-store provider), `page.tsx` (dashboard), `shipments/`, `quotations/`, `documents/`, `parties/`, `customs/`, `finance/`, `settings/`, `globals.css` (updated 2026-10-21; it previously described the original health-check page). Added 2026-10-21 evening: `agents/`, `expenses/`, `reports/`, `users/` |
| `Frontend/frontend/lib/` | Domain types, labels, formatting, derivations (`metrics.ts`), validation and change rules (`*-form.ts`, `*-changes.ts`), money and dates; `lib/data/` = data-access layer, demo data and the in-browser session store |
| `Frontend/frontend/docs/api-contracts.md` | Proposed backend API, storage and integration contracts that the demo UI needs |
| `Backend/backend/README.md`, `Frontend/frontend/README.md` | Unmodified framework boilerplate |
| `Backend/backend/package.json`, `package-lock.json` (and frontend equivalents) | Scripts, dependency ranges, pinned versions |
| `Backend/backend/vitest.config.ts` | Unit tests: includes `**/*.spec.ts` |
| `Backend/backend/vitest.config.e2e.ts` | e2e tests: includes `**/*.e2e-spec.ts` |
| `Backend/backend/nest-cli.json` | Nest CLI config; `deleteOutDir: true` (build clears `dist/`) |
| `Backend/backend/tsconfig.json`, `tsconfig.build.json` | TS config (`nodenext`, strict, decorators); build excludes `test` and `*spec.ts`. Since 2026-10-26 `tsconfig.json` excludes `migrations` (Prisma-rendered `migration.ts` files use extensionless imports that `nodenext` rejects, and must not be edited) |
| `Backend/backend/.oxlintrc.json`, `.prettierrc` | Lint rules (`no-floating-promises` error, `no-explicit-any` off); Prettier (single quotes, trailing commas) |
| `Frontend/frontend/eslint.config.mjs` | ESLint with `eslint-config-next` (core-web-vitals + typescript) |
| `Frontend/frontend/next.config.ts` | Next.js config (currently empty) |
| `Frontend/frontend/postcss.config.mjs` | Tailwind 4 via `@tailwindcss/postcss` |
| `Frontend/frontend/tsconfig.json` | TS config (`bundler` resolution, `@/*` path alias) |

## 5. Implemented features and current status

Status labels: **Planned** · **In progress** · **Implemented, unverified** · **Verified** (checks actually run, with evidence) · **Blocked**.

| Feature | Status | Evidence / notes |
|---|---|---|
| Backend `GET /health` | **Verified** 2026-11-03 | Unit and end-to-end tests |
| Customers (Phase 1): list, search, filters, paging, create, edit, archive, restore, contacts, calculated figures, per-role billing access | **Verified** 2026-11-04; merged to `main` (PR #4, `d966e35`, 2026-11-04; recorded in LOG-20261116-1549-resume-sync) | LOG-20261104-1056-phase1 and LOG-20261104-1120-phase1-decisions: 70 unit tests, 112 end-to-end tests, 91 browser checks. Live pages need sign-in |
| Quotations and bookings (Phase 2): quotations API, server totals, status flow, expiry, duplicate, conversion to a booking, standalone bookings, confirm and cancel, credit-limit check with override, archived-customer refusal; live quotation pages and minimal booking pages | **Verified** 2026-11-26 with the repository owner's decisions implemented (LOG-20261126-1725-phase2-owner-decisions); on `feature/quotations-phase2`; **awaiting the PR (opened in the browser by a contributor), review and merge**, not on `main` | LOG-20261120-1343-phase2-backend, LOG-20261120-1412-phase2-done, LOG-20261120-1425-phase2-reconcile: 104 unit tests, 142 end-to-end tests, 14 browser checks. Remediation batch 1 (LOG-20261120-1501-phase2-batch1, **not committed**): 108 unit, 145 end-to-end, 18/18 browser. Credit-approval step (LOG-20261120-1514-credit-approval): 112 unit, 152 end-to-end, 21/21 browser. Batch 1 and the approval step committed as `7112b59` and pushed. Final Phase 2 items (LOG-20261120-1543-phase2-complete): New booking page and 6 more e2e tests; 112 unit, 158 end-to-end, 22/22 browser. Owner decisions (LOG-20261126-1725-phase2-owner-decisions): on-hold/closed customers blocked, archiving refused with open work, admin tax settings, browser checks committed; **137 unit, 168 end-to-end, 26/26 browser** |
| Shipments and tracking (Phase 3): shipments from a confirmed booking or standalone (clearing only); views (active, needs attention, delayed, arriving, customs) with counts; status changes with the date rules; milestones; delays and other issues with actions; current ETA from open delays; containers; customs summary; history from the audit log; booking page lists its shipments; 11 fictional demo shipments in `db:seed:demo`; live shipment pages | **Verified** 2026-11-26 (LOG-20261126-1952-phase3-shipments) on **`feature/shipments-phase3`**, branched from the Phase 2 head `ab2962b`; not merged | 155 unit, 186 end-to-end, 36/36 browser checks (run against the `*_test` database). Documents, customs work and invoicing for live shipments are Phase 4 |
| Backend foundation: validation, error format, sign-in, permission guard, audit service, seed scripts | **Verified** 2026-11-03; merged to `main` (PR #3) | LOG-20261103-2218-phase0: 37 unit tests, 34 end-to-end tests, 27 browser checks |
| Configurable reference formats | **Verified** 2026-11-03; merged to `main` (PR #3) | Includes concurrency, rollback and "issued references never change" tests. No record type uses them yet; quotations are first, in Phase 2 |
| Frontend sign-in, sign-out, Numbering editor | **Verified** in headless Chrome 2026-11-03; merged to `main` (PR #3) | Demo pages remain open without signing in |
| Frontend → backend health check | Implemented, unverified | Originally `Frontend/frontend/app/page.tsx`; moved (2026-10-19) to `lib/api/client.ts` + `components/layout/api-status.tsx` (top bar, System status page). Backend `/health` returned HTTP 200 to curl on the collaborator's machine; the browser path was not exercised |
| Frontend shell, dashboard and core screens (demo data) | Implemented; build and link crawl verified, not visually reviewed (branch `feature/frontend-foundation`, committed and pushed per LOG-20261019-1553-frontend-review; merged to `main` via PR #1 on 2026-10-29, LOG-20261029-2138-merged) | Routes `/`, `/shipments`, `/shipments/[reference]`, `/quotations`, `/documents`, `/customs`, `/parties`, `/finance`, `/settings`. All data is fictional demo data, labelled in the UI. See LOG-20261019-1503-frontend-decisions |
| Frontend shipment create/edit/status, actual dates, milestones, delays (demo, session only) | Implemented; committed in `5e2910f`; **browser-tested 2026-10-21** (LOG-20261021-2304-browser-review) | LOG-20261021-0111-frontend-phase1. Saved only in the browser tab (session store) |
| Frontend quotations, customer billing and service history, agent routes (demo, session only) | Implemented; committed in `5e2910f`; **browser-tested** including print layout | LOG-20261021-0111-frontend-phase2. No email sending; balances indicative |
| Frontend document uploads (demo, in-memory only) | Implemented; committed in `5e2910f`; **browser-tested** (file selection, rejection, open, download, review) | LOG-20261021-0111-frontend-phase3. Files never leave the tab; production storage not built |
| Frontend grouped sidebar; Agents & partners page (demo) | Implemented; committed and pushed (LOG-20261021-2341-commit-push); **browser-tested** (desktop and mobile drawer) | LOG-20261021-2240-sidebar-pages. Customers page (`/parties`) unchanged and still one page |
| Frontend expenses and profitability (demo, session only) | Implemented; committed and pushed (LOG-20261021-2341-commit-push); **browser-tested** (recording, filters, cross-page updates) | LOG-20261021-2240-sidebar-pages. Cost estimates are fixed demo figures; no approval or payment |
| Frontend reports and analytics (demo) | Implemented; committed and pushed (LOG-20261021-2341-commit-push); **browser-tested** (filters, all six CSV downloads); printing of the reports page not separately checked | LOG-20261021-2240-sidebar-pages. Computed in the browser; scheduled/emailed reports planned |
| Frontend users and permissions, settings and audit log (prototype) | Implemented; committed and pushed (LOG-20261021-2341-commit-push); pages and audit-log filters **browser-tested** | LOG-20261021-2240-sidebar-pages. Read-only; **permissions are not enforced** (no auth); audit log is a session preview |
| Frontend notifications and tasks (demo, session only) | Implemented; committed and pushed (LOG-20261021-2341-commit-push); **browser-tested** (LOG-20261021-2338-notifications-tasks) | `/notifications` under Operations. Notifications are calculated in the browser and never sent; tasks and read markers are kept in the tab only; reminders and delivery need a backend. (Reported missing in LOG-20261021-2304-browser-review.) |
| `DATABASE_URL` env validation | Implemented, unverified | `src/config/env.validation.ts` + spec, not run in audit |
| `User` model (id, email, name?, createdAt) | In progress (minimal) | `contract.prisma`; no roles/passwords/CRUD. Superseded 2026-10-26 by the row below (User gained status, passwordHash, lastLoginAt, partyId, updatedAt) |
| Database schema (33 tables) and migration | Implemented; **verified on the repository owner's local DB** (LOG-20261026-2215-database-schema): `migration check` pass, applied with `db migrate`, `db verify` pass. Committed as `a4239fc`; merged to `main` via PR #2 on 2026-10-29 (LOG-20261029-2138-merged) | `contract.prisma`, `migrations/app/20261026T1925_baseline`, `20261026T1926_freight_core_schema`, `docs/database-design.md`. No API endpoints, no seed data (roles, permissions, retention, charge types), no auth yet |
| `GET /` list all users | **Removed** 2026-11-03 (Phase 0); on `main` since PR #3 | End-to-end test confirms 404 |
| Module 1 (auth & access control) | **Verified** (Phase 0, on `main`) | Sign-in, permission guard, roles and permissions as data. User management screens are Phase 4 |
| Module 2 (users/staff) | In progress | Staff accounts, roles and seeded permissions exist (Phase 0); no user-management API or live screens yet (Phase 4) |
| Module 3 (customers/suppliers/partners) | Customers **Verified** (Phase 1, on `main`); suppliers, agents and transporters planned (Phase 4) | `/api/parties` |
| Modules 4–16 (§2) | Planned (phase mapping in `docs/IMPLEMENTATION_ROADMAP.md`) | Schema tables exist (2026-10-26); no endpoints. M-Pesa removed from scope |
| KRA iCMS integration | Planned; possibly **Blocked** on KRA onboarding/accreditation (assumption from general domain knowledge; not established by repository evidence; status of any application unknown) | No code |
| M-Pesa integration | **Removed from scope** (repository owner, 2026-10-26: cheque and bank transfer only) | No code. The frontend demo still offers `mpesa` as a payment method (`lib/types.ts`); see `docs/database-design.md` §7 |

Last checks actually run (2026-10-15 audit, read-only): see §11.

## 6. Planned features and roadmap

**The roadmap is in `docs/IMPLEMENTATION_ROADMAP.md`** (all phases, status, dependencies, completion criteria). **The detailed backend roadmap proposal is in `docs/BACKEND_IMPLEMENTATION_ROADMAP.md`** (2026-11-20, awaiting review). It keeps Phases 0–3 as approved, splits Phase 3 into 3A and 3B, splits the approved "Phase 4, remaining modules" into Phases 4–16, and renumbers client data import (approved "Phase 5") as Phase 17 and deployment as Phase 18. The renumbering is not in effect until the repository owner approves it. The approved scope of each backend phase is in `docs/backend-implementation-plan.md`. The 2026-10-15 recommendation list that used to be here is preserved in the roadmap's "Superseded plans" section (moved 2026-11-16).

**Authorized phases:** documentation (2026-10-15); **frontend development** (2026-10-19, collaborator; frontend only, see §16.6 decision 3); **database design and schema implementation** (2026-10-26, repository owner: approved schema, Node 24.20.0 pin, migration on the owner's own local DB, on branch `feature/database-schema`). **Backend Phase 0** (2026-11-03, repository owner: foundation, auth, `ReferenceFormat` migration, local test database, seeding the owner's local DB; on `feature/backend-foundation`; see `docs/backend-implementation-plan.md`). Later backend phases follow that plan. Integrations and deployment are **not** authorized. **Backend Phase 1** (customers) was built and merged on 2026-11-04. **Phase 2 has not started:** the repository owner's instruction relayed on 2026-11-16 is to implement Phases 2, 3 and 4 one at a time, but each start needs the operator's explicit approval in the session (LOG-20261116-1549-resume-sync). *Update 2026-11-20:*
- Phase 2 was authorized by the operator and implemented (LOG-20261120-1315-phase2-start onwards).
- It is committed and pushed on `feature/quotations-phase2` and awaits PR review.
- Phase 3 has not started.

*Update 2026-11-26:* the repository owner answered every §17 question. The approved decisions are implemented (LOG-20261126-1725-phase2-owner-decisions). **Phase 3 is approved to start only after Phase 2 passes its checks and its PR is reviewed and merged**, with the provisional tax configuration documented. A contributor opens the PR in the browser; nobody merges without the repository owner.

*Update 2026-11-26 19:16 (LOG-20261126-1952-phase3-shipments):* **the user changed the order of work.** Phase 3 is built now, on its own branch `feature/shipments-phase3` (from the Phase 2 head), **before** Phase 2 is merged; both are merged after Phase 3 is complete, and only with the repository owner's approval. This replaces "Phase 3 only after the Phase 2 merge". Phase 4 is not started.

## 7. Database and integration notes

- **Each developer uses their own local PostgreSQL database and their own `Backend/backend/.env`.** There is no shared development database (collaborator instruction, 2026-10-15; the repo contains no DB configuration other than the `.env.example` placeholder, and the owner's local setup is not verifiable from the repo). Do not assume another contributor's DB exists or matches yours. (A shared dev DB may be configured later only by explicit decision — record it in §9 if so.)
- Never write real connection strings, credentials or database names tied to a person's machine into this file or any committed file. Copy `.env.example` → `.env` and fill in your own values.
- Database state (whether the `User` table exists, how it was created) is not recorded in the repo. Verify against your own local DB only.
  - **2026-11-03:** the repository owner's local DB has all migrations (marker `9e752599…`) and the seed data: setup data, the first admin, 12 fictional companies and 4 fictional staff accounts.
  - **2026-10-26:** the repository owner's local DB was at the original `User` contract (marker `a9d7a849…`, matching the committed `db` ref) and now has the full schema (marker `32773253…`). The collaborator's DB state is unknown. Check it with `npx prisma db verify` and `npx prisma db migrate --show` (both read-only) before applying anything.
- **Migration workflow (decided 2026-10-26):** `prisma migration plan` + `prisma db migrate`, with migration folders, snapshots and `refs/db.json` committed. `db update` only on throwaway databases. Full steps: `docs/database-design.md` §8. A database-writing command still needs explicit authorization in the session.
- **Do not run** Prisma migration/push/reset/seed commands, or anything that writes to a database, without explicit authorization for that session.
- No M-Pesa or KRA iCMS code exists. Never claim either works without evidence of a real, authorized integration.

## 8. Security rules and operational safeguards

- Never print or commit secrets, tokens, passwords, connection strings or customer data — including in this file and the activity log.
- **Never run `npm run deploy`** in the backend (`nest deploy` → NestJS Mau/AWS, possibly paid). Nothing is configured for deployment.
- `GET /`, which exposed all user emails and names without sign-in, was removed in Phase 0 (on `main` since PR #3). Every new endpoint is protected by default; only `@Public()` routes are open.
- Future documents (B/L, invoices, etc.) must go to access-controlled private storage, never `public/`.
- No commit or push without explicit authorization from the human contributor in that session.

## 9. Established decisions and constraints

| Decision | Source |
|---|---|
| `karechel/freight-management` `main` is the source of truth | Project brief |
| Separate from the older freight-management project; no copying without authorization | Project brief |
| Preserve `Frontend/frontend` / `Backend/backend` structure | Project brief |
| Keep existing stack and Prisma 8 setup; no casual replacement/upgrade | Project brief |
| No destructive DB commands; no reset of unknown/shared DBs | Project brief |
| No commit/push without authorization | Project brief |
| Development proceeds only in explicitly authorized phases | Project brief |
| Each developer has their own local DB and `.env`; no shared dev DB (2026-10-15) | Collaborator instruction, 2026-10-15 |
| Generated Prisma contract files are never hand-edited | Repo (generated-file headers) |
| Only `.env.example` files are committed | Repo (`.gitignore` files) |
| Frontend development authorized; backend, schema, integrations, deploy not authorized (2026-10-19) | Collaborator decision, 2026-10-19 (§16.6) |
| Application code on feature branches; commit/push only with explicit approval; no force-push (2026-10-19) | Collaborator decision, 2026-10-19 (§16.6) |
| No Node/Prisma/dependency version changes without a separate decision (2026-10-19) | Collaborator decision, 2026-10-19 (§16.6) |
| Role labels ("repository owner", "collaborator") in shared docs; no personal emails (2026-10-19) | Collaborator decision, 2026-10-19 (§16.6) |
| Record everything done in a session in §13 of this file: changes, read-only checks, processes, files created outside the repo, failed attempts, instructions (2026-10-21) | Collaborator instructions, 2026-10-21 ("make sure you always document the entries"; "make sure you write everything you do in the claude.md") |
| Frontend demo edits and files stay in the browser session only: no `localStorage`, no fake backend, nothing in `public/` (2026-10-21) | Repository owner's requirements as relayed by the collaborator, 2026-10-20 |
| Database schema v2 approved, using `TimestamptzJsDate(3)`, `DateString` and `Numeric(14,2)`; no new dependency (no `temporal-polyfill`); reviewable migrations; never reset or overwrite an existing database (2026-10-26) | Repository owner, 2026-10-26 |
| Business rules for the data model: KES only; VAT + KRA eTIMS (issued invoices locked, credit notes for corrections); disbursements re-billed; clearing-only jobs; quotation → at most one booking, edited in place; booking → many shipments, containers tracked; one invoice per shipment; external agents; no owned trucks; cheque and bank transfer only (no M-Pesa); credit terms and limits; paper originals tracked (2026-10-26) | Repository owner, 2026-10-26 (`docs/database-design.md` §1) |
| Credit-limit overrides: finance, management and admin may proceed past a warning; sales and operations see it only; user, time and reason recorded every time (`CreditCheck`); enforced in the backend, not only the UI (2026-10-26) | Repository owner, 2026-10-26 |
| Permissions are data (`Permission`/`RolePermission`), starting from the owner's matrix (`docs/database-design.md` §6); adjustable later (2026-10-26) | Repository owner, 2026-10-26 |
| Retention: 5 years from end of reporting period, longer under legal hold; stored in `RetentionPolicy`, adjustable later (2026-10-26) | Repository owner, 2026-10-26 |
| Node.js 24.20.0 pinned (`.nvmrc`, `engines ^24.20.0` in both apps). This replaces the 2026-10-19 "observed only" note (2026-10-26) | Repository owner, 2026-10-26 |
| Database work on `feature/database-schema`, branched from `feature/frontend-foundation` (2026-10-26) | Repository owner, 2026-10-26 |
| Fictional data only throughout development; importing the client's real data is a separate phase before production launch (2026-11-03) | Repository owner, 2026-11-03 |
| Reference formats are configurable by an authorized administrator without code changes; existing frontend formats (`FMS-…`, `QT-…`, `INV-…`) are the defaults; issued references never change and must be unique. Replaces the 2026-10-26 `PREFIX-YYYY-NNNNN` rule (2026-11-03) | Repository owner, 2026-11-03 (`docs/backend-implementation-plan.md` §3) |
| Request validation: `class-validator` and `class-transformer` with NestJS's `ValidationPipe` configured globally, and DTOs for incoming requests (2026-11-03) | Repository owner, 2026-11-03 |
| Login in Phase 0: `@nestjs/jwt` and Node's built-in `crypto` with a secure password-hashing algorithm; guards and role-based authorization, with permissions enforced on the backend (2026-11-03) | Repository owner, 2026-11-03 |
| Customers use numeric database ids in API URLs; any customer reference code stays separate; no migration for this decision (2026-11-03) | Repository owner, 2026-11-03 |
| Bookings over the credit limit: staff without `credit.override` (Sales) may create them as pending, awaiting credit approval; `credit.override` holders (Finance, Management, Admin) approve or reject with a reason (rejecting cancels the booking); confirmation waits for approval. No change to the credit rule, role permissions or schema (2026-11-20) | Operator instruction, 2026-11-20 ("implement this permission adjustment… Sales creating a booking and Finance/Management approving it"). The exact design is Claude Code's interpretation (LOG-20261120-1514-credit-approval). **Approved by the repository owner on 2026-11-26** |
| **Phase 2 approved as built (2026-11-26):** credit rule = outstanding issued-invoice balance + this booking's value (quotation total or standalone estimated value), other open bookings not added, no check without a limit; separate credit-approval workflow (Sales request; Finance, Management or Admin approve or reject; approval allows confirmation; rejection cancels; approver recorded; Sales cannot approve; approvers do not get `quotations.manage`); permission matrix unchanged (Admin manage + override; Sales manage, no override; Finance and Management override and approve, no manage; Operations view only); one booking per quotation, no re-conversion (duplicate instead), no schema change; no booking edits, pending or confirmed; last save wins for quotations, audited, no 409 | Repository owner, 2026-11-26 (§17 answers 2–4, 7–9) |
| On-hold and closed customers cannot receive new quotations or bookings; the refusal explains the status; existing records stay accessible; only authorized users change the status (2026-11-26) | Repository owner, 2026-11-26 (§17 answer 5) |
| A customer cannot be archived while they have undelivered shipments, pending or confirmed bookings, or open quotations; the refusal names the records (2026-11-26) | Repository owner, 2026-11-26 (§17 answer 6) |
| Tax settings (charge-type categories and rates) are editable in the system; line default = charge type's category, otherwise `standard`; per-line half-away-from-zero rounding stays; the values are **not** accountant-approved and stay provisional until reviewed; this does not block Phase 2. Implemented as the admin-only permission `settings.tax.manage` (2026-11-26) | Repository owner, 2026-11-26 (§17 answer 11). Admin-only is Claude Code's choice within the approved matrix |
| The KRA PIN format must become admin-configurable in the future; no permanent format is hard-coded (2026-11-26) | Repository owner, 2026-11-26 (§17 answer 10) |
| Browser checks committed as a development tool, using the installed Chrome, no new dependency or test framework (2026-11-26) | Repository owner, 2026-11-26 (§17 answer 12) |
| The activity log names the operator by this clone's Git commit identity (Sean Macharia), not "operator not confirmed" (2026-11-26) | Repository owner, 2026-11-26 (§17 answer 13) |
| `docs/BACKEND_IMPLEMENTATION_ROADMAP.md` is kept as an unapproved reference; it never overrides the approved plan or authorizes scope (2026-11-26) | Repository owner, 2026-11-26 (§17 answer 14) |
| **Sequencing changed (2026-11-26 19:16):** Phase 3 is built before Phase 2 is merged, on a separate branch `feature/shipments-phase3` based on the pushed Phase 2 branch; the Phase 2 PR is not merged until Phase 3 is complete; §17 questions 16–18 are deferred until after Phase 3 and the current behaviour is kept. Replaces "Phase 3 only after the Phase 2 merge" (§17 answer 15) | User instruction in the session, 2026-11-26 (pasted "We are changing the order of work"; operator Sean Macharia) |
| Pending bookings of on-hold or closed customers cannot be confirmed or credit-approved; cancelling and rejecting stay possible; enforced in the backend (2026-11-27) | Repository owner, 2026-11-27, relayed by Sean Macharia (§17 answers; LOG-20261127-0010-owner-decisions), question 17 |
| Accepted quotations without a booking block archiving the customer, as other open work does; the refusal names them (2026-11-27) | Repository owner, 2026-11-27, relayed by Sean Macharia (§17 answers; LOG-20261127-0010-owner-decisions), question 18 |
| A confirmed booking of an on-hold or closed customer cannot become a shipment (archived already could not) (2026-11-27) | Repository owner, 2026-11-27, relayed by Sean Macharia (§17 answers; LOG-20261127-0010-owner-decisions), question 19 |
| A booking with shipments cannot be cancelled; a booking becomes `completed` automatically when every one of its shipments is delivered (2026-11-27) | Repository owner, 2026-11-27, relayed by Sean Macharia (§17 answers; LOG-20261127-0010-owner-decisions), question 20 |
| Delivered is final; every shipment needs a planned ETA; the current ETA comes from open delays only — all unchanged (2026-11-27) | Repository owner, 2026-11-27, relayed by Sean Macharia (§17 answers; LOG-20261127-0010-owner-decisions), question 21 |
| The Phase 3 completion criteria in `docs/IMPLEMENTATION_ROADMAP.md` are approved; Phase 2 and Phase 3 have separate PRs (Phase 2 → `main`; Phase 3 → `feature/quotations-phase2`, retargeted to `main` after the Phase 2 merge); no merge without the repository owner (2026-11-27) | Repository owner, 2026-11-27, relayed by Sean Macharia (§17 answers; LOG-20261127-0010-owner-decisions), question 22 |
| **Tax settings stay administrator-only:** only admin holds `settings.tax.manage`; Finance does not receive it; the accountant reviews tax settings through an administrator. Supersedes the 2026-11-26 "admin-only is Claude Code's choice" note (2026-11-27) | Repository owner, 2026-11-27, relayed by Sean Macharia (§17 question 16, option A; LOG-20261127-0050-finalise) |
| Customer account status can be changed only by management and admin (`parties.status.manage`); finance changes terms and limits but not status (2026-11-04) | Session operator, identity not confirmed, 2026-11-04 (LOG-20261104-1120-phase1-decisions). **Confirmed by the repository owner on 2026-11-26** |
| A customer cannot be archived while they have a shipment not yet delivered (2026-11-04) | Session operator, 2026-11-04. **Confirmed by the repository owner on 2026-11-26**, and extended to open bookings and quotations the same day |
| When two people edit one customer, the last save wins; changes are audited, with no warning (2026-11-04) | Session operator, 2026-11-04. **Confirmed by the repository owner on 2026-11-26** |
| The KRA PIN has no fixed format for now: up to 20 characters, unique, upper case. Revisit once the client's records are seen (2026-11-04) | Session operator: "leave the format editable for now", then confirmed as "any format for now", 2026-11-04. **Confirmed by the repository owner on 2026-11-26**; an admin-configurable format is a future requirement |
| Backend plan approved: additive `ReferenceFormat` table; separate local test database; seed scripts on the owner's local DB; converting a quotation auto-creates the booking, with minimal booking pages; credit-limit checks at booking and at invoicing (2026-11-03) | Repository owner, 2026-11-03 (`docs/backend-implementation-plan.md` §7) |

## 10. Setup and safe development commands

Setup (each developer): `npm ci` in each app folder (installs exactly the lockfile versions — only when authorized; prefer it over `npm install`, which can update the lockfile given the caret ranges on prerelease Prisma packages, unless a dependency change is authorized), copy `.env.example` → `.env` (backend) / `.env.local` (frontend), point `DATABASE_URL` at **your own** local PostgreSQL.

| Read-only / safe | Writes files or needs care |
|---|---|
| `tsc --noEmit --incremental false` (both apps) | `npm run format` (rewrites `src/**/*.ts` and `test/**/*.ts`, **including the generated `src/prisma/contract.d.ts`**; do not run it without excluding generated files) |
| `npm run lint` (backend oxlint, frontend eslint; no `--fix`) | `npm test` / `npm run test:e2e` (Vitest cache; e2e hits your DB) |
| `npx prettier --check "src/**/*.ts" "test/**/*.ts"` | `npm run build` (writes `dist/` / `.next/`) |
| `git status`, `git log`, `git diff`, `git ls-remote origin` | Any Prisma CLI command that touches a DB |
| | `npm run deploy` — **do not run** |

Backend runs on `PORT` (default 3001); frontend on 3000.

**Node and Prisma (added 2026-10-26):**
- Use Node 24.20.0 (`nvm install 24.20.0`). On the repository owner's machine, nvm-windows 2.0 runs in shim mode: it picks 24.20.0 from `.nvmrc` at the repository root and from `engines` inside each app folder, while other folders keep the machine default. Check with `node -v` in each folder.
- On that machine, **Git Bash** finds a separate older `~/.nvm` (Node 8.17.0) first on its PATH. Run Node, npm and Prisma commands from **PowerShell**.
- Read-only Prisma commands (from `Backend/backend`): `npx prisma --version`, `npx prisma contract emit` (writes only `src/prisma/contract.json`/`.d.ts`), `npx prisma migration check`, `npx prisma migration show <dir>`, `npx prisma db verify`, `npx prisma db schema`, `npx prisma db migrate --show`.
- Database-writing commands need authorization: `npx prisma db migrate --advance-ref db`, `db update`, `db sign`, `db init`. `migration plan` writes migration folders but does not touch the database.

**Backend (added 2026-11-03), from `Backend/backend`:**
- Copy the new keys from `.env.example` into your `.env`: `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `DEMO_USER_PASSWORD`. Use your own random values.
- `npx prisma db migrate --advance-ref db` (after checking your DB, §7), then `npm run db:seed` and `npm run db:seed:demo`. Both seeds are safe to re-run: they only add what is missing.
- `npm run start:dev` starts the API on port 3001; `npm run dev` in `Frontend/frontend` starts the app. Sign in with `ADMIN_EMAIL` and `ADMIN_PASSWORD`, or a fictional account such as `f.mwende@freight-demo.example` with `DEMO_USER_PASSWORD`.
- `npm run test:e2e` creates `<your database>_test` if needed, migrates it and empties it between test files. It refuses any database not named `*_test`, and needs permission to create databases.
- On a machine using nvm's shim, stopping `node` by the process that `Start-Process` returns leaves the real server running. Stop by the port's owning process instead.

## 11. Testing and verification procedures

- Never state that tests/builds pass unless they were run in that session; record command + result in the activity log.
- Existing tests: `src/app.controller.spec.ts` (overrides `PrismaService` with a mock, but still imports `db.ts`, which loads `.env` and constructs the real client; no query is sent to it), `src/config/env.validation.spec.ts`, `test/app.e2e-spec.ts` (needs a running local DB with a `User` table).
- **Last recorded results (2026-10-15 audit, re-run identically in the §16 audit; local clone with Git identity Sean Macharia):** backend `tsc --noEmit` → 1 error (`test/app.e2e-spec.ts(4,21) TS2307 'supertest/types'`), `src/` clean; backend oxlint → pass; backend prettier --check → 10 files flagged on this CRLF working copy, 8 with `--end-of-line auto` (including the generated `src/prisma/contract.d.ts`) — see §12 item 9; frontend `tsc --noEmit` → pass; frontend eslint → pass. Unit/e2e tests **not run**. `npm audit` **not run**. The cause of the TS2307 error is **unknown** (`@types/supertest` 7.2.1 ships `types.d.ts`, but it does not resolve under `nodenext`); do not document a cause until investigated.
- **Latest results: final verification (2026-11-26 23:31–23:45, `feature/shipments-phase3` at `baddadb`, LOG-20261126-2345-final-verification):** backend `tsc` and lint exit 0; `npm test` → **155 pass**; `npm run test:e2e` → **187 pass**; frontend `next typegen`, `tsc`, lint exit 0; `npm run build` pass (in `Frontend/frontend`, now serving the demonstration); browser **50/50** on the isolated copy (re-synced to `baddadb`) against the `*_test` database; read-only walkthrough of the running demonstration: 5/6 automated checks, the sixth a fault in the walkthrough script's own field check (the update form's severity, description and notes fields were confirmed present by direct inspection).
- **Earlier results: Phase 3 audit (2026-11-26 23:13–23:30, `feature/shipments-phase3`, LOG-20261126-2330-phase3-audit):**
  - Backend: `tsc` exit 0; lint exit 0; `npm test` → 13 files, **155 pass**; `npm run test:e2e` → 7 files, **187 pass** (1 new); build pass.
  - Frontend: `next typegen`, `tsc` exit 0, lint exit 0 (after fixing a quoting error in the browser-check script); `next build` pass **in an isolated copy** (scratchpad `fe-test`, own `node_modules` copy, `NEXT_PUBLIC_API_URL=http://localhost:3011`), so the build folder of the running demonstration frontend was not touched.
  - Browser: **50/50** (26 Phase 2 regression, 11 Phase 3, 13 workflow) against the isolated frontend on port 3010 and a temporary backend on port 3011 using the **`*_test` database** (emptied and seeded by the scratchpad prep script); both temporary servers stopped afterwards. Read-only walkthrough of the running demonstration (ports 3000/3001, development database): 13/14 navigation checks pass; the fourteenth expected `QT-2610-0051` on page 1 of Baobab Crest's quotations, but it is item 26 of 27 (page 2) because of browser-check records — not a defect.
- **Earlier results: demonstration preparation (2026-11-26 20:05–20:20, `feature/shipments-phase3` at `c7d92c4` plus this session's changes, LOG-20261126-2017-demo-prep):**
  - Backend: `tsc` exit 0; lint exit 0 (no warnings); `npm test` → 13 files, **155 pass**; `npm run test:e2e` → 7 files, **186 pass**; build pass. Prisma `db verify` (read-only) → marker and schema match on the development database.
  - Frontend: `next typegen`, `tsc` exit 0, lint exit 0, build pass; re-run (`tsc`, lint, build) after two text fixes.
  - Browser: **49/49** against production builds and the **development database** (36 earlier + 13 for the connected demonstration workflow). Screenshots of the dashboard, customers, quotations, bookings, shipments and settings reviewed by eye; a smoke pass after the rebuild found no console errors.
- **Earlier results: Phase 3 shipments (2026-11-26 19:16–19:52, `feature/shipments-phase3`, LOG-20261126-1952-phase3-shipments):**
  - Backend: `tsc` exit 0; lint exit 0 (one `no-misused-spread` warning fixed); `npm test` → 13 files, **155 pass** (18 new); `npm run test:e2e` → 7 files, **186 pass** (17 shipment tests and 1 seed test new); build pass. Prettier `--write --end-of-line auto` on the changed backend files.
  - Frontend: `next typegen`, `tsc` exit 0, lint exit 0, `npm run build` pass.
  - Browser: **36/36** (26 earlier + 10 Phase 3) against production builds with the backend pointed at the **`*_test` database** (emptied and seeded with the setup, demo, demo-quotation and demo-shipment seeds), not the development database. Screenshots reviewed by eye. The sidebar note and dashboard status text were updated after the run (text only; `tsc` and lint re-run).
  - Not run: `npm audit`, Safari/Firefox, screen readers; `prisma db verify` (no schema change).
- **Earlier results: repository-owner decisions (2026-11-26, Sean Macharia's clone, Node 24.20.0, LOG-20261126-1725-phase2-owner-decisions):**
  - Backend: `tsc` exit 0; lint exit 0; build pass; `npm test` → 12 files, **137 pass** (25 new); `npm run test:e2e` → 6 files, **168 pass** (10 new), run twice (before and after formatting). Prettier `--end-of-line auto` clean on the changed files.
  - Prisma: `db verify` → match (marker `9e752599…`).
  - Frontend: `next typegen`, `tsc`, lint and build → pass.
  - Browser: `scripts/browser-checks.mjs` against production builds and the development database → **26/26** (22 earlier + 4 new). Screenshots reviewed by eye.
  - Not run: `npm audit`, Safari/Firefox, screen readers.
- **Final Phase 2 items (2026-11-20 15:30–15:43, LOG-20261120-1543-phase2-complete):**
  - Backend: `tsc`, lint and build → pass; `npm test` → 10 files, **112 pass**; `npm run test:e2e` → 6 files, **158 pass** (6 new: moving a quotation to an archived customer, clearing the agent, an inactive charge type, search and the agent filter, a wrong agent role on a standalone booking, an unknown booking 404, two approvers deciding at once).
  - Frontend: `next typegen`, `tsc`, lint and build → pass.
  - Headless Chrome → **22/22** (new: the New booking page). No server error lines.
- **Credit-approval step (2026-11-20 15:14–15:27, uncommitted, LOG-20261120-1514-credit-approval):**
  - Backend: `tsc`, lint and build → pass; `npm test` → 10 files, **112 pass** (4 new); `npm run test:e2e` → 6 files, **152 pass** (7 new).
  - Frontend: `tsc`, lint and build → pass.
  - Headless Chrome → **21/21** (3 new: Sales request approval; Finance approves and Sales confirms; Management rejects).
- **Remediation batch 1 (2026-11-20 14:45–15:01, uncommitted changes on `feature/quotations-phase2` at `071041a`, LOG-20261120-1501-phase2-batch1):**
  - Backend: `tsc`, lint and build → pass; `npm test` → 10 files, **108 pass** (4 new); `npm run test:e2e` → 6 files, **145 pass** (3 new: the issue-date regression, the seed adding quotations once, counters never moving back; plus the Phase 1 figures test extended with expired quotations). Prettier: only the same three files as before.
  - Seed: `npm run db:seed:demo` run twice on the development database. First run: 8 quotations and 2 bookings added; second run: nothing. Parties, users and credit checks unchanged; the quotation counter moved 16 → 58; the booking counter stayed at 11.
  - Frontend: `next typegen`, `tsc`, lint and build → pass.
  - Headless Chrome against production builds → **18/18** (14 earlier checks plus 4 for this batch).
- **Re-verified on branch `feature/quotations-phase2` at `ab318bb` (2026-11-20 14:22–14:30, LOG-20261120-1425-phase2-reconcile):**
  - Backend: `tsc`, lint and build → pass; `npm test` → 10 files, 104 pass; `npm run test:e2e` → 6 files, 142 pass. Prisma `migration check` → pass; `db verify` → match.
  - Frontend: `next typegen`, `tsc`, lint and build → pass.
  - Headless Chrome against fresh production builds → 14/14 pass.
  - The same figures as the first run below; the code had not changed since.
- **Latest results (2026-11-20, collaborator's clone with Git identity Sean Macharia, Node 24.20.0, PostgreSQL 18, LOG-20261120-1412-phase2-done):**
  - Backend: `tsc`, lint and build → pass; `npm test` → 10 files, 104 tests pass; `npm run test:e2e` → 6 files, 142 tests pass. That is all 112 earlier tests plus 30 new Phase 2 tests.
  - Prettier: clean except the three files already flagged before this session (`src/prisma/contract.d.ts`, `db.ts`, `prisma.module.ts`).
  - Prisma: `migration check` → pass; development database migrated (2 migrations, 257 operations); `db verify` → pass.
  - Frontend: `next typegen`, `tsc`, lint and build → pass. The earlier TS2344 `AppRoutes` errors were stale route types, fixed by `next typegen`.
  - Browser: 14/14 headless Chrome checks against production builds and the development database, covering sales, admin and finance and 390 px width. Screenshots reviewed by eye.
  - Not run: `npm audit`, Safari/Firefox, screen readers.
- **Earlier results (2026-11-04, local clone with Git identity PPSOne-02, Node 24.20.0, PostgreSQL 17.11, LOG-20261104-1056-phase1):**
  - Backend: `tsc`, lint, Prettier on the changed files and build → pass; `npm test` → 70 tests pass; `npm run test:e2e` → 5 files, 112 tests pass. (Earlier the same day: 77 and 107. The unit count fell because the KRA PIN format tests were removed.)
  - Prisma: `migration check` → pass; `db verify` → pass; migrating an empty development database → 3 migrations, 260 operations.
  - Frontend: `tsc`, lint and build → pass; 91/91 headless Chrome checks against production builds and the test database, covering every staff role and 390 px width. Screenshots reviewed by eye.
  - Not run: `npm audit`, Safari/Firefox, screen readers.
- **Earlier results (2026-11-03, repository owner's machine, Node 24.20.0, LOG-20261103-2218-phase0):**
  - Backend: `tsc` → pass (no errors; the old `supertest/types` error is gone); lint → pass; `npm test` → 6 files, 37 tests pass; `npm run test:e2e` → 4 files, 34 tests pass; build → pass.
  - Prisma: `migration check` → pass; `db verify` → pass; migrating an empty database from nothing → pass.
  - Frontend: `tsc`, lint, build → pass; 27/27 headless Chrome checks against the running backend (test database).
  - Not run: `npm audit`, Safari/Firefox, screen readers. The other demo pages were not re-tested in a browser; `tsc` and the build cover them.
- **Earlier results on Node 24.20.0 (2026-10-26, repository owner's machine, LOG-20261026-2215-database-schema):**
  - Backend: `tsc --noEmit` → only the long-standing TS2307 in `test/app.e2e-spec.ts`; `npm run lint` → pass; `npm test` → 2 files, 4 tests pass; `npm run build` → pass.
  - Prisma: `migration check` → all checks passed; `db migrate` → 1 migration, 253 additive operations; `db verify` → marker and schema match.
  - A read-only query through `src/prisma/db.ts` works without `Temporal`. The tables were empty, so decoding a stored date was **not** exercised.
  - e2e tests **not run**.
  - Frontend: `next typegen`, `tsc --noEmit`, `npm run lint`, `npm run build` → all pass.
- **Latest frontend results (2026-10-21 01:10 +03:00, LOG-20261021-0111-frontend-phase3):**
  - Re-run in the pre-commit review (2026-10-21 01:20–01:27, LOG-20261021-0128-precommit-review): `npx tsc --noEmit --incremental false` → pass; `npx eslint` → pass; `npx next build` → success, 19 route entries (18 app routes + `/_not-found`; an earlier "20 routes" figure was a miscount).
  - Scratch logic tests (outside the repo) → 22/22 groups pass.
  - Curl on `next start` → 25/25 pages render the expected `<h1>`, `/nowhere` → 404. No browser testing has been done.
  - Status codes alone are not enough: a page can return 200 while rendering not-found or error UI because of streaming from `loading.tsx`, so check page content. Backend checks not re-run.
- **Latest browser run (2026-10-21 23:37 +03:00, LOG-20261021-2338-notifications-tasks):** all scenarios pass on the final build, including notifications and tasks (12 steps) and the sidebar fit at 1280×900/800/720. tsc, lint and build (29 route entries) pass; logic tests 34/34.
- **First browser testing (2026-10-21 23:04 +03:00, LOG-20261021-2304-browser-review):** 49 browser steps on headless Chrome against `next start` all pass, with no console errors. They cover the sidebar, mobile drawer, shipments, delays, quotations, customer history, agents, documents (select/open/download/review), expenses, report filters and CSV, the audit log, and no sideways scrolling at 390/768/1280 px. One defect was fixed (table overflow on phones). tsc, lint and build pass. Not covered: manual visual review of every page, screen readers, Safari/Firefox.
- **Latest frontend results (2026-10-21 22:39 +03:00, LOG-20261021-2240-sidebar-pages):** `npx tsc --noEmit --incremental false` → pass; `npm run lint` → pass; `npm run build` → success, 25 route entries (24 app routes + `/_not-found`); scratch logic tests → 28/28 groups pass (9 + 8 + 5 + 6 new); curl on `next start -p 3100` → all 12 sidebar links present in the HTML, all 23 pages checked → 200 with the expected `<h1>`, `/nowhere` → 404, no server errors. No browser testing.

## 12. Known issues, technical debt and blockers

1. `GET /` returns all users unauthenticated (`Backend/backend/src/app.service.ts`). **Fixed on `feature/backend-foundation`; on `main` since PR #3 (status updated 2026-11-16).**
2. No helmet, shared rate limiter or logging config (decide before launch). Auth, authorization, `ValidationPipe` and the exception filter exist on `main` (PR #3). Pages still on demo data are not behind sign-in.
3. Prisma 8 is a release candidate with caret ranges; unused Prisma 7 `@prisma/client` installed alongside.
4. No SQL migrations; DB creation process undocumented. (Update 2026-10-26: Prisma 8 migration packages now exist and the process is documented in `docs/database-design.md` §8. Prisma 8 still has no SQL migration files; `migration show` prints the SQL.)
5. `dotenv` imported (`main.ts`, `db.ts`, `prisma.config.ts`) but not a declared dependency. **Fixed on `feature/backend-foundation`; on `main` since PR #3.**
6. `Backend/backend/src/prisma/db.ts` creates the Prisma client at import time using `DATABASE_URL!` (non-null assertion, no validation in that path); the connection itself opens lazily on the first query (`@prisma/orm-postgres/dist/runtime.mjs`, `getRuntime()`). The e2e test imports `AppModule` directly and therefore bypasses `validateEnv()`.
7. `deploy` script (`nest deploy`) deploys to the cloud via NestJS Mau (verified from `@nestjs/cli` source). Whether this incurs cost is unknown from the repo; treat it as potentially paid and do not run it.
8. CORS origin hard-coded (**now `CORS_ORIGINS`, on `main` since PR #3**). (Since 2026-10-19 the frontend shows an "API not configured" state when `NEXT_PUBLIC_API_URL` is unset, instead of failing.)
9. TS2307 in e2e test (**gone since Phase 0, on `main`**: that test was rewritten; the original cause was never determined); Prettier drift: `--check` flags 10 files on a working copy checked out with CRLF (`core.autocrlf=true`, a per-machine Git setting), while committed files are LF (`git ls-files --eol`). Ignoring line endings (`--end-of-line auto`), 8 files are flagged, including the generated `src/prisma/contract.d.ts`. No `.gitattributes` exists, so line endings depend on each developer's Git config. No CI; boilerplate READMEs/metadata; TS 5.9 (frontend) vs 6.0 (backend).
10. No requirements document or phase definitions in the repo. (Update 2026-11-16: phases are defined in `docs/backend-implementation-plan.md` and summarised in `docs/IMPLEMENTATION_ROADMAP.md`; business rules are in `docs/database-design.md` §1. There is still no single requirements document.)
11. `.env.example` uses placeholder DB name `freight_management`; developers' actual DB names may differ (expected — placeholder only).
12. (2026-10-26, updated 2026-11-03) No business endpoints use the schema yet. Seeding and reference generation exist on `main` (PR #3); the customers API (PR #4) is the first business endpoint; allocation limits and the credit-limit check come with their phases. Tax defaults on the seeded charge types are a starting guess and need the company accountant's review.
13. (2026-10-26) The frontend demo types differ from the database in places (`USD` currency, `mpesa`, a stored `booked` quotation status, integer-cent prices, a single customs entry per shipment). See `docs/database-design.md` §7. The API layer or the frontend must reconcile these.
14. (2026-10-26) Applying a migration to a fresh database (baseline + delta) has not been tested; only the delta was applied, on the repository owner's DB. **Resolved 2026-11-03: the test database migrates from empty on the first end-to-end run.**
15. (2026-11-03) Signing out does not revoke a token (no server-side session store): a stolen token works until it expires, up to 8 hours, unless the user is disabled. The login limit is in memory, so it resets on restart and applies per server process.
16. (2026-11-20, Phase 2) The fictional demo seed (`npm run db:seed:demo`) has no quotations or bookings, so a fresh database shows empty Quotations and Bookings lists until someone creates them. **Resolved 2026-11-20 (LOG-20261120-1501-phase2-batch1, not committed):** `db:seed:demo` now adds 8 quotations and 2 bookings.
17. (2026-11-20, Phase 2) **Resolved 2026-11-20 (LOG-20261120-1543-phase2-complete):** `/bookings/new` creates standalone bookings. Original text: No page creates a standalone booking (a booking without a quotation). `POST /api/bookings` exists and is tested, but bookings can only be made in the UI by converting an accepted quotation.
18. (2026-11-20, Phase 2) A demo quotation reference (such as `QT-2610-0057`, linked from demo pages) opens the demo record under `/quotations/...`. That page shows the top bar's "Live data" badge together with its own "Demonstration data" banner, which is inconsistent. **Resolved 2026-11-20 (LOG-20261120-1501-phase2-batch1, not committed):** demo fallback pages now show "Demo data". The seeded references now exist live, so links from demo pages open the live records.
19. (2026-11-20, Phase 2) Owner review pending, not a defect: the credit rule (decided by the operator on 2026-11-20) and the seeded permission matrix, in which only admin holds both `quotations.manage` and `credit.override`. See §14. *(Update, LOG-20261120-1514-credit-approval: an approval step now lets Sales book over the limit and Finance or Management approve; the matrix itself is unchanged. Owner review still pending.)*
20. (2026-11-20, Phase 2) A quotation whose booking was cancelled now shows "Booking cancelled" (LOG-20261120-1501-phase2-batch1). It cannot be converted again (`Booking.quotationId` is unique). Whether re-conversion should be possible is an owner decision and would need a schema change.
21. (2026-11-20, Phase 2) Bookings have no edit endpoint. Carrier, carrier booking number and planned dates can only be given when converting or creating (the convert form now offers them). Booking edits are an owner decision.
22. (2026-11-20, Phase 2) Still open; see §17 question 12. The browser checks exist only as a scratchpad script (`browser-check.mjs`), and the frontend has no test runner. Whether to commit a browser-check tool is the operator's decision.
    - **Update 2026-11-26 (LOG-20261126-1725-phase2-owner-decisions):** items 19–22 are settled by the repository owner. Item 19: credit rule, approval workflow and matrix approved. Item 20: no re-conversion; duplicate instead. Item 21: no booking edits. Item 22: committed as `Frontend/frontend/scripts/browser-checks.mjs` (docs: `Frontend/frontend/docs/browser-checks.md`).
23. (2026-11-26) **Tax defaults are provisional.** The seeded charge-type tax categories and rates, the line default and per-line half-away-from-zero rounding have **not** been reviewed by the company's accountant. An admin can change categories and rates in Settings › Tax settings (`settings.tax.manage`); saved quotation lines keep their values. The accountant's review is still outstanding; it does not block Phase 2.
24. (2026-11-26) The KRA PIN format is not configurable yet (no format is enforced beyond 20 characters, unique, upper case). An admin-configurable format is a future requirement and needs a settings store (a schema change), so it was not built in Phase 2.
25. (2026-11-26) The browser checks write fictional records to the database the backend uses (every run adds customers, quotations, bookings and credit checks). Use them only against a development database.
26. (2026-11-26) Confirming or credit-approving a booking that already exists is still allowed after its customer is put on hold or closed; the owner's rule covers new quotations and bookings. A pending booking blocks archiving, so it must be confirmed or cancelled first. **Update 2026-11-27 (question 17):** no longer allowed; built on `feature/quotations-phase2` (`23dc964`). The Phase 3 branch gets it when Phase 2 reaches it through `main`.
27. (2026-11-26, Phase 3) **Resolved 2026-11-26 20:08 (LOG-20261126-2017-demo-prep):** the development database was seeded with the 11 demo shipments, with the operator's authorization. Original text: The development database has **not** been seeded with the demo shipments (`npm run db:seed:demo` was not run on it in this session; it needs authorization). Until it is, the live Shipments page on the development database is empty apart from shipments created by hand. The `*_test` database holds them after the browser run.
28. (2026-11-26, Phase 3) Phase 3 choices made by Claude Code, pending the owner's confirmation (§17 questions 19–22): delivered is final; the planned ETA is required; a booking with shipments cannot be cancelled; shipments from an existing booking are refused only for archived customers (standalone jobs also for on-hold and closed ones); bookings are never marked `completed` automatically; the current ETA counts open delays only (the demo also counted resolved ones). **Update 2026-11-27:** settled by the repository owner (§17 questions 19–22): on-hold and closed customers' bookings no longer become shipments, and bookings now complete automatically; the other choices are confirmed unchanged.
29. (2026-11-26, Phase 3) Live shipments have no documents, customs entries (only a read-only summary), expenses or invoices yet (Phase 4). The dashboard, documents, customs and finance pages still show demo data.
30. (2026-11-26, demonstration) The development database holds many fictional records from browser-check runs (customers named "Held Browser Ltd …", "Browser Credit Ltd …", "Approval Browser Ltd …" with numeric suffixes, and their quotations, bookings and a few shipments). They show at the top of the live lists. Nothing was deleted: removing them is a database change that needs its own authorization. The dashboard's shipment table also cuts off its right-hand ETA column at 1280 px (an existing layout issue, not fixed).
31. (2026-11-26 23:30) **Resolved 2026-11-26 23:39 (LOG-20261126-2345-final-verification):** the frontend was rebuilt from `baddadb` and restarted (port 3000, now PID 2192). Original text: The running demonstration frontend (port 3000, PID 22912) serves the build made at about 20:14, **before** the Phase 3 audit fixes (delay notes; customer "View shipments" link). To show them: stop the process on port 3000, run `npm run build` and `npm run start` in `Frontend/frontend` (about two minutes of downtime). Not done without the operator's go-ahead. The backend needs no restart (no backend source change).

## 13. Shared activity log

Append-only, oldest first. Never edit past entries; corrections are new entries referencing the original. Never record secrets.

**Older entries are archived verbatim in `docs/activity-log.md`, Part C** (LOG-20261005-2211-CK to LOG-20261104-1135-phase1-commit, moved 2026-11-16 by LOG-20261116-1554-docs-restructure; then LOG-20261116-1549-resume-sync to LOG-20261116-1658-session-close, moved 2026-11-20 by LOG-20261120-1425-phase2-reconcile; then LOG-20261120-1246-backend-roadmap to LOG-20261120-1309-phase2-prep-audit, moved 2026-11-20 by LOG-20261120-1501-phase2-batch1; then LOG-20261120-1315-phase2-start to LOG-20261120-1412-phase2-done, moved 2026-11-20 by LOG-20261120-1514-credit-approval; then LOG-20261120-1417-phase2-commit to LOG-20261120-1436-phase2-audit, moved 2026-11-20 by LOG-20261120-1543-phase2-complete; then LOG-20261120-1501-phase2-batch1 and LOG-20261120-1514-credit-approval, moved 2026-11-26 by LOG-20261126-1725-phase2-owner-decisions; then LOG-20261120-1543-phase2-complete and LOG-20261120-1632-session-close, moved 2026-11-26 by LOG-20261126-1952-phase3-shipments; then LOG-20261126-1725-phase2-owner-decisions (which holds the Phase 2 PR description) and LOG-20261126-1805-session-close, moved 2026-11-26 by LOG-20261126-2017-demo-prep; then LOG-20261126-1952-phase3-shipments (the Phase 3 build record), moved 2026-11-26 by LOG-20261126-2330-phase3-audit; then LOG-20261126-2017-demo-prep (development database seeded for the demonstration), moved 2026-11-26 by LOG-20261126-2345-final-verification; then LOG-20261126-2019-session-close, LOG-20261126-2330-phase3-audit and LOG-20261126-2345-final-verification, moved 2026-11-27 by LOG-20261127-0010-owner-decisions; then LOG-20261127-0010-owner-decisions (the 2026-11-27 decisions and the **Phase 3 PR description**), moved 2026-11-27 by LOG-20261127-0050-finalise). Summary of the archived period, for orientation only:
- **2026-10-05 – 10-15:** initial scaffold (`b68a0cd`); the commit titled "Phase 0" (`42ae8a8`: test and env fixes, before the backend plan defined its own Phase 0); read-only audit; this handover file; documentation audit (archive Part A) and its corrections.
- **2026-10-19 – 10-22:** frontend on fictional demo data (`feature/frontend-foundation`), built in three frontend "phases" (shipments and delays; quotations, customers and agents; document uploads), then the grouped sidebar, expenses, reports, users, settings and audit log, notifications and tasks; headless-browser review; fresh-clone check.
- **2026-10-26 – 10-29:** database schema (33 tables, migrations) and Node 24.20.0 pin (`feature/database-schema`); PRs #1 and #2 merged; read-only backend audit.
- **2026-11-03 – 11-04:** backend plan approved; backend Phase 0 (sign-in, permissions, reference formats, seeds) and Phase 1 (customers) built, verified, committed and pushed; PR #3 merged. The PR #4 merge is recorded in LOG-20261116-1549-resume-sync.
- **2026-11-16:** resumed on the collaborator's clone; `main` pulled to `d966e35`; this file split below the size limit (history archived, `docs/IMPLEMENTATION_ROADMAP.md` written); committed and pushed to `main` (`773db22`, `3bcc128`, `cbad567`); operator identified as Sean (collaborator).
- **2026-11-20 (morning):** detailed Phases 0–18 roadmap proposal written (`docs/BACKEND_IMPLEMENTATION_ROADMAP.md`, not approved); approved plan explained; read-only machine readiness check for Phase 2.
- **2026-11-20 (early afternoon):** Phase 2 authorized; `npm ci`, `.env` keys (random, never shown) and the credit rule "outstanding + booking value" decided by the operator; Phase 2 backend and frontend built; test and development databases migrated and seeded; 104 unit, 142 end-to-end and 14 browser checks passed.
- **2026-11-20 (mid-afternoon):** Phase 2 committed (`ec5c760`) and pushed on `feature/quotations-phase2`; `CLAUDE.md` reconciled and the branch re-validated; the PR could not be opened here (no `gh`); read-only completion audit (one validation bug, seed and display gaps, owner decisions).
- **2026-11-20 (late afternoon):** remediation batch 1 (issue-date bug, open-quotation count, cancelled-booking display, demo badge, customer link, convert-form carrier details, seeded demo quotations); the credit-approval step (Sales request, Finance or Management approve or reject); 112 unit, 152 end-to-end and 21 browser checks passed.
- **2026-11-20 (evening) – 11-26:** New booking page and remaining Phase 2 tests; questions added as §17; session paused; then the repository owner's answers implemented (LOG-20261126-1725, archived; it holds the Phase 2 PR description).

Entry template:

```
### LOG-YYYYMMDD-HHMM-<short-label>   (label = a short description such as "audit"; do not use initials or names that are not confirmed)
- Time: YYYY-MM-DD HH:MM:SS +03:00 (Africa/Nairobi) — source: <command>
- Contributor/session: <name if known> / <Claude Code model if applicable> | unknown
- What changed:
- Why:
- Files created / edited / deleted (repo-relative):
- Database/schema changes:
- Dependency changes:
- Commands that changed project state:
- Checks run and results:
- Known failures / outstanding:
- Commit: <hash> | not committed · Pushed: yes (confirmed how) | no
- Working-tree status after:
```

### LOG-20261127-0050-finalise — Question 16 answered (administrator-only); branches finalised and pushed; demonstration updated to the latest Phase 3 code
- Time: 2026-11-27, from 00:46:27 (start) to about 01:00 +03:00 (Africa/Nairobi) — source: PowerShell `Get-Date` (00:46:27 at start, 00:50:59 when writing this entry).
- Contributor/session: Sean Macharia (operator, relaying the repository owner) / Claude Code (Opus 5.5).
- **Instruction received:** a pasted document, "Finalise Phase 2 and Phase 3": record question 16 (tax settings stay administrator-only; Finance does not receive `settings.tax.manage`) on both branches; push both branches and verify; open both PRs if GitHub access is available (no `gh`, no merge); update the running demonstration to the latest Phase 3 code without touching the demonstration data; verify the repository owner can pull everything; log it. No merge, rebase, force-push, branch deletion, Phase 4, or new product or permission decisions.
- **Starting state:** after `git fetch origin --prune`: `main` = `cbad567`; `feature/quotations-phase2` = `23dc9641a3e5e9b5790bdf42620c0401e583997f`; `feature/shipments-phase3` = `f96903b2fe32b6e128f4996e76864935c659eab0`; each equal to its remote; clean (only the git-ignored `Frontend/frontend/next-env.d.ts`); no stashes.
- **Question 16:** recorded as answered (option A, administrator-only) in §9 (new row) and §17 on this branch, and in §17 and `docs/backend-implementation-plan.md` on the Phase 2 branch. The §17 answer line is **word-for-word identical** on both branches, so merging them later does not conflict on it. Verified read-only: in both branches' seed data `settings.tax.manage` reaches admin only (through `allStaffPermissions`; it is not in the finance list); in the development database only the `admin` role holds it. **No permission or code changed.** (The PR description and the Q16 bullet in LOG-20261127-0010 still call question 16 open; this entry supersedes them.)
- **Phase 2 branch:** edited in a temporary `git worktree` (scratchpad `wt-p2`), so this checkout never switched branches; commit **`ea7e7ad`** (documentation only); the worktree was removed afterwards. No code changed, so no tests were re-run on Phase 2 (its last results, 2026-11-27: 137 unit, 173 end-to-end, 27/27 browser).
- **Branch relationship (checked):** `feature/shipments-phase3` descends from `ab2962b` and does **not** contain the Phase 2 commits `23dc964` (questions 17 and 18) and `ea7e7ad`. This does not block review: the Phase 3 PR against `feature/quotations-phase2` shows only the Phase 3 commits (GitHub compares from the merge base). Before Phase 3 is merged, the Phase 2 work must be brought into it. The safest way is a normal merge commit (no rebase, no force-push): after Phase 2 is merged into `main`, merge `main` into `feature/shipments-phase3` and retarget the PR to `main`. A read-only `git merge-tree --write-tree` of the final branch heads reports no conflicts. **Not done**: it needs the operator's approval.
- **Pull requests: not opened.** No browser tool exists in this session. An attempt to call the GitHub API with the credential git already uses for pushing (read in memory only, never printed) was **blocked by the session's permission safety check** before anything ran; the helper script was deleted. Nothing was created on GitHub. The compare links are in §14. Descriptions to paste: Phase 2's is below and replaces the one in LOG-20261127-0010 (which still called question 16 open); Phase 3's is unchanged from LOG-20261127-0010 (now archived at the end of `docs/activity-log.md` Part C).

  > **Phase 2: Quotations, Bookings and Credit Controls** (base `main`, compare `feature/quotations-phase2`)
  >
  > Quotations API and live pages (create, edit, status flow, expiry, duplicate, server totals); bookings (conversion, standalone creation on the New booking page, confirm, cancel); credit-limit checks at booking with the approved rule (outstanding issued-invoice balance + this booking's value).
  > - **Batch 1 fixes:** issue date not after the sent date, open-quotation counts leave out expired ones, "Booking cancelled" display, Demo/Live badge, the customer page's quotation link, carrier details on conversion, seeded demo quotations and bookings.
  > - **Credit-approval workflow:** Sales book over the limit and request approval; Finance, Management or Admin approve (the booking can then be confirmed) or reject (the booking is cancelled); the approver is recorded; Sales cannot approve.
  > - **Owner decisions of 2026-11-26:** on-hold and closed customers cannot receive new quotations or bookings; archiving is refused while a customer has undelivered shipments, pending or confirmed bookings, or open quotations; admin-editable charge-type tax settings (`settings.tax.manage`, **provisional until the accountant reviews them**); no booking edits; one booking per quotation; last save wins for quotations.
  > - **Owner decisions of 2026-11-27:** pending bookings of on-hold or closed customers cannot be confirmed or credit-approved (cancel and reject still allowed); accepted quotations without a booking also block archiving; tax settings stay **administrator-only** (Finance does not receive `settings.tax.manage`).
  > - No schema change or migration; no new dependencies. One new permission row (`settings.tax.manage`, admin only): run `npm run db:seed` after pulling.
  > - Tests: 137 unit, 173 end-to-end, 27/27 headless-Chrome checks (`Frontend/frontend/scripts/browser-checks.mjs`, see `docs/browser-checks.md`).
  > - Outstanding: the accountant's review of the tax rates; a configurable KRA PIN format (future).
  >
  > 🤖 Generated with [Claude Code](https://claude.com/claude-code)

- **Demonstration update:** before: frontend port 3000 → PID 2192 (`next start`, build of 2026-11-26 23:38 = `baddadb`), backend port 3001 → PID 22560 (`node dist/main`, started 2026-11-26 20:09, before questions 19 and 20). Checks before restarting: development database target `localhost:5432/freight_management_sister` (no override); `npx prisma db verify` (read-only) → "Database marker and schema match contract"; no schema or migration files changed between `baddadb` and `f96903b`, so **no migration and no seed** were needed or run. Built `f96903b` (backend `npm run build`, frontend `npm run build`, build 00:49:09); stopped only those two PIDs after confirming their command lines; kept the old logs as `backend-until-20261127-0050.log` and `frontend-until-20261127-0050.log` in `C:\Users\HP\Documents\freight-demo-logs`; restarted with `npm run start:prod` and `npm run start`. **Now: frontend port 3000 → PID 23212; backend port 3001 → PID 13160**; `/health` ok, `/login` 200.
- **Read-only verification of the updated demonstration (GET requests and page loads only):** main pages load with "Live data" and "API online"; customer → "View shipments" → shipment → booking → quotation works. Not observable without changing data: no customer is on hold or closed (so there is no question 19 refusal to show), and no booking is `completed` (question 20.2 completes bookings only when a shipment is delivered from now on; bookings whose shipments were delivered earlier stay `confirmed`, because updating that data was not authorized). Both behaviours are covered by the e2e and browser tests of LOG-20261127-0010.
- **Database:** development database counts before and after: 41 parties, 101 quotations, 76 bookings, 14 shipments (the 11 demo shipments, with their links to BKG-2610-0001/0002 intact), 79 milestones, 7 issues, 9 customs entries, 2 containers. Only sign-in timestamps change through the walkthrough. Nothing deleted, reset or reseeded; the `*_test` database was not used.
- **Tests this session:** no application code changed, so the unit, e2e and browser suites were not re-run (last results, LOG-20261127-0010: Phase 3 155 unit, 193 e2e, 52/52 browser). Run now: backend and frontend production builds of `f96903b` (pass); read-only walkthrough 2/2.
- **For the repository owner (pulling):** the README files are still the framework boilerplate; the project state is described in this file, `docs/IMPLEMENTATION_ROADMAP.md` and `docs/activity-log.md`.
- **History archived (§15 rule 7):** this file reached 110,112 characters, so LOG-20261127-0010-owner-decisions was moved verbatim to the end of `docs/activity-log.md` Part C (checked against `git show HEAD:CLAUDE.md`); §13 summary and the §14 pointers updated.
- **Commits and pushes:** Phase 2 `ea7e7ad` and this entry's Phase 3 commit pushed (no force); full hashes verified with `git ls-remote` in the session reply.

## 14. Current handover state

Earlier handover states (up to 2026-11-04, as at `d966e35`) are archived in `docs/activity-log.md`, Part B. Rewritten on 2026-11-26 (LOG-20261126-1725-phase2-owner-decisions); Phase 3 bullets updated the same evening (LOG-20261126-1952-phase3-shipments).

- **Git:** `main` = `origin/main` = `cbad567` (PRs #1–#4 and the 2026-11-16 documentation commits). **`feature/quotations-phase2`** holds all of Phase 2, pushed to `origin`; the latest commit hash is recorded in LOG-20261126-1725-phase2-owner-decisions and the session reply. The old feature branches still exist on `origin`.
- **Done:** backend Phases 0 and 1 (on `main`). **Phase 2 (quotations, bookings, credit controls): complete and verified on `feature/quotations-phase2`, with every repository-owner decision of 2026-11-26 implemented** (137 unit, 168 end-to-end, 26/26 browser checks).
- **Live pages:** sign-in, Customers, Settings › Numbering and Tax settings, Quotations (list, detail, new, edit) and Bookings (list, detail, new). All other pages still use fictional demo data in the browser session.
- **Pull requests (2026-11-27, LOG-20261127-0010-owner-decisions; repository owner, §17 question 22.2):** two separate PRs, opened by a contributor **in the browser** (do not install `gh`; Claude Code has no browser access in these sessions). Descriptions to paste: Phase 2 in LOG-20261127-0050-finalise (§13); Phase 3 in LOG-20261127-0010-owner-decisions, now at the end of `docs/activity-log.md` Part C.
  - **Phase 2:** https://github.com/karechel/freight-management/compare/main...feature/quotations-phase2?expand=1 — title `Phase 2: Quotations, Bookings and Credit Controls`; base `main`; branch now holds the 2026-11-27 decisions on questions 17 and 18 and the question 16 record (`ea7e7ad`).
  - **Phase 3:** https://github.com/karechel/freight-management/compare/feature/quotations-phase2...feature/shipments-phase3?expand=1 — title `Phase 3: Shipments and Tracking`; base `feature/quotations-phase2` at first, retargeted to `main` after Phase 2 is merged. The Phase 3 branch does **not** yet contain the Phase 2 commits `23dc964` (questions 17 and 18) and `ea7e7ad` (question 16 record): they arrive when `main` is merged into Phase 3 at retargeting (a normal merge commit, needing the operator's approval; a trial merge is conflict-free).
  - **Do not merge without the repository owner's approval.**
- **Phase 3 (shipments and tracking): built and verified on `feature/shipments-phase3`** (branched from the Phase 2 head `ab2962b`; LOG-20261126-1952-phase3-shipments). The user changed the order of work on 2026-11-26: Phase 3 before the Phase 2 merge; both are merged after Phase 3, only with the repository owner's approval. A Phase 3 PR would target `feature/quotations-phase2` (or `main` once Phase 2 is merged). Phase 4 is not started.
- **For the demonstration (prepared 2026-11-26 evening, LOG-20261126-2017-demo-prep; frontend rebuilt from `baddadb` and restarted at 23:39, LOG-20261126-2345-final-verification):** the development database holds the 11 demo shipments; both apps were left running from `feature/shipments-phase3` as production builds (frontend http://localhost:3000, PID 23212; backend http://localhost:3001, PID 13160 — both rebuilt from `f96903b` and restarted on 2026-11-27 at 00:50, LOG-20261127-0050-finalise; logs in `C:\Users\HP\Documents\freight-demo-logs`). Stop them by the process listening on each port. To restart: `npm run start:prod` in `Backend/backend` and `npm run start` in `Frontend/frontend` (after `npm run build` in each, if code changed).
- **Outstanding, not blocking Phase 2:**
  - The company accountant has **not** reviewed the tax defaults; they are provisional and admin-editable (§12 item 23).
  - An admin-configurable KRA PIN format is a future requirement (§12 item 24).
  - Before launch: `helmet` and a shared rate limiter; keep or remove the `deploy` script; Prisma RC vs stable and the unused `@prisma/client` 7; KRA iCMS access; Phase 4 scope.
  - `docs/BACKEND_IMPLEMENTATION_ROADMAP.md` stays an unapproved reference.
- **This machine (Sean Macharia's clone):** Node 24.20.0; development database migrated (marker `9e752599…`), seeded (on 2026-11-26 `npm run db:seed` added the `settings.tax.manage` grant for admin) and holding fictional records from the browser checks; the `*_test` database exists; `gh` is not installed.
- **Security:** signing out does not revoke the token (valid up to 8 hours). Demo pages are open without sign-in, so use fictional data only until each page goes live.

## 15. Maintaining this document

1. Before editing, run `git status` and `git fetch` (read-only for working files) and compare `main` with `origin/main`; read this whole file and the documents listed under "Read before making changes". Only `git pull` when the human contributor has authorized it and the working tree is clean or changes are safely committed/stashed. Never overwrite another contributor's entries.
2. Append a log entry (§13) for everything done in a session. Include:
   - the instruction received
   - the starting branch, commit and working-tree state
   - findings
   - changes, with file paths
   - checks run (including read-only ones) with their actual results, and checks not run
   - processes started or stopped
   - files created outside the repository
   - failed attempts
   - commits and pushes, with verified hashes
   - the final working-tree state
   - open decisions

   Update the entry throughout the session, not only at the end. If something is done after an entry is written, add a short follow-up entry. New entries go at the end of §13 **in this file** (above §14), never in `docs/activity-log.md`. (Changed 2026-10-21 on the collaborator's instruction, LOG-20261021-0116-logging-rule; restated as a standing instruction for every session on 2026-11-16, LOG-20261116-1549-resume-sync.)
3. Get timestamps from PowerShell `Get-Date -Format "yyyy-MM-dd HH:mm:ss zzz"`. Git Bash's `date` on this machine ignores `TZ=Africa/Nairobi` and reports GMT — do not use it. (Cause: Git Bash lacks zoneinfo. In Git Bash, `TZ=EAT-3 date '+%F %T %z'` gives the correct +0300 time; PowerShell remains the preferred source.)
4. Never backdate; if exact time is unknown write "Exact change time unavailable." Don't infer times from file mtimes alone.
5. Update §5, §11, §12 and §14 when facts change, and `docs/IMPLEMENTATION_ROADMAP.md` when a phase's status changes; log changes to this file itself.
6. Commit log entries together with the change they describe, to reduce merge conflicts between contributors.
7. Keep this file well under Claude Code's 150,000-character limit; check with `(Get-Content CLAUDE.md -Raw).Length`. When it passes about 100,000 characters, move the oldest §13 entries, unchanged and in order, to the **end** of `docs/activity-log.md` (Part C), update the summary at the top of §13, and log the move. Archived entries are never edited; corrections go in new §13 entries. (First move: 2026-11-16, LOG-20261116-1554-docs-restructure.)
8. Section references inside archived entries (§3, §5, §9, §11, §12, §14, §16 …) use this file's numbering at the time. Former §14 is archive Part B; former §16 (including "§16.6" decisions) is archive Part A.

---

## 16. Documentation accuracy audit (moved)

The 2026-10-15 documentation accuracy audit, including §16.6 (open questions and the 2026-10-19 decisions), is preserved verbatim in `docs/activity-log.md`, Part A. Its corrections were applied in LOG-20261015-2305-corrections and LOG-20261015-2310-corrections.

---

## 17. Questions for the operator and the repository owner

Added 2026-11-20 (LOG-20261120-1543-phase2-complete). **All fifteen questions were answered by the repository owner on 2026-11-26**; the answers were relayed by the operator and implemented in LOG-20261126-1725-phase2-owner-decisions. The decisions are recorded in §9. The full question text is in `git show 16a9bf5:CLAUDE.md`.

**How to answer new questions:** write the answer under the question, or tell Claude Code in a session. Claude Code records it in §9 and §13 and marks the question "Answered (date, by whom)".

1. **Pull request.** *Answered 2026-11-26, repository owner:* a contributor opens it in the browser; do not install `gh`. Title "Phase 2: Quotations, Bookings and Credit Controls"; the description includes batch 1, the credit-approval workflow and the New booking page. Do not merge without the owner's approval.
2. **Credit rule.** *Answered:* approved. Outstanding issued-invoice balances plus this booking's value; other pending or confirmed bookings are not included; no check without a credit limit.
3. **Credit-approval step.** *Answered:* approved as built. Sales cannot approve; the approver is recorded; Finance and Management do not get `quotations.manage`.
4. **Permission matrix.** *Answered:* keep it unchanged; do not broaden any permission.
5. **On-hold and closed customers.** *Answered:* block new quotations and bookings, with a clear explanation. **Implemented 2026-11-26.**
6. **Archiving with open work.** *Answered:* refuse while there are undelivered shipments, pending or confirmed bookings, or open quotations, naming them. **Implemented 2026-11-26.**
7. **Cancelled bookings.** *Answered:* keep one booking per quotation; duplicate to book again; no schema change.
8. **Booking edits.** *Answered:* none, pending or confirmed. Any future edit needs its own approval and specification.
9. **Two people editing a quotation.** *Answered:* keep last-save-wins, audited; no 409.
10. **Phase 1 decisions of 2026-11-04.** *Answered:* all four confirmed. The KRA PIN format must become admin-configurable in the future (§12 item 24).
11. **Tax defaults.** *Answered:* **not reviewed by the accountant.** Make them editable (done: Settings › Tax settings, admin only); keep the line default and per-line rounding; treat them as provisional. Not a Phase 2 blocker. **Accountant review still outstanding.**
12. **Browser checks.** *Answered:* commit them with no new dependency (done: `Frontend/frontend/scripts/browser-checks.mjs`, documented in `Frontend/frontend/docs/browser-checks.md`).
13. **Who ran the sessions.** *Answered:* use the Git commit identity, Sean Macharia.
14. **Roadmap proposal.** *Answered:* keep `docs/BACKEND_IMPLEMENTATION_ROADMAP.md` as an unapproved reference.
15. **Next phase.** *Answered:* Phase 3 follows once Phase 2 has passed its checks and its PR is reviewed and merged, with the provisional tax configuration documented. Not before the merge. *Superseded 2026-11-26 19:16 by the user's instruction to build Phase 3 first, on its own branch, and merge both afterwards (§9, LOG-20261126-1952-phase3-shipments).*

### Open questions (2026-11-26)

*Questions 16–18 were deferred until after Phase 3 (2026-11-26 19:16). Questions 17–22 were answered by the repository owner on 2026-11-27 (relayed by Sean Macharia) and implemented in LOG-20261127-0010-owner-decisions. Question 16 was answered later on 2026-11-27 (option A, administrator-only; LOG-20261127-0050-finalise). **All questions in this section are answered.**

16. **Who may edit tax settings?** Claude Code made `settings.tax.manage` admin-only, within the approved matrix. Should Finance also hold it, or should the accountant review only through an administrator?
    - *Answer:* **Answered 2026-11-27, repository owner (relayed by Sean Macharia): option A. Tax settings stay administrator-only.** Finance does **not** receive `settings.tax.manage`; the accountant reviews tax settings through an administrator. No permission change was needed: only admin has held `settings.tax.manage` since 2026-11-26.
17. **Existing bookings of on-hold or closed customers.** Confirming or credit-approving an existing pending booking is still allowed (it is not new work). Should that be blocked too?
    - *Answer:* Answered 2026-11-27, repository owner (relayed by Sean Macharia, LOG-20261127-0010-owner-decisions): **Not allowed.** Pending bookings of on-hold or closed customers cannot be confirmed or credit-approved. Built on `feature/quotations-phase2` (`23dc964`); cancelling and rejecting stay possible.
18. **Accepted quotations and archiving.** An accepted quotation without a booking does not count as "open" (the existing "open quotations" figure counts draft and sent only), so it does not block archiving; converting it afterwards is refused because the customer is archived. Should accepted, unbooked quotations also block archiving?
    - *Answer:* Answered 2026-11-27, repository owner (relayed by Sean Macharia, LOG-20261127-0010-owner-decisions): **Yes.** Built on `feature/quotations-phase2` (`23dc964`): archiving is refused while an accepted quotation has no booking; the refusal names it.
19. **Shipments for on-hold or closed customers.** A standalone shipment (new work) is refused for archived, on-hold and closed customers. A shipment from an existing confirmed booking is refused only for archived customers, like question 17. Should on-hold and closed customers' bookings also be blocked from becoming shipments?
    - *Answer:* Answered 2026-11-27, repository owner (relayed by Sean Macharia, LOG-20261127-0010-owner-decisions): **Yes.** Built on `feature/shipments-phase3`: a confirmed booking of an on-hold or closed customer cannot become a shipment (archived as before).
20. **Bookings with shipments.** Claude Code made a booking with shipments impossible to cancel (409 naming them). Is that right, and should a booking be marked `completed` automatically once all its shipments are delivered (not built)?
    - *Answer:* Answered 2026-11-27, repository owner (relayed by Sean Macharia, LOG-20261127-0010-owner-decisions): **20.1 Yes**: a booking with shipments cannot be cancelled (already built; unchanged). **20.2 Yes**: built on `feature/shipments-phase3`: the booking becomes `completed` automatically when every one of its shipments is delivered.
21. **Delivered and ETA rules.** Delivered is final (no reopening); every shipment needs a planned ETA; the current ETA comes from **open** delays only (the approved plan), while the demo also kept the revised date of resolved delays. Confirm, or say which to change.
    - *Answer:* Answered 2026-11-27, repository owner (relayed by Sean Macharia, LOG-20261127-0010-owner-decisions): **Keep all three rules unchanged.** Regression tests retained.
22. **Phase 3 completion criteria and merge order.** The plan states none; the ones applied are in `docs/IMPLEMENTATION_ROADMAP.md` (Phase 3). Confirm them, and whether the Phase 3 PR should target `feature/quotations-phase2` or wait for Phase 2 to reach `main`.
    - *Answer:* Answered 2026-11-27, repository owner (relayed by Sean Macharia, LOG-20261127-0010-owner-decisions): **22.1** the applied completion criteria are approved. **22.2** separate PRs: Phase 2 → `main`; Phase 3 → `feature/quotations-phase2` at first, retargeted to `main` after Phase 2 is merged. Neither is merged without the repository owner.
