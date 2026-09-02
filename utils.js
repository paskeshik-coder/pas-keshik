/**
 * ============================================================================
 * پاس‌کشیک — SHARED HELPERS  (utils.js)
 * ============================================================================
 * Small, single-purpose functions used across many screens. Anything that gets
 * written twice in app.js belongs here instead.
 *
 * Nothing in this file knows about screens, layout, or the database. Each
 * function takes a value and returns a value, which makes them safe to change
 * in isolation and easy to reason about.
 * ============================================================================
 */

const Utils = {

  /**
   * Replace English digits with Persian ones for display.
   *
   * The app computes everything in English digits — JavaScript arithmetic and
   * date maths only produce those — and converts at the last moment before
   * text reaches the screen. Doing it here, in one place, is what guarantees
   * the "Persian numerals everywhere" rule actually holds without needing to
   * remember it at every call site.
   *
   * @param   {string|number} value  Any text or number.
   * @returns {string}               Same content with 0-9 replaced by ۰-۹.
   */
  toPersianDigits(value) {
    const persianDigits = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];
    // String() guards against being handed a raw number.
    return String(value).replace(/[0-9]/g, d => persianDigits[d]);
  },

  /**
   * Replace Persian and Arabic digits with English ones for storage and maths.
   *
   * The mirror of toPersianDigits, applied when reading what a user typed.
   * Arabic-Indic digits (٠١٢…) are included because some Android keyboards
   * produce those instead of the Persian forms, and they look nearly identical
   * on screen — a difference the user cannot see but a number check would
   * fail on.
   *
   * @param   {string} value  Text that may contain non-English digits.
   * @returns {string}        Same text with all digits normalised to 0-9.
   */
  toEnglishDigits(value) {
    return String(value)
      .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 1776))  // Persian block
      .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 1632)); // Arabic block
  },

  /**
   * Pause execution for a given time. Used to sequence animations readably.
   *
   * Written as a promise so calling code can say `await Utils.wait(400)` in a
   * straight line, instead of nesting callbacks inside callbacks.
   *
   * @param   {number} milliseconds  How long to wait.
   * @returns {Promise}              Resolves once the time has elapsed.
   */
  wait(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
  },
  /**
   * Wait until the browser has actually painted a frame.
   *
   * Needed before starting a CSS transition on a freshly created element. A
   * plain setTimeout is not reliable here: if the browser has not yet painted
   * the element's starting state, it sees only the final value and skips the
   * animation entirely — the element simply appears. Two nested frame requests
   * guarantee one real paint has happened in between.
   *
   * @returns {Promise}  Resolves after the next painted frame.
   */
  nextFrame() {
    return new Promise(resolve =>
      requestAnimationFrame(() => requestAnimationFrame(resolve))
    );
  },

  /**
   * Escape text before inserting it into HTML.
   *
   * Any value that originated from a user — a name, a hospital, a message —
   * must pass through this before being placed on the page. Without it, text
   * containing < or > would be interpreted as markup rather than shown as
   * characters, which is the mechanism behind cross-site scripting attacks.
   *
   * Assigning to textContent and reading back innerHTML makes the browser do
   * the escaping itself, which is more reliable than a hand-written list of
   * replacements.
   *
   * @param   {string} text  Untrusted text.
   * @returns {string}       The same text, safe to place inside HTML.
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = String(text ?? '');
    return div.innerHTML;
  },
  /**
   * Normalise Persian text so that visually identical characters compare equal.
   *
   * Persian and Arabic share a script but not a character set, and Android
   * keyboards are inconsistent about which they emit. Arabic yeh (ي) and
   * Persian yeh (ی) look the same on screen but are different characters, so a
   * search for "پزشکی" would silently fail to match "پزشكي". Users would see
   * a list that appears to contain their university and a search that refuses
   * to find it, with nothing on screen explaining why.
   *
   * Every substitution here is one character for one character, and the
   * zero-width non-joiner becomes an ordinary space rather than being deleted.
   * Preserving length is deliberate: it means a match position found in the
   * normalised text is also valid in the original, which is what allows the
   * matched letters to be highlighted in the results list.
   *
   * @param   {string} text  Text as typed or as stored.
   * @returns {string}       Normalised, same length, lower-cased.
   */
  foldPersian(text) {
    return String(text ?? '')
      .replace(/[يیۍێ]/g, 'ی')   // every yeh variant
      .replace(/[كکڪ]/g,  'ک')   // every kaf variant
      .replace(/[أإآٱا]/g, 'ا')   // alef with and without hamza
      .replace(/[ؤو]/g,   'و')
      .replace(/[ةه]/g,   'ه')
      .replace(/\u200C/g, ' ')    // ZWNJ becomes a space, not nothing
      .toLowerCase();
  },

  /**
   * Strip everything that is not a digit, and normalise what remains to 0-9.
   *
   * @param   {string} text  Raw input.
   * @returns {string}       Digits only, in English form.
   */
  digitsOnly(text) {
    return this.toEnglishDigits(text).replace(/\D/g, '');
  },

  /**
   * Read the saved user profile from this device.
   *
   * Stage 2 only. Storing a profile in the browser lets us build and test the
   * new-user and returning-user paths before any database exists. Stage 3
   * replaces every call to this with a real Supabase lookup.
   *
   * @returns {object|null}  The saved profile, or null if none exists.
   */
  getLocalProfile() {
    try {
      const raw = localStorage.getItem('paskeshik_profile');
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      // Corrupt or unreadable storage is treated as "no profile" rather than
      // being allowed to throw, so a bad value can never lock the user out.
      console.warn('Could not read local profile:', error);
      return null;
    }
  },

  /**
   * Save the user profile to this device. Stage 2 only — see getLocalProfile.
   *
   * @param {object} profile  The profile object to persist.
   */
  saveLocalProfile(profile) {
    try {
      localStorage.setItem('paskeshik_profile', JSON.stringify(profile));
    } catch (error) {
      console.warn('Could not save local profile:', error);
    }
  }

};
