import type { Numeric } from '@prisma/orm-postgres/target/codec-types';
import type { Db } from '../prisma/prisma.service.js';
import { advanceCounter } from './demo-quotations.js';

// Fictional shipments for development and demonstrations (backend Phase 3). Generated once from the
// frontend's demo shipments (Frontend/frontend/lib/data/demo-data.ts, `seedShipments`) with the same
// references, milestones, delays and exceptions, so links from the remaining demo pages (documents,
// finance, dashboard) open these live records.
//
// Filled in or adapted here (fictional):
// - Staff the backend seed does not have (C. Mutua, D. Achieng, E. Kiprono) are left unassigned.
// - "SGR freight service" is not a seeded carrier, so that shipment has no carrier.
// - Exceptions become issues of type "other"; a customs summary becomes a customs entry with the
//   demo's internal reference (never a KRA iCMS number), or DEMO-CE-<number> when it had none.
// - FMS-SEA-2610-0022 and FMS-AIR-2610-0019 belong to the seeded bookings BKG-2610-0001 and
//   BKG-2610-0002, the bookings of the quotations the demo links them to.

interface DemoShipment {
  reference: string;
  customerName: string;
  mode: 'sea' | 'air' | 'road' | 'rail';
  direction: 'import' | 'export' | 'transit';
  status:
    | 'booked'
    | 'in_transit'
    | 'arrived'
    | 'customs'
    | 'released'
    | 'out_for_delivery'
    | 'delivered'
    | 'on_hold';
  origin: string;
  destination: string;
  carrier: string;
  transportDocRef: string | null;
  equipment: string;
  cargoDescription: string;
  packages: number;
  grossWeightKg: string;
  etd: string | null;
  eta: string | null;
  estimatedDeliveryAt: string | null;
  atd: string | null;
  ata: string | null;
  deliveredAt: string | null;
  assignedTo: string;
  agentName: string | null;
  customs: {
    reference: string | null;
    status:
      | 'documents_pending'
      | 'lodged'
      | 'assessed'
      | 'duty_paid'
      | 'released'
      | 'query'
      | 'not_started';
    updatedAt: string;
  } | null;
  milestones: {
    label: string;
    location: string | null;
    plannedAt: string | null;
    actualAt: string | null;
  }[];
  exceptions: {
    severity: 'low' | 'medium' | 'high';
    message: string;
    raisedAt: string;
  }[];
  delays: {
    reason:
      | 'port_congestion'
      | 'border_queue'
      | 'carrier_schedule'
      | 'customs_query'
      | 'missing_documents'
      | 'permit_pending'
      | 'payment_pending'
      | 'equipment_shortage'
      | 'weather'
      | 'other';
    reasonDetail: string;
    identifiedAt: string;
    severity: 'low' | 'medium' | 'high';
    milestone: string;
    originalExpectedAt: string;
    revisedExpectedAt: string | null;
    affectsEta: boolean;
    status: 'open' | 'monitoring' | 'resolved';
    nextAction: string | null;
    notes: string | null;
    resolvedAt: string | null;
    customerNotification: 'not_notified' | 'informed_manually' | 'not_required';
    customerNotifiedAt: string | null;
  }[];
  updatedAt: string;
}

const BOOKINGS: Record<string, string> = {
  'FMS-SEA-2610-0022': 'BKG-2610-0001',
  'FMS-AIR-2610-0019': 'BKG-2610-0002',
};

const DEMO_SHIPMENTS: DemoShipment[] = [
  {
    reference: 'FMS-SEA-2610-0041',
    customerName: 'Baobab Crest Traders Ltd',
    mode: 'sea',
    direction: 'import',
    status: 'customs',
    origin: 'Shanghai, CN',
    destination: 'Nairobi ICD',
    carrier: 'Indigo Ocean Lines',
    transportDocRef: 'IOL-SHA-778120',
    equipment: '2 × 40ft HC',
    cargoDescription: 'Household appliances',
    packages: 412,
    grossWeightKg: '18640',
    etd: '2026-09-14T00:00:00+03:00',
    eta: '2026-10-12T00:00:00+03:00',
    estimatedDeliveryAt: null,
    atd: '2026-09-14T18:00:00+03:00',
    ata: '2026-10-14T21:00:00+03:00',
    deliveredAt: null,
    assignedTo: 'A. Wanjiru',
    agentName: 'Eastgate Forwarding (Shanghai)',
    customs: {
      reference: 'DEMO-CE-0041',
      status: 'assessed',
      updatedAt: '2026-10-17T15:20:00+03:00',
    },
    milestones: [
      {
        label: 'Booking confirmed',
        location: 'Shanghai',
        plannedAt: null,
        actualAt: '2026-09-08T10:00:00+03:00',
      },
      {
        label: 'Departed origin',
        location: 'Shanghai',
        plannedAt: null,
        actualAt: '2026-09-14T18:00:00+03:00',
      },
      {
        label: 'Arrived Mombasa',
        location: 'Mombasa',
        plannedAt: null,
        actualAt: '2026-10-11T07:30:00+03:00',
      },
      {
        label: 'Railed to Nairobi ICD',
        location: 'Nairobi ICD',
        plannedAt: null,
        actualAt: '2026-10-14T21:00:00+03:00',
      },
      {
        label: 'Customs clearance',
        location: 'Nairobi ICD',
        plannedAt: null,
        actualAt: null,
      },
      {
        label: 'Released',
        location: null,
        plannedAt: null,
        actualAt: null,
      },
      {
        label: 'Delivered',
        location: null,
        plannedAt: null,
        actualAt: null,
      },
    ],
    exceptions: [],
    delays: [],
    updatedAt: '2026-10-17T15:20:00+03:00',
  },
  {
    reference: 'FMS-AIR-2610-0038',
    customerName: 'Ziwa Pharma Distributors Ltd',
    mode: 'air',
    direction: 'import',
    status: 'on_hold',
    origin: 'Mumbai, IN',
    destination: 'Nairobi (JKIA)',
    carrier: 'Kestrel Air Cargo',
    transportDocRef: 'KAC-551-2208734',
    equipment: '6 pallets, temperature-controlled',
    cargoDescription: 'Pharmaceutical products (2–8 °C)',
    packages: 6,
    grossWeightKg: '1240',
    etd: '2026-10-16T02:00:00+03:00',
    eta: '2026-10-16T09:40:00+03:00',
    estimatedDeliveryAt: null,
    atd: '2026-10-16T02:00:00+03:00',
    ata: '2026-10-16T09:40:00+03:00',
    deliveredAt: null,
    assignedTo: 'D. Achieng',
    agentName: null,
    customs: {
      reference: null,
      status: 'documents_pending',
      updatedAt: '2026-10-18T11:05:00+03:00',
    },
    milestones: [
      {
        label: 'Booking confirmed',
        location: 'Mumbai',
        plannedAt: null,
        actualAt: '2026-10-13T09:00:00+03:00',
      },
      {
        label: 'Departed origin',
        location: 'Mumbai',
        plannedAt: null,
        actualAt: '2026-10-16T02:00:00+03:00',
      },
      {
        label: 'Arrived JKIA',
        location: 'Nairobi',
        plannedAt: null,
        actualAt: '2026-10-16T09:40:00+03:00',
      },
      {
        label: 'Customs clearance',
        location: 'JKIA',
        plannedAt: null,
        actualAt: null,
      },
      {
        label: 'Released',
        location: null,
        plannedAt: null,
        actualAt: null,
      },
      {
        label: 'Delivered',
        location: null,
        plannedAt: null,
        actualAt: null,
      },
    ],
    exceptions: [
      {
        severity: 'high',
        message:
          'Product import permit not yet received from the customer; cargo held in cold store.',
        raisedAt: '2026-10-16T12:10:00+03:00',
      },
    ],
    delays: [],
    updatedAt: '2026-10-18T11:05:00+03:00',
  },
  {
    reference: 'FMS-SEA-2610-0035',
    customerName: 'Kijani Build Supplies Ltd',
    mode: 'sea',
    direction: 'import',
    status: 'in_transit',
    origin: 'Jebel Ali, AE',
    destination: 'Mombasa',
    carrier: 'Indigo Ocean Lines',
    transportDocRef: 'IOL-JEA-664501',
    equipment: '4 × 20ft GP',
    cargoDescription: 'Steel fittings and roofing sheets',
    packages: 96,
    grossWeightKg: '74200',
    etd: '2026-10-09T00:00:00+03:00',
    eta: '2026-10-23T00:00:00+03:00',
    estimatedDeliveryAt: null,
    atd: '2026-10-09T22:00:00+03:00',
    ata: null,
    deliveredAt: null,
    assignedTo: 'B. Otieno',
    agentName: 'Gulf Bridge Logistics',
    customs: null,
    milestones: [
      {
        label: 'Booking confirmed',
        location: 'Jebel Ali',
        plannedAt: null,
        actualAt: '2026-10-02T14:00:00+03:00',
      },
      {
        label: 'Departed origin',
        location: 'Jebel Ali',
        plannedAt: null,
        actualAt: '2026-10-09T22:00:00+03:00',
      },
      {
        label: 'Arrived Mombasa',
        location: 'Mombasa',
        plannedAt: null,
        actualAt: null,
      },
      {
        label: 'Customs clearance',
        location: null,
        plannedAt: null,
        actualAt: null,
      },
      {
        label: 'Released',
        location: null,
        plannedAt: null,
        actualAt: null,
      },
      {
        label: 'Delivered',
        location: null,
        plannedAt: null,
        actualAt: null,
      },
    ],
    exceptions: [],
    delays: [],
    updatedAt: '2026-10-18T06:00:00+03:00',
  },
  {
    reference: 'FMS-ROAD-2610-0033',
    customerName: 'Mlima Fresh Exports Ltd',
    mode: 'road',
    direction: 'export',
    status: 'in_transit',
    origin: 'Naivasha',
    destination: 'Kampala, UG (via Malaba)',
    carrier: 'Mara Haulage Ltd',
    transportDocRef: 'MHL-CMR-20931',
    equipment: '1 × reefer truck',
    cargoDescription: 'Fresh produce',
    packages: 840,
    grossWeightKg: '12600',
    etd: '2026-10-18T05:00:00+03:00',
    eta: '2026-10-20T16:00:00+03:00',
    estimatedDeliveryAt: null,
    atd: '2026-10-18T05:00:00+03:00',
    ata: null,
    deliveredAt: null,
    assignedTo: 'C. Mutua',
    agentName: 'Lakeside Clearing Partners',
    customs: {
      reference: 'DEMO-CE-0033',
      status: 'released',
      updatedAt: '2026-10-17T17:45:00+03:00',
    },
    milestones: [
      {
        label: 'Export documents lodged',
        location: 'Naivasha',
        plannedAt: null,
        actualAt: '2026-10-17T10:00:00+03:00',
      },
      {
        label: 'Export cleared',
        location: null,
        plannedAt: null,
        actualAt: '2026-10-17T17:45:00+03:00',
      },
      {
        label: 'Departed Naivasha',
        location: 'Naivasha',
        plannedAt: null,
        actualAt: '2026-10-18T05:00:00+03:00',
      },
      {
        label: 'Malaba border crossing',
        location: 'Malaba',
        plannedAt: null,
        actualAt: null,
      },
      {
        label: 'Delivered Kampala',
        location: null,
        plannedAt: null,
        actualAt: null,
      },
    ],
    exceptions: [],
    delays: [
      {
        reason: 'border_queue',
        reasonDetail:
          'Queue at Malaba border; driver reports an estimated 6-hour delay.',
        identifiedAt: '2026-10-19T07:15:00+03:00',
        severity: 'medium',
        milestone: 'Malaba border crossing',
        originalExpectedAt: '2026-10-20T16:00:00+03:00',
        revisedExpectedAt: '2026-10-20T22:00:00+03:00',
        affectsEta: true,
        status: 'open',
        nextAction: 'Confirm border crossing time with the driver.',
        notes: null,
        resolvedAt: null,
        customerNotification: 'not_notified',
        customerNotifiedAt: null,
      },
    ],
    updatedAt: '2026-10-19T07:15:00+03:00',
  },
  {
    reference: 'FMS-SEA-2610-0030',
    customerName: 'Upeo Electronics Ltd',
    mode: 'sea',
    direction: 'import',
    status: 'released',
    origin: 'Guangzhou (Nansha), CN',
    destination: 'Mombasa',
    carrier: 'Indigo Ocean Lines',
    transportDocRef: 'IOL-NSA-701944',
    equipment: '1 × 40ft HC',
    cargoDescription: 'Consumer electronics accessories',
    packages: 1150,
    grossWeightKg: '9870',
    etd: '2026-09-10T00:00:00+03:00',
    eta: '2026-10-08T00:00:00+03:00',
    estimatedDeliveryAt: null,
    atd: '2026-09-10T20:00:00+03:00',
    ata: '2026-10-08T06:00:00+03:00',
    deliveredAt: null,
    assignedTo: 'A. Wanjiru',
    agentName: 'Eastgate Forwarding (Shanghai)',
    customs: {
      reference: 'DEMO-CE-0030',
      status: 'released',
      updatedAt: '2026-10-16T13:00:00+03:00',
    },
    milestones: [
      {
        label: 'Booking confirmed',
        location: null,
        plannedAt: null,
        actualAt: '2026-09-03T09:00:00+03:00',
      },
      {
        label: 'Departed origin',
        location: 'Nansha',
        plannedAt: null,
        actualAt: '2026-09-10T20:00:00+03:00',
      },
      {
        label: 'Arrived Mombasa',
        location: 'Mombasa',
        plannedAt: null,
        actualAt: '2026-10-08T06:00:00+03:00',
      },
      {
        label: 'Customs clearance',
        location: null,
        plannedAt: null,
        actualAt: '2026-10-15T16:30:00+03:00',
      },
      {
        label: 'Released',
        location: 'Mombasa',
        plannedAt: null,
        actualAt: '2026-10-16T13:00:00+03:00',
      },
      {
        label: 'Truck allocated',
        location: null,
        plannedAt: null,
        actualAt: null,
      },
      {
        label: 'Delivered',
        location: null,
        plannedAt: null,
        actualAt: null,
      },
    ],
    exceptions: [],
    delays: [],
    updatedAt: '2026-10-16T13:00:00+03:00',
  },
  {
    reference: 'FMS-RAIL-2610-0028',
    customerName: 'Kijani Build Supplies Ltd',
    mode: 'rail',
    direction: 'import',
    status: 'out_for_delivery',
    origin: 'Mombasa',
    destination: 'Nairobi (Industrial Area)',
    carrier: 'SGR freight service',
    transportDocRef: 'SGR-RCN-448812',
    equipment: '3 × 20ft GP',
    cargoDescription: 'Ceramic floor tiles',
    packages: 1620,
    grossWeightKg: '61500',
    etd: '2026-10-15T00:00:00+03:00',
    eta: '2026-10-19T14:00:00+03:00',
    estimatedDeliveryAt: null,
    atd: '2026-10-15T19:00:00+03:00',
    ata: '2026-10-16T08:00:00+03:00',
    deliveredAt: null,
    assignedTo: 'E. Kiprono',
    agentName: null,
    customs: {
      reference: 'DEMO-CE-0028',
      status: 'released',
      updatedAt: '2026-10-14T10:00:00+03:00',
    },
    milestones: [
      {
        label: 'Customs released (Mombasa)',
        location: null,
        plannedAt: null,
        actualAt: '2026-10-14T10:00:00+03:00',
      },
      {
        label: 'Loaded on SGR',
        location: 'Mombasa',
        plannedAt: null,
        actualAt: '2026-10-15T19:00:00+03:00',
      },
      {
        label: 'Arrived Nairobi ICD',
        location: 'Nairobi ICD',
        plannedAt: null,
        actualAt: '2026-10-16T08:00:00+03:00',
      },
      {
        label: 'Out for delivery',
        location: null,
        plannedAt: null,
        actualAt: null,
      },
      {
        label: 'Delivered',
        location: null,
        plannedAt: null,
        actualAt: null,
      },
    ],
    exceptions: [],
    delays: [],
    updatedAt: '2026-10-19T07:30:00+03:00',
  },
  {
    reference: 'FMS-SEA-2610-0026',
    customerName: 'Simba Line Textiles Ltd',
    mode: 'sea',
    direction: 'import',
    status: 'arrived',
    origin: 'Nhava Sheva, IN',
    destination: 'Mombasa',
    carrier: 'Indigo Ocean Lines',
    transportDocRef: 'IOL-NSV-659027',
    equipment: '1 × 20ft GP',
    cargoDescription: 'Cotton yarn',
    packages: 320,
    grossWeightKg: '16000',
    etd: '2026-09-29T00:00:00+03:00',
    eta: '2026-10-17T00:00:00+03:00',
    estimatedDeliveryAt: null,
    atd: '2026-09-29T15:00:00+03:00',
    ata: '2026-10-17T05:00:00+03:00',
    deliveredAt: null,
    assignedTo: 'B. Otieno',
    agentName: null,
    customs: {
      reference: null,
      status: 'documents_pending',
      updatedAt: '2026-10-18T09:30:00+03:00',
    },
    milestones: [
      {
        label: 'Booking confirmed',
        location: null,
        plannedAt: null,
        actualAt: '2026-09-22T11:00:00+03:00',
      },
      {
        label: 'Departed origin',
        location: 'Nhava Sheva',
        plannedAt: null,
        actualAt: '2026-09-29T15:00:00+03:00',
      },
      {
        label: 'Arrived Mombasa',
        location: 'Mombasa',
        plannedAt: null,
        actualAt: '2026-10-17T05:00:00+03:00',
      },
      {
        label: 'Customs clearance',
        location: null,
        plannedAt: null,
        actualAt: null,
      },
      {
        label: 'Released',
        location: null,
        plannedAt: null,
        actualAt: null,
      },
      {
        label: 'Delivered',
        location: null,
        plannedAt: null,
        actualAt: null,
      },
    ],
    exceptions: [
      {
        severity: 'medium',
        message:
          'Certificate of origin missing; free storage period ends 2026-10-21.',
        raisedAt: '2026-10-18T09:30:00+03:00',
      },
    ],
    delays: [],
    updatedAt: '2026-10-18T09:30:00+03:00',
  },
  {
    reference: 'FMS-AIR-2610-0024',
    customerName: 'Mlima Fresh Exports Ltd',
    mode: 'air',
    direction: 'export',
    status: 'delivered',
    origin: 'Nairobi (JKIA)',
    destination: 'Amsterdam, NL',
    carrier: 'Kestrel Air Cargo',
    transportDocRef: 'KAC-551-2208611',
    equipment: '14 ULDs',
    cargoDescription: 'Cut flowers',
    packages: 1960,
    grossWeightKg: '8300',
    etd: '2026-10-13T23:30:00+03:00',
    eta: '2026-10-14T07:10:00+03:00',
    estimatedDeliveryAt: null,
    atd: '2026-10-13T23:30:00+03:00',
    ata: '2026-10-14T07:10:00+03:00',
    deliveredAt: '2026-10-14T11:00:00+03:00',
    assignedTo: 'C. Mutua',
    agentName: null,
    customs: {
      reference: 'DEMO-CE-0024',
      status: 'released',
      updatedAt: '2026-10-13T16:00:00+03:00',
    },
    milestones: [
      {
        label: 'Export cleared',
        location: null,
        plannedAt: null,
        actualAt: '2026-10-13T16:00:00+03:00',
      },
      {
        label: 'Departed JKIA',
        location: null,
        plannedAt: null,
        actualAt: '2026-10-13T23:30:00+03:00',
      },
      {
        label: 'Arrived destination',
        location: 'Amsterdam',
        plannedAt: null,
        actualAt: '2026-10-14T07:10:00+03:00',
      },
      {
        label: 'Delivered',
        location: null,
        plannedAt: null,
        actualAt: '2026-10-14T11:00:00+03:00',
      },
    ],
    exceptions: [],
    delays: [],
    updatedAt: '2026-10-14T11:00:00+03:00',
  },
  {
    reference: 'FMS-SEA-2610-0022',
    customerName: 'Baobab Crest Traders Ltd',
    mode: 'sea',
    direction: 'import',
    status: 'booked',
    origin: 'Rotterdam, NL',
    destination: 'Mombasa',
    carrier: 'Indigo Ocean Lines',
    transportDocRef: null,
    equipment: '1 × 40ft HC',
    cargoDescription: 'Packaging machinery',
    packages: 12,
    grossWeightKg: '14300',
    etd: '2026-10-24T00:00:00+03:00',
    eta: '2026-11-18T00:00:00+03:00',
    estimatedDeliveryAt: null,
    atd: null,
    ata: null,
    deliveredAt: null,
    assignedTo: 'A. Wanjiru',
    agentName: null,
    customs: null,
    milestones: [
      {
        label: 'Booking confirmed',
        location: null,
        plannedAt: null,
        actualAt: '2026-10-15T10:00:00+03:00',
      },
      {
        label: 'Cargo collected',
        location: 'Rotterdam',
        plannedAt: null,
        actualAt: null,
      },
      {
        label: 'Departed origin',
        location: null,
        plannedAt: null,
        actualAt: null,
      },
      {
        label: 'Arrived Mombasa',
        location: null,
        plannedAt: null,
        actualAt: null,
      },
      {
        label: 'Customs clearance',
        location: null,
        plannedAt: null,
        actualAt: null,
      },
      {
        label: 'Delivered',
        location: null,
        plannedAt: null,
        actualAt: null,
      },
    ],
    exceptions: [],
    delays: [],
    updatedAt: '2026-10-15T10:00:00+03:00',
  },
  {
    reference: 'FMS-ROAD-2610-0020',
    customerName: 'Upeo Electronics Ltd',
    mode: 'road',
    direction: 'transit',
    status: 'in_transit',
    origin: 'Mombasa',
    destination: 'Kigali, RW (via Busia)',
    carrier: 'Mara Haulage Ltd',
    transportDocRef: 'MHL-CMR-20907',
    equipment: '1 × 40ft HC on flatbed',
    cargoDescription: 'Solar panels (transit cargo)',
    packages: 640,
    grossWeightKg: '13900',
    etd: '2026-10-17T06:00:00+03:00',
    eta: '2026-10-22T18:00:00+03:00',
    estimatedDeliveryAt: null,
    atd: '2026-10-17T06:00:00+03:00',
    ata: null,
    deliveredAt: null,
    assignedTo: 'E. Kiprono',
    agentName: 'Lakeside Clearing Partners',
    customs: {
      reference: 'DEMO-CE-0020',
      status: 'lodged',
      updatedAt: '2026-10-16T12:00:00+03:00',
    },
    milestones: [
      {
        label: 'Transit entry lodged',
        location: null,
        plannedAt: null,
        actualAt: '2026-10-16T12:00:00+03:00',
      },
      {
        label: 'Departed Mombasa',
        location: null,
        plannedAt: null,
        actualAt: '2026-10-17T06:00:00+03:00',
      },
      {
        label: 'Busia border crossing',
        location: 'Busia',
        plannedAt: null,
        actualAt: null,
      },
      {
        label: 'Delivered Kigali',
        location: null,
        plannedAt: null,
        actualAt: null,
      },
    ],
    exceptions: [],
    delays: [],
    updatedAt: '2026-10-18T19:00:00+03:00',
  },
  {
    reference: 'FMS-AIR-2610-0019',
    customerName: 'Upeo Electronics Ltd',
    mode: 'air',
    direction: 'import',
    status: 'customs',
    origin: 'Shenzhen, CN',
    destination: 'Nairobi (JKIA)',
    carrier: 'Kestrel Air Cargo',
    transportDocRef: 'KAC-551-2208590',
    equipment: '3 pallets',
    cargoDescription: 'Mobile phone spare parts',
    packages: 48,
    grossWeightKg: '620',
    etd: '2026-10-15T01:00:00+03:00',
    eta: '2026-10-15T14:20:00+03:00',
    estimatedDeliveryAt: null,
    atd: '2026-10-15T01:00:00+03:00',
    ata: '2026-10-15T14:20:00+03:00',
    deliveredAt: null,
    assignedTo: 'D. Achieng',
    agentName: 'Eastgate Forwarding (Shanghai)',
    customs: {
      reference: 'DEMO-CE-0019',
      status: 'query',
      updatedAt: '2026-10-18T16:40:00+03:00',
    },
    milestones: [
      {
        label: 'Departed origin',
        location: null,
        plannedAt: null,
        actualAt: '2026-10-15T01:00:00+03:00',
      },
      {
        label: 'Arrived JKIA',
        location: null,
        plannedAt: null,
        actualAt: '2026-10-15T14:20:00+03:00',
      },
      {
        label: 'Customs clearance',
        location: null,
        plannedAt: null,
        actualAt: null,
      },
      {
        label: 'Released',
        location: null,
        plannedAt: null,
        actualAt: null,
      },
      {
        label: 'Delivered',
        location: null,
        plannedAt: null,
        actualAt: null,
      },
    ],
    exceptions: [
      {
        severity: 'high',
        message:
          'Customs valuation query on declared unit prices; supplier price list requested.',
        raisedAt: '2026-10-18T16:40:00+03:00',
      },
    ],
    delays: [],
    updatedAt: '2026-10-18T16:40:00+03:00',
  },
];

const REGIME = {
  import: 'import_home_use',
  export: 'export',
  transit: 'transit',
} as const;

const date = (value: string | null) => (value ? new Date(value) : null);

/**
 * Adds the fictional shipments. Safe to re-run: shipments whose reference exists are left alone,
 * and the shipment counter only moves forward. Run after `seedDemo` and `seedDemoQuotations`.
 */
export async function seedDemoShipments(
  db: Db,
  at: Date = new Date(),
): Promise<{ shipments: number }> {
  if (process.env['NODE_ENV'] === 'production') {
    throw new Error('Fictional demo data must never be seeded in production.');
  }
  return db.transaction(async (tx) => {
    const { orm } = tx;
    let shipments = 0;
    const partyId = async (name: string | null) =>
      name
        ? ((await orm.public.Party.where({ name }).first())?.id ?? null)
        : null;
    for (const [index, demo] of DEMO_SHIPMENTS.entries()) {
      if (
        await orm.public.Shipment.where({ reference: demo.reference }).first()
      ) {
        continue;
      }
      const customerId = await partyId(demo.customerName);
      if (!customerId)
        throw new Error('Run the fictional data seed (seedDemo) first.');
      const bookingReference = BOOKINGS[demo.reference];
      const booking = bookingReference
        ? await orm.public.Booking.where({
            reference: bookingReference,
          }).first()
        : null;
      const assignee = await orm.public.User.where({
        name: demo.assignedTo,
      }).first();
      const updatedAt = new Date(demo.updatedAt);
      const firstTime = demo.milestones.find((m) => m.actualAt)?.actualAt;
      const createdAt = date(firstTime ?? demo.etd) ?? updatedAt;
      const shipment = await orm.public.Shipment.create({
        reference: demo.reference,
        bookingId: booking?.id ?? null,
        customerId,
        carrierId: await partyId(demo.carrier),
        agentId: await partyId(demo.agentName),
        assignedToId: assignee?.id ?? null,
        mode: demo.mode,
        direction: demo.direction,
        status: demo.status,
        origin: demo.origin,
        destination: demo.destination,
        transportDocRef: demo.transportDocRef,
        vesselOrFlight: null,
        voyageNumber: null,
        equipment: demo.equipment,
        cargoDescription: demo.cargoDescription,
        packages: demo.packages,
        grossWeightKg: `${demo.grossWeightKg}.000` as Numeric<12, 3>,
        volumeCbm: null,
        etd: date(demo.etd),
        eta: date(demo.eta),
        estimatedDeliveryAt: date(demo.estimatedDeliveryAt),
        atd: date(demo.atd),
        ata: date(demo.ata),
        deliveredAt: date(demo.deliveredAt),
        createdById: null,
        createdAt,
        updatedAt,
      });
      const milestoneIds = new Map<string, number>();
      for (const [sequence, m] of demo.milestones.entries()) {
        const row = await orm.public.ShipmentMilestone.create({
          shipmentId: shipment.id,
          sequence: sequence + 1,
          label: m.label,
          location: m.location,
          plannedAt: date(m.plannedAt),
          actualAt: date(m.actualAt),
          note: null,
          recordedById: null,
          createdAt,
          updatedAt,
        });
        milestoneIds.set(m.label, row.id);
      }
      for (const d of demo.delays) {
        await orm.public.ShipmentIssue.create({
          shipmentId: shipment.id,
          type: 'delay',
          severity: d.severity,
          reason: d.reason,
          reasonDetail: d.reasonDetail,
          identifiedAt: new Date(d.identifiedAt),
          affectedMilestoneId: milestoneIds.get(d.milestone) ?? null,
          originalExpectedAt: new Date(d.originalExpectedAt),
          revisedExpectedAt: date(d.revisedExpectedAt),
          affectsEta: d.affectsEta,
          followUpUserId: assignee?.id ?? null,
          status: d.status,
          nextAction: d.nextAction,
          notes: d.notes,
          resolvedAt: date(d.resolvedAt),
          resolution: null,
          customerNotification: d.customerNotification,
          customerNotifiedAt: date(d.customerNotifiedAt),
          createdById: null,
          createdAt: new Date(d.identifiedAt),
          updatedAt,
        });
      }
      for (const e of demo.exceptions) {
        await orm.public.ShipmentIssue.create({
          shipmentId: shipment.id,
          type: 'other',
          severity: e.severity,
          reason: null,
          reasonDetail: e.message,
          identifiedAt: new Date(e.raisedAt),
          affectedMilestoneId: null,
          originalExpectedAt: null,
          revisedExpectedAt: null,
          affectsEta: false,
          followUpUserId: assignee?.id ?? null,
          status: 'open',
          nextAction: null,
          notes: null,
          resolvedAt: null,
          resolution: null,
          customerNotification: 'not_notified',
          customerNotifiedAt: null,
          createdById: null,
          createdAt: new Date(e.raisedAt),
          updatedAt,
        });
      }
      if (demo.customs) {
        const reference =
          demo.customs.reference ??
          `DEMO-CE-${String(index + 1).padStart(4, '0')}`;
        const customsAt = new Date(demo.customs.updatedAt);
        const lodged = !['not_started', 'documents_pending'].includes(
          demo.customs.status,
        );
        if (!(await orm.public.CustomsEntry.where({ reference }).first())) {
          await orm.public.CustomsEntry.create({
            reference,
            shipmentId: shipment.id,
            declarationNumber: null,
            regime: REGIME[demo.direction],
            customsStation: null,
            status: demo.customs.status,
            lodgedAt: lodged ? customsAt : null,
            assessedAt: ['assessed', 'duty_paid', 'released'].includes(
              demo.customs.status,
            )
              ? customsAt
              : null,
            releasedAt: demo.customs.status === 'released' ? customsAt : null,
            releaseOrderNumber: null,
            queryDetails:
              demo.customs.status === 'query'
                ? 'Fictional demo query: valuation of the declared goods.'
                : null,
            legalHold: false,
            legalHoldReason: null,
            createdById: null,
            createdAt: customsAt,
            updatedAt: customsAt,
          });
        }
      }
      await orm.public.AuditLog.create({
        actorUserId: null,
        entityType: 'Shipment',
        entityId: shipment.id,
        action: 'create',
        summary: 'Fictional demo shipment added by the demo seed.',
        changes: null,
        occurredAt: createdAt,
      });
      shipments += 1;
    }
    await advanceCounter(
      db,
      tx,
      'shipment',
      Math.max(
        ...DEMO_SHIPMENTS.map((s) => Number(s.reference.split('-').at(-1))),
      ),
      at,
    );
    return { shipments };
  });
}
