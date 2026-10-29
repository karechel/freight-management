'use client';

import { useApiHealth } from '@/components/layout/api-status';
import { Badge } from '@/components/ui/badge';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { DetailList } from '@/components/ui/detail-list';
import { RefreshIcon } from '@/components/ui/icons';
import { getApiBaseUrl } from '@/lib/api/client';

export function BackendHealthCard() {
  const { state, recheck } = useApiHealth();
  const badge =
    state.kind === 'online' ? (
      <Badge tone="success" dot>Online</Badge>
    ) : state.kind === 'offline' ? (
      <Badge tone="danger" dot>Unavailable</Badge>
    ) : state.kind === 'not_configured' ? (
      <Badge tone="warning" dot>Not configured</Badge>
    ) : (
      <Badge dot>Checking…</Badge>
    );

  return (
    <Card>
      <CardHeader title="Backend connection" description="Live check against the existing GET /health endpoint">
        <button
          type="button"
          onClick={recheck}
          disabled={state.kind === 'checking' || state.kind === 'not_configured'}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshIcon className="size-4" />
          Check again
        </button>
      </CardHeader>
      <CardBody>
        <div aria-live="polite">
          <DetailList
            items={[
              { label: 'Status', value: badge },
              { label: 'API base URL (NEXT_PUBLIC_API_URL)', value: <span className="font-mono text-[13px]">{getApiBaseUrl() ?? 'Not set'}</span> },
              {
                label: 'Response',
                value:
                  state.kind === 'online'
                    ? state.message
                    : state.kind === 'offline'
                      ? 'No response. Is the backend running, and does its CORS origin allow this page?'
                      : state.kind === 'not_configured'
                        ? 'Copy .env.example to .env.local and set NEXT_PUBLIC_API_URL.'
                        : '—',
              },
              {
                label: 'Last checked',
                value: state.kind === 'online' || state.kind === 'offline' ? state.checkedAt.toLocaleTimeString('en-KE') : '—',
              },
            ]}
          />
        </div>
      </CardBody>
    </Card>
  );
}
