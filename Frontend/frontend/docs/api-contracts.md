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
| `getTasks()` | `GET /tasks?status=open` | `Task[]` |

## Before real operational data is handled

1. Authentication and role-based authorisation on every endpoint (none exist).
2. Remove or protect `GET /`.
3. CORS origin and API URL configured per environment (CORS is hard-coded to `http://localhost:3000`).
4. Private, access-controlled file storage for documents (never `public/`).
5. Write operations (create/update shipments, quotations, invoices) with server-side validation. The UI deliberately has no create/save buttons until these exist.
6. KRA iCMS and M-Pesa only after real, authorised access. Until then the UI labels both "pending".
