/**
 * درخواست‌های من — the requester's active requests. Open ones list their
 * incoming offers (price only, anonymous, cheapest first) with accept and
 * reject, and can be cancelled; arranged ones show the arrangement (the
 * coverer's name, «چت», cancel until the shift starts).
 *
 * Accepting an offer, or a colleague taking the asked price, starts the two
 * confirmation steps: the request then shows a box with the colleague's name
 * and, in step 1, Proceed / Decline; in step 2 (waiting for the colleague),
 * a cancel button. While that is under way no other offer can be accepted
 * and the request can't be cancelled. Every choice asks for confirmation.
 */

import { fill } from '../../../supabase/functions/_shared/text.js?v=0.6.1';
import { formatPrice } from '../../../supabase/functions/_shared/price.js?v=0.6.1';
import { formatDateTime } from '../../../supabase/functions/_shared/time.js?v=0.6.1';
import { h, actionButton } from '../dom.js?v=0.6.1';
import { requestCard, summaryLines, arrangementBox, emptyState } from '../widgets.js?v=0.6.1';

/**
 * Asks to proceed with a named colleague (step 1), right after accepting an
 * offer. Returns whether the step was confirmed.
 * @param {any} ctx
 * @param {{matchId:number, otherName:string, deadline:number}} match
 */
export async function proceedWithName(ctx, match) {
  const c = ctx.t.confirm.acceptedName;
  const vars = { name: match.otherName, time: formatDateTime(match.deadline) };
  if (!await ctx.confirm({ title: fill(c.title, vars), body: fill(c.body, vars), okText: c.ok, cancelText: c.later })) return false;
  const done = await ctx.run(() => ctx.backend.confirmMatch(match.matchId));
  if (done) ctx.toast(fill(ctx.t.myRequests.match.proceeded, vars));
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
  const vars = { name: m.otherName, price: formatPrice(m.price), time: formatDateTime(m.deadline) };
  const decline = actionButton({
    class: 'btn danger',
    onClick: async () => {
      const d = c.declineMatch;
      if (!await ctx.confirm({ title: d.title, body: d.body, okText: d.ok, danger: true })) return;
      const done = await ctx.run(() => ctx.backend.declineMatch(m.id));
      if (done) ctx.toast(M.declined);
      ctx.nav.refresh();
    },
  }, M.decline);
  if (m.step === 1) {
    return h('div', { class: 'match-box' },
      h('div', { class: 'section-title' }, M.step1Title),
      h('div', null, fill(m.flow === 'take' ? M.takeLine : M.offerLine, vars)),
      h('div', { class: 'hint' }, fill(M.step1Hint, vars)),
      h('div', { class: 'hint' }, fill(M.deadline, vars)),
      h('div', { class: 'actions' },
        actionButton({
          class: 'btn primary',
          onClick: async () => {
            await proceedWithName(ctx, { matchId: m.id, otherName: m.otherName, deadline: m.deadline });
            ctx.nav.refresh();
          },
        }, M.proceed),
        decline));
  }
  return h('div', { class: 'match-box' },
    h('div', { class: 'section-title' }, fill(M.step2Title, vars)),
    h('div', { class: 'hint' }, M.step2Hint),
    h('div', { class: 'hint' }, fill(M.deadline, vars)),
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
        onClick: async () => {
          const lines = [...summaryLines(ctx, item), fill(c.acceptOffer.price, { price: formatPrice(offer.price) })];
          if (!await ctx.confirm({ title: c.acceptOffer.title, body: c.acceptOffer.body, lines, okText: c.acceptOffer.ok })) return;
          const done = await ctx.run(() => ctx.backend.acceptOffer(offer.id, offer.price));
          // Step 1: the offerer's name, then proceed (or decide later).
          if (done) await proceedWithName(ctx, done);
          ctx.nav.refresh();
        },
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
    const { items } = await ctx.backend.myRequests();
    const badges = {
      open: [m.statusOpen, ''],
      arranged: [m.statusArranged, 'success'],
      in_progress: [m.statusInProgress, 'muted'],
    };
    return h('div', { class: 'stack' },
      h('button', { class: 'btn primary block gap-bottom', type: 'button', onClick: () => ctx.nav.push('newRequest') }, m.newRequest),
      items.length
        ? items.map((item) => {
          const [badge, badgeClass] = badges[item.state] ?? ['', ''];
          const children = item.state === 'open'
            ? offersSection(ctx, item)
            : item.arrangement
              ? [arrangementBox(ctx, {
                nameLine: fill(ctx.t.arrangement.coverer, { name: item.arrangement.otherName }),
                price: item.arrangement.price,
                arrangementId: item.arrangement.id,
                canCancel: item.arrangement.canCancel,
                onChanged: () => ctx.nav.refresh(),
              })]
              : [];
          return requestCard(ctx, item, { badge, badgeClass, children });
        })
        : emptyState(m.empty, m.emptyHint));
  },
};
