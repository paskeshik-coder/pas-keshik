/**
 * ============================================================================
 * پاس‌کشیک — MY REQUESTS  (requests.js)
 * ============================================================================
 * The user's own request, the bids on it, and the form for creating one.
 *
 * THREE VIEWS, one screen:
 *     list    the active request and its bids, or an empty state
 *     form    creating a request
 *     review  confirming it before posting
 *
 * WHY A REVIEW STEP AND NO EDITING
 * A request cannot be changed once posted. Editing would mean deciding what
 * happens to bids already placed against the old terms — leave them attached
 * and a bidder is committed to a shift they never agreed to; clear them and a
 * small correction costs the requester every offer they had. Confirming before
 * posting avoids the question entirely.
 *
 * EVENTS are delegated from #app-content, which MainApp refills but never
 * replaces, so no handler needs re-binding after a redraw.
 * ============================================================================
 */

const RequestsScreen = {

  /** 'list', 'form' or 'review'. */
  view: 'list',

  /** Work in progress for the create form. */
  draft: {},

  /** Guard so the delegated listener is attached exactly once. */
  _bound: false,


  /* ======================================================================
     HELPERS
     ================================================================== */

  profile() { return Utils.getLocalProfile() || {}; },

  /** The ward list for this user's رشته, or null if their رشته has none. */
  wardList() {
    const major = CONFIG.SIGNUP.PAGE_MAJOR.MAJORS
      .find(m => m.id === this.profile().major);
    if (!major?.hasWards) return null;
    return CONFIG.SEARCH.WARDS[major.id] || [];
  },

  wardLabel(id) {
    return this.wardList()?.find(w => w.id === id)?.label || '';
  },

  /**
   * Format a picked date and time for display on a button.
   *
   * @param   {object} value  {jy, jm, jd} or {hour, minute}.
   * @param   {string} kind   'date' or 'time'.
   * @returns {string}
   */
  formatPicked(value, kind) {
    if (!value) return '';

    if (kind === 'date') {
      const month = CONFIG.JALALI_MONTHS[value.jm - 1];
      return `${Utils.toPersianDigits(value.jd)} ${month}`;
    }

    const pad = n => String(n).padStart(2, '0');
    return Utils.toPersianDigits(`${pad(value.hour)}:${pad(value.minute)}`);
  },


  /* ======================================================================
     VIEW: LIST
     ================================================================== */

  renderList() {
    const text = CONFIG.REQUESTS;
    const request = DemoStore.myRequest();

    if (!request) {
      return `
        <div class="req-empty">
          <div class="empty-icon">${ART.NAV.clipboard}</div>
          <div class="empty-title">${Utils.escapeHtml(text.EMPTY_TITLE)}</div>
          <div class="empty-text">${Utils.escapeHtml(text.EMPTY_TEXT)}</div>
          <div class="empty-hint">${Utils.escapeHtml(text.EMPTY_HINT)}</div>
        </div>
        <button class="fab ripple" data-new-request="1">+</button>`;
    }

    return `<div class="req-screen">
              ${request.acceptedBid
                  ? this.renderAccepted(request)
                  : this.renderActive(request)}
            </div>
            <button class="fab ripple" data-new-request="1">+</button>`;
  },

  /** The request card, shared by the open and accepted states. */
  renderCard(request, headClass, headText) {
    const text = CONFIG.REQUESTS;
    const wardRow = request.ward
      ? `<div class="req-row">
           <span class="req-label">${Utils.escapeHtml(text.WARD_LABEL)}</span>
           <span class="req-value">${Utils.escapeHtml(this.wardLabel(request.ward))}</span>
         </div>`
      : '';

    return `
      <div class="req-card">
        <div class="req-card-head ${headClass}">${Utils.escapeHtml(headText)}</div>
        <div class="req-card-body">
          ${wardRow}
          <div class="req-row">
            <span class="req-label">${Utils.escapeHtml(text.PLACE_LABEL)}</span>
            <span class="req-value">${Utils.escapeHtml(request.place)}</span>
          </div>
          <div class="req-row">
            <span class="req-label">${Utils.escapeHtml(text.START_LABEL)}</span>
            <span class="req-value">${Utils.escapeHtml(Utils.formatJalaliDateTime(request.startsAt))}</span>
          </div>
          <div class="req-row">
            <span class="req-label">${Utils.escapeHtml(text.END_LABEL)}</span>
            <span class="req-value">${Utils.escapeHtml(Utils.formatJalaliDateTime(request.endsAt))}</span>
          </div>
        </div>
        ${headClass ? '' : `
          <div class="req-card-foot">
            <button class="req-cancel ripple ripple-dark" data-cancel="${request.id}">
              ${Utils.escapeHtml(text.CANCEL_BUTTON)}
            </button>
          </div>`}
      </div>`;
  },

  /** Open request plus its bids, sorted cheapest first. */
  renderActive(request) {
    const text = CONFIG.REQUESTS;

    const bids = DemoStore.bidsOn(request.id)
      .filter(bid => bid.status === DemoStore.BID_STATUS.PENDING)
      // Lowest price first: the requester pays, so the cheapest offer is the
      // one they came here to find.
      .sort((a, b) => a.amount - b.amount);

    const bidsHtml = bids.length
      ? bids.map(bid => `
          <div class="bid-card">
            <div class="bid-top">
              <div class="bid-price">
                ${Utils.formatPrice(bid.amount)}
                <span class="bid-unit">${Utils.escapeHtml(text.TOMAN)}</span>
              </div>
              <!-- Likes are all that is known about a bidder at this stage.
                   No name, no university, nothing identifying. -->
              <div class="bid-likes">
                ${Utils.toPersianDigits(bid.bidderLikes)} ❤️
              </div>
            </div>
            <div class="bid-actions-row">
              <button class="btn btn-primary ripple" data-accept="${bid.id}">
                ${Utils.escapeHtml(text.BID_ACCEPT)}
              </button>
              <button class="btn btn-danger ripple" data-reject="${bid.id}">
                ${Utils.escapeHtml(text.BID_REJECT)}
              </button>
            </div>
          </div>`).join('')
      : `<div class="bids-empty">${Utils.escapeHtml(text.BIDS_EMPTY)}</div>`;

    return this.renderCard(request, '', text.CARD_TITLE)
         + `<div class="bids-title">${Utils.escapeHtml(text.BIDS_TITLE)}</div>`
         + bidsHtml;
  },

  /** Accepted request, with the contact details revealed. */
  renderAccepted(request) {
    const text = CONFIG.REQUESTS;
    const bid = request.acceptedBid;

    /*
      Contact details are fetched through the guarded lookup rather than read
      off the bid. The check that this bid is genuinely accepted lives with the
      data, so this screen cannot show a phone number by asking wrongly — and
      if the lookup declines, nothing is rendered at all.
    */
    const contact = DemoStore.contactForBid(bid.id);
    if (!contact) return this.renderCard(request, 'accepted', text.ACCEPTED_TITLE);

    const rateHtml = bid.rated
      ? `<div class="rate-done">${Utils.escapeHtml(text.RATED_MESSAGE)}</div>`
      : `<div class="rate-row">
           <button class="rate-btn ripple ripple-dark" data-rate="${bid.id}">
             👍 ${Utils.escapeHtml(text.RATE_BUTTON)}
           </button>
         </div>`;

    return this.renderCard(request, 'accepted', text.ACCEPTED_TITLE)
      + `<div class="req-card">
           <div class="req-card-body">
             <div class="bid-top">
               <div class="bid-price">
                 ${Utils.formatPrice(bid.amount)}
                 <span class="bid-unit">${Utils.escapeHtml(text.TOMAN)}</span>
               </div>
             </div>
             <div class="contact-box">
               <div class="contact-row">
                 <span class="contact-label">${Utils.escapeHtml(text.ACCEPTED_NAME_LABEL)}</span>
                 <span class="contact-value">${Utils.escapeHtml(contact.name)}</span>
               </div>
               <div class="contact-row">
                 <span class="contact-label">${Utils.escapeHtml(text.ACCEPTED_PHONE_LABEL)}</span>
                 <span class="contact-value contact-phone">
                   ${Utils.toPersianDigits(contact.phone)}
                 </span>
                 <button class="copy-btn ripple ripple-dark"
                         data-copy="${Utils.escapeHtml(contact.phone)}">
                   ${Utils.escapeHtml(text.COPY_BUTTON)}
                 </button>
               </div>
             </div>
             ${rateHtml}
           </div>
         </div>`;
  },


  /* ======================================================================
     VIEW: CREATE FORM
     ================================================================== */

  renderForm() {
    const text = CONFIG.CREATE;
    const wards = this.wardList();
    const draft = this.draft;

    // Dismissible for good, so it informs the first time and never nags.
    const noticeHtml = localStorage.getItem('paskeshik_hide_notice')
      ? ''
      : `<div class="create-notice">
           ${Utils.escapeHtml(text.NOTICE)}
           <label class="create-notice-dismiss">
             <input type="checkbox" id="notice-dismiss">
             <span>${Utils.escapeHtml(text.NOTICE_DISMISS)}</span>
           </label>
         </div>`;

    // Hidden entirely for majors that do not use wards, rather than shown
    // empty — an unusable control is worse than none.
    const wardHtml = wards
      ? `<div class="field">
           <label class="field-label">${Utils.escapeHtml(text.WARD_LABEL)}</label>
           <button class="picker-btn ripple ripple-dark" id="ward-btn" data-pick="ward">
             <span class="${draft.ward ? '' : 'picker-placeholder'}">
               ${Utils.escapeHtml(draft.ward ? this.wardLabel(draft.ward) : text.WARD_PLACEHOLDER)}
             </span>
             <span class="picker-caret">▼</span>
           </button>
           <span class="field-hint" id="ward-hint"></span>
         </div>`
      : '';

    /** One date-and-time pair, for start or end. */
    const pairHtml = (which, label) => {
      const date = draft[which + 'Date'];
      const time = draft[which + 'Time'];
      return `
        <div class="field">
          <label class="field-label">${Utils.escapeHtml(label)}</label>
          <div class="datetime-pair">
            <button class="picker-btn ripple ripple-dark" data-pick="${which}-date">
              <span class="${date ? '' : 'picker-placeholder'}">
                ${Utils.escapeHtml(date ? this.formatPicked(date, 'date') : text.PICK_DATE)}
              </span>
              <span class="picker-caret">▼</span>
            </button>
            <button class="picker-btn ripple ripple-dark" data-pick="${which}-time">
              <span class="${time ? '' : 'picker-placeholder'}">
                ${Utils.escapeHtml(time ? this.formatPicked(time, 'time') : text.PICK_TIME)}
              </span>
              <span class="picker-caret">▼</span>
            </button>
          </div>
          <span class="field-hint" id="${which}-hint"></span>
        </div>`;
    };

    return `
      <div class="create-screen">
        ${noticeHtml}
        ${wardHtml}
        <div class="field">
          <label class="field-label" for="place-input">
            ${Utils.escapeHtml(text.PLACE_LABEL)}
          </label>
          <input class="field-input" id="place-input" type="text"
                 maxlength="${text.PLACE_MAX_LENGTH}"
                 placeholder="${Utils.escapeHtml(text.PLACE_PLACEHOLDER)}"
                 value="${Utils.escapeHtml(draft.place || '')}"
                 autocomplete="off">
          <span class="field-hint" id="place-hint"></span>
        </div>
        ${pairHtml('start', text.START_LABEL)}
        ${pairHtml('end', text.END_LABEL)}
        <div class="create-actions">
          <button class="btn btn-primary ripple" data-review="1">
            ${Utils.escapeHtml(text.NEXT_BUTTON)}
          </button>
          <button class="btn btn-flat ripple ripple-dark" data-abandon="1">
            ${Utils.escapeHtml(text.CANCEL_BUTTON)}
          </button>
        </div>
      </div>`;
  },


  /* ======================================================================
     VIEW: REVIEW
     ================================================================== */

  renderReview() {
    const text = CONFIG.CREATE;
    const draft = this.draft;

    const row = (label, value) => `
      <div class="review-row">
        <span class="review-label">${Utils.escapeHtml(label)}</span>
        <span class="review-value">${Utils.escapeHtml(value)}</span>
      </div>`;

    const wardRow = draft.ward
      ? row(text.WARD_LABEL, this.wardLabel(draft.ward))
      : '';

    // Shown exactly as they will appear on the board, so what is confirmed is
    // what other people will read.
    const startIso = Jalali.toIso(draft.startDate.jy, draft.startDate.jm,
                                  draft.startDate.jd, draft.startTime.hour,
                                  draft.startTime.minute);
    const endIso = Jalali.toIso(draft.endDate.jy, draft.endDate.jm,
                                draft.endDate.jd, draft.endTime.hour,
                                draft.endTime.minute);

    return `
      <div class="create-screen">
        <p class="review-intro">${Utils.escapeHtml(text.REVIEW_INTRO)}</p>
        <div class="review-card">
          ${wardRow}
          ${row(text.PLACE_LABEL, draft.place)}
          ${row(text.START_LABEL, Utils.formatJalaliDateTime(startIso))}
          ${row(text.END_LABEL, Utils.formatJalaliDateTime(endIso))}
        </div>
        <div class="create-actions">
          <button class="btn btn-primary ripple" data-submit="1">
            ${Utils.escapeHtml(text.SUBMIT_BUTTON)}
          </button>
          <button class="btn btn-flat ripple ripple-dark" data-back-to-form="1">
            ${Utils.escapeHtml(text.BACK_BUTTON)}
          </button>
        </div>
      </div>`;
  },


  /* ======================================================================
     VALIDATION
     ================================================================== */

  /**
   * Check the draft and show any problems against the fields they belong to.
   *
   * @returns {boolean}  Whether the draft may proceed to review.
   */
  validateDraft() {
    const text = CONFIG.CREATE;
    const draft = this.draft;
    let ok = true;

    const fail = (hintId, message, buttonId) => {
      ok = false;
      const hint = document.getElementById(hintId);
      if (hint) { hint.textContent = message; hint.classList.add('error'); }
      if (buttonId) document.getElementById(buttonId)?.classList.add('invalid');
    };

    // Clear anything left from a previous attempt, so old errors cannot
    // linger beside fields that have since been corrected.
    ['ward-hint', 'place-hint', 'start-hint', 'end-hint'].forEach(id => {
      const hint = document.getElementById(id);
      if (hint) { hint.textContent = ''; hint.classList.remove('error'); }
    });

    if (this.wardList() && !draft.ward) fail('ward-hint', text.ERROR_WARD, 'ward-btn');
    if (!draft.place?.trim()) fail('place-hint', text.ERROR_PLACE);
    if (!draft.startDate || !draft.startTime) fail('start-hint', text.ERROR_START);
    if (!draft.endDate || !draft.endTime) fail('end-hint', text.ERROR_END);

    if (!ok) return false;

    const startIso = Jalali.toIso(draft.startDate.jy, draft.startDate.jm,
                                  draft.startDate.jd, draft.startTime.hour,
                                  draft.startTime.minute);
    const endIso = Jalali.toIso(draft.endDate.jy, draft.endDate.jm,
                                draft.endDate.jd, draft.endTime.hour,
                                draft.endTime.minute);

    // The calendar already blocks past days, but the time is typed freely, so
    // a shift earlier today could still slip through.
    if (new Date(startIso).getTime() <= Date.now()) {
      fail('start-hint', text.ERROR_PAST);
      return false;
    }

    // An overnight shift is normal — ۲۰:۰۰ Tuesday to ۰۸:۰۰ Wednesday. What
    // is compared is the two full moments, so the date rolls over naturally
    // and the user never has to think about it.
    if (new Date(endIso).getTime() <= new Date(startIso).getTime()) {
      fail('end-hint', text.ERROR_ORDER);
      return false;
    }

    return true;
  },


  /* ======================================================================
     SHEET, shared with the pickers
     ================================================================== */

  openSheet(title, bodyHtml) {
    document.getElementById('req-sheet-title').textContent = title;
    document.getElementById('req-sheet-body').innerHTML = bodyHtml;
    document.getElementById('req-sheet').classList.add('open');
    document.getElementById('req-sheet-scrim').classList.add('open');
    App.attachRipples(document.getElementById('req-sheet'));
  },

  closeSheet() {
    document.getElementById('req-sheet').classList.remove('open');
    document.getElementById('req-sheet-scrim').classList.remove('open');
  },

  /** Ward chooser, in the same sheet the pickers use. */
  openWardSheet() {
    const rows = (this.wardList() || []).map(ward => `
      <button class="sheet-option ripple ripple-dark ${this.draft.ward === ward.id ? 'selected' : ''}"
              data-ward="${ward.id}">
        <span>${Utils.escapeHtml(ward.label)}</span>
        ${this.draft.ward === ward.id ? '<span class="check">✓</span>' : ''}
      </button>`).join('');

    this.openSheet(CONFIG.CREATE.WARD_LABEL, rows);
  },

  /**
   * Open a date or time picker for one end of the shift.
   *
   * @param {string} target  'start-date', 'start-time', 'end-date', 'end-time'.
   */
  openPicker(target) {
    const [which, kind] = target.split('-');
    const today = Jalali.today();

    if (kind === 'date') {
      /*
        The end date cannot precede the start date, so the calendar's floor
        moves to the chosen start once there is one. Blocking it in the picker
        is better than accepting it and complaining afterwards.
      */
      const floor = (which === 'end' && this.draft.startDate)
        ? this.draft.startDate
        : { jy: today[0], jm: today[1], jd: today[2] };

      DatePicker.openDate({
        sheet: this,
        initial: this.draft[which + 'Date'] || floor,
        min: floor,
        onPick: value => {
          this.draft[which + 'Date'] = value;

          // Choosing a start after the existing end would leave the pair
          // contradicting itself, so the end is cleared rather than left to
          // fail validation later.
          if (which === 'start' && this.draft.endDate) {
            const rank = d => d.jy * 10000 + d.jm * 100 + d.jd;
            if (rank(this.draft.endDate) < rank(value)) this.draft.endDate = null;
          }

          this.show('form');
        }
      });
      return;
    }

    DatePicker.openTime({
      sheet: this,
      initial: this.draft[which + 'Time'],
      onPick: value => {
        this.draft[which + 'Time'] = value;
        this.show('form');
      }
    });
  },


  /* ======================================================================
     ACTIONS
     ================================================================== */

  submit() {
    const draft = this.draft;

    DemoStore.createRequest({
      ward: draft.ward || null,
      place: draft.place.trim(),
      startsAt: Jalali.toIso(draft.startDate.jy, draft.startDate.jm,
                             draft.startDate.jd, draft.startTime.hour,
                             draft.startTime.minute),
      endsAt: Jalali.toIso(draft.endDate.jy, draft.endDate.jm,
                           draft.endDate.jd, draft.endTime.hour,
                           draft.endTime.minute)
    });

    this.draft = {};
    this.show('list');
    alert(CONFIG.CREATE.SUCCESS);
  },

  /**
   * Copy text to the clipboard.
   *
   * The modern clipboard API is unavailable outside a secure context and on
   * some in-app browsers, so a hidden textarea and the legacy command stand in
   * when it is missing. Copying a phone number is the whole point of the
   * button, so it needs to work everywhere rather than only where it is
   * convenient.
   *
   * @param {string} value
   */
  async copyText(value) {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const field = document.createElement('textarea');
      field.value = value;
      // Kept out of view and non-interactive, so it never flashes on screen.
      field.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
      document.body.appendChild(field);
      field.select();
      document.execCommand('copy');
      field.remove();
    }
    alert(CONFIG.REQUESTS.COPIED_MESSAGE);
  },


  /* ======================================================================
     RENDERING AND EVENTS
     ================================================================== */

  render() {
    return `
      <div id="req-view"></div>
      <div class="sheet-scrim" id="req-sheet-scrim"></div>
      <div class="sheet" id="req-sheet">
        <div class="sheet-handle"></div>
        <div class="sheet-title" id="req-sheet-title"></div>
        <div class="sheet-body" id="req-sheet-body"></div>
      </div>`;
  },

  /**
   * Swap the visible view.
   *
   * @param {string} [view]  'list', 'form' or 'review'. Keeps the current one
   *                         when omitted, which is how a redraw after a picker
   *                         stays where it was.
   */
  show(view) {
    if (view) this.view = view;

    const container = document.getElementById('req-view');
    container.innerHTML =
      this.view === 'form'   ? this.renderForm() :
      this.view === 'review' ? this.renderReview() :
                               this.renderList();

    // The place field is not redrawn from its own state as the user types, so
    // its handler is attached here rather than delegated.
    const place = document.getElementById('place-input');
    if (place) {
      place.addEventListener('input', () => { this.draft.place = place.value; });
    }

    const dismiss = document.getElementById('notice-dismiss');
    if (dismiss) {
      dismiss.addEventListener('change', () => {
        if (dismiss.checked) localStorage.setItem('paskeshik_hide_notice', '1');
        else localStorage.removeItem('paskeshik_hide_notice');
      });
    }

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

    document.getElementById('app-content').addEventListener('click', async event => {
      const text = CONFIG.REQUESTS;
      const hit = selector => event.target.closest(selector);

      // Start a new request. Blocked while one is already live, since a
      // second would have nowhere to live on this screen.
      if (hit('[data-new-request]')) {
        if (DemoStore.myRequest()) { alert(CONFIG.CREATE.ERROR_ACTIVE); return; }
        this.draft = {};
        this.show('form');
        return;
      }

      if (hit('[data-abandon]')) { this.draft = {}; this.show('list'); return; }
      if (hit('[data-back-to-form]')) { this.show('form'); return; }

      if (hit('[data-review]')) {
        if (this.validateDraft()) this.show('review');
        return;
      }

      if (hit('[data-submit]')) { this.submit(); return; }

      const picker = hit('[data-pick]');
      if (picker) {
        if (picker.dataset.pick === 'ward') this.openWardSheet();
        else this.openPicker(picker.dataset.pick);
        return;
      }

      const ward = hit('[data-ward]');
      if (ward) {
        this.draft.ward = ward.dataset.ward;
        this.closeSheet();
        this.show('form');
        return;
      }

      if (hit('#req-sheet-scrim')) { this.closeSheet(); return; }

      // Accepting is irreversible and voids every other offer, so the
      // confirmation says so rather than asking a bare "are you sure".
      const accept = hit('[data-accept]');
      if (accept) {
        if (!confirm(text.BID_ACCEPT_CONFIRM)) return;
        DemoStore.acceptBid(accept.dataset.accept);
        this.show('list');
        return;
      }

      const reject = hit('[data-reject]');
      if (reject) {
        if (!confirm(text.BID_REJECT_CONFIRM)) return;
        DemoStore.setBidStatus(reject.dataset.reject, DemoStore.BID_STATUS.REJECTED);
        this.show('list');
        return;
      }

      const cancel = hit('[data-cancel]');
      if (cancel) {
        if (!confirm(text.CANCEL_CONFIRM)) return;
        DemoStore.cancelRequest(cancel.dataset.cancel);
        this.show('list');
        return;
      }

      const copy = hit('[data-copy]');
      if (copy) { await this.copyText(copy.dataset.copy); return; }

      const rate = hit('[data-rate]');
      if (rate) { DemoStore.rateBid(rate.dataset.rate); this.show('list'); }
    });
  },

  mount() {
    // Always open on the list, so navigating away mid-form and back does not
    // drop the user into a half-filled screen with no explanation.
    this.view = 'list';
    this.show('list');
    this.bindOnce();
  }

};
