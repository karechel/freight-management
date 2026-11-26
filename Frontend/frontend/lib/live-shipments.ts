// Live shipments (backend Phase 3): the API's shapes, list filters, and a mapping to the demo
// `Shipment` type so the existing display components (table, dates, milestone timeline) show
// live records unchanged. No React here; safe for Server and Client Components.

import type { ShipmentView } from '@/lib/metrics';
import type {
  CustomerNotificationStatus,
  CustomsStatus,
  DelayReason,
  DelayStatus,
  MilestoneState,
  Severity,
  Shipment,
  ShipmentDirection,
  ShipmentStatus,
  TransportMode,
} from '@/lib/types';
import type { PartyRef } from '@/lib/live-quotations';

export const SHIPMENTS_VIEW = 'shipments.view';
export const SHIPMENTS_MANAGE = 'shipments.manage';

export type IssueType = 'delay' | 'damage' | 'documentation' | 'customs_query' | 'other';

export const issueTypeLabel: Record<IssueType, string> = {
  delay: 'Delay',
  damage: 'Damage',
  documentation: 'Documentation problem',
  customs_query: 'Customs query',
  other: 'Other issue',
};

export type ContainerType =
  | 'dry_20'
  | 'dry_40'
  | 'high_cube_40'
  | 'reefer_20'
  | 'reefer_40'
  | 'open_top'
  | 'flat_rack'
  | 'other';

export const containerTypeLabel: Record<ContainerType, string> = {
  dry_20: '20ft dry',
  dry_40: '40ft dry',
  high_cube_40: '40ft high cube',
  reefer_20: '20ft reefer',
  reefer_40: '40ft reefer',
  open_top: 'Open top',
  flat_rack: 'Flat rack',
  other: 'Other',
};

export interface PersonRef {
  id: number;
  name: string;
}

export interface LiveMilestone {
  id: number;
  sequence: number;
  label: string;
  location: string | null;
  plannedAt: string | null;
  actualAt: string | null;
  note: string | null;
  state: MilestoneState;
  recordedBy: PersonRef | null;
}

export interface LiveIssue {
  id: number;
  type: IssueType;
  severity: Severity;
  reason: DelayReason | null;
  reasonDetail: string;
  identifiedAt: string;
  affectedMilestone: { id: number; label: string } | null;
  originalExpectedAt: string | null;
  revisedExpectedAt: string | null;
  affectsEta: boolean;
  followUpUser: PersonRef | null;
  status: DelayStatus;
  nextAction: string | null;
  notes: string | null;
  resolvedAt: string | null;
  resolution: string | null;
  customerNotification: CustomerNotificationStatus;
  customerNotifiedAt: string | null;
  createdBy: PersonRef | null;
  createdAt: string;
  updatedAt: string;
  /** Detail view only. */
  actions?: { at: string; actor: string; note: string; automatic: boolean }[];
}

export interface LiveContainer {
  id: number;
  containerNumber: string;
  type: ContainerType;
  sealNumber: string | null;
  grossWeightKg: string | null;
  packages: number | null;
}

export interface LiveCustoms {
  reference: string;
  declarationNumber: string | null;
  regime: string;
  status: CustomsStatus;
  customsStation: string | null;
  lodgedAt: string | null;
  assessedAt: string | null;
  releasedAt: string | null;
  queryDetails: string | null;
  updatedAt: string;
}

export interface LiveShipment {
  id: number;
  reference: string;
  status: ShipmentStatus;
  mode: TransportMode;
  direction: ShipmentDirection;
  origin: string;
  destination: string;
  booking: { id: number; reference: string; status: string } | null;
  customer: PartyRef;
  carrier: PartyRef | null;
  agent: PartyRef | null;
  assignedTo: PersonRef | null;
  transportDocRef: string | null;
  vesselOrFlight: string | null;
  voyageNumber: string | null;
  equipment: string | null;
  cargoDescription: string;
  packages: number | null;
  grossWeightKg: string | null;
  volumeCbm: string | null;
  etd: string | null;
  eta: string;
  estimatedDeliveryAt: string | null;
  atd: string | null;
  ata: string | null;
  deliveredAt: string | null;
  currentEta: { at: string; revised: boolean };
  needsAttention: boolean;
  customs: LiveCustoms | null;
  milestones: LiveMilestone[];
  issues: LiveIssue[];
  createdBy: PersonRef | null;
  createdAt: string;
  updatedAt: string;
  /** Detail view only. */
  containers?: LiveContainer[];
  history?: { id: number; at: string; actor: string; action: string; summary: string }[];
}

export interface ShipmentListPage {
  items: LiveShipment[];
  total: number;
  counts: Record<ShipmentView, number>;
}

/**
 * The live record in the demo `Shipment` shape, for the shared display components. Resolved
 * delays do not revise the ETA (approved plan: "current ETA from open delays"), so they are
 * passed on as not affecting it; open issues other than delays are shown as exceptions.
 */
export function toDisplayShipment(s: LiveShipment): Shipment {
  return {
    reference: s.reference,
    customerId: String(s.customer.id),
    customerName: s.customer.name,
    mode: s.mode,
    direction: s.direction,
    status: s.status,
    origin: s.origin,
    destination: s.destination,
    carrier: s.carrier?.name ?? 'Not recorded',
    transportDocRef: s.transportDocRef ?? 'Pending',
    equipment: s.equipment ?? 'Equipment not recorded',
    cargoDescription: s.cargoDescription,
    packages: s.packages ?? 0,
    weightKg: Number(s.grossWeightKg ?? 0),
    etd: s.etd ?? undefined,
    eta: s.eta,
    estimatedDeliveryAt: s.estimatedDeliveryAt ?? undefined,
    atd: s.atd ?? undefined,
    ata: s.ata ?? undefined,
    deliveredAt: s.deliveredAt ?? undefined,
    assignedTo: s.assignedTo?.name ?? 'Unassigned',
    agentName: s.agent?.name,
    customs: {
      entryReference: s.customs?.reference,
      status: s.customs?.status ?? 'not_started',
      updatedAt: s.customs?.updatedAt ?? s.updatedAt,
    },
    milestones: s.milestones.map((m) => ({
      label: m.label,
      state: m.state,
      at: m.actualAt ?? undefined,
      plannedAt: m.plannedAt ?? undefined,
      location: m.location ?? undefined,
    })),
    exceptions: s.issues
      .filter((i) => i.type !== 'delay' && i.status !== 'resolved')
      .map((i) => ({ id: String(i.id), severity: i.severity, message: i.reasonDetail, raisedAt: i.identifiedAt })),
    delays: s.issues
      .filter((i) => i.type === 'delay')
      .map((i) => ({
        id: String(i.id),
        reason: i.reason ?? 'other',
        reasonDetail: i.reasonDetail,
        identifiedAt: i.identifiedAt,
        severity: i.severity,
        milestone: i.affectedMilestone?.label ?? '',
        originalExpectedAt: i.originalExpectedAt ?? i.identifiedAt,
        revisedExpectedAt: i.revisedExpectedAt ?? undefined,
        affectsEta: i.affectsEta && i.status !== 'resolved',
        followUpBy: i.followUpUser?.name ?? 'Unassigned',
        status: i.status,
        nextAction: i.nextAction ?? undefined,
        notes: i.notes ?? undefined,
        resolvedAt: i.resolvedAt ?? undefined,
        customerNotification: i.customerNotification,
        customerNotifiedAt: i.customerNotifiedAt ?? undefined,
        actions: [],
        updatedAt: i.updatedAt,
      })),
    events: [],
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}

// --- List filters -------------------------------------------------------------------------

export const SHIPMENT_PAGE_SIZE = 25;
const VIEWS: ShipmentView[] = ['all', 'active', 'attention', 'delayed', 'arriving', 'customs'];
const MODES: TransportMode[] = ['sea', 'air', 'road', 'rail'];

export interface ShipmentListFilters {
  view: ShipmentView;
  mode?: TransportMode;
  q?: string;
  page: number;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseShipmentFilters(params: Record<string, string | string[] | undefined>): ShipmentListFilters {
  const view = first(params.view);
  const mode = first(params.mode);
  const page = Number(first(params.page));
  return {
    view: VIEWS.includes(view as ShipmentView) ? (view as ShipmentView) : 'active',
    mode: MODES.includes(mode as TransportMode) ? (mode as TransportMode) : undefined,
    q: first(params.q)?.trim().slice(0, 100) || undefined,
    page: Number.isInteger(page) && page > 1 ? page : 1,
  };
}

/** The page's own query string (for links and sign-in return). */
export function shipmentPageQuery(filters: Partial<ShipmentListFilters>): string {
  const query = new URLSearchParams();
  if (filters.view && filters.view !== 'active') query.set('view', filters.view);
  if (filters.mode) query.set('mode', filters.mode);
  if (filters.q) query.set('q', filters.q);
  if (filters.page && filters.page > 1) query.set('page', String(filters.page));
  const text = query.toString();
  return text ? `?${text}` : '';
}

export function shipmentApiQuery(filters: ShipmentListFilters): string {
  const query = new URLSearchParams({
    view: filters.view,
    limit: String(SHIPMENT_PAGE_SIZE),
    offset: String((filters.page - 1) * SHIPMENT_PAGE_SIZE),
  });
  if (filters.mode) query.set('mode', filters.mode);
  if (filters.q) query.set('q', filters.q);
  return query.toString();
}

export const liveShipmentHref = (reference: string) => `/shipments/${encodeURIComponent(reference)}`;

/** Decimal strings from the API without trailing zeros: "1520.500" → "1520.5". */
export function trimQuantity(value: string | null): string {
  if (!value) return '';
  return value.includes('.') ? value.replace(/\.?0+$/, '') : value;
}
