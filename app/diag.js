/**
 * diag.html: a permanent on-screen diagnostics page for the owner. Each
 * check shows its result in green/red on screen (never only in a console):
 * release version, telegram-web-app.js status, platform and Telegram
 * version, initData presence and length (never its content), gateway URL,
 * the health call (database, bot token, the reminders timer and when it last
 * ran successfully — red after timing.timerStaleMinutes — and the last
 * successful daily backup — red after timing.backupStaleHours), the me
 * call, and webhook status. When the health call fails, the rows it answers say
 * «نامعلوم» instead of disappearing.
 */

import { CONFIG } from '../supabase/functions/_shared/config.js?v=1.2.6';
import { fill } from '../supabase/functions/_shared/text.js?v=1.2.6';
import { errorText } from '../supabase/functions/_shared/errors.js?v=1.2.6';
import { formatDateTime } from '../supabase/functions/_shared/time.js?v=1.2.6';
import { toFaDigits } from '../supabase/functions/_shared/persian.js?v=1.2.6';
import { createTelegram } from './telegram.js?v=1.2.6';
import { followTheme } from './theme.js?v=1.2.6';
import { h, replace } from './ui/dom.js?v=1.2.6';

const D = CONFIG.text.diag;

/**
 * One result row.
 * @param {string} label
 * @param {string} value
 * @param {'ok'|'fail'|'muted'|''} [state]
 * @param {boolean} [ltr] show value left-to-right (URLs, versions)
 */
function row(label, value, state = '', ltr = false) {
  return h('div', { class: 'diag-row' },
    h('span', { class: 'k' }, label),
    h('span', { class: `v ${state}${ltr ? ' ltr' : ''}` }, value));
}

/**
 * When the 5-minute timer last did its work (health's timerLastOk), measured
 * on the server's clock: green while recent, red once older than
 * timing.timerStaleMinutes or never; «نامعلوم» from a server that doesn't say.
 * @param {any} data the health answer
 */
function timerRow(data) {
  if (!('timerLastOk' in data)) return row(D.timerLastOk, D.unknown, 'muted');
  const last = data.timerLastOk;
  if (last === null || !Number.isFinite(Number(last))) return row(D.timerLastOk, D.timerNever, 'fail');
  const serverNow = Number.isFinite(Number(data.time)) ? Number(data.time) : Date.now();
  const minutes = Math.max(0, Math.floor((serverNow - Number(last)) / 60000));
  const time = formatDateTime(Number(last));
  const text = minutes < 1 ? fill(D.timerJustNow, { time }) : fill(D.timerAgo, { time, minutes: toFaDigits(minutes) });
  return row(D.timerLastOk, text, minutes <= CONFIG.timing.timerStaleMinutes ? 'ok' : 'fail');
}

/**
 * When the daily backup last succeeded (health's backupLastOk), on the
 * server's clock: green while within timing.backupStaleHours, red when
 * older or never; «نامعلوم» from a server that doesn't say.
 * @param {any} data the health answer
 */
function backupRow(data) {
  if (!('backupLastOk' in data)) return row(D.backupLastOk, D.unknown, 'muted');
  const last = data.backupLastOk;
  if (last === null || !Number.isFinite(Number(last))) return row(D.backupLastOk, D.backupNever, 'fail');
  const serverNow = Number.isFinite(Number(data.time)) ? Number(data.time) : Date.now();
  const hours = Math.max(0, Math.floor((serverNow - Number(last)) / 3600000));
  const time = formatDateTime(Number(last));
  const text = hours < 1 ? fill(D.backupJustNow, { time }) : fill(D.backupAgo, { time, hours: toFaDigits(hours) });
  return row(D.backupLastOk, text, serverNow - Number(last) <= CONFIG.timing.backupStaleHours * 3600000 ? 'ok' : 'fail');
}

/**
 * Fetches with a timeout; resolves to { status, json } or throws.
 * @param {string} url
 * @param {RequestInit} init
 */
async function fetchJson(url, init) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONFIG.timing.requestTimeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal, credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer' });
    return { status: res.status, json: await res.json().catch(() => null) };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Runs every check and draws the page.
 * @param {ReturnType<typeof createTelegram>} tg
 */
async function run(tg) {
  const root = document.getElementById('app');
  const gateway = CONFIG.app.gatewayUrl;
  const list = h('div');
  const pending = h('p', { class: 'hint' }, D.running);

  replace(root,
    h('header', { class: 'topbar' }, h('h1', { class: 'title' }, CONFIG.text.screens.diag)),
    h('main', { class: 'content' },
      h('p', { class: 'hint' }, D.intro),
      list,
      pending,
      h('div', { class: 'actions' },
        h('button', { class: 'btn primary', type: 'button', onClick: () => run(tg) }, D.rerun),
        h('a', { class: 'btn', href: './' }, D.openApp))));

  const add = (...rows) => list.append(...rows);
  add(row(D.version, CONFIG.version, '', true));
  add(row(D.telegramScript,
    window.Telegram?.WebApp ? D.scriptReal : tg.placeholder ? D.scriptPlaceholder : D.scriptMissing,
    window.Telegram?.WebApp ? 'ok' : 'fail'));
  add(row(D.platform, tg.platform, '', true));
  add(row(D.telegramVersion, tg.version || '—', '', true));
  add(row(D.initData, tg.initData ? fill(D.initDataPresent, { n: tg.initData.length }) : D.initDataAbsent, tg.initData ? 'ok' : 'muted'));
  add(row(D.gateway, gateway || D.notSet, gateway ? '' : 'fail', Boolean(gateway)));

  if (!gateway) {
    add(row(D.health, D.needsGateway, 'muted'), row(D.me, D.needsGateway, 'muted'), row(D.webhook, D.needsGateway, 'muted'));
    pending.remove();
    return;
  }

  // Health (no initData needed). When it fails, what it would have told is unknown.
  const unknown = () => add(...[D.database, D.botToken, D.reminders, D.timerLastOk, D.backupLastOk, D.webhook].map((label) => row(label, D.unknown, 'muted')));
  try {
    const { status, json } = await fetchJson(`${gateway}?action=health`, { method: 'GET' });
    const data = json?.data;
    if (json?.ok && data) {
      add(row(D.health, `${D.ok} — ${data.version}`, data.version === CONFIG.version ? 'ok' : 'fail'));
      add(row(D.database, data.database === 'ok' ? D.ok : D.fail, data.database === 'ok' ? 'ok' : 'fail'));
      add(row(D.botToken, data.botToken ? D.ok : D.fail, data.botToken ? 'ok' : 'fail'));
      if (data.reminders !== undefined && data.reminders !== null) {
        add(row(D.reminders, data.reminders ? D.remindersOn : D.remindersOff, data.reminders ? 'ok' : 'fail'));
      }
      add(timerRow(data));
      add(backupRow(data));
      const w = data.webhook;
      if (!w) add(row(D.webhook, D.skipped, 'muted'));
      else {
        const parts = [w.ok ? D.webhookOk : D.webhookWrong];
        if (Number.isFinite(w.pendingUpdates)) parts.push(fill(D.pendingUpdates, { n: w.pendingUpdates }));
        if (w.lastError) parts.push(fill(D.lastError, { error: `${w.lastError}${w.lastErrorDate ? ` (${formatDateTime(w.lastErrorDate)})` : ''}` }));
        if (w.error) parts.push(w.error);
        add(row(D.webhook, parts.join(' — '), w.ok ? 'ok' : 'fail'));
      }
    } else {
      add(row(D.health, `${D.fail} — HTTP ${toFaDigits(status)}`, 'fail'));
      unknown();
    }
  } catch (e) {
    add(row(D.health, `${D.fail} — ${errorText('network')} (${e?.name ?? ''})`, 'fail'));
    unknown();
  }

  // me (needs initData, so only inside Telegram).
  if (!tg.initData) {
    add(row(D.me, D.onlyInTelegram, 'muted'));
  } else {
    try {
      const { status, json } = await fetchJson(gateway, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-init-data': tg.initData },
        body: JSON.stringify({ action: 'me' }),
      });
      if (json?.ok) add(row(D.me, `${D.ok} — ${json.data.registered ? D.meRegistered : D.meNotRegistered}`, 'ok'));
      else add(row(D.me, `${D.fail} — ${errorText(json?.error ?? 'unknown')} (HTTP ${toFaDigits(status)})`, 'fail'));
    } catch (e) {
      add(row(D.me, `${D.fail} — ${errorText('network')} (${e?.name ?? ''})`, 'fail'));
    }
  }
  pending.remove();
}

const telegram = createTelegram();
followTheme(telegram);
telegram.ready();
run(telegram);
