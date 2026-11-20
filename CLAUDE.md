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
| Quotations and bookings (Phase 2): quotations API, server totals, status flow, expiry, duplicate, conversion to a booking, standalone bookings, confirm and cancel, credit-limit check with override, archived-customer refusal; live quotation pages and minimal booking pages | **Verified** 2026-11-20 (re-run on the branch the same day); committed on `feature/quotations-phase2` (`ec5c760`) and pushed; **awaiting PR review and merge**, not on `main` | LOG-20261120-1343-phase2-backend, LOG-20261120-1412-phase2-done, LOG-20261120-1425-phase2-reconcile: 104 unit tests, 142 end-to-end tests, 14 browser checks. Remediation batch 1 (LOG-20261120-1501-phase2-batch1, **not committed**): 108 unit, 145 end-to-end, 18/18 browser. Credit-approval step (LOG-20261120-1514-credit-approval): 112 unit, 152 end-to-end, 21/21 browser. Batch 1 and the approval step committed as `7112b59` and pushed. Final Phase 2 items (LOG-20261120-1543-phase2-complete): New booking page and 6 more e2e tests; 112 unit, 158 end-to-end, 22/22 browser |
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
| Bookings over the credit limit: staff without `credit.override` (Sales) may create them as pending, awaiting credit approval; `credit.override` holders (Finance, Management, Admin) approve or reject with a reason (rejecting cancels the booking); confirmation waits for approval. No change to the credit rule, role permissions or schema (2026-11-20) | Operator instruction, 2026-11-20 ("implement this permission adjustment… Sales creating a booking and Finance/Management approving it"). The exact design is Claude Code's interpretation (LOG-20261120-1514-credit-approval). Repository owner's approval **not confirmed** |
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

## 13. Shared activity log

Append-only, oldest first. Never edit past entries; corrections are new entries referencing the original. Never record secrets.

**Older entries are archived verbatim in `docs/activity-log.md`, Part C** (LOG-20261005-2211-CK to LOG-20261104-1135-phase1-commit, moved 2026-11-16 by LOG-20261116-1554-docs-restructure; then LOG-20261116-1549-resume-sync to LOG-20261116-1658-session-close, moved 2026-11-20 by LOG-20261120-1425-phase2-reconcile; then LOG-20261120-1246-backend-roadmap to LOG-20261120-1309-phase2-prep-audit, moved 2026-11-20 by LOG-20261120-1501-phase2-batch1; then LOG-20261120-1315-phase2-start to LOG-20261120-1412-phase2-done, moved 2026-11-20 by LOG-20261120-1514-credit-approval; then LOG-20261120-1417-phase2-commit to LOG-20261120-1436-phase2-audit, moved 2026-11-20 by LOG-20261120-1543-phase2-complete). Summary of the archived period, for orientation only:
- **2026-10-05 – 10-15:** initial scaffold (`b68a0cd`); the commit titled "Phase 0" (`42ae8a8`: test and env fixes, before the backend plan defined its own Phase 0); read-only audit; this handover file; documentation audit (archive Part A) and its corrections.
- **2026-10-19 – 10-22:** frontend on fictional demo data (`feature/frontend-foundation`), built in three frontend "phases" (shipments and delays; quotations, customers and agents; document uploads), then the grouped sidebar, expenses, reports, users, settings and audit log, notifications and tasks; headless-browser review; fresh-clone check.
- **2026-10-26 – 10-29:** database schema (33 tables, migrations) and Node 24.20.0 pin (`feature/database-schema`); PRs #1 and #2 merged; read-only backend audit.
- **2026-11-03 – 11-04:** backend plan approved; backend Phase 0 (sign-in, permissions, reference formats, seeds) and Phase 1 (customers) built, verified, committed and pushed; PR #3 merged. The PR #4 merge is recorded in LOG-20261116-1549-resume-sync.
- **2026-11-16:** resumed on the collaborator's clone; `main` pulled to `d966e35`; this file split below the size limit (history archived, `docs/IMPLEMENTATION_ROADMAP.md` written); committed and pushed to `main` (`773db22`, `3bcc128`, `cbad567`); operator identified as Sean (collaborator).
- **2026-11-20 (morning):** detailed Phases 0–18 roadmap proposal written (`docs/BACKEND_IMPLEMENTATION_ROADMAP.md`, not approved); approved plan explained; read-only machine readiness check for Phase 2.
- **2026-11-20 (early afternoon):** Phase 2 authorized; `npm ci`, `.env` keys (random, never shown) and the credit rule "outstanding + booking value" decided by the operator; Phase 2 backend and frontend built; test and development databases migrated and seeded; 104 unit, 142 end-to-end and 14 browser checks passed.
- **2026-11-20 (mid-afternoon):** Phase 2 committed (`ec5c760`) and pushed on `feature/quotations-phase2`; `CLAUDE.md` reconciled and the branch re-validated; the PR could not be opened here (no `gh`); read-only completion audit (one validation bug, seed and display gaps, owner decisions).

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

### LOG-20261120-1501-phase2-batch1 — Phase 2 remediation batch 1: seven fixes, tests, seed; not committed
- Time: 2026-11-20, from 14:45:07 (start) to 15:03:09 +03:00 (this entry written) (Africa/Nairobi) — source: PowerShell `Get-Date`. The label uses 15:01, when the last check finished.
- Contributor/session: same session; operator not confirmed / Claude Code (Opus 5.5).
- **Instruction received:** pasted brief "TASK: Complete Phase 2 — First Remediation Batch":
  - Fix the seven items from LOG-20261120-1436-phase2-audit that need no new business-rule or permission decision.
  - Add tests; verify seed repeatability without destroying data; update the docs and this file.
  - No credit-rule, permission, on-hold/closed or re-conversion changes; no booking edits; no schema change; no Phase 3; no commit or push.
- **Starting state:** after `git fetch origin --prune`, branch `feature/quotations-phase2` = `origin/feature/quotations-phase2` = `071041a`; `origin/main` = `cbad567`. Uncommitted: `CLAUDE.md` (the LOG-20261120-1436 entry), kept.
- **Implemented:**
  1. **Issue date after sent date (bug):**
     - New rule `issueAfterSentProblem` in `src/quotations/quotation-rules.ts`: a sent quotation's issue date cannot be after the Nairobi day it was sent.
     - Applied in `QuotationsService.update` when the dates are valid.
     - Tests: 4 unit tests (`quotation-rules.spec.ts`) and 1 end-to-end regression (`test/quotations.e2e-spec.ts`).
  2. **"Live data" badge on demo fallback pages:**
     - New `components/layout/page-source.tsx` (`DemoPageContext`, `DemoPageMarker`). `AppShell` shows "Demo data" while a marker is rendered.
     - The marker is rendered by the three demo fallbacks: `app/quotations/[reference]/page.tsx`, `[reference]/edit/page.tsx`, `new/page.tsx`.
     - Limitation: the server-rendered HTML says "Live data" until the page hydrates (the marker is set in an effect).
  3. **Cancelled bookings:**
     - `quotationDisplayStatus` in `lib/live-quotations.ts` shows "Booking cancelled" when the quotation's booking is cancelled. It is used by the list and the detail page.
     - The detail page explains that the quotation cannot be converted again (one booking per quotation; no re-conversion policy invented).
     - Frontend only.
  4. **Open-quotation count:** `PartiesService.figures` counts as open only draft or sent quotations with `validUntil` on or after today (Nairobi).
     - The Phase 1 figures e2e test now uses far-future validity, so it no longer starts failing after 2026-11-30.
     - It adds two expired quotations: expected `{ open: 2, total: 5 }`.
  5. **Customer page:**
     - The outdated "Shipments and quotations move to the live system in later phases" is replaced.
     - A "View quotations" link opens `/quotations?customerId=<id>`.
     - `lib/live-quotations.ts` filters gain `customerId` (page and API queries, a hidden form field). `components/quotations/live-lists.tsx` shows "Showing quotations for … · Show all customers".
  6. **Convert form** (`components/quotations/live-quotation-actions.tsx`):
     - Optional carrier (live carriers loaded by `app/quotations/[reference]/page.tsx` only for accepted, unbooked quotations and `quotations.manage` holders), carrier booking number, planned departure and arrival.
     - Uses the existing API fields. Client checks that arrival is not before departure, with errors clearing on change. The values are kept through the credit-warning retry.
  7. **Demo seed:**
     - New `src/seed/demo-quotations.ts` (`seedDemoQuotations`), called by `src/seed/seed-demo.ts` after `seedDemo`. It adds the 8 frontend demo quotations, with the same references, and 2 confirmed bookings (`BKG-2610-0001`, `BKG-2610-0002`).
     - Fictional sent and decision times. Stored status `sent` for the demo "expired" record and `accepted` for "booked".
     - Skips existing references; refuses `NODE_ENV=production`; moves counters forward with `GREATEST` for the configured period.
     - Kept out of `seedDemo` because `test/references.e2e-spec.ts` expects `QT-2611-0001` after `seedDemo`.
     - 2 new e2e tests in `test/seed.e2e-spec.ts` (added once; counter never moved back), plus the production refusal.
- **Unchanged (as instructed):** the credit rule, permissions, rules for on-hold and closed customers, re-conversion, booking editing, the schema and migrations, and dependencies.
- **Files:**
  - Created: `Backend/backend/src/seed/demo-quotations.ts`, `Frontend/frontend/components/layout/page-source.tsx`.
  - Edited (backend): `src/quotations/quotation-rules.ts`, `quotation-rules.spec.ts`, `quotations.service.ts`; `src/parties/parties.service.ts`; `src/seed/seed-demo.ts`; `test/quotations.e2e-spec.ts`, `test/parties.e2e-spec.ts`, `test/seed.e2e-spec.ts`.
  - Edited (frontend): `components/layout/app-shell.tsx` (7 lines; a first attempt ran Prettier over the whole file, so it was restored with `git checkout -- …` and edited by hand); the three `app/quotations/…` pages; `components/customers/customer-detail-view.tsx`; `components/quotations/live-lists.tsx`, `live-quotation-actions.tsx`, `live-quotation-detail.tsx`; `lib/live-quotations.ts`.
  - Docs: `Frontend/frontend/docs/api-contracts.md`, `docs/backend-implementation-plan.md`, `docs/IMPLEMENTATION_ROADMAP.md`, this file (§5, §11, §12 items 16–22, §14, §13), `docs/activity-log.md`.
- **Checks run (actual results):**
  - Backend: `tsc` exit 0; `npm run lint` exit 0; `npm test` → 10 files, 108 pass; `npm run test:e2e` → 6 files, 145 pass (81 s; writes only the `*_test` database); `npm run build` pass. Prettier `--check`: only the three files already flagged before this session.
  - Seed repeatability, on the development database (adds rows, never deletes; a throwaway count script was run from the backend folder and removed):
    - Before: 17 parties, 5 users, 15 quotations, 10 bookings, 10 credit checks; counters `booking:0=11`, `quotation:0=16`.
    - `npm run db:seed:demo`, first run: `{ quotations: 8, bookings: 2 }`. Second run: `{ quotations: 0, bookings: 0 }`.
    - After: 23 quotations, 12 bookings; everything else unchanged; counters `booking:0=11`, `quotation:0=58`.
  - Frontend: `next typegen`; `tsc` exit 0; lint exit 0; build pass.
  - Headless Chrome (scratchpad `browser-check.mjs`, extended with 4 new checks and with the old demo-link check rewritten, since seeded references are now live), against production builds on ports 3000 and 3001:
    - Run 1: 18/18. Its screenshot showed the date-order error staying after a corrected date, so errors now clear on change and a check was added.
    - Run 2 (final build): **18/18**, no server error lines.
    - Screenshots reviewed by eye.
  - Processes: servers stopped by the ports' owning processes (last: 3000 → 19408, 3001 → 22808).
- **Failed attempts:**
  1. Prettier reformatted the whole of `app-shell.tsx` (the frontend does not use Prettier); restored and edited by hand.
  2. A shell `node -e` script failed on an apostrophe before running; nothing was written, and it was redone from scratchpad files `docs-batch1.cjs` and `claude-batch1.cjs`.
  3. An earlier `node -e` edit of `test/parties.e2e-spec.ts` did not match (CRLF file) and was redone with exact edits.
- **History archived (§15 rule 7):** this file had reached about 101,600 characters.
  - Moved LOG-20261120-1246-backend-roadmap, LOG-20261120-1300-approved-plan-review and LOG-20261120-1309-phase2-prep-audit (3 entries, 11,924 characters) verbatim to the end of `docs/activity-log.md` Part C, after checking them against `git show HEAD:CLAUDE.md`.
  - Updated the §13 summary (pointer and a "2026-11-20 (morning)" bullet). The file is now about 90,000 characters before this entry.
- **Remaining decisions (repository owner):** the credit rule; the permission matrix; on-hold and closed customers; archiving with open bookings or quotations; re-converting quotations whose booking was cancelled (schema); booking edits; whether the standalone-booking page belongs in Phase 2; stale-update handling for quotations; the four 2026-11-04 Phase 1 decisions; the accountant's tax-default review. Operator decision: whether to commit a browser-check tool.
- Database/schema changes: none to the schema or migrations. The development database gained the seeded rows above and the browser checks' fictional records; the test database was rewritten by the e2e run.
- Dependency changes: none.
- Commit: **not committed** · Pushed: **no**.
- Working-tree status after: on `feature/quotations-phase2` at `071041a`, with the files above modified or created and nothing staged.

### LOG-20261120-1514-credit-approval — Credit-approval step: Sales book over the limit, Finance or Management approve (not committed)
- Time: 2026-11-20, from 15:14:02 (start) to 15:27:19 +03:00 (this entry written) (Africa/Nairobi) — source: PowerShell `Get-Date`.
- Contributor/session: same session; operator not confirmed / Claude Code (Opus 5.5).
- **Instruction received** (sent twice): "Have Claude Code implement this permission adjustment, add tests for Sales creating a booking and Finance/Management approving it, and update the activity log and documentation. No Phase 3 work, schema changes, commits or pushes unless separately authorized."
- **Interpretation:**
  - "This permission adjustment" is not described in this session, `CLAUDE.md` or the docs.
  - A question offering two readings ("approval step on the booking" or "grant `quotations.manage` to Finance and Management") was **declined**, and the instruction was repeated unchanged.
  - The approval-step reading was implemented, because it matches "Sales creating a booking and Finance/Management approving it".
  - Who decided it (repository owner or operator) was not stated. **The repository owner's approval is not confirmed.**
- **Starting state:** branch `feature/quotations-phase2` = `origin/feature/quotations-phase2` = `071041a` (after `git fetch origin --prune`); 24 uncommitted paths from LOG-20261120-1436 and LOG-20261120-1501 kept.
- **Behaviour implemented:**
  - **Request:** over the credit limit, the warning now offers `request_approval` to anyone who can manage bookings.
    - The booking is created `pending` and **awaiting credit approval**.
    - No `CreditCheck` is written yet. The request, figures and reason go to `AuditLog` (`credit_approval_requested`).
  - **Decision:** `POST /api/bookings/:reference/credit-approval` `{ decision: approve | reject, reason }`.
    - Needs `credit.override` + `quotations.view`, **not** `quotations.manage` (this is the permission adjustment).
    - `approve` writes a `proceed` CreditCheck: decider, time, reason, exposure recalculated now, the value as requested.
    - `reject` writes `blocked` and cancels the booking ("Credit approval rejected: <reason>").
    - Both audited (`credit_approved` / `credit_rejected`). The booking row is locked; a decision is final (409 afterwards).
  - **Confirmation:** refused (409) while awaiting approval.
  - **Views:** booking responses carry `creditApproval` (state, requester, time, reason; money figures only with `parties.billing.view`). `GET /api/bookings?creditApproval=awaiting` lists the waiting ones.
  - **Unchanged:** the credit rule (outstanding + value against the limit); Admin and other override holders can still proceed directly; "stop" still records `blocked` without a booking.
- **Also fixed:** a standalone booking's `estimatedValue` was passed to the credit check as typed (`"250000"`), unlike every other amount (`"250000.00"`). It is now normalized to two decimals. A new e2e test exposed it.
- **Not changed:** schema and migrations, role permissions and seed data (no new permission codes), dependencies, Phase 3.
- **Derived state, no schema change:** "awaiting" = a `credit_approval_requested` audit entry exists and the booking has no `CreditCheck` yet. A dedicated column would be cleaner, but it is a schema change and was not authorized.
- **Files:**
  - Backend: `src/credit/credit.service.ts` (`request_approval`, `RecordedOutcome`, reusable `currentFigures`); `src/bookings/booking-rules.ts` + spec (`creditApprovalState`, confirm block, 4 unit tests); `src/bookings/bookings.dto.ts` (`request_approval`, `CreditApprovalDto`, `creditApproval` filter); `src/bookings/bookings.service.ts` (request record, `decideCreditApproval`, `approvals` helper, list filter, view, `estimatedValue` normalization); `src/bookings/bookings.controller.ts` (new endpoint); `test/quotations.e2e-spec.ts` (7 e2e tests).
  - Frontend: `lib/live-quotations.ts` (types, `creditApprovalMeta`, list filter); `components/quotations/live-quotation-actions.tsx` ("Book and request approval"); `components/quotations/booking-detail.tsx` (credit-approval card with Approve and Reject; no Confirm while awaiting; header badge); `components/quotations/live-lists.tsx` (badge; "Show only bookings awaiting credit approval"); `app/bookings/[reference]/page.tsx` (`canApprove`).
  - Docs: `Frontend/frontend/docs/api-contracts.md`, `docs/backend-implementation-plan.md`, `docs/IMPLEMENTATION_ROADMAP.md`, this file (§5, §9 new row, §11, §12 item 19, §14), `docs/activity-log.md`.
- **Tests added for the requested scenarios** (`test/quotations.e2e-spec.ts`, "credit approval: sales books, finance or management approve"):
  1. Sales creates an over-limit booking with `request_approval` → pending and awaiting, figures and requester shown, no `CreditCheck`, request audited.
  2. Confirmation refused until approved; approval refused for Sales (403), Operations (403) and signed-out callers (401).
  3. **Finance approves** → `proceed` CreditCheck by Finance, audited; Sales then confirms; a second decision → 409.
  4. **Management rejects** → `blocked` CreditCheck by Management; booking cancelled; quotation shows the cancelled booking; confirm → 409.
  5. Reason required (400); a booking that never asked → 409; unknown booking → 404.
  6. Standalone request with `estimatedValue`; the awaiting filter; Operations sees the state without figures.
  7. Admin still proceeds directly, with no approval state.
- **Checks run (actual results):**
  - Backend: `tsc` exit 0; lint exit 0; `npm test` → 10 files, **112 pass**; `npm run test:e2e` → 6 files, **152 pass**. The first e2e run had 1 failure (the `estimatedValue` normalization above); it passed after the fix. `npm run build` pass. Prettier: only the three files flagged before.
  - Frontend: `tsc` exit 0; lint exit 0; build pass.
  - Headless Chrome (scratchpad `browser-check.mjs`, plus 3 approval checks) against production builds on the development database → **21/21**, no server error lines. Screenshot of the approver's view reviewed.
  - Servers stopped (3000 → 24008, 3001 → 9408). The development database gained fictional records from the checks (an "Approval Browser Ltd …" customer, quotations, bookings, credit checks).
- **Failed attempts:** one inline `node` heredoc failed on shell quoting before running; nothing was written. The scripts were then run from scratchpad files (`approval-svc.cjs`, `approval-ctl.cjs`, `approval-e2e.cjs`, `approval-fe-*.cjs`, `approval-docs.cjs`, `approval-claude.cjs`).
- **History archived (§15 rule 7):** LOG-20261120-1315-phase2-start, LOG-20261120-1343-phase2-backend and LOG-20261120-1412-phase2-done were moved verbatim to `docs/activity-log.md` Part C, after checking them against `git show HEAD:CLAUDE.md`. The §13 summary was updated.
- **Open:**
  - The repository owner should confirm this approval design, the credit rule and the permission matrix.
  - The other owner decisions in §14.
  - Commit and push (not authorized); the PR.
- Database/schema changes: none · Dependency changes: none · Commit: **not committed** · Pushed: **no**.
- Working-tree status after: on `feature/quotations-phase2` at `071041a`; batch 1 and this work uncommitted; nothing staged.

### LOG-20261120-1543-phase2-complete — Checkpoint pushed; Phase 2 implementation completed; questions added as §17
- Time: 2026-11-20, from about 15:30 (start) to 15:43:34 +03:00 (this entry written) (Africa/Nairobi) — source: PowerShell `Get-Date`. The checkpoint commit was pushed at the start.
- Contributor/session: same session; operator not confirmed / Claude Code (Opus 5.5).
- **Instruction received:** "commit and push to the feature branch. also make sure phase 2 is completely complete. if you have any questions you need me to answer write them at the bottom of claude.md". This authorizes committing and pushing to `feature/quotations-phase2` (not `main`, not a PR, not a merge).
- **Checkpoint:**
  - After `git fetch origin --prune`, the branch was level with its remote (0/0).
  - Committed the verified work of LOG-20261120-1436, -1501 and -1514 (32 files) as **`7112b59`** ("feat(quotations): Phase 2 fixes, demo quotations and credit approval step"), from a message file in the scratchpad.
  - `git push origin feature/quotations-phase2` → `071041a..7112b59`. `git ls-remote` = `git rev-parse HEAD` = `7112b59…`; working tree clean afterwards.
- **What "completely complete" covered** (everything that needs no owner decision):
  1. **New booking page** `/bookings/new`, for standalone bookings, the approved "standalone creation". It covers customer, agent, mode, direction, route, cargo, carrier, carrier booking number, planned dates and estimated value. Client checks match the API. Over the limit, it uses the same choices as conversion (proceed, request approval, or stop).
     - The warning panel was moved into the shared `components/quotations/credit-warning-panel.tsx`, used by both forms.
     - A "New booking" button on `/bookings` for `quotations.manage` holders.
     - New files: `app/bookings/new/page.tsx`, `components/quotations/new-booking-form.tsx`. Edited: `app/bookings/page.tsx`, `components/quotations/live-quotation-actions.tsx`.
  2. **The e2e cases the audit listed as missing**, 6 new tests in `test/quotations.e2e-spec.ts`:
     - moving a quotation to an archived customer (409) and clearing its agent;
     - an inactive charge type (400), and an active one's tax category used;
     - search by reference and the agent filter;
     - a standalone booking with an agent lacking the agent role (400);
     - an unknown booking (404);
     - two approvers deciding at once, giving exactly one 200, one 409 and one `CreditCheck`.
- **Checks run (actual results):**
  - Backend: `tsc` exit 0; lint exit 0; `npm test` → 10 files, 112 pass; `npm run test:e2e` → 6 files, **158 pass** (70 s); build pass. Prettier: only the three files flagged before this session.
  - Frontend: `next typegen`; `tsc` exit 0; lint exit 0 (one unused import removed after the refactor); build pass, including `/bookings/new`.
  - Headless Chrome (scratchpad `browser-check.mjs`, plus the New booking check) → **22/22**, no server error lines. Servers stopped (3000 → 18248, 3001 → 15692). The development database gained more fictional records.
- **Docs:**
  - `Frontend/frontend/docs/api-contracts.md`: `POST /api/bookings` is now used by a page.
  - `docs/backend-implementation-plan.md`: as-built note.
  - `docs/IMPLEMENTATION_ROADMAP.md`: Phase 2 completion status.
  - This file: §5, §11, §12 (item 17 resolved; item 22 now points to §17), §14, this entry, and **new §17 "Questions for the operator and the repository owner"** at the bottom, as instructed.
- **Phase 2 status:** implementation complete and verified. **Not closed:** the PR is not opened (no `gh`) and not merged, and the owner decisions in §17 are unanswered. Some answers (re-conversion, booking edits, permissions) would need further work.
- **Commit:** this entry and the changes above are committed and pushed in a second commit after this entry; the session reply reports its hash.
- Database/schema changes: none · Dependency changes: none · Phase 3: not started.
- History archived (§15 rule 7): this file had reached 104,339 characters, so LOG-20261120-1417-phase2-commit to LOG-20261120-1436-phase2-audit (5 entries) were moved verbatim to `docs/activity-log.md` Part C, after checking them against `git show HEAD:CLAUDE.md`.

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
  - **Credit-approval step (2026-11-20, LOG-20261120-1514-credit-approval): done and verified (112 unit, 152 end-to-end, 21/21 browser) but NOT committed.** Sales book over the limit and request approval; Finance or Management approve or reject. Interpretation of the operator's instruction; the owner should confirm it.
  - **Remediation batch 1 (2026-11-20, LOG-20261120-1501-phase2-batch1): done and verified (108 unit, 145 end-to-end, 18/18 browser) but NOT committed.** It fixed the issue-date bug, the open-quotation count, the cancelled-booking display, the badge on demo fallback pages and the outdated customer page with its link; it added carrier details to the convert form and fictional quotations and bookings to the seed.
  - Live pages: sign-in, Customers, Settings › Numbering, Quotations (list, detail, new, edit) and Bookings (list, detail). All other pages still use fictional demo data in the browser session.
- **Pull request:** not opened yet (`gh` is not installed). To be opened from `feature/quotations-phase2` into `main`: https://github.com/karechel/freight-management/compare/main...feature/quotations-phase2?expand=1. Do not merge without the repository owner. See §17 question 1.
- **Phase 2 status (2026-11-20, LOG-20261120-1543-phase2-complete):** implementation complete and verified (112 unit, 158 end-to-end, 22/22 browser), committed and pushed. It closes once the PR is opened, the owner answers §17 and the PR is merged.
- **Phase 3 (shipments and tracking): not started.** It needs the operator's explicit approval, after Phase 2 is merged.
- **Waiting for the repository owner (Phase 2):**
  - The **credit rule** decided by the operator on 2026-11-20 and not yet approved by the owner: outstanding issued-invoice balance + booking value (quotation total, or the estimated value of a standalone booking) against the credit limit; customers without a limit are not checked.
  - The **permission matrix:** only admin holds both `quotations.manage` and `credit.override`. Sales can create bookings but cannot override; finance and management can override but cannot create bookings. No permission data was changed.
  - The **credit-approval step** (LOG-20261120-1514-credit-approval, not committed), added at the operator's instruction: Sales book over the limit and request approval; Finance or Management (`credit.override`) approve or reject. Its design is Claude Code's reading of an instruction that did not spell it out, so the owner should confirm it.
  - The four 2026-11-04 Phase 1 decisions (§9).
- **Known Phase 2 gaps** (§12): none that need no decision. Remaining items wait for answers in §17: re-converting a quotation after its booking was cancelled (item 20), booking edits (item 21), committing the browser-check tool (item 22).
- **This machine (collaborator's clone):** set up for backend work on 2026-11-20:
  - Node 24.20.0; `npm ci` (backend); the `.env` keys.
  - Development database migrated (marker `9e752599…`) and seeded; it also holds fictional records created by the browser checks.
  - The `*_test` database exists.
  - `gh` (GitHub CLI) is **not installed**.
- **Other open decisions:** the KRA PIN format (later); Phase 4 scope; keep or remove the `deploy` script; Prisma RC vs stable and the unused `@prisma/client` 7; `helmet` and a shared rate limiter before launch; an accountant's review of the seeded tax defaults (and of the line tax-category default added in Phase 2); KRA iCMS access; review of the unapproved roadmap proposal `docs/BACKEND_IMPLEMENTATION_ROADMAP.md`.
- **Housekeeping:** on 2026-11-20 the oldest §13 entries were moved to `docs/activity-log.md` to stay under the §15 rule 7 threshold: LOG-20261120-1246 to -1309 (by LOG-20261120-1501-phase2-batch1), then LOG-20261120-1315 to -1412 (by LOG-20261120-1514-credit-approval).
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

---

## 17. Questions for the operator and the repository owner

Added 2026-11-20 (LOG-20261120-1543-phase2-complete) on the operator's instruction: "if you have any questions you need me to answer write them at the bottom of claude.md".

**How to answer:** write the answer under each question, or tell Claude Code in a session. Claude Code then records it in §9 (decisions) and §13, and leaves the question here marked "Answered (date, by whom)".

Phase 2 is implemented, verified and pushed on `feature/quotations-phase2`. Questions 1–9 decide whether it can close; the others can wait.

### Needed to close Phase 2

1. **Pull request.** The GitHub CLI is not installed on this machine, so the PR could not be opened here.
   - Will a contributor open it in the browser?
     - Link: https://github.com/karechel/freight-management/compare/main...feature/quotations-phase2?expand=1
     - Title: "Phase 2: Quotations, Bookings and Credit Controls"
     - The description drafted on 2026-11-20 should mention the later additions: batch 1, credit approval, the New booking page.
   - Or may Claude Code install and use `gh`, after you sign in with `gh auth login`?
   - *Answer:*
2. **Credit rule.** Decided by the operator on 2026-11-20: the outstanding issued-invoice balance plus the booking's value (the quotation total, or the estimated value of a standalone booking) is checked against the credit limit; customers without a limit are not checked.
   - Does the repository owner approve this rule?
   - Or should the exposure also include other open (pending or confirmed) bookings?
   - *Answer:*
3. **Credit-approval step** (LOG-20261120-1514-credit-approval).
   - Your instruction "implement this permission adjustment… Sales creating a booking and Finance/Management approving it" did not say what the adjustment was. Claude Code built: Sales book over the limit and request approval; Finance, Management or Admin approve (the booking can then be confirmed) or reject (the booking is cancelled).
   - Is that what you meant? Or did you mean the simpler change: give Finance and Management `quotations.manage`, so they can create and override bookings themselves?
   - *Answer:*
4. **Permission matrix** (seeded data, unchanged).
   - Today Admin holds both `quotations.manage` and `credit.override`. Sales can create bookings but not override. Finance and Management can override (and now approve) but cannot create or edit quotations or bookings. Operations can only view quotations and bookings.
   - Should any of this change?
   - *Answer:*
5. **Customers on hold or closed.** They can still receive new quotations and bookings; only archived customers are refused.
   - Should `on_hold` and/or `closed` block new work, warn, or be allowed?
   - *Answer:*
6. **Archiving a customer with open work.** A customer can be archived while they have pending or confirmed bookings, or open quotations; the Phase 1 rule checks only shipments not yet delivered.
   - Should archiving be refused in those cases too?
   - *Answer:*
7. **Cancelled bookings.** A quotation can have only one booking, so a quotation whose booking was cancelled (or rejected at credit approval) can never be converted again; staff must duplicate it.
   - Is that acceptable?
   - Or should re-conversion be allowed? That needs a schema change and a reviewed migration.
   - *Answer:*
8. **Booking edits.** The approved plan lists no booking edit. Carrier, carrier booking number and planned dates can only be given when a booking is created.
   - Should bookings be editable while pending? If so, which fields, and by whom?
   - *Answer:*
9. **Two people editing one quotation.** The last save wins, with every change in the audit log. This is the rule decided for customers on 2026-11-04.
   - Keep it for quotations?
   - Or reject outdated edits (409, "someone else changed this")?
   - *Answer:*

### Earlier decisions still open

10. **The four Phase 1 decisions of 2026-11-04** (§9), made in a session whose operator was not confirmed:
    - (a) only management and admin change a customer's account status;
    - (b) a customer cannot be archived while they have an undelivered shipment;
    - (c) the last save wins when two people edit a customer;
    - (d) the KRA PIN has no fixed format for now.

    Does the repository owner confirm them?
    - *Answer:*
11. **Tax defaults.** The seeded charge types' tax categories and rates, and the Phase 2 default for quotation lines (the charge type's category, otherwise `standard`), are guesses.
    - Has the company's accountant reviewed them?
    - Is half-away-from-zero rounding per line correct?
    - *Answer:*
12. **Browser checks in the repository.** The headless-Chrome checks (22 scenarios) live only in a temporary scratchpad script, and the frontend has no test runner.
    - Should Claude Code commit them as a development tool, using the installed Chrome with no new dependency?
    - *Answer:*

### Housekeeping

13. **Who ran these sessions?** The 2026-11-20 entries say "operator not confirmed": the Claude Code account differs from this clone's Git identity (Sean Macharia).
    - Who should the log name?
    - *Answer:*
14. **Roadmap proposal.** `docs/BACKEND_IMPLEMENTATION_ROADMAP.md` (Phases 0–18) is committed but not approved; the approved plan stays authoritative.
    - Keep it as a reference, revise it, or remove it?
    - *Answer:*
15. **Next phase.** Phase 3 (shipments and tracking) starts only with explicit approval, after Phase 2 is merged.
    - Should it follow straight after the merge?
    - *Answer:*
