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
    /*
      true  = intro screens appear on every load, useful while designing them
      false = intro appears only for someone with no saved profile

      Set this to false to test the returning-user path: a saved profile then
      takes you straight to the main app, and the reset button in the drawer
      puts you back at the intro.
    */
    ALWAYS_SHOW_INTRO: false,

    /*
      Shows a "clear my data" button at the foot of the drawer. It deletes the
      locally saved profile so the sign-up flow can be run again without
      clearing browser data by hand.

      Set to false before this ever reaches real users.
    */
    SHOW_RESET_BUTTON: true,
    RESET_LABEL: 'پاک کردن اطلاعات (فقط برای تست)',
    RESET_CONFIRM: 'اطلاعات ذخیره‌شده روی این دستگاه پاک شود؟',

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
  /* ==========================================================================
     SECTION 6 — SIGN-UP
     A five-page wizard. Every label, hint, error message and list option is
     defined here so the wording can be changed without opening any logic.

     PAGE ORDER is fixed in signup.js; the content of each page is below.
     ====================================================================== */
  SIGNUP: {

    // Shared button labels.
    NEXT_BUTTON: 'بعدی',
    BACK_BUTTON: 'قبلی',
    SUBMIT_BUTTON: 'ثبت‌نام',

 /*
      DECORATIVE MOTIF
      A large translucent brand circle and a small solid amber dot, drifting
      between corners as the user advances. They live in the wizard shell
      rather than in the page body, so page content can fade while they keep
      moving — the motif reads as one continuous object travelling across a
      changing page, not as decoration that blinks out and reappears.

      Each has its own list of corners and its own travel time, so they never
      look welded together.

      Corner codes: first letter t/b = top/bottom, second l/r = left/right.
    */
    DECOR: {
      // Corner per page, in page order.
      ARC_POSITIONS: ['tl', 'tr', 'br', 'bl', 'tr'],
      DOT_POSITIONS: ['tr', 'bl', 'tl', 'tr', 'tl'],

      /*
        The circle is deliberately large and mostly hidden. A 190px circle
        half off the edge reads as a semicircle; a 280px circle with three
        quarters hidden reads as a shallow slice, which is what was wanted.

        HIDE_Y / HIDE_X are the fraction of the circle pushed off each edge.
        Raise them to show less of it, lower them to show more.
      */
      ARC_SIZE: 280,
      ARC_HIDE_Y: 0.74,
      ARC_HIDE_X: 0.50,
      ARC_OPACITY: 0.11,

      // The dot sits fully on screen, measured in from the corner.
      DOT_SIZE: 15,
      DOT_INSET_X: 36,
      DOT_INSET_Y: 104,

      /*
        Travel times, in milliseconds. Different values are the point: matched
        durations would make the two shapes look like one rigid object being
        dragged around. The dot arrives first and settles while the circle is
        still moving.
      */
      ARC_MOVE_MS: 950,
      DOT_MOVE_MS: 620,

      // Page content fades out, swaps, fades in. Kept well short of the
      // shorter travel time so the motif is visibly still moving underneath.
      CONTENT_FADE_OUT_MS: 170,
      CONTENT_FADE_IN_MS: 260
    },


    /* ---- PAGE 1: name ---------------------------------------------------- */
    PAGE_NAME: {
      TITLE: 'نام شما چیست؟',
      FIRST_LABEL: 'نام',
      LAST_LABEL: 'نام خانوادگی',
      HINT: 'به فارسی',
      ERROR_EMPTY: 'این فیلد الزامی است',
      ERROR_PERSIAN: 'فقط حروف فارسی مجاز است',
      ERROR_TOO_SHORT: 'حداقل ۲ حرف وارد کنید',
      PRIVACY_NOTE: 'نام شما در هیچ کجای برنامه به‌صورت عمومی نمایش داده نمی‌شود.'
    },


    /* ---- PAGE 2: major --------------------------------------------------- */
    PAGE_MAJOR: {
      TITLE: 'رشته تحصیلی',
      SUBTITLE: 'بکشید و انتخاب کنید',
      TAP_HINT: 'برای انتخاب، روی کارت بزنید',

      /*
        To add a major: copy a line below, then add a matching icon under
        MAJORS in illustrations.js using the same `icon` name.

        `id` is what gets stored in the database. Never change an existing id
        once real users exist — their saved records point at it. `label` is
        display text and is safe to reword at any time.

        `hasWards` controls whether the ward dropdown appears when this user
        creates a request. Only medicine and nursing use wards.
      */
      MAJORS: [
        { id: 'medicine',  label: 'پزشکی',    icon: 'medicine',  hasWards: true  },
        { id: 'nursing',   label: 'پرستاری',  icon: 'nursing',   hasWards: true  },
        { id: 'midwifery', label: 'مامایی',   icon: 'midwifery', hasWards: false },
        { id: 'pharmacy',  label: 'داروسازی', icon: 'pharmacy',  hasWards: false }
      ]
    },


    /* ---- PAGE 3: entry year and semester --------------------------------- */
    PAGE_YEAR: {
      TITLE: 'سال ورود',
      YEAR_LABEL: 'سال',
      SEMESTER_LABEL: 'نیمسال',

      /*
        The year list is computed from the current Persian year rather than
        written out, so it stays correct after every Nowruz with no edit.

        With the current year 1405, these settings offer 1395 to 1400.
        MIN_YEARS_AGO is the most recent year offered, MAX_YEARS_AGO the
        oldest. DEFAULT_YEARS_AGO decides where the wheel opens.
      */
      MIN_YEARS_AGO: 5,
      MAX_YEARS_AGO: 10,
      DEFAULT_YEARS_AGO: 7,

      SEMESTERS: [
        { id: 'mehr',   label: 'مهر' },
        { id: 'bahman', label: 'بهمن' }
      ]
    },


    /* ---- PAGE 4: university ---------------------------------------------- */
    PAGE_UNIVERSITY: {
      TITLE: 'دانشگاه',
      SEARCH_PLACEHOLDER: 'نام دانشگاه را جستجو کنید',
      SUGGESTIONS_LABEL: 'پیشنهاد',
      NO_RESULTS: 'دانشگاهی با این نام پیدا نشد',

      /*
        PLACEHOLDER LIST — replace with your real one.

        Each entry pairs a university with its city. The city is never asked
        for directly; it is derived from this pairing. That is what lets the
        search board scope to the user's city, and lets the university filter
        offer only the universities in it.

        `id` is stored in the database and must stay stable once real users
        exist. `name` and `city` are display text and safe to reword.

        To add one: copy a line, give it an id no other entry uses.
      */
      UNIVERSITIES: [
        { id: 'tums',      name: 'علوم پزشکی تهران',            city: 'تهران' },
        { id: 'sbmu',      name: 'علوم پزشکی شهید بهشتی',       city: 'تهران' },
        { id: 'iums',      name: 'علوم پزشکی ایران',            city: 'تهران' },
        { id: 'abzums',    name: 'علوم پزشکی البرز',            city: 'کرج' },
        { id: 'mui',       name: 'علوم پزشکی اصفهان',           city: 'اصفهان' },
        { id: 'mums',      name: 'علوم پزشکی مشهد',             city: 'مشهد' },
        { id: 'sums',      name: 'علوم پزشکی شیراز',            city: 'شیراز' },
        { id: 'tbzmed',    name: 'علوم پزشکی تبریز',            city: 'تبریز' },
        { id: 'ajums',     name: 'علوم پزشکی جندی‌شاپور اهواز', city: 'اهواز' },
        { id: 'kmu',       name: 'علوم پزشکی کرمان',            city: 'کرمان' },
        { id: 'ssu',       name: 'علوم پزشکی شهید صدوقی یزد',   city: 'یزد' },
        { id: 'gums',      name: 'علوم پزشکی گیلان',            city: 'رشت' },
        { id: 'mazums',    name: 'علوم پزشکی مازندران',         city: 'ساری' },
        { id: 'kums',      name: 'علوم پزشکی کرمانشاه',         city: 'کرمانشاه' },
        { id: 'umsha',     name: 'علوم پزشکی همدان',            city: 'همدان' }
      ],

      // Shown as tappable chips before the user types anything, so the most
      // common answers need no typing at all. Values are ids from the list.
      SUGGESTED: ['tums', 'sbmu', 'iums', 'mui', 'mums']
    },


    /* ---- PAGE 5: phone and invite code ----------------------------------- */
    PAGE_CONTACT: {
      TITLE: 'شماره تماس',
      PHONE_LABEL: 'شماره تلفن همراه',

      /*
        The prefix is fixed in the field rather than typed. Every Iranian
        mobile number begins 09, so showing it as part of the field means the
        user types 9 digits instead of 11 and cannot enter a wrong prefix —
        a whole class of validation error simply cannot occur.
      */
      PHONE_PREFIX: '09',
      PHONE_REMAINING_DIGITS: 9,
      PHONE_HINT: '۹ رقم باقی‌مانده را وارد کنید',
      PHONE_ERROR: 'شماره تلفن باید ۱۱ رقم باشد',

      INVITE_TOGGLE: 'کد دعوت دارید؟',
      INVITE_LABEL: 'کد دعوت',
      INVITE_LENGTH: 6,
      // Case is significant: K7mR2X and k7mr2x are different codes.
      INVITE_HINT: 'کد ۶ کاراکتری — به بزرگ و کوچک بودن حروف دقت کنید',
      INVITE_ERROR: 'کد دعوت باید ۶ کاراکتر باشد',

      PRIVACY_NOTE: 'شماره شما فقط پس از پذیرفتن یک پیشنهاد، برای طرف مقابل نمایش داده می‌شود.'
    },


    /* ---- Validation ------------------------------------------------------ */
    VALIDATION: {
      /*
        Characters permitted in name fields. Written out as a literal list
        rather than a Unicode range because the Arabic Unicode block also
        contains digits and punctuation that must not be allowed through.

        Includes a space and the zero-width non-joiner, so «محمد رضا» and
        «سیدحسینی» with a نیم‌فاصله both pass.
      */
      PERSIAN_LETTERS: 'آأإئءابپتثجچحخدذرزژسشصضطظعغفقکگلمنوهیةيك\u200C ',
      NAME_MIN_LENGTH: 2,
      NAME_MAX_LENGTH: 30
    }

  },
  /* ==========================================================================
     SECTION 7 — MAIN APP NAVIGATION
     ====================================================================== */
  NAV: {
    // Shown at the top of the drawer. The header bar carries only the current
    // screen's name, so this is where the app identifies itself.
    BRAND: 'پاس‌کشیک',

    /*
      Drawer items, in display order.

      `id`    routes to the matching entry in MainApp.SCREENS and must match it.
      `label` is display text, safe to reword at any time.
      `title` is what appears in the header bar. Usually the same as `label`,
              but kept separate so a long drawer label can have a short header.
      `icon`  names an SVG under ART.NAV in illustrations.js.

      Reordering means moving a whole line. Removing one hides that screen
      entirely without breaking anything that does not link to it.
    */
    ITEMS: [
      { id: 'search',   label: 'جستجو',            title: 'جستجو',            icon: 'search' },
      { id: 'requests', label: 'درخواست‌های من',    title: 'درخواست‌های من',    icon: 'clipboard' },
      { id: 'offers',   label: 'پیشنهادهای من',    title: 'پیشنهادهای من',    icon: 'briefcase' },
      { id: 'invite',   label: 'کد دعوت',          title: 'کد دعوت',          icon: 'ticket' },
      { id: 'contact',  label: 'تماس با ما',       title: 'تماس با ما',       icon: 'mail' },
      { id: 'settings', label: 'تنظیمات',          title: 'تنظیمات',          icon: 'gear' }
    ],

    // Screen shown when the app opens.
    DEFAULT: 'search',

    /*
      Avatar colours. The circle takes its colour from a hash of the user's
      name, so the same person always gets the same one. Derived rather than
      fixed because avatars will later appear against other people's bids,
      where a single shared colour would make everyone look identical.

      These are Material 500-weight colours, chosen to hold white text.
    */
    AVATAR_COLORS: [
      '#D32F2F', '#C2185B', '#7B1FA2', '#512DA8', '#303F9F',
      '#0288D1', '#00796B', '#388E3C', '#F57C00', '#5D4037'
    ],

    LIKES_SUFFIX: '❤️'
  },


  /* ==========================================================================
     SECTION 8 — DRAWER BEHAVIOUR
     ====================================================================== */
  DRAWER: {
    // Drawer width as a percentage of screen width, capped in pixels so it
    // does not become absurdly wide on a tablet.
    WIDTH_PERCENT: 78,
    MAX_WIDTH_PX: 320,

    OPEN_MS: 260,
    CLOSE_MS: 200,

    /*
      How far in from the right edge a swipe must begin to count as opening
      the drawer, in pixels. Deliberately narrow: the search screen has
      horizontally scrolling filter chips, and a wide capture zone would
      swallow the start of every attempt to scroll them.
    */
    /*
      Edge-swipe to open the drawer, off by default.

      Android's system back gesture claims both screen edges at the OS level
      and receives the touch before the page does, so an edge swipe usually
      closes the app instead of opening the drawer. This is not something a web
      page can override, and it applies equally inside Telegram, which is also
      a WebView.

      A gesture that works occasionally is worse than none: it teaches people
      the interface is unreliable. The hamburger button is always there and
      always works.

      Set to true to re-enable, and raise EDGE_ZONE_PX if you do — though it
      will still lose to the system gesture nearest the edge.
    */
    EDGE_SWIPE_ENABLED: false,
    EDGE_ZONE_PX: 26,

    // Fraction of the drawer's width a drag must cross before releasing
    // completes the gesture rather than snapping back.
    COMMIT_FRACTION: 0.4
  },
  // Jalali month names, in order. Used wherever a date is written out.
  JALALI_MONTHS: [
    'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
    'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
  ],


  /* ==========================================================================
     SECTION 9 — SEARCH SCREEN
     The public board. Every active request the current user is eligible to
     cover appears here.

     SCOPE, not filters: the board only ever shows requests from the user's own
     city and own رشته. Neither is shown on a card or offered as a filter,
     because every card would carry the same two values.
     ====================================================================== */
  SEARCH: {
    FILTER_UNIVERSITY_ALL: 'همه دانشگاه‌های',   // city name is appended
    FILTER_WARD_ALL: 'همه بخش‌ها',

    // Card content.
    START_LABEL: 'شروع',
    END_LABEL: 'پایان',
    // [X] is replaced with the current lowest bid. Hidden entirely when a
    // request has no bids yet.
    LOWEST_BID_TEXT: 'پایین‌ترین قیمت پیشنهاد داده شده در حال حاضر [X] تومان است.',

    BID_BUTTON: 'پیشنهاد قیمت',
    BID_BUTTON_ALREADY: 'پیشنهاد داده‌اید',
    OWN_REQUEST_LABEL: 'درخواست شما',

    // Boost badge and the note shown when it is tapped.
    BOOST_BADGE: 'تبلیغ',
    BOOST_EXPLANATION: 'این درخواست توسط کاربری که دیگران را به پاس‌کشیک دعوت کرده بالای لیست نمایش داده می‌شود. برای اطلاعات بیشتر به بخش کد دعوت مراجعه کنید.',

    // Empty states. The board can legitimately be empty for a long time in a
    // small city, so this needs to explain rather than just say "nothing".
    EMPTY_TITLE: 'در حال حاضر درخواستی وجود ندارد',
    EMPTY_TEXT: 'هنوز کسی در شهر و رشته شما درخواست کشیک ثبت نکرده است. بعداً دوباره سر بزنید.',
    EMPTY_FILTERED_TITLE: 'نتیجه‌ای یافت نشد',
    EMPTY_FILTERED_TEXT: 'با این فیلترها درخواستی پیدا نشد. فیلترها را تغییر دهید.',

    // Bid dialog.
    BID_TITLE: 'پیشنهاد قیمت',
    BID_EXPLANATION: 'مبلغی که حاضرید در ازای پوشش این کشیک دریافت کنید را وارد کنید.',
    BID_PLACEHOLDER: 'مبلغ به تومان',
    BID_SUBMIT: 'ثبت پیشنهاد',
    BID_CANCEL: 'انصراف',
    // Eight digits, as agreed. Zero is permitted: covering a friend's shift
    // for nothing is a real case and not an error.
    BID_MAX_DIGITS: 8,
    BID_ERROR_EMPTY: 'مبلغ را وارد کنید',
    BID_SUCCESS: 'پیشنهاد شما ثبت شد.',

    /*
      WARD LISTS — placeholders, replace with your own.

      Two separate lists that happen to hold the same values today. Kept apart
      deliberately so medicine and nursing wards can diverge later without one
      edit disturbing the other.

      Only users whose رشته has hasWards set see the ward filter at all.
    */
    WARDS: {
      medicine: [
        { id: 'emergency', label: 'اورژانس' },
        { id: 'internal',  label: 'داخلی' },
        { id: 'surgery',   label: 'جراحی' },
        { id: 'pediatrics',label: 'اطفال' },
        { id: 'obgyn',     label: 'زنان و زایمان' },
        { id: 'icu',       label: 'آی‌سی‌یو' },
        { id: 'ccu',       label: 'سی‌سی‌یو' },
        { id: 'psychiatry',label: 'روان‌پزشکی' }
      ],
      nursing: [
        { id: 'emergency', label: 'اورژانس' },
        { id: 'internal',  label: 'داخلی' },
        { id: 'surgery',   label: 'جراحی' },
        { id: 'pediatrics',label: 'اطفال' },
        { id: 'obgyn',     label: 'زنان و زایمان' },
        { id: 'icu',       label: 'آی‌سی‌یو' },
        { id: 'ccu',       label: 'سی‌سی‌یو' },
        { id: 'psychiatry',label: 'روان‌پزشکی' }
      ]
    }
  },
  GENERAL: {
    APP_NAME: 'پاس‌کشیک',

    // Shown when the app is opened in a normal browser instead of Telegram.
    // Disabled during Stage 2 so you can preview screens in Chrome; we turn
    // this on in Stage 3 once the Telegram connection is real.
    ENFORCE_TELEGRAM: false,
    OUTSIDE_TELEGRAM_MESSAGE: 'لطفاً پاس‌کشیک را از داخل تلگرام باز کنید.'
  }

};
