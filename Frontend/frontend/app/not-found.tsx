import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/states';

export default function NotFound() {
  return (
    <Card>
      <EmptyState
        title="Page or record not found"
        description="The address may be mistyped, or the record does not exist in the current data set."
      >
        <Link
          href="/"
          className="mt-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          Back to dashboard
        </Link>
      </EmptyState>
    </Card>
  );
}
