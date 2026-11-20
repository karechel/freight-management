import {
  BellIcon,
  BoxIcon,
  ChartIcon,
  ClipboardIcon,
  DashboardIcon,
  FileIcon,
  GlobeIcon,
  KeyIcon,
  ReceiptIcon,
  SettingsIcon,
  ShieldIcon,
  UsersIcon,
  WalletIcon,
} from '@/components/ui/icons';

export interface NavItem {
  href: string;
  label: string;
  icon: (props: { className?: string }) => React.JSX.Element;
  /** Shows the number of unread notifications next to the label. */
  showUnread?: boolean;
  /** Other sections that belong to this item, such as /bookings under quotations. */
  also?: string[];
}

export interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

// Sidebar labels can differ from page titles; pages keep their existing names and routes.
export const navGroups: NavGroup[] = [
  {
    id: 'overview',
    label: 'Overview',
    items: [{ href: '/', label: 'Dashboard', icon: DashboardIcon }],
  },
  {
    id: 'operations',
    label: 'Operations',
    items: [
      { href: '/shipments', label: 'Shipments and Tracking', icon: BoxIcon },
      { href: '/quotations', label: 'Quotations and Bookings', icon: ClipboardIcon, also: ['/bookings'] },
      { href: '/documents', label: 'Documents', icon: FileIcon },
      { href: '/customs', label: 'Customs and Duties', icon: ShieldIcon },
      { href: '/notifications', label: 'Notifications and Tasks', icon: BellIcon, showUnread: true },
    ],
  },
  {
    id: 'contacts',
    label: 'Contacts',
    items: [
      { href: '/parties', label: 'Customers', icon: UsersIcon },
      { href: '/agents', label: 'Agents and Partners', icon: GlobeIcon },
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    items: [
      { href: '/finance', label: 'Invoices and Payments', icon: ReceiptIcon },
      { href: '/expenses', label: 'Expenses and Profitability', icon: WalletIcon },
    ],
  },
  {
    id: 'insights',
    label: 'Insights',
    items: [{ href: '/reports', label: 'Reports and Analytics', icon: ChartIcon }],
  },
  {
    id: 'administration',
    label: 'Administration',
    items: [
      { href: '/users', label: 'Users and Permissions', icon: KeyIcon },
      { href: '/settings', label: 'Settings and Audit Logs', icon: SettingsIcon },
    ],
  },
];

export const allNavItems: NavItem[] = navGroups.flatMap((g) => g.items);

export function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

/** Whether the item, or one of the sections it also covers, is the current page. */
export function isItemActive(pathname: string, item: NavItem): boolean {
  return [item.href, ...(item.also ?? [])].some((href) => isActive(pathname, href));
}

export function findNavItem(pathname: string): NavItem | undefined {
  return allNavItems.find((item) => isItemActive(pathname, item));
}
