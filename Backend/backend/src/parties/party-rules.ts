/** Fits the `Money` column, Numeric(14, 2). Negative amounts never match. */
export const MONEY_PATTERN = /^\d{1,12}(\.\d{1,2})?$/;

export const PHONE_PATTERN = /^\+?[0-9(][0-9 ()-]{5,18}[0-9]$/;

/** The exact two-decimal text the database returns, so "1250.5" and "1250.50" compare as equal. */
export function normalizeMoney(value: string): string {
  const [whole, fraction = ''] = value.split('.');
  return `${whole.replace(/^0+(?=\d)/, '')}.${fraction.padEnd(2, '0')}`;
}

/** Makes user input match literally inside an ILIKE pattern, then matches it anywhere in the text. */
export function containsPattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
}
