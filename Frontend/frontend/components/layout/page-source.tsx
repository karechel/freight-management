'use client';

import { createContext, useContext, useEffect } from 'react';

// Lets a page tell the top bar that it is showing demo records, for routes that serve both live
// and demo data (a quotation reference the backend does not know opens the demo record).

export const DemoPageContext = createContext<(demo: boolean) => void>(() => {});

/** Render on a page that shows demo data under a live route. The top bar then says "Demo data". */
export function DemoPageMarker() {
  const setDemo = useContext(DemoPageContext);
  useEffect(() => {
    setDemo(true);
    return () => setDemo(false);
  }, [setDemo]);
  return null;
}
