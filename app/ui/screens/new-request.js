/**
 * Creating a request, in four steps (one screen each):
 *   1. بخش (medicine and nursing only), مکان, and the start: a Jalali month
 *      grid plus the time as two fields, hours and minutes (widgets.js
 *      timeInput, with one-tap chips);
 *   2. the end date and time;
 *   3. the price, which may be skipped (no price is valid: colleagues then
 *      offer theirs);
 *   4. the review: the card exactly as colleagues will see it, and posting.
 * Every step checks its own fields with the same shared rules the server
 * applies (validate.js), so a mistake is shown on the step where it was
 * made. مکان also gets its own error line, shown while typing (as the name
 * fields do), for a character a place can't have (Latin letters, @, …) or a
 * phone number. The form lives in one object passed from step to step in the
 * navigation params, so going back keeps everything typed.
 */

import { CONFIG } from '../../../supabase/functions/_shared/config.js?v=0.6.1';
import { fill } from '../../../supabase/functions/_shared/text.js?v=0.6.1';
import { validateRequestInput, placeInputError } from '../../../supabase/functions/_shared/validate.js?v=0.6.1';
import { errorText } from '../../../supabase/functions/_shared/errors.js?v=0.6.1';
import { majorHasWards, wardsOf } from '../../../supabase/functions/_shared/catalog.js?v=0.6.1';
import {
  addDays, tehranDate, latestStart, combineDateTime, formatDateTime, parseClock, dayNumber, HOUR_MS,
} from '../../../supabase/functions/_shared/time.js?v=0.6.1';
import { h, actionButton } from '../dom.js?v=0.6.1';
import { requestCard, field, select, calendar, timeInput, priceInput } from '../widgets.js?v=0.6.1';

const TOTAL_STEPS = 4;

/**
 * Days an end date may be after the start date (a shift is at most
 * maxShiftHours long, so it can end at most that many days later).
 */
const END_DAYS_AFTER_START = Math.ceil(CONFIG.limits.maxShiftHours / 24);

// Errors about ward and place, which step 1 shows before any about the start.
const EARLY_ERRORS = ['ward_required', 'ward_invalid', 'place_required', 'place_too_long', 'place_chars', 'place_digits'];

/** A fresh, empty form. */
function emptyForm() {
  return {
    ward: '', place: '',
    startDate: null, startHour: '', startMinute: '',
    endDate: null, endHour: '', endMinute: '',
    price: '',
  };
}

/**
 * «مرحلهٔ n از ۴».
 * @param {any} ctx @param {number} n
 */
function stepLabel(ctx, n) {
  return h('div', { class: 'step' }, fill(ctx.t.common.step, { n, total: TOTAL_STEPS }));
}

/**
 * The start or end instant from the form, or the error code.
 * @param {any} form
 * @param {'start'|'end'} which
 * @returns {{ok:true, value:number}|{ok:false, error:string}}
 */
function readInstant(form, which) {
  const date = form[`${which}Date`];
  const hour = form[`${which}Hour`];
  if (!date || !String(hour).trim()) return { ok: false, error: `${which}_required` };
  const ms = combineDateTime(date, parseClock(hour, form[`${which}Minute`]));
  return ms === null ? { ok: false, error: 'time_invalid' } : { ok: true, value: ms };
}

/**
 * Checks the form up to a step with the shared rules (validate.js). Step 1
 * checks ward, place and start (the end is then a stand-in an hour later,
 * which can't fail); step 2 adds the end; step 3 the price.
 * @param {any} ctx
 * @param {any} form
 * @param {1|2|3} step
 * @returns {{ok:true, value:any}|{ok:false, error:string}}
 */
function checkUpTo(ctx, form, step) {
  // Ward and place first, as on the screen (times here are stand-ins).
  const early = validateRequestInput({ ward: form.ward || null, place: form.place, startAt: 1, endAt: 2 }, ctx.profile, 0);
  if (!early.ok && EARLY_ERRORS.includes(early.error)) return early;
  const start = readInstant(form, 'start');
  if (!start.ok) return start;
  let endAt = start.value + HOUR_MS;
  if (step >= 2) {
    const end = readInstant(form, 'end');
    if (!end.ok) return end;
    endAt = end.value;
  }
  return validateRequestInput(
    { ward: form.ward || null, place: form.place, startAt: start.value, endAt, price: step >= 3 ? form.price || null : null },
    ctx.profile,
    ctx.backend.now(),
  );
}

/** A step's error line, and a function that shows an error code there (null clears it). */
function errorLine() {
  const el = h('p', { class: 'error-text', role: 'alert' });
  return { el, show: (code) => { el.textContent = code ? errorText(code) : ''; } };
}

/**
 * Date grid plus hours/minutes for the start or the end, with the chosen
 * moment written out under them («شنبه ۵ مهر ۱۴۰۵، ساعت ۰۸:۰۰»).
 * @param {any} ctx
 * @param {any} form
 * @param {'start'|'end'} which
 * @param {{min:any, max:any, today:any}} bounds
 * @param {()=>void} onChange
 */
function momentPicker(ctx, form, which, bounds, onChange) {
  const t = ctx.t.newRequest;
  const summary = h('div', { class: 'datetime-summary' });
  const show = () => {
    const r = readInstant(form, which);
    summary.textContent = r.ok ? formatDateTime(r.value) : t.chooseDate;
  };
  const grid = calendar(ctx, {
    value: form[`${which}Date`], ...bounds,
    onChange: (d) => { form[`${which}Date`] = d; show(); onChange(); },
  });
  const time = timeInput(ctx, {
    hour: form[`${which}Hour`], minute: form[`${which}Minute`],
    onChange: (hh, mm) => { form[`${which}Hour`] = hh; form[`${which}Minute`] = mm; show(); onChange(); },
  });
  show();
  return [
    h('div', { class: 'field' }, h('div', { class: 'label' }, which === 'start' ? t.start : t.end), grid),
    h('div', { class: 'field' }, h('div', { class: 'label' }, t.time), time, summary),
  ];
}

/** Step 1: ward, place and the start. */
export const newRequest = {
  /** @param {any} ctx */
  title: (ctx) => ctx.t.screens.newRequest,

  /**
   * @param {any} ctx
   * @param {{form?:any}} params
   */
  render(ctx, params) {
    const t = ctx.t.newRequest;
    const form = (params.form ??= emptyForm());
    const now = ctx.backend.now();
    const today = tehranDate(now);
    const error = errorLine();

    const placeCounter = h('div', { class: 'hint' });
    const updateCounter = () => {
      placeCounter.textContent = fill(t.placeCounter, { n: [...form.place].length, max: CONFIG.limits.placeMax });
    };
    updateCounter();
    // Under the field, at once while typing: a character a place can't have
    // or a phone number (the rest is checked on «بعدی»).
    const placeError = errorLine();
    const place = h('input', {
      id: 'place', class: 'input', type: 'text', autocomplete: 'off', dir: 'rtl', maxlength: String(CONFIG.limits.placeMax),
      placeholder: t.placePlaceholder, value: form.place,
      onInput: () => {
        form.place = place.value;
        updateCounter();
        error.show(null);
        placeError.show(placeInputError(place.value));
      },
    });
    placeError.show(form.place ? placeInputError(form.place) : null);

    const wardField = majorHasWards(ctx.profile.major)
      ? field(t.ward, select({
        value: form.ward,
        options: [{ value: '', label: t.wardChoose }, ...wardsOf(ctx.profile.major).map((w) => ({ value: w.id, label: w.label }))],
        onChange: (v) => { form.ward = v; error.show(null); },
      }))
      : null;

    const next = () => {
      const r = checkUpTo(ctx, form, 1);
      if (!r.ok) {
        // A place problem shows under the place field; the rest at the bottom.
        if (r.error === 'place_chars' || r.error === 'place_digits') {
          placeError.show(r.error);
          return place.focus();
        }
        return error.show(r.error);
      }
      return ctx.nav.push('newRequestEnd', { form });
    };

    return h('div', null,
      stepLabel(ctx, 1),
      h('h2', null, t.step1Title),
      wardField,
      h('div', { class: 'field' }, h('label', { for: 'place' }, t.place), place, placeError.el, placeCounter),
      momentPicker(ctx, form, 'start', { min: today, max: tehranDate(latestStart(now)), today }, () => error.show(null)),
      error.el,
      h('button', { class: 'btn primary block', type: 'button', onClick: next }, ctx.t.common.next));
  },
};

/** Step 2: the end date and time. */
export const newRequestEnd = {
  /** @param {any} ctx */
  title: (ctx) => ctx.t.screens.newRequest,

  /**
   * @param {any} ctx
   * @param {{form:any}} params
   */
  render(ctx, params) {
    const t = ctx.t.newRequest;
    const form = params.form;
    const today = tehranDate(ctx.backend.now());
    const error = errorLine();
    // The end is on the start day or up to the longest shift later, and
    // starts out on the start day.
    const min = form.startDate ?? today;
    const max = addDays(min, END_DAYS_AFTER_START);
    if (!form.endDate || dayNumber(form.endDate) < dayNumber(min) || dayNumber(form.endDate) > dayNumber(max)) form.endDate = min;
    const start = readInstant(form, 'start');

    const next = () => {
      const r = checkUpTo(ctx, form, 2);
      if (!r.ok) return error.show(r.error);
      return ctx.nav.push('newRequestPrice', { form });
    };

    return h('div', null,
      stepLabel(ctx, 2),
      h('h2', null, t.step2Title),
      start.ok ? h('p', { class: 'hint' }, `${t.start}: ${formatDateTime(start.value)}`) : null,
      momentPicker(ctx, form, 'end', { min, max, today }, () => error.show(null)),
      error.el,
      h('button', { class: 'btn primary block', type: 'button', onClick: next }, ctx.t.common.next));
  },
};

/** Step 3: the price, or none. */
export const newRequestPrice = {
  /** @param {any} ctx */
  title: (ctx) => ctx.t.screens.newRequest,

  /**
   * @param {any} ctx
   * @param {{form:any}} params
   */
  render(ctx, params) {
    const t = ctx.t.newRequest;
    const form = params.form;
    const error = errorLine();
    /** Checks everything and opens the review. */
    const review = () => {
      const r = checkUpTo(ctx, form, 3);
      if (!r.ok) return error.show(r.error);
      return ctx.nav.push('reviewRequest', { input: r.value });
    };
    return h('div', null,
      stepLabel(ctx, 3),
      h('h2', null, t.step3Title),
      // No standing hint under the field: only «تومان» beside it and, when
      // the price is wrong, the error under it.
      field(t.price, priceInput(ctx, {
        value: form.price, placeholder: t.pricePlaceholder, unit: t.priceUnit,
        onChange: (v) => { form.price = v; error.show(null); },
      })),
      error.el,
      h('button', { class: 'btn primary block', type: 'button', onClick: review }, ctx.t.common.next),
      h('button', {
        class: 'btn block gap-top',
        type: 'button',
        onClick: () => {
          form.price = '';
          review();
        },
      }, t.priceSkip));
  },
};

/** Step 4: the card as colleagues will see it, and posting. */
export const reviewRequest = {
  /** @param {any} ctx */
  title: (ctx) => ctx.t.screens.reviewRequest,

  /**
   * @param {any} ctx
   * @param {{input:any}} params validated request input
   */
  render(ctx, params) {
    const r = ctx.t.review;
    const input = params.input;
    // The same card the board shows, built from the same fields.
    const preview = { id: 0, universityId: ctx.profile.universityId, ...input };
    return h('div', null,
      stepLabel(ctx, 4),
      h('p', { class: 'hint' }, r.hint),
      requestCard(ctx, preview),
      h('div', { class: 'actions' },
        actionButton({
          class: 'btn primary',
          onClick: async () => {
            const done = await ctx.run(() => ctx.backend.createRequest(input));
            if (done) {
              ctx.toast(r.posted);
              await ctx.nav.reset('myRequests');
            }
          },
        }, r.post),
        h('button', { class: 'btn', type: 'button', onClick: () => ctx.nav.back() }, r.edit)));
  },
};
