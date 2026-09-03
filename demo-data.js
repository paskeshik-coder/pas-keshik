/**
 * ============================================================================
 * پاس‌کشیک — DEMO DATA  (demo-data.js)
 * ============================================================================
 * Fabricated requests and bids, so the screens can be built and reviewed
 * before any database exists.
 *
 * DELETE THIS FILE IN STAGE 3, along with its <script> tag in index.html. The
 * screens read through DemoStore's methods rather than touching this array,
 * so replacing it with real Supabase calls means rewriting those methods and
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
   * Requests are scoped to the signed-in user's city and رشته, exactly as the
   * real query will be. City and major are read from the saved profile so the
   * board is populated whatever was chosen at sign-up — a fixed city would
   * leave most testers looking at an empty screen.
   *
   * @returns {object[]}  Request records.
   */
  build() {
    const profile = Utils.getLocalProfile() || {};
    const city = profile.city || 'تهران';

    // Universities in the user's city, so the university filter has something
    // meaningful to filter between.
    const local = CONFIG.SIGNUP.PAGE_UNIVERSITY.UNIVERSITIES
      .filter(u => u.city === city);
    const uni = i => (local[i % local.length] || local[0] || { id: '?', name: '؟' });

    return [
      {
        id: 'req-1',
        ownerId: 'other-1',
        universityId: uni(0).id,
        universityName: uni(0).name,
        ward: 'emergency',
        place: 'بیمارستان امام خمینی (ره)',
        startsAt: this.at(3, 8),
        endsAt:   this.at(3, 20),
        createdAt: this.at(-1, 14),
        lowestBid: 450000,
        // A boost expiring in the future puts this above everything else.
        boostedUntil: this.at(2, 12)
      },
      {
        id: 'req-2',
        ownerId: 'other-2',
        universityId: uni(1).id,
        universityName: uni(1).name,
        ward: 'icu',
        place: 'بیمارستان شریعتی',
        startsAt: this.at(1, 20),
        endsAt:   this.at(2, 8),
        createdAt: this.at(0, 9),
        lowestBid: 800000,
        boostedUntil: null
      },
      {
        id: 'req-3',
        ownerId: 'other-3',
        universityId: uni(0).id,
        universityName: uni(0).name,
        ward: 'internal',
        place: 'بیمارستان سینا',
        startsAt: this.at(5, 8),
        endsAt:   this.at(5, 14),
        createdAt: this.at(-2, 11),
        // No bids yet, so the lowest-bid line is hidden on this card.
        lowestBid: null,
        boostedUntil: null
      },
      {
        id: 'req-4',
        // Owned by the signed-in user, to exercise the own-request state.
        ownerId: 'me',
        universityId: uni(2).id,
        universityName: uni(2).name,
        ward: 'surgery',
        place: 'بیمارستان دکتر شریعتی',
        startsAt: this.at(4, 14),
        endsAt:   this.at(4, 22),
        createdAt: this.at(-1, 8),
        lowestBid: 620000,
        boostedUntil: null
      },
      {
        id: 'req-5',
        ownerId: 'other-4',
        universityId: uni(1).id,
        universityName: uni(1).name,
        ward: 'pediatrics',
        place: 'بیمارستان کودکان',
        startsAt: this.at(2, 8),
        endsAt:   this.at(2, 20),
        createdAt: this.at(-3, 16),
        lowestBid: 1250000,
        boostedUntil: null
      },
      {
        id: 'req-6',
        ownerId: 'other-5',
        universityId: uni(0).id,
        universityName: uni(0).name,
        ward: 'emergency',
        place: 'داروخانه جمعیت هلال احمر',
        startsAt: this.at(6, 16),
        endsAt:   this.at(6, 23),
        createdAt: this.at(-4, 10),
        lowestBid: null,
        boostedUntil: null
      }
    ];
  }

};


/**
 * The data layer the screens actually talk to.
 *
 * Every screen reads and writes through these methods rather than reaching
 * into DemoData directly. That indirection is the whole point: in Stage 3 each
 * method body is replaced with a Supabase call, and no screen changes at all.
 */
const DemoStore = {

  /** Loaded requests. Built once per session. */
  _requests: null,

  /** Bids placed during this session, keyed by request id. */
  _myBids: {},

  /**
   * The signed-in user's id.
   *
   * In Stage 3 this becomes the Telegram numeric user id. The demo uses a
   * fixed string, matching the ownerId on the request seeded as the user's own.
   */
  currentUserId() { return 'me'; },

  /**
   * Fetch the board.
   *
   * Ordering is decided here, on what will become the server side, and the
   * screen renders whatever order it receives. Deliberate: if the client
   * chose the order, a technical user could promote their own request to the
   * top simply by editing the page.
   *
   * @returns {object[]}  Requests, boosted first, then newest first.
   */
  getRequests() {
    if (!this._requests) this._requests = DemoData.build();

    const now = Date.now();

    return [...this._requests]
      // A request disappears once its shift has started or a week has passed,
      // whichever comes first. Computed on read, so nothing has to be
      // scheduled and nothing can silently stop running.
      .filter(request => {
        const started = new Date(request.startsAt).getTime() <= now;
        const weekOld = now - new Date(request.createdAt).getTime()
                        > 7 * 24 * 60 * 60 * 1000;
        return !started && !weekOld;
      })
      .sort((a, b) => {
        const aBoosted = a.boostedUntil && new Date(a.boostedUntil).getTime() > now;
        const bBoosted = b.boostedUntil && new Date(b.boostedUntil).getTime() > now;
        if (aBoosted !== bBoosted) return aBoosted ? -1 : 1;
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
  },

  /**
   * The current user's bid on a request, if any.
   *
   * @param   {string} requestId
   * @returns {number|null}  The amount bid, or null.
   */
  myBidOn(requestId) {
    return this._myBids[requestId] ?? null;
  },

  /**
   * Place or replace a bid.
   *
   * One bid per user per request: re-bidding replaces the previous amount
   * rather than adding a second.
   *
   * @param {string} requestId
   * @param {number} amount     Price in تومان.
   */
  placeBid(requestId, amount) {
    this._myBids[requestId] = amount;

    // Keep the displayed lowest bid honest, so the card updates immediately.
    const request = this._requests.find(r => r.id === requestId);
    if (request && (request.lowestBid === null || amount < request.lowestBid)) {
      request.lowestBid = amount;
    }
  }

};
