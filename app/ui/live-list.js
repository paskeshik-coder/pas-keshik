/**
 * A list of cards kept up to date in place (spec: Auto-refresh), keyed by
 * id. It is never rebuilt:
 *   - a card whose data changed is replaced where it stands; one that didn't
 *     change is left alone (so nothing typed or chosen in it is lost);
 *   - a card that left (taken, cancelled, started) fades out over fadeMs
 *     and is then removed; a tap on it meanwhile only calls onGoneTap;
 *   - a new card slides in where it belongs, unless the user has scrolled
 *     down and it would push what they are looking at: then it waits, and
 *     onPending(count) shows the «درخواست‌های جدید» pill; revealPending()
 *     (the pill's tap, or scrolling back to the top) puts the waiting cards
 *     in;
 *   - whatever changes above the user's view, the card they are looking at
 *     stays exactly where it is on the screen (the scroll position is
 *     corrected by the height that changed above it).
 * The page itself never scrolls to the top or anywhere else on its own.
 *
 * Layout questions (is the user scrolled down? where is the bottom of the
 * screen?) and scrolling are passed in, so tests can drive it with a fake
 * page.
 */

import { CONFIG } from '../../supabase/functions/_shared/config.js?v=1.0.0';

/**
 * @template T
 * @typedef {{
 *   container: HTMLElement,
 *   render: (item: T) => HTMLElement,
 *   keyOf?: (item: T) => number,
 *   empty?: () => HTMLElement|null,
 *   isScrolledDown?: () => boolean,
 *   viewportTop?: () => number,
 *   viewportBottom?: () => number,
 *   scrollBy?: (dy: number) => void,
 *   onPending?: (count: number) => void,
 *   onGoneTap?: () => void,
 *   onChange?: () => void,
 *   setTimer?: (fn: () => void, ms: number) => any,
 *   clearTimer?: (t: any) => void,
 *   timing?: {fadeMs: number, enterMs: number},
 * }} LiveListOptions
 */

/**
 * @template T
 * @param {LiveListOptions<T>} options
 */
export function createLiveList({
  container, render, keyOf = (item) => item.id, empty = () => null,
  isScrolledDown = () => false,
  viewportTop = () => 0,
  viewportBottom = () => (typeof innerHeight === 'number' ? innerHeight : 0),
  scrollBy = (dy) => window.scrollBy(0, dy),
  onPending = () => {}, onGoneTap = () => {}, onChange = () => {},
  setTimer = (fn, ms) => setTimeout(fn, ms), clearTimer = (t) => clearTimeout(t),
  timing = CONFIG.timing.refresh,
}) {
  /** @type {Map<number, {el:HTMLElement, sig:string, leaving:boolean, timer:any, guard:any}>} */
  const entries = new Map();
  /** @type {Map<number, T>} new items waiting for the pill */
  const pending = new Map();
  /** @type {number[]} keys in display order (shown and waiting) */
  let order = [];
  /** @type {HTMLElement|null} */
  let emptyEl = null;
  let lastPending = 0;

  /** The cards in the container, in page order, with their keys. */
  const shown = () => [...entries.entries()]
    .sort(([, a], [, b]) => indexOf(a.el) - indexOf(b.el));
  const indexOf = (el) => [...container.children].indexOf(el);

  /**
   * Runs a change; if the user is scrolled down, keeps the first card they
   * can see exactly where it was on the screen.
   * @param {()=>void} change
   * @param {HTMLElement[]} [moving] cards the change itself moves or replaces
   */
  function keepView(change, moving = []) {
    if (!isScrolledDown()) {
      change();
      return;
    }
    const top = viewportTop();
    const anchor = shown().map(([, e]) => e.el)
      .find((el) => !moving.includes(el) && el.getBoundingClientRect().bottom > top);
    const before = anchor ? anchor.getBoundingClientRect().top : 0;
    change();
    if (anchor && anchor.isConnected !== false) {
      const delta = anchor.getBoundingClientRect().top - before;
      if (delta) scrollBy(delta);
    }
  }

  /** The card (shown) that comes after `key` in display order, or null for the end. */
  function nextShown(key) {
    for (let i = order.indexOf(key) + 1; i < order.length; i += 1) {
      const e = entries.get(order[i]);
      if (e) return e.el;
    }
    return null;
  }

  /**
   * Puts a new card in.
   * @param {T} item
   */
  function insert(item) {
    const key = keyOf(item);
    const el = render(item);
    el.classList.add('entering');
    const before = nextShown(key);
    keepView(() => container.insertBefore(el, before ?? emptyEl ?? null), [el]);
    entries.set(key, { el, sig: JSON.stringify(item), leaving: false, timer: null, guard: null });
    setTimer(() => el.classList.remove('entering'), timing.enterMs);
    return el;
  }

  /**
   * Starts fading a card out; it is removed after fadeMs.
   * @param {number} key
   */
  function leave(key) {
    const e = entries.get(key);
    if (!e || e.leaving) return;
    e.leaving = true;
    e.el.classList.add('leaving');
    e.el.setAttribute('aria-hidden', 'true');
    // A tap on a card that is going: only the "no longer available" note.
    e.guard = (event) => {
      event.preventDefault();
      event.stopPropagation();
      onGoneTap();
    };
    e.el.addEventListener('click', e.guard, true);
    e.timer = setTimer(() => {
      keepView(() => e.el.remove(), [e.el]);
      entries.delete(key);
      afterChange();
    }, timing.fadeMs);
  }

  /** A card that was fading out is wanted again. */
  function stay(e) {
    clearTimer(e.timer);
    e.leaving = false;
    e.el.classList.remove('leaving');
    e.el.removeAttribute('aria-hidden');
    e.el.removeEventListener('click', e.guard, true);
    e.guard = null;
  }

  /** Keeps the shown cards in display order (rarely needed: a start time edited). */
  function reorder() {
    const wanted = order.filter((k) => entries.has(k) && !entries.get(k).leaving);
    const now = shown().filter(([, e]) => !e.leaving).map(([k]) => k);
    if (wanted.join() === now.join()) return;
    keepView(() => {
      for (const k of wanted) container.insertBefore(entries.get(k).el, emptyEl ?? null);
    }, wanted.map((k) => entries.get(k).el));
  }

  /** Empty state and pill after any change. */
  function afterChange() {
    const visible = [...entries.values()].filter((e) => !e.leaving).length;
    const shouldBeEmpty = visible === 0 && pending.size === 0 && entries.size === 0;
    if (shouldBeEmpty && !emptyEl) {
      emptyEl = empty();
      if (emptyEl) container.append(emptyEl);
    } else if (!shouldBeEmpty && emptyEl) {
      emptyEl.remove();
      emptyEl = null;
    }
    if (pending.size !== lastPending) {
      lastPending = pending.size;
      onPending(pending.size);
    }
    onChange();
  }

  return {
    /**
     * Brings the list to `items` (the full list, in display order).
     * @param {T[]} items
     */
    update(items) {
      order = items.map(keyOf);
      const wanted = new Map(items.map((item) => [keyOf(item), item]));
      for (const [key, e] of entries) if (!wanted.has(key) && !e.leaving) leave(key);
      for (const key of [...pending.keys()]) if (!wanted.has(key)) pending.delete(key);
      // Changed cards, in place.
      for (const item of items) {
        const key = keyOf(item);
        const e = entries.get(key);
        if (!e) {
          if (pending.has(key)) pending.set(key, item);
          continue;
        }
        if (e.leaving) stay(e);
        const sig = JSON.stringify(item);
        if (sig === e.sig) continue;
        const el = render(item);
        const old = e.el;
        keepView(() => container.replaceChild(el, old), [old]);
        Object.assign(e, { el, sig });
      }
      // New cards: in, or waiting for the pill.
      const scrolled = isScrolledDown();
      const bottom = viewportBottom();
      for (const item of items) {
        const key = keyOf(item);
        if (entries.has(key) || pending.has(key)) continue;
        const next = nextShown(key);
        // Would it push what the user is looking at? (Nothing below the
        // bottom of the screen, or at the very end of the list, can.)
        const pushes = scrolled && next !== null && next.getBoundingClientRect().top < bottom;
        if (pushes) pending.set(key, item);
        else insert(item);
      }
      reorder();
      afterChange();
    },

    /**
     * Puts the waiting new cards in (the pill was tapped, or the user is back
     * at the top). Returns the first of them on the page, to scroll to.
     * @returns {HTMLElement|null}
     */
    revealPending() {
      if (!pending.size) return null;
      const items = order.filter((k) => pending.has(k)).map((k) => pending.get(k));
      pending.clear();
      const els = items.map((item) => {
        const el = render(item);
        el.classList.add('entering');
        container.insertBefore(el, nextShown(keyOf(item)) ?? emptyEl ?? null);
        entries.set(keyOf(item), { el, sig: JSON.stringify(item), leaving: false, timer: null, guard: null });
        setTimer(() => el.classList.remove('entering'), timing.enterMs);
        return el;
      });
      afterChange();
      return els.sort((a, b) => indexOf(a) - indexOf(b))[0] ?? null;
    },

    /**
     * Fades one card out now (its shift started between refreshes).
     * @param {number} key
     */
    remove(key) {
      order = order.filter((k) => k !== key);
      if (pending.delete(key)) afterChange();
      leave(key);
    },

    /** Empties the list at once (the board's filter changed). */
    clear() {
      for (const e of entries.values()) {
        clearTimer(e.timer);
        e.el.remove();
      }
      entries.clear();
      pending.clear();
      order = [];
      emptyEl?.remove();
      emptyEl = null;
      lastPending = -1;
    },

    /** Whether the card for `key` is fading out. */
    isLeaving: (key) => Boolean(entries.get(key)?.leaving),
    /** How many cards are shown or waiting (not counting those fading out). */
    get size() {
      return [...entries.values()].filter((e) => !e.leaving).length + pending.size;
    },
    /** How many new cards wait for the pill. */
    get waiting() {
      return pending.size;
    },
    /** Whether the user has scrolled past the top of this list. */
    get scrolledDown() {
      return isScrolledDown();
    },
  };
}
