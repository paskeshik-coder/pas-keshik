/**
 * Where a launch opens (spec: Drawer at start). A normal launch (the bot's
 * menu button, the direct link) opens on جستجو with the drawer already open.
 * A launch from a bot message's button goes straight to its target without
 * the drawer: ?request=<id> (an alert: that request, with the board one step
 * back) or ?screen=myRequests | myOffers | board (a confirmation, an
 * arrangement, a cancellation, the daily summary…). The bot builds those
 * addresses (telegram-helpers.js miniAppUrl).
 */

/** Screens a bot button may open directly. */
export const LAUNCH_SCREENS = Object.freeze(['board', 'myRequests', 'myOffers']);

/**
 * @param {string} search the page address's query (window.location.search)
 * @returns {{screen:string, request:number|null, drawer:boolean}}
 */
export function launchTarget(search) {
  const params = new URLSearchParams(search);
  const request = Number(params.get('request'));
  if (Number.isSafeInteger(request) && request > 0) return { screen: 'board', request, drawer: false };
  const screen = params.get('screen');
  if (LAUNCH_SCREENS.includes(screen)) return { screen, request: null, drawer: false };
  return { screen: 'board', request: null, drawer: true };
}

/**
 * Opens a launch's target: the screen (with the drawer open for a normal
 * launch, right away, while the screen loads) and, for an alert, the
 * request on top of the board.
 * @param {any} ctx the shell's context
 * @param {{screen:string, request:number|null, drawer:boolean}} target
 */
export async function openLaunch(ctx, { screen, request, drawer }) {
  const shown = ctx.nav.reset(screen);
  if (drawer) ctx.drawer.open();
  await shown;
  if (request) await ctx.nav.push('request', { id: request });
}
