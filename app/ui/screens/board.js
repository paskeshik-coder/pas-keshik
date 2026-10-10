/**
 * جستجو — the board: open requests from the viewer's own city and major,
 * soonest first. Filters, under the one heading «فیلترها»: university
 * (defaults to the viewer's own, with an «همه دانشگاه‌های [شهر]» option)
 * and, directly under it, ward (only for majors with wards). The dropdowns
 * have no visible labels; each has an accessible one (aria-label).
 * The viewer's own requests are marked «درخواست شما» with no actions; on
 * the others the one action is an offer (requests have no price to take). A
 * card the viewer has offered on says so. A viewer who unlocked the second
 * invite reward sees, as the last line inside each card (their own requests
 * included), the lowest live offer on it, «(پیشنهاد شما)» when it is theirs;
 * the server sends the value to nobody else.
 *
 * Live (spec: Auto-refresh): the cards are kept up to date in place
 * (live-list.js, live-screen.js); a request whose shift starts leaves on
 * time, between refreshes too; a changed filter starts the list over and
 * refreshes at once, and the filters themselves stay as chosen.
 */

import { fill } from '../../../supabase/functions/_shared/text.js?v=1.0.0';
import { formatPrice } from '../../../supabase/functions/_shared/price.js?v=1.0.0';
import { universitiesInCity, cityName, wardsOf, majorHasWards } from '../../../supabase/functions/_shared/catalog.js?v=1.0.0';
import { h } from '../dom.js?v=1.0.0';
import { requestCard, select, lowestOfferLine } from '../widgets.js?v=1.0.0';
import { createLiveList } from '../live-list.js?v=1.0.0';
import { liveScreen } from '../live-screen.js?v=1.0.0';

/**
 * Action area of one card (also used by the request screen an alert opens).
 * @param {any} ctx
 * @param {any} item board item
 */
export function cardActions(ctx, item) {
  const b = ctx.t.board;
  if (item.mine) return [];
  if (item.blocked) return [h('div', { class: 'note' }, b.blocked)];
  const out = [];
  if (item.myOffer) out.push(h('div', { class: 'note' }, fill(b.youOffered, { price: formatPrice(item.myOffer.price) })));
  out.push(h('div', { class: 'actions' }, h('button', {
    class: 'btn primary',
    type: 'button',
    onClick: () => ctx.nav.push('offerForm', item.myOffer
      ? { mode: 'change', request: item, offerId: item.myOffer.id, price: item.myOffer.price }
      : { mode: 'send', request: item }),
  }, item.myOffer ? b.changeOffer : b.offer)));
  return out;
}

export const board = {
  /** @param {any} ctx */
  title: (ctx) => ctx.t.screens.board,

  /** @param {any} ctx */
  async render(ctx) {
    const b = ctx.t.board;
    const profile = ctx.profile;
    ctx.boardFilters ??= { universityId: profile.universityId, ward: '' };
    const filters = ctx.boardFilters;
    const list = h('div', { class: 'live-list', 'aria-live': 'polite' });

    let live = null;
    const cards = createLiveList({
      container: list,
      render: (item) => requestCard(ctx, item, {
        badge: item.mine ? b.yourRequest : null,
        children: [...cardActions(ctx, item), lowestOfferLine(ctx, item)],
      }),
      empty: () => h('div', { class: 'empty' }, b.empty),
      isScrolledDown: () => list.getBoundingClientRect().top < ctx.live.viewportTop(),
      viewportTop: () => ctx.live.viewportTop(),
      onPending: () => live?.pendingChanged(),
      onGoneTap: () => ctx.live.goneTap(),
    });
    live = liveScreen(ctx, {
      screen: 'board',
      lists: [{ list: cards }],
      body: () => ({ universityId: filters.universityId || null, ward: filters.ward || null }),
      // A request leaves the board when its shift starts.
      expiresAt: (item) => item.startAt,
    });
    /** A filter changed: start the list over and refresh at once. */
    const load = () => live.restart();

    const universityFilter = select({
      value: filters.universityId,
      options: [
        { value: '', label: fill(b.allUniversities, { city: cityName(profile.city) }) },
        ...universitiesInCity(profile.city).map((u) => ({ value: u.id, label: u.name })),
      ],
      onChange: (v) => { filters.universityId = v; load(); },
      label: b.filterUniversity,
    });
    const hasWards = majorHasWards(profile.major);
    const wardFilter = hasWards
      ? select({
        value: filters.ward,
        options: [{ value: '', label: b.allWards }, ...wardsOf(profile.major).map((w) => ({ value: w.id, label: w.label }))],
        onChange: (v) => { filters.ward = v; load(); },
        label: b.filterWard,
      })
      : null;

    await live.load(true);
    ctx.live.attach(live);
    return h('div', null,
      h('button', { class: 'btn primary block', type: 'button', onClick: () => ctx.nav.push('newRequest') }, b.newRequest),
      // Wide gaps (app.css .filters) between this button, «فیلترها», the
      // first filter, and the cards; a normal gap between the two filters.
      h('section', { class: 'filters', 'aria-labelledby': 'board-filters' },
        h('h2', { class: 'filters-title', id: 'board-filters' }, b.filters),
        h('div', { class: 'filter-list' }, universityFilter, wardFilter)),
      list);
  },
};
