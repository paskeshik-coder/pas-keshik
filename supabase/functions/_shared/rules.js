/**
 * Lifecycle rules shared by every layer: time-derived states (expiry,
 * finishing, display windows), the overlap (double-booking) rule and sort
 * orders. Stored statuses never change with time; the "real" state is
 * derived here from timestamps whenever data is read (spec: Lifecycle).
 *
 * Shapes used here (all timestamps are epoch ms):
 *   request: { id, status: 'open'|'arranged'|'cancelled', startAt, endAt }
 *   offer:   { id, status, reason, price, updatedAt, settledAt }
 */

import { CONFIG } from './config.js?v=0.6.1';
import { HOUR_MS } from './time.js?v=0.6.1';

/**
 * Derived state of a request at `now`:
 *  open        — stored open and the shift hasn't started
 *  expired     — stored open but the shift started with no arrangement
 *  arranged    — has an arrangement, shift not started yet (cancellable)
 *  in_progress — has an arrangement, shift under way (no longer cancellable)
 *  finished    — has an arrangement and the shift has ended
 *  cancelled   — cancelled by the requester
 * @param {{status:string, startAt:number, endAt:number}} req
 * @param {number} now
 */
export function requestState(req, now) {
  if (req.status === 'cancelled') return 'cancelled';
  if (req.status === 'open') return req.startAt > now ? 'open' : 'expired';
  if (req.endAt <= now) return 'finished';
  return req.startAt <= now ? 'in_progress' : 'arranged';
}

/**
 * Active = open, or arranged and not yet finished. Counts toward the
 * per-person limit and the one-request-per-day rule.
 * @param {{status:string, startAt:number, endAt:number}} req
 * @param {number} now
 */
export function isActiveRequest(req, now) {
  const state = requestState(req, now);
  return state === 'open' || state === 'arranged' || state === 'in_progress';
}

/**
 * Whether colleagues may still take the price or send offers.
 * @param {{status:string, startAt:number, endAt:number}} req
 * @param {number} now
 */
export function isOpenForOffers(req, now) {
  return requestState(req, now) === 'open';
}

/**
 * Either side may cancel an arrangement until the shift starts.
 * @param {{status:string, startAt:number, endAt:number}} req
 * @param {number} now
 */
export function canCancelArrangement(req, now) {
  return requestState(req, now) === 'arranged';
}

/**
 * Two shifts overlap when each starts before the other ends. Back-to-back
 * shifts (one ends 08:00, the next starts 08:00) do not overlap.
 * @param {number} aStart @param {number} aEnd
 * @param {number} bStart @param {number} bEnd
 */
export function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Derived state of an offer: a stored "pending" offer becomes "expired" once
 * its request's shift has started (nothing is written; it's read that way).
 * @param {{status:string}} offer
 * @param {{status:string, startAt:number, endAt:number}} req
 * @param {number} now
 */
export function offerState(offer, req, now) {
  if (offer.status !== 'pending') return offer.status;
  const state = requestState(req, now);
  if (state === 'open') return 'pending';
  // The database voids pending offers when a request is cancelled or
  // arranged, so a still-pending offer on a non-open request means expiry.
  return state === 'expired' ? 'expired' : 'void';
}

/**
 * When an offer stopped being pending (for the 24-hour display window).
 * Derived expiry settles at the shift start.
 * @param {{status:string, settledAt:number|null}} offer
 * @param {{startAt:number}} req
 * @param {string} state result of offerState
 */
export function offerSettledAt(offer, req, state) {
  if (state === 'expired') return req.startAt;
  return offer.settledAt ?? req.startAt;
}

/**
 * Which of the maker's offers «پیشنهادهای من» shows at `now`:
 * pending ones always; accepted ones until the shift ends; other settled ones
 * for config.timing.settledOfferWindowHours. Offers the maker withdrew
 * themselves, or that were replaced by their own "take", are not shown.
 * @param {{status:string, reason:string|null, settledAt:number|null}} offer
 * @param {{status:string, startAt:number, endAt:number}} req
 * @param {number} now
 */
export function offerVisibleToMaker(offer, req, now) {
  const state = offerState(offer, req, now);
  if (state === 'pending') return true;
  if (state === 'withdrawn' && offer.reason === 'self') return false;
  if (state === 'void' && offer.reason === 'superseded') return false;
  if (state === 'accepted') return req.endAt > now;
  const windowMs = CONFIG.timing.settledOfferWindowHours * HOUR_MS;
  return now - offerSettledAt(offer, req, state) < windowMs;
}

/**
 * Key into config.text.myOffers.status for a settled offer.
 * @param {{reason:string|null}} offer
 * @param {string} state result of offerState
 */
export function offerStatusKey(offer, state) {
  if (state === 'void') {
    // request_cancelled also covers a request an admin removed.
    return ['request_cancelled', 'profile_changed', 'banned'].includes(offer.reason) ? `void_${offer.reason}` : 'void_arranged_other';
  }
  if (state === 'withdrawn') return 'withdrawn_overlap';
  return state;
}

/**
 * Key into config.text.myOffers.status for a confirmation that didn't go
 * ahead, from the coverer's side: which step it stopped at and why.
 * @param {{state:string, step:number, end_reason:string|null}} match raw my_offers match
 */
export function matchStatusKey(match) {
  if (match.state === 'expired') return `match_expired_${match.step}`;
  switch (match.end_reason) {
    case 'declined': return `match_declined_${match.step}`;
    case 'cancelled': return 'match_cancelled_2';
    case 'withdrawn': return 'match_withdrawn';
    case 'removed': return 'match_removed';
    default: return 'match_banned';
  }
}

/**
 * Board / list order: soonest shift first, then oldest request.
 * @param {{startAt:number, id:number}} a
 * @param {{startAt:number, id:number}} b
 */
export function compareByStart(a, b) {
  return a.startAt - b.startAt || a.id - b.id;
}

/**
 * Offers on a request: cheapest first, then the one that has waited longest.
 * @param {{price:number, updatedAt:number, id:number}} a
 * @param {{price:number, updatedAt:number, id:number}} b
 */
export function compareOffers(a, b) {
  return a.price - b.price || a.updatedAt - b.updatedAt || a.id - b.id;
}
