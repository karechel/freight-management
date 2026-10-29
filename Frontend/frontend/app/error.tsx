'use client'; // Error boundaries must be Client Components

import { useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/states';

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Card>
      <ErrorState
        title="This page could not be displayed"
        description="Something went wrong while rendering this page. You can try again; if it keeps happening, note the time and what you were doing."
      >
        <button
          type="button"
          onClick={() => retry()}
          className="mt-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          Try again
        </button>
      </ErrorState>
    </Card>
  );
}
