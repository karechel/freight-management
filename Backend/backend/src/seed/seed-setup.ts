import 'dotenv/config';
import { db } from '../prisma/db.js';
import { seedSetup } from './setup.js';

const email = process.env['ADMIN_EMAIL'];
const password = process.env['ADMIN_PASSWORD'];
if (!email || !password) {
  throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD in .env first.');
}

try {
  console.log(await seedSetup(db, { email, password }));
} finally {
  await db.close();
}
