/**
 * ============================================================================
 * پاس‌کشیک — GATEWAY CLIENT  (api.js)
 * ============================================================================
 * The app's only route to the server. Every screen that needs data goes
 * through here rather than calling fetch itself.
 *
 * WHY ONE PLACE
 * The Telegram signature, the project key, error handling and the offline case
 * are the same for every call. Written once, they are correct once. Scattered
 * across a dozen screens they would be correct in most of them.
 *
 * WHAT IT SENDS
 * Every request carries the initData blob Telegram gave the Mini App,
 * unchanged. The server verifies its signature and reads the user id from
 * inside it — the app never states who it is, because a claim of identity from
 * a browser is worth nothing.
 * ============================================================================
 */

const Api = {

  /*
    Copy both of these from the Supabase dashboard.

    URL   : Edge Functions -> api -> the address under the title
    KEY   : Project Settings -> API Keys -> publishable (or anon)

    The publishable key is designed to sit in browser code and grants nothing
    on its own — it identifies the project, not a person. Not to be confused
    with the service_role key, which bypasses every security rule and must
    never leave Supabase.
  */
  URL: 'https://cxksklayzylbqlbgjtsu.supabase.co/functions/v1/api',
  KEY: 'PASTE_YOUR_PUBLISHABLE_KEY_HERE',

  /**
   * Whether the app is running inside Telegram with a usable signature.
   *
   * Outside Telegram there is no initData, so nothing can authenticate. The
   * app falls back to local demo data in that case, which is what makes it
   * reviewable in a plain browser.
   *
   * @returns {boolean}
   */
  isLive() {
    const tg = window.Telegram?.WebApp;
    return Boolean(tg && tg.platform !== 'unknown' && tg.initData);
  },

  /**
   * Call the gateway.
   *
   * @param   {string} action  Which operation to run.
   * @param   {object} [data]  Its parameters.
   * @returns {Promise<object>} The server's reply.
   * @throws  {Error} With a `code` property naming the failure.
   */
  async call(action, data = {}) {
    const tg = window.Telegram?.WebApp;

    /*
      A timeout, because a request that hangs reports nothing at all — which
      looks identical to a crashed page and is the least useful outcome
      possible. Better to fail loudly after twenty seconds.
    */
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);

    try {
      const response = await fetch(this.URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Supabase's gateway requires this on every call, separately from
          // any user authentication. Without it the request never reaches
          // the function.
          'apikey': this.KEY,
          'Authorization': 'Bearer ' + this.KEY
        },
        // The blob is forwarded byte for byte. Re-encoding or reordering it
        // would change the string that was signed, and verification fails.
        body: JSON.stringify({ action, initData: tg?.initData || '', data }),
        signal: controller.signal
      });

      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        const error = new Error(body.error || 'request_failed');
        error.code = body.error || 'request_failed';
        error.detail = body.detail;
        error.status = response.status;
        throw error;
      }

      return body;

    } catch (thrown) {
      // A network failure and a rejection by the server are different
      // problems, and the app should be able to tell them apart.
      if (thrown.name === 'AbortError') {
        const error = new Error('timeout');
        error.code = 'timeout';
        throw error;
      }
      if (!thrown.code) {
        const error = new Error('network_error');
        error.code = 'network_error';
        error.detail = thrown.message;
        throw error;
      }
      throw thrown;

    } finally {
      clearTimeout(timer);
    }
  },

  /** Fetch the caller's identity and profile, if they have one. */
  me() { return this.call('me'); },

  /** Create a user record. @param {object} profile */
  signup(profile) { return this.call('signup', profile); }

};
