/**
 * Malaysian mobile in local form: 01X-XXXXXXX (e.g. 011-1234567).
 * Accepts only digits while typing; inserts dash after the first 3 digits.
 */

const DIGITS_MAX = 10;

export function formatMalaysiaMobileDash(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, DIGITS_MAX);
  if (d.length <= 3) return d;
  return `${d.slice(0, 3)}-${d.slice(3)}`;
}

export function isValidMalaysiaMobileDash(value: string): boolean {
  return /^01[0-9]-[0-9]{7}$/.test(value.trim());
}
