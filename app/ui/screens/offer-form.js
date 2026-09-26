/**
 * Sending or changing an offer: the request card, a price field (same range
 * as request prices) and a note that only the requester sees it, without a
 * name. On success it goes back to where the user came from.
 */

import { fill } from '../../../supabase/functions/_shared/text.js?v=0.6.1';
import { validateOfferPrice } from '../../../supabase/functions/_shared/validate.js?v=0.6.1';
import { errorText } from '../../../supabase/functions/_shared/errors.js?v=0.6.1';
import { priceRangeVars, formatNumber } from '../../../supabase/functions/_shared/price.js?v=0.6.1';
import { h, actionButton } from '../dom.js?v=0.6.1';
import { requestCard, field, priceInput } from '../widgets.js?v=0.6.1';

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
      const done = await ctx.run(() => (params.mode === 'change'
        ? ctx.backend.changeOffer(params.offerId, price.value)
        : ctx.backend.sendOffer(params.request.id, price.value)));
      if (done) {
        ctx.toast(params.mode === 'change' ? o.changed : o.sent);
        ctx.nav.back();
      }
    };
    return h('div', null,
      requestCard(ctx, params.request),
      field(o.priceLabel, priceInput(ctx, {
        value: params.text,
        placeholder: o.pricePlaceholder,
        onChange: (v) => { params.text = v; error.textContent = ''; },
      }), { hint: fill(o.range, priceRangeVars()) }),
      h('p', { class: 'hint' }, o.note),
      error,
      actionButton({ class: 'btn primary block', onClick: submit }, params.mode === 'change' ? o.submitChange : o.submit));
  },
};
