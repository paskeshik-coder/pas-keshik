/**
 * Tehran-time and Jalali date helpers used everywhere a timestamp is shown
 * or built from user input. Tehran is a fixed UTC+3:30 (config.timing), so we
 * shift epoch milliseconds by that offset and read the UTC fields — this never
 * depends on the phone's or server's own time zone.
 *
 * Timestamps are always epoch milliseconds (numbers) inside shared logic;
 * ISO strings are only used on the wire and in storage.
 */

import { CONFIG } from './config.js?v=0.6.1';
import { toJalali, toGregorian, jalaliMonthLength, isValidJalaliDate } from './jalali.js?v=0.6.1';
import { toFaDigits, toEnDigits } from './persian.js?v=0.6.1';
import { fill } from './text.js?v=0.6.1';

export const MINUTE_MS = 60 * 1000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;
const OFFSET_MS = CONFIG.timing.tehranOffsetMinutes * MINUTE_MS;

/**
 * Splits an instant into Tehran wall-clock parts on the Jalali calendar.
 * weekday: 0 = شنبه (Saturday) … 6 = جمعه (Friday).
 * @param {number} ms epoch milliseconds
 * @returns {{jy:number, jm:number, jd:number, hour:number, minute:number, weekday:number}}
 */
export function tehranParts(ms) {
  const d = new Date(ms + OFFSET_MS);
  const { jy, jm, jd } = toJalali(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  return { jy, jm, jd, hour: d.getUTCHours(), minute: d.getUTCMinutes(), weekday: (d.getUTCDay() + 1) % 7 };
}

/**
 * Builds the instant for a Tehran wall-clock time on a Jalali date.
 * @param {number} jy @param {number} jm @param {number} jd
 * @param {number} [hour] @param {number} [minute]
 * @returns {number} epoch milliseconds
 */
export function tehranMs(jy, jm, jd, hour = 0, minute = 0) {
  const { gy, gm, gd } = toGregorian(jy, jm, jd);
  return Date.UTC(gy, gm - 1, gd, hour, minute) - OFFSET_MS;
}

/**
 * The Jalali date (in Tehran) an instant falls on.
 * @param {number} ms
 * @returns {{jy:number, jm:number, jd:number}}
 */
export function tehranDate(ms) {
  const { jy, jm, jd } = tehranParts(ms);
  return { jy, jm, jd };
}

/**
 * Orders Jalali dates as plain numbers (yyyymmdd) for easy comparison.
 * @param {{jy:number, jm:number, jd:number}} date
 */
export function dayNumber(date) {
  return date.jy * 10000 + date.jm * 100 + date.jd;
}

/**
 * Tehran calendar day of an instant as "yyyy-mm-dd" (Jalali, ASCII digits).
 * Used for the "one active request per day" rule.
 * @param {number} ms
 */
export function dayKey(ms) {
  const { jy, jm, jd } = tehranDate(ms);
  return `${jy}-${String(jm).padStart(2, '0')}-${String(jd).padStart(2, '0')}`;
}

/**
 * Adds whole days to a Jalali date (calendar arithmetic through noon Tehran,
 * so the result can never slip across a day boundary).
 * @param {{jy:number, jm:number, jd:number}} date
 * @param {number} days
 */
export function addDays(date, days) {
  return tehranDate(tehranMs(date.jy, date.jm, date.jd, 12, 0) + days * DAY_MS);
}

/**
 * Moves an instant forward by whole Jalali months, keeping the Tehran
 * wall-clock time; the day is clamped to the target month's length
 * (31 شهریور + 1 month → 30 مهر).
 * @param {number} ms
 * @param {number} months
 */
export function addJalaliMonths(ms, months) {
  const p = tehranParts(ms);
  const index = p.jy * 12 + (p.jm - 1) + months;
  const jy = Math.floor(index / 12);
  const jm = (index % 12) + 1;
  const jd = Math.min(p.jd, jalaliMonthLength(jy, jm));
  return tehranMs(jy, jm, jd, p.hour, p.minute);
}

/**
 * Weekday (0 = شنبه) of a Jalali date.
 * @param {number} jy @param {number} jm @param {number} jd
 */
export function weekdayOf(jy, jm, jd) {
  return tehranParts(tehranMs(jy, jm, jd, 12, 0)).weekday;
}

/**
 * Parses a typed 24-hour time. Accepts Persian, Arabic or ASCII digits and
 * ":" "." "٫" "/" as separators: "8:30", "۰۸:۳۰", "0830", "20".
 * @param {string} value
 * @returns {{hour:number, minute:number}|null}
 */
export function parseTime(value) {
  const s = toEnDigits(String(value ?? '')).trim().replace(/[.٫/]/g, ':');
  let m = /^(\d{1,2}):(\d{1,2})$/.exec(s);
  if (!m) m = /^(\d{2})(\d{2})$/.exec(s);
  if (!m) {
    const only = /^(\d{1,2})$/.exec(s);
    if (only) m = [s, only[1], '0'];
  }
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

/**
 * Reads one of the two time fields (hours or minutes): one or two digits,
 * Persian, Arabic or Latin ("6" means 06), at most `max`.
 * @param {string} value
 * @param {number} max 23 for hours, 59 for minutes
 * @returns {number|null} null when empty or invalid
 */
function clockPart(value, max) {
  const s = toEnDigits(String(value ?? '')).trim();
  if (!/^\d{1,2}$/.test(s)) return null;
  const n = Number(s);
  return n <= max ? n : null;
}

/**
 * Reads the request form's two time fields. Hours 0–23 are required; minutes
 * 0–59, and an empty minutes field counts as 00.
 * @param {string} hourText
 * @param {string} minuteText
 * @returns {{hour:number, minute:number}|null}
 */
export function parseClock(hourText, minuteText) {
  const hour = clockPart(hourText, 23);
  if (hour === null) return null;
  const minuteEmpty = toEnDigits(String(minuteText ?? '')).trim() === '';
  const minute = minuteEmpty ? 0 : clockPart(minuteText, 59);
  return minute === null ? null : { hour, minute };
}

/**
 * Whether the hours field can't take another digit, so typing moves on to
 * the minutes: two digits, or one digit from 3 to 9 (no hour 30–99 exists).
 * @param {string} hourText
 */
export function hourComplete(hourText) {
  const s = toEnDigits(String(hourText ?? '')).trim();
  return /^\d{2}$/.test(s) || /^[3-9]$/.test(s);
}

/**
 * Keeps only the digits of a time field as typed (Persian, Arabic or Latin
 * become Persian), at most two, so the field shows what will be read.
 * @param {string} value
 */
export function clockFieldText(value) {
  return toFaDigits(toEnDigits(String(value ?? '')).replace(/\D/g, '').slice(0, 2));
}

/**
 * Formats hours and minutes as HH:MM with Persian digits.
 * @param {number} hour @param {number} minute
 */
export function formatHM(hour, minute) {
  return toFaDigits(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
}

/**
 * Tehran clock time of an instant, e.g. «۰۸:۰۰».
 * @param {number} ms
 */
export function formatTime(ms) {
  const p = tehranParts(ms);
  return formatHM(p.hour, p.minute);
}

/**
 * Month title for the calendar grid, e.g. «مهر ۱۴۰۵».
 * @param {number} jy @param {number} jm
 */
export function monthTitle(jy, jm) {
  return `${CONFIG.calendar.monthNames[jm - 1]} ${toFaDigits(jy)}`;
}

/**
 * Full Jalali date with weekday, e.g. «شنبه ۵ مهر ۱۴۰۵».
 * @param {number} ms
 */
export function formatDate(ms) {
  const p = tehranParts(ms);
  return `${CONFIG.calendar.weekdayNames[p.weekday]} ${toFaDigits(p.jd)} ${monthTitle(p.jy, p.jm)}`;
}

/**
 * Date and time together, e.g. «شنبه ۵ مهر ۱۴۰۵، ساعت ۰۸:۰۰».
 * @param {number} ms
 */
export function formatDateTime(ms) {
  return fill(CONFIG.text.common.dateTime, { date: formatDate(ms), time: formatTime(ms) });
}

/**
 * Latest allowed shift start for a given "now" (config.limits.maxStartAheadMonths).
 * @param {number} nowMs
 */
export function latestStart(nowMs) {
  return addJalaliMonths(nowMs, CONFIG.limits.maxStartAheadMonths);
}

/**
 * Builds an instant from a Jalali date and a time: typed "HH:MM" text, or
 * the {hour, minute} read from the two time fields (parseClock).
 * @param {{jy:number, jm:number, jd:number}|null} date
 * @param {string|{hour:number, minute:number}|null} time
 * @returns {number|null} epoch ms, or null if either part is missing/invalid
 */
export function combineDateTime(date, time) {
  if (!date || !isValidJalaliDate(date.jy, date.jm, date.jd)) return null;
  const t = typeof time === 'string' ? parseTime(time) : time;
  if (!t) return null;
  return tehranMs(date.jy, date.jm, date.jd, t.hour, t.minute);
}

/**
 * Parses an ISO string or epoch number coming from storage or the wire.
 * @param {string|number|Date|null|undefined} value
 * @returns {number} epoch ms (NaN when unparseable)
 */
export function toMs(value) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value) return Date.parse(value);
  return NaN;
}
