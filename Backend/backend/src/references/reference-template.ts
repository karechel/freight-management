import type {
  ContractDocumentType,
  ContractResetPolicy,
} from './reference.types.js';

const TOKEN = /\{([^{}]*)\}/g;
const SEQUENCE_TOKEN = /^SEQ:(\d+)$/;
const DATE_TOKENS = new Set(['YYYY', 'YY', 'MM', 'YYMM']);
const MAX_RENDERED_LENGTH = 40;
const MAX_SEQUENCE_PADDING = 10;
// Width assumed for the running number when checking the rendered length.
const LONGEST_SEQUENCE_DIGITS = 7;
// Tokens render at most this wide.
const TOKEN_WIDTH: Record<string, number> = {
  YYYY: 4,
  YY: 2,
  MM: 2,
  YYMM: 4,
  MODE: 4,
};

export interface DateParts {
  year: number;
  month: number;
}

/** The calendar year and month in Africa/Nairobi, whatever the server's time zone. */
export function nairobiDateParts(at: Date): DateParts {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(at);
  const part = (type: string) =>
    Number(parts.find((candidate) => candidate.type === type)!.value);
  return { year: part('year'), month: part('month') };
}

/** The counter period: 0 for never, YYYY for yearly, YYYYMM for monthly. */
export function counterPeriod(
  policy: ContractResetPolicy,
  { year, month }: DateParts,
): number {
  if (policy === 'yearly') return year;
  if (policy === 'monthly') return year * 100 + month;
  return 0;
}

/** Every problem with a template, empty when it can be saved. */
export function validateTemplate(
  documentType: ContractDocumentType,
  template: string,
  resetPolicy: ContractResetPolicy,
): string[] {
  const problems: string[] = [];
  const tokens = [...template.matchAll(TOKEN)].map((match) => match[1]);
  const sequences = tokens.filter((token) => SEQUENCE_TOKEN.test(token));

  if (sequences.length !== 1) {
    problems.push('Use the running number {SEQ:n} exactly once.');
  }
  for (const sequence of sequences) {
    const padding = Number(SEQUENCE_TOKEN.exec(sequence)![1]);
    if (padding < 1 || padding > MAX_SEQUENCE_PADDING) {
      problems.push(
        `The running number's padding must be from 1 to ${MAX_SEQUENCE_PADDING}.`,
      );
    }
  }

  for (const token of tokens) {
    if (SEQUENCE_TOKEN.test(token) || DATE_TOKENS.has(token)) continue;
    if (token === 'MODE') {
      if (documentType !== 'shipment') {
        problems.push('{MODE} can only be used for shipments.');
      }
    } else {
      problems.push(`Unknown placeholder {${token}}.`);
    }
  }

  if (!/^[A-Z0-9-]*$/.test(template.replace(TOKEN, ''))) {
    problems.push(
      'Outside placeholders, use only capital letters, digits and hyphens.',
    );
  }

  const hasYear = tokens.some((token) =>
    ['YYYY', 'YY', 'YYMM'].includes(token),
  );
  const hasMonth = tokens.some((token) => ['MM', 'YYMM'].includes(token));
  if (resetPolicy === 'yearly' && !hasYear) {
    problems.push('A yearly restart needs a year placeholder in the format.');
  }
  if (resetPolicy === 'monthly' && !(hasYear && hasMonth)) {
    problems.push(
      'A monthly restart needs year and month placeholders in the format.',
    );
  }

  const longest = template.replace(TOKEN, (_whole, token: string) => {
    const sequence = SEQUENCE_TOKEN.exec(token);
    const width = sequence
      ? Math.max(Number(sequence[1]), LONGEST_SEQUENCE_DIGITS)
      : (TOKEN_WIDTH[token] ?? 0);
    return 'X'.repeat(width);
  });
  if (longest.length > MAX_RENDERED_LENGTH) {
    problems.push(
      `References can be at most ${MAX_RENDERED_LENGTH} characters long.`,
    );
  }
  return problems;
}

export interface RenderInput extends DateParts {
  sequence: number;
  mode?: string;
}

/** Fills in a valid template. The number grows past its padding rather than being cut off. */
export function renderReference(template: string, input: RenderInput): string {
  const month = String(input.month).padStart(2, '0');
  const shortYear = String(input.year % 100).padStart(2, '0');
  return template.replace(TOKEN, (_whole, token: string) => {
    const sequence = SEQUENCE_TOKEN.exec(token);
    if (sequence) {
      return String(input.sequence).padStart(Number(sequence[1]), '0');
    }
    switch (token) {
      case 'YYYY':
        return String(input.year);
      case 'YY':
        return shortYear;
      case 'MM':
        return month;
      case 'YYMM':
        return `${shortYear}${month}`;
      case 'MODE':
        return (input.mode ?? '').toUpperCase();
      default:
        throw new Error(`Unknown placeholder {${token}}`);
    }
  });
}
