/**
 * تماس با ما — opens an email to the contact address in the phone's mail
 * app. The address is also shown as text, in case no mail app opens.
 */

import { CONFIG } from '../../../supabase/functions/_shared/config.js?v=0.6.1';
import { fill } from '../../../supabase/functions/_shared/text.js?v=0.6.1';
import { h } from '../dom.js?v=0.6.1';

export const contact = {
  /** @param {any} ctx */
  title: (ctx) => ctx.t.screens.contact,

  /** @param {any} ctx */
  render(ctx) {
    const t = ctx.t.contact;
    const email = CONFIG.app.contactEmail;
    return h('div', { class: 'stack' },
      h('p', null, t.body),
      h('a', { class: 'btn primary block', href: `mailto:${email}?subject=${encodeURIComponent(t.subject)}` }, t.button),
      h('p', { class: 'hint' }, fill(t.address, { email })));
  },
};
