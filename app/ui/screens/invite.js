/**
 * دعوت از دوستان — the user's invite link (t.me/PasKeshikBot?start=<code>),
 * a ready-made invitation text to copy or share in Telegram, and the reward:
 * hearing about new requests instantly instead of in the 08:00 summary,
 * unlocked for good by the first friend who signs up. Only whether the
 * reward is unlocked is shown, never how many people joined (spec: Invite).
 */

import { fill } from '../../../supabase/functions/_shared/text.js?v=0.6.1';
import { majorHasWards } from '../../../supabase/functions/_shared/catalog.js?v=0.6.1';
import { h, actionButton } from '../dom.js?v=0.6.1';

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
    const { link, unlocked } = await ctx.backend.invite();
    const message = fill(t.message, { link });
    // For Telegram's share picker the link travels separately from the text.
    const shareText = fill(t.message, { link: '' }).trim();
    const scope = majorHasWards(ctx.profile.major) ? t.rewardScopeWithWards : t.rewardScopeNoWards;
    return h('div', { class: 'groups' },
      h('div', { class: unlocked ? 'arrangement' : 'match-box' },
        h('div', { class: 'section-title' }, t.rewardTitle),
        h('p', null, fill(t.rewardBody, { scope })),
        h('div', { class: 'who' }, unlocked ? t.unlocked : t.locked)),
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
