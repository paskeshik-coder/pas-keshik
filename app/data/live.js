/**
 * LiveBackend: talks to the Supabase "api" gateway. Sends Telegram's signed
 * initData with every call (the gateway verifies it and takes the user's
 * identity from it). Holds no Supabase key. The only external calls the
 * front end ever makes are these (gatewayPost, also used by Local mode's PIN
 * screen, app/ui/local-gate.js).
 */

import { CONFIG } from '../../supabase/functions/_shared/config.js?v=1.0.0';
import { AppError } from '../../supabase/functions/_shared/errors.js?v=1.0.0';
import { BackendBase } from './backend.js?v=1.0.0';

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
    throw new AppError('network', e?.message);
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

export class LiveBackend extends BackendBase {
  /**
   * @param {{gatewayUrl:string, initData:string}} options
   */
  constructor({ gatewayUrl, initData }) {
    super();
    this.kind = 'live';
    this.gatewayUrl = gatewayUrl;
    this.initData = initData;
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
    let res;
    try {
      res = await gatewayPost(this.gatewayUrl, { 'x-init-data': this.initData }, { ...body, action });
    } catch (e) {
      throw e && typeof e === 'object' ? tagged(e) : e;
    }
    const { status, json } = res;
    if (json === null) throw tagged(new AppError('server_error', `HTTP ${status}`));
    if (!json?.ok) throw tagged(new AppError(json?.error || 'unknown', `HTTP ${status}`));
    return json.data;
  }

  /** me() also synchronises the clock. */
  async me() {
    const data = await this.call('me');
    if (Number.isFinite(data.now)) this.clockSkew = data.now - Date.now();
    return data;
  }
}
