/**
 * Maps error codes (returned by the gateway, the SQL functions and the local
 * engine alike) to the Persian messages in config.js, filling in the numbers
 * each message mentions. Codes are the contract between server and client;
 * wording lives only in config. (The admin menu passes the server's fuller
 * list, which adds the messages only admins see.)
 */

import { CONFIG } from './config.js?v=0.6.1';
import { fill } from './text.js?v=0.6.1';
import { priceRangeVars } from './price.js?v=0.6.1';

/**
 * Placeholder values per error code.
 * @param {string} code
 * @returns {Record<string, string|number>}
 */
function varsFor(code) {
  const L = CONFIG.limits;
  switch (code) {
    case 'first_name_short':
    case 'last_name_short':
      return { min: L.nameMin };
    case 'first_name_long':
    case 'last_name_long':
      return { max: L.nameMax };
    case 'place_too_long':
      return { max: L.placeMax };
    case 'place_digits':
      return { max: L.placeMaxDigitRun };
    case 'start_too_far':
      return { months: L.maxStartAheadMonths };
    case 'shift_too_long':
      return { hours: L.maxShiftHours };
    case 'too_many_active':
      return { max: L.maxActiveRequests };
    case 'price_out_of_range':
      return priceRangeVars();
    default:
      return {};
  }
}

/**
 * Persian message for an error code; unknown codes get the generic message.
 * @param {string} code
 * @param {Record<string,string>} [messages] the list to look in (the app's by default)
 * @returns {string}
 */
export function errorText(code, messages = CONFIG.text.errors) {
  const template = messages[code] ?? messages.unknown;
  return fill(template, varsFor(code));
}

/**
 * Error carrying one of the codes above. Thrown by both backends so screens
 * can show `errorText(err.code)` without caring where it came from.
 */
export class AppError extends Error {
  /**
   * @param {string} code
   * @param {string} [detail] technical detail (English) for diagnostics only
   */
  constructor(code, detail) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'AppError';
    this.code = code;
  }
}

/**
 * The row list of a database list result, or an exception. A failed or
 * malformed result must never look like "nothing found": an empty list
 * would silently skip reminders or broadcasts, or tell an admin that no user
 * matches. Used wherever a caller needs `rows` from a list function.
 * @param {any} result a jsonb result such as {ok:true, rows:[…]}
 * @param {string} label what was being read (for the log; no personal data)
 * @returns {any[]}
 */
export function rowsOf(result, label) {
  if (!result || result.ok !== true || !Array.isArray(result.rows)) {
    throw new Error(`database ${label} failed: ${result?.error ?? 'no rows in result'}`);
  }
  return result.rows;
}
