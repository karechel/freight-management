'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShipIcon } from '@/components/ui/icons';
import { isActive, primaryNav, secondaryNav, type NavItem } from './nav-items';

function NavLink({ item, pathname, onNavigate }: { item: NavItem; pathname: string; onNavigate?: () => void }) {
  const active = isActive(pathname, item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
        active ? 'bg-white/12 text-white' : 'text-blue-100/80 hover:bg-white/8 hover:text-white'
      }`}
    >
      <Icon className={`size-5 shrink-0 ${active ? 'text-white' : 'text-blue-200/70'}`} />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <div className="flex h-full flex-col bg-[#0b2545] text-white">
      <div className="flex h-16 items-center gap-2.5 border-b border-white/10 px-5">
        <span className="flex size-8 items-center justify-center rounded-lg bg-blue-500/90">
          <ShipIcon className="size-5 text-white" />
        </span>
        <div className="leading-tight">
          <p className="text-sm font-semibold">Freight Management</p>
          <p className="text-xs text-blue-200/70">Forwarding &amp; clearing</p>
        </div>
      </div>
      <nav aria-label="Main" className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-4">
        <ul className="flex flex-col gap-0.5">
          {primaryNav.map((item) => (
            <li key={item.href}>
              <NavLink item={item} pathname={pathname} onNavigate={onNavigate} />
            </li>
          ))}
        </ul>
        <ul className="mt-auto flex flex-col gap-0.5 border-t border-white/10 pt-4">
          {secondaryNav.map((item) => (
            <li key={item.href}>
              <NavLink item={item} pathname={pathname} onNavigate={onNavigate} />
            </li>
          ))}
        </ul>
      </nav>
      <p className="border-t border-white/10 px-5 py-3 text-xs text-blue-200/70">
        Demo build: no sign-in or access control yet.
      </p>
    </div>
  );
}
