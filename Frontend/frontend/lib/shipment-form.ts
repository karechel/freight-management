// Shipment create/edit form: field values, validation and conversion to a
// typed input. Pure functions, no React, so the same rules can be reused by a
// future API client and mirrored by server-side validation.

import { fromDateInput, fromDateTimeInput, isBefore, toDateInput, toDateTimeInput } from '@/lib/dates';
import { directionLabel, modeLabel, shipmentStatusMeta } from '@/lib/labels';
import type { Quotation, Shipment, ShipmentDirection, ShipmentStatus, TransportMode } from '@/lib/types';
import type { FieldErrors } from '@/lib/validation';

/** Raw string values, as held by the form inputs. */
export interface ShipmentFormValues {
  customerId: string;
  direction: string;
  mode: string;
  status: string;
  origin: string;
  destination: string;
  carrier: string;
  transportDocRef: string;
  equipment: string;
  cargoDescription: string;
  packages: string;
  weightKg: string;
  etd: string;
  eta: string;
  estimatedDeliveryAt: string;
  atd: string;
  ata: string;
  deliveredAt: string;
  assignedTo: string;
  agentName: string;
  agentRouteId: string;
}

export type ShipmentField = keyof ShipmentFormValues;

/** Validated values, ready to apply to a shipment record. */
export interface ShipmentInput {
  customerId: string;
  customerName: string;
  direction: ShipmentDirection;
  mode: TransportMode;
  status: ShipmentStatus;
  origin: string;
  destination: string;
  carrier: string;
  transportDocRef: string;
  equipment: string;
  cargoDescription: string;
  packages: number;
  weightKg: number;
  etd?: string;
  eta: string;
  estimatedDeliveryAt?: string;
  atd?: string;
  ata?: string;
  deliveredAt?: string;
  assignedTo: string;
  agentName?: string;
  agentRouteId?: string;
}

export const shipmentFieldLabel: Record<ShipmentField, string> = {
  customerId: 'Customer',
  direction: 'Direction',
  mode: 'Transport mode',
  status: 'Status',
  origin: 'Origin',
  destination: 'Destination',
  carrier: 'Carrier',
  transportDocRef: 'B/L, AWB or consignment number',
  equipment: 'Equipment',
  cargoDescription: 'Cargo description',
  packages: 'Packages',
  weightKg: 'Gross weight (kg)',
  etd: 'Estimated departure (ETD)',
  eta: 'Estimated arrival (ETA)',
  estimatedDeliveryAt: 'Estimated delivery',
  atd: 'Actual departure',
  ata: 'Actual arrival',
  deliveredAt: 'Actual delivery',
  assignedTo: 'Assigned to',
  agentName: 'Overseas / partner agent',
  agentRouteId: 'Agent route',
};

/** Placeholder used in records when no transport document number is known yet. */
export const PENDING_DOC_REF = 'Pending';

export const emptyShipmentForm: ShipmentFormValues = {
  customerId: '',
  direction: '',
  mode: '',
  status: 'booked',
  origin: '',
  destination: '',
  carrier: '',
  transportDocRef: '',
  equipment: '',
  cargoDescription: '',
  packages: '',
  weightKg: '',
  etd: '',
  eta: '',
  estimatedDeliveryAt: '',
  atd: '',
  ata: '',
  deliveredAt: '',
  assignedTo: '',
  agentName: '',
  agentRouteId: '',
};

export function shipmentToForm(s: Shipment): ShipmentFormValues {
  return {
    customerId: s.customerId,
    direction: s.direction,
    mode: s.mode,
    status: s.status,
    origin: s.origin,
    destination: s.destination,
    carrier: s.carrier,
    transportDocRef: s.transportDocRef === PENDING_DOC_REF ? '' : s.transportDocRef,
    equipment: s.equipment,
    cargoDescription: s.cargoDescription,
    packages: String(s.packages),
    weightKg: String(s.weightKg),
    etd: toDateInput(s.etd),
    eta: toDateInput(s.eta),
    estimatedDeliveryAt: toDateInput(s.estimatedDeliveryAt),
    atd: toDateTimeInput(s.atd),
    ata: toDateTimeInput(s.ata),
    deliveredAt: toDateTimeInput(s.deliveredAt),
    assignedTo: s.assignedTo,
    agentName: s.agentName ?? '',
    agentRouteId: s.agentRouteId ?? '',
  };
}

export interface ShipmentFormContext {
  customers: { id: string; name: string }[];
  agents: string[];
  staff: string[];
  /** Routes per agent name; a route must belong to the selected agent. */
  agentRoutes: Record<string, { id: string }[]>;
  /** Current time (ISO). Actual dates may not be later than this. */
  now: string;
}

const MAX_TEXT = 120;
const MAX_LONG_TEXT = 200;

export function validateShipmentForm(
  values: ShipmentFormValues,
  ctx: ShipmentFormContext,
): { errors: FieldErrors<ShipmentField>; input?: ShipmentInput } {
  const errors: FieldErrors<ShipmentField> = {};
  const v = Object.fromEntries(
    Object.entries(values).map(([k, val]) => [k, val.trim()]),
  ) as unknown as ShipmentFormValues;

  const required = (field: ShipmentField, message = `Enter the ${shipmentFieldLabel[field].toLowerCase()}.`) => {
    if (!v[field]) errors[field] = message;
  };
  const maxLength = (field: ShipmentField, max: number) => {
    if (v[field].length > max) errors[field] = `Use ${max} characters or fewer.`;
  };

  const customer = ctx.customers.find((c) => c.id === v.customerId);
  if (!v.customerId) errors.customerId = 'Select the customer.';
  else if (!customer) errors.customerId = 'Select a customer from the list.';

  if (!v.direction) errors.direction = 'Select import, export or transit.';
  else if (!Object.hasOwn(directionLabel, v.direction)) errors.direction = 'Select a direction from the list.';

  if (!v.mode) errors.mode = 'Select the transport mode.';
  else if (!Object.hasOwn(modeLabel, v.mode)) errors.mode = 'Select a transport mode from the list.';

  if (!v.status || !Object.hasOwn(shipmentStatusMeta, v.status)) errors.status = 'Select a status from the list.';

  for (const field of ['origin', 'destination', 'carrier', 'equipment'] as const) {
    required(field);
    maxLength(field, MAX_TEXT);
  }
  required('cargoDescription', 'Describe the cargo.');
  maxLength('cargoDescription', MAX_LONG_TEXT);
  maxLength('transportDocRef', 60);
  if (!errors.origin && !errors.destination && v.origin.toLowerCase() === v.destination.toLowerCase()) {
    errors.destination = 'Destination must be different from the origin.';
  }

  let packages = 0;
  if (!v.packages) errors.packages = 'Enter the number of packages.';
  else if (!/^\d+$/.test(v.packages)) errors.packages = 'Enter a whole number, without commas.';
  else {
    packages = Number(v.packages);
    if (packages < 1 || packages > 1_000_000) errors.packages = 'Enter a number between 1 and 1,000,000.';
  }

  let weightKg = 0;
  if (!v.weightKg) errors.weightKg = 'Enter the gross weight in kilograms.';
  else if (!/^\d+(\.\d{1,2})?$/.test(v.weightKg)) errors.weightKg = 'Enter a number with up to 2 decimal places, without commas.';
  else {
    weightKg = Number(v.weightKg);
    if (weightKg <= 0 || weightKg > 1_000_000) errors.weightKg = 'Enter a weight above 0 and up to 1,000,000 kg.';
  }

  if (!v.assignedTo) errors.assignedTo = 'Select the staff member responsible.';
  else if (!ctx.staff.includes(v.assignedTo)) errors.assignedTo = 'Select a staff member from the list.';
  if (v.agentName && !ctx.agents.includes(v.agentName)) errors.agentName = 'Select an agent from the list, or leave empty.';
  if (v.agentRouteId) {
    if (!v.agentName) errors.agentRouteId = 'Select the agent first, or leave the route empty.';
    else if (!ctx.agentRoutes[v.agentName]?.some((r) => r.id === v.agentRouteId)) {
      errors.agentRouteId = "Select one of this agent's routes, or leave empty.";
    }
  }

  // Estimated dates (date only).
  const parseDate = (field: 'etd' | 'eta' | 'estimatedDeliveryAt') => {
    if (!v[field]) return undefined;
    const iso = fromDateInput(v[field]);
    if (!iso) errors[field] = 'Enter a valid date.';
    return iso;
  };
  const etd = parseDate('etd');
  const eta = parseDate('eta');
  const estimatedDeliveryAt = parseDate('estimatedDeliveryAt');
  if (!v.eta) errors.eta = 'Enter the estimated arrival date.';
  if (etd && eta && isBefore(eta, etd)) errors.eta = 'ETA cannot be before the ETD.';
  if (eta && estimatedDeliveryAt && isBefore(estimatedDeliveryAt, eta)) {
    errors.estimatedDeliveryAt = 'Estimated delivery cannot be before the ETA.';
  }

  // Actual dates (date and time); none may be in the future.
  const parseActual = (field: 'atd' | 'ata' | 'deliveredAt') => {
    if (!v[field]) return undefined;
    const iso = fromDateTimeInput(v[field]);
    if (!iso) errors[field] = 'Enter a valid date and time.';
    else if (isBefore(ctx.now, iso)) errors[field] = 'An actual date cannot be in the future.';
    return iso;
  };
  const atd = parseActual('atd');
  const ata = parseActual('ata');
  const deliveredAt = parseActual('deliveredAt');
  if (atd && ata && !errors.ata && isBefore(ata, atd)) errors.ata = 'Actual arrival cannot be before actual departure.';
  if (deliveredAt && !errors.deliveredAt) {
    if (ata && isBefore(deliveredAt, ata)) errors.deliveredAt = 'Actual delivery cannot be before actual arrival.';
    else if (atd && isBefore(deliveredAt, atd)) errors.deliveredAt = 'Actual delivery cannot be before actual departure.';
  }

  // Status and actual dates must agree.
  if (!errors.status) {
    if (v.status === 'delivered' && !v.deliveredAt) {
      errors.deliveredAt ??= 'Enter the actual delivery date to mark the shipment as delivered.';
    }
    if (v.status !== 'delivered' && v.deliveredAt) {
      errors.status = 'A shipment with an actual delivery date must have the status "Delivered".';
    }
    if (v.status === 'arrived' && !v.ata) {
      errors.ata ??= 'Enter the actual arrival date to mark the shipment as arrived.';
    }
  }

  if (Object.keys(errors).length > 0 || !customer || !eta) return { errors };

  return {
    errors,
    input: {
      customerId: customer.id,
      customerName: customer.name,
      direction: v.direction as ShipmentDirection,
      mode: v.mode as TransportMode,
      status: v.status as ShipmentStatus,
      origin: v.origin,
      destination: v.destination,
      carrier: v.carrier,
      transportDocRef: v.transportDocRef || PENDING_DOC_REF,
      equipment: v.equipment,
      cargoDescription: v.cargoDescription,
      packages,
      weightKg,
      etd,
      eta,
      estimatedDeliveryAt,
      atd,
      ata,
      deliveredAt,
      assignedTo: v.assignedTo,
      agentName: v.agentName || undefined,
      agentRouteId: (v.agentName && v.agentRouteId) || undefined,
    },
  };
}

/** Prefill for a new shipment converted from a quotation. Dates, carrier and cargo details are left for the user. */
export function quotationToShipmentForm(q: Quotation): ShipmentFormValues {
  return {
    ...emptyShipmentForm,
    customerId: q.customerId,
    direction: q.direction,
    mode: q.mode,
    origin: q.origin,
    destination: q.destination,
    cargoDescription: q.cargoSummary,
    agentName: q.agentName ?? '',
  };
}
