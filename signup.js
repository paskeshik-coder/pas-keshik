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
 * ============================================================================
 */

const SignUp = {

  /** Collected answers. Reset by start(). */
  data: {},

  /** Zero-based index of the visible page. */
  pageIndex: 0,


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

        // The `field` helper builds a labelled input with a hint slot below.
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

        return `
          <h2 class="signup-title">${Utils.escapeHtml(page.TITLE)}</h2>
          <p class="signup-subtitle">${Utils.escapeHtml(page.SUBTITLE)}</p>
          <div class="major-track" id="major-track">
            <div class="major-spacer"></div>${cards}<div class="major-spacer"></div>
          </div>
          <p class="signup-subtitle" style="margin-top:16px">
            ${Utils.escapeHtml(page.TAP_HINT)}
          </p>`;
      },

      mount() {
        const track = document.getElementById('major-track');
        const cards = [...track.querySelectorAll('.major-card')];

        /**
         * Scale and fade each card by how far it sits from the centre.
         *
         * Positions are measured with getBoundingClientRect rather than from
         * scrollLeft, because scrollLeft's sign and origin differ between
         * left-to-right and right-to-left layouts. Screen coordinates behave
         * identically in both.
         */
        const applyDepth = () => {
          const trackCentre = track.getBoundingClientRect().left
                            + track.getBoundingClientRect().width / 2;

          cards.forEach(card => {
            const rect = card.getBoundingClientRect();
            const cardCentre = rect.left + rect.width / 2;
            // Distance expressed in card-widths, so it is resolution independent.
            const distance = Math.min(
              Math.abs(cardCentre - trackCentre) / rect.width, 1
            );
            card.style.transform = `scale(${1 - distance * 0.18})`;
            card.style.opacity   = String(1 - distance * 0.55);
          });
        };

        track.addEventListener('scroll', () => {
          requestAnimationFrame(applyDepth);
        }, { passive: true });

        /**
         * Which card is currently nearest the middle of the track.
         *
         * Asked as a comparison between cards rather than as an absolute
         * distance threshold. A fixed threshold assumes a card can always
         * settle exactly on centre, and any residue — a rounding difference,
         * a spacer a pixel out — leaves the first and last cards permanently
         * "not centred enough" and therefore permanently unselectable. Whoever
         * is closest is always somebody, so this cannot get stuck.
         *
         * @returns {number}  Index into `cards`.
         */
        const centredIndex = () => {
          const tRect = track.getBoundingClientRect();
          const trackCentre = tRect.left + tRect.width / 2;

          let best = 0, bestDistance = Infinity;
          cards.forEach((card, i) => {
            const rect = card.getBoundingClientRect();
            const distance = Math.abs((rect.left + rect.width / 2) - trackCentre);
            if (distance < bestDistance) { bestDistance = distance; best = i; }
          });
          return best;
        };

        cards.forEach((card, index) => {
          card.addEventListener('click', () => {
            // Tapping a card that is off to one side means "bring this one
            // over", not "choose it" — selecting something half off the screen
            // is almost always a mis-tap.
            if (index !== centredIndex()) {
              const rect  = card.getBoundingClientRect();
              const tRect = track.getBoundingClientRect();
              track.scrollBy({
                left: (rect.left + rect.width / 2) - (tRect.left + tRect.width / 2),
                behavior: 'smooth'
              });
              return;
            }

            cards.forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            SignUp.data.major = card.dataset.id;
            SignUp.refreshNav();
          });
        });

        // Open on the previously chosen card, or the first one.
        const startIndex = Math.max(
          0, CONFIG.SIGNUP.PAGE_MAJOR.MAJORS.findIndex(m => m.id === SignUp.data.major)
        );
        requestAnimationFrame(() => {
          const card  = cards[startIndex];
          const rect  = card.getBoundingClientRect();
          const tRect = track.getBoundingClientRect();
          track.scrollLeft += (rect.left + rect.width / 2)
                            - (tRect.left + tRect.width / 2);
          applyDepth();
        });
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
          <div style="margin-top:20px">
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
        return digits.length === page.PHONE_PREFIX.length + page.PHONE_REMAINING_DIGITS;
      },

      privacyNote: () => CONFIG.SIGNUP.PAGE_CONTACT.PRIVACY_NOTE
    }

  ],


  /* ========================================================================
     WHEEL COMPONENT
     Shared by the year and semester pickers, and available to the Jalali date
     picker later. Built on native scroll-snap, which supplies real flick
     momentum and rubber-banding that a hand-written drag handler would only
     imitate.
     ==================================================================== */

  // Height of one row, in pixels. Also the snap interval.
  WHEEL_ITEM_HEIGHT: 46,

  /**
   * Build a wheel's markup.
   *
   * @param   {string} name          Identifier, used for the element ids.
   * @param   {string} caption       Label shown above the wheel.
   * @param   {Array}  items         [{value, label}, ...] top to bottom.
   * @param   {number} visibleRows   How many rows are on screen. Must be odd,
   *                                 so exactly one row can sit in the middle.
   * @returns {string}               HTML.
   */
  renderWheel(name, caption, items, visibleRows) {
    const rowHeight = this.WHEEL_ITEM_HEIGHT;
    const height    = rowHeight * visibleRows;
    // Empty space above and below, so the first and last values can reach the
    // centre rather than stopping at the wheel's edge.
    const padding   = rowHeight * ((visibleRows - 1) / 2);

    const rows = items.map(item =>
      `<div class="wheel-item" data-value="${Utils.escapeHtml(item.value)}"
            style="height:${rowHeight}px">${Utils.escapeHtml(item.label)}</div>`
    ).join('');

    return `
      <div class="wheel-group">
        <div class="wheel-caption">${Utils.escapeHtml(caption)}</div>
        <div class="wheel" id="wheel-${name}" style="height:${height}px">
          <div class="wheel-band"
               style="top:${padding}px;height:${rowHeight}px"></div>
          <div class="wheel-scroll" id="wheel-scroll-${name}">
            <div class="wheel-pad" style="height:${padding}px"></div>
            ${rows}
            <div class="wheel-pad" style="height:${padding}px"></div>
          </div>
        </div>
      </div>`;
  },

  /**
   * Activate a wheel: set its starting row and report changes.
   *
   * @param {string}   name          Must match the name given to renderWheel.
   * @param {number}   visibleRows   Must match too.
   * @param {number}   startIndex    Row to open on.
   * @param {Function} onChange      Called with the selected value.
   */
  mountWheel(name, visibleRows, startIndex, onChange) {
    const rowHeight = this.WHEEL_ITEM_HEIGHT;
    const scroller  = document.getElementById('wheel-scroll-' + name);
    const rows      = [...scroller.querySelectorAll('.wheel-item')];

    /**
     * Restyle every row by its distance from the centre and report the value
     * now sitting under the marker.
     */
    const update = () => {
      const centreIndex = Math.round(scroller.scrollTop / rowHeight);

      rows.forEach((row, i) => {
        const distance = Math.abs(i - centreIndex);
        row.style.opacity   = String(Math.max(0.25, 1 - distance * 0.32));
        row.style.transform = `scale(${Math.max(0.72, 1 - distance * 0.13)})`;
      });

      const chosen = rows[Math.max(0, Math.min(rows.length - 1, centreIndex))];
      if (chosen) onChange(chosen.dataset.value);
    };

    scroller.addEventListener('scroll', () => {
      requestAnimationFrame(update);
    }, { passive: true });

    // Position on the starting row before the first paint, so the wheel never
    // appears at the top and then jumps.
    requestAnimationFrame(() => {
      scroller.scrollTop = startIndex * rowHeight;
      update();
    });
  },


  /* ========================================================================
     WIZARD SHELL
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
   * its width and animates smoothly from one page to the next.
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
      createdAt:      new Date().toISOString()
    };

    Utils.saveLocalProfile(profile);

    // Temporary confirmation, so the collected values can be checked against
    // what was actually entered. Replaced by the main app in the next slice.
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
