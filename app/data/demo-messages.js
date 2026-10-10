/**
 * The Local-mode demo's stand-ins for the bot's messages. The bot's real
 * wording is server-only and never published, so the test panel's inbox
 * shows a short summary instead: what kind of message it is, whose name it
 * reveals and the shift, with the same buttons (open the app or a request,
 * chat, «خاموش کن»). Same interface as the server's messages.js (see
 * notify.js MessageBuilders), so LocalBackend runs the very same
 * notification logic.
 */

import { CONFIG } from '../../supabase/functions/_shared/config.js?v=1.0.0';
import { fill } from '../../supabase/functions/_shared/text.js?v=1.0.0';
import { formatDateTime } from '../../supabase/functions/_shared/time.js?v=1.0.0';
import { toFaDigits } from '../../supabase/functions/_shared/persian.js?v=1.0.0';
import { displayPlace } from '../../supabase/functions/_shared/validate.js?v=1.0.0';
import { SUMMARY_OFF_DATA } from '../../supabase/functions/_shared/match-buttons.js?v=1.0.0';

const T = CONFIG.text.testPanel;
const K = T.inboxKinds;
const B = T.inboxButtons;

/** The "open the app" button: on one request, on one screen, or a normal launch. */
const appButton = (request, screen) => ({
  kind: 'app', text: request ? B.open : B.app, ...(request ? { request } : {}), ...(screen ? { screen } : {}),
});
/** The screen a role's messages open. @param {string} role */
const screenOf = (role) => (role === 'requester' ? 'myRequests' : 'myOffers');

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

export const DEMO_MESSAGES = Object.freeze({
  welcome: () => message(K.welcome, [], [[appButton()]]),
  signupDone: () => message(K.signupDone, [], [[appButton()]]),
  signupNotices: () => [1, 2].map((n) => message(fill(K.signupNotice, { n: toFaDigits(n) }), [n === 1 && K.signupNoticeEnd], [])),
  newOffer: () => message(K.newOffer, [], [[appButton(null, 'myRequests')]]),
  matchStep2: () => message(K.matchStep2, [], [[appButton(null, 'myOffers')]]),
  arranged: () => message(K.arranged, [], [[appButton(null, 'myRequests')]]),
  stoppedByColleague: () => message(K.stoppedByColleague, [], []),
  reminder: ({ hours, request, requesterName }) =>
    message(fill(K.reminder, { hours }), [nameLine(requesterName), shiftLine(request)], []),
  chat: ({ otherName }) => message(K.chat, [nameLine(otherName)], [[{ kind: 'chat', text: fill(B.chat, { name: otherName }) }]]),
  banned: () => message(K.banned, [], []),
  removedByAdmin: ({ role, request }) => message(K.removed, [shiftLine(request)], [[appButton(null, screenOf(role))]]),
  removedFromMatch: ({ request }) => message(K.removedFromMatch, [shiftLine(request)], [[appButton(null, 'myOffers')]]),
  alertsUnlocked: () => message(K.alertsUnlocked, [], [[appButton()]]),
  alert: ({ kind, request }) => message(kind === 'back' ? K.alertBack : K.alertNew, [shiftLine(request)], [[appButton(request.id)]]),
  summary: ({ requests }) => message(K.summary, requests.map(shiftLine),
    [[appButton(null, 'board')], [{ kind: 'callback', text: B.summaryOff, data: SUMMARY_OFF_DATA }]]),
});

/** What a pressed demo button leaves on its message (match-buttons.js texts). */
export const DEMO_BUTTON_TEXTS = Object.freeze({
  openApp: B.app,
  proceeded: T.inboxDone.proceeded,
  declined: T.inboxDone.declined,
  summaryOff: T.inboxDone.summaryOff,
});
