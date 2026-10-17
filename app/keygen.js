/**
 * keygen.html: the owner makes the backups' keys on their phone, in Chrome.
 * Not linked from the app (docs/SETUP.md gives the address). Nothing on
 * this page ever goes over the network: its CSP allows no connections at
 * all, and the keys are made with the browser's own Web Crypto
 * (app/backup-keys.js).
 *
 * Making the keys:
 *  1. «ساخت کلید» makes the pair and shows a new key code, which the owner
 *     writes on paper and types back (proving the paper is right);
 *  2. «ذخیرهٔ فایل کلید خصوصی» saves the private key, locked with that
 *     code, as a .txt file in the phone's Download folder (the owner moves
 *     it to Google Drive);
 *  3. the public key is shown with «کپی کلید عمومی», for the
 *     BACKUP_PUBLIC_KEY repository secret.
 * For a restore: «انتخاب فایل کلید» opens the saved file, checks the key
 * code on the phone, and copies the file's (still locked) text for the
 * temporary BACKUP_PRIVATE_KEY secret.
 */

import { CONFIG } from '../supabase/functions/_shared/config.js?v=1.2.5';
import { followTheme } from './theme.js?v=1.2.5';
import { h, replace } from './ui/dom.js?v=1.2.5';
import { generateKeys, lockPrivateKey, makeKeyCode, normalizeKeyCode, unlockPrivateKey } from './backup-keys.js?v=1.2.5';

const K = CONFIG.text.keygen;

/** The message for an error from backup-keys.js (or anything else). @param {any} e */
const errorMessage = (e) => K.errors[e?.code] ?? K.errors.failed;

/**
 * Copies text, falling back to selecting it in its box so the owner can
 * copy it by hand.
 * @param {string} text
 * @param {HTMLTextAreaElement} box
 * @param {HTMLElement} status
 */
async function copy(text, box, status) {
  try {
    await navigator.clipboard.writeText(text);
    status.className = 'hint';
    status.textContent = K.copied;
  } catch {
    box.focus();
    box.select();
    status.className = 'error-text';
    status.textContent = K.copyFailed;
  }
}

/**
 * Saves text as a file in the phone's Download folder.
 * @param {string} name
 * @param {string} text
 */
function download(name, text) {
  const url = URL.createObjectURL(new Blob([`${text}\n`], { type: 'text/plain' }));
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/**
 * A Persian label followed by a left-to-right value (a key id, a file name),
 * so the two don't get mixed up on screen.
 * @param {HTMLElement} el
 * @param {string} label
 * @param {string} value
 */
function labelled(el, label, value) {
  replace(el, `${label} `, h('span', { class: 'ltr' }, value));
  return el;
}

/** A read-only box showing a long line of text (left to right). @param {string} text */
const textBox = (text) => h('textarea', { class: 'input ltr key-text', readOnly: true, rows: 5, value: text });

/**
 * Step 1 to 3: makes the keys and walks the owner through keeping them.
 * @param {HTMLElement} place
 */
async function makeKeys(place) {
  replace(place, h('p', { class: 'hint' }, K.making), h('div', { class: 'spinner' }));
  const keys = await generateKeys();
  const code = makeKeyCode();
  const retype = h('input', { class: 'input ltr', type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' });
  const retypeError = h('p', { class: 'error-text', hidden: true }, K.retypeWrong);
  const saveStatus = h('p', { class: 'hint', hidden: true });
  const publicPart = h('div', { hidden: true });
  const save = h('button', { class: 'btn primary block', type: 'button', disabled: true }, K.save);
  const fileName = `pas-keshik-backup-private-key-${keys.id}.txt`;

  retype.addEventListener('input', () => {
    const typed = normalizeKeyCode(retype.value);
    const same = typed === normalizeKeyCode(code);
    save.disabled = !same;
    retypeError.hidden = same || typed.length < normalizeKeyCode(code).length;
  });

  save.addEventListener('click', async () => {
    save.disabled = true;
    save.textContent = K.saving;
    try {
      download(fileName, await lockPrivateKey(keys.privateKey, keys.id, code));
      saveStatus.className = 'hint';
      replace(saveStatus, K.saved, h('br'), h('span', { class: 'ltr' }, fileName), h('br'), K.savedNext);
      publicPart.hidden = false;
    } catch (e) {
      saveStatus.className = 'error-text';
      saveStatus.textContent = errorMessage(e);
      save.disabled = false;
    }
    saveStatus.hidden = false;
    save.textContent = K.save;
  });

  const publicBox = textBox(keys.publicText);
  const copyStatus = h('p', { class: 'hint', hidden: false });
  replace(publicPart,
    h('h2', { class: 'section-title' }, K.publicTitle),
    h('p', { class: 'hint' }, K.publicHint),
    publicBox,
    h('button', { class: 'btn primary block gap-top', type: 'button', onClick: () => copy(keys.publicText, publicBox, copyStatus) }, K.copyPublic),
    copyStatus);

  replace(place,
    h('p', { class: 'note' }, K.leave),
    labelled(h('p', { class: 'hint' }), K.keyId, keys.id),
    h('h2', { class: 'section-title' }, K.codeTitle),
    h('p', { class: 'hint' }, K.codeHint),
    h('p', { class: 'key-code ltr' }, code),
    h('div', { class: 'field' }, h('label', null, K.retype), retype, retypeError),
    save,
    saveStatus,
    publicPart);
}

/**
 * For a restore: opens the saved file, checks the key code on the phone and
 * copies the file's (still locked) text.
 */
function openKey() {
  const status = h('p', { class: 'hint', hidden: true });
  const codeInput = h('input', { class: 'input ltr', type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' });
  const box = textBox('');
  const after = h('div', { hidden: true });
  const copyStatus = h('p', { class: 'hint' });
  let text = '';
  const say = (message, ok) => {
    status.className = ok ? 'hint' : 'error-text';
    status.textContent = message;
    status.hidden = false;
  };
  const file = h('input', { type: 'file', accept: '.txt,text/plain', class: 'input' });
  file.addEventListener('change', async () => {
    after.hidden = true;
    text = ((await file.files?.[0]?.text()) ?? '').trim();
    box.value = text;
  });
  const check = h('button', { class: 'btn block', type: 'button' }, K.check);
  check.addEventListener('click', async () => {
    check.disabled = true;
    check.textContent = K.checking;
    try {
      const key = await unlockPrivateKey(text, codeInput.value);
      say('', true);
      labelled(status, K.checkOk, key.id);
      after.hidden = false;
    } catch (e) {
      say(errorMessage(e), false);
      after.hidden = true;
    }
    check.disabled = false;
    check.textContent = K.check;
  });
  replace(after,
    h('p', { class: 'hint' }, K.copyFileHint),
    box,
    h('button', { class: 'btn primary block gap-top', type: 'button', onClick: () => copy(text, box, copyStatus) }, K.copyFile),
    copyStatus);
  return h('div', null,
    h('h2', { class: 'section-title' }, K.openTitle),
    h('p', { class: 'hint' }, K.openHint),
    h('div', { class: 'field' }, h('label', null, K.chooseFile), file),
    h('div', { class: 'field' }, h('label', null, K.code), codeInput),
    check,
    status,
    after);
}

/** Draws the page. */
function start() {
  const root = document.getElementById('app');
  const supported = Boolean(globalThis.crypto?.subtle && globalThis.isSecureContext !== false);
  const place = h('div');
  const make = h('button', { class: 'btn primary block', type: 'button', disabled: !supported }, K.make);
  make.addEventListener('click', async () => {
    make.hidden = true;
    try {
      await makeKeys(place);
    } catch (e) {
      replace(place, h('p', { class: 'error-text' }, errorMessage(e)));
    }
  });
  replace(root,
    h('header', { class: 'topbar' }, h('h1', { class: 'title' }, K.title)),
    h('main', { class: 'content' },
      h('p', { class: 'hint' }, K.intro),
      h('p', { class: 'hint' }, K.chrome),
      supported ? null : h('p', { class: 'error-text' }, K.errors.unsupported),
      make,
      place,
      h('hr', { class: 'gap-top' }),
      openKey()));
  document.title = K.title;
}

followTheme({ themeParams: {}, onThemeChanged: () => {} });
start();
