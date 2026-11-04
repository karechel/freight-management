// Live customer records from /api/parties. Money is exact decimal text from the backend,
// so it is only ever displayed here and never added up.

import type { AccountStatus } from './types';

export const PARTIES_MANAGE = 'parties.manage';
export const BILLING_MANAGE = 'parties.billing.manage';
export const STATUS_MANAGE = 'parties.status.manage';

export interface CustomerContact {
  id: number;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
}

export interface CustomerAccount {
  invoiced: string;
  credited: string;
  paid: string;
  outstanding: string;
  overdue: string;
  overdueInvoices: number;
  availableCredit: string | null;
}

export interface Customer {
  id: number;
  name: string;
  legalName: string | null;
  kraPin: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  notes: string | null;
  accountStatus: AccountStatus;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  roles: string[];
  shipments: { active: number; total: number };
  quotations: { open: number; total: number };
  /** Present only for users allowed to view billing. */
  billing?: {
    paymentTermsDays: number | null;
    creditLimit: string | null;
    account: CustomerAccount;
  };
}

export interface CustomerListItem extends Customer {
  primaryContact: CustomerContact | null;
}

export interface CustomerDetail extends Customer {
  contacts: CustomerContact[];
}

export interface CustomerPage {
  items: CustomerListItem[];
  total: number;
}

export const PAGE_SIZE = 25;

const STATUS_VALUES: readonly string[] = ['active', 'on_hold', 'closed'];
const ARCHIVED_VALUES: readonly string[] = ['exclude', 'only', 'include'];

export interface CustomerFilters {
  q: string;
  status: string;
  archived: string;
  page: number;
}

const single = (value: string | string[] | undefined) => (typeof value === 'string' ? value : '');

/** Reads the filters from the page URL. Anything unrecognised falls back to the default. */
export function parseCustomerFilters(params: Record<string, string | string[] | undefined>): CustomerFilters {
  const status = single(params.status);
  const archived = single(params.archived);
  const page = Number(single(params.page));
  return {
    q: single(params.q).trim().slice(0, 100),
    status: STATUS_VALUES.includes(status) ? status : '',
    archived: ARCHIVED_VALUES.includes(archived) ? archived : 'exclude',
    page: Number.isSafeInteger(page) && page >= 1 ? page : 1,
  };
}

/** The page URL's query string for these filters, leaving out defaults. */
export function customerPageQuery(filters: CustomerFilters): string {
  const query = new URLSearchParams();
  if (filters.q) query.set('q', filters.q);
  if (filters.status) query.set('status', filters.status);
  if (filters.archived !== 'exclude') query.set('archived', filters.archived);
  if (filters.page > 1) query.set('page', String(filters.page));
  const text = query.toString();
  return text ? `?${text}` : '';
}

/** The backend's query string for these filters. */
export function customerApiQuery(filters: CustomerFilters): string {
  const query = new URLSearchParams({
    role: 'customer',
    archived: filters.archived,
    limit: String(PAGE_SIZE),
    offset: String((filters.page - 1) * PAGE_SIZE),
  });
  if (filters.q) query.set('q', filters.q);
  if (filters.status) query.set('status', filters.status);
  return query.toString();
}

/** A numeric database id. Non-numeric ids such as "c-001" belong to the demo records. */
export const isLiveCustomerId = (id: string) => /^[1-9]\d{0,9}$/.test(id);

/** Pages whose records come from the live backend rather than demo data. */
export const isLivePage = (pathname: string) => /^\/parties(\/new|\/[1-9]\d{0,9}(\/edit)?)?\/?$/.test(pathname);

export const customerLocation =(customer: Pick<Customer, 'city' | 'country'>) =>
  [customer.city, customer.country].filter(Boolean).join(', ');
