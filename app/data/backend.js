/**
 * The Data interface screens talk to, and the automatic choice between its
 * two implementations:
 *   LiveBackend  — the Supabase gateway; used inside Telegram.
 *   LocalBackend — fabricated data in localStorage; used in a plain browser
 *                  (or with ?mode=local), with a test panel.
 *
 * Both implement call(action, body) and inherit the named methods below, so
 * a screen can never tell which one it is using (except for backend.kind,
 * which only main.js and the test panel look at).
 */

import { CONFIG } from '../../supabase/functions/_shared/config.js?v=0.6.1';

/**
 * Named operations shared by both backends. Each returns the action's data
 * or throws AppError(code).
 */
export class BackendBase {
  /** @returns {Promise<{registered:boolean, profile:any, canMessage:boolean, now:number}>} */
  me() { return this.call('me'); }
  /** @param {{firstName:string,lastName:string,major:string,universityId:string,acceptRules:boolean}} p */
  signup(p) { return this.call('signup', p); }
  /** @param {{universityId:string|null, ward:string|null}} filters */
  board(filters) { return this.call('board', filters); }
  /** @param {{ward:string|null, place:string, startAt:number, endAt:number, price:number|null}} input */
  createRequest(input) { return this.call('createRequest', input); }
  /** @param {number} requestId */
  cancelRequest(requestId) { return this.call('cancelRequest', { requestId }); }
  /** @param {number} requestId @param {number} expectedPrice */
  takePrice(requestId, expectedPrice) { return this.call('takePrice', { requestId, expectedPrice }); }
  /** @param {number} requestId @param {number} price */
  sendOffer(requestId, price) { return this.call('sendOffer', { requestId, price }); }
  /** @param {number} offerId @param {number} price */
  changeOffer(offerId, price) { return this.call('changeOffer', { offerId, price }); }
  /** @param {number} offerId */
  withdrawOffer(offerId) { return this.call('withdrawOffer', { offerId }); }
  /** @param {number} offerId @param {number} expectedPrice */
  acceptOffer(offerId, expectedPrice) { return this.call('acceptOffer', { offerId, expectedPrice }); }
  /** @param {number} offerId */
  rejectOffer(offerId) { return this.call('rejectOffer', { offerId }); }
  /** Proceed (step 1 as requester, step 2 as coverer). @param {number} matchId */
  confirmMatch(matchId) { return this.call('confirmMatch', { matchId }); }
  /** Decline (step 1 as requester, step 2 as coverer). @param {number} matchId */
  declineMatch(matchId) { return this.call('declineMatch', { matchId }); }
  /** The requester cancels while waiting for the coverer. @param {number} matchId */
  cancelMatch(matchId) { return this.call('cancelMatch', { matchId }); }
  /** @param {number} arrangementId */
  cancelArrangement(arrangementId) { return this.call('cancelArrangement', { arrangementId }); }
  myRequests() { return this.call('myRequests'); }
  myOffers() { return this.call('myOffers'); }
  /** @param {number} arrangementId */
  chat(arrangementId) { return this.call('chat', { arrangementId }); }
  /** @returns {Promise<{link:string, count:number, joined:number, unlocked:boolean}>} */
  invite() { return this.call('invite'); }
  /** @param {{offers:boolean, arranged:boolean, reminders:boolean, alerts:boolean}} switches */
  setNotifications(switches) { return this.call('setNotifications', switches); }
  /** @param {{university:string|null, wards:string[]|null}} filters */
  setAlertFilters(filters) { return this.call('setAlertFilters', filters); }
  /** @param {{firstName:string,lastName:string,major:string,universityId:string}} p */
  updateProfile(p) { return this.call('updateProfile', p); }
}

/**
 * Why the app can't start (shown on screen by main.js).
 */
export class StartupProblem extends Error {
  /** @param {'telegramScriptMissing'|'gatewayMissing'} key text key in config.text.fatal */
  constructor(key) {
    super(key);
    this.key = key;
  }
}

/**
 * Picks the backend for this launch.
 * @param {ReturnType<typeof import('../telegram.js').createTelegram>} tg
 * @returns {Promise<BackendBase & {kind:string, now:()=>number}>}
 */
export async function pickBackend(tg) {
  const forcedLocal = CONFIG.switches.allowForcedLocalMode
    && new URLSearchParams(window.location.search).get('mode') === 'local';
  if (!forcedLocal) {
    if (tg.inTelegram) {
      if (!CONFIG.app.gatewayUrl) throw new StartupProblem('gatewayMissing');
      const { LiveBackend } = await import('./live.js?v=0.6.1');
      return new LiveBackend({ gatewayUrl: CONFIG.app.gatewayUrl, initData: tg.initData });
    }
    // Launched by Telegram, but without the real telegram-web-app.js we can't read initData.
    if (tg.launchedByTelegram) throw new StartupProblem('telegramScriptMissing');
  }
  const { LocalBackend } = await import('./local.js?v=0.6.1');
  return new LocalBackend();
}
