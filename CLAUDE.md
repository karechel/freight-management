# CLAUDE.md — Freight Management (shared handover + activity log)

> Shared by two human contributors working from different computers and separate Claude Code sessions.
> The repository and Git history are the evidence of actual code state; this file is the handover record.
> Keep **requirements**, **implementation facts**, **recommendations** and **open questions** clearly separated.

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

## 3. Architecture and technology stack (ACTUAL, as of commit `42ae8a8`)

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
- **Backend foundation (2026-11-03, on `feature/backend-foundation`, LOG-20261103-2218-phase0):** routes under `/api` (except `/health`); global `ValidationPipe` (`class-validator`, `class-transformer`); one error format; JWT sign-in with a guard that protects every route by default; permissions read from the database on each request. Details: `docs/backend-implementation-plan.md`.
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
| `docs/backend-implementation-plan.md` | Approved backend plan: decisions, API conventions, reference-number and auth design, phases; Phase 0 "as built" notes |
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
| Customers (Phase 1): list, search, filters, paging, create, edit, archive, restore, contacts, calculated figures, per-role billing access | **Verified** 2026-11-04 (branch `feature/customers-phase1`, not committed yet) | LOG-20261104-1056-phase1 and LOG-20261104-1120-phase1-decisions: 70 unit tests, 112 end-to-end tests, 91 browser checks. Live pages need sign-in |
| Backend foundation: validation, error format, sign-in, permission guard, audit service, seed scripts | **Verified** 2026-11-03; merged to `main` (PR #3) | LOG-20261103-2218-phase0: 37 unit tests, 34 end-to-end tests, 27 browser checks |
| Configurable reference formats | **Verified** 2026-11-03 (branch, not merged) | Includes concurrency, rollback and "issued references never change" tests. No record type uses them yet; quotations are first, in Phase 2 |
| Frontend sign-in, sign-out, Numbering editor | **Verified** in headless Chrome 2026-11-03 (branch, not merged) | Demo pages remain open without signing in |
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
| `GET /` list all users | **Removed** on `feature/backend-foundation` 2026-11-03; still on `main` until that branch merges | End-to-end test confirms 404 |
| Modules 1 and 3–16 (§2) | Planned | No code, models or config found |
| Module 2 (users/staff) | In progress (minimal) | Only the `User` model above; no roles, auth or management features |
| KRA iCMS integration | Planned; possibly **Blocked** on KRA onboarding/accreditation (assumption from general domain knowledge; not established by repository evidence; status of any application unknown) | No code |
| M-Pesa integration | **Removed from scope** (repository owner, 2026-10-26: cheque and bank transfer only) | No code. The frontend demo still offers `mpesa` as a payment method (`lib/types.ts`); see `docs/database-design.md` §7 |

Last checks actually run (2026-10-15 audit, read-only): see §11.

## 6. Planned features and roadmap (RECOMMENDATIONS — none authorized unless marked)

1. Write requirements + phase plan into the repo; define what "Phase 0" covers (commit `42ae8a8` is titled "Phase 0" but no definition exists).
2. Phase 0 hygiene: remove/protect `GET /`; declare `dotenv`; fix `supertest/types` type error; `.gitattributes` + Prettier; handle `deploy` script; CORS/env fallback.
3. Decide Prisma direction (stay on 8 RC vs stable; remove unused `@prisma/client` 7); document migration workflow on a disposable local DB.
4. Auth + roles, global validation and exception handling.
5. CI (lint, type-check, unit tests).
6. Core domain: customers → shipments/jobs → documents (private storage) → tracking.
7. Finance, then integrations (M-Pesa sandbox first; KRA iCMS once access is confirmed).

**Authorized phases:** documentation (2026-10-15); **frontend development** (2026-10-19, collaborator; frontend only, see §16.6 decision 3); **database design and schema implementation** (2026-10-26, repository owner: approved schema, Node 24.20.0 pin, migration on the owner's own local DB, on branch `feature/database-schema`). **Backend Phase 0** (2026-11-03, repository owner: foundation, auth, `ReferenceFormat` migration, local test database, seeding the owner's local DB; on `feature/backend-foundation`; see `docs/backend-implementation-plan.md`). Later backend phases follow that plan. Integrations and deployment are **not** authorized.

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
- `GET /` currently exposes all user emails/names unauthenticated — must be removed or protected before any real data exists.
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

1. `GET /` returns all users unauthenticated (`Backend/backend/src/app.service.ts`). **Fixed on `feature/backend-foundation`; still on `main` until it merges.**
2. No helmet, shared rate limiter or logging config (decide before launch). Auth, authorization, `ValidationPipe` and the exception filter exist on `feature/backend-foundation`. Pages still on demo data are not behind sign-in.
3. Prisma 8 is a release candidate with caret ranges; unused Prisma 7 `@prisma/client` installed alongside.
4. No SQL migrations; DB creation process undocumented. (Update 2026-10-26: Prisma 8 migration packages now exist and the process is documented in `docs/database-design.md` §8. Prisma 8 still has no SQL migration files; `migration show` prints the SQL.)
5. `dotenv` imported (`main.ts`, `db.ts`, `prisma.config.ts`) but not a declared dependency. **Fixed on `feature/backend-foundation`.**
6. `Backend/backend/src/prisma/db.ts` creates the Prisma client at import time using `DATABASE_URL!` (non-null assertion, no validation in that path); the connection itself opens lazily on the first query (`@prisma/orm-postgres/dist/runtime.mjs`, `getRuntime()`). The e2e test imports `AppModule` directly and therefore bypasses `validateEnv()`.
7. `deploy` script (`nest deploy`) deploys to the cloud via NestJS Mau (verified from `@nestjs/cli` source). Whether this incurs cost is unknown from the repo; treat it as potentially paid and do not run it.
8. CORS origin hard-coded (**now `CORS_ORIGINS` on `feature/backend-foundation`**). (Since 2026-10-19 the frontend shows an "API not configured" state when `NEXT_PUBLIC_API_URL` is unset, instead of failing.)
9. TS2307 in e2e test (**gone on `feature/backend-foundation`**: that test was rewritten; the original cause was never determined); Prettier drift: `--check` flags 10 files on a working copy checked out with CRLF (`core.autocrlf=true`, a per-machine Git setting), while committed files are LF (`git ls-files --eol`). Ignoring line endings (`--end-of-line auto`), 8 files are flagged, including the generated `src/prisma/contract.d.ts`. No `.gitattributes` exists, so line endings depend on each developer's Git config. No CI; boilerplate READMEs/metadata; TS 5.9 (frontend) vs 6.0 (backend).
10. No requirements document or phase definitions in the repo.
11. `.env.example` uses placeholder DB name `freight_management`; developers' actual DB names may differ (expected — placeholder only).
12. (2026-10-26, updated 2026-11-03) No business endpoints use the schema yet. Seeding and reference generation exist on `feature/backend-foundation`; allocation limits and the credit-limit check come with their phases. Tax defaults on the seeded charge types are a starting guess and need the company accountant's review.
13. (2026-10-26) The frontend demo types differ from the database in places (`USD` currency, `mpesa`, a stored `booked` quotation status, integer-cent prices, a single customs entry per shipment). See `docs/database-design.md` §7. The API layer or the frontend must reconcile these.
14. (2026-10-26) Applying a migration to a fresh database (baseline + delta) has not been tested; only the delta was applied, on the repository owner's DB. **Resolved 2026-11-03: the test database migrates from empty on the first end-to-end run.**
15. (2026-11-03) Signing out does not revoke a token (no server-side session store): a stolen token works until it expires, up to 8 hours, unless the user is disabled. The login limit is in memory, so it resets on restart and applies per server process.

## 13. Shared activity log

Append-only, oldest first. Never edit past entries; corrections are new entries referencing the original. Never record secrets.

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

### LOG-20261005-2211-CK — Initial project setup (reconstructed from Git)
- Time: commit time 2026-10-05 22:11:20 +03:00. Exact change time unavailable.
- Contributor/session: Chelsea (Git author). Session details unknown.
- What changed: commit `b68a0cd`, 47 files — Next.js scaffold with health-check page; NestJS scaffold wired to Prisma 8 (`User` model, `GET /`, `GET /health`, CORS); generated contract and migration snapshot; tests still asserting old "Hello World!".
- Files: see `git show --stat b68a0cd`.
- Commit: `b68a0cd` · Pushed: yes (present on `origin/main`).

### LOG-20261009-1314-SM — "Phase 0" fixes (reconstructed from Git)
- Time: commit time 2026-10-09 13:14:36 +03:00. Exact change time unavailable.
- Contributor/session: Sean Macharia (Git author), co-authored with Claude Sonnet 5 (per commit trailer). Conversation not available.
- What changed: updated unit/e2e tests to match DB-backed `getHello()`; added `DATABASE_URL` validation; `main.ts` loads dotenv, validates, then dynamically imports `AppModule`; added `.env.example` files; un-ignored `.env.example` in frontend.
- Files edited: `Backend/backend/src/app.controller.spec.ts`, `Backend/backend/src/main.ts`, `Backend/backend/test/app.e2e-spec.ts`, `Frontend/frontend/.gitignore`. Created: `Backend/backend/.env.example`, `Backend/backend/src/config/env.validation.ts`, `Backend/backend/src/config/env.validation.spec.ts`, `Frontend/frontend/.env.example`.
- Checks run and results: not recorded.
- Commit: `42ae8a8` · Pushed: yes (confirmed 2026-10-15 via `git ls-remote origin` showing `refs/heads/main` = `42ae8a8`).

### LOG-20261015-1423-SM — Read-only audit
- Time: 2026-10-15 14:23:06 +03:00 (Africa/Nairobi) — source: PowerShell `Get-Date`.
- Contributor/session: Sean Macharia's machine / Claude Code (Opus 5.5).
- What changed: nothing. Read-only audit of repo, Git history, config and code.
- Checks run and results: see §11 (tsc, oxlint, prettier --check, eslint). `git ls-remote origin` → `main` = `42ae8a8`, local in sync.
- Commit: none · Working tree after: clean.

### LOG-20261015-1431-SM — Created root CLAUDE.md
- Time: 2026-10-15 14:31:55 +03:00 (Africa/Nairobi) — source: PowerShell `Get-Date`, taken immediately before writing.
- Contributor/session: Sean Macharia's machine / Claude Code (Opus 5.5), authorized by the collaborator for documentation only.
- What changed: created this file (shared handover + activity log). No prior root `CLAUDE.md` existed; `Frontend/frontend/CLAUDE.md` and `AGENTS.md` left untouched.
- Why: give both contributors and future Claude sessions a persistent, evidence-based handover.
- Files created: `CLAUDE.md`. Edited/deleted: none.
- Database/schema changes: none. Dependency changes: none.
- Checks run: none (documentation only).
- Commit: not committed · Pushed: no.
- Working-tree status after: `CLAUDE.md` untracked; everything else unchanged.

### LOG-20261015-1438-audit — Documentation accuracy audit (§16 appended)
- Time: 2026-10-15 14:38:44 +03:00 (start); append completed 2026-10-15 14:42:23 +03:00 (Africa/Nairobi) — source: PowerShell `Get-Date`.
- Contributor/session: collaborator's local clone (Git identity Sean Macharia) / Claude Code (Opus 5.5).
- What changed: appended §16 (documentation accuracy audit) to `CLAUDE.md`; sections 1–15 unchanged at that time.
- Why: verify the handover document before it is committed and shared.
- Files edited: `CLAUDE.md` (append only). Created/deleted: none in the repository.
- Database/schema changes: none · Dependency changes: none.
- Checks run and results: backend tsc (1 error TS2307 in `test/app.e2e-spec.ts`), oxlint pass, prettier --check 10 files (8 with `--end-of-line auto`); frontend tsc pass, eslint pass. Tests, builds and `npm audit` not run.
- Known failures: first append attempt failed (shell quoting error); verified via file hash that it wrote nothing before retrying.
- Commit: not committed · Pushed: no.
- Working-tree status after: `CLAUDE.md` untracked; nothing else changed.
- Note: this entry was added later, in LOG-20261015-2305-corrections (AUDIT-007).

### LOG-20261015-2305-corrections — Applied Necessary corrections from §16
- Time: 2026-10-15 23:05:50 +03:00 (Africa/Nairobi) — source: PowerShell `Get-Date`, taken immediately before editing.
- Contributor/session: collaborator's local clone (Git identity Sean Macharia) / Claude Code (Opus 5.5), authorized by the collaborator ("apply the necessary corrections from section 16").
- What changed in `CLAUDE.md`:
  - AUDIT-001: §12 item 6 now says the client is created at import time and connects lazily.
  - AUDIT-002: §11 results line and §12 item 9 now explain that CRLF is a per-machine working-copy setting and committed files are LF; 8 files flagged ignoring line endings.
  - AUDIT-003: correction recorded below; old IDs not renamed.
  - AUDIT-005: §15 rule 1 now says `git status` + `git fetch`, and `git pull` only when authorized and safe.
  - AUDIT-007: added the missing audit log entry above and updated §14.
  - AUDIT-011: §5 now separates modules 1 and 3–16 (Planned) from module 2 (In progress, minimal).
- **Correction to LOG-20261005-2211-CK (AUDIT-003):** the "CK" suffix was not supported by evidence; Git records the author only as "Chelsea". Refer to that entry as LOG-20261005-2211-chelsea in future references. The original heading is left unchanged to preserve history.
- Why: fix inaccuracies identified in the §16 audit before the file is committed and shared.
- Files edited: `CLAUDE.md` only. §16 itself was not changed.
- Database/schema changes: none · Dependency changes: none.
- Checks run: none (documentation only).
- Commit: not committed · Pushed: no.
- Working-tree status after: `CLAUDE.md` untracked; nothing else changed.

### LOG-20261015-2310-corrections — Applied Recommended corrections from §16; corrections to earlier log entries
- Time: 2026-10-15 23:10:54 +03:00 (Africa/Nairobi) — source: PowerShell `Get-Date`, taken immediately before editing.
- Contributor/session: collaborator's local clone (Git identity Sean Macharia) / Claude Code (Opus 5.5), authorized by the collaborator to apply the remaining documentation corrections within `CLAUDE.md` only.
- Pre-edit check: `git status` showed only `?? CLAUDE.md`; HEAD and `origin/main` (via `git ls-remote`) both `42ae8a8`; file last modified 23:06:19 +03:00 by the previous corrections session — no unexpected changes.
- What changed in sections 1–15:
  - AUDIT-004 / AUDIT-010: §1 contributor line now separates verified facts (owner account `karechel`, Git author "Chelsea", local Git identity "Sean Macharia") from inferences; §3 and §11 "Sean's machine" replaced with "local clone with Git identity Sean Macharia".
  - AUDIT-006: §11 test description clarified (mocked `PrismaService`, but `db.ts` still loads `.env` and constructs the client).
  - AUDIT-012: §10 warns that `npm run format` rewrites the generated `contract.d.ts`.
  - AUDIT-013: §10 setup now recommends `npm ci` over `npm install`.
  - AUDIT-014: §3 states the required Node.js version is unknown/not specified; the observed version is labelled as an observation.
  - AUDIT-015: §4 adds rows for package manifests, Vitest, Nest CLI, TS, lint, Prettier, ESLint, Next.js, PostCSS and frontend TS config files.
  - AUDIT-016: §15 rule 3 explains the Git Bash cause and the `TZ=EAT-3` alternative.
  - AUDIT-018: §5 KRA row labelled as an assumption not established by repository evidence.
  - AUDIT-019 (consistency): §12 item 7 no longer asserts the deploy target is paid; cost is labelled unknown.
  - AUDIT-021: §7 notes that the no-shared-DB statement is a collaborator instruction and the owner's setup is not verifiable from the repo.
  - AUDIT-022: §11 notes that the cause of the TS2307 error is unknown.
  - §3 also records `@nestjs/cli` 12.0.6 and that installed versions match the lockfiles (from §16.3).
- **Corrections to earlier log entries (originals left unchanged):**
  - **LOG-20261005-2211-CK** (refer to it as LOG-20261005-2211-chelsea) — AUDIT-009 / AUDIT-017: "Pushed: yes" means only that `b68a0cd` is on `origin/main`; how and when it was pushed is **unknown** (this clone's reflog starts with `clone` at 2026-10-08 16:13:41 +03:00). Database/schema changes: the commit added the Prisma contract (`User` model) and migration ref/snapshot files; whether any database was changed is **unknown**. Dependency changes: the commit added both `package.json` files and lockfiles (initial dependency set). Working-tree status after: **unknown**.
  - **LOG-20261009-1314-SM** — AUDIT-008 / AUDIT-017: push evidence is stronger than `git ls-remote`. `.git/logs/refs/remotes/origin/main` on this clone records "update by push" `b68a0cd → 42ae8a8` at 2026-10-09 13:15:20 +03:00 under Git identity Sean Macharia. Database/schema changes: none in the diff (no contract or migration files changed); whether any database was changed is **unknown**. Dependency changes: none in the diff (no `package.json`/lockfile changes). Working-tree status after: **unknown**. AUDIT-020 (inference only): `Backend/backend/dist/` and `tsconfig.build.tsbuildinfo` mtimes of 2026-10-09 13:11:29 +03:00 suggest a backend build ran about 3 minutes before the commit; mtimes do not prove that it ran or what the result was.
  - **LOG-20261015-1423-SM** and **LOG-20261015-1431-SM** — AUDIT-004: "Sean Macharia's machine" should read "local clone with Git identity Sean Macharia"; the operator's identity was not explicitly confirmed in session.
- Why: complete the documentation corrections identified in the §16 audit without guessing unresolved facts.
- Files edited: `CLAUDE.md` only. §16 itself was not changed.
- Database/schema changes: none · Dependency changes: none.
- Checks run: none (documentation only).
- Commit: not committed · Pushed: no.
- Working-tree status after: `CLAUDE.md` untracked; nothing else changed (verified after editing).

### LOG-20261015-2314-consistency — Pre-commit consistency review of CLAUDE.md
- Time: 2026-10-15 23:14:47 +03:00 (Africa/Nairobi) — source: PowerShell `Get-Date`, taken immediately before editing.
- Contributor/session: collaborator's local clone (Git identity Sean Macharia) / Claude Code (Opus 5.5), authorized by the collaborator for a documentation-only pre-commit review of `CLAUDE.md`.
- Pre-edit check: `git status` showed only `?? CLAUDE.md`; ignored files unchanged; HEAD and `origin/main` (via `git ls-remote`) both `42ae8a8`; no stashes; file last modified 23:11:55 +03:00 by LOG-20261015-2310-corrections — no unexpected changes.
- What changed:
  - §16 opening: added a dated status note. It states that "sections 1–15 not modified" and "corrections not applied" were true at append time but are no longer current, and points to LOG-20261015-2305-corrections and LOG-20261015-2310-corrections. Original §16 text kept.
  - §16.5, §16.8, §16.9: headings qualified with "as at 2026-10-15 14:42:23 +03:00" plus a historical-record note under each. Findings, evidence and proposed wording unchanged.
  - §13 template: `<initials>` replaced with `<short-label>`, with guidance not to use unconfirmed initials or names (consistent with AUDIT-003).
  - §14: updated to reflect this review.
- **Clarifications to earlier log entries (originals left unchanged):**
  - **LOG-20261015-2305-corrections** omitted one edit it made: §15 rule 2 gained "New entries go at the end of §13 (above §14), not at the end of the file." (part of AUDIT-007). That edit was made after the entry was written, in the same session.
  - **LOG-20261015-2310-corrections** labels the §12 item 7 change "AUDIT-019 (consistency)". AUDIT-019 concerned §8 and required no correction; the §12 item 7 change was a consistency fix to align §12 with AUDIT-019's finding that cost is unknown. It was not a correction AUDIT-019 asked for.
- Other checks (no change needed): no secrets, connection strings, personal emails or private DB names found; status labels in §5 consistent with §11/§12; §14 unresolved list consistent with §16.6.
- Why: remove the contradiction between §16's original wording and the later correction history before the file is committed and shared.
- Files edited: `CLAUDE.md` only.
- Database/schema changes: none · Dependency changes: none.
- Checks run: none (documentation only).
- Commit: not committed · Pushed: no.
- Working-tree status after: `CLAUDE.md` untracked; nothing else changed (verified after editing).

### LOG-20261015-2318-finalize — Final documentation fixes; commit and push of CLAUDE.md
- Time: 2026-10-15 23:18:51 +03:00 (Africa/Nairobi) — source: PowerShell `Get-Date`, taken immediately before the final edits.
- Contributor/session: collaborator's local clone (Git identity Sean Macharia) / Claude Code (Opus 5.5), authorized by the collaborator to finalize `CLAUDE.md`, commit only that file, and push to `main` with a normal (non-force) push.
- Pre-edit checks: working directory `C:/Users/HP/Documents/freight-management-sister` is the repo root; `origin` = `https://github.com/karechel/freight-management.git`; branch `main`; `git fetch origin` succeeded with no new commits; `main` = `origin/main` = `42ae8a8` (0 ahead / 0 behind); `git status` showed only `?? CLAUDE.md`; no stashes; file last modified 23:15:16 +03:00 by LOG-20261015-2314-consistency.
- What changed in `CLAUDE.md`:
  - §16.2 and §16.7 headings qualified "as at 2026-10-15 14:42:23 +03:00", each with a historical-record note (their contents describe problems since corrected).
  - §16.6: current-status note added saying all ten questions remain open.
  - §14: "Uncommitted … not committed" replaced with the pre-commit Git state and a pointer to this commit; added an explicit line that no application code has changed since `42ae8a8`; restated the unauthenticated `GET /` as the most important open security issue (not fixed); updated the next recommended action.
- Not changed: application code, tests, package/lock files, env/config files, Prisma files, migrations. The TS2307 error and the `GET /` exposure remain **unfixed**. No tests, builds or `npm audit` were run in this session.
- Checks run before writing this entry: `git diff --no-index --check /dev/null CLAUDE.md` → no whitespace errors; `git diff --check` (tracked files) → clean; secret/connection-string/email pattern scan of `CLAUDE.md` → no matches. Before committing, the staged diff is re-checked with `git diff --cached --check`, `--stat` and `--name-only`; the commit proceeds only if `CLAUDE.md` is the only staged file and the checks are clean.
- Database/schema changes: none · Dependency changes: none.
- Commit: this entry is part of the commit "docs: finalize freight management handover" on `main`, parent `42ae8a8`. A file cannot record its own commit hash; see `git log -1 -- CLAUDE.md`.
- Pushed: a normal `git push origin main` is performed **after** this commit, only if `origin/main` is still `42ae8a8`. The push result cannot be recorded inside the commit; verify with `git ls-remote origin refs/heads/main`. If the push failed, the next log entry must say so.
- Working-tree status after: expected clean; verify with `git status`.
- Earlier entries that say "Commit: not committed" were accurate when written; their changes are all included in this commit.

### LOG-20261019-1503-frontend-decisions — §16.6 decisions recorded; frontend foundation and core screens built
- Time: work started 2026-10-19 14:46:06 +03:00; this entry written 2026-10-19 15:03:04 +03:00 (Africa/Nairobi) — source: PowerShell `Get-Date`.
- Contributor/session: collaborator (local Git identity Sean Macharia) / Claude Code (Opus 5.5). Authorized by the collaborator for frontend development and for recording the §16.6 decisions in `CLAUDE.md`.
- Preflight (Git evidence): repo root `C:/Users/HP/Documents/freight-management-sister`, `origin` = `https://github.com/karechel/freight-management.git`, branch `main`, working tree clean, no stashes. `git fetch origin` → no changes; `main` = `origin/main` = `883f93b` (0 ahead / 0 behind).
- **Confirmation for LOG-20261015-2318-finalize:** the commit "docs: finalize freight management handover" is `883f93b` (parent `42ae8a8`). `git ls-remote origin` shows `refs/heads/main` = `883f93b`, and `.git/logs/refs/remotes/origin/main` on this clone records "update by push" `42ae8a8 → 883f93b` at 2026-10-15 23:19:59 +03:00. The push succeeded.
- What changed:
  - `CLAUDE.md`: §16.6 decisions note (original questions unchanged); §3 frontend line; §5 frontend rows; §6 authorized phases; §9 new decisions; §12 item 8; §14; this entry.
  - Created local branch `feature/frontend-foundation` from `883f93b` (not pushed).
  - Frontend (all under `Frontend/frontend/`): app shell with responsive sidebar/mobile drawer and top bar; live API status pill (`GET /health`); dashboard (6 KPI cards linking to filtered views, filterable shipment table, pipeline breakdown, pending tasks, integrations summary, activity feed); screens for shipments list (search + view/mode filters synced to URL), shipment detail (milestones, exceptions, documents, customs, costs), quotations & bookings, documents (status/type filters), customs & duties, customers & agents, invoices & payments, system status; `loading`, `error` and `not-found` states. Every data page shows a "Demonstration data" banner; KRA iCMS, M-Pesa, document storage, auth and portals are labelled pending/not built. There are no create/save buttons, because no write endpoints exist.
- Files edited: `CLAUDE.md`, `Frontend/frontend/app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `.env.example` (comment only).
- Files created (under `Frontend/frontend/`): `app/{error,loading,not-found}.tsx`; `app/{shipments,quotations,documents,customs,parties,finance,settings}/page.tsx`; `app/shipments/[reference]/page.tsx`; `components/layout/{app-shell,sidebar,api-status}.tsx`, `components/layout/nav-items.ts`; `components/ui/{badge,card,kpi-card,page-header,states,table,detail-list,icons}.tsx`; `components/dashboard/panels.tsx`; `components/shipments/{shipment-table,shipment-explorer,milestone-timeline}.tsx`; `components/documents/document-list.tsx`; `components/settings/backend-health-card.tsx`; `lib/types.ts`, `lib/labels.ts`, `lib/format.ts`, `lib/metrics.ts`, `lib/api/client.ts`, `lib/data/index.ts`, `lib/data/demo-data.ts`; `docs/api-contracts.md`. Deleted: none.
- Not changed: backend source/tests, Prisma files, migrations, package manifests and lockfiles, `AGENTS.md`, Git config.
- Database/schema changes: none · Dependency changes: none.
- Commands that changed project state: `git switch -c feature/frontend-foundation`; `npx next typegen` and `npx next build` (write only to the git-ignored `Frontend/frontend/.next/`).
- Checks run and results (frontend): `npx tsc --noEmit --incremental false` → pass (it first failed with TS2344 on `PageProps` route types until `next typegen` generated them); `npx eslint` → pass; `npx next build` → success, 11 routes. With `next start -p 3100`, curl returned HTTP 200 for all 11 app URLs tested and 404 for an unknown route; an unknown shipment reference renders the not-found UI with HTTP 200, because `loading.tsx` streaming starts before `notFound()`. `curl localhost:3001/health` → 200 (a backend was already running locally). Not done: no visual/browser review, no accessibility audit tooling, no backend checks.
- Known failures / outstanding: backend TS2307 (`supertest/types`) unchanged and out of scope; `GET /` exposure unchanged; no auth.
- Commit: not committed · Pushed: no.
- Working-tree status after: branch `feature/frontend-foundation`; modified and untracked files as listed above; nothing staged.

### LOG-20261019-1553-frontend-review — Frontend review fixes; commit and push of `feature/frontend-foundation`
- Time: review started after LOG-20261019-1503-frontend-decisions; this entry written 2026-10-19 15:53:07 +03:00 (Africa/Nairobi) — source: PowerShell `Get-Date`. Exact start time of the review not recorded.
- Contributor/session: collaborator (local Git identity Sean Macharia) / Claude Code (Opus 5.5). The collaborator authorized a frontend-only review with fixes (scope `Frontend/frontend/`), then authorized this `CLAUDE.md` entry and a commit and push.
- Pre-edit checks: branch `feature/frontend-foundation`; uncommitted work from LOG-20261019-1503-frontend-decisions present and preserved. `git fetch origin` at 15:53 → `main` = `origin/main` = `883f93b`; no remote branches other than `main`; no stashes.
- Review method: read `Frontend/frontend/AGENTS.md` and the Next.js docs (`loading.md` status codes, `not-found.md`, route-matcher source); confirmed every Tailwind class used is present in the built CSS; crawled all internal links on the eight top-level pages with curl against `next start -p 3100`; tested edge-case URLs; checked labels, focus states and contrast by code and HTML inspection.
- Issues found and fixed (all in `Frontend/frontend/`):
  1. `app/shipments/[reference]/page.tsx`: route params were decoded twice (Next.js already decodes them), so `/shipments/A%2520B` resolved to "A B". The extra `decodeURIComponent` was removed.
  2. `app/shipments/page.tsx`: the `?view=` and `?mode=` checks used `in`, which accepted inherited keys (`?view=toString` showed an empty list). They now use `Object.hasOwn`.
  3. `lib/data/index.ts`, `lib/data/demo-data.ts`: hand-typed party "active shipments" and "outstanding" figures disagreed with the shipment and invoice data (e.g. Mlima 2 vs 1, Indigo Ocean Lines 4 vs 5). They are now derived from the demo shipments and invoices, and the hand-typed values were removed.
  4. `app/page.tsx`: the "In customs clearance" KPI linked to `/customs` (all active shipments) instead of the 5 it counts. It now links to `/shipments?view=customs`.
  5. `lib/api/client.ts`: requests had no timeout, so "Checking API…" could persist indefinitely. Requests now abort after 8 s and show "API unavailable".
  6. `components/layout/app-shell.tsx`: the mobile drawer now moves focus to its close button when opened and returns focus to the menu button when closed; the rest of the page is `inert` while it is open.
  7. `components/ui/table.tsx`: horizontally scrollable tables are now focusable named regions (keyboard scrolling on narrow screens).
  8. `components/shipments/shipment-explorer.tsx`, `components/documents/document-list.tsx`: input focus outline is now solid (was 30 % opacity); placeholder text darkened for contrast.
  9. `app/loading.tsx`, `components/ui/states.tsx`, `components/layout/api-status.tsx`: the loading state is a `role="status"` with screen-reader text; pulse animations only run with `motion-safe`.
- Files edited: the 13 frontend files named above, plus `CLAUDE.md` (this entry, §5 frontend row, §14). Created/deleted: none. Nothing else outside `Frontend/frontend/` was changed.
- Database/schema changes: none · Dependency changes: none · Backend: untouched.
- Commands that changed project state: `npx next build` (git-ignored `.next/` only). I stopped my own leftover `next start -p 3100` processes: the first had survived from the previous session because stopping the background task did not kill its `node` child. Each was confirmed by its command line before `Stop-Process`. No server was left running.
- Checks run and results (final run, after all fixes): `npx tsc --noEmit --incremental false` → pass; `npx eslint` → pass; `npx next build` → success, 11 routes. Curl against `next start -p 3100`: all 9 app routes tested → 200; `/nowhere` → 404; link crawl → 30 unique internal links, no broken links and no not-found pages; `?view=toString` → falls back to the default view; `/shipments/A%2520B` → title "A%20B"; `/shipments/NOPE` → not-found UI with HTTP 200 (`noindex`; documented Next.js streaming behaviour with `loading.tsx`).
- Known failures / outstanding: a malformed percent-encoded dynamic URL (e.g. `/shipments/%E0%A4%A`) returns HTTP 500 from inside Next.js route matching, before app code runs; not fixed (it would need a `proxy` file running on every request). No visual or browser review, light theme only, no backend endpoints or auth, `GET /` exposure and backend TS2307 unchanged.
- Commit: all work from LOG-20261019-1503-frontend-decisions and this entry is committed together on `feature/frontend-foundation` (parent `883f93b`) as "feat(frontend): app shell, dashboard and core screens with demo data". A file cannot record its own hash; see `git log -1 feature/frontend-foundation`. Earlier entries that say "Commit: not committed" were accurate when written.
- Pushed: a normal (non-force) `git push -u origin feature/frontend-foundation` runs after this commit. `main` is not changed and nothing is merged. Verify with `git ls-remote origin refs/heads/feature/frontend-foundation`. If the push failed, the next log entry must say so.
- Working-tree status after: expected clean; verify with `git status`.

### LOG-20261021-0111-frontend-phase1 — Shipment management and delay reporting (frontend phase 1)
- Time: work done on 2026-10-20 and early 2026-10-21 (Africa/Nairobi); exact change time unavailable (not recorded with `Get-Date` during the work). Entry written 2026-10-21 01:11:07 +03:00 — source: PowerShell `Get-Date`.
- Contributor/session: collaborator (local Git identity Sean Macharia) / Claude Code (Opus 5.5). Authorized by the collaborator to continue frontend development on `feature/frontend-foundation` against the repository owner's requirements (features 1–6), working only in `Frontend/frontend/`, without commit, push, stash, reset or branch changes.
- **Confirmation for LOG-20261019-1553-frontend-review:** the push succeeded. `git ls-remote origin` (2026-10-21 01:10 +03:00) shows `refs/heads/feature/frontend-foundation` = `46ad529` = local HEAD; `main` = `883f93b`.
- What changed:
  - **Session store.** Added `lib/data/session-store.tsx`, an in-memory React context seeded from `lib/data` in `app/layout.tsx`. Created and edited records last across client-side navigation and are lost on reload. No `localStorage`, no fake backend. Every edit form and page banner says this.
  - **Shipments.** Create (`/shipments/new`), edit (`/shipments/[reference]/edit`), and a status-change panel on the detail page. New fields: actual departure, arrival and delivery (`atd`, `ata`, `deliveredAt`) and estimated delivery, separate from ETD/ETA. The detail page shows estimated vs actual dates with the difference. Milestones show planned vs actual times and can be updated, staying in date order. Each shipment has a change history (`events`). References continue the existing `FMS-<MODE>-<YYMM>-<NNNN>` numbering. Validation covers required fields, date order, no future actual dates, and status/date agreement.
  - **Delays.** Record and edit at `/shipments/[reference]/delays/new` and `/delays/[id]/edit`. Fields: reason, details, identified date, severity, affected milestone, original and revised expected dates, follow-up person, status, next action, notes, resolved date, and customer-notification status (recorded manually; nothing is sent). Duration is calculated from the two dates. The revised ETA is derived (`currentEta`) and never overwrites the planned ETA. Each delay has its own timeline with manual "action taken" entries. The list has a "Delayed" view and delay badges, and delays count toward "Needs attention".
  - **Dashboard and list.** Both read shipments from the session store. Whole rows open the shipment.
  - **Demo data.** Actual dates were copied from existing milestone timestamps. The Malaba border exception (`ex-02`) was converted to a delay record (`dl-01`); the revised date is the original ETA plus the 6 hours stated in the exception text. Added a staff list made of names already used in the data.
- Files (all under `Frontend/frontend/`):
  - Edited: `app/layout.tsx`, `app/page.tsx`, `app/shipments/page.tsx`, `app/shipments/[reference]/page.tsx`, `components/shipments/{milestone-timeline,shipment-explorer,shipment-table}.tsx`, `components/ui/states.tsx`, `docs/api-contracts.md`, `lib/{types,labels,metrics,format}.ts`, `lib/data/{demo-data,index}.ts`.
  - Created: `app/shipments/new/page.tsx`, `app/shipments/[reference]/edit/page.tsx`, `app/shipments/[reference]/delays/new/page.tsx`, `app/shipments/[reference]/delays/[delayId]/edit/page.tsx`, `components/dashboard/session-panels.tsx`, `components/shipments/{delay-form,delay-panel,milestone-update,shipment-dates,shipment-detail-view,shipment-edit-view,shipment-form,shipment-history,status-change}.tsx`, `components/ui/{button,form,session-notice}.tsx`, `components/ui/use-validated-form.ts`, `lib/{dates,delay-form,shipment-changes,shipment-form,validation}.ts`, `lib/data/session-store.tsx`.
  - Deleted: none.
- Database/schema changes: none · Dependency changes: none · Backend: untouched.
- Commands that changed project state: `npx next typegen`, `npx next build` (git-ignored `.next/` only); `next start -p 3100` for curl checks, then stopped by PID after confirming its command line.
- Checks run and results:
  - Frontend `npx tsc --noEmit --incremental false` → pass; `npx eslint` → pass (after fixing a React Compiler `react-hooks/refs` error in the new form code); `npx next build` → success, 15 routes.
  - Logic tests in a scratch script outside the repo (Node 24 type stripping, nothing added to the project) → 9/9 groups pass, including that all 11 seed shipments pass the new validation.
  - Curl: all routes 200, `/nowhere` 404. The "Delayed" view lists only `FMS-ROAD-2610-0033` with "+6 h". `FMS-SEA-2610-0041` shows "2 days late" on arrival.
  - No browser or visual review.
- Known failures / outstanding: no auth or roles (changes are attributed to "You (demo session)"); customs fields not editable; the Customs page reads static data; write APIs listed in `docs/api-contracts.md`.
- Commit: not committed · Pushed: no.
- Working-tree status after: uncommitted changes in `Frontend/frontend/` only.

### LOG-20261021-0111-frontend-phase2 — Quotations, customer billing and history, agent routes (frontend phase 2)
- Time: work done on 2026-10-21 before 00:58 +03:00 (Africa/Nairobi); exact change time unavailable. Entry written 2026-10-21 01:11:07 +03:00 — source: PowerShell `Get-Date`.
- Contributor/session: collaborator (local Git identity Sean Macharia) / Claude Code (Opus 5.5). Authorized by the collaborator: "Do not commit Phase 1 yet. Continue to Phase 2 in the same working branch, preserving all existing changes."
- Pre-work check: phase 1 re-verified first — tsc, eslint, build and the 9 logic groups all passed; 38 uncommitted changes, all in `Frontend/frontend/`; no stashes.
- What changed:
  - **Quotations.**
    - Line items with quantity, unit price and tax %, stored as integer minor units (`lib/money.ts`; rounding per line, to the nearest cent). Currency KES or USD, terms and internal note.
    - Create, view, edit (drafts only) and "Duplicate as draft". Status flow draft → sent → accepted or rejected → booked; "expired" is derived from the validity date as at the fixed demo date. The existing `declined` value is labelled "Rejected".
    - "Sent" only records when and to whom staff sent it outside the system; no email integration exists.
    - Print / save as PDF uses the browser print dialog. The app shell hides on print, and the document carries a "Demonstration document" banner.
    - An accepted quotation can be converted into a new shipment (`/shipments/new?quotation=`, pre-filled) or linked to an existing one; either marks it booked.
    - The 8 seed quotations became one line each holding their recorded total, so no breakdown was invented (a test confirms every total is unchanged).
  - **Customer pages** (`/parties/[id]`).
    - Billing profile (fictional demo values). KRA PIN, phone and credit limit are deliberately "Not recorded".
    - Indicative account balance from invoices, labelled not authoritative.
    - Chronological service history of shipments, delays, quotations, documents, invoices and payments, with a type filter and sort order, linking to each record.
    - Invoices, payments and quotations for the customer.
  - **Agents.** Supported routes derived only from the jobs each agent handles in the demo data, labelled "not an agreement". New optional `Shipment.agentRouteId`, validated against the selected agent; `Quotation.agentName`. Agent pages show routes with job counts, related jobs, quotations naming the agent, and customer invoices on their jobs (agent payables not modelled).
  - **Navigation.** Shipment list filters `?customer=` and `?agent=` (removable chips). Cross-links between shipments, quotations, customers, agents and invoice rows (`/finance#INV-…`). Dashboard activity links to quotations.
- Files (all under `Frontend/frontend/`):
  - Edited: `app/{finance,parties,quotations}/page.tsx`, `app/layout.tsx`, `app/shipments/new/page.tsx`, `components/dashboard/panels.tsx`, `components/layout/app-shell.tsx` (print styles only), `components/shipments/{shipment-detail-view,shipment-explorer,shipment-form,shipment-history}.tsx`, `components/ui/use-validated-form.ts`, `docs/api-contracts.md`, `lib/{types,labels,shipment-form,shipment-changes}.ts`, `lib/data/{demo-data,index,session-store}.ts(x)`, plus the phase 1 files `app/shipments/page.tsx` and `app/page.tsx`.
  - Created: `app/parties/[id]/page.tsx`, `app/quotations/new/page.tsx`, `app/quotations/[reference]/page.tsx`, `app/quotations/[reference]/edit/page.tsx`, `components/parties/{party-detail-view,party-table,service-history}.tsx`, `components/quotations/{quotation-actions,quotation-detail-view,quotation-document,quotation-form,quotation-form-view,quotation-list}.tsx`, `components/shipments/new-shipment-view.tsx`, `lib/{customer-history,money,quotation-changes,quotation-form,quotations}.ts`.
  - Deleted: none.
- Database/schema changes: none · Dependency changes: none · Backend: untouched.
- Commands that changed project state: `npx next typegen`, `npx next build` (`.next/` only); `next start -p 3100` for curl checks, then stopped after confirming its command line.
- Checks run and results:
  - tsc → pass; eslint → pass; build → success, 18 routes.
  - Logic tests → 8/8 phase 2 groups and 9/9 phase 1 groups pass. A phase 1 fixture failed at first because the new `agentRoutes` validation context was optional. The context was made required, so a missing context now fails type-checking, and the fixture was updated.
  - Curl: 27 app URLs → 200, `/nowhere` → 404. Content spot checks matched the demo data (filtered rows, conversion blocked for non-accepted quotations, Baobab overdue KES 486,400, agent routes).
  - No browser or visual review.
- Known failures / outstanding: billing profiles and agent routes are read-only; quotation expiry is judged against the fixed demo date (19 Oct 2026), so QT-2610-0049 still shows "sent"; payment `p-04` refers to invoice `INV-2609-0081`, which is not in the demo data; invoices and payments are matched to customers by name.
- Commit: not committed · Pushed: no.
- Working-tree status after: uncommitted changes in `Frontend/frontend/` only.

### LOG-20261021-0111-frontend-phase3 — Document uploads (frontend phase 3, demo only)
- Time: work started 2026-10-21 00:58:56 +03:00; checks finished 01:10:35 +03:00; entry written 01:11:07 +03:00 (Africa/Nairobi) — source: PowerShell `Get-Date`.
- Contributor/session: collaborator (local Git identity Sean Macharia) / Claude Code (Opus 5.5). Authorized by the collaborator: "Proceed with Phase 3: document uploads, same rules as before. make sure you always document the entries". Interpreted as authorization to record phase entries in this file (§9). This file is the only change outside `Frontend/frontend/`.
- What changed:
  - **Upload page** (`/documents/upload`, pre-fillable with `?shipment=&type=`). Choose a shipment (the customer is taken from it), a document type and up to 10 files, by file picker or drag and drop.
  - **File checks** (`lib/document-upload.ts`): PDF, JPEG, PNG, DOC/DOCX or XLS/XLSX only; not empty; at most 10 MB each and 100 MB per session. The extension, browser-reported MIME type and leading bytes must agree, so a renamed executable or script is rejected. Unreadable files (moved, deleted, locked) produce a clear error, and nothing is added.
  - **In-memory storage.** Valid files are copied into the tab's memory as `Blob`s. Open and Download use temporary `blob:` URLs, released after a short delay. Nothing is uploaded, sent to the backend, placed in `public/` or kept after reload, and every upload screen says so.
  - **Records.** Each file becomes a document record with status "received". The first file fulfils an outstanding "missing" or "rejected" requirement of the same type instead of duplicating it. Received documents can be verified, or rejected with a reason. Uploads and reviews appear in the shipment change history and the dashboard activity.
  - **Documents page.** Filename, size, type, shipment, customer, upload date, status and reviewer; a "With file (this tab)" filter.
  - **Consistency.** The shipment page documents card, the dashboard "Documents outstanding" KPI and the customer service history now read documents from the session store.
- Files:
  - Edited: `CLAUDE.md` (§3, §5, §9, §11, §14 and these three entries) and, under `Frontend/frontend/`: `app/documents/page.tsx`, `app/layout.tsx`, `app/page.tsx`, `app/parties/[id]/page.tsx`, `app/shipments/[reference]/page.tsx`, `components/dashboard/session-panels.tsx`, `components/documents/document-list.tsx`, `components/parties/party-detail-view.tsx`, `components/shipments/{shipment-detail-view,shipment-history}.tsx`, `docs/api-contracts.md`, `lib/{types,metrics,customer-history,shipment-changes}.ts`, `lib/data/session-store.tsx`.
  - Created: `app/documents/upload/page.tsx`, `components/documents/upload-form.tsx`, `lib/{document-upload,document-changes}.ts`.
  - Deleted: none.
- Database/schema changes: none · Dependency changes: none · Backend: untouched.
- Commands that changed project state: `npx next typegen`, `npx next build` (`.next/` only); `git fetch origin` (no new commits); `next start -p 3100` twice for curl checks, each stopped after confirming its command line. No server left running.
- Checks run and results:
  - tsc → pass; eslint → pass (after renaming a helper parameter called `use`, which the hooks lint rule mistook for React's `use`); build → success, 20 routes.
  - Logic tests → 22/22 groups pass across all three phases (phase 3: format, size and signature checks, an unreadable file, fulfilling requirements, review rules).
  - **Bug found and fixed during checks:** `/documents` rendered the not-found page while still returning HTTP 200. The cause was a constant (`documentFilters`) exported from a `'use client'` module and imported into a Server Component, where it becomes a client reference instead of the array. It was moved to `lib/metrics.ts`. An audit confirmed every other client import into server pages is a component or a type.
  - Curl after the fix: every page renders its expected `<h1>`, `/nowhere` 404, unknown records show not-found UI, no server errors logged.
  - No browser or visual review, so an actual file selection, open and download were **not exercised in a browser**.
- Known failures / outstanding: files cannot be removed or replaced after adding (reject and re-upload instead); no customer-level documents; no in-app preview; no virus scanning. Production needs private storage, authorised short-lived downloads, server-side validation and scanning, an audit log and a retention policy — see `Frontend/frontend/docs/api-contracts.md`.
- Commit: not committed · Pushed: no.
- Working-tree status after: uncommitted changes in `Frontend/frontend/` and `CLAUDE.md`; nothing staged; branch `feature/frontend-foundation` = `46ad529` (same as `origin`).

### LOG-20261021-0116-logging-rule — "Write everything in CLAUDE.md"; items not yet logged from phases 1–3
- Time: 2026-10-21 01:16:55 +03:00 (Africa/Nairobi), taken before editing — source: PowerShell `Get-Date`.
- Contributor/session: collaborator (local Git identity Sean Macharia) / Claude Code (Opus 5.5), same session as LOG-20261021-0111-frontend-phase1/2/3.
- Instruction received: "make sure you write everything you do in the claude.md". From now on every action is logged here, including read-only checks, processes started or stopped, files created outside the repository, failed attempts and instructions received (§9, §15 rule 2 updated).
- Pre-edit checks:
  - `git fetch origin` → no new commits.
  - `git ls-remote origin` → `main` = `883f93b`, `feature/frontend-foundation` = `46ad529` = local HEAD.
  - No stashes; only `CLAUDE.md` changed outside `Frontend/frontend/`.
  - `CLAUDE.md` last modified 01:12:23 +03:00, which matches the edits below. No sign of anyone else editing it.
- **Done after the LOG-20261021-0111 entries were written** (01:11:07–01:12:23, then checks):
  - Edited §3 (frontend line), §5 (three frontend rows), §9 (two rows), §11 (latest frontend results) and §14 (Git state, authorized work, frontend state, next action).
  - Checks: `git diff --check -- CLAUDE.md Frontend/frontend` → clean. A scan of the added `CLAUDE.md` lines → no email addresses other than `.example`, and no connection strings, passwords, secrets or tokens. `git status` → only `CLAUDE.md` outside `Frontend/frontend/`, 70 entries with untracked files expanded; nothing staged; no stashes; branch unchanged.
- **Files created outside the repository (not committed, not part of the project):**
  - Claude Code memory on this machine: `~/.claude/projects/C--Users-HP-Documents-freight-management-sister/memory/log-every-phase-in-claude-md.md` and its index `MEMORY.md`. Created 2026-10-21 00:58 (phase 3 start) to remember the logging instruction; updated 01:16–01:17 to the broader "log everything" rule. Local to this machine and session tooling, not visible to the repository owner.
  - Session scratchpad (a temporary folder under the user's `AppData\Local\Temp\claude\…`; may be deleted automatically):
    - Test helpers: `alias-hooks.mjs`, `register.mjs` (map `@/` imports so Node can run the frontend's TypeScript).
    - Logic tests: `logic-test.ts` (phase 1), `logic-test-p2.ts` (phase 2), `logic-test-p3.ts` (phase 3).
    - One-off data-edit scripts: `actuals.mjs` (phase 1: inserted actual dates into `lib/data/demo-data.ts`), `p2-demo.mjs` (phase 2: renamed the quotation seed array and inserted `agentRouteId` values).
    - The logic tests are not in the repository. Adding a test runner to the frontend would be a dependency decision (§9).
- **Editing method and failed attempts during phases 1–3** (recorded for completeness; all were corrected and the checks above were run afterwards):
  - Many edits were made with one-off `node -e` and `sed` commands in Git Bash, as well as the Edit and Write tools. Python is not installed on this machine.
  - Shell quoting failures, each detected and fixed:
    - Phase 1: an edit of `lib/types.ts` aborted before writing (Python missing). An edit to `lib/format.ts` lost its template literals and was corrected. An edit of `shipment-table.tsx` aborted before writing; the file was rewritten instead.
    - Phase 1, `docs/api-contracts.md`: the first attempt to append the write-endpoint section garbled it. Because of the shell quoting, Bash also tried to run words from the text as commands; each failed with "command not found" or "No such file or directory", and nothing ran. The garbled section was truncated with `head` and rewritten with the Edit tool.
    - Phase 2: a broken quote in a validation message in `lib/shipment-form.ts` was fixed.
    - Phase 3: an edit of `lib/data/session-store.tsx` failed before writing, and the file was rewritten. A link in `shipment-detail-view.tsx` lost its template literal and was fixed. A renamed helper parameter (`use` → `consume`) was missed at its call site; tsc and eslint caught it and it was fixed.
  - Phase 1 lint fix: ref access during render in the new form hook (React Compiler `react-hooks/refs`). The error summary is now focused by element id instead of a ref.
- **Background processes:** three `next start -p 3100` servers were started for curl checks: phase 1 once, phase 2 once, phase 3 twice (one was stopped and restarted after the `/documents` fix). Each was stopped by `Stop-Process` after its command line was confirmed. The "exit code 127" each task then reported is the result of that stop, not a crash. Port 3100 was free afterwards.
- Database/schema changes: none · Dependency changes: none · Backend: untouched · Application code: not changed by this entry.
- Files edited by this entry: `CLAUDE.md` (this entry, §9 row, §15 rule 2). Outside the repository: the memory files above.
- Commit: not committed · Pushed: no.
- Working-tree status after: unchanged apart from `CLAUDE.md`; verified after editing.

### LOG-20261021-0128-precommit-review — Final pre-commit review of frontend phases 1–3
- Time: review started 2026-10-21 01:20:41 +03:00; this entry written 01:27:53 +03:00 (Africa/Nairobi) — source: PowerShell `Get-Date`.
- Contributor/session: collaborator (local Git identity Sean Macharia) / Claude Code (Opus 5.5). Authorized by the collaborator: a final pre-commit review within the frontend scope, plus this log update. No staging, commit, push, merge, deploy or database commands.
- **Repository checks (read-only):**
  - Root `C:/Users/HP/Documents/freight-management-sister`; branch `feature/frontend-foundation`; `origin` = `https://github.com/karechel/freight-management.git` (fetch and push).
  - `git fetch origin` → nothing new. `git ls-remote` → `main` = `883f93b`, `feature/frontend-foundation` = `46ad529`. Local `main` = `883f93b` tracking `origin/main`; local feature branch = `46ad529`, in sync.
  - No stashes, no merge, rebase or `index.lock` in progress; nothing staged.
  - `core.autocrlf=true`; changed files are LF in both index and working tree (`git ls-files --eol`), so they will be committed as LF.
- **Diff inspection.** Before this entry: 23 modified tracked files (`CLAUDE.md` plus 22 under `Frontend/frontend/`) and 47 untracked files, all under `Frontend/frontend/`. All belong to phases 1–3 as logged. No backend, Prisma, package manifest, lockfile, env or config changes.
- **Scans** of all added and untracked content (7,203 lines):
  - No email addresses other than `.example`; no connection strings, passwords, API keys, tokens or private keys; no URLs.
  - No `localStorage`, `sessionStorage`, IndexedDB, cookies, `eval`, `dangerouslySetInnerHTML` or new network calls (`localStorage` appears only in "not used" statements).
  - No `console.log`, `debugger` or TODO; no `public/` paths.
  - Contributor names appear only in this log, in the established "local Git identity" form.
  - The clock is used only in event handlers, validation callbacks and effects, so there is no server/client render mismatch risk.
- **Demo claims and API consistency.**
  - UI wording matches `docs/api-contracts.md`: session-only saving, no email or notification sending, quotations editable as drafts only, document limits (10 files, 10 MB each, 100 MB per session) and formats, `blob:`-only file access, read-only billing and routes, Customs page still on static data.
  - **Fixed:** `app/settings/page.tsx` (System status) said "All pages use demo data" and "No files are uploaded or stored" without mentioning the new edit and upload screens. It now says edits are kept in the browser tab only, and that files chosen on the upload page stay in tab memory and are never uploaded or stored.
  - **Fixed:** the §4 `app/` row of this file (out of date since 2026-10-19); added rows for `lib/` and `docs/api-contracts.md`.
  - Noted, not changed: `getShipment()` in `lib/data/index.ts` is no longer called. It is kept because `docs/api-contracts.md` maps it to `GET /shipments/:reference`.
- **Checks** (after the fixes):
  - `npx tsc --noEmit --incremental false` → exit 0; `npx eslint` → exit 0.
  - `npx next build` → exit 0, 19 route entries (18 app routes + `/_not-found`).
  - Scratch logic tests → 9 + 8 + 5 = 22/22 groups pass.
  - The project's own Next.js 16.3.5 (`node …/node_modules/next/dist/bin/next start -p 3100 <frontend dir>`): 25/25 pages return 200 with the expected `<h1>`, `/nowhere` → 404, the new System status wording renders, no server errors. Server stopped (PIDs 13200, 27156, 1612, 29524); port 3100 free.
- **Incident during the review (no project impact).**
  - The first server start for the curl checks ran `npx next start -p 3100` from the repository root instead of `Frontend/frontend`; the background command lost its `cd`. With no local `next` there, npx began fetching **next@16.4.2** into the global npx cache, outside the repository. The curl loop got connection failures (`000`).
  - Stopped by command line: npx/node 28768, wrappers 1500, 22140, 21840, 9792; check-loop processes 2516, 10964, 26824 and curl 17900.
  - Verified afterwards: no new files in the repository; `Frontend/frontend/package.json`, `package-lock.json` and `Backend/` identical to HEAD; installed `next` still 16.3.5.
  - **Left behind outside the repository:** an incomplete npx cache folder, `C:\Users\HP\AppData\Local\npm-cache\_npx\8b377f6eec906bc4\` (about 249 MB, created 01:24:08 +03:00, 19 top-level packages, no install-complete marker, contains a `concurrency.lock`). Whether package install scripts ran (e.g. `sharp`) could not be confirmed. Not deleted; awaiting the collaborator's decision. It does not affect the project, which always uses its own `node_modules`.
  - Changed practice: servers are now started with the project's `next` binary by absolute path and an explicit directory, never with `npx` from an unknown working directory.
- **Corrections to earlier entries** (originals left unchanged):
  - LOG-20261021-0111-frontend-phase1 says the build produced "15 routes"; the output listed 14 entries (13 app routes + `/_not-found`).
  - LOG-20261021-0111-frontend-phase3 and §11 say "20 routes"; the output listed 19 entries (18 app routes + `/_not-found`). §11 is a living section and is corrected here.
  - LOG-20261021-0111-frontend-phase2's "18 routes" was correct (17 + `/_not-found`).
- **Needs browser or manual verification** (not done; no browser testing was performed in phases 1–3 or in this review):
  - Creating, editing and changing status of shipments; recording and editing delays.
  - The full quotation flow, including line items, totals, duplicate, convert and printing / save as PDF.
  - Customer and agent pages; filter chips.
  - Selecting real files, rejection of a renamed file, open (new tab) and download, verify/reject.
  - Focus moving to the error summary; keyboard navigation of whole-row links and the mobile drawer.
  - Phone-width layout, and print layout.
  - That reloading clears session data, as the UI states.
- **Outstanding issues (known, documented):** no auth or roles; session-only data; the Customs page reads static data; billing and routes read-only; quotation expiry measured against the fixed demo date; no file removal, preview or scanning; backend `GET /` exposure and TS2307 unchanged (backend out of scope).
- Files edited by this review: `Frontend/frontend/app/settings/page.tsx`, `CLAUDE.md` (§4, §11, §14, this entry). Created or deleted in the repository: none. Outside the repository: the npx cache folder above (unintended).
- Database/schema changes: none · Dependency changes: none (project manifests unchanged).
- Commit: not committed · Pushed: no. Proposed commit (awaiting explicit approval): all 71 files listed by `git status` (24 modified, 47 new) on `feature/frontend-foundation`, followed by a normal push of that branch only; `main` is not touched.
- Working-tree status after: 24 modified (including `CLAUDE.md` and `app/settings/page.tsx`) + 47 untracked; nothing staged; branch `feature/frontend-foundation` = `46ad529`.

### LOG-20261021-0130-commit-phases — Commit and push of frontend phases 1–3
- Time: 2026-10-21 01:30:45 +03:00 (Africa/Nairobi), taken before this entry — source: PowerShell `Get-Date`.
- Contributor/session: collaborator (local Git identity Sean Macharia) / Claude Code (Opus 5.5). Authorized by the collaborator: "commit and push. dont delete the npx folder yet though".
- Pre-commit checks:
  - `git fetch origin` → nothing new. `git ls-remote` → `main` = `883f93b`, `feature/frontend-foundation` = `46ad529` = local HEAD.
  - 24 modified + 47 untracked, the same as at the end of LOG-20261021-0128-precommit-review. `CLAUDE.md` last modified 01:28:36 by that review. No stashes; nothing staged.
- What is committed: the 71 files listed in LOG-20261021-0128-precommit-review (phases 1–3, the System status wording fix, these `CLAUDE.md` updates and this entry).
  - Staged with `git add -- CLAUDE.md Frontend/frontend`. The staged list is checked before committing: exactly 71 files, nothing outside `CLAUDE.md` and `Frontend/frontend/`, and `git diff --cached --check` clean.
  - Commit message: "feat(frontend): shipments, delays, quotations, customer/agent views and document uploads (demo)", parent `46ad529`. A file cannot record its own hash; see `git log -1 feature/frontend-foundation`.
- Push: a normal (non-force) `git push origin feature/frontend-foundation` runs after the commit. `main` is not changed and nothing is merged. The push result is recorded in a follow-up entry after this commit, which is left uncommitted.
- Not done, as instructed: the incomplete npx cache folder `C:\Users\HP\AppData\Local\npm-cache\_npx\8b377f6eec906bc4\` (LOG-20261021-0128-precommit-review) is **left in place**; the collaborator will decide later.
- Database/schema changes: none · Dependency changes: none · Backend: untouched.
- Checks: the full frontend checks from LOG-20261021-0128-precommit-review (tsc, eslint, build, 22/22 logic groups, 25/25 page headings). No code has changed since. No browser testing has been done.

### LOG-20261021-0131-push-confirmed — Commit and push result for LOG-20261021-0130-commit-phases
- Time: 2026-10-21 01:31:31 +03:00 (Africa/Nairobi) — source: PowerShell `Get-Date`.
- Contributor/session: collaborator (local Git identity Sean Macharia) / Claude Code (Opus 5.5), same session.
- Commit:
  - `5e2910f` (`5e2910f1c436676707ffbb003e7a6d9720c30ba9`), parent `46ad529`, author time 2026-10-21 01:31:09 +03:00.
  - 71 files changed (47 created), 7,249 insertions, 574 deletions. Working tree clean afterwards.
- Push:
  - `git ls-remote` showed the remote branch still at `46ad529` immediately before. A normal `git push origin feature/frontend-foundation` then reported `46ad529..5e2910f`.
  - Afterwards `git ls-remote origin`: `refs/heads/feature/frontend-foundation` = `5e2910f`, `refs/heads/main` = `883f93b` (unchanged), `HEAD` = `883f93b`. `.git/logs/refs/remotes/origin/feature/frontend-foundation` records "update by push" `46ad529 → 5e2910f` at 2026-10-21 01:31:21 +03:00.
  - No force push, no merge, `main` untouched.
- The npx cache folder `C:\Users\HP\AppData\Local\npm-cache\_npx\8b377f6eec906bc4\` is still in place, as instructed.
- Files edited: `CLAUDE.md` (this entry and §14 only). **This entry is uncommitted**, because a commit cannot record its own push. It should go into the next commit.
- Database/schema changes: none · Dependency changes: none.
- Commit: not committed (this entry) · Pushed: no (this entry).
- Working-tree status after: `CLAUDE.md` modified; nothing else.

### LOG-20261021-0144-pr-draft — Pull request description drafted; fresh-clone check of the pushed branch
- Time: started 2026-10-21 01:35:21 +03:00; entry written 01:44:21 +03:00 (Africa/Nairobi) — source: PowerShell `Get-Date`.
- Contributor/session: collaborator (local Git identity Sean Macharia) / Claude Code (Opus 5.5). Instruction: "draft the pull request description. make sure my sister will be able to pull all of this" (the repository owner).
- Read-only checks:
  - `git fetch origin` → nothing new. `git ls-remote` → `main` = `883f93b`, `feature/frontend-foundation` = `5e2910f`.
  - The branch is 2 commits ahead of `origin/main`, and `origin/main` is an ancestor (`git merge-base --is-ancestor`), so a pull request merges without conflicts.
  - The GitHub CLI (`gh`) is not installed, so the PR was not opened and the repository owner's GitHub permissions were not queried.
- **Fresh-clone verification** (in the session scratchpad, outside the repository):
  - First attempt: `git clone --branch feature/frontend-foundation` checked out incompletely. 136 files, including backend files, showed as deleted, and Git advised `git restore`.
    - Cause: the scratchpad path (146 characters) plus the repository's longest path (`Backend/backend/migrations/snapshots/<hash>/contract.json`, 115 characters, from the initial commit) exceeds the Windows 260-character limit.
    - The longest path added in phases 1–3 is 74 characters (`Frontend/frontend/app/shipments/[reference]/delays/[delayId]/edit/page.tsx`).
    - Not a repository problem, but relevant to anyone cloning into a deep folder on Windows. It is documented in the PR description.
  - Second attempt, with `core.longpaths=true` set **for that clone only** (no global Git config change):
    - Clean checkout. Tree identical to local `5e2910f`; 104 tracked frontend files.
    - `npm ci` in `Frontend/frontend` → exit 0; Next.js 16.3.5; lockfile unchanged. npm 11 reported that `unrs-resolver@1.12.2`'s postinstall script was not run because it is not on npm's allow-list; no effect on lint or build.
    - `npx next typegen` → ok; `tsc --noEmit` → exit 0; `eslint` → exit 0; `next build` → exit 0, 19 route entries. The clone stayed clean afterwards.
    - Finding for the setup instructions: standalone `tsc` needs Next's generated route types first (`next typegen`, `dev` or `build`); otherwise TS2344 (as in LOG-20261019-1503-frontend-decisions).
  - The test clone (508 MB, its `node_modules` included) was deleted afterwards. It was the session's own folder created minutes earlier; its remote URL was checked before deletion.
- **PR description** saved outside the repository at the session scratchpad `pr-description.md`, for the collaborator to paste into GitHub. Contents:
  - Summary and demo-only warning; what each phase includes.
  - Exact pull and run commands (`git fetch`, `git switch feature/frontend-foundation`, `npm ci`, optional `.env.local`, `npm run dev`).
  - Setup notes (typegen before `tsc`, the npm 11 install-script warning, the Windows path length).
  - Checks performed, including the fresh clone; a browser-testing checklist (none done yet); what is not included; review notes.
  - Uses role labels (§9), no personal names or emails.
- Unchanged, as instructed: the npx cache folder `C:\Users\HP\AppData\Local\npm-cache\_npx\8b377f6eec906bc4\` (still present).
- **Not yet on GitHub:** this entry and LOG-20261021-0131-push-confirmed exist only in the local working copy (`CLAUDE.md` modified). The repository owner will not see them until they are committed and pushed, which needs the collaborator's approval.
- Database/schema changes: none · Dependency changes: none (the `npm ci` ran only in the deleted test clone) · Application code: unchanged.
- Files edited: `CLAUDE.md` (this entry). Created outside the repository: `pr-description.md` in the scratchpad; the test clone (since deleted).
- Commit: not committed · Pushed: no.
- Working-tree status after: `CLAUDE.md` modified; nothing else.

### LOG-20261021-0154-commit-log — Commit and push of the pending CLAUDE.md log entries
- Time: 2026-10-21 01:53:49 +03:00 (Africa/Nairobi), taken before this entry — source: PowerShell `Get-Date`.
- Contributor/session: collaborator (local Git identity Sean Macharia) / Claude Code (Opus 5.5). Authorized by the collaborator: "commit and push the CLAUDE.md log entries".
- Pre-commit checks:
  - `git fetch origin` → nothing new. `git ls-remote` → `main` = `883f93b`, `feature/frontend-foundation` = `5e2910f` = local HEAD.
  - Only `CLAUDE.md` modified, last written 01:44:42 +03:00 by LOG-20261021-0144-pr-draft. Nothing staged; no stashes.
- What is committed: `CLAUDE.md` only. That covers LOG-20261021-0131-push-confirmed, LOG-20261021-0144-pr-draft, this entry, and the §14 updates. Commit message: "docs: log push confirmation, PR draft and clone check in CLAUDE.md", parent `5e2910f`, on `feature/frontend-foundation`.
- Push: a normal `git push origin feature/frontend-foundation`, only if the remote branch is still `5e2910f`. `main` is not changed; nothing is merged.
- The push result cannot be recorded inside the commit it describes. As agreed (§15 rule 2), a short follow-up entry records it afterwards; that entry stays uncommitted until the next approved commit.
- Database/schema changes: none · Dependency changes: none · Application code: unchanged · npx cache folder: still untouched.

### LOG-20261021-0154-push-confirmed — Result of LOG-20261021-0154-commit-log
- Time: 2026-10-21 01:54:34 +03:00 (Africa/Nairobi) — source: PowerShell `Get-Date`.
- Contributor/session: collaborator (local Git identity Sean Macharia) / Claude Code (Opus 5.5), same session.
- Commit: `bb47544` (`bb47544c00bb1169cb39fbe731887f594b649a9e`), parent `5e2910f`, author time 01:54:11 +03:00. `CLAUDE.md` only: 1 file, 60 insertions, 2 deletions. Working tree clean afterwards.
- Push:
  - Remote branch confirmed at `5e2910f` just before. A normal `git push origin feature/frontend-foundation` reported `5e2910f..bb47544`.
  - Afterwards `git ls-remote origin`: `feature/frontend-foundation` = `bb47544`, `main` = `883f93b` (unchanged). The remote-tracking reflog records "update by push" `5e2910f → bb47544` at 01:54:17 +03:00.
  - No force push, no merge.
- The repository owner can now pull `feature/frontend-foundation` at `bb47544`, which contains all phase 1–3 code (`5e2910f`) and the log up to LOG-20261021-0154-commit-log.
- **This entry is uncommitted** (it records the push of the commit before it) and goes into the next approved commit.
- Files edited: `CLAUDE.md` (this entry). Database/schema: none · Dependencies: none.
- Commit: not committed · Pushed: no.
- Working-tree status after: `CLAUDE.md` modified; nothing else.

### LOG-20261021-0158-wrap-up — npx cache folder deleted; end-of-session state
- Time: 2026-10-21 01:57:49 +03:00 (Africa/Nairobi) — source: PowerShell `Get-Date`.
- Contributor/session: collaborator (local Git identity Sean Macharia) / Claude Code (Opus 5.5). Instruction: "now delete the npx folder, i also want to stop working now so make sure everything is ok".
- **Deleted (outside the repository):** `C:\Users\HP\AppData\Local\npm-cache\_npx\8b377f6eec906bc4\`, the incomplete next@16.4.2 download created by mistake in LOG-20261021-0128-precommit-review.
  - Checked before deleting: same folder (created 01:24:08 +03:00, 249 MB, the same 19 packages, `next/package.json` still unreadable). No process referenced it, and no npx or next process was running.
  - Deleted with `rm -rf`; confirmed gone afterwards.
  - The other npx cache entries (`cc2145a2fe1558fa` = create-next-app, `ccf722f030a36e55` = @nestjs/cli, both from 2026-09-13) predate this session and were left alone.
- **End-of-session checks:**
  - `git fetch origin` → nothing new. Branch `feature/frontend-foundation` = `origin/feature/frontend-foundation` = `bb47544`; `main` = `origin/main` = `883f93b` (never changed this session).
  - `Frontend/` and `Backend/` match HEAD (no uncommitted code). Only `CLAUDE.md` is modified (LOG-20261021-0154-push-confirmed and this entry). Nothing staged; no stashes; no merge or lock.
  - Ignored local files unchanged in kind: `.env` files, `node_modules/`, `.next/`, `dist/`, `next-env.d.ts`.
  - No dev or production servers running; ports 3000 and 3100 free.
- **Left on this machine, outside the repository (not part of the project):**
  - The session scratchpad: test scripts, logic tests, `pr-description.md`, scan and build logs. It may be cleared automatically; nothing in the project depends on it.
  - The Claude Code memory note holding the "log everything in CLAUDE.md" rule (LOG-20261021-0116-logging-rule).
- **Open items for the next session:**
  1. Commit the uncommitted `CLAUDE.md` entries (LOG-20261021-0154-push-confirmed and this one) when approved, so the repository owner sees them.
  2. Browser walkthrough of phases 1–3 (checklist in the PR draft; not yet done).
  3. Open the pull request `feature/frontend-foundation` → `main` (draft description in LOG-20261021-0144-pr-draft).
  4. Decide on backend work (start with protecting or removing `GET /`).
- Database/schema changes: none · Dependency changes: none · Application code: unchanged.
- Files edited: `CLAUDE.md` (this entry, §14). Commit: not committed · Pushed: no.
- Working-tree status after: `CLAUDE.md` modified; nothing else.

### LOG-20261021-0159-final-commit — Commit and push of the last log entries; session closed
- Time: 2026-10-21 01:59:00 +03:00 (Africa/Nairobi), taken before this entry — source: PowerShell `Get-Date`.
- Contributor/session: collaborator (local Git identity Sean Macharia) / Claude Code (Opus 5.5). Authorized by the collaborator: "commit and push the CLAUDE.md entries".
- Pre-commit checks:
  - `git fetch origin` → nothing new. `feature/frontend-foundation` = `origin` = `bb47544`; `main` = `883f93b`.
  - Only `CLAUDE.md` modified, last written 01:58:09 +03:00 by LOG-20261021-0158-wrap-up. Nothing staged; no stashes.
- What is committed: `CLAUDE.md` only. That covers LOG-20261021-0154-push-confirmed, LOG-20261021-0158-wrap-up and this entry. Commit message: "docs: log final push confirmation and session wrap-up in CLAUDE.md", parent `bb47544`.
- Push: immediately after the commit, a normal `git push origin feature/frontend-foundation`, only if the remote branch is still `bb47544`. `main` is not changed; nothing is merged.
- **How the result is recorded:** so the session ends with a clean working tree, **no further local entry is written after this push** (an exception to §15 rule 2's follow-up-entry practice, which would otherwise leave one uncommitted entry after every push).
  - The result is verifiable from Git: `git ls-remote origin refs/heads/feature/frontend-foundation` should equal this commit (`git log -1 feature/frontend-foundation`), and `.git/logs/refs/remotes/origin/feature/frontend-foundation` should show "update by push" from `bb47544`.
  - If the push failed, the next session's first entry must say so.
- Database/schema changes: none · Dependency changes: none · Application code: unchanged.
- Working-tree status after: expected clean; verify with `git status`.

### LOG-20261021-2240-sidebar-pages — Grouped sidebar; agents, expenses, reports, users and settings pages (frontend, demo)
- Time: work started 2026-10-21 22:21:04 +03:00; checks finished 22:39:16 +03:00; entry written about 22:40 +03:00 (Africa/Nairobi) — source: PowerShell `Get-Date`.
- Contributor/session: operator not confirmed in this session; local Git identity Sean Macharia / Claude Code (Opus 5.5).
- Instructions received:
  - A pasted brief: reorganise the sidebar into Overview, Operations, Contacts, Finance, Insights and Administration groups, in a fixed order. Add pages for Agents and Partners (if missing), Expenses and Profitability, Reports and Analytics, Users and Permissions, and Settings and Audit Logs.
  - Do not rename the shipments page. Do not split the Customers page. Preserve existing features.
  - Frontend only (plus this log). No backend, schema, Prisma, dependency or integration changes. No database or deploy commands. No reset, stash or branch switch. No commit or push.
  - Run tsc, lint and build; verify every sidebar link; report.
  - The operator added: "make sure you also write what you do in the claude.md".
- **Confirmation for LOG-20261021-0159-final-commit:** the push succeeded. `git ls-remote origin` (22:21) shows `refs/heads/feature/frontend-foundation` = `77471c7` = local HEAD = `origin/feature/frontend-foundation`; `main` = `883f93b` (unchanged). Working tree was clean and there were no stashes at the start.
- What changed (all under `Frontend/frontend/`):
  - **Sidebar** (`components/layout/nav-items.ts`, `sidebar.tsx`):
    - Six labelled groups in the requested order.
    - Each group can be collapsed. The group holding the current page always stays open. Collapsed state is not stored.
    - Active-page highlighting is unchanged.
    - Sidebar labels differ from page titles where requested; routes and page titles were not renamed.
    - New icons in `components/ui/icons.tsx`.
  - **Agents and partners:**
    - New `/agents` page: agents, carriers and transporters (reusing `PartyTable`), plus agent routes.
    - New `/agents/[id]` page reuses `PartyDetailView` for non-customers; a customer id returns not-found.
    - Links to agents, carriers and transporters now go to `/agents/…`. Old `/parties/a-…` links still work.
    - `/parties` (Customers & agents) is unchanged and still one page.
  - **Expenses and profitability** (`/expenses`, `/expenses/new`):
    - `Expense` gained a `category` (carrier, transport, handling, storage, customs, agent fees, other).
    - New demo data: `CostEstimate` records (job-costing estimates) and 8 more demo expenses (`e-06`–`e-13`). These include duty disbursements equal to the assessed duty already shown on two shipments. Existing expenses `e-01`–`e-05` are unchanged except for the new category. The "awaiting approval" total is unchanged.
    - Expenses are now held in the session store (`recordExpense`). Recording one adds an "Expense" entry to the shipment history.
    - The page shows estimated vs invoiced charges, estimated vs actual costs, cost variance, estimated and actual-to-date profit with margin, an expense list with filters and totals, costs by category, and how each figure is calculated (`lib/profitability.ts`).
    - The Finance page's "Job expenses" card and "Expenses awaiting approval" tile now read the session store. The shipment page's "Costs and billing" card does too, and links to "Record expense".
  - **Reports and analytics** (`/reports`):
    - Filters: planned-ETA date range, customer, status and mode.
    - Sections: shipment volumes (by mode, status and month); delivery performance (arrival vs planned ETA, 24 h grace); customs delays; outstanding invoices with ageing; revenue and expenses by month; shipment profitability.
    - CSV downloads are built in the browser, with formula-injection protection. "Print / save as PDF" uses the browser.
    - Scheduled and emailed reports are labelled planned.
  - **Users and permissions** (`/users`):
    - 6 demo accounts using names already in the demo data, with illustrative roles.
    - Five roles and a permission matrix (`lib/access.ts`). Customer billing, invoices, payments and margins are limited to finance and management.
    - Banner: "Prototype: permissions are not enforced". "Invite user" is disabled and labelled planned.
  - **Settings and audit log** (`/settings`):
    - Read-only sections: company details (unknown values say "Not recorded"), currencies, charge categories, numbering formats, and other configuration.
    - The previous System status content (backend health card, integrations, planned modules) is kept as a section; the planned-modules list was updated.
    - Audit log preview built from shipment and quotation change histories plus the demo activity entries. It has filters and labels each entry "This tab" or "Demo entry". It states that it is not a production audit log.
  - `docs/api-contracts.md`: added contracts for expenses and costing, reports, users, settings and the audit log.
- Files:
  - Edited (17): `app/finance/page.tsx`, `app/layout.tsx`, `app/settings/page.tsx`, `app/shipments/[reference]/page.tsx`, `components/layout/{nav-items.ts,sidebar.tsx}`, `components/parties/{party-detail-view,party-table}.tsx`, `components/shipments/{shipment-detail-view,shipment-history}.tsx`, `components/ui/icons.tsx`, `docs/api-contracts.md`, `lib/data/{demo-data.ts,index.ts,session-store.tsx}`, `lib/{labels,types}.ts`.
  - Created (17): `app/agents/page.tsx`, `app/agents/[id]/page.tsx`, `app/expenses/page.tsx`, `app/expenses/new/page.tsx`, `app/reports/page.tsx`, `app/users/page.tsx`, `components/expenses/{expense-form,expenses-view,shipment-costs-card}.tsx`, `components/finance/job-expenses.tsx`, `components/reports/{report-parts,reports-view}.tsx`, `components/settings/audit-log.tsx`, `lib/{access,expense-form,profitability,reports}.ts`.
  - Deleted: none. Also edited: `CLAUDE.md` (§3, §4, §5, §11, §14, this entry).
- Database/schema changes: none · Dependency changes: none · Backend: untouched.
- Commands that changed project state: `next typegen` and `npm run build` (git-ignored `.next/` only); `next start -p 3100` using the project's own binary by absolute path, stopped by PID 3856 after confirming its command line (the "exit code 127" reported afterwards is that stop). Port 3100 free afterwards. `git fetch origin` (nothing new).
- Checks run and results:
  - `tsc --noEmit --incremental false` → exit 0; `npm run lint` → exit 0; `npm run build` → exit 0, 25 route entries.
  - Logic tests in the session scratchpad (outside the repo) → 28/28 groups pass: the three earlier suites plus a new `logic-test-p4.ts` with 6 groups (demo data integrity, expense validation, costing figures checked by hand, reports, CSV quoting and formula protection, permission matrix).
  - Curl: all 12 sidebar hrefs present in the rendered HTML; all 23 pages checked → 200 with the expected `<h1>`; `/agents/c-001` → not-found; `/nowhere` → 404.
  - Content checks on the new pages passed; no server errors.
  - `git diff --check` clean. Scan of added lines: no emails other than `.example`, no secrets or connection strings, no `localStorage`/`sessionStorage`, `console.log` or new network calls.
  - No browser or visual review.
- **Failed attempts and findings:**
  - The first edit of `lib/data/demo-data.ts` (Bash heredoc plus `node -e`) failed with a shell quoting error before writing anything (`git status` confirmed); it was redone with the Edit tool.
  - The new logic test found that the shared `fromDateInput` (phase 1) accepts impossible dates such as `2026-02-30`, which roll over to 2 March. Not changed: browser date pickers cannot produce such values, and changing a shared helper was outside this task. Recorded as a known limitation.
  - The curl script first marked 10 headings "FAIL" only because it compared `&` with the HTML-escaped `&amp;`; the headings were correct.
- Outside the repository: session scratchpad files `alias-hooks.mjs`, `register.mjs` and the three earlier logic tests (copied from the previous session's scratchpad), plus `logic-test-p4.ts`, `crawl.sh`, `crawl_body.html` and `build.log`. Nothing else.
- Known limitations / outstanding:
  - All new pages use demo data or the session store; nothing is saved permanently.
  - Cost estimates, settings, roles and permissions are read-only.
  - Expenses cannot be approved, paid, edited or deleted.
  - There is no auth, so the permission matrix is a design, not enforcement.
  - Report figures depend on the fixed demo date (19 Oct 2026).
  - Needs a browser check: sidebar collapse and the mobile drawer at phone width; recording an expense end to end; CSV download and print; report filters; audit log filters after making edits.
- Commit: not committed · Pushed: no (as instructed; awaiting the operator's approval).
- Working-tree status after: 18 modified (17 frontend files + `CLAUDE.md`) and 17 untracked (35 entries in total), all under `Frontend/frontend/` apart from `CLAUDE.md`; nothing staged; branch `feature/frontend-foundation` = `77471c7`.

### LOG-20261021-2304-browser-review — Requirements review and first browser testing of the whole frontend
- Time: started 2026-10-21 22:49:58 +03:00; testing finished and processes stopped 23:04:00 +03:00 (Africa/Nairobi) — source: PowerShell `Get-Date`.
- Contributor/session: operator not confirmed in this session; local Git identity Sean Macharia / Claude Code (Opus 5.5).
- Instruction received (pasted brief):
  - Review the whole frontend against all of the repository owner's requirements, "including the screenshots and the clarification about sidebar grouping".
  - Report Notifications and Tasks explicitly.
  - Run a browser review and fix only verified frontend defects.
  - No commit, push, merge, reset, revert, stash or branch switch.
  - Log the checks actually performed.
- **Sources available:** §2 of this file, the earlier phase logs, and the sidebar brief from this session. **No screenshots and no written Notifications and Tasks requirement were available in this session or in the repository**, so the review could not be checked against them.
- **How the browser testing was done:**
  - Tools: installed Google Chrome, headless, with a throwaway profile in the session scratchpad and remote debugging on `127.0.0.1:9333`. It was driven by scratchpad scripts using only Node 24 built-ins (`fetch` and `WebSocket`, Chrome DevTools Protocol).
  - Target: the production build served by `next start -p 3100`.
  - Nothing was installed, and nothing was added to the repository or to `package.json`.
  - Forms were filled as a user would. Files were attached through the real file input. Open and Download used trusted mouse clicks. Downloads went to the scratchpad. Print layout was checked by emulating print media.
- **Browser-tested and passing (final run on the rebuilt app; 49 steps, 0 failures, no console errors or exceptions):**
  - **Sidebar:**
    - Six groups in the requested order with the requested items. All 12 links navigate client-side to the right page, with the correct highlight and top-bar label.
    - A group collapses and expands; the group holding the current page cannot be collapsed.
    - Customers (`/parties`) is one page with all four sections.
  - **Mobile, 390×844:**
    - The sidebar is hidden; the menu opens the drawer and moves focus to its close button.
    - A drawer link navigates and closes the drawer. Escape closes it and returns focus to the menu button.
    - Screenshots were reviewed visually.
  - **No sideways page scrolling:** checked on 22 pages, including detail and form pages, at 390, 768 and 1280 px.
  - **Shipments:**
    - An empty submit shows a focused error summary (12 problems). Create works (`FMS-SEA-2610-0042`), as does edit (carrier).
    - Status changes to In transit with a note. Arrived without an actual arrival time is rejected, and accepted once the time is given.
    - Milestone update works.
    - Delay recording: "Next action" is required for an open delay. The revised ETA is shown, and a follow-up action can be added.
    - The change history and dashboard activity list the changes; the "Delayed" view filters correctly.
    - Reloading clears session data, as the UI says.
  - **Quotations:**
    - Create with two lines: 450 × 320.50 + 15,000 + 16% gives KES 161,625.00 exactly.
    - Print calls the browser dialog, hides the app shell, and shows the demo banner.
    - Record sent → accepted → convert to a prefilled shipment (`FMS-AIR-2610-0042`). The quotation shows Booked; duplicate as draft works.
  - **Customer page:** billing, balance and service history include the new quotation; the history type filter works.
  - **Agents and Partners:** list → agent `a-001` (routes and jobs, nav highlight on Agents and Partners) → back link → transporter `t-001`.
  - **Documents:**
    - A `.pdf` that is really a program, and an empty file, are both rejected with clear messages.
    - A real PDF is accepted and fulfils the missing certificate-of-origin requirement.
    - Open shows it in exactly one new tab (`blob:` URL). Download saves it with the original name and identical bytes.
    - Rejecting without a reason is refused; verify works.
  - **Expenses:**
    - An empty submit shows the error summary. Recording an expense raises the count from 13 to 14 and shows a notice ("Ksh 125,000").
    - The expense appears in the Finance "Job expenses" card, the shipment costs card and the shipment history.
    - The category and status filters work.
  - **Reports:**
    - Filters change the counts: all 11 → air 3 → plus a customer 1 → a single day 1. Reset restores them.
    - The filtered CSV contains only air rows. All six CSV buttons download a file.
  - **Audit log:** entries made in this tab appear, and the "This tab", "Demo entries" and record-type filters work.
- **Defect found and fixed (1):**
  - Symptom: `/documents` scrolled sideways by 245 px at phone width.
  - Cause: screen-reader-only text (`sr-only`, absolutely positioned) inside table cells was positioned relative to the page, not the table's scroll box.
  - Fix: `components/ui/table.tsx` — added `relative` to the shared table scroll region, with a comment.
  - Verified: no overflow on 22 pages at three widths after rebuilding.
- **Observations, not changed:**
  - The milestone panel allowed the last milestone ("Delivered") to be marked current while the shipment status was Arrived. This is a consistency question for the repository owner, not a confirmed defect.
  - Script-side mistakes during testing were corrected in the scripts, not the app:
    - Group headings are shown in capitals by CSS.
    - The delay form needs "Next action".
    - "Update a milestone" first reveals its form.
    - The money format shows "Ksh".
    - Background tabs pause `requestAnimationFrame`.
    - Two scratch-script edits broke because `$'` in a JS replacement string is a special pattern; the scripts were repaired.
- **Notifications and Tasks — status: missing (no dedicated functionality):**
  - What exists:
    - A read-only "Pending tasks" card on the dashboard (`TaskList`, `getTasks()`, 6 fixed demo tasks).
    - The delay field "Customer notification", recorded manually, with a "No notifications are sent" notice.
    - "Notifications and reminders" in the Settings planned-modules list.
  - What is missing: a Notifications/Tasks page, route and sidebar entry. Also missing: creating, assigning, completing or snoozing tasks; reminders; a notification list or inbox; and any sending (email/SMS/in-app).
  - Not built in this session: it is a missing feature, not a defect. The sidebar brief from this session did not include it, so its place in the six groups needs the repository owner's decision.
- Other checks: `tsc --noEmit` → exit 0; `npm run lint` → exit 0; `npm run build` → exit 0, 25 route entries; `git diff --check` clean.
- Processes:
  - `next start -p 3100` was started twice (before and after the rebuild).
  - Headless Chrome was started once, then 13 processes were stopped by their profile path.
  - The "exit code 127" notices are from these stops.
  - Ports 3100 and 9333 were free afterwards.
- Files outside the repository (session scratchpad):
  - Scripts: `cdp.mjs`, `t1-sidebar.mjs` … `t5-overflow.mjs`, `probe-*.mjs`.
  - Test files: `upload/` (test PDF, a renamed program, an empty file), `downloads/` (downloaded PDF and 6 CSVs).
  - Other: `chrome-profile/`, PNG screenshots, `build2.log`.
- Files changed in the repository: `Frontend/frontend/components/ui/table.tsx`; `CLAUDE.md` (this entry, §5, §11, §14). The §5 rows for phases 1–3 still said "uncommitted" although they were committed in `5e2910f`; they were corrected, and a "Notifications and tasks — Missing" row was added.
- Database/schema changes: none · Dependency changes: none · Backend: untouched.
- Commit: not committed · Pushed: no.
- Working-tree status after: 19 modified (18 frontend + `CLAUDE.md`) and 17 untracked (36 entries); nothing staged; no stashes; branch `feature/frontend-foundation` = `77471c7`.

### LOG-20261021-2338-notifications-tasks — Notifications and Tasks page (frontend, demo)
- Time: started 2026-10-21 23:13:36 +03:00; checks finished and processes stopped 23:38:15 +03:00 (Africa/Nairobi) — source: PowerShell `Get-Date`.
- Contributor/session: operator not confirmed in this session; local Git identity Sean Macharia / Claude Code (Opus 5.5).
- Instruction received (pasted):
  - Add a dedicated Notifications and Tasks page under Operations.
  - Notifications: upcoming arrivals, delayed shipments, missing or expiring documents, pending quotations, overdue invoices.
  - Tasks: assignee, due date, priority, status and follow-up notes.
  - Link each item to its shipment, quotation, document or invoice. Add a summary to the dashboard.
  - Keep the sidebar grouping and all pages. Demo data only, clearly labelled; no fake persistence or integrations. Update the API contracts.
  - No commit, push, merge, reset, revert, stash or branch switch.
- Pre-work checks: branch `feature/frontend-foundation` = `77471c7`; 36 uncommitted entries from the earlier work in this session, all preserved; no stashes.
- What changed (all under `Frontend/frontend/`):
  - **Sidebar:**
    - "Notifications and Tasks" (`/notifications`) is the last item under Operations. No other item, group or page was renamed or moved.
    - The link shows the number of unread notifications.
    - All sidebar labels now wrap instead of truncating, and link spacing was tightened slightly so the sidebar fits at 1280×900 (see defects below).
  - **Notifications** (`lib/notifications.ts`): calculated in the browser from the current records against the fixed demo date. Nothing is stored or sent. Rules:
    - Arrivals due within 7 days.
    - Open or monitored delays.
    - Missing or rejected documents on active shipments (high priority once the cargo is at destination).
    - Documents expiring within 14 days or already expired.
    - Quotations sent and awaiting a decision, accepted but not booked, or still a draft.
    - Unpaid invoices past their due date (same day count as the reports page).
  - **Notification behaviour:**
    - Ids are stable, so "read" markers (session only) survive recalculation; a notification disappears when its cause is resolved.
    - Filters: by type, and unread only. Actions: mark read or unread, mark all read.
    - "Create task" opens a task form prefilled from the notification.
  - **Tasks** (`lib/task-form.ts`, `lib/task-changes.ts`; routes `/notifications/tasks/new`, `/[id]`, `/[id]/edit`):
    - Fields: title, details, assignee (staff accounts), due date and time, priority, and status (open, in progress, done, cancelled).
    - Optional links to a shipment, document (which must belong to that shipment), quotation or invoice.
    - Each change adds an automatic follow-up note; users can add their own notes. Status buttons follow the allowed transitions.
    - Filters: status (outstanding, overdue, done, cancelled, all), assignee, priority.
    - Tasks live in the session store. Task changes appear in the dashboard activity and in the audit-log preview (new "Tasks" record type).
  - **Dashboard:** the static "Pending tasks" card was replaced by "Alerts and tasks", which reads the session store. It shows unread medium and high alerts and outstanding tasks, with links. The old `TaskList` component was removed.
  - **Documents:**
    - Optional `expiresAt` field. The upload form has an optional "Valid until" date.
    - The documents list shows the validity date (red once expired). Rows have `id="doc-…"` anchors for links.
    - Demo data: fictional expiry dates on `d-04` (20 Oct 2026) and `d-12` (31 Oct 2026).
  - **Demo tasks:**
    - Status and notes added; `tk-01` is in progress with one note.
    - Links added to existing documents and invoices (`tk-01`→`d-07`, `tk-04`→`d-14`, `tk-05`→`d-09`, `tk-06`→`INV-2610-0098`).
    - New `tk-07` (quotation `QT-2610-0057`).
    - `tk-06` assignee changed from "Finance (F. Mwende)" to "F. Mwende" to match the staff accounts.
  - Settings planned-modules wording updated (notification delivery and reminders still planned). `docs/api-contracts.md` gained a "Notifications and tasks" section describing the backend that will be needed.
- Files:
  - Edited: `app/layout.tsx`, `app/page.tsx`, `app/settings/page.tsx`, `components/dashboard/panels.tsx`, `components/documents/{document-list,upload-form}.tsx`, `components/layout/{nav-items.ts,sidebar.tsx}`, `components/settings/audit-log.tsx`, `components/ui/icons.tsx`, `docs/api-contracts.md`, `lib/data/{demo-data.ts,session-store.tsx}`, `lib/{document-changes,labels,types}.ts`.
  - Created: `app/notifications/page.tsx`, `app/notifications/tasks/new/page.tsx`, `app/notifications/tasks/[id]/page.tsx`, `app/notifications/tasks/[id]/edit/page.tsx`, `components/dashboard/alerts-summary.tsx`, `components/notifications/{notification-list,notifications-view,record-links,task-detail-view,task-form,task-list}.tsx`, `lib/{notifications,task-changes,task-form}.ts`.
  - Deleted: none. `CLAUDE.md`: this entry, §3, §5, §11, §14.
- Database/schema changes: none · Dependency changes: none · Backend: untouched.
- Checks run and results:
  - `tsc --noEmit` → exit 0; `npm run lint` → exit 0; `npm run build` → exit 0, 29 route entries.
  - Logic tests → 34/34 groups pass. The new `logic-test-p5.ts` has 6 groups, with hand-worked expected notifications (17 on the seed data), task validation, task changes and seed links.
  - Headless Chrome, final run on the last build:
    - Notifications and tasks: 12/12 steps.
    - Earlier scenarios: sidebar 19, shipments 12, quotations/customers/agents 8, documents/expenses/reports/audit 11, overflow 3 (25 pages at 390, 768 and 1280 px), sidebar fit 4 (1280×900, 1440×900, 1280×800, 1280×720).
    - No browser console errors.
    - Screenshots reviewed: desktop and mobile notifications page, task page, dashboard card.
- **Defects found and fixed during testing:**
  1. The sidebar label was cut off ("Notifications and T…") by the unread count.
  2. With the extra item, the sidebar scrolled at 1280×900, and its scrollbar truncated "Quotations and Bookings" and "Expenses and Profitability". Fixed by wrapping labels, slightly tighter spacing and a thin scrollbar; it now fits at 900 px height, and labels stay complete when it scrolls at 800 and 720 px.
  3. The task page showed "Due: due 19 Oct".
  4. The notification overdue-day count rounded differently from the reports page (9 vs 8 days); now uses the same formula.
- **Observations, not changed:**
  - After a client-side link to `/finance#INV-…`, the `:target` highlight does not appear, because browsers do not apply it when the URL changes without a full page load. The row is still the link target. This also applies to older invoice links.
  - Seed tasks due on 19 Oct are not "overdue" at the fixed demo time (19 Oct, 09:00).
- Script-only problems corrected during testing:
  - Text styled in capitals.
  - Template-string regex escapes.
  - A navigation race in the upload step (passes three times out of three in isolation).
  - A `rm` of the scratchpad downloads folder was blocked by a safety check before running; fresh folders (`downloads-run3` to `downloads-run5`) were used instead and nothing was deleted.
- Processes: `next start -p 3100` started 4 times (around rebuilds) and headless Chrome once (16 processes), each stopped after checking its command line. The "exit code 127" notices are from those stops. Ports 3100 and 9333 free afterwards.
- Outside the repository (scratchpad): `logic-test-p5.ts`, `t6-notifications.mjs`, `t7-sidebar-fit.mjs`, `shot.mjs`, `probe-upload.mjs`, `build3.log`–`build5.log`, new PNG screenshots, `downloads-run3`–`downloads-run5/`.
- Commit: not committed · Pushed: no.
- Working-tree status after: 24 modified (23 frontend + `CLAUDE.md`) and 31 untracked (55 entries); nothing staged; no stashes; branch `feature/frontend-foundation` = `77471c7`.

### LOG-20261021-2341-commit-push — Commit and push of the sidebar pages, browser review and notifications and tasks
- Time: 2026-10-21 23:41:16 +03:00 (Africa/Nairobi), taken before this entry — source: PowerShell `Get-Date`.
- Contributor/session: operator not confirmed in this session; local Git identity Sean Macharia / Claude Code (Opus 5.5). Instruction: "commit and push".
- **Confirmation for LOG-20261021-0159-final-commit:** already recorded in LOG-20261021-2240-sidebar-pages (`77471c7` is on `origin`).
- Pre-commit checks:
  - `git fetch origin` → nothing new. `git ls-remote origin` → `feature/frontend-foundation` = `77471c7` = local HEAD = `origin/feature/frontend-foundation`; `main` = `883f93b`.
  - 55 changed entries, all under `Frontend/frontend/` or `CLAUDE.md`. Nothing staged; no stashes; no merge, rebase or `index.lock`.
  - The checks from LOG-20261021-2338-notifications-tasks were run on this exact code: tsc, lint, build, logic tests 34/34, all browser scenarios. Only `CLAUDE.md` has changed since.
- What is committed:
  - The work in LOG-20261021-2240-sidebar-pages, LOG-20261021-2304-browser-review and LOG-20261021-2338-notifications-tasks.
  - The `CLAUDE.md` updates, including this entry.
  - Staged with `git add -- CLAUDE.md Frontend/frontend`. Before committing, the staged list is checked: exactly 55 files, nothing outside those paths, `git diff --cached --check` clean.
- Commit message: "feat(frontend): grouped sidebar, agents, expenses, reports, users, settings, notifications and tasks (demo)", parent `77471c7`, with the Claude co-author trailer. A file cannot record its own hash; see `git log -1 feature/frontend-foundation`.
- Push: a normal (non-force) `git push origin feature/frontend-foundation`, only if the remote branch is still `77471c7`. `main` is not changed and nothing is merged.
- **How the result is recorded:** as in LOG-20261021-0159-final-commit, no local entry is written after the push, so the working tree ends clean.
  - Verify with `git ls-remote origin refs/heads/feature/frontend-foundation` (should equal `git log -1 --format=%H feature/frontend-foundation`).
  - The remote-tracking reflog should show "update by push" from `77471c7`.
  - If the push failed, the next session's first entry must say so.
- Database/schema changes: none · Dependency changes: none · Backend: untouched.
- Working-tree status after: expected clean; verify with `git status`.

### LOG-20261021-2344-pr-description — PR description updated for the whole branch
- Time: 2026-10-21 23:43:03 +03:00 (start) to 23:44:02 +03:00 (Africa/Nairobi) — source: PowerShell `Get-Date`.
- Contributor/session: operator not confirmed in this session; local Git identity Sean Macharia / Claude Code (Opus 5.5). Instruction: "update the PR description to cover the new pages".
- **Confirmation for LOG-20261021-2341-commit-push:** the push succeeded. `git push` reported `77471c7..a0cb63b`. `git ls-remote origin` shows `feature/frontend-foundation` = `a0cb63b`, `main` = `883f93b` (unchanged), and the remote-tracking reflog records "update by push". The working tree was clean afterwards.
- Read-only checks: `git fetch origin` → nothing new. The branch is 5 commits ahead of `origin/main`, and `main` is an ancestor (merges cleanly). 120 files differ from `main`, all under `Frontend/frontend/` or `CLAUDE.md`; none in the backend, `package.json` or the lockfile.
- What was written:
  - A new `pr-description.md` in the session scratchpad, outside the repository, for the operator to paste into GitHub. It replaces the earlier draft from LOG-20261021-0144-pr-draft (which covered only `5e2910f`; that file was left untouched in the earlier session's scratchpad).
  - Contents: the sidebar structure; every page, including the new ones; run instructions (top commit `a0cb63b`); the checks actually performed, including the browser testing and the defects it found; a review checklist; what is missing or demo-only; decisions for the repository owner.
  - It states that the fresh-clone check was done for `5e2910f` only and not repeated for `a0cb63b`.
  - Uses role labels only; a scan found no personal names or emails.
- The PR itself was not opened: the GitHub CLI is not installed (LOG-20261021-0144-pr-draft), and opening one needs the operator's approval.
- Database/schema changes: none · Dependency changes: none · Application code: unchanged.
- Files edited: `CLAUDE.md` (this entry only). Commit: not committed · Pushed: no.
- Working-tree status after: `CLAUDE.md` modified; nothing else.

### LOG-20261021-2345-commit-log — Commit and push of the PR-description log entry
- Time: 2026-10-21 23:45:33 +03:00 (Africa/Nairobi) — source: PowerShell `Get-Date`.
- Contributor/session: operator not confirmed in this session; local Git identity Sean Macharia / Claude Code (Opus 5.5). Instruction: "commit and push the CLAUDE.md entry".
- Pre-commit checks:
  - `git fetch origin` → nothing new. `feature/frontend-foundation` = `origin` = `a0cb63b`; `main` = `883f93b`.
  - Only `CLAUDE.md` modified (LOG-20261021-2344-pr-description). Nothing staged; no stashes.
- What is committed: `CLAUDE.md` only (LOG-20261021-2344-pr-description and this entry). Commit message: "docs: log PR description update in CLAUDE.md", parent `a0cb63b`.
- Push: a normal `git push origin feature/frontend-foundation`, only if the remote branch is still `a0cb63b`. `main` is not changed; nothing is merged.
- **How the result is recorded:** as in LOG-20261021-0159-final-commit, no local entry is written after the push, so the working tree ends clean. Verify with `git ls-remote origin refs/heads/feature/frontend-foundation` against `git log -1 feature/frontend-foundation`. If the push failed, the next session's first entry must say so.
- Database/schema changes: none · Dependency changes: none · Application code: unchanged.

### LOG-20261021-2346-pr-refs — PR description commit references updated
- Time: 2026-10-21 23:46:37 +03:00 (Africa/Nairobi) — source: PowerShell `Get-Date`.
- Contributor/session: operator not confirmed in this session; local Git identity Sean Macharia / Claude Code (Opus 5.5). Instruction: "update the PR description commit references to 2c4eb8e".
- **Confirmation for LOG-20261021-2345-commit-log:** the push succeeded. `git push` reported `a0cb63b..2c4eb8e`, and `git ls-remote origin` shows `feature/frontend-foundation` = `2c4eb8e`. The remote-tracking reflog records "update by push", `main` = `883f93b` is unchanged, and the working tree was clean.
- Changed in the scratchpad `pr-description.md` (outside the repository):
  - The Compare line and the expected `git log` output now show `2c4eb8e`; "5 commits" became "6 commits". The file count stays at 120.
  - The checks line now says the checks ran at `a0cb63b`, and that `2c4eb8e` only adds `CLAUDE.md` log entries, so the application code is identical (`git diff --name-only a0cb63b 2c4eb8e` → `CLAUDE.md` only). The checks were not re-run.
  - The fresh-clone caveat now names `2c4eb8e`; LOG-20261021-2344 and -2345 were added to the log list.
- Files edited: `CLAUDE.md` (this entry). Commit: not committed · Pushed: no.
- Working-tree status after: `CLAUDE.md` modified; nothing else.

### LOG-20261021-2347-wrap-up — End of session: final commit and push
- Time: 2026-10-21 23:47:33 +03:00 (Africa/Nairobi) — source: PowerShell `Get-Date`.
- Contributor/session: operator not confirmed in this session; local Git identity Sean Macharia / Claude Code (Opus 5.5). Instruction: "make sure everything is committed and pushed so i can stop for today".
- **End-of-session checks:**
  - No dev or production servers and no test browser running (no `next` processes; no Chrome processes with the session's test profile). Ports 3000, 3001, 3100 and 9333 free.
  - `git fetch origin` → nothing new. `feature/frontend-foundation` = `origin` = `2c4eb8e`; `main` = `883f93b` (never changed this session).
  - Only `CLAUDE.md` modified (LOG-20261021-2346-pr-refs and this entry). Nothing staged; no stashes; no lock or merge in progress.
- What is committed: `CLAUDE.md` only, plus the §14 note below. Commit message: "docs: log PR description references and session wrap-up in CLAUDE.md", parent `2c4eb8e`.
- Push: a normal `git push origin feature/frontend-foundation`, only if the remote branch is still `2c4eb8e`. `main` is not changed; nothing is merged.
- **How the result is recorded:** as in LOG-20261021-0159-final-commit, no local entry is written after this push, so the session ends with a clean working tree. Verify with `git ls-remote origin refs/heads/feature/frontend-foundation` against `git log -1 feature/frontend-foundation`. If the push failed, the next session's first entry must say so.
- **Left on this machine, outside the repository (not part of the project):**
  - The session scratchpad (a temporary folder; may be cleared automatically). It holds the test scripts and screenshots, the Chrome test profile, the download folders, and **`pr-description.md`, the pull request description to paste into GitHub**. Copy it somewhere safe before it is cleared; it can be regenerated from LOG-20261021-2344-pr-description if lost.
  - The Claude Code memory note with the "log everything in CLAUDE.md" rule (unchanged).
- **Open items for the next session:**
  1. Open the pull request `feature/frontend-foundation` → `main` using `pr-description.md` (the GitHub CLI is not installed here).
  2. A person should click through the app in a normal browser (checklist in the PR description). Safari, Firefox and screen readers are not yet tested.
  3. Repository owner decisions: whether the "Delivered" milestone may be current while the status is "Arrived", and whether the roles and permission matrix fit the team.
  4. Decide on backend work, starting with removing or protecting `GET /`.
- Database/schema changes: none · Dependency changes: none · Application code: unchanged.
- Working-tree status after: expected clean; verify with `git status`.

### LOG-20261021-2349-pr-refs — PR description updated to 803a685 (entry left uncommitted on purpose)
- Time: 2026-10-21 23:49:04 +03:00 (Africa/Nairobi) — source: PowerShell `Get-Date`.
- Contributor/session: operator not confirmed in this session; local Git identity Sean Macharia / Claude Code (Opus 5.5). Instruction: "update the PR description to 803a685".
- **Confirmation for LOG-20261021-2347-wrap-up:** the push succeeded. `git push` reported `2c4eb8e..803a685`; `git ls-remote origin` shows `feature/frontend-foundation` = `803a685` and `main` = `883f93b`. The working tree was clean afterwards.
- Changed in the scratchpad `pr-description.md` (outside the repository):
  - The Compare line and the expected `git log` output now show `803a685`; "6 commits" became "7 commits" (checked with `git rev-list --count`). Still 120 files.
  - The checks line now says `2c4eb8e` and `803a685` only add `CLAUDE.md` log entries (`git diff --name-only a0cb63b 803a685` → `CLAUDE.md`).
  - The fresh-clone caveat now names `803a685`; LOG-20261021-2346 and -2347 were added to the log list.
- **Why this entry is not committed:** committing it would move the branch past `803a685` and make the PR description out of date again. It should go into the next commit that changes something else; update the PR description's commit references then, if the PR is not yet open.
- Files edited: `CLAUDE.md` (this entry). Commit: not committed · Pushed: no.
- Working-tree status after: `CLAUDE.md` modified; nothing else.

### LOG-20261021-2350-final-commit — Commit and push of LOG-20261021-2349; PR description follow-up
- Time: 2026-10-21 23:50:19 +03:00 (Africa/Nairobi) — source: PowerShell `Get-Date`.
- Contributor/session: operator not confirmed in this session; local Git identity Sean Macharia / Claude Code (Opus 5.5). Instruction: "commit and push the CLAUDE.md entry". This was given after being told it would move the branch past `803a685`.
- Pre-commit checks: `git fetch origin` → nothing new. `feature/frontend-foundation` = `origin` = `803a685`; `main` = `883f93b`. Only `CLAUDE.md` modified; nothing staged; no stashes.
- What is committed: `CLAUDE.md` only (LOG-20261021-2349-pr-refs and this entry). Commit message: "docs: log PR description update to 803a685 in CLAUDE.md", parent `803a685`.
- Push: a normal `git push origin feature/frontend-foundation`, only if the remote branch is still `803a685`. `main` is not changed; nothing is merged.
- **Done after the push, recorded here in advance** (no further local entry, so the working tree ends clean, as in LOG-20261021-0159-final-commit):
  - The scratchpad `pr-description.md` (outside the repository) is updated to this commit's hash: Compare line, expected `git log` output, "8 commits", the list of commits that only change `CLAUDE.md`, the fresh-clone caveat, and the log list (adding LOG-20261021-2349 and -2350).
  - Verify by comparing the hash in that file with `git log -1 --format=%h feature/frontend-foundation` and `git ls-remote origin`.
  - If the push failed, the next session's first entry must say so.
- Database/schema changes: none · Dependency changes: none · Application code: unchanged.
- Working-tree status after: expected clean; verify with `git status`.

### LOG-20261022-0000-handover-check — Fresh-clone check for the repository owner; final commit of the day
- Time: started 2026-10-21 23:53:13 +03:00; entry written 2026-10-22 00:00:11 +03:00 (Africa/Nairobi) — source: PowerShell `Get-Date`.
- Contributor/session: operator not confirmed in this session; local Git identity Sean Macharia / Claude Code (Opus 5.5). Instruction: "make sure everything is available for my sister to pull. Also commit and push everything you need to so i can go to sleep" (the sister is the repository owner).
- **Confirmation for LOG-20261021-2350-final-commit:** the push succeeded. `git push` reported `803a685..9bea6bb`; `git ls-remote origin` shows `feature/frontend-foundation` = `9bea6bb` and `main` = `883f93b`. The PR description was updated to `9bea6bb` as announced, and the working tree was clean.
- **Fresh-clone check of `9bea6bb`** (what the repository owner will get when pulling):
  - `git clone --branch feature/frontend-foundation` from `https://github.com/karechel/freight-management.git` into the session scratchpad, with `core.longpaths=true` for that clone only (no global Git config change). The scratchpad path is long; see the Windows path note in the PR description.
  - The clone's HEAD is `9bea6bb` and its tree is `d641d27`, both identical to the local branch. 167 tracked files; no changes after checkout.
  - In `Frontend/frontend`:
    - `npm ci` → exit 0 (Next.js 16.3.5; the same npm 11 warning that `unrs-resolver`'s install script was not run).
    - `next typegen` → exit 0; `tsc --noEmit` → exit 0; `npm run lint` → exit 0; `npm run build` → exit 0, 29 route entries.
    - The clone was still clean afterwards (build output is git-ignored).
  - This repeats, for the final code, the check done for `5e2910f` in LOG-20261021-0144-pr-draft.
- **Clean-up, partly failed:**
  - Deleting the test clone with PowerShell `Remove-Item` failed on the long backend migration paths, after deleting part of the folder.
  - A second attempt with `cmd rd` and the `\\?\` long-path prefix was blocked by a Claude Code safety check (the path was built from a variable). As that check requires, it was not retried another way.
  - **Left behind:** `C:\Users\HP\AppData\Local\Temp\claude\C--Users-HP-Documents-freight-management-sister\43db939a-f0cf-4e72-84fa-2e8c280345d9\scratchpad\fresh-clone\` (about 8,500 files, mostly `node_modules`). It is outside the repository, the project does not use it, and it can be deleted by hand.
- What is committed: `CLAUDE.md` only (this entry and the §14 note). Commit message: "docs: log fresh-clone check and handover in CLAUDE.md", parent `9bea6bb`.
- Push: a normal `git push origin feature/frontend-foundation`, only if the remote branch is still `9bea6bb`. `main` is not changed; nothing is merged.
- **Done after the push, recorded here in advance** (no further local entry, so the working tree ends clean, as in LOG-20261021-0159-final-commit):
  - The scratchpad `pr-description.md` is updated to this commit's hash, with "9 commits" and the list of log-only commits.
  - Its fresh-clone line now says the fresh clone of `9bea6bb` passed.
  - Verify by comparing the hash in that file with `git ls-remote origin`.
  - If the push failed, the next session's first entry must say so.
- Database/schema changes: none · Dependency changes: none (`npm ci` ran only in the test clone) · Application code: unchanged.
- Working-tree status after: expected clean; verify with `git status`.

### LOG-20261022-0002-preview — Local preview server started for the operator
- Time: 2026-10-22 00:02:36 +03:00 (Africa/Nairobi) — source: PowerShell `Get-Date`.
- Contributor/session: operator not confirmed in this session; local Git identity Sean Macharia / Claude Code (Opus 5.5). Instruction: "i want to preview the website".
- **Confirmation for LOG-20261022-0000-handover-check:**
  - The push succeeded: `9bea6bb..db3e895`; `git ls-remote origin` shows `feature/frontend-foundation` = `db3e895`. The working tree was clean.
  - The PR description was updated to `db3e895` as announced.
- What was done:
  - Started the production server on port 3000, using the project's own binary by absolute path: `node …/node_modules/next/dist/bin/next start -p 3000 <Frontend/frontend>`.
  - It serves the existing `.next` build from 2026-10-21 23:35:16 +03:00. That build was made from the final code: the last commit touching `Frontend/frontend` (`a0cb63b`, 23:42) came after it with no further code changes.
  - `next dev` was deliberately not used, because it rewrites the generated block in `Frontend/frontend/AGENTS.md` and would leave a change in the working tree.
  - Curl: `/`, `/shipments`, `/notifications` and `/reports` → 200.
- The server keeps running until stopped (it was started from this Claude Code session). Stop it when the preview is finished; record that in the next entry.
- Database/schema changes: none · Dependency changes: none · Application code: unchanged.
- Files edited: `CLAUDE.md` (this entry). Commit: not committed · Pushed: no (deliberately, so the pushed branch and the PR description stay at `db3e895`).
- Working-tree status after: `CLAUDE.md` modified; nothing else.

### LOG-20261022-0006-preview-stopped — Preview server stopped
- Time: 2026-10-22 00:06:18 +03:00 (Africa/Nairobi) — source: PowerShell `Get-Date`.
- Contributor/session: operator not confirmed in this session; local Git identity Sean Macharia / Claude Code (Opus 5.5). Instruction: "I am finished, thank you".
- In between (after LOG-20261022-0002-preview), on "how do i preview it on a broswer": checked that `http://localhost:3000/` returned 200, then opened it in the default browser with PowerShell `Start-Process 'http://localhost:3000'`.
- Stopped the preview server (PID 10292) after checking its command line was the `next start -p 3000` started in LOG-20261022-0002-preview. The "exit code 127" reported afterwards is that stop. Port 3000 free; no `next` processes left.
- Database/schema changes: none · Dependency changes: none · Application code: unchanged.
- Files edited: `CLAUDE.md` (this entry). Commit: not committed · Pushed: no. GitHub and the PR description remain at `db3e895`; this entry and LOG-20261022-0002-preview go into the next approved commit.
- Working-tree status after: `CLAUDE.md` modified; nothing else.

### LOG-20261022-0007-commit-log — Commit and push of the preview log entries
- Time: 2026-10-22 00:07:04 +03:00 (Africa/Nairobi) — source: PowerShell `Get-Date`.
- Contributor/session: operator not confirmed in this session; local Git identity Sean Macharia / Claude Code (Opus 5.5). Instruction: "commit and push the CLAUDE.md entries".
- Pre-commit checks: `git fetch origin` → nothing new. `feature/frontend-foundation` = `origin` = `db3e895`; `main` = `883f93b`. Only `CLAUDE.md` modified; nothing staged; no stashes. No servers running.
- What is committed: `CLAUDE.md` only (LOG-20261022-0002-preview, LOG-20261022-0006-preview-stopped and this entry). Commit message: "docs: log local preview in CLAUDE.md", parent `db3e895`.
- Push: a normal `git push origin feature/frontend-foundation`, only if the remote branch is still `db3e895`. `main` is not changed; nothing is merged.
- **Done after the push, recorded here in advance** (no further local entry, so the working tree ends clean, as in LOG-20261021-0159-final-commit):
  - The scratchpad `pr-description.md` is updated to this commit's hash, with "10 commits", this commit added to the list of log-only commits, and the three new log entries added to its log list.
  - Verify by comparing the hash in that file with `git ls-remote origin`.
  - If the push failed, the next session's first entry must say so.
- Database/schema changes: none · Dependency changes: none · Application code: unchanged.
- Working-tree status after: expected clean; verify with `git status`.

### LOG-20261026-2215-database-schema — Database schema designed, approved and applied; Node 24.20.0 pinned
- Time: work started 2026-10-26 22:15:10 +03:00; migration applied 22:26:06–22:26:11; this entry written 2026-10-26 22:32:24 +03:00 (Africa/Nairobi) — source: PowerShell `Get-Date`. The earlier read-only parts of this session (2026-10-20 and 2026-10-26, before 22:15) have no recorded start times; exact time unavailable.
- Contributor/session: **repository owner** (stated in this session on 2026-10-20: "i am the owner"), working on their own machine (clone at `C:\Users\ENVY\Desktop\Freight WebApp\Project`; Git author identity "Chelsea", unchanged) / Claude Code (Opus 5.5).
- **First entry from the repository owner's machine.** Earlier in this session, before this work (none of it recorded until now):
  - Read `CLAUDE.md`, the code and Git history. `git fetch origin`. Switched this clone from `main` to `feature/frontend-foundation` (then at `46ad529`) on the owner's request ("i want to pull these changes"). No files changed.
  - The owner instructed: record every change in `CLAUDE.md` for the collaborator.
  - Database design discussion (phases 1–2): the owner answered the 12 business questions and the follow-up questions. Their answers are in `docs/database-design.md` §1 and §9 of this file.
- **Instructions for this work (repository owner, 2026-10-26):**
  - Approve schema v2 with `TimestamptzJsDate(3)`, `DateString`, `Numeric(14,2)` and no new dependency. Verify the types against the installed Prisma before creating migrations.
  - Keep the migration reviewable; do not reset or overwrite an existing database.
  - Branch `feature/database-schema` from `feature/frontend-foundation`.
  - Pin Node 24.20.0 (`.nvmrc` plus `engines` in both apps), checking compatibility first. Switch this machine via nvm without disrupting other projects.
  - Credit-limit overrides: finance, management and admin only, recorded every time, enforced in the backend.
  - Document the decisions here.
- **Pre-work checks:**
  - `git fetch origin` found the collaborator's newer commits on `feature/frontend-foundation` (`46ad529` → `9c5bdf3`, up to LOG-20261022-0007-commit-log). The working tree was clean, so it was fast-forwarded (`git merge --ff-only`). `feature/database-schema` was created from `9c5bdf3`.
  - The collaborator's newer frontend types (delays with action timelines, task notes, quotation terms, document expiry, account status) were read, and the schema covers them.
- **Node.js:**
  - Every direct dependency's `engines` range accepts 24.20.0. The strictest are `@nestjs/schematics` (`^24.15.0` on the 24 line) and `prisma` (`>=22.18.0`).
  - `nvm install 24.20.0` (nvm-windows 2.0.0, shim mode). The machine default stays **22.23.3**; nothing else was changed in nvm. Other folders still resolve to 22.23.3 (checked in the user profile folder).
  - Added root `.nvmrc` (`24.20.0`); the shim reads it only in the repository root. Added `"engines": { "node": "^24.20.0" }` to both `package.json` files; the shim reads that in each app folder. `node -v` → v24.20.0 in the root, `Backend/backend` and `Frontend/frontend`.
  - Lockfiles:
    - Backend: `npm install --package-lock-only --ignore-scripts` added only the 3-line `engines` entry.
    - Frontend: the same command also added 66 lines of bundled `@tailwindcss/oxide-wasm32-wasi` entries. That change was **reverted** (`git checkout -- package-lock.json`) and only the `engines` entry was added, in npm's own format. `npm ls --depth=0` is clean.
    - No dependency versions changed.
  - Found: on this machine Git Bash puts a separate `~/.nvm` (Node 8.17.0) first on its PATH. It was left untouched (user configuration outside the project); PowerShell was used for all Node, npm and Prisma commands.
- **Database (all from `Backend/backend`, PowerShell, Node 24.20.0):**
  - Read-only state check before any change: `prisma db schema` → only the `User` table plus Prisma's `prisma_contract` schema (PostgreSQL 16.1). `prisma db verify` → marker `a9d7a849…` matches the original contract and the committed `db` ref.
  - Confirmed the type mappings in the installed `@prisma/orm-target-postgres`:
    - `TimestamptzJsDate` → `timestamptz`, JS `Date` (no `Temporal`).
    - `DateString` → `date`, string.
    - `Numeric(p,s)` → `numeric`, string.
    - `DateTime`/`Date` need `Temporal`.
    - `Jsonb` → `jsonb`.
  - Wrote `src/prisma/contract.prisma` (33 tables) and ran `prisma contract emit`. The emitted contract was checked for column types, 88 CHECKs, 87 foreign keys, 106 indexes and 23 uniques. `AuditLog.changes` was changed from `Json` to `Jsonb` and re-emitted.
  - First `prisma migration plan` (19:24 UTC) put a `placeholder` data transform in the delta, for changing the existing `User.createdAt` from `timestamptz` to `timestamptz(3)`. To avoid rewriting an existing column, `User.createdAt` was kept at `timestamptz` (codec `TimestamptzJsDate`, still a JS `Date`). The generated packages were deleted.
    - The first delete attempt partly failed: the folder was locked because the Bash tool's working directory was inside it. It succeeded on retry; only the committed ref and snapshot remained.
  - Second plan: `20261026T1925_baseline` (recreates the original `User` table; used only on empty databases) and `20261026T1926_freight_core_schema` (**253 operations, all additive**, no placeholders, no drops).
  - Before applying:
    - `prisma migration check` → all checks passed.
    - `prisma migration show` → the CHECK, partial-index and foreign-key SQL was reviewed (391 statements, no `DROP`).
    - `prisma db migrate --show` → 1 migration would run.
  - **Applied** with `prisma db migrate --advance-ref db` (22:26:06–22:26:11 +03:00) to the repository owner's own local database (dev data only; the owner said nothing in it was worth keeping, and the migration changed no existing data): 1 migration, 253 operations. `db verify` → marker `32773253…` and schema match. `migrations/app/refs/db.json` now points at `32773253…`.
- **Other changes:**
  - `Backend/backend/tsconfig.json` now has `"exclude": ["node_modules", "dist", "migrations"]`. Prisma-rendered `migration.ts` files use extensionless imports (TS2835 under `nodenext`) and must not be edited. `tsconfig.build.json` was unaffected (it includes only `src`). This is the only config change besides `engines`.
  - Created `docs/database-design.md`: the approved design, business rules, setup and migration commands, pgAdmin inspection, and the frontend type differences.
- Files created: `.nvmrc`, `docs/database-design.md`, `Backend/backend/migrations/app/20261026T1925_baseline/{migration.ts,migration.json,ops.json}`, `Backend/backend/migrations/app/20261026T1926_freight_core_schema/{migration.ts,migration.json,ops.json}`, `Backend/backend/migrations/snapshots/3277325397aec2a66c498a80377ddeeeee51528527b3b4c6864dd3167eb01cdc/{contract.json,contract.d.ts}`.
- Files edited: `CLAUDE.md` (§2, §3, §4, §5, §6, §7, §9, §10, §11, §12, this entry, §14), `Backend/backend/src/prisma/contract.prisma`, generated `src/prisma/contract.json` and `contract.d.ts`, `Backend/backend/migrations/app/refs/db.json`, `Backend/backend/tsconfig.json`, both `package.json` and both `package-lock.json` files (`engines` only). Deleted: none (the only deletions were the first, unused migration packages generated in this session).
- Database/schema changes: the repository owner's local DB only, as above. Dependency changes: none (no packages added, removed or updated).
- **Checks run and results (Node 24.20.0):**
  - Backend:
    - `tsc --noEmit` → only the long-standing TS2307 (`supertest/types`). It first also showed TS2835 in the migration files, fixed by the `exclude` above.
    - `npm run lint` → exit 0; `npm test` → 2 files, 4 tests pass; `npm run build` → exit 0, with no migration files in `dist/`.
  - Read-only runtime query through `src/prisma/db.ts` (scratch script): `User` and `Invoice` queries ran with `Temporal` unavailable. Both tables were empty, so decoding a stored date was not exercised.
  - Frontend: `next typegen`, `tsc --noEmit`, `npm run lint`, `npm run build` → all exit 0.
  - Not run: e2e tests, `npm audit`, browser tests, a migration onto a fresh empty database.
- **Failed attempts:**
  - Two inline `node -e` scripts failed: one on PowerShell quoting, one on a wrong guess at the `contract.json` structure.
  - The migration-folder delete was locked (see above).
  - The first `migration plan` was replaced (see above).
- **Files outside the repository:**
  - Session scratchpad (`C:\Users\ENVY\AppData\Local\Temp\claude\…\scratchpad\`): `plan-summary.cjs`, `show-sql.cjs`, `smoke-read.mts`.
  - `%TEMP%`: `plan-out.txt`, `mig-show.txt`, `lint.txt`, `fe-lint.txt`, `fe-build.txt`.
  - Claude Code's own tool-output and memory files.
  - Node 24.20.0 installed under nvm's `installs` folder.
  - Rebuilt (git-ignored): `Backend/backend/dist/`, `Frontend/frontend/.next/`.
  - No servers or processes left running.
- **Not done (outside the approved scope):**
  - No seed data: roles, the permission matrix, `credit.override`, retention policy, charge types.
  - No API endpoints, auth or permission guard; the credit-override rule is in the schema and documentation and will be enforced when the backend services are built.
  - No frontend changes.
  - `GET /` is still unauthenticated.
- Commit: not committed · Pushed: no (not authorized yet).
- Working-tree status after: branch `feature/database-schema` (from `9c5bdf3`). Modified and untracked files are exactly the ones listed above; nothing staged.

### LOG-20261026-2301-commit-push — Commit and push of `feature/database-schema`
- Time: 2026-10-26 23:01:50 +03:00 (Africa/Nairobi) — source: PowerShell `Get-Date`.
- Contributor/session: repository owner / Claude Code (Opus 5.5). Instruction: "yes" (to committing and pushing `feature/database-schema`). Before that, the owner asked whether the collaborator's work had been pulled: a fresh `git fetch` confirmed `origin/feature/frontend-foundation` = `9c5bdf3`, already contained in this branch.
- Pre-commit checks: `git fetch origin` → nothing new. `origin` has `main` = `883f93b` and `feature/frontend-foundation` = `9c5bdf3`; `feature/database-schema` does not exist on `origin` yet. Commits are authored as "Chelsea" (Git metadata, unchanged).
- Correction to the repository owner's session of 2026-10-20 (not previously logged): Claude reported then that this clone's Git `user.name` was set to an email address. That was a misreading of `git config` output; the email setting was shown, and the author name is "Chelsea".
- What is committed: everything listed in LOG-20261026-2215-database-schema, plus this entry. Commit message: "feat(db): freight core schema, Prisma migrations and Node 24.20.0 pin", parent `9c5bdf3`.
- First attempt failed: `git commit -F -` was given the message as a PowerShell argument, not on stdin, so Git treated it as a pathspec and made no commit. The `git push -u` in the same command still ran and created `origin/feature/database-schema` at `9c5bdf3` (identical to `feature/frontend-foundation`, none of this work). The changes stayed staged. The commit was then made from a message file and pushed again as a normal fast-forward.
- Push: a normal `git push -u origin feature/database-schema` (no force). `main` and `feature/frontend-foundation` are not changed; nothing is merged. Verify with `git ls-remote origin`. If the push failed, the next entry must say so.
- Database/schema changes: none in this step · Dependency changes: none.
- Working-tree status after: expected clean; verify with `git status`.

### LOG-20261029-2128-pr-prep — Pull request descriptions prepared (PRs not opened from here)
- Time: 2026-10-29 21:28:04 +03:00 (Africa/Nairobi) — source: PowerShell `Get-Date`.
- Contributor/session: repository owner / Claude Code (Opus 5.5). Instruction: "do step 1" (open a PR for `feature/frontend-foundation` into `main` first, then one for `feature/database-schema`).
- **Confirmation for LOG-20261026-2301-commit-push:** the push succeeded. `git ls-remote origin` shows `feature/database-schema` = `a4239fc`, `feature/frontend-foundation` = `9c5bdf3`, `main` = `883f93b`. `git fetch origin` found nothing new, and the working tree was clean.
- Read-only checks:
  - `feature/frontend-foundation` is 10 commits and 120 files ahead of `main`; apart from `CLAUDE.md`, all of them are under `Frontend/frontend/`. `main` is an ancestor, so the PR merges without conflicts.
  - `feature/database-schema` is 1 commit (20 files) ahead of `feature/frontend-foundation`.
- The GitHub CLI (`gh`) is not installed on this machine, so the PRs were not opened from here. The repository owner opens them in the browser, using GitHub "compare" links.
- PR descriptions written to the session scratchpad (`pr-descriptions.md`, outside the repository). They use role labels only. PR 2 is stacked: its base is `feature/frontend-foundation`, so it shows only the database changes; change its base to `main` after PR 1 is merged.
- Database/schema changes: none · Dependency changes: none · Application code: unchanged.
- Files edited: `CLAUDE.md` (this entry). Commit: not committed · Pushed: no (left uncommitted so the branches stay as they are while the PRs are opened; include it in the next approved commit).
- Working-tree status after: `CLAUDE.md` modified; nothing else.

### LOG-20261029-2138-merged — Both feature branches merged into `main` (PR #1, PR #2)
- Time: 2026-10-29 21:38:39 +03:00 (Africa/Nairobi) — source: PowerShell `Get-Date`.
- Contributor/session: repository owner / Claude Code (Opus 5.5). The owner chose to merge through pull requests ("1"), opened and merged them in the browser, then reported "both are merged".
- **Merges (done by the repository owner on GitHub, both as merge commits):**
  - PR #1 `feature/frontend-foundation` → `main`: merge commit `f663dd2` (2026-10-29 21:35 +03:00).
  - PR #2 `feature/database-schema` → `main`: merge commit `293a951` (21:37 +03:00).
- **Verified:**
  - `git fetch origin --prune`: `main` moved from `883f93b` to `293a951`.
  - `9c5bdf3` and `a4239fc` are both ancestors of `origin/main`, and `git diff a4239fc origin/main` is empty, so `main` now has exactly the reviewed content.
  - Both feature branches still exist on GitHub, unchanged.
- **Local Git, including a hiccup:**
  - `git switch main` was refused at first: local `main` was still at `883f93b`, and the uncommitted `CLAUDE.md` would have been overwritten.
  - The chained `git merge --ff-only origin/main` then ran on `feature/database-schema` instead, moving that local branch to `293a951`. Nothing was pushed.
  - Fixed with pointer moves only:
    - `git branch -f main origin/main` (a fast-forward; old `main` was an ancestor).
    - `git switch main`.
    - `git branch -f feature/database-schema origin/feature/database-schema` (back to `a4239fc`).
  - Afterwards all three local branches match `origin`, and the `CLAUDE.md` edits were kept.
- **For the collaborator:** run `git fetch origin`, then `git switch main` and `git pull` (when your working tree is clean). Then set up Node 24.20.0 and your database as in `docs/database-design.md` §8.
- Database/schema changes: none · Dependency changes: none · Application code: unchanged.
- Files edited: `CLAUDE.md` (LOG-20261029-2128-pr-prep, this entry, §14). Commit: not committed · Pushed: no (awaiting the owner's approval).
- Working-tree status after: branch `main` = `origin/main` = `293a951`; `CLAUDE.md` modified; nothing else.

### LOG-20261029-2146-backend-audit — Read-only backend audit; phased backend plan proposed (awaiting approval)
- Time: 2026-10-29, after 21:46 +03:00 (Africa/Nairobi); exact start time not recorded.
- Contributor/session: repository owner / Claude Code (Opus 5.5). Instruction: audit the backend, Prisma connection, migrations and frontend integration, and propose a phased plan (foundation + Customer CRUD, then Quotations and Bookings, then Shipments and Tracking). **No implementation until the plan is reviewed.**
- **Checks run (all read-only, on `main` at `293a951`, Node 24.20.0, PowerShell):**
  - Read the backend `src/`, `test/`, configuration, the frontend `lib/api/client.ts`, `lib/data/index.ts`, `lib/data/session-store.tsx` and `docs/api-contracts.md`.
  - `prisma db verify` → marker and schema match the contract (`32773253…`).
  - `prisma migration status` → `20261026T1926_freight_core_schema` applied. `20261026T1925_baseline` has no status on this DB, which is expected (the DB already existed at its end state).
  - `prisma migration check` → pass. `prisma db migrate --show` → nothing to run.
  - Checked `node_modules` for validation and auth packages: none installed, except `arktype` 2.2.3 as a sub-dependency.
  - Read the installed Prisma 8 query docs: transactions, ORM writes, `SqlQueryError.sqlState`.
- **Failed attempts (shell only, no effect):**
  - The first Prisma check loop passed each command as one string and got "unknown command".
  - The second used a helper function named `R`, which is PowerShell's alias for `Invoke-History`.
  - Re-run as plain commands.
- Findings and the proposed plan were reported to the owner in the session (summary in §14). Nothing implemented.
- Database/schema changes: none · Dependency changes: none · Files edited: `CLAUDE.md` (this entry, §14). Commit: not committed · Pushed: no.
- Working-tree status after: `CLAUDE.md` modified; nothing else.

### LOG-20261103-2141-backend-decisions — Backend decisions recorded; implementation plan written (not started)
- Time: 2026-11-03 21:41:53 +03:00 (Africa/Nairobi), taken before these edits — source: PowerShell `Get-Date`.
- Contributor/session: repository owner / Claude Code (Opus 5.5).
- Instructions received:
  - Use fictional data throughout development; keep the client-data import as a separate phase before production launch.
  - Make reference formats configurable, with the existing frontend formats as defaults, so an authorized administrator can change prefixes and numbering without code changes. Previously generated references stay unchanged, and references must be unique.
  - Validation: `class-validator` and `class-transformer` with `ValidationPipe`, globally, with DTOs.
  - Login approved for Phase 0: `@nestjs/jwt` and built-in `crypto`, with guards and role-based authorization enforced on the backend.
  - Customer ids: numeric database ids in API URLs; no schema migration for this decision.
  - Document these decisions here and include them in the implementation plan.
- **Read-only checks:**
  - `git fetch origin` → nothing new; `main` = `origin/main` = `293a951`.
  - Node 24.20.0: `crypto.scrypt` and `crypto.argon2` are both available (OpenSSL 3.5.7).
  - `npm view`: `@nestjs/jwt` 12.0.3 (peer range includes NestJS 12), `class-validator` 0.15.1 and `class-transformer` 0.5.1 (within `@nestjs/common`'s optional peer ranges). **Nothing installed.**
  - Read the frontend's numbering rules (`app/settings/page.tsx`) and demo references. The running number continues across modes and months, which is why the design has an explicit reset policy instead of one counter per rendered prefix.
- What changed:
  - Created `docs/backend-implementation-plan.md`: decisions, API conventions, reference-number design, auth design, development data, phases 0–5, open items.
  - `docs/database-design.md` §1: the References row now records the change and says it is not implemented yet.
  - `CLAUDE.md`: §4, §9, this entry, §14.
- **Proposed schema change (not made, needs approval):** one additive `ReferenceFormat` table. `NumberSequence` is reused unchanged.
- Files outside the repository: none created for this step.
- Database/schema changes: none · Dependency changes: none · Application code: unchanged · Migrations: none.
- Commit: not committed · Pushed: no. The uncommitted log entries from 2026-10-29 are also still pending.
- Working-tree status after: `CLAUDE.md` and `docs/database-design.md` modified; `docs/backend-implementation-plan.md` new; nothing staged.

### LOG-20261103-2154-plan-approved — Backend plan approved; documentation committed to `main`
- Time: 2026-11-03 21:54:24 +03:00 (Africa/Nairobi) — source: PowerShell `Get-Date`.
- Contributor/session: repository owner / Claude Code (Opus 5.5). Instruction: "follow your recommendations for the decisions" (the seven items in the session, now in `docs/backend-implementation-plan.md` §7).
- Pre-commit checks: `git fetch origin` → nothing new; `main` = `origin/main` = `293a951`. Changed: `CLAUDE.md`, `docs/database-design.md`, new `docs/backend-implementation-plan.md`.
- What is committed: those three files only, including the uncommitted entries since LOG-20261029-2128-pr-prep, directly to `main` (decision 7). Commit message: "docs: record merges, backend audit and approved implementation plan", parent `293a951`.
- Push: a normal `git push origin main`, only if `origin/main` is still `293a951`. Verify with `git ls-remote origin`. If it failed, the next entry must say so.
- Database/schema changes: none · Dependency changes: none · Application code: unchanged.
- Working-tree status after: expected clean, then `feature/backend-foundation` is created from this commit for Phase 0.

### LOG-20261103-2218-phase0 — Backend Phase 0 built and verified on `feature/backend-foundation`
- Time: work started about 2026-11-03 21:56 +03:00 (exact start not recorded); migration applied at 21:57:43; this entry written 22:18:14 +03:00 (Africa/Nairobi) — source: PowerShell `Get-Date`.
- Contributor/session: repository owner / Claude Code (Opus 5.5). Instruction: "follow your recommendations for the decisions".
- **Confirmation for LOG-20261103-2154-plan-approved:** the push succeeded: `git ls-remote origin` showed `main` = `56946bf`. `feature/backend-foundation` was created from it. A later `git fetch origin` still showed `main` = `56946bf`.
- **Dependencies added (backend only, after checking compatibility):** `class-validator` 0.15.1, `class-transformer` 0.5.1, `@nestjs/jwt` 12.0.3. `dotenv` 17.4.2 is now declared, at the version already installed. The lockfile only gained entries (20 packages), apart from `dotenv` no longer being marked dev-only; no existing versions changed. Frontend: none.
- **Database:**
  - Contract: added `ReferenceFormat` and two enums. Migration `20261103T1857_add_reference_format`: 4 additive operations, reviewed, `migration check` passed.
  - Applied to the repository owner's local DB with `db migrate --advance-ref db`, after `db migrate --show` showed that one migration pending. `db verify` passed; marker `9e752599…`.
  - Created the separate test database (the development DB's name plus `_test`), migrated from empty. Its name is not recorded here; the rule is in `test/support/test-database.ts`.
  - Seeded the owner's local DB: `db:seed` added 6 roles, 21 permissions, 60 grants, 14 charge types, 1 retention policy, 7 reference formats and the first admin; `db:seed:demo` added 12 fictional companies, 12 contacts and 4 fictional staff accounts.
  - Row counts confirmed the development DB was still empty after the first end-to-end run, so the tests are isolated.
- **Backend:**
  - Removed `GET /`. Added `configureApp` (`/api` prefix, `ValidationPipe`, exception filter, CORS from `CORS_ORIGINS`, shutdown hooks), `JWT_SECRET` validation, and Prisma closing on shutdown.
  - Auth: `POST /api/auth/login`, `GET /api/auth/me`; scrypt (N=2^17, r=8, p=1); HS256 JWT for 8 hours; a global guard, protected by default, which reloads the user and permissions on each request; a login limit of 10 failures in 15 minutes.
  - Reference formats: `GET`, `PATCH` and `POST preview`; generation inside the caller's transaction using an atomic upsert; template rules; audit log entries.
  - Pagination DTO and audit service are in place for Phase 1.
- **Frontend:** `/login`, a top-bar user menu, a Numbering editor in Settings for permitted users, same-origin `/api/auth/*` and `/api/backend/*` routes with the token in an HttpOnly cookie, a browser API client with field errors, and corrected wording where pages said no sign-in exists. `docs/api-contracts.md` lists the implemented endpoints.
- **Secrets:** `Backend/backend/.env` (git-ignored) gained `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` and `DEMO_USER_PASSWORD`, generated randomly and never printed. Scans found none of these in committed files.
- **Checks (final code, Node 24.20.0):** see §11. Also: a real sign-in with the seeded admin and a fictional finance user against the development DB returned 200; an anonymous format list returned 401; 45 new or changed backend files were formatted with Prettier, excluding generated files.
- **Failed attempts and incidents:**
  - A large Bash heredoc failed on shell quoting before finishing; files were then written from a bundle by a scratch script, overwriting anything partial.
  - `plan-summary.cjs` failed on a byte-order mark in a saved file; the plan had printed correctly and was read directly.
  - `tsc` first flagged `tx.raw` (not available on the transaction context), JSON and Numeric types, and a `CardHeader` action prop; all fixed.
  - Review found `Origin: null` would crash the cross-site check; fixed to refuse the request.
  - **Leftover servers:** `Stop-Process` on the `Start-Process` result only stopped nvm's shim, leaving servers on ports 3001, 3002 and 3100. So the second browser run may have tested old servers, and that result was discarded. The processes were stopped after checking their command lines, and a clean run on the final build passed 27/27. A path typo in the runner's cleanup left servers once more; they were stopped the same way. All ports were free afterwards, with no test Chrome left.
- **Files outside the repository:** session scratchpad: bundles and patch scripts, `browser-test.mjs`, `run-browser.ps1`, `stop-servers.ps1`, `dev-login.cjs`, `db-counts.mts`, server logs. `%TEMP%`: command logs, a throwaway Chrome profile (`fm-chrome-*`).
- Commit: not committed · Pushed: no (awaiting the repository owner's approval).
- Working-tree status after: branch `feature/backend-foundation` at `56946bf`, with all of this uncommitted; nothing staged.

### LOG-20261103-2226-local-run — Servers started for the repository owner
- Time: 2026-11-03 22:26:28 +03:00 (Africa/Nairobi) — source: PowerShell `Get-Date`.
- Contributor/session: repository owner / Claude Code (Opus 5.5). Instruction: "start the front and backend".
- Started from the existing final builds, against the owner's local development DB: `node dist/main.js` (port 3001) and `next start -p 3000`. `next dev` was not used, because it rewrites the block in `Frontend/frontend/AGENTS.md`.
- Checks: `/health`, `/login`, `/` and `/settings` → 200; signed-out `/api/backend/auth/me` → 401.
- The servers keep running until stopped; record that in a later entry.
- Database/schema changes: none · Dependency changes: none · Application code: unchanged.
- Files edited: `CLAUDE.md` (this entry). Commit: not committed · Pushed: no.

### LOG-20261103-2243-phase0-commit — Commit and push of backend Phase 0
- Time: 2026-11-03 22:43:44 +03:00 (Africa/Nairobi) — source: PowerShell `Get-Date`.
- Contributor/session: repository owner / Claude Code (Opus 5.5). Instruction: "push the current work before phase 1 starts".
- Pre-commit checks: `git fetch origin` → nothing new; HEAD = `origin/main` = `56946bf`; `feature/backend-foundation` not yet on `origin`; no stashes or lock; no `.env`, `node_modules`, build output or build-cache files among the 79 changed paths. The staged diff is re-checked before committing.
- What is committed: everything in LOG-20261103-2218-phase0, LOG-20261103-2226-local-run and this entry. Commit message: "feat(backend): Phase 0 foundation, sign-in, permissions and configurable references", parent `56946bf`. A file cannot record its own hash; see `git log -1 feature/backend-foundation`.
- Push: a normal `git push -u origin feature/backend-foundation`, run only if the commit succeeds. `main` is not changed and nothing is merged; the repository owner merges by PR. Verify with `git ls-remote origin`. If the push failed, the next entry must say so.
- The local servers from LOG-20261103-2226-local-run are still running; they use git-ignored build output, so they are unaffected.
- Database/schema changes: none in this step · Dependency changes: none in this step.
- Working-tree status after: expected clean; verify with `git status`.

### LOG-20261104-1056-phase1 — Phase 1 (customers) built and verified on `feature/customers-phase1`
- Time: work started about 2026-11-04 10:05 +03:00; this entry written after the final checks at 10:54:37 +03:00 (Africa/Nairobi) — source: PowerShell `Get-Date`.
- Contributor/session: local clone with Git identity PPSOne-02; operator not confirmed / Claude Code (Opus 5.5). Instructions: pull `main`, read this file, start Phase 1; then, when asked which database to use, "Install PostgreSQL". That answer also authorized the migrations and fictional seed data on that database only.
- **Git:** `main` fast-forwarded from `56946bf` to `ff7d6fb`, so PR #3 (Phase 0) is merged. `feature/customers-phase1` was created from it.
- **Machine setup (this clone had no database, `.env` or `node_modules`):**
  - `npm ci` in both apps. Lockfiles unchanged.
  - Installed PostgreSQL 17.11 with `winget` (`PostgreSQL.PostgreSQL.17`), including pgAdmin; it runs as a Windows service.
  - Created a role that is not a superuser and can create databases, and a development database. `Backend/backend/.env` and `Frontend/frontend/.env.local` are git-ignored; secrets were generated randomly and never printed.
  - **Incident:** `winget` wrote the superuser password in plain text to its diagnostic log. The password was changed immediately, so the logged value no longer works. The current one is in a private file in the user's profile, outside the repository.
  - **Network:** the installer's server listens on all interfaces. Access rules allow only localhost with SCRAM passwords, and no firewall rule was found for it. `listen_addresses = 'localhost'` is set but needs a service restart, which was refused without elevation, so it applies at the next reboot.
- **Database:** on this machine's development DB, 3 migrations (260 operations) applied with `db migrate --advance-ref db`; `db verify` passed; `db:seed` and `db:seed:demo` ran (12 fictional companies, 12 contacts, 4 staff). The test database was created by the end-to-end setup. **No schema change and no new migration.** `migrations/app/refs/db.json` shows as modified only because of line endings; its content is unchanged.
- **Backend:** `/api/parties` (see `Frontend/frontend/docs/api-contracts.md`), `ParseIdPipe`. Billing is left out of responses for callers without `parties.billing.view`. A request containing any field the caller may not change is refused whole. All changes are audited. Balances are calculated in SQL. The demo seed gained address and payment terms for customers; existing databases keep their rows.
- **Frontend:**
  - `/parties` is now a live, customers-only list. New pages: `/parties/new` and `/parties/[id]/edit`.
  - `/parties/[id]` is live for numeric ids; `c-001` style ids still open demo records.
  - Corrected text that had become wrong: the top bar now says "Live data" on these pages, and the sidebar footer, dashboard integrations panel and Settings status no longer say sign-in or endpoints do not exist.
- **Dependencies:** none added.
- **Checks:** see §11. After them, a one-line Settings text change; frontend `tsc`, lint and build were re-run and passed. The browser checks were not repeated for that one line.
- **Failed attempts:**
  - Raw SQL parameters cannot be null in this Prisma version, and booleans cannot be sorted in the ORM. `tsc` caught both; fixed.
  - The first seed edit script failed harmlessly because this checkout uses CRLF; redone with an editor tool.
  - Two test mistakes fixed: a phone pattern that refused `(020) 123456`, and test data for a delivered shipment with no delivery time.
  - `Restart-Service` on PostgreSQL refused without elevation (above).
- **Processes:** both servers were started for the browser runs and stopped by port; ports 3000 and 3001 were confirmed free. PostgreSQL keeps running as a service.
- **Files outside the repository:** session scratchpad: `browser-test.mjs`, `run-browser.ps1`, screenshots, logs. User profile: the private PostgreSQL password file and the install output.
- **Needs the repository owner's confirmation:** see §14.
- Commit: not committed · Pushed: no (awaiting approval).
- Working-tree status after: on `feature/customers-phase1`, all of this uncommitted; nothing staged.

### LOG-20261104-1120-phase1-decisions — Phase 1 decisions applied
- Time: changes from about 2026-11-04 11:05 +03:00; final browser run 11:18:09 +03:00 (Africa/Nairobi) — source: PowerShell `Get-Date`.
- Contributor/session: local clone with Git identity PPSOne-02; operator not confirmed / Claude Code (Opus 5.5).
- Instructions received, answering the session's questions: account status "not finance just management and admin"; block archiving with active shipments, "yes"; last save wins, "yes"; KRA PIN "leave the format editable for now". The question about committing was not answered, so nothing is committed.
- **What changed:**
  - New permission `parties.status.manage`, granted to management and admin. Terms and limits stay with finance, management and admin. The edit form shows each user only what they can change.
  - Archiving returns 409 while the customer has a shipment not yet delivered.
  - KRA PIN format check removed: up to 20 characters, unique, upper case.
- **Interpretation to confirm:** "editable" was taken to mean the field accepts any format for now. It was not built as an administrator setting that defines a format. That would be new work.
- **Correction to LOG-20261104-1056-phase1 and the earlier §14 note:** an existing setup now does need a step after merging: `npm run db:seed`, which adds the new permission. Its grants go to admin and management; removed grants stay removed.
- **Database:** `npm run db:seed` on this machine's development DB added 1 permission and 2 grants. `db verify` passed. No schema change and no migration. Dependency changes: none.
- **Checks:** see §11.
- **Failed attempt:** one browser check, `/finance still renders`, failed on the first run. The page was fine: the check looked for the word "Finance" anywhere, and had earlier passed only because the signed-in user's role label said Finance. So the "still renders" checks in LOG-20261104-1056-phase1 were weaker than they looked for `/finance`. They now match each page's `<h1>`; all pass.
- **Processes:** both servers were started for the browser runs and stopped; ports 3000 and 3001 were confirmed free.
- Commit: not committed · Pushed: no (awaiting approval).
- Working-tree status after: on `feature/customers-phase1`, all of this uncommitted; nothing staged.

### LOG-20261104-1135-phase1-commit — Commit, push and PR for Phase 1
- Time: 2026-11-04, about 11:35 +03:00 (Africa/Nairobi); exact time is in the commit — source: `git log`.
- Contributor/session: local clone with Git identity PPSOne-02; operator not confirmed / Claude Code (Opus 5.5). Instructions: "any format for now", which confirms the KRA PIN interpretation in LOG-20261104-1120-phase1-decisions; and "yes" to committing, pushing and opening a PR.
- What is committed: everything in LOG-20261104-1056-phase1, LOG-20261104-1120-phase1-decisions and this entry. A file cannot record its own hash; see `git log -1 feature/customers-phase1`.
- Push: a normal `git push -u origin feature/customers-phase1`. Nothing is merged. Verify with `git ls-remote origin`. If the push failed, the next entry must say so.
- PR: `gh` is not installed on this machine, so the PR into `main` is opened on GitHub by a contributor, using the description given in the session. Check GitHub for whether it is open.
- Database/schema changes: none in this step · Dependency changes: none. No checks were re-run for this entry: only `CLAUDE.md` changed after the final checks.
- Working-tree status after: expected clean; verify with `git status`.

## 14. Current handover state

- **Latest (2026-11-04 11:35 +03:00, LOG-20261104-1135-phase1-commit):** Phase 1 is committed and pushed on `feature/customers-phase1` (verify with `git ls-remote origin`), **not merged**. A contributor opens the PR on GitHub. Merging requires the `npm run db:seed` step in the note below.
- **Earlier (2026-11-04 11:20 +03:00, LOG-20261104-1120-phase1-decisions):** Phase 0 is merged to `main` (`ff7d6fb`). Phase 1 (customers) is built and verified on `feature/customers-phase1`, **not committed**. It adds no migration and no dependency. **After merging, each developer must run `npm run db:seed`** in `Backend/backend` to add the new account-status permission.
  - **Next:** open, review and merge the PR into `main` (LOG-20261104-1135-phase1-commit), then start Phase 2.
  - **For the repository owner to review:** the four decisions dated 2026-11-04 in §9 came from a session whose operator's identity was not confirmed.
  - **Still open:** whether the KRA PIN should later get a format check, or an administrator-configured one, once the client's records are seen. For now it accepts any format, as confirmed in the session.
- **Earlier (2026-11-04 10:56 +03:00, LOG-20261104-1056-phase1):** first build of Phase 1. Its note that an existing setup needs nothing after merging is no longer true.
- **Earlier (2026-11-03 22:43 +03:00, LOG-20261103-2243-phase0-commit):** backend Phase 0 is built and verified on `feature/backend-foundation`, committed and pushed (verify with `git ls-remote origin`), **not merged**. `main` (`56946bf`) still has the old `GET /`. Next: PR this branch into `main`, then Phase 1 (customers). Collaborator setup after it merges: §10 "Backend".
- **Earlier (2026-11-03, LOG-20261103-2154-plan-approved):** backend plan approved (`docs/backend-implementation-plan.md`); Phase 0 runs on `feature/backend-foundation`. The repository owner decided: fictional data during development, client-data import as a separate pre-launch phase, configurable reference formats, `class-validator` validation, JWT login in Phase 0, numeric customer ids (§9).

- **Latest (2026-10-29 21:38 +03:00, LOG-20261029-2138-merged):** `main` (`293a951`) now contains the whole frontend (PR #1) and the database schema with Node 24.20.0 pin (PR #2). Work from `main` from now on. Collaborator: fetch, switch to `main`, pull, then follow `docs/database-design.md` §8. Next decision: authorize the next backend phase (sign-in and roles with seeded permissions, the credit-override guard, then API endpoints; first remove or protect `GET /`). The bullets below describe earlier states.

- **Latest (2026-10-26 22:32 +03:00, LOG-20261026-2215-database-schema):**
  - The repository owner approved and the database schema was built on the new branch **`feature/database-schema`** (from `feature/frontend-foundation` at `9c5bdf3`): 33 tables, two migration packages, `docs/database-design.md`.
  - Node 24.20.0 is pinned.
  - It is applied only to the repository owner's local DB. Committed and pushed as a new branch in LOG-20261026-2301-commit-push; verify with `git ls-remote origin`. Not merged.
  - **For the collaborator, after it is pushed:**
    1. Switch to Node 24.20.0.
    2. In `Backend/backend`, run `npm ci`.
    3. Run `npx prisma db verify` and `npx prisma db migrate --show` (read-only) to see your DB's state.
    4. Apply with `npx prisma db migrate --advance-ref db` only once that state is understood.
  - **Next decisions:**
    - Order of the PRs: frontend first, then database.
    - Authorize the next backend phase: auth and roles with seeded permissions, the credit-override guard, then the API endpoints. Removing or protecting `GET /` comes first.
- **Superseded by the entry above where they conflict:** the "Authorized work", "Decided" and "Still unresolved" bullets below. The Node version and the repository owner's DB state are now resolved. The owner has not explicitly reviewed the collaborator's other 2026-10-19 decisions.

- **Git state (2026-10-21 23:41 +03:00, LOG-20261021-2341-commit-push):** `main` = `origin/main` = `883f93b` (unchanged). `feature/frontend-foundation` contains phases 1–3 (`5e2910f`) and, in the commit after `77471c7`, the grouped sidebar, the new pages, the browser-review fix and notifications and tasks (see `git log -1 feature/frontend-foundation`). It is pushed with a normal push; verify with `git ls-remote origin`. Nothing is merged into `main`. A pull request for the repository owner's review is the suggested next step; a draft description is described in LOG-20261021-0144-pr-draft (it predates the newer pages).
- **Session ended 2026-10-21 ~01:58 +03:00 (LOG-20261021-0158-wrap-up):** the incomplete npx cache folder from LOG-20261021-0128-precommit-review was deleted on the collaborator's instruction. No servers running. All log entries, including LOG-20261021-0159-final-commit, are committed and pushed on `feature/frontend-foundation` (verify with `git log -1` and `git ls-remote origin`).
- **Sidebar pages (2026-10-21 22:40 +03:00, LOG-20261021-2240-sidebar-pages):** grouped sidebar and new Agents, Expenses & profitability, Reports, Users & permissions and Settings & audit log pages. Committed and pushed in LOG-20261021-2341-commit-push.
- **Session ended 2026-10-22 ~00:00 +03:00 (LOG-20261022-0000-handover-check):** everything is committed and pushed on `feature/frontend-foundation`, including that entry (verify with `git log -1` and `git ls-remote origin`). A fresh clone of `9bea6bb` passed `npm ci`, typegen, tsc, lint and build, so the repository owner can pull and run the branch. No servers or test browsers are running. The PR description to paste into GitHub is in the session scratchpad (`pr-description.md`); next step: open the pull request into `main`.
- **Notifications and tasks (2026-10-21 23:38, LOG-20261021-2338-notifications-tasks):** added under Operations, with a dashboard summary. Demo only: notifications are calculated in the browser, nothing is sent, and tasks last for the tab only. Committed and pushed in LOG-20261021-2341-commit-push.
- **Browser review (2026-10-21 23:04, LOG-20261021-2304-browser-review):** all phase 1–3 flows and the new pages were browser-tested in headless Chrome and pass. One layout fix (`components/ui/table.tsx`), committed with the work above. **Notifications and Tasks are missing** apart from a read-only dashboard task card. The screenshots referred to in the review request were not available to that session.
- **Authorized work:** frontend development (collaborator, 2026-10-19), and recording every phase in this log (2026-10-21). Backend, schema, integrations, deployment and Phase 0 cleanup are **not** authorized. Commit/push requires explicit collaborator approval.
- **Frontend state:** the shell (grouped sidebar) plus shipment management and delays, quotations, customer billing and history, agents and partners, document uploads, expenses and profitability, reports, and preview pages for users and permissions and for settings and the audit log, all on fictional demo data. Edits and uploaded files live only in the browser tab (session store) until reload. The only live backend call is `GET /health`. Endpoint, storage and integration contracts: `Frontend/frontend/docs/api-contracts.md`.
- **Most important open security issue:** unauthenticated `GET /` returns every `User` row (§12 item 1). Not fixed; it must be removed or protected before any real data is stored.
- **Documentation audit:** §16 (2026-10-15). Necessary corrections applied (LOG-20261015-2305-corrections); Recommended corrections applied (LOG-20261015-2310-corrections). Pre-commit consistency review done (LOG-20261015-2314-consistency): §16 now carries dated notes marking its "not modified / NOT applied" statements as historical; the findings themselves are preserved unchanged.
- **Decided 2026-10-19 (§16.6 decisions note):** naming convention, collaborator confirmation, frontend scope, Node (observed only), line-ending preference, Prisma freeze, integration labelling, commit strategy.
- **Still unresolved:** "Phase 0" definition; agreed Node.js version; the repository owner's DB state and how the `User` table was created; keep/remove the `deploy` script; Prisma RC vs stable and `@prisma/client` 7; KRA iCMS / M-Pesa access; the repository owner's own confirmation of these decisions.
- **Next recommended action:**
  0. Browser-test any further changes the same way (headless Chrome scripts, LOG-20261021-2304-browser-review), and update the PR description to cover the newer pages before opening the pull request.
  1. Review phases 1–3 in a browser (`npm run dev` in `Frontend/frontend`), including on a phone-width screen. In particular: create and edit a shipment, record a delay, the quotation lifecycle and printing, and uploading, opening and downloading a real file.
  2. Then decide whether to open a pull request from `feature/frontend-foundation` (now `5e2910f`) into `main` for the repository owner to review. Commit the pending `CLAUDE.md` follow-up entry with the next change.
  3. Separately, decide whether to authorize backend work, starting with removing or protecting `GET /`, then the write endpoints and private document storage in `docs/api-contracts.md`.

## 15. Maintaining this document

1. Before editing, run `git status` and `git fetch` (read-only for working files) and compare `main` with `origin/main`; read this whole file. Only `git pull` when the human contributor has authorized it and the working tree is clean or changes are safely committed/stashed. Never overwrite another contributor's entries.
2. Append a log entry (§13) for everything done in a session. Include changes, checks run (including read-only ones), processes started or stopped, files created outside the repository, failed attempts and instructions received. If something is done after an entry is written, add a short follow-up entry. New entries go at the end of §13 (above §14), not at the end of the file. (Changed 2026-10-21 on the collaborator's instruction, LOG-20261021-0116-logging-rule; previously trivial read-only commands were excluded.)
3. Get timestamps from PowerShell `Get-Date -Format "yyyy-MM-dd HH:mm:ss zzz"`. Git Bash's `date` on this machine ignores `TZ=Africa/Nairobi` and reports GMT — do not use it. (Cause: Git Bash lacks zoneinfo. In Git Bash, `TZ=EAT-3 date '+%F %T %z'` gives the correct +0300 time; PowerShell remains the preferred source.)
4. Never backdate; if exact time is unknown write "Exact change time unavailable." Don't infer times from file mtimes alone.
5. Update §5, §11, §12 and §14 when facts change; log changes to this file itself.
6. Commit log entries together with the change they describe, to reduce merge conflicts between contributors.
7. If this file grows too long, move older log entries to `docs/activity-log.md` (keeping them intact) and leave a summary plus pointer here.

---

## 16. Independent documentation accuracy audit

> Appended for review. Sections 1–15 above were **not** modified. Corrections proposed here have **not** been applied.
> Evidence labels: **[Verified]** directly supported by inspected evidence · **[Unsupported]** not substantiated · **[Inference]** plausible, not proven · **[Unknown]** cannot be determined from the repo/history.
> Reviewer note: sections 1–15 were written earlier on 2026-10-15 by the same Claude Code (Opus 5.5) session that performed this audit. This is a self-review, not an independent third-party review; an external reviewer should treat it accordingly.
>
> **Status update (added 2026-10-15 23:14:47 +03:00, LOG-20261015-2314-consistency):** the two statements at the top of this block ("Sections 1–15 … were **not** modified" and "Corrections … have **not** been applied") were true when this audit was appended (14:42:23 +03:00) but are **no longer current**. The corrections were subsequently applied to sections 1–15 and recorded in §13:
> - Necessary corrections (AUDIT-001, -002, -003, -005, -007, -011): **LOG-20261015-2305-corrections**.
> - Recommended corrections and corrections to earlier log entries (AUDIT-004, -006, -008, -009, -010, -012 to -018, -020, -021, -022): **LOG-20261015-2310-corrections**.
>
> Where the applied wording differs from §16.5, sections 1–15 are authoritative. Corrections to historical log entries were made by adding new log entries, not by editing the originals. The rest of §16 (findings, evidence, proposed wording, conclusion) is preserved unchanged as the historical audit record.

### 16.1 Audit metadata

- **Audit start:** 2026-10-15 14:38:44 +03:00 — **report text finalised:** 2026-10-15 14:39:30 +03:00 (the first append attempt failed with a shell quoting error and wrote nothing — file hash confirmed unchanged — so the report was re-written via a temporary file; see 16.9 for the actual append time).
- **Timezone:** Africa/Nairobi (UTC+03:00; Windows zone "E. Africa Standard Time").
- **Timestamp source:** PowerShell `Get-Date -Format "yyyy-MM-dd HH:mm:ss zzz"` on the local machine.
- **Git state observed before writing:** branch `main`, tracking `origin/main`, ahead 0 / behind 0; HEAD `42ae8a88ca49592b18e3f1ce090b55105caeb616`; no stashes; no merge/lock files; only untracked file `CLAUDE.md`. `git ls-remote origin` → `HEAD` and `refs/heads/main` = `42ae8a8` (no other remote branches).
- **Pre-edit state of this file:** 226 lines, SHA-256 `be1c7c44581de7944b40e80cb6494fb91f67d51cfa27ce96dff3f8fdd7d6992a`, last modified 2026-10-15 14:32:55 +03:00 (consistent with the creation recorded in LOG-20261015-1431-SM; no sign of edits by anyone else).
- **Scope:** every section 1–15 of this file checked against tracked files, Git metadata/diffs/reflogs, package manifests and lockfiles, installed `node_modules` package metadata, and the Prisma runtime source in `node_modules`.
- **Commands run freshly in this audit (none write files):** backend `tsc --noEmit --incremental false -p tsconfig.json`, `oxlint --type-aware src/ test/`, `prettier --check` (with and without `--end-of-line auto`); frontend `tsc --noEmit --incremental false`, `eslint`; `git status/log/show/ls-files --eol/grep/ls-remote`. `git status --porcelain --ignored` was identical before and after; `Backend/backend/dist/` and `tsconfig.build.tsbuildinfo` mtimes unchanged (2026-10-09 13:11:29 +03:00).
- **Limitations:** no database was contacted; unit/e2e tests, builds and `npm audit` were not run (cache writes / DB access / network registry); GitHub collaborator permissions not queried; the sister's machine and environment are not observable; the earlier Claude Sonnet 5 conversation (commit `42ae8a8`) is not available.

### 16.2 Executive summary — as at 2026-10-15 14:42:23 +03:00

> Historical record: the problems listed below have since been corrected in sections 1–15 (LOG-20261015-2305-corrections, LOG-20261015-2310-corrections).

Sections 1–15 are **largely accurate** on the facts that matter most: commit history, file contents, package versions, absence of auth/business modules, the unauthenticated `GET /`, the `deploy` script and the recorded check results were all re-verified. The material problems are:

1. **One technical inaccuracy:** §12 item 6 says `db.ts` *connects* at import time; the Prisma 8 runtime actually connects lazily on first query (AUDIT-001).
2. **Line-ending claims are misleading:** committed files are LF; CRLF exists only in this machine's working copy because of local `core.autocrlf=true`, so the Prettier result is machine-dependent (AUDIT-002).
3. **Attribution overreach:** log IDs use initials "CK" (unsupported) and entries attribute sessions to "Sean Macharia's machine", which rests on local Git config, not identity confirmation (AUDIT-003, AUDIT-004).
4. **Maintenance rule risk:** §15 says `git pull` before editing, which conflicts with the project's no-pull-without-authorization rule (AUDIT-005).
5. **Unit-test nuance:** the "mocked DB" unit test still imports the real `db.ts` and loads `.env` (AUDIT-006).
6. The handover state (§13/§14) does not yet record this audit (AUDIT-007).

After the Necessary corrections in 16.5 are reviewed and applied, the file is suitable as a shared handover. Nothing found indicates a security or data-loss risk introduced by the document itself.

### 16.3 Verified statements

| Claim (section) | Evidence |
|---|---|
| Source of truth is `karechel/freight-management`, branch `main` (§1) | `git remote -v` → `https://github.com/karechel/freight-management.git`; `git ls-remote` shows only `main` |
| Two commits; `b68a0cd` by "Chelsea" 2026-10-05 22:11:20 +03:00; `42ae8a8` by "Sean Macharia" 2026-10-09 13:14:36 +03:00 with trailer `Co-Authored-By: Claude Sonnet 5` (§13) | `git log --format` (committer dates identical to author dates); commit body |
| `42ae8a8` is still the latest commit and is on the remote (§13, §14) | `git log -1`, `git ls-remote origin` |
| Push of `42ae8a8` happened from this clone | `.git/logs/refs/remotes/origin/main`: `b68a0cd → 42ae8a8 … update by push`, epoch 1791540920 = 2026-10-09 13:15:20 +03:00 (Git identity recorded: Sean Macharia) |
| `b68a0cd` tests asserted "Hello World!" (LOG-20261005) | `git show b68a0cd:Backend/backend/src/app.controller.spec.ts` lines 18–19; `…/test/app.e2e-spec.ts` line 23 |
| `42ae8a8` file list and purpose (LOG-20261009) | `git show --stat 42ae8a8`: 8 files, matches the log entry exactly |
| `.env` / `.env.local` never committed (§8) | `git log --all --name-only` for env patterns → only `.env.example` files |
| No shared DB configured in the repo (§7) | `git grep DATABASE_URL` → only a placeholder in `Backend/backend/.env.example` and `process.env` reads |
| Local `.env` DB host is localhost (§7) | Checked host/DB name only; values not recorded |
| `GET /` returns all `User` rows unauthenticated (§12.1) | `Backend/backend/src/app.controller.ts` `getHello()` → `app.service.ts` `this.prisma.client.orm.public.User.all()`; `src/prisma/contract.json` fields `id, email, name, createdAt`; `git grep` for `UseGuards|CanActivate|passport|jwt|bcrypt|argon|ValidationPipe|helmet|Throttler` → none |
| Prisma 8 contract architecture, generated files "DO NOT EDIT" (§3) | `contract.prisma` line 1 `// use prisma-8`; headers of `contract.json`/`contract.d.ts`; `prisma.config.ts` `definePrismaConfig` |
| Migration ref hash = contract storage hash; no SQL migrations (§3, §12.4) | `migrations/app/refs/db.json` hash `a9d7a849…` = `contract.json` `storageHash`; only `refs/` and `snapshots/` exist |
| `@prisma/client` 7.10.0 unused (§3) | Declared in `package.json`; `git grep @prisma/client` in `src`, `test`, `prisma.config.ts` → none |
| `dotenv` transitive only (§3, §12.5) | Not in `Backend/backend/package.json`; lockfile shows it required by `c12` and `prisma`; imported in `main.ts`, `db.ts`, `prisma.config.ts` |
| Versions (§3) | `package-lock.json` resolved versions equal installed `node_modules` versions for every package listed (NestJS 12.1.0, prisma 8.0.0-rc.17, @prisma/orm-postgres 8.0.0-rc.12, @prisma/client 7.10.0, dotenv 17.4.2, TS 6.0.3 / 5.9.3, Vitest 4.1.11, oxlint 1.85.0, Next 16.3.5, React 19.2.8, Tailwind 4.3.3, ESLint 9.39.5) |
| `npm run deploy` → cloud deployment via Mau (§8) | `Backend/backend/package.json` `"deploy": "nest deploy"`; `node_modules/@nestjs/cli/commands/deploy.command.js` description "Deploy your application to the cloud (powered by Mau)"; `@nestjs/mau` 0.2.8 installed |
| CORS `http://localhost:3000`, `PORT` default 3001 (§3) | `Backend/backend/src/main.ts` |
| e2e test bypasses `validateEnv()` (§12.6) | `Backend/backend/test/app.e2e-spec.ts` imports `AppModule` directly |
| Next.js docs in `node_modules/next/dist/docs/` and agent-file generator exist (§1, §3) | Both paths present under `Frontend/frontend/node_modules/next/` |
| §11 check results | **Freshly re-run today with identical results:** backend tsc → 1 error `test/app.e2e-spec.ts(4,21) TS2307 'supertest/types'`; backend oxlint exit 0; backend prettier --check → 10 files; frontend tsc exit 0; frontend eslint exit 0 |
| Git Bash `date` ignores `TZ=Africa/Nairobi` (§15.3) | `TZ=Africa/Nairobi date` → `+0000 GMT`; `/usr/share/zoneinfo` absent in Git Bash |

### 16.4 Findings and discrepancies

**AUDIT-001 — Medium — §12 item 6: "`db.ts` connects at import time with `DATABASE_URL!`"**
- Issue: inaccurate. `db.ts` *creates* the client at import time, but the connection is lazy.
- Evidence: `Backend/backend/node_modules/@prisma/orm-postgres/dist/runtime.mjs`. `getRuntime()` (called from `query/execute/connection`) is what invokes `connectDriver(binding)`; `postgres()` itself does not connect. [Verified, static reading of installed runtime]
- Correction: Necessary. Confidence: high.

**AUDIT-002 — Medium — §11 and §12 item 9: "prettier --check → 10 files flagged (CRLF + indentation)"; "CRLF line endings (`core.autocrlf=true`, no `.gitattributes`)"**
- Issue: misleading. CRLF is a local working-copy artifact, not repo content, so the results differ per machine.
- Evidence: `git ls-files --eol` → every backend `src`/`test` file is `i/lf` (LF in the repo); 12 of 14 are `w/crlf` in this working copy; `core.autocrlf=true` is this machine's Git config; no `.gitattributes`. With `--end-of-line auto`, 8 files are still flagged: `src/app.controller.spec.ts`, `src/app.controller.ts`, `src/app.service.ts`, `src/main.ts`, `src/prisma/contract.d.ts`, `src/prisma/db.ts`, `src/prisma/prisma.module.ts`, `src/prisma/prisma.service.ts`. Exact non-line-ending diffs were not inspected beyond the indentation visible in `app.controller.ts`, `app.service.ts` and `main.ts`. [Verified]
- Correction: Necessary. Confidence: high.

**AUDIT-003 — Medium — §13 log IDs `LOG-20261005-2211-CK`, `…-SM`**
- Issue: unsupported. Git records the author of `b68a0cd` only as "Chelsea"; no surname or initial "K" is in evidence. [Unsupported]
- Correction: Necessary for the CK ID (use a suffix that is not inferred). Do not rename existing IDs silently; add a documented correction entry. Confidence: high.

**AUDIT-004 — Medium — §3 "on Sean's machine"; LOG-20261015-1423-SM / -1431-SM "Sean Macharia's machine"; §1 "Sean Macharia is a collaborator"**
- Issue: inference stated as fact. The evidence is the local Git config (`user.name` = Sean Macharia) and the commit/push identity. The operator has said they are the collaborator but has not stated their name in the session. GitHub collaborator status was not queried. [Inference, medium-high plausibility]
- Correction: Recommended. Confidence: medium.

**AUDIT-005 — Medium — §15 rule 1: "`git pull` and read this whole file before editing"**
- Issue: contradicts the project's "no pull/merge without authorization" safeguard, and could merge into a contributor's uncommitted work (e.g. this untracked `CLAUDE.md`).
- Correction: Necessary. Confidence: high.

**AUDIT-006 — Medium — §11: "`src/app.controller.spec.ts` (mocked DB)"**
- Issue: incomplete. The spec overrides the `PrismaService` provider, but its imports (`app.service.ts` → `prisma/prisma.service.ts` → `prisma/db.ts`) still execute `db.ts`. That loads `dotenv/config` (the developer's `.env`) and constructs the real client. Per AUDIT-001, no connection is opened unless a query runs on the real client. [Verified import chain; runtime behaviour inferred from static reading]
- Correction: Recommended. Confidence: high (imports), medium (runtime).

**AUDIT-007 — Medium — §13/§14 handover state**
- Issue: missing. Neither section records this audit, and §14 "Next recommended action" does not mention the pending corrections. Also, because §16 is appended after §13, future "append-only, oldest first" log entries must go at the end of §13, not at the end of the file.
- Correction: Necessary. Confidence: high.

**AUDIT-008 — Low — LOG-20261009-1314-SM: "Pushed: yes (confirmed 2026-10-15 via `git ls-remote`…)"**
- Issue: `ls-remote` proves the commit is on the remote, not who pushed it or when. Stronger evidence exists: the remote-tracking reflog records "update by push" at 2026-10-09 13:15:20 +03:00 from this clone. [Verified]
- Correction: Recommended. Confidence: high.

**AUDIT-009 — Low — LOG-20261005-2211-CK: "Pushed: yes (present on `origin/main`)"**
- Issue: it is on the remote, but how and when it reached GitHub is [Unknown]. This clone's reflog starts with `clone` at 2026-10-08 16:13:41 +03:00.
- Correction: Recommended clarification. Confidence: high.

**AUDIT-010 — Low — §1 "Owned by Chelsea (GitHub `karechel`)"**
- Issue: `karechel` as the owner account is [Verified] from the remote URL. That the account belongs to Chelsea is [Inference], based on the initial commit author "Chelsea" and the collaborator's statement that the owner is their sister.
- Correction: Recommended. Confidence: medium.

**AUDIT-011 — Low — §5: "All 16 business modules (§2) — Planned" vs "`User` model — In progress"**
- Issue: internal contradiction, because module 2 (users/staff) is partially present.
- Correction: Necessary (small). Confidence: high.

**AUDIT-012 — Low — §11 / §10: Prettier and `npm run format` include generated files**
- Issue: missing warning. `src/prisma/contract.d.ts` (header "GENERATED FILE - DO NOT EDIT") is in the flagged list and inside the `format` glob `src/**/*.ts`, so running `npm run format` would rewrite it.
- Correction: Recommended. Confidence: high.

**AUDIT-013 — Low — §10 setup: "`npm install` in each app folder"**
- Issue: with caret ranges on prerelease Prisma (`^8.0.0-rc.12`, `^8.0.0-rc.17`), `npm install` can update the lockfile. `npm ci` installs exactly what the lockfile pins.
- Correction: Recommended. Confidence: medium (npm resolution behaviour not tested here).

**AUDIT-014 — Low — §3 runtime versions; no required Node version documented**
- Issue: omission. Neither `package.json` has an `engines` field, and there is no `.nvmrc` or `.node-version`. Node v24.20.0 / npm 11.19.0 are simply what this machine has. [Verified absence]
- Correction: Recommended (needs an owner decision). Confidence: high.

**AUDIT-015 — Low — §4 important files incomplete**
- Issue: omits `Backend/backend/vitest.config.ts` (unit include `**/*.spec.ts`), `Backend/backend/vitest.config.e2e.ts` (include `**/*.e2e-spec.ts`), `Backend/backend/nest-cli.json` (`deleteOutDir: true`), `Backend/backend/.oxlintrc.json`, `Backend/backend/.prettierrc`, `Backend/backend/tsconfig*.json`, `Frontend/frontend/eslint.config.mjs`, `Frontend/frontend/next.config.ts` (empty) and `Frontend/frontend/postcss.config.mjs`.
- Correction: Recommended. Confidence: high.

**AUDIT-016 — Low — §15 rule 3 (timestamps)**
- Issue: accurate but incomplete. The cause is missing zoneinfo in Git Bash. In Git Bash, `TZ=EAT-3 date '+%F %T %z'` gives the correct +0300 output (verified 14:38:36 +0300). PowerShell remains the recommended source.
- Correction: Recommended. Confidence: high.

**AUDIT-017 — Low — §13 reconstructed entries omit template fields**
- Issue: LOG-20261005 and LOG-20261009 lack "Database/schema changes", "Dependency changes" and "Working-tree status after". These are [Unknown] for historical commits, although `b68a0cd` did add dependencies (both lockfiles) and the Prisma contract/migration snapshot.
- Correction: Recommended (fill in as "Unknown" or with Git-derived facts via a correction entry). Confidence: high.

**AUDIT-018 — Informational — §2/§5: "KRA iCMS … likely Blocked on KRA onboarding/accreditation (unconfirmed)"**
- Issue: based on general domain knowledge, not repo evidence. It is already marked "unconfirmed", which is acceptable if it is labelled as an assumption. [Unsupported by repo]
- Correction: Recommended label tweak. Confidence: high.

**AUDIT-019 — Informational — §8 "possibly paid" for `npm run deploy`**
- Issue: that it deploys to Mau cloud is [Verified]; the cost is [Unknown] from the repo. The wording is appropriately hedged.
- Correction: None needed.

**AUDIT-020 — Informational — LOG-20261009 "Checks run and results: not recorded"**
- Issue: accurate. [Inference only:] the mtimes of `Backend/backend/dist/` and `tsconfig.build.tsbuildinfo` (2026-10-09 13:11:29 +03:00), together with the presence of `dist/config/env.validation.js`, suggest a backend build ran about 3 minutes before the commit. Mtimes do not prove results.
- Correction: Optional note. Confidence: medium.

**AUDIT-021 — Informational — §7 local DB statements**
- Issue: the one-local-database-per-developer arrangement is a collaborator instruction (2026-10-15) and cannot be verified from the repo for the sister's machine. This machine's `.env` host is localhost [Verified]; the sister's configuration is [Unknown].
- Correction: None needed beyond keeping the "Source" column in §9.

**AUDIT-022 — Informational — §11 TS2307 cause**
- Issue: the error is verified but its cause is [Unknown]. `@types/supertest` 7.2.1 ships `types.d.ts`, yet `supertest/types` fails to resolve under `moduleResolution: nodenext`. Do not document a cause until it has been investigated.
- Correction: None.

### 16.5 Proposed corrections (NOT applied) — original audit recommendations, as at 2026-10-15 14:42:23 +03:00

> Historical record: this list describes what the audit proposed at that time, not the current state. These corrections were later applied (LOG-20261015-2305-corrections, LOG-20261015-2310-corrections). Differences in how they were applied: the KRA label was applied in §5 (§2 has no KRA status line); "Sean's machine" in historical log entries was corrected via a new log entry instead of editing those entries; the applied §1 wording is more detailed than proposed. See sections 1–15 for the current wording.

- **§12 item 6 → replace with:** "`Backend/backend/src/prisma/db.ts` creates the Prisma client at import time using `DATABASE_URL!` (non-null assertion, no validation in that path); the connection itself opens lazily on the first query (`@prisma/orm-postgres/dist/runtime.mjs`, `getRuntime()`). The e2e test imports `AppModule` directly and therefore bypasses `validateEnv()`." (AUDIT-001)
- **§11 last-results line and §12 item 9 → replace the CRLF wording with:** "Prettier `--check` flags 10 files on a working copy checked out with CRLF (`core.autocrlf=true`, a per-machine Git setting); committed files are LF (`git ls-files --eol`). Ignoring line endings (`--end-of-line auto`), 8 files are flagged, including the generated `src/prisma/contract.d.ts`. No `.gitattributes` exists, so line endings depend on each developer's Git config." (AUDIT-002)
- **§13 → add a correction entry (do not rename old IDs):** "LOG-20261015-xxxx — Correction to LOG-20261005-2211-CK: the 'CK' suffix was not supported by evidence; Git records the author only as 'Chelsea'. Refer to this entry as LOG-20261005-2211-chelsea in future references." (AUDIT-003)
- **§1 → replace the ownership line with:** "Repository owner account: `karechel` (from remote URL). Initial commit authored as 'Chelsea'; the collaborator states the owner is their sister. Collaborator working on the clone whose Git identity is 'Sean Macharia'." **§3/§13:** replace "Sean's machine" with "the local clone with Git identity Sean Macharia". (AUDIT-004, AUDIT-010)
- **§15 rule 1 → replace with:** "Before editing, run `git status` and `git fetch` (read-only for working files) and compare `main` with `origin/main`; read this whole file. Only `git pull` when the human contributor has authorized it and the working tree is clean or changes are safely committed/stashed. Never overwrite another contributor's entries." (AUDIT-005)
- **§11 tests bullet → replace "(mocked DB)" with:** "(overrides `PrismaService` with a mock, but still imports `db.ts`, which loads `.env` and constructs the real client; no query is sent to it)". (AUDIT-006)
- **§5 → replace "All 16 business modules (§2) — Planned" with:** "Modules 1 and 3–16 (§2) — Planned; module 2 (users/staff) — In progress (minimal `User` model only)". (AUDIT-011)
- **§10 → add:** "`npm run format` rewrites `src/**/*.ts`, including the generated `src/prisma/contract.d.ts`; do not run it without excluding generated files." and "Prefer `npm ci` (exact lockfile versions) over `npm install` unless a dependency change is authorized." (AUDIT-012, AUDIT-013)
- **§3 → add:** "Required Node.js version: not specified (no `engines` / `.nvmrc`). Observed on one machine: Node v24.20.0, npm 11.19.0." (AUDIT-014)
- **§4 → add rows** for the config files listed in AUDIT-015.
- **§15 rule 3 → append:** "(Cause: Git Bash lacks zoneinfo. In Git Bash, `TZ=EAT-3 date '+%F %T %z'` gives the correct +0300 time; PowerShell remains the preferred source.)" (AUDIT-016)
- **LOG-20261009 → add via a correction entry:** "Push evidence: `.git/logs/refs/remotes/origin/main` records 'update by push' b68a0cd→42ae8a8 at 2026-10-09 13:15:20 +03:00 from this clone." **LOG-20261005:** "How/when it was pushed: unknown." (AUDIT-008, AUDIT-009, AUDIT-017)
- **§13 → append a new entry at the end of §13 (above §16):**
  ```
  ### LOG-20261015-1438-audit
  - Time: 2026-10-15 14:38:44 +03:00 (start) / see §16.9 for append time (Africa/Nairobi) — source: PowerShell Get-Date
  - Contributor/session: collaborator's local clone (Git identity Sean Macharia) / Claude Code (Opus 5.5)
  - What changed: appended §16 documentation accuracy audit to CLAUDE.md; sections 1–15 unchanged
  - Why: verify the handover document before it is committed and shared
  - Files edited: CLAUDE.md (append only). Created/deleted: none in the repository
  - Database/schema changes: none · Dependency changes: none
  - Checks run and results: backend tsc (1 error TS2307 in test/app.e2e-spec.ts), oxlint pass, prettier --check 10 files (8 with --end-of-line auto); frontend tsc pass, eslint pass. Tests/builds/npm audit not run
  - Known failures: first append attempt failed (shell quoting error); verified it wrote nothing before retrying
  - Commit: not committed · Pushed: no
  - Working-tree status after: CLAUDE.md untracked; nothing else changed
  ```
- **§14 → replace "Next recommended action" with:** "Review §16 findings; apply the Necessary corrections (AUDIT-001, -002, -003, -005, -007, -011); then decide whether to commit `CLAUDE.md`." (AUDIT-007)
- **§2 KRA line → append:** "(assumption from general domain knowledge; not established by repository evidence)". (AUDIT-018)

### 16.6 Missing information and unresolved questions

> Current status (2026-10-15 23:18:51 +03:00, LOG-20261015-2318-finalize): **all ten questions below remain open.** None has been answered in the repository or in any recorded session. Do not treat any of them as decided.
>
> **Decisions recorded 2026-10-19 15:03:04 +03:00 (LOG-20261019-1503-frontend-decisions).** The collaborator answered the ten questions. The original questions are kept below unchanged. Decisions vs. still-unknown facts:
> 1. **Naming:** use role labels ("repository owner", "collaborator") in shared docs. No personal emails. Git author names and usernames are Git metadata, not proof of identity. The collaborator states the repository owner is their sister.
> 2. **Collaborator:** the collaborator confirms they operate these sessions. Local Git identity "Sean Macharia" is Git metadata only; do not change Git identity settings without asking.
> 3. **Scope:** authorized: **frontend development** (shell, dashboard, core screens, connecting to existing endpoints). Not authorized: backend implementation, schema changes, live integrations, deployment, unrelated Phase 0 cleanup. "Phase 0" itself remains undefined.
> 4. **Node.js:** v24.20.0 is the collaborator's observed environment, **not** an agreed requirement. No `engines` field or version change.
> 5. **Owner's database:** **unknown** (existence, contents, setup). Each contributor uses their own local DB/env. No DB-writing or Prisma migration commands during frontend work.
> 6. **Line endings:** prefer LF in committed files; avoid noisy line-ending diffs; no global Git config changes; add `.gitattributes` only if genuinely needed with a narrow, explained change. (None added so far.)
> 7. **`deploy` script:** do not run; keep/remove remains **undecided**; leave unchanged.
> 8. **Prisma:** no upgrade/downgrade/removal now; preserve lockfiles and the Prisma 8 contract architecture. A stable migration or removal of `@prisma/client` 7 needs a separate decision.
> 9. **KRA iCMS / M-Pesa:** access status **unknown**. UI shows them as pending; only clearly labelled demo data; no fake integrations, no secrets.
> 10. **Commits:** the earlier direct-to-`main` authorization was for the documentation handover only. New application code goes on a feature branch and is committed/pushed only with explicit collaborator approval; never force-push.

1. Should contributor names and emails appear in the log, and in what form (full name, first name, role)? Confirm the owner's preferred identifier (AUDIT-003/004/010).
2. Is Sean Macharia the collaborator operating these sessions? Please confirm explicitly.
3. What does "Phase 0" cover, and which phases are authorized?
4. What Node.js version should both developers use (AUDIT-014)?
5. Does the sister's local database exist, and does it contain the `User` table? How was the table created on either machine (which Prisma 8 command)? This cannot be determined from the repo.
6. Is there a team decision on line endings (`.gitattributes`, `core.autocrlf`)?
7. Is `npm run deploy` / Mau intended at all, or should the script be removed later?
8. Stay on Prisma 8 RC or move to a stable release? Keep or remove `@prisma/client` 7?
9. Has KRA iCMS system-to-system access been applied for? Is an M-Pesa Daraja sandbox account available?
10. Should `CLAUDE.md` be committed directly on `main` or via a branch/PR to the owner's repository?

### 16.7 Recommended correction order — as at 2026-10-15 14:42:23 +03:00

> Historical record: all corrections listed below have since been applied (see the §16 status note).

1. **AUDIT-005** (§15 `git pull` rule): it governs every future session and could cause lost work.
2. **AUDIT-007** (log entry + §14): keeps the handover current before anyone else reads it.
3. **AUDIT-001, AUDIT-002, AUDIT-006**: technical inaccuracies that would mislead debugging or formatting work.
4. **AUDIT-003, AUDIT-004, AUDIT-010**: attribution accuracy, which matters because the file is shared between two people.
5. **AUDIT-011, AUDIT-012, AUDIT-013, AUDIT-008, AUDIT-009, AUDIT-017**: small accuracy and safety improvements.
6. **AUDIT-014, AUDIT-015, AUDIT-016, AUDIT-018**: completeness.

### 16.8 Audit conclusion — as at 2026-10-15 14:42:23 +03:00

> Historical record: this conclusion reflects the document's state when the audit was appended. The Necessary corrections it lists were applied in LOG-20261015-2305-corrections; the remaining recommendations in LOG-20261015-2310-corrections. For the current state see §14.

- **Correct before committing and sharing:** AUDIT-001, AUDIT-002, AUDIT-003, AUDIT-005, AUDIT-007 and AUDIT-011 (all marked Necessary). The others are recommended.
- None of the findings about the document's accuracy are Critical or High. The High-severity *project* risks the document already records (unauthenticated `GET /`, no auth, Prisma RC, the `deploy` script) were re-verified as accurately described.
- **Confirmed:** no application files, tests, configuration, packages, database state or Git history were changed during this audit, and no database was contacted. A temporary copy of this section was written to the Claude Code scratchpad (outside the repository) to work around the failed append.

### 16.9 Git and file state after audit — as at 2026-10-15 14:42:23 +03:00

> Historical record: "lines 1–226 unchanged" was true at append time. Sections 1–15 have since been edited (LOG-20261015-2305-corrections, LOG-20261015-2310-corrections, LOG-20261015-2314-consistency). For the current Git state see §14.

- Only file intentionally modified: `CLAUDE.md` at the repository root (append only; lines 1–226 unchanged).
- Append completed (Africa/Nairobi, PowerShell `Get-Date`): 2026-10-15 14:42:23 +03:00
- `git status --porcelain` after append: `?? CLAUDE.md` only (re-checked immediately after writing).
- Not committed. Not pushed.
