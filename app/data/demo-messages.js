/**
 * The Local-mode demo's stand-ins for the bot's messages. The bot's real
 * wording is server-only and never published, so the test panel's inbox
 * shows a short summary instead: what kind of message it is, whose name it
 * reveals, the shift, the price and any privacy note, with the same buttons
 * (open the app or a request, chat, Proceed / Decline, «خاموش کن»). Same
 * interface as the server's messages.js (see notify.js MessageBuilders), so
 * LocalBackend runs the very same notification logic.
 */

import { CONFIG } from '../../supabase/functions/_shared/config.js?v=0.6.1';
import { fill } from '../../supabase/functions/_shared/text.js?v=0.6.1';
import { formatDateTime } from '../../supabase/functions/_shared/time.js?v=0.6.1';
import { formatPrice } from '../../supabase/functions/_shared/price.js?v=0.6.1';
import { displayPlace } from '../../supabase/functions/_shared/validate.js?v=0.6.1';
import { SUMMARY_OFF_DATA, matchCallbackData } from '../../supabase/functions/_shared/match-buttons.js?v=0.6.1';

const T = CONFIG.text.testPanel;
const K = T.inboxKinds;
const B = T.inboxButtons;

/** The "open the app" button (optionally on one request). */
const appButton = (request) => ({ kind: 'app', text: request ? B.open : B.app, ...(request ? { request } : {}) });

/**
 * One demo message: the kind, then the given detail lines (empty ones dropped).
 * @param {string} kind
 * @param {Array<string|null|false|undefined>} lines
 * @param {any[][]} buttons
 */
function message(kind, lines, buttons) {
  return { text: [fill(T.inboxTitle, { kind }), ...lines.filter(Boolean)].join('\n'), buttons };
}

/** «مکان — شروع» of a shift. @param {{place:string, startAt:number}} shift */
const shiftLine = (shift) => fill(T.inboxShift, { place: displayPlace(shift.place), start: formatDateTime(shift.startAt) });
/** «نام: …». @param {string|null|undefined} name */
const nameLine = (name) => (name ? fill(T.inboxName, { name }) : null);
/** «مبلغ: …», or nothing without a price. @param {number|null|undefined} price */
const priceLine = (price) => (price === null || price === undefined ? null : fill(T.inboxPrice, { price: formatPrice(price) }));
/** Proceed / Decline for a confirmation step. @param {number} matchId */
const matchRow = (matchId) => [
  { kind: 'callback', text: B.proceed, data: matchCallbackData(matchId, true) },
  { kind: 'callback', text: B.decline, data: matchCallbackData(matchId, false) },
];

export const DEMO_MESSAGES = Object.freeze({
  welcome: () => message(K.welcome, [], [[appButton()]]),
  signupDone: () => message(K.signupDone, [], [[appButton()]]),
  newOffer: ({ request, price, isChange }) =>
    message(isChange ? K.changedOffer : K.newOffer, [shiftLine(request), priceLine(price)], [[appButton()]]),
  arranged: ({ request, price, otherName, note = 'none', chatButton }) => message(K.arranged,
    [nameLine(otherName), shiftLine(request), priceLine(price), T.inboxNotes[note]],
    [...(chatButton ? [[{ kind: 'chat', text: fill(B.chat, { name: otherName }) }]] : []), [appButton()]]),
  pleaseStartFollowup: ({ otherName }) =>
    message(K.pleaseStart, [nameLine(otherName)], [[{ kind: 'chat', text: fill(B.chat, { name: otherName }) }]]),
  cancelled: ({ request, byName }) => message(K.cancelled, [nameLine(byName), shiftLine(request)], [[appButton()]]),
  reminder: ({ hours, request, requesterName }) =>
    message(fill(K.reminder, { hours }), [nameLine(requesterName), shiftLine(request)], [[appButton()]]),
  chat: ({ otherName }) => message(K.chat, [nameLine(otherName)], [[{ kind: 'chat', text: fill(B.chat, { name: otherName }) }]]),
  chatBlocked: ({ otherName }) => message(K.chatBlocked, [nameLine(otherName)], [[appButton()]]),
  banned: () => message(K.banned, [], []),
  removedByAdmin: ({ request }) => message(K.removed, [shiftLine(request)], [[appButton()]]),
  matchStep1: ({ matchId, otherName, request, price }) =>
    message(K.matchStep1, [nameLine(otherName), shiftLine(request), priceLine(price)], [matchRow(matchId), [appButton()]]),
  matchStep2: ({ matchId, otherName, request, price }) =>
    message(K.matchStep2, [nameLine(otherName), shiftLine(request), priceLine(price)], [matchRow(matchId), [appButton()]]),
  matchEnded: ({ otherName, request }) => message(K.matchEnded, [nameLine(otherName), shiftLine(request)], [[appButton()]]),
  alertsUnlocked: () => message(K.alertsUnlocked, [], [[appButton()]]),
  alert: ({ kind, request }) =>
    message(kind === 'back' ? K.alertBack : K.alertNew, [shiftLine(request), priceLine(request.price)], [[appButton(request.id)]]),
  summary: ({ requests }) => message(K.summary, requests.map(shiftLine),
    [[appButton()], [{ kind: 'callback', text: B.summaryOff, data: SUMMARY_OFF_DATA }]]),
});

/** What a pressed demo button leaves on its message (match-buttons.js texts). */
export const DEMO_BUTTON_TEXTS = Object.freeze({
  openApp: B.app,
  proceeded: T.inboxDone.proceeded,
  declined: T.inboxDone.declined,
  summaryOff: T.inboxDone.summaryOff,
});
