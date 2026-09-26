/**
 * The test panel, shown only with LocalBackend (plain browser or ?mode=local).
 * Lets the owner switch between fake users, move the app's clock forward,
 * mark a user as privacy-restricted (to see the chat-button fallbacks), ban
 * a user (to see what a banned person sees), read the bot messages a user
 * would have received and press their buttons (Proceed / Decline /
 * «خاموش کن» behave as in Telegram; "open" buttons open the app or the
 * request), send the 08:00 daily summary right away, and reset all data.
 */

import { fill } from '../../supabase/functions/_shared/text.js?v=0.6.1';
import { CONFIG } from '../../supabase/functions/_shared/config.js?v=0.6.1';
import { majorLabel, universityName } from '../../supabase/functions/_shared/catalog.js?v=0.6.1';
import { formatDateTime } from '../../supabase/functions/_shared/time.js?v=0.6.1';
import { errorText } from '../../supabase/functions/_shared/errors.js?v=0.6.1';
import { h, replace } from './dom.js?v=0.6.1';

/**
 * Adds the panel and its toggle button to the page.
 * @param {any} ctx screen context (for dialogs and refreshing)
 * @param {import('../data/local.js').LocalBackend} backend
 * @param {()=>Promise<void>} restart re-runs start-up (after switching user or resetting)
 */
export function mountTestPanel(ctx, backend, restart) {
  const tp = ctx.t.testPanel;
  const panel = h('section', { class: 'tp', hidden: true, 'aria-label': tp.title });
  const toggle = h('button', {
    class: 'tp-toggle',
    type: 'button',
    onClick: () => {
      panel.hidden = !panel.hidden;
      if (!panel.hidden) draw();
    },
  }, tp.toggle);
  document.body.append(toggle, panel);

  /** Label of a user in the switcher. */
  const labelOf = (u) => {
    if (u.tg === CONFIG.demo.ownTelegramId) return `${tp.you}: ${u.registered ? u.name : tp.notRegistered}`;
    return `${u.name} — ${majorLabel(u.major)} — ${universityName(u.universityId)}`;
  };

  /** Moves the clock and redraws the current screen. */
  const advance = async (minutes) => {
    await backend.advanceClock(minutes);
    ctx.nav.refresh();
    draw();
  };

  /**
   * Presses a button of a bot message, as the current user.
   * @param {number} messageId
   * @param {number} index
   */
  const press = async (messageId, index) => {
    const res = await backend.pressButton(messageId, index);
    if (res.open !== undefined) {
      panel.hidden = true;
      await (res.open ? ctx.nav.push('request', { id: res.open }) : ctx.nav.refresh());
      return;
    }
    if (res.ok === false && res.error) ctx.toast(errorText(res.error), { error: true });
    ctx.nav.refresh();
    draw();
  };

  /** Draws the panel's contents. */
  function draw() {
    const current = backend.currentTg;
    const users = backend.users();
    const userSelect = h('select', {
      class: 'select',
      onChange: async () => {
        backend.switchUser(Number(userSelect.value));
        panel.hidden = true;
        await restart();
      },
    }, users.map((u) => h('option', { value: String(u.tg), selected: u.tg === current }, labelOf(u))));

    const privacy = h('input', {
      type: 'checkbox',
      id: 'tp-privacy',
      checked: backend.privacyRestricted(current),
      onChange: () => backend.setPrivacyRestricted(current, privacy.checked),
    });

    const registered = users.some((u) => u.tg === current && u.registered);
    const banned = h('input', {
      type: 'checkbox',
      id: 'tp-banned',
      checked: backend.banned(current),
      disabled: !registered,
      onChange: async () => {
        backend.setBanned(current, banned.checked);
        panel.hidden = true;
        await restart();
      },
    });

    const steps = CONFIG.timing.testClockSteps;
    const inbox = backend.inbox(current);

    replace(panel,
      h('h3', null, tp.title),
      h('p', { class: 'hint' }, tp.note),
      h('div', { class: 'field' }, h('label', { class: 'label' }, tp.user), userSelect, h('div', { class: 'hint' }, tp.userHint)),
      h('label', { class: 'check', for: 'tp-privacy' }, privacy, tp.privacy),
      h('label', { class: 'check', for: 'tp-banned' }, banned, tp.banned),
      h('button', {
        class: 'btn small',
        type: 'button',
        onClick: async () => {
          if (!await backend.simulateInvitee()) return;
          draw();
          ctx.toast(tp.simulatedInvite);
          if (ctx.nav.current === 'invite') ctx.nav.refresh();
        },
      }, tp.simulateInvite),
      h('button', {
        class: 'btn small',
        type: 'button',
        onClick: async () => {
          const sent = await backend.sendSummaryNow();
          draw();
          ctx.toast(sent ? fill(tp.summarySent, { n: sent }) : tp.summaryNone);
        },
      }, fill(tp.summaryNow, { hour: CONFIG.timing.summaryHour })),
      h('div', { class: 'field' },
        h('div', { class: 'label' }, fill(tp.clock, { time: formatDateTime(backend.now()) })),
        h('div', { class: 'clock-buttons' },
          h('button', { class: 'btn small', type: 'button', onClick: () => advance(steps.hour) }, tp.advance.hour),
          h('button', { class: 'btn small', type: 'button', onClick: () => advance(steps.sixHours) }, tp.advance.sixHours),
          h('button', { class: 'btn small', type: 'button', onClick: () => advance(steps.day) }, tp.advance.day),
          h('button', { class: 'btn small', type: 'button', onClick: () => advance(steps.week) }, tp.advance.week),
          h('button', {
            class: 'btn small',
            type: 'button',
            onClick: () => {
              backend.resetClock();
              ctx.nav.refresh();
              draw();
            },
          }, tp.realClock))),
      h('div', { class: 'field' },
        h('div', { class: 'label' }, tp.inbox),
        h('div', { class: 'hint' }, tp.inboxNote),
        h('button', { class: 'btn small', type: 'button', onClick: () => draw() }, ctx.t.common.refresh),
        inbox.length ? h('div', { class: 'hint' }, tp.inboxTap) : null,
        inbox.length
          ? inbox.map((m) => h('div', { class: 'inbox-msg' },
            h('div', { class: 'hint' }, formatDateTime(m.at)),
            m.text,
            m.buttons.length
              ? h('div', { class: 'inbox-buttons' }, m.buttons.map((b, i) => {
                // Messages saved by older versions keep only the button labels.
                const label = typeof b === 'string' ? b : b.text;
                const usable = typeof b !== 'string' && m.id !== undefined && (b.app || b.data);
                return h('button', {
                  class: 'btn small', type: 'button', disabled: !usable, onClick: () => press(m.id, i),
                }, label);
              }))
              : null))
          : h('div', { class: 'hint' }, tp.inboxEmpty)),
      h('div', { class: 'actions' },
        h('button', {
          class: 'btn danger',
          type: 'button',
          onClick: async () => {
            if (!await ctx.confirm({ title: tp.resetTitle, body: tp.resetBody, okText: tp.resetOk, danger: true })) return;
            backend.reset();
            panel.hidden = true;
            await restart();
          },
        }, tp.reset),
        h('button', { class: 'btn', type: 'button', onClick: () => { panel.hidden = true; } }, ctx.t.common.close)));
  }
}
