export const DOCUMENT_TYPES = [
  'shipment',
  'quotation',
  'invoice',
  'booking',
  'credit_note',
  'payment',
  'customs_entry',
] as const;
export type ContractDocumentType = (typeof DOCUMENT_TYPES)[number];

export const RESET_POLICIES = ['never', 'yearly', 'monthly'] as const;
export type ContractResetPolicy = (typeof RESET_POLICIES)[number];

export const TRANSPORT_MODES = ['sea', 'air', 'road', 'rail'] as const;
export type ContractTransportMode = (typeof TRANSPORT_MODES)[number];
