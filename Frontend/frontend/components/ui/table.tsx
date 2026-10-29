// Minimal table primitives. Tables scroll horizontally inside their container on
// narrow screens so the page itself never scrolls sideways.

export function Table({ children, caption }: { children: React.ReactNode; caption: string }) {
  return (
    // Focusable named region so keyboard users can scroll the table sideways on narrow screens.
    // `relative` contains absolutely positioned descendants (e.g. sr-only text in cells), which
    // otherwise widen the whole page on phones instead of scrolling inside this region.
    <div
      role="region"
      aria-label={caption}
      tabIndex={0}
      className="relative overflow-x-auto focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-600"
    >
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}

export function Th({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={`border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold tracking-wide text-slate-600 uppercase first:pl-4 sm:first:pl-5 ${className}`}
    >
      {children}
    </th>
  );
}

export function Td({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return (
    <td className={`border-b border-slate-100 px-4 py-3 align-top text-slate-700 first:pl-4 sm:first:pl-5 ${className}`}>
      {children}
    </td>
  );
}
