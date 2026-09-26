/**
 * Sends queued new-request alerts (the invite reward) in the background, so
 * posting a request stays fast. The database chooses the recipients and
 * queues one row each (app.alert_queue) in the same transaction that posted
 * the request or put it back on the board; this module claims them in small
 * batches (skip locked, so two runs never send the same alert), sends each
 * one at Telegram's pace, and records the outcome. Alerts whose request left
 * the board meanwhile are skipped by the database at claim time.
 *
 * Runs after a request is posted or goes back on the board (in the api and
 * bot functions, after answering), and on every 5-minute timer call; in test
 * mode LocalBackend runs it after each action. Used in the browser too, so it
 * imports nothing platform-specific.
 */

import { CONFIG } from './config.js?v=0.6.1';
import { isTemporaryError } from './telegram-helpers.js?v=0.6.1';
import { rowsOf } from './errors.js?v=0.6.1';

/**
 * One run of the sender.
 * @param {{db:any, notifier:any, now?:()=>number, sleep?:(ms:number)=>Promise<void>, log?:(m:string)=>void}} deps
 *   sleep — pause between messages (Telegram asks bots to stay under ~30/s); tests and test mode pass a no-op
 * @returns {Promise<{sent:number, failed:number, stopped:boolean}>}
 */
export async function runAlertQueue({
  db, notifier, now = Date.now, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), log = () => {},
}) {
  const L = CONFIG.limits;
  const deadline = now() + CONFIG.timing.alertRunSeconds * 1000;
  const gap = Math.ceil(1000 / L.alertPerSecond);
  const stats = { sent: 0, failed: 0, stopped: false };
  while (!stats.stopped && now() < deadline) {
    const rows = rowsOf(await db.alertClaim(now(), L.alertBatch), 'alert claim');
    if (!rows.length) break;
    for (const row of rows) {
      if (stats.stopped || now() >= deadline) {
        // Hand the rest of the batch back for the next run.
        await db.alertMark(row.id, 'queued', now());
        continue;
      }
      const res = await notifier.alert(row);
      if (res.ok) {
        stats.sent += 1;
        await db.alertMark(row.id, 'sent', now());
      } else if (isTemporaryError(res)) {
        // Flood limit or network trouble: stop and let the next run retry.
        stats.stopped = true;
        await db.alertMark(row.id, 'queued', now());
      } else {
        // Blocked the bot, deleted their account, …: nothing more to do.
        stats.failed += 1;
        await db.alertMark(row.id, 'failed', now());
      }
      await sleep(gap);
    }
  }
  if (stats.stopped) log('alert run paused by a temporary Telegram error');
  return stats;
}
