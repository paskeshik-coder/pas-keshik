/**
 * What makes جستجو, درخواست‌های من and پیشنهادهای من live (spec:
 * Auto-refresh): one sync call per refresh (only what changed since the
 * last one, plus the drawer's red dots), the changes handed to the screen's
 * in-place lists (live-list.js), and the refresh timing (refresh.js). A
 * screen builds its lists, then calls liveScreen() and awaits load() once
 * before showing itself; the shell then drives the returned controller
 * (activity, background, foreground, refresh after actions) until the user
 * leaves the screen.
 *
 * Background refreshes never show an error: a failure only counts towards
 * the offline sign. A banned user is taken to the banned screen.
 */

import { createRefresher } from './refresh.js?v=1.0.0';

/**
 * @param {any} ctx
 * @param {{
 *   screen: 'board'|'myRequests'|'myOffers',
 *   lists: {list: ReturnType<typeof import('./live-list.js').createLiveList>, accepts?: (item:any)=>boolean}[],
 *   body?: () => object,
 *   expiresAt?: (item:any) => number|null,
 *   onItems?: (items:any[]) => void,
 * }} options
 *   body      — extra fields for the sync call (the board's filters)
 *   expiresAt — when an item leaves on its own, even between refreshes (a board request's start)
 *   onItems   — after every change, with the full list (e.g. for a whole-screen empty state)
 */
export function liveScreen(ctx, { screen, lists, body = () => ({}), expiresAt = () => null, onItems = () => {} }) {
  /** @type {string|null} */
  let cursor = null;
  /** @type {Map<number, any>} */
  const items = new Map();
  /** @type {number[]} */
  let order = [];
  let generation = 0;
  let expiryTimer = null;
  let stopped = false;

  const ordered = () => order.map((id) => items.get(id)).filter(Boolean);

  /** Hands the current list to the screen's lists. */
  function draw() {
    const all = ordered();
    for (const { list, accepts = () => true } of lists) list.update(all.filter(accepts));
    onItems(all);
    scheduleExpiry(all);
  }

  /** Items whose time is up leave the screen on time, between refreshes too. */
  function scheduleExpiry(all) {
    clearTimeout(expiryTimer);
    if (stopped) return;
    const now = ctx.backend.now();
    const next = Math.min(...all.map(expiresAt).filter((t) => typeof t === 'number' && t > now), Infinity);
    const due = all.filter((item) => {
      const t = expiresAt(item);
      return typeof t === 'number' && t <= now;
    });
    for (const item of due) {
      items.delete(item.id);
      order = order.filter((id) => id !== item.id);
      for (const { list } of lists) list.remove(item.id);
    }
    if (due.length) onItems(ordered());
    // setTimeout can't wait longer than about 24 days; a later start is checked again then.
    if (next !== Infinity) expiryTimer = setTimeout(() => scheduleExpiry(ordered()), Math.min(next - now, 2 ** 31 - 1));
  }

  /**
   * One sync. Resolves true when it worked. Only the screen's first load
   * lets an error through (the shell then shows it with «تلاش دوباره»);
   * background refreshes never do.
   * @param {boolean} [first]
   */
  async function load(first = false) {
    const gen = generation;
    let data;
    try {
      data = await ctx.backend.sync({ screen, cursor, ...body() });
    } catch (e) {
      if (first) throw e;
      if (e?.code === 'banned') ctx.nav.reset('banned');
      return false;
    }
    // The filter changed meanwhile: this answer is for the old one.
    if (gen !== generation || stopped) return true;
    if (data.full) items.clear();
    for (const id of data.removed) items.delete(id);
    for (const item of data.changed) items.set(item.id, item);
    order = data.order;
    cursor = data.cursor;
    ctx.live.setDots(data.dots);
    draw();
    return true;
  }

  const refresher = createRefresher({
    run: () => load(false),
    isBusy: (urgent) => ctx.live.isBusy(urgent),
    onOffline: (offline) => ctx.live.setOffline(offline),
    now: () => Date.now(),
  });

  /** Total of new cards waiting for the pill, across the lists. */
  const waiting = () => lists.reduce((n, { list }) => n + list.waiting, 0);

  /** Puts the waiting cards in and returns the first one on the page. */
  function reveal() {
    const els = lists.map(({ list }) => list.revealPending()).filter(Boolean);
    ctx.live.setPill(0);
    return els[0] ?? null;
  }

  return {
    load,
    /** Shows or hides the pill for the lists' waiting cards. */
    pendingChanged() {
      const n = waiting();
      ctx.live.setPill(n, () => {
        const el = reveal();
        if (el) ctx.live.scrollTo(el);
      });
    },
    /** The board's filter changed: start over (the filters themselves stay as chosen). */
    restart() {
      generation += 1;
      cursor = null;
      items.clear();
      order = [];
      for (const { list } of lists) list.clear();
      ctx.live.setPill(0);
      refresher.refreshNow();
    },
    // The shell's side.
    start: () => refresher.start(),
    stop() {
      stopped = true;
      clearTimeout(expiryTimer);
      refresher.stop();
    },
    refreshNow: () => refresher.refreshNow(),
    activity: () => refresher.activity(),
    background: () => refresher.background(),
    foreground: () => refresher.foreground(),
    /** After a scroll: back at the top, waiting cards come in by themselves. */
    onScroll() {
      if (waiting() && lists.every(({ list }) => !list.scrolledDown)) reveal();
    },
    get refresher() {
      return refresher;
    },
  };
}
