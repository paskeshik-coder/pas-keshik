/**
 * The app shell: header (current screen's name), drawer, navigation stack,
 * back handling, toasts and confirmation dialogs; and, for the live screens
 * (جستجو, درخواست‌های من, پیشنهادهای من; live-screen.js), what they need
 * from the page: the drawer's red dots (and the menu button's, while the
 * drawer is closed), the offline sign, the «درخواست‌های جدید» pill, whether
 * the user is busy (typing, touching, scrolling, a dialog or an action of
 * theirs under way), and the user's activity and the app going to the
 * background and back (Telegram's activated/deactivated events where
 * available, otherwise the page's visibility).
 *
 * Navigation is taps only. Going back uses Telegram's BackButton inside
 * Telegram; in a plain browser a header back button appears instead, and the
 * browser/Android back gesture is mapped onto the same stack via the History
 * API. No swipe gestures anywhere (Android's edge swipe would close the Mini
 * App).
 *
 * Screens are plain objects: { title(ctx, params), render(ctx, params) →
 * Element | Promise<Element>, onboarding?: true }. `ctx` is the one object
 * every screen receives (backend, profile, navigation, dialogs, texts).
 */

import { CONFIG } from '../../supabase/functions/_shared/config.js?v=1.0.0';
import { errorText } from '../../supabase/functions/_shared/errors.js?v=1.0.0';
import { universityName } from '../../supabase/functions/_shared/catalog.js?v=1.0.0';
import { h, replace } from './dom.js?v=1.0.0';

/** Errors meaning the request is no longer there to act on (spec: Auto-refresh). */
export const GONE_ERRORS = Object.freeze(['request_not_found', 'request_closed', 'request_arranged', 'match_pending']);

/** The screens with a red dot in the drawer. */
const DOT_SCREENS = ['myRequests', 'myOffers'];

/** Text fields where the user may be typing (refreshes wait for them). */
const TYPING = /^(text|search|number|tel|password|email|url)$/;

/**
 * Builds the shell inside `root` and returns the screen context.
 * @param {{root:HTMLElement, tg:any, backend:any, platform:any, screens:Record<string, any>,
 *          report?:(error:any, context?:{action?:string|null, screen?:string|null})=>void}} deps
 *   report — sends an error report (app/report.js) whenever an error message is shown
 */
export function createShell({ root, tg, backend, platform, screens, report = () => {} }) {
  const T = CONFIG.text;
  const useTelegramBack = tg.backButton.available;
  const useHistory = !useTelegramBack && typeof history !== 'undefined';

  /** @type {{name:string, params:any}[]} */
  let stack = [];
  let drawerOpen = false;
  /** @type {null|(()=>void)} closes the open dialog as "cancel" */
  let closeDialog = null;
  let renderToken = 0;
  let toastTimer = 0;
  /** The live screen on show (live-screen.js), and one offered by a render in progress. */
  let live = null;
  let offered = null;
  /** Red dots from the last sync. */
  const dots = { myRequests: false, myOffers: false };
  /** @type {Record<string, HTMLElement>} the open drawer's dot per item */
  let drawerDots = {};
  // What the user is doing (for "busy").
  let actionsRunning = 0;
  let touching = false;
  let lastInteraction = -Infinity;
  let appVisible = true;
  /** @type {null|(()=>void)} what the pill does when tapped */
  let pillTap = null;

  const menuDot = h('span', { class: 'red-dot', hidden: true });
  const menuButton = h('button', { class: 'icon-btn menu-btn', type: 'button', 'aria-label': T.common.menu, onClick: () => openDrawer() },
    '☰', menuDot);
  const backButton = h('button', { class: 'icon-btn', type: 'button', 'aria-label': T.common.back, hidden: true, onClick: () => goBack() }, '→');
  const title = h('h1', { class: 'title' });
  const offlineSign = h('span', { class: 'offline', role: 'status', hidden: true }, T.live.offline);
  const header = h('header', { class: 'topbar' }, backButton, menuButton, title, offlineSign);
  const pill = h('button', { class: 'new-pill', type: 'button', hidden: true, onClick: () => pillTap?.() }, T.live.newItems);
  const content = h('main', { class: 'content' });
  const toast = h('div', { class: 'toast', role: 'status', 'aria-live': 'polite', hidden: true });
  const backdrop = h('div', { class: 'backdrop', hidden: true, onClick: () => closeDrawer() });
  const drawer = h('nav', { class: 'drawer', hidden: true, 'aria-label': T.common.menu });
  replace(root, header, pill, content, backdrop, drawer, toast);

  /** Shows or hides the back affordance for the current state. */
  function syncBack() {
    const canGoBack = stack.length > 1;
    if (useTelegramBack) {
      if (canGoBack || drawerOpen || closeDialog) tg.backButton.show();
      else tg.backButton.hide();
    } else {
      backButton.hidden = !canGoBack;
    }
  }

  /** Renders the top of the stack. */
  async function show() {
    const token = ++renderToken;
    const top = stack[stack.length - 1];
    const screen = screens[top.name];
    // The previous live screen stops refreshing (forms, dialogs elsewhere).
    live?.stop();
    live = null;
    setPill(0);
    setOffline(false);
    // Opening a screen clears its dot (the server marks it seen too).
    if (DOT_SCREENS.includes(top.name)) dots[top.name] = false;
    syncDots();
    title.textContent = screen.title(ctx, top.params);
    menuButton.hidden = Boolean(screen.onboarding);
    syncBack();
    replace(content, h('div', { class: 'boot' }, h('div', { class: 'spinner' })));
    let node;
    try {
      node = await screen.render(ctx, top.params);
    } catch (e) {
      if (e?.code === 'banned' && top.name !== 'banned') return reset('banned');
      report(e, { action: e?.action ?? 'load', screen: top.name });
      node = h('div', { class: 'stack' },
        h('p', { class: 'error-text' }, messageOf(e)),
        h('button', { class: 'btn', type: 'button', onClick: () => show() }, T.common.retry));
    }
    const candidate = offered?.token === token ? offered.controller : null;
    if (token !== renderToken) {
      candidate?.stop();
      return; // a newer navigation happened meanwhile
    }
    offered = null;
    replace(content, node);
    window.scrollTo(0, 0);
    if (candidate) {
      live = candidate;
      live.start();
    }
  }

  /** Persian message for any error. */
  function messageOf(e) {
    return errorText(e?.code ?? 'unknown');
  }

  /**
   * Shows an error message (a toast; `text`, or the error's own message)
   * and sends its technical reason to the server log (report).
   * @param {any} e
   * @param {{action?:string|null, text?:string|null}} [options]
   */
  function showError(e, { action = null, text = null } = {}) {
    showToast(text ?? messageOf(e), { error: true });
    report(e, { action: action ?? e?.action ?? null, screen: stack[stack.length - 1]?.name ?? null });
  }

  /** @param {string} name @param {any} [params] */
  function push(name, params = {}) {
    stack.push({ name, params });
    if (useHistory) history.pushState({ pk: stack.length }, '');
    return show();
  }

  /** @param {string} name @param {any} [params] */
  function reset(name, params = {}) {
    stack = [{ name, params }];
    if (useHistory) history.replaceState({ pk: 1 }, '');
    return show();
  }

  /** Back one step: closes a dialog or the drawer first. */
  function goBack() {
    if (closeDialog) return closeDialog();
    if (drawerOpen) return closeDrawer();
    if (stack.length <= 1) return undefined;
    if (useHistory) return history.back(); // popstate does the popping
    stack.pop();
    return show();
  }

  if (useTelegramBack) tg.backButton.onClick(goBack);
  if (useHistory) {
    window.addEventListener('popstate', (event) => {
      const depth = Math.max(1, Number(event.state?.pk) || 1);
      if (closeDialog) closeDialog();
      if (drawerOpen) closeDrawer();
      if (depth < stack.length) {
        stack = stack.slice(0, depth);
        show();
      }
    });
  }

  /** Builds and opens the drawer. */
  function openDrawer() {
    const current = stack[0]?.name;
    const items = [['board', T.drawer.board], ['myRequests', T.drawer.myRequests], ['myOffers', T.drawer.myOffers]];
    // Later slices' items stay hidden until their switch is turned on.
    for (const key of ['invite', 'contact', 'settings']) {
      if (CONFIG.switches.drawer[key] && screens[key]) items.push([key, T.drawer[key]]);
    }
    const p = ctx.profile;
    drawerDots = {};
    replace(drawer,
      h('div', { class: 'drawer-head' },
        h('div', { class: 'app-name' }, T.appName),
        p ? h('div', { class: 'who' }, `${p.firstName} ${p.lastName}`) : null,
        p ? h('div', { class: 'who' }, universityName(p.universityId)) : null),
      items.map(([name, label]) => {
        const here = name === current && stack.length === 1;
        const dot = DOT_SCREENS.includes(name) ? (drawerDots[name] = h('span', { class: 'red-dot', hidden: true })) : null;
        return h('button', {
          class: 'drawer-item',
          type: 'button',
          'aria-current': here ? 'page' : null,
          onClick: () => {
            closeDrawer();
            // The screen already on show stays as it is.
            if (!here) reset(name);
          },
        }, label, dot);
      }));
    drawer.hidden = false;
    backdrop.hidden = false;
    drawerOpen = true;
    syncDots();
    syncBack();
  }

  function closeDrawer() {
    drawer.hidden = true;
    backdrop.hidden = true;
    drawerOpen = false;
    syncDots();
    syncBack();
  }

  /**
   * Shows the red dots: on the drawer's items while it is open, on the menu
   * button while it is closed; never for the screen on show.
   */
  function syncDots() {
    const current = stack[stack.length - 1]?.name;
    const visible = (name) => dots[name] && name !== current;
    for (const name of DOT_SCREENS) {
      if (drawerDots[name]) {
        drawerDots[name].hidden = !visible(name);
        drawerDots[name].setAttribute('aria-label', T.live.dot);
      }
    }
    menuDot.hidden = drawerOpen || !DOT_SCREENS.some(visible);
  }

  /** @param {boolean} on */
  function setOffline(on) {
    offlineSign.hidden = !on;
  }

  /**
   * Shows the «درخواست‌های جدید» pill (count > 0) or hides it.
   * @param {number} count
   * @param {()=>void} [onTap]
   */
  function setPill(count, onTap) {
    pill.hidden = !(count > 0);
    pillTap = count > 0 ? onTap ?? null : null;
  }

  /** Bottom of the header: the top of what the user can see of the page. */
  const viewportTop = () => header.getBoundingClientRect().bottom;

  /**
   * Whether the user is in the middle of something a refresh must not
   * disturb. A refresh asked for at once (after an action, a filter change,
   * the app coming back) doesn't wait out the moments after a touch.
   * @param {boolean} [urgent]
   */
  function isBusy(urgent = false) {
    if (closeDialog || actionsRunning > 0 || touching) return true;
    if (!urgent && Date.now() - lastInteraction < CONFIG.timing.refresh.catchUpAfterMs) return true;
    const a = document.activeElement;
    return Boolean(a && (a.tagName === 'TEXTAREA' || a.isContentEditable
      || (a.tagName === 'INPUT' && TYPING.test(a.type || 'text'))));
  }

  /** The user touched, scrolled or typed. */
  function interacted() {
    lastInteraction = Date.now();
    live?.activity();
  }

  /** The app went to the background (false) or came back (true). */
  function visibility(visible) {
    if (visible === appVisible) return;
    appVisible = visible;
    if (visible) live?.foreground();
    else live?.background();
  }

  const listen = (target, names, fn) => {
    if (!target?.addEventListener) return;
    for (const name of names) target.addEventListener(name, fn, { passive: true });
  };
  listen(document, ['pointerdown', 'touchstart'], () => {
    touching = true;
    interacted();
  });
  listen(document, ['pointerup', 'pointercancel', 'touchend', 'touchcancel'], () => {
    touching = false;
    interacted();
  });
  listen(document, ['keydown', 'input'], () => interacted());
  listen(window, ['scroll', 'wheel'], () => {
    interacted();
    live?.onScroll();
  });
  listen(window, ['online'], () => live?.refreshNow());
  // Telegram's own events say best whether the Mini App is in front; the
  // page's visibility is the fallback.
  if (!tg.onActivation?.((active) => visibility(active))) {
    listen(document, ['visibilitychange'], () => visibility(document.visibilityState !== 'hidden'));
  }

  /**
   * Shows a short message at the bottom of the screen.
   * @param {string} text
   * @param {{error?:boolean}} [options]
   */
  function showToast(text, { error = false } = {}) {
    toast.textContent = text;
    toast.className = error ? 'toast error' : 'toast';
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, CONFIG.timing.toastMs);
  }

  /**
   * Confirmation dialog.
   * @param {{title:string, body?:string, lines?:string[], okText?:string, cancelText?:string, danger?:boolean}} options
   * @returns {Promise<boolean>}
   */
  function confirm({ title: heading, body, lines, okText = T.common.confirm, cancelText = T.common.cancel, danger = false }) {
    return new Promise((resolve) => {
      const finish = (answer) => {
        wrap.remove();
        closeDialog = null;
        syncBack();
        resolve(answer);
      };
      const wrap = h('div', { class: 'modal-wrap', role: 'dialog', 'aria-modal': 'true' },
        h('div', { class: 'modal' },
          h('h3', null, heading),
          body ? h('p', null, body) : null,
          lines?.length ? h('div', { class: 'lines' }, lines.map((l) => h('div', null, l))) : null,
          h('div', { class: 'actions' },
            h('button', { class: danger ? 'btn danger' : 'btn primary', type: 'button', onClick: () => finish(true) }, okText),
            h('button', { class: 'btn', type: 'button', onClick: () => finish(false) }, cancelText))));
      closeDialog = () => finish(false);
      document.body.append(wrap);
      syncBack();
    });
  }

  /**
   * Runs an async task (an action the user took); failures become a Persian
   * toast. With `gone`, a request that left meanwhile (taken, cancelled,
   * started) only says «این درخواست دیگر در دسترس نیست». The live screen
   * refreshes right after.
   * @template T
   * @param {()=>Promise<T>} task
   * @param {{gone?:boolean}} [options]
   * @returns {Promise<T|undefined>}
   */
  async function run(task, { gone = false } = {}) {
    actionsRunning += 1;
    try {
      return await task();
    } catch (e) {
      // Banned while the app was open: from now on every call is refused.
      if (e?.code === 'banned') {
        reset('banned');
        return undefined;
      }
      if (gone && GONE_ERRORS.includes(e?.code)) {
        showToast(T.live.gone);
        return undefined;
      }
      showError(e);
      if (!e?.code) console.error(e);
      return undefined;
    } finally {
      actionsRunning -= 1;
      live?.refreshNow();
    }
  }

  const ctx = {
    t: T,
    tg,
    backend,
    platform,
    /** The signed-in user's profile (null before sign-up). */
    profile: null,
    /** Last me() result. */
    me: null,
    /** Sign-up answers collected across the sign-up screens. */
    signup: {},
    /** Board filters kept while navigating. */
    boardFilters: null,
    nav: {
      push,
      reset,
      back: goBack,
      /**
       * After an action: a live screen refreshes in place (only what
       * changed); any other screen is drawn again.
       */
      refresh: () => (live ? live.refreshNow() : show()),
      /** Name of the current screen. */
      get current() {
        return stack[stack.length - 1]?.name;
      },
    },
    toast: showToast,
    showError,
    confirm,
    run,
    messageOf,
    drawer: {
      open: openDrawer,
      close: closeDrawer,
      get isOpen() {
        return drawerOpen;
      },
    },
    /** What the live screens use (live-screen.js). */
    live: {
      /** Offered while rendering; started once the screen is on show. */
      attach(controller) {
        offered = { token: renderToken, controller };
      },
      /** @param {{myRequests:boolean, myOffers:boolean}} d */
      setDots(d) {
        for (const name of DOT_SCREENS) dots[name] = Boolean(d?.[name]);
        syncDots();
      },
      setOffline,
      setPill,
      isBusy,
      viewportTop,
      /** Scrolls so `el` sits just under the header. */
      scrollTo(el) {
        const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
        window.scrollBy({ top: el.getBoundingClientRect().top - viewportTop() - 8, behavior: reduce ? 'auto' : 'smooth' });
      },
      /** A tap on a card that is fading out. */
      goneTap: () => showToast(T.live.gone),
      get dots() {
        return { ...dots };
      },
      get current() {
        return live;
      },
    },
  };
  return ctx;
}
