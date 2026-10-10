/**
 * The app's business actions: validate input against config → call the
 * atomic database function → shape the result with views.js → queue bot
 * notifications. Used by the gateway (with the real database and Bot API)
 * AND by LocalBackend (with the local engine and a fake Bot API), so the
 * plain-browser test mode runs the very same pipeline as production.
 *
 * Each action receives a context { tg, allowsWriteToPm, body, now }:
 *   tg              — the caller's Telegram id; the gateway takes it ONLY from
 *                     verified initData, never from the request body
 *   allowsWriteToPm — from the signed initData user object
 *   body            — the untrusted request body
 *   now             — epoch ms
 * and returns { ok: true, data } or { ok: false, error }. Results never
 * contain Telegram ids (the SQL "notify" payloads stay here).
 *
 * A banned user is refused every action with 'banned'; only "me" still
 * answers (with banned: true), so the app can show why.
 *
 * Matching takes two confirmations (spec: Confirmation): accepting an offer
 * (offers are the only way; requests have no price) opens a "match";
 * confirmMatch / declineMatch / cancelMatch move it on in the app (and from
 * the Proceed / Decline buttons older bot messages still carry: bot.js
 * calls these same actions). Whenever a request is posted or goes back on
 * the board, the database queues alerts; `alerts()` starts sending them in
 * the background. The 08:00 daily summary is sent by summary.js from the
 * timer; its «خاموش کن» button runs setSummary here.
 */

import { CONFIG } from './config.js?v=1.0.0';
import {
  validateProfile, validateProfileEdit, validateNotifications, validateAlertFilters, validateRequestInput, validateOfferPrice,
  validateId,
} from './validate.js?v=1.0.0';
import { boardView, myRequestsView, myOffersView } from './views.js?v=1.0.0';
import { diffList, readCursor } from './sync.js?v=1.0.0';
import { isUnreachableError } from './telegram-helpers.js?v=1.0.0';
import { rowsOf } from './errors.js?v=1.0.0';
import { cleanReport } from './report.js?v=1.0.0';

/** @param {any} data */
const ok = (data) => ({ ok: true, data });
/** @param {string} error */
const fail = (error) => ({ ok: false, error });

/**
 * Raw profile (snake_case) → client profile.
 * @param {any} u
 */
function profileView(u) {
  return { firstName: u.first_name, lastName: u.last_name, major: u.major, universityId: u.university_id, city: u.city };
}

/**
 * Raw notification switches → client shape.
 * @param {any} n
 */
function notificationsView(n) {
  return n
    ? {
      offers: Boolean(n.offers), arranged: Boolean(n.arranged), reminders: Boolean(n.reminders),
      alerts: Boolean(n.alerts), summary: Boolean(n.summary),
    }
    : null;
}

/**
 * Raw alert settings → client shape (null = all universities / all wards).
 * @param {any} a
 */
function alertsView(a) {
  return a ? { unlocked: Boolean(a.unlocked), university: a.university ?? null, wards: a.wards ?? null } : null;
}

/**
 * Sends every reminder that is due at `now` (the database claims them, so
 * each is sent once). Called by the gateway when the database timer knocks,
 * and by LocalBackend whenever its clock moves. With `defer`, sending
 * happens after the caller has answered (the timer doesn't wait for it).
 * @param {{db:any, notifier:any, now:number, defer?:(p:Promise<any>)=>void}} deps
 * @returns {Promise<number>} how many were claimed
 */
export async function runReminders({ db, notifier, now, defer }) {
  const r = await db.claimReminders(now, CONFIG.timing.reminders, CONFIG.timing.reminderGraceMinutes);
  const rows = rowsOf(r, 'claim reminders');
  const send = async () => {
    for (const row of rows) await notifier.reminder(row);
  };
  if (defer) defer(send());
  else await send();
  return rows.length;
}

/**
 * The rest of the 5-minute timer's work besides reminders: confirmations
 * whose window passed are claimed once, and the other side is told the
 * match didn't go ahead. (Their requests' alerts are queued by the database;
 * the caller starts the alert sender.)
 * @param {{db:any, notifier:any, now:number, defer?:(p:Promise<any>)=>void}} deps
 * @returns {Promise<number>} how many lapsed
 */
export async function runMatchExpiries({ db, notifier, now, defer }) {
  const rows = rowsOf(await db.claimMatchExpiries(now), 'claim match expiries');
  const send = async () => {
    for (const row of rows) await notifier.matchEnded(row);
  };
  if (defer) defer(send());
  else await send();
  return rows.length;
}

/**
 * Optional list id from the client (university or ward filter): null when
 * absent, the id when well-formed, undefined when malformed.
 * @param {any} value
 */
function optionalListId(value) {
  if (value === null || value === undefined || value === '') return null;
  return typeof value === 'string' && /^[a-z0-9_]{1,40}$/.test(value) ? value : undefined;
}

/**
 * Names of actions that change data (rate-limited by the gateway).
 */
export const WRITE_ACTIONS = new Set([
  'signup', 'setNotifications', 'setSummary', 'setAlertFilters', 'updateProfile', 'createRequest', 'cancelRequest', 'sendOffer',
  'changeOffer', 'withdrawOffer', 'acceptOffer', 'rejectOffer', 'confirmMatch', 'declineMatch', 'cancelMatch',
  'cancelArrangement', 'chat',
]);

/**
 * Names of the background reads (the live screens' refresh and the lists),
 * which have their own read limit in the gateway.
 */
export const READ_ACTIONS = new Set(['sync', 'board', 'myRequests', 'myOffers']);

/** The screens that refresh themselves (spec: Auto-refresh). */
export const LIVE_SCREENS = Object.freeze(['board', 'myRequests', 'myOffers']);

/**
 * @param {{db:any, notifier:ReturnType<typeof import('./notify.js').createNotifier>,
 *          defer:(p:Promise<any>)=>void, alerts?:()=>void, log?:(m:string)=>void}} deps
 *   db       — createDb(sql) in production, the local engine in test mode
 *   defer    — runs a promise after the response (EdgeRuntime.waitUntil)
 *   alerts   — starts sending queued alerts in the background
 */
export function createActions({ db, notifier, defer, alerts = () => {}, log = () => {} }) {
  const L = CONFIG.limits;
  const WINDOW = CONFIG.timing.matchStepMinutes;

  /**
   * Wraps every action except "me" with the ban check. (A ban made while a
   * call is already past this check can still let that one call through;
   * the ban itself then cancels what it left open, or an admin removes it.)
   * @param {Record<string, (ctx:any)=>Promise<any>>} actions
   */
  const refuseBanned = (actions) => Object.fromEntries(Object.entries(actions).map(([name, fn]) => [name,
    name === 'me' ? fn : async (ctx) => ((await db.isBanned(ctx.tg)) ? fail('banned') : fn(ctx))]));

  /**
   * Adds each arrangement's «چت» target (notify.js chatTarget: the
   * https://t.me/<username> link, or the no-username fallback) to the items
   * being sent, so the app has it before any tap. Looked up from Telegram
   * now, for these items only, and never stored or logged; null when it
   * couldn't be (the app then asks on the tap).
   * @template {{arrangement?:any}} I
   * @param {number} tg
   * @param {I[]} items
   * @param {number} now
   * @returns {Promise<I[]>}
   */
  const withChatTargets = (tg, items, now) => Promise.all(items.map(async (item) => {
    if (!item.arrangement) return item;
    let chat = null;
    try {
      const t = await db.chatTarget(tg, item.arrangement.id, now);
      if (t.ok) chat = await notifier.chatTarget(tg, t.target);
    } catch (e) {
      log(`chat target failed: ${e?.message ?? e}`);
    }
    return { ...item, arrangement: { ...item.arrangement, chat } };
  }));

  /** Queues a notification without letting its failure affect the caller. */
  const later = (label, promiseFactory) => {
    defer(Promise.resolve().then(promiseFactory).catch((e) => log(`${label}: ${e?.message ?? e}`)));
  };

  return refuseBanned({
    /** Profile (if registered), whether the bot can already message the user, ban state and server time. */
    async me({ tg, allowsWriteToPm, now }) {
      const r = await db.me(tg);
      return ok({
        banned: Boolean(r.banned),
        registered: Boolean(r.user),
        profile: r.user ? profileView(r.user) : null,
        notifications: notificationsView(r.notifications),
        alerts: alertsView(r.alerts),
        canMessage: Boolean(r.bot_started || allowsWriteToPm),
        now,
      });
    },

    /**
     * Registers the caller. Sign-up only completes if the bot can message the
     * user: we send the confirmation first and refuse if Telegram says no.
     * Right after it, once only (when this call created the account), the
     * two notices follow as separate messages.
     */
    async signup({ tg, body, now }) {
      const v = validateProfile(body);
      if (!v.ok) return v;
      const existing = await db.me(tg);
      if (existing.user) return ok({ profile: profileView(existing.user) });
      const sent = await notifier.signupDone(tg);
      if (!sent.ok) return fail(isUnreachableError(sent) ? 'bot_cannot_message' : 'server_error');
      const p = v.value;
      const r = await db.signup(tg, p.firstName, p.lastName, p.major, p.universityId, p.city, now);
      if (r.created) later('notify signup notices', () => notifier.signupNotices(tg));
      // The friend who invited this person may just have unlocked alerts.
      if (r.unlocked) later('notify unlocked', () => notifier.alertsUnlocked(r.unlocked.tg));
      return ok({ profile: profileView(r.user) });
    },

    /**
     * The caller's invite link and which rewards are unlocked: instant alerts
     * (the first friend who signs up) and the lowest offer (any later one).
     * How many people joined through the link is never shown (spec: Invite).
     */
    async invite({ tg }) {
      const r = await db.inviteInfo(tg);
      if (!r.ok) return r;
      return ok({
        link: `${CONFIG.app.botLink}?start=${r.code}`,
        unlocked: Boolean(r.unlocked),
        lowestUnlocked: Boolean(r.lowest_unlocked),
      });
    },

    /** Saves the notification switches (cancellations have none). */
    async setNotifications({ tg, body, now }) {
      const v = validateNotifications(body);
      if (!v.ok) return v;
      const n = v.value;
      const r = await db.setNotifications(tg, n.offers, n.arranged, n.reminders, n.alerts, n.summary, now);
      return r.ok ? ok({ notifications: notificationsView(r.notifications) }) : r;
    },

    /** The daily summary on or off (the summary's «خاموش کن» button sends off). */
    async setSummary({ tg, body, now }) {
      if (typeof body?.on !== 'boolean') return fail('bad_request');
      const r = await db.setSummary(tg, body.on, now);
      return r.ok ? ok({ notifications: notificationsView(r.notifications) }) : r;
    },

    /**
     * Which new requests the daily summary and (once unlocked) the instant
     * alerts cover: one university or all of the city, all wards or chosen ones.
     */
    async setAlertFilters({ tg, body, now }) {
      const me = await db.me(tg);
      if (!me.user) return fail('not_registered');
      const v = validateAlertFilters(body, me.user);
      if (!v.ok) return v;
      const r = await db.setAlertFilters(tg, v.value.university, v.value.wards, now);
      return r.ok ? ok({ alerts: alertsView(r.alerts) }) : r;
    },

    /**
     * Edits name, major and university. The city is derived again from the
     * university; the database refuses a major/university change while the
     * user has an active request, and voids their pending offers otherwise.
     */
    async updateProfile({ tg, body, now }) {
      const v = validateProfileEdit(body);
      if (!v.ok) return v;
      const p = v.value;
      const r = await db.updateProfile(tg, p.firstName, p.lastName, p.major, p.universityId, p.city, now);
      return r.ok ? ok({ profile: profileView(r.user), voided: Number(r.voided) }) : r;
    },

    /** Open requests of the caller's city and major, with optional filters. */
    async board({ tg, body, now }) {
      const university = optionalListId(body?.universityId);
      const ward = optionalListId(body?.ward);
      if (university === undefined || ward === undefined) return fail('bad_request');
      const r = await db.board(tg, university, ward, now, L.boardMaxItems);
      return r.ok ? ok({ items: boardView(r.rows, now) }) : r;
    },

    /** Posts a request at once (no price; fields validated against config and the caller's major). */
    async createRequest({ tg, body, now }) {
      const me = await db.me(tg);
      if (!me.user) return fail('not_registered');
      const v = validateRequestInput(body, { major: me.user.major }, now);
      if (!v.ok) return v;
      const q = v.value;
      const r = await db.createRequest(tg, q.ward, q.place, q.startAt, q.endAt, now,
        L.maxActiveRequests, CONFIG.timing.tehranOffsetMinutes);
      if (!r.ok) return r;
      if (Number(r.alerts) > 0) alerts();
      return ok({ requestId: r.request_id });
    },

    /** Cancels one's own open request. */
    async cancelRequest({ tg, body, now }) {
      const id = validateId(body?.requestId);
      if (!id) return fail('bad_request');
      const r = await db.cancelRequest(tg, id, now);
      return r.ok ? ok({}) : r;
    },

    /** Sends a new offer (the requester is told). */
    async sendOffer({ tg, body, now }) {
      const id = validateId(body?.requestId);
      if (!id) return fail('bad_request');
      const price = validateOfferPrice(body?.price);
      if (!price.ok) return price;
      const r = await db.sendOffer(tg, id, price.value, now);
      if (!r.ok) return r;
      later('notify offer', () => notifier.newOffer(r.notify));
      return ok({ offerId: r.offer_id });
    },

    /** Changes one's own pending offer (nobody is told). */
    async changeOffer({ tg, body, now }) {
      const id = validateId(body?.offerId);
      if (!id) return fail('bad_request');
      const price = validateOfferPrice(body?.price);
      if (!price.ok) return price;
      const r = await db.changeOffer(tg, id, price.value, now);
      return r.ok ? ok({ offerId: r.offer_id }) : r;
    },

    /** Withdraws one's own pending offer. */
    async withdrawOffer({ tg, body, now }) {
      const id = validateId(body?.offerId);
      if (!id) return fail('bad_request');
      const r = await db.withdrawOffer(tg, id, now);
      return r.ok ? ok({}) : r;
    },

    /**
     * Requester accepts an offer at the price they saw (no "are you sure?"
     * first). Opens a match and returns the offer maker's name: the
     * requester now proceeds or declines (step 1) in the app.
     */
    async acceptOffer({ tg, body, now }) {
      const id = validateId(body?.offerId);
      const price = validateOfferPrice(body?.expectedPrice);
      if (!id || !price.ok) return fail('bad_request');
      const r = await db.acceptOffer(tg, id, price.value, now, WINDOW);
      if (!r.ok) return r;
      return ok({ matchId: Number(r.match_id), otherName: r.other_name });
    },

    /**
     * Proceed. After step 1 the bot points the offer maker to the app (step
     * 2 is theirs, there); after step 2 the arrangement is made and the
     * requester is told, and the offer maker's overlapping confirmations
     * elsewhere are withdrawn (their requesters are told, and those
     * requests go back on the board).
     */
    async confirmMatch({ tg, body, now }) {
      const id = validateId(body?.matchId);
      if (!id) return fail('bad_request');
      const r = await db.confirmMatch(tg, id, now, WINDOW);
      if (!r.ok) return r;
      if (Number(r.step) === 2) {
        later('notify step 2', () => notifier.matchStep2(r.notify));
        return ok({ step: 2 });
      }
      later('notify arranged', () => notifier.arranged(r.notify));
      for (const notice of r.ended ?? []) later('notify withdrawn', () => notifier.matchEnded(notice));
      if ((r.ended ?? []).length) alerts();
      return ok({ step: 3, arrangementId: Number(r.arrangement_id) });
    },

    /** Decline: the requester in step 1, the coverer in step 2. The requester is told when the coverer declines. */
    async declineMatch({ tg, body, now }) {
      const id = validateId(body?.matchId);
      if (!id) return fail('bad_request');
      const r = await db.declineMatch(tg, id, now);
      if (!r.ok) return r;
      if (r.notify) later('notify declined', () => notifier.matchEnded(r.notify));
      alerts();
      return ok({});
    },

    /** The requester cancels while waiting for the coverer (step 2); nobody is told. */
    async cancelMatch({ tg, body, now }) {
      const id = validateId(body?.matchId);
      if (!id) return fail('bad_request');
      const r = await db.cancelMatch(tg, id, now);
      if (!r.ok) return r;
      if (r.notify) later('notify cancelled match', () => notifier.matchEnded(r.notify));
      alerts();
      return ok({});
    },

    /** Requester rejects an offer. */
    async rejectOffer({ tg, body, now }) {
      const id = validateId(body?.offerId);
      if (!id) return fail('bad_request');
      const r = await db.rejectOffer(tg, id, now);
      return r.ok ? ok({}) : r;
    },

    /** Either side cancels an arrangement; the other side is always told. */
    async cancelArrangement({ tg, body, now }) {
      const id = validateId(body?.arrangementId);
      if (!id) return fail('bad_request');
      const r = await db.cancelArrangement(tg, id, now);
      if (!r.ok) return r;
      later('notify cancelled', () => notifier.cancelled(r.notify));
      alerts();
      return ok({});
    },

    /** The requester's active requests. */
    async myRequests({ tg, now }) {
      const r = await db.myRequests(tg, now);
      return r.ok ? ok({ items: await withChatTargets(tg, myRequestsView(r.rows, now), now) }) : r;
    },

    /** The caller's offers (pending and settled). */
    async myOffers({ tg, now }) {
      const r = await db.myOffers(tg, now, CONFIG.timing.settledOfferWindowHours);
      if (!r.ok) return r;
      const { pending, settled } = myOffersView(r.rows, now);
      return ok({ pending, settled: await withChatTargets(tg, settled, now) });
    },

    /**
     * The live screens' refresh (spec: Auto-refresh): one screen's list —
     * only what changed since the app's cursor (sync.js) — and the drawer's
     * red dots, in one call. Viewing «درخواست‌های من» or «پیشنهادهای من»
     * marks it seen, so it never has a dot.
     */
    async sync({ tg, body, now }) {
      const screen = body?.screen;
      if (!LIVE_SCREENS.includes(screen)) return fail('bad_request');
      const university = screen === 'board' ? optionalListId(body?.universityId) : null;
      const ward = screen === 'board' ? optionalListId(body?.ward) : null;
      if (university === undefined || ward === undefined) return fail('bad_request');
      const r = await db.sync(tg, screen, university, ward, now, L.boardMaxItems, CONFIG.timing.settledOfferWindowHours);
      if (!r.ok) return r;
      let items;
      if (screen === 'board') items = boardView(r.rows, now);
      else if (screen === 'myRequests') items = myRequestsView(r.rows, now);
      else {
        const v = myOffersView(r.rows, now);
        items = [...v.pending.map((o) => ({ ...o, section: 'pending' })), ...v.settled.map((o) => ({ ...o, section: 'settled' }))];
      }
      // The «چت» targets aren't part of what is compared (they'd mean asking
      // Telegram on every refresh): only the items sent get them.
      const diff = diffList(items, readCursor(body?.cursor));
      return ok({
        screen,
        ...diff,
        changed: screen === 'board' ? diff.changed : await withChatTargets(tg, diff.changed, now),
        dots: { myRequests: Boolean(r.dots?.myRequests), myOffers: Boolean(r.dots?.myOffers) },
        now,
      });
    },

    /**
     * An error report from the app (report.js): cleaned again here (only
     * known fields; no names, usernames, IDs or initData), then one log
     * line. Rate-limited in the gateway.
     */
    async clientError({ body }) {
      log(`client error ${JSON.stringify(cleanReport(body?.report))}`);
      return ok({});
    },

    /**
     * «چت» tapped (notify.js chat): the current target, looked up from
     * Telegram again (the app has already opened the one it got with the
     * arrangement, and retries once when this one differs): with the other
     * side's username, the link (https://t.me/<username>; never stored or
     * logged); without one, the bot sends the caller a chat button (the app
     * has opened the bot meanwhile); or why they can't be reached.
     */
    async chat({ tg, body, now }) {
      const id = validateId(body?.arrangementId);
      if (!id) return fail('bad_request');
      const t = await db.chatTarget(tg, id, now);
      if (!t.ok) return t;
      const r = await notifier.chat(tg, t.target);
      if (!r.ok) return fail('chat_failed');
      return ok(r.status === 'username' ? { status: r.status, url: r.url } : { status: r.status });
    },
  });
}
