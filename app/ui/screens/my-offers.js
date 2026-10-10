/**
 * پیشنهادهای من — the user's offers. Pending ones can be changed or
 * withdrawn. An offer in a confirmation shows where it stands: waiting for
 * the requester (step 1; no name yet), or the requester's name with
 * Proceed / Decline (step 2; the bot's message only points here). The
 * steps' time windows are never shown. Settled ones (accepted, rejected,
 * expired, cancelled, the automatic outcomes, and confirmations that didn't
 * go ahead) show for 24 hours; accepted ones stay until the shift ends and
 * show the arrangement with the requester's name, «چت» and cancel. The
 * display windows are applied by the shared views, not here.
 *
 * Live (spec: Auto-refresh): both sections are kept up to date in place
 * (live-list.js); an offer that is settled moves from the first section to
 * the second (it fades out of one and comes into the other).
 */

import { fill } from '../../../supabase/functions/_shared/text.js?v=1.0.0';
import { formatPrice } from '../../../supabase/functions/_shared/price.js?v=1.0.0';
import { h, actionButton } from '../dom.js?v=1.0.0';
import { requestCard, arrangementBox, emptyState } from '../widgets.js?v=1.0.0';
import { createLiveList } from '../live-list.js?v=1.0.0';
import { liveScreen } from '../live-screen.js?v=1.0.0';

export const myOffers = {
  /** @param {any} ctx */
  title: (ctx) => ctx.t.screens.myOffers,

  /** @param {any} ctx */
  async render(ctx) {
    const o = ctx.t.myOffers;

    /**
     * An offer in a confirmation: step 1 waits for the requester; in step 2
     * it's the coverer's turn.
     * @param {any} offer
     */
    const matchChildren = (offer) => {
      const M = o.match;
      const m = offer.match;
      const vars = { name: m.otherName ?? '' };
      if (m.step === 1) {
        return [
          h('div', { class: 'note' }, fill(o.yourPrice, { price: formatPrice(offer.price) })),
          h('div', { class: 'hint' }, fill(M.waiting, vars)),
        ];
      }
      return [h('div', { class: 'match-box' },
        h('div', { class: 'section-title' }, fill(M.yourTurn, vars)),
        h('div', { class: 'note' }, fill(o.yourPrice, { price: formatPrice(offer.price) })),
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

    /** A pending offer's card (or one in a confirmation). @param {any} offer */
    const pendingCard = (offer) => requestCard(ctx, offer.request, offer.match ? { children: matchChildren(offer) } : {
      children: [
        h('div', { class: 'note' }, fill(o.yourPrice, { price: formatPrice(offer.price) })),
        h('div', { class: 'actions' },
          h('button', {
            class: 'btn',
            type: 'button',
            // The form looks the request up on the board for the lowest offer.
            onClick: () => ctx.nav.push('offerForm', {
              mode: 'change', request: offer.request, offerId: offer.id, price: offer.price, lookup: true,
            }),
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
    });

    /** A settled offer's card. @param {any} offer */
    const settledCard = (offer) => requestCard(ctx, offer.request, {
      badge: o.status[offer.statusKey] ?? '',
      badgeClass: offer.state === 'accepted' ? 'success' : 'muted',
      children: [
        h('div', { class: 'note' }, fill(o.yourPrice, { price: formatPrice(offer.price) })),
        offer.arrangement
          ? arrangementBox(ctx, {
            nameLine: fill(ctx.t.arrangement.requester, { name: offer.arrangement.otherName }),
            otherName: offer.arrangement.otherName,
            price: offer.price,
            arrangementId: offer.arrangement.id,
            chat: offer.arrangement.chat,
            canCancel: offer.arrangement.canCancel,
            onChanged: () => ctx.nav.refresh(),
          })
          : null,
      ],
    });

    const pendingTitle = h('div', { class: 'section-title', hidden: true }, o.pendingTitle);
    const settledTitle = h('div', { class: 'section-title', hidden: true }, o.settledTitle);
    const empty = h('div', { hidden: true }, emptyState(o.empty, o.emptyHint));
    const pendingList = h('div', { class: 'live-list' });
    const settledList = h('div', { class: 'live-list' });
    let live = null;
    /** One of the two sections' lists. */
    const section = (container, render) => createLiveList({
      container,
      render,
      isScrolledDown: () => container.getBoundingClientRect().top < ctx.live.viewportTop(),
      viewportTop: () => ctx.live.viewportTop(),
      onPending: () => live?.pendingChanged(),
      onGoneTap: () => ctx.live.goneTap(),
    });
    const pendingCards = section(pendingList, pendingCard);
    const settledCards = section(settledList, settledCard);
    live = liveScreen(ctx, {
      screen: 'myOffers',
      lists: [
        { list: pendingCards, accepts: (offer) => offer.section === 'pending' },
        { list: settledCards, accepts: (offer) => offer.section === 'settled' },
      ],
      // Section titles only above sections with offers; the empty state when there are none.
      onItems: (all) => {
        pendingTitle.hidden = !all.some((x) => x.section === 'pending');
        settledTitle.hidden = !all.some((x) => x.section === 'settled');
        empty.hidden = all.length > 0;
      },
    });
    await live.load(true);
    ctx.live.attach(live);
    return h('div', null, empty, pendingTitle, pendingList, settledTitle, settledList);
  },
};
