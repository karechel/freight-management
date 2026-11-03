'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Button, ButtonLink } from '@/components/ui/button';
import { useCurrentUser } from './current-user';

export function UserMenu() {
  const { session, signOut } = useCurrentUser();
  const [busy, setBusy] = useState(false);
  const pathname = usePathname();

  if (session.status === 'signed_out') {
    if (pathname === '/login') return null;
    return (
      <ButtonLink href={`/login?next=${encodeURIComponent(pathname)}`} variant="secondary" size="sm">
        Sign in
      </ButtonLink>
    );
  }
  if (session.status !== 'signed_in') return null;

  const { user } = session;
  return (
    <div className="flex items-center gap-2">
      <p className="hidden max-w-48 truncate text-right text-xs text-slate-600 md:block">
        <span className="font-medium text-slate-900">{user.name ?? user.email}</span>
        {user.roles.length > 0 && <span className="block capitalize">{user.roles.join(', ')}</span>}
      </p>
      <Button
        variant="secondary"
        size="sm"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          signOut().finally(() => setBusy(false));
        }}
      >
        Sign out
      </Button>
    </div>
  );
}
