/**
 * Fabricated data for LocalBackend (plain-browser test mode): colleagues and
 * requests across several cities, universities and majors, plus two
 * colleagues in the owner's own city and major created at sign-up, so the
 * board is never empty whatever the owner picks.
 *
 * Everything goes through the local engine's normal functions, so demo data
 * obeys the same rules as real data. A seeded random generator keeps the
 * data identical on every reset.
 */

import { CONFIG } from '../../supabase/functions/_shared/config.js?v=0.6.1';
import { universitiesInCity, wardsOf } from '../../supabase/functions/_shared/catalog.js?v=0.6.1';
import { addDays, tehranDate, tehranMs, HOUR_MS } from '../../supabase/functions/_shared/time.js?v=0.6.1';

const PRICES = [null, 800000, 1200000, 1500000, 2000000, 2500000, null, 1000000];
const HOURS = [8, 14, 20];
const DURATIONS = [6, 12, 24];

/**
 * Small deterministic PRNG (mulberry32).
 * @param {number} seed
 */
function random(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * @template T
 * @param {()=>number} rnd
 * @param {readonly T[]} list
 * @returns {T}
 */
function pick(rnd, list) {
  return list[Math.floor(rnd() * list.length)];
}

/**
 * Places (hospitals) for a city.
 * @param {string} city
 */
function placesFor(city) {
  return CONFIG.demo.places[city] ?? CONFIG.demo.defaultPlaces;
}

/**
 * Posts `count` requests for a user on distinct future days.
 * @param {any} engine
 * @param {{tg:number, major:string, city:string}} user
 * @param {number} count
 * @param {number} now
 * @param {()=>number} rnd
 * @param {(number|null)[]} [prices] fixed price per request (random when omitted)
 * @returns {number[]} new request ids
 */
function postRequests(engine, user, count, now, rnd, prices) {
  const today = tehranDate(now);
  const used = new Set();
  const ids = [];
  const wards = wardsOf(user.major);
  for (let i = 0; i < count; i += 1) {
    let dayOffset;
    do dayOffset = 1 + Math.floor(rnd() * 14); while (used.has(dayOffset));
    used.add(dayOffset);
    const date = addDays(today, dayOffset);
    const start = tehranMs(date.jy, date.jm, date.jd, pick(rnd, HOURS), 0);
    const end = start + pick(rnd, DURATIONS) * HOUR_MS;
    const ward = wards.length ? pick(rnd, wards).id : null;
    const res = engine.createRequest(user.tg, ward, pick(rnd, placesFor(user.city)), start, end,
      prices ? prices[i] : pick(rnd, PRICES), now, CONFIG.limits.maxActiveRequests, CONFIG.timing.tehranOffsetMinutes);
    if (res.ok) ids.push(res.request_id);
  }
  return ids;
}

/**
 * Registers a fabricated user who has pressed Start in the bot.
 * @param {any} engine
 * @param {number} tg
 * @param {string} major
 * @param {{id:string, city:string}} university
 * @param {number} nameIndex
 * @param {number} now
 */
function addUser(engine, tg, major, university, nameIndex, now) {
  const { firstNames, lastNames } = CONFIG.demo;
  const first = firstNames[nameIndex % firstNames.length];
  const last = lastNames[(nameIndex * 7 + 3) % lastNames.length];
  engine.signup(tg, first, last, major, university.id, university.city, now);
  engine.noteBotStart(tg, now);
  return { tg, major, city: university.city };
}

/**
 * Seeds the standard demo data: in each config.demo.seedCities city, two
 * colleagues per major with a few requests, and a pending offer between them.
 * @param {any} engine local engine
 * @param {number} now
 */
export function seedDemo(engine, now) {
  const rnd = random(1405);
  let tg = 1001;
  let nameIndex = 0;
  for (const city of CONFIG.demo.seedCities) {
    const unis = universitiesInCity(city);
    for (const major of CONFIG.majors) {
      const a = addUser(engine, tg++, major.id, unis[0], nameIndex++, now);
      const b = addUser(engine, tg++, major.id, unis[1 % unis.length], nameIndex++, now);
      const aRequests = postRequests(engine, a, 2, now, rnd);
      postRequests(engine, b, 1, now, rnd);
      if (aRequests[0]) engine.sendOffer(b.tg, aRequests[0], pick(rnd, [900000, 1100000, 1300000]), now);
    }
  }
}

/** Telegram ids of the colleagues created for the owner. */
export const COLLEAGUE_IDS = [2001, 2002];

/**
 * Creates two colleagues in the owner's city and major (one at the owner's
 * university, one at another university of the city when there is one),
 * each with requests — one priced, one not — so the owner can try every
 * flow right after signing up.
 * @param {any} engine
 * @param {{major:string, universityId:string, city:string}} profile the owner's profile
 * @param {number} now
 */
export function seedColleagues(engine, profile, now) {
  const rnd = random(2001);
  const unis = universitiesInCity(profile.city);
  const own = unis.find((u) => u.id === profile.universityId) ?? unis[0];
  const other = unis.find((u) => u.id !== own.id) ?? own;
  [own, other].forEach((university, i) => {
    const tg = COLLEAGUE_IDS[i];
    if (engine.me(tg).user) return;
    const user = addUser(engine, tg, profile.major, university, 40 + i * 3, now);
    postRequests(engine, user, 2, now, rnd, [i === 0 ? 1500000 : 1800000, null]);
  });
}
