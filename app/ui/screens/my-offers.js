/**
 * پیشنهادهای من — the user's offers. Pending ones can be changed or
 * withdrawn. An offer (or take) in a confirmation shows where it stands:
 * waiting for the requester (step 1; no name yet), or the requester's name
 * with Proceed / Decline (step 2). Settled ones (accepted, rejected,
 * expired, cancelled, the automatic outcomes, and confirmations that didn't
 * go ahead) show for 24 hours; accepted ones stay until the shift ends and
 * show the arrangement with the requester's name, «چت» and cancel. The
 * display windows are applied by the shared views, not here.
 */

import { fill } from '../../../supabase/functions/_shared/text.js?v=0.6.1';
import { formatPrice } from '../../../supabase/functions/_shared/price.js?v=0.6.1';
import { formatDateTime } from '../../../supabase/functions/_shared/time.js?v=0.6.1';
import { h, actionButton } from '../dom.js?v=0.6.1';
import { requestCard, arrangementBox, emptyState } from '../widgets.js?v=0.6.1';

export const myOffers = {
  /** @param {any} ctx */
  title: (ctx) => ctx.t.screens.myOffers,

  /** @param {any} ctx */
  async render(ctx) {
    const o = ctx.t.myOffers;
    const { pending, settled } = await ctx.backend.myOffers();
    if (!pending.length && !settled.length) return emptyState(o.empty, o.emptyHint);

    /**
     * An offer in a confirmation: step 1 waits for the requester; in step 2
     * it's the coverer's turn.
     * @param {any} offer
     */
    const matchChildren = (offer) => {
      const M = o.match;
      const m = offer.match;
      const vars = { name: m.otherName ?? '', time: formatDateTime(m.deadline) };
      if (m.step === 1) {
        return [
          h('div', { class: 'note' }, fill(o.yourPrice, { price: formatPrice(offer.price) })),
          h('div', { class: 'hint' }, fill(M.waiting, vars)),
        ];
      }
      return [h('div', { class: 'match-box' },
        h('div', { class: 'section-title' }, fill(M.yourTurn, vars)),
        h('div', { class: 'note' }, fill(o.yourPrice, { price: formatPrice(offer.price) })),
        h('div', { class: 'hint' }, fill(M.deadline, vars)),
        h('div', { class: 'actions' },
          actionButton({
            class: 'btn primary',
            onClick: async () => {
              const c = ctx.t.confirm.proceedMatch;
              if (!await ctx.confirm({ title: c.title, body: fill(c.body, vars), okText: c.ok })) return;
              const done = await ctx.run(() => ctx.backend.confirmMatch(m.id));
              if (done) ctx.toast(M.arranged);
              ctx.nav.refresh();
            },
          }, M.proceed),
          actionButton({
            class: 'btn danger',
            onClick: async () => {
              const c = ctx.t.confirm.declineMatch;
              if (!await ctx.confirm({ title: c.title, body: c.body, okText: c.ok, danger: true })) return;
              const done = await ctx.run(() => ctx.backend.declineMatch(m.id));
              if (done) ctx.toast(M.declined);
              ctx.nav.refresh();
            },
          }, M.decline)))];
    };

    const pendingCards = pending.map((offer) => requestCard(ctx, offer.request, offer.match ? { children: matchChildren(offer) } : {
      children: [
        h('div', { class: 'note' }, fill(o.yourPrice, { price: formatPrice(offer.price) })),
        h('div', { class: 'actions' },
          h('button', {
            class: 'btn',
            type: 'button',
            onClick: () => ctx.nav.push('offerForm', { mode: 'change', request: offer.request, offerId: offer.id, price: offer.price }),
          }, o.change),
          actionButton({
            class: 'btn danger',
            onClick: async () => {
              const c = ctx.t.confirm.withdrawOffer;
              if (!await ctx.confirm({ title: c.title, body: c.body, okText: c.ok, danger: true })) return;
              const done = await ctx.run(() => ctx.backend.withdrawOffer(offer.id));
              if (done) ctx.toast(o.withdrawn);
              ctx.nav.refresh();
            },
          }, o.withdraw)),
      ],
    }));

    const settledCards = settled.map((offer) => requestCard(ctx, offer.request, {
      badge: o.status[offer.statusKey] ?? '',
      badgeClass: offer.state === 'accepted' ? 'success' : 'muted',
      children: [
        h('div', { class: 'note' }, fill(o.yourPrice, { price: formatPrice(offer.price) })),
        offer.arrangement
          ? arrangementBox(ctx, {
            nameLine: fill(ctx.t.arrangement.requester, { name: offer.arrangement.otherName }),
            price: offer.price,
            arrangementId: offer.arrangement.id,
            canCancel: offer.arrangement.canCancel,
            onChanged: () => ctx.nav.refresh(),
          })
          : null,
      ],
    }));

    return h('div', null,
      pendingCards.length ? [h('div', { class: 'section-title' }, o.pendingTitle), pendingCards] : null,
      settledCards.length ? [h('div', { class: 'section-title' }, o.settledTitle), settledCards] : null);
  },
};
