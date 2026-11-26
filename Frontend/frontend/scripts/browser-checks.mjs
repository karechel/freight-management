// Headless Chrome checks for the live Phase 2 pages, driven through the Chrome DevTools protocol.
// No dependencies: Node's built-in fetch and WebSocket, and the Chrome already installed.
// How to run, what it needs and its limitations: Frontend/frontend/docs/browser-checks.md.
//
//   node scripts/browser-checks.mjs [output folder]
//
// It signs in with ADMIN_EMAIL / ADMIN_PASSWORD and DEMO_USER_PASSWORD from Backend/backend/.env
// (never printed) and CREATES fictional records in the database the backend is connected to.
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const OUT = process.argv[2] ?? join(tmpdir(), 'freight-browser-checks');
const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const DEBUG_PORT = Number(process.env.CHROME_DEBUG_PORT ?? 9333);
mkdirSync(OUT, { recursive: true });
const env = Object.fromEntries(
  readFileSync(`${ROOT}/Backend/backend/.env`, 'utf8')
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);
const ADMIN = { email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD };
const DEMO = env.DEMO_USER_PASSWORD;
const SALES = 'b.otieno@freight-demo.example';
const FINANCE = 'f.mwende@freight-demo.example';
const APP = process.env.APP_URL ?? 'http://localhost:3000';

const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${DEBUG_PORT}`, `--user-data-dir=${OUT}/profile`, '--no-first-run', '--window-size=1280,900', 'about:blank',
]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let targets;
for (let i = 0; i < 40; i += 1) {
  try { targets = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json`)).json(); break; } catch { await sleep(250); }
}
const page = targets.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let nextId = 0;
const pending = new Map();
const events = [];
const problems = [];
ws.addEventListener('message', (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); return; }
  events.push(msg);
  if (msg.method === 'Runtime.exceptionThrown') problems.push(`exception: ${msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text}`);
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') problems.push(`console.error: ${msg.params.args.map((a) => a.value ?? a.description).join(' ')}`);
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = (nextId += 1);
  pending.set(id, (msg) => (msg.error ? reject(new Error(`${method}: ${msg.error.message}`)) : resolve(msg.result)));
  ws.send(JSON.stringify({ id, method, params }));
});
await send('Page.enable'); await send('Runtime.enable');

const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  return r.result.value;
};
const waitFor = async (expression, label, timeout = 15000) => {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (await evaluate(expression).catch(() => false)) return; await sleep(150); }
  throw new Error(`timed out waiting for ${label}`);
};
const nav = async (path) => {
  await send('Page.navigate', { url: `${APP}${path}` });
  await waitFor('document.readyState === "complete"', `load ${path}`);
  await sleep(700); // hydration
};
const text = () => evaluate('document.body.innerText');
const url = () => evaluate('location.pathname + location.search');
const h1 = () => evaluate('document.querySelector("h1")?.innerText ?? ""');
const setField = (id, value) => evaluate(`(() => {
  const el = document.getElementById(${JSON.stringify(id)});
  if (!el) throw new Error('no field ${id}');
  const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)});
  el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
  return true;
})()`);
const selectByLabel = (id, label) => evaluate(`(() => {
  const el = document.getElementById(${JSON.stringify(id)});
  const opt = [...el.options].find((o) => o.text === ${JSON.stringify(label)});
  if (!opt) throw new Error('no option ' + ${JSON.stringify(label)});
  Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(el, opt.value);
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
})()`);
const click = (label) => evaluate(`(() => {
  const el = [...document.querySelectorAll('button, a')].find((b) => b.innerText.trim() === ${JSON.stringify(label)});
  if (!el) throw new Error('no button ' + ${JSON.stringify(label)});
  el.click(); return true;
})()`);
const api = (method, path, body) => evaluate(`fetch(${JSON.stringify(path)}, { method: ${JSON.stringify(method)}, headers: { 'Content-Type': 'application/json' }, body: ${body ? JSON.stringify(JSON.stringify(body)) : 'undefined'} }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }))`);
const signIn = async (email, password) => {
  await nav('/login');
  const r = await api('POST', '/api/auth/login', { email, password });
  if (r.status !== 200) throw new Error(`sign-in failed for ${email}: ${r.status}`);
};
const signOut = () => api('POST', '/api/auth/logout', {});
const shot = async (name, width = 1280) => {
  await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 500 });
  await sleep(400);
  const { data } = await send('Page.captureScreenshot', { captureBeyondViewport: true, format: 'png' });
  writeFileSync(join(OUT, `${name}.png`), Buffer.from(data, 'base64'));
};
const noSideScroll = () => evaluate('document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1');

const results = [];
const step = async (name, fn) => {
  const before = problems.length;
  try {
    await fn();
    const fresh = problems.slice(before);
    results.push(fresh.length ? `FAIL ${name} (${fresh.join(' | ')})` : `PASS ${name}`);
  } catch (error) {
    results.push(`FAIL ${name}: ${error.message}`);
  }
};
const expect = (cond, message) => { if (!cond) throw new Error(message); };

const nairobi = (offsetMinutes = 0) => new Date(Date.now() + 3 * 3600_000 + offsetMinutes * 60_000).toISOString();
const today = nairobi().slice(0, 10);
const inDays = (d) => new Date(Date.now() + 3 * 3600_000 + d * 86_400_000).toISOString().slice(0, 10);
let reference;
let bookingRef;

await step('signed-out visitor is sent to sign-in', async () => {
  await nav('/quotations');
  expect((await url()).startsWith('/login'), `ended on ${await url()}`);
});

await step('sales signs in and sees the live quotation list', async () => {
  await signIn(SALES, DEMO);
  await nav('/quotations');
  expect((await h1()) === 'Quotations & bookings', await h1());
  expect((await text()).includes('Live data'), 'no live badge');
  await shot('01-list-empty');
});

await step('create a quotation through the form', async () => {
  await nav('/quotations/new');
  await selectByLabel('quotation-customerId', 'Baobab Crest Traders Ltd');
  await setField('quotation-mode', 'sea');
  await setField('quotation-direction', 'import');
  await setField('quotation-origin', 'Shanghai');
  await setField('quotation-destination', 'Mombasa');
  await selectByLabel('quotation-agentName', 'Eastgate Forwarding (Shanghai)');
  await setField('quotation-cargoSummary', '1 × 40ft HC, household goods');
  await setField('quotation-issuedAt', today);
  await setField('quotation-validUntil', inDays(30));
  await setField('quotation-lines.0.description', 'Ocean freight');
  await setField('quotation-lines.0.unitPrice', '150000');
  await click('Add line');
  await sleep(200);
  await setField('quotation-lines.1.description', 'Clearing fee');
  await setField('quotation-lines.1.unitPrice', '25000');
  await setField('quotation-lines.1.taxRatePercent', '16');
  await shot('02-new-form');
  await click('Create draft');
  await waitFor('/^\\/quotations\\/QT-/.test(location.pathname)', 'redirect to the new quotation');
  await sleep(800);
  reference = decodeURIComponent((await url()).split('/')[2]);
  const t = await text();
  expect(t.includes('179,000.00'), 'total 179,000.00 not shown');
  expect(t.includes('Draft'), 'not a draft');
  await shot('03-detail-draft');
});

await step('client validation blocks an empty form', async () => {
  await nav('/quotations/new');
  await click('Create draft');
  await sleep(300);
  expect((await text()).includes('Select the customer.'), 'no customer error');
  expect((await url()) === '/quotations/new', 'navigated away');
});

await step('edit the draft', async () => {
  await nav(`/quotations/${reference}/edit`);
  await setField('quotation-cargoSummary', '2 × 20ft GP, household goods');
  await click('Save changes');
  await waitFor(`location.pathname === '/quotations/${reference}'`, 'back on detail');
  await sleep(800);
  expect((await text()).includes('2 × 20ft GP, household goods'), 'edit not shown');
});

await step('record sent, then accepted', async () => {
  await nav(`/quotations/${reference}`);
  await setField('quotation-status-sentAt', nairobi(-10).slice(0, 16));
  await setField('quotation-status-sentTo', 'imports@baobabcrest.example');
  await click('Record status');
  await waitFor('document.body.innerText.includes("recorded manually")', 'sent recorded');
  await sleep(500);
  await setField('quotation-status-status', 'accepted');
  await setField('quotation-status-decidedAt', nairobi(-5).slice(0, 16));
  await click('Record status');
  await waitFor('document.body.innerText.includes("Convert to booking")', 'convert card');
  await shot('04-accepted');
});

await step('convert to a booking and confirm it', async () => {
  await click('Convert to booking');
  await waitFor('/^\\/bookings\\/BKG-/.test(location.pathname)', 'booking page');
  await sleep(800);
  bookingRef = decodeURIComponent((await url()).split('/')[2]);
  expect((await text()).includes(reference), 'quotation link missing');
  await click('Confirm booking');
  await waitFor('document.body.innerText.includes("Confirmed")', 'confirmed');
  await shot('05-booking');
  await nav(`/quotations/${reference}`);
  expect((await text()).includes(bookingRef), 'booking not linked on quotation');
  expect((await text()).includes('Booked'), 'quotation not shown as booked');
});

await step('bookings list shows the booking', async () => {
  await nav('/bookings');
  expect((await text()).includes(bookingRef), 'booking not listed');
  await shot('06-bookings');
});

let limitedQuote;
await step('sales sees the credit warning and can only stop', async () => {
  await signOut();
  await signIn(ADMIN.email, ADMIN.password);
  const customer = await api('POST', '/api/backend/parties', { name: `Browser Credit Ltd ${Date.now()}`, roles: ['customer'], creditLimit: '100000' });
  expect(customer.status === 201, `customer ${customer.status}`);
  const make = async () => {
    const q = await api('POST', '/api/backend/quotations', {
      customerId: customer.body.id, mode: 'air', direction: 'export', origin: 'Nairobi', destination: 'Amsterdam',
      cargoSummary: 'Cut flowers', issueDate: today, validUntil: inDays(14),
      lines: [{ description: 'Air freight', quantity: '1', unitPrice: '150000', taxRate: '0' }],
    });
    const r = q.body.reference;
    await api('POST', `/api/backend/quotations/${r}/status`, { status: 'sent', sentAt: new Date(Date.now() - 600_000).toISOString(), sentTo: 'x@example.com' });
    await api('POST', `/api/backend/quotations/${r}/status`, { status: 'accepted', decidedAt: new Date(Date.now() - 300_000).toISOString() });
    return r;
  };
  limitedQuote = [await make(), await make()];
  await signOut();
  await signIn(SALES, DEMO);
  await nav(`/quotations/${limitedQuote[0]}`);
  await click('Convert to booking');
  await waitFor('document.body.innerText.includes("Over the credit limit")', 'warning');
  const t = await text();
  expect(!t.includes('Proceed past the limit'), 'sales offered proceed');
  expect(t.includes('150,000.00') && t.includes('100,000.00'), 'figures missing');
  await shot('07-credit-warning');
  await click('Stop, do not book');
  await sleep(300);
  expect((await text()).includes('Give a reason'), 'reason not required');
  await setField('credit-decision-reason', 'Over limit; ask finance');
  await click('Stop, do not book');
  await waitFor('document.body.innerText.includes("Not booked")', 'stopped message');
});

await step('admin proceeds past the limit; decision shown on the booking', async () => {
  await signOut();
  await signIn(ADMIN.email, ADMIN.password);
  await nav(`/quotations/${limitedQuote[1]}`);
  await click('Convert to booking');
  await waitFor('document.body.innerText.includes("Proceed past the limit")', 'proceed button');
  await setField('credit-decision-reason', 'Approved: long-standing customer');
  await click('Proceed past the limit');
  await waitFor('/^\\/bookings\\/BKG-/.test(location.pathname)', 'booking page');
  await sleep(800);
  const t = await text();
  expect(t.includes('Credit-limit decisions') && t.includes('Approved: long-standing customer'), 'credit decision not shown');
  await shot('08-booking-credit');
});

await step('finance can view but not create or edit', async () => {
  await signOut();
  await signIn(FINANCE, DEMO);
  await nav('/quotations/new');
  expect((await text()).includes('You cannot create quotations'), 'finance allowed to create');
  await nav(`/quotations/${reference}`);
  const controls = await evaluate('[...document.querySelectorAll("button, a")].map((b) => b.innerText.trim())');
  expect(!controls.includes('Duplicate as draft') && !controls.includes('Record status') && !controls.includes('Edit'), 'finance sees manage actions');
  expect(!(await text()).includes('to quote again'), 'finance sees the duplicate hint');
});

const badge = () => evaluate('[...document.querySelectorAll("header span, div span")].map((s) => s.innerText.trim()).find((t) => t === "Live data" || t === "Demo data") ?? ""');

await step('seeded demo reference opens the live record with the Live data badge', async () => {
  await nav('/quotations/QT-2610-0057');
  const t = await text();
  expect(t.includes('QT-2610-0057') && t.includes('Ziwa Pharma Distributors Ltd'), 'seeded record not shown');
  expect(!/demonstration data/i.test(t), 'demo banner on a live record');
  expect((await badge()) === 'Live data', `badge was ${await badge()}`);
});

await step('demo fallback page shows the Demo data badge (batch 1 fix)', async () => {
  await nav('/quotations/QT-0000-0000');
  await sleep(500);
  expect((await badge()) === 'Demo data', `badge was ${await badge()}`);
  await nav('/quotations');
  await sleep(300);
  expect((await badge()) === 'Live data', `badge stayed ${await badge()} after leaving`);
});

await step('cancelled booking shows on its quotation (batch 1 fix)', async () => {
  await signOut();
  await signIn(SALES, DEMO);
  const r = await api('POST', '/api/backend/quotations', {
    customerId: (await api('GET', '/api/backend/parties?role=customer&q=Baobab')).body.items[0].id,
    mode: 'sea', direction: 'import', origin: 'Shanghai', destination: 'Mombasa', cargoSummary: 'Cancel check',
    issueDate: today, validUntil: inDays(20), lines: [{ description: 'Freight', quantity: '1', unitPrice: '1000', taxRate: '0' }],
  });
  const ref = r.body.reference;
  await api('POST', `/api/backend/quotations/${ref}/status`, { status: 'sent', sentAt: new Date(Date.now() - 600_000).toISOString(), sentTo: 'x@example.com' });
  await api('POST', `/api/backend/quotations/${ref}/status`, { status: 'accepted', decidedAt: new Date(Date.now() - 300_000).toISOString() });
  const b = await api('POST', `/api/backend/quotations/${ref}/convert`, {});
  expect(b.status === 201, `convert ${b.status}`);
  await api('POST', `/api/backend/bookings/${b.body.reference}/cancel`, { reason: 'Browser check' });
  await nav(`/quotations/${ref}`);
  const t = await text();
  expect(t.includes('Booking cancelled') && t.includes('cannot be converted again'), 'cancelled booking not shown');
  expect(!/\bBooked\b/.test(t.split('Booking')[0]), 'still says Booked in the header');
  await nav(`/quotations?q=${ref}`);
  expect((await text()).includes('Booking cancelled'), 'list still says Booked');
  await shot('10-booking-cancelled');
});

await step('customer page links to that customer\'s quotations (batch 1 fix)', async () => {
  const id = (await api('GET', '/api/backend/parties?role=customer&q=Baobab')).body.items[0].id;
  await nav(`/parties/${id}`);
  const t = await text();
  expect(!t.includes('Shipments and quotations move to the live system'), 'old message still shown');
  await click('View quotations');
  await waitFor(`location.search.includes('customerId=${id}')`, 'filtered list');
  await sleep(800);
  const list = await text();
  expect(list.includes('Showing quotations for') && list.includes('Baobab Crest Traders Ltd'), 'filter notice missing');
  const customers = await evaluate('[...document.querySelectorAll("tbody tr td:nth-child(2)")].map((td) => td.innerText.trim())');
  expect(customers.length > 0 && customers.every((c) => c === 'Baobab Crest Traders Ltd'), `other customers listed: ${[...new Set(customers)].join(', ')}`);
  await shot('11-customer-quotations');
});

await step('convert form records carrier, booking number and planned dates (batch 1 fix)', async () => {
  const r = await api('POST', '/api/backend/quotations', {
    customerId: (await api('GET', '/api/backend/parties?role=customer&q=Kijani')).body.items[0].id,
    mode: 'sea', direction: 'import', origin: 'Jebel Ali', destination: 'Mombasa', cargoSummary: 'Carrier check',
    issueDate: today, validUntil: inDays(20), lines: [{ description: 'Freight', quantity: '1', unitPrice: '2000', taxRate: '0' }],
  });
  const ref = r.body.reference;
  await api('POST', `/api/backend/quotations/${ref}/status`, { status: 'sent', sentAt: new Date(Date.now() - 600_000).toISOString(), sentTo: 'x@example.com' });
  await api('POST', `/api/backend/quotations/${ref}/status`, { status: 'accepted', decidedAt: new Date(Date.now() - 300_000).toISOString() });
  await nav(`/quotations/${ref}`);
  await selectByLabel('convert-carrierId', 'Indigo Ocean Lines');
  await setField('convert-carrierBookingNumber', 'IOL-55210');
  await setField('convert-plannedEtd', `${inDays(5)}T08:00`);
  await setField('convert-plannedEta', `${inDays(4)}T08:00`);
  await click('Convert to booking');
  await sleep(400);
  expect((await text()).includes('cannot be before the planned departure'), 'date order not checked');
  await setField('convert-plannedEta', `${inDays(25)}T08:00`);
  await sleep(200);
  expect(!(await text()).includes('cannot be before the planned departure'), 'error not cleared after correcting the date');
  await shot('12-convert-details');
  await click('Convert to booking');
  await waitFor('/^\\/bookings\\/BKG-/.test(location.pathname)', 'booking page');
  await sleep(800);
  const t = await text();
  expect(t.includes('Indigo Ocean Lines') && t.includes('IOL-55210'), 'carrier details not saved');
  expect(!t.includes('Planned departure\nNot recorded'), 'planned departure not saved');
});

let approvalRefs = [];
await step('credit approval: sales books over the limit and requests approval', async () => {
  await signOut();
  await signIn(ADMIN.email, ADMIN.password);
  const customer = await api('POST', '/api/backend/parties', { name: `Approval Browser Ltd ${Date.now()}`, roles: ['customer'], creditLimit: '100000' });
  const make = async () => {
    const q = await api('POST', '/api/backend/quotations', {
      customerId: customer.body.id, mode: 'sea', direction: 'import', origin: 'Mersin', destination: 'Mombasa',
      cargoSummary: 'Approval check', issueDate: today, validUntil: inDays(14),
      lines: [{ description: 'Freight', quantity: '1', unitPrice: '150000', taxRate: '0' }],
    });
    const r = q.body.reference;
    await api('POST', `/api/backend/quotations/${r}/status`, { status: 'sent', sentAt: new Date(Date.now() - 600_000).toISOString(), sentTo: 'x@example.com' });
    await api('POST', `/api/backend/quotations/${r}/status`, { status: 'accepted', decidedAt: new Date(Date.now() - 300_000).toISOString() });
    return r;
  };
  const quotes = [await make(), await make()];
  await signOut();
  await signIn(SALES, DEMO);
  for (const quote of quotes) {
    await nav(`/quotations/${quote}`);
    await click('Convert to booking');
    await waitFor('document.body.innerText.includes("Book and request approval")', 'request button');
    await setField('credit-decision-reason', 'Customer pays on delivery');
    if (quote === quotes[0]) await shot('13-request-approval');
    await click('Book and request approval');
    await waitFor('/^\\/bookings\\/BKG-/.test(location.pathname)', 'booking page');
    await sleep(800);
    approvalRefs.push(decodeURIComponent((await url()).split('/')[2]));
  }
  const t = await text();
  expect(t.includes('Awaiting credit approval') && t.includes('Customer pays on delivery'), 'awaiting state not shown');
  const controls = await evaluate('[...document.querySelectorAll("button")].map((b) => b.innerText.trim())');
  expect(!controls.includes('Confirm booking'), 'confirm offered while awaiting approval');
  expect(!controls.includes('Approve'), 'sales offered approve');
});

await step('credit approval: finance approves, then sales confirms', async () => {
  await signOut();
  await signIn(FINANCE, DEMO);
  await nav('/bookings');
  await click('Show only bookings awaiting credit approval');
  await waitFor('location.search.includes("creditApproval=awaiting")', 'filtered list');
  await sleep(800);
  expect((await text()).includes(approvalRefs[0]), 'awaiting booking not listed');
  await nav(`/bookings/${approvalRefs[0]}`);
  await shot('14-approve');
  await click('Approve');
  await sleep(300);
  expect((await text()).includes('Give a reason'), 'reason not required');
  await setField('credit-approval-reason', 'Payment plan agreed');
  await click('Approve');
  await waitFor('document.body.innerText.includes("Credit approved")', 'approved');
  await signOut();
  await signIn(SALES, DEMO);
  await nav(`/bookings/${approvalRefs[0]}`);
  await click('Confirm booking');
  await waitFor('document.body.innerText.includes("Confirmed")', 'confirmed');
});

await step('credit approval: management rejects, which cancels the booking', async () => {
  await signOut();
  await signIn('g.nduta@freight-demo.example', DEMO);
  await nav(`/bookings/${approvalRefs[1]}`);
  await setField('credit-approval-reason', 'Balance too high');
  await click('Reject and cancel booking');
  await waitFor('document.body.innerText.includes("Credit rejected")', 'rejected');
  const t = await text();
  expect(t.includes('Cancelled') && t.includes('Credit approval rejected: Balance too high'), 'not cancelled');
  await shot('15-rejected');
  await signOut();
  await signIn(SALES, DEMO);
});

await step('new booking page creates a booking without a quotation', async () => {
  await nav('/bookings');
  await click('New booking');
  await waitFor('location.pathname === "/bookings/new"', 'new booking page');
  await sleep(600);
  await click('Create booking');
  await sleep(300);
  expect((await text()).includes('Select the customer.'), 'empty form accepted');
  await selectByLabel('booking-customerId', 'Baobab Crest Traders Ltd');
  await setField('booking-mode', 'road');
  await setField('booking-direction', 'transit');
  await setField('booking-origin', 'Mombasa');
  await setField('booking-destination', 'Kampala, UG');
  await setField('booking-cargoSummary', 'Transit cargo, 1 truck');
  await selectByLabel('booking-carrierId', 'Indigo Ocean Lines');
  await setField('booking-plannedEtd', `${inDays(3)}T08:00`);
  await setField('booking-plannedEta', `${inDays(6)}T08:00`);
  await shot('16-new-booking');
  await click('Create booking');
  await waitFor('/^\\/bookings\\/BKG-/.test(location.pathname)', 'booking page');
  await sleep(800);
  const t = await text();
  expect(t.includes('Booked without a quotation') && t.includes('Kampala, UG') && t.includes('Indigo Ocean Lines'), 'booking details missing');
});

await step('unknown booking shows not found', async () => {
  await nav('/bookings/BKG-0000-0000');
  expect(/not found|could not be found/i.test(await text()), 'no not-found page');
});

// Repository-owner decisions of 2026-11-26.
let heldCustomer;
await step('on-hold customer: quotation explains the block and the forms leave them out', async () => {
  await signOut();
  await signIn(ADMIN.email, ADMIN.password);
  const name = `Held Browser Ltd ${Date.now()}`;
  const customer = await api('POST', '/api/backend/parties', { name, roles: ['customer'] });
  expect(customer.status === 201, `customer ${customer.status}`);
  heldCustomer = { id: customer.body.id, name };
  const q = await api('POST', '/api/backend/quotations', {
    customerId: customer.body.id, mode: 'sea', direction: 'import', origin: 'Shanghai', destination: 'Mombasa',
    cargoSummary: 'Hold check', issueDate: today, validUntil: inDays(20),
    lines: [{ description: 'Freight', quantity: '1', unitPrice: '1000', taxRate: '0' }],
  });
  const ref = q.body.reference;
  await api('POST', `/api/backend/quotations/${ref}/status`, { status: 'sent', sentAt: new Date(Date.now() - 600_000).toISOString(), sentTo: 'x@example.com' });
  await api('POST', `/api/backend/quotations/${ref}/status`, { status: 'accepted', decidedAt: new Date(Date.now() - 300_000).toISOString() });
  const held = await api('PATCH', `/api/backend/parties/${customer.body.id}`, { accountStatus: 'on_hold' });
  expect(held.status === 200, `status change ${held.status}`);
  await nav(`/quotations/${ref}`);
  const t = await text();
  expect(t.includes('is on hold, so new quotations and bookings are blocked'), 'no block explanation');
  const controls = await evaluate('[...document.querySelectorAll("button")].map((b) => b.innerText.trim())');
  expect(!controls.includes('Convert to booking'), 'convert offered for an on-hold customer');
  await shot('17-on-hold-quotation');
  for (const path of ['/quotations/new', '/bookings/new']) {
    await nav(path);
    const options = await evaluate('[...document.querySelectorAll("select option")].map((o) => o.text)');
    expect(!options.includes(name), `on-hold customer offered on ${path}`);
    expect(/customers? (is|are) not listed/.test(await text()), `no note on ${path}`);
  }
  await nav(`/parties/${customer.body.id}`);
  expect((await text()).includes('This customer is on hold'), 'customer page has no on-hold notice');
  await api('PATCH', `/api/backend/parties/${customer.body.id}`, { accountStatus: 'active' });
});

await step('archiving is refused while the customer has open work, naming it', async () => {
  const q = await api('POST', '/api/backend/quotations', {
    customerId: heldCustomer.id, mode: 'air', direction: 'export', origin: 'Nairobi', destination: 'Dubai',
    cargoSummary: 'Archive check', issueDate: today, validUntil: inDays(20),
    lines: [{ description: 'Freight', quantity: '1', unitPrice: '1000', taxRate: '0' }],
  });
  await nav(`/parties/${heldCustomer.id}`);
  await click('Archive');
  await sleep(200);
  await click('Yes, archive');
  await waitFor('document.body.innerText.includes("cannot be archived yet")', 'archive refusal');
  const t = await text();
  expect(t.includes(`1 open quotation: ${q.body.reference}.`), 'blocking quotation not named');
  await shot('18-archive-refused');
});

await step('admin changes a charge-type tax rate in Settings', async () => {
  const types = await api('GET', '/api/backend/charge-types/tax-settings');
  expect(types.status === 200 && types.body.length > 0, `tax settings ${types.status}`);
  const type = types.body.find((c) => c.isActive) ?? types.body[0];
  await nav('/settings#tax');
  await waitFor(`!!document.querySelector('[aria-label=${JSON.stringify(`Change tax for ${type.name}`)}]')`, 'tax table');
  expect((await text()).includes('have not been reviewed by the company'), 'provisional note missing');
  await evaluate(`document.querySelector('[aria-label=${JSON.stringify(`Change tax for ${type.name}`)}]').click()`);
  await sleep(300);
  await setField(`tax-${type.code}-rate`, '150');
  await click('Save tax settings');
  await sleep(300);
  expect((await text()).includes('Enter a rate from 0 to 100'), 'rate over 100 accepted');
  // A rate different from the current one; the original values are put back afterwards.
  const newRate = type.defaultTaxRate === '15.50' ? '14.5' : '15.5';
  try {
    await setField(`tax-${type.code}-rate`, newRate);
    await click('Save tax settings');
    await waitFor(`document.body.innerText.includes('${newRate}%') && !document.body.innerText.includes('Save tax settings')`, 'saved rate');
    await shot('19-tax-settings');
  } finally {
    const back = await api('PATCH', `/api/backend/charge-types/${type.id}/tax`, {
      defaultTaxCategory: type.defaultTaxCategory, defaultTaxRate: type.defaultTaxRate,
    });
    // 409 means the values were never changed.
    expect(back.status === 200 || back.status === 409, `restoring the original rate: ${back.status}`);
  }
});

await step('tax settings are admin-only for other roles', async () => {
  await signOut();
  await signIn(FINANCE, DEMO);
  await nav('/settings#tax');
  await sleep(500);
  expect((await text()).includes('Only an administrator can view and change the tax settings.'), 'finance not told');
  const r = await api('GET', '/api/backend/charge-types/tax-settings');
  expect(r.status === 403, `finance read tax settings: ${r.status}`);
});

await step('no sideways scrolling at 390 px', async () => {
  await signOut();
  await signIn(SALES, DEMO);
  for (const path of ['/quotations', `/quotations/${reference}`, '/quotations/new', `/bookings/${bookingRef}`, '/bookings']) {
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await nav(path);
    expect(await noSideScroll(), `side scroll on ${path}`);
  }
  await shot('09-mobile-detail', 390);
  await send('Emulation.clearDeviceMetricsOverride');
});

console.log(results.join('\n'));
console.log(`${results.filter((r) => r.startsWith('PASS')).length}/${results.length} passed`);
console.log(`Screenshots: ${OUT}`);
ws.close();
chrome.kill();
if (results.some((r) => r.startsWith('FAIL'))) process.exitCode = 1;
