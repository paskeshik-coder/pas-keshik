/**
 * Persian text helpers shared by the front end, the tests and the Edge
 * Functions: digit conversion, Arabic→Persian letter normalisation, name
 * validation, the characters a مکان may hold, and search keys. Pure
 * functions, no imports, no platform APIs.
 */

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';

/** Zero-width non-joiner (نیم‌فاصله), allowed inside Persian names. */
export const ZWNJ = '‌';

/**
 * Converts every ASCII digit in a value to a Persian digit.
 * @param {string|number} value
 * @returns {string}
 */
export function toFaDigits(value) {
  return String(value).replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]);
}

/**
 * Converts Persian and Arabic-Indic digits to ASCII digits (for parsing).
 * @param {string} value
 * @returns {string}
 */
export function toEnDigits(value) {
  return String(value).replace(/[۰-۹٠-٩]/g, (d) => {
    const fa = FA_DIGITS.indexOf(d);
    return String(fa >= 0 ? fa : AR_DIGITS.indexOf(d));
  });
}

/**
 * Replaces the Arabic letter forms Iranian keyboards sometimes produce with
 * their Persian equivalents (ي/ى → ی, ك → ک). Required by the spec for names,
 * and used everywhere user text is stored so the same word is spelled once.
 * @param {string} value
 * @returns {string}
 */
export function normalizeLetters(value) {
  return String(value).replace(/[يى]/g, 'ی').replace(/ك/g, 'ک');
}

/**
 * Normalises free text typed by a user (a place, for instance): Persian
 * letters, trimmed, runs of whitespace collapsed to one space. Control
 * characters are removed so nothing invisible reaches other users.
 * @param {string} value
 * @returns {string}
 */
export function normalizeFreeText(value) {
  return normalizeLetters(String(value ?? ''))
    // Strip C0/C1 control characters and bidi overrides (which could make text render deceptively).
    .replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Letters accepted in names: the Persian alphabet plus the hamza forms and
// the heh-with-yeh that appear in real Iranian names.
const NAME_LETTERS = 'آاأإءئؤبپتثجچحخدذرزژسشصضطظعغفقکگلمنوهیۀة';
const NAME_WORD = `[${NAME_LETTERS}]+`;
// Words separated by single spaces or ZWNJs; nothing leading or trailing.
const NAME_PATTERN = new RegExp(`^${NAME_WORD}(?:[ ${ZWNJ}]${NAME_WORD})*$`);

/**
 * Normalises one name part: Persian letters, trimmed, repeated spaces or
 * ZWNJs collapsed, ZWNJ next to a space dropped (it has no effect there).
 * @param {string} value
 * @returns {string}
 */
export function normalizeName(value) {
  return normalizeLetters(String(value ?? ''))
    .replace(/\s+/g, ' ')
    .replace(new RegExp(`${ZWNJ}+`, 'g'), ZWNJ)
    .replace(new RegExp(` ?${ZWNJ} ?`, 'g'), (m) => (m.includes(' ') ? ' ' : ZWNJ))
    .trim()
    .replace(new RegExp(`^${ZWNJ}+|${ZWNJ}+$`, 'g'), '')
    .trim();
}

/**
 * Whether a name as typed so far contains a character a name can't have
 * (anything but Persian letters, spaces and ZWNJ) — shown at once, under the
 * field, while the user types. Arabic letter variants count as Persian.
 * @param {string} value raw input
 */
export function hasInvalidNameChar(value) {
  return new RegExp(`[^${NAME_LETTERS}\\s${ZWNJ}]`).test(normalizeLetters(String(value ?? '')));
}

/**
 * Checks one already-normalised name part against the spec: Persian letters
 * only, `min`–`max` characters, inner spaces and ZWNJ allowed.
 * @param {string} value normalised name part
 * @param {number} min
 * @param {number} max
 * @returns {null|'required'|'short'|'long'|'letters'} null when valid
 */
export function checkNamePart(value, min, max) {
  if (!value) return 'required';
  if (!NAME_PATTERN.test(value)) return 'letters';
  const length = [...value].length;
  if (length < min) return 'short';
  if (length > max) return 'long';
  return null;
}

// A مکان may hold the name letters plus the hamza above (as in «خانهٔ»),
// digits (Persian, Arabic-Indic or ASCII), spaces, ZWNJ and only this
// punctuation: ، ـ ( ) - /  — so no Latin letters, no @, no dot: nothing a
// link, a username or an e-mail address needs.
const PLACE_LETTERS = `${NAME_LETTERS}\u0654`;
const PLACE_SEPARATORS = ` ${ZWNJ}،ـ()\\-/`;
const PLACE_DIGIT = /[0-9۰-۹٠-٩]/;
const PLACE_LETTER = new RegExp(`[${PLACE_LETTERS}]`);
const PLACE_SEPARATOR = new RegExp(`[${PLACE_SEPARATORS}]`);

/**
 * Splits a مکان into characters and marks, for each digit, whether it
 * belongs to a run of more than `maxDigitRun` digits. Digits separated only
 * by spaces or the allowed punctuation count as one run (so «۰۹۱۲ ۳۴۵ ۶۷۸۹»
 * is one run of 11); a letter ends a run.
 * @param {string[]} chars
 * @param {number} maxDigitRun
 * @returns {boolean[]} true for digits in a run that is too long
 */
function longDigitRuns(chars, maxDigitRun) {
  const tooLong = chars.map(() => false);
  let run = [];
  const close = () => {
    if (run.length > maxDigitRun) for (const i of run) tooLong[i] = true;
    run = [];
  };
  chars.forEach((ch, i) => {
    if (PLACE_DIGIT.test(ch)) run.push(i);
    else if (!PLACE_SEPARATOR.test(ch)) close();
  });
  close();
  return tooLong;
}

/**
 * What is wrong with a مکان, if anything, as far as its characters go:
 * 'chars' when it has a character a place can't have (a Latin letter, @, a
 * dot, an emoji, …), 'digits' when it has a run of more than `maxDigitRun`
 * digits (a phone number), otherwise null. Arabic letter forms count as
 * Persian. Length and emptiness are checked elsewhere.
 * @param {string} value raw or normalised text
 * @param {number} maxDigitRun
 * @returns {null|'chars'|'digits'}
 */
export function placeProblem(value, maxDigitRun) {
  const chars = [...normalizeLetters(String(value ?? ''))];
  if (chars.some((ch) => !PLACE_DIGIT.test(ch) && !PLACE_LETTER.test(ch) && !PLACE_SEPARATOR.test(ch) && !/\s/.test(ch))) {
    return 'chars';
  }
  return longDigitRuns(chars, maxDigitRun).some(Boolean) ? 'digits' : null;
}

/**
 * A مکان saved before the rule above existed, made safe to show: every
 * character a place can't have is removed, and so is every digit of a run
 * that is too long; spaces are tidied. Returns '' when nothing but
 * punctuation would be left.
 * @param {string} value
 * @param {number} maxDigitRun
 * @returns {string}
 */
export function cleanPlace(value, maxDigitRun) {
  const allowed = [...normalizeFreeText(value)]
    .filter((ch) => PLACE_DIGIT.test(ch) || PLACE_LETTER.test(ch) || PLACE_SEPARATOR.test(ch));
  const tooLong = longDigitRuns(allowed, maxDigitRun);
  // Tidy what removal leaves behind: runs of spaces, and a dash, slash,
  // comma or tatweel hanging at either end (as from «… t.me/x»).
  const text = allowed.filter((_, i) => !tooLong[i]).join('')
    .replace(/\s+/g, ' ')
    .replace(new RegExp(`^[\\s${ZWNJ}،ـ\\-/]+|[\\s${ZWNJ}،ـ\\-/]+$`, 'g'), '');
  return [...text].some((ch) => PLACE_DIGIT.test(ch) || PLACE_LETTER.test(ch)) ? text : '';
}

/**
 * Builds a search key so that Arabic and Persian letter variants, digits,
 * diacritics, ZWNJ and spacing differences all match each other.
 * @param {string} value
 * @returns {string}
 */
export function searchKey(value) {
  return toEnDigits(normalizeLetters(String(value ?? '')))
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '') // harakat, superscript alef, tatweel
    .replace(/[ۀة]/g, 'ه')
    .replace(/[أإٱ]/g, 'ا')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ی')
    .replace(/‌/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/**
 * True when every word of `query` appears somewhere in `haystackKey`
 * (a value previously produced by searchKey). Empty queries match everything.
 * @param {string} haystackKey
 * @param {string} query raw user input
 * @returns {boolean}
 */
export function matchesSearch(haystackKey, query) {
  const words = searchKey(query).split(' ').filter(Boolean);
  // Also compare without spaces so «علوم‌پزشکی» and «علوم پزشکی» both match.
  const compact = haystackKey.replace(/ /g, '');
  return words.every((w) => haystackKey.includes(w) || compact.includes(w));
}
