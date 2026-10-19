import {
  BoxIcon,
  ClipboardIcon,
  DashboardIcon,
  FileIcon,
  ReceiptIcon,
  SettingsIcon,
  ShieldIcon,
  UsersIcon,
} from '@/components/ui/icons';

export interface NavItem {
  href: string;
  label: string;
  icon: (props: { className?: string }) => React.JSX.Element;
}

export const primaryNav: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: DashboardIcon },
  { href: '/shipments', label: 'Shipments', icon: BoxIcon },
  { href: '/quotations', label: 'Quotations & bookings', icon: ClipboardIcon },
  { href: '/documents', label: 'Documents', icon: FileIcon },
  { href: '/customs', label: 'Customs & duties', icon: ShieldIcon },
  { href: '/parties', label: 'Customers & agents', icon: UsersIcon },
  { href: '/finance', label: 'Invoices & payments', icon: ReceiptIcon },
];

export const secondaryNav: NavItem[] = [
  { href: '/settings', label: 'System status', icon: SettingsIcon },
];

export function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

export function findNavItem(pathname: string): NavItem | undefined {
  return [...primaryNav, ...secondaryNav].find((item) => isActive(pathname, item.href));
}
