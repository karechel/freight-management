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

// --- Phase 3: shipments and tracking (2026-11-26) -------------------------------------------
const OPERATIONS = 'a.wanjiru@freight-demo.example';
let shipmentRef;

await step('operations sees the live shipment list with view counts', async () => {
  await signOut();
  await signIn(OPERATIONS, DEMO);
  await nav('/shipments?view=all');
  const t = await text();
  expect((await h1()) === 'Shipments', await h1());
  expect(t.includes('Live data'), 'no live badge');
  expect(t.includes('FMS-SEA-2610-0041'), 'seeded shipment missing');
  expect(t.includes('Needs attention'), 'no attention view');
  await shot('20-shipments-list');
  await nav('/shipments?view=delayed');
  expect((await text()).includes('FMS-ROAD-2610-0033'), 'seeded delayed shipment not in the delayed view');
});

await step('a seeded shipment shows milestones, customs summary and its booking', async () => {
  await nav('/shipments/FMS-SEA-2610-0022');
  const t = await text();
  expect(t.includes('BKG-2610-0001'), 'booking link missing');
  expect(t.includes('Packaging machinery'), 'cargo missing');
  await nav('/shipments/FMS-AIR-2610-0019');
  expect((await text()).includes('Fictional demo query'), 'customs query summary missing');
});

await step('operations creates a shipment from a confirmed booking', async () => {
  const booking = await api('POST', '/api/backend/bookings', {
    customerId: (await api('GET', '/api/backend/parties?role=customer&q=Kijani&limit=5')).body.items[0].id,
    mode: 'sea', direction: 'import', origin: 'Jebel Ali, AE', destination: 'Mombasa', cargoSummary: '3 × 20ft GP, roofing sheets',
    plannedEta: `${inDays(12)}T00:00:00+03:00`, estimatedValue: '100000',
  });
  // Operations cannot create bookings (quotations.manage); an admin makes and confirms it.
  expect(booking.status === 403, `operations created a booking: ${booking.status}`);
  await signOut();
  await signIn(ADMIN.email, ADMIN.password);
  const kijani = (await api('GET', '/api/backend/parties?role=customer&q=Kijani&limit=5')).body.items[0].id;
  const made = await api('POST', '/api/backend/bookings', {
    customerId: kijani, mode: 'sea', direction: 'import', origin: 'Jebel Ali, AE', destination: 'Mombasa',
    cargoSummary: '3 × 20ft GP, roofing sheets', plannedEta: `${inDays(12)}T00:00:00+03:00`, estimatedValue: '100000',
    creditDecision: { decision: 'proceed', reason: 'Browser check' },
  });
  expect(made.status === 201, `booking: ${made.status} ${JSON.stringify(made.body)}`);
  const confirmed = await api('POST', `/api/backend/bookings/${made.body.reference}/confirm`, {});
  expect(confirmed.status === 200, `confirm: ${confirmed.status}`);
  await signOut();
  await signIn(OPERATIONS, DEMO);
  await nav(`/bookings/${made.body.reference}`);
  await click('Create shipment');
  await waitFor('location.pathname === "/shipments/new"', 'new shipment form');
  await sleep(800);
  expect((await text()).includes(`From booking ${made.body.reference}`), 'not prefilled from the booking');
  await selectByLabel('shipment-assigned', 'A. Wanjiru');
  await setField('shipment-equipment', '3 × 20ft GP');
  await setField('shipment-packages', '96');
  await setField('shipment-weight', '52000');
  await shot('21-new-shipment');
  await click('Create shipment');
  await waitFor('/^\\/shipments\\/FMS-SEA-/.test(location.pathname)', 'redirect to the new shipment');
  await sleep(800);
  shipmentRef = decodeURIComponent((await url()).split('/')[2]);
  const t = await text();
  expect(t.includes('Booking confirmed'), 'default milestones missing');
  expect(t.includes(made.body.reference), 'booking not linked');
  await nav(`/bookings/${made.body.reference}`);
  expect((await text()).includes(shipmentRef), 'booking does not list the shipment');
});

await step('status change records departure and completes the milestone', async () => {
  await nav(`/shipments/${shipmentRef}`);
  await setField('status-new', 'in_transit');
  await sleep(200);
  await setField('status-atd', nairobi(-120).slice(0, 16));
  await click('Change status');
  await waitFor('document.body.innerText.includes(\'to "In transit"\')', 'history entry');
  const arrived = await api('POST', `/api/backend/shipments/${shipmentRef}/status`, { status: 'arrived' });
  expect(arrived.status === 400 && arrived.body.details[0].field === 'ata', `arrived without ata: ${arrived.status}`);
});

await step('a delay with a revised date becomes the ETA, and resolving it restores the plan', async () => {
  await nav(`/shipments/${shipmentRef}`);
  await click('Record delay or issue');
  await sleep(300);
  await setField('issue-severity', 'high');
  await setField('issue-reason', 'port_congestion');
  await setField('issue-identified', nairobi(-30).slice(0, 16));
  await setField('issue-detail', 'Vessel waiting at anchorage');
  await setField('issue-revised', `${inDays(15)}T10:00`);
  await setField('issue-notes', 'Agent confirmed the next berth window');
  await click('Record delay');
  await waitFor('document.body.innerText.includes("revised by an open delay")', 'revised ETA');
  expect((await text()).includes('Needs attention'), 'no attention badge');
  expect((await text()).includes('Agent confirmed the next berth window'), 'delay notes not shown');
  await shot('22-shipment-delay');
  await click('Update');
  await sleep(300);
  const delayId = (await api('GET', `/api/backend/shipments/${shipmentRef}`)).body.issues[0].id;
  await setField(`issue-${delayId}-status`, 'resolved');
  await sleep(200);
  await setField(`issue-${delayId}-resolved`, nairobi(-5).slice(0, 16));
  await setField(`issue-${delayId}-severity`, 'medium');
  await setField(`issue-${delayId}-notes`, 'Berthed two days late');
  await click('Save changes');
  await waitFor('!document.body.innerText.includes("revised by an open delay")', 'ETA back to planned');
  await waitFor('document.body.innerText.includes("Berthed two days late")', 'updated notes shown');
  const after = (await api('GET', `/api/backend/shipments/${shipmentRef}`)).body.issues[0];
  expect(after.severity === 'medium' && after.notes === 'Berthed two days late', `issue not updated: ${after.severity} ${after.notes}`);
});

await step('containers are added in the ISO format', async () => {
  await setField('container-number', 'iolu 7654321');
  await setField('container-type', 'dry_20');
  await click('Add container');
  await waitFor('document.body.innerText.includes("IOLU7654321")', 'container listed');
  await setField('container-number', 'BAD1');
  await setField('container-type', 'dry_20');
  await click('Add container');
  await waitFor('document.body.innerText.includes("four letters and seven digits")', 'format error');
});

await step('arrival and delivery; delivered is final', async () => {
  await nav(`/shipments/${shipmentRef}`);
  await setField('status-new', 'arrived');
  await sleep(200);
  await setField('status-ata', nairobi(-60).slice(0, 16));
  await click('Change status');
  await waitFor('document.body.innerText.includes(\'to "Arrived"\')', 'arrived');
  await sleep(500);
  await setField('status-new', 'delivered');
  await sleep(200);
  await setField('status-delivered', nairobi(-1).slice(0, 16));
  await click('Change status');
  await waitFor('document.body.innerText.includes("Delivered shipments are final")', 'delivered');
  await shot('23-shipment-delivered');
});

await step('operations opens a standalone clearing job', async () => {
  await nav('/shipments/new');
  await selectByLabel('shipment-customer', 'Upeo Electronics Ltd');
  await setField('shipment-mode', 'road');
  await setField('shipment-direction', 'import');
  await setField('shipment-origin', 'Mombasa');
  await setField('shipment-destination', 'Nairobi ICD');
  await setField('shipment-cargo', 'Clearing only: 1 × 20ft, electrical goods');
  await click('Create shipment');
  await sleep(500);
  expect((await text()).includes('Enter the estimated arrival date.'), 'no ETA error');
  await setField('shipment-eta', inDays(3));
  await click('Create shipment');
  await waitFor('/^\\/shipments\\/FMS-ROAD-/.test(location.pathname)', 'standalone created');
  await sleep(600);
  expect((await text()).includes('Job opened'), 'standalone milestones missing');
});

await step("the customer page links to that customer's shipments", async () => {
  const customerId = (await api('GET', `/api/backend/shipments/${shipmentRef}`)).body.customer.id;
  await nav(`/parties/${customerId}`);
  await click('View shipments');
  await waitFor('location.pathname === "/shipments"', 'shipments list');
  await sleep(800);
  const t = await text();
  expect(t.includes("Showing one customer's shipments"), 'no customer filter note');
  expect(t.includes(shipmentRef), 'customer shipment missing');
  expect(!t.includes('FMS-AIR-2610-0038'), "another customer's shipment shown");
});

await step('sales can view shipments but not change them', async () => {
  await signOut();
  await signIn(SALES, DEMO);
  await nav('/shipments');
  expect(!(await text()).includes('New shipment'), 'sales sees New shipment');
  await nav(`/shipments/${shipmentRef}`);
  expect(!(await text()).includes('Record delay or issue'), 'sales sees delay form');
  const r = await api('POST', `/api/backend/shipments/${shipmentRef}/issues`, { type: 'other' });
  expect(r.status === 403, `sales wrote: ${r.status}`);
});

await step('no sideways scrolling on shipment pages at 390 px', async () => {
  for (const path of ['/shipments', `/shipments/${shipmentRef}`, '/shipments/FMS-ROAD-2610-0033']) {
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await nav(path);
    expect(await noSideScroll(), `side scroll on ${path}`);
  }
  await shot('24-mobile-shipment', 390);
  await send('Emulation.clearDeviceMetricsOverride');
});

// --- Connected workflow for the buyer demonstration (2026-11-26) ------------------------------
// Continues from the quotation and booking created at the start of this run (`reference`,
// `bookingRef`): quotation → confirmed booking → shipment → tracking → delivery.
let flowShipment;

await step('workflow: customers page lists a customer and opens it', async () => {
  await signOut();
  await signIn(ADMIN.email, ADMIN.password);
  await nav('/parties');
  await waitFor('document.body.innerText.includes("Baobab Crest Traders Ltd")', 'customer listed');
  await evaluate(`[...document.querySelectorAll('a')].find((a) => a.innerText.trim() === 'Baobab Crest Traders Ltd').click()`);
  await waitFor('/^\\/parties\\/\\d+$/.test(location.pathname)', 'customer page');
  await sleep(800);
  expect((await text()).includes('Baobab Crest Traders Ltd'), 'customer name missing');
});

await step('workflow: the converted quotation is booked and its booking confirmed', async () => {
  const q = await api('GET', `/api/backend/quotations/${reference}`);
  expect(q.body.booking?.reference === bookingRef, `quotation booking ${q.body.booking?.reference}`);
  const b = await api('GET', `/api/backend/bookings/${bookingRef}`);
  expect(b.body.status === 'confirmed', `booking is ${b.body.status}`);
  expect(b.body.quotation?.reference === reference, 'booking does not link the quotation');
});

await step('workflow: operations creates a shipment from that booking', async () => {
  await signOut();
  await signIn(OPERATIONS, DEMO);
  await nav(`/bookings/${bookingRef}`);
  await click('Create shipment');
  await waitFor('location.pathname === "/shipments/new"', 'new shipment form');
  await sleep(800);
  if (!(await evaluate('document.getElementById("shipment-eta").value'))) await setField('shipment-eta', inDays(25));
  await click('Create shipment');
  await waitFor('/^\\/shipments\\/FMS-SEA-/.test(location.pathname)', 'shipment page');
  await sleep(800);
  flowShipment = decodeURIComponent((await url()).split('/')[2]);
  expect((await text()).includes(bookingRef), 'booking not linked on the shipment');
});

await step('workflow: shipment details are updated through the edit form', async () => {
  await nav(`/shipments/${flowShipment}/edit`);
  await setField('shipment-docref', 'IOL-SHA-990011');
  await setField('shipment-vessel', 'MV Indigo Star');
  await setField('shipment-equipment', '2 × 20ft GP');
  await setField('shipment-packages', '220');
  await click('Save changes');
  await waitFor(`location.pathname === '/shipments/${flowShipment}'`, 'back on the shipment');
  await sleep(800);
  const t = await text();
  expect(t.includes('IOL-SHA-990011') && t.includes('MV Indigo Star'), 'edits not shown');
  expect(t.includes('Details updated'), 'no history entry');
});

await step('workflow: a milestone is recorded and departure follows', async () => {
  await setField('milestone-actual', nairobi(-240).slice(0, 16));
  await setField('milestone-note', 'Sailed on schedule');
  await click('Save milestone');
  await waitFor('document.body.innerText.includes("Milestone \\"Departed origin\\" marked completed")', 'milestone history');
  const s = await api('GET', `/api/backend/shipments/${flowShipment}`);
  expect(s.body.atd !== null, 'departure time not set from the milestone');
});

await step('workflow: a delay revises the current ETA', async () => {
  await click('Record delay or issue');
  await sleep(300);
  await setField('issue-severity', 'medium');
  await setField('issue-reason', 'carrier_schedule');
  await setField('issue-identified', nairobi(-60).slice(0, 16));
  await setField('issue-detail', 'Transhipment vessel rolled to the next sailing');
  await setField('issue-revised', `${inDays(32)}T08:00`);
  await click('Record delay');
  await waitFor('document.body.innerText.includes("revised by an open delay")', 'revised ETA');
  const s = await api('GET', `/api/backend/shipments/${flowShipment}`);
  expect(s.body.currentEta.revised === true, 'API ETA not revised');
});

await step('workflow: an issue is recorded and an action taken is logged', async () => {
  await click('Record delay or issue');
  await sleep(300);
  await setField('issue-type', 'documentation');
  await sleep(200);
  await setField('issue-severity', 'low');
  await setField('issue-identified', nairobi(-30).slice(0, 16));
  await setField('issue-detail', 'Packing list missing HS codes');
  await click('Record issue');
  await waitFor('document.body.innerText.includes("Packing list missing HS codes")', 'issue listed');
  await sleep(500);
  const issue = (await api('GET', `/api/backend/shipments/${flowShipment}`)).body.issues.find((i) => i.type === 'documentation');
  await setField(`issue-${issue.id}-action`, 'Requested a corrected packing list from the shipper');
  await evaluate(`document.getElementById('issue-${issue.id}-action').closest('li').querySelector('button').click()`);
  await waitFor('document.body.innerText.includes("Requested a corrected packing list")', 'action logged');
  await shot('25-workflow-issues');
});

await step('workflow: a container is added and shown', async () => {
  await setField('container-number', 'IOLU1122334');
  await setField('container-type', 'dry_20');
  await setField('container-seal', 'SL-4410');
  await click('Add container');
  await waitFor('document.body.innerText.includes("IOLU1122334")', 'container listed');
  const s = await api('GET', `/api/backend/shipments/${flowShipment}`);
  expect(s.body.containers.some((c) => c.containerNumber === 'IOLU1122334' && c.sealNumber === 'SL-4410'), 'container not saved');
});

await step('workflow: status moves to in transit, then arrived with the arrival time', async () => {
  await nav(`/shipments/${flowShipment}`);
  await setField('status-new', 'in_transit');
  await click('Change status');
  await waitFor('document.body.innerText.includes(\'to "In transit"\')', 'in transit');
  await sleep(500);
  await setField('status-new', 'arrived');
  await sleep(200);
  await setField('status-ata', nairobi(-20).slice(0, 16));
  await click('Change status');
  await waitFor('document.body.innerText.includes(\'to "Arrived"\')', 'arrived');
});

await step('workflow: customs summary and history are shown', async () => {
  const t = await text();
  expect(t.includes('No customs entry recorded.'), 'customs summary missing');
  for (const entry of ['Shipment created from booking', 'Details updated', 'Delay recorded', 'Issue recorded', 'Container IOLU1122334 added', 'to "Arrived"']) {
    expect(t.includes(entry), `history lacks "${entry}"`);
  }
});

await step('workflow: the booking shows its shipment and refuses cancellation', async () => {
  await signOut();
  await signIn(SALES, DEMO);
  await nav(`/bookings/${bookingRef}`);
  expect((await text()).includes(flowShipment), 'shipment not listed on the booking');
  await click('Cancel booking…');
  await sleep(200);
  await setField('booking-cancel-reason', 'Customer changed plans');
  await click('Cancel booking');
  await waitFor('document.body.innerText.includes("already has shipments")', 'cancel refused');
  const b = await api('GET', `/api/backend/bookings/${bookingRef}`);
  expect(b.body.status === 'confirmed', `booking became ${b.body.status}`);
});

await step('workflow: delivery needs the delivery time, then the shipment is delivered', async () => {
  await signOut();
  await signIn(OPERATIONS, DEMO);
  await nav(`/shipments/${flowShipment}`);
  await setField('status-new', 'delivered');
  await click('Change status');
  await waitFor('document.body.innerText.includes("Enter the actual delivery time")', 'delivery time required');
  await setField('status-delivered', nairobi(-1).slice(0, 16));
  await click('Change status');
  await waitFor('document.body.innerText.includes("Delivered shipments are final")', 'delivered');
  await shot('26-workflow-delivered');
});

await step('demo pages load without errors and say which data is live', async () => {
  await signOut();
  await signIn(ADMIN.email, ADMIN.password);
  const pages = {
    '/': 'Demo data', '/parties': 'Live data', '/quotations': 'Live data', '/bookings': 'Live data', '/shipments': 'Live data',
    [`/shipments/${flowShipment}`]: 'Live data', '/shipments/new': 'Live data', [`/shipments/${flowShipment}/edit`]: 'Live data', '/settings': 'Demo data',
  };
  for (const [path, badge] of Object.entries(pages)) {
    await nav(path);
    const t = await text();
    expect(!t.includes('could not be loaded') && !t.includes('Something went wrong'), `error on ${path}`);
    expect(t.includes(badge), `${path} does not show "${badge}"`);
  }
});

console.log(results.join('\n'));
console.log(`${results.filter((r) => r.startsWith('PASS')).length}/${results.length} passed`);
console.log(`Screenshots: ${OUT}`);
ws.close();
chrome.kill();
if (results.some((r) => r.startsWith('FAIL'))) process.exitCode = 1;
