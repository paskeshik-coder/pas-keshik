/**
 * Sends the 08:00 daily summary in the background. The 5-minute database
 * timer calls this on every run; before config.timing.summaryHour (Tehran
 * time) the database answers "nothing to do" in one cheap call. From that
 * hour on, the database claims users in small batches (skip locked, so two
 * runs never pick the same person), records each one for today's Tehran
 * date — 'empty' when there is nothing new for them, so nothing is sent —
 * and returns the others with their requests. This module sends each
 * summary at Telegram's pace and records the outcome, so everyone gets at
 * most one summary a day.
 *
 * A summary claimed but not sent (the run hit its time limit, or Telegram
 * asked us to slow down) stays 'claimed'; the database treats a claim older
 * than 10 minutes as unhandled, so a later timer run sends it.
 *
 * In test mode LocalBackend runs it whenever its clock moves, and its test
 * panel's "send now" button runs it with `force` (ignores the hour and
 * records nothing). Used in the browser too, so it imports nothing
 * platform-specific.
 */

import { CONFIG } from './config.js?v=0.6.1';
import { isTemporaryError } from './telegram-helpers.js?v=0.6.1';
import { rowsOf } from './errors.js?v=0.6.1';

/** How many users a forced run (test panel only) takes in its single claim. */
const FORCE_LIMIT = 100000;

/**
 * One run of the sender.
 * @param {{db:any, notifier:any, now?:()=>number, sleep?:(ms:number)=>Promise<void>, log?:(m:string)=>void,
 *          force?:boolean}} deps
 *   sleep — pause between messages (Telegram asks bots to stay under ~30/s); tests and test mode pass a no-op
 *   force — the test panel's "send now": one pass over everyone, whatever the hour, nothing recorded
 * @returns {Promise<{sent:number, failed:number, stopped:boolean}>}
 */
export async function runSummaries({
  db, notifier, now = Date.now, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), log = () => {}, force = false,
}) {
  const T = CONFIG.timing;
  const L = CONFIG.limits;
  const deadline = now() + T.summaryRunSeconds * 1000;
  const gap = Math.ceil(1000 / L.summaryPerSecond);
  const stats = { sent: 0, failed: 0, stopped: false };
  while (!stats.stopped && now() < deadline) {
    const r = await db.claimSummaries(now(), T.tehranOffsetMinutes, T.summaryHour, T.summaryWindowHours,
      L.summaryMaxItems, force ? FORCE_LIMIT : L.summaryBatch, force);
    const rows = rowsOf(r, 'summary claim');
    for (const row of rows) {
      // Out of time or slowed down: the rest stay claimed and are retried later.
      if (stats.stopped || now() >= deadline) break;
      const res = await notifier.summary(row);
      if (res.ok) {
        stats.sent += 1;
        if (!force) await db.summaryMark(row.user_id, r.day, 'sent', now());
      } else if (isTemporaryError(res)) {
        // Flood limit or network trouble: stop and let a later run retry.
        stats.stopped = true;
      } else {
        // Blocked the bot, deleted their account, …: nothing more to do today.
        stats.failed += 1;
        if (!force) await db.summaryMark(row.user_id, r.day, 'failed', now());
      }
      await sleep(gap);
    }
    // A forced run is one pass; otherwise stop once nobody is left to claim.
    if (force || !Number(r.processed)) break;
  }
  if (stats.stopped) log('summary run paused by a temporary Telegram error');
  return stats;
}
