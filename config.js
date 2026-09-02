/**
 * ============================================================================
 * پاس‌کشیک — CENTRAL CONFIGURATION  (config.js)
 * ============================================================================
 *
 * PURPOSE
 * Every value a non-programmer might want to change lives in this one file:
 * text, colours, timings, list contents, feature switches. No other file
 * should contain a hard-coded Persian string or a hex colour.
 *
 * The reason is maintenance. When you want to reword a button six months from
 * now, you should be able to find that word here and change it without ever
 * opening a file that contains logic — where a stray keystroke could break
 * the app. Logic files read FROM this file; they never define content.
 *
 * HOW TO EDIT SAFELY
 *   - Change only what is between the 'single quotes'.
 *   - Keep the comma at the end of each line.
 *   - Never delete a name on the left of a colon; app.js looks those up by
 *     name, so renaming one breaks the screen that uses it.
 *
 * This file grows as we add screens. Each screen gets its own clearly
 * marked section below.
 * ============================================================================
 */

const CONFIG = {

  /* ==========================================================================
     SECTION 1 — DEMO SWITCHES
     Temporary flags for building and testing. All of these get removed once
     the real backend exists in Stage 3.
     ====================================================================== */
  DEMO: {
    // true  = intro screens appear on every single load (useful while designing)
    // false = intro appears only for someone with no saved profile (real behaviour)
    ALWAYS_SHOW_INTRO: true,

    // true = skip straight past the logo animation. Saves you 2 seconds on
    // every reload while we are iterating. Set to false to see the real thing.
    SKIP_LOGO: false
  },


  /* ==========================================================================
     SECTION 2 — COLOURS
     These feed the CSS variables in styles.css. Changing a value here changes
     it everywhere that colour is used, in both light and dark mode.
     ====================================================================== */
  COLORS: {
    LIGHT: {
      brand:       '#01579B',  // Deep Medical Blue — app bar, sidebar header
      brandDark:   '#013A69',  // pressed states, status bar tint
      brandLight:  '#4F83CC',  // subtle brand-tinted backgrounds
      accent:      '#FFC107',  // Amber — FAB, highlights, active indicators
      background:  '#ECEFF1',  // the page behind the cards
      surface:     '#FFFFFF',  // cards, sheets, dialogs
      textPrimary: '#212121',  // headings and body text
      textMuted:   '#6B7280',  // captions, hints, secondary information
      divider:     '#E0E0E0',  // hairlines between rows
      danger:      '#C62828',  // errors, destructive actions, reject
      success:     '#2E7D32'   // confirmations, accepted state
    },
    DARK: {
      brand:       '#0B79D0',
      brandDark:   '#01579B',
      brandLight:  '#1E88E5',
      accent:      '#FFCA28',
      background:  '#121212',  // Material dark: near-black, never pure black
      surface:     '#1E1E1E',
      textPrimary: '#ECEFF1',
      textMuted:   '#9E9E9E',
      divider:     '#2C2C2C',
      danger:      '#EF5350',
      success:     '#66BB6A'
    }
  },


  /* ==========================================================================
     SECTION 3 — LOGO SCREEN
     Shown on every app open, per your decision.
     ====================================================================== */
  LOGO_SCREEN: {
    /*
      Timings in milliseconds. 1000 = one second.
      Total = FADE_IN + HOLD + FADE_OUT, currently 2100ms.
      FADE_IN was raised from 400ms because at that speed the fade was hard to
      perceive on a phone. Lower HOLD first if it starts to feel slow.
    */
    FADE_IN_MS:  700,
    HOLD_MS:     900,
    FADE_OUT_MS: 500,

    /*
      Which logo to draw. Three choices:

        'svg'   Use the built-in vector logo in illustrations.js. Recommended.
                It is sharp at every size and colours itself automatically —
                black on the light screen, white on the dark one — so a single
                definition covers both modes.

        'image' Use uploaded picture files. Create an assets/ folder, upload
                your two images, and set the paths below. Use this only if you
                want artwork the vector version cannot express, such as a
                multi-colour or photographic mark.

        'text'  Draw PLACEHOLDER_TEXT as a wordmark. Fallback only.
    */
    MODE: 'svg',

    // Used only when MODE is 'image'. Named for how the logo LOOKS, not the
    // mode it appears in: the black logo sits on the white light-mode screen.
    BLACK_LOGO: 'assets/logo-black.png',
    WHITE_LOGO: 'assets/logo-white.png',

    // Used only when MODE is 'text'.
    PLACEHOLDER_TEXT: 'پاس‌کشیک',

    /*
      Size limits. Both are applied together, so the logo is scaled to fit
      inside whichever constraint binds first. Two limits rather than one
      because a tall narrow mark and a wide flat mark need opposite rules —
      this way a future logo of any shape still lands at a sensible size
      without anyone having to work out which dimension matters.

      MAX_WIDTH_PERCENT — share of screen width.
      MAX_HEIGHT_VH     — share of screen height.
    */
    MAX_WIDTH_PERCENT: 50,
    MAX_HEIGHT_VH: 34
  },


  /* ==========================================================================
     SECTION 4 — INTRO SCREENS
     Three swipeable pages, shown once to users who have no profile yet.

     To change wording, edit title and text below.
     To reorder pages, move a whole { ... } block — the dots and swiping
     adjust themselves automatically from the length of this list.
     To add a fourth page, copy any block and paste it before the closing ].
     ====================================================================== */
  INTRO: {
    // Text on the button at the end of the final page.
    START_BUTTON: 'شروع ثبت‌نام',

    // Shown on pages 1 and 2 to hint that swiping is possible.
    SWIPE_HINT: 'برای ادامه بکشید',

    PAGES: [
      {
        // 'illustration' names an SVG defined in app.js under ILLUSTRATIONS.
        // To swap artwork, change this name or replace that SVG's contents.
        illustration: 'handover',
        title: 'جابجایی کشیک، آسان‌تر از همیشه',
        text:  'یک تابلو اعلانات تخصصی برای کارورزان پزشکی، پرستاری، مامایی و داروسازی — بدون واسطه، سریع و مستقیم'
      },
      {
        illustration: 'privacy',
        title: 'اطلاعات شما کاملاً محرمانه است',
        text:  'نام و شماره تلفن شما در هیچ کجای برنامه نمایش داده نمی‌شود. این اطلاعات فقط پس از پذیرفتن یک پیشنهاد، برای طرف مقابل قابل مشاهده خواهد بود — و بس.'
      },
      {
        illustration: 'doorway',
        title: 'آماده‌اید؟',
        text:  'بیایید شروع کنیم. ثبت‌نام فقط چند دقیقه طول می‌کشد.'
      }
    ]
  },


  /* ==========================================================================
     SECTION 5 — GENERAL
     Strings that appear in more than one place.
     ====================================================================== */
  GENERAL: {
    APP_NAME: 'پاس‌کشیک',

    // Shown when the app is opened in a normal browser instead of Telegram.
    // Disabled during Stage 2 so you can preview screens in Chrome; we turn
    // this on in Stage 3 once the Telegram connection is real.
    ENFORCE_TELEGRAM: false,
    OUTSIDE_TELEGRAM_MESSAGE: 'لطفاً پاس‌کشیک را از داخل تلگرام باز کنید.'
  }

};
