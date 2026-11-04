import 'dotenv/config';
import { db } from '../prisma/db.js';
import { seedDemo } from './demo.js';

const password = process.env['DEMO_USER_PASSWORD'];
if (!password) {
  throw new Error('Set DEMO_USER_PASSWORD in .env first.');
}

try {
  console.log(await seedDemo(db, password));
} finally {
  await db.close();
}
