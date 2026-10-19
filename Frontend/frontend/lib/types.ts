// Domain types for the freight-management frontend.
// These describe what the UI expects. The backend does not implement these
// entities yet (see Frontend/frontend/docs/api-contracts.md); the demo provider in
// lib/data/demo-data.ts produces data in these shapes.

export type TransportMode = 'sea' | 'air' | 'road' | 'rail';
export type ShipmentDirection = 'import' | 'export' | 'transit';

export type ShipmentStatus =
  | 'booked'
  | 'in_transit'
  | 'arrived'
  | 'customs'
  | 'released'
  | 'out_for_delivery'
  | 'delivered'
  | 'on_hold';

export type MilestoneState = 'done' | 'current' | 'pending';

export interface Milestone {
  label: string;
  state: MilestoneState;
  /** ISO date-time, when known. */
  at?: string;
  location?: string;
}

export type Severity = 'low' | 'medium' | 'high';

export interface ShipmentException {
  id: string;
  severity: Severity;
  message: string;
  raisedAt: string;
}

export type CustomsStatus =
  | 'not_started'
  | 'documents_pending'
  | 'lodged'
  | 'assessed'
  | 'duty_paid'
  | 'released'
  | 'query';

export interface CustomsEntry {
  /** Internal reference only. Not a KRA iCMS entry number. */
  entryReference?: string;
  status: CustomsStatus;
  dutyKes?: number;
  updatedAt: string;
}

export interface Shipment {
  reference: string;
  customerId: string;
  customerName: string;
  mode: TransportMode;
  direction: ShipmentDirection;
  status: ShipmentStatus;
  origin: string;
  destination: string;
  carrier: string;
  /** B/L, AWB, CMR or rail consignment number. */
  transportDocRef: string;
  equipment: string;
  cargoDescription: string;
  packages: number;
  weightKg: number;
  etd?: string;
  eta: string;
  assignedTo: string;
  agentName?: string;
  customs: CustomsEntry;
  milestones: Milestone[];
  exceptions: ShipmentException[];
  updatedAt: string;
}

export type DocumentType =
  | 'bill_of_lading'
  | 'air_waybill'
  | 'road_consignment_note'
  | 'packing_list'
  | 'commercial_invoice'
  | 'certificate_of_origin'
  | 'import_declaration_form';

export type DocumentStatus = 'missing' | 'received' | 'verified' | 'rejected';

export interface ShipmentDocument {
  id: string;
  shipmentReference: string;
  customerName: string;
  type: DocumentType;
  status: DocumentStatus;
  receivedAt?: string;
  note?: string;
}

export type QuotationStatus =
  | 'draft'
  | 'sent'
  | 'accepted'
  | 'booked'
  | 'declined'
  | 'expired';

export interface Quotation {
  reference: string;
  customerName: string;
  mode: TransportMode;
  direction: ShipmentDirection;
  origin: string;
  destination: string;
  cargoSummary: string;
  amountKes: number;
  status: QuotationStatus;
  createdAt: string;
  validUntil: string;
  /** Set once the quotation has been converted into a shipment. */
  shipmentReference?: string;
}

export type PartyType = 'customer' | 'agent' | 'supplier' | 'transporter';

export interface Party {
  id: string;
  name: string;
  type: PartyType;
  location: string;
  contactName: string;
  /** Always a reserved `.example` domain in demo data. */
  email: string;
  activeShipments: number;
  outstandingKes?: number;
}

export type InvoiceStatus = 'draft' | 'issued' | 'part_paid' | 'paid' | 'overdue';

export interface Invoice {
  number: string;
  customerName: string;
  shipmentReference: string;
  amountKes: number;
  paidKes: number;
  issuedAt: string;
  dueAt: string;
  status: InvoiceStatus;
}

export type PaymentMethod = 'mpesa' | 'bank_transfer' | 'cheque';

export interface Payment {
  id: string;
  invoiceNumber: string;
  customerName: string;
  method: PaymentMethod;
  amountKes: number;
  receivedAt: string;
  reference: string;
  reconciled: boolean;
}

export interface Expense {
  id: string;
  shipmentReference: string;
  description: string;
  payee: string;
  amountKes: number;
  incurredAt: string;
  status: 'pending_approval' | 'approved' | 'paid';
}

export interface ActivityItem {
  id: string;
  at: string;
  actor: string;
  message: string;
  shipmentReference?: string;
}

export interface Task {
  id: string;
  title: string;
  dueAt: string;
  priority: Severity;
  assignee: string;
  shipmentReference?: string;
}

/** Where a piece of data came from. Only 'live' means a real backend response. */
export type DataSource = 'demo' | 'live';

export interface Sourced<T> {
  data: T;
  source: DataSource;
}
