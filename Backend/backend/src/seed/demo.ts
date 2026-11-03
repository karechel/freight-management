import { hashPassword, MIN_PASSWORD_LENGTH } from '../auth/password.js';
import type { Db } from '../prisma/prisma.service.js';
import type { RoleCode } from './setup-data.js';

type PartyRoleCode =
  'customer' | 'agent' | 'supplier' | 'carrier' | 'transporter';

/** Fictional companies, matching the frontend's demo records. Emails use the reserved .example domain. */
const DEMO_PARTIES: {
  name: string;
  roles: PartyRoleCode[];
  city: string;
  country: string;
  contactName: string;
  email: string;
}[] = [
  {
    name: 'Baobab Crest Traders Ltd',
    roles: ['customer'],
    city: 'Nairobi',
    country: 'KE',
    contactName: 'J. Kamau',
    email: 'imports@baobabcrest.example',
  },
  {
    name: 'Mlima Fresh Exports Ltd',
    roles: ['customer'],
    city: 'Naivasha',
    country: 'KE',
    contactName: 'R. Chebet',
    email: 'logistics@mlimafresh.example',
  },
  {
    name: 'Kijani Build Supplies Ltd',
    roles: ['customer'],
    city: 'Mombasa',
    country: 'KE',
    contactName: 'S. Mwangi',
    email: 'procurement@kijanibuild.example',
  },
  {
    name: 'Ziwa Pharma Distributors Ltd',
    roles: ['customer'],
    city: 'Kisumu',
    country: 'KE',
    contactName: 'L. Odhiambo',
    email: 'supply@ziwapharma.example',
  },
  {
    name: 'Upeo Electronics Ltd',
    roles: ['customer'],
    city: 'Nairobi',
    country: 'KE',
    contactName: 'P. Njeri',
    email: 'ops@upeoelectronics.example',
  },
  {
    name: 'Simba Line Textiles Ltd',
    roles: ['customer'],
    city: 'Eldoret',
    country: 'KE',
    contactName: 'K. Rotich',
    email: 'shipping@simbaline.example',
  },
  {
    name: 'Eastgate Forwarding (Shanghai)',
    roles: ['agent'],
    city: 'Shanghai',
    country: 'CN',
    contactName: 'M. Chen',
    email: 'kenya.desk@eastgatefwd.example',
  },
  {
    name: 'Gulf Bridge Logistics',
    roles: ['agent'],
    city: 'Dubai',
    country: 'AE',
    contactName: 'H. Rahman',
    email: 'africa@gulfbridge.example',
  },
  {
    name: 'Lakeside Clearing Partners',
    roles: ['agent'],
    city: 'Kampala',
    country: 'UG',
    contactName: 'D. Ssempa',
    email: 'desk@lakesideclearing.example',
  },
  {
    name: 'Indigo Ocean Lines',
    roles: ['supplier', 'carrier'],
    city: 'Mombasa',
    country: 'KE',
    contactName: 'Bookings desk',
    email: 'bookings@indigoocean.example',
  },
  {
    name: 'Kestrel Air Cargo',
    roles: ['supplier', 'carrier'],
    city: 'Nairobi (JKIA)',
    country: 'KE',
    contactName: 'Cargo desk',
    email: 'cargo@kestrelair.example',
  },
  {
    name: 'Mara Haulage Ltd',
    roles: ['transporter'],
    city: 'Mombasa',
    country: 'KE',
    contactName: 'G. Kariuki',
    email: 'dispatch@marahaulage.example',
  },
];

/** One fictional account per staff role, so each role's permissions can be tried. */
const DEMO_USERS: { name: string; email: string; role: RoleCode }[] = [
  {
    name: 'A. Wanjiru',
    email: 'a.wanjiru@freight-demo.example',
    role: 'operations',
  },
  { name: 'B. Otieno', email: 'b.otieno@freight-demo.example', role: 'sales' },
  {
    name: 'F. Mwende',
    email: 'f.mwende@freight-demo.example',
    role: 'finance',
  },
  {
    name: 'G. Nduta',
    email: 'g.nduta@freight-demo.example',
    role: 'management',
  },
];

export interface DemoSummary {
  parties: number;
  contacts: number;
  users: number;
}

/**
 * Adds fictional data for development. Safe to re-run; existing rows are left alone.
 * Later phases extend it (quotations, shipments) along with their counters.
 */
export async function seedDemo(db: Db, password: string): Promise<DemoSummary> {
  if (process.env['NODE_ENV'] === 'production') {
    throw new Error('Fictional demo data must never be seeded in production.');
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `DEMO_USER_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    );
  }
  const passwordHash = await hashPassword(password);

  return db.transaction(async (tx) => {
    const { orm } = tx;
    const summary: DemoSummary = { parties: 0, contacts: 0, users: 0 };

    for (const { roles, contactName, ...details } of DEMO_PARTIES) {
      const existing = await orm.public.Party.where({
        name: details.name,
      }).first();
      if (existing) continue;
      const party = await orm.public.Party.create({
        ...details,
        legalName: null,
        kraPin: null,
        phone: null,
        address: null,
        paymentTermsDays: null,
        creditLimit: null,
        accountStatus: 'active',
        notes: null,
        archivedAt: null,
        createdById: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      summary.parties += 1;
      for (const role of roles) {
        await orm.public.PartyRole.create({ partyId: party.id, role });
      }
      await orm.public.Contact.create({
        partyId: party.id,
        name: contactName,
        title: null,
        email: details.email,
        phone: null,
        isPrimary: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      summary.contacts += 1;
    }

    for (const { role, ...details } of DEMO_USERS) {
      const existing = await orm.public.User.where({
        email: details.email,
      }).first();
      if (existing) continue;
      const roleRow = await orm.public.Role.where({ code: role }).first();
      if (!roleRow)
        throw new Error('Run the setup seed (npm run db:seed) first.');
      const user = await orm.public.User.create({
        ...details,
        passwordHash,
        status: 'active',
        lastLoginAt: null,
        partyId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await orm.public.UserRole.create({ userId: user.id, roleId: roleRow.id });
      summary.users += 1;
    }
    return summary;
  });
}
