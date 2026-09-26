/**
 * LocalBackend's engine: a line-by-line JavaScript mirror of the SQL
 * functions in supabase/migrations/*.sql that the app uses (plus banning, so
 * the test panel can show the banned screen, and the alert queue and
 * confirmation timer, so alerts and expiry can be tried with the test
 * panel's clock), working on a plain in-memory store (LocalBackend persists
 * it in localStorage). The bot's admin menu and broadcasts exist only on the
 * server.
 *
 * Same function names (camelCase), same parameters, same checks in the same
 * order, same error codes and the same raw result shapes (snake_case,
 * epoch-ms timestamps). tests/parity.test.js runs one scenario against this
 * engine and against real Postgres and requires identical results, so the
 * plain-browser test mode enforces exactly the rules production does.
 *
 * JavaScript is single-threaded, so the row locks of the SQL version have no
 * equivalent here; the check order still matches.
 */

/**
 * @typedef {object} Store
 * @property {{user:number, request:number, offer:number, arrangement:number, match:number, alert:number}} seq
 * @property {any[]} users
 * @property {Record<string, {started_at:number, last_seen_at:number, invited_by:number|null}>} botContacts
 * @property {any[]} requests
 * @property {any[]} offers
 * @property {any[]} arrangements
 * @property {any[]} matches confirmations (app.matches)
 * @property {any[]} alertQueue queued new-request alerts (app.alert_queue)
 * @property {Record<string, {status:string, claimed_at:number, sent_at:number|null}>} summariesSent
 *   "<userId>:<YYYY-MM-DD>" → the day's summary (app.summaries_sent)
 * @property {Record<string, {window_start:number, hits:number}>} rateLimits
 * @property {Record<string, number>} remindersSent "<arrangementId>:<kind>" → sent_at
 * @property {{user_id:number, banned_at:number, banned_by_tg:number, unbanned_at:number|null, unbanned_by_tg:number|null}[]} bans
 * @property {number[]} admins user ids
 * @property {{actor_tg:number, action:string, target:string|null, details:any, at:number}[]} auditLog
 */

/**
 * An empty store.
 * @returns {Store}
 */
export function emptyStore() {
  return {
    seq: { user: 0, request: 0, offer: 0, arrangement: 0, match: 0, alert: 0 },
    users: [],
    botContacts: {},
    requests: [],
    offers: [],
    arrangements: [],
    matches: [],
    alertQueue: [],
    summariesSent: {},
    rateLimits: {},
    remindersSent: {},
    bans: [],
    admins: [],
    auditLog: [],
  };
}

/**
 * app._new_invite_code: 12 random hex characters.
 */
function newInviteCode() {
  const bytes = new Uint8Array(6);
  globalThis.crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** @param {string} code */
function err(code) {
  return { ok: false, error: code };
}

/**
 * Creates the engine over a store (mutated in place).
 * @param {Store} store
 */
export function createEngine(store) {
  // Stores saved by older versions lack the newer tables and columns.
  store.bans ??= [];
  store.admins ??= [];
  store.auditLog ??= [];
  store.matches ??= [];
  store.alertQueue ??= [];
  store.summariesSent ??= {};
  store.seq.match ??= 0;
  store.seq.alert ??= 0;
  for (const u of store.users) {
    u.notify_alerts ??= true;
    if (u.alert_university === undefined) u.alert_university = u.university_id;
    u.alert_wards ??= null;
    u.alerts_unlocked_at ??= null;
    u.notify_summary ??= true;
  }

  const userByTg = (tg) => store.users.find((u) => u.tg_id === tg) ?? null;
  const userById = (id) => store.users.find((u) => u.id === id) ?? null;
  const requestById = (id) => store.requests.find((r) => r.id === id) ?? null;
  const offerById = (id) => store.offers.find((o) => o.id === id) ?? null;
  const arrangementById = (id) => store.arrangements.find((a) => a.id === id) ?? null;
  const matchById = (id) => store.matches.find((m) => m.id === id) ?? null;
  const nextId = (table) => {
    store.seq[table] += 1;
    return store.seq[table];
  };

  /** app.is_banned */
  const isBanned = (tg) => {
    const u = userByTg(tg);
    return Boolean(u && store.bans.some((b) => b.user_id === u.id && b.unbanned_at === null));
  };

  /** app.is_admin */
  const isAdmin = (tg) => {
    const u = userByTg(tg);
    return Boolean(u && store.admins.includes(u.id));
  };

  /** app._name */
  const name = (u) => `${u.first_name} ${u.last_name}`;

  /** app._profile */
  const profile = (u) => ({
    first_name: u.first_name, last_name: u.last_name, major: u.major, university_id: u.university_id, city: u.city,
  });

  /** app._notifications */
  const notifications = (u) => ({
    offers: u.notify_offers, arranged: u.notify_arranged, reminders: u.notify_reminders, alerts: u.notify_alerts,
    summary: u.notify_summary,
  });

  /** app._alerts */
  const alertSettings = (u) => ({ unlocked: u.alerts_unlocked_at !== null, university: u.alert_university, wards: u.alert_wards });

  /** app._request_json */
  const requestJson = (r) => ({
    id: r.id, university_id: r.university_id, major: r.major, ward: r.ward, place: r.place,
    start_at: r.start_at, end_at: r.end_at, price: r.price, status: r.status,
  });

  /** app._is_active */
  const isActive = (r, now) => (r.status === 'open' && r.start_at > now) || (r.status === 'arranged' && r.end_at > now);

  /** app._covering_overlap */
  const coveringOverlap = (userId, start, end, now) => store.arrangements.some((a) => {
    if (a.coverer_id !== userId || a.cancelled_at !== null) return false;
    const r = requestById(a.request_id);
    return r.end_at > now && r.start_at < end && start < r.end_at;
  });

  /** app._match_state */
  const matchState = (m, now) => {
    if (m.arrangement_id !== null) return 'arranged';
    if (m.ended_at !== null) return 'ended';
    if (m.step1_at === null) return now < m.step1_deadline ? 'step1' : 'expired';
    return now < m.step2_deadline ? 'step2' : 'expired';
  };

  /** app._match_active */
  const matchActive = (m, now) => ['step1', 'step2'].includes(matchState(m, now));

  /** app._match_expired_at */
  const matchExpiredAt = (m) => (m.step1_at === null ? m.step1_deadline : m.step2_deadline);

  /** app._has_active_match */
  const hasActiveMatch = (requestId, now) => store.matches.some((m) => m.request_id === requestId && matchActive(m, now));

  /** app._on_board */
  const onBoard = (r, now) => r.status === 'open' && r.start_at > now && !hasActiveMatch(r.id, now);

  /** app._pair_blocked */
  const pairBlocked = (requestId, covererId) => store.arrangements.some((a) => a.request_id === requestId && a.coverer_id === covererId)
    || store.matches.some((m) => m.request_id === requestId && m.coverer_id === covererId);

  /** app._step_deadline */
  const stepDeadline = (start, shiftStart, windowMinutes) => Math.min(start + windowMinutes * 60000, shiftStart);

  /** app._respond_error */
  const respondError = (user, req, now) => {
    if (!req) return 'request_not_found';
    if (req.city !== user.city || req.major !== user.major) return 'request_not_found';
    if (req.requester_id === user.id) return 'own_request';
    if (req.status === 'arranged') return 'request_taken';
    if (req.status !== 'open' || req.start_at <= now) return 'request_closed';
    if (hasActiveMatch(req.id, now)) return 'request_pending';
    if (pairBlocked(req.id, user.id)) return 'rematch_blocked';
    return null;
  };

  /** app._listed_at */
  const listedAt = (r, now) => Math.max(
    r.created_at,
    ...store.matches.filter((m) => m.request_id === r.id && ['ended', 'expired'].includes(matchState(m, now)))
      .map((m) => m.ended_at ?? matchExpiredAt(m)),
    ...store.arrangements.filter((a) => a.request_id === r.id && a.cancelled_at !== null && a.cancelled_at <= now)
      .map((a) => a.cancelled_at),
  );

  /** app._summary_items */
  const summaryItems = (u, now, hours, limit) => store.requests
    .filter((r) => r.city === u.city
      && r.major === u.major
      && r.requester_id !== u.id
      && onBoard(r, now)
      && listedAt(r, now) > now - hours * 3600000
      && (u.alert_university === null || u.alert_university === r.university_id)
      && (u.alert_wards === null || r.ward === null || u.alert_wards.includes(r.ward))
      && !coveringOverlap(u.id, r.start_at, r.end_at, now)
      && !pairBlocked(r.id, u.id)
      && !store.offers.some((o) => o.request_id === r.id && o.offerer_id === u.id && o.status === 'pending'))
    .sort((a, b) => a.start_at - b.start_at || a.id - b.id)
    .slice(0, limit)
    .map(requestJson);

  /** app._enqueue_alerts */
  const enqueueAlerts = (req, kind, now) => {
    if (!onBoard(req, now)) return 0;
    const targets = store.users
      .filter((u) => u.alerts_unlocked_at !== null
        && u.notify_alerts
        && u.city === req.city
        && u.major === req.major
        && u.id !== req.requester_id
        && (u.alert_university === null || u.alert_university === req.university_id)
        && (u.alert_wards === null || req.ward === null || u.alert_wards.includes(req.ward))
        && !isBanned(u.tg_id)
        && !coveringOverlap(u.id, req.start_at, req.end_at, now)
        && !pairBlocked(req.id, u.id)
        && !store.offers.some((o) => o.request_id === req.id && o.offerer_id === u.id && o.status === 'pending'))
      .sort((a, b) => a.id - b.id);
    for (const u of targets) {
      store.alertQueue.push({
        id: nextId('alert'), request_id: req.id, user_id: u.id, tg_id: u.tg_id, kind, created_at: now,
        status: 'queued', claimed_at: null, sent_at: null,
      });
    }
    return targets.length;
  };

  /** app._end_match */
  const endMatch = (m, reason, by, now) => {
    const step = m.step1_at === null ? 1 : 2;
    Object.assign(m, { ended_at: now, ended_by: by, end_reason: reason, notified_at: now });
    const req = requestById(m.request_id);
    enqueueAlerts(req, 'back', now);
    if (reason === 'removed' || reason === 'banned') return null;
    const requester = userById(m.requester_id);
    const coverer = userById(m.coverer_id);
    if (by === m.requester_id) {
      return {
        kind: 'match_ended', reason, step, to_tg: coverer.tg_id, to_role: 'coverer',
        other_name: step === 2 ? name(requester) : null, request: requestJson(req),
      };
    }
    return {
      kind: 'match_ended', reason, step, to_tg: requester.tg_id, to_role: 'requester',
      other_name: name(coverer), request: requestJson(req),
    };
  };

  /** app._start_match */
  const startMatch = (req, offerId, coverer, price, flow, now, windowMinutes) => {
    const m = {
      id: nextId('match'), request_id: req.id, offer_id: offerId, requester_id: req.requester_id, coverer_id: coverer.id,
      price, flow, created_at: now, step1_deadline: stepDeadline(now, req.start_at, windowMinutes), step1_at: null,
      step2_deadline: null, step2_at: null, arrangement_id: null, ended_at: null, ended_by: null, end_reason: null,
      notified_at: null,
    };
    store.matches.push(m);
    return m;
  };

  /** app._arrange */
  const arrange = (req, offerId, coverer, price, now) => {
    const requester = userById(req.requester_id);
    const arrangement = {
      id: nextId('arrangement'), request_id: req.id, offer_id: offerId, requester_id: req.requester_id,
      coverer_id: coverer.id, price, created_at: now, cancelled_at: null, cancelled_by: null,
    };
    store.arrangements.push(arrangement);
    // The SQL version describes the request as it was passed in (still open).
    const snapshot = requestJson(req);
    req.status = 'arranged';
    for (const o of store.offers) {
      if (o.request_id === req.id && o.status === 'pending' && o.id !== offerId) {
        Object.assign(o, { status: 'void', reason: 'arranged_other', settled_at: now });
      }
    }
    for (const o of store.offers) {
      if (o.offerer_id !== coverer.id || o.status !== 'pending' || o.request_id === req.id) continue;
      const r = requestById(o.request_id);
      if (r.status === 'open' && r.start_at > now && r.start_at < req.end_at && req.start_at < r.end_at) {
        Object.assign(o, { status: 'withdrawn', reason: 'overlap', settled_at: now });
      }
    }
    const ended = [];
    const overlapping = store.matches
      .filter((m) => {
        if (m.coverer_id !== coverer.id || m.request_id === req.id || !matchActive(m, now)) return false;
        const r = requestById(m.request_id);
        return r.start_at < req.end_at && req.start_at < r.end_at;
      })
      .sort((a, b) => a.id - b.id);
    for (const m of overlapping) {
      const notice = endMatch(m, 'withdrawn', coverer.id, now);
      if (notice) ended.push(notice);
    }
    return {
      ok: true,
      arrangement_id: arrangement.id,
      notify: {
        kind: 'arranged',
        price,
        request: snapshot,
        requester: { tg: requester.tg_id, name: name(requester), notify: requester.notify_arranged },
        coverer: { tg: coverer.tg_id, name: name(coverer), notify: coverer.notify_arranged },
      },
      ended,
    };
  };

  /**
   * Finds the user and match for a confirmation call, as the SQL functions
   * do before locking (null result = the error to return).
   */
  const matchFor = (tg, matchId, requesterOnly = false) => {
    const user = userByTg(tg);
    if (!user) return { error: err('not_registered') };
    const m = matchById(matchId);
    if (!m || (requesterOnly ? user.id !== m.requester_id : user.id !== m.requester_id && user.id !== m.coverer_id)) {
      return { error: err('match_not_found') };
    }
    return { user, m };
  };

  return {
    /** app.me */
    me(tg) {
      const u = userByTg(tg);
      return {
        ok: true,
        user: u ? profile(u) : null,
        notifications: u ? notifications(u) : null,
        alerts: u ? alertSettings(u) : null,
        bot_started: Boolean(store.botContacts[tg]),
        banned: isBanned(tg),
      };
    },

    /** app.is_banned */
    isBanned(tg) {
      return isBanned(tg);
    },

    /** app.admin_ban */
    adminBan(actorTg, userId, ownerTg, now) {
      const v = userById(userId);
      if (!v) return err('user_not_found');
      if (v.tg_id === ownerTg) return err('cannot_ban_owner');
      if (isAdmin(v.tg_id)) return err('cannot_ban_admin');
      if (isBanned(v.tg_id)) return err('already_banned');
      store.bans.push({ user_id: v.id, banned_at: now, banned_by_tg: actorTg, unbanned_at: null, unbanned_by_tg: null });
      const theirs = store.matches
        .filter((m) => (m.requester_id === v.id || m.coverer_id === v.id) && matchActive(m, now))
        .sort((a, b) => a.id - b.id);
      for (const m of theirs) endMatch(m, 'banned', null, now);
      for (const o of store.offers) {
        const r = requestById(o.request_id);
        if (r.requester_id === v.id && r.status === 'open' && o.status === 'pending') {
          Object.assign(o, { status: 'void', reason: 'request_cancelled', settled_at: now });
        }
      }
      let requests = 0;
      for (const r of store.requests) {
        if (r.requester_id === v.id && r.status === 'open') {
          Object.assign(r, { status: 'cancelled', cancelled_at: now });
          requests += 1;
        }
      }
      let offers = 0;
      for (const o of store.offers) {
        if (o.offerer_id === v.id && o.status === 'pending') {
          Object.assign(o, { status: 'void', reason: 'banned', settled_at: now });
          offers += 1;
        }
      }
      store.auditLog.push({
        actor_tg: actorTg, action: 'ban', target: String(v.id), details: { requests_cancelled: requests, offers_voided: offers }, at: now,
      });
      return { ok: true, requests_cancelled: requests, offers_voided: offers };
    },

    /** app.admin_unban */
    adminUnban(actorTg, userId, now) {
      const active = store.bans.filter((b) => b.user_id === userId && b.unbanned_at === null);
      if (!active.length) return err('not_banned');
      for (const b of active) Object.assign(b, { unbanned_at: now, unbanned_by_tg: actorTg });
      store.auditLog.push({ actor_tg: actorTg, action: 'unban', target: String(userId), details: {}, at: now });
      return { ok: true };
    },

    /** app.signup */
    signup(tg, first, last, major, university, city, now) {
      let u = userByTg(tg);
      const created = !u;
      let inviter = null;
      if (!u) {
        u = {
          id: nextId('user'), tg_id: tg, first_name: first, last_name: last, major, university_id: university,
          city, rules_accepted_at: now, created_at: now, updated_at: now,
          invite_code: newInviteCode(), invited_by: store.botContacts[tg]?.invited_by ?? null,
          notify_offers: true, notify_arranged: true, notify_reminders: true,
          notify_alerts: true, alert_university: university, alert_wards: null, alerts_unlocked_at: null, notify_summary: true,
        };
        store.users.push(u);
        if (u.invited_by !== null) {
          const candidate = userById(u.invited_by);
          if (candidate && candidate.alerts_unlocked_at === null) {
            candidate.alerts_unlocked_at = now;
            inviter = candidate;
          }
        }
      }
      return { ok: true, created, user: profile(u), unlocked: inviter ? { tg: inviter.tg_id } : null };
    },

    /** app.note_bot_start */
    noteBotStart(tg, now, inviteCode) {
      const existing = store.botContacts[tg];
      const isNew = !existing && !userByTg(tg);
      const inviter = isNew && inviteCode !== null ? store.users.find((u) => u.invite_code === inviteCode) ?? null : null;
      const credited = Boolean(inviter && inviter.tg_id !== tg);
      store.botContacts[tg] = existing
        ? { ...existing, last_seen_at: now }
        : { started_at: now, last_seen_at: now, invited_by: credited ? inviter.id : null };
      return { ok: true, credited };
    },

    /** app.invite_info */
    inviteInfo(tg) {
      const user = userByTg(tg);
      if (!user) return err('not_registered');
      const count = Object.values(store.botContacts).filter((c) => c.invited_by === user.id).length;
      const joined = store.users.filter((u) => u.invited_by === user.id).length;
      return { ok: true, code: user.invite_code, count, joined, unlocked: user.alerts_unlocked_at !== null };
    },

    /** app.set_notifications */
    setNotifications(tg, offers, arranged, reminders, alerts, summary, now) {
      const user = userByTg(tg);
      if (!user) return err('not_registered');
      Object.assign(user, {
        notify_offers: offers, notify_arranged: arranged, notify_reminders: reminders, notify_alerts: alerts,
        notify_summary: summary, updated_at: now,
      });
      return { ok: true, notifications: notifications(user) };
    },

    /** app.set_summary */
    setSummary(tg, on, now) {
      const user = userByTg(tg);
      if (!user) return err('not_registered');
      Object.assign(user, { notify_summary: on, updated_at: now });
      return { ok: true, notifications: notifications(user) };
    },

    /** app.claim_summaries */
    claimSummaries(now, tzOffsetMin, hour, hours, items, limit, force) {
      const local = new Date(now + tzOffsetMin * 60000);
      const day = local.toISOString().slice(0, 10);
      const rows = [];
      if (!force && local.getUTCHours() < hour) return { ok: true, day, processed: 0, rows };
      const handled = (u) => {
        const s = store.summariesSent[`${u.id}:${day}`];
        return Boolean(s) && !(s.status === 'claimed' && s.claimed_at < now - 600000);
      };
      const due = store.users
        .filter((u) => u.alerts_unlocked_at === null && u.notify_summary && !isBanned(u.tg_id) && (force || !handled(u)))
        .sort((a, b) => a.id - b.id)
        .slice(0, limit);
      for (const u of due) {
        const list = summaryItems(u, now, hours, items);
        if (!force) store.summariesSent[`${u.id}:${day}`] = { status: list.length ? 'claimed' : 'empty', claimed_at: now, sent_at: null };
        if (list.length) rows.push({ user_id: u.id, to_tg: u.tg_id, items: list });
      }
      return { ok: true, day, processed: due.length, rows };
    },

    /** app.summary_mark */
    summaryMark(userId, day, status, now) {
      const s = store.summariesSent[`${userId}:${day}`];
      if (s) {
        s.status = status;
        if (status === 'sent') s.sent_at = now;
      }
      return { ok: true };
    },

    /** app.set_alert_filters */
    setAlertFilters(tg, university, wards, now) {
      const user = userByTg(tg);
      if (!user) return err('not_registered');
      Object.assign(user, { alert_university: university, alert_wards: wards, updated_at: now });
      return { ok: true, alerts: alertSettings(user) };
    },

    /** app.update_profile */
    updateProfile(tg, first, last, major, university, city, now) {
      const user = userByTg(tg);
      if (!user) return err('not_registered');
      let voided = 0;
      if (user.major !== major || user.university_id !== university) {
        if (store.requests.some((r) => r.requester_id === user.id && isActive(r, now))
          || store.matches.some((m) => m.coverer_id === user.id && matchActive(m, now))) {
          return err('profile_change_blocked');
        }
        for (const o of store.offers) {
          if (o.offerer_id === user.id && o.status === 'pending') {
            Object.assign(o, { status: 'void', reason: 'profile_changed', settled_at: now });
            voided += 1;
          }
        }
      }
      Object.assign(user, {
        first_name: first, last_name: last,
        alert_university: user.alert_university === null ? null : university,
        alert_wards: user.major === major ? user.alert_wards : null,
        major, university_id: university, city, updated_at: now,
      });
      return { ok: true, user: profile(user), voided };
    },

    /** app.claim_reminders */
    claimReminders(now, kinds, graceMinutes) {
      const rows = [];
      for (const a of store.arrangements) {
        if (a.cancelled_at !== null) continue;
        const r = requestById(a.request_id);
        const coverer = userById(a.coverer_id);
        if (!coverer.notify_reminders || r.start_at <= now) continue;
        for (const k of kinds) {
          const at = r.start_at - k.minutes * 60000;
          const key = `${a.id}:${k.key}`;
          if (at <= now && now < at + graceMinutes * 60000 && a.created_at <= at && !(key in store.remindersSent)) {
            store.remindersSent[key] = now;
            rows.push({ a, r, coverer, kind: k.key });
          }
        }
      }
      rows.sort((x, y) => x.r.start_at - y.r.start_at || x.a.id - y.a.id || (x.kind < y.kind ? -1 : x.kind > y.kind ? 1 : 0));
      return {
        ok: true,
        rows: rows.map(({ a, r, coverer, kind }) => ({
          kind, to_tg: coverer.tg_id, requester_name: name(userById(a.requester_id)), request: requestJson(r),
        })),
      };
    },

    /** app.create_request */
    createRequest(tg, ward, place, start, end, price, now, maxActive, tzOffsetMin) {
      const user = userByTg(tg);
      if (!user) return err('not_registered');
      if (end <= start) return err('end_before_start');
      if (start <= now) return err('start_in_past');
      const active = store.requests.filter((r) => r.requester_id === user.id && isActive(r, now));
      if (active.length >= maxActive) return err('too_many_active');
      const day = (ms) => new Date(ms + tzOffsetMin * 60000).toISOString().slice(0, 10);
      if (active.some((r) => day(r.start_at) === day(start))) return err('same_day_active');
      const req = {
        id: nextId('request'), requester_id: user.id, major: user.major, city: user.city,
        university_id: user.university_id, ward, place, start_at: start, end_at: end, price,
        status: 'open', created_at: now, cancelled_at: null,
      };
      store.requests.push(req);
      return { ok: true, request_id: req.id, alerts: enqueueAlerts(req, 'new', now) };
    },

    /** app.cancel_request */
    cancelRequest(tg, requestId, now) {
      const user = userByTg(tg);
      if (!user) return err('not_registered');
      const req = requestById(requestId);
      if (!req || req.requester_id !== user.id) return err('request_not_found');
      if (req.status === 'arranged' && req.start_at > now) return err('request_arranged');
      if (req.status !== 'open' || req.start_at <= now) return err('request_closed');
      if (hasActiveMatch(req.id, now)) return err('match_pending');
      req.status = 'cancelled';
      req.cancelled_at = now;
      for (const o of store.offers) {
        if (o.request_id === req.id && o.status === 'pending') {
          Object.assign(o, { status: 'void', reason: 'request_cancelled', settled_at: now });
        }
      }
      return { ok: true };
    },

    /** app.take_price */
    takePrice(tg, requestId, expectedPrice, now, windowMinutes) {
      const user = userByTg(tg);
      if (!user) return err('not_registered');
      const req = requestById(requestId);
      const error = respondError(user, req, now);
      if (error) return err(error);
      if (req.price === null) return err('no_price');
      if (req.price !== expectedPrice) return err('price_changed');
      if (coveringOverlap(user.id, req.start_at, req.end_at, now)) return err('overlap');
      for (const o of store.offers) {
        if (o.request_id === req.id && o.offerer_id === user.id && o.status === 'pending') {
          Object.assign(o, { status: 'void', reason: 'superseded', settled_at: now });
        }
      }
      const offer = {
        id: nextId('offer'), request_id: req.id, offerer_id: user.id, price: req.price, kind: 'take',
        status: 'matched', reason: null, created_at: now, updated_at: now, settled_at: now,
      };
      store.offers.push(offer);
      const m = startMatch(req, offer.id, user, req.price, 'take', now, windowMinutes);
      const requester = userById(req.requester_id);
      return {
        ok: true,
        match_id: m.id,
        deadline: m.step1_deadline,
        notify: {
          kind: 'match_step1', to_tg: requester.tg_id, match_id: m.id, other_name: name(user), price: m.price,
          deadline: m.step1_deadline, request: requestJson(req),
        },
      };
    },

    /** app.send_offer */
    sendOffer(tg, requestId, price, now) {
      const user = userByTg(tg);
      if (!user) return err('not_registered');
      const req = requestById(requestId);
      const error = respondError(user, req, now);
      if (error) return err(error);
      if (store.offers.some((o) => o.request_id === req.id && o.offerer_id === user.id && o.status === 'pending')) {
        return err('offer_exists');
      }
      if (coveringOverlap(user.id, req.start_at, req.end_at, now)) return err('overlap');
      const offer = {
        id: nextId('offer'), request_id: req.id, offerer_id: user.id, price, kind: 'offer',
        status: 'pending', reason: null, created_at: now, updated_at: now, settled_at: null,
      };
      store.offers.push(offer);
      const requester = userById(req.requester_id);
      return {
        ok: true,
        offer_id: offer.id,
        notify: {
          kind: 'offer', to_tg: requester.tg_id, enabled: requester.notify_offers, is_change: false, price, request: requestJson(req),
        },
      };
    },

    /** app.change_offer */
    changeOffer(tg, offerId, price, now) {
      const user = userByTg(tg);
      if (!user) return err('not_registered');
      const offer = offerById(offerId);
      if (!offer || offer.offerer_id !== user.id) return err('offer_not_found');
      const req = requestById(offer.request_id);
      if (offer.status !== 'pending' || req.status !== 'open' || req.start_at <= now) return err('offer_not_pending');
      if (offer.price === price) return { ok: true, offer_id: offer.id };
      offer.price = price;
      offer.updated_at = now;
      const requester = userById(req.requester_id);
      return {
        ok: true,
        offer_id: offer.id,
        notify: {
          kind: 'offer', to_tg: requester.tg_id, enabled: requester.notify_offers, is_change: true, price, request: requestJson(req),
        },
      };
    },

    /** app.withdraw_offer */
    withdrawOffer(tg, offerId, now) {
      const user = userByTg(tg);
      if (!user) return err('not_registered');
      const offer = offerById(offerId);
      if (!offer || offer.offerer_id !== user.id) return err('offer_not_found');
      const req = requestById(offer.request_id);
      if (offer.status !== 'pending' || req.status !== 'open' || req.start_at <= now) return err('offer_not_pending');
      Object.assign(offer, { status: 'withdrawn', reason: 'self', settled_at: now });
      return { ok: true };
    },

    /** app.accept_offer */
    acceptOffer(tg, offerId, expectedPrice, now, windowMinutes) {
      const user = userByTg(tg);
      if (!user) return err('not_registered');
      const offer = offerById(offerId);
      if (!offer) return err('offer_not_found');
      const req = requestById(offer.request_id);
      if (req.requester_id !== user.id) return err('offer_not_found');
      if (req.status !== 'open' || req.start_at <= now) return err('request_closed');
      if (hasActiveMatch(req.id, now)) return err('match_pending');
      const coverer = userById(offer.offerer_id);
      if (offer.status !== 'pending') return err('offer_not_pending');
      if (offer.price !== expectedPrice) return err('offer_changed');
      if (coveringOverlap(coverer.id, req.start_at, req.end_at, now)) return err('offerer_busy');
      if (pairBlocked(req.id, coverer.id)) return err('rematch_blocked');
      Object.assign(offer, { status: 'matched', settled_at: now });
      const m = startMatch(req, offer.id, coverer, offer.price, 'offer', now, windowMinutes);
      return { ok: true, match_id: m.id, other_name: name(coverer), deadline: m.step1_deadline };
    },

    /** app.reject_offer */
    rejectOffer(tg, offerId, now) {
      const user = userByTg(tg);
      if (!user) return err('not_registered');
      const offer = offerById(offerId);
      if (!offer) return err('offer_not_found');
      const req = requestById(offer.request_id);
      if (req.requester_id !== user.id) return err('offer_not_found');
      if (req.status !== 'open' || req.start_at <= now) return err('request_closed');
      if (offer.status !== 'pending') return err('offer_not_pending');
      offer.status = 'rejected';
      offer.settled_at = now;
      return { ok: true };
    },

    /** app.confirm_match */
    confirmMatch(tg, matchId, now, windowMinutes) {
      const found = matchFor(tg, matchId);
      if (found.error) return found.error;
      const { user, m } = found;
      const req = requestById(m.request_id);
      const state = matchState(m, now);
      if (state === 'arranged') return err('match_done');
      if (state !== 'step1' && state !== 'step2') return err('match_closed');
      if (state === 'step1') {
        if (user.id !== m.requester_id) return err('match_not_your_turn');
        Object.assign(m, { step1_at: now, step2_deadline: stepDeadline(now, req.start_at, windowMinutes) });
        const coverer = userById(m.coverer_id);
        return {
          ok: true,
          step: 2,
          deadline: m.step2_deadline,
          notify: {
            kind: 'match_step2', to_tg: coverer.tg_id, match_id: m.id, other_name: name(user), price: m.price,
            deadline: m.step2_deadline, request: requestJson(req),
          },
        };
      }
      if (user.id !== m.coverer_id) return err('match_not_your_turn');
      if (coveringOverlap(user.id, req.start_at, req.end_at, now)) return err('overlap');
      Object.assign(offerById(m.offer_id), { status: 'accepted', settled_at: now });
      const result = arrange(req, m.offer_id, user, m.price, now);
      Object.assign(m, { step2_at: now, arrangement_id: result.arrangement_id, notified_at: now });
      return { ...result, step: 3 };
    },

    /** app.decline_match */
    declineMatch(tg, matchId, now) {
      const found = matchFor(tg, matchId);
      if (found.error) return found.error;
      const { user, m } = found;
      const state = matchState(m, now);
      if (state === 'arranged') return err('match_done');
      if (state !== 'step1' && state !== 'step2') return err('match_closed');
      if ((state === 'step1' && user.id !== m.requester_id) || (state === 'step2' && user.id !== m.coverer_id)) {
        return err('match_not_your_turn');
      }
      return { ok: true, notify: endMatch(m, 'declined', user.id, now) };
    },

    /** app.cancel_match */
    cancelMatch(tg, matchId, now) {
      const found = matchFor(tg, matchId, true);
      if (found.error) return found.error;
      const { user, m } = found;
      const state = matchState(m, now);
      if (state === 'arranged') return err('match_done');
      if (state !== 'step1' && state !== 'step2') return err('match_closed');
      if (state !== 'step2') return err('match_not_your_turn');
      return { ok: true, notify: endMatch(m, 'cancelled', user.id, now) };
    },

    /** app.claim_match_expiries */
    claimMatchExpiries(now) {
      const rows = [];
      const due = store.matches
        .filter((m) => m.ended_at === null && m.arrangement_id === null && m.notified_at === null && matchState(m, now) === 'expired')
        .sort((a, b) => a.id - b.id);
      for (const m of due) {
        m.notified_at = now;
        const req = requestById(m.request_id);
        enqueueAlerts(req, 'back', now);
        const requester = userById(m.requester_id);
        const coverer = userById(m.coverer_id);
        rows.push(m.step1_at === null
          ? { kind: 'match_ended', reason: 'expired', step: 1, to_tg: coverer.tg_id, to_role: 'coverer', other_name: null, request: requestJson(req) }
          : {
            kind: 'match_ended', reason: 'expired', step: 2, to_tg: requester.tg_id, to_role: 'requester',
            other_name: name(coverer), request: requestJson(req),
          });
      }
      return { ok: true, rows };
    },

    /** app.cancel_arrangement */
    cancelArrangement(tg, arrangementId, now) {
      const user = userByTg(tg);
      if (!user) return err('not_registered');
      const a = arrangementById(arrangementId);
      if (!a || (user.id !== a.requester_id && user.id !== a.coverer_id)) return err('arrangement_not_found');
      const req = requestById(a.request_id);
      if (a.cancelled_at !== null) return err('arrangement_not_found');
      if (req.end_at <= now) return err('arrangement_finished');
      if (req.start_at <= now) return err('arrangement_started');
      a.cancelled_at = now;
      a.cancelled_by = user.id;
      Object.assign(offerById(a.offer_id), { status: 'cancelled', settled_at: now });
      req.status = 'open';
      enqueueAlerts(req, 'back', now);
      const byRequester = user.id === a.requester_id;
      const other = userById(byRequester ? a.coverer_id : a.requester_id);
      return {
        ok: true,
        notify: {
          kind: 'cancelled', to_tg: other.tg_id, to_role: byRequester ? 'coverer' : 'requester',
          by_name: name(user), request: requestJson(req),
        },
      };
    },

    /** app.chat_target */
    chatTarget(tg, arrangementId, now) {
      const user = userByTg(tg);
      if (!user) return err('not_registered');
      const a = arrangementById(arrangementId);
      if (!a || a.cancelled_at !== null || (user.id !== a.requester_id && user.id !== a.coverer_id)) {
        return err('arrangement_not_found');
      }
      const req = requestById(a.request_id);
      if (req.end_at <= now) return err('arrangement_finished');
      const other = userById(user.id === a.requester_id ? a.coverer_id : a.requester_id);
      return { ok: true, target: { tg: other.tg_id, name: name(other) } };
    },

    /** app.board */
    board(tg, university, ward, now, limit) {
      const user = userByTg(tg);
      if (!user) return err('not_registered');
      const rows = store.requests
        .filter((r) => r.city === user.city && r.major === user.major && r.status === 'open' && r.start_at > now
          && !hasActiveMatch(r.id, now)
          && (university === null || r.university_id === university)
          && (ward === null || r.ward === ward))
        .sort((a, b) => a.start_at - b.start_at || a.id - b.id)
        .slice(0, limit)
        .map((r) => {
          const mine = store.offers.find((o) => o.request_id === r.id && o.offerer_id === user.id && o.status === 'pending');
          return {
            ...requestJson(r),
            mine: r.requester_id === user.id,
            my_offer: mine ? { id: mine.id, price: mine.price } : null,
            blocked: pairBlocked(r.id, user.id),
          };
        });
      return { ok: true, rows };
    },

    /** app.my_requests */
    myRequests(tg, now) {
      const user = userByTg(tg);
      if (!user) return err('not_registered');
      const rows = store.requests
        .filter((r) => r.requester_id === user.id && isActive(r, now))
        .sort((a, b) => a.start_at - b.start_at || a.id - b.id)
        .map((r) => {
          const offers = store.offers
            .filter((o) => o.request_id === r.id && o.status === 'pending')
            .sort((a, b) => a.price - b.price || a.updated_at - b.updated_at || a.id - b.id)
            .map((o) => ({ id: o.id, price: o.price, updated_at: o.updated_at }));
          const m = store.matches.filter((x) => x.request_id === r.id && matchActive(x, now)).sort((a, b) => b.id - a.id)[0];
          const a = store.arrangements.find((x) => x.request_id === r.id && x.cancelled_at === null);
          return {
            ...requestJson(r),
            offers,
            match: m
              ? {
                id: m.id, flow: m.flow, price: m.price, step: matchState(m, now) === 'step1' ? 1 : 2,
                deadline: m.step1_at === null ? m.step1_deadline : m.step2_deadline, other_name: name(userById(m.coverer_id)),
              }
              : null,
            arrangement: a
              ? { id: a.id, price: a.price, other_name: name(userById(a.coverer_id)), created_at: a.created_at }
              : null,
          };
        });
      return { ok: true, rows };
    },

    /** app.my_offers */
    myOffers(tg, now, windowHours) {
      const user = userByTg(tg);
      if (!user) return err('not_registered');
      const since = now - windowHours * 3600000;
      const latestMatch = (o) => store.matches.filter((m) => m.offer_id === o.id).sort((a, b) => b.id - a.id)[0] ?? null;
      const rows = store.offers
        .filter((o) => {
          if (o.offerer_id !== user.id) return false;
          if (o.status === 'withdrawn' && o.reason === 'self') return false;
          if (o.status === 'void' && o.reason === 'superseded') return false;
          const r = requestById(o.request_id);
          if (o.status === 'pending') return r.start_at > since;
          if (o.status === 'accepted') return r.end_at > now;
          if (o.status === 'matched') {
            const m = latestMatch(o);
            return Boolean(m) && (matchActive(m, now) || (m.ended_at ?? matchExpiredAt(m)) > since);
          }
          return o.settled_at > since;
        })
        .map((o) => ({ o, r: requestById(o.request_id) }))
        .sort((x, y) => x.r.start_at - y.r.start_at || x.o.id - y.o.id)
        .map(({ o, r }) => {
          let arrangement = null;
          if (o.status === 'accepted') {
            const a = store.arrangements.find((x) => x.offer_id === o.id && x.cancelled_at === null);
            arrangement = a ? { id: a.id, other_name: name(userById(a.requester_id)) } : null;
          }
          let match = null;
          if (o.status === 'matched') {
            const m = latestMatch(o);
            match = m
              ? {
                id: m.id, flow: m.flow, state: matchState(m, now), step: m.step1_at === null ? 1 : 2,
                deadline: m.step1_at === null ? m.step1_deadline : m.step2_deadline, end_reason: m.end_reason,
                ended_at: m.ended_at ?? matchExpiredAt(m),
                other_name: m.step1_at !== null ? name(userById(m.requester_id)) : null,
              }
              : null;
          }
          return {
            id: o.id, price: o.price, status: o.status, reason: o.reason, kind: o.kind,
            updated_at: o.updated_at, settled_at: o.settled_at, request: requestJson(r), arrangement, match,
          };
        });
      return { ok: true, rows };
    },

    /** app.alert_claim */
    alertClaim(now, limit) {
      const stale = (q) => q.status === 'queued' || (q.status === 'claimed' && q.claimed_at < now - 600000);
      for (const q of store.alertQueue) {
        if (!stale(q)) continue;
        const u = userById(q.user_id);
        if (!onBoard(requestById(q.request_id), now) || !u.notify_alerts || isBanned(u.tg_id)) q.status = 'skipped';
      }
      const picked = store.alertQueue.filter(stale).sort((a, b) => a.id - b.id).slice(0, limit);
      for (const q of picked) Object.assign(q, { status: 'claimed', claimed_at: now });
      return {
        ok: true,
        rows: picked.map((q) => ({ id: q.id, to_tg: q.tg_id, kind: q.kind, request: requestJson(requestById(q.request_id)) })),
      };
    },

    /** app.alert_mark */
    alertMark(id, status, now) {
      const q = store.alertQueue.find((x) => x.id === id);
      if (q) {
        q.status = status;
        if (status === 'sent') q.sent_at = now;
        if (status === 'queued') q.claimed_at = null;
      }
      return { ok: true };
    },

    /** app.rate_hit */
    rateHit(tg, limit, windowSeconds, now) {
      const row = store.rateLimits[tg];
      if (!row || row.window_start <= now - windowSeconds * 1000) {
        store.rateLimits[tg] = { window_start: now, hits: 1 };
      } else {
        row.hits += 1;
      }
      return { ok: store.rateLimits[tg].hits <= limit };
    },
  };
}
