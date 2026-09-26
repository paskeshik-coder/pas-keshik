/**
 * The users' callback buttons in bot messages:
 *   - Proceed / Decline of the confirmation prompts (callback data
 *     "mc:<matchId>:y" or "mc:<matchId>:n");
 *   - «خاموش کن» under the daily summary ("sm:off").
 * The person pressing is taken from the verified webhook update
 * (callback_query.from), never from the button data, and the choice runs
 * through the very same actions as the app's buttons (actions.js:
 * confirmMatch / declineMatch / setSummary, with the ban check), so the rules
 * can't differ between the two: a match that isn't the presser's is refused
 * by the database exactly as in the app.
 *
 * After a press the message is edited: the outcome is appended and the
 * pressed buttons are removed (the "open the app" button stays). A press
 * that can no longer work (the step lapsed, the other side acted first) gets
 * a short alert and the buttons are removed too.
 *
 * The wording is passed in (the bot's in the Edge Functions, the test mode's
 * in LocalBackend, whose test panel presses these same buttons), so this
 * module holds no bot text and can be published with the demo.
 */

import { errorText } from './errors.js?v=0.6.1';
import { toInlineKeyboard } from './telegram-helpers.js?v=0.6.1';

const DATA = /^mc:(\d{1,15}):([yn])$/;
// Telegram's longest message text.
const MAX_TEXT = 4096;

/** The callback data of the summary's «خاموش کن» button. */
export const SUMMARY_OFF_DATA = 'sm:off';

/**
 * The callback data of a confirmation prompt's Proceed (yes) or Decline button.
 * @param {number} matchId
 * @param {boolean} yes
 */
export function matchCallbackData(matchId, yes) {
  return `mc:${matchId}:${yes ? 'y' : 'n'}`;
}

/**
 * @param {{actions:any, api:{call:(method:string, params?:object)=>Promise<any>},
 *          texts:{openApp:string, proceeded:string, declined:string, summaryOff:string},
 *          rateLimit?:{db:{rateHit:Function}, count:number, windowSeconds:number}|null,
 *          now?:()=>number, log?:(m:string)=>void}} deps
 *   texts     — what a pressed message says afterwards, and its remaining button's label
 *   rateLimit — the per-user write limit the gateway applies (the bot passes it; the demo doesn't)
 */
export function createMatchButtons({ actions, api, texts, rateLimit = null, now = Date.now, log = () => {} }) {
  /** The keyboard left on the prompt once it has been answered. */
  const appOnly = () => toInlineKeyboard([[{ kind: 'app', text: texts.openApp }]]);

  return {
    /**
     * Whether a callback's data is one of these buttons.
     * @param {any} data
     */
    handles(data) {
      return typeof data === 'string' && (DATA.test(data) || data === SUMMARY_OFF_DATA);
    },

    /**
     * Handles one press.
     * @param {any} cq Telegram CallbackQuery
     * @returns {Promise<{ok:boolean, error?:string}>}
     */
    async handle(cq) {
      const answer = (text) => api.call('answerCallbackQuery', {
        callback_query_id: cq.id, ...(text ? { text: text.slice(0, 200), show_alert: true } : {}),
      });
      const tg = cq.from?.id;
      const msg = cq.message;
      // Only in the presser's own private chat with the bot.
      if (!Number.isSafeInteger(tg) || cq.from.is_bot || !msg || msg.chat?.type !== 'private' || msg.chat.id !== tg) {
        await answer(errorText('bad_request'));
        return { ok: false, error: 'bad_request' };
      }
      const at = now();
      if (rateLimit && !(await rateLimit.db.rateHit(tg, rateLimit.count, rateLimit.windowSeconds, at)).ok) {
        await answer(errorText('rate_limited'));
        return { ok: false, error: 'rate_limited' };
      }
      const summaryOff = cq.data === SUMMARY_OFF_DATA;
      const [, id, choice] = summaryOff ? [] : DATA.exec(cq.data);
      const ctx = { tg, allowsWriteToPm: true, body: summaryOff ? { on: false } : { matchId: Number(id) }, now: at };
      let res;
      try {
        if (summaryOff) res = await actions.setSummary(ctx);
        else res = choice === 'y' ? await actions.confirmMatch(ctx) : await actions.declineMatch(ctx);
      } catch (e) {
        log(`bot button failed: ${e?.message ?? e}`);
        await answer(errorText('server_error'));
        return { ok: false, error: 'server_error' };
      }
      if (!res.ok) {
        // Not your turn yet: keep the buttons (they will work later).
        if (res.error !== 'match_not_your_turn' && res.error !== 'rate_limited') {
          await api.call('editMessageReplyMarkup', { chat_id: msg.chat.id, message_id: msg.message_id, reply_markup: appOnly() });
        }
        await answer(errorText(res.error));
        return res;
      }
      let done;
      if (summaryOff) done = texts.summaryOff;
      else done = choice === 'y' ? texts.proceeded : texts.declined;
      // A near-limit message (a long summary) can't take the extra line; then
      // the outcome replaces the text rather than the edit failing.
      const text = `${msg.text ?? ''}\n\n${done}`.trim();
      await api.call('editMessageText', {
        chat_id: msg.chat.id,
        message_id: msg.message_id,
        text: text.length > MAX_TEXT ? done : text,
        reply_markup: appOnly(),
        link_preview_options: { is_disabled: true },
      });
      await answer('');
      return res;
    },
  };
}
