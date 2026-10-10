/**
 * Jalali (Persian solar hijri) ⇄ Gregorian calendar conversion.
 *
 * This is the well-known algorithm by Kazimierz Borkowski as used by the
 * jalaali-js library (MIT): the "breaks" table encodes the 2820-year cycle
 * irregularities, and all conversions go through Julian Day Numbers. It is
 * exact for Jalali years -61 … 3177. Pure integer arithmetic; no Date objects,
 * so results never depend on the device's time zone.
 */

const BREAKS = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];

/**
 * Integer division truncating toward zero (as the reference algorithm needs).
 * @param {number} a
 * @param {number} b
 */
function div(a, b) {
  return Math.trunc(a / b);
}

/**
 * Remainder matching `div` (sign follows the dividend).
 * @param {number} a
 * @param {number} b
 */
function mod(a, b) {
  return a - Math.trunc(a / b) * b;
}

/**
 * Core of the algorithm: for a Jalali year returns whether it is leap
 * (leap === 0), the matching Gregorian year and the March day of Nowruz.
 * @param {number} jy
 * @returns {{leap:number, gy:number, march:number}}
 */
function jalCal(jy) {
  const bl = BREAKS.length;
  const gy = jy + 621;
  let leapJ = -14;
  let jp = BREAKS[0];
  let jump = 0;
  if (jy < jp || jy >= BREAKS[bl - 1]) throw new RangeError(`Invalid Jalali year ${jy}`);
  for (let i = 1; i < bl; i += 1) {
    const jm = BREAKS[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }
  let n = jy - jp;
  leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;
  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  let leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;
  return { leap, gy, march };
}

/**
 * Gregorian date → Julian Day Number.
 * @param {number} gy @param {number} gm @param {number} gd
 */
function g2d(gy, gm, gd) {
  let d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4) + div(153 * mod(gm + 9, 12) + 2, 5) + gd - 34840408;
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}

/**
 * Julian Day Number → Gregorian date.
 * @param {number} jdn
 */
function d2g(jdn) {
  let j = 4 * jdn + 139361631;
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1;
  const gm = mod(div(i, 153), 12) + 1;
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { gy, gm, gd };
}

/**
 * Jalali date → Julian Day Number.
 * @param {number} jy @param {number} jm @param {number} jd
 */
function j2d(jy, jm, jd) {
  const r = jalCal(jy);
  return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
}

/**
 * Julian Day Number → Jalali date.
 * @param {number} jdn
 */
function d2j(jdn) {
  const gy = d2g(jdn).gy;
  let jy = gy - 621;
  const r = jalCal(jy);
  const jdn1f = g2d(gy, 3, r.march);
  let k = jdn - jdn1f;
  if (k >= 0) {
    if (k <= 185) {
      return { jy, jm: 1 + div(k, 31), jd: mod(k, 31) + 1 };
    }
    k -= 186;
  } else {
    jy -= 1;
    k += 179;
    if (r.leap === 1) k += 1;
  }
  return { jy, jm: 7 + div(k, 30), jd: mod(k, 30) + 1 };
}

/**
 * Gregorian → Jalali.
 * @param {number} gy @param {number} gm 1-12 @param {number} gd
 * @returns {{jy:number, jm:number, jd:number}}
 */
export function toJalali(gy, gm, gd) {
  return d2j(g2d(gy, gm, gd));
}

/**
 * Jalali → Gregorian.
 * @param {number} jy @param {number} jm 1-12 @param {number} jd
 * @returns {{gy:number, gm:number, gd:number}}
 */
export function toGregorian(jy, jm, jd) {
  return d2g(j2d(jy, jm, jd));
}

/**
 * True for Jalali leap years (Esfand has 30 days).
 * @param {number} jy
 */
export function isLeapJalaliYear(jy) {
  return jalCal(jy).leap === 0;
}

/**
 * Number of days in a Jalali month: 31 for the first six, 30 for the next
 * five, and 29 or 30 for Esfand.
 * @param {number} jy @param {number} jm
 */
export function jalaliMonthLength(jy, jm) {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return isLeapJalaliYear(jy) ? 30 : 29;
}

/**
 * Checks that a Jalali triple names a real day.
 * @param {number} jy @param {number} jm @param {number} jd
 */
export function isValidJalaliDate(jy, jm, jd) {
  return Number.isInteger(jy) && Number.isInteger(jm) && Number.isInteger(jd)
    && jy >= -60 && jy <= 3177 && jm >= 1 && jm <= 12 && jd >= 1 && jd <= jalaliMonthLength(jy, jm);
}
