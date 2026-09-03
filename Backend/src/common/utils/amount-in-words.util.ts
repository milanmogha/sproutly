/**
 * Rupee amounts spelled out, the way an Indian receipt does it.
 *
 * Grouping is lakh/crore, not thousand/million — "Rupees One Lakh Twenty
 * Thousand Only", never "One Hundred Twenty Thousand". Getting this wrong on a
 * printed receipt looks like a foreign template, and the words are the part a
 * parent checks against the figure.
 */

const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];

const TENS = [
  '',
  '',
  'Twenty',
  'Thirty',
  'Forty',
  'Fifty',
  'Sixty',
  'Seventy',
  'Eighty',
  'Ninety',
];

/** 0–99. */
function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  const tens = TENS[Math.floor(n / 10)];
  const ones = ONES[n % 10];
  return ones ? `${tens} ${ones}` : tens;
}

/** 0–999. */
function threeDigits(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (hundreds) parts.push(`${ONES[hundreds]} Hundred`);
  if (rest) parts.push(twoDigits(rest));
  return parts.join(' ');
}

/**
 * A whole number in the Indian system: crore, lakh, thousand, then the last
 * three digits.
 */
function wholeNumberInWords(n: number): string {
  if (n === 0) return 'Zero';

  const crore = Math.floor(n / 10_000_000);
  const lakh = Math.floor((n % 10_000_000) / 100_000);
  const thousand = Math.floor((n % 100_000) / 1000);
  const rest = n % 1000;

  const parts: string[] = [];
  // Crores can exceed 99, so they recurse rather than cap at two digits.
  if (crore) parts.push(`${wholeNumberInWords(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (rest) parts.push(threeDigits(rest));
  return parts.join(' ');
}

/**
 * The full line printed on a receipt, e.g.
 * `Rupees Thirty Six Thousand Seven Hundred Only`.
 *
 * Paise are spelled out only when there are any, since school fees are
 * overwhelmingly whole rupees and "and Zero Paise" on every receipt is noise.
 */
export function amountInWords(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.abs(amount) : 0;
  // Round to paise first: 0.1 + 0.2 arithmetic must not produce "Ninety Nine
  // Paise" on an amount the rest of the receipt prints as a round figure.
  const totalPaise = Math.round(safe * 100);
  const rupees = Math.floor(totalPaise / 100);
  const paise = totalPaise % 100;

  const sign = amount < 0 ? 'Minus ' : '';
  const rupeeWords = `Rupees ${wholeNumberInWords(rupees)}`;
  if (!paise) return `${sign}${rupeeWords} Only`;
  return `${sign}${rupeeWords} and ${twoDigits(paise)} Paise Only`;
}
