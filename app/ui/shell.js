/**
 * The app shell: header (current screen's name), drawer, navigation stack,
 * back handling, toasts and confirmation dialogs.
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

import { CONFIG } from '../../supabase/functions/_shared/config.js?v=0.6.1';
import { errorText } from '../../supabase/functions/_shared/errors.js?v=0.6.1';
import { universityName } from '../../supabase/functions/_shared/catalog.js?v=0.6.1';
import { h, replace } from './dom.js?v=0.6.1';

/**
 * Builds the shell inside `root` and returns the screen context.
 * @param {{root:HTMLElement, tg:any, backend:any, platform:any, screens:Record<string, any>}} deps
 */
export function createShell({ root, tg, backend, platform, screens }) {
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

  const menuButton = h('button', { class: 'icon-btn', type: 'button', 'aria-label': T.common.menu, onClick: () => openDrawer() }, '☰');
  const backButton = h('button', { class: 'icon-btn', type: 'button', 'aria-label': T.common.back, hidden: true, onClick: () => goBack() }, '→');
  const title = h('h1', { class: 'title' });
  const content = h('main', { class: 'content' });
  const toast = h('div', { class: 'toast', role: 'status', 'aria-live': 'polite', hidden: true });
  const backdrop = h('div', { class: 'backdrop', hidden: true, onClick: () => closeDrawer() });
  const drawer = h('nav', { class: 'drawer', hidden: true, 'aria-label': T.common.menu });
  replace(root, h('header', { class: 'topbar' }, backButton, menuButton, title), content, backdrop, drawer, toast);

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
    title.textContent = screen.title(ctx, top.params);
    menuButton.hidden = Boolean(screen.onboarding);
    syncBack();
    replace(content, h('div', { class: 'boot' }, h('div', { class: 'spinner' })));
    let node;
    try {
      node = await screen.render(ctx, top.params);
    } catch (e) {
      if (e?.code === 'banned' && top.name !== 'banned') return reset('banned');
      node = h('div', { class: 'stack' },
        h('p', { class: 'error-text' }, messageOf(e)),
        h('button', { class: 'btn', type: 'button', onClick: () => show() }, T.common.retry));
    }
    if (token !== renderToken) return; // a newer navigation happened meanwhile
    replace(content, node);
    window.scrollTo(0, 0);
  }

  /** Persian message for any error. */
  function messageOf(e) {
    return errorText(e?.code ?? 'unknown');
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
    replace(drawer,
      h('div', { class: 'drawer-head' },
        h('div', { class: 'app-name' }, T.appName),
        p ? h('div', { class: 'who' }, `${p.firstName} ${p.lastName}`) : null,
        p ? h('div', { class: 'who' }, universityName(p.universityId)) : null),
      items.map(([name, label]) => h('button', {
        class: 'drawer-item',
        type: 'button',
        'aria-current': name === current && stack.length === 1 ? 'page' : null,
        onClick: () => {
          closeDrawer();
          reset(name);
        },
      }, label)));
    drawer.hidden = false;
    backdrop.hidden = false;
    drawerOpen = true;
    syncBack();
  }

  function closeDrawer() {
    drawer.hidden = true;
    backdrop.hidden = true;
    drawerOpen = false;
    syncBack();
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
   * Runs an async task; failures become a Persian toast.
   * @template T
   * @param {()=>Promise<T>} task
   * @returns {Promise<T|undefined>}
   */
  async function run(task) {
    try {
      return await task();
    } catch (e) {
      // Banned while the app was open: from now on every call is refused.
      if (e?.code === 'banned') {
        reset('banned');
        return undefined;
      }
      showToast(messageOf(e), { error: true });
      if (!e?.code) console.error(e);
      return undefined;
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
      /** Re-renders the current screen (e.g. after an action). */
      refresh: () => show(),
      /** Name of the current screen. */
      get current() {
        return stack[stack.length - 1]?.name;
      },
    },
    toast: showToast,
    confirm,
    run,
    messageOf,
  };
  return ctx;
}
