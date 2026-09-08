/**
 * ============================================================================
 * پاس‌کشیک — SETTINGS AND PROFILE  (settings.js)
 * ============================================================================
 * Two views in one screen: the settings list, and the profile form behind it.
 *
 * NO DARK-MODE CONTROL. The theme follows Telegram, with no override. A note
 * on the screen says so, because an absent control reads as missing unless it
 * is explained.
 *
 * THE CONFLICT RULE is enforced on save, not on open. Someone may want to look
 * at their own details while a request is live, and refusing to show them a
 * read-only screen would be obstructive. The refusal comes at the moment it
 * actually matters.
 * ============================================================================
 */

const SettingsScreen = {

  /** 'list' or 'profile'. */
  view: 'list',

  /** Working copy of the profile while editing. */
  draft: {},

  _bound: false,


  /* ======================================================================
     VIEW: SETTINGS LIST
     ================================================================== */

  renderList() {
    const text = CONFIG.SETTINGS;
    const prefs = Utils.getNotificationPrefs();

    // A checkbox styled as a switch, rather than markup imitating one. It
    // keeps the input's own behaviour and stays readable to screen readers.
    const toggle = (key, title, note, on) => `
      <div class="misc-row">
        <div class="misc-row-text">
          <div class="misc-row-title">${Utils.escapeHtml(title)}</div>
          <div class="misc-row-note">${Utils.escapeHtml(note)}</div>
        </div>
        <label class="switch">
          <input type="checkbox" data-notify="${key}" ${on ? 'checked' : ''}>
          <span class="track"></span>
          <span class="thumb"></span>
        </label>
      </div>`;

    return `
      <div class="misc-screen">
        <div class="misc-card">
          <button class="misc-row ripple ripple-dark" data-open-profile="1">
            <div class="misc-row-text">
              <div class="misc-row-title">${Utils.escapeHtml(text.PROFILE_TITLE)}</div>
              <div class="misc-row-note">${Utils.escapeHtml(text.PROFILE_SUBTITLE)}</div>
            </div>
            <span class="misc-row-caret">‹</span>
          </button>
        </div>

        <div class="misc-section-title">
          ${Utils.escapeHtml(text.NOTIFICATIONS_TITLE)}
        </div>
        <div class="misc-card">
          ${toggle('newBid', text.NOTIFY_NEW_BID, text.NOTIFY_NEW_BID_NOTE, prefs.newBid)}
          ${toggle('bidAccepted', text.NOTIFY_ACCEPTED, text.NOTIFY_ACCEPTED_NOTE, prefs.bidAccepted)}
        </div>

        <div class="misc-note">${Utils.escapeHtml(text.THEME_NOTE)}</div>
      </div>`;
  },


  /* ======================================================================
     VIEW: PROFILE FORM
     ================================================================== */

  renderProfile() {
    const text = CONFIG.PROFILE;
    const draft = this.draft;

    const major = CONFIG.SIGNUP.PAGE_MAJOR.MAJORS.find(m => m.id === draft.major);
    const semester = CONFIG.SIGNUP.PAGE_YEAR.SEMESTERS.find(s => s.id === draft.semester);

    const textField = (id, label, value, hint) => `
      <div class="field">
        <label class="field-label" for="${id}">${Utils.escapeHtml(label)}</label>
        <input class="field-input" id="${id}" type="text"
               value="${Utils.escapeHtml(value || '')}"
               maxlength="${CONFIG.SIGNUP.VALIDATION.NAME_MAX_LENGTH}"
               autocomplete="off" spellcheck="false">
        <span class="field-hint" id="${id}-hint">${Utils.escapeHtml(hint || '')}</span>
      </div>`;

    // A control that opens a picker. Looks like a field so it reads as one,
    // but behaves as a button.
    const pickerField = (key, label, value) => `
      <div class="field">
        <label class="field-label">${Utils.escapeHtml(label)}</label>
        <button class="picker-btn ripple ripple-dark" data-pick="${key}">
          <span>${Utils.escapeHtml(value)}</span>
          <span class="picker-caret">▼</span>
        </button>
        <span class="field-hint"></span>
      </div>`;

    // Years are derived from the current Persian year, exactly as at sign-up,
    // so the offered range rolls forward at Nowruz without an edit.
    return `
      <div class="misc-screen profile-form">
        ${textField('p-first', text.FIRST_LABEL, draft.firstName, CONFIG.SIGNUP.PAGE_NAME.HINT)}
        ${textField('p-last', text.LAST_LABEL, draft.lastName, CONFIG.SIGNUP.PAGE_NAME.HINT)}
        ${pickerField('major', text.MAJOR_LABEL, major?.label || '—')}
        ${pickerField('year', text.YEAR_LABEL, Utils.toPersianDigits(draft.year || '—'))}
        ${pickerField('semester', text.SEMESTER_LABEL, semester?.label || '—')}
        ${pickerField('university', text.UNIVERSITY_LABEL, draft.universityName || '—')}

        <div class="profile-city">
          <div class="city-label">${Utils.escapeHtml(text.CITY_LABEL)}</div>
          <div class="city-value">${Utils.escapeHtml(draft.city || '—')}</div>
          <div class="city-note">${Utils.escapeHtml(text.CITY_NOTE)}</div>
        </div>

        <div class="field">
          <label class="field-label" for="p-phone">
            ${Utils.escapeHtml(text.PHONE_LABEL)}
          </label>
          <div class="phone-row" id="p-phone-row">
            <input class="field-input" id="p-phone" type="tel"
                   inputmode="numeric" autocomplete="tel"
                   placeholder="${Utils.escapeHtml(CONFIG.SIGNUP.PAGE_CONTACT.PHONE_PLACEHOLDER)}"
                   value="${Utils.toPersianDigits(draft.phone || '')}">
          </div>
          <span class="field-hint" id="p-phone-hint"></span>
        </div>

        <div class="profile-actions">
          <button class="btn btn-primary ripple" data-save="1">
            ${Utils.escapeHtml(text.SAVE_BUTTON)}
          </button>
          <button class="btn btn-flat ripple ripple-dark" data-cancel-profile="1">
            ${Utils.escapeHtml(text.CANCEL_BUTTON)}
          </button>
        </div>
      </div>`;
  },


  /* ======================================================================
     OPTION SHEETS
     ================================================================== */

  openSheet(title, bodyHtml) {
    document.getElementById('set-sheet-title').textContent = title;
    document.getElementById('set-sheet-body').innerHTML = bodyHtml;
    document.getElementById('set-sheet').classList.add('open');
    document.getElementById('set-sheet-scrim').classList.add('open');
    App.attachRipples(document.getElementById('set-sheet'));
  },

  closeSheet() {
    document.getElementById('set-sheet').classList.remove('open');
    document.getElementById('set-sheet-scrim').classList.remove('open');
  },

  /**
   * Show a chooser for one profile field.
   *
   * @param {string} key  'major', 'year', 'semester' or 'university'.
   */
  openPicker(key) {
    const text = CONFIG.PROFILE;

    let title, options, current;

    if (key === 'major') {
      title = text.MAJOR_LABEL;
      options = CONFIG.SIGNUP.PAGE_MAJOR.MAJORS.map(m => ({ id: m.id, label: m.label }));
      current = this.draft.major;

    } else if (key === 'semester') {
      title = text.SEMESTER_LABEL;
      options = CONFIG.SIGNUP.PAGE_YEAR.SEMESTERS.map(s => ({ id: s.id, label: s.label }));
      current = this.draft.semester;

    } else if (key === 'year') {
      title = text.YEAR_LABEL;
      const page = CONFIG.SIGNUP.PAGE_YEAR;
      const currentYear = Jalali.currentYear();
      options = [];
      for (let ago = page.MAX_YEARS_AGO; ago >= page.MIN_YEARS_AGO; ago--) {
        const year = currentYear - ago;
        options.push({ id: String(year), label: Utils.toPersianDigits(year) });
      }
      current = String(this.draft.year);

    } else {
      title = text.UNIVERSITY_LABEL;
      options = CONFIG.SIGNUP.PAGE_UNIVERSITY.UNIVERSITIES
        .map(u => ({ id: u.id, label: u.name, extra: u.city }));
      current = this.draft.university;
    }

    // The university list is long enough to need searching; the others are
    // not, and a search box above four options would be clutter.
    const searchHtml = (key === 'university')
      ? `<input class="sheet-search" id="set-search" type="text"
                placeholder="${Utils.escapeHtml(text.SEARCH_PLACEHOLDER)}"
                autocomplete="off" spellcheck="false">`
      : '';

    const rowsHtml = list => list.map(option => `
      <button class="sheet-option ripple ripple-dark ${option.id === current ? 'selected' : ''}"
              data-set="${key}" data-value="${Utils.escapeHtml(option.id)}">
        <span>${Utils.escapeHtml(option.label)}</span>
        ${option.extra
            ? `<span class="uni-city">${Utils.escapeHtml(option.extra)}</span>`
            : (option.id === current ? '<span class="check">✓</span>' : '')}
      </button>`).join('');

    this.openSheet(title, searchHtml + `<div id="set-options">${rowsHtml(options)}</div>`);

    const search = document.getElementById('set-search');
    if (search) {
      search.addEventListener('input', () => {
        // Folded comparison, so Arabic and Persian spellings of the same word
        // match — a search for پزشکی must find پزشكي.
        const query = Utils.foldPersian(search.value.trim());
        const matches = query
          ? options.filter(o => Utils.foldPersian(o.label).includes(query) ||
                                Utils.foldPersian(o.extra || '').includes(query))
          : options;
        document.getElementById('set-options').innerHTML = rowsHtml(matches);
      });
    }
  },


  /* ======================================================================
     SAVING
     ================================================================== */

  /**
   * Validate and store the edited profile.
   *
   * The conflict rule is checked here rather than when the screen opens: a
   * user may legitimately want to read their own details while a request is
   * live, and only a change actually needs refusing.
   */
  save() {
    const text = CONFIG.PROFILE;
    const draft = this.draft;
    const original = Utils.getLocalProfile() || {};

    // Same character rules as sign-up, reused rather than restated so the two
    // cannot drift apart.
    const firstError = SignUp.validateName(draft.firstName);
    const lastError = SignUp.validateName(draft.lastName);

    if (firstError || lastError) {
      const show = (id, message) => {
        if (!message) return;
        document.getElementById(id)?.classList.add('invalid');
        const hint = document.getElementById(id + '-hint');
        if (hint) { hint.textContent = message; hint.classList.add('error'); }
      };
      show('p-first', firstError);
      show('p-last', lastError);
      return;
    }

    const phone = Utils.digitsOnly(draft.phone || '');
    const contact = CONFIG.SIGNUP.PAGE_CONTACT;
    if (phone.length !== contact.PHONE_DIGITS || !phone.startsWith(contact.PHONE_MUST_START)) {
      document.getElementById('p-phone-row')?.classList.add('invalid');
      const hint = document.getElementById('p-phone-hint');
      if (hint) { hint.textContent = contact.PHONE_ERROR; hint.classList.add('error'); }
      return;
    }

    /*
      Changing رشته or دانشگاه changes which requests exist for this user at
      all — a different board, and any bids they hold become bids on shifts
      they can no longer see. So the conflict rule bites only on those two
      fields; correcting a misspelled surname has no such consequence and
      should not be blocked.
    */
    const scopeChanged = draft.major !== original.major
                      || draft.university !== original.university;

    if (scopeChanged && DemoStore.myRequest()) {
      alert(text.BLOCKED_MESSAGE);
      return;
    }

    if (scopeChanged && !confirm(text.SCOPE_WARNING)) return;

    Utils.saveLocalProfile({ ...original, ...draft, phone });

    // The demo board is seeded per رشته and per شهر, so a scope change makes
    // the existing set wrong for this user and it is rebuilt from scratch.
    if (scopeChanged) DemoStore.reset();

    this.view = 'list';
    this.show();
    alert(text.SAVED_MESSAGE);
  },


  /* ======================================================================
     RENDERING AND EVENTS
     ================================================================== */

  render() {
    return `
      <div id="set-view"></div>
      <div class="sheet-scrim" id="set-sheet-scrim"></div>
      <div class="sheet" id="set-sheet">
        <div class="sheet-handle"></div>
        <div class="sheet-title" id="set-sheet-title"></div>
        <div class="sheet-body" id="set-sheet-body"></div>
      </div>`;
  },

  show() {
    const container = document.getElementById('set-view');
    container.innerHTML = (this.view === 'profile')
      ? this.renderProfile()
      : this.renderList();

    // Text fields are not redrawn as the user types, so their handlers are
    // attached here rather than delegated.
    const bind = (id, key, transform) => {
      const input = document.getElementById(id);
      if (!input) return;
      input.addEventListener('input', () => {
        this.draft[key] = transform ? transform(input) : input.value;
        input.classList.remove('invalid');
        const hint = document.getElementById(id + '-hint');
        if (hint) { hint.textContent = ''; hint.classList.remove('error'); }
      });
    };

    bind('p-first', 'firstName');
    bind('p-last', 'lastName');
    bind('p-phone', 'phone', input => {
      // Shown in Persian, stored in English. Both fields change length only
      // when a character is stripped, so the cursor shifts by that difference.
      const cursor = input.selectionStart;
      const before = input.value.length;
      const digits = Utils.digitsOnly(input.value)
                          .slice(0, CONFIG.SIGNUP.PAGE_CONTACT.PHONE_DIGITS);
      input.value = Utils.toPersianDigits(digits);
      const shift = input.value.length - before;
      input.setSelectionRange(cursor + shift, cursor + shift);
      document.getElementById('p-phone-row')?.classList.remove('invalid');
      return digits;
    });

    App.attachRipples(container);
  },

  bindOnce() {
    if (this._bound) return;
    this._bound = true;

    document.getElementById('app-content').addEventListener('click', event => {
      const hit = selector => event.target.closest(selector);

      if (hit('[data-open-profile]')) {
        // A fresh copy each time, so abandoning an edit leaves nothing behind.
        this.draft = { ...(Utils.getLocalProfile() || {}) };
        this.view = 'profile';
        this.show();
        return;
      }

      if (hit('[data-cancel-profile]')) { this.view = 'list'; this.show(); return; }
      if (hit('[data-save]')) { this.save(); return; }

      const picker = hit('[data-pick]');
      if (picker) { this.openPicker(picker.dataset.pick); return; }

      const option = hit('[data-set]');
      if (option) {
        const key = option.dataset.set;
        const value = option.dataset.value;

        if (key === 'university') {
          const uni = CONFIG.SIGNUP.PAGE_UNIVERSITY.UNIVERSITIES
            .find(u => u.id === value);
          if (uni) {
            this.draft.university = uni.id;
            this.draft.universityName = uni.name;
            // City is never asked for; it follows the university.
            this.draft.city = uni.city;
          }
        } else if (key === 'year') {
          this.draft.year = Number(value);
        } else {
          this.draft[key] = value;
        }

        this.closeSheet();
        this.show();
        return;
      }

      if (hit('#set-sheet-scrim')) this.closeSheet();
    });

    // Switches fire change rather than click, so they need their own listener.
    document.getElementById('app-content').addEventListener('change', event => {
      const toggle = event.target.closest('[data-notify]');
      if (!toggle) return;

      const prefs = Utils.getNotificationPrefs();
      prefs[toggle.dataset.notify] = toggle.checked;
      Utils.saveNotificationPrefs(prefs);
    });
  },

  mount() {
    // Always open on the list, so navigating away mid-edit and back does not
    // drop the user into a half-filled form with no explanation.
    this.view = 'list';
    this.show();
    this.bindOnce();
  }

};
