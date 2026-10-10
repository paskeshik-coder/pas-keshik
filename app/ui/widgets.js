/**
 * Reusable pieces of UI: the request card (identical on the board, the
 * review screen and the lists), labelled fields, the Jalali month grid, the
 * hours/minutes fields with one-tap chips, the price field (thousands
 * separators while typing), the arrangement box, the university picker and
 * the empty-state block. All text comes from config via ctx.t; all user text
 * goes in as text.
 */

import { CONFIG } from '../../supabase/functions/_shared/config.js?v=1.0.0';
import { fill } from '../../supabase/functions/_shared/text.js?v=1.0.0';
import { toFaDigits } from '../../supabase/functions/_shared/persian.js?v=1.0.0';
import {
  universityName, wardLabel, searchUniversities, universityById, cityName,
} from '../../supabase/functions/_shared/catalog.js?v=1.0.0';
import {
  formatPrice, priceInWords, parsePrice, checkPrice, formatPriceTyping, digitsBefore, caretAfterDigits,
} from '../../supabase/functions/_shared/price.js?v=1.0.0';
import { errorText } from '../../supabase/functions/_shared/errors.js?v=1.0.0';
import { jalaliMonthLength } from '../../supabase/functions/_shared/jalali.js?v=1.0.0';
import {
  formatDateTime, formatHM, parseClock, hourComplete, clockFieldText, weekdayOf, dayNumber, tehranDate, monthTitle,
} from '../../supabase/functions/_shared/time.js?v=1.0.0';
import { h, replace, actionButton } from './dom.js?v=1.0.0';
import { USER_CHAT_URL } from '../telegram.js?v=1.0.0';

/**
 * One labelled row of a card.
 * @param {string} label
 * @param {any} value
 */
function row(label, value) {
  return h('div', { class: 'row' }, h('span', { class: 'k' }, label), h('span', { class: 'v' }, value));
}

/**
 * The request card, exactly as colleagues see it on the board: university,
 * ward, place, start and end (requests have no price).
 * @param {any} ctx
 * @param {{universityId:string, ward:string|null, place:string, startAt:number, endAt:number}} item
 * @param {{badge?:string, badgeClass?:string, children?:any[]}} [options]
 */
export function requestCard(ctx, item, { badge, badgeClass = '', children = [] } = {}) {
  const t = ctx.t.card;
  const ward = wardLabel(ctx.profile?.major, item.ward);
  return h('article', { class: 'card' },
    h('div', { class: 'card-head' },
      h('div', { class: 'card-title' }, universityName(item.universityId)),
      badge ? h('span', { class: `badge ${badgeClass}` }, badge) : null),
    ward ? row(t.ward, ward) : null,
    row(t.place, item.place),
    row(t.start, formatDateTime(item.startAt)),
    row(t.end, formatDateTime(item.endAt)),
    children);
}

/**
 * «کمترین پیشنهاد: …» — the lowest live offer on a request (the second
 * invite reward), with «(پیشنهاد شما)» when it is the viewer's own; null
 * when there is none to show (no live offers, or a viewer who hasn't
 * unlocked it, to whom the server sends no value at all).
 * @param {any} ctx
 * @param {{price:number, mine:boolean}|null|undefined} lowest a board item's lowestOffer
 */
export function lowestOfferText(ctx, lowest) {
  if (!lowest) return null;
  return fill(lowest.mine ? ctx.t.board.lowestOfferYours : ctx.t.board.lowestOffer, { price: formatPrice(lowest.price) });
}

/**
 * The lowest offer as the last line inside a جستجو card, or null.
 * @param {any} ctx
 * @param {any} item board item
 */
export function lowestOfferLine(ctx, item) {
  const text = lowestOfferText(ctx, item.lowestOffer);
  return text ? h('div', { class: 'lowest-offer' }, text) : null;
}

/**
 * Plain-text lines describing a shift, for confirmation dialogs.
 * @param {any} ctx
 * @param {any} item
 */
export function summaryLines(ctx, item) {
  const t = ctx.t.card;
  const ward = wardLabel(ctx.profile?.major, item.ward);
  return [
    universityName(item.universityId),
    ward ? `${t.ward}: ${ward}` : null,
    `${t.place}: ${item.place}`,
    `${t.start}: ${formatDateTime(item.startAt)}`,
    `${t.end}: ${formatDateTime(item.endAt)}`,
  ].filter(Boolean);
}

/**
 * A labelled form field.
 * @param {string} label
 * @param {any} control
 * @param {{hint?:string|Node|null, id?:string}} [options]
 */
export function field(label, control, { hint = null, id } = {}) {
  if (id) control.id = id;
  return h('div', { class: 'field' },
    h('label', id ? { for: id } : { class: 'label' }, label),
    control,
    hint ? h('div', { class: 'hint' }, hint) : null);
}

/**
 * A native select. `label`, when given, is its accessible name (aria-label),
 * for a select with no visible label of its own.
 * @param {{value:string, options:{value:string,label:string}[], onChange:(v:string)=>void, label?:string}} p
 */
export function select({ value, options, onChange, label }) {
  const el = h('select', { class: 'select', 'aria-label': label, onChange: () => onChange(el.value) },
    options.map((o) => h('option', { value: o.value, selected: o.value === value }, o.label)));
  return el;
}

/**
 * Jalali month grid. Days outside [min, max] are disabled (past days, days
 * too far ahead, end dates before the start). Month navigation by buttons.
 * @param {any} ctx
 * @param {{value:{jy:number,jm:number,jd:number}|null, min:{jy:number,jm:number,jd:number},
 *          max:{jy:number,jm:number,jd:number}, today:{jy:number,jm:number,jd:number},
 *          onChange:(d:{jy:number,jm:number,jd:number})=>void}} options
 * @returns {HTMLElement & {setBounds:(min:any, max:any, value:any)=>void}}
 */
export function calendar(ctx, { value, min, max, today, onChange }) {
  const t = ctx.t.newRequest;
  const root = /** @type {any} */ (h('div', { class: 'calendar' }));
  let selected = value;
  let lo = min;
  let hi = max;
  let view = { jy: (value ?? min).jy, jm: (value ?? min).jm };
  const monthIndex = (d) => d.jy * 12 + d.jm;

  /** Draws the current month. */
  function draw() {
    const first = weekdayOf(view.jy, view.jm, 1);
    const length = jalaliMonthLength(view.jy, view.jm);
    const cells = [];
    for (let i = 0; i < first; i += 1) cells.push(h('span'));
    for (let d = 1; d <= length; d += 1) {
      const day = { jy: view.jy, jm: view.jm, jd: d };
      const n = dayNumber(day);
      const isSelected = selected && dayNumber(selected) === n;
      cells.push(h('button', {
        type: 'button',
        class: dayNumber(today) === n ? 'cal-day today' : 'cal-day',
        disabled: n < dayNumber(lo) || n > dayNumber(hi),
        'aria-pressed': isSelected ? 'true' : 'false',
        onClick: () => {
          selected = day;
          draw();
          onChange(day);
        },
      }, toFaDigits(d)));
    }
    replace(root,
      h('div', { class: 'cal-head' },
        h('button', {
          type: 'button', class: 'btn small', disabled: monthIndex(view) <= monthIndex(lo),
          onClick: () => { view = step(view, -1); draw(); },
        }, t.prevMonth),
        h('span', { class: 'cal-title' }, monthTitle(view.jy, view.jm)),
        h('button', {
          type: 'button', class: 'btn small', disabled: monthIndex(view) >= monthIndex(hi),
          onClick: () => { view = step(view, 1); draw(); },
        }, t.nextMonth)),
      h('div', { class: 'cal-grid' },
        CONFIG.calendar.weekdayShort.map((w) => h('span', { class: 'cal-wd' }, w)),
        cells));
  }

  /** Moves a {jy, jm} by n months. */
  function step(v, n) {
    const index = v.jy * 12 + (v.jm - 1) + n;
    return { jy: Math.floor(index / 12), jm: (index % 12) + 1 };
  }

  /** Changes the allowed range (and selection) without losing the element. */
  root.setBounds = (newMin, newMax, newValue) => {
    lo = newMin;
    hi = newMax;
    selected = newValue;
    const anchor = newValue ?? newMin;
    if (monthIndex(view) < monthIndex(newMin) || monthIndex(view) > monthIndex(newMax)) view = { jy: anchor.jy, jm: anchor.jm };
    draw();
  };

  draw();
  return root;
}

/**
 * The time as two fields, hours then minutes, laid out left to right as
 * times are written («۰۸ : ۳۰»). Each takes one or two digits, Persian or
 * Latin (shown in Persian); typing moves on to the minutes as soon as the
 * hour can't take another digit; empty minutes count as 00 (parseClock).
 * The one-tap chips (config.timeChips) fill both fields.
 * @param {any} ctx
 * @param {{hour:string, minute:string, onChange:(hour:string, minute:string)=>void}} options
 */
export function timeInput(ctx, { hour, minute, onChange }) {
  const t = ctx.t.newRequest;
  const make = (value, label) => h('input', {
    class: 'input ltr clock', type: 'text', inputmode: 'numeric', autocomplete: 'off', maxlength: '2',
    'aria-label': label, value: clockFieldText(value),
  });
  const hourBox = make(hour, t.hour);
  const minuteBox = make(minute, t.minute);
  const changed = () => {
    onChange(hourBox.value, minuteBox.value);
    markChips();
  };
  hourBox.addEventListener('input', () => {
    hourBox.value = clockFieldText(hourBox.value);
    changed();
    if (hourComplete(hourBox.value)) {
      minuteBox.focus();
      minuteBox.select();
    }
  });
  minuteBox.addEventListener('input', () => {
    minuteBox.value = clockFieldText(minuteBox.value);
    changed();
  });
  const chips = CONFIG.timeChips.map((chip) => {
    const [hh, mm] = chip.split(':').map(Number);
    return h('button', {
      type: 'button', class: 'chip', dataset: { time: chip },
      onClick: () => {
        const [hText, mText] = formatHM(hh, mm).split(':');
        hourBox.value = hText;
        minuteBox.value = mText;
        changed();
      },
    }, formatHM(hh, mm));
  });
  /** Highlights the chip matching the typed time. */
  function markChips() {
    const parsed = parseClock(hourBox.value, minuteBox.value);
    for (const chip of chips) {
      const [hh, mm] = chip.dataset.time.split(':').map(Number);
      chip.setAttribute('aria-pressed', parsed && parsed.hour === hh && parsed.minute === mm ? 'true' : 'false');
    }
  }
  markChips();
  // dir=ltr keeps hours on the left and minutes on the right in this RTL app.
  return h('div', null,
    h('div', { class: 'clock-row', dir: 'ltr' },
      h('div', { class: 'clock-part' }, hourBox, h('div', { class: 'hint' }, t.hour)),
      h('span', { class: 'clock-sep', 'aria-hidden': 'true' }, ':'),
      h('div', { class: 'clock-part' }, minuteBox, h('div', { class: 'hint' }, t.minute))),
    h('div', { class: 'chips' }, chips));
}

/**
 * Price input showing thousands separators while typing (the same «٬» and
 * Persian digits as prices shown everywhere). Under it, after the wide gap,
 * as the user types: the amount in Persian words («دو میلیون و پانصد هزار
 * تومان»), or what is wrong with it (out of range) in the same spot;
 * nothing while the field is empty.
 * @param {any} ctx
 * @param {{value:string, placeholder:string, onChange:(v:string)=>void}} options
 */
export function priceInput(ctx, { value, placeholder, onChange }) {
  const preview = h('div', { class: 'price-words', hidden: true });
  const input = h('input', {
    class: 'input ltr', type: 'text', inputmode: 'numeric', autocomplete: 'off', maxlength: '20',
    placeholder, value: formatPriceTyping(value),
  });
  input.addEventListener('input', () => {
    // Redraw the separators and put the caret back after the same digit.
    const digits = digitsBefore(input.value, input.selectionStart ?? input.value.length);
    input.value = formatPriceTyping(input.value);
    const caret = caretAfterDigits(input.value, digits);
    try {
      input.setSelectionRange(caret, caret);
    } catch {
      // Some inputs refuse selection changes; the caret then stays at the end.
    }
    onChange(input.value);
    update();
  });
  /** Shows the price in words or what is wrong with it. */
  function update() {
    const price = parsePrice(input.value);
    const error = price === null ? null : checkPrice(price);
    preview.hidden = price === null;
    preview.textContent = price === null ? '' : error ? errorText(error) : priceInWords(price);
    preview.className = error ? 'price-words error-text' : 'price-words';
  }
  update();
  return h('div', null, input, preview);
}

/** A «چت» target from the server, or null when it isn't one. @param {any} t */
function chatTarget(t) {
  if (!t || typeof t !== 'object') return null;
  if (t.status === 'username') return typeof t.url === 'string' && USER_CHAT_URL.test(t.url) ? { status: t.status, url: t.url } : null;
  return ['bot', 'other_blocked', 'both_blocked'].includes(t.status) ? { status: t.status } : null;
}

/**
 * The arrangement block: the other person's name, the agreed price, «چت»
 * and cancel (until the shift starts).
 *
 * «چت»: the arrangement data carries the chat target (actions.js
 * withChatTargets), so the tap acts at once, with nothing awaited first:
 *   - with the other person's Telegram username, Telegram opens
 *     https://t.me/<username> (Telegram.WebApp.openTelegramLink);
 *   - without one, the app opens the bot while the server sends the chat
 *     button (actions.js chat, started in the same tap);
 *   - if they can't be reached, the box says why.
 * The same tap asks the server for the current target. When it differs
 * (the username changed since the list loaded) or Telegram didn't take the
 * link, the box takes the new target and tries once more; if Telegram still
 * doesn't open the chat, a specific message says so. Without a target
 * (Telegram didn't answer when the list loaded), the tap waits for the
 * server's answer instead. Usernames are used at once and kept nowhere but
 * in this box.
 * @param {any} ctx
 * @param {{nameLine:string, otherName:string, price:number, arrangementId:number, chat?:any,
 *          canCancel:boolean, onChanged:()=>void}} options
 */
export function arrangementBox(ctx, { nameLine, otherName, price, arrangementId, chat = null, canCancel, onChanged }) {
  const t = ctx.t.arrangement;
  const local = ctx.backend.kind !== 'live';
  const note = h('div', { class: 'note chat-note', hidden: true });
  /** Shows why «چت» couldn't connect (or hides the note). @param {string|null} text */
  const showNote = (text) => {
    note.textContent = text ?? '';
    note.hidden = !text;
  };
  let target = chatTarget(chat);
  /** Why the last attempt to open the chat failed. */
  let openError = null;

  /**
   * Acts on a target at once (nothing awaited): 'opened', 'failed' (Telegram
   * didn't take the link) or 'shown' (the note says why there's no chat).
   * @param {{status:string, url?:string}} to
   */
  function act(to) {
    showNote(to.status === 'other_blocked' ? t.otherBlocked : to.status === 'both_blocked' ? t.bothBlocked : null);
    try {
      if (to.status === 'username') {
        if (local) {
          ctx.toast(fill(ctx.t.testPanel.usernameChatOpened, { name: otherName }));
          return 'opened';
        }
        if (ctx.platform.openUserChat(to.url)) return 'opened';
        openError = new Error('openUserChat refused the link');
        return 'failed';
      }
      if (to.status === 'bot') {
        if (local) {
          ctx.toast(ctx.t.testPanel.botChatOpened);
        } else {
          ctx.toast(t.chatSent);
          ctx.platform.openBotChat();
        }
        return 'opened';
      }
    } catch (e) {
      openError = e;
      return 'failed';
    }
    return 'shown';
  }

  /** The tap: everything up to opening the chat happens before any await. */
  function tapChat() {
    const first = target;
    // The server's current target (and, without a username, the bot's
    // chat-button message): on its way before Telegram takes over the screen.
    let answer;
    try {
      answer = ctx.backend.chat(arrangementId);
    } catch (e) {
      answer = Promise.reject(e);
    }
    const result = first ? act(first) : null;
    return answer.then((fresh) => {
      const next = chatTarget(fresh);
      if (!next) return;
      const changed = !first || first.status !== next.status || first.url !== next.url;
      target = next;
      if (!changed && result !== 'failed') return;
      // Loaded without a target, the username changed, or Telegram didn't
      // take the link: once more, with the current target.
      if (act(next) === 'failed') ctx.showError(openError, { action: 'chat', text: t.chatOpenFailed });
    }, (e) => {
      if (e?.code === 'banned') return ctx.run(() => Promise.reject(e));
      // The chat already opened needs nothing more; otherwise say why.
      if (result === 'opened' && first.status === 'username') return undefined;
      return ctx.showError(e, { action: 'chat', text: result === 'failed' ? t.chatOpenFailed : null });
    });
  }

  return h('div', { class: 'arrangement' },
    h('div', { class: 'who' }, nameLine),
    h('div', null, fill(t.price, { price: formatPrice(price) })),
    h('div', { class: 'actions' },
      actionButton({ class: 'btn primary', onClick: tapChat }, t.chat),
      canCancel
        ? actionButton({
          class: 'btn danger',
          onClick: async () => {
            const c = ctx.t.confirm.cancelArrangement;
            if (!await ctx.confirm({ title: c.title, body: c.body, okText: c.ok, danger: true })) return;
            const done = await ctx.run(() => ctx.backend.cancelArrangement(arrangementId));
            if (done) {
              ctx.toast(t.cancelled);
              onChanged();
            }
          },
        }, t.cancel)
        : null),
    note,
    canCancel ? null : h('div', { class: 'hint' }, t.started));
}

/**
 * University picker: the search field (Arabic/Persian letter variants
 * match), then — while it's empty — the title «پرتکرارها» and the frequent
 * universities as chips (config.suggestedUniversities, in order); typing
 * replaces the chips with the matching universities, clearing the field
 * brings them back. At the bottom, after a little extra space, the
 * «دانشگاه شما در فهرست نیست؟» email link. There is no full list. Used by
 * sign-up and by تنظیمات.
 * @param {any} ctx
 * @param {{selectedId?:string, query?:string, onQuery?:(q:string)=>void, onPick:(id:string)=>void}} options
 */
export function universityPicker(ctx, { selectedId, query = '', onQuery = () => {}, onPick }) {
  const s = ctx.t.signup;
  const body = h('div', { class: 'picker-body' });
  const search = h('input', {
    class: 'input', type: 'search', autocomplete: 'off', placeholder: s.universitySearch, dir: 'rtl', value: query,
    onInput: () => { onQuery(search.value); draw(); },
  });
  // Full names, exactly as in the university list; chips wrap onto as many
  // rows as needed (a long name may take a row of its own).
  const frequent = [
    h('div', { class: 'group-title' }, s.universityFrequent),
    h('div', { class: 'chips wide' }, CONFIG.suggestedUniversities
      .map((id) => universityById(id))
      .filter(Boolean)
      .map((u) => h('button', {
        class: 'chip', type: 'button', 'aria-pressed': selectedId === u.id ? 'true' : 'false', onClick: () => onPick(u.id),
      }, u.name))),
  ];
  /** Chips while the field is empty; otherwise the matching universities. */
  function draw() {
    if (!search.value.trim()) {
      replace(body, frequent);
      return;
    }
    const results = searchUniversities(search.value);
    replace(body, results.length
      ? h('div', { class: 'list', role: 'listbox' }, results.map((u) => h('button', {
        class: 'list-item', type: 'button', role: 'option',
        'aria-selected': selectedId === u.id ? 'true' : 'false',
        onClick: () => onPick(u.id),
      }, u.name, h('span', { class: 'sub' }, fill(s.universityCity, { city: cityName(u.city) })))))
      : h('div', { class: 'empty' }, s.universityNoResults));
  }
  draw();
  const mail = `mailto:${CONFIG.app.contactEmail}?subject=${encodeURIComponent(s.universityMissingSubject)}&body=${encodeURIComponent(s.universityMissingBody)}`;
  return h('div', { class: 'picker' },
    search,
    body,
    h('div', { class: 'picker-missing' }, h('a', { class: 'link-btn', href: mail }, s.universityMissing)));
}

/**
 * An empty list's message: a short question in bold and a line under it.
 * @param {string} title
 * @param {string} body
 */
export function emptyState(title, body) {
  return h('div', { class: 'empty' }, h('div', { class: 'empty-title' }, title), h('p', null, body));
}

/**
 * Today's Jalali date in Tehran for the backend's clock.
 * @param {any} ctx
 */
export function todayOf(ctx) {
  return tehranDate(ctx.backend.now());
}
