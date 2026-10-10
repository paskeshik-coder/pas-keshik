/**
 * دعوت از دوستان — the user's invite link (t.me/PasKeshikBot?start=<code>),
 * a ready-made invitation text to copy or share in Telegram, and the
 * rewards, each unlocked for good:
 *   - the first friend who signs up: hearing about new requests instantly
 *     instead of in the 08:00 summary;
 *   - another one: seeing the lowest offer on each request.
 * The box shows the first reward while it is locked; once it is on, a line
 * says so and the box presents the second (locked or on). Only which reward
 * is on is shown, never how many people joined (spec: Invite).
 */

import { fill } from '../../../supabase/functions/_shared/text.js?v=1.0.0';
import { majorHasWards } from '../../../supabase/functions/_shared/catalog.js?v=1.0.0';
import { h, actionButton } from '../dom.js?v=1.0.0';

/**
 * The rewards box: the first reward while it is locked; then «پاداش اول
 * فعال است» and the second reward, locked or on.
 * @param {any} ctx
 * @param {{unlocked:boolean, lowestUnlocked:boolean}} state
 */
export function rewardsBox(ctx, { unlocked, lowestUnlocked }) {
  const t = ctx.t.invite;
  if (!unlocked) {
    const scope = majorHasWards(ctx.profile.major) ? t.rewardScopeWithWards : t.rewardScopeNoWards;
    return h('div', { class: 'match-box rewards' },
      h('div', { class: 'section-title' }, t.rewardTitle),
      h('p', null, fill(t.rewardBody, { scope })),
      h('div', { class: 'who' }, t.locked));
  }
  return h('div', { class: `${lowestUnlocked ? 'arrangement' : 'match-box'} rewards` },
    h('div', { class: 'who first-active' }, t.firstActive),
    h('div', { class: 'section-title' }, t.reward2Title),
    h('p', null, t.reward2Body),
    h('div', { class: 'who' }, lowestUnlocked ? t.reward2Unlocked : t.reward2Locked));
}

/**
 * Copies text to the clipboard; false when the WebView doesn't allow it.
 * @param {string} text
 */
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export const invite = {
  /** @param {any} ctx */
  title: (ctx) => ctx.t.screens.invite,

  /** @param {any} ctx */
  async render(ctx) {
    const t = ctx.t.invite;
    const { link, unlocked, lowestUnlocked } = await ctx.backend.invite();
    const message = fill(t.message, { link });
    // For Telegram's share picker the link travels separately from the text.
    const shareText = fill(t.message, { link: '' }).trim();
    return h('div', { class: 'groups' },
      rewardsBox(ctx, { unlocked: Boolean(unlocked), lowestUnlocked: Boolean(lowestUnlocked) }),
      h('div', { class: 'field' },
        h('div', { class: 'label' }, t.linkLabel),
        h('div', { class: 'card ltr' }, link)),
      h('div', { class: 'field' },
        h('div', { class: 'label' }, t.messageLabel),
        h('div', { class: 'card pre' }, message)),
      h('div', { class: 'actions' },
        actionButton({
          class: 'btn primary',
          onClick: async () => {
            const copied = await copyText(message);
            ctx.toast(copied ? t.copied : t.copyFailed, { error: !copied });
          },
        }, t.copy),
        h('button', { class: 'btn', type: 'button', onClick: () => ctx.platform.share(link, shareText) }, t.share)));
  },
};
