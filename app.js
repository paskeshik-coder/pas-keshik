/**
 * ============================================================================
 * پاس‌کشیک — APPLICATION  (app.js)
 * ============================================================================
 * Screen definitions, navigation, and startup.
 *
 * ARCHITECTURE
 * Each screen is an object with two methods:
 *
 *     render()  returns the screen's HTML as a string
 *     mount()   runs after that HTML is on the page, to attach event handlers
 *
 * They are separate because handlers can only be attached to elements that
 * already exist. Trying to do both at once is the most common source of
 * "the button does nothing" bugs.
 *
 * Navigate with:  App.go('screenName')
 *
 * This file grows one screen at a time. Currently: logo, intro.
 * ============================================================================
 */


/* ==========================================================================
   ILLUSTRATIONS
   Inline SVG artwork for the intro screens, kept together so artwork is
   never tangled with layout code.

   These are placeholders in the correct style and palette. To replace one,
   overwrite its string with new SVG markup, or point the intro page at a
   different name in config.js. Colours use currentColor and the brand
   variables where possible so artwork follows the theme automatically.
   ====================================================================== */
const ILLUSTRATIONS = {

  // Page 1: one figure handing a clipboard to another.
  handover: `
    <svg viewBox="0 0 240 180" xmlns="http://www.w3.org/2000/svg">
      <circle cx="120" cy="92" r="72" fill="var(--brand)" opacity=".07"/>
      <!-- left figure -->
      <circle cx="72" cy="58" r="17" fill="var(--brand)"/>
      <path d="M46 142c0-16 12-28 26-28s26 12 26 28z" fill="var(--brand)"/>
      <!-- right figure -->
      <circle cx="168" cy="58" r="17" fill="var(--brand-light)"/>
      <path d="M142 142c0-16 12-28 26-28s26 12 26 28z" fill="var(--brand-light)"/>
      <!-- clipboard passing between them -->
      <rect x="100" y="76" width="40" height="50" rx="4" fill="#fff"
            stroke="var(--brand)" stroke-width="3"/>
      <rect x="112" y="70" width="16" height="10" rx="2" fill="var(--accent)"/>
      <line x1="109" y1="94"  x2="131" y2="94"  stroke="var(--brand)" stroke-width="3" stroke-linecap="round"/>
      <line x1="109" y1="105" x2="131" y2="105" stroke="var(--brand)" stroke-width="3" stroke-linecap="round"/>
      <line x1="109" y1="116" x2="123" y2="116" stroke="var(--brand)" stroke-width="3" stroke-linecap="round"/>
    </svg>`,

  // Page 2: a shield with a lock, two silhouettes held apart on either side.
  privacy: `
    <svg viewBox="0 0 240 180" xmlns="http://www.w3.org/2000/svg">
      <circle cx="120" cy="92" r="72" fill="var(--brand)" opacity=".07"/>
      <!-- separated silhouettes -->
      <circle cx="34" cy="76" r="13" fill="var(--brand)" opacity=".35"/>
      <path d="M14 122c0-12 9-21 20-21s20 9 20 21z" fill="var(--brand)" opacity=".35"/>
      <circle cx="206" cy="76" r="13" fill="var(--brand)" opacity=".35"/>
      <path d="M186 122c0-12 9-21 20-21s20 9 20 21z" fill="var(--brand)" opacity=".35"/>
      <!-- shield -->
      <path d="M120 34l44 18v34c0 30-19 52-44 60-25-8-44-30-44-60V52z" fill="var(--brand)"/>
      <!-- lock -->
      <path d="M108 92v-9a12 12 0 0124 0v9" fill="none" stroke="#fff"
            stroke-width="5" stroke-linecap="round"/>
      <rect x="102" y="92" width="36" height="28" rx="4" fill="#fff"/>
      <circle cx="120" cy="105" r="4" fill="var(--brand)"/>
    </svg>`,

  // Page 3: a figure stepping through a lit doorway.
  doorway: `
    <svg viewBox="0 0 240 180" xmlns="http://www.w3.org/2000/svg">
      <circle cx="120" cy="92" r="72" fill="var(--brand)" opacity=".07"/>
      <!-- glow behind the opening -->
      <rect x="86" y="34" width="68" height="112" rx="6" fill="var(--accent)" opacity=".30"/>
      <!-- door frame -->
      <rect x="86" y="34" width="68" height="112" rx="6" fill="none"
            stroke="var(--brand)" stroke-width="5"/>
      <!-- figure stepping through -->
      <circle cx="120" cy="76" r="15" fill="var(--brand)"/>
      <path d="M97 146c0-14 10-25 23-25s23 11 23 25z" fill="var(--brand)"/>
      <!-- forward arrow -->
      <path d="M164 90h28M182 80l10 10-10 10" fill="none" stroke="var(--brand)"
            stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`
};


/* ==========================================================================
   THEME
   Reads colours out of config.js and writes them into the CSS variables that
   styles.css reads. This indirection is what lets one edit in config.js
   recolour the whole app, and makes dark mode a single function call.
   ====================================================================== */
const Theme = {

  // Which palette is currently applied. Settings will let the user override
  // this in a later slice; for now it follows Telegram, defaulting to light.
  current: 'light',

  /**
   * Apply a colour palette to the document.
   *
   * @param {string} mode  Either 'light' or 'dark'.
   */
  apply(mode) {
    this.current = mode;

    const palette = (mode === 'dark') ? CONFIG.COLORS.DARK : CONFIG.COLORS.LIGHT;

    // Every key in the palette becomes a CSS variable. The names are converted
    // from camelCase to kebab-case because CSS variables use hyphens:
    // textPrimary here becomes --text-primary in the stylesheet.
    for (const [name, value] of Object.entries(palette)) {
      const cssName = '--' + name.replace(/[A-Z]/g, c => '-' + c.toLowerCase());
      document.documentElement.style.setProperty(cssName, value);
    }

    // Tints the phone's own status bar to match the app bar on Android.
    document.querySelector('meta[name="theme-color"]')
            ?.setAttribute('content', palette.brand);
  },

  /**
   * Decide which palette to start in.
   *
   * Order of preference: the user's saved manual choice, then Telegram's own
   * setting, then light. The manual choice wins because an explicit decision
   * should always outrank an inherited default.
   */
  initialise() {
    const savedPreference = localStorage.getItem('paskeshik_theme');
    const telegramScheme  = window.Telegram?.WebApp?.colorScheme;

    this.apply(savedPreference || telegramScheme || 'light');
  }
};


/* ==========================================================================
   SCREENS
   ====================================================================== */
const Screens = {

  /* ------------------------------------------------------------------------
     SCREEN: LOGO
     Plays on every app open. Fades a mark in, holds, fades out, then hands
     over to the intro (new user) or the main app (returning user).
     --------------------------------------------------------------------- */
  logo: {
    render() {
      const settings = CONFIG.LOGO_SCREEN;

      // Placeholder wordmark versus a real uploaded image. Swapping between
      // them is a single boolean in config.js so no markup has to change when
      // the real logo files arrive.
      const mark = settings.USE_PLACEHOLDER
        ? `<div class="logo-text">${Utils.escapeHtml(settings.PLACEHOLDER_TEXT)}</div>`
        : `<img src="${Theme.current === 'dark' ? settings.WHITE_LOGO : settings.BLACK_LOGO}"
                alt="${Utils.escapeHtml(CONFIG.GENERAL.APP_NAME)}"
                style="width:100%">`;

      return `<div id="logo-mark" style="max-width:${settings.LOGO_WIDTH_PERCENT}%">
                ${mark}
              </div>`;
    },

    async mount() {
      const settings = CONFIG.LOGO_SCREEN;
      const screen   = document.getElementById('screen-logo');
      const mark     = document.getElementById('logo-mark');

      // Pure white or pure black, per the specification — not the app's normal
      // surface colours, which are slightly tinted.
      const isDark = (Theme.current === 'dark');
      screen.style.background = isDark ? '#000000' : '#FFFFFF';
      mark.style.color        = isDark ? '#FFFFFF' : '#000000';

      // Drive the fade durations from config rather than the stylesheet, so
      // all four timing values live together in one place.
      mark.style.transitionDuration = settings.FADE_IN_MS + 'ms';

      // A frame's delay before changing opacity. Without it the browser may
      // batch the change with the initial paint and skip the transition
      // entirely — the animation would simply not appear.
      await Utils.wait(50);
      mark.style.opacity = '1';

      await Utils.wait(settings.FADE_IN_MS + settings.HOLD_MS);

      mark.style.transitionDuration = settings.FADE_OUT_MS + 'ms';
      mark.style.opacity = '0';

      await Utils.wait(settings.FADE_OUT_MS);

      App.goToStartScreen();
    }
  },


  /* ------------------------------------------------------------------------
     SCREEN: INTRO
     Horizontally swipeable pages built from CONFIG.INTRO.PAGES. The page
     count is never hard-coded — dots, button timing and swipe bounds are all
     derived from the length of that list, so adding a page in config.js
     requires no change here.
     --------------------------------------------------------------------- */
  intro: {
    render() {
      const pages = CONFIG.INTRO.PAGES;

      const pagesHtml = pages.map(page => `
        <div class="intro-page">
          <div class="intro-illustration">${ILLUSTRATIONS[page.illustration] || ''}</div>
          <h2 class="intro-title">${Utils.escapeHtml(page.title)}</h2>
          <p class="intro-text">${Utils.escapeHtml(page.text)}</p>
        </div>
      `).join('');

      const dotsHtml = pages.map((_, index) =>
        `<div class="intro-dot ${index === 0 ? 'active' : ''}"></div>`
      ).join('');

      return `
        <div class="intro-track" id="intro-track">${pagesHtml}</div>
        <div class="intro-footer">
          <div class="intro-dots" id="intro-dots">${dotsHtml}</div>
          <div class="intro-hint" id="intro-hint">${Utils.escapeHtml(CONFIG.INTRO.SWIPE_HINT)}</div>
          <button class="btn btn-primary btn-block ripple" id="intro-start">
            ${Utils.escapeHtml(CONFIG.INTRO.START_BUTTON)}
          </button>
        </div>`;
    },

    mount() {
      const track      = document.getElementById('intro-track');
      const dots       = document.querySelectorAll('.intro-dot');
      const hint       = document.getElementById('intro-hint');
      const startButton = document.getElementById('intro-start');
      const lastIndex  = CONFIG.INTRO.PAGES.length - 1;

      /*
        RTL note: with dir="rtl" the track scrolls from right to left, so
        scrollLeft counts downward into negative numbers as the user advances.
        Math.abs normalises that, which keeps this code working unchanged if
        the app is ever run left-to-right.
      */
      const updateForScrollPosition = () => {
        const pageWidth = track.clientWidth;
        const index = Math.round(Math.abs(track.scrollLeft) / pageWidth);

        dots.forEach((dot, i) => dot.classList.toggle('active', i === index));

        // The button appears only on the final page; the swipe hint retires
        // at the same moment, since there is nothing left to swipe to.
        const onLastPage = (index === lastIndex);
        startButton.classList.toggle('visible', onLastPage);
        hint.classList.toggle('hidden', onLastPage);
      };

      track.addEventListener('scroll', updateForScrollPosition, { passive: true });

      startButton.addEventListener('click', () => {
        // Sign-up does not exist yet. Announcing that plainly is better than
        // a dead button that leaves you wondering whether it registered.
        alert('صفحه ثبت‌نام در مرحله بعد ساخته می‌شود.');
      });
    }
  }

};


/* ==========================================================================
   APPLICATION CONTROLLER
   Owns navigation and startup. The single place that decides which screen is
   on screen, so screens never need to know about one another.
   ====================================================================== */
const App = {

  /**
   * Show a screen, replacing whatever was there.
   *
   * @param {string} name  A key from the Screens object above.
   */
  go(name) {
    const screen = Screens[name];
    if (!screen) {
      console.error('No such screen:', name);
      return;
    }

    // Hide every screen, then reveal only the requested one.
    document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));

    const container = document.getElementById('screen-' + name);
    container.innerHTML = screen.render();
    container.classList.add('active');

    // Reset scroll — otherwise a screen revisited later would reappear
    // halfway down where it was last left.
    container.scrollTop = 0;

    screen.mount?.();
    this.attachRipples(container);
  },

  /**
   * Decide where to send the user once the logo animation finishes.
   *
   * Someone with no saved profile is new and sees the intro; everyone else
   * goes straight to the main app. The demo switch forces the intro path so
   * it can be reviewed without clearing browser storage every time.
   */
  goToStartScreen() {
    const isNewUser = CONFIG.DEMO.ALWAYS_SHOW_INTRO || !Utils.getLocalProfile();

    if (isNewUser) {
      this.go('intro');
    } else {
      // Main app arrives in a later slice.
      this.go('intro');
    }
  },

  /**
   * Give every element marked class="ripple" inside a container its Material
   * touch feedback.
   *
   * The circle is sized to the element's longest dimension and centred on the
   * point of contact, then removed once its animation finishes so repeated
   * taps cannot accumulate leftover elements in the page.
   *
   * @param {HTMLElement} container  Where to look for ripple targets.
   */
  attachRipples(container) {
    container.querySelectorAll('.ripple').forEach(element => {
      element.addEventListener('click', event => {
        const bounds = element.getBoundingClientRect();
        const size   = Math.max(bounds.width, bounds.height);

        const circle = document.createElement('span');
        circle.className = 'ripple-circle';
        circle.style.width  = circle.style.height = size + 'px';
        circle.style.left   = (event.clientX - bounds.left - size / 2) + 'px';
        circle.style.top    = (event.clientY - bounds.top  - size / 2) + 'px';

        element.appendChild(circle);
        circle.addEventListener('animationend', () => circle.remove());
      });
    });
  },

  /**
   * Entry point. Runs once, when the page has finished loading.
   */
  start() {
    const telegram = window.Telegram?.WebApp;

    // Telegram wants to be told the page is ready, and asked for full height.
    // Guarded because in Stage 2 we are usually running in a normal browser.
    if (telegram?.ready) {
      telegram.ready();
      telegram.expand();
    }

    // Optional gate, off during Stage 2 so screens can be previewed in Chrome.
    const insideTelegram = telegram && telegram.platform !== 'unknown';
    if (CONFIG.GENERAL.ENFORCE_TELEGRAM && !insideTelegram) {
      document.getElementById('screen-blocked').classList.add('active');
      return;
    }

    Theme.initialise();

    if (CONFIG.DEMO.SKIP_LOGO) {
      this.goToStartScreen();
    } else {
      this.go('logo');
    }
  }
};


// Wait for the document before touching any element. Without this guard the
// script could run before the screen containers exist in the page.
document.addEventListener('DOMContentLoaded', () => App.start());
