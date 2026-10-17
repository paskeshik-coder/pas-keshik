/**
 * Sends everything the bot sends in the background (spec: Bot messages), at
 * one shared pace and in order of importance:
 *   1. personal messages — the one-time messages queued in app.outbox: a new
 *      offer, «نوبت شماست», an arrangement made, a cancellation, a
 *      confirmation that didn't go ahead, the sign-up messages, an admin's
 *      notices;
 *   2. shift reminders;
 *   3. new-request alerts (alerts.js);
 *   4. the 08:00 daily summary (summary.js);
 *   5. broadcasts (broadcast.js, server only).
 * After every small batch it starts again from the top, so a personal
 * message queued while a big summary or broadcast is going out is next.
 *
 * One sender at a time, across both Edge Functions and all their copies:
 * a run first takes the database's lease (app.sender_lease) and gives it
 * back when it ends, so one pace limit (limits.sendPerSecond, about 25
 * messages a second, under Telegram's ~30) covers every background message.
 * Replies to a person's own tap or command (the welcome, «چت»'s button, the
 * admin menu) are sent at once instead, outside this queue.
 *
 * A message is marked sent only after Telegram accepted it. A temporary
 * refusal (flood limit, Telegram's own errors, no connection) puts it back
 * for a later try: a personal message until its expiry, a reminder within
 * its window; the run pauses (as long as Telegram asks), and stops after a
 * few temporary errors in a row. A permanent refusal (the person blocked
 * the bot) marks it failed. Runs are started after any action that queues
 * something and by the 5-minute timer; a run that finds nothing left gives
 * the lease back and looks once more, so nothing queued meanwhile waits.
 *
 * Shared by the Edge Functions and LocalBackend (whose run has no pauses),
 * so it imports nothing server-only.
 */

import { CONFIG } from './config.js?v=1.2.5';
import { isTemporaryError } from './telegram-helpers.js?v=1.2.5';
import { rowsOf } from './errors.js?v=1.2.5';

/** @param {number} ms */
const realSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** A random name for one run's hold on the lease. */
function newHolder() {
  const bytes = new Uint8Array(12);
  globalThis.crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * The pace of one run: sends start at least 1000/perSecond ms apart, at most
 * `concurrency` are in flight at once, one recipient's sends go one after
 * another in the order given, and a pause (Telegram asked us to wait) holds
 * every send not yet started.
 * @param {{perSecond:number, concurrency:number, now:()=>number, sleep:(ms:number)=>Promise<void>}} options
 */
export function createPacer({ perSecond, concurrency, now, sleep }) {
  const gap = Math.ceil(1000 / perSecond);
  let nextStart = -Infinity;
  let pauseUntil = -Infinity;
  let gate = Promise.resolve();
  let free = concurrency;
  /** @type {(() => void)[]} */
  const waiting = [];
  /** @type {Map<number, Promise<void>>} */
  const chains = new Map();
  /** @type {Set<Promise<any>>} */
  const pending = new Set();

  const acquire = () => {
    if (free > 0) {
      free -= 1;
      return Promise.resolve();
    }
    return new Promise((resolve) => waiting.push(resolve));
  };
  const release = () => {
    const next = waiting.shift();
    if (next) next();
    else free += 1;
  };
  /** Waits for this send's turn to start (the pace, and any pause, even one asked for while waiting). */
  const slot = () => {
    const turn = gate.then(async () => {
      let until = Math.max(nextStart, pauseUntil);
      while (until > now()) {
        await sleep(until - now());
        const later = Math.max(nextStart, pauseUntil);
        if (later <= until) break;
        until = later;
      }
      nextStart = Math.max(now(), nextStart) + gap;
    });
    gate = turn.catch(() => {});
    return turn;
  };

  return {
    /**
     * Runs `task` for `chat` when its turn comes. `skip` is asked before the
     * wait and again before starting; when it says so, `onSkip` runs instead
     * (the row is handed back for a later run).
     * @param {number} chat
     * @param {() => Promise<any>} task
     * @param {{skip:() => boolean, onSkip:() => Promise<any>|any}} control
     */
    send(chat, task, { skip, onSkip }) {
      const previous = chains.get(chat) ?? Promise.resolve();
      const run = previous.then(async () => {
        if (skip()) return onSkip();
        await acquire();
        try {
          await slot();
          if (skip()) return onSkip();
          return await task();
        } finally {
          release();
        }
      });
      const tail = run.then(() => {}, () => {});
      chains.set(chat, tail);
      pending.add(run);
      tail.then(() => {
        pending.delete(run);
        if (chains.get(chat) === tail) chains.delete(chat);
      });
      return run;
    },
    /** Holds every send not yet started for `ms`. @param {number} ms */
    pause(ms) {
      pauseUntil = Math.max(pauseUntil, now() + ms);
    },
    /** Resolves once everything given to send() has finished (failures included). */
    async idle() {
      while (pending.size) await Promise.allSettled([...pending]);
    },
  };
}

/**
 * Queues one-time bot messages (notify.js plan) in app.outbox, then starts
 * the sender. Waits until they are in the queue, so none is lost once the
 * action that caused them has succeeded, but never fails that action over
 * them: a problem is logged.
 * @param {{db:any, kick?:()=>void, log?:(m:string)=>void}} deps kick — starts a sender run after the answer
 * @param {import('./notify.js').QueuedMessage[]} items
 * @param {number} now
 */
export async function queueMessages({ db, kick = () => {}, log = () => {} }, items, now) {
  if (!items.length) return;
  try {
    const r = await db.outboxAdd(items, now, CONFIG.timing.outboxExpiryHours);
    if (!r?.ok) throw new Error(r?.error ?? 'no result');
  } catch (e) {
    log(`queue messages failed: ${e?.message ?? e}`);
    return;
  }
  kick();
}

/** Counts of one kind of message in a run. */
const counts = () => ({ sent: 0, failed: 0, retried: 0 });

/**
 * The personal messages (app.outbox): one batch.
 * @param {any} ctx see runSender
 */
export async function personalTier(ctx) {
  const { db, notifier, now, T, L } = ctx;
  const stats = ctx.stats.personal;
  const rows = rowsOf(await db.outboxClaim(now(), L.sendBatch, T.sendStaleClaimMinutes), 'outbox claim');
  for (const row of rows) {
    ctx.dispatch(row.to_tg, async () => {
      const res = await notifier.deliver(row);
      const outcome = ctx.outcome(res);
      if (outcome === 'ok') {
        if (res.skipped) return db.outboxMark(row.id, 'skipped', now(), null);
        stats.sent += 1;
        return db.outboxMark(row.id, 'sent', now(), null);
      }
      if (outcome === 'failed') {
        stats.failed += 1;
        return db.outboxMark(row.id, 'failed', now(), null);
      }
      stats.retried += 1;
      return db.outboxMark(row.id, 'queued', now(), ctx.retryAt(row.attempts, res));
    }, () => db.outboxMark(row.id, 'queued', now(), now()));
  }
  return rows.length;
}

/**
 * Shift reminders due now: one batch.
 * @param {any} ctx see runSender
 */
export async function reminderTier(ctx) {
  const { db, notifier, now, T, L } = ctx;
  const stats = ctx.stats.reminders;
  const rows = rowsOf(await db.reminderClaim(now(), T.reminders, T.reminderGraceMinutes, L.sendBatch, T.sendStaleClaimMinutes),
    'reminder claim');
  for (const row of rows) {
    const mark = (status, next) => db.reminderMark(row.arrangement_id, row.kind, row.start_at, status, now(), next);
    ctx.dispatch(row.to_tg, async () => {
      const res = await notifier.reminder(row);
      const outcome = ctx.outcome(res);
      if (outcome === 'ok') {
        stats.sent += 1;
        return mark('sent', null);
      }
      if (outcome === 'failed') {
        stats.failed += 1;
        return mark('failed', null);
      }
      stats.retried += 1;
      return mark('queued', ctx.retryAt(row.attempts, res));
    }, () => mark('queued', now()));
  }
  return rows.length;
}

/**
 * One run of the sender: takes the lease, then sends batch after batch,
 * always the most important kind first, until nothing is left, the run's
 * time is up (timing.sendRunSeconds) or Telegram keeps refusing.
 * @param {{db:any, notifier:any, api?:any, tiers?:Array<{name:string, run:(ctx:any)=>Promise<number>}>,
 *          now?:()=>number, sleep?:(ms:number)=>Promise<void>, log?:(m:string)=>void, only?:string[]|null,
 *          force?:boolean}} deps
 *   tiers — the kinds of work after personal messages and reminders, most important first
 *           (alerts, summary, broadcast; see alerts.js, summary.js, broadcast.js)
 *   only  — run just these kinds (tests, and the test panel's "send the summary now")
 *   force — the summary's "send now" (summary.js)
 * @returns {Promise<{ran:boolean, stopped:boolean, personal:any, reminders:any, alerts:any, summary:any, broadcast:any}>}
 */
export async function runSender({
  db, notifier, api = null, tiers = [], now = Date.now, sleep = realSleep, log = () => {}, only = null, force = false,
}) {
  const T = CONFIG.timing;
  const L = CONFIG.limits;
  const stats = {
    ran: false, stopped: false, personal: counts(), reminders: counts(), alerts: counts(), summary: counts(),
    broadcast: { sent: 0, failed: 0, deleted: 0, edited: 0, gone: 0, retried: 0 },
  };
  const all = [{ name: 'personal', run: personalTier }, { name: 'reminders', run: reminderTier }, ...tiers]
    .filter((tier) => !only || only.includes(tier.name));
  const holder = newHolder();
  if (!(await db.senderLease(holder, now(), T.sendLeaseSeconds))) return stats;
  stats.ran = true;

  const deadline = now() + T.sendRunSeconds * 1000;
  const pacer = createPacer({ perSecond: L.sendPerSecond, concurrency: L.sendConcurrency, now, sleep });
  let errorsInRow = 0;
  let stopped = false;
  // Until when Telegram asked us to send nothing (a flood limit's retry_after).
  let telegramWaitUntil = -Infinity;
  const over = () => stopped || now() >= deadline;

  const ctx = {
    db, notifier, api, now, T, L, stats, force, log,
    /** Per-run memory for a kind of work (e.g. broadcast.js does its once-a-run steps once). */
    state: {},
    /**
     * Sends one row when its turn comes; hands it back (onSkip) once the run is over.
     * @param {number} chat
     * @param {() => Promise<any>} task
     * @param {() => Promise<any>|any} onSkip
     */
    dispatch(chat, task, onSkip) {
      pacer.send(Number(chat), task, { skip: over, onSkip }).catch((e) => log(`send failed: ${e?.message ?? e}`));
    },
    /**
     * What Telegram's answer means for the run: 'ok', 'failed' (for good: the
     * person blocked the bot, …) or 'retry' (temporary: the run pauses as
     * long as Telegram asks, or stops after a few of these in a row).
     * @param {any} res
     * @returns {'ok'|'failed'|'retry'}
     */
    outcome(res) {
      if (res?.ok) {
        errorsInRow = 0;
        return 'ok';
      }
      if (!isTemporaryError(res)) return 'failed';
      const retryAfter = Number(res.parameters?.retry_after) || 0;
      if (res.error_code === 429 && retryAfter > 0) {
        telegramWaitUntil = Math.max(telegramWaitUntil, now() + retryAfter * 1000);
        if (retryAfter > T.sendLongestPauseSeconds || now() + retryAfter * 1000 >= deadline) stopped = true;
        else pacer.pause(retryAfter * 1000);
      } else {
        errorsInRow += 1;
        if (errorsInRow >= T.sendStopAfterErrors) stopped = true;
        else pacer.pause(T.sendPauseSeconds * 1000);
      }
      return 'retry';
    },
    /**
     * When to try a message again: as long as Telegram asked, otherwise
     * sendRetryFirstSeconds, doubling with each attempt, at most
     * sendRetryMaxMinutes.
     * @param {number} attempts tries so far
     * @param {any} res
     */
    retryAt(attempts, res) {
      const asked = (Number(res?.parameters?.retry_after) || 0) * 1000;
      const backoff = Math.min(T.sendRetryFirstSeconds * 1000 * 2 ** Math.max(0, Number(attempts) - 1),
        T.sendRetryMaxMinutes * 60000);
      return now() + Math.max(asked, backoff);
    },
  };

  let holding = true;
  // Whether the last pass already gave the lease back and looked once more.
  let lookedAgain = false;
  try {
    while (!over()) {
      // Keep the lease while working (and stop if another sender took it over).
      if (!(await db.senderLease(holder, now(), T.sendLeaseSeconds))) break;
      let handled = 0;
      for (const tier of all) {
        handled = await tier.run(ctx);
        await pacer.idle();
        if (handled || over()) break;
      }
      if (handled) {
        lookedAgain = false;
        continue;
      }
      // Nothing to do after looking once more (what is waiting can't be sent
      // yet, e.g. a person's earlier message still held): the next timer's run will.
      if (over() || only || lookedAgain) break;
      // Nothing left: give the lease back, then look once more, so a message
      // queued while we held it doesn't wait for the next timer.
      await db.senderRelease(holder);
      holding = false;
      lookedAgain = true;
      if (!(await db.senderPending(now()))) break;
      if (!(await db.senderLease(holder, now(), T.sendLeaseSeconds))) break;
      holding = true;
    }
  } catch (e) {
    log(`sender run failed: ${e?.message ?? e}`);
  } finally {
    await pacer.idle();
    if (holding) {
      // (LocalBackend's engine answers at once, the database with a promise.)
      try {
        // Telegram asked for a wait that isn't over: keep the lease until then,
        // so no run (from either function) sends anything before it is.
        const wait = Math.ceil((telegramWaitUntil - now()) / 1000);
        if (wait > 0) await db.senderLease(holder, now(), wait);
        else await db.senderRelease(holder);
      } catch (e) {
        log(`sender release failed: ${e?.message ?? e}`);
      }
    }
  }
  stats.stopped = stopped;
  if (stopped) log('sender run paused by temporary Telegram errors');
  return stats;
}
