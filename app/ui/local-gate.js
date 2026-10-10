/**
 * Local mode's PIN screen (spec: Local mode). Outside Telegram the app runs
 * on made-up data. Before it starts, the server says whether this device may
 * open it (the gateway's localCheck): at once while the owner has turned the
 * PIN off with the bot, otherwise with the token saved after the right PIN.
 * Failing that, the PIN screen asks for the PIN the owner set as the
 * Supabase secret LOCAL_MODE_PIN. The server checks it (localUnlock: wrong
 * tries counted per visitor, a one-hour lock after five) and returns a token
 * that keeps this device unlocked for 30 days, kept in localStorage.
 *
 * The server's answer is never kept longer than
 * timing.localPinRecheckSeconds: while Local mode or the PIN screen is open
 * and in view, the server is asked again that often, and whenever the page
 * comes back into view. Once it says this device may no longer open Local
 * mode (the owner turned the PIN back on, or the unlock ran out), the page
 * reloads into the PIN screen; the PIN screen opens Local mode by itself as
 * soon as the owner turns the PIN off. No answer at all (offline) changes
 * nothing while Local mode is open. Inside Telegram (Live mode) none of this
 * applies.
 *
 * Nothing here decides anything: without the server's yes, Local mode
 * doesn't start. (The page itself is public; the PIN only keeps casual
 * visitors out of the demo, which holds no real data.)
 */

import { CONFIG } from '../../supabase/functions/_shared/config.js?v=1.0.0';
import { fill } from '../../supabase/functions/_shared/text.js?v=1.0.0';
import { errorText } from '../../supabase/functions/_shared/errors.js?v=1.0.0';
import { formatDateTime } from '../../supabase/functions/_shared/time.js?v=1.0.0';
import { toFaDigits } from '../../supabase/functions/_shared/persian.js?v=1.0.0';
import { h, replace } from './dom.js?v=1.0.0';
import { gatewayPost } from '../data/live.js?v=1.0.0';

const TOKEN_KEY = 'pk-local-unlock';
/** The server's answers meaning this device may not open Local mode now (as opposed to no answer). */
const REFUSED = new Set(['local_unlock_expired', 'local_locked']);

/** The saved token, or null (storage may be unavailable). */
function savedToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

/** Saves (or, with null, forgets) the token. @param {string|null} token */
function saveToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Private mode: the PIN is simply asked again next time.
  }
}

/**
 * The message for a refused PIN.
 * @param {any} json the gateway's answer
 */
function refusal(json) {
  const t = CONFIG.text.localGate;
  if (json?.error === 'local_pin_wrong' && Number.isFinite(json.left)) return fill(t.wrong, { left: toFaDigits(json.left) });
  if (json?.error === 'local_pin_locked' && Number.isFinite(json.lockedUntil)) return fill(t.locked, { time: formatDateTime(json.lockedUntil) });
  return errorText(json?.error || 'unknown');
}

/**
 * Asks the server whether this device may open Local mode now.
 * @param {string} url
 * @returns {Promise<any>} the gateway's answer, or null when there was none (offline, timeout)
 */
async function ask(url) {
  if (!url) return null;
  try {
    const { json } = await gatewayPost(url, {}, { action: 'localCheck', token: savedToken() });
    return json && typeof json === 'object' ? json : null;
  } catch {
    return null;
  }
}

/**
 * Runs `fn` every timing.localPinRecheckSeconds while the page is in view,
 * and at once whenever it comes back into view; never two at a time.
 * @param {()=>Promise<void>} fn
 * @returns {()=>void} stops it
 */
function whileInView(fn) {
  let running = false;
  const run = async () => {
    if (running || document.visibilityState === 'hidden') return;
    running = true;
    try {
      await fn();
    } finally {
      running = false;
    }
  };
  const timer = setInterval(run, CONFIG.timing.localPinRecheckSeconds * 1000);
  document.addEventListener('visibilitychange', run);
  return () => {
    clearInterval(timer);
    document.removeEventListener('visibilitychange', run);
  };
}

/**
 * While Local mode is open: once the server says this device may no longer
 * open it, reloads the page into the PIN screen.
 * @param {string} url
 */
function watch(url) {
  whileInView(async () => {
    const json = await ask(url);
    if (!json || json.ok || !REFUSED.has(json.error)) return;
    if (json.error === 'local_unlock_expired') saveToken(null);
    window.location.reload();
  });
}

/**
 * Resolves once this device may use Local mode: at once while the PIN is off
 * or with a token the server still accepts, otherwise after the right PIN
 * (or once the owner turns the PIN off). From then on the server is asked
 * again regularly (watch).
 * @param {HTMLElement} root
 * @returns {Promise<void>}
 */
export async function unlockLocalMode(root) {
  const url = CONFIG.app.gatewayUrl;
  const json = await ask(url);
  if (!json?.ok) {
    if (json?.error === 'local_unlock_expired') saveToken(null);
    // No answer (unreachable): the PIN screen; it keeps asking, and
    // submitting the PIN shows the network error.
    await new Promise((resolve) => showPinScreen(root, url, resolve));
  }
  watch(url);
  return undefined;
}

/**
 * @param {HTMLElement} root
 * @param {string} url
 * @param {()=>void} done
 */
function showPinScreen(root, url, done) {
  const t = CONFIG.text.localGate;
  const error = h('p', { class: 'error-text', role: 'alert' });
  const input = h('input', {
    id: 'local-pin', class: 'input', type: 'password', autocomplete: 'off', inputmode: 'numeric', dir: 'ltr',
    maxlength: '64', onInput: () => { error.textContent = ''; },
    onKeydown: (e) => { if (e.key === 'Enter') submit(); },
  });
  const button = h('button', { class: 'btn primary block', type: 'button', onClick: () => submit() }, t.enter);
  let busy = false;
  let finished = false;
  // The screen opens Local mode by itself as soon as the server says so
  // (the owner turned the PIN off), so it never stays up while the PIN is off.
  const stop = whileInView(async () => {
    if (busy || finished) return;
    if ((await ask(url))?.ok) finish();
  });
  function finish() {
    if (finished) return;
    finished = true;
    stop();
    done();
  }

  async function submit() {
    if (busy || finished) return;
    const pin = input.value.trim();
    if (!pin) {
      error.textContent = t.empty;
      return;
    }
    if (!url) {
      error.textContent = errorText('local_locked');
      return;
    }
    busy = true;
    button.disabled = true;
    button.textContent = t.checking;
    error.textContent = '';
    try {
      const { json } = await gatewayPost(url, {}, { action: 'localUnlock', pin });
      if (json?.ok) {
        // No token while the PIN is off: nothing to keep.
        if (typeof json.data?.token === 'string') saveToken(json.data.token);
        finish();
        return;
      }
      input.value = '';
      error.textContent = refusal(json);
    } catch (e) {
      error.textContent = errorText(e?.code || 'network');
    } finally {
      busy = false;
      button.disabled = false;
      button.textContent = t.enter;
    }
  }

  replace(root, h('main', { class: 'content' },
    h('div', { class: 'centered local-gate' },
      h('div', { class: 'icon' }, '🔒'),
      h('h2', null, t.title),
      h('p', { class: 'hint' }, t.body),
      h('div', { class: 'field' }, h('label', { for: 'local-pin' }, t.pinLabel), input),
      error,
      button,
      h('p', { class: 'hint gap-top' }, t.telegramHint),
      h('a', { class: 'btn block', href: CONFIG.app.directLink, rel: 'noopener noreferrer' }, t.telegramButton))));
  input.focus();
}
