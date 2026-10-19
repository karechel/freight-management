'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { CloseIcon, MenuIcon } from '@/components/ui/icons';
import { ApiStatusPill } from './api-status';
import { findNavItem } from './nav-items';
import { Sidebar } from './sidebar';

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const section = findNavItem(pathname)?.label ?? 'Freight Management';
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  // Move focus into the drawer when it opens, and back to the menu button when it closes.
  useEffect(() => {
    if (mobileOpen) closeButtonRef.current?.focus();
    else if (wasOpen.current) menuButtonRef.current?.focus();
    wasOpen.current = mobileOpen;
  }, [mobileOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:shadow"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">
        <Sidebar />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/50"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative h-full w-72 max-w-[85%] shadow-xl">
            <Sidebar onNavigate={() => setMobileOpen(false)} />
            <button
              ref={closeButtonRef}
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-3 rounded-md p-1.5 text-blue-100 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white"
              aria-label="Close navigation"
            >
              <CloseIcon />
            </button>
          </div>
        </div>
      )}

      {/* inert while the mobile drawer is open, so keyboard focus stays in the drawer */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-64" inert={mobileOpen}>
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6">
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setMobileOpen(true)}
            className="-ml-1 rounded-md p-1.5 text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600 lg:hidden"
            aria-label="Open navigation"
            aria-expanded={mobileOpen}
          >
            <MenuIcon />
          </button>
          <p className="min-w-0 truncate text-sm font-semibold text-slate-900">{section}</p>
          <div className="ml-auto flex items-center gap-2">
            <Badge tone="warning" className="hidden sm:inline-flex">
              Demo data
            </Badge>
            <ApiStatusPill />
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
