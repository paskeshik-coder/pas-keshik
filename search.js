/**
 * ============================================================================
 * پاس‌کشیک — SEARCH SCREEN  (search.js)
 * ============================================================================
 * The public board of active requests.
 *
 * SCOPE VERSUS FILTERS
 * The board is scoped to the signed-in user's city and رشته. That scope is not
 * adjustable and is not shown on the cards, because every visible card shares
 * the same two values — repeating them would be noise. What remains adjustable
 * is university (within the city) and ward.
 *
 * ORDERING is decided by the data layer, never here. The screen renders the
 * order it is given. If the client chose, a technical user could promote their
 * own request to the top by editing the page.
 *
 * EVENT HANDLING — one delegated listener, attached once
 * Every tap on this screen is handled by a single listener on #app-content,
 * which is the one element that survives every redraw. Nothing is ever
 * re-bound.
 *
 * This matters because both earlier approaches failed in ways that were hard
 * to see. Attaching handlers inside the sheet-opening function accumulated
 * them, so one tap fired several. Re-binding buttons after each redraw left
 * their working state dependent on which redraw ran last. Delegation removes
 * both: handlers are attached to an ancestor that is never replaced, and the
 * markup they act on is identified by data attributes rather than by object
 * references that go stale.
 * ============================================================================
 */

const SearchScreen = {

  /** Current filter selections. `null` means "no narrowing". */
  filters: { university: null, ward: null },

  /** Set once per mount, from the saved profile. */
  profile: null,

  /** Guard so the delegated listener is attached exactly once per page load. */
  _bound: false,


  /* ======================================================================
     LOOKUPS
     ================================================================== */

  /** Universities in the user's city, the only ones the filter offers. */
  cityUniversities() {
    return CONFIG.SIGNUP.PAGE_UNIVERSITY.UNIVERSITIES
      .filter(u => u.city === this.profile.city);
  },

  /**
   * The ward list for the user's رشته, or null if their رشته has no wards.
   *
   * Returning null rather than an empty array lets the caller distinguish
   * "this major has no wards, hide the filter" from "the list is empty",
   * which would be a data problem worth showing differently.
   */
  wardList() {
    const major = CONFIG.SIGNUP.PAGE_MAJOR.MAJORS
      .find(m => m.id === this.profile.major);

    if (!major?.hasWards) return null;
    return CONFIG.SEARCH.WARDS[major.id] || [];
  },

  /** Display label for a ward id. */
  wardLabel(wardId) {
    return this.wardList()?.find(w => w.id === wardId)?.label || '';
  },


  /* ======================================================================
     RENDERING
     ================================================================== */

  render() {
    return `
      <div class="search-filters" id="search-filters"></div>
      <div class="search-list" id="search-list"></div>

      <!-- One reusable sheet serves the two filter pickers and the bid
           dialog. Three separate sheets would triple the markup for what is
           the same container with different contents. -->
      <div class="sheet-scrim" id="sheet-scrim"></div>
      <div class="sheet" id="sheet">
        <div class="sheet-handle"></div>
        <div class="sheet-title" id="sheet-title"></div>
        <div class="sheet-body" id="sheet-body"></div>
      </div>`;
  },

  /** Draw the filter bar, reflecting the current selections. */
  renderFilters() {
    const wards = this.wardList();
    const universities = this.cityUniversities();

    const uniLabel = this.filters.university
      ? (universities.find(u => u.id === this.filters.university)?.name || '')
      : `${CONFIG.SEARCH.FILTER_UNIVERSITY_ALL} ${this.profile.city}`;

    const wardLabel = this.filters.ward
      ? this.wardLabel(this.filters.ward)
      : CONFIG.SEARCH.FILTER_WARD_ALL;

    const button = (id, label, narrowed) => `
      <button class="filter-btn ripple ripple-dark ${narrowed ? 'narrowed' : ''}"
              data-filter-open="${id}">
        <span class="filter-value">${Utils.escapeHtml(label)}</span>
        <span class="filter-caret">▼</span>
      </button>`;

    // The ward filter is omitted entirely for majors that have no wards,
    // rather than shown empty — an unusable control is worse than none.
    document.getElementById('search-filters').innerHTML =
      button('university', uniLabel, Boolean(this.filters.university)) +
      (wards ? button('ward', wardLabel, Boolean(this.filters.ward)) : '');
  },

  /**
   * Build one request card.
   *
   * @param   {object} request
   * @returns {string}  HTML.
   */
  renderCard(request) {
    const text = CONFIG.SEARCH;
    const isOwn = request.ownerId === DemoStore.currentUserId();
    const myBid = DemoStore.myBidOn(request.id);
    const boosted = request.boostedUntil
                 && new Date(request.boostedUntil).getTime() > Date.now();

    // Wards are only meaningful for majors that use them.
    const wardChip = (this.wardList() && request.ward)
      ? `<div class="request-ward">${Utils.escapeHtml(this.wardLabel(request.ward))}</div>`
      : '';

    // Hidden entirely when nobody has bid, rather than showing a zero or a
    // dash — there is no lowest bid to report, so the line has nothing to say.
    const lowest = (request.lowestBid !== null && request.lowestBid !== undefined)
      ? `<div class="request-lowest">${Utils.escapeHtml(
           text.LOWEST_BID_TEXT.replace('[X]', Utils.formatPrice(request.lowestBid))
         )}</div>`
      : '';

    /*
      Three mutually exclusive footer states:
        own request  — no button at all; bidding on yourself is meaningless
        already bid  — disabled, showing that the bid was registered
        otherwise    — the live bid button
    */
    let footer;
    if (isOwn) {
      footer = '';
    } else if (myBid !== null) {
      footer = `<div class="request-foot">
                  <button class="btn btn-primary" disabled>
                    ${Utils.escapeHtml(text.BID_BUTTON_ALREADY)}
                  </button>
                </div>`;
    } else {
      footer = `<div class="request-foot">
                  <button class="btn btn-primary ripple" data-bid="${request.id}">
                    ${Utils.escapeHtml(text.BID_BUTTON)}
                  </button>
                </div>`;
    }

    const badge = boosted
      ? `<button class="boost-badge ripple ripple-dark" data-boost="1">
           ${Utils.escapeHtml(text.BOOST_BADGE)}
         </button>`
      : (isOwn
          ? `<span class="own-badge">${Utils.escapeHtml(text.OWN_REQUEST_LABEL)}</span>`
          : '');

    return `
      <div class="request-card ${boosted ? 'boosted' : ''}">
        <div class="request-head">
          <div class="request-uni">${Utils.escapeHtml(request.universityName)}</div>
          ${badge}
        </div>
        <div class="request-body">
          ${wardChip}
          <div class="request-place">${Utils.escapeHtml(request.place)}</div>
          <div class="request-row">
            <span class="row-label">${Utils.escapeHtml(text.START_LABEL)}</span>
            <span>${Utils.escapeHtml(Utils.formatJalaliDateTime(request.startsAt))}</span>
          </div>
          <div class="request-row">
            <span class="row-label">${Utils.escapeHtml(text.END_LABEL)}</span>
            <span>${Utils.escapeHtml(Utils.formatJalaliDateTime(request.endsAt))}</span>
          </div>
          ${lowest}
        </div>
        ${footer}
      </div>`;
  },

  /** Draw the list, applying the current filters. */
  renderList() {
    const text = CONFIG.SEARCH;

    const all = DemoStore.getRequests();
    const shown = all.filter(request => {
      if (this.filters.university && request.universityId !== this.filters.university) {
        return false;
      }
      if (this.filters.ward && request.ward !== this.filters.ward) return false;
      return true;
    });

    const list = document.getElementById('search-list');

    if (!shown.length) {
      // A board that is empty because of filters needs different advice from
      // one that is empty because nothing has been posted. Telling someone to
      // "change the filters" when no filter is set would be nonsense.
      const filtered = Boolean(this.filters.university || this.filters.ward);

      list.innerHTML = `
        <div class="search-empty">
          <div class="empty-icon">${ART.NAV.search}</div>
          <div class="empty-title">${Utils.escapeHtml(
            filtered ? text.EMPTY_FILTERED_TITLE : text.EMPTY_TITLE)}</div>
          <div class="empty-text">${Utils.escapeHtml(
            filtered ? text.EMPTY_FILTERED_TEXT : text.EMPTY_TEXT)}</div>
        </div>`;
      return;
    }

    list.innerHTML = shown.map(request => this.renderCard(request)).join('');
    App.attachRipples(list);
  },

  /** Redraw both halves of the screen after a filter change. */
  refresh() {
    this.renderFilters();
    this.renderList();
    App.attachRipples(document.getElementById('search-filters'));
  },


  /* ======================================================================
     BOTTOM SHEET
     ================================================================== */

  openSheet(title, bodyHtml) {
    document.getElementById('sheet-title').textContent = title;
    document.getElementById('sheet-body').innerHTML = bodyHtml;
    document.getElementById('sheet').classList.add('open');
    document.getElementById('sheet-scrim').classList.add('open');
    App.attachRipples(document.getElementById('sheet'));
  },

  closeSheet() {
    document.getElementById('sheet').classList.remove('open');
    document.getElementById('sheet-scrim').classList.remove('open');
  },

  /**
   * Show a picker for one of the filters.
   *
   * Only draws the sheet. The taps inside it are handled by the delegated
   * listener, which reads from the markup rather than from anything this
   * function leaves behind.
   *
   * @param {string} which  'university' or 'ward'.
   */
  openFilterSheet(which) {
    const isUniversity = (which === 'university');

    // The "all" row is an option in the same list rather than a separate
    // clear button, so returning to unfiltered is the same gesture as any
    // other choice instead of a different one to hunt for.
    const allLabel = isUniversity
      ? `${CONFIG.SEARCH.FILTER_UNIVERSITY_ALL} ${this.profile.city}`
      : CONFIG.SEARCH.FILTER_WARD_ALL;

    const options = isUniversity
      ? this.cityUniversities().map(u => ({ id: u.id, label: u.name }))
      : (this.wardList() || []).map(w => ({ id: w.id, label: w.label }));

    const rows = [{ id: '', label: allLabel }, ...options].map(option => {
      const selected = (this.filters[which] || '') === option.id;
      // Each row names the filter it belongs to, so one shared listener can
      // serve both pickers without knowing which is open.
      return `<button class="sheet-option ripple ripple-dark ${selected ? 'selected' : ''}"
                      data-filter-set="${which}"
                      data-value="${Utils.escapeHtml(option.id)}">
                <span>${Utils.escapeHtml(option.label)}</span>
                ${selected ? '<span class="check">✓</span>' : ''}
              </button>`;
    }).join('');

    this.openSheet(isUniversity ? 'دانشگاه' : 'بخش', rows);
  },

  /**
   * Show the bid dialog for a request.
   *
   * This one does attach its own handlers, which is safe here and not a
   * repeat of the earlier mistake: the input and buttons are created fresh
   * each time the sheet opens and destroyed when its contents are replaced,
   * so their listeners go with them and cannot accumulate.
   *
   * @param {string} requestId
   */
  openBidSheet(requestId) {
    const text = CONFIG.SEARCH;

    this.openSheet(text.BID_TITLE, `
      <p class="bid-explanation">${Utils.escapeHtml(text.BID_EXPLANATION)}</p>
      <div class="bid-amount-row" id="bid-row">
        <input id="bid-input" type="tel" inputmode="numeric"
               placeholder="${Utils.escapeHtml(text.BID_PLACEHOLDER)}">
        <span class="bid-currency">تومان</span>
      </div>
      <div class="bid-error" id="bid-error"></div>
      <div class="bid-actions">
        <button class="btn btn-primary ripple" id="bid-submit">
          ${Utils.escapeHtml(text.BID_SUBMIT)}
        </button>
        <button class="btn btn-flat ripple ripple-dark" id="bid-cancel">
          ${Utils.escapeHtml(text.BID_CANCEL)}
        </button>
      </div>`);

    const input = document.getElementById('bid-input');
    const row   = document.getElementById('bid-row');
    const error = document.getElementById('bid-error');

    input.addEventListener('focus', () => row.classList.add('focused'));
    input.addEventListener('blur',  () => row.classList.remove('focused'));

    input.addEventListener('input', () => {
      /*
        Digits are stored in English and shown in Persian, with thousand
        separators added as the user types so a large number stays readable.

        The cursor is pinned to the end rather than preserved by offset:
        inserting a separator changes the text length unpredictably, so any
        attempt to restore the old position would drift. Amounts are entered
        left to right in one go, so the end is where the cursor belongs.
      */
      const digits = Utils.digitsOnly(input.value).slice(0, text.BID_MAX_DIGITS);
      input.value = digits ? Utils.formatPrice(digits) : '';
      input.setSelectionRange(input.value.length, input.value.length);

      row.classList.remove('invalid');
      error.textContent = '';
    });

    document.getElementById('bid-cancel')
            .addEventListener('click', () => this.closeSheet());

    document.getElementById('bid-submit').addEventListener('click', () => {
      const digits = Utils.digitsOnly(input.value);

      // An empty field is the only rejection. Zero is allowed on purpose:
      // covering a colleague's shift for nothing is a real offer.
      if (!digits.length) {
        row.classList.add('invalid');
        error.textContent = text.BID_ERROR_EMPTY;
        return;
      }

      DemoStore.placeBid(requestId, Number(digits));
      this.closeSheet();
      this.renderList();
      alert(text.BID_SUCCESS);
    });

    input.focus();
  },


  /* ======================================================================
     EVENTS
     ================================================================== */

  /**
   * Attach the one and only click listener for this screen.
   *
   * Bound to #app-content, which MainApp refills but never replaces, so the
   * listener outlives every redraw and every navigation away and back. The
   * guard makes calling this repeatedly harmless.
   *
   * Each branch identifies its target by a data attribute rather than by a
   * stored element, so freshly drawn markup works immediately with no
   * re-binding step that could be skipped.
   */
  bindOnce() {
    if (this._bound) return;
    this._bound = true;

    document.getElementById('app-content').addEventListener('click', event => {

      // Open a filter picker.
      const filterButton = event.target.closest('[data-filter-open]');
      if (filterButton) {
        this.openFilterSheet(filterButton.dataset.filterOpen);
        return;
      }

      // Choose a value inside a filter picker. An empty value is the "all"
      // row, which clears that one filter and leaves the other alone.
      const option = event.target.closest('[data-filter-set]');
      if (option) {
        this.filters[option.dataset.filterSet] = option.dataset.value || null;
        this.closeSheet();
        this.refresh();
        return;
      }

      // Tap outside an open sheet.
      if (event.target.closest('#sheet-scrim')) {
        this.closeSheet();
        return;
      }

      // Explain the boost badge.
      if (event.target.closest('[data-boost]')) {
        alert(CONFIG.SEARCH.BOOST_EXPLANATION);
        return;
      }

      // Open the bid dialog.
      const bidButton = event.target.closest('[data-bid]');
      if (bidButton) {
        this.openBidSheet(bidButton.dataset.bid);
      }
    });
  },

  mount() {
    this.profile = Utils.getLocalProfile() || {};

    // Default the university filter to the user's own, as agreed, while
    // leaving every other university in their city reachable.
    if (this.filters.university === null && this.profile.university) {
      this.filters.university = this.profile.university;
    }

    this.refresh();
    this.bindOnce();
  }

};
