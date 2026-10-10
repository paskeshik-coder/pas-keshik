/**
 * Start-up: theme, Telegram, choice of backend (Live inside Telegram, Local
 * in a plain browser), then either the intro/sign-up flow or — for returning
 * users — the board with the drawer open (or, when a bot button opened the
 * app, its target screen without the drawer; launch.js), or for a banned
 * user the banned notice. Any start-up problem or unexpected error is shown
 * on screen in Persian (the owner has no console).
 */

import { CONFIG } from '../supabase/functions/_shared/config.js?v=1.0.0';
import { createTelegram } from './telegram.js?v=1.0.0';
import { applyTheme } from './theme.js?v=1.0.0';
import { pickBackend, StartupProblem } from './data/backend.js?v=1.0.0';
import { createShell } from './ui/shell.js?v=1.0.0';
import { SCREENS } from './ui/screens/index.js?v=1.0.0';
import { h, replace } from './ui/dom.js?v=1.0.0';
import { launchTarget, openLaunch } from './launch.js?v=1.0.0';
import { createPlatform } from './platform.js?v=1.0.0';
import { createReporter } from './report.js?v=1.0.0';

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
 * Shows unexpected errors on screen instead of only in the console, and
 * reports them (report.js).
 * @param {HTMLElement} root
 * @param {ReturnType<typeof createReporter>} report
 */
function catchUnexpectedErrors(root, report) {
  const show = (detail, error) => {
    report(error ?? detail, { action: 'unexpected' });
    const box = h('div', { class: 'fatal', role: 'alert' },
      h('p', null, T.fatal.unexpected),
      h('pre', null, String(detail).slice(0, 500)),
      h('button', { class: 'btn small', type: 'button', onClick: () => box.remove() }, T.common.close));
    root.prepend(box);
  };
  window.addEventListener('error', (e) => show(e.message || e.error, e.error));
  window.addEventListener('unhandledrejection', (e) => show(e.reason?.stack || e.reason, e.reason));
}

/** Boots the app. */
async function start() {
  const root = document.getElementById('app');
  const tg = createTelegram();
  // Every error message the app shows is also reported to the server log.
  const report = createReporter(tg);
  catchUnexpectedErrors(root, report);

  applyTheme(tg);
  tg.onThemeChanged(() => applyTheme(tg));
  tg.ready();

  let backend;
  try {
    backend = await pickBackend(tg);
  } catch (e) {
    if (e instanceof StartupProblem) {
      report(e, { action: `start:${e.key}` });
      return showFatal(root, T.fatal[e.key]);
    }
    throw e;
  }
  // Local mode opens only with the PIN, checked on the server (Live mode
  // inside Telegram never sees this).
  if (backend.kind === 'local') {
    const { unlockLocalMode } = await import('./ui/local-gate.js?v=1.0.0');
    await unlockLocalMode(root);
  }

  // Platform actions differ between real Telegram and the local simulation.
  const platform = createPlatform(tg, { local: backend.kind === 'local' });
  const ctx = createShell({ root, tg, backend, platform, screens: SCREENS, report });
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

  // Where this launch opens; only the first boot uses it (not a restart from the test panel).
  let target = launchTarget(window.location.search);

  /** Loads the user and opens the right first screen. */
  const boot = async () => {
    const me = await backend.me();
    ctx.me = me;
    ctx.profile = me.profile;
    ctx.signup = {};
    ctx.boardFilters = null;
    if (me.banned) return ctx.nav.reset('banned');
    if (!me.registered) return ctx.nav.reset('intro', { page: 0 });
    const first = target;
    target = launchTarget('');
    // A normal launch: the board with the drawer open (tapping an item, or
    // anywhere outside it, closes it). From a bot button: its target.
    await openLaunch(ctx, first);
    return undefined;
  };

  try {
    await boot();
  } catch (e) {
    report(e, { action: e?.action ?? 'boot' });
    showFatal(root, ctx.messageOf(e), e?.message);
    return undefined;
  }

  if (backend.kind === 'local' && CONFIG.switches.testPanel) {
    const { mountTestPanel } = await import('./ui/local-panel.js?v=1.0.0');
    mountTestPanel(ctx, backend, boot);
  }
  return undefined;
}

start();
