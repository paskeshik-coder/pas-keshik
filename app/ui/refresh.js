/**
 * When the live screens (جستجو, درخواست‌های من, پیشنهادهای من) refresh
 * themselves (spec: Auto-refresh). Only the timing lives here; what a
 * refresh does is the screen's `run`. All values come from
 * config.timing.refresh:
 *   - every activeEverySeconds while the user is active (touched, scrolled
 *     or typed within activeWindowSeconds), every idleEverySeconds otherwise;
 *   - stopped after stopAfterMinutes without a touch, and while the app is in
 *     the background; a touch, or the app coming back, starts it again;
 *   - at once when the app comes back, after any action the user takes, when
 *     a filter changes, and when the connection returns;
 *   - never two at once: one asked for while another runs follows it;
 *   - a refresh that falls due while the user is busy (typing, touching,
 *     scrolling, a dialog open, an action of theirs under way) waits until
 *     catchUpAfterMs after they stop;
 *   - after offlineAfterFailures failures in a row the offline sign shows,
 *     until a refresh works again. Failures never show anything else.
 *
 * Pure timing logic: the clock, the timers and "is the user busy" are passed
 * in, so tests drive it with a fake clock.
 */

import { CONFIG } from '../../supabase/functions/_shared/config.js?v=1.0.0';

/**
 * @typedef {{
 *   run: () => Promise<boolean>,
 *   isBusy?: (urgent: boolean) => boolean,
 *   onOffline?: (offline: boolean) => void,
 *   now?: () => number,
 *   setTimer?: (fn: () => void, ms: number) => any,
 *   clearTimer?: (t: any) => void,
 *   timing?: typeof CONFIG.timing.refresh,
 * }} RefresherOptions
 *   run       — one refresh; resolves true when it worked
 *   isBusy    — whether the user is typing, touching, scrolling or has a dialog open right now
 *               (urgent: the refresh was asked for at once, so a recent touch alone doesn't hold it)
 *   onOffline — shows or hides the offline sign
 */

/**
 * Creates a stopped refresher; call start().
 * @param {RefresherOptions} options
 */
export function createRefresher({
  run, isBusy = () => false, onOffline = () => {}, now = Date.now,
  setTimer = (fn, ms) => setTimeout(fn, ms), clearTimer = (t) => clearTimeout(t),
  timing = CONFIG.timing.refresh,
}) {
  const ACTIVE = timing.activeEverySeconds * 1000;
  const IDLE = timing.idleEverySeconds * 1000;
  const WINDOW = timing.activeWindowSeconds * 1000;
  const STOP = timing.stopAfterMinutes * 60000;
  const CATCH_UP = timing.catchUpAfterMs;

  const state = {
    started: false,
    hidden: false,
    sleeping: false,
    inFlight: false,
    /** A refresh was asked for "now" (and hasn't run yet). */
    wanted: false,
    lastActivity: 0,
    lastRun: 0,
    failures: 0,
    offline: false,
    timer: /** @type {any} */ (null),
    runs: 0,
  };

  const clear = () => {
    if (state.timer !== null) clearTimer(state.timer);
    state.timer = null;
  };

  /** The gap between refreshes right now. */
  const interval = () => (now() - state.lastActivity < WINDOW ? ACTIVE : IDLE);

  /** Sets the one timer for the next thing to check. */
  function schedule() {
    clear();
    if (!state.started || state.hidden || state.inFlight) return;
    const t = now();
    const stopAt = state.lastActivity + STOP;
    if (t >= stopAt && !state.wanted) {
      state.sleeping = true;
      return;
    }
    const due = state.wanted ? t : state.lastRun + interval();
    // Wake up at the due time, when the active window ends (the gap grows),
    // or when it's time to stop — whichever comes first.
    const windowEnd = state.lastActivity + WINDOW;
    const next = Math.min(due, t < windowEnd ? windowEnd : Infinity, stopAt > t ? stopAt : Infinity);
    state.timer = setTimer(tick, Math.max(0, next - t));
  }

  /** The timer fired: refresh if due (and the user isn't busy), else wait. */
  function tick() {
    state.timer = null;
    if (!state.started || state.hidden || state.inFlight) return;
    const t = now();
    if (t >= state.lastActivity + STOP && !state.wanted) {
      state.sleeping = true;
      return;
    }
    const due = state.wanted || t >= state.lastRun + interval();
    if (!due) return schedule();
    if (isBusy(state.wanted)) {
      // Catch up shortly after the user stops.
      state.timer = setTimer(tick, CATCH_UP);
      return undefined;
    }
    return refresh();
  }

  /** Runs one refresh now. */
  async function refresh() {
    state.inFlight = true;
    state.wanted = false;
    state.lastRun = now();
    state.runs += 1;
    let ok = false;
    try {
      ok = await run();
    } catch {
      ok = false;
    }
    state.inFlight = false;
    state.failures = ok ? 0 : state.failures + 1;
    const offline = state.failures >= timing.offlineAfterFailures;
    if (offline !== state.offline) {
      state.offline = offline;
      onOffline(offline);
    }
    schedule();
  }

  return {
    /** Starts (the screen just appeared; its first load counts as a refresh). */
    start() {
      state.started = true;
      state.sleeping = false;
      state.lastActivity = now();
      state.lastRun = now();
      schedule();
    },

    /** Stops for good (the screen is gone). */
    stop() {
      state.started = false;
      clear();
    },

    /** The user touched, scrolled or typed. Wakes a stopped refresher. */
    activity() {
      state.lastActivity = now();
      if (state.sleeping) {
        state.sleeping = false;
        state.wanted = true;
      }
      if (!state.inFlight) schedule();
    },

    /**
     * Refresh as soon as possible: after an action, a filter change, the app
     * coming back or the connection returning. Still waits for a running
     * refresh to finish, and for the user to stop typing or touching.
     */
    refreshNow() {
      state.wanted = true;
      state.sleeping = false;
      if (!state.inFlight) {
        clear();
        tick();
      }
    },

    /** The app went to the background: nothing runs until it comes back. */
    background() {
      state.hidden = true;
      clear();
    },

    /** The app came back: refresh at once (counts as activity). */
    foreground() {
      state.hidden = false;
      state.lastActivity = now();
      this.refreshNow();
    },

    /** For tests and the offline sign. */
    get status() {
      return {
        started: state.started, hidden: state.hidden, sleeping: state.sleeping, inFlight: state.inFlight,
        offline: state.offline, failures: state.failures, runs: state.runs,
      };
    },
  };
}
