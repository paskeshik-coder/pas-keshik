/**
 * Input validation against config — run by the gateway on every write (the
 * server never trusts the client), by LocalBackend (same rules in test mode)
 * and by the screens (to show a friendly Persian message before sending).
 *
 * Every validator returns either { ok: true, value } with the cleaned value,
 * or { ok: false, error } with an error code understood by errors.js.
 */

import { CONFIG } from './config.js?v=0.6.1';
import { normalizeName, checkNamePart, normalizeFreeText, placeProblem, cleanPlace } from './persian.js?v=0.6.1';
import { majorById, majorHasWards, isValidWard, cityOfUniversity, universityById, wardsOf } from './catalog.js?v=0.6.1';
import { parsePrice, checkPrice } from './price.js?v=0.6.1';
import { latestStart, toMs, HOUR_MS } from './time.js?v=0.6.1';

/**
 * @template T
 * @param {T} value
 * @returns {{ok:true, value:T}}
 */
function ok(value) {
  return { ok: true, value };
}

/**
 * @param {string} error
 * @returns {{ok:false, error:string}}
 */
function fail(error) {
  return { ok: false, error };
}

/**
 * Sign-up data: name parts, major, university (the city is derived from the
 * university, never taken from input) and acceptance of the rules.
 * @param {any} input
 */
export function validateProfile(input) {
  const { nameMin, nameMax } = CONFIG.limits;
  const firstName = normalizeName(input?.firstName);
  const firstError = checkNamePart(firstName, nameMin, nameMax);
  if (firstError) return fail(`first_name_${firstError}`);
  const lastName = normalizeName(input?.lastName);
  const lastError = checkNamePart(lastName, nameMin, nameMax);
  if (lastError) return fail(`last_name_${lastError}`);
  if (typeof input?.major !== 'string' || !majorById(input.major)) return fail('major_invalid');
  const city = typeof input?.universityId === 'string' ? cityOfUniversity(input.universityId) : undefined;
  if (!city) return fail('university_invalid');
  if (input?.acceptRules !== true) return fail('rules_not_accepted');
  return ok({ firstName, lastName, major: input.major, universityId: input.universityId, city });
}

/**
 * A profile edit from تنظیمات: the same checks as sign-up (the rules were
 * accepted at sign-up, so they aren't asked again).
 * @param {any} input
 */
export function validateProfileEdit(input) {
  return validateProfile({ ...(input && typeof input === 'object' ? input : {}), acceptRules: true });
}

/**
 * The five notification switches (offers, arrangements, reminders, instant
 * alerts, the daily summary); each must be a real boolean.
 * @param {any} input
 */
export function validateNotifications(input) {
  const keys = ['offers', 'arranged', 'reminders', 'alerts', 'summary'];
  if (!input || keys.some((k) => typeof input[k] !== 'boolean')) return fail('bad_request');
  return ok({
    offers: input.offers, arranged: input.arranged, reminders: input.reminders, alerts: input.alerts, summary: input.summary,
  });
}

/**
 * Alert settings, checked against the user's own city and major: university
 * is null (every university of the city) or the id of one in that city;
 * wards is null (all) or a non-empty list of distinct ward ids of the
 * user's major — and must be null for majors without wards.
 * @param {any} input
 * @param {{major:string, city:string}} profile
 */
export function validateAlertFilters(input, profile) {
  if (!input || typeof input !== 'object') return fail('bad_request');
  const university = input.university ?? null;
  if (university !== null) {
    const u = typeof university === 'string' ? universityById(university) : null;
    if (!u || u.city !== profile.city) return fail('university_invalid');
  }
  const wards = input.wards ?? null;
  if (wards !== null) {
    if (!majorHasWards(profile.major) || !Array.isArray(wards) || !wards.length
      || wards.length > wardsOf(profile.major).length || new Set(wards).size !== wards.length
      || wards.some((w) => typeof w !== 'string' || !isValidWard(profile.major, w))) {
      return fail('ward_invalid');
    }
  }
  return ok({ university, wards });
}

/**
 * A new request, checked against the requester's profile (for the ward list)
 * and the current time. startAt/endAt may be epoch ms or ISO strings.
 * @param {any} input
 * @param {{major:string}} profile
 * @param {number} nowMs
 */
export function validateRequestInput(input, profile, nowMs) {
  const { placeMax, maxShiftHours } = CONFIG.limits;

  let ward = null;
  if (majorHasWards(profile.major)) {
    if (input?.ward === null || input?.ward === undefined || input?.ward === '') return fail('ward_required');
    if (typeof input.ward !== 'string' || !isValidWard(profile.major, input.ward)) return fail('ward_invalid');
    ward = input.ward;
  } else if (input?.ward !== null && input?.ward !== undefined && input?.ward !== '') {
    // Midwifery and pharmacy have no wards; a ward here means a tampered client.
    return fail('ward_invalid');
  }

  if (input?.place !== undefined && input?.place !== null && typeof input.place !== 'string') return fail('place_required');
  const place = normalizeFreeText(input?.place ?? '');
  if (!place) return fail('place_required');
  if ([...place].length > placeMax) return fail('place_too_long');
  const placeError = placeInputError(place);
  if (placeError) return fail(placeError);

  const startAt = toMs(input?.startAt);
  if (!Number.isFinite(startAt)) return fail('start_required');
  const endAt = toMs(input?.endAt);
  if (!Number.isFinite(endAt)) return fail('end_required');
  if (startAt <= nowMs) return fail('start_in_past');
  if (startAt > latestStart(nowMs)) return fail('start_too_far');
  if (endAt <= startAt) return fail('end_before_start');
  if (endAt - startAt > maxShiftHours * HOUR_MS) return fail('shift_too_long');

  const price = parsePrice(input?.price ?? null);
  if (price !== null) {
    const priceError = checkPrice(price);
    if (priceError) return fail(priceError);
  }
  return ok({ ward, place, startAt, endAt, price });
}

/**
 * The error to show under the مکان field while the user types: a character
 * a place can't have ('place_chars': Latin letters, @, a dot, …) or a phone
 * number ('place_digits'), else null. The same check runs on the server.
 * @param {string} value
 * @returns {null|'place_chars'|'place_digits'}
 */
export function placeInputError(value) {
  const problem = placeProblem(value, CONFIG.limits.placeMaxDigitRun);
  return problem ? `place_${problem}` : null;
}

/**
 * A stored مکان as it may be shown, in the app and in bot messages: values
 * saved before the rule existed lose whatever links, usernames or phone
 * numbers they had; one with nothing left shows a dash.
 * @param {string} value
 * @returns {string}
 */
export function displayPlace(value) {
  return cleanPlace(value, CONFIG.limits.placeMaxDigitRun) || CONFIG.text.card.placeUnknown;
}

/**
 * An offer's price (required, same range as request prices).
 * @param {any} value
 */
export function validateOfferPrice(value) {
  const price = parsePrice(value ?? null);
  if (price === null) return fail('price_required');
  const error = checkPrice(price);
  return error ? fail(error) : ok(price);
}

/**
 * A record id sent by the client: a positive safe integer.
 * @param {any} value
 * @returns {number|null}
 */
export function validateId(value) {
  const n = typeof value === 'string' && /^\d{1,15}$/.test(value) ? Number(value) : value;
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}
