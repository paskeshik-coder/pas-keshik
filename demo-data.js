/**
 * ============================================================================
 * پاس‌کشیک — DEMO DATA  (demo-data.js)
 * ============================================================================
 * Fabricated requests and bids, so the screens can be built and reviewed
 * before any database exists.
 *
 * DELETE THIS FILE IN STAGE 3, along with its <script> tag in index.html. The
 * screens read and write through DemoStore's methods rather than touching
 * these arrays, so replacing it means rewriting those method bodies and
 * nothing else.
 *
 * Dates are generated relative to now, so the demo board never goes stale.
 * ============================================================================
 */

const DemoData = {

  /**
   * Build a timestamp offset from now.
   *
   * @param   {number} days   Days from now. Negative is in the past.
   * @param   {number} hour   Hour of day in Tehran time, 0-23.
   * @returns {string}        ISO 8601 timestamp.
   */
  at(days, hour) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    // Tehran is UTC+3:30, so a Tehran wall-clock hour is that hour minus 3:30
    // in UTC. Written out rather than using a library, since it is one line.
    date.setUTCHours(hour - 3, -30, 0, 0);
    return date.toISOString();
  },

  /**
   * Generate the demo board.
   *
   * Requests are generated for EVERY رشته and filtered down on read, which
   * mirrors the real query and makes the scoping testable: change your رشته
   * and the board genuinely changes rather than the same rows being relabelled.
   *
   * @returns {{requests: object[], bids: object[]}}
   */
  build() {
    const profile = Utils.getLocalProfile() || {};
    const city = profile.city || 'تهران';

    const local = CONFIG.SIGNUP.PAGE_UNIVERSITY.UNIVERSITIES
      .filter(u => u.city === city);
    const pool = local.length ? local : [{ id: 'demo', name: 'دانشگاه نمونه' }];
    const uni = i => pool[i % pool.length];

    // Places and wards suited to each رشته. A pharmacy shift belongs to a
    // pharmacy student and would never appear on a medical board.
    const byMajor = {
      medicine: {
        wards: ['emergency', 'icu', 'internal', 'surgery', 'pediatrics'],
        places: [
          'بیمارستان امام خمینی (ره)', 'بیمارستان شریعتی', 'بیمارستان سینا',
          'بیمارستان طالقانی', 'بیمارستان کودکان'
        ]
      },
      nursing: {
        wards: ['icu', 'emergency', 'ccu', 'internal', 'surgery'],
        places: [
          'بیمارستان قلب شهید رجایی', 'بیمارستان میلاد', 'بیمارستان فیروزگر',
          'بیمارستان لقمان حکیم', 'بیمارستان رسول اکرم'
        ]
      },
      midwifery: {
        wards: [null, null, null, null, null],
        places: [
          'بیمارستان زنان مهدیه', 'زایشگاه شهید اکبرآبادی', 'بیمارستان صارم',
          'درمانگاه مادر و کودک', 'بیمارستان آرش'
        ]
      },
      pharmacy: {
        wards: [null, null, null, null, null],
        places: [
          'داروخانه جمعیت هلال احمر', 'داروخانه شبانه‌روزی ۲۹ فروردین',
          'داروخانه بیمارستان دی', 'داروخانه دکتر رضایی', 'داروخانه مرکزی'
        ]
      }
    };

    /*
      Shape shared by all majors, so a change to the timing or bid pattern
      applies everywhere instead of being repeated four times and drifting.

      Index 0 is boosted, index 3 is owned by the user, index 2 has no bids.
      `bidAmounts` seeds other people's pending offers on each request.
    */
    const shape = [
      { startDay: 3, startHour: 8,  endDay: 3, endHour: 20, createdDay: -1, boost: true,  own: false, bidAmounts: [450000, 700000] },
      { startDay: 1, startHour: 20, endDay: 2, endHour: 8,  createdDay: 0,  boost: false, own: false, bidAmounts: [800000] },
      { startDay: 5, startHour: 8,  endDay: 5, endHour: 14, createdDay: -2, boost: false, own: false, bidAmounts: [] },
      { startDay: 4, startHour: 14, endDay: 4, endHour: 22, createdDay: -1, boost: false, own: true,  bidAmounts: [620000, 900000] },
      { startDay: 2, startHour: 8,  endDay: 2, endHour: 20, createdDay: -3, boost: false, own: false, bidAmounts: [1250000, 1400000] }
    ];

    const requests = [];
    const bids = [];

    for (const [majorId, content] of Object.entries(byMajor)) {
      shape.forEach((row, i) => {
        const requestId = `${majorId}-${i}`;

        requests.push({
          id: requestId,
          major: majorId,
          ownerId: row.own ? 'me' : `other-${majorId}-${i}`,
          universityId: uni(i).id,
          universityName: uni(i).name,
          ward: content.wards[i],
          place: content.places[i],
          startsAt: this.at(row.startDay, row.startHour),
          endsAt:   this.at(row.endDay, row.endHour),
          createdAt: this.at(row.createdDay, 10),
          boostedUntil: row.boost ? this.at(2, 12) : null
        });

        row.bidAmounts.forEach((amount, b) => {
          bids.push({
            id: `${requestId}-bid-${b}`,
            requestId,
            bidderId: `bidder-${majorId}-${i}-${b}`,
            bidderLikes: (b * 3) + 2,
            amount,
            status: 'pending',
            createdAt: this.at(row.createdDay, 12)
          });
        });
      });
    }

    return { requests, bids };
  }

};


/**
 * The data layer the screens actually talk to.
 *
 * Every screen reads and writes through these methods rather than reaching
 * into DemoData directly. In Stage 3 each method body becomes a Supabase call
 * and no screen changes at all.
 */
const DemoStore = {

  _requests: null,
  _bids: null,

  /** Load the demo set once per session. */
  _load() {
    if (this._requests) return;
    const built = DemoData.build();
    this._requests = built.requests;
    this._bids = built.bids;
  },

  /**
   * The signed-in user's id.
   * In Stage 3 this becomes the Telegram numeric user id.
   */
  currentUserId() { return 'me'; },

  /*
    Bid statuses. Only 'pending' counts as a live offer.

      pending    awaiting the requester's decision
      accepted   chosen; the request is now closed
      rejected   turned down by the requester
      expired    the request timed out beneath it
      cancelled  the requester withdrew the request
  */
  BID_STATUS: {
    PENDING: 'pending',
    ACCEPTED: 'accepted',
    REJECTED: 'rejected',
    EXPIRED: 'expired',
    CANCELLED: 'cancelled'
  },

  /**
   * The lowest live offer on a request.
   *
   * Computed from pending bids each time it is asked for, rather than stored
   * on the request and updated by hand. That is what makes a rejected bid stop
   * counting immediately and everywhere: there is no cached figure left behind
   * to go stale, so the board cannot advertise a price nobody is offering.
   *
   * @param   {string} requestId
   * @returns {number|null}  Lowest pending amount, or null if there are none.
   */
  lowestBidOn(requestId) {
    this._load();

    const live = this._bids.filter(bid =>
      bid.requestId === requestId && bid.status === this.BID_STATUS.PENDING
    );

    if (!live.length) return null;
    return Math.min(...live.map(bid => bid.amount));
  },

  /**
   * All bids on a request, newest first. Used by درخواست‌های من.
   *
   * @param   {string} requestId
   * @returns {object[]}
   */
  bidsOn(requestId) {
    this._load();
    return this._bids
      .filter(bid => bid.requestId === requestId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  /**
   * Fetch the board.
   *
   * Scope and ordering are both decided here, on what becomes the server side.
   * The screen renders whatever it is given — if the client chose the order, a
   * technical user could promote their own request by editing the page.
   *
   * @returns {object[]}  Requests with a computed lowestBid attached.
   */
  getRequests() {
    this._load();

    const now = Date.now();
    const profile = Utils.getLocalProfile() || {};

    return this._requests
      /*
        SCOPE. A user only ever sees requests from their own رشته. Not a filter
        they can widen: a pharmacy student cannot cover a nursing shift, so
        those requests are not theirs to see. City scoping is implicit, since
        every request already uses a university from the user's own city.
      */
      .filter(request => !profile.major || request.major === profile.major)

      /*
        A request lives until its shift begins, and no longer.

        There was also a one-week limit, now removed: it was arbitrary, and it
        made a shift posted far in advance vanish before it happened. Shift
        start is the only boundary that means anything — after it, the request
        is not late, it is moot.

        Computed on read, so nothing is scheduled and nothing can silently
        stop running.
      */
      .filter(request => new Date(request.startsAt).getTime() > now)

      // The lowest bid is attached at read time rather than stored, so it can
      // never disagree with the bids themselves.
      .map(request => ({
        ...request,
        lowestBid: this.lowestBidOn(request.id)
      }))

      .sort((a, b) => {
        // Boosted requests sit above everything, regardless of urgency. That
        // is what the boost is.
        const aBoosted = a.boostedUntil && new Date(a.boostedUntil).getTime() > now;
        const bBoosted = b.boostedUntil && new Date(b.boostedUntil).getTime() > now;
        if (aBoosted !== bBoosted) return aBoosted ? -1 : 1;

        /*
          Then soonest shift first, rather than most recently posted.

          Newest-first was the original rule, and it stopped making sense once
          the one-week expiry was removed: a shift six months away posted this
          morning would outrank a shift tomorrow posted last week. Sorting by
          when the shift actually begins puts the requests that are running out
          of time at the top, which is what someone scanning the board needs.
        */
        return new Date(a.startsAt) - new Date(b.startsAt);
      });
  },

  /**
   * The current user's live bid on a request, if any.
   *
   * Only a pending bid counts. Once a bid has been rejected the user is free
   * to offer again, so a rejected bid must not leave the button showing
   * «پیشنهاد داده‌اید».
   *
   * @param   {string} requestId
   * @returns {number|null}
   */
  myBidOn(requestId) {
    this._load();

    const mine = this._bids.find(bid =>
      bid.requestId === requestId &&
      bid.bidderId === this.currentUserId() &&
      bid.status === this.BID_STATUS.PENDING
    );

    return mine ? mine.amount : null;
  },

  /**
   * Place or replace a bid.
   *
   * One live bid per user per request: re-bidding replaces the amount rather
   * than adding a second offer.
   *
   * @param {string} requestId
   * @param {number} amount     Price in تومان.
   */
  placeBid(requestId, amount) {
    this._load();

    const existing = this._bids.find(bid =>
      bid.requestId === requestId &&
      bid.bidderId === this.currentUserId() &&
      bid.status === this.BID_STATUS.PENDING
    );

    if (existing) {
      existing.amount = amount;
      return;
    }

    this._bids.push({
      id: `${requestId}-bid-me-${Date.now()}`,
      requestId,
      bidderId: this.currentUserId(),
      bidderLikes: 0,
      amount,
      status: this.BID_STATUS.PENDING,
      createdAt: new Date().toISOString()
    });
  },

  /**
   * Change a bid's status.
   *
   * Rejecting, cancelling or expiring a bid takes it out of the pending set,
   * which removes it from the lowest-bid calculation on the next read with no
   * further bookkeeping.
   *
   * @param {string} bidId
   * @param {string} status  One of BID_STATUS.
   */
  setBidStatus(bidId, status) {
    this._load();
    const bid = this._bids.find(b => b.id === bidId);
    if (bid) {
      bid.status = status;
      bid.statusChangedAt = new Date().toISOString();
    }
  },

  /**
   * Accept a bid: mark it accepted and reject every other live offer.
   *
   * @param {string} bidId
   */
  acceptBid(bidId) {
    this._load();

    const accepted = this._bids.find(b => b.id === bidId);
    if (!accepted) return;

    this._bids.forEach(bid => {
      if (bid.requestId !== accepted.requestId) return;
      if (bid.status !== this.BID_STATUS.PENDING) return;

      bid.status = (bid.id === bidId)
        ? this.BID_STATUS.ACCEPTED
        : this.BID_STATUS.REJECTED;
      bid.statusChangedAt = new Date().toISOString();
    });
  }

};
