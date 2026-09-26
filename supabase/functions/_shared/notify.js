/**
 * Sends the bot notifications described in the spec, including the privacy
 * fallbacks for arrangements: who is told what, and when. It holds no
 * wording: the message builders are passed in, so the same logic runs with
 *   - the bot's real messages (messages.js, server-only) in the Edge
 *     Functions, through the real Bot API;
 *   - the test mode's short stand-ins (app/data/demo-messages.js) in
 *     LocalBackend, through a fake Telegram that files them into the test
 *     panel's inbox.
 *
 * Input payloads are the "notify" objects returned by the SQL functions (and
 * the local engine). They carry Telegram ids, which is why they never leave
 * the server: the gateway strips them from every response.
 */

import { CONFIG } from './config.js?v=0.6.1';
import { sendMessage, isPrivacyError } from './telegram-helpers.js?v=0.6.1';

/**
 * Raw request JSON (snake_case, epoch ms) → messages.js ShiftInfo.
 * @param {any} r
 */
export function requestToShift(r) {
  return {
    id: Number(r.id),
    universityId: r.university_id,
    major: r.major,
    ward: r.ward ?? null,
    place: r.place,
    startAt: Number(r.start_at),
    endAt: Number(r.end_at),
    price: r.price === null || r.price === undefined ? null : Number(r.price),
  };
}

/**
 * @typedef {{text:string, buttons:any[][]}} BuiltMessage
 * @typedef {{welcome:()=>BuiltMessage, signupDone:()=>BuiltMessage, newOffer:(p:any)=>BuiltMessage,
 *   arranged:(p:any)=>BuiltMessage, pleaseStartFollowup:(p:any)=>BuiltMessage, cancelled:(p:any)=>BuiltMessage,
 *   reminder:(p:any)=>BuiltMessage, chat:(p:any)=>BuiltMessage, chatBlocked:(p:any)=>BuiltMessage,
 *   banned:()=>BuiltMessage, removedByAdmin:(p:any)=>BuiltMessage, matchStep1:(p:any)=>BuiltMessage,
 *   matchStep2:(p:any)=>BuiltMessage, matchEnded:(p:any)=>BuiltMessage, alertsUnlocked:()=>BuiltMessage,
 *   alert:(p:any)=>BuiltMessage, summary:(p:any)=>BuiltMessage}} MessageBuilders
 *   the parameters of each builder are those of the same-named function in messages.js
 */

/**
 * Creates the notifier.
 * @param {import('./telegram-helpers.js').ApiLike} api
 * @param {MessageBuilders} messages the wording (messages.js on the server)
 * @param {(msg:string)=>void} [log] receives short English diagnostics (no ids, no tokens)
 */
export function createNotifier(api, messages, log = () => {}) {
  const {
    newOffer: newOfferMessage, arranged: arrangedMessage, pleaseStartFollowup: pleaseStartFollowupMessage,
    cancelled: cancelledMessage, chat: chatMessage, chatBlocked: chatBlockedMessage, welcome: welcomeMessage,
    signupDone: signupDoneMessage, reminder: reminderMessage, banned: bannedMessage, removedByAdmin: removedByAdminMessage,
    matchStep1: matchStep1Message, matchStep2: matchStep2Message, matchEnded: matchEndedMessage,
    alertsUnlocked: alertsUnlockedMessage, alert: alertMessage, summary: summaryMessage,
  } = messages;

  /** Logs a failed send without personal data. */
  const check = (label, res) => {
    if (!res.ok) log(`notify ${label} failed: ${res.error_code} ${res.description}`);
    return res;
  };

  return {
    /**
     * New or changed offer → the requester.
     * @param {{to_tg:number, is_change:boolean, price:number, request:any}} n
     */
    async newOffer(n) {
      // The requester switched these off in تنظیمات.
      if (n.enabled === false) return { ok: true, skipped: true };
      const message = newOfferMessage({ request: requestToShift(n.request), price: n.price, isChange: n.is_change });
      return check('offer', await sendMessage(api, n.to_tg, message));
    },

    /**
     * Arrangement made → both people, each with a chat button to the other.
     * Privacy fallbacks (spec: Arrangement):
     *  - coverer can't be linked → requester gets no chat button and is told
     *    they'll be contacted; the coverer is asked to start the chat;
     *  - requester can't be linked → the mirror image (the requester already
     *    got the normal message, so they get a follow-up asking them to start);
     *  - neither can be linked → both are told which setting to change.
     * A person who switched arrangement notifications off gets nothing; the
     * other side then gets the message alone (without a chat button, and a
     * note saying so, if the silent side can't be linked).
     * @param {{price:number, request:any, requester:{tg:number,name:string,notify?:boolean},
     *          coverer:{tg:number,name:string,notify?:boolean}}} n
     */
    async arranged(n) {
      const request = requestToShift(n.request);
      const R = n.requester;
      const C = n.coverer;
      const base = (role, other) => ({ role, request, price: n.price, otherName: other.name });
      const requesterOn = R.notify !== false;
      const covererOn = C.notify !== false;
      if (!requesterOn && !covererOn) return { skipped: true };
      if (!requesterOn || !covererOn) {
        const [to, other, role] = requesterOn ? [R, C, 'requester'] : [C, R, 'coverer'];
        const res = await sendMessage(api, to.tg, arrangedMessage({ ...base(role, other), chatButton: true }), { chatTgId: other.tg });
        if (!isPrivacyError(res)) return check('arranged/single', res);
        return check('arranged/single-fallback',
          await sendMessage(api, to.tg, arrangedMessage({ ...base(role, other), chatButton: false, note: 'noLink' })));
      }

      const toRequester = await sendMessage(api, R.tg, arrangedMessage({ ...base('requester', C), chatButton: true }), { chatTgId: C.tg });
      const covererUnlinkable = isPrivacyError(toRequester);
      if (!covererUnlinkable) check('arranged/requester', toRequester);

      const toCoverer = await sendMessage(api, C.tg,
        arrangedMessage({ ...base('coverer', R), chatButton: true, note: covererUnlinkable ? 'pleaseStart' : 'none' }),
        { chatTgId: R.tg });
      const requesterUnlinkable = isPrivacyError(toCoverer);
      if (!requesterUnlinkable) check('arranged/coverer', toCoverer);

      if (covererUnlinkable) {
        // The requester has received nothing yet.
        check('arranged/requester-fallback', await sendMessage(api, R.tg, arrangedMessage({
          ...base('requester', C), chatButton: false, note: requesterUnlinkable ? 'bothBlocked' : 'willBeContacted',
        })));
      }
      if (requesterUnlinkable) {
        // The coverer has received nothing yet.
        check('arranged/coverer-fallback', await sendMessage(api, C.tg, arrangedMessage({
          ...base('coverer', R), chatButton: false, note: covererUnlinkable ? 'bothBlocked' : 'willBeContacted',
        })));
        if (!covererUnlinkable) {
          // The requester already has a working chat button; ask them to use it.
          check('arranged/requester-followup',
            await sendMessage(api, R.tg, pleaseStartFollowupMessage({ otherName: C.name }), { chatTgId: C.tg }));
        }
      }
      return { requesterLinkable: !requesterUnlinkable, covererLinkable: !covererUnlinkable };
    },

    /**
     * Arrangement cancelled → the other side (always sent).
     * @param {{to_tg:number, to_role:'requester'|'coverer', by_name:string, request:any}} n
     */
    async cancelled(n) {
      const message = cancelledMessage({ role: n.to_role, request: requestToShift(n.request), byName: n.by_name });
      return check('cancelled', await sendMessage(api, n.to_tg, message));
    },

    /**
     * The fresh chat-button message behind the app's «چت» button.
     * @param {number} toTg the person who pressed «چت»
     * @param {{tg:number, name:string}} target the other side of the arrangement
     * @returns {Promise<{ok:boolean, blocked:boolean}>}
     */
    async chat(toTg, target) {
      const res = await sendMessage(api, toTg, chatMessage({ otherName: target.name }), { chatTgId: target.tg });
      if (isPrivacyError(res)) {
        const fallback = check('chat-fallback', await sendMessage(api, toTg, chatBlockedMessage({ otherName: target.name })));
        return { ok: fallback.ok, blocked: true };
      }
      check('chat', res);
      return { ok: res.ok, blocked: false };
    },

    /**
     * Shift reminder to a coverer (rows from app.claim_reminders).
     * @param {{kind:string, to_tg:number, requester_name:string, request:any}} row
     */
    async reminder(row) {
      const kind = CONFIG.timing.reminders.find((k) => k.key === row.kind);
      if (!kind) return { ok: false };
      const message = reminderMessage({ hours: Math.round(kind.minutes / 60), request: requestToShift(row.request), requesterName: row.requester_name });
      return check('reminder', await sendMessage(api, row.to_tg, message));
    },

    /** Reply to /start. @param {number} tg */
    async welcome(tg) {
      return check('welcome', await sendMessage(api, tg, welcomeMessage()));
    },

    /** Sign-up confirmation; its result proves whether the bot can message the user. @param {number} tg */
    async signupDone(tg) {
      return sendMessage(api, tg, signupDoneMessage());
    },

    /**
     * Step 1 of the price flow → the requester (always sent).
     * @param {{to_tg:number, match_id:number, other_name:string, price:number, deadline:number, request:any}} n
     */
    async matchStep1(n) {
      return check('match step 1', await sendMessage(api, n.to_tg, matchStep1Message({
        matchId: Number(n.match_id), otherName: n.other_name, request: requestToShift(n.request),
        price: Number(n.price), deadline: Number(n.deadline),
      })));
    },

    /**
     * Step 2 → the coverer (always sent).
     * @param {{to_tg:number, match_id:number, other_name:string, price:number, deadline:number, request:any}} n
     */
    async matchStep2(n) {
      return check('match step 2', await sendMessage(api, n.to_tg, matchStep2Message({
        matchId: Number(n.match_id), otherName: n.other_name, request: requestToShift(n.request),
        price: Number(n.price), deadline: Number(n.deadline),
      })));
    },

    /**
     * A confirmation didn't go ahead → the other side (always sent).
     * @param {{to_tg:number, to_role:'requester'|'coverer', reason:string, other_name:string|null, request:any}} n
     */
    async matchEnded(n) {
      return check('match ended', await sendMessage(api, n.to_tg, matchEndedMessage({
        toRole: n.to_role, reason: n.reason, otherName: n.other_name ?? null, request: requestToShift(n.request),
      })));
    },

    /** Alerts unlocked by a friend's sign-up. @param {number} tg */
    async alertsUnlocked(tg) {
      return check('alerts unlocked', await sendMessage(api, tg, alertsUnlockedMessage()));
    },

    /**
     * One new-request alert (rows from app.alert_claim). Returns Telegram's
     * result so the sender can tell a flood limit from a blocked bot.
     * @param {{to_tg:number, kind:'new'|'back', request:any}} row
     */
    async alert(row) {
      return sendMessage(api, row.to_tg, alertMessage({ kind: row.kind, request: requestToShift(row.request) }));
    },

    /**
     * One user's daily summary (rows from app.claim_summaries). Returns
     * Telegram's result so the sender can tell a flood limit from a blocked bot.
     * @param {{to_tg:number, items:any[]}} row
     */
    async summary(row) {
      return sendMessage(api, row.to_tg, summaryMessage({ requests: row.items.map(requestToShift) }));
    },

    /** Reply to /start from a banned person. @param {number} tg */
    async banned(tg) {
      return check('banned', await sendMessage(api, tg, bannedMessage()));
    },

    /**
     * An admin removed a request (rows from app.admin_remove_request): the
     * requester is always told; the coverer too when it had been arranged.
     * @param {{request:any, requester_tg:number, requester_name?:string, coverer_tg:number|null}} n
     */
    async removedByAdmin(n) {
      const request = requestToShift(n.request);
      check('removed/requester', await sendMessage(api, n.requester_tg, removedByAdminMessage({ role: 'requester', request })));
      if (n.coverer_tg) {
        check('removed/coverer', await sendMessage(api, n.coverer_tg,
          removedByAdminMessage({ role: 'coverer', request, requesterName: n.requester_name ?? '' })));
      }
      // A colleague waiting in a confirmation is told it didn't go ahead (no name).
      if (n.match_coverer_tg) {
        check('removed/match', await sendMessage(api, n.match_coverer_tg,
          matchEndedMessage({ toRole: 'coverer', reason: 'removed', otherName: null, request })));
      }
      return { ok: true };
    },
  };
}
