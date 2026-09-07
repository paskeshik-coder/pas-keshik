/**
 * ============================================================================
 * پاس‌کشیک — SIGN-UP WIZARD  (signup.js)
 * ============================================================================
 * Five pages collecting: name, major, entry year, university, contact details.
 *
 * STRUCTURE
 * PAGES below is an array of page objects, each with:
 *     render()    returns that page's HTML
 *     mount()     attaches its event handlers after the HTML is on the page
 *     isValid()   returns whether بعدی should be enabled
 *
 * Reordering the wizard means moving a whole entry in that array. The progress
 * bar, the back/next buttons and the arc positions all derive from the array's
 * length and the current index, so nothing else needs adjusting.
 *
 * STATE
 * Answers accumulate in SignUp.data as the user advances, and are only written
 * anywhere on submit. Moving backward therefore preserves what was entered,
 * and abandoning the wizard leaves nothing behind.
 *
 * VALIDATION happens at two moments, deliberately different:
 *   - live, on every keystroke, to decide whether بعدی is enabled
 *   - on blur, to actually display an error message
 * Showing errors while someone is still typing their own name means being
 * told it is wrong before they have finished writing it.
 *
 * NO SWIPING ANYWHERE
 * The major carousel and the value wheels are driven by buttons. Inside a
 * Telegram Mini App a horizontal drag can be claimed by the platform's own
 * back gesture and close the whole app, which is unrecoverable and looks to
 * the user like a crash. Buttons cannot be intercepted. The sliding animation
 * is kept — only the input method changed.
 * ============================================================================
 */

const SignUp = {

  /** Collected answers. Reset by start(). */
  data: {},

  /** Zero-based index of the visible page. */
  pageIndex: 0,

  /**
   * The resize handler currently attached for the major carousel.
   *
   * Held so it can be removed before a new one is attached. Without this,
   * every visit to the major page would leave another listener behind, all
   * firing on the same event against elements that no longer exist.
   */
  _majorResizeHandler: null,


  /* ========================================================================
     VALIDATION HELPERS
     ==================================================================== */

  /**
   * Check a name field against the allowed Persian character set.
   *
   * @param   {string} value  Raw field contents.
   * @returns {string|null}   An error message, or null when valid.
   */
  validateName(value) {
    const rules = CONFIG.SIGNUP.VALIDATION;
    const page  = CONFIG.SIGNUP.PAGE_NAME;
    const text  = String(value || '').trim();

    if (!text) return page.ERROR_EMPTY;
    if (text.length < rules.NAME_MIN_LENGTH) return page.ERROR_TOO_SHORT;

    // Built from the explicit character list in config rather than a Unicode
    // range, because the Arabic block also contains digits and punctuation.
    const allowed = new RegExp(
      '^[' + rules.PERSIAN_LETTERS.replace(/[\\\]^-]/g, '\\$&') + ']+$'
    );
    if (!allowed.test(text)) return page.ERROR_PERSIAN;

    return null;
  },


  /* ========================================================================
     PAGES
     ==================================================================== */

  PAGES: [

    /* ---- PAGE 1: NAME -------------------------------------------------- */
    {
      render() {
        const page = CONFIG.SIGNUP.PAGE_NAME;
        const data = SignUp.data;

        // Builds a labelled input with a hint slot below it.
        const field = (id, label, value) => `
          <div class="field">
            <label class="field-label" for="${id}">${Utils.escapeHtml(label)}</label>
            <input class="field-input" id="${id}" type="text"
                   value="${Utils.escapeHtml(value || '')}"
                   maxlength="${CONFIG.SIGNUP.VALIDATION.NAME_MAX_LENGTH}"
                   autocomplete="off" autocorrect="off" spellcheck="false">
            <span class="field-hint" id="${id}-hint">${Utils.escapeHtml(page.HINT)}</span>
          </div>`;

        return `
          <h2 class="signup-title">${Utils.escapeHtml(page.TITLE)}</h2>
          <div style="margin-top:18px">
            ${field('first-name', page.FIRST_LABEL, data.firstName)}
            ${field('last-name',  page.LAST_LABEL,  data.lastName)}
          </div>`;
      },

      mount() {
        const page = CONFIG.SIGNUP.PAGE_NAME;

        [['first-name', 'firstName'], ['last-name', 'lastName']].forEach(
          ([id, key]) => {
            const input = document.getElementById(id);
            const hint  = document.getElementById(id + '-hint');

            // Every keystroke updates the stored value and the button state,
            // but says nothing about correctness yet.
            input.addEventListener('input', () => {
              SignUp.data[key] = input.value;
              input.classList.remove('invalid');
              hint.classList.remove('error');
              hint.textContent = page.HINT;
              SignUp.refreshNav();
            });

            // Leaving the field is the moment to report a problem: the user
            // has signalled they consider it finished.
            input.addEventListener('blur', () => {
              const error = SignUp.validateName(input.value);
              // An untouched empty field is not an error, only an unfinished one.
              if (error && input.value.trim()) {
                input.classList.add('invalid');
                hint.classList.add('error');
                hint.textContent = error;
              }
            });
          }
        );
      },

      isValid() {
        return !SignUp.validateName(SignUp.data.firstName)
            && !SignUp.validateName(SignUp.data.lastName);
      },

      // Text shown in the domed panel along the bottom of this page.
      privacyNote: () => CONFIG.SIGNUP.PAGE_NAME.PRIVACY_NOTE
    },


    /* ---- PAGE 2: MAJOR ------------------------------------------------- */
    {
      render() {
        const page = CONFIG.SIGNUP.PAGE_MAJOR;

        const cards = page.MAJORS.map(major => `
          <div class="major-card ${SignUp.data.major === major.id ? 'selected' : ''}"
               data-id="${major.id}">
            <div class="major-icon">${ART.MAJORS[major.icon] || ''}</div>
            <div class="major-name">${Utils.escapeHtml(major.label)}</div>
          </div>
        `).join('');

        /*
          Button order matters under right-to-left layout.

          In a flex row with dir="rtl" the FIRST child appears on the right.
          Cards also run right to left, so advancing to the next major moves
          the track leftward. The forward button therefore has to be the last
          child — landing on the left — and point left. Putting them the other
          way round produces arrows that point away from the direction they
          actually move.
        */
        return `
          <h2 class="signup-title">${Utils.escapeHtml(page.TITLE)}</h2>
          <p class="signup-subtitle">${Utils.escapeHtml(page.SUBTITLE)}</p>
          <div class="major-carousel">
            <button class="major-arrow ripple ripple-dark" id="major-prev"
                    aria-label="${Utils.escapeHtml(page.PREV_LABEL)}">›</button>
            <div class="major-viewport" id="major-viewport">
              <div class="major-track" id="major-track">${cards}</div>
            </div>
            <button class="major-arrow ripple ripple-dark" id="major-next"
                    aria-label="${Utils.escapeHtml(page.NEXT_LABEL)}">‹</button>
          </div>
          <p class="signup-subtitle" style="margin-top:14px">
            ${Utils.escapeHtml(page.TAP_HINT)}
          </p>`;
      },

      mount() {
        const majors   = CONFIG.SIGNUP.PAGE_MAJOR.MAJORS;
        const track    = document.getElementById('major-track');
        const viewport = document.getElementById('major-viewport');
        const cards    = [...track.querySelectorAll('.major-card')];
        const nextBtn  = document.getElementById('major-next');
        const prevBtn  = document.getElementById('major-prev');

        // Which card is centred. Selection is separate: centring only brings a
        // card into view, and a tap on it confirms the choice.
        let index = Math.max(0, majors.findIndex(m => m.id === SignUp.data.major));

        /*
          How far to slide the track to centre each card, measured once.

          Measured rather than calculated from card widths, because under
          right-to-left layout the direction of increasing position is
          reversed and the arithmetic would need to know which way round it
          is. Screen coordinates read the same in both directions.
        */
        let offsets = [];

        const measure = () => {
          // Suppress the transition while measuring, or resetting to zero
          // would animate visibly before the real offset is applied.
          track.style.transition = 'none';
          track.style.transform = 'translateX(0px)';

          const viewRect = viewport.getBoundingClientRect();
          const centre = viewRect.left + viewRect.width / 2;

          offsets = cards.map(card => {
            const rect = card.getBoundingClientRect();
            return centre - (rect.left + rect.width / 2);
          });

          // Reading offsetWidth forces the browser to lay the page out, which
          // commits the zero position. Only then can the transition be turned
          // back on without the first real move animating from the wrong place.
          void track.offsetWidth;
          track.style.transition = '';
        };

        /** Slide to the current card and restyle every card by its distance. */
        const apply = () => {
          track.style.transform = `translateX(${offsets[index] || 0}px)`;

          cards.forEach((card, i) => {
            const distance = Math.min(Math.abs(i - index), 2);
            card.style.transform = `scale(${1 - distance * 0.14})`;
            card.style.opacity = String(1 - distance * 0.45);
          });

          // Disabled rather than hidden at the ends, so the row keeps its
          // width and the cards do not shift sideways.
          nextBtn.disabled = (index >= cards.length - 1);
          prevBtn.disabled = (index <= 0);
        };

        const move = step => {
          index = Math.min(cards.length - 1, Math.max(0, index + step));
          apply();
        };

        nextBtn.addEventListener('click', () => move(1));
        prevBtn.addEventListener('click', () => move(-1));

        cards.forEach((card, i) => {
          card.addEventListener('click', () => {
            // A tap on a card off to one side means "bring this one over", not
            // "choose it" — selecting something half out of view is almost
            // always a mis-tap.
            if (i !== index) { index = i; apply(); return; }

            cards.forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            SignUp.data.major = card.dataset.id;
            SignUp.refreshNav();
          });
        });

        // Measure after the first paint, when the cards have real widths.
        requestAnimationFrame(() => { measure(); apply(); });

        /*
          Rotating the phone changes every width, so the cached offsets have to
          be taken again or the track settles in the wrong place.

          The previous handler is removed first. Adding one per visit without
          removing would leave a growing pile of listeners, all firing on the
          same event against elements that have since been replaced.
        */
        if (SignUp._majorResizeHandler) {
          window.removeEventListener('resize', SignUp._majorResizeHandler);
        }
        SignUp._majorResizeHandler = () => { measure(); apply(); };
        window.addEventListener('resize', SignUp._majorResizeHandler);
      },

      isValid() { return Boolean(SignUp.data.major); }
    },


    /* ---- PAGE 3: ENTRY YEAR AND SEMESTER ------------------------------- */
    {
      render() {
        const page = CONFIG.SIGNUP.PAGE_YEAR;

        /*
          The year list is derived from the current Persian year, so it rolls
          forward automatically at Nowruz. Ascending order reads naturally
          downward, matching how a printed list would run.
        */
        const currentYear = Jalali.currentYear();
        const years = [];
        for (let ago = page.MAX_YEARS_AGO; ago >= page.MIN_YEARS_AGO; ago--) {
          years.push(currentYear - ago);
        }
        SignUp._years = years;

        const yearItems = years.map(y => ({
          value: String(y), label: Utils.toPersianDigits(y)
        }));
        const semesterItems = page.SEMESTERS.map(s => ({
          value: s.id, label: s.label
        }));

        return `
          <h2 class="signup-title">${Utils.escapeHtml(page.TITLE)}</h2>
          <div style="margin-top:14px">
            ${SignUp.renderWheel('year', page.YEAR_LABEL, yearItems, 5)}
            ${SignUp.renderWheel('semester', page.SEMESTER_LABEL, semesterItems, 3)}
          </div>`;
      },

      mount() {
        const page  = CONFIG.SIGNUP.PAGE_YEAR;
        const years = SignUp._years;

        // Reopen on the previous answer if there is one, otherwise on the
        // configured default, which sits in the middle of the offered range.
        const defaultYear = Jalali.currentYear() - page.DEFAULT_YEARS_AGO;
        const yearIndex = Math.max(0, years.indexOf(
          Number(SignUp.data.year) || defaultYear
        ));
        const semesterIndex = Math.max(0, page.SEMESTERS.findIndex(
          s => s.id === SignUp.data.semester
        ));

        SignUp.mountWheel('year', 5, yearIndex, value => {
          SignUp.data.year = Number(value);
        });
        SignUp.mountWheel('semester', 3, semesterIndex, value => {
          SignUp.data.semester = value;
        });
      },

      // A wheel always has something under the marker, so there is nothing
      // for the user to complete here.
      isValid() { return true; }
    },


    /* ---- PAGE 4: UNIVERSITY -------------------------------------------- */
    {
      render() {
        const page = CONFIG.SIGNUP.PAGE_UNIVERSITY;

        const chips = page.SUGGESTED
          .map(id => page.UNIVERSITIES.find(u => u.id === id))
          .filter(Boolean)
          .map(u => `<button class="uni-chip ripple ripple-dark" data-id="${u.id}">
                       ${Utils.escapeHtml(u.name)}
                     </button>`)
          .join('');

        return `
          <h2 class="signup-title">${Utils.escapeHtml(page.TITLE)}</h2>
          <div style="margin-top:16px">
            <div class="uni-search-wrap">
              <span class="uni-search-icon">🔍</span>
              <input class="field-input" id="uni-search" type="text"
                     placeholder="${Utils.escapeHtml(page.SEARCH_PLACEHOLDER)}"
                     autocomplete="off" autocorrect="off" spellcheck="false">
            </div>
            <div id="uni-chips-wrap">
              <div class="field-label">${Utils.escapeHtml(page.SUGGESTIONS_LABEL)}</div>
              <div class="uni-chips">${chips}</div>
            </div>
            <div class="uni-results" id="uni-results"></div>
          </div>`;
      },

      mount() {
        const page      = CONFIG.SIGNUP.PAGE_UNIVERSITY;
        const search    = document.getElementById('uni-search');
        const results   = document.getElementById('uni-results');
        const chipsWrap = document.getElementById('uni-chips-wrap');

        /**
         * Draw the result list for the current query.
         *
         * Matching runs on folded text so that Arabic and Persian spellings of
         * the same word compare equal. Because folding preserves length, the
         * match position found in the folded string is also correct in the
         * original, which is what allows the matched letters to be highlighted
         * without any index adjustment.
         */
        const draw = () => {
          const query = Utils.foldPersian(search.value.trim());

          // Chips only make sense before typing starts.
          chipsWrap.style.display = query ? 'none' : '';

          const matches = query
            ? page.UNIVERSITIES.filter(u =>
                Utils.foldPersian(u.name).includes(query) ||
                Utils.foldPersian(u.city).includes(query))
            : page.UNIVERSITIES;

          if (!matches.length) {
            results.innerHTML =
              `<div class="uni-empty">${Utils.escapeHtml(page.NO_RESULTS)}</div>`;
            return;
          }

          results.innerHTML = matches.map(u => {
            let nameHtml = Utils.escapeHtml(u.name);

            if (query) {
              const at = Utils.foldPersian(u.name).indexOf(query);
              if (at !== -1) {
                // Escape each of the three pieces separately, then join with
                // the <mark> tags — escaping afterwards would neutralise them.
                nameHtml =
                  Utils.escapeHtml(u.name.slice(0, at)) +
                  '<mark>' + Utils.escapeHtml(u.name.slice(at, at + query.length)) + '</mark>' +
                  Utils.escapeHtml(u.name.slice(at + query.length));
              }
            }

            const chosen = SignUp.data.university === u.id ? 'selected' : '';
            return `<div class="uni-item ${chosen}" data-id="${u.id}">
                      <span class="uni-name">${nameHtml}</span>
                      <span class="uni-city">${Utils.escapeHtml(u.city)}</span>
                    </div>`;
          }).join('');
        };

        /**
         * Record a choice and reflect it in the list.
         * The city is stored alongside, since it is derived from the
         * university rather than asked for.
         */
        const choose = id => {
          const university = page.UNIVERSITIES.find(u => u.id === id);
          if (!university) return;

          SignUp.data.university     = university.id;
          SignUp.data.universityName = university.name;
          SignUp.data.city           = university.city;

          draw();
          SignUp.refreshNav();
        };

        search.addEventListener('input', draw);

        // One listener on each container rather than one per row, so rows
        // redrawn by a later search do not need re-binding.
        results.addEventListener('click', event => {
          const row = event.target.closest('.uni-item');
          if (row) choose(row.dataset.id);
        });
        chipsWrap.addEventListener('click', event => {
          const chip = event.target.closest('.uni-chip');
          if (chip) choose(chip.dataset.id);
        });

        draw();
      },

      isValid() { return Boolean(SignUp.data.university); }
    },


    /* ---- PAGE 5: PHONE AND INVITE CODE --------------------------------- */
    {
      render() {
        const page = CONFIG.SIGNUP.PAGE_CONTACT;
        const stored = SignUp.data.phone || '';

        return `
          <h2 class="signup-title">${Utils.escapeHtml(page.TITLE)}</h2>
          <div style="margin-top:18px">
            <div class="field">
              <label class="field-label" for="phone-input">
                ${Utils.escapeHtml(page.PHONE_LABEL)}
              </label>
              <div class="phone-row" id="phone-row">
                <input class="field-input" id="phone-input" type="tel"
                       inputmode="numeric" autocomplete="tel"
                       placeholder="${Utils.escapeHtml(page.PHONE_PLACEHOLDER)}"
                       value="${Utils.toPersianDigits(stored)}">
              </div>
              <span class="field-hint" id="phone-hint">
                ${Utils.escapeHtml(page.PHONE_HINT)}
              </span>
            </div>

            <button class="invite-toggle" id="invite-toggle">
              <span>${Utils.escapeHtml(page.INVITE_TOGGLE)}</span>
              <span class="chevron">▼</span>
            </button>
            <div class="invite-body" id="invite-body">
              <div class="field">
                <input class="field-input" id="invite-input" type="text"
                       maxlength="${page.INVITE_LENGTH}"
                       value="${Utils.escapeHtml(SignUp.data.inviteCode || '')}"
                       autocomplete="off" autocorrect="off"
                       autocapitalize="off" spellcheck="false">
                <span class="field-hint" id="invite-hint">
                  ${Utils.escapeHtml(page.INVITE_HINT)}
                </span>
              </div>
            </div>
          </div>`;
      },

      mount() {
        const page   = CONFIG.SIGNUP.PAGE_CONTACT;
        const input  = document.getElementById('phone-input');
        const row    = document.getElementById('phone-row');
        const hint   = document.getElementById('phone-hint');

        input.addEventListener('input', () => {
          /*
            Digits are shown in Persian while being stored in English.

            The cursor has to be restored by hand, because assigning to value
            moves it to the end — which would make editing the middle of a
            number impossible. Digit conversion is one character for one, so
            the only length change comes from characters stripped as invalid;
            shifting the cursor by that difference keeps it beside the same
            digit the user was working on.
          */
          const cursorBefore = input.selectionStart;
          const lengthBefore = input.value.length;

          const digits = Utils.digitsOnly(input.value).slice(0, page.PHONE_DIGITS);

          input.value = Utils.toPersianDigits(digits);
          const shift = input.value.length - lengthBefore;
          input.setSelectionRange(cursorBefore + shift, cursorBefore + shift);

          SignUp.data.phone = digits;

          row.classList.remove('invalid');
          hint.classList.remove('error');
          hint.textContent = page.PHONE_HINT;
          SignUp.refreshNav();
        });

        input.addEventListener('focus', () => row.classList.add('focused'));

        input.addEventListener('blur', () => {
          row.classList.remove('focused');

          const digits = Utils.digitsOnly(input.value);

          // Silence on an untouched field; an error only once something is
          // there. Both the length and the prefix are checked, since a valid
          // Iranian mobile number is eleven digits beginning 09.
          const wrongLength = digits.length !== page.PHONE_DIGITS;
          const wrongPrefix = !digits.startsWith(page.PHONE_MUST_START);

          if (digits.length && (wrongLength || wrongPrefix)) {
            row.classList.add('invalid');
            hint.classList.add('error');
            hint.textContent = page.PHONE_ERROR;
          }
        });

        // Invite code section, collapsed unless a code is already entered.
        const toggle = document.getElementById('invite-toggle');
        const body   = document.getElementById('invite-body');
        const invite = document.getElementById('invite-input');

        if (SignUp.data.inviteCode) {
          toggle.classList.add('open');
          body.classList.add('open');
        }

        toggle.addEventListener('click', () => {
          toggle.classList.toggle('open');
          body.classList.toggle('open');
          if (body.classList.contains('open')) invite.focus();
        });

        invite.addEventListener('input', () => {
          // Letters and digits only. Case is preserved deliberately: K7mR2X
          // and k7mr2x are different codes.
          invite.value = invite.value.replace(/[^A-Za-z0-9]/g, '');
          SignUp.data.inviteCode = invite.value;
        });

        invite.addEventListener('blur', () => {
          const inviteHint = document.getElementById('invite-hint');
          const value = invite.value;

          // A wrong code never blocks sign-up — it is reported and the user
          // decides whether to correct it or continue without one.
          if (value.length && value.length !== page.INVITE_LENGTH) {
            inviteHint.classList.add('error');
            inviteHint.textContent = page.INVITE_ERROR;
          } else {
            inviteHint.classList.remove('error');
            inviteHint.textContent = page.INVITE_HINT;
          }
        });
      },

      isValid() {
        const page = CONFIG.SIGNUP.PAGE_CONTACT;
        const digits = Utils.digitsOnly(SignUp.data.phone || '');
        return digits.length === page.PHONE_DIGITS
            && digits.startsWith(page.PHONE_MUST_START);
      },

      privacyNote: () => CONFIG.SIGNUP.PAGE_CONTACT.PRIVACY_NOTE
    }

  ],


  /* ========================================================================
     WHEEL COMPONENT
     Shared by the year and semester pickers, and available to the Jalali date
     picker later.

     Moved by transform rather than scrolled. A scroll container would have
     worked here, since vertical gestures do not collide with the platform
     back gesture — but the carousel had to abandon scrolling, and one
     consistent mechanism is easier to reason about than two.
     ==================================================================== */

  // Height of one row, in pixels.
  WHEEL_ITEM_HEIGHT: 42,

  /**
   * Build a wheel's markup.
   *
   * @param   {string} name          Identifier, used for the element ids.
   * @param   {string} caption       Label shown above the wheel.
   * @param   {Array}  items         [{value, label}, ...] top to bottom.
   * @param   {number} visibleRows   Rows on screen. Must be odd, so exactly
   *                                 one row can sit in the middle.
   * @returns {string}               HTML.
   */
  renderWheel(name, caption, items, visibleRows) {
    const rowHeight = this.WHEEL_ITEM_HEIGHT;
    const height    = rowHeight * visibleRows;
    // Distance from the top of the wheel down to the selected row.
    const padding   = rowHeight * ((visibleRows - 1) / 2);

    const rows = items.map(item =>
      `<div class="wheel-item" data-value="${Utils.escapeHtml(item.value)}"
            style="height:${rowHeight}px">${Utils.escapeHtml(item.label)}</div>`
    ).join('');

    const labels = CONFIG.SIGNUP.PAGE_YEAR;

    return `
      <div class="wheel-group">
        <div class="wheel-caption">${Utils.escapeHtml(caption)}</div>
        <button class="wheel-arrow ripple ripple-dark" id="wheel-up-${name}"
                aria-label="${Utils.escapeHtml(labels.UP_LABEL)}">▲</button>
        <div class="wheel" id="wheel-${name}" style="height:${height}px">
          <div class="wheel-band"
               style="top:${padding}px;height:${rowHeight}px"></div>
          <div class="wheel-track" id="wheel-track-${name}"
               style="transform:translateY(${padding}px)">${rows}</div>
        </div>
        <button class="wheel-arrow ripple ripple-dark" id="wheel-down-${name}"
                aria-label="${Utils.escapeHtml(labels.DOWN_LABEL)}">▼</button>
      </div>`;
  },

  /**
   * Activate a wheel: set its starting row, wire its arrows, report changes.
   *
   * Row offsets need no measurement, unlike the carousel: rows are a fixed
   * height set in this same file, so position is arithmetic.
   *
   * @param {string}   name          Must match the name given to renderWheel.
   * @param {number}   visibleRows   Must match too.
   * @param {number}   startIndex    Row to open on.
   * @param {Function} onChange      Called with the selected value.
   */
  mountWheel(name, visibleRows, startIndex, onChange) {
    const rowHeight = this.WHEEL_ITEM_HEIGHT;
    const padding   = rowHeight * ((visibleRows - 1) / 2);

    const track   = document.getElementById('wheel-track-' + name);
    const rows    = [...track.querySelectorAll('.wheel-item')];
    const upBtn   = document.getElementById('wheel-up-' + name);
    const downBtn = document.getElementById('wheel-down-' + name);

    let index = Math.min(rows.length - 1, Math.max(0, startIndex));

    /** Move the track, restyle the rows, and report the selected value. */
    const apply = () => {
      track.style.transform = `translateY(${padding - index * rowHeight}px)`;

      rows.forEach((row, i) => {
        const distance = Math.abs(i - index);
        row.style.opacity   = String(Math.max(0.25, 1 - distance * 0.32));
        row.style.transform = `scale(${Math.max(0.72, 1 - distance * 0.13)})`;
      });

      upBtn.disabled   = (index <= 0);
      downBtn.disabled = (index >= rows.length - 1);

      onChange(rows[index].dataset.value);
    };

    const move = step => {
      index = Math.min(rows.length - 1, Math.max(0, index + step));
      apply();
    };

    upBtn.addEventListener('click',   () => move(-1));
    downBtn.addEventListener('click', () => move(1));

    // Tapping a visible row jumps straight to it, so reaching a distant value
    // does not mean repeatedly pressing an arrow.
    rows.forEach((row, i) => {
      row.addEventListener('click', () => { index = i; apply(); });
    });

    apply();
  },


  /* ========================================================================
     DECORATIVE MOTIF
     ==================================================================== */

  /**
   * Place the two decorative shapes for the current page.
   *
   * Both are positioned with top and left only. Corners are computed from the
   * shape's size and how much of it should hang off the edge, rather than
   * written out four times, so changing ARC_SIZE in config moves all four
   * corners consistently instead of requiring four matching edits.
   *
   * Nothing is recreated here — the same two elements are repositioned, which
   * is what lets CSS animate them across the screen.
   */
  moveDecorations() {
    const decor = CONFIG.SIGNUP.DECOR;

    /**
     * Turn a corner code into top/left values.
     *
     * @param   {string} corner  't'/'b' then 'l'/'r', e.g. 'tl'.
     * @param   {number} size    Diameter of the shape, in pixels.
     * @param   {number} hideY   Fraction hidden past the top or bottom edge.
     * @param   {number} hideX   Fraction hidden past the left or right edge.
     * @returns {{top: string, left: string}}
     */
    const place = (corner, size, hideY, hideX) => {
      const offsetY = size * hideY;
      const offsetX = size * hideX;
      // The visible sliver, used to sit the shape against the far edge.
      const visibleY = size - offsetY;
      const visibleX = size - offsetX;

      return {
        top:  corner[0] === 't' ? `${-offsetY}px` : `calc(100% - ${visibleY}px)`,
        left: corner[1] === 'l' ? `${-offsetX}px` : `calc(100% - ${visibleX}px)`
      };
    };

    const arc = document.getElementById('signup-arc');
    const dot = document.getElementById('signup-dot');
    if (!arc || !dot) return;

    const arcAt = place(
      decor.ARC_POSITIONS[this.pageIndex] || 'tl',
      decor.ARC_SIZE, decor.ARC_HIDE_Y, decor.ARC_HIDE_X
    );
    arc.style.top  = arcAt.top;
    arc.style.left = arcAt.left;

    // The dot stays fully on screen, so its inset is given directly in pixels
    // rather than as a fraction of its own size.
    const dotCorner = decor.DOT_POSITIONS[this.pageIndex] || 'tr';
    dot.style.top = dotCorner[0] === 't'
      ? `${decor.DOT_INSET_Y}px`
      : `calc(100% - ${decor.DOT_INSET_Y + decor.DOT_SIZE}px)`;
    dot.style.left = dotCorner[1] === 'l'
      ? `${decor.DOT_INSET_X}px`
      : `calc(100% - ${decor.DOT_INSET_X + decor.DOT_SIZE}px)`;
  },


  /* ========================================================================
     WIZARD SHELL
     ==================================================================== */

  /** Reset and open the wizard at page one. */
  start() {
    this.data = {};
    this.pageIndex = 0;
  },

  /**
   * Enable or disable بعدی according to the current page, and update the
   * progress bar. Called after anything that could change validity.
   */
  refreshNav() {
    const page = this.PAGES[this.pageIndex];
    const next = document.getElementById('signup-next');
    if (next) next.disabled = !page.isValid();

    const fill = document.getElementById('signup-progress');
    if (fill) {
      fill.style.width =
        (((this.pageIndex + 1) / this.PAGES.length) * 100) + '%';
    }
  },

  /**
   * Render the current page into the wizard shell.
   *
   * Only the body is replaced, not the whole screen, so the progress bar keeps
   * its width and the decorative motif keeps moving across the swap.
   *
   * @param {boolean} animate  False on first entry, which has nothing to fade
   *                           out of.
   */
  async showPage(animate = true) {
    const decor = CONFIG.SIGNUP.DECOR;
    const page  = this.PAGES[this.pageIndex];
    const body  = document.getElementById('signup-body');
    const isLastPage = (this.pageIndex === this.PAGES.length - 1);

    // The motif starts travelling first and keeps going through the content
    // swap, so the two shapes are still visibly in flight when the new page
    // fades in. Starting them together would read as one combined transition.
    this.moveDecorations();

    if (animate) {
      body.style.transitionDuration = decor.CONTENT_FADE_OUT_MS + 'ms';
      body.style.opacity = '0';
      await Utils.wait(decor.CONTENT_FADE_OUT_MS);
    }

    body.innerHTML = page.render();
    body.scrollTop = 0;
    page.mount?.();

    // Privacy panel, on the pages that declare one.
    const dome = document.getElementById('signup-dome');
    const note = page.privacyNote?.();
    dome.innerHTML = note ? `<p>${Utils.escapeHtml(note)}</p>` : '';
    dome.style.display = note ? '' : 'none';

    // قبلی is hidden rather than disabled on the first page: there is no
    // backward step to describe, so offering one would be misleading.
    const back = document.getElementById('signup-back');
    back.style.visibility = (this.pageIndex === 0) ? 'hidden' : 'visible';

    document.getElementById('signup-next').textContent = isLastPage
      ? CONFIG.SIGNUP.SUBMIT_BUTTON
      : CONFIG.SIGNUP.NEXT_BUTTON;

    this.refreshNav();
    App.attachRipples(body);

    body.style.transitionDuration = decor.CONTENT_FADE_IN_MS + 'ms';
    body.style.opacity = '1';
  },

  /** Advance, or submit if this was the last page. */
  next() {
    if (!this.PAGES[this.pageIndex].isValid()) return;

    if (this.pageIndex === this.PAGES.length - 1) {
      this.submit();
      return;
    }
    this.pageIndex++;
    this.showPage();
  },

  /** Step back one page, keeping everything already entered. */
  back() {
    if (this.pageIndex === 0) return;
    this.pageIndex--;
    this.showPage();
  },

  /**
   * Finish sign-up.
   *
   * Stage 2 stores the profile on the device so the returning-user path can be
   * exercised without a backend. Stage 3 replaces this with a Supabase write
   * and server-side re-validation of every field — the checks above are for
   * the user's benefit and are not a security boundary.
   */
  submit() {
    const profile = {
      firstName:      SignUp.data.firstName?.trim(),
      lastName:       SignUp.data.lastName?.trim(),
      major:          SignUp.data.major,
      year:           SignUp.data.year,
      semester:       SignUp.data.semester,
      university:     SignUp.data.university,
      universityName: SignUp.data.universityName,
      city:           SignUp.data.city,
      phone:          SignUp.data.phone,
      inviteCode:     SignUp.data.inviteCode || null,
      createdAt:      new Date().toISOString(),

      // Pro tier, dormant. Null means no subscription, which is every user
      // today. Present from the start so the field does not have to be
      // backfilled across existing records when the tier is switched on.
      proUntil:       null
    };

    Utils.saveLocalProfile(profile);

    // Temporary confirmation, so the collected values can be checked against
    // what was actually entered. Replaced by the main app in a later slice.
    const majorLabel = CONFIG.SIGNUP.PAGE_MAJOR.MAJORS
      .find(m => m.id === profile.major)?.label || '—';
    const semesterLabel = CONFIG.SIGNUP.PAGE_YEAR.SEMESTERS
      .find(s => s.id === profile.semester)?.label || '—';

    alert(
      'ثبت‌نام انجام شد ✅\n\n' +
      'نام: ' + profile.firstName + ' ' + profile.lastName + '\n' +
      'رشته: ' + majorLabel + '\n' +
      'سال ورود: ' + Utils.toPersianDigits(profile.year) + ' — ' + semesterLabel + '\n' +
      'دانشگاه: ' + profile.universityName + '\n' +
      'شهر: ' + profile.city + '\n' +
      'تلفن: ' + Utils.toPersianDigits(profile.phone) + '\n' +
      'کد دعوت: ' + (profile.inviteCode || 'ندارد')
    );

    App.go('main');
  }

};


/**
 * The screen object app.js navigates to. Kept thin: it builds the fixed shell
 * once, then hands over to SignUp for everything inside it.
 */
const SignUpScreen = {
  render() {
    const decor = CONFIG.SIGNUP.DECOR;

    return `
      <div class="signup-progress-track">
        <div class="signup-progress-fill" id="signup-progress"></div>
      </div>

      <!-- The motif sits in the shell, as a sibling of the body rather than
           inside it. Two consequences, both wanted: it survives every page
           swap so its movement can be animated, and it cannot add to the
           body's scrollable width the way it did when nested inside. -->
      <div class="signup-decor signup-arc" id="signup-arc"
           style="width:${decor.ARC_SIZE}px;height:${decor.ARC_SIZE}px;
                  opacity:${decor.ARC_OPACITY};
                  transition:top ${decor.ARC_MOVE_MS}ms var(--ease),
                             left ${decor.ARC_MOVE_MS}ms var(--ease)"></div>
      <div class="signup-decor signup-dot" id="signup-dot"
           style="width:${decor.DOT_SIZE}px;height:${decor.DOT_SIZE}px;
                  transition:top ${decor.DOT_MOVE_MS}ms var(--ease),
                             left ${decor.DOT_MOVE_MS}ms var(--ease)"></div>

      <div class="signup-body" id="signup-body"></div>
      <div class="privacy-dome" id="signup-dome"></div>
      <div class="signup-nav">
        <button class="btn btn-primary btn-next ripple" id="signup-next"></button>
        <button class="btn btn-flat btn-back ripple ripple-dark" id="signup-back">
          ${Utils.escapeHtml(CONFIG.SIGNUP.BACK_BUTTON)}
        </button>
      </div>`;
  },

  mount() {
    SignUp.start();
    document.getElementById('signup-next')
            .addEventListener('click', () => SignUp.next());
    document.getElementById('signup-back')
            .addEventListener('click', () => SignUp.back());
    // First entry has nothing to fade out of, so it renders immediately.
    SignUp.showPage(false);
  }
};
