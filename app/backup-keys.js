/**
 * The backups' keys and encryption, shared by keygen.html (in the owner's
 * phone browser) and the backup and restore workflows (scripts/backup.js,
 * Node). Only the Web Crypto API (globalThis.crypto.subtle), so the same
 * code runs in both and nothing is ever sent anywhere.
 *
 * Keys: an RSA-OAEP (SHA-256, 4096-bit) pair made on the owner's phone.
 *  - The public key (one line of text) only locks backups; it is the
 *    BACKUP_PUBLIC_KEY repository secret.
 *  - The private key never exists in the clear outside the phone's memory
 *    and a restore job: keygen.html saves it as one line of text locked with
 *    a key code (PBKDF2-SHA256, 600 000 rounds → AES-256-GCM). The owner
 *    keeps the file in Google Drive and the key code on paper; a restore
 *    needs both, given as the temporary BACKUP_PRIVATE_KEY and
 *    BACKUP_KEY_CODE secrets.
 *
 * A backup file: a fresh random AES-256-GCM key encrypts the (already
 * compressed) dump; RSA-OAEP with the public key locks that AES key:
 *   "PKBACKUP1" | key id (8 bytes) | locked-key length (2 bytes) |
 *   locked key | IV (12 bytes) | encrypted dump with its GCM tag.
 * Everything before the encrypted dump is authenticated with it. The key id
 * (the first 8 bytes of SHA-256 of the public key) lets a restore say
 * "this backup was locked with another key" instead of failing vaguely.
 */

const PUBLIC_PREFIX = 'pas-keshik-backup-public-key-1';
const PRIVATE_PREFIX = 'pas-keshik-backup-private-key-1';
const MAGIC = new TextEncoder().encode('PKBACKUP1');
const RSA = { name: 'RSA-OAEP', hash: 'SHA-256' };
const ROUNDS = 600000;
/** The key code's letters: no look-alikes (no i, l, o, 0, 1). */
const CODE_LETTERS = 'abcdefghjkmnpqrstuvwxyz23456789';
const CODE_LENGTH = 20;

const subtle = () => globalThis.crypto.subtle;

/** Base64 of bytes. @param {Uint8Array} bytes */
function toBase64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Bytes of base64 (throws a 'bad_key' error on anything else). @param {string} text */
function fromBase64(text) {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(text)) throw keyError('bad_key');
  const s = atob(text);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i += 1) out[i] = s.charCodeAt(i);
  return out;
}

/** Hex of bytes. @param {Uint8Array} bytes */
const toHex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');

/**
 * An error with a code the callers turn into a clear message:
 * bad_key (not a key of ours), wrong_code, wrong_key (the backup was locked
 * with another key), bad_backup (not a backup file, or damaged).
 * @param {'bad_key'|'wrong_code'|'wrong_key'|'bad_backup'} code
 */
function keyError(code) {
  return Object.assign(new Error(code), { code });
}

/** The 8-byte key id of a public key (SPKI bytes). @param {Uint8Array} spki */
async function keyId(spki) {
  return new Uint8Array(await subtle().digest('SHA-256', spki)).slice(0, 8);
}

/**
 * A new key code: 20 letters and digits from CODE_LETTERS (about 99 bits),
 * shown in groups of four.
 * @returns {string} e.g. "k7mp-..."
 */
export function makeKeyCode() {
  const out = [];
  // Rejection sampling keeps every letter equally likely.
  const limit = 256 - (256 % CODE_LETTERS.length);
  while (out.length < CODE_LENGTH) {
    for (const b of globalThis.crypto.getRandomValues(new Uint8Array(32))) {
      if (b < limit && out.length < CODE_LENGTH) out.push(CODE_LETTERS[b % CODE_LETTERS.length]);
    }
  }
  return out.join('').match(/.{4}/g).join('-');
}

/**
 * The key code as the lock uses it: what was written on paper may come back
 * with capitals, spaces, without the dashes or with Persian digits.
 * @param {string} code
 */
export function normalizeKeyCode(code) {
  return String(code ?? '')
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * A new key pair.
 * @returns {Promise<{publicText:string, privateKey:CryptoKey, id:string}>} id: the key id in hex
 */
export async function generateKeys() {
  const pair = await subtle().generateKey({ ...RSA, modulusLength: 4096, publicExponent: new Uint8Array([1, 0, 1]) },
    true, ['encrypt', 'decrypt']);
  const spki = new Uint8Array(await subtle().exportKey('spki', pair.publicKey));
  return { publicText: `${PUBLIC_PREFIX}:${toBase64(spki)}`, privateKey: pair.privateKey, id: toHex(await keyId(spki)) };
}

/**
 * Reads a public key's text (as pasted into BACKUP_PUBLIC_KEY).
 * @param {string} text
 * @returns {Promise<{key:CryptoKey, id:Uint8Array}>}
 */
export async function readPublicKey(text) {
  const [prefix, body, ...rest] = String(text ?? '').trim().split(':');
  if (prefix !== PUBLIC_PREFIX || !body || rest.length) throw keyError('bad_key');
  const spki = fromBase64(body);
  const key = await subtle().importKey('spki', spki, RSA, false, ['encrypt']).catch(() => { throw keyError('bad_key'); });
  return { key, id: await keyId(spki) };
}

/** The AES key a key code makes. @param {string} code @param {Uint8Array} salt @param {number} rounds */
async function codeKey(code, salt, rounds) {
  const base = await subtle().importKey('raw', new TextEncoder().encode(normalizeKeyCode(code)), 'PBKDF2', false, ['deriveKey']);
  return subtle().deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: rounds }, base,
    { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

/**
 * The private key as one line of text locked with the key code (the file
 * keygen.html saves).
 * @param {CryptoKey} privateKey
 * @param {string} id the key id in hex (from generateKeys)
 * @param {string} code
 * @returns {Promise<string>}
 */
export async function lockPrivateKey(privateKey, id, code) {
  if (normalizeKeyCode(code).length < CODE_LENGTH) throw keyError('wrong_code');
  const pkcs8 = new Uint8Array(await subtle().exportKey('pkcs8', privateKey));
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const head = `${PRIVATE_PREFIX}:${id}:${ROUNDS}:${toBase64(salt)}:${toBase64(iv)}`;
  const sealed = await subtle().encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(head) },
    await codeKey(code, salt, ROUNDS), pkcs8);
  pkcs8.fill(0);
  return `${head}:${toBase64(new Uint8Array(sealed))}`;
}

/**
 * Opens a locked private key with its key code.
 * @param {string} text the file's content (BACKUP_PRIVATE_KEY)
 * @param {string} code (BACKUP_KEY_CODE)
 * @returns {Promise<{key:CryptoKey, id:string}>}
 */
export async function unlockPrivateKey(text, code) {
  const parts = String(text ?? '').trim().split(':');
  if (parts.length !== 6 || parts[0] !== PRIVATE_PREFIX || !/^[0-9a-f]{16}$/.test(parts[1]) || !/^[0-9]{6,8}$/.test(parts[2])) {
    throw keyError('bad_key');
  }
  const [, id, rounds, salt, iv, sealed] = parts;
  const head = parts.slice(0, 5).join(':');
  let pkcs8;
  try {
    pkcs8 = await subtle().decrypt({ name: 'AES-GCM', iv: fromBase64(iv), additionalData: new TextEncoder().encode(head) },
      await codeKey(code, fromBase64(salt), Number(rounds)), fromBase64(sealed));
  } catch (e) {
    if (e?.code === 'bad_key') throw e;
    throw keyError('wrong_code');
  }
  const key = await subtle().importKey('pkcs8', pkcs8, RSA, false, ['decrypt']).catch(() => { throw keyError('bad_key'); });
  new Uint8Array(pkcs8).fill(0);
  return { key, id };
}

/**
 * Locks a backup with the public key.
 * @param {Uint8Array} data the compressed dump
 * @param {string} publicText BACKUP_PUBLIC_KEY
 * @returns {Promise<Uint8Array>}
 */
export async function encryptBackup(data, publicText) {
  const { key, id } = await readPublicKey(publicText);
  const raw = globalThis.crypto.getRandomValues(new Uint8Array(32));
  const locked = new Uint8Array(await subtle().encrypt(RSA, key, raw));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const head = new Uint8Array(MAGIC.length + 8 + 2 + locked.length + 12);
  head.set(MAGIC, 0);
  head.set(id, MAGIC.length);
  new DataView(head.buffer).setUint16(MAGIC.length + 8, locked.length);
  head.set(locked, MAGIC.length + 10);
  head.set(iv, MAGIC.length + 10 + locked.length);
  const aes = await subtle().importKey('raw', raw, 'AES-GCM', false, ['encrypt']);
  raw.fill(0);
  const body = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv, additionalData: head }, aes, data));
  const out = new Uint8Array(head.length + body.length);
  out.set(head, 0);
  out.set(body, head.length);
  return out;
}

/**
 * The key id a backup was locked with (hex), without opening it.
 * @param {Uint8Array} file
 */
export function backupKeyId(file) {
  if (file.length < MAGIC.length + 10 || !MAGIC.every((b, i) => file[i] === b)) throw keyError('bad_backup');
  return toHex(file.subarray(MAGIC.length, MAGIC.length + 8));
}

/**
 * Opens a backup with the unlocked private key.
 * @param {Uint8Array} file
 * @param {{key:CryptoKey, id:string}} privateKey from unlockPrivateKey
 * @returns {Promise<Uint8Array>} the compressed dump
 */
export async function decryptBackup(file, privateKey) {
  if (backupKeyId(file) !== privateKey.id) throw keyError('wrong_key');
  const at = MAGIC.length + 8;
  const n = new DataView(file.buffer, file.byteOffset, file.byteLength).getUint16(at);
  const headLength = at + 2 + n + 12;
  if (file.length < headLength + 16) throw keyError('bad_backup');
  const head = file.subarray(0, headLength);
  try {
    const raw = await subtle().decrypt(RSA, privateKey.key, file.subarray(at + 2, at + 2 + n));
    const aes = await subtle().importKey('raw', raw, 'AES-GCM', false, ['decrypt']);
    const iv = file.subarray(at + 2 + n, headLength);
    return new Uint8Array(await subtle().decrypt({ name: 'AES-GCM', iv, additionalData: head }, aes, file.subarray(headLength)));
  } catch {
    throw keyError('bad_backup');
  }
}
