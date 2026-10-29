// Conversions between stored ISO date-times and HTML date / datetime-local
// input values. All dates are entered and shown in Africa/Nairobi time, which
// is a fixed UTC+03:00 offset with no daylight saving, so the conversion is exact.

const OFFSET = '+03:00';
const OFFSET_MS = 3 * 60 * 60 * 1000;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DATE_TIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** Nairobi wall-clock time as `YYYY-MM-DDTHH:mm:ss`. */
function nairobiWallClock(iso: string): string {
  return new Date(new Date(iso).getTime() + OFFSET_MS).toISOString().slice(0, 19);
}

/** ISO date-time → `YYYY-MM-DD` for `<input type="date">`. */
export const toDateInput = (iso?: string) => (iso ? nairobiWallClock(iso).slice(0, 10) : '');

/** ISO date-time → `YYYY-MM-DDTHH:mm` for `<input type="datetime-local">`. */
export const toDateTimeInput = (iso?: string) => (iso ? nairobiWallClock(iso).slice(0, 16) : '');

/** `YYYY-MM-DD` → ISO at 00:00 Nairobi time; undefined when empty or malformed. */
export function fromDateInput(value: string): string | undefined {
  return DATE_RE.test(value) && isValidIso(`${value}T00:00:00${OFFSET}`) ? `${value}T00:00:00${OFFSET}` : undefined;
}

/** `YYYY-MM-DDTHH:mm` → ISO in Nairobi time; undefined when empty or malformed. */
export function fromDateTimeInput(value: string): string | undefined {
  return DATE_TIME_RE.test(value) && isValidIso(`${value}:00${OFFSET}`) ? `${value}:00${OFFSET}` : undefined;
}

function isValidIso(iso: string): boolean {
  return !Number.isNaN(new Date(iso).getTime());
}

/** Current time as an ISO string with the Nairobi offset. Call from event handlers only (not during render). */
export function nowIso(): string {
  return `${nairobiWallClock(new Date().toISOString())}${OFFSET}`;
}

/** Current Nairobi time for a datetime-local input. Event handlers only. */
export const nowDateTimeInput = () => nowIso().slice(0, 16);

export const isBefore = (a: string, b: string) => new Date(a).getTime() < new Date(b).getTime();
