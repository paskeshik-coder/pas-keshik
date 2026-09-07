/**
 * ============================================================================
 * پاس‌کشیک — MY OFFERS  (offers.js)
 * ============================================================================
 * Every request the user has bid on.
 *
 * SPLIT INTO TWO SECTIONS, awaiting an answer and settled. Only pending offers
 * can be edited or withdrawn, so separating them puts everything actionable in
 * one place rather than scattered through a list sorted by date.
 *
 * WHAT AN ACCEPTED OFFER SHOWS is deliberately thin: contact reveal is one-way
 * by design, so the bidder sees no name and no number. The card says so
 * explicitly, because a screen that simply omits the information looks broken
 * rather than intentional.
 *
 * EVENTS are delegated from #app-content, which MainApp refills but never
 * replaces, so no handler needs re-binding after a redraw.
 * ============================================================================
 */

const OffersScreen = {

  /** Guard so the delegated listener is attached exactly once. */
  _bound: false,


  /* ======================================================================
     HELPERS
     ================================================================== */

  profile() { return Utils.getLocalProfile() || {}; },

  /** Ward label, or empty when this user's رشته has no wards. */
  wardLabel(id) {
    const major = CONFIG.SIGNUP.PAGE_MAJOR.MAJORS
      .find(m => m.id === this.profile().major);
    if (!major?.hasWards || !id) return '';
    return (CONFIG.SEARCH.WARDS[major.id] || [])
      .find(w => w.id === id)?.label || '';
  },


  /* ======================================================================
     RENDERING
     ================================================================== */

  /**
   * Build one offer card.
   *
   * @param   {object} entry  A record from DemoStore.myBids().
   * @returns {string}        HTML.
   */
  renderCard(entry) {
    const text = CONFIG.OFFERS;
    const request = entry.request;
    const isPending = (entry.status === DemoStore.BID_STATUS.PENDING);

    const badge = text.STATUS[entry.status] || text.STATUS.pending;

    const ward = this.wardLabel(request.ward);
    const wardChip = ward
      ? `<div class="offer-ward">${Utils.escapeHtml(ward)}</div>` : '';

    /*
      The competing figure, shown only while the offer is live — once settled
      it is history and the number would be noise.

      When the user already holds the lowest bid, saying so is more useful than
      repeating their own price back at them, which is what a bare figure would
      amount to.
    */
    let lowestHtml = '';
    if (isPending) {
      const lowest = DemoStore.lowestBidOn(request.id);

      if (lowest !== null && lowest >= entry.amount) {
        lowestHtml = `<div class="offer-lowest leading">
                        ${Utils.escapeHtml(text.LOWEST_IS_YOURS)}
                      </div>`;
      } else if (lowest !== null) {
        lowestHtml = `<div class="offer-lowest">
                        ${Utils.escapeHtml(text.LOWEST_LABEL)}:
                        ${Utils.formatPrice(lowest)} ${Utils.escapeHtml(text.TOMAN)}
                      </div>`;
      }
    }

    // An accepted offer explains what happens next, since there is deliberately
    // no contact information on this side of the exchange.
    const noteHtml = (entry.status === DemoStore.BID_STATUS.ACCEPTED)
      ? `<div class="offer-note">${Utils.escapeHtml(text.ACCEPTED_NOTE)}</div>`
      : '';

    const actionsHtml = isPending
      ? `<div class="offer-actions">
           <button class="btn btn-primary ripple" data-edit="${entry.id}"
                   data-amount="${entry.amount}">
             ${Utils.escapeHtml(text.EDIT_BUTTON)}
           </button>
           <button class="btn btn-danger ripple" data-withdraw="${entry.id}">
             ${Utils.escapeHtml(text.WITHDRAW_BUTTON)}
           </button>
         </div>`
      : '';

    return `
      <div class="offer-card ${isPending ? '' : 'settled'}">
        <div class="offer-head">
          <div class="offer-uni">${Utils.escapeHtml(request.universityName)}</div>
          <span class="status-badge ${badge.tone}">
            ${Utils.escapeHtml(badge.label)}
          </span>
        </div>
        <div class="offer-body">
          ${wardChip}
          <div class="offer-place">${Utils.escapeHtml(request.place)}</div>
          <div class="offer-row">
            <span class="row-label">${Utils.escapeHtml(CONFIG.SEARCH.START_LABEL)}</span>
            <span>${Utils.escapeHtml(Utils.formatJalaliDateTime(request.startsAt))}</span>
          </div>
          <div class="offer-row">
            <span class="row-label">${Utils.escapeHtml(CONFIG.SEARCH.END_LABEL)}</span>
            <span>${Utils.escapeHtml(Utils.formatJalaliDateTime(request.endsAt))}</span>
          </div>
          <div class="offer-mine">
            <span class="mine-label">${Utils.escapeHtml(text.MY_BID_LABEL)}</span>
            <span class="mine-price">
              ${Utils.formatPrice(entry.amount)}
              <span class="mine-unit">${Utils.escapeHtml(text.TOMAN)}</span>
            </span>
          </div>
          ${noteHtml}
        </div>
        ${lowestHtml}
        ${actionsHtml}
      </div>`;
  },

  render() {
    const text = CONFIG.OFFERS;
    const entries = DemoStore.myBids();

    if (!entries.length) {
      return `
        <div class="offers-empty">
          <div class="empty-icon">${ART.NAV.briefcase}</div>
          <div class="empty-title">${Utils.escapeHtml(text.EMPTY_TITLE)}</div>
          <div class="empty-text">${Utils.escapeHtml(text.EMPTY_TEXT)}</div>
          <div class="empty-hint">${Utils.escapeHtml(text.EMPTY_HINT)}</div>
        </div>
        <div class="sheet-scrim" id="off-sheet-scrim"></div>
        <div class="sheet" id="off-sheet">
          <div class="sheet-handle"></div>
          <div class="sheet-title" id="off-sheet-title"></div>
          <div class="sheet-body" id="off-sheet-body"></div>
        </div>`;
    }

    const pending = entries
      .filter(e => e.status === DemoStore.BID_STATUS.PENDING)
      // Soonest shift first, matching the board: whatever is running out of
      // time is what the user needs to act on.
      .sort((a, b) => new Date(a.request.startsAt) - new Date(b.request.startsAt));

    const settled = entries
      .filter(e => e.status !== DemoStore.BID_STATUS.PENDING)
      // Most recently decided first, since that is what changed last.
      .sort((a, b) => new Date(b.statusSince) - new Date(a.statusSince));

    const section = (title, list) => list.length
      ? `<div class="offers-section-title">${Utils.escapeHtml(title)}</div>`
        + list.map(entry => this.renderCard(entry)).join('')
      : '';

    return `
      <div class="offers-screen">
        ${section(text.PENDING_TITLE, pending)}
        ${section(text.SETTLED_TITLE, settled)}
      </div>
      <div class="sheet-scrim" id="off-sheet-scrim"></div>
      <div class="sheet" id="off-sheet">
        <div class="sheet-handle"></div>
        <div class="sheet-title" id="off-sheet-title"></div>
        <div class="sheet-body" id="off-sheet-body"></div>
      </div>`;
  },


  /* ======================================================================
     EDIT SHEET
     ================================================================== */

  closeSheet() {
    document.getElementById('off-sheet').classList.remove('open');
    document.getElementById('off-sheet-scrim').classList.remove('open');
  },

  /**
   * Open the edit dialog for a pending bid.
   *
   * @param {string} bidId
   * @param {number} current  The amount currently offered.
   */
  openEditSheet(bidId, current) {
    const text = CONFIG.OFFERS;

    document.getElementById('off-sheet-title').textContent = text.EDIT_TITLE;
    document.getElementById('off-sheet-body').innerHTML = `
      <p class="bid-explanation">${Utils.escapeHtml(text.EDIT_EXPLANATION)}</p>
      <div class="bid-amount-row" id="off-bid-row">
        <input id="off-bid-input" type="tel" inputmode="numeric"
               value="${Utils.formatPrice(current)}">
        <span class="bid-currency">${Utils.escapeHtml(text.TOMAN)}</span>
      </div>
      <div class="bid-error" id="off-bid-error"></div>
      <div class="bid-actions">
        <button class="btn btn-primary ripple" id="off-bid-submit">
          ${Utils.escapeHtml(text.EDIT_SUBMIT)}
        </button>
        <button class="btn btn-flat ripple ripple-dark" id="off-bid-cancel">
          ${Utils.escapeHtml(text.EDIT_CANCEL)}
        </button>
      </div>`;

    document.getElementById('off-sheet').classList.add('open');
    document.getElementById('off-sheet-scrim').classList.add('open');
    App.attachRipples(document.getElementById('off-sheet'));

    const input = document.getElementById('off-bid-input');
    const row   = document.getElementById('off-bid-row');
    const error = document.getElementById('off-bid-error');

    input.addEventListener('focus', () => row.classList.add('focused'));
    input.addEventListener('blur',  () => row.classList.remove('focused'));

    input.addEventListener('input', () => {
      /*
        Digits are stored in English and shown in Persian, with thousand
        separators added as the user types so a large number stays readable.

        The cursor is pinned to the end rather than preserved by offset:
        inserting a separator changes the text length unpredictably, so any
        attempt to restore the old position would drift.
      */
      const digits = Utils.digitsOnly(input.value).slice(0, text.BID_MAX_DIGITS);
      input.value = digits ? Utils.formatPrice(digits) : '';
      input.setSelectionRange(input.value.length, input.value.length);

      row.classList.remove('invalid');
      error.textContent = '';
    });

    document.getElementById('off-bid-cancel')
            .addEventListener('click', () => this.closeSheet());

    document.getElementById('off-bid-submit').addEventListener('click', () => {
      const digits = Utils.digitsOnly(input.value);

      // An empty field is the only rejection. Zero is allowed on purpose:
      // covering a colleague's shift for nothing is a real offer.
      if (!digits.length) {
        row.classList.add('invalid');
        error.textContent = text.EDIT_ERROR_EMPTY;
        return;
      }

      // Placing a bid replaces the live one rather than adding a second, so
      // editing needs no separate path through the data layer.
      const entry = DemoStore.myBids().find(e => e.id === bidId);
      if (entry) DemoStore.placeBid(entry.requestId, Number(digits));

      this.closeSheet();
      this.refresh();
      alert(text.EDIT_SUCCESS);
    });

    input.focus();
  },


  /* ======================================================================
     EVENTS
     ================================================================== */

  refresh() {
    const container = document.getElementById('app-content');
    container.innerHTML = this.render();
    App.attachRipples(container);
  },

  /**
   * Attach the one and only click listener for this screen.
   *
   * Bound to #app-content, which MainApp refills but never replaces, so it
   * survives every redraw and every navigation away and back.
   */
  bindOnce() {
    if (this._bound) return;
    this._bound = true;

    document.getElementById('app-content').addEventListener('click', event => {
      const edit = event.target.closest('[data-edit]');
      if (edit) {
        this.openEditSheet(edit.dataset.edit, Number(edit.dataset.amount));
        return;
      }

      const withdraw = event.target.closest('[data-withdraw]');
      if (withdraw) {
        if (!confirm(CONFIG.OFFERS.WITHDRAW_CONFIRM)) return;
        DemoStore.withdrawBid(withdraw.dataset.withdraw);
        this.refresh();
        return;
      }

      if (event.target.closest('#off-sheet-scrim')) this.closeSheet();
    });
  },

  mount() {
    this.bindOnce();
  }

};
