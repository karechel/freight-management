// Formatting helpers. A fixed locale and time zone keep server- and
// client-rendered output identical (avoids hydration mismatches).

const LOCALE = 'en-KE';
const TIME_ZONE = 'Africa/Nairobi';

const kesFormatter = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: 'KES',
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat(LOCALE);

const dateFormatter = new Intl.DateTimeFormat(LOCALE, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: TIME_ZONE,
});

const shortDateFormatter = new Intl.DateTimeFormat(LOCALE, {
  day: 'numeric',
  month: 'short',
  timeZone: TIME_ZONE,
});

const dateTimeFormatter = new Intl.DateTimeFormat(LOCALE, {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: TIME_ZONE,
});

export const formatKes = (amount: number) => kesFormatter.format(amount);
export const formatNumber = (value: number) => numberFormatter.format(value);
export const formatDate = (iso: string) => dateFormatter.format(new Date(iso));
export const formatShortDate = (iso: string) =>
  shortDateFormatter.format(new Date(iso));
export const formatDateTime = (iso: string) =>
  dateTimeFormatter.format(new Date(iso));

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days from `fromIso` to `toIso` (negative when `toIso` is earlier). */
export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / DAY_MS);
}
