/**
 * دعوت از دوستان — the user's invite link (t.me/PasKeshikBot?start=<code>),
 * a ready-made invitation text to copy or share in Telegram, and the one
 * invite reward (1.2.9): seeing the lowest offer on each request, unlocked
 * for good by the first friend who finishes sign-up. Only whether it is on
 * is shown, never how many people joined (spec: Invite).
 */

import { fill } from '../../../supabase/functions/_shared/text.js?v=1.2.9';
import { h, actionButton } from '../dom.js?v=1.2.9';

/**
 * The reward box: the lowest offer, and whether it is on yet.
 * @param {any} ctx
 * @param {{lowestUnlocked:boolean}} state
 */
export function rewardsBox(ctx, { lowestUnlocked }) {
  const t = ctx.t.invite;
  return h('div', { class: `${lowestUnlocked ? 'arrangement' : 'match-box'} rewards` },
    h('div', { class: 'section-title' }, t.rewardTitle),
    h('p', null, t.rewardBody),
    h('div', { class: 'who' }, lowestUnlocked ? t.rewardUnlocked : t.rewardLocked));
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
    const { link, lowestUnlocked } = await ctx.backend.invite();
    const message = fill(t.message, { link });
    // For Telegram's share picker the link travels separately from the text.
    const shareText = fill(t.message, { link: '' }).trim();
    return h('div', { class: 'groups' },
      rewardsBox(ctx, { lowestUnlocked: Boolean(lowestUnlocked) }),
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
