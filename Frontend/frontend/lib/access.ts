// Intended role-based access structure, for the users and permissions page.
// This is a design proposal shown in the UI. Nothing here is enforced: there is
// no sign-in and no backend authorization yet, and hiding something in the UI
// would not protect it. Enforcement must happen on the backend.

import type { StaffRole } from '@/lib/types';

export const staffRoles: StaffRole[] = ['administrator', 'operations', 'documentation', 'finance', 'management'];

export const staffRoleMeta: Record<StaffRole, { label: string; summary: string }> = {
  administrator: {
    label: 'Administrator',
    summary: 'Manages staff accounts, roles and company settings. Can see the audit log.',
  },
  operations: {
    label: 'Operations / clearing',
    summary: 'Runs shipments day to day: status, milestones, delays and customs progress.',
  },
  documentation: {
    label: 'Documentation',
    summary: 'Collects, uploads and checks shipping and customs documents; prepares quotations.',
  },
  finance: {
    label: 'Finance / accounts',
    summary: 'Invoices, payments, reconciliation, expenses and customer billing details.',
  },
  management: {
    label: 'Management',
    summary: 'Views every area and the reports; approves large expenses. Day-to-day edits stay with the teams.',
  },
};

/** none: area hidden · view: read only · edit: create and change · manage: edit plus approve or configure. */
export type AccessLevel = 'none' | 'view' | 'edit' | 'manage';

export const accessLevelMeta: Record<AccessLevel, { label: string; description: string }> = {
  none: { label: 'No access', description: 'Area hidden; data not returned by the API' },
  view: { label: 'View', description: 'Read only' },
  edit: { label: 'Edit', description: 'Create and update records' },
  manage: { label: 'Manage', description: 'Edit, approve and configure' },
};

export interface PermissionArea {
  id: string;
  label: string;
  /** Marks areas holding sensitive customer financial information. */
  sensitive?: boolean;
  access: Record<StaffRole, AccessLevel>;
}

export const permissionAreas: PermissionArea[] = [
  {
    id: 'shipments',
    label: 'Shipments, tracking and delays',
    access: { administrator: 'view', operations: 'edit', documentation: 'view', finance: 'view', management: 'view' },
  },
  {
    id: 'quotations',
    label: 'Quotations and bookings',
    access: { administrator: 'view', operations: 'edit', documentation: 'edit', finance: 'view', management: 'manage' },
  },
  {
    id: 'documents',
    label: 'Documents',
    access: { administrator: 'view', operations: 'view', documentation: 'manage', finance: 'view', management: 'view' },
  },
  {
    id: 'customs',
    label: 'Customs and duties',
    access: { administrator: 'view', operations: 'edit', documentation: 'edit', finance: 'view', management: 'view' },
  },
  {
    id: 'contacts',
    label: 'Customer and agent contacts',
    access: { administrator: 'view', operations: 'edit', documentation: 'view', finance: 'view', management: 'view' },
  },
  {
    id: 'billing',
    label: 'Customer billing details, balances and credit limits',
    sensitive: true,
    access: { administrator: 'none', operations: 'none', documentation: 'none', finance: 'manage', management: 'view' },
  },
  {
    id: 'invoices',
    label: 'Invoices and payments',
    sensitive: true,
    access: { administrator: 'none', operations: 'none', documentation: 'none', finance: 'manage', management: 'view' },
  },
  {
    id: 'expenses',
    label: 'Shipment expenses',
    access: { administrator: 'none', operations: 'edit', documentation: 'none', finance: 'manage', management: 'manage' },
  },
  {
    id: 'profitability',
    label: 'Profitability and margins',
    sensitive: true,
    access: { administrator: 'none', operations: 'none', documentation: 'none', finance: 'view', management: 'view' },
  },
  {
    id: 'reports',
    label: 'Reports and analytics',
    access: { administrator: 'none', operations: 'view', documentation: 'none', finance: 'view', management: 'view' },
  },
  {
    id: 'users',
    label: 'Users and permissions',
    access: { administrator: 'manage', operations: 'none', documentation: 'none', finance: 'none', management: 'view' },
  },
  {
    id: 'settings',
    label: 'Company settings and audit log',
    access: { administrator: 'manage', operations: 'none', documentation: 'none', finance: 'view', management: 'view' },
  },
];
