/**
 * Sends error reports (supabase/functions/_shared/report.js) to the server
 * log: whenever the app shows an error message, the shell, the start-up code
 * and «چت» call report(error, {action, screen}). Each report is cleaned
 * (cleanReport: no names, usernames, IDs or initData) before it leaves the
 * phone; a page sends each different report once, and at most
 * limits.errorReportsPerPage of them; the server limits them again.
 *
 * Live mode only: a report goes with the page's initData, which the gateway
 * verifies like any call (and never logs). In Local mode there is no server
 * identity, so nothing is sent. Sending never throws and is never awaited.
 */

import { CONFIG, VERSION } from '../supabase/functions/_shared/config.js?v=1.0.0';
import { cleanReport, stackWhere } from '../supabase/functions/_shared/report.js?v=1.0.0';
import { gatewayPost } from './data/live.js?v=1.0.0';

/**
 * The Telegram app's own version, when its browser says it (Android does:
 * "Telegram-Android/12.10.6").
 * @param {string} userAgent
 */
export function telegramClient(userAgent) {
  const m = /Telegram-(Android|iOS|Desktop|macOS|Web[AK]?)\/([0-9][0-9.]{0,15})/.exec(String(userAgent ?? ''));
  return m ? `Telegram-${m[1]}/${m[2]}` : null;
}

/**
 * The report for an error, cleaned.
 * @param {any} error
 * @param {{action?:string|null, screen?:string|null}} context
 * @param {{platform?:string, version?:string}} tg
 * @param {string} [userAgent]
 */
export function buildReport(error, { action = null, screen = null } = {}, tg = {}, userAgent = '') {
  const e = error && typeof error === 'object' ? error : { message: String(error ?? '') };
  return cleanReport({
    name: typeof e.name === 'string' ? e.name : 'Error',
    message: e.message,
    code: e.code ?? null,
    action: action ?? e.action ?? null,
    screen,
    where: stackWhere(e.stack),
    app: VERSION,
    platform: tg.platform,
    tgVersion: tg.version,
    client: telegramClient(userAgent),
  });
}

/**
 * @param {{inTelegram:boolean, initData:string, platform?:string, version?:string}} tg
 * @param {{post?:typeof gatewayPost, url?:string, userAgent?:string}} [deps]
 * @returns {(error:any, context?:{action?:string|null, screen?:string|null})=>void}
 */
export function createReporter(tg, { post = gatewayPost, url = CONFIG.app.gatewayUrl, userAgent = globalThis.navigator?.userAgent ?? '' } = {}) {
  const seen = new Set();
  return (error, context = {}) => {
    try {
      if (!tg.inTelegram || !tg.initData || !url) return;
      const report = buildReport(error, context, tg, userAgent);
      const key = JSON.stringify(report);
      if (seen.has(key) || seen.size >= CONFIG.limits.errorReportsPerPage) return;
      seen.add(key);
      post(url, { 'x-init-data': tg.initData }, { action: 'clientError', report }).catch(() => {});
    } catch {
      // A report must never break the app.
    }
  };
}
