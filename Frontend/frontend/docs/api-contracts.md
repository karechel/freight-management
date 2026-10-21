# Frontend ↔ backend API contracts (proposed)

Status: **proposal for future backend work.** None of the endpoints below exist yet.
The only backend endpoint the frontend calls today is `GET /health`.

The frontend reads data only through `lib/data/index.ts`. Each function currently
returns demo data from `lib/data/demo-data.ts` tagged `source: 'demo'`, which makes
every page show a "Demonstration data" banner. To connect a real endpoint, replace the
function body with a call through `lib/api/client.ts` (`apiGet`) and return
`source: 'live'`. Response shapes should match the types in `lib/types.ts`.

## Existing (verified in backend source)

| Method | Path | Used by | Notes |
|---|---|---|---|
| GET | `/health` | Top-bar API status, System status page | Returns `{ status, message }`. No auth. |
| GET | `/` | **Not used** | Returns every `User` row unauthenticated. Security issue, see root `CLAUDE.md` §12. |

## Needed (not implemented)

| Data-access function | Proposed endpoint | Returns (`lib/types.ts`) |
|---|---|---|
| `getShipments()` | `GET /shipments?view=&mode=&q=` | `Shipment[]` |
| `getShipment(ref)` | `GET /shipments/:reference` | `Shipment` (404 if unknown) |
| `getDocuments(ref?)` | `GET /documents?shipment=` | `ShipmentDocument[]` (metadata only) |
| `getQuotations()` | `GET /quotations` | `Quotation[]` |
| `getParties(type?)` | `GET /parties?type=` | `Party[]` |
| `getInvoices(ref?)` | `GET /invoices?shipment=` | `Invoice[]` |
| `getPayments()` | `GET /payments` | `Payment[]` |
| `getExpenses(ref?)` | `GET /expenses?shipment=` | `Expense[]` |
| `getRecentActivity()` | `GET /activity?limit=` | `ActivityItem[]` |
| `getTasks()` | `GET /tasks?status=&assignee=&due_before=` | `Task[]` (see Notifications and tasks below) |
| `getStaff()` | `GET /users?assignable=true` | `{ id, name }[]` (the UI uses names today) |
| `getShipmentFormOptions()` | Composed from `/parties` and `/users` | Customers, agents, staff, carrier suggestions |
| `getParty(id)` | `GET /parties/:id` | `Party` with `billing` or `routes` |
| `getQuotationFormOptions()` | Composed from `/parties` | Customers, agents, default terms |

## Before real operational data is handled

1. Authentication and role-based authorisation on every endpoint (none exist).
2. Remove or protect `GET /`.
3. CORS origin and API URL configured per environment (CORS is hard-coded to `http://localhost:3000`).
4. Private, access-controlled file storage for documents (never `public/`).
5. Write operations with server-side validation (see below). Until they exist, the UI's create/edit forms save to an in-browser session store only and say so.
6. KRA iCMS and M-Pesa only after real, authorised access. Until then the UI labels both "pending".

## Write operations needed for shipments and delays (phase 1 UI)

The shipment and delay forms exist in the UI but have **no backend**. Saving
updates `lib/data/session-store.tsx`, an in-memory React store seeded from
`lib/data`. It survives client-side navigation, and is lost on reload or in
another tab. Nothing is written to the backend, `localStorage` or any other
storage. To connect the API, replace the store mutations with calls to the
endpoints below and re-read data afterwards.

Validation rules are in `lib/shipment-form.ts`, `lib/delay-form.ts` and
`validateMilestoneUpdate` in `lib/shipment-changes.ts`. The server must enforce
the same rules, because client-side validation can be bypassed. All date-times
are ISO 8601 with offset. The UI enters them in Africa/Nairobi time (+03:00).

| Method | Path | Body | Returns | Notes |
|---|---|---|---|---|
| POST | `/shipments` | `ShipmentInput` (`lib/shipment-form.ts`) | `201` `Shipment` | Server assigns `reference` (`FMS-<MODE>-<YYMM>-<NNNN>`, unique, concurrency-safe sequence), default milestones, `createdAt`, the first history event, and the author from the signed-in user. |
| PATCH | `/shipments/:reference` | Partial `ShipmentInput` + optional `note` | `200` `Shipment` | Server records history events (`ShipmentEvent`) for status, estimated and actual date changes, and completes matching milestones when actual dates are set. `409` on a stale update (send `updatedAt` or an ETag). |
| PATCH | `/shipments/:reference/milestones/:index` | `{ state, at?, location? }` | `200` `Shipment` | Chronology rules as in `validateMilestoneUpdate`. Prefer stable milestone IDs over indexes in the real API. |
| POST | `/shipments/:reference/delays` | `DelayInput` (`lib/delay-form.ts`) | `201` `ShipmentDelay` | Server sets `id`, the first action entry and the author. `revisedExpectedAt` must be later than `originalExpectedAt`. |
| PATCH | `/shipments/:reference/delays/:id` | Partial `DelayInput` | `200` `ShipmentDelay` | Server appends automatic `DelayAction` entries describing each change. |
| POST | `/shipments/:reference/delays/:id/actions` | `{ at, note }` | `201` `DelayAction` | Manual "action taken" entries. |
| GET | `/shipments/:reference/events` | — | `ShipmentEvent[]` | Full change history (the demo data has none before the session). Could also be embedded in `GET /shipments/:reference`. |

Validation errors should return `422` with `{ errors: { [field]: message } }`,
using the field names of the form types, so the UI can show each message next to
its field and in the error summary.

Derived values the UI calculates (the API may return them instead):

- **Current ETA** (`currentEta` in `lib/metrics.ts`): the revised date of the most recently identified delay with `affectsEta`, otherwise the planned `eta`. The planned ETA is never overwritten.
- **Delay duration**: `revisedExpectedAt − originalExpectedAt`; unknown while no revised date is recorded.
- **Views** (`?view=delayed|attention|arriving|customs|active`): see `matchesView`.

Still required before these endpoints are used with real data:

- **Authentication and roles.** The UI has no permission checks; anyone can create, edit, change status and record delays. The intended roles (operations, documentation, management) are not enforced anywhere. Changes are attributed to "You (demo session)".
- **Customer notification.** `customerNotification` only records what staff did outside the system. Sending delay notices needs an email/SMS or customer-portal integration (not built) and an endpoint such as `POST /shipments/:reference/delays/:id/notifications` that returns delivery status. The UI must not show "sent" without that status.
- **Customs.** New shipments start with customs status "Not started". Customs fields are not editable in the UI yet.
- **Other pages.** The Customs page still reads the static demo data, so shipments created in the session do not appear there yet. (Since phase 2, the Customers & agents pages read shipments and quotations from the session store.)

## Quotations (phase 2 UI)

Same session-store approach as above. Rules: `lib/quotation-form.ts`,
`lib/quotation-changes.ts`, `lib/quotations.ts`, `lib/money.ts`.

| Method | Path | Body | Returns | Notes |
|---|---|---|---|---|
| GET | `/quotations?status=&customer=&agent=` | — | `Quotation[]` | Replaces `getQuotations()`. |
| GET | `/quotations/:reference` | — | `Quotation` | 404 if unknown. |
| POST | `/quotations` | `QuotationInput` + optional `duplicatedFrom` | `201` `Quotation` | Server assigns `reference` (`QT-<YYMM>-<NNNN>`, concurrency-safe), status `draft`, history event, author. |
| PATCH | `/quotations/:reference` | Partial `QuotationInput` | `200` `Quotation` | Drafts only (`409` otherwise). A sent quotation is never edited; it is duplicated. |
| POST | `/quotations/:reference/status` | `{ status, sentAt?, sentTo?, decidedAt?, note? }` | `200` `Quotation` | Allowed transitions in `quotationTransitions`. Dates not in the future, not before issue; decision not before sending. |
| POST | `/quotations/:reference/booking` | `{ shipmentReference }` or a `ShipmentInput` to create one | `200` `{ quotation, shipment }` | Accepted only. Sets status `booked` and links the shipment. Creating the shipment and booking should be one transaction. |
| GET | `/quotations/:reference/pdf` | — | `application/pdf` | Optional. The UI prints with the browser today. A server PDF needs company letterhead and details, which are not configured anywhere. |

Money:

- Amounts are integers in minor units (`unitPriceMinor`).
- Quantities have up to 3 decimals, tax rates up to 2.
- Each line is net = round(qty × unit price) and tax = round(net × rate), both to the nearest cent, half away from zero (`lineAmounts`).
- The server must compute totals itself and not trust client totals.
- Currencies are KES or USD; no exchange-rate conversion is done.

Expiry: draft or sent quotations past `validUntil` count as expired
(`effectiveQuotationStatus`). The demo calculates this as at the fixed demo
date. A real API should use the server clock and may store the transition.

**Sending (not built).** There is no email or customer-portal integration.
"Sent" only records what staff did outside the system (`sentAt`, `sentTo`). A
real send needs `POST /quotations/:reference/send` with
`{ to, cc?, message? }`, returning a delivery record such as
`{ id, status: 'queued' | 'sent' | 'failed', providerMessageId? }`. It also needs
an email provider, a sender domain and the PDF attachment above. The UI must not
show "sent" from that endpoint until the status confirms it.

## Customer billing and service history (phase 2 UI)

| Method | Path | Returns | Notes |
|---|---|---|---|
| GET | `/parties/:id` | `Party` incl. `billing` (customers) or `routes` (agents) | Replaces `getParty()`. |
| PATCH | `/parties/:id/billing` | `BillingProfile` | Not built in the UI (billing is read-only). Needs finance-role permission. Validate the KRA PIN format server-side if it is stored. |
| GET | `/parties/:id/account` | `{ invoicedKes, paidKes, outstandingKes, overdueKes, overdueCount, creditLimitKes?, availableCreditKes? }` | The UI calculates an *indicative* version from invoices (`accountSummary`). The authoritative figure must come from the finance ledger, including credit notes, unapplied payments and multi-currency invoices. None of these exist in the demo. |
| GET | `/parties/:id/history?from=&to=&kind=` | `HistoryEntry[]` (`lib/customer-history.ts`) | Server-side, paginated version of `buildCustomerHistory`. It should come from an audit/event log rather than be rebuilt from current records, so past status changes are not lost. |

Demo data gaps that the real data must fill:

- **Billing profile:** KRA PIN, phone and credit limit are not recorded for any customer. Addresses are placeholders.
- **Payments:** payment `p-04` refers to invoice `INV-2609-0081`, which is not in the demo invoices.
- **Linking:** invoices and payments are matched to customers by name; the real API should use customer IDs.

## Agent routes and relationships (phase 2 UI)

| Method | Path | Returns | Notes |
|---|---|---|---|
| GET | `/parties/:id/routes` | `AgentRoute[]` | Demo routes are derived from the jobs each agent appears on. They are not agreements or rate cards. |
| POST/PATCH/DELETE | `/parties/:id/routes[/:routeId]` | `AgentRoute` | Not built in the UI. |
| GET | `/shipments?agent=&customer=` | `Shipment[]` | The list page already filters on `?agent=` (name) and `?customer=` (id). The real API should filter by agent ID. |
| GET | `/invoices?agent=:id` | `Invoice[]` | Customer invoices on jobs the agent handled. **Agent charges and payables** (what the forwarder owes the agent) are not modelled at all. They need a payables/supplier-invoice API. |

`Shipment.agentRouteId` and `Quotation.agentName` are new optional fields. Both
are validated against the selected agent (`validateShipmentForm`).

## Document uploads and storage (phase 3 UI)

**What the UI does today (demo only):**

- The user selects up to 10 files per upload on `/documents/upload` and picks a shipment (the customer comes from the shipment) and a document type.
- Each file is checked in the browser (`lib/document-upload.ts`). It must be PDF, JPEG, PNG, DOC/DOCX or XLS/XLSX, and not empty. It may be at most 10 MB, with a session total of 100 MB. The extension, the browser-reported MIME type and the leading bytes must all agree.
- Valid files are copied into the tab's memory as `Blob`s in `lib/data/session-store.tsx`. Open and Download use temporary `blob:` URLs, which are released after a short delay.
- These URLs exist only in that tab and are not reachable by anyone else. Nothing is uploaded, written to `public/`, sent to the backend or kept after reload.
- Each file becomes a `ShipmentDocument` with status `received` (`attachUploads` in `lib/document-changes.ts`). The first file fulfils an outstanding requirement of the same type (`missing` or `rejected`), so it does not duplicate it.
- Received documents can be verified, or rejected with a reason (`validateReview`, `applyReview`).

Browser checks are only a usability aid. **The server must repeat every check.**

**Storage requirements for production:**

1. **Private object storage.** Use a non-public bucket or container, with server-side encryption. Do not use the Next.js `public/` folder or any public URL. Object keys must not be guessable (e.g. `documents/<uuid>`), and the original file name is kept as metadata only.
2. **Access control on every read and write.** Check the user's role (operations, documentation, finance, management) and, for portal users, that the shipment belongs to their customer or agent account.
3. **Short-lived downloads.** Downloads go through an authorised endpoint that streams the file, or returns a signed URL that expires within minutes. Send `Content-Disposition` with a sanitised file name and `X-Content-Type-Options: nosniff`.
4. **Server-side validation.** Check size limits, the format allow-list and the leading bytes. Add malware scanning before a file becomes available, with a `scanning` → `available` or `quarantined` state the UI can show.
5. **Audit log.** Record uploads, downloads, reviews and deletions, with user and time.
6. **Retention and deletion policy.** This needs a business and legal decision (customs records retention). Not decided.

| Method | Path | Body | Returns | Notes |
|---|---|---|---|---|
| GET | `/documents?shipment=&customer=&status=&type=` | — | `ShipmentDocument[]` (metadata only) | Replaces `getDocuments()`. `file` holds name, size, type, upload time and author. It never includes a URL. |
| POST | `/shipments/:reference/documents` | `multipart/form-data`: `type`, `note?`, `files[]` | `201` `ShipmentDocument[]` | Server validates, stores privately and links to the shipment and its customer. It fulfils an open requirement of the same type as `attachUploads` does. `413` too large, `415` unsupported type, `422` validation. Report results per file, so a partial failure is clear. |
| GET | `/documents/:id/file` | — | File stream, or `{ url, expiresAt }` | Authorised. Never cached publicly (`Cache-Control: private, no-store`). |
| POST | `/documents/:id/review` | `{ decision: 'verified' \| 'rejected', reason? }` | `200` `ShipmentDocument` | `reason` required for rejection. Only from `received`. Records reviewer and time. |
| DELETE | `/documents/:id/file` | — | `204` | Not in the UI. Needs permissions and an audit trail; may be forbidden after verification. |
| POST | `/shipments/:reference/documents/requirements` | `{ type }` | `201` `ShipmentDocument` (status `missing`) | Optional. Lets staff list which documents a job needs. The UI has no form for this yet. |

Not built in the UI:

- Removing or replacing a file after it was added. A wrong file can be rejected and the right one uploaded.
- Customer-level documents that are not tied to a shipment.
- File previews inside the app. Files open in a new tab using the browser's own viewer.
- Virus scanning states.

## Expenses and profitability (sidebar restructure UI)

`Expense` gains `category` (`carrier`, `transport`, `handling`, `storage`, `customs`, `agent_fees`, `other`). Cost estimates are a new `CostEstimate { shipmentReference, category, estimatedKes }`. Profit rules are in `lib/profitability.ts`; with a backend they should be computed on the server from the same definitions.

| Method | Path | Body | Returns | Notes |
|---|---|---|---|---|
| GET | `/expenses?shipment=&category=&status=` | — | `Expense[]` | Replaces `getExpenses()`. Finance and management, plus operations for the jobs they handle. |
| POST | `/shipments/:reference/expenses` | `{ category, description, payee, amountKes, incurredAt, status? }` | `201` `Expense` | Replaces `recordExpense` in the session store. Server sets the author and time, starts at `pending_approval` unless the user may approve, and writes an audit entry. |
| POST | `/expenses/:id/approve`, `/expenses/:id/mark-paid` | — | `200` `Expense` | Finance or management only. Not in the UI. |
| GET | `/shipments/:reference/costing` | — | Estimates, expenses, quoted and invoiced totals, profit figures | Replaces `getCostEstimates()` and the client-side calculation. |
| PUT | `/shipments/:reference/cost-estimates` | `CostEstimate[]` | `200` | Not in the UI (estimates are read-only demo data). |

## Reports (sidebar restructure UI)

The reports page computes everything in the browser (`lib/reports.ts`). With real data volumes this should move to `GET /reports/<name>?from=&to=&customer=&status=&mode=` endpoints returning the same aggregates, with access limited by role. CSV downloads are generated in the browser from the figures on screen; scheduled or emailed reports are not built.

## Users, permissions, settings and audit log (sidebar restructure UI)

All three pages are previews. Nothing is enforced or saved.

- Users: `GET/POST /users`, `PATCH /users/:id` (role, status), and sign-in. The intended role matrix is in `lib/access.ts`. Every API route must check the caller's role; the UI only mirrors the result.
- Settings: `GET/PUT /settings` (company details, currencies, numbering, charge categories), administrator only.
- Audit log: `GET /audit-log?record=&user=&from=&to=`, append-only and written by the backend for every create, update, review, approval and permission change. The preview builds its list from the change histories in the session store.

## Notifications and tasks (frontend demo, `/notifications`)

What the UI does now:

- **Notifications** are not stored. `lib/notifications.ts` works them out in the browser from the current records, against the fixed demo date. Each has a stable id.
- **Rules:**
  - Arrivals due within 7 days.
  - Open or monitored delays on active shipments.
  - Missing or rejected documents on active shipments. These are high priority once the cargo is at destination.
  - Received or verified documents whose `expiresAt` is within 14 days or already passed.
  - Quotations sent and awaiting a decision (medium within 3 days of expiry), accepted but not booked, or still a draft.
  - Unpaid invoices past their due date (high after 30 days).
- **Read state:** "Read" markers are kept in the tab only.
- **Tasks** are created, edited, reassigned, re-dated and re-prioritised in the session store (`lib/task-changes.ts`). They have statuses open, in progress, done and cancelled. Each change adds an automatic follow-up note, and users can add their own notes. A task can link to a shipment, quotation, document or invoice.
- **Nothing is sent** (no email, SMS or push), and assigning a task notifies nobody.

New fields: `ShipmentDocument.expiresAt` (optional; entered on the upload page), and on `Task`: `details`, `status`, `quotationReference`, `documentId`, `invoiceNumber`, `notes[]`, `createdAt`, `createdBy`, `completedAt`, `updatedAt`.

Backend functionality required:

| Method | Path | Body | Returns | Notes |
|---|---|---|---|---|
| GET | `/notifications?unread=&kind=` | — | `AppNotification[]` for the signed-in user | Generated on the server by a scheduled job using the same rules, filtered by role (finance sees invoice alerts, operations sees shipment alerts). Stored, so read state and history persist. |
| POST | `/notifications/read` | `{ ids: string[], read: boolean }` | `204` | Per user. |
| GET/PUT | `/notification-preferences` | channels per kind (in-app, email, SMS), quiet hours | | Needs the user accounts from the users and permissions work. |
| — | Delivery | — | — | Email/SMS provider integration, retry and an audit of what was sent to whom. Customer-facing messages (e.g. delay notices) need consent and templates. Not built. |
| GET | `/tasks?status=&assignee=&priority=&due_before=&shipment=&quotation=&document=&invoice=` | — | `Task[]` | Replaces `getTasks()`. |
| POST | `/tasks` | `TaskInput` | `201` `Task` | Server sets the id, author and time, checks that the assignee is an active staff account, and checks that linked records exist and are visible to the user. |
| PATCH | `/tasks/:id` | partial `TaskInput` | `200` `Task` | Records an automatic note per change, as `applyTaskUpdate` does. |
| POST | `/tasks/:id/notes` | `{ note }` | `201` `TaskNote` | Max 300 characters. |
| — | Reminders | — | — | Scheduler for due and overdue reminders to the assignee; escalation rules. Not built. |

Every task and notification-read change should also go to the audit log.
