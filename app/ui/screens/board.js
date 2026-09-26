/**
 * جستجو — the board: open requests from the viewer's own city and major,
 * soonest first. Filters: university (defaults to the viewer's own, with an
 * «همه دانشگاه‌های [شهر]» option) and ward (only for majors with wards).
 * The viewer's own requests are marked «درخواست شما» with no actions; a card
 * the viewer has offered on says so.
 */

import { fill } from '../../../supabase/functions/_shared/text.js?v=0.6.1';
import { formatPrice } from '../../../supabase/functions/_shared/price.js?v=0.6.1';
import { universitiesInCity, cityName, wardsOf, majorHasWards } from '../../../supabase/functions/_shared/catalog.js?v=0.6.1';
import { h, replace, actionButton } from '../dom.js?v=0.6.1';
import { requestCard, summaryLines, select } from '../widgets.js?v=0.6.1';

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
  const buttons = [];
  if (item.price !== null) {
    buttons.push(actionButton({
      class: 'btn primary',
      onClick: async () => {
        const c = ctx.t.confirm.take;
        const lines = [...summaryLines(ctx, item), fill(c.price, { price: formatPrice(item.price) })];
        if (!await ctx.confirm({ title: c.title, body: c.body, lines, okText: c.ok })) return;
        const done = await ctx.run(() => ctx.backend.takePrice(item.id, item.price));
        if (done) {
          ctx.toast(b.taken);
          await ctx.nav.reset('myOffers');
        } else {
          ctx.nav.refresh();
        }
      },
    }, b.take));
  }
  buttons.push(h('button', {
    class: 'btn',
    type: 'button',
    onClick: () => ctx.nav.push('offerForm', item.myOffer
      ? { mode: 'change', request: item, offerId: item.myOffer.id, price: item.myOffer.price }
      : { mode: 'send', request: item }),
  }, item.myOffer ? b.changeOffer : b.offer));
  out.push(h('div', { class: 'actions' }, buttons));
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
    const list = h('div', { 'aria-live': 'polite' });

    /** Loads and draws the cards for the current filters. */
    const load = async () => {
      replace(list, h('div', { class: 'boot' }, h('div', { class: 'spinner' })));
      try {
        const data = await ctx.backend.board({ universityId: filters.universityId || null, ward: filters.ward || null });
        replace(list, data.items.length
          ? data.items.map((item) => requestCard(ctx, item, {
            badge: item.mine ? b.yourRequest : null,
            children: cardActions(ctx, item),
          }))
          : h('div', { class: 'empty' }, b.empty));
      } catch (e) {
        replace(list, h('p', { class: 'error-text' }, ctx.messageOf(e)));
      }
    };

    const universityFilter = select({
      value: filters.universityId,
      options: [
        { value: '', label: fill(b.allUniversities, { city: cityName(profile.city) }) },
        ...universitiesInCity(profile.city).map((u) => ({ value: u.id, label: u.name })),
      ],
      onChange: (v) => { filters.universityId = v; load(); },
    });
    const hasWards = majorHasWards(profile.major);
    const wardFilter = hasWards
      ? select({
        value: filters.ward,
        options: [{ value: '', label: b.allWards }, ...wardsOf(profile.major).map((w) => ({ value: w.id, label: w.label }))],
        onChange: (v) => { filters.ward = v; load(); },
      })
      : null;

    await load();
    return h('div', null,
      h('button', { class: 'btn primary block', type: 'button', onClick: () => ctx.nav.push('newRequest') }, b.newRequest),
      // Wide gaps (app.css .filters) between this button, the titles, the filters and the cards.
      h('div', { class: hasWards ? 'filters' : 'filters single' },
        h('div', { class: 'field' }, h('div', { class: 'label' }, b.filterUniversity), universityFilter),
        wardFilter ? h('div', { class: 'field' }, h('div', { class: 'label' }, b.filterWard), wardFilter) : null),
      list);
  },
};
