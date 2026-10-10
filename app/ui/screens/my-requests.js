/**
 * درخواست‌های من — the requester's active requests. Open ones list their
 * incoming offers (price only, anonymous, cheapest first) with accept and
 * reject, and can be cancelled; arranged ones show the arrangement (the
 * coverer's name, «چت», cancel until the shift starts).
 *
 * Accepting an offer (no "are you sure?" first) starts the two
 * confirmation steps: the request at once shows a box with the offer
 * maker's name and, in step 1 («در انتظار تصمیم شما»), Proceed / Decline;
 * in step 2 (waiting for the offer maker), a cancel button. While that is
 * under way no other offer can be accepted and the request can't be
 * cancelled. Step 1's Proceed and Decline act at once (the box itself
 * explains them); rejecting an offer and cancelling ask for confirmation.
 * The steps' time windows are never shown.
 *
 * Live (spec: Auto-refresh): new offers, confirmations and arrangements
 * appear in place, without the list being rebuilt (live-list.js).
 */

import { fill } from '../../../supabase/functions/_shared/text.js?v=1.0.0';
import { formatPrice } from '../../../supabase/functions/_shared/price.js?v=1.0.0';
import { h, actionButton } from '../dom.js?v=1.0.0';
import { requestCard, summaryLines, arrangementBox, emptyState } from '../widgets.js?v=1.0.0';
import { createLiveList } from '../live-list.js?v=1.0.0';
import { liveScreen } from '../live-screen.js?v=1.0.0';

/**
 * Step 1's Proceed: goes ahead with the named offer maker at once (no
 * sheet, pop-up or second confirmation). Returns whether it went through.
 * @param {any} ctx
 * @param {{matchId:number, otherName:string}} match
 */
export async function proceedWithName(ctx, match) {
  const done = await ctx.run(() => ctx.backend.confirmMatch(match.matchId));
  if (done) ctx.toast(fill(ctx.t.myRequests.match.proceeded, { name: match.otherName }));
  return Boolean(done);
}

/**
 * The confirmation under way on a request.
 * @param {any} ctx
 * @param {any} item
 */
function matchBox(ctx, item) {
  const M = ctx.t.myRequests.match;
  const c = ctx.t.confirm;
  const m = item.match;
  const vars = { name: m.otherName, price: formatPrice(m.price) };
  // Step 1's Decline: at once, like Proceed.
  const decline = actionButton({
    class: 'btn danger',
    onClick: async () => {
      const done = await ctx.run(() => ctx.backend.declineMatch(m.id));
      if (done) ctx.toast(M.declined);
      ctx.nav.refresh();
    },
  }, M.decline);
  if (m.step === 1) {
    return h('div', { class: 'match-box' },
      h('div', { class: 'section-title' }, M.step1Title),
      h('div', null, fill(M.offerLine, vars)),
      h('div', { class: 'hint' }, fill(M.step1Hint, vars)),
      h('div', { class: 'actions' },
        actionButton({
          class: 'btn primary',
          onClick: async () => {
            await proceedWithName(ctx, { matchId: m.id, otherName: m.otherName });
            ctx.nav.refresh();
          },
        }, M.proceed),
        decline));
  }
  return h('div', { class: 'match-box' },
    h('div', { class: 'section-title' }, fill(M.step2Title, vars)),
    h('div', { class: 'hint' }, M.step2Hint),
    h('div', { class: 'actions' }, actionButton({
      class: 'btn danger',
      onClick: async () => {
        const d = c.cancelMatch;
        if (!await ctx.confirm({ title: d.title, body: fill(d.body, vars), okText: d.ok, danger: true })) return;
        const done = await ctx.run(() => ctx.backend.cancelMatch(m.id));
        if (done) ctx.toast(M.cancelled);
        ctx.nav.refresh();
      },
    }, M.cancel)));
}

/**
 * Offer rows with accept/reject for an open request.
 * @param {any} ctx
 * @param {any} item
 */
function offersSection(ctx, item) {
  const m = ctx.t.myRequests;
  const c = ctx.t.confirm;
  const rows = item.offers.map((offer) => h('div', { class: 'offer-row' },
    h('span', { class: 'price' }, formatPrice(offer.price)),
    item.canAccept
      ? actionButton({
        class: 'btn primary small',
        // Straight to step 1: the card shows the offer maker's name with
        // Proceed / Decline as soon as the list refreshes (right after this).
        onClick: () => ctx.run(() => ctx.backend.acceptOffer(offer.id, offer.price)),
      }, m.accept)
      : null,
    actionButton({
      class: 'btn small',
      onClick: async () => {
        const lines = [fill(c.rejectOffer.price, { price: formatPrice(offer.price) })];
        if (!await ctx.confirm({ title: c.rejectOffer.title, body: c.rejectOffer.body, lines, okText: c.rejectOffer.ok, danger: true })) return;
        const done = await ctx.run(() => ctx.backend.rejectOffer(offer.id));
        if (done) ctx.toast(m.rejected);
        ctx.nav.refresh();
      },
    }, m.reject)));
  return [
    item.match ? matchBox(ctx, item) : null,
    h('div', { class: 'section-title' }, m.offersTitle),
    item.match && rows.length ? h('div', { class: 'hint' }, m.match.offersLocked) : null,
    rows.length ? rows : h('div', { class: 'hint' }, m.noOffers),
    item.canCancel
      ? h('div', { class: 'actions' }, actionButton({
        class: 'btn danger',
        onClick: async () => {
          const cr = c.cancelRequest;
          if (!await ctx.confirm({ title: cr.title, body: cr.body, lines: summaryLines(ctx, item), okText: cr.ok, danger: true })) return;
          const done = await ctx.run(() => ctx.backend.cancelRequest(item.id));
          if (done) ctx.toast(m.cancelled);
          ctx.nav.refresh();
        },
      }, m.cancelRequest))
      : null,
  ];
}

export const myRequests = {
  /** @param {any} ctx */
  title: (ctx) => ctx.t.screens.myRequests,

  /** @param {any} ctx */
  async render(ctx) {
    const m = ctx.t.myRequests;
    const badges = {
      open: [m.statusOpen, ''],
      arranged: [m.statusArranged, 'success'],
      in_progress: [m.statusInProgress, 'muted'],
    };
    /** One request's card. @param {any} item */
    const card = (item) => {
      const [badge, badgeClass] = badges[item.state] ?? ['', ''];
      const children = item.state === 'open'
        ? offersSection(ctx, item)
        : item.arrangement
          ? [arrangementBox(ctx, {
            nameLine: fill(ctx.t.arrangement.coverer, { name: item.arrangement.otherName }),
            otherName: item.arrangement.otherName,
            price: item.arrangement.price,
            arrangementId: item.arrangement.id,
            chat: item.arrangement.chat,
            canCancel: item.arrangement.canCancel,
            onChanged: () => ctx.nav.refresh(),
          })]
          : [];
      return requestCard(ctx, item, { badge, badgeClass, children });
    };
    const list = h('div', { class: 'live-list stack' });
    let live = null;
    const cards = createLiveList({
      container: list,
      render: card,
      empty: () => emptyState(m.empty, m.emptyHint),
      isScrolledDown: () => list.getBoundingClientRect().top < ctx.live.viewportTop(),
      viewportTop: () => ctx.live.viewportTop(),
      onPending: () => live?.pendingChanged(),
      onGoneTap: () => ctx.live.goneTap(),
    });
    live = liveScreen(ctx, { screen: 'myRequests', lists: [{ list: cards }] });
    await live.load(true);
    ctx.live.attach(live);
    return h('div', { class: 'stack' },
      h('button', { class: 'btn primary block gap-bottom', type: 'button', onClick: () => ctx.nav.push('newRequest') }, m.newRequest),
      list);
  },
};
