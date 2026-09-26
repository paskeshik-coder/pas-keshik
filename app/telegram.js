/**
 * Thin wrapper over Telegram.WebApp (the vendored telegram-web-app.js). All
 * Telegram-specific calls go through here, with version checks, so screens
 * never touch window.Telegram directly and everything degrades gracefully in
 * a plain browser (Local mode).
 */

import { CONFIG } from '../supabase/functions/_shared/config.js?v=0.6.1';

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
  };
}
