/**
 * Small Telegram helpers shared by the Edge Functions and the Local-mode
 * demo (which runs the same notification code against a fake Telegram):
 * turning messages' button descriptors into an inline keyboard, sending a
 * message as plain text, and reading Telegram's error answers. Nothing here
 * talks to the network; the real Bot API client is telegram-api.js
 * (server-only).
 *
 * toInlineKeyboard is the only place a Telegram id becomes a tg://user?id=
 * link, and it runs only on the server (or on the demo's fake ids), so real
 * ids never reach a browser.
 */

import { CONFIG } from './config.js?v=1.0.0';

/**
 * @typedef {{ok:true, result:any} | {ok:false, error_code:number, description:string, parameters?:{retry_after?:number}}} ApiResult
 * @typedef {{call:(method:string, params?:object)=>Promise<ApiResult>}} ApiLike
 */

/** Screens a button may open directly (the app's launch.js accepts the same). */
const BUTTON_SCREENS = ['board', 'myRequests', 'myOffers'];

/**
 * The Mini App address a bot button opens: one request (?request=<id>; the
 * app shows it only if the server lets this user see it), one screen
 * (?screen=myRequests…), or the app as a normal launch (no target: the board
 * with the drawer open).
 * @param {{request?:number, screen?:string}} [target]
 */
export function miniAppUrl({ request, screen } = {}) {
  if (Number.isSafeInteger(request)) return `${CONFIG.app.miniAppUrl}?request=${request}`;
  if (BUTTON_SCREENS.includes(screen)) return `${CONFIG.app.miniAppUrl}?screen=${screen}`;
  return CONFIG.app.miniAppUrl;
}

/**
 * Converts button descriptors to Telegram's inline_keyboard. A "chat" button
 * becomes a tg://user?id= link to `chatTgId` (dropped if no id is given); a
 * "callback" button carries its data (at most 64 bytes) back to the bot.
 * @param {{kind:string, text:string, request?:number, screen?:string, data?:string}[][]} buttons
 * @param {{chatTgId?:number|null}} [options]
 */
export function toInlineKeyboard(buttons, { chatTgId = null } = {}) {
  const rows = buttons
    .map((row) => row
      .map((b) => {
        if (b.kind === 'app') return { text: b.text, web_app: { url: miniAppUrl({ request: b.request, screen: b.screen }) } };
        if (b.kind === 'chat' && chatTgId) return { text: b.text, url: `tg://user?id=${chatTgId}` };
        if (b.kind === 'callback' && typeof b.data === 'string') return { text: b.text, callback_data: b.data };
        return null;
      })
      .filter(Boolean))
    .filter((row) => row.length);
  return { inline_keyboard: rows };
}

/**
 * Sends a built message: no parse_mode (so nothing a user typed can become
 * formatting or a link) and link previews off. Formatting, where a message
 * has any, goes as message entities over its fixed text (messages.js
 * entitiesFor).
 * @param {ApiLike} api
 * @param {number} chatId recipient's Telegram id
 * @param {{text:string, buttons:{kind:string,text:string}[][], entities?:object[]}} message
 * @param {{chatTgId?:number|null}} [options]
 */
export function sendMessage(api, chatId, message, options = {}) {
  return api.call('sendMessage', {
    chat_id: chatId,
    text: message.text,
    ...(message.entities?.length ? { entities: message.entities } : {}),
    reply_markup: toInlineKeyboard(message.buttons, options),
    link_preview_options: { is_disabled: true },
  });
}

/**
 * True when Telegram refused a message because a tg://user link points at
 * someone whose privacy settings forbid it (BUTTON_USER_PRIVACY_RESTRICTED).
 * @param {ApiResult} res
 */
export function isPrivacyError(res) {
  return !res.ok && /PRIVACY_RESTRICTED/i.test(res.description ?? '');
}

/**
 * True when Telegram says the bot may not message this user at all (they
 * never pressed Start, blocked the bot, or the chat doesn't exist).
 * @param {ApiResult} res
 */
export function isUnreachableError(res) {
  return !res.ok && (res.error_code === 403 || (res.error_code === 400 && /chat not found|user not found|PEER_ID_INVALID/i.test(res.description ?? '')));
}

/**
 * True when a failure is temporary (flood limit, network, Telegram's own
 * errors): the work should be retried later rather than given up.
 * @param {ApiResult} res
 */
export function isTemporaryError(res) {
  return !res.ok && (res.error_code === 429 || res.error_code === 0 || res.error_code >= 500);
}
