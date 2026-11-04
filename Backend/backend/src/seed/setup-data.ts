import type {
  ContractDocumentType,
  ContractResetPolicy,
} from '../references/reference.types.js';

/** Staff and portal roles from the repository owner's matrix (docs/database-design.md §6). */
export const ROLES = [
  { code: 'admin', name: 'Administrator' },
  { code: 'finance', name: 'Finance' },
  { code: 'operations', name: 'Operations' },
  { code: 'sales', name: 'Sales' },
  { code: 'management', name: 'Management' },
  { code: 'customer', name: 'Customer' },
] as const;

export type RoleCode = (typeof ROLES)[number]['code'];

export const PERMISSIONS: Record<string, string> = {
  'users.manage': 'Manage staff accounts and roles',
  'settings.references.manage': 'Change reference number formats',
  'credit.override': 'Proceed past a credit-limit warning',
  'parties.view': 'View customers and partners',
  'parties.manage': 'Create and edit customers and partners',
  'parties.billing.view': 'View customer billing information',
  'parties.billing.manage': 'Change payment terms and credit limits',
  'parties.status.manage': 'Change customer account status (on hold, closed)',
  'quotations.view': 'View quotations and bookings',
  'quotations.manage': 'Create and edit quotations and bookings',
  'shipments.view': 'View shipments and tracking',
  'shipments.manage': 'Create and edit shipments and tracking',
  'customs.view': 'View customs assessments and charges',
  'customs.manage': 'Manage clearance records and documents',
  'invoices.view': 'View invoices',
  'invoices.manage': 'Create and issue invoices and credit notes',
  'payments.view': 'View payments and financial records',
  'payments.manage': 'Record and reconcile payments',
  'charges.view': 'View charges relevant to a job',
  'transactions.approve': 'Approve transactions',
  'reports.view': 'View reports',
  'portal.own.view': 'View own documents, invoices and shipments in the portal',
};

const allStaffPermissions = Object.keys(PERMISSIONS).filter(
  (code) => code !== 'portal.own.view',
);

/** Starting grants, translated from the matrix. Adjustable later as data. */
export const ROLE_PERMISSIONS: Record<RoleCode, string[]> = {
  admin: allStaffPermissions,
  finance: [
    'credit.override',
    'parties.view',
    'parties.billing.view',
    'parties.billing.manage',
    'quotations.view',
    'shipments.view',
    'customs.view',
    'invoices.view',
    'invoices.manage',
    'payments.view',
    'payments.manage',
    'charges.view',
    'reports.view',
  ],
  operations: [
    'parties.view',
    'quotations.view',
    'shipments.view',
    'shipments.manage',
    'customs.view',
    'customs.manage',
    'invoices.view',
    'charges.view',
  ],
  sales: [
    'parties.view',
    'parties.manage',
    'parties.billing.view',
    'quotations.view',
    'quotations.manage',
    'shipments.view',
  ],
  management: [
    'credit.override',
    'parties.view',
    'parties.billing.view',
    'parties.billing.manage',
    'parties.status.manage',
    'quotations.view',
    'shipments.view',
    'customs.view',
    'invoices.view',
    'payments.view',
    'charges.view',
    'transactions.approve',
    'reports.view',
  ],
  customer: ['portal.own.view'],
};

export const REFERENCE_FORMATS: {
  documentType: ContractDocumentType;
  template: string;
  resetPolicy: ContractResetPolicy;
}[] = [
  {
    documentType: 'shipment',
    template: 'FMS-{MODE}-{YYMM}-{SEQ:4}',
    resetPolicy: 'never',
  },
  {
    documentType: 'quotation',
    template: 'QT-{YYMM}-{SEQ:4}',
    resetPolicy: 'never',
  },
  {
    documentType: 'invoice',
    template: 'INV-{YYMM}-{SEQ:4}',
    resetPolicy: 'never',
  },
  {
    documentType: 'booking',
    template: 'BKG-{YYMM}-{SEQ:4}',
    resetPolicy: 'never',
  },
  {
    documentType: 'credit_note',
    template: 'CN-{YYMM}-{SEQ:4}',
    resetPolicy: 'never',
  },
  {
    documentType: 'payment',
    template: 'RCT-{YYMM}-{SEQ:4}',
    resetPolicy: 'never',
  },
  {
    documentType: 'customs_entry',
    template: 'CE-{YYMM}-{SEQ:4}',
    resetPolicy: 'never',
  },
];

export const RETENTION_POLICIES = [
  {
    recordCategory: 'financial_and_customs_records',
    retentionYears: 5,
    basis: 'end_of_reporting_period',
    description:
      'Five years from the end of the reporting period; longer under legal hold for amended assessments or ongoing proceedings.',
  },
];

type Category =
  | 'service_fee'
  | 'carrier'
  | 'transport'
  | 'handling'
  | 'storage'
  | 'customs'
  | 'agent_fees'
  | 'other';

const VAT = {
  defaultTaxCategory: 'standard',
  defaultTaxRate: '16.00',
} as const;
const NO_VAT = {
  defaultTaxCategory: 'outside_vat',
  defaultTaxRate: '0.00',
} as const;

/** Starting defaults for staff to adjust. Tax treatment needs the company accountant's review. */
export const CHARGE_TYPES: {
  code: string;
  name: string;
  category: Category;
  defaultTaxCategory: 'standard' | 'outside_vat';
  defaultTaxRate: string;
  isDisbursement: boolean;
}[] = [
  {
    code: 'CLEARING_FEE',
    name: 'Clearing fee',
    category: 'service_fee',
    isDisbursement: false,
    ...VAT,
  },
  {
    code: 'AGENCY_FEE',
    name: 'Agency fee',
    category: 'service_fee',
    isDisbursement: false,
    ...VAT,
  },
  {
    code: 'FREIGHT',
    name: 'Freight',
    category: 'carrier',
    isDisbursement: false,
    ...VAT,
  },
  {
    code: 'TRANSPORT',
    name: 'Local transport',
    category: 'transport',
    isDisbursement: false,
    ...VAT,
  },
  {
    code: 'HANDLING',
    name: 'Handling',
    category: 'handling',
    isDisbursement: false,
    ...VAT,
  },
  {
    code: 'STORAGE',
    name: 'Storage',
    category: 'storage',
    isDisbursement: false,
    ...VAT,
  },
  {
    code: 'AGENT_FEE',
    name: 'Overseas agent fee',
    category: 'agent_fees',
    isDisbursement: false,
    ...VAT,
  },
  {
    code: 'PORT_CHARGES',
    name: 'Port charges',
    category: 'handling',
    isDisbursement: true,
    ...NO_VAT,
  },
  {
    code: 'IMPORT_DUTY',
    name: 'Import duty',
    category: 'customs',
    isDisbursement: true,
    ...NO_VAT,
  },
  {
    code: 'EXCISE_DUTY',
    name: 'Excise duty',
    category: 'customs',
    isDisbursement: true,
    ...NO_VAT,
  },
  {
    code: 'IMPORT_VAT',
    name: 'VAT on imports',
    category: 'customs',
    isDisbursement: true,
    ...NO_VAT,
  },
  {
    code: 'IDF_FEE',
    name: 'Import declaration fee',
    category: 'customs',
    isDisbursement: true,
    ...NO_VAT,
  },
  {
    code: 'RDL',
    name: 'Railway development levy',
    category: 'customs',
    isDisbursement: true,
    ...NO_VAT,
  },
  {
    code: 'OTHER',
    name: 'Other',
    category: 'other',
    isDisbursement: false,
    ...VAT,
  },
];
