/**
 * Thin wrapper over Telegram.WebApp (the vendored telegram-web-app.js). All
 * Telegram-specific calls go through here, with version checks, so screens
 * never touch window.Telegram directly and everything degrades gracefully in
 * a plain browser (Local mode).
 */

import { CONFIG } from '../supabase/functions/_shared/config.js?v=1.0.0';

// The only user chats the app opens: exactly https://t.me/<Telegram
// username> (no @, no tg://, no telegram.me).
export const USER_CHAT_URL = /^https:\/\/t\.me\/[A-Za-z0-9_]{4,32}$/;

/**
 * Inspects the environment and returns a small API.
 */
export function createTelegram() {
  const wa = window.Telegram?.WebApp;
  const initData = typeof wa?.initData === 'string' ? wa.initData : '';
  const inTelegram = Boolean(wa && initData);
  /** @param {string} v */
  const atLeast = (v) => Boolean(wa?.isVersionAtLeast?.(v));

  return {
    /** Opened inside Telegram with signed initData. */
    inTelegram,
    /** vendor/telegram-web-app.js is still the placeholder (see docs/SETUP.md). */
    placeholder: Boolean(window.__PK_TELEGRAM_PLACEHOLDER__),
    /** Telegram launched us (its launch parameters are in the URL hash) even if the script is missing. */
    launchedByTelegram: /tgWebApp(Data|Version|Platform)=/.test(window.location.hash),
    initData,
    platform: wa?.platform ?? 'browser',
    version: wa?.version ?? '',
    get colorScheme() {
      return wa?.colorScheme;
    },
    get themeParams() {
      return wa?.themeParams ?? {};
    },

    /** Tells Telegram we're ready, expands to full height, stops swipe-to-close while using forms. */
    ready() {
      if (!wa) return;
      wa.ready?.();
      wa.expand?.();
      if (atLeast('7.7')) wa.disableVerticalSwipes?.();
      if (atLeast('6.1')) {
        wa.setHeaderColor?.('bg_color');
        wa.setBackgroundColor?.('bg_color');
      }
    },

    /** @param {()=>void} fn */
    onThemeChanged(fn) {
      wa?.onEvent?.('themeChanged', fn);
    },

    /**
     * Calls fn(false) when the Mini App goes to the background (minimised,
     * another chat opened) and fn(true) when it comes back — Telegram's
     * activated/deactivated events (Bot API 8.0+). Returns false when they
     * aren't available (then the caller watches the page's visibility).
     * @param {(active:boolean)=>void} fn
     */
    onActivation(fn) {
      if (!inTelegram || !atLeast('8.0') || !wa?.onEvent) return false;
      wa.onEvent('activated', () => fn(true));
      wa.onEvent('deactivated', () => fn(false));
      return true;
    },

    /** Telegram's native back button (Bot API 6.1+). */
    backButton: {
      available: inTelegram && atLeast('6.1'),
      show() {
        wa?.BackButton?.show();
      },
      hide() {
        wa?.BackButton?.hide();
      },
      /** @param {()=>void} fn */
      onClick(fn) {
        wa?.BackButton?.onClick(fn);
      },
    },

    /** Whether Telegram can show its "allow messages" prompt (Bot API 6.9+). */
    canRequestWriteAccess: inTelegram && atLeast('6.9'),

    /**
     * Shows Telegram's prompt asking to let the bot message the user.
     * @returns {Promise<boolean>} true when allowed
     */
    requestWriteAccess() {
      return new Promise((resolve) => {
        try {
          wa.requestWriteAccess((allowed) => resolve(Boolean(allowed)));
        } catch {
          resolve(false);
        }
      });
    },

    /**
     * Opens Telegram's "share to a chat" picker with a link and a text.
     * @param {string} url
     * @param {string} text
     */
    share(url, text) {
      const target = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
      if (wa?.openTelegramLink) wa.openTelegramLink(target);
      else window.open(target, '_blank', 'noopener');
    },

    /** Opens the bot's chat inside Telegram. */
    openBotChat() {
      if (wa?.openTelegramLink) wa.openTelegramLink(CONFIG.app.botLink);
      else window.open(CONFIG.app.botLink, '_blank', 'noopener');
    },

    /**
     * Opens someone's chat by their username («چت»: https://t.me/<username>),
     * handing the link straight to Telegram.WebApp.openTelegramLink. Call it
     * directly in the tap, with nothing awaited first. Returns false (and
     * opens nothing) for any other address or outside Telegram; Telegram's
     * own errors are thrown.
     * @param {string} url
     * @returns {boolean}
     */
    openUserChat(url) {
      if (typeof url !== 'string' || !USER_CHAT_URL.test(url)) return false;
      if (!wa?.openTelegramLink) return false;
      wa.openTelegramLink(url);
      return true;
    },
  };
}
