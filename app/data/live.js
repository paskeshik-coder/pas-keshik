/**
 * LiveBackend: talks to the Supabase "api" gateway. Sends Telegram's signed
 * initData with every call (the gateway verifies it and takes the user's
 * identity from it). Holds no Supabase key. The only external calls the
 * front end ever makes are these.
 */

import { CONFIG } from '../../supabase/functions/_shared/config.js?v=0.6.1';
import { AppError } from '../../supabase/functions/_shared/errors.js?v=0.6.1';
import { BackendBase } from './backend.js?v=0.6.1';

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
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CONFIG.timing.requestTimeoutMs);
    let res;
    try {
      res = await fetch(this.gatewayUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-init-data': this.initData },
        body: JSON.stringify({ ...body, action }),
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
    let json;
    try {
      json = await res.json();
    } catch {
      throw new AppError('server_error', `HTTP ${res.status}`);
    }
    if (!json?.ok) throw new AppError(json?.error || 'unknown', `HTTP ${res.status}`);
    return json.data;
  }

  /** me() also synchronises the clock. */
  async me() {
    const data = await this.call('me');
    if (Number.isFinite(data.now)) this.clockSkew = data.now - Date.now();
    return data;
  }
}
