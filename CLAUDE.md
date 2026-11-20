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
| Quotations and bookings (Phase 2): quotations API, server totals, status flow, expiry, duplicate, conversion to a booking, standalone bookings, confirm and cancel, credit-limit check with override, archived-customer refusal; live quotation pages and minimal booking pages | **Verified** 2026-11-20 (re-run on the branch the same day); committed on `feature/quotations-phase2` (`ec5c760`) and pushed; **awaiting PR review and merge**, not on `main` | LOG-20261120-1343-phase2-backend, LOG-20261120-1412-phase2-done, LOG-20261120-1425-phase2-reconcile: 104 unit tests, 142 end-to-end tests, 14 browser checks |
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
| Customer account status can be changed only by management and admin (`parties.status.manage`); finance changes terms and limits but not status (2026-11-04) | Session operator, identity not confirmed, 2026-11-04 (LOG-20261104-1120-phase1-decisions) |
| A customer cannot be archived while they have a shipment not yet delivered (2026-11-04) | Session operator, 2026-11-04 |
| When two people edit one customer, the last save wins; changes are audited, with no warning (2026-11-04) | Session operator, 2026-11-04 |
| The KRA PIN has no fixed format for now: up to 20 characters, unique, upper case. Revisit once the client's records are seen (2026-11-04) | Session operator: "leave the format editable for now", then confirmed as "any format for now", 2026-11-04 |
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
16. (2026-11-20, Phase 2) The fictional demo seed (`npm run db:seed:demo`) has no quotations or bookings, so a fresh database shows empty Quotations and Bookings lists until someone creates them.
17. (2026-11-20, Phase 2) No page creates a standalone booking (a booking without a quotation). `POST /api/bookings` exists and is tested, but bookings can only be made in the UI by converting an accepted quotation.
18. (2026-11-20, Phase 2) A demo quotation reference (such as `QT-2610-0057`, linked from demo pages) opens the demo record under `/quotations/...`. That page shows the top bar's "Live data" badge together with its own "Demonstration data" banner, which is inconsistent.
19. (2026-11-20, Phase 2) Owner review pending, not a defect: the credit rule (decided by the operator on 2026-11-20) and the seeded permission matrix, in which only admin holds both `quotations.manage` and `credit.override`. See §14.

## 13. Shared activity log

Append-only, oldest first. Never edit past entries; corrections are new entries referencing the original. Never record secrets.

**Older entries are archived verbatim in `docs/activity-log.md`, Part C** (LOG-20261005-2211-CK to LOG-20261104-1135-phase1-commit, moved 2026-11-16 by LOG-20261116-1554-docs-restructure; then LOG-20261116-1549-resume-sync to LOG-20261116-1658-session-close, moved 2026-11-20 by LOG-20261120-1425-phase2-reconcile). Summary of the archived period, for orientation only:
- **2026-10-05 – 10-15:** initial scaffold (`b68a0cd`); the commit titled "Phase 0" (`42ae8a8`: test and env fixes, before the backend plan defined its own Phase 0); read-only audit; this handover file; documentation audit (archive Part A) and its corrections.
- **2026-10-19 – 10-22:** frontend on fictional demo data (`feature/frontend-foundation`), built in three frontend "phases" (shipments and delays; quotations, customers and agents; document uploads), then the grouped sidebar, expenses, reports, users, settings and audit log, notifications and tasks; headless-browser review; fresh-clone check.
- **2026-10-26 – 10-29:** database schema (33 tables, migrations) and Node 24.20.0 pin (`feature/database-schema`); PRs #1 and #2 merged; read-only backend audit.
- **2026-11-03 – 11-04:** backend plan approved; backend Phase 0 (sign-in, permissions, reference formats, seeds) and Phase 1 (customers) built, verified, committed and pushed; PR #3 merged. The PR #4 merge is recorded in LOG-20261116-1549-resume-sync.
- **2026-11-16:** resumed on the collaborator's clone; `main` pulled to `d966e35`; this file split below the size limit (history archived, `docs/IMPLEMENTATION_ROADMAP.md` written); committed and pushed to `main` (`773db22`, `3bcc128`, `cbad567`); operator identified as Sean (collaborator).

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

### LOG-20261120-1246-backend-roadmap — Detailed backend roadmap written (planning and documentation only)
- Time: session started 2026-11-20 12:46:18 +03:00; this entry written 12:56:36 +03:00 (Africa/Nairobi). Source: PowerShell `Get-Date`.
- Contributor/session: collaborator's local clone (Git identity Sean Macharia). The operator has **not been confirmed in this session**; the Claude Code account signed in differs from the Git identity, as on 2026-11-16. Model: Claude Code (Opus 5.5).
- **Instruction received:** pasted brief "TASK: Fully Document the Backend Implementation Roadmap in CLAUDE.md":
  - Inspect the repository.
  - Document every backend phase in detail: overview, features, database, backend, frontend, security, testing, dependencies, completion criteria.
  - Explain the sequence and recommend a first phase.
  - Keep facts, requirements, proposals, decisions and external dependencies separate.
  - Use a dedicated document if `CLAUDE.md` would grow too large.
  - Log the session.
  - Strictly no code, schema, migration, database, dependency, environment or config changes; no deploy, **no commit or push**.
- **Starting state:** branch `main` = `origin/main` = `cbad567` (after a `git fetch origin --prune`, which changed nothing); working tree clean.
- **Inspected (read-only):**
  - This file.
  - `docs/IMPLEMENTATION_ROADMAP.md`, `docs/backend-implementation-plan.md`, `docs/database-design.md`.
  - `Backend/backend/src/prisma/contract.prisma` (whole file).
  - The backend `src/` tree and `package.json`.
  - `src/seed/setup-data.ts` (roles and permissions) and `src/seed/demo.ts` (partner roles).
  - `src/parties/parties.dto.ts` (accepts all five party roles).
  - `Backend/backend/test/` listing; `migrations/app/` listing; `.env.example` (key names only, values not printed).
  - `Frontend/frontend/docs/api-contracts.md`, `lib/types.ts`, the `lib/` and `app/**/page.tsx` listings, and `lib/access.ts` (role names).
  - `node_modules/@nestjs/platform-express/package.json`: it depends on `multer` 2.4.0, so file uploads need no new dependency.
- **Findings recorded in the roadmap (schema gaps, not changed):**
  - No FCL/LCL field.
  - No `cancelled` shipment status.
  - No shipper or consignee fields.
  - One agent per shipment.
  - No supplementary-invoice flag.
  - No customs item (HS code) lines.
  - No document scan status or agent-visibility flag.
  - No `documentation` or `agent` role seeded.
  - The `AgentRoute`, `CostEstimate`, notification, company-settings and integration-log tables do not exist.
  - Conflict: the brief lists M-Pesa, but the repository owner removed it from scope on 2026-10-26. The roadmap keeps it out of scope and lists the conflict as a decision.
  - Differences between `api-contracts.md` and the approved conventions (URL prefix, error format, cents vs decimals, editing sent quotations) are listed in the roadmap's §2.3.
- **Files created:** `docs/BACKEND_IMPLEMENTATION_ROADMAP.md` (about 119k characters). It holds 20 phase sections: 0, 1, 2, 3A, 3B and 4–18. It also covers the sequence, 37 open decisions and external dependencies. It is assembled from five draft parts in the session scratchpad (`r1.md`–`r5.md`, outside the repository).
- **Files edited:**
  - `CLAUDE.md`: "Read before" block, §4 row, §6 note, §14 next actions, and this entry.
  - `docs/IMPLEMENTATION_ROADMAP.md`: a pointer to the new file at the top.
  - No earlier log entry was edited.
- **Roadmap status:** **proposal only.** `docs/backend-implementation-plan.md` stays authoritative until the repository owner approves it. The proposed renumbering is not in effect yet:
  - Phases 0–3 keep their numbers, with Phase 3 split into 3A and 3B.
  - The approved Phase 4 becomes Phases 4–16.
  - The approved Phase 5 becomes Phase 17, and deployment becomes Phase 18.
- **Recommended first phase:** Phase 2 (quotations and bookings), after:
  - the baseline setup and test re-run on this clone;
  - the "Before Phase 2" decisions;
  - explicit approval.
- **Checks run:** `wc -m` on the new file and `CLAUDE.md`; a count of the phase headings (20); `git status`. No tests, builds, lint, Prisma or database commands were run (documentation only).
- Database/schema changes: none · Dependency changes: none · Application code, configuration and `.env`: unchanged · Processes started: none.
- Commit: **not committed** · Pushed: **no** (the brief forbids both in this session).
- Working-tree status after: `CLAUDE.md` and `docs/IMPLEMENTATION_ROADMAP.md` modified; `docs/BACKEND_IMPLEMENTATION_ROADMAP.md` untracked; nothing staged. Branch `main` = `cbad567`.
- **Open:** review of the roadmap; the decisions in its §6; approval to start Phase 2; operator identity for this session; the repository owner's review of the 2026-11-04 decisions.

### LOG-20261120-1300-approved-plan-review — Explanation of the approved backend plan (Phases 0–5); comparison with the proposal
- Time: 2026-11-20 13:00:11 +03:00 (Africa/Nairobi) — source: PowerShell `Get-Date`.
- Contributor/session: same session as LOG-20261120-1246-backend-roadmap; operator not confirmed / Claude Code (Opus 5.5).
- **Instruction received:** pasted brief "TASK: Explain and Review the Existing Approved Backend Phase Plan":
  - Explain approved Phases 0–5 in detail, and the order between them.
  - Compare `docs/BACKEND_IMPLEMENTATION_ROADMAP.md` **without adopting its numbering**.
  - Recommend how to proceed.
  - Documentation and explanation only: no code, schema, migration, dependency, environment or config changes, no database writes, no deploy, no commit or push.
- **Confirmed by the operator:** `docs/backend-implementation-plan.md` is authoritative. The Phases 0–18 file is a supporting proposal only. No document was changed to say otherwise.
- **Starting state:** `main` = `origin/main` = `cbad567` (after `git fetch origin`). Still uncommitted from LOG-20261120-1246-backend-roadmap: `CLAUDE.md` and `docs/IMPLEMENTATION_ROADMAP.md` modified, `docs/BACKEND_IMPLEMENTATION_ROADMAP.md` untracked.
- **Read:** the six documents named in the brief. All were already read in full earlier in this session; none changed in between (`git status`).
- **Output:** the explanation was given in the session reply, not written to a file.
- **Documentation problems found and reported, not fixed:**
  - `docs/backend-implementation-plan.md`:
    - Its status line still says Phase 1 is "not yet merged". It was merged as PR #4 (`d966e35`).
    - Its Phase 1 rule "KRA PIN format" is superseded by the 2026-11-04 decision ("as built" note in the same section).
  - `Frontend/frontend/docs/api-contracts.md`:
    - "Before real operational data is handled" still says no authentication exists and CORS is hard-coded. Both are out of date since Phase 0.
    - The older proposed sections differ from the approved conventions: no `/api` prefix, 422 `{ errors }` instead of 400 `details`, prices in cents, a sent quotation never edited, and quotation → shipment without a booking.
  - `CLAUDE.md` §3: the architecture diagram still shows CORS hard-coded. §12 item 8 records the fix.
  - `docs/database-design.md` says "33 tables" in some places and "34, including `User`" in §3. Both are correct depending on whether `User` is counted.
  - The approved plan has no completion criteria for Phases 2–3 and no agreed scope for Phase 4.
  - The approved Phase 5 includes "production security hardening and launch checks", but deployment is not authorized anywhere.
- **Checks run:** `git status`, `git fetch`, `git rev-parse`. No tests, builds, Prisma or database commands.
- Database/schema changes: none · Dependency changes: none · Application code and configuration: unchanged.
- Commit: not committed · Pushed: no.
- Working-tree status after: `CLAUDE.md` (both 2026-11-20 entries) and `docs/IMPLEMENTATION_ROADMAP.md` modified; `docs/BACKEND_IMPLEMENTATION_ROADMAP.md` untracked; nothing staged; `main` = `cbad567`.

### LOG-20261120-1309-phase2-prep-audit — Read-only readiness check of this machine for Phase 2 (nothing changed)
- Time: 2026-11-20 13:08:51 +03:00 (start) (Africa/Nairobi) — source: PowerShell `Get-Date`.
- Contributor/session: same session; operator not confirmed / Claude Code (Opus 5.5).
- **Instruction received:** "set up this machine for backend work", with the pasted brief "TASK: Prepare the Freight Management Repository for Backend Phase 2". The brief limits this session to read-only checks and a report. It forbids changing environment files, dependencies or code, database-writing commands, commit and push. It says to stop and wait for approval. Following the brief, **no setup step was carried out**.
- **Repository:**
  - `origin` = `https://github.com/karechel/freight-management.git`.
  - Branch `main` = `cbad567`; after `git fetch origin --prune`, 0 ahead and 0 behind `origin/main`. No stashes.
  - Uncommitted work, all from this session's documentation entries: `CLAUDE.md` and `docs/IMPLEMENTATION_ROADMAP.md` modified, `docs/BACKEND_IMPLEMENTATION_ROADMAP.md` untracked.
- **Environment (values never displayed):**
  - Node v24.20.0 (`C:\Program Files\nodejs`) in the root and both app folders; npm 11.19.0; `.nvmrc` 24.20.0.
  - PostgreSQL 18: service `postgresql-x64-18` running, port 5432 open, `psql` installed. Earlier recorded runs used PostgreSQL 17.11 on another machine.
  - Backend `.env` exists. Of the `.env.example` keys it has only `DATABASE_URL`, which is set. **Missing:** `JWT_SECRET` (required at startup), `CORS_ORIGINS` (optional, has a default), `PORT` (optional), `ADMIN_EMAIL`, `ADMIN_PASSWORD` and `DEMO_USER_PASSWORD` (needed by the seeds).
  - Frontend `.env.local` exists with `NEXT_PUBLIC_API_URL` (the only key in its `.env.example`).
- **Dependencies:**
  - Backend `npm ls --depth=0` → ELSPROBLEMS. Missing: `@nestjs/jwt`, `class-transformer`, `class-validator`. The installed `node_modules` predates Phase 0, so `npm ci` is needed.
  - Frontend `npm ls --depth=0` → all present.
- **Checks run (all read-only):**
  - Backend `npx tsc --noEmit --incremental false` → fails with TS2307 errors, all from the three missing packages.
  - `npx prisma --version` → 8.0.0-rc.17.
  - `npx prisma migration check` → all checks passed.
  - `npx prisma db verify` → exit 4, `CONTRACT.MARKER_MISMATCH`: the database marker `a9d7a849…` is the original `User` contract, and the code expects `9e752599…`.
  - `npx prisma db migrate --show` → 2 migrations would run: `20261026T1926_freight_core_schema` and `20261103T1857_add_reference_format`.
  - Prisma also warned "agent skills are out of date (`prisma skills sync`)". Not acted on.
  - Frontend: `npx tsc --noEmit --incremental false` → exit 2, TS2344 `AppRoutes` errors on `app/login/page.tsx` and `app/parties/[id]/edit/page.tsx`. The likely cause is stale generated route types in `.next/` (earlier sessions ran `next typegen` before `tsc`). Not confirmed.
  - Frontend `npm run lint` → pass.
- **Not run:**
  - Backend lint, unit tests, end-to-end tests and build: their dependencies are missing.
  - `next typegen` and the frontend build: they write `.next/`.
  - Any database-writing command, `npm ci`, and anything that edits `.env`.
- **Files outside the repository:** none. npm wrote its own debug log to the user's npm cache after the ELSPROBLEMS result.
- Database/schema changes: none · Dependency changes: none · Application code, configuration and environment files: unchanged.
- Commit: not committed · Pushed: no.
- Working-tree status after: unchanged from the start of this entry, plus this entry in `CLAUDE.md`.
- **Awaiting approval:**
  1. `npm ci` in `Backend/backend`.
  2. Adding the missing backend `.env` keys.
  3. Migrating the local development database, after checking what data it holds.
  4. `npm run db:seed` and `npm run db:seed:demo`.
  5. `npm run test:e2e`, which creates and migrates a `*_test` database.
  6. `next typegen` / the frontend build.

### LOG-20261120-1315-phase2-start — Phase 2 authorized; blocked on setup approvals and one credit-check rule
- Time: 2026-11-20 13:15:18 +03:00 (Africa/Nairobi) — source: PowerShell `Get-Date`.
- Contributor/session: same session; operator not confirmed / Claude Code (Opus 5.5).
- **Instruction received:** pasted brief "TASK: Implement Backend Phase 2 — Quotations and Bookings":
  - The operator authorizes Phase 2 under the approved plan.
  - No unapproved proposal features; no Phase 3 or later work.
  - No database writes without explicit approval in this session.
  - No dependency or environment changes unless authorized.
  - Ask one clear question where a business rule is missing.
  - No commit or push.
- **Rechecked (read-only), unchanged since LOG-20261120-1309-phase2-prep-audit:**
  - `main` = `origin/main` = `cbad567`, with the same uncommitted documentation.
  - Backend packages `@nestjs/jwt`, `class-transformer` and `class-validator` still missing.
  - Backend `.env` still has only `DATABASE_URL`.
  - `prisma db verify` still reports "Hash mismatch".
- **Read for Phase 2:**
  - Backend: `src/references/references.service.ts` and `reference.types.ts`; `src/audit/audit.service.ts`; `src/auth/auth.decorators.ts`; `src/app.module.ts`; `src/common/` (`parse-id.pipe.ts`, `validation-exception.ts`, `pagination.dto.ts`); `src/prisma/db.ts` and `prisma.service.ts`; `src/parties/parties.service.ts`.
  - Frontend: `lib/quotations.ts`, `lib/quotation-changes.ts`, `lib/money.ts`, `lib/quotation-form.ts`.
- **Blocked on:**
  1. Approval for `npm ci`, the `.env` keys and the database steps.
  2. The operator's answer on the credit-check comparison at booking (exposure and attempted amount). The approved plan does not define it, and a standalone booking has no amount column.
- No files changed except this entry.

### LOG-20261120-1343-phase2-backend — Phase 2 backend written; unit tests, lint and build pass; end-to-end tests not yet run
- Time: 2026-11-20, from 13:15 to about 13:43 +03:00 (Africa/Nairobi) — source: PowerShell `Get-Date` at the start; smoke-test log timestamp 13:42:12.
- Contributor/session: same session; operator not confirmed / Claude Code (Opus 5.5).
- **Answers received (question dialog, 13:2x):**
  - Setup: **only "npm ci in backend" approved.** Not approved: migrating and seeding the development database, creating the `*_test` database for end-to-end tests, `next typegen` and the frontend build.
  - `.env`: "I generate them". The missing keys were appended to `Backend/backend/.env` with random values, never printed: `JWT_SECRET`, `ADMIN_EMAIL` (a fictional `admin@freight-demo.example`), `ADMIN_PASSWORD`, `DEMO_USER_PASSWORD`. `.env` is git-ignored (`git check-ignore`). `CORS_ORIGINS` and `PORT` were left at their defaults.
  - **Credit rule (business decision by the operator, 2026-11-20):** "Outstanding + quote total". A warning is raised when the customer's outstanding issued-invoice balance (the Phase 1 `outstanding` figure) plus the booking's value exceeds the credit limit. The value is the quotation total; a standalone booking requires an estimated value, which is recorded in `CreditCheck`. No limit means no check.
- **Commands that changed state:**
  - `npm ci` in `Backend/backend` → exit 0; `npm ls` reports no missing packages. npm noted that the install scripts of `esbuild` and `workerd` are not covered by `allowScripts`; not acted on. No lockfile change.
  - `.env` append (above).
  - `npm run build` (writes `dist/`).
  - One smoke start of `node dist/main.js` on port 3199, stopped by the port's owning process (PID 12484). Output went to `%TEMP%\fm-smoke.out` and `.err`, outside the repository.
- **Baseline before changes:** `tsc` pass; lint pass; `npm test` → 7 files, 70 tests pass (matches the recorded Phase 1 count).
- **Implemented (backend, approved Phase 2 scope):**
  - `GET /api/charge-types`: any signed-in user; active charge types only.
  - `GET/POST /api/quotations`, `GET/PATCH /api/quotations/:reference`, `POST /api/quotations/:reference/status`:
    - lines saved in one transaction;
    - totals calculated in SQL (`round(qty × price, 2)`, then `round(net × rate / 100, 2)`, half away from zero like the frontend's `lineAmounts`);
    - editable only while `draft` or `sent` (approved plan), never once expired or booked;
    - status flow `draft → sent → accepted | declined`, plus `accepted → declined` while unbooked, as in the frontend's `quotationTransitions`;
    - `expired` is derived from `validUntil` on the Nairobi calendar and never stored;
    - duplicate by sending `duplicatedFrom`;
    - `QT-…` reference from the configured format inside the creating transaction;
    - concurrent changes serialized with `SELECT … FOR UPDATE`.
  - `POST /api/quotations/:reference/convert`: accepted quotations only, at most one booking (409 otherwise). Copies customer, agent, mode, direction, route and cargo; optional carrier, carrier booking number and planned dates; `BKG-…` reference.
  - `GET/POST /api/bookings`, `GET /api/bookings/:reference`, `POST …/confirm` (pending only), `POST …/cancel` (pending or confirmed, reason required). No booking edit endpoint: the approved plan lists none.
  - **Credit check at booking** (`src/credit/credit.service.ts`):
    - locks the customer row;
    - 409 with the figures in `details` when over the limit and no decision was sent;
    - `proceed` needs `credit.override` (403 otherwise);
    - `blocked` records the decision and returns 409 after the commit;
    - every decision writes a `CreditCheck` row and an `AuditLog` entry.
  - Archived customers are refused for new quotations, bookings, conversions and moving a quotation to that customer. Party roles are checked (customer, agent, carrier).
  - Permissions use only the existing seeded codes: `quotations.view` and `quotations.manage` (described in the seed as covering bookings), `credit.override`, and `parties.billing.view` (credit decisions are shown on bookings only to its holders). No permission or schema change; no migration.
  - Every create, edit, status change, conversion, confirmation, cancellation and credit decision is audited.
- **Files created:**
  - `src/quotations/` (`quotation-rules.ts` + spec, `quotations.dto.ts`, `.service.ts`, `.controller.ts`, `.module.ts`);
  - `src/bookings/` (`booking-rules.ts` + spec, `bookings.dto.ts`, `.service.ts`, `.controller.ts`, `.module.ts`);
  - `src/credit/` (`credit.service.ts`, `credit.module.ts`);
  - `src/charge-types/` (controller, module);
  - `src/common/text-fields.ts`, `src/common/decimal-fields.ts` + spec;
  - `src/parties/party-checks.ts`;
  - `test/quotations.e2e-spec.ts`.
- **Files edited:**
  - `src/app.module.ts`: new modules registered.
  - `src/parties/parties.dto.ts`: `trim`, `blankToNull`, `OptionalText` and `RequiredText` moved unchanged to `src/common/text-fields.ts` and imported back. No behaviour change; the existing unit tests pass.
- **Checks run after the changes:**
  - `tsc` pass; `npm run lint` pass.
  - `npm test` → 10 files, **104 tests pass**.
  - Prettier `--check --end-of-line auto`: only the three files flagged before this session (`src/prisma/contract.d.ts`, `db.ts`, `prisma.module.ts`), left untouched. New files were formatted with `prettier --write` on those files only.
  - `npm run build` pass.
  - Smoke start: all modules load; `/health` → 200; `/api/quotations`, `/api/bookings`, `/api/charge-types` and `POST /api/quotations/QT-1/convert` without a token → 401.
- **Not run:**
  - `npm run test:e2e` (needs the `*_test` database, not approved). `test/quotations.e2e-spec.ts` is written and covers: permissions per role; totals and rounding; validation; archived customers; editing; the status flow; expiry; duplication; concurrent references; single and concurrent conversion; credit warning, stop, proceed and 403; the estimated value; confirm and cancel; hidden credit decisions.
  - Browser checks.
- **Not done yet:**
  - Frontend: quotation pages to live data, and the minimal booking list and detail.
  - Fictional quotations in the demo seed.
  - `api-contracts.md` and the other Phase 2 documentation.
- **Observation for the owner (not changed):** in the seeded matrix, only admin holds both `quotations.manage` and `credit.override`. Finance and management can override but cannot create bookings, and sales can create but not override. Proceeding past a limit therefore needs an admin, unless the permission data is changed.
- Database/schema changes: none · Dependency changes: none (lockfile install only).
- Commit: not committed · Pushed: no.

### LOG-20261120-1412-phase2-done — Phase 2 end-to-end and browser verified; databases set up; frontend live; documentation updated (not committed)
- Time: 2026-11-20, from about 13:45 to 14:11:35 +03:00 (Africa/Nairobi) — source: PowerShell `Get-Date` (end-to-end run started 13:50:10; entry written 14:11:35).
- Contributor/session: same session; operator not confirmed / Claude Code (Opus 5.5).
- **Approvals received (question dialog, about 13:45):**
  1. "Yes, create test DB": `npm run test:e2e` may create, migrate and empty the `*_test` database.
  2. "Build it, migrate + seed dev DB (Recommended)": implement the Phase 2 frontend; migrate and seed the development database; run `next typegen` and the build; check the pages in headless Chrome.
- **Database commands that changed state (operator-approved):**
  - `npm run test:e2e` created and migrated the `*_test` database (it refuses any other name) and emptied it between files.
  - Read-only check of the development database first: 1 table (`User`), 0 rows.
  - `npx prisma db migrate --advance-ref db` → "Applied 2 migration(s) (257 operation(s))". `npx prisma db verify` → "Database marker and schema match contract".
  - `npm run db:seed` → roles, 62 grants, 14 charge types, 1 retention policy, 7 reference formats, admin created. `npm run db:seed:demo` → 12 parties, 12 contacts, 4 users.
  - The browser checks then created fictional records in the development database: about 9 quotations, 6 bookings and 3 customers named "Browser Credit Ltd …" (each with a 100,000 credit limit), plus `CreditCheck` and audit rows. All fictional; nothing was reset.
- **Side effect noticed and handled:** `--advance-ref db` rewrote `Backend/backend/migrations/app/refs/db.json` with identical content (marker `9e752599…`, as committed). Only the working copy's CRLF became LF. Restored with `git checkout -- …/refs/db.json`; no content change.
- **Checks run (actual results):**
  - `npm run test:e2e` → 6 files, **142 tests pass** (112 earlier + 30 new in `test/quotations.e2e-spec.ts`), 76 s, first run.
  - Frontend: `npx next typegen` → generated. `tsc` → pass (the TS2344 errors from LOG-20261120-1309-phase2-prep-audit were stale route types). `npm run lint` → pass (one unused-variable warning fixed). `npm run build` → pass; the routes now include `/bookings` and `/bookings/[reference]`.
  - Backend `npm run build` before starting the servers → pass.
  - Headless Chrome, using a scratchpad script that drives Chrome's DevTools protocol (`browser-check.mjs`, outside the repository):
    - Run 1: 13/14. The failing check matched hint text, not a button; the hint is now hidden from users who cannot duplicate, and the check was tightened.
    - Run 2: 13/14. A test-setup fault: the reused Chrome profile kept a session cookie.
    - Runs 3 and 4 (the last on the final build): **14/14 pass**, no console errors or exceptions, no errors in the server logs.
    - The checks: signed-out redirect; the live list; create through the form; client validation; edit; record sent and accepted; convert and confirm; the bookings list; the sales credit warning (no proceed button, reason required, stop recorded); an admin proceeding with the decision shown on the booking; finance view-only; the demo-reference fallback; an unknown booking giving not found; no sideways scrolling at 390 px on 5 pages.
  - Screenshots in the scratchpad `shots/`, reviewed by eye. Two fixes followed: the outdated sidebar footer text, and booking references wrapping on phones.
- **Processes:**
  - Backend `node dist/main.js` (port 3001) and frontend `next start -p 3000` were started for the browser checks; the frontend was restarted twice after rebuilds.
  - All were stopped by the ports' owning processes (last: 3000 → 6768, 3001 → 4772).
  - Logs in the scratchpad (`backend.out/.err`, `frontend.out/.err`).
- **Frontend files:**
  - New: `lib/live-quotations.ts`, `lib/api/quotation-options.ts`, `components/quotations/live-quotation-form.tsx`, `live-quotation-detail.tsx`, `live-quotation-actions.tsx`, `live-lists.tsx`, `booking-detail.tsx`, `app/bookings/page.tsx`, `app/bookings/[reference]/page.tsx`.
  - Edited:
    - `app/quotations/page.tsx`, `[reference]/page.tsx`, `[reference]/edit/page.tsx` and `new/page.tsx`: live data; a reference the backend does not know falls back to the demo record.
    - `components/layout/nav-items.ts` and `sidebar.tsx`: `/bookings` highlights "Quotations and Bookings"; footer text updated.
    - `lib/customers.ts`: `isLivePage` includes `/quotations` and `/bookings`.
  - Demo quotation components are unchanged.
- **Documentation:**
  - `Frontend/frontend/docs/api-contracts.md`: new "Implemented (Phase 2)" section; the old proposal marked superseded; the data-access table updated.
  - `docs/backend-implementation-plan.md`: Phase 2 "As built" notes; a dated update of the stale status line.
  - `docs/IMPLEMENTATION_ROADMAP.md`: Phase 2 status.
  - This file: §4, §5, §11 and §14.
- **Correction:** the label `LOG-20261120-1415-phase2-done` had been written in advance into two documents. The actual time is 14:11, so it was renamed to `…-1412-…` with `sed`.
- **Not done / open:**
  - No commit, branch or PR (needs approval).
  - Fictional quotations not added to the demo seed.
  - No page for standalone bookings (the API exists).
  - The demo-fallback quotation pages show the "Live data" badge in the top bar, alongside their own "Demonstration data" banner.
  - The repository owner should review the 2026-11-20 credit rule and the seeded permission matrix (only admin can both book and override).
  - Phase 3 not started.
- Database/schema changes: none to the schema or migrations. Development and test databases written as above.
- Dependency changes: none.
- Commit: **not committed** · Pushed: **no**.
- Working-tree status after: on `main` at `cbad567` (= `origin/main`).
  - Modified: 13 tracked files (backend `app.module.ts`, `parties.dto.ts`; frontend quotation pages, nav, sidebar, `customers.ts`, `api-contracts.md`; `docs/IMPLEMENTATION_ROADMAP.md`, `docs/backend-implementation-plan.md`; `CLAUDE.md`).
  - Untracked: the new Phase 2 files and `docs/BACKEND_IMPLEMENTATION_ROADMAP.md`.
  - Nothing staged.

### LOG-20261120-1417-phase2-commit — Phase 2 committed on `feature/quotations-phase2` and pushed
- Time: 2026-11-20 14:17:01 +03:00 (Africa/Nairobi) — source: PowerShell `Get-Date`.
- Contributor/session: same session; operator not confirmed / Claude Code (Opus 5.5).
- **Instruction received:** "yes, create the branch, commit and push". This authorizes the branch, the commit and the push. **A PR was not mentioned, so none is opened.**
- **Starting state:** after `git fetch origin`, `main` = `origin/main` = `cbad567` (0 ahead, 0 behind). `git switch -c feature/quotations-phase2` from `cbad567`.
- **Commit content:**
  - All Phase 2 changes listed in LOG-20261120-1343-phase2-backend and LOG-20261120-1412-phase2-done.
  - This session's documentation: `CLAUDE.md` entries LOG-20261120-1246 to this one; `docs/IMPLEMENTATION_ROADMAP.md`; `docs/backend-implementation-plan.md`; `Frontend/frontend/docs/api-contracts.md`.
  - `docs/BACKEND_IMPLEMENTATION_ROADMAP.md`, the Phases 0–18 proposal, **not approved**; it is committed because `CLAUDE.md` links to it.
  - Not included: `.env` (git-ignored), `dist/`, `.next/`, scratchpad files.
- Then `git push -u origin feature/quotations-phase2` (no force). A commit cannot record its own hash; the push result is recorded in the follow-up entry below.

### LOG-20261120-1420-phase2-pushed — Push verified (follow-up to LOG-20261120-1417-phase2-commit)
- Time: 2026-11-20, about 14:20 +03:00 (Africa/Nairobi). Exact time unavailable; written after the 14:17:01 entry and the push.
- Contributor/session: same session; operator not confirmed / Claude Code (Opus 5.5).
- **Failed attempt:** the first `git commit -F -` with a PowerShell here-string failed. PowerShell split the message into pathspecs ("did not match any file(s)"), so nothing was committed. The chained `git push -u` still ran and created `origin/feature/quotations-phase2` at `cbad567` (identical to `main`, no Phase 2 changes). Nothing else was affected.
- **Retry:** `git commit -F <scratchpad commit-msg.txt>` from Git Bash → **`ec5c760`** (`ec5c7601a82569b4c8a23a4f937a3fd31c0082fe`), parent `cbad567`, 44 files, 6,796 insertions, 70 deletions. Author: this clone's Git identity (Sean Macharia).
- **Push:** `git push origin feature/quotations-phase2` → `cbad567..ec5c760`, a fast-forward with no force. Verified: `git ls-remote origin refs/heads/feature/quotations-phase2` = `git rev-parse HEAD` = `ec5c760…`. Working tree clean afterwards.
- This entry is committed and pushed as a small follow-up commit on the same branch; see `git log -1 feature/quotations-phase2`.
- **Open:**
  - No PR opened. GitHub offers `https://github.com/karechel/freight-management/pull/new/feature/quotations-phase2`; opening it needs the operator's approval.
  - The repository owner's review of the credit rule and the permission matrix.
  - Fictional quotations in the demo seed.
  - `CLAUDE.md` is near the 100,000-character archive threshold (§15 rule 7).
  - Phase 3 not started.

### LOG-20261120-1425-phase2-reconcile — Repository verified; Phase 2 branch re-validated; CLAUDE.md reconciled; history archived
- Time: 2026-11-20, from 14:22:16 (start) to 14:27:38 +03:00 (this entry written) (Africa/Nairobi) — source: PowerShell `Get-Date`.
- Contributor/session: same session; operator not confirmed / Claude Code (Opus 5.5).
- **Instruction received:** pasted brief "Phase 2 Documentation Reconciliation and Pull Request":
  - Verify the repository.
  - Reconcile §5, §11, §12, §14 and the phase status (§14 still said Phase 2 was uncommitted).
  - Re-validate the branch.
  - Open the PR with a given title and contents.
  - Never merge, delete the branch, start Phase 3, change rules or permissions, or rewrite history.
- **Repository verification (read-only):**
  - `origin` = `https://github.com/karechel/freight-management.git`; on branch `feature/quotations-phase2`; working tree clean.
  - `git fetch origin --prune`: local `feature/quotations-phase2` = `origin/feature/quotations-phase2` = `ab318bb`.
  - `ec5c7601…` is an ancestor of the branch (`git merge-base --is-ancestor` exit 0).
  - Against `origin/main` (`cbad567`): 0 behind, 2 ahead.
  - No PR exists for the branch: the public GitHub API `GET /repos/karechel/freight-management/pulls?state=all&head=karechel:feature/quotations-phase2` returned 0, using a generic User-Agent and no credentials.
  - `gh` is not installed: not on `PATH`, nor in the usual install folders.
- **Validation re-run on the branch at `ab318bb` (results from this session):**
  - Backend: `tsc` exit 0; lint exit 0; `npm test` → 10 files, 104 pass; `npm run build` pass; `prisma migration check` → "All checks passed"; `prisma db verify` → "Database marker and schema match contract"; `npm run test:e2e` → 6 files, **142 pass** (72 s; writes only the `*_test` database).
  - Frontend: `next typegen`; `tsc` exit 0; lint exit 0; build pass (includes `/bookings` and `/bookings/[reference]`).
  - Headless Chrome: the scratchpad `browser-check.mjs`, run against fresh production builds on ports 3000 and 3001 with a fresh profile → **14/14 pass**. It added a few more fictional records to the development database.
  - Servers stopped by the ports' owning processes (3000 → 28944, 3001 → 6592).
  - No failures.
- **Documentation changes:**
  - `CLAUDE.md`:
    - §4 Phase 2 row (branch, awaiting PR review).
    - §5 Phase 2 row (committed and pushed, awaiting review).
    - §6 a dated update to the authorized-phases note.
    - §11 the re-verification results.
    - §12 new items 16–19: no demo-seed quotations; no standalone-booking page; inconsistent indicators on demo-fallback pages; owner review pending.
    - **§14 rewritten** to the verified state.
  - `docs/IMPLEMENTATION_ROADMAP.md` and `docs/backend-implementation-plan.md`: Phase 2 status changed from "not committed" to "committed on `feature/quotations-phase2`, awaiting PR review".
  - No code, schema, permission or business-rule change.
- **History archived (§15 rule 7):** `CLAUDE.md` had reached 103,094 characters.
  - The five oldest §13 entries, LOG-20261116-1549-resume-sync to LOG-20261116-1658-session-close (15,487 characters), were moved verbatim and in order to the end of `docs/activity-log.md` Part C.
  - The §13 summary was updated (pointer and a 2026-11-16 bullet). No archived or remaining entry was edited.
- **Note on earlier entries:** entries up to LOG-20261120-1412-phase2-done describe Phase 2 as "not committed". That was true when they were written; LOG-20261120-1417 and -1420 record the commit and push. They are not edited.

### LOG-20261120-1430-phase2-pr — Pull request: not created from this machine (`gh` missing); link and text prepared
- Time: 2026-11-20, about 14:30 +03:00 (Africa/Nairobi). Exact time unavailable; written straight after LOG-20261120-1425-phase2-reconcile.
- Contributor/session: same session; operator not confirmed / Claude Code (Opus 5.5).
- **Outcome:** **no PR was created.**
  - The GitHub CLI is not installed. Installing it would add software to the machine and is not authorized.
  - Using the Git credential helper's stored token directly was deliberately not done: it would mean extracting a credential without permission.
  - The PR must be opened in the browser by a contributor signed in to GitHub.
- **PR details prepared:**
  - Base `main`, head `feature/quotations-phase2`.
  - Commits: `ec5c760` (Phase 2), `ab318bb` (push log), plus the commit that contains this entry.
  - Title: "Phase 2: Quotations, Bookings and Credit Controls".
  - Creation link: `https://github.com/karechel/freight-management/compare/main...feature/quotations-phase2?expand=1`.
  - The description (scope, the credit rule as implemented, the override audit trail, archived-customer restrictions, frontend, tests, owner-review items, known gaps) is in the session scratchpad `pr-body.md` and was given to the operator in the session reply.
- **Not done:** no merge, no branch deletion, Phase 3 not started.
- **Commit:** this entry and LOG-20261120-1425-phase2-reconcile are committed together on `feature/quotations-phase2` and pushed. The hash and push are verified in the session reply (`git ls-remote origin refs/heads/feature/quotations-phase2`).

## 14. Current handover state

Earlier handover states (up to 2026-11-04, as at `d966e35`) are archived in `docs/activity-log.md`, Part B. Rewritten on 2026-11-20 (LOG-20261120-1425-phase2-reconcile), because the earlier text still said Phase 2 was uncommitted and not started.

- **Git (verified 2026-11-20 with `git fetch` and `git rev-parse`):**
  - `main` = `origin/main` = `cbad567`. It contains PR #1 (frontend), #2 (database schema), #3 (backend Phase 0), #4 (Phase 1 customers, merge `d966e35`) and the 2026-11-16 documentation commits.
  - **`feature/quotations-phase2`** exists locally and on `origin`, 2 commits ahead of `main` and 0 behind:
    - `ec5c760`: Phase 2 implementation, tests and docs.
    - `ab318bb`: the log entry for that push.
    - Plus the documentation-reconciliation commit from LOG-20261120-1425-phase2-reconcile.
  - The old feature branches still exist on `origin`.
- **Done:**
  - Backend Phases 0 and 1 (on `main`).
  - **Backend Phase 2, quotations and bookings: implemented, committed and pushed on `feature/quotations-phase2`. It awaits PR review and merging by the repository owner.**
  - Phase 2 checks were re-run on the branch on 2026-11-20, all passing: 104 unit, 142 end-to-end, 14/14 browser (§11).
  - Live pages: sign-in, Customers, Settings › Numbering, Quotations (list, detail, new, edit) and Bookings (list, detail). All other pages still use fictional demo data in the browser session.
- **Pull request:** to be opened from `feature/quotations-phase2` into `main`; see the newest §13 entry for its number or link. Do not merge without the repository owner.
- **Phase 3 (shipments and tracking): not started.** It needs the operator's explicit approval, after Phase 2 is merged.
- **Waiting for the repository owner (Phase 2):**
  - The **credit rule** decided by the operator on 2026-11-20 and not yet approved by the owner: outstanding issued-invoice balance + booking value (quotation total, or the estimated value of a standalone booking) against the credit limit; customers without a limit are not checked.
  - The **permission matrix:** only admin holds both `quotations.manage` and `credit.override`. Sales can create bookings but cannot override; finance and management can override but cannot create bookings. Whether to change this is the owner's decision; no permissions were changed.
  - The four 2026-11-04 Phase 1 decisions (§9).
- **Known Phase 2 gaps** (§12 items 16–18): no fictional quotations or bookings in the demo seed; no page for standalone bookings (the API exists); demo-fallback quotation pages show both the "Live data" badge and a "Demonstration data" banner.
- **This machine (collaborator's clone):** set up for backend work on 2026-11-20:
  - Node 24.20.0; `npm ci` (backend); the `.env` keys.
  - Development database migrated (marker `9e752599…`) and seeded; it also holds fictional records created by the browser checks.
  - The `*_test` database exists.
  - `gh` (GitHub CLI) is **not installed**.
- **Other open decisions:** the KRA PIN format (later); Phase 4 scope; keep or remove the `deploy` script; Prisma RC vs stable and the unused `@prisma/client` 7; `helmet` and a shared rate limiter before launch; an accountant's review of the seeded tax defaults (and of the line tax-category default added in Phase 2); KRA iCMS access; review of the unapproved roadmap proposal `docs/BACKEND_IMPLEMENTATION_ROADMAP.md`.
- **Housekeeping:** this file is close to the 100,000-character threshold in §15 rule 7. The next session should move the oldest §13 entries to `docs/activity-log.md`.
- **Security:** `GET /` was removed in Phase 0. Signing out does not revoke the token (valid up to 8 hours). Demo pages are open without sign-in, so use fictional data only until each page goes live.

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
