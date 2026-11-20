import type { Numeric } from '@prisma/orm-postgres/target/codec-types';
import type { Db, Tx } from '../prisma/prisma.service.js';
import {
  counterPeriod,
  nairobiDateParts,
} from '../references/reference-template.js';

// Fictional quotations and bookings for development (backend Phase 2). They mirror the frontend's
// demo quotations (Frontend/frontend/lib/data/demo-data.ts, `seedQuotations`) with the same
// references, so links from the remaining demo pages open these live records. Like the frontend
// demo, each quotation has one line holding its recorded total, at 0% tax.
//
// Not in the frontend demo, so filled in here (fictional): sent and decision times, and the two
// bookings for the quotations the demo shows as "booked". Dates are fixed, so draft and sent
// quotations whose validity has passed show as expired, as the backend derives it.

const TERMS =
  'Demonstration terms only. Rates are subject to space and equipment availability and exclude duties, taxes and storage unless itemised.';

type Mode = 'sea' | 'air' | 'road' | 'rail';
type DemoStatus =
  'draft' | 'sent' | 'accepted' | 'booked' | 'declined' | 'expired';

interface DemoQuotation {
  reference: string;
  customerName: string;
  mode: Mode;
  direction: 'import' | 'export';
  origin: string;
  destination: string;
  cargoSummary: string;
  amountKes: string;
  status: DemoStatus;
  createdAt: string;
  validUntil: string;
  booking?: string;
}

const DEMO_QUOTATIONS: DemoQuotation[] = [
  {
    reference: 'QT-2610-0057',
    customerName: 'Ziwa Pharma Distributors Ltd',
    mode: 'air',
    direction: 'import',
    origin: 'Hyderabad, IN',
    destination: 'Nairobi (JKIA)',
    cargoSummary: '4 pallets, 2–8 °C, ~900 kg',
    amountKes: '612000',
    status: 'sent',
    createdAt: '2026-10-18T10:00:00+03:00',
    validUntil: '2026-10-25',
  },
  {
    reference: 'QT-2610-0056',
    customerName: 'Kijani Build Supplies Ltd',
    mode: 'sea',
    direction: 'import',
    origin: 'Jebel Ali, AE',
    destination: 'Nairobi ICD',
    cargoSummary: '6 × 20ft GP, steel products',
    amountKes: '1480500',
    status: 'draft',
    createdAt: '2026-10-18T15:30:00+03:00',
    validUntil: '2026-11-01',
  },
  {
    reference: 'QT-2610-0054',
    customerName: 'Mlima Fresh Exports Ltd',
    mode: 'road',
    direction: 'export',
    origin: 'Naivasha',
    destination: 'Kampala, UG',
    cargoSummary: '1 reefer truck, fresh produce',
    amountKes: '285000',
    status: 'accepted',
    createdAt: '2026-10-16T09:00:00+03:00',
    validUntil: '2026-10-30',
  },
  {
    reference: 'QT-2610-0051',
    customerName: 'Baobab Crest Traders Ltd',
    mode: 'sea',
    direction: 'import',
    origin: 'Rotterdam, NL',
    destination: 'Mombasa',
    cargoSummary: '1 × 40ft HC, machinery',
    amountKes: '968000',
    status: 'booked',
    createdAt: '2026-10-10T11:00:00+03:00',
    validUntil: '2026-10-24',
    booking: 'BKG-2610-0001',
  },
  {
    reference: 'QT-2610-0049',
    customerName: 'Upeo Electronics Ltd',
    mode: 'rail',
    direction: 'import',
    origin: 'Mombasa',
    destination: 'Nairobi ICD',
    cargoSummary: '2 × 40ft HC, electronics',
    amountKes: '344000',
    status: 'sent',
    createdAt: '2026-10-09T14:00:00+03:00',
    validUntil: '2026-10-20',
  },
  {
    reference: 'QT-2610-0046',
    customerName: 'Simba Line Textiles Ltd',
    mode: 'sea',
    direction: 'import',
    origin: 'Chittagong, BD',
    destination: 'Mombasa',
    cargoSummary: '2 × 20ft GP, fabrics',
    amountKes: '702400',
    status: 'declined',
    createdAt: '2026-10-05T10:00:00+03:00',
    validUntil: '2026-10-19',
  },
  {
    reference: 'QT-2609-0041',
    customerName: 'Upeo Electronics Ltd',
    mode: 'air',
    direction: 'import',
    origin: 'Shenzhen, CN',
    destination: 'Nairobi (JKIA)',
    cargoSummary: '3 pallets, ~620 kg',
    amountKes: '418600',
    status: 'booked',
    createdAt: '2026-09-30T10:00:00+03:00',
    validUntil: '2026-10-14',
    booking: 'BKG-2610-0002',
  },
  {
    reference: 'QT-2609-0038',
    customerName: 'Baobab Crest Traders Ltd',
    mode: 'air',
    direction: 'import',
    origin: 'Istanbul, TR',
    destination: 'Nairobi (JKIA)',
    cargoSummary: '2 pallets, spare parts',
    amountKes: '226000',
    status: 'expired',
    createdAt: '2026-09-25T10:00:00+03:00',
    validUntil: '2026-10-09',
  },
];

const HOUR = 60 * 60 * 1000;

export interface DemoQuotationSummary {
  quotations: number;
  bookings: number;
}

/** The running number at the end of a reference such as QT-2610-0057. */
const sequenceOf = (reference: string) => Number(reference.split('-').at(-1));

/**
 * Adds the fictional quotations and bookings. Safe to re-run: records whose reference already
 * exists are left alone, and counters only ever move forward, so references issued later continue
 * after the seeded ones. Run after `seedDemo` (it needs the fictional customers).
 */
export async function seedDemoQuotations(
  db: Db,
  at: Date = new Date(),
): Promise<DemoQuotationSummary> {
  if (process.env['NODE_ENV'] === 'production') {
    throw new Error('Fictional demo data must never be seeded in production.');
  }

  return db.transaction(async (tx) => {
    const { orm } = tx;
    const summary: DemoQuotationSummary = { quotations: 0, bookings: 0 };

    for (const demo of DEMO_QUOTATIONS) {
      const customer = await orm.public.Party.where({
        name: demo.customerName,
      }).first();
      if (!customer) {
        throw new Error('Run the fictional data seed (seedDemo) first.');
      }
      const created = new Date(demo.createdAt);
      const issueDate = demo.createdAt.slice(0, 10);
      const sent = demo.status !== 'draft';
      const decided = ['accepted', 'booked', 'declined'].includes(demo.status);
      const sentAt = sent ? new Date(created.getTime() + 2 * HOUR) : null;
      const decidedAt = decided
        ? new Date(created.getTime() + 26 * HOUR)
        : null;

      let quotation = await orm.public.Quotation.where({
        reference: demo.reference,
      }).first();
      if (!quotation) {
        quotation = await orm.public.Quotation.create({
          reference: demo.reference,
          customerId: customer.id,
          agentId: null,
          mode: demo.mode,
          direction: demo.direction,
          origin: demo.origin,
          destination: demo.destination,
          incoterm: null,
          cargoSummary: demo.cargoSummary,
          packages: null,
          grossWeightKg: null,
          volumeCbm: null,
          terms: TERMS,
          internalNote: null,
          // "Booked" is not stored (a booking exists); "expired" is derived from validUntil.
          status:
            demo.status === 'booked'
              ? 'accepted'
              : demo.status === 'expired'
                ? 'sent'
                : demo.status,
          issueDate,
          validUntil: demo.validUntil,
          sentAt,
          sentTo: sent ? customer.email : null,
          decidedAt,
          duplicatedFromId: null,
          preparedById: null,
          createdAt: created,
          updatedAt: decidedAt ?? sentAt ?? created,
        });
        await orm.public.QuotationLine.create({
          quotationId: quotation.id,
          chargeTypeId: null,
          description: `Freight and handling: ${demo.cargoSummary} (recorded total; no breakdown in demo data)`,
          quantity: '1.000' as Numeric<12, 3>,
          unitPrice: `${demo.amountKes}.00` as Numeric<14, 2>,
          taxCategory: 'standard',
          taxRate: '0.00' as Numeric<5, 2>,
          sortOrder: 0,
        });
        summary.quotations += 1;
      }

      if (demo.booking) {
        const existing = await orm.public.Booking.where({
          reference: demo.booking,
        }).first();
        const forQuotation = await orm.public.Booking.where({
          quotationId: quotation.id,
        }).first();
        if (!existing && !forQuotation) {
          const confirmedAt = new Date(decidedAt!.getTime() + 3 * HOUR);
          await orm.public.Booking.create({
            reference: demo.booking,
            quotationId: quotation.id,
            customerId: customer.id,
            carrierId: null,
            agentId: null,
            carrierBookingNumber: null,
            mode: demo.mode,
            direction: demo.direction,
            origin: demo.origin,
            destination: demo.destination,
            cargoSummary: demo.cargoSummary,
            plannedEtd: null,
            plannedEta: null,
            status: 'confirmed',
            confirmedAt,
            cancelledAt: null,
            cancellationReason: null,
            createdById: null,
            createdAt: decidedAt!,
            updatedAt: confirmedAt,
          });
          summary.bookings += 1;
        }
      }
    }

    await advanceCounter(
      db,
      tx,
      'quotation',
      Math.max(...DEMO_QUOTATIONS.map((q) => sequenceOf(q.reference))),
      at,
    );
    await advanceCounter(
      db,
      tx,
      'booking',
      Math.max(
        ...DEMO_QUOTATIONS.flatMap((q) =>
          q.booking ? [sequenceOf(q.booking)] : [],
        ),
      ),
      at,
    );
    return summary;
  });
}

/**
 * Makes sure the document type's current counter will issue a number above `highest`. It never
 * moves a counter back. (The reference service also skips any number already in use.)
 */
async function advanceCounter(
  db: Db,
  tx: Tx,
  documentType: 'quotation' | 'booking',
  highest: number,
  at: Date,
): Promise<void> {
  const format = await tx.orm.public.ReferenceFormat.where({
    documentType,
  }).first();
  if (!format) throw new Error('Run the setup seed (npm run db:seed) first.');
  const period = counterPeriod(format.resetPolicy, nairobiDateParts(at));
  await tx.query(
    db.raw.sql`
      INSERT INTO "NumberSequence" ("prefix", "year", "nextValue")
      VALUES (${documentType}, ${period}::int, ${highest + 1}::int)
      ON CONFLICT ("prefix", "year")
      DO UPDATE SET "nextValue" = GREATEST("NumberSequence"."nextValue", EXCLUDED."nextValue")
      RETURNING "nextValue"
    `
      .returnsRow({ nextValue: 'pg/int4@1' })
      .build(),
  );
}
