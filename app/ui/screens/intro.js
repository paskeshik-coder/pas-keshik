/**
 * First open: three intro pages navigated by buttons (never swipes). The
 * last page's button starts sign-up. Back goes to the previous page.
 */

import { h } from '../dom.js?v=0.6.1';

export const intro = {
  onboarding: true,

  /** @param {any} ctx */
  title: (ctx) => ctx.t.screens.intro,

  /**
   * @param {any} ctx
   * @param {{page?:number}} params
   */
  render(ctx, params) {
    const pages = ctx.t.intro.pages;
    const index = Math.min(params.page ?? 0, pages.length - 1);
    const page = pages[index];
    const last = index === pages.length - 1;
    return h('div', { class: 'intro centered' },
      h('div', { class: 'icon', 'aria-hidden': 'true' }, page.icon),
      h('h2', null, page.title),
      h('p', null, page.body),
      h('div', { class: 'dots', 'aria-hidden': 'true' },
        pages.map((_, i) => h('span', { class: i === index ? 'dot on' : 'dot' }))),
      h('button', {
        class: 'btn primary block',
        type: 'button',
        onClick: () => (last ? ctx.nav.push('signupName') : ctx.nav.push('intro', { page: index + 1 })),
      }, last ? ctx.t.intro.start : ctx.t.common.next));
  },
};
