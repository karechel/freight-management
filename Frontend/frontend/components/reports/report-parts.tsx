'use client';

// Building blocks for the reports page: a single-series bar list (each bar
// carries its value as text, so the list doubles as its own table) and a CSV
// download that is generated in the browser from the figures on screen.

import { Button } from '@/components/ui/button';
import { DownloadIcon } from '@/components/ui/icons';
import { toCsv } from '@/lib/reports';

export interface BarDatum {
  label: string;
  value: number;
  /** Text shown for the value, e.g. a formatted amount. */
  display: string;
}

export function BarList({ data, label }: { data: BarDatum[]; label: string }) {
  const max = Math.max(0, ...data.map((d) => d.value));
  if (data.length === 0) return <p className="text-sm text-slate-500">No data for these filters.</p>;
  return (
    <ul aria-label={label} className="flex flex-col gap-2.5">
      {data.map((d) => (
        <li key={d.label} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-sm" title={`${d.label}: ${d.display}`}>
          <span className="truncate text-slate-700">{d.label}</span>
          <span className="h-2.5 rounded-full bg-slate-100" aria-hidden="true">
            <span
              className="block h-full rounded-full bg-blue-600"
              style={{ width: `${max > 0 ? Math.max((d.value / max) * 100, d.value > 0 ? 2 : 0) : 0}%` }}
            />
          </span>
          <span className="text-right font-medium text-slate-900 tabular-nums">{d.display}</span>
        </li>
      ))}
    </ul>
  );
}

/** Downloads the given rows as a CSV file. The file is built in this tab; nothing is sent anywhere. */
export function CsvButton({ filename, rows, label = 'CSV' }: { filename: string; rows: () => (string | number)[][]; label?: string }) {
  function download() {
    // Byte-order mark so spreadsheet programs read the file as UTF-8.
    const blob = new Blob(['﻿', toCsv(rows())], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
  return (
    <Button variant="secondary" size="sm" onClick={download}>
      <DownloadIcon className="size-4" />
      {label}
      <span className="sr-only"> – download {filename}</span>
    </Button>
  );
}
