/**
 * تنظیمات — notification switches (saved as soon as they are tapped;
 * confirmations and cancellations can't be switched off; the daily summary
 * for everyone, or instant alerts instead once a friend's sign-up has
 * unlocked them), which new requests those cover (one university or all of
 * the city, all or chosen wards) and profile editing. The name can change
 * any time; changing major or university is refused by the server while the
 * user has an active request and otherwise asks for confirmation, because it
 * voids their pending offers.
 */

import { CONFIG } from '../../../supabase/functions/_shared/config.js?v=0.6.1';
import { fill } from '../../../supabase/functions/_shared/text.js?v=0.6.1';
import { toFaDigits, normalizeName, checkNamePart } from '../../../supabase/functions/_shared/persian.js?v=0.6.1';
import { errorText } from '../../../supabase/functions/_shared/errors.js?v=0.6.1';
import {
  universityName, cityName, cityOfUniversity, universitiesInCity, wardsOf, majorHasWards,
} from '../../../supabase/functions/_shared/catalog.js?v=0.6.1';
import { h, replace, actionButton } from '../dom.js?v=0.6.1';
import { field, select, universityPicker } from '../widgets.js?v=0.6.1';

/**
 * The notification switches: the daily summary until alerts are unlocked,
 * then the instant alerts switch instead (unlocked users get no summary).
 * @param {any} ctx
 * @param {{offers:boolean, arranged:boolean, reminders:boolean, alerts:boolean, summary:boolean}} current
 * @param {boolean} alertsUnlocked
 */
function notificationsSection(ctx, current, alertsUnlocked) {
  const t = ctx.t.settings;
  const hours = CONFIG.timing.reminders.map((k) => toFaDigits(Math.round(k.minutes / 60))).join(ctx.t.common.and);
  const state = { ...current };
  const boxes = {};
  /** Saves all the switches; puts the box back if saving fails. */
  const save = async (key) => {
    const done = await ctx.run(() => ctx.backend.setNotifications(state));
    if (done) {
      ctx.toast(ctx.t.common.saved);
    } else {
      state[key] = !state[key];
      boxes[key].checked = state[key];
    }
  };
  const row = (key, label) => {
    const box = h('input', {
      type: 'checkbox', id: `n-${key}`, checked: state[key],
      onChange: () => { state[key] = box.checked; save(key); },
    });
    boxes[key] = box;
    return h('label', { class: 'check', for: `n-${key}` }, box, label);
  };
  return [
    h('div', { class: 'section-title' }, t.notificationsTitle),
    row('offers', t.offers),
    row('arranged', t.arranged),
    row('reminders', fill(t.reminders, { hours })),
    alertsUnlocked ? row('alerts', t.alerts) : row('summary', fill(t.summary, { hour: CONFIG.timing.summaryHour })),
    h('p', { class: 'hint' }, t.cancellationsNote),
  ];
}

/**
 * Which new requests the daily summary and the instant alerts cover. Until a
 * friend signs up, it also explains the reward (instant instead of 08:00)
 * and links to the invite screen.
 * @param {any} ctx
 * @param {{unlocked:boolean, university:string|null, wards:string[]|null}} current
 */
function alertsSection(ctx, current) {
  const t = ctx.t.settings;
  const p = ctx.profile;
  const draft = { university: current?.university ?? '', wards: current?.wards ? [...current.wards] : null };
  const error = h('p', { class: 'error-text', role: 'alert' });
  const universitySelect = select({
    value: draft.university,
    options: [
      { value: '', label: fill(ctx.t.board.allUniversities, { city: cityName(p.city) }) },
      ...universitiesInCity(p.city).map((u) => ({ value: u.id, label: u.name })),
    ],
    onChange: (v) => { draft.university = v; },
  });

  let wardsPart = null;
  if (majorHasWards(p.major)) {
    const list = h('div', { hidden: draft.wards === null });
    const boxes = wardsOf(p.major).map((w) => {
      const box = h('input', {
        type: 'checkbox', id: `aw-${w.id}`, checked: Boolean(draft.wards?.includes(w.id)),
        onChange: () => {
          const chosen = new Set(draft.wards ?? []);
          if (box.checked) chosen.add(w.id); else chosen.delete(w.id);
          draft.wards = wardsOf(p.major).map((x) => x.id).filter((id) => chosen.has(id));
          error.textContent = '';
        },
      });
      return h('label', { class: 'check', for: `aw-${w.id}` }, box, w.label);
    });
    list.append(...boxes);
    const mode = select({
      value: draft.wards === null ? 'all' : 'some',
      options: [{ value: 'all', label: t.alertsAllWards }, { value: 'some', label: t.alertsSomeWards }],
      onChange: (v) => {
        list.hidden = v === 'all';
        draft.wards = v === 'all' ? null : (draft.wards ?? []);
      },
    });
    wardsPart = h('div', { class: 'field' }, h('div', { class: 'label' }, t.alertsWards), mode, list);
  }

  const save = async () => {
    if (draft.wards !== null && !draft.wards.length) {
      error.textContent = t.alertsChooseWard;
      return;
    }
    const done = await ctx.run(() => ctx.backend.setAlertFilters({ university: draft.university || null, wards: draft.wards }));
    if (done) ctx.toast(t.alertsSaved);
  };

  return [
    h('div', { class: 'section-title' }, t.alertsTitle),
    h('p', { class: 'hint' }, t.alertsHint),
    field(t.alertsUniversity, universitySelect),
    wardsPart,
    error,
    actionButton({ class: 'btn block', onClick: save }, t.alertsSave),
    current?.unlocked
      ? null
      : h('div', { class: 'note' },
        h('p', null, t.alertsLocked),
        h('button', { class: 'btn small', type: 'button', onClick: () => ctx.nav.reset('invite') }, t.alertsInvite)),
  ];
}

/**
 * Name, major and university editing.
 * @param {any} ctx
 */
function profileSection(ctx) {
  const t = ctx.t.settings;
  const s = ctx.t.signup;
  const p = ctx.profile;
  const draft = { firstName: p.firstName, lastName: p.lastName, major: p.major, universityId: p.universityId };
  const error = h('p', { class: 'error-text', role: 'alert' });
  const nameInput = (key) => h('input', {
    class: 'input', type: 'text', autocomplete: 'off', dir: 'rtl', maxlength: String(CONFIG.limits.nameMax + 10),
    value: draft[key], onInput: (e) => { draft[key] = e.target.value; error.textContent = ''; },
  });

  const universityLine = h('div', { class: 'datetime-summary' });
  const pickerBox = h('div', { hidden: true });
  const showUniversity = () => {
    universityLine.textContent = `${universityName(draft.universityId)} — ${cityName(cityOfUniversity(draft.universityId))}`;
  };
  showUniversity();
  replace(pickerBox, universityPicker(ctx, {
    selectedId: draft.universityId,
    onPick: (id) => {
      draft.universityId = id;
      showUniversity();
      pickerBox.hidden = true;
    },
  }));

  const save = async () => {
    const first = normalizeName(draft.firstName);
    const last = normalizeName(draft.lastName);
    const e1 = checkNamePart(first, CONFIG.limits.nameMin, CONFIG.limits.nameMax);
    const e2 = checkNamePart(last, CONFIG.limits.nameMin, CONFIG.limits.nameMax);
    if (e1 || e2) {
      error.textContent = errorText(e1 ? `first_name_${e1}` : `last_name_${e2}`);
      return;
    }
    const boardChanges = draft.major !== p.major || draft.universityId !== p.universityId;
    if (boardChanges) {
      const c = t.confirmChange;
      if (!await ctx.confirm({ title: c.title, body: c.body, okText: c.ok, danger: true })) return;
    }
    const data = await ctx.run(() => ctx.backend.updateProfile({ firstName: first, lastName: last, major: draft.major, universityId: draft.universityId }));
    if (!data) return;
    ctx.profile = data.profile;
    if (boardChanges) ctx.boardFilters = null;
    ctx.toast(t.profileSaved);
    ctx.nav.refresh();
  };

  return [
    h('div', { class: 'section-title' }, t.profileTitle),
    field(s.firstName, nameInput('firstName'), { id: 'set-first' }),
    field(s.lastName, nameInput('lastName'), { id: 'set-last' }),
    field(t.major, select({
      value: draft.major,
      options: CONFIG.majors.map((m) => ({ value: m.id, label: m.label })),
      onChange: (v) => { draft.major = v; },
    })),
    h('div', { class: 'field' },
      h('div', { class: 'label' }, t.university),
      universityLine,
      // A wide gap between the university's name and «تغییر دانشگاه».
      h('button', { class: 'btn small gap-top', type: 'button', onClick: () => { pickerBox.hidden = !pickerBox.hidden; } }, t.universityChange),
      pickerBox),
    h('p', { class: 'hint' }, t.majorUniversityHint),
    error,
    actionButton({ class: 'btn primary block', onClick: save }, t.saveProfile),
  ];
}

export const settings = {
  /** @param {any} ctx */
  title: (ctx) => ctx.t.screens.settings,

  /** @param {any} ctx */
  async render(ctx) {
    const me = await ctx.backend.me();
    ctx.me = me;
    ctx.profile = me.profile;
    return h('div', null,
      notificationsSection(ctx, me.notifications, Boolean(me.alerts?.unlocked)),
      alertsSection(ctx, me.alerts),
      profileSection(ctx));
  },
};
