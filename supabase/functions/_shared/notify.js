/**
 * The bot notifications described in the spec: who is told what, and how
 * each message is sent. It holds no wording: the message builders are passed
 * in, so the same logic runs with
 *   - the bot's real messages (messages.js, server-only) in the Edge
 *     Functions, through the real Bot API;
 *   - the test mode's short stand-ins (app/data/demo-messages.js) in
 *     LocalBackend, through a fake Telegram that files them into the test
 *     panel's inbox.
 *
 * One-time messages go through the queue (app.outbox; sender.js sends it):
 * `plan` turns an event's "notify" payload (returned by the SQL functions and
 * the local engine) into the messages it means — one per recipient, in the
 * order they must arrive, carrying no more than their wording needs — and
 * `deliver` sends one queued message when its turn comes. Reminders, alerts
 * and summaries have their own queues and are sent by `reminder`, `alert`
 * and `summary`. Replies to a person's own tap or command (the welcome,
 * «چت»'s button) are sent at once.
 *
 * The payloads carry Telegram ids, which is why they never leave the server:
 * the gateway strips them from every response.
 *
 * What is never sent (spec: Bot messages): a changed offer, anything about
 * an arrangement to the offer maker, a "didn't go ahead" to the offer maker,
 * and anything about chat connection problems (the app shows those).
 */

import { CONFIG } from './config.js?v=1.2.8';
import { sendMessage, sendPhoto, isPrivacyError, isTemporaryError, isUnreachableError } from './telegram-helpers.js?v=1.2.8';

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

/** A queued message nobody is told (e.g. a lapse notice for the offer maker). */
const SKIPPED = Object.freeze({ ok: true, skipped: true });

/**
 * @typedef {{text:string, buttons:any[][]}} BuiltMessage
 * @typedef {{welcome:()=>BuiltMessage, signupDone:()=>BuiltMessage, signupNotices:()=>BuiltMessage[],
 *   newOffer:()=>BuiltMessage, matchStep2:()=>BuiltMessage, arranged:()=>BuiltMessage,
 *   stoppedByColleague:()=>BuiltMessage, reminder:(p:any)=>BuiltMessage, chat:(p:any)=>BuiltMessage,
 *   banned:()=>BuiltMessage, removedByAdmin:(p:any)=>BuiltMessage, removedFromMatch:(p:any)=>BuiltMessage,
 *   alertsUnlocked:()=>BuiltMessage, alert:(p:any)=>BuiltMessage, summary:(p:any)=>BuiltMessage,
 *   inviteNudge:(p:any)=>BuiltMessage,
 *   requestEdited?:(p:any)=>BuiltMessage, accountDeleted?:()=>BuiltMessage, arrangementDetached?:(p:any)=>BuiltMessage,
 *   adminAdded?:()=>BuiltMessage, adminRemoved?:()=>BuiltMessage}} MessageBuilders
 *   the parameters of each builder are those of the same-named function in messages.js; the
 *   admin's messages exist only on the server (Local mode has no admin menu)
 * @typedef {{kind:string, to_tg:number, payload?:any, about_tgs?:number[], expires_at?:number}} QueuedMessage
 *   one message for app.outbox: about_tgs are the people it names (an account deletion drops it);
 *   expires_at (epoch ms) when it is useless later than its default expiry
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
    alertsUnlocked: alertsUnlockedMessage, alert: alertMessage, summary: summaryMessage, inviteNudge: inviteNudgeMessage,
    requestEdited: requestEditedMessage, accountDeleted: accountDeletedMessage,
    arrangementDetached: arrangementDetachedMessage, adminAdded: adminAddedMessage, adminRemoved: adminRemovedMessage,
  } = messages;

  /** Logs a failed send without personal data. */
  const check = (label, res) => {
    if (!res.ok) log(`notify ${label} failed: ${res.error_code} ${res.description}`);
    return res;
  };

  /**
   * Who is told what (spec: Bot messages): an event's notify payload → the
   * queued messages it means (none, one or more), in the order they must
   * arrive.
   */
  const plan = {
    /**
     * A new offer → the requester (unless they switched these off). A
     * changed offer is not announced.
     * @param {{to_tg:number, enabled?:boolean, is_change?:boolean}} n
     * @returns {QueuedMessage[]}
     */
    newOffer: (n) => (n.enabled === false || n.is_change ? [] : [{ kind: 'offer', to_tg: n.to_tg }]),

    /**
     * Step 2 → the offer maker: the requester accepted their offer (always
     * sent; the confirmation itself happens in the app). Useless after the
     * step's deadline.
     * @param {{to_tg:number, deadline?:number}} n
     * @returns {QueuedMessage[]}
     */
    matchStep2: (n) => [{
      kind: 'step2', to_tg: n.to_tg, ...(Number.isFinite(Number(n.deadline)) ? { expires_at: Number(n.deadline) } : {}),
    }],

    /**
     * Arrangement made (the offer maker confirmed step 2) → the requester,
     * unless they switched arrangement messages off. The offer maker, who
     * has just confirmed it, gets nothing.
     * @param {{requester:{tg:number, notify?:boolean}}} n
     * @returns {QueuedMessage[]}
     */
    arranged: (n) => (n.requester.notify === false ? [] : [{ kind: 'arranged', to_tg: n.requester.tg }]),

    /**
     * A confirmation didn't go ahead (declined, lapsed, withdrawn) → the
     * requester only (always sent). Nothing goes to the offer maker.
     * @param {{to_tg:number, to_role:'requester'|'coverer'}} n
     * @returns {QueuedMessage[]}
     */
    matchEnded: (n) => (n.to_role === 'requester' ? [{ kind: 'ended', to_tg: n.to_tg, payload: { to_role: n.to_role } }] : []),

    /**
     * Arrangement cancelled → the side that didn't cancel (always sent).
     * @param {{to_tg:number}} n
     * @returns {QueuedMessage[]}
     */
    cancelled: (n) => [{ kind: 'cancelled', to_tg: n.to_tg }],

    /**
     * A new account: the sign-up confirmation, then the notices sent once
     * right after it, as separate messages in that order.
     * @param {number} tg
     * @returns {QueuedMessage[]}
     */
    signedUp: (tg) => [
      { kind: 'signup_done', to_tg: tg },
      ...signupNoticeMessages().map((_, i) => ({ kind: 'signup_notice', to_tg: tg, payload: { n: i } })),
    ],

    /**
     * Alerts unlocked by a friend's sign-up → the friend who invited them.
     * @param {number} tg
     * @returns {QueuedMessage[]}
     */
    alertsUnlocked: (tg) => [{ kind: 'alerts_unlocked', to_tg: tg }],

    /**
     * An admin removed a request (app.admin_remove_request): the requester
     * is always told; the coverer too when it had been arranged (with the
     * requester's name), and the offer maker in a confirmation under way on
     * it (never the requester's name).
     * @param {{request:any, requester_tg:number, requester_name?:string, coverer_tg:number|null,
     *          match_coverer_tg?:number|null}} n
     * @returns {QueuedMessage[]}
     */
    removedByAdmin: (n) => [
      { kind: 'removed', to_tg: n.requester_tg, payload: { role: 'requester', request: n.request } },
      ...(n.coverer_tg ? [{
        kind: 'removed', to_tg: n.coverer_tg, about_tgs: [n.requester_tg],
        payload: { role: 'coverer', request: n.request, requester_name: n.requester_name ?? '' },
      }] : []),
      ...(n.match_coverer_tg ? [{ kind: 'removed_match', to_tg: n.match_coverer_tg, payload: { request: n.request } }] : []),
    ],

    /**
     * An admin changed a request: everyone involved, each told that their
     * part stays as it is.
     * @param {string} field
     * @param {any} request the request JSON after the change
     * @param {{tg:number, role:string, arranged?:boolean, matching?:boolean}[]} recipients
     * @returns {QueuedMessage[]}
     */
    requestEdited: (field, request, recipients) => recipients.map((n) => ({
      kind: 'edited', to_tg: Number(n.tg),
      payload: { role: n.role, request, field, arranged: Boolean(n.arranged), matching: Boolean(n.matching) },
    })),

    /**
     * An admin deleted an account (app.admin_delete_user): the person
     * themselves, the requesters whose confirmations with them ended, and
     * the other side of each arrangement that left the app.
     * @param {{tg_id:number, ended?:any[], detached?:{to_tg:number, other_name?:string, request:any}[]}} r
     * @returns {QueuedMessage[]}
     */
    accountDeleted: (r) => [
      { kind: 'account_deleted', to_tg: Number(r.tg_id) },
      ...(r.ended ?? []).flatMap((n) => plan.matchEnded(n)),
      ...(r.detached ?? []).map((n) => ({
        kind: 'detached', to_tg: Number(n.to_tg), payload: { other_name: n.other_name ?? '', request: n.request },
      })),
    ],

    /** The owner made someone an admin. @param {number} tg @returns {QueuedMessage[]} */
    adminAdded: (tg) => [{ kind: 'admin_added', to_tg: tg }],

    /** The owner removed an admin. @param {number} tg @returns {QueuedMessage[]} */
    adminRemoved: (tg) => [{ kind: 'admin_removed', to_tg: tg }],
  };

  /**
   * Sends one message with a builder (refused as a permanent error when
   * this wording doesn't exist here, e.g. an admin message in Local mode).
   * @param {number} to
   * @param {string} label
   * @param {((...args:any[])=>BuiltMessage)|undefined} builder
   * @param {...any} args
   */
  const sendBuilt = async (to, label, builder, ...args) => {
    if (typeof builder !== 'function') return { ok: false, error_code: 400, description: `no wording for ${label}` };
    return check(label, await sendMessage(api, to, builder(...args)));
  };

  /**
   * The after-swap invite message: a picture with the text as its caption
   * when the wording has one; if Telegram refuses the picture for good (not
   * a temporary error, not a person the bot can't reach), the same text
   * without it.
   * @param {number} to
   * @param {string} reward
   */
  const sendInviteNudge = async (to, reward) => {
    if (typeof inviteNudgeMessage !== 'function') return { ok: false, error_code: 400, description: 'no wording for invite nudge' };
    const message = inviteNudgeMessage({ reward });
    if (!message.photo) return check('invite nudge', await sendMessage(api, to, message));
    const res = await sendPhoto(api, to, message);
    if (res.ok || isTemporaryError(res) || isUnreachableError(res)) return check('invite nudge', res);
    log(`notify invite nudge picture failed: ${res.error_code} ${res.description}; sent as text`);
    return check('invite nudge', await sendMessage(api, to, message));
  };

  return {
    plan,

    /**
     * Sends one queued message (a row claimed from app.outbox) and returns
     * Telegram's answer, so the sender can tell a sent message from a flood
     * limit or a blocked bot. { ok: true, skipped: true } when nobody is told.
     * @param {{kind:string, to_tg:number, payload?:any}} row
     */
    async deliver(row) {
      const p = row.payload ?? {};
      const to = Number(row.to_tg);
      switch (row.kind) {
        case 'offer': return sendBuilt(to, 'offer', newOfferMessage);
        case 'step2': return sendBuilt(to, 'match step 2', matchStep2Message);
        case 'arranged': return sendBuilt(to, 'arranged', arrangedMessage);
        case 'ended': return p.to_role === 'requester' ? sendBuilt(to, 'match ended', stoppedByColleagueMessage) : SKIPPED;
        case 'cancelled': return sendBuilt(to, 'cancelled', stoppedByColleagueMessage);
        case 'signup_done': return sendBuilt(to, 'signup done', signupDoneMessage);
        case 'signup_notice': {
          const message = signupNoticeMessages()[Number(p.n)];
          return message ? check('signup notice', await sendMessage(api, to, message)) : SKIPPED;
        }
        case 'alerts_unlocked': return sendBuilt(to, 'alerts unlocked', alertsUnlockedMessage);
        // Queued by the timer (app.invite_nudge_claim), once per person after their first completed swap.
        case 'invite_nudge': return sendInviteNudge(to, p.reward);
        case 'removed':
          return sendBuilt(to, `removed/${p.role === 'coverer' ? 'coverer' : 'requester'}`, removedByAdminMessage, {
            role: p.role, request: requestToShift(p.request), requesterName: p.requester_name ?? '',
          });
        case 'removed_match': return sendBuilt(to, 'removed/match', removedFromMatchMessage, { request: requestToShift(p.request) });
        case 'edited':
          return sendBuilt(to, 'edited', requestEditedMessage, {
            role: p.role, request: requestToShift(p.request), field: p.field, arranged: Boolean(p.arranged), matching: Boolean(p.matching),
          });
        case 'account_deleted': return sendBuilt(to, 'account deleted', accountDeletedMessage);
        case 'detached':
          return sendBuilt(to, 'detached', arrangementDetachedMessage, { otherName: p.other_name ?? '', request: requestToShift(p.request) });
        case 'admin_added': return sendBuilt(to, 'admin added', adminAddedMessage);
        case 'admin_removed': return sendBuilt(to, 'admin removed', adminRemovedMessage);
        default: return { ok: false, error_code: 400, description: 'unknown message kind' };
      }
    },

    /**
     * Whether the bot may message this person now, asked without sending
     * anything (a "typing…" action): sign-up only completes if it may.
     * @param {number} tg
     */
    canReach(tg) {
      return api.call('sendChatAction', { chat_id: tg, action: 'typing' });
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
     * Shift reminder to a coverer (rows from app.reminder_claim). Returns
     * Telegram's result so the sender can tell a flood limit from a blocked bot.
     * @param {{kind:string, to_tg:number, requester_name:string, request:any}} row
     */
    async reminder(row) {
      const kind = CONFIG.timing.reminders.find((k) => k.key === row.kind);
      if (!kind) return { ok: false, error_code: 400, description: 'unknown reminder kind' };
      const message = reminderMessage({ hours: Math.round(kind.minutes / 60), request: requestToShift(row.request), requesterName: row.requester_name });
      return check('reminder', await sendMessage(api, row.to_tg, message));
    },

    /** Reply to /start. @param {number} tg */
    async welcome(tg) {
      return check('welcome', await sendMessage(api, tg, welcomeMessage()));
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
  };
}
