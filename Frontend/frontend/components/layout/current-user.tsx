'use client';

// Who is signed in, for client components. Backend guards remain the real control;
// this only decides what to show.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ApiError, backend, signOutRequest, type CurrentUser } from '@/lib/api/browser';

type SessionState =
  | { status: 'loading' }
  | { status: 'signed_in'; user: CurrentUser }
  | { status: 'signed_out' }
  | { status: 'unavailable' };

interface CurrentUserValue {
  session: SessionState;
  signedIn: (user: CurrentUser) => void;
  signOut: () => Promise<void>;
  can: (permission: string) => boolean;
}

const CurrentUserContext = createContext<CurrentUserValue | null>(null);

export function CurrentUserProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<SessionState>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    backend.get<CurrentUser>('auth/me').then(
      (user) => {
        if (active) setSession({ status: 'signed_in', user });
      },
      (error: unknown) => {
        if (!active) return;
        setSession({ status: error instanceof ApiError && error.status === 401 ? 'signed_out' : 'unavailable' });
      },
    );
    return () => {
      active = false;
    };
  }, []);

  const signedIn = useCallback((user: CurrentUser) => setSession({ status: 'signed_in', user }), []);
  const signOut = useCallback(async () => {
    await signOutRequest();
    setSession({ status: 'signed_out' });
  }, []);

  const value = useMemo<CurrentUserValue>(
    () => ({
      session,
      signedIn,
      signOut,
      can: (permission) => session.status === 'signed_in' && session.user.permissions.includes(permission),
    }),
    [session, signedIn, signOut],
  );
  return <CurrentUserContext.Provider value={value}>{children}</CurrentUserContext.Provider>;
}

export function useCurrentUser(): CurrentUserValue {
  const value = useContext(CurrentUserContext);
  if (!value) throw new Error('useCurrentUser must be used inside CurrentUserProvider');
  return value;
}
