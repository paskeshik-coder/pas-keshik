/**
 * The platform actions the screens use (ctx.platform), built from the
 * Telegram wrapper (telegram.js). Local mode replaces some of them with
 * stand-ins (main.js).
 */

/**
 * @param {ReturnType<typeof import('./telegram.js').createTelegram>} tg
 * @param {{local?:boolean}} [options]
 */
export function createPlatform(tg, { local = false } = {}) {
  return {
    canRequestWriteAccess: local || tg.canRequestWriteAccess,
    requestWriteAccess: () => tg.requestWriteAccess(),
    openBotChat: () => tg.openBotChat(),
    // «چت» with a username: true once the link is handed to Telegram.
    openUserChat: (url) => tg.openUserChat(url),
    share: (url, text) => tg.share(url, text),
  };
}
