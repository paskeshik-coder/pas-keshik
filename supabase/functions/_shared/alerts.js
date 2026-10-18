/**
 * Sends queued new-request alerts (the invite reward) in the background, so
 * posting a request stays fast. The database chooses the recipients and
 * queues one row each (app.alert_queue) in the same transaction that posted
 * the request or put it back on the board; this module claims them in small
 * batches (skip locked, so two runs never send the same alert) and records
 * each outcome. Alerts whose request left the board meanwhile are skipped by
 * the database at claim time. An alert that got a temporary error (other
 * than a flood limit) waits before its next try, longer each time
 * (sender.js retryAt).
 *
 * Alerts are the third kind of work of the one background sender
 * (sender.js), after personal messages and reminders, at its shared pace.
 * Used in the browser too (LocalBackend), so it imports nothing
 * platform-specific.
 */

import { rowsOf } from './errors.js?v=1.2.6';
import { runSender } from './sender.js?v=1.2.6';

/**
 * One batch of alerts.
 * @param {any} ctx sender.js's run context
 * @returns {Promise<number>} how many were claimed
 */
async function alertBatch(ctx) {
  const { db, notifier, now, L } = ctx;
  const stats = ctx.stats.alerts;
  const rows = rowsOf(await db.alertClaim(now(), L.sendBatch), 'alert claim');
  for (const row of rows) {
    ctx.dispatch(row.to_tg, async () => {
      const res = await notifier.alert(row);
      const outcome = ctx.outcome(res);
      if (outcome === 'ok') {
        stats.sent += 1;
        return db.alertMark(row.id, 'sent', now());
      }
      if (outcome === 'failed') {
        // Blocked the bot, deleted their account, …: nothing more to do.
        stats.failed += 1;
        return db.alertMark(row.id, 'failed', now());
      }
      // A temporary error: tried again later, after a longer wait each time
      // (like the message queue), so an alert that keeps failing never fills
      // every run. A flood limit that says how long to wait (429 with
      // retry_after) is Telegram's pace for all messages, which the sender
      // already waits out for everyone (it pauses, or holds every run back
      // until then): the alert stays due as before.
      stats.retried += 1;
      const paced = res?.error_code === 429 && Number(res?.parameters?.retry_after) > 0;
      return db.alertMark(row.id, 'queued', now(), paced ? null : ctx.retryAt(row.attempts, res));
    }, () => db.alertMark(row.id, 'queued', now(), null));
  }
  return rows.length;
}

/** The sender's alert work (sender.js tiers). */
export const ALERT_TIER = Object.freeze({ name: 'alerts', run: alertBatch });

/**
 * A sender run that sends only alerts (tests).
 * @param {{db:any, notifier:any, now?:()=>number, sleep?:(ms:number)=>Promise<void>, log?:(m:string)=>void}} deps
 * @returns {Promise<{sent:number, failed:number, retried:number, stopped:boolean}>}
 */
export async function runAlertQueue(deps) {
  const stats = await runSender({ ...deps, tiers: [ALERT_TIER], only: ['alerts'] });
  return { ...stats.alerts, stopped: stats.stopped };
}
