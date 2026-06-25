/**
 * Malaysian mobile in local form: 01X-XXXXXXX … (e.g. 011-1234567, 011-12345678).
 * Inserts dash after the first 3 digits; allows 11–12 total digits (7–9 after the dash).
 */

const DIGITS_MAX = 12;

export function formatMalaysiaMobileDash(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, DIGITS_MAX);
  if (d.length <= 3) return d;
  return `${d.slice(0, 3)}-${d.slice(3)}`;
}

/** 01X- plus 7–9 digits → 10–12 digits total (typically 11–12 digit numbers once formatted). */
export function isValidMalaysiaMobileDash(value: string): boolean {
  return /^01[0-9]-[0-9]{7,9}$/.test(value.trim());
}
