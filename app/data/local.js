/**
 * LocalBackend: the plain-browser test mode. It runs the SAME action
 * pipeline as the gateway (_shared/actions.js: validation → rules → views →
 * notifications) over the local engine (a mirror of the SQL functions) and a
 * fake Telegram whose messages go to a per-user inbox shown in the test
 * panel. The bot's real wording is server-only, so the inbox holds short
 * stand-ins (demo-messages.js) with the same buttons. Data lives in this
 * browser's localStorage only.
 *
 * Test controls (used only by the test panel): switch between fake users,
 * move the clock forward (the 5-minute timer — reminders, lapsed
 * confirmations, alerts, the 08:00 summary — is replayed for the skipped
 * time), send the daily summary right now, press the
 * buttons of a bot message (Proceed / Decline / «خاموش کن» run exactly as in
 * Telegram; "open" buttons open the request), toggle a user's Telegram privacy restriction, ban or unban
 * a user (as an admin would in the bot), simulate a new person arriving
 * through the current user's invite link, read a user's bot inbox, reset
 * everything.
 */

import { CONFIG } from '../../supabase/functions/_shared/config.js?v=0.6.1';
import { AppError } from '../../supabase/functions/_shared/errors.js?v=0.6.1';
import { createActions, runReminders, runMatchExpiries } from '../../supabase/functions/_shared/actions.js?v=0.6.1';
import { runAlertQueue } from '../../supabase/functions/_shared/alerts.js?v=0.6.1';
import { runSummaries } from '../../supabase/functions/_shared/summary.js?v=0.6.1';
import { createMatchButtons } from '../../supabase/functions/_shared/match-buttons.js?v=0.6.1';
import { createNotifier } from '../../supabase/functions/_shared/notify.js?v=0.6.1';
import { DEMO_MESSAGES, DEMO_BUTTON_TEXTS } from './demo-messages.js?v=0.6.1';
import { BackendBase } from './backend.js?v=0.6.1';
import { createEngine, emptyStore } from './local-engine.js?v=0.6.1';
import { createFakeTelegram } from './fake-telegram.js?v=0.6.1';
import { seedDemo, seedColleagues, COLLEAGUE_IDS } from './demo.js?v=0.6.1';

const STORAGE_KEY = 'paskeshik.local.v1';
// Bump when the saved shape changes; older saved data is replaced by fresh demo data.
const STATE_VERSION = 3;
// The production timer runs every 5 minutes; test mode replays it at this step.
const TIMER_STEP_MINUTES = 5;
// Fake Telegram ids for people "arriving" through invite links.
const FIRST_INVITEE_ID = 3001;
const INBOX_LIMIT = 50;

/**
 * localStorage that never throws (private mode, quota): falls back to memory.
 */
function safeStorage() {
  const memory = new Map();
  return {
    get(key) {
      try {
        return window.localStorage.getItem(key);
      } catch {
        return memory.get(key) ?? null;
      }
    },
    set(key, value) {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        memory.set(key, value);
      }
    },
  };
}

export class LocalBackend extends BackendBase {
  /**
   * @param {{storage?:{get:(k:string)=>string|null, set:(k:string,v:string)=>void}}} [options]
   */
  constructor({ storage = safeStorage() } = {}) {
    super();
    this.kind = 'local';
    this.storage = storage;
    /** @type {Promise<any>[]} */
    this.deferred = [];
    this.state = this.load() ?? this.freshState();
    this.wire();
  }

  /** A brand-new state with demo data and the owner not yet registered. */
  freshState() {
    const store = emptyStore();
    seedDemo(createEngine(store), Date.now());
    return {
      version: STATE_VERSION,
      nextInviteeTg: FIRST_INVITEE_ID,
      store,
      clockOffsetMs: 0,
      currentTg: CONFIG.demo.ownTelegramId,
      writeAccess: {},
      privacy: {},
      inbox: {},
      nextMessageId: 1,
    };
  }

  /** Reads saved state (null when absent or unreadable). */
  load() {
    try {
      const raw = this.storage.get(STORAGE_KEY);
      const state = raw ? JSON.parse(raw) : null;
      return state?.version === STATE_VERSION ? state : null;
    } catch {
      return null;
    }
  }

  /** Persists state. */
  save() {
    this.storage.set(STORAGE_KEY, JSON.stringify(this.state));
  }

  /** (Re)creates the engine, fake Telegram and action pipeline over the current state. */
  wire() {
    const state = this.state;
    this.engine = createEngine(state.store);
    state.nextMessageId ??= 1;
    /** Telegram buttons → what the inbox keeps (text, callback data, request to open). */
    const keep = (buttons) => buttons.map((b) => ({
      text: b.text,
      data: b.callback_data ?? null,
      request: b.web_app?.url ? Number(new URL(b.web_app.url).searchParams.get('request')) || null : null,
      app: Boolean(b.web_app),
    }));
    const telegram = createFakeTelegram({
      // The bot can message people who pressed Start or allowed it.
      canMessage: (tg) => Boolean(state.store.botContacts[tg] || state.writeAccess[tg]),
      isPrivacyRestricted: (tg) => Boolean(state.privacy[tg]),
      firstMessageId: state.nextMessageId,
      onMessage: (tg, text, buttons, messageId) => {
        state.nextMessageId = messageId + 1;
        const box = (state.inbox[tg] ??= []);
        box.unshift({ id: messageId, at: this.now(), text, buttons: keep(buttons) });
        box.length = Math.min(box.length, INBOX_LIMIT);
      },
      onEdit: (tg, messageId, text, buttons) => {
        const m = (state.inbox[tg] ?? []).find((x) => x.id === messageId);
        if (!m) return;
        if (text !== null) m.text = text;
        if (buttons !== null) m.buttons = keep(buttons);
      },
    });
    this.telegram = telegram;
    this.notifier = createNotifier(telegram, DEMO_MESSAGES);
    this.actions = createActions({
      db: this.engine,
      notifier: this.notifier,
      defer: (p) => this.deferred.push(p),
      // Alerts are sent right after each action (see settle()).
    });
    this.matchButtons = createMatchButtons({ actions: this.actions, api: telegram, texts: DEMO_BUTTON_TEXTS, now: () => this.now() });
  }

  /**
   * What the server does after answering, done at once here: pending
   * notifications, then one tick of the 5-minute timer's work (reminders,
   * lapsed confirmations, the daily summary from 08:00) and the alert sender.
   */
  async settle() {
    await Promise.all(this.deferred.splice(0));
    await runReminders({ db: this.engine, notifier: this.notifier, now: this.now() });
    await runMatchExpiries({ db: this.engine, notifier: this.notifier, now: this.now() });
    await runAlertQueue({ db: this.engine, notifier: this.notifier, now: () => this.now(), sleep: async () => {} });
    await runSummaries({ db: this.engine, notifier: this.notifier, now: () => this.now(), sleep: async () => {} });
  }

  /** The app's clock (real time plus the test panel's offset). */
  now() {
    return Date.now() + this.state.clockOffsetMs;
  }

  /**
   * Runs an action as the current fake user, exactly as the gateway would
   * after verifying initData.
   * @param {string} action
   * @param {object} [body]
   */
  async call(action, body = {}) {
    // Round-trip through JSON, like the network would.
    const wire = JSON.parse(JSON.stringify(body));
    const res = await this.actions[action]({ tg: this.state.currentTg, allowsWriteToPm: false, body: wire, now: this.now() });
    await this.settle();
    if (res.ok && action === 'signup' && this.state.currentTg === CONFIG.demo.ownTelegramId) {
      seedColleagues(this.engine, res.data.profile, this.now());
    }
    this.save();
    if (!res.ok) throw new AppError(res.error);
    return res.data;
  }

  /* ---------------- test controls ---------------- */

  /**
   * Presses a button of a bot message in the current user's inbox, as they
   * would in Telegram. Proceed / Decline run the same handler as the bot;
   * an "open" button returns the request to open (or 0 for the app itself).
   * @param {number} messageId
   * @param {number} index position of the button in the message
   * @returns {Promise<{open?:number, ok?:boolean, error?:string}>}
   */
  async pressButton(messageId, index) {
    const tg = this.state.currentTg;
    const m = (this.state.inbox[tg] ?? []).find((x) => x.id === messageId);
    const b = m?.buttons[index];
    if (!b) return { ok: false };
    if (b.app) return { open: b.request ?? 0 };
    if (!b.data || !this.matchButtons.handles(b.data)) return { ok: false };
    const res = await this.matchButtons.handle({
      id: `local-${messageId}-${index}`,
      from: { id: tg, is_bot: false },
      message: { message_id: messageId, chat: { id: tg, type: 'private' }, text: m.text },
      data: b.data,
    });
    await this.settle();
    this.save();
    return res;
  }

  /** Simulates the user allowing the bot to message them. */
  grantWriteAccess() {
    this.state.writeAccess[this.state.currentTg] = true;
    this.save();
  }

  /** Current fake user's Telegram id. */
  get currentTg() {
    return this.state.currentTg;
  }

  /**
   * Everyone the test panel can switch to: the owner first, then the owner's
   * colleagues, then the demo users.
   */
  users() {
    const own = CONFIG.demo.ownTelegramId;
    const list = this.state.store.users.map((u) => ({
      tg: u.tg_id,
      name: `${u.first_name} ${u.last_name}`,
      major: u.major,
      universityId: u.university_id,
      city: u.city,
      registered: true,
    }));
    if (!list.some((u) => u.tg === own)) list.push({ tg: own, name: '', registered: false });
    const rank = (u) => (u.tg === own ? 0 : COLLEAGUE_IDS.includes(u.tg) ? 1 : 2);
    return list.sort((a, b) => rank(a) - rank(b) || a.tg - b.tg);
  }

  /** @param {number} tg */
  switchUser(tg) {
    this.state.currentTg = tg;
    this.save();
  }

  /**
   * Moves the clock forward, replaying the timer every 5 minutes of the
   * skipped time so reminders, "didn't go ahead" notices and alerts arrive
   * as they would in production.
   * @param {number} minutes
   */
  async advanceClock(minutes) {
    for (let done = 0; done < minutes; done += TIMER_STEP_MINUTES) {
      this.state.clockOffsetMs += Math.min(TIMER_STEP_MINUTES, minutes - done) * 60000;
      await this.settle();
    }
    this.save();
  }

  /**
   * A brand-new person opens the current user's invite link, presses Start
   * (credited exactly as the bot would) and signs up. Returns false when the
   * current user isn't registered.
   */
  async simulateInvitee() {
    const info = this.engine.inviteInfo(this.state.currentTg);
    if (!info.ok) return false;
    const inviter = this.engine.me(this.state.currentTg).user;
    const tg = this.state.nextInviteeTg++;
    this.engine.noteBotStart(tg, this.now(), info.code);
    // …and finishes sign-up (same major and university), which unlocks the
    // inviter's alerts the first time, with the bot's message.
    const n = tg - FIRST_INVITEE_ID;
    const d = CONFIG.demo;
    const r = this.engine.signup(tg, d.firstNames[n % d.firstNames.length], d.lastNames[(n + 3) % d.lastNames.length],
      inviter.major, inviter.university_id, inviter.city, this.now());
    if (r.unlocked) await this.notifier.alertsUnlocked(r.unlocked.tg);
    this.save();
    return true;
  }

  /**
   * The test panel's "send the 08:00 summary now": everyone due a summary
   * gets it at once, whatever the time, without using up today's (the real
   * 08:00 run still happens). Returns how many were sent.
   */
  async sendSummaryNow() {
    const stats = await runSummaries({
      db: this.engine, notifier: this.notifier, now: () => this.now(), sleep: async () => {}, force: true,
    });
    this.save();
    return stats.sent;
  }

  resetClock() {
    this.state.clockOffsetMs = 0;
    this.save();
  }

  /** @param {number} tg */
  inbox(tg) {
    return this.state.inbox[tg] ?? [];
  }

  /** @param {number} tg */
  banned(tg) {
    return this.engine.isBanned(tg);
  }

  /**
   * Bans or unbans a registered user exactly as an admin would in the bot
   * (same rules: open requests cancelled, pending offers voided). Returns
   * false when the user isn't registered.
   * @param {number} tg
   * @param {boolean} on
   */
  setBanned(tg, on) {
    const user = this.state.store.users.find((u) => u.tg_id === tg);
    if (!user) return false;
    // Actor 0 stands for "the test panel"; no owner in test mode.
    if (on) this.engine.adminBan(0, user.id, null, this.now());
    else this.engine.adminUnban(0, user.id, this.now());
    this.save();
    return true;
  }

  /** @param {number} tg */
  privacyRestricted(tg) {
    return Boolean(this.state.privacy[tg]);
  }

  /** @param {number} tg @param {boolean} on */
  setPrivacyRestricted(tg, on) {
    this.state.privacy[tg] = Boolean(on);
    this.save();
  }

  /** Wipes everything and re-creates the demo data. */
  reset() {
    this.state = this.freshState();
    this.wire();
    this.save();
  }
}
