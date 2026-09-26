/**
 * Shown instead of the app to someone an admin has banned (me() says so, or
 * any call is refused with 'banned'). No menu: every action would be refused
 * anyway. The contact email is offered in case it's a mistake.
 */

import { CONFIG } from '../../../supabase/functions/_shared/config.js?v=0.6.1';
import { fill } from '../../../supabase/functions/_shared/text.js?v=0.6.1';
import { h } from '../dom.js?v=0.6.1';

export const banned = {
  // Hides the menu button, like the sign-up screens.
  onboarding: true,

  /** @param {any} ctx */
  title: (ctx) => ctx.t.screens.banned,

  /** @param {any} ctx */
  render(ctx) {
    const t = ctx.t.banned;
    const c = ctx.t.contact;
    const email = CONFIG.app.contactEmail;
    return h('div', { class: 'stack' },
      h('div', { class: 'banned-mark', 'aria-hidden': 'true' }, '🚫'),
      h('p', null, t.body),
      h('p', null, t.contact),
      h('a', { class: 'btn primary block', href: `mailto:${email}?subject=${encodeURIComponent(c.subject)}` }, c.button),
      h('p', { class: 'hint' }, fill(c.address, { email })));
  },
};
