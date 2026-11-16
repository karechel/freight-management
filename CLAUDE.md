# CLAUDE.md — Freight Management (shared handover + activity log)

> Shared by two human contributors working from different computers and separate Claude Code sessions.
> The repository and Git history are the evidence of actual code state; this file is the handover record.
> Keep **requirements**, **implementation facts**, **recommendations** and **open questions** clearly separated.
>
> **Read before making changes** (this file stays short; details live in these files):
> - `docs/IMPLEMENTATION_ROADMAP.md`: every phase, its status and what remains. Read it before starting or planning any phase.
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
| `docs/activity-log.md` | Archived activity log (2026-10-05 to 2026-11-04), the 2026-10-15 documentation audit and older handover states, moved verbatim from this file on 2026-11-16 |
| `Backend/backend/src/auth/` | Sign-in, scrypt password hashing, JWT, global guard, `@Public()` and `@RequirePermission()` |
| `Backend/backend/src/references/` | Configurable reference formats: template rules, generation, admin API |
| `Backend/backend/src/common/`, `src/audit/`, `src/app.setup.ts` | Error format and database-error mapping, pagination DTO, audit log service, global HTTP setup |
| `Backend/backend/src/parties/` | Customers and contacts API (reused by agents and partners later): rules, DTOs, service, controller. `src/common/parse-id.pipe.ts` reads ids from URLs |
| `Frontend/frontend/app/parties/`, `components/customers/`, `lib/customers.ts`, `lib/customer-form.ts`, `lib/api/server.ts` | Live Customers pages, their rules and types, and backend reads made while rendering on the server |
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

**The roadmap is in `docs/IMPLEMENTATION_ROADMAP.md`** (all phases, status, dependencies, completion criteria). The approved scope of each backend phase is in `docs/backend-implementation-plan.md`. The 2026-10-15 recommendation list that used to be here is preserved in the roadmap's "Superseded plans" section (moved 2026-11-16).

**Authorized phases:** documentation (2026-10-15); **frontend development** (2026-10-19, collaborator; frontend only, see §16.6 decision 3); **database design and schema implementation** (2026-10-26, repository owner: approved schema, Node 24.20.0 pin, migration on the owner's own local DB, on branch `feature/database-schema`). **Backend Phase 0** (2026-11-03, repository owner: foundation, auth, `ReferenceFormat` migration, local test database, seeding the owner's local DB; on `feature/backend-foundation`; see `docs/backend-implementation-plan.md`). Later backend phases follow that plan. Integrations and deployment are **not** authorized. **Backend Phase 1** (customers) was built and merged on 2026-11-04. **Phase 2 has not started:** the repository owner's instruction relayed on 2026-11-16 is to implement Phases 2, 3 and 4 one at a time, but each start needs the operator's explicit approval in the session (LOG-20261116-1549-resume-sync).

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
- **Latest results (2026-11-04, local clone with Git identity PPSOne-02, Node 24.20.0, PostgreSQL 17.11, LOG-20261104-1056-phase1):**
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

## 13. Shared activity log

Append-only, oldest first. Never edit past entries; corrections are new entries referencing the original. Never record secrets.

**Older entries are archived verbatim in `docs/activity-log.md`, Part C** (LOG-20261005-2211-CK to LOG-20261104-1135-phase1-commit, moved 2026-11-16 by LOG-20261116-1554-docs-restructure). Summary of the archived period, for orientation only:
- **2026-10-05 – 10-15:** initial scaffold (`b68a0cd`); the commit titled "Phase 0" (`42ae8a8`: test and env fixes, before the backend plan defined its own Phase 0); read-only audit; this handover file; documentation audit (archive Part A) and its corrections.
- **2026-10-19 – 10-22:** frontend on fictional demo data (`feature/frontend-foundation`), built in three frontend "phases" (shipments and delays; quotations, customers and agents; document uploads), then the grouped sidebar, expenses, reports, users, settings and audit log, notifications and tasks; headless-browser review; fresh-clone check.
- **2026-10-26 – 10-29:** database schema (33 tables, migrations) and Node 24.20.0 pin (`feature/database-schema`); PRs #1 and #2 merged; read-only backend audit.
- **2026-11-03 – 11-04:** backend plan approved; backend Phase 0 (sign-in, permissions, reference formats, seeds) and Phase 1 (customers) built, verified, committed and pushed; PR #3 merged. The PR #4 merge is recorded in LOG-20261116-1549-resume-sync.

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

### LOG-20261116-1549-resume-sync — Resume after break: read-only phase audit, switch to `main` and fast-forward pull
- Time: session started 2026-11-16 14:49:20 +03:00; pull ran 15:48:42–15:48:48 +03:00; this entry written shortly after (Africa/Nairobi) — source: PowerShell `Get-Date`.
- Contributor/session: collaborator's local clone (Git identity Sean Macharia, unchanged); **operator not confirmed in this session** (the Claude Code account signed in differs from the clone's Git identity; confirmation requested) / Claude Code (Opus 5.5).
- **Instructions received:**
  1. Pasted brief "Resume, Documentation Recovery and Phase Audit", relaying the repository owner's instructions:
     - Pull `main`.
     - Summarize Phases 0 and 1 and list the remaining phases.
     - Restructure `CLAUDE.md` below the 150k-character limit.
     - Do not implement Phase 2 yet.
     - Stop before pulling if not on `main` or if the working tree is dirty.
  2. Pasted standing instruction "Maintain a Complete and Accurate Activity Log in CLAUDE.md": log every session completely and factually, throughout the session, never rewriting history; a final documentation check before ending. This restates §9 and §15 rule 2, and now applies to every future session.
  3. "yes, switch to main and pull".
- **Starting state:**
  - Branch `feature/frontend-foundation` = `9c5bdf3` = `origin/feature/frontend-foundation`.
  - Working tree clean: no modified, staged or untracked files. No stashes.
  - Local `main` = `883f93b`. `origin` = `https://github.com/karechel/freight-management.git`.
- **Commands that changed state:**
  - `git fetch origin --prune`:
    - `origin/main` moved `883f93b` → `d966e35`.
    - New remote branches: `feature/backend-foundation`, `feature/customers-phase1`, `feature/database-schema`.
    - The PowerShell call reported exit code 255, although every command in it printed its output. The most likely cause is a final `Select-Object -First 80` truncating `git log` output; not investigated further.
  - After the operator's approval: `git switch main`, then `git pull --ff-only origin main` → fast-forward `883f93b..d966e35`, 219 files changed. Afterwards `main` = `origin/main` (0 ahead, 0 behind) and the working tree was clean.
  - Nothing was stashed, reset, merged or rebased, and nothing was pushed.
- **Findings (read-only, from Git and from files on `origin/main`):**
  - `feature/frontend-foundation` (`9c5bdf3`) is an ancestor of `origin/main`, so nothing on it is missing from `main`.
  - The repository owner merged four PRs:
    - #1 `f663dd2`: frontend.
    - #2 `293a951`: database schema.
    - #3 `ff7d6fb`: backend Phase 0 (`af73edf`).
    - #4 `d966e35`: Phase 1 customers (`94a575f`). Merged 2026-11-04 11:40:52 +03:00; `git diff 94a575f d966e35` is empty.
  - "Phase 0" and "Phase 1" now refer to the backend phases in `docs/backend-implementation-plan.md` (approved 2026-11-03). They are not the October frontend "phases 1–3".
  - Phases 2 (quotations and bookings), 3 (shipments and tracking), 4 (remaining modules, scope "to be agreed") and 5 (client data import) are not started.
  - The schema already has the 33 models Phases 2–3 need, including `Quotation`, `QuotationLine`, `Booking`, `CreditCheck` and `Shipment`.
  - `CLAUDE.md` on `main`: 231,661 characters (`wc -m`) before this entry, over Claude Code's 150k-character limit. The 174.7k figure Claude Code reported was the older copy on `feature/frontend-foundation`.
  - Discrepancy: §15 rule 7 names `docs/activity-log.md` for moved history; the brief proposes `docs/PROJECT_HISTORY.md`. Awaiting the operator's choice.
- **Correction (to LOG-20261104-1135-phase1-commit and §5, §12, §14; originals left unchanged):** PR #4 **was merged** into `main` as `d966e35` on 2026-11-04 11:40:52 +03:00, by the GitHub account recorded as committer "Chelsea Nyaga" (Git metadata). The merge was not logged before this entry. §5 rows and §12 items that say "branch, not merged" for Phase 0 or Phase 1 are out of date: both are on `main`.
- **Checks and tests:**
  - Not run in this session: `tsc`, lint, unit, end-to-end and browser tests, and builds.
  - No `node_modules` reinstall (`npm ci`), no `.env` changes, no Prisma or database commands.
  - The Phase 0/1 results quoted to the operator were the recorded ones in §11, not re-verified.
- **Deliberately not changed:**
  - Application code, configuration, dependencies, schema, migrations.
  - `CLAUDE.md` restructuring, pending the operator's decisions on the history file name and on direct-to-`main` vs. branch and PR. §5, §12 and §14 are not rewritten yet; the correction above records the facts.
  - Phase 2 not started (explicit approval required).
- **Outside the repository:**
  - Session scratchpad: `main-CLAUDE.md`, `plan.md`, `dbdesign.md` (copies via `git show origin/main:…`) and `session-notes-20261116.md` (running notes).
  - The first extraction failed because the scratchpad folder did not exist yet; it was created and the command retried.
  - Claude Code memory note `log-every-phase-in-claude-md.md`, rewritten to hold the standing logging instruction.
- **This machine still needs setup before backend work** (not done; each step that writes to a database needs approval):
  - Node 24.20.0 (`.nvmrc`).
  - `npm ci` in both apps.
  - Backend `.env` entries (`JWT_SECRET`, `CORS_ORIGINS`, admin and demo passwords; see `Backend/backend/.env.example`).
  - A local PostgreSQL with migrations and `npm run db:seed` (plus `db:seed:demo`).
  - This machine's database state is unknown.
- **Awaiting decisions:**
  1. History file name (`docs/activity-log.md` or `docs/PROJECT_HISTORY.md`).
  2. Commit the documentation restructure straight to `main`, or via a branch and PR.
  3. Operator identity for the log.
  4. Approval to start Phase 2.
  5. Repository owner's review of the four 2026-11-04 decisions (§9).
- Database/schema changes: none · Dependency changes: none · Application code: unchanged by this session.
- Files edited: `CLAUDE.md` (this entry only). Commit: not committed · Pushed: no.
- Working-tree status after: branch `main` = `origin/main` = `d966e35`; `CLAUDE.md` modified (this entry); nothing staged.

### LOG-20261116-1554-docs-restructure — `CLAUDE.md` split below the size limit; history archived; roadmap written; committed to `main`
- Time: 2026-11-16, from about 15:50 to 15:53:58 +03:00 (the label time), then the checks and commit below (Africa/Nairobi) — source: PowerShell `Get-Date`. The exact start time was not recorded.
- Contributor/session: same session as LOG-20261116-1549-resume-sync; operator not confirmed / Claude Code (Opus 5.5).
- **Instructions received:**
  - "use docs/activity-log.md and commit straight to main".
  - This answers the two questions in LOG-20261116-1549-resume-sync: the history file name (as §15 rule 7 already said), and committing the documentation directly to `main`.
  - **Pushing was not mentioned**, so nothing is pushed until the operator approves it.
- **Starting state:** branch `main` = `origin/main` = `d966e35`. Only `CLAUDE.md` modified (LOG-20261116-1549-resume-sync), at 241,385 characters.
- **What changed:**
  - **Created `docs/activity-log.md`** (about 189k characters). It holds, verbatim, the blocks taken from `CLAUDE.md` as committed at `d966e35` (`git show HEAD:CLAUDE.md`):
    - Part A: former §16 audit.
    - Part B: former §14 handover states.
    - Part C: all 50 former §13 entries, LOG-20261005-2211-CK to LOG-20261104-1135-phase1-commit, oldest first.
    - A short introduction with rules: do not edit; new entries go in `CLAUDE.md`; section numbers refer to the old layout.
  - **Created `docs/IMPLEMENTATION_ROADMAP.md`:**
    - the three meanings of "phase"
    - the work done before the plan
    - backend Phases 0–5 with status, dependencies, schema, endpoints, tests and completion criteria (criteria marked "proposed" where the approved plan has none)
    - open items
    - the former §6 recommendation list, unchanged, under "Superseded plans"
  - **Rebuilt `CLAUDE.md`** (scratchpad script `split-claude.mjs` and text file `new-sections.md`):
    - A "Read before making changes" block at the top lists the supporting documents.
    - §1–§12 kept in place.
    - §13: the template and LOG-20261116-1549-resume-sync, with a summary of the archived period and a pointer to it.
    - §14 rewritten for the current state.
    - §15 rules 1, 2 and 5 extended; rule 7 replaced by the archiving procedure; rule 8 explains old section numbers.
    - §16 replaced by a pointer to archive Part A.
  - **Living-section updates in `CLAUDE.md`**, factual and based on the merges recorded in LOG-20261116-1549-resume-sync:
    - §3: heading, and the backend-foundation line.
    - §4: rows for the two new docs.
    - §5: Phase 0 and Phase 1 rows now say merged; module rows updated (auth Verified; customers Verified; users in progress; the rest planned).
    - §6: replaced by a pointer to the roadmap; authorized-phases note extended (Phase 1 merged; Phase 2 not started and needs approval).
    - §8: `GET /` removed.
    - §12: items 1, 2, 5, 8, 9 and 12 now say "on `main`"; item 10 points to the roadmap.
  - **Not changed:** §9 decisions, §10 setup, §11 results, and all archived entries. Earlier log entries are not edited; the facts that superseded them are recorded here and in LOG-20261116-1549-resume-sync. The `IMPLEMENTATION_ROADMAP.md`, `PROJECT_HISTORY.md` and `TECHNICAL_REFERENCE.md` layout in the brief was adapted:
    - `docs/activity-log.md` is used instead of `PROJECT_HISTORY.md`, on the operator's instruction.
    - **No `TECHNICAL_REFERENCE.md` was created.** §3, §4, §7, §10, §11 and §12 stay in `CLAUDE.md`, where every session loads them, because moving the history alone brought the file well under the limit.
- **Checks run before the commit:**
  - Scratchpad `verify-split.mjs` compares against `git show HEAD:CLAUDE.md`. Results:
    - The former §13 entry block, §14 and §16 bodies appear verbatim in the archive.
    - 50 entries in HEAD and 50 in the archive, in the same order, none missing.
    - No archived entry is duplicated in `CLAUDE.md`.
  - Sizes: `CLAUDE.md` 61,064 characters before this paragraph was added (limit 150,000); `docs/activity-log.md` 189,118.
  - `git diff --check` → exit 0. `git diff --no-index --check` on the two new files → no whitespace errors (exit 1 only because the files differ from `/dev/null`).
  - Git warned that LF will be replaced by CRLF in this working copy (`core.autocrlf=true`); committed content is LF.
  - Pattern scan of the three files for connection strings, `password=`, `secret=`, private keys and personal email domains → no matches.
- **Commit:** only `CLAUDE.md`, `docs/activity-log.md` and `docs/IMPLEMENTATION_ROADMAP.md` are staged. Commit message: "docs: archive activity log, add implementation roadmap and slim CLAUDE.md", parent `d966e35`, directly on `main`. A file cannot record its own hash; see `git log -1 main`. **Not pushed** (not yet authorized). The hash is recorded in a follow-up entry.
- **Failed attempt / correction:** the entry label was first written in advance as `…-1602-…`. The actual time was 15:53:58, so it was renamed to `…-1554-…` in `CLAUDE.md`, the archive introduction and the roadmap with `sed` (5 occurrences). Archived entries were not touched.
- **Outside the repository** (session scratchpad): `split-claude.mjs`, `new-sections.md`.
- Database/schema changes: none · Dependency changes: none · Application code and configuration: unchanged · Tests: none run (documentation only).

### LOG-20261116-1555-commit-confirmed — Result of the LOG-20261116-1554-docs-restructure commit (not pushed)
- Time: 2026-11-16 15:55:08 +03:00 (commit), 15:55:09 (check) (Africa/Nairobi) — source: `git log`, PowerShell `Get-Date`.
- Contributor/session: same session; operator not confirmed / Claude Code (Opus 5.5).
- Commit: `773db22` (`773db22c83cc3a11248b4ec60f271a5966b5b136`), parent `d966e35`, on `main`, authored under this clone's Git identity (Sean Macharia; unchanged). 3 files: 1,777 insertions, 1,450 deletions; two files created. `git commit` exit 0.
- Committed `CLAUDE.md`: 62,568 characters.
- **Not pushed:** `main` is 1 commit ahead of `origin/main` (`d966e35`). Pushing needs the operator's approval.
- **This entry is uncommitted.** It goes into the next approved commit.
- Working-tree status after: `CLAUDE.md` modified (this entry only); nothing staged.

### LOG-20261116-1657-push — Commit the follow-up entry and push `main`
- Time: 2026-11-16 16:57:08 +03:00 (Africa/Nairobi) — source: PowerShell `Get-Date`.
- Contributor/session: same session; operator not confirmed / Claude Code (Opus 5.5).
- **Instruction received:** "commit the log entry and push to main". This authorizes pushing `773db22` and this commit.
- **Starting state:** `main` = `773db22`; `git fetch origin` → `origin/main` still `d966e35` (1 ahead, 0 behind), so the push is a fast-forward. Only `CLAUDE.md` modified (LOG-20261116-1555-commit-confirmed).
- **What changed:** this entry and LOG-20261116-1555-commit-confirmed committed (`CLAUDE.md` only), then `git push origin main` (no force).
- **Push result:** a commit cannot record its own hash or the push that follows it. Verify with `git ls-remote origin main`, which should match `git rev-parse main`. If the push had failed, the next session must record that here as a new entry.
- Database/schema changes: none · Dependency changes: none · Application code: unchanged · Tests: none run (documentation only).
- **Still open:** approval to start Phase 2; operator identity; the repository owner's review of the four 2026-11-04 decisions; machine setup for backend work (§14).

### LOG-20261116-1658-session-close — Push confirmed; operator identified; session closed
- Time: 2026-11-16 16:58:25 +03:00 (Africa/Nairobi) — source: PowerShell `Get-Date`.
- Contributor/session: **Sean (collaborator)**, stated by the operator in this session ("Sean worked on this session") / Claude Code (Opus 5.5). This applies to every 2026-11-16 entry above (LOG-20261116-1549-resume-sync to LOG-20261116-1657-push), which said "operator not confirmed". Those entries are not edited. The Claude Code account signed in during the session belongs to a different person than the Git identity; the operator's statement is recorded as given.
- **Instruction received:** "just make sure everything is committed and pushed for now. Sean worked on this session".
- **Push result for LOG-20261116-1657-push (verified):** `git push origin main` → `d966e35..3bcc128 main -> main`. Afterwards `git ls-remote origin main` = `git rev-parse main` = `3bcc128186e8cc8f06eb5f40dba88abf5b9b9d0d`; working tree clean.
- **What changed:** this entry, and §14 "Awaiting decisions" (operator identity removed as resolved). Committed and pushed to `main` with the operator's authorization. The hash of this commit is visible with `git log -1 main`.
- **Not done (deliberately):** Phase 2 not started; no machine setup; no tests, builds or database commands. Database/schema changes: none · Dependency changes: none · Application code: unchanged.
- **Unfinished items for the next session:**
  - Approval to start Phase 2.
  - The repository owner's review of the four 2026-11-04 decisions (§9).
  - Machine setup for backend work on this clone (§14).
- Working-tree status after: expected clean, with `main` = `origin/main`. Confirm with `git status` at the start of the next session.

## 14. Current handover state

Earlier handover states (up to 2026-11-04, as at `d966e35`) are archived in `docs/activity-log.md`, Part B.

- **Git (2026-11-16, LOG-20261116-1554-docs-restructure):** `main` contains PR #1 (frontend), #2 (database schema), #3 (backend Phase 0) and #4 (Phase 1 customers, merge `d966e35`), plus the documentation restructure commit made in that session. Verify with `git log -1 main` and `git ls-remote origin`. The old feature branches still exist on `origin`.
- **Done:** backend Phase 0 and Phase 1, recorded as verified in §11 (not re-run on 2026-11-16). Live pages: sign-in, Customers, Settings › Numbering. All other pages still use fictional demo data in the browser session.
- **Next:** Phase 2, quotations and bookings (`docs/IMPLEMENTATION_ROADMAP.md`), **awaiting explicit approval**. Phase 2 must refuse new work for archived customers (`docs/backend-implementation-plan.md` §6).
- **Machine setup:** the collaborator's clone (Git identity Sean Macharia) has not been set up for backend work since the merges: Node 24.20.0, `npm ci` in both apps, the new `.env` keys, a local PostgreSQL with migrations and seeds (§10). Its database state is unknown. Any database that already had Phase 0 needs `npm run db:seed` after pulling Phase 1.
- **Awaiting decisions:**
  - Approval to start Phase 2.
  - The repository owner's review of the four 2026-11-04 decisions (§9).
  - The KRA PIN format, later.
  - Phase 4 scope.
  - Keep or remove the `deploy` script.
  - Prisma RC vs stable, and the unused `@prisma/client` 7.
  - `helmet` and a shared rate limiter before launch.
  - An accountant's review of the seeded tax defaults.
  - KRA iCMS access.
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
