/**
 * Sends the 08:00 daily summary in the background. The 5-minute database
 * timer starts the background sender (sender.js) on every run; before
 * config.timing.summaryHour (Tehran time) the database answers "nothing to
 * do" in one cheap call. From that hour on, the database claims users in
 * small batches (skip locked, so two runs never pick the same person),
 * records each one for today's Tehran date — 'empty' when there is nothing
 * new for them, so nothing is sent — and returns the others with their
 * requests. This module sends each summary and records the outcome, so
 * everyone gets at most one summary a day.
 *
 * A summary claimed but not sent (the run ran out of time, or Telegram
 * asked us to slow down) stays 'claimed'; the database treats a claim older
 * than 10 minutes as unhandled, so a later run sends it.
 *
 * The summary is the fourth kind of work of the one background sender,
 * after personal messages, reminders and alerts, at its shared pace. In
 * test mode LocalBackend's sender runs it whenever its clock moves, and its
 * test panel's "send now" button runs it with `force` (ignores the hour and
 * records nothing). Used in the browser too, so it imports nothing
 * platform-specific.
 */

import { rowsOf } from './errors.js?v=1.2.6';
import { runSender } from './sender.js?v=1.2.6';

/** How many users a forced run (test panel only) takes in its single claim. */
const FORCE_LIMIT = 100000;

/**
 * One batch of summaries (a forced run: everyone, once).
 * @param {any} ctx sender.js's run context
 * @returns {Promise<number>} how many users the database handled (0: nothing left)
 */
async function summaryBatch(ctx) {
  const { db, notifier, now, T, L, force } = ctx;
  const stats = ctx.stats.summary;
  const r = await db.claimSummaries(now(), T.tehranOffsetMinutes, T.summaryHour, T.summaryWindowHours,
    L.summaryMaxItems, force ? FORCE_LIMIT : L.summaryBatch, force);
  const rows = rowsOf(r, 'summary claim');
  for (const row of rows) {
    ctx.dispatch(row.to_tg, async () => {
      const res = await notifier.summary(row);
      const outcome = ctx.outcome(res);
      if (outcome === 'ok') {
        stats.sent += 1;
        if (!force) await db.summaryMark(row.user_id, r.day, 'sent', now());
      } else if (outcome === 'failed') {
        // Blocked the bot, deleted their account, …: nothing more to do today.
        stats.failed += 1;
        if (!force) await db.summaryMark(row.user_id, r.day, 'failed', now());
      } else {
        // Stays claimed: a later run sends it once the claim is old enough.
        stats.retried += 1;
      }
    }, () => {});
  }
  // A forced run is one pass; otherwise go on while users are being handled.
  return force ? 0 : Number(r.processed) || 0;
}

/** The sender's summary work (sender.js tiers). */
export const SUMMARY_TIER = Object.freeze({ name: 'summary', run: summaryBatch });

/**
 * A sender run that sends only summaries (tests, and the test panel's "send now" with `force`).
 * @param {{db:any, notifier:any, now?:()=>number, sleep?:(ms:number)=>Promise<void>, log?:(m:string)=>void,
 *          force?:boolean}} deps
 * @returns {Promise<{sent:number, failed:number, retried:number, stopped:boolean}>}
 */
export async function runSummaries(deps) {
  const stats = await runSender({ ...deps, tiers: [SUMMARY_TIER], only: ['summary'] });
  return { ...stats.summary, stopped: stats.stopped };
}
