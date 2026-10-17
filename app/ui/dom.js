/**
 * Tiny DOM builder. The only way screens create elements.
 *
 * Security: text is always inserted as text (textContent / text nodes), so
 * anything a user typed — names, places — can never become markup. There is
 * deliberately no way to pass HTML, and inline styles are not supported
 * (the Content-Security-Policy forbids them anyway).
 */

/**
 * Appends children: strings/numbers become text nodes; arrays are flattened;
 * null/undefined/false are skipped.
 * @param {Element} parent
 * @param {any[]} children
 */
export function append(parent, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    parent.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return parent;
}

// Properties set directly on the element rather than as attributes.
const PROPS = new Set(['value', 'checked', 'disabled', 'selected', 'hidden']);

/**
 * Creates an element.
 *   h('button', { class: 'btn', onClick: fn }, 'متن')
 * Keys: class, text, dataset, on<Event> (listener), value/checked/disabled/
 * selected/hidden (properties), anything else becomes an attribute.
 * @param {string} tag
 * @param {Record<string, any>|null} [props]
 * @param {...any} children
 * @returns {HTMLElement}
 */
export function h(tag, props = null, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key === 'text') el.textContent = String(value);
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (PROPS.has(key)) el[key] = value;
    else if (key === 'style' || key === 'innerHTML' || key.startsWith('on')) throw new Error(`h(): "${key}" is not allowed`);
    else el.setAttribute(key, value === true ? '' : String(value));
  }
  return append(el, children);
}

/**
 * Replaces all children of an element.
 * @param {Element} el
 * @param {...any} children
 */
export function replace(el, ...children) {
  el.replaceChildren();
  return append(el, children);
}

/**
 * A button that disables itself while its async handler runs, so a double
 * tap can't send the same request twice.
 * @param {Record<string, any>} props must include onClick (may be async)
 * @param {...any} children
 */
export function actionButton(props, ...children) {
  const { onClick, ...rest } = props;
  const button = h('button', { type: 'button', ...rest }, ...children);
  button.addEventListener('click', async () => {
    if (button.disabled) return;
    button.disabled = true;
    try {
      await onClick();
    } finally {
      if (button.isConnected) button.disabled = false;
    }
  });
  return button;
}
