'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDownIcon, ShipIcon } from '@/components/ui/icons';
import { useSessionStore } from '@/lib/data/session-store';
import { isActive, navGroups, type NavGroup, type NavItem } from './nav-items';

function UnreadCount() {
  const { notifications, readNotificationIds } = useSessionStore();
  const unread = notifications.filter((n) => !readNotificationIds.has(n.id)).length;
  if (unread === 0) return null;
  return (
    <span className="ml-auto rounded-full bg-amber-400 px-1.5 text-xs font-semibold text-slate-900 tabular-nums">
      {unread}
      <span className="sr-only"> unread</span>
    </span>
  );
}

function NavLink({ item, pathname, onNavigate }: { item: NavItem; pathname: string; onNavigate?: () => void }) {
  const active = isActive(pathname, item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={`flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
        active ? 'bg-white/12 text-white' : 'text-blue-100/80 hover:bg-white/8 hover:text-white'
      }`}
    >
      <Icon className={`size-5 shrink-0 ${active ? 'text-white' : 'text-blue-200/70'}`} />
      {/* Labels wrap instead of truncating, so a count or a scrollbar never hides part of a label. */}
      <span className="min-w-0 leading-snug">{item.label}</span>
      {item.showUnread && <UnreadCount />}
    </Link>
  );
}

function NavSection({
  group,
  pathname,
  collapsed,
  onToggle,
  onNavigate,
}: {
  group: NavGroup;
  pathname: string;
  collapsed: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
}) {
  const listId = `nav-group-${group.id}`;
  // The group holding the current page always stays open, so the highlight is never hidden.
  const containsActive = group.items.some((item) => isActive(pathname, item.href));
  const open = containsActive || !collapsed;
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        disabled={containsActive}
        aria-expanded={open}
        aria-controls={listId}
        className="flex w-full items-center justify-between rounded-md px-3 py-1 text-xs font-semibold tracking-wide text-blue-200/80 uppercase hover:text-white focus-visible:outline-2 focus-visible:outline-white disabled:cursor-default disabled:hover:text-blue-200/80"
      >
        {group.label}
        {!containsActive && (
          <ChevronDownIcon className={`size-4 transition-transform motion-reduce:transition-none ${open ? '' : '-rotate-90'}`} />
        )}
      </button>
      <ul id={listId} hidden={!open} className="mt-1 flex flex-col gap-0.5">
        {group.items.map((item) => (
          <li key={item.href}>
            <NavLink item={item} pathname={pathname} onNavigate={onNavigate} />
          </li>
        ))}
      </ul>
    </li>
  );
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  // Collapsed groups, for this page view only (not stored).
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  return (
    <div className="flex h-full flex-col bg-[#0b2545] text-white">
      <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-white/10 px-5">
        <span className="flex size-8 items-center justify-center rounded-lg bg-blue-500/90">
          <ShipIcon className="size-5 text-white" />
        </span>
        <div className="leading-tight">
          <p className="text-sm font-semibold">Freight Management</p>
          <p className="text-xs text-blue-200/70">Forwarding &amp; clearing</p>
        </div>
      </div>
      <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 py-3 [scrollbar-width:thin]">
        <ul className="flex flex-col gap-3">
          {navGroups.map((group) => (
            <NavSection
              key={group.id}
              group={group}
              pathname={pathname}
              collapsed={Boolean(collapsed[group.id])}
              onToggle={() => setCollapsed((c) => ({ ...c, [group.id]: !c[group.id] }))}
              onNavigate={onNavigate}
            />
          ))}
        </ul>
      </nav>
      <p className="shrink-0 border-t border-white/10 px-5 py-3 text-xs text-blue-200/70">
        Demo build: no sign-in or access control yet.
      </p>
    </div>
  );
}
