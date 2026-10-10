/**
 * Sending or changing an offer: the request card, a price field and a note
 * that the requester sees it anonymously. On success it goes back to where
 * the user came from; so it does if the request left meanwhile (taken,
 * cancelled, started), with the note «این درخواست دیگر در دسترس نیست»
 * instead of an error.
 *
 * A user who unlocked the second invite reward also sees, next to the price
 * field, the lowest live offer on the request («کمترین پیشنهاد: …», with
 * «(پیشنهاد شما)» when it is theirs), kept up to date with the board's
 * auto-refresh: the request is looked up on the board (its own university
 * and ward) through the live screens' sync, only what changed. Opened from
 * جستجو, the card's own value shows at once; from پیشنهادهای من (`lookup`),
 * it appears after the first look-up. The server sends the value to nobody
 * else, and then nothing is looked up again.
 */

import { validateOfferPrice } from '../../../supabase/functions/_shared/validate.js?v=1.0.0';
import { errorText } from '../../../supabase/functions/_shared/errors.js?v=1.0.0';
import { formatNumber } from '../../../supabase/functions/_shared/price.js?v=1.0.0';
import { h, actionButton } from '../dom.js?v=1.0.0';
import { requestCard, field, priceInput, lowestOfferText } from '../widgets.js?v=1.0.0';
import { GONE_ERRORS } from '../shell.js?v=1.0.0';
import { createRefresher } from '../refresh.js?v=1.0.0';

/**
 * Keeps the lowest offer of `request` up to date while the form is open, on
 * the auto-refresh's timing (refresh.js), as the shell's live controller.
 * @param {any} ctx
 * @param {{id:number, universityId:string, ward:string|null}} request
 * @param {(lowest:any)=>void} show
 * @param {boolean} lookUpNow ask at once (the value isn't known yet)
 */
function watchLowestOffer(ctx, request, show, lookUpNow) {
  let cursor = null;
  let stopped = false;
  const refresher = createRefresher({
    run: async () => {
      let data;
      try {
        data = await ctx.backend.sync({ screen: 'board', cursor, universityId: request.universityId, ward: request.ward ?? null });
      } catch (e) {
        if (e?.code === 'banned' && !stopped) ctx.nav.reset('banned');
        return false;
      }
      if (stopped) return true;
      cursor = data.cursor;
      ctx.live.setDots(data.dots);
      // Gone from the board (taken, cancelled, started): nothing to show.
      if (!data.order.includes(request.id)) {
        show(null);
        return true;
      }
      const item = data.changed.find((x) => x.id === request.id);
      if (!item) return true;
      if (!Object.hasOwn(item, 'lowestOffer')) {
        // Not for this viewer: no value, and no more look-ups.
        show(null);
        controller.stop();
        return true;
      }
      show(item.lowestOffer);
      return true;
    },
    isBusy: (urgent) => ctx.live.isBusy(urgent),
    onOffline: (offline) => ctx.live.setOffline(offline),
  });
  const controller = {
    start() {
      refresher.start();
      if (lookUpNow) refresher.refreshNow();
    },
    stop() {
      stopped = true;
      refresher.stop();
    },
    refreshNow: () => refresher.refreshNow(),
    activity: () => refresher.activity(),
    background: () => refresher.background(),
    foreground: () => refresher.foreground(),
    onScroll() {},
  };
  ctx.live.attach(controller);
}

export const offerForm = {
  /**
   * @param {any} ctx
   * @param {{mode:'send'|'change'}} params
   */
  title: (ctx, params) => (params.mode === 'change' ? ctx.t.screens.changeOffer : ctx.t.screens.sendOffer),

  /**
   * @param {any} ctx
   * @param {{mode:'send'|'change', request:any, offerId?:number, price?:number, text?:string}} params
   */
  render(ctx, params) {
    const o = ctx.t.offerForm;
    if (params.text === undefined) params.text = params.price ? formatNumber(params.price) : '';
    const error = h('p', { class: 'error-text', role: 'alert' });
    const submit = async () => {
      const price = validateOfferPrice(params.text);
      if (!price.ok) {
        error.textContent = errorText(price.error);
        return;
      }
      let gone = false;
      const done = await ctx.run(async () => {
        try {
          return await (params.mode === 'change'
            ? ctx.backend.changeOffer(params.offerId, price.value)
            : ctx.backend.sendOffer(params.request.id, price.value));
        } catch (e) {
          gone = GONE_ERRORS.includes(e?.code);
          throw e;
        }
      }, { gone: true });
      if (done) {
        ctx.toast(params.mode === 'change' ? o.changed : o.sent);
        ctx.nav.back();
      } else if (gone) {
        // The request left meanwhile (the note is already shown): back to the list.
        ctx.nav.back();
      }
    };
    // The lowest offer, next to the price field (second invite reward only).
    const lowest = h('div', { class: 'lowest-offer in-form', hidden: true });
    const showLowest = (value) => {
      const text = lowestOfferText(ctx, value);
      lowest.textContent = text ?? '';
      lowest.hidden = !text;
    };
    const known = Object.hasOwn(params.request, 'lowestOffer');
    showLowest(params.request.lowestOffer);
    if (known || params.lookup) watchLowestOffer(ctx, params.request, showLowest, !known);
    return h('div', null,
      requestCard(ctx, params.request),
      field(o.priceLabel, h('div', null, lowest, priceInput(ctx, {
        value: params.text,
        placeholder: o.pricePlaceholder,
        onChange: (v) => { params.text = v; error.textContent = ''; },
      }))),
      h('p', { class: 'hint' }, o.note),
      error,
      actionButton({ class: 'btn primary block', onClick: submit }, params.mode === 'change' ? o.submitChange : o.submit));
  },
};
