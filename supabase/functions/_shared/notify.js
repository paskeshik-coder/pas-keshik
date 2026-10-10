/**
 * Sends the bot notifications described in the spec: who is told what, and
 * when. It holds no wording: the message builders are passed in, so the same
 * logic runs with
 *   - the bot's real messages (messages.js, server-only) in the Edge
 *     Functions, through the real Bot API;
 *   - the test mode's short stand-ins (app/data/demo-messages.js) in
 *     LocalBackend, through a fake Telegram that files them into the test
 *     panel's inbox.
 *
 * Input payloads are the "notify" objects returned by the SQL functions (and
 * the local engine). They carry Telegram ids, which is why they never leave
 * the server: the gateway strips them from every response.
 *
 * What is never sent (spec: Bot messages): a changed offer, anything about
 * an arrangement to the offer maker, a "didn't go ahead" to the offer maker,
 * and anything about chat connection problems (the app shows those).
 */

import { CONFIG } from './config.js?v=1.0.0';
import { sendMessage, isPrivacyError } from './telegram-helpers.js?v=1.0.0';

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
  };
}

// Telegram usernames: 4–32 letters, digits and underscores (collectible
// ones can be 4 long). Anything else is ignored.
const USERNAME = /^[A-Za-z0-9_]{4,32}$/;

/**
 * What Telegram says about reaching a person (getChat, asked each time it's
 * needed): their username, if any, and whether their "Forwarded messages"
 * privacy setting forbids tg://user?id= links to them in anyone else's
 * chat. The username is used at once and never stored or logged. `known`
 * is false when Telegram didn't answer.
 * @param {import('./telegram-helpers.js').ApiLike} api
 * @param {number} tg
 * @returns {Promise<{known:boolean, username:string|null, restricted:boolean}>}
 */
export async function chatInfo(api, tg) {
  const res = await api.call('getChat', { chat_id: tg });
  const chat = res.ok && res.result && typeof res.result === 'object' ? res.result : {};
  return {
    known: Boolean(res.ok),
    username: typeof chat.username === 'string' && USERNAME.test(chat.username) ? chat.username : null,
    restricted: chat.has_private_forwards === true,
  };
}

/**
 * The only link the app opens for «چت»: exactly https://t.me/<username>
 * (no @, no tg://, no telegram.me).
 * @param {string} username a username that passed USERNAME
 */
export const userChatUrl = (username) => `https://t.me/${username}`;

/**
 * Whether others can reach this person: through their username, or through
 * a chat button when their privacy settings allow it.
 * @param {{username:string|null, restricted:boolean}} info
 */
const reachable = (info) => Boolean(info.username) || !info.restricted;

/**
 * @typedef {{text:string, buttons:any[][]}} BuiltMessage
 * @typedef {{welcome:()=>BuiltMessage, signupDone:()=>BuiltMessage, signupNotices:()=>BuiltMessage[],
 *   newOffer:()=>BuiltMessage, matchStep2:()=>BuiltMessage, arranged:()=>BuiltMessage,
 *   stoppedByColleague:()=>BuiltMessage, reminder:(p:any)=>BuiltMessage, chat:(p:any)=>BuiltMessage,
 *   banned:()=>BuiltMessage, removedByAdmin:(p:any)=>BuiltMessage, removedFromMatch:(p:any)=>BuiltMessage,
 *   alertsUnlocked:()=>BuiltMessage, alert:(p:any)=>BuiltMessage, summary:(p:any)=>BuiltMessage}} MessageBuilders
 *   the parameters of each builder are those of the same-named function in messages.js
 */

/**
 * Creates the notifier.
 * @param {import('./telegram-helpers.js').ApiLike} api
 * @param {MessageBuilders} messages the wording (messages.js on the server)
 * @param {(msg:string)=>void} [log] receives short English diagnostics (no ids, no tokens, no usernames)
 */
export function createNotifier(api, messages, log = () => {}) {
  const {
    welcome: welcomeMessage, signupDone: signupDoneMessage, signupNotices: signupNoticeMessages,
    newOffer: newOfferMessage, matchStep2: matchStep2Message, arranged: arrangedMessage,
    stoppedByColleague: stoppedByColleagueMessage, reminder: reminderMessage, chat: chatMessage,
    banned: bannedMessage, removedByAdmin: removedByAdminMessage, removedFromMatch: removedFromMatchMessage,
    alertsUnlocked: alertsUnlockedMessage, alert: alertMessage, summary: summaryMessage,
  } = messages;

  /** Logs a failed send without personal data. */
  const check = (label, res) => {
    if (!res.ok) log(`notify ${label} failed: ${res.error_code} ${res.description}`);
    return res;
  };

  return {
    /**
     * A new offer → the requester (unless they switched these off). A
     * changed offer is not announced.
     * @param {{to_tg:number, enabled?:boolean, is_change?:boolean}} n
     */
    async newOffer(n) {
      if (n.enabled === false || n.is_change) return { ok: true, skipped: true };
      return check('offer', await sendMessage(api, n.to_tg, newOfferMessage()));
    },

    /**
     * Step 2 → the offer maker: the requester accepted their offer (always
     * sent; the confirmation itself happens in the app).
     * @param {{to_tg:number}} n
     */
    async matchStep2(n) {
      return check('match step 2', await sendMessage(api, n.to_tg, matchStep2Message()));
    },

    /**
     * Arrangement made (the offer maker confirmed step 2) → the requester,
     * unless they switched arrangement messages off. The offer maker, who
     * has just confirmed it, gets nothing.
     * @param {{requester:{tg:number, notify?:boolean}}} n
     */
    async arranged(n) {
      if (n.requester.notify === false) return { ok: true, skipped: true };
      return check('arranged', await sendMessage(api, n.requester.tg, arrangedMessage()));
    },

    /**
     * A confirmation didn't go ahead (declined, lapsed, withdrawn) → the
     * requester only (always sent). Nothing goes to the offer maker.
     * @param {{to_tg:number, to_role:'requester'|'coverer'}} n
     */
    async matchEnded(n) {
      if (n.to_role !== 'requester') return { ok: true, skipped: true };
      return check('match ended', await sendMessage(api, n.to_tg, stoppedByColleagueMessage()));
    },

    /**
     * Arrangement cancelled → the side that didn't cancel (always sent).
     * @param {{to_tg:number}} n
     */
    async cancelled(n) {
      return check('cancelled', await sendMessage(api, n.to_tg, stoppedByColleagueMessage()));
    },

    /**
     * How the caller would reach the other side of their arrangement, sent
     * with the arrangement data before any tap (actions.js), so «چت» can
     * open the chat at once. Nothing is sent to anyone. The statuses are
     * those of chat() below; null when Telegram didn't answer (the app then
     * asks with chat() on the tap).
     * @param {number} toTg the caller
     * @param {{tg:number}} target the other side of the arrangement
     * @returns {Promise<{status:'username', url:string}|{status:'bot'|'other_blocked'|'both_blocked'}|null>}
     */
    async chatTarget(toTg, target) {
      const other = await chatInfo(api, target.tg);
      if (!other.known) return null;
      if (other.username) return { status: 'username', url: userChatUrl(other.username) };
      if (!other.restricted) return { status: 'bot' };
      const self = await chatInfo(api, toTg);
      if (!self.known) return null;
      return { status: reachable(self) ? 'other_blocked' : 'both_blocked' };
    },

    /**
     * «چت» in the app: how the caller reaches the other side of their
     * arrangement. Reachability is worked out in both directions from
     * Telegram each time (chatInfo):
     *   username      — the other person has a username: the app opens
     *                   https://t.me/<username> itself (nothing is sent);
     *   bot           — no username, but their settings allow a chat
     *                   button: the bot sends the caller one (the only
     *                   message with a chat button) and the app opens the bot;
     *   other_blocked — the other person can't be reached, the caller can:
     *                   the app asks the caller to wait for their message;
     *   both_blocked  — neither can: the app tells the caller what to change.
     * No message about a problem is ever sent.
     * @param {number} toTg the person who pressed «چت»
     * @param {{tg:number, name:string}} target the other side of the arrangement
     * @returns {Promise<{ok:boolean, status?:'username'|'bot'|'other_blocked'|'both_blocked', url?:string}>}
     */
    async chat(toTg, target) {
      const [other, self] = await Promise.all([chatInfo(api, target.tg), chatInfo(api, toTg)]);
      const blocked = () => ({ ok: true, status: reachable(self) ? 'other_blocked' : 'both_blocked' });
      if (other.username) return { ok: true, status: 'username', url: userChatUrl(other.username) };
      if (other.restricted) return blocked();
      const res = await sendMessage(api, toTg, chatMessage({ otherName: target.name }), { chatTgId: target.tg });
      // Telegram knew better than getChat: their settings refuse the button.
      if (isPrivacyError(res)) return blocked();
      check('chat', res);
      return res.ok ? { ok: true, status: 'bot' } : { ok: false };
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
     * The two notices sent once, right after the sign-up confirmation, as
     * separate messages in that order.
     * @param {number} tg
     */
    async signupNotices(tg) {
      for (const message of signupNoticeMessages()) {
        const res = check('signup notice', await sendMessage(api, tg, message));
        if (!res.ok) return res;
      }
      return { ok: true };
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
     * requester is always told; the coverer too when it had been arranged,
     * and the offer maker in a confirmation under way on it.
     * @param {{request:any, requester_tg:number, requester_name?:string, coverer_tg:number|null,
     *          match_coverer_tg?:number|null}} n
     */
    async removedByAdmin(n) {
      const request = requestToShift(n.request);
      check('removed/requester', await sendMessage(api, n.requester_tg, removedByAdminMessage({ role: 'requester', request })));
      if (n.coverer_tg) {
        check('removed/coverer', await sendMessage(api, n.coverer_tg,
          removedByAdminMessage({ role: 'coverer', request, requesterName: n.requester_name ?? '' })));
      }
      if (n.match_coverer_tg) {
        check('removed/match', await sendMessage(api, n.match_coverer_tg, removedFromMatchMessage({ request })));
      }
      return { ok: true };
    },
  };
}
