/**
 * A stand-in for the Telegram Bot API with the same `call(method, params)`
 * shape as _shared/telegram-api.js. LocalBackend uses it so the real
 * notification code (_shared/notify.js) runs in test mode and its messages
 * land in the test panel's bot inbox; the tests use it to check privacy
 * fallbacks.
 *
 * Messages get ids, and editMessageText / editMessageReplyMarkup change a
 * message already delivered (the confirmation buttons edit their prompt).
 *
 * It imitates the two refusals that matter:
 *  - 403 when the recipient can't be messaged (never started the bot and
 *    never granted write access, or blocked it);
 *  - BUTTON_USER_PRIVACY_RESTRICTED when a tg://user?id= button points at
 *    someone whose privacy settings forbid links.
 */

/**
 * @param {{canMessage?:(tg:number)=>boolean, isPrivacyRestricted?:(tg:number)=>boolean,
 *          onMessage?:(chatId:number, text:string, buttons:any[], messageId:number)=>void,
 *          onEdit?:(chatId:number, messageId:number, text:string|null, buttons:any[]|null)=>void,
 *          firstMessageId?:number}} [options]
 *   onMessage — buttons are Telegram's inline keyboard buttons, flattened
 *   onEdit    — text null = unchanged; buttons null = unchanged
 */
export function createFakeTelegram({
  canMessage = () => true, isPrivacyRestricted = () => false, onMessage = () => {}, onEdit = () => {}, firstMessageId = 1,
} = {}) {
  const calls = [];
  let nextMessageId = firstMessageId;
  return {
    /** Every call made, for tests. */
    calls,
    /**
     * @param {string} method
     * @param {any} [params]
     */
    async call(method, params = {}) {
      calls.push({ method, params });
      if (method === 'sendMessage') {
        const chatId = Number(params.chat_id);
        if (!canMessage(chatId)) {
          return { ok: false, error_code: 403, description: "Forbidden: bot can't initiate conversation with a user" };
        }
        const buttons = (params.reply_markup?.inline_keyboard ?? []).flat();
        const link = buttons.find((b) => typeof b.url === 'string' && b.url.startsWith('tg://user?id='));
        if (link && isPrivacyRestricted(Number(link.url.slice('tg://user?id='.length)))) {
          return { ok: false, error_code: 400, description: 'Bad Request: BUTTON_USER_PRIVACY_RESTRICTED' };
        }
        const messageId = nextMessageId++;
        onMessage(chatId, params.text, buttons, messageId);
        return { ok: true, result: { message_id: messageId } };
      }
      if (method === 'editMessageText' || method === 'editMessageReplyMarkup') {
        const buttons = params.reply_markup ? (params.reply_markup.inline_keyboard ?? []).flat() : null;
        onEdit(Number(params.chat_id), Number(params.message_id), method === 'editMessageText' ? params.text : null, buttons);
        return { ok: true, result: true };
      }
      if (method === 'getWebhookInfo') return { ok: true, result: { url: '', pending_update_count: 0 } };
      return { ok: true, result: true };
    },
  };
}
