/**
 * Template filling for the Persian strings kept in config.js. Strings use
 * {name} placeholders; numbers passed in are shown with Persian digits so the
 * "Persian numerals everywhere" rule holds in both the app and the bot.
 */

import { toFaDigits } from './persian.js?v=0.6.1';

/**
 * Replaces {key} placeholders in a template. Numeric values are converted to
 * Persian digits; strings are inserted as-is (callers format them first).
 * Unknown placeholders are left visible so a missing value is noticed in review.
 * @param {string} template
 * @param {Record<string, string|number>} [vars]
 * @returns {string}
 */
export function fill(template, vars = {}) {
  return String(template).replace(/\{(\w+)\}/g, (whole, key) => {
    if (!(key in vars)) return whole;
    const value = vars[key];
    return typeof value === 'number' ? toFaDigits(value) : String(value);
  });
}
