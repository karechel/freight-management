# Browser checks (headless Chrome)

`scripts/browser-checks.mjs` drives the installed Google Chrome through the Chrome DevTools protocol and checks the live Phase 2 pages from end to end: sign-in, quotations, bookings, credit warnings and approvals, customer status and archiving rules, and the tax settings. It has **no dependencies**: it uses Node's built-in `fetch` and `WebSocket` (Node 24.20.0) and the Chrome already on the machine. It is a development tool, not a test framework, and it is not run by `npm test`.

Approved by the repository owner on 2026-11-26 (`CLAUDE.md` §17 question 12).

## What it needs

1. Node 24.20.0 and Google Chrome.
2. A backend `.env` in `Backend/backend` with `ADMIN_EMAIL`, `ADMIN_PASSWORD` and `DEMO_USER_PASSWORD`. The script reads them and never prints them.
3. A database that has been migrated and seeded with `npm run db:seed` and `npm run db:seed:demo` (the fictional demo staff, customers, carriers and agents are used by name).
4. Both apps running, ideally as production builds:
   - backend: `npm run build`, then `npm run start:prod` in `Backend/backend` (port 3001);
   - frontend: `npm run build`, then `npm run start` in `Frontend/frontend` (port 3000).

## Running it

From `Frontend/frontend`:

```
npm run check:browser
# or, choosing where screenshots go:
node scripts/browser-checks.mjs C:\path\to\output
```

Each check prints `PASS` or `FAIL`, followed by a total and the screenshot folder (by default `freight-browser-checks` in the system temporary folder). The process exits with code 1 if any check fails. Read the screenshots: a check can pass while a page looks wrong.

Optional environment variables:

| Variable | Default | Use |
|---|---|---|
| `CHROME_PATH` | `C:/Program Files/Google/Chrome/Application/chrome.exe` | Chrome elsewhere, or on macOS/Linux |
| `CHROME_DEBUG_PORT` | `9333` | Another free port for DevTools |
| `APP_URL` | `http://localhost:3000` | Frontend address |

## What it covers (26 checks)

- The 22 Phase 2 checks first run on 2026-11-20: sign-in redirect; creating, validating, editing, sending, accepting and converting a quotation; confirming a booking; the credit-limit warning for Sales and the override for Admin; Finance's view-only access; demo and live badges; cancelled bookings; the customer's quotation link; carrier details on conversion; credit approval requested by Sales, approved by Finance and rejected by Management; the New booking page; the not-found page; no sideways scrolling at 390 px.
- 4 checks for the repository owner's 2026-11-26 decisions: an on-hold customer's quotation explains the block, offers no conversion, and the customer is left out of the new quotation and booking forms; archiving is refused and names the open work; Admin changes a tax rate in Settings (and the original value is put back); other roles cannot see or change tax settings.

## Limitations

- **It writes to the database the backend is connected to.** Every run creates fictional customers, quotations, bookings and credit checks; nothing is deleted. Use a development database, never production. The tax check changes one charge type's rate and then restores it; if the run is interrupted between the two, put the value back in Settings › Tax settings.
- Chrome only (headless). No Safari, Firefox or screen-reader coverage.
- It relies on visible text, field ids and button labels, so wording changes in the UI may need matching changes in the script.
- It depends on the fictional seed data (for example "Baobab Crest Traders Ltd", "Indigo Ocean Lines", `b.otieno@freight-demo.example`) and on the seeded permission matrix.
- Checks run in order and share state (for example, the quotation created early on is reused later), so a failure can cause later failures.
- It is not part of CI (there is no CI).
