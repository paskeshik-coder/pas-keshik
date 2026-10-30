/**
 * "Only what changed": turns a live screen's full list (as views.js shapes
 * it) into the difference from what the app already has. The app keeps an
 * opaque cursor from its last sync — each item's id and a short hash of it —
 * and sends it back; the answer holds the items that are new or different,
 * the ids that left, the ids in display order and the next cursor. No state
 * is kept on the server, and the cursor only ever narrows what a person is
 * sent about their own screen, so a tampered one changes nothing else.
 *
 * Used by actions.js (the gateway and LocalBackend alike).
 */

/** Longest cursor accepted (ids up to 15 digits and 8-character hashes). */
const MAX_CURSOR_CHARS = 8000;
const CURSOR_PATTERN = /^\d{1,15}\.[0-9a-f]{8}(,\d{1,15}\.[0-9a-f]{8})*$/;

/**
 * FNV-1a (32-bit) of a string, as 8 hex digits: a cheap fingerprint, not
 * a security measure.
 * @param {string} text
 */
export function fingerprint(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/**
 * The cursor sent by the app → Map id → hash; null when absent or not one
 * we made (then everything is sent).
 * @param {any} cursor
 * @returns {Map<number,string>|null}
 */
export function readCursor(cursor) {
  if (cursor === '') return new Map();
  if (typeof cursor !== 'string' || cursor.length > MAX_CURSOR_CHARS || !CURSOR_PATTERN.test(cursor)) return null;
  return new Map(cursor.split(',').map((part) => {
    const [id, hash] = part.split('.');
    return [Number(id), hash];
  }));
}

/**
 * The difference between a screen's current list and the app's cursor.
 * @template {{id:number}} T
 * @param {T[]} items the full list, in display order
 * @param {Map<number,string>|null} known from readCursor (null: the app has nothing)
 * @returns {{full:boolean, order:number[], changed:T[], removed:number[], cursor:string}}
 */
export function diffList(items, known) {
  const order = [];
  const changed = [];
  const parts = [];
  const present = new Set();
  for (const item of items) {
    const hash = fingerprint(JSON.stringify(item));
    order.push(item.id);
    present.add(item.id);
    parts.push(`${item.id}.${hash}`);
    if (!known || known.get(item.id) !== hash) changed.push(item);
  }
  const removed = known ? [...known.keys()].filter((id) => !present.has(id)) : [];
  return { full: !known, order, changed, removed, cursor: parts.join(',') };
}
