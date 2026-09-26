/**
 * diag.html: a permanent on-screen diagnostics page for the owner. Each
 * check shows its result in green/red on screen (never only in a console):
 * release version, telegram-web-app.js status, platform and Telegram
 * version, initData presence and length (never its content), gateway URL,
 * the health call (database, bot token), the me call, and webhook status.
 */

import { CONFIG } from '../supabase/functions/_shared/config.js?v=0.6.1';
import { fill } from '../supabase/functions/_shared/text.js?v=0.6.1';
import { errorText } from '../supabase/functions/_shared/errors.js?v=0.6.1';
import { formatDateTime } from '../supabase/functions/_shared/time.js?v=0.6.1';
import { toFaDigits } from '../supabase/functions/_shared/persian.js?v=0.6.1';
import { createTelegram } from './telegram.js?v=0.6.1';
import { applyTheme } from './theme.js?v=0.6.1';
import { h, replace } from './ui/dom.js?v=0.6.1';

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

/** Runs every check and draws the page. */
async function run() {
  const root = document.getElementById('app');
  const tg = createTelegram();
  applyTheme(tg);
  tg.ready();
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
        h('button', { class: 'btn primary', type: 'button', onClick: () => run() }, D.rerun),
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

  // Health (no initData needed).
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
    }
  } catch (e) {
    add(row(D.health, `${D.fail} — ${errorText('network')} (${e?.name ?? ''})`, 'fail'));
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

run();
