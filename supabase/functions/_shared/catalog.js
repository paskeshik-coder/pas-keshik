/**
 * Read-only lookups over the lists in config.js: majors, wards, cities and
 * universities. Both the gateway (validation, deriving a user's city) and the
 * front end (labels, filters, the university search) go through here so the
 * lists are interpreted in exactly one way.
 */

import { CONFIG } from './config.js?v=0.6.1';
import { searchKey, matchesSearch } from './persian.js?v=0.6.1';

const MAJOR_BY_ID = new Map(CONFIG.majors.map((m) => [m.id, m]));
const UNIVERSITY_BY_ID = new Map(CONFIG.universities.map((u) => [u.id, u]));
// Precomputed search keys: the university name plus its city, so typing the
// city («شیراز») also finds the universities there.
const UNIVERSITY_KEYS = CONFIG.universities.map((u) => ({
  university: u,
  key: searchKey(`${u.name} ${CONFIG.cities[u.city] ?? ''}`),
}));

/**
 * The major record for an id, or undefined.
 * @param {string} id
 */
export function majorById(id) {
  return MAJOR_BY_ID.get(id);
}

/**
 * Persian label of a major ('' for unknown ids).
 * @param {string} id
 */
export function majorLabel(id) {
  return MAJOR_BY_ID.get(id)?.label ?? '';
}

/**
 * Whether requests in this major carry a ward (medicine and nursing).
 * @param {string} majorId
 */
export function majorHasWards(majorId) {
  return Boolean(MAJOR_BY_ID.get(majorId)?.hasWards);
}

/**
 * Ward list for a major (empty for majors without wards).
 * @param {string} majorId
 * @returns {ReadonlyArray<{id:string,label:string}>}
 */
export function wardsOf(majorId) {
  return majorHasWards(majorId) ? CONFIG.wards[majorId] ?? [] : [];
}

/**
 * True when wardId belongs to the major's ward list.
 * @param {string} majorId
 * @param {string} wardId
 */
export function isValidWard(majorId, wardId) {
  return wardsOf(majorId).some((w) => w.id === wardId);
}

/**
 * Persian label of a ward within a major ('' when unknown or absent).
 * @param {string} majorId
 * @param {string|null|undefined} wardId
 */
export function wardLabel(majorId, wardId) {
  if (!wardId) return '';
  return wardsOf(majorId).find((w) => w.id === wardId)?.label ?? '';
}

/**
 * The university record for an id, or undefined.
 * @param {string} id
 */
export function universityById(id) {
  return UNIVERSITY_BY_ID.get(id);
}

/**
 * Persian name of a university ('' for unknown ids).
 * @param {string} id
 */
export function universityName(id) {
  return UNIVERSITY_BY_ID.get(id)?.name ?? '';
}

/**
 * City id a university belongs to — the only way a user's city is derived.
 * @param {string} universityId
 * @returns {string|undefined}
 */
export function cityOfUniversity(universityId) {
  return UNIVERSITY_BY_ID.get(universityId)?.city;
}

/**
 * Persian name of a city ('' for unknown ids).
 * @param {string} cityId
 */
export function cityName(cityId) {
  return CONFIG.cities[cityId] ?? '';
}

/**
 * Universities in a city, in list order.
 * @param {string} cityId
 */
export function universitiesInCity(cityId) {
  return CONFIG.universities.filter((u) => u.city === cityId);
}

/**
 * University search for the sign-up step: every typed word must match the
 * name or city, with Arabic/Persian letter variants treated as equal.
 * @param {string} query
 * @param {number} [limit]
 */
export function searchUniversities(query, limit = CONFIG.limits.universitySearchMaxResults) {
  const out = [];
  for (const { university, key } of UNIVERSITY_KEYS) {
    if (matchesSearch(key, query)) out.push(university);
    if (out.length >= limit) break;
  }
  return out;
}
