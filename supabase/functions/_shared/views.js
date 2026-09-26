/**
 * Turns raw rows (from the SQL read functions, or from LocalBackend's engine,
 * which returns the very same shape) into what screens receive. Doing this in
 * one shared place guarantees both backends apply the same time-derived
 * states, display windows, sort orders — and the same privacy rule: nothing
 * here ever carries a Telegram id, and nothing names the other person before
 * the confirmation steps allow it (the requester sees the coverer's name from
 * step 1; the coverer sees the requester's name from step 2).
 *
 * Raw rows use snake_case and epoch-ms timestamps; views use camelCase.
 */

import {
  requestState, isOpenForOffers, isActiveRequest, canCancelArrangement,
  offerState, offerVisibleToMaker, offerStatusKey, offerSettledAt, compareByStart, compareOffers, matchStatusKey,
} from './rules.js?v=0.6.1';
import { CONFIG } from './config.js?v=0.6.1';
import { HOUR_MS } from './time.js?v=0.6.1';
import { displayPlace } from './validate.js?v=0.6.1';

/**
 * Request fields every card shows (no identity of any kind). The مکان is
 * cleaned for display (displayPlace), so an old value with a link, a
 * username or a phone number never reaches a screen.
 * @param {any} r raw request row
 */
function cardFields(r) {
  return {
    id: Number(r.id),
    universityId: r.university_id,
    ward: r.ward ?? null,
    place: displayPlace(r.place),
    startAt: Number(r.start_at),
    endAt: Number(r.end_at),
    price: r.price === null || r.price === undefined ? null : Number(r.price),
  };
}

/**
 * Minimal request shape the lifecycle rules need.
 * @param {any} r raw request row
 */
function lifecycle(r) {
  return { status: r.status, startAt: Number(r.start_at), endAt: Number(r.end_at) };
}

/**
 * The board: open requests only, soonest first.
 * @param {any[]} rows raw board rows
 * @param {number} now
 */
export function boardView(rows, now) {
  return rows
    .filter((r) => isOpenForOffers(lifecycle(r), now))
    .map((r) => ({
      ...cardFields(r),
      mine: Boolean(r.mine),
      myOffer: r.my_offer ? { id: Number(r.my_offer.id), price: Number(r.my_offer.price) } : null,
      blocked: Boolean(r.blocked),
    }))
    .sort(compareByStart);
}

/**
 * «درخواست‌های من»: the requester's active requests with anonymous offers
 * (price only, cheapest first) or the arrangement.
 * @param {any[]} rows raw my_requests rows
 * @param {number} now
 */
export function myRequestsView(rows, now) {
  return rows
    .filter((r) => isActiveRequest(lifecycle(r), now))
    .map((r) => {
      const life = lifecycle(r);
      const state = requestState(life, now);
      const offers = state === 'open'
        ? (r.offers ?? [])
          .map((o) => ({ id: Number(o.id), price: Number(o.price), updatedAt: Number(o.updated_at) }))
          .sort(compareOffers)
          .map(({ id, price }) => ({ id, price }))
        : [];
      const a = r.arrangement;
      const m = state === 'open' && r.match ? r.match : null;
      return {
        ...cardFields(r),
        state,
        // A request with a confirmation under way can't be cancelled, and
        // no other offer can be accepted, until that is settled.
        canCancel: state === 'open' && !m,
        canAccept: state === 'open' && !m,
        offers,
        match: m
          ? {
            id: Number(m.id), flow: m.flow, price: Number(m.price), step: Number(m.step),
            deadline: Number(m.deadline), otherName: m.other_name,
          }
          : null,
        arrangement: a && state !== 'open'
          ? { id: Number(a.id), price: Number(a.price), otherName: a.other_name, canCancel: canCancelArrangement(life, now) }
          : null,
      };
    })
    .sort(compareByStart);
}

/**
 * «پیشنهادهای من»: pending offers (editable) and settled ones within their
 * display windows. Accepted offers carry the arrangement (the requester's
 * name is known to the coverer from that moment on).
 * @param {any[]} rows raw my_offers rows
 * @param {number} now
 */
export function myOffersView(rows, now) {
  const pending = [];
  const settled = [];
  const windowMs = CONFIG.timing.settledOfferWindowHours * HOUR_MS;
  for (const row of rows) {
    const life = lifecycle(row.request);
    if (row.status === 'matched' && row.match) {
      // An offer (or take) in a confirmation: under way → with the pending
      // ones (the coverer acts in step 2); settled → why it didn't go ahead.
      const m = row.match;
      const active = m.state === 'step1' || m.state === 'step2';
      const endedAt = Number(m.ended_at);
      if (!active && now - endedAt >= windowMs) continue;
      const view = {
        id: Number(row.id),
        price: Number(row.price),
        state: active ? 'matching' : 'match_ended',
        statusKey: active ? 'matching' : matchStatusKey(m),
        request: cardFields(row.request),
        settledAt: active ? null : endedAt,
        arrangement: null,
        match: active
          ? {
            id: Number(m.id), step: Number(m.step), deadline: Number(m.deadline),
            // Only present from step 2 on (the database leaves it out before).
            otherName: m.other_name ?? null,
          }
          : null,
      };
      (active ? pending : settled).push(view);
      continue;
    }
    const offer = {
      status: row.status,
      reason: row.reason ?? null,
      settledAt: row.settled_at === null || row.settled_at === undefined ? null : Number(row.settled_at),
    };
    if (!offerVisibleToMaker(offer, life, now)) continue;
    const state = offerState(offer, life, now);
    const a = row.arrangement;
    const view = {
      id: Number(row.id),
      price: Number(row.price),
      state,
      statusKey: state === 'pending' ? 'pending' : offerStatusKey(offer, state),
      request: cardFields(row.request),
      settledAt: state === 'pending' ? null : offerSettledAt(offer, life, state),
      arrangement: state === 'accepted' && a
        ? { id: Number(a.id), otherName: a.other_name, canCancel: canCancelArrangement(life, now) }
        : null,
      match: null,
    };
    (state === 'pending' ? pending : settled).push(view);
  }
  pending.sort((x, y) => compareByStart(x.request, y.request));
  // Upcoming arrangements first (soonest shift), then the rest newest first.
  settled.sort((x, y) => {
    const xa = x.state === 'accepted' ? 0 : 1;
    const ya = y.state === 'accepted' ? 0 : 1;
    if (xa !== ya) return xa - ya;
    if (xa === 0) return compareByStart(x.request, y.request);
    return (y.settledAt ?? 0) - (x.settledAt ?? 0) || y.id - x.id;
  });
  return { pending, settled };
}
