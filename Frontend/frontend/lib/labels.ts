// Human-readable labels and badge tones for domain enums.

import type {
  CustomsStatus,
  DocumentStatus,
  DocumentType,
  InvoiceStatus,
  PartyType,
  PaymentMethod,
  QuotationStatus,
  Severity,
  ShipmentDirection,
  ShipmentStatus,
  TransportMode,
} from '@/lib/types';

export type Tone = 'neutral' | 'info' | 'progress' | 'success' | 'warning' | 'danger';

export interface StatusMeta {
  label: string;
  tone: Tone;
}

export const shipmentStatusMeta: Record<ShipmentStatus, StatusMeta> = {
  booked: { label: 'Booked', tone: 'neutral' },
  in_transit: { label: 'In transit', tone: 'info' },
  arrived: { label: 'Arrived', tone: 'progress' },
  customs: { label: 'In customs', tone: 'progress' },
  released: { label: 'Released', tone: 'success' },
  out_for_delivery: { label: 'Out for delivery', tone: 'info' },
  delivered: { label: 'Delivered', tone: 'success' },
  on_hold: { label: 'On hold', tone: 'danger' },
};

/** Display order for status filters and breakdowns (workflow order). */
export const shipmentStatusOrder: ShipmentStatus[] = [
  'booked',
  'in_transit',
  'arrived',
  'customs',
  'on_hold',
  'released',
  'out_for_delivery',
  'delivered',
];

export const customsStatusMeta: Record<CustomsStatus, StatusMeta> = {
  not_started: { label: 'Not started', tone: 'neutral' },
  documents_pending: { label: 'Documents pending', tone: 'warning' },
  lodged: { label: 'Entry lodged', tone: 'info' },
  assessed: { label: 'Duty assessed', tone: 'progress' },
  duty_paid: { label: 'Duty paid', tone: 'progress' },
  released: { label: 'Released', tone: 'success' },
  query: { label: 'Customs query', tone: 'danger' },
};

export const documentTypeLabel: Record<DocumentType, string> = {
  bill_of_lading: 'Bill of lading',
  air_waybill: 'Air waybill',
  road_consignment_note: 'Road consignment note (CMR)',
  packing_list: 'Packing list',
  commercial_invoice: 'Commercial invoice',
  certificate_of_origin: 'Certificate of origin',
  import_declaration_form: 'Import declaration form',
};

export const documentStatusMeta: Record<DocumentStatus, StatusMeta> = {
  missing: { label: 'Missing', tone: 'warning' },
  received: { label: 'Received', tone: 'info' },
  verified: { label: 'Verified', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
};

export const quotationStatusMeta: Record<QuotationStatus, StatusMeta> = {
  draft: { label: 'Draft', tone: 'neutral' },
  sent: { label: 'Sent', tone: 'info' },
  accepted: { label: 'Accepted', tone: 'progress' },
  booked: { label: 'Booked', tone: 'success' },
  declined: { label: 'Declined', tone: 'danger' },
  expired: { label: 'Expired', tone: 'neutral' },
};

export const invoiceStatusMeta: Record<InvoiceStatus, StatusMeta> = {
  draft: { label: 'Draft', tone: 'neutral' },
  issued: { label: 'Issued', tone: 'info' },
  part_paid: { label: 'Part paid', tone: 'progress' },
  paid: { label: 'Paid', tone: 'success' },
  overdue: { label: 'Overdue', tone: 'danger' },
};

export const severityMeta: Record<Severity, StatusMeta> = {
  low: { label: 'Low', tone: 'neutral' },
  medium: { label: 'Medium', tone: 'warning' },
  high: { label: 'High', tone: 'danger' },
};

export const modeLabel: Record<TransportMode, string> = {
  sea: 'Sea',
  air: 'Air',
  road: 'Road',
  rail: 'Rail',
};

export const directionLabel: Record<ShipmentDirection, string> = {
  import: 'Import',
  export: 'Export',
  transit: 'Transit',
};

export const partyTypeLabel: Record<PartyType, string> = {
  customer: 'Customer',
  agent: 'Freight agent',
  supplier: 'Carrier / supplier',
  transporter: 'Transporter',
};

export const paymentMethodLabel: Record<PaymentMethod, string> = {
  mpesa: 'M-Pesa',
  bank_transfer: 'Bank transfer',
  cheque: 'Cheque',
};
