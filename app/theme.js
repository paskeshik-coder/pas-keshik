/**
 * Applies colours as CSS variables (--c-*). Inside Telegram every colour
 * comes from the user's theme (so light/dark follow Telegram); anything
 * Telegram doesn't provide, and everything in a plain browser, comes from
 * config.js's fallback palette (light or dark as the system is set, e.g.
 * Local mode). The browser's own controls (fields, dropdown lists, check
 * boxes, scroll bars) are drawn in the same light or dark (color-scheme),
 * never the system's when Telegram's differs. Also sets --wide-gap, the one
 * space between groups of items (config.layout.wideGapPx), and
 * --select-inset, every dropdown's edge spacing (config.layout.selectInsetPx).
 */

import { CONFIG } from '../supabase/functions/_shared/config.js?v=1.2.5';

// Our colour tokens → Telegram themeParams keys.
const TELEGRAM_KEYS = {
  bg: 'bg_color',
  text: 'text_color',
  hint: 'hint_color',
  link: 'link_color',
  button: 'button_color',
  buttonText: 'button_text_color',
  secondaryBg: 'secondary_bg_color',
  sectionBg: 'section_bg_color',
  destructive: 'destructive_text_color',
  accent: 'accent_text_color',
};

/**
 * Only plain hex colours are accepted from outside, so a theme value can
 * never smuggle other CSS in.
 * @param {any} value
 */
function isHexColor(value) {
  return typeof value === 'string' && /^#[0-9a-f]{3,8}$/i.test(value);
}

/**
 * camelCase token → kebab-case variable name part.
 * @param {string} token
 */
function kebab(token) {
  return token.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}

/**
 * Sets every --c-* variable on <html>.
 * @param {{colorScheme?:string, themeParams?:Record<string,string>}} tg
 */
export function applyTheme(tg) {
  const prefersDark = typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
  const dark = tg.colorScheme ? tg.colorScheme === 'dark' : prefersDark;
  const palette = CONFIG.colors[dark ? 'dark' : 'light'];
  const params = tg.themeParams ?? {};
  const root = document.documentElement;
  for (const [token, fallback] of Object.entries(palette)) {
    const fromTelegram = TELEGRAM_KEYS[token] ? params[TELEGRAM_KEYS[token]] : undefined;
    root.style.setProperty(`--c-${kebab(token)}`, isHexColor(fromTelegram) ? fromTelegram : fallback);
  }
  root.dataset.scheme = dark ? 'dark' : 'light';
  root.style.setProperty('color-scheme', dark ? 'dark' : 'light');
  root.style.setProperty('--wide-gap', `${Number(CONFIG.layout.wideGapPx)}px`);
  root.style.setProperty('--select-inset', `${Number(CONFIG.layout.selectInsetPx)}px`);
}

/**
 * Applies the theme now and again whenever it changes: Telegram's theme
 * inside Telegram; outside it (Local mode, diag.html in a browser), the
 * system's light or dark setting.
 * @param {{colorScheme?:string, themeParams?:Record<string,string>, onThemeChanged?:(fn:()=>void)=>void}} tg
 */
export function followTheme(tg) {
  applyTheme(tg);
  tg.onThemeChanged?.(() => applyTheme(tg));
  if (typeof matchMedia === 'function') {
    matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
      if (!tg.colorScheme) applyTheme(tg);
    });
  }
}
