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
   * Requests are generated for EVERY رشته, not just the signed-in user's, and
   * filtered down on read. That mirrors what the real query does and makes the
   * scoping testable: change your رشته and the board genuinely changes,
   * rather than the same rows being relabelled.
   *
   * Places are chosen to suit each رشته — a pharmacy shift belongs to a
   * pharmacy student and would never appear on a medical board.
   *
   * @returns {object[]}  Request records across all majors.
   */
  build() {
    const profile = Utils.getLocalProfile() || {};
    const city = profile.city || 'تهران';

    // Universities in the user's city, so the university filter has something
    // real to filter between.
    const local = CONFIG.SIGNUP.PAGE_UNIVERSITY.UNIVERSITIES
      .filter(u => u.city === city);
    const pool = local.length ? local : [{ id: 'demo', name: 'دانشگاه نمونه' }];
    const uni = i => pool[i % pool.length];

    /*
      Per-major templates. Each major gets five requests: one boosted, one
      owned by the signed-in user, one with no bids yet, and two ordinary ones.
      That covers every card state on whichever major is chosen at sign-up,
      instead of only on medicine.

      `ward` is null for majors that do not use wards, matching what the real
      request form will produce.
    */
    const byMajor = {
      medicine: {
        wards: ['emergency', 'icu', 'internal', 'surgery', 'pediatrics'],
        places: [
          'بیمارستان امام خمینی (ره)',
          'بیمارستان شریعتی',
          'بیمارستان سینا',
          'بیمارستان طالقانی',
          'بیمارستان کودکان'
        ]
      },
      nursing: {
        wards: ['icu', 'emergency', 'ccu', 'internal', 'surgery'],
        places: [
          'بیمارستان قلب شهید رجایی',
          'بیمارستان میلاد',
          'بیمارستان فیروزگر',
          'بیمارستان لقمان حکیم',
          'بیمارستان رسول اکرم'
        ]
      },
      midwifery: {
        wards: [null, null, null, null, null],
        places: [
          'بیمارستان زنان مهدیه',
          'زایشگاه شهید اکبرآبادی',
          'بیمارستان صارم',
          'درمانگاه مادر و کودک',
          'بیمارستان آرش'
        ]
      },
      pharmacy: {
        wards: [null, null, null, null, null],
        places: [
          'داروخانه جمعیت هلال احمر',
          'داروخانه شبانه‌روزی ۲۹ فروردین',
          'داروخانه بیمارستان دی',
          'داروخانه دکتر رضایی',
          'داروخانه مرکزی'
        ]
      }
    };

    /*
      Shape shared by all majors. Kept as one table so a change to the timing
      or bid pattern applies everywhere, rather than being repeated four times
      and drifting apart.

      Index 0 is boosted, index 3 is owned by the user, index 2 has no bids.
    */
    const shape = [
      { startDay: 3, startHour: 8,  endDay: 3, endHour: 20, createdDay: -1, lowestBid: 450000,  boost: true,  own: false },
      { startDay: 1, startHour: 20, endDay: 2, endHour: 8,  createdDay: 0,  lowestBid: 800000,  boost: false, own: false },
      { startDay: 5, startHour: 8,  endDay: 5, endHour: 14, createdDay: -2, lowestBid: null,    boost: false, own: false },
      { startDay: 4, startHour: 14, endDay: 4, endHour: 22, createdDay: -1, lowestBid: 620000,  boost: false, own: true  },
      { startDay: 2, startHour: 8,  endDay: 2, endHour: 20, createdDay: -3, lowestBid: 1250000, boost: false, own: false }
    ];

    const requests = [];

    for (const [majorId, content] of Object.entries(byMajor)) {
      shape.forEach((row, i) => {
        requests.push({
          id: `${majorId}-${i}`,
          major: majorId,
          ownerId: row.own ? 'me' : `other-${majorId}-${i}`,
          universityId: uni(i).id,
          universityName: uni(i).name,
          ward: content.wards[i],
          place: content.places[i],
          startsAt: this.at(row.startDay, row.startHour),
          endsAt:   this.at(row.endDay, row.endHour),
          createdAt: this.at(row.createdDay, 10),
          lowestBid: row.lowestBid,
          boostedUntil: row.boost ? this.at(2, 12) : null
        });
      });
    }

    return requests;
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
   * fixed string, matching the ownerId on the requests seeded as the user's.
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
    const profile = Utils.getLocalProfile() || {};

    return [...this._requests]
      /*
        SCOPE, applied before anything else.

        A user only ever sees requests from their own رشته. This is not a
        filter the user can widen — a pharmacy student cannot cover a nursing
        shift, so those requests are not theirs to see. City scoping is
        implicit here because every generated request already uses a
        university from the user's own city.

        In Stage 3 this becomes a WHERE clause on the server. Doing it there
        rather than in the browser matters: a client-side scope is a display
        convention, not a boundary, and could be lifted by anyone willing to
        edit the page.
      */
      .filter(request => !profile.major || request.major === profile.major)

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
