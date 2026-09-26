/**
 * Price parsing, validation and formatting (whole تومان). Shared by the
 * request form, the offer form, the gateway's input validation and the bot's
 * messages, so a price is read and shown identically everywhere.
 */

import { CONFIG } from './config.js?v=0.6.1';
import { toEnDigits, toFaDigits } from './persian.js?v=0.6.1';
import { fill } from './text.js?v=0.6.1';

/**
 * Reads a typed price. Persian/Arabic/ASCII digits and the usual thousands
 * separators (, ٬ ، . space) are accepted; anything else makes it invalid.
 * @param {string|number|null|undefined} value
 * @returns {number|null|typeof NaN} null for an empty input, NaN for garbage
 */
export function parsePrice(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  const cleaned = toEnDigits(String(value)).replace(/[\s,٬،.'’]/g, '');
  if (cleaned === '') return null;
  if (!/^\d{1,12}$/.test(cleaned)) return NaN;
  return Number(cleaned);
}

/**
 * Checks a parsed price against the allowed range.
 * @param {number|null} price
 * @returns {null|'price_invalid'|'price_out_of_range'} null when valid
 */
export function checkPrice(price) {
  if (typeof price !== 'number' || !Number.isSafeInteger(price)) return 'price_invalid';
  if (price < CONFIG.limits.priceMin || price > CONFIG.limits.priceMax) return 'price_out_of_range';
  return null;
}

// Longest price the price fields accept (the same bound parsePrice reads).
const MAX_PRICE_DIGITS = 12;

/**
 * Groups a string of ASCII digits in threes with the Persian thousands
 * separator (٬) and Persian digits.
 * @param {string} digits
 */
function groupDigits(digits) {
  return toFaDigits(digits.replace(/\B(?=(\d{3})+(?!\d))/g, '٬'));
}

/**
 * Groups digits in threes with the Persian thousands separator (٬).
 * @param {number} n
 * @returns {string} e.g. «۱٬۲۰۰٬۰۰۰»
 */
export function formatNumber(n) {
  return groupDigits(String(Math.trunc(n)));
}

/**
 * What a price field shows while the user types: only the digits (Persian,
 * Arabic or Latin; anything else is dropped), grouped with the same
 * separator and digits the app uses to show prices. "1500000" and
 * "۱۵۰۰۰۰۰" both become «۱٬۵۰۰٬۰۰۰». parsePrice reads the result back.
 * @param {string} value
 * @returns {string} '' when there are no digits
 */
export function formatPriceTyping(value) {
  const digits = toEnDigits(String(value ?? '')).replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, MAX_PRICE_DIGITS);
  return digits ? groupDigits(digits) : '';
}

/**
 * How many digits come before position `caret` in a typed value — used to
 * put the caret back in the same place after the separators are redrawn.
 * @param {string} value
 * @param {number} caret
 */
export function digitsBefore(value, caret) {
  return toEnDigits(String(value ?? '').slice(0, caret)).replace(/\D/g, '').length;
}

/**
 * The position in a formatted value just after its `count`-th digit.
 * @param {string} formatted
 * @param {number} count
 */
export function caretAfterDigits(formatted, count) {
  if (count <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < formatted.length; i += 1) {
    if (/\d/.test(toEnDigits(formatted[i]))) seen += 1;
    if (seen === count) return i + 1;
  }
  return formatted.length;
}

/**
 * Price with its unit, e.g. «۱٬۲۰۰٬۰۰۰ تومان».
 * @param {number} n
 */
export function formatPrice(n) {
  return fill(CONFIG.text.common.price, { amount: formatNumber(n) });
}

/**
 * Values for the {min}/{max} placeholders in price messages.
 */
export function priceRangeVars() {
  return { min: formatNumber(CONFIG.limits.priceMin), max: formatNumber(CONFIG.limits.priceMax) };
}
