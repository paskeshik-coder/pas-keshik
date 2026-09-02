/**
 * ============================================================================
 * پاس‌کشیک — PERSIAN CALENDAR  (jalali.js)
 * ============================================================================
 * Conversion between the Gregorian calendar the browser uses and the Jalali
 * (Shamsi) calendar the app displays.
 *
 * WHY THIS IS WRITTEN BY HAND
 * JavaScript has no built-in Jalali support, and the alternative — a library
 * from a CDN — is not an option here: testing proved public CDNs unreachable
 * on Iranian connections.
 *
 * WHY IT IS TRUSTWORTHY
 * A wrong leap-year rule would shift shift dates by a day, and nobody would
 * notice until someone missed a کشیک. So this was validated before use:
 * every day from 1950 to 2100 (54,787 days) was converted and converted back,
 * with zero mismatches, and the Jalali side was checked to advance by exactly
 * one day each time — no gaps, no repeats. The leap years it produces for
 * 1390-1420 are 1391, 1395, 1399, 1403, 1408, 1412, 1416, 1420, matching the
 * known 4-4-4-5 pattern of the 33-year cycle.
 *
 * Months are 1-based: 1 is فروردین, 12 is اسفند.
 * ============================================================================
 */

const Jalali = {

  /** Integer division, truncating toward zero. */
  _div(a, b) { return ~~(a / b); },

  /**
   * Convert a Gregorian date to Jalali.
   *
   * @param   {number} gy  Gregorian year, e.g. 2026.
   * @param   {number} gm  Gregorian month, 1-12.
   * @param   {number} gd  Gregorian day of month.
   * @returns {number[]}   [jalaliYear, jalaliMonth, jalaliDay]
   */
  fromGregorian(gy, gm, gd) {
    const div = this._div;
    // Cumulative days at the start of each Gregorian month, ignoring leap day.
    const monthOffsets = [0,31,59,90,120,151,181,212,243,273,304,334];

    let jy = (gy <= 1600) ? 0 : 979;
    gy -= (gy <= 1600) ? 621 : 1600;

    // Leap-day accounting shifts by one once past February.
    const gy2 = (gm > 2) ? (gy + 1) : gy;

    let days = (365 * gy) + div(gy2 + 3, 4) - div(gy2 + 99, 100)
             + div(gy2 + 399, 400) - 80 + gd + monthOffsets[gm - 1];

    // 12053 days is one full 33-year Jalali cycle; 1461 is one 4-year cycle.
    jy += 33 * div(days, 12053);  days %= 12053;
    jy += 4  * div(days, 1461);   days %= 1461;

    if (days > 365) { jy += div(days - 1, 365); days = (days - 1) % 365; }

    // First six months are 31 days, the next five are 30.
    const jm = (days < 186) ? 1 + div(days, 31) : 7 + div(days - 186, 30);
    const jd = 1 + ((days < 186) ? (days % 31) : ((days - 186) % 30));

    return [jy, jm, jd];
  },

  /**
   * Convert a Jalali date to Gregorian.
   *
   * @param   {number} jy  Jalali year, e.g. 1405.
   * @param   {number} jm  Jalali month, 1-12.
   * @param   {number} jd  Jalali day of month.
   * @returns {number[]}   [gregorianYear, gregorianMonth, gregorianDay]
   */
  toGregorian(jy, jm, jd) {
    const div = this._div;

    let gy = (jy <= 979) ? 621 : 1600;
    jy -= (jy <= 979) ? 0 : 979;

    let days = (365 * jy) + (div(jy, 33) * 8) + div((jy % 33) + 3, 4) + 78 + jd
             + ((jm < 7) ? (jm - 1) * 31 : ((jm - 7) * 30) + 186);

    // 146097 days is the 400-year Gregorian cycle; 36524 is a century.
    gy += 400 * div(days, 146097);
    days %= 146097;

    if (days > 36524) {
      gy += 100 * div(--days, 36524);
      days %= 36524;
      if (days >= 365) days++;
    }

    gy += 4 * div(days, 1461);
    days %= 1461;
    if (days > 365) { gy += div(days - 1, 365); days = (days - 1) % 365; }

    let gd = days + 1;
    const isLeap = (gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0);
    const lengths = [0,31,isLeap?29:28,31,30,31,30,31,31,30,31,30,31];

    let gm;
    for (gm = 0; gm < 13 && gd > lengths[gm]; gm++) gd -= lengths[gm];

    return [gy, gm, gd];
  },

  /**
   * Today's date in the Jalali calendar, in Tehran time.
   *
   * The device clock could be set to any timezone, but the app's day must be
   * Tehran's day — a request created at 1am Tehran time belongs to that date
   * regardless of where the phone thinks it is. Intl does the conversion using
   * the browser's own timezone database, which handles any future change to
   * Iran's offset or daylight-saving rules without an edit here.
   *
   * @returns {number[]}  [jalaliYear, jalaliMonth, jalaliDay]
   */
  today() {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Tehran',
      year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date()).split('-').map(Number);

    return this.fromGregorian(parts[0], parts[1], parts[2]);
  },

  /** The current Jalali year in Tehran. @returns {number} */
  currentYear() { return this.today()[0]; },

  /**
   * Number of days in a Jalali month.
   *
   * Esfand's length is worked out by measuring the distance between successive
   * new years rather than applying a leap rule written out separately. Two
   * independent statements of the same rule can drift apart; one cannot.
   *
   * @param   {number} jy  Jalali year.
   * @param   {number} jm  Jalali month, 1-12.
   * @returns {number}     29, 30 or 31.
   */
  monthLength(jy, jm) {
    if (jm <= 6)  return 31;
    if (jm <= 11) return 30;

    const toUtc = ([y, m, d]) => Date.UTC(y, m - 1, d);
    const thisNewYear = toUtc(this.toGregorian(jy,     1, 1));
    const nextNewYear = toUtc(this.toGregorian(jy + 1, 1, 1));

    return Math.round((nextNewYear - thisNewYear) / 86400000) === 366 ? 30 : 29;
  },

  /** Whether a Jalali year has 366 days. @param {number} jy @returns {boolean} */
  isLeapYear(jy) { return this.monthLength(jy, 12) === 30; }

};
