/**
 * Sign-up, one screen per step: name (a wrong character is flagged under
 * the field at once; "too short" when leaving the field or pressing
 * «بعدی») → major (a looping carousel of square cards; tapping a side card
 * slides it to the centre; taps only, no swipes)
 * → university (search plus the «پرتکرارها» chips; the city is derived) →
 * rules («قبول دارم») → bot permission. Answers are kept in ctx.signup so
 * going back keeps them. The server validates everything again.
 *
 * Bot permission (spec): people who already pressed Start in the bot see no
 * prompt; others get Telegram's prompt, and if they decline, the reason is
 * explained and the prompt is offered again. The server double-checks by
 * sending the sign-up confirmation through the bot and refusing if it can't.
 */

import { CONFIG } from '../../../supabase/functions/_shared/config.js?v=0.6.1';
import { fill } from '../../../supabase/functions/_shared/text.js?v=0.6.1';
import { normalizeName, checkNamePart, hasInvalidNameChar } from '../../../supabase/functions/_shared/persian.js?v=0.6.1';
import { errorText } from '../../../supabase/functions/_shared/errors.js?v=0.6.1';
import { h, actionButton } from '../dom.js?v=0.6.1';
import { field, universityPicker } from '../widgets.js?v=0.6.1';

const TOTAL_STEPS = 5;

/**
 * «مرحلهٔ n از ۵».
 * @param {any} ctx @param {number} n
 */
function stepLabel(ctx, n) {
  return h('div', { class: 'step' }, fill(ctx.t.common.step, { n, total: TOTAL_STEPS }));
}

/**
 * Sends the sign-up. On success the user lands on the board.
 * @param {any} ctx
 * @returns {Promise<'done'|'bot_cannot_message'|'error'>}
 */
async function finish(ctx) {
  try {
    const { firstName, lastName, major, universityId } = ctx.signup;
    const data = await ctx.backend.signup({ firstName, lastName, major, universityId, acceptRules: true });
    ctx.profile = data.profile;
    ctx.signup = {};
    ctx.toast(ctx.t.signup.done);
    await ctx.nav.reset('board');
    return 'done';
  } catch (e) {
    if (e?.code === 'bot_cannot_message') return 'bot_cannot_message';
    ctx.toast(ctx.messageOf(e), { error: true });
    return 'error';
  }
}

const base = {
  onboarding: true,
  /** @param {any} ctx */
  title: (ctx) => ctx.t.screens.signup,
};

export const signupName = {
  ...base,
  /** @param {any} ctx */
  render(ctx) {
    const s = ctx.t.signup;
    const { nameMin, nameMax } = CONFIG.limits;
    /**
     * One name field with its own error line under it. A character a name
     * can't have is flagged while typing; the other problems ("too short",
     * "too long", empty) when leaving the field (empty stays quiet then) or
     * on «بعدی».
     * @param {'firstName'|'lastName'} key where ctx.signup keeps the typed text
     * @param {'first'|'last'} part error-code prefix
     * @param {string} label
     * @param {string} placeholder
     * @param {string} id the input's id (for its label)
     */
    const nameField = (key, part, label, placeholder, id) => {
      const error = h('p', { class: 'error-text', role: 'alert' });
      const input = h('input', {
        class: 'input', type: 'text', autocomplete: 'off', maxlength: String(nameMax + 10), dir: 'rtl',
        placeholder, value: ctx.signup[key] ?? '',
      });
      const show = (code) => { error.textContent = code ? errorText(`${part}_name_${code}`) : ''; };
      /** The full check; returns the normalised name, or null after showing why not. */
      const check = ({ quietWhenEmpty }) => {
        const value = normalizeName(input.value);
        const problem = checkNamePart(value, nameMin, nameMax);
        show(problem === 'required' && quietWhenEmpty ? null : problem);
        return problem ? null : value;
      };
      input.addEventListener('input', () => {
        ctx.signup[key] = input.value;
        // Only a wrong character is shown while typing; fixing it clears the line.
        show(hasInvalidNameChar(input.value) ? 'letters' : null);
      });
      input.addEventListener('blur', () => check({ quietWhenEmpty: true }));
      return { el: field(label, input, { id }), error, check, focus: () => input.focus() };
    };
    const first = nameField('firstName', 'first', s.firstName, s.firstNamePlaceholder, 'first-name');
    const last = nameField('lastName', 'last', s.lastName, s.lastNamePlaceholder, 'last-name');
    first.el.append(first.error);
    last.el.append(last.error);
    const next = () => {
      const firstName = first.check({ quietWhenEmpty: false });
      const lastName = last.check({ quietWhenEmpty: false });
      if (firstName === null) return first.focus();
      if (lastName === null) return last.focus();
      Object.assign(ctx.signup, { firstName, lastName });
      return ctx.nav.push('signupMajor');
    };
    return h('div', null,
      stepLabel(ctx, 1),
      h('h2', null, s.nameTitle),
      // The hint, then (next line, smaller) when the other side sees the name.
      h('div', { class: 'hint-block' },
        h('p', { class: 'hint' }, s.nameHint),
        h('p', { class: 'hint small' }, s.nameNote)),
      first.el,
      last.el,
      h('button', { class: 'btn primary block', type: 'button', onClick: next }, ctx.t.common.next));
  },
};

export const signupMajor = {
  ...base,
  /**
   * @param {any} ctx
   * @param {{index?:number}} params
   */
  render(ctx, params) {
    const s = ctx.t.signup;
    const majors = CONFIG.majors;
    // Start on the major chosen before (going back), else on پزشکی.
    if (params.index === undefined) {
      const chosen = majors.findIndex((m) => m.id === (ctx.signup.major ?? CONFIG.defaultMajor));
      params.index = Math.max(0, chosen);
    }
    // Every major is one card, made once; moving only changes each card's
    // position class, so CSS slides and fades the cards between positions
    // (app.css .major-card). Positions: the centre (the chosen major), the
    // previous major on the right and the next on the left (right-to-left
    // reading), and hidden ones further out on each side. The ring loops,
    // so there is always a card on both sides (after هوشبری, پرستاری).
    const n = majors.length;
    const half = Math.floor(n / 2);
    /** Card i's place relative to the centre: 0, ±1 for the sides, up to ±half (looping). */
    const offsetOf = (i) => ((((i - params.index + half) % n) + n) % n) - half;
    const POSITION = { '-1': 'at-prev', 0: 'at-centre', 1: 'at-next' };
    const cards = majors.map((m, i) => h('button', { class: 'major-card', type: 'button', onClick: () => tap(i) },
      h('div', { class: 'icon', 'aria-hidden': 'true' }, m.icon),
      h('div', { class: 'name' }, m.label)));
    /** Puts every card in its place for the current index. */
    const place = () => cards.forEach((card, i) => {
      const o = offsetOf(i);
      card.className = `major-card ${POSITION[o] ?? (o < 0 ? 'at-far-prev' : 'at-far-next')}`;
      // Only the two side cards can be tapped (or reached with the keyboard).
      card.tabIndex = Math.abs(o) === 1 ? 0 : -1;
      if (Math.abs(o) > 1) card.setAttribute('aria-hidden', 'true'); else card.removeAttribute('aria-hidden');
      if (o === 0) card.setAttribute('aria-current', 'true'); else card.removeAttribute('aria-current');
    });
    /** A tapped side card slides to the centre; the centre card does nothing. */
    const tap = (i) => {
      const o = offsetOf(i);
      if (Math.abs(o) !== 1) return;
      params.index = (params.index + o + n) % n;
      place();
    };
    place();
    // Centred on the screen like the intro pages; «انتخاب» is sized to its
    // label (app.css .btn.choose) and centred under the carousel.
    return h('div', { class: 'centered' },
      stepLabel(ctx, 2),
      h('h2', null, s.majorTitle),
      h('p', { class: 'hint' }, s.majorHint),
      h('div', { class: 'carousel', role: 'group', 'aria-label': s.majorTitle }, cards),
      h('button', {
        class: 'btn primary choose',
        type: 'button',
        onClick: () => {
          ctx.signup.major = majors[params.index].id;
          ctx.nav.push('signupUniversity');
        },
      }, s.majorChoose));
  },
};

export const signupUniversity = {
  ...base,
  /** @param {any} ctx */
  render(ctx) {
    const s = ctx.t.signup;
    return h('div', null,
      stepLabel(ctx, 3),
      h('h2', null, s.universityTitle),
      h('p', { class: 'hint' }, s.universityHint),
      universityPicker(ctx, {
        selectedId: ctx.signup.universityId,
        query: ctx.signup.universityQuery ?? '',
        onQuery: (q) => { ctx.signup.universityQuery = q; },
        onPick: (id) => {
          ctx.signup.universityId = id;
          ctx.nav.push('signupRules');
        },
      }));
  },
};

export const signupRules = {
  ...base,
  /** @param {any} ctx */
  render(ctx) {
    const s = ctx.t.signup;
    return h('div', { class: 'centered' },
      stepLabel(ctx, 4),
      h('h2', null, s.rulesTitle),
      h('ol', { class: 'rules' }, s.rules.map((r) => h('li', null, r))),
      actionButton({
        class: 'btn primary block',
        onClick: async () => {
          ctx.signup.acceptRules = true;
          // Anyone who already pressed Start (or allowed messages) sees no prompt.
          const me = await ctx.run(() => ctx.backend.me());
          if (!me) return;
          ctx.me = me;
          const result = me.canMessage ? await finish(ctx) : 'bot_cannot_message';
          if (result === 'bot_cannot_message') await ctx.nav.push('signupBot');
        },
      }, s.rulesAccept));
  },
};

export const signupBot = {
  ...base,
  /**
   * @param {any} ctx
   * @param {{declined?:boolean, asked?:boolean}} params
   */
  render(ctx, params) {
    const s = ctx.t.signup;
    const status = h('p', { class: 'error-text', role: 'alert' }, params.declined ? s.botDeclined : '');
    const platform = ctx.platform;

    /** Shows Telegram's prompt; on "allow" completes sign-up. */
    const ask = async () => {
      params.asked = true;
      const allowed = await platform.requestWriteAccess();
      if (allowed) {
        status.textContent = s.finishing;
        status.className = 'hint';
        const result = await finish(ctx);
        if (result === 'done') return;
        if (result === 'error') {
          status.textContent = '';
          return;
        }
      }
      // Declined (or the server still can't message them): explain and offer again.
      params.declined = true;
      status.textContent = s.botDeclined;
      status.className = 'error-text';
    };

    if (!platform.canRequestWriteAccess) {
      // Old Telegram without the prompt: press Start in the bot instead.
      return h('div', null,
        stepLabel(ctx, 5),
        h('h2', null, s.botTitle),
        h('p', null, s.botWhy),
        h('p', { class: 'note' }, s.botUnsupported),
        h('div', { class: 'actions' },
          h('button', { class: 'btn primary', type: 'button', onClick: () => platform.openBotChat() }, s.botOpen),
          actionButton({
            class: 'btn',
            onClick: async () => {
              const me = await ctx.run(() => ctx.backend.me());
              if (me?.canMessage) await finish(ctx);
            },
          }, s.botCheckAgain)));
    }

    // First visit: show Telegram's prompt right away.
    if (!params.asked) setTimeout(() => { if (ctx.nav.current === 'signupBot' && !params.asked) ask(); }, 400);
    return h('div', null,
      stepLabel(ctx, 5),
      h('h2', null, s.botTitle),
      h('p', null, s.botWhy),
      status,
      actionButton({ class: 'btn primary block', onClick: ask }, s.botAllow));
  },
};
