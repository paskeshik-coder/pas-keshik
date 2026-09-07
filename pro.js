/**
 * ============================================================================
 * پاس‌کشیک — PRO TIER  (pro.js)
 * ============================================================================
 * Entitlement checks for the paid tier.
 *
 * The whole tier is dormant: CONFIG.PRO.ENABLED is false, so isActive always
 * returns false and everyone gets the free limits. Nothing in the app is gated
 * yet. This file exists so that when the tier is switched on, the checks are
 * already in the right places rather than being retrofitted across screens.
 *
 * THREE RULES THIS ENCODES
 *
 * 1. Expiry is computed on read. `proUntil` is a timestamp and every check
 *    compares it to now, so nobody has to be flipped back by a scheduled job
 *    that could silently stop running.
 *
 * 2. Pro adds, never subtracts. Free limits are the limits the app has today.
 *    Switching the tier on gives payers more; it takes nothing from anyone who
 *    already had it, which is the difference between an upsell and a betrayal.
 *
 * 3. This file is not a security boundary. Stage 3 re-checks every entitlement
 *    inside the Edge Function before acting. These checks decide what to draw;
 *    the server decides what is allowed.
 * ============================================================================
 */

const Pro = {

  /**
   * Whether this user currently holds an active Pro subscription.
   *
   * @param   {object} profile  The user record.
   * @returns {boolean}
   */
  isActive(profile) {
    if (!CONFIG.PRO.ENABLED) return false;
    if (!profile?.proUntil) return false;
    return new Date(profile.proUntil).getTime() > Date.now();
  },

  /**
   * Whether a user may use a named feature.
   *
   * A feature not listed in config is not gated, so forgetting to add an entry
   * fails open rather than silently disabling something for everyone.
   *
   * @param   {object} profile
   * @param   {string} feature  A key from CONFIG.PRO.FEATURES.
   * @returns {boolean}
   */
  can(profile, feature) {
    const gate = CONFIG.PRO.FEATURES[feature];
    if (!gate?.PRO_ONLY) return true;
    return this.isActive(profile);
  },

  /**
   * The numeric limit that applies to this user.
   *
   * @param   {object} profile
   * @param   {string} name     A key from CONFIG.PRO.LIMITS.
   * @returns {number}
   */
  limit(profile, name) {
    const limits = CONFIG.PRO.LIMITS[name];
    if (!limits) return Infinity;
    return this.isActive(profile) ? limits.PRO : limits.FREE;
  },

  /**
   * Days remaining on a subscription, for display.
   *
   * @param   {object} profile
   * @returns {number}  Whole days, or 0 if not subscribed.
   */
  daysRemaining(profile) {
    if (!this.isActive(profile)) return 0;
    const ms = new Date(profile.proUntil).getTime() - Date.now();
    return Math.ceil(ms / (24 * 60 * 60 * 1000));
  }

};
