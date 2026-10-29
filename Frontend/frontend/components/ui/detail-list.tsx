// Label/value grid for record details.

export interface DetailItem {
  label: string;
  value: React.ReactNode;
}

export function DetailList({ items, columns = 2 }: { items: DetailItem[]; columns?: 1 | 2 | 3 }) {
  const grid = { 1: '', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-2 lg:grid-cols-3' }[columns];
  return (
    <dl className={`grid grid-cols-1 gap-x-6 gap-y-4 ${grid}`}>
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-xs font-medium text-slate-500">{item.label}</dt>
          <dd className="mt-0.5 text-sm break-words text-slate-900">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
