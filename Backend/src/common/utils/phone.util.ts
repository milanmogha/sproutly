/**
 * Indian mobile number helpers.
 *
 * Accepted inputs (separators ` `, `-` allowed anywhere):
 *   9876543210 · 09876543210 · 919876543210 · +919876543210 · +91 98765-43210
 * The subscriber number must be 10 digits starting with 6-9.
 *
 * Canonical stored/matched form: `+91XXXXXXXXXX`.
 */

/** DTO-level pattern — same shapes normalizeIndianPhone() accepts. */
export const INDIAN_PHONE_REGEX =
  /^(?:\+?91[\s-]?|0)?(?:[6-9](?:[\s-]?\d){9})$/;

/**
 * Returns the canonical `+91XXXXXXXXXX` form, or `null` when the input is
 * not a valid Indian mobile number.
 */
export function normalizeIndianPhone(input: string): string | null {
  const digits = input.replace(/[\s-]/g, '').replace(/^\+/, '');
  let subscriber: string;
  if (digits.length === 10) {
    subscriber = digits;
  } else if (digits.length === 11 && digits.startsWith('0')) {
    subscriber = digits.slice(1);
  } else if (digits.length === 12 && digits.startsWith('91')) {
    subscriber = digits.slice(2);
  } else {
    return null;
  }
  if (!/^[6-9]\d{9}$/.test(subscriber)) {
    return null;
  }
  return `+91${subscriber}`;
}
