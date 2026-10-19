import { Skeleton } from '@/components/ui/states';

export default function Loading() {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">Loading…</span>
      <Skeleton className="h-8 w-64" />
      <Skeleton className="mt-2 h-4 w-96 max-w-full" />
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="mt-6 h-72" />
    </div>
  );
}
