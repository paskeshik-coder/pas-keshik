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
      const isDark   = (Theme.current === 'dark');

      // Three artwork sources, selected by MODE in config.js.
      let mark;
      if (settings.MODE === 'image') {
        const src = isDark ? settings.WHITE_LOGO : settings.BLACK_LOGO;
        mark = `<img src="${Utils.escapeHtml(src)}" alt=""
                     style="width:100%;height:100%;object-fit:contain;display:block">`;
      } else if (settings.MODE === 'text') {
        mark = `<div class="logo-text">${Utils.escapeHtml(settings.PLACEHOLDER_TEXT)}</div>`;
      } else {
        // Default: the inline vector. Inlined rather than loaded as a file so
        // there is no network request that could finish after the fade began.
        mark = ART.LOGO;
      }

      // Both size limits are applied at once; the tighter one wins.
      return `<div id="logo-mark"
                   style="max-width:${settings.MAX_WIDTH_PERCENT}%;
                          max-height:${settings.MAX_HEIGHT_VH}vh">
                ${mark}
              </div>`;
    },

    async mount() {
      const settings = CONFIG.LOGO_SCREEN;
      const screen   = document.getElementById('screen-logo');
      const mark     = document.getElementById('logo-mark');

      // Pure white or pure black per the specification, not the app's normal
      // surface colours. The text colour is what the inline SVG picks up
      // through currentColor, which is how one logo serves both modes.
      const isDark = (Theme.current === 'dark');
      screen.style.background = isDark ? '#000000' : '#FFFFFF';
      mark.style.color        = isDark ? '#FFFFFF' : '#000000';

      /*
        Committing the starting state before animating.

        Transitions only run when the browser has already painted the previous
        value. This element was created milliseconds ago, so we disable the
        transition, set opacity to 0, then read offsetWidth — a measurement the
        browser cannot answer without laying the page out, which forces that
        value to be committed. Only then is the transition re-enabled.

        Reading offsetWidth purely for its side effect looks odd, which is why
        it is worth saying plainly: the read is the point, not the number.
      */
      mark.style.transition = 'none';
      mark.style.opacity    = '0';
      void mark.offsetWidth;

      mark.style.transition = `opacity ${settings.FADE_IN_MS}ms var(--ease)`;

      // One painted frame, so the change below is seen as a change.
      await Utils.nextFrame();
      mark.style.opacity = '1';

      await Utils.wait(settings.FADE_IN_MS + settings.HOLD_MS);

      mark.style.transition = `opacity ${settings.FADE_OUT_MS}ms var(--ease)`;
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
