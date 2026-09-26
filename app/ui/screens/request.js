/**
 * One request, opened from the button of a new-request alert in the bot
 * (the app is opened with ?request=<id>), or from the test panel. It is
 * looked up on the viewer's own board, so the server's rules decide whether
 * it can be seen at all; if it has left the board (taken, cancelled,
 * started), the screen says so and offers the board instead.
 */

import { h } from '../dom.js?v=0.6.1';
import { requestCard } from '../widgets.js?v=0.6.1';
import { cardActions } from './board.js?v=0.6.1';

export const request = {
  /** @param {any} ctx */
  title: (ctx) => ctx.t.screens.request,

  /**
   * @param {any} ctx
   * @param {{id:number}} params
   */
  async render(ctx, params) {
    const t = ctx.t.requestScreen;
    const { items } = await ctx.backend.board({ universityId: null, ward: null });
    const item = items.find((x) => x.id === Number(params.id));
    if (!item) {
      return h('div', { class: 'stack' },
        h('div', { class: 'empty' }, t.gone),
        h('button', { class: 'btn primary block', type: 'button', onClick: () => ctx.nav.reset('board') }, t.toBoard));
    }
    return h('div', { class: 'stack' },
      requestCard(ctx, item, { badge: item.mine ? ctx.t.board.yourRequest : null, children: cardActions(ctx, item) }),
      h('button', { class: 'btn block', type: 'button', onClick: () => ctx.nav.reset('board') }, t.toBoard));
  },
};
