/**
 * Start-up: theme, Telegram, choice of backend (Live inside Telegram, Local
 * in a plain browser), then either the intro/sign-up flow or — for returning
 * users — straight into the board (or, for a banned user, the banned
 * notice). Any start-up problem or unexpected error is shown on screen in
 * Persian (the owner has no console).
 */

import { CONFIG } from '../supabase/functions/_shared/config.js?v=0.6.1';
import { createTelegram } from './telegram.js?v=0.6.1';
import { applyTheme } from './theme.js?v=0.6.1';
import { pickBackend, StartupProblem } from './data/backend.js?v=0.6.1';
import { createShell } from './ui/shell.js?v=0.6.1';
import { SCREENS } from './ui/screens/index.js?v=0.6.1';
import { h, replace } from './ui/dom.js?v=0.6.1';

const T = CONFIG.text;

/**
 * Replaces the page with a Persian error box and a reload button.
 * @param {HTMLElement} root
 * @param {string} message
 * @param {string} [detail] technical detail (English), shown small
 */
function showFatal(root, message, detail) {
  replace(root, h('div', { class: 'fatal', role: 'alert' },
    h('h2', null, T.fatal.title),
    h('p', null, message),
    detail ? h('pre', null, detail) : null,
    h('button', { class: 'btn primary', type: 'button', onClick: () => window.location.reload() }, T.fatal.reload)));
}

/**
 * Shows unexpected errors on screen instead of only in the console.
 * @param {HTMLElement} root
 */
function catchUnexpectedErrors(root) {
  const report = (detail) => {
    const box = h('div', { class: 'fatal', role: 'alert' },
      h('p', null, T.fatal.unexpected),
      h('pre', null, String(detail).slice(0, 500)),
      h('button', { class: 'btn small', type: 'button', onClick: () => box.remove() }, T.common.close));
    root.prepend(box);
  };
  window.addEventListener('error', (e) => report(e.message || e.error));
  window.addEventListener('unhandledrejection', (e) => report(e.reason?.stack || e.reason));
}

/** Boots the app. */
async function start() {
  const root = document.getElementById('app');
  catchUnexpectedErrors(root);

  const tg = createTelegram();
  applyTheme(tg);
  tg.onThemeChanged(() => applyTheme(tg));
  tg.ready();

  let backend;
  try {
    backend = await pickBackend(tg);
  } catch (e) {
    if (e instanceof StartupProblem) return showFatal(root, T.fatal[e.key]);
    throw e;
  }

  // Platform actions differ between real Telegram and the local simulation.
  const platform = {
    canRequestWriteAccess: backend.kind === 'local' || tg.canRequestWriteAccess,
    requestWriteAccess: () => tg.requestWriteAccess(),
    openBotChat: () => tg.openBotChat(),
    share: (url, text) => tg.share(url, text),
  };
  const ctx = createShell({ root, tg, backend, platform, screens: SCREENS });
  if (backend.kind === 'local') {
    const tp = T.testPanel;
    // Stand-in for Telegram's "allow messages" prompt.
    platform.requestWriteAccess = async () => {
      const allowed = await ctx.confirm({ title: tp.promptTitle, body: tp.promptBody, okText: tp.promptAllow, cancelText: tp.promptDecline });
      if (allowed) backend.grantWriteAccess();
      return allowed;
    };
    platform.openBotChat = () => ctx.toast(tp.botChatOpened);
    platform.share = () => ctx.toast(tp.shareOpened);
  }

  const asked = Number(new URLSearchParams(window.location.search).get('request'));
  let openRequest = Number.isSafeInteger(asked) && asked > 0 ? asked : null;

  /** Loads the user and opens the right first screen. */
  const boot = async () => {
    const me = await backend.me();
    ctx.me = me;
    ctx.profile = me.profile;
    ctx.signup = {};
    ctx.boardFilters = null;
    if (me.banned) return ctx.nav.reset('banned');
    if (!me.registered) return ctx.nav.reset('intro', { page: 0 });
    await ctx.nav.reset('board');
    // Opened from an alert's button (?request=<id>): show that request, with
    // the board one step back. Only on the first boot, not after a reset.
    if (openRequest) {
      const id = openRequest;
      openRequest = null;
      await ctx.nav.push('request', { id });
    }
    return undefined;
  };

  try {
    await boot();
  } catch (e) {
    showFatal(root, ctx.messageOf(e), e?.message);
    return undefined;
  }

  if (backend.kind === 'local' && CONFIG.switches.testPanel) {
    const { mountTestPanel } = await import('./ui/local-panel.js?v=0.6.1');
    mountTestPanel(ctx, backend, boot);
  }
  return undefined;
}

start();
