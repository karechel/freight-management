'use client';

// Live connectivity indicator using the backend's existing GET /health endpoint.
// This is the only live backend call the frontend makes today.

import { useCallback, useEffect, useState } from 'react';
import { ApiNotConfiguredError, getApiBaseUrl, getHealth } from '@/lib/api/client';
import { RefreshIcon } from '@/components/ui/icons';

export type ApiState =
  | { kind: 'checking' }
  | { kind: 'online'; message: string; checkedAt: Date }
  | { kind: 'offline'; checkedAt: Date }
  | { kind: 'not_configured' };

export function useApiHealth() {
  // NEXT_PUBLIC_* values are inlined at build time, so this is identical on
  // the server and in the browser.
  const [state, setState] = useState<ApiState>(() =>
    getApiBaseUrl() ? { kind: 'checking' } : { kind: 'not_configured' },
  );

  // Only sets state from promise callbacks, after the request settles.
  const check = useCallback((signal?: AbortSignal) => {
    getHealth(signal).then(
      (health) => setState({ kind: 'online', message: health.message, checkedAt: new Date() }),
      (error: unknown) => {
        if (signal?.aborted) return;
        setState(
          error instanceof ApiNotConfiguredError
            ? { kind: 'not_configured' }
            : { kind: 'offline', checkedAt: new Date() },
        );
      },
    );
  }, []);

  useEffect(() => {
    if (!getApiBaseUrl()) return;
    const controller = new AbortController();
    check(controller.signal);
    return () => controller.abort();
  }, [check]);

  const recheck = () => {
    if (!getApiBaseUrl()) return;
    setState({ kind: 'checking' });
    check();
  };

  return { state, recheck };
}

const presentation = {
  checking: { dot: 'bg-slate-400 motion-safe:animate-pulse', label: 'Checking API…' },
  online: { dot: 'bg-emerald-500', label: 'API online' },
  offline: { dot: 'bg-red-500', label: 'API unavailable' },
  not_configured: { dot: 'bg-amber-500', label: 'API not configured' },
} as const;

/** Compact pill for the top bar. */
export function ApiStatusPill() {
  const { state, recheck } = useApiHealth();
  const { dot, label } = presentation[state.kind];
  const title =
    state.kind === 'online'
      ? `Backend health check: ${state.message}`
      : state.kind === 'offline'
        ? 'The backend did not respond to GET /health. Pages still work with demo data.'
        : state.kind === 'not_configured'
          ? 'NEXT_PUBLIC_API_URL is not set. Copy .env.example to .env.local.'
          : 'Contacting the backend…';

  return (
    <button
      type="button"
      onClick={recheck}
      disabled={state.kind === 'checking'}
      title={title}
      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-wait"
    >
      <span className={`size-2 rounded-full ${dot}`} aria-hidden="true" />
      <span aria-live="polite">{label}</span>
      <RefreshIcon className="size-3.5 text-slate-400" />
      <span className="sr-only">Re-check backend connection</span>
    </button>
  );
}
