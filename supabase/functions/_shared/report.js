/**
 * Error reports (diagnostics). Whenever the app shows an error message, it
 * also sends the technical reason to the server log (app/report.js →
 * the gateway's clientError action), so a problem on someone's phone never
 * needs guessing.
 *
 * A report holds only: the error's name and message, its code, the action
 * and screen it happened in, where in the code (file:line), and the app
 * version, Telegram platform, Telegram (Bot API) version and Telegram app
 * version. Never a name, username, Telegram ID or initData: cleanReport()
 * keeps only these fields, checks each against a pattern, and scrubs the
 * free text (links to t.me, @usernames, long numbers, launch parameters and
 * anything that isn't plain ASCII, so no Persian name, are removed). The app
 * runs it before sending, and the server runs it again on what it receives
 * (never trusting the client) before writing one log line.
 *
 * Shared by the app and the server (no server-only imports).
 */

/** Longest message and code location kept. */
export const REPORT_MESSAGE_MAX = 300;
export const REPORT_WHERE_MAX = 200;

/**
 * Free text with anything personal removed.
 * @param {any} value
 * @param {number} max
 */
export function scrubText(value, max) {
  return String(value ?? '')
    // Telegram's launch parameters and initData fields, whatever their value.
    .replace(/(tgWebApp[A-Za-z]*|initData|query_id|user|auth_date|hash|signature|receiver|chat_instance|start_param)=[^\s&#'"]*/gi, '$1=...')
    // Chats and profiles: https://t.me/<username>, telegram.me, tg:// links.
    .replace(/(?:https?:\/\/)?(?:t\.me|telegram\.me|telegram\.dog)\/[^\s'")\]]*/gi, 't.me/...')
    .replace(/tg:\/\/[^\s'")\]]*/gi, 'tg://...')
    .replace(/@[A-Za-z0-9_]{2,}/g, '@...')
    // Telegram IDs and other long numbers.
    .replace(/\d{5,}/g, '#')
    // Names and anything else that isn't plain ASCII.
    .replace(/[^\x20-\x7E]+/g, '?')
    .slice(0, max);
}

/** A value matching `pattern`, or null. */
const pick = (value, pattern) => (typeof value === 'string' && pattern.test(value) ? value : null);

/**
 * The report as it may be sent and logged: only the known fields, each
 * checked, free text scrubbed.
 * @param {any} input
 * @returns {{name:string, message:string, code:string|null, action:string|null, screen:string|null,
 *            where:string|null, app:string|null, platform:string|null, tgVersion:string|null, client:string|null}}
 */
export function cleanReport(input) {
  const r = input && typeof input === 'object' ? input : {};
  return {
    name: pick(r.name, /^[A-Za-z][A-Za-z0-9_]{0,39}$/) ?? 'Error',
    message: scrubText(r.message, REPORT_MESSAGE_MAX),
    code: pick(r.code, /^[a-z0-9_]{1,40}$/),
    action: pick(r.action, /^[A-Za-z][A-Za-z0-9_:-]{0,39}$/),
    screen: pick(r.screen, /^[A-Za-z][A-Za-z0-9_]{0,39}$/),
    where: r.where === undefined || r.where === null ? null : scrubText(r.where, REPORT_WHERE_MAX) || null,
    app: pick(r.app, /^[0-9]{1,3}(\.[0-9]{1,3}){1,3}$/),
    platform: pick(r.platform, /^[a-z_]{1,20}$/),
    tgVersion: pick(r.tgVersion, /^[0-9]{1,3}(\.[0-9]{1,3}){0,2}$/),
    client: pick(r.client, /^Telegram-(Android|iOS|Desktop|macOS|Web[AK]?)\/[0-9]{1,3}(\.[0-9]{1,4}){0,3}$/),
  };
}

/**
 * Where an error happened: the first stack frames as path:line:column,
 * without the site's address or the ?v= version.
 * @param {any} stack
 */
export function stackWhere(stack) {
  if (typeof stack !== 'string') return null;
  const frames = [];
  for (const m of stack.matchAll(/(?:https?:\/\/[^/\s]+)?\/?((?:app|supabase)\/[A-Za-z0-9_/.-]+\.js)(?:\?[^:\s)]*)?:(\d+):(\d+)/g)) {
    frames.push(`${m[1]}:${m[2]}:${m[3]}`);
    if (frames.length === 3) break;
  }
  return frames.length ? frames.join(' < ') : null;
}
