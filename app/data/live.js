/**
 * LiveBackend: talks to the Supabase "api" gateway. Sends Telegram's signed
 * initData with every call (the gateway verifies it and takes the user's
 * identity from it). Holds no Supabase key. The only external calls the
 * front end ever makes are these (gatewayPost, also used by Local mode's PIN
 * screen, app/ui/local-gate.js).
 *
 * A read that is safe to repeat (SAFE_TO_RETRY) is tried once more, quietly,
 * when it failed before the gateway could answer: the request was lost on
 * the way (slow mobile networks, VPNs), or Supabase answered by itself (a
 * 503 when no worker is ready, as during the rush of 17 October 2026) with
 * something that isn't the gateway's {ok, …}. Such an answer is a server
 * error, never "unknown". Actions that change something are never repeated:
 * the first try may have been done already.
 */

import { CONFIG } from '../../supabase/functions/_shared/config.js?v=1.2.8';
import { AppError } from '../../supabase/functions/_shared/errors.js?v=1.2.8';
import { BackendBase } from './backend.js?v=1.2.8';

/**
 * POSTs one JSON body to the gateway and returns the HTTP status and the
 * parsed answer (null when it isn't JSON). Throws AppError('network') when
 * the gateway can't be reached in time. Used by LiveBackend and by Local
 * mode's PIN screen (which needs the answer's extra fields).
 * @param {string} gatewayUrl
 * @param {Record<string,string>} headers extra headers (e.g. x-init-data)
 * @param {object} payload
 * @returns {Promise<{status:number, json:any}>}
 */
export async function gatewayPost(gatewayUrl, headers, payload) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONFIG.timing.requestTimeoutMs);
  let res;
  try {
    res = await fetch(gatewayUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(payload),
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      signal: controller.signal,
    });
  } catch (e) {
    // Ran out of time: it may have reached a slow server, so it isn't sent again.
    const timedOut = controller.signal.aborted || e?.name === 'AbortError';
    throw Object.assign(new AppError('network', e?.message), { timedOut });
  } finally {
    clearTimeout(timer);
  }
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

/** Reads that change nothing on the server, so trying one twice is harmless. */
export const SAFE_TO_RETRY = new Set(['me', 'sync', 'dots', 'board', 'myRequests', 'myOffers', 'invite']);

/** Whether a gateway answer is the gateway's own ({ok: true|false, …}), not Supabase's or a proxy's. */
const fromGateway = (json) => typeof json?.ok === 'boolean';

export class LiveBackend extends BackendBase {
  /**
   * @param {{gatewayUrl:string, initData:string, retryDelayMs?:number}} options
   */
  constructor({ gatewayUrl, initData, retryDelayMs = CONFIG.timing.requestRetryDelayMs }) {
    super();
    this.kind = 'live';
    this.gatewayUrl = gatewayUrl;
    this.initData = initData;
    this.retryDelayMs = retryDelayMs;
    // Server clock minus device clock, learned from me(); keeps "now"
    // consistent with the server even if the phone's clock is off.
    this.clockSkew = 0;
  }

  /** Current time, corrected to the server's clock. */
  now() {
    return Date.now() + this.clockSkew;
  }

  /**
   * POSTs one action to the gateway.
   * @param {string} action
   * @param {object} [body]
   */
  async call(action, body = {}) {
    /** Errors name the action they happened in (for error reports). */
    const tagged = (e) => Object.assign(e, { action });
    const post = () => gatewayPost(this.gatewayUrl, { 'x-init-data': this.initData }, { ...body, action });
    let res;
    // At most one quiet retry, only for a safe read that failed before the
    // gateway could answer, and never after a timeout.
    for (let attempt = 0; ; attempt += 1) {
      const mayRetry = attempt === 0 && SAFE_TO_RETRY.has(action);
      try {
        res = await post();
      } catch (e) {
        if (mayRetry && e?.code === 'network' && !e.timedOut) {
          await this.pause();
          continue;
        }
        throw e && typeof e === 'object' ? tagged(e) : e;
      }
      if (mayRetry && !fromGateway(res.json)) {
        await this.pause();
        continue;
      }
      break;
    }
    const { status, json } = res;
    // Not the gateway's answer (Supabase's own 503, a proxy's page): a server error.
    if (!fromGateway(json)) throw tagged(new AppError('server_error', `HTTP ${status}`));
    if (!json.ok) throw tagged(new AppError(json.error || 'unknown', `HTTP ${status}`));
    return json.data;
  }

  /** The short pause before the one quiet retry. */
  async pause() {
    if (this.retryDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, this.retryDelayMs));
  }

  /** me() also synchronises the clock. */
  async me() {
    const data = await this.call('me');
    if (Number.isFinite(data.now)) this.clockSkew = data.now - Date.now();
    return data;
  }
}
