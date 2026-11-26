import 'dotenv/config';
import { db } from '../prisma/db.js';
import { seedDemo } from './demo.js';
import { seedDemoQuotations } from './demo-quotations.js';
import { seedDemoShipments } from './demo-shipments.js';

const password = process.env['DEMO_USER_PASSWORD'];
if (!password) {
  throw new Error('Set DEMO_USER_PASSWORD in .env first.');
}

try {
  console.log(await seedDemo(db, password));
  // Phase 2: fictional quotations and bookings, which need the fictional customers above.
  console.log(await seedDemoQuotations(db));
  // Phase 3: fictional shipments, two of them on the bookings above.
  console.log(await seedDemoShipments(db));
} finally {
  await db.close();
}
