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
          <div class="intro-illustration">${
            // A page may name built-in vector art, or point at an uploaded
            // image file. The image path wins when both are present.
            page.image
              ? `<img src="${Utils.escapeHtml(page.image)}" alt="" style="width:100%;display:block">`
              : (ART.INTRO[page.illustration] || '')
          }</div>
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

      startButton.addEventListener('click', () => App.go('signup'));
    }
  },

/* ------------------------------------------------------------------------
     SCREEN: SIGN-UP
     Defined in signup.js, which is large enough to warrant its own file.
     --------------------------------------------------------------------- */
  signup: SignUpScreen,

  /* ------------------------------------------------------------------------
     SCREEN: MAIN APP
     The shell holding the header, the drawer, and whichever sub-screen is
     currently showing. Defined below in MainApp.
     --------------------------------------------------------------------- */
  main: {
    render() { return MainApp.renderShell(); },
    mount()  { MainApp.mount(); }
  }

};


/* ==========================================================================
   MAIN APP SHELL
   Everything behind sign-up lives inside one screen container, because the
   header and drawer persist while only the content between them changes.
   Rebuilding the header on every navigation would make it flicker and would
   throw away the drawer's open state.

   Sub-screens register themselves in SCREENS below and are shown with
   MainApp.show('id').
   ====================================================================== */
const MainApp = {

  /** id of the visible sub-screen. */
  current: null,

  /** Whether the drawer is open. */
  drawerOpen: false,

  /**
   * Sub-screens, keyed by the ids used in CONFIG.NAV.ITEMS.
   * Each is an object with render() and optionally mount(), matching the
   * convention used by the top-level screens.
   *
   * Screens not yet built fall back to a placeholder, so a drawer item can be
   * added before its screen exists without producing a dead tap.
   */
  SCREENS: {},

  /**
   * Placeholder for a nav item whose screen has not been written yet.
   *
   * @param   {object} item  The CONFIG.NAV.ITEMS entry.
   * @returns {object}       A screen object.
   */
  placeholderFor(item) {
    return {
      render() {
        return `<div class="placeholder">
                  <div class="placeholder-icon">${ART.NAV[item.icon] || ''}</div>
                  <div>${Utils.escapeHtml(item.label)}</div>
                  <div style="font-size:13px">این بخش در مرحله بعد ساخته می‌شود</div>
                </div>`;
      }
    };
  },


  /* ======================================================================
     SHELL MARKUP
     ================================================================== */

  renderShell() {
    const drawerConfig = CONFIG.DRAWER;

    return `
      <div class="app-header">
        <div class="app-header-row">
          <button class="app-menu-btn ripple" id="app-menu-btn"
                  aria-label="منو">${ART.NAV.menu}</button>
          <div class="app-screen-title" id="app-screen-title"></div>
        </div>
      </div>

      <div class="app-content" id="app-content"></div>

      <div class="drawer-scrim" id="drawer-scrim"></div>

      <div class="drawer" id="drawer"
           style="width:${drawerConfig.WIDTH_PERCENT}%;
                  max-width:${drawerConfig.MAX_WIDTH_PX}px">
        <div class="drawer-head" id="drawer-head"></div>
        <div class="drawer-nav" id="drawer-nav"></div>
        <div id="drawer-footer"></div>
      </div>`;
  },

  /**
   * Fill the drawer's header from the saved profile.
   *
   * Stage 2 reads the profile from this device. Stage 3 replaces that with the
   * record Supabase returns for the Telegram user; nothing else here changes.
   */
  renderDrawerHead() {
    const profile = Utils.getLocalProfile() || {};
    const fullName = [profile.firstName, profile.lastName]
      .filter(Boolean).join(' ') || '—';

    // The circle shows the family name's first letter, falling back to the
    // given name so it is never blank.
    const initial = (profile.lastName || profile.firstName || '؟').trim().charAt(0);
    const color = Utils.colorFromText(fullName, CONFIG.NAV.AVATAR_COLORS);

    // Likes are not implemented yet; zero is the honest value for a new user.
    const likes = profile.likes || 0;

    document.getElementById('drawer-head').innerHTML = `
      <div class="drawer-brand">${Utils.escapeHtml(CONFIG.NAV.BRAND)}</div>
      <div class="drawer-avatar" style="background:${color}">
        ${Utils.escapeHtml(initial)}
      </div>
      <div class="drawer-name">${Utils.escapeHtml(fullName)}</div>
      <div class="drawer-likes">
        ${Utils.toPersianDigits(likes)} ${CONFIG.NAV.LIKES_SUFFIX}
      </div>`;
  },

  /** Draw the drawer's navigation list, marking the current screen. */
  renderDrawerNav() {
    document.getElementById('drawer-nav').innerHTML = CONFIG.NAV.ITEMS.map(item => `
      <button class="drawer-item ripple ripple-dark ${item.id === this.current ? 'active' : ''}"
              data-id="${item.id}">
        ${ART.NAV[item.icon] || ''}
        <span>${Utils.escapeHtml(item.label)}</span>
      </button>
    `).join('');
  },

  /** Draw the demo-only reset control, if the flag allows it. */
  renderDrawerFooter() {
    const footer = document.getElementById('drawer-footer');

    if (!CONFIG.DEMO.SHOW_RESET_BUTTON) {
      footer.innerHTML = '';
      return;
    }

    footer.innerHTML = `
      <div class="drawer-divider"></div>
      <button class="drawer-reset ripple ripple-dark" id="drawer-reset">
        ${Utils.escapeHtml(CONFIG.DEMO.RESET_LABEL)}
      </button>`;

    document.getElementById('drawer-reset').addEventListener('click', () => {
      if (!confirm(CONFIG.DEMO.RESET_CONFIRM)) return;
      localStorage.removeItem('paskeshik_profile');
      location.reload();
    });
  },


  /* ======================================================================
     NAVIGATION
     ================================================================== */

  /**
   * Show a sub-screen inside the shell.
   *
   * @param {string} id  A key from SCREENS, matching a CONFIG.NAV.ITEMS id.
   */
  show(id) {
    const item = CONFIG.NAV.ITEMS.find(i => i.id === id);
    if (!item) { console.error('No such nav item:', id); return; }

    this.current = id;

    const screen = this.SCREENS[id] || this.placeholderFor(item);
    const content = document.getElementById('app-content');

    content.innerHTML = screen.render();
    content.scrollTop = 0;
    screen.mount?.();

    document.getElementById('app-screen-title').textContent = item.title;

    this.renderDrawerNav();
    this.bindDrawerNav();
    App.attachRipples(content);
    App.attachRipples(document.getElementById('drawer'));
  },

  /** Attach handlers to the drawer's nav buttons after each redraw. */
  bindDrawerNav() {
    document.querySelectorAll('.drawer-item').forEach(button => {
      button.addEventListener('click', () => {
        const id = button.dataset.id;
        this.closeDrawer();

        // Wait out the closing animation before swapping the content. Doing
        // both at once makes the drawer appear to slide over a screen that has
        // already changed, which reads as a glitch rather than a transition.
        setTimeout(() => {
          if (id !== this.current) this.show(id);
        }, CONFIG.DRAWER.CLOSE_MS);
      });
    });
  },


  /* ======================================================================
     DRAWER
     ================================================================== */

  openDrawer() {
    if (this.drawerOpen) return;
    this.drawerOpen = true;

    const drawer = document.getElementById('drawer');
    const scrim  = document.getElementById('drawer-scrim');

    drawer.style.setProperty('--drawer-open-ms', CONFIG.DRAWER.OPEN_MS + 'ms');
    drawer.classList.add('animated', 'open');
    scrim.classList.add('animated', 'open');
    // Any transform left over from a drag must be cleared, or it would
    // override the class and freeze the drawer mid-slide.
    drawer.style.transform = '';

    /*
      Push a history entry so Android's back gesture closes the drawer instead
      of leaving the app. The entry is marked, so the popstate handler can tell
      this apart from any other backward navigation.
    */
    history.pushState({ drawer: true }, '');
  },

  /**
   * Close the drawer.
   *
   * @param {boolean} fromHistory  True when called by the popstate handler,
   *                               in which case the history entry is already
   *                               gone and must not be popped again.
   */
  closeDrawer(fromHistory = false) {
    if (!this.drawerOpen) return;
    this.drawerOpen = false;

    const drawer = document.getElementById('drawer');
    const scrim  = document.getElementById('drawer-scrim');

    drawer.style.setProperty('--drawer-open-ms', CONFIG.DRAWER.CLOSE_MS + 'ms');
    drawer.classList.remove('open');
    scrim.classList.remove('open');
    drawer.style.transform = '';

    // Discard the entry pushed when opening, so a later back gesture leaves
    // the app as expected rather than doing nothing.
    if (!fromHistory && history.state?.drawer) history.back();
  },

  /**
   * Drag-to-open and drag-to-close.
   *
   * Two gestures share one set of handlers: a swipe starting within a narrow
   * strip of the right edge opens the drawer, and a swipe anywhere on an open
   * drawer closes it. In both cases the drawer tracks the finger directly,
   * with transitions switched off for the duration — a transition during a
   * drag puts the drawer behind the finger, which feels broken.
   */
  bindDrawerGestures() {
    const drawer = document.getElementById('drawer');
    const scrim  = document.getElementById('drawer-scrim');
    const screen = document.getElementById('screen-main');

    let startX = 0;
    let dragging = false;
    let openingGesture = false;

    screen.addEventListener('touchstart', event => {
      const touch = event.touches[0];
      const fromRightEdge =
        touch.clientX > window.innerWidth - CONFIG.DRAWER.EDGE_ZONE_PX;

      if (!this.drawerOpen && fromRightEdge) {
        dragging = true;
        openingGesture = true;
      } else if (this.drawerOpen) {
        dragging = true;
        openingGesture = false;
      } else {
        return;
      }

      startX = touch.clientX;
      drawer.classList.remove('animated');
      scrim.classList.remove('animated');
    }, { passive: true });

    screen.addEventListener('touchmove', event => {
      if (!dragging) return;

      const width = drawer.offsetWidth;
      // Rightward movement is positive. Opening drags leftward (negative),
      // closing drags rightward (positive).
      const moved = event.touches[0].clientX - startX;

      // How far the drawer is pulled out, from 0 (hidden) to 1 (fully open).
      const progress = openingGesture
        ? Math.min(1, Math.max(0, -moved / width))
        : Math.min(1, Math.max(0, 1 - moved / width));

      drawer.style.transform = `translateX(${(1 - progress) * 100}%)`;
      scrim.style.opacity = String(progress);
      scrim.style.pointerEvents = progress > 0 ? 'auto' : 'none';
    }, { passive: true });

    screen.addEventListener('touchend', event => {
      if (!dragging) return;
      dragging = false;

      const width = drawer.offsetWidth;
      const moved = (event.changedTouches[0].clientX) - startX;
      const progress = openingGesture
        ? Math.min(1, Math.max(0, -moved / width))
        : Math.min(1, Math.max(0, 1 - moved / width));

      // Clear the inline values so the open/closed classes take over again.
      drawer.style.transform = '';
      scrim.style.opacity = '';
      scrim.style.pointerEvents = '';
      drawer.classList.add('animated');
      scrim.classList.add('animated');

      // Past the commit point the gesture completes; short of it, it snaps
      // back to wherever it started.
      const committed = progress > CONFIG.DRAWER.COMMIT_FRACTION;

      if (openingGesture) {
        // drawerOpen is still false here, so this must be forced rather than
        // routed through openDrawer's early return.
        if (committed) { this.drawerOpen = false; this.openDrawer(); }
        else           { this.drawerOpen = true;  this.closeDrawer(); }
      } else {
        if (committed) { this.drawerOpen = true;  this.closeDrawer(); }
        else           { this.drawerOpen = false; this.openDrawer(); }
      }
    }, { passive: true });
  },


  /* ======================================================================
     STARTUP
     ================================================================== */

  mount() {
    this.renderDrawerHead();
    this.renderDrawerFooter();

    document.getElementById('app-menu-btn')
            .addEventListener('click', () => this.openDrawer());

    document.getElementById('drawer-scrim')
            .addEventListener('click', () => this.closeDrawer());

    this.bindDrawerGestures();

    // Android back gesture, and the browser back button, close an open drawer.
    window.addEventListener('popstate', () => {
      if (this.drawerOpen) this.closeDrawer(true);
    });

    this.show(CONFIG.NAV.DEFAULT);
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

  this.go(isNewUser ? 'intro' : 'main');
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
