/**
 * Pas-Keshik — the PUBLIC half of the configuration: everything the browser
 * needs. Everything that is text, a colour, a list (majors, wards, cities,
 * universities), a limit, a timing or an on/off switch lives in exactly one
 * of two modules and nowhere else:
 *   - this one, which is published with the website (scripts/publish.js) and
 *     loaded by the front end, the Node test-suite and the Edge Functions;
 *   - server-config.js, which adds what only the server uses (the bot's and
 *     the admin menu's texts, admin command names, admin error messages,
 *     server-only limits, timings and switches) and is never published.
 * Nothing here may be secret or server-only: this file is public.
 * It must stay plain data plus tiny pure helpers, with no imports and no
 * platform-specific APIs.
 *
 * The owner reviews every Persian string and list in docs/REVIEW-fa.md, which
 * is generated from both modules by scripts/gen-review.js (a test fails when
 * that document is out of date).
 */

/**
 * The single release version. Every script, stylesheet and module reference in
 * the front end carries ?v=<VERSION> so Telegram's aggressive cache can never
 * serve a stale file. Bump it in every PR that touches the front end
 * (scripts/set-version.js rewrites every reference; a test enforces it).
 */
export const VERSION = '0.6.1';

/**
 * Recursively freezes a plain object/array tree so no module can mutate the
 * shared configuration at run time (a mutation in one screen would otherwise
 * silently leak into every other user of the config).
 * @template T
 * @param {T} value
 * @returns {T}
 */
export function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze(value[key]);
  }
  return value;
}

/* ------------------------------------------------------------------------ */
/* Lists                                                                     */
/* ------------------------------------------------------------------------ */

/**
 * The nine majors, in carousel order (alphabetical, the owner's choice; the
 * carousel starts on CONFIG.defaultMajor). `hasWards` decides whether
 * requests carry a ward (and whether the board and alerts have a ward
 * filter). Ids are stored per user and per request, so they never change.
 */
const MAJORS = [
  { id: 'nursing', label: 'پرستاری', icon: '💉', hasWards: true },
  { id: 'medicine', label: 'پزشکی', icon: '🩺', hasWards: true },
  { id: 'or_tech', label: 'تکنولوژی اتاق عمل', icon: '🥼', hasWards: false },
  { id: 'radiology_tech', label: 'تکنولوژی پرتوشناسی', icon: '🩻', hasWards: false },
  { id: 'pharmacy', label: 'داروسازی', icon: '💊', hasWards: false },
  { id: 'lab_sciences', label: 'علوم آزمایشگاهی', icon: '🧪', hasWards: false },
  { id: 'ems', label: 'فوریت‌های پزشکی', icon: '🚑', hasWards: false },
  { id: 'midwifery', label: 'مامایی', icon: '🤱', hasWards: false },
  { id: 'anesthesia', label: 'هوشبری', icon: '😷', hasWards: false },
];

/**
 * Ward lists per major (only majors with hasWards). Each list must end
 * with the «سایر» entry (id "other"); a test enforces it. Ids are stored in the
 * database, so never change an id once real data exists — only its label.
 */
const WARDS = {
  medicine: [
    { id: 'emergency', label: 'اورژانس' },
    { id: 'internal', label: 'داخلی' },
    { id: 'surgery', label: 'جراحی عمومی' },
    { id: 'pediatrics', label: 'اطفال' },
    { id: 'obgyn', label: 'زنان و زایمان' },
    { id: 'cardiology', label: 'قلب' },
    { id: 'orthopedics', label: 'ارتوپدی' },
    { id: 'neurology', label: 'مغز و اعصاب (نورولوژی)' },
    { id: 'neurosurgery', label: 'جراحی مغز و اعصاب' },
    { id: 'infectious', label: 'عفونی' },
    { id: 'icu', label: 'مراقبت‌های ویژه (ICU)' },
    { id: 'ccu', label: 'مراقبت‌های ویژهٔ قلبی (CCU)' },
    { id: 'nicu', label: 'مراقبت‌های ویژهٔ نوزادان (NICU)' },
    { id: 'psychiatry', label: 'روان‌پزشکی' },
    { id: 'dermatology', label: 'پوست' },
    { id: 'ophthalmology', label: 'چشم' },
    { id: 'ent', label: 'گوش، حلق و بینی' },
    { id: 'urology', label: 'اورولوژی' },
    { id: 'anesthesia', label: 'بیهوشی' },
    { id: 'radiology', label: 'رادیولوژی' },
    { id: 'burns', label: 'سوختگی' },
    { id: 'toxicology', label: 'مسمومیت' },
    { id: 'other', label: 'سایر' },
  ],
  nursing: [
    { id: 'emergency', label: 'اورژانس' },
    { id: 'internal', label: 'داخلی' },
    { id: 'surgery', label: 'جراحی' },
    { id: 'pediatrics', label: 'کودکان' },
    { id: 'icu', label: 'مراقبت‌های ویژه (ICU)' },
    { id: 'ccu', label: 'مراقبت‌های ویژهٔ قلبی (CCU)' },
    { id: 'post_ccu', label: 'پست CCU' },
    { id: 'nicu', label: 'مراقبت‌های ویژهٔ نوزادان (NICU)' },
    { id: 'operating_room', label: 'اتاق عمل' },
    { id: 'dialysis', label: 'دیالیز' },
    { id: 'obgyn', label: 'زنان و زایمان' },
    { id: 'cardiology', label: 'قلب' },
    { id: 'orthopedics', label: 'ارتوپدی' },
    { id: 'neurology', label: 'مغز و اعصاب' },
    { id: 'infectious', label: 'عفونی' },
    { id: 'oncology', label: 'انکولوژی (سرطان)' },
    { id: 'burns', label: 'سوختگی' },
    { id: 'psychiatry', label: 'روان‌پزشکی' },
    { id: 'other', label: 'سایر' },
  ],
};

/**
 * Cities that appear in the university list. The id is stored in the
 * database (the board groups users by city), so ids must never change.
 */
const CITIES = {
  tehran: 'تهران',
  karaj: 'کرج',
  qom: 'قم',
  isfahan: 'اصفهان',
  najafabad: 'نجف‌آباد',
  kashan: 'کاشان',
  mashhad: 'مشهد',
  sabzevar: 'سبزوار',
  gonabad: 'گناباد',
  torbat_heydarieh: 'تربت حیدریه',
  neyshabur: 'نیشابور',
  torbat_jam: 'تربت جام',
  shiraz: 'شیراز',
  kazerun: 'کازرون',
  fasa: 'فسا',
  jahrom: 'جهرم',
  lar: 'لار',
  gerash: 'گراش',
  abadeh: 'آباده',
  tabriz: 'تبریز',
  maragheh: 'مراغه',
  sarab: 'سراب',
  urmia: 'ارومیه',
  khoy: 'خوی',
  ardabil: 'اردبیل',
  khalkhal: 'خلخال',
  ahvaz: 'اهواز',
  abadan: 'آبادان',
  dezful: 'دزفول',
  behbahan: 'بهبهان',
  shushtar: 'شوشتر',
  kerman: 'کرمان',
  rafsanjan: 'رفسنجان',
  jiroft: 'جیرفت',
  bam: 'بم',
  sirjan: 'سیرجان',
  yazd: 'یزد',
  rasht: 'رشت',
  sari: 'ساری',
  babol: 'بابل',
  tonekabon: 'تنکابن',
  gorgan: 'گرگان',
  semnan: 'سمنان',
  shahroud: 'شاهرود',
  zanjan: 'زنجان',
  qazvin: 'قزوین',
  hamadan: 'همدان',
  asadabad: 'اسدآباد',
  arak: 'اراک',
  saveh: 'ساوه',
  khomein: 'خمین',
  kermanshah: 'کرمانشاه',
  sanandaj: 'سنندج',
  khorramabad: 'خرم‌آباد',
  ilam: 'ایلام',
  yasuj: 'یاسوج',
  shahrekord: 'شهرکرد',
  bushehr: 'بوشهر',
  bandar_abbas: 'بندرعباس',
  zahedan: 'زاهدان',
  zabol: 'زابل',
  iranshahr: 'ایرانشهر',
  birjand: 'بیرجند',
  tabas: 'طبس',
  bojnurd: 'بجنورد',
  esfarayen: 'اسفراین',
};

/**
 * Universities and faculties that train at least one of the nine majors,
 * each with its city id (final, reviewed by the owner). The university id is
 * stored per user, so ids must never change once real data exists. Missing
 * universities reach the owner by email (see text.signup.universityMissing)
 * and get added here.
 */
const UNIVERSITIES = [
  // تهران
  { id: 'tums', name: 'دانشگاه علوم پزشکی تهران', city: 'tehran' },
  { id: 'sbmu', name: 'دانشگاه علوم پزشکی شهید بهشتی', city: 'tehran' },
  { id: 'iums', name: 'دانشگاه علوم پزشکی ایران', city: 'tehran' },
  { id: 'bmsu', name: 'دانشگاه علوم پزشکی بقیه‌الله', city: 'tehran' },
  { id: 'ajaums', name: 'دانشگاه علوم پزشکی ارتش', city: 'tehran' },
  { id: 'shahed', name: 'دانشگاه شاهد', city: 'tehran' },
  { id: 'iau_tehran_med', name: 'دانشگاه آزاد اسلامی واحد علوم پزشکی تهران', city: 'tehran' },
  { id: 'iau_pharm', name: 'دانشگاه آزاد اسلامی واحد علوم دارویی', city: 'tehran' },
  // البرز
  { id: 'abzums', name: 'دانشگاه علوم پزشکی البرز', city: 'karaj' },
  { id: 'iau_karaj', name: 'دانشگاه آزاد اسلامی واحد کرج', city: 'karaj' },
  // قم
  { id: 'muq', name: 'دانشگاه علوم پزشکی قم', city: 'qom' },
  { id: 'iau_qom', name: 'دانشگاه آزاد اسلامی واحد قم', city: 'qom' },
  // اصفهان
  { id: 'mui', name: 'دانشگاه علوم پزشکی اصفهان', city: 'isfahan' },
  { id: 'iau_khorasgan', name: 'دانشگاه آزاد اسلامی واحد اصفهان (خوراسگان)', city: 'isfahan' },
  { id: 'iau_najafabad', name: 'دانشگاه آزاد اسلامی واحد نجف‌آباد', city: 'najafabad' },
  { id: 'kaums', name: 'دانشگاه علوم پزشکی کاشان', city: 'kashan' },
  // خراسان رضوی
  { id: 'mums', name: 'دانشگاه علوم پزشکی مشهد', city: 'mashhad' },
  { id: 'iau_mashhad', name: 'دانشگاه آزاد اسلامی واحد مشهد', city: 'mashhad' },
  { id: 'medsab', name: 'دانشگاه علوم پزشکی سبزوار', city: 'sabzevar' },
  { id: 'gmu', name: 'دانشگاه علوم پزشکی گناباد', city: 'gonabad' },
  { id: 'thums', name: 'دانشگاه علوم پزشکی تربت حیدریه', city: 'torbat_heydarieh' },
  { id: 'nums', name: 'دانشگاه علوم پزشکی نیشابور', city: 'neyshabur' },
  { id: 'tbjm', name: 'دانشکده علوم پزشکی تربت جام', city: 'torbat_jam' },
  // فارس
  { id: 'sums', name: 'دانشگاه علوم پزشکی شیراز', city: 'shiraz' },
  { id: 'iau_kazerun', name: 'دانشگاه آزاد اسلامی واحد کازرون', city: 'kazerun' },
  { id: 'fums', name: 'دانشگاه علوم پزشکی فسا', city: 'fasa' },
  { id: 'jums', name: 'دانشگاه علوم پزشکی جهرم', city: 'jahrom' },
  { id: 'lums_lar', name: 'دانشگاه علوم پزشکی لارستان', city: 'lar' },
  { id: 'gerums', name: 'دانشکده علوم پزشکی گراش', city: 'gerash' },
  { id: 'abadeh', name: 'دانشکده علوم پزشکی آباده', city: 'abadeh' },
  // آذربایجان شرقی
  { id: 'tbzmed', name: 'دانشگاه علوم پزشکی تبریز', city: 'tabriz' },
  { id: 'iau_tabriz', name: 'دانشگاه آزاد اسلامی واحد تبریز', city: 'tabriz' },
  { id: 'mrgums', name: 'دانشگاه علوم پزشکی مراغه', city: 'maragheh' },
  { id: 'sarabums', name: 'دانشکده علوم پزشکی سراب', city: 'sarab' },
  // آذربایجان غربی
  { id: 'umsu', name: 'دانشگاه علوم پزشکی ارومیه', city: 'urmia' },
  { id: 'khoyums', name: 'دانشکده علوم پزشکی خوی', city: 'khoy' },
  // اردبیل
  { id: 'arums', name: 'دانشگاه علوم پزشکی اردبیل', city: 'ardabil' },
  { id: 'iau_ardabil', name: 'دانشگاه آزاد اسلامی واحد اردبیل', city: 'ardabil' },
  { id: 'khalums', name: 'دانشکده علوم پزشکی خلخال', city: 'khalkhal' },
  // خوزستان
  { id: 'ajums', name: 'دانشگاه علوم پزشکی جندی‌شاپور اهواز', city: 'ahvaz' },
  { id: 'abadanums', name: 'دانشگاه علوم پزشکی آبادان', city: 'abadan' },
  { id: 'dums', name: 'دانشگاه علوم پزشکی دزفول', city: 'dezful' },
  { id: 'behums', name: 'دانشکده علوم پزشکی بهبهان', city: 'behbahan' },
  { id: 'shoushtar', name: 'دانشکده علوم پزشکی شوشتر', city: 'shushtar' },
  // کرمان
  { id: 'kmu', name: 'دانشگاه علوم پزشکی کرمان', city: 'kerman' },
  { id: 'rums', name: 'دانشگاه علوم پزشکی رفسنجان', city: 'rafsanjan' },
  { id: 'jmu', name: 'دانشگاه علوم پزشکی جیرفت', city: 'jiroft' },
  { id: 'mubam', name: 'دانشگاه علوم پزشکی بم', city: 'bam' },
  { id: 'sirums', name: 'دانشکده علوم پزشکی سیرجان', city: 'sirjan' },
  // یزد
  { id: 'ssu', name: 'دانشگاه علوم پزشکی شهید صدوقی یزد', city: 'yazd' },
  { id: 'iau_yazd', name: 'دانشگاه آزاد اسلامی واحد یزد', city: 'yazd' },
  // گیلان
  { id: 'gums', name: 'دانشگاه علوم پزشکی گیلان', city: 'rasht' },
  { id: 'iau_rasht', name: 'دانشگاه آزاد اسلامی واحد رشت', city: 'rasht' },
  // مازندران
  { id: 'mazums', name: 'دانشگاه علوم پزشکی مازندران', city: 'sari' },
  { id: 'iau_sari', name: 'دانشگاه آزاد اسلامی واحد ساری', city: 'sari' },
  { id: 'mubabol', name: 'دانشگاه علوم پزشکی بابل', city: 'babol' },
  { id: 'iau_tonekabon', name: 'دانشگاه آزاد اسلامی واحد تنکابن', city: 'tonekabon' },
  // گلستان
  { id: 'goums', name: 'دانشگاه علوم پزشکی گلستان', city: 'gorgan' },
  // سمنان
  { id: 'semums', name: 'دانشگاه علوم پزشکی سمنان', city: 'semnan' },
  { id: 'shmu', name: 'دانشگاه علوم پزشکی شاهرود', city: 'shahroud' },
  { id: 'iau_shahroud', name: 'دانشگاه آزاد اسلامی واحد شاهرود', city: 'shahroud' },
  // زنجان، قزوین، همدان، مرکزی
  { id: 'zums', name: 'دانشگاه علوم پزشکی زنجان', city: 'zanjan' },
  { id: 'qums', name: 'دانشگاه علوم پزشکی قزوین', city: 'qazvin' },
  { id: 'umsha', name: 'دانشگاه علوم پزشکی همدان', city: 'hamadan' },
  { id: 'asaums', name: 'دانشکده علوم پزشکی اسدآباد', city: 'asadabad' },
  { id: 'arakmu', name: 'دانشگاه علوم پزشکی اراک', city: 'arak' },
  { id: 'savehums', name: 'دانشکده علوم پزشکی ساوه', city: 'saveh' },
  { id: 'khomeinums', name: 'دانشکده علوم پزشکی خمین', city: 'khomein' },
  // غرب کشور
  { id: 'kums', name: 'دانشگاه علوم پزشکی کرمانشاه', city: 'kermanshah' },
  { id: 'muk', name: 'دانشگاه علوم پزشکی کردستان', city: 'sanandaj' },
  { id: 'lums', name: 'دانشگاه علوم پزشکی لرستان', city: 'khorramabad' },
  { id: 'medilam', name: 'دانشگاه علوم پزشکی ایلام', city: 'ilam' },
  // جنوب و جنوب غرب
  { id: 'yums', name: 'دانشگاه علوم پزشکی یاسوج', city: 'yasuj' },
  { id: 'skums', name: 'دانشگاه علوم پزشکی شهرکرد', city: 'shahrekord' },
  { id: 'bpums', name: 'دانشگاه علوم پزشکی بوشهر', city: 'bushehr' },
  { id: 'hums', name: 'دانشگاه علوم پزشکی هرمزگان', city: 'bandar_abbas' },
  // سیستان و بلوچستان
  { id: 'zaums', name: 'دانشگاه علوم پزشکی زاهدان', city: 'zahedan' },
  { id: 'iau_zahedan', name: 'دانشگاه آزاد اسلامی واحد زاهدان', city: 'zahedan' },
  { id: 'zbmu', name: 'دانشگاه علوم پزشکی زابل', city: 'zabol' },
  { id: 'irshums', name: 'دانشگاه علوم پزشکی ایرانشهر', city: 'iranshahr' },
  // خراسان جنوبی و شمالی
  { id: 'bums', name: 'دانشگاه علوم پزشکی بیرجند', city: 'birjand' },
  { id: 'tabasms', name: 'دانشکده علوم پزشکی طبس', city: 'tabas' },
  { id: 'nkums', name: 'دانشگاه علوم پزشکی خراسان شمالی', city: 'bojnurd' },
  { id: 'esfums', name: 'دانشکده علوم پزشکی اسفراین', city: 'esfarayen' },
];

/* ------------------------------------------------------------------------ */
/* Persian text — app                                                        */
/* ------------------------------------------------------------------------ */

/**
 * The warning that only @PasKeshikBot is the real bot and that Pas-Keshik
 * never asks for money or a card number. Shown on the rules page and in the
 * bot's arrangement message (server-config.js uses text.common.officialBot).
 * The left-to-right marks (U+200E) keep the username in one piece inside the
 * right-to-left sentence.
 */
const OFFICIAL_BOT = 'تنها ربات رسمی پاس‌کشیک \u200e@PasKeshikBot\u200e است. پاس‌کشیک هرگز از شما پول یا شمارهٔ کارت نمی‌خواهد.';

/**
 * Every Persian string the app shows. Placeholders look like {name} and are
 * filled by text.js#fill (numbers are converted to Persian digits by the
 * caller). Grouped by screen so docs/REVIEW-fa.md can list them the same way.
 */
const TEXT = {
  appName: 'پاس‌کشیک',

  common: {
    step: 'مرحلهٔ {n} از {total}',
    next: 'بعدی',
    previous: 'قبلی',
    back: 'بازگشت',
    cancel: 'انصراف',
    confirm: 'تأیید',
    ok: 'باشه',
    close: 'بستن',
    retry: 'تلاش دوباره',
    refresh: 'به‌روزرسانی',
    loading: 'در حال بارگذاری…',
    sending: 'در حال ارسال…',
    menu: 'منو',
    dateTime: '{date}، ساعت {time}',
    and: ' و ',
    save: 'ذخیره',
    saved: 'ذخیره شد.',
    price: '{amount} تومان',
    officialBot: OFFICIAL_BOT,
  },

  screens: {
    intro: 'پاس‌کشیک',
    signup: 'ثبت‌نام',
    board: 'جستجو',
    myRequests: 'درخواست‌های من',
    myOffers: 'پیشنهادهای من',
    newRequest: 'درخواست جدید',
    reviewRequest: 'مرور درخواست',
    sendOffer: 'ارسال پیشنهاد',
    changeOffer: 'تغییر پیشنهاد',
    diag: 'عیب‌یابی پاس‌کشیک',
    invite: 'دعوت از دوستان',
    contact: 'تماس با ما',
    settings: 'تنظیمات',
    banned: 'حساب مسدود شده',
    request: 'درخواست',
  },

  drawer: {
    board: 'جستجو',
    myRequests: 'درخواست‌های من',
    myOffers: 'پیشنهادهای من',
    invite: 'دعوت از دوستان',
    contact: 'تماس با ما',
    settings: 'تنظیمات',
  },

  intro: {
    pages: [
      {
        icon: '🩺',
        title: 'به پاس‌کشیک خوش آمدید',
        body: 'کشیکی دارید که نمی‌توانید انجام دهید؟ از همکاران خود بخواهید به جای شما کشیک بدهند.\nمی‌توانید به جای همکاران خود کشیک بدهید؟ درخواست‌های همکاران خود را مشاهده کنید و بپذیرید.',
      },
      {
        icon: '🤝',
        title: 'درخواست بدهید، پیشنهاد بگیرید',
        body: 'برای کشیک خود درخواست بگذارید و اگر خواستید قیمتی پیشنهاد کنید. همکاران می‌توانند همان قیمت را بپذیرند یا قیمت دیگری پیشنهاد دهند.',
      },
      {
        icon: '🔒',
        title: 'بی‌نام تا لحظهٔ تأیید',
        body: 'کسی نمی‌بیند درخواست یا پیشنهاد از طرف کیست. وقتی دو نفر به هم می‌رسند، اول درخواست‌دهنده نام همکار را می‌بیند و تأیید می‌کند، بعد همکار نام درخواست‌دهنده را می‌بیند و تأیید می‌کند. بعد از تأیید هر دو، در تلگرام مستقیم گفتگو می‌کنید.',
      },
    ],
    start: 'شروع ثبت‌نام',
  },

  signup: {
    nameTitle: 'نام شما',
    nameHint: 'نام و نام خانوادگی خود را با حروف فارسی بنویسید.',
    nameNote: 'نام شما فقط پس از توافق برای جابه‌جایی کشیک به طرف مقابل نمایش داده می‌شود تا پیش از نهایی شدن جابه‌جایی، همدیگر را بشناسید.',
    firstName: 'نام',
    lastName: 'نام خانوادگی',
    firstNamePlaceholder: 'مثلاً مریم',
    lastNamePlaceholder: 'مثلاً احمدی',
    majorTitle: 'رشتهٔ شما',
    majorHint: 'با زدن روی کارت‌های کناری، رشته خود را پیدا کنید و «انتخاب» را بزنید',
    majorChoose: 'انتخاب',
    universityTitle: 'دانشگاه شما',
    universityHint: 'دانشگاه محل تحصیل خود را انتخاب کنید.',
    universitySearch: 'جستجوی نام دانشگاه یا شهر',
    universityFrequent: 'پرتکرارها',
    universityNoResults: 'دانشگاهی با این نام پیدا نشد.',
    universityMissing: 'دانشگاه شما در فهرست نیست؟',
    universityMissingSubject: 'افزودن دانشگاه به پاس‌کشیک',
    universityMissingBody: 'سلام، دانشگاه من در فهرست پاس‌کشیک نیست.\nنام دانشگاه:\nشهر:\nرشته:',
    universityCity: 'شهر: {city}',
    rulesTitle: 'قوانین پاس‌کشیک',
    rules: [
      'پاس‌کشیک فقط برای این طراحی شده است که پیدا کردن همکار برای جابه‌جایی کشیک را آسان کند؛ با پول سروکار ندارد و حضور در کشیک یا پرداخت را تضمین نمی‌کند.',
      'قیمت و نحوهٔ پرداخت را مستقیم با طرف مقابل و به‌صورت نوشتاری در گفتگوی تلگرام توافق کنید.',
      'قوانین بیمارستان و دانشگاه خود را دربارهٔ جابه‌جایی کشیک رعایت کنید.',
      'رفتار نادرست، مثل حاضر نشدن در کشیکی که پذیرفته‌اید یا پرداخت نکردن مبلغ توافق‌شده، می‌تواند به مسدود شدن حساب شما منجر شود.',
      OFFICIAL_BOT,
    ],
    rulesAccept: 'قبول دارم',
    botTitle: 'اجازهٔ پیام ربات',
    botWhy: 'پاس‌کشیک خبر پیشنهادهای تازه، هماهنگی‌ها و لغوها را با ربات تلگرام به شما می‌دهد و دکمهٔ گفتگو با همکارتان را هم ربات می‌فرستد. بدون اجازهٔ پیام، این خبرها به شما نمی‌رسد؛ برای همین ثبت‌نام بدون آن کامل نمی‌شود.',
    botAllow: 'اجازه دادن به ربات',
    botDeclined: 'اجازه داده نشد. برای تکمیل ثبت‌نام، دوباره دکمهٔ «اجازه دادن به ربات» را بزنید و در پنجرهٔ تلگرام اجازه بدهید.',
    botUnsupported: 'نسخهٔ تلگرام شما این پنجره را پشتیبانی نمی‌کند. ربات را باز کنید، دکمهٔ «شروع» (Start) را بزنید و بعد به برنامه برگردید و «بررسی دوباره» را بزنید.',
    botOpen: 'باز کردن ربات',
    botCheckAgain: 'بررسی دوباره',
    finishing: 'در حال تکمیل ثبت‌نام…',
    done: 'ثبت‌نام شما کامل شد. خوش آمدید!',
  },

  card: {
    ward: 'بخش',
    place: 'مکان',
    start: 'شروع',
    end: 'پایان',
    price: 'پیشنهاد درخواست‌دهنده',
    noPrice: 'قیمتی تعیین نشده است',
    // Shown for an old مکان that had nothing allowed left once links,
    // usernames and phone numbers were removed from it.
    placeUnknown: '—',
  },

  board: {
    filterUniversity: 'دانشگاه',
    filterWard: 'بخش',
    allUniversities: 'همه دانشگاه‌های {city}',
    allWards: 'همه بخش‌ها',
    empty: 'فعلاً درخواست فعالی با این فیلترها وجود ندارد.',
    newRequest: '+ درخواست جدید',
    take: 'قبول با این قیمت',
    offer: 'ارسال پیشنهاد',
    changeOffer: 'تغییر پیشنهاد',
    yourRequest: 'درخواست شما',
    youOffered: 'شما روی این درخواست پیشنهاد {price} داده‌اید.',
    blocked: 'شما پیش‌تر روی این درخواست با درخواست‌دهنده هماهنگ شده بودید و انجام نشد؛ دوباره نمی‌توانید برای آن اقدام کنید.',
    taken: 'برای درخواست‌دهنده فرستاده شد. اگر ادامه دهد، از شما خواسته می‌شود تأیید کنید (در «پیشنهادهای من» و با پیام ربات).',
  },

  newRequest: {
    step1Title: 'کشیک کجا و کی شروع می‌شود؟',
    step2Title: 'کشیک کی تمام می‌شود؟',
    step3Title: 'پیشنهاد قیمت',
    ward: 'بخش',
    wardChoose: 'بخش را انتخاب کنید',
    place: 'مکان',
    placePlaceholder: 'مثلاً بیمارستان امام خمینی',
    placeCounter: '{n} از {max} حرف',
    start: 'شروع کشیک',
    end: 'پایان کشیک',
    date: 'تاریخ',
    chooseDate: 'روز را از تقویم انتخاب کنید.',
    time: 'ساعت',
    hour: 'ساعت',
    minute: 'دقیقه',
    prevMonth: 'ماه قبل',
    nextMonth: 'ماه بعد',
    price: 'مبلغی که ترجیح می‌دهید برای واگذاری این کشیک پرداخت کنید (اختیاری)',
    pricePlaceholder: 'مثلاً ۱٬۵۰۰٬۰۰۰',
    priceUnit: 'تومان',
    priceSkip: 'بدون تعیین قیمت ترجیحی ادامه دهید',
  },

  review: {
    hint: 'همکاران درخواست شما را دقیقاً همین‌طور می‌بینند. پس از ثبت، درخواست قابل ویرایش نیست؛ فقط می‌توانید آن را لغو کنید.',
    post: 'ثبت درخواست',
    edit: 'ویرایش',
    posted: 'درخواست شما ثبت شد.',
  },

  offerForm: {
    priceLabel: 'قیمت پیشنهادی شما (تومان)',
    pricePlaceholder: 'مثلاً ۱٬۵۰۰٬۰۰۰',
    range: 'از {min} تا {max} تومان',
    note: 'پیشنهاد شما بدون نام و فقط برای درخواست‌دهنده نمایش داده می‌شود.',
    submit: 'ارسال پیشنهاد',
    submitChange: 'ثبت قیمت جدید',
    sent: 'پیشنهاد شما ارسال شد.',
    changed: 'پیشنهاد شما تغییر کرد.',
  },

  myRequests: {
    empty: 'نمی‌توانید در کشیک خود حاضر شوید؟',
    emptyHint: 'با ایجاد درخواست جدید، از همکاران خود بخواهید که به جای شما کشیک بدهند',
    newRequest: '+ درخواست جدید',
    statusOpen: 'فعال',
    statusArranged: 'هماهنگ‌شده',
    statusInProgress: 'در حال انجام',
    offersTitle: 'پیشنهادهای رسیده (ارزان‌ترین اول)',
    noOffers: 'هنوز هیچ همکاری پیشنهادی ثبت نکرده است.',
    accept: 'پذیرفتن',
    reject: 'رد کردن',
    cancelRequest: 'لغو درخواست',
    accepted: 'پیشنهاد پذیرفته شد و هماهنگی انجام شد.',
    rejected: 'پیشنهاد رد شد.',
    cancelled: 'درخواست لغو شد.',
    // A confirmation under way on one of my requests.
    match: {
      step1Title: 'در انتظار تصمیم شما',
      takeLine: '{name} می‌خواهد این کشیک را با قیمت شما ({price}) بپذیرد.',
      offerLine: 'پیشنهاد {price} از {name}',
      step1Hint: 'با «ادامه»، از {name} خواسته می‌شود تأیید کند و او نام شما را می‌بیند. اگر تا پایان مهلت تصمیم نگیرید، رد حساب می‌شود.',
      step2Title: 'در انتظار تأیید {name}',
      step2Hint: 'تا تأیید او، این درخواست در جستجو نیست و پیشنهاد دیگری را نمی‌توانید بپذیرید. اگر وقت کم است، می‌توانید هماهنگی را لغو کنید.',
      deadline: 'مهلت: {time}',
      proceed: 'ادامه',
      decline: 'رد',
      cancel: 'لغو این هماهنگی',
      offersLocked: 'تا روشن شدن این هماهنگی، پذیرفتن پیشنهاد دیگر ممکن نیست.',
      proceeded: 'از {name} خواسته شد تأیید کند.',
      declined: 'رد شد؛ درخواست دوباره در جستجو قرار گرفت.',
      cancelled: 'هماهنگی لغو شد؛ درخواست دوباره در جستجو قرار گرفت.',
    },
  },

  myOffers: {
    empty: 'می‌خواهید در ازای دریافت هزینه به جای همکارتان کشیک بدهید؟',
    emptyHint: 'در صفحه «جستجو»، بعد از قبول قیمت پیشنهادشده یا پیشنهاد قیمتی متفاوت برای یک کشیک، وضعیت پیشنهاد خود را در این قسمت مشاهده کنید',
    pendingTitle: 'در انتظار پاسخ',
    settledTitle: 'نتیجه‌ها',
    yourPrice: 'پیشنهاد شما: {price}',
    change: 'تغییر قیمت',
    withdraw: 'پس گرفتن',
    withdrawn: 'پیشنهاد پس گرفته شد.',
    status: {
      accepted: 'پذیرفته شد',
      rejected: 'رد شد',
      expired: 'منقضی شد؛ کشیک شروع شد',
      cancelled: 'هماهنگی لغو شد',
      void_request_cancelled: 'درخواست لغو شد',
      void_arranged_other: 'با همکار دیگری هماهنگ شد',
      withdrawn_overlap: 'به‌خاطر هم‌زمانی با کشیکی که پذیرفتید، خودکار پس گرفته شد',
      void_profile_changed: 'به‌خاطر تغییر رشته یا دانشگاه شما باطل شد',
      void_banned: 'به‌خاطر مسدود شدن حساب شما باطل شد',
      match_declined_1: 'درخواست‌دهنده ادامه نداد',
      match_expired_1: 'درخواست‌دهنده در مهلت پاسخ نداد',
      match_declined_2: 'شما نپذیرفتید',
      match_expired_2: 'در مهلت تأیید نکردید',
      match_cancelled_2: 'درخواست‌دهنده پیش از تأیید شما لغو کرد',
      match_withdrawn: 'به‌خاطر پذیرفتن کشیک هم‌زمان دیگر کنار گذاشته شد',
      match_removed: 'درخواست را مدیر حذف کرد',
      match_banned: 'این هماهنگی متوقف شد',
    },
    // A confirmation under way on one of my offers (or takes).
    match: {
      waiting: 'در انتظار تأیید درخواست‌دهنده (مهلت: {time})',
      yourTurn: 'درخواست‌دهنده ({name}) ادامه داد؛ نوبت تأیید شماست.',
      deadline: 'مهلت: {time}',
      proceed: 'ادامه',
      decline: 'رد',
      arranged: 'هماهنگی انجام شد. جزئیات را پایین همین صفحه ببینید.',
      declined: 'رد شد.',
    },
  },

  arrangement: {
    title: 'هماهنگی',
    coverer: 'پوشش‌دهنده: {name}',
    requester: 'درخواست‌دهنده: {name}',
    price: 'مبلغ توافق‌شده: {price}',
    chat: 'چت',
    cancel: 'لغو هماهنگی',
    started: 'کشیک شروع شده است و دیگر نمی‌توان هماهنگی را لغو کرد.',
    chatSent: 'ربات دکمهٔ گفتگو را برایتان فرستاد.',
    cancelled: 'هماهنگی لغو شد و درخواست دوباره باز شد.',
  },

  invite: {
    linkLabel: 'لینک دعوت شما',
    messageLabel: 'متن آمادهٔ دعوت',
    message: 'سلام! من از پاس‌کشیک استفاده می‌کنم؛ برنامه‌ای در تلگرام که دانشجویان و کارورزان رشته‌های علوم پزشکی (پزشکی، پرستاری، مامایی، داروسازی، اتاق عمل، فوریت‌های پزشکی، هوشبری، علوم آزمایشگاهی و پرتوشناسی) با آن، کشیک‌هایشان را با دانشجویان هم‌شهر و هم‌رشته خود خرید و فروش می‌کنند.\nاز این لینک وارد شو:\n{link}',
    copy: 'کپی متن دعوت',
    copied: 'متن دعوت کپی شد.',
    copyFailed: 'کپی نشد. متن بالا را نگه دارید و خودتان کپی کنید.',
    share: 'فرستادن برای دوستان در تلگرام',
    rewardTitle: 'اولین نفری باشید که از درخواست‌های جدید آگاه می‌شود!',
    // {scope} is filled with either "دانشگاه و بخشی" (majors with wards) or
    // "دانشگاهی" (majors without), so the sentence still reads correctly.
    rewardBody: 'با دعوت از دوستان خود، این قابلیت برای شما فعال می‌شود که به محض ایجاد درخواست جدید (در {scope} که در تنظیمات انتخاب می‌کنید)، قبل از بقیهٔ اعضا به شما اطلاع داده شود تا هیچ درخواستی را از دست ندهید.',
    rewardScopeWithWards: 'دانشگاه و بخشی',
    rewardScopeNoWards: 'دانشگاهی',
    unlocked: '✅ پاداش شما فعال است: درخواست‌های تازه را همان لحظه خبر می‌دهیم. آن را در «تنظیمات» تنظیم یا خاموش کنید.',
    locked: 'هنوز فعال نشده است.',
  },

  contact: {
    body: 'پرسش، پیشنهاد یا مشکلی دارید؟ برای ما ایمیل بفرستید. با زدن دکمهٔ زیر، برنامهٔ ایمیل گوشی شما باز می‌شود.',
    button: 'نوشتن ایمیل',
    address: 'نشانی ایمیل: {email}',
    subject: 'پاس‌کشیک',
  },

  settings: {
    notificationsTitle: 'اعلان‌های ربات',
    offers: 'پیشنهاد تازه یا تغییر پیشنهاد روی درخواست‌های من',
    arranged: 'انجام شدن هماهنگی',
    reminders: 'یادآوری کشیک‌هایی که پوشش می‌دهم ({hours} ساعت قبل)',
    cancellationsNote: 'پیام‌های تأیید هماهنگی و لغو هماهنگی همیشه فرستاده می‌شوند و خاموش نمی‌شوند.',
    summary: 'خلاصهٔ روزانهٔ درخواست‌های تازه (ساعت {hour} صبح)',
    alerts: 'هشدار فوری درخواست‌های تازه در شهر و رشتهٔ من',
    alertsTitle: 'خبر درخواست‌های تازه',
    alertsHint: 'این انتخاب‌ها هم برای خلاصهٔ روزانه است و هم برای هشدار فوری.',
    alertsLocked: 'با دعوت از دوستان، از درخواست‌های جدید همان لحظه به شما خبر می‌دهیم تا قبل از بقیه از آن‌ها مطلع شوید و هیچ‌کدام را از دست ندهید. این قابلیت با ثبت‌نام اولین دوستی که دعوت کرده‌اید، برای شما فعال می‌شود.',
    alertsInvite: 'دعوت از دوستان',
    alertsUniversity: 'برای کدام دانشگاه؟',
    alertsWards: 'برای کدام بخش‌ها؟',
    alertsAllWards: 'همهٔ بخش‌ها',
    alertsSomeWards: 'فقط بخش‌هایی که انتخاب می‌کنم',
    alertsChooseWard: 'دست‌کم یک بخش را انتخاب کنید.',
    alertsSave: 'ذخیرهٔ این انتخاب‌ها',
    alertsSaved: 'انتخاب‌های شما ذخیره شد.',
    profileTitle: 'مشخصات',
    major: 'رشته',
    university: 'دانشگاه',
    universityChange: 'تغییر دانشگاه',
    majorUniversityHint: 'با تغییر رشته یا دانشگاه، درخواست‌هایی که در جستجو می‌بینید عوض می‌شود. تا وقتی درخواست فعالی دارید این تغییر ممکن نیست.',
    saveProfile: 'ذخیرهٔ مشخصات',
    profileSaved: 'مشخصات شما ذخیره شد.',
    confirmChange: {
      title: 'رشته یا دانشگاه را تغییر می‌دهید؟',
      body: 'همهٔ پیشنهادهای در انتظار پاسخ شما باطل می‌شوند و از این پس درخواست‌های رشته و شهر تازه را می‌بینید.',
      ok: 'بله، تغییر بده',
    },
  },

  // Shown instead of the app to someone an admin has banned.
  banned: {
    body: 'حساب شما در پاس‌کشیک مسدود شده است و نمی‌توانید از برنامه استفاده کنید. هماهنگی‌هایی که پیش از این انجام داده‌اید سر جای خود هستند.',
    contact: 'اگر فکر می‌کنید اشتباهی رخ داده است، برای ما ایمیل بفرستید.',
  },

  confirm: {
    take: {
      title: 'این کشیک را با همین قیمت می‌پذیرید؟',
      body: 'درخواست‌دهنده نام شما را می‌بیند و باید تأیید کند؛ بعد از او، شما هم نام او را می‌بینید و تأیید می‌کنید. تا آن وقت درخواست برای دیگران بسته است.',
      price: 'قیمت: {price}',
      ok: 'بله، می‌پذیرم',
    },
    acceptOffer: {
      title: 'این پیشنهاد را می‌پذیرید؟',
      body: 'بعد از پذیرفتن، نام پیشنهاددهنده را می‌بینید و تصمیم می‌گیرید ادامه دهید یا نه. بقیهٔ پیشنهادها سر جای خود می‌مانند تا هماهنگی انجام شود.',
      price: 'قیمت: {price}',
      ok: 'بله، می‌پذیرم',
    },
    rejectOffer: {
      title: 'این پیشنهاد را رد می‌کنید؟',
      body: 'پیشنهاددهنده می‌تواند بعداً دوباره پیشنهاد بدهد.',
      price: 'قیمت: {price}',
      ok: 'بله، رد کن',
    },
    cancelRequest: {
      title: 'این درخواست را لغو می‌کنید؟',
      body: 'درخواست از جستجو برداشته می‌شود و همهٔ پیشنهادهای آن باطل می‌شوند. این کار برگشت‌پذیر نیست.',
      ok: 'بله، لغو کن',
    },
    cancelArrangement: {
      title: 'هماهنگی را لغو می‌کنید؟',
      body: 'طرف مقابل با پیام ربات باخبر می‌شود و درخواست با همان جزئیات و قیمت دوباره باز می‌شود. شما دو نفر دیگر نمی‌توانید روی این درخواست با هم هماهنگ شوید.',
      ok: 'بله، لغو کن',
    },
    withdrawOffer: {
      title: 'پیشنهاد خود را پس می‌گیرید؟',
      body: 'بعداً می‌توانید دوباره پیشنهاد بدهید.',
      ok: 'بله، پس بگیر',
    },
    // Shown right after accepting an offer: the offerer's name (step 1).
    acceptedName: {
      title: 'پیشنهاددهنده: {name}',
      body: 'اگر می‌خواهید با {name} ادامه دهید، «ادامه» را بزنید؛ سپس از او خواسته می‌شود تأیید کند و او نام شما را می‌بیند. تا {time} فرصت دارید؛ بعد از آن رد حساب می‌شود.',
      ok: 'ادامه',
      later: 'بعداً تصمیم می‌گیرم',
    },
    declineMatch: {
      title: 'این هماهنگی را رد می‌کنید؟',
      body: 'درخواست دوباره در جستجو قرار می‌گیرد و شما دو نفر دیگر نمی‌توانید روی این درخواست هماهنگ شوید. طرف مقابل باخبر می‌شود.',
      ok: 'بله، رد کن',
    },
    cancelMatch: {
      title: 'این هماهنگی را لغو می‌کنید؟',
      body: '{name} هنوز تأیید نکرده است. با لغو، درخواست دوباره در جستجو قرار می‌گیرد، او باخبر می‌شود و شما دو نفر دیگر نمی‌توانید روی این درخواست هماهنگ شوید.',
      ok: 'بله، لغو کن',
    },
    proceedMatch: {
      title: 'این کشیک را می‌پذیرید؟',
      body: 'با «ادامه»، هماهنگی با {name} انجام می‌شود و ربات دکمهٔ گفتگو را برای هر دو نفر می‌فرستد.',
      ok: 'ادامه',
    },
  },

  // The request screen opened from an alert's button.
  requestScreen: {
    gone: 'این درخواست دیگر در جستجو نیست؛ ممکن است همکار دیگری آن را پذیرفته باشد، لغو شده باشد یا شروع شده باشد.',
    toBoard: 'رفتن به جستجو',
  },

  errors: {
    unknown: 'مشکلی پیش آمد. لطفاً دوباره تلاش کنید.',
    network: 'اتصال به سرور برقرار نشد. اینترنت خود را بررسی کنید و دوباره تلاش کنید.',
    gateway_not_configured: 'نشانی سرور هنوز تنظیم نشده است.',
    auth_missing: 'اطلاعات ورود تلگرام پیدا نشد. برنامه را از داخل ربات باز کنید.',
    auth_invalid: 'اطلاعات ورود تلگرام معتبر نیست. برنامه را ببندید و دوباره باز کنید.',
    auth_expired: 'اطلاعات ورود منقضی شده است. برنامه را ببندید و دوباره باز کنید.',
    origin_forbidden: 'دسترسی از این نشانی مجاز نیست.',
    rate_limited: 'تعداد درخواست‌های شما در یک دقیقه زیاد شد. کمی صبر کنید و دوباره تلاش کنید.',
    bad_request: 'درخواست نامعتبر است.',
    server_error: 'خطای سرور. لطفاً کمی بعد دوباره تلاش کنید.',
    not_registered: 'ابتدا ثبت‌نام کنید.',
    first_name_required: 'نام را بنویسید.',
    first_name_short: 'نام باید دست‌کم {min} حرف باشد.',
    first_name_long: 'نام حداکثر {max} حرف است.',
    first_name_letters: 'نام را فقط با حروف فارسی بنویسید.',
    last_name_required: 'نام خانوادگی را بنویسید.',
    last_name_short: 'نام خانوادگی باید دست‌کم {min} حرف باشد.',
    last_name_long: 'نام خانوادگی حداکثر {max} حرف است.',
    last_name_letters: 'نام خانوادگی را فقط با حروف فارسی بنویسید.',
    major_invalid: 'رشته را انتخاب کنید.',
    university_invalid: 'دانشگاه را از فهرست انتخاب کنید.',
    rules_not_accepted: 'برای ادامه باید قوانین را بپذیرید.',
    bot_cannot_message: 'ربات هنوز اجازهٔ پیام دادن به شما را ندارد.',
    ward_required: 'بخش را انتخاب کنید.',
    ward_invalid: 'بخش انتخاب‌شده معتبر نیست.',
    place_required: 'مکان را بنویسید.',
    place_too_long: 'مکان حداکثر {max} حرف است.',
    place_chars: 'مکان را فقط با حروف فارسی، عدد، فاصله و این نشانه‌ها بنویسید: ، ـ ( ) - /',
    place_digits: 'در مکان بیشتر از {max} رقم پشت سر هم ننویسید (شمارهٔ تلفن مجاز نیست).',
    start_required: 'روز و ساعت شروع را کامل کنید.',
    end_required: 'روز و ساعت پایان را کامل کنید.',
    time_invalid: 'ساعت باید از ۰ تا ۲۳ و دقیقه از ۰ تا ۵۹ باشد.',
    start_in_past: 'شروع کشیک باید در آینده باشد.',
    start_too_far: 'شروع کشیک حداکثر {months} ماه بعد می‌تواند باشد.',
    end_before_start: 'پایان کشیک باید بعد از شروع آن باشد.',
    shift_too_long: 'طول کشیک حداکثر {hours} ساعت است.',
    price_required: 'قیمت را بنویسید.',
    price_invalid: 'قیمت را فقط با عدد و به تومان بنویسید.',
    price_out_of_range: 'قیمت باید بین {min} و {max} تومان باشد.',
    too_many_active: 'حداکثر {max} درخواست فعال می‌توانید داشته باشید.',
    same_day_active: 'برای این روز یک درخواست فعال دیگر دارید. هر روز فقط یک درخواست فعال مجاز است.',
    request_not_found: 'این درخواست پیدا نشد.',
    request_taken: 'این کشیک را همکار دیگری زودتر گرفت.',
    request_closed: 'این درخواست دیگر باز نیست.',
    request_arranged: 'این درخواست هماهنگ شده است. اگر لازم است، اول هماهنگی را لغو کنید.',
    own_request: 'این درخواست خودتان است.',
    no_price: 'برای این درخواست قیمتی تعیین نشده است؛ قیمت پیشنهاد بدهید.',
    price_changed: 'قیمت این درخواست تغییر کرده است. دوباره بررسی کنید.',
    offer_exists: 'روی این درخواست یک پیشنهاد فعال دارید؛ می‌توانید آن را تغییر دهید یا پس بگیرید.',
    offer_not_found: 'این پیشنهاد پیدا نشد.',
    offer_not_pending: 'این پیشنهاد دیگر در انتظار پاسخ نیست.',
    offer_changed: 'قیمت این پیشنهاد همین حالا تغییر کرد. قیمت تازه را ببینید و دوباره تصمیم بگیرید.',
    overlap: 'این کشیک با کشیکی که پوشش آن را پذیرفته‌اید هم‌زمان است.',
    offerer_busy: 'این همکار در این زمان کشیک دیگری را پذیرفته است.',
    rematch_blocked: 'شما پیش‌تر روی این درخواست با درخواست‌دهنده هماهنگ شده بودید و انجام نشد؛ دوباره ممکن نیست.',
    profile_change_blocked: 'تا وقتی درخواست فعال یا هماهنگی در انتظار تأیید دارید، نمی‌توانید رشته یا دانشگاه را تغییر دهید.',
    request_pending: 'این درخواست در حال تأیید با همکار دیگری است.',
    match_pending: 'این درخواست یک هماهنگی در انتظار تأیید دارد؛ اول آن را رد یا لغو کنید.',
    match_not_found: 'این هماهنگی پیدا نشد.',
    match_closed: 'این هماهنگی دیگر در انتظار تأیید نیست (رد، لغو یا منقضی شده است).',
    match_done: 'این هماهنگی قبلاً تأیید و انجام شده است.',
    match_not_your_turn: 'اکنون نوبت تأیید طرف مقابل است.',
    arrangement_not_found: 'این هماهنگی پیدا نشد.',
    arrangement_started: 'کشیک شروع شده است و دیگر نمی‌توان هماهنگی را لغو کرد.',
    arrangement_finished: 'این کشیک تمام شده است.',
    chat_failed: 'ربات نتوانست پیام بفرستد. کمی بعد دوباره تلاش کنید.',
    banned: 'حساب شما در پاس‌کشیک مسدود شده است.',
  },

  fatal: {
    title: 'خطا',
    unexpected: 'خطای غیرمنتظره‌ای رخ داد. اگر تکرار شد، متن زیر را برای پشتیبانی بفرستید:',
    reload: 'بارگذاری دوباره',
    telegramScriptMissing: 'فایل telegram-web-app.js هنوز در مخزن قرار نگرفته است، پس برنامه داخل تلگرام کار نمی‌کند. (جزئیات در docs/SETUP.md)',
    gatewayMissing: 'نشانی سرور (gateway) هنوز در تنظیمات برنامه وارد نشده است. تا آن زمان برنامه را در مرورگر معمولی و در حالت آزمایشی امتحان کنید.',
  },

  testPanel: {
    toggle: '🧪 آزمایش',
    title: 'پنل آزمایشی (حالت محلی)',
    note: 'این داده‌ها ساختگی‌اند و فقط در همین مرورگر ذخیره می‌شوند.',
    user: 'کاربر فعلی',
    userHint: 'برای دیدن برنامه از چشم یک همکار، کاربر دیگری را انتخاب کنید.',
    you: 'شما',
    notRegistered: 'ثبت‌نام‌نشده',
    clock: 'ساعت برنامه: {time}',
    advance: {
      hour: '+۱ ساعت',
      sixHours: '+۶ ساعت',
      day: '+۱ روز',
      week: '+۷ روز',
    },
    realClock: 'ساعت واقعی',
    privacy: 'تنظیمات حریم خصوصی این کاربر اجازهٔ دکمهٔ گفتگو را نمی‌دهد',
    banned: 'این کاربر مسدود شده است (مثل مسدود کردن به دست مدیر در ربات)',
    inbox: 'پیام‌های ربات به این کاربر',
    inboxEmpty: 'پیامی نیست.',
    inboxTap: 'دکمه‌های پیام را بزنید تا همان کاری را بکنند که در تلگرام می‌کنند.',
    inboxNote: 'متن کامل پیام‌های ربات فقط در خود تلگرام دیده می‌شود؛ اینجا خلاصهٔ هر پیام و دکمه‌هایش آمده است.',
    // The test mode's short stand-ins for the bot's messages (the real
    // wording is server-only): what kind of message it is, then its details.
    inboxKinds: {
      welcome: 'خوشامد پس از «شروع»',
      signupDone: 'ثبت‌نام کامل شد',
      newOffer: 'پیشنهاد تازه برای درخواست شما',
      changedOffer: 'یک پیشنهاد روی درخواست شما تغییر کرد',
      arranged: 'هماهنگی انجام شد',
      pleaseStart: 'لطفاً خودتان گفتگو را شروع کنید',
      cancelled: 'هماهنگی لغو شد',
      chat: 'دکمهٔ گفتگو',
      chatBlocked: 'دکمهٔ گفتگو ساخته نشد (حریم خصوصی طرف مقابل)',
      reminder: 'یادآوری کشیک: {hours} ساعت دیگر شروع می‌شود',
      matchStep1: 'یک همکار می‌خواهد کشیک شما را بپذیرد',
      matchStep2: 'درخواست‌دهنده ادامه داد؛ نوبت تأیید شماست',
      matchEnded: 'این هماهنگی انجام نشد',
      alertsUnlocked: 'هشدار فوری درخواست‌های تازه فعال شد',
      alertNew: 'درخواست تازه در جستجو',
      alertBack: 'درخواستی دوباره در جستجو قرار گرفت',
      summary: 'خلاصهٔ روزانهٔ درخواست‌های تازه',
      banned: 'حساب شما مسدود است',
      removed: 'مدیر این درخواست را حذف کرد',
    },
    inboxTitle: '🤖 {kind}',
    inboxShift: '{place} — {start}',
    inboxName: 'نام: {name}',
    inboxPrice: 'مبلغ: {price}',
    inboxNotes: {
      willBeContacted: 'دکمهٔ گفتگو ساخته نشد؛ طرف مقابل به شما پیام می‌دهد.',
      pleaseStart: 'طرف مقابل نمی‌تواند گفتگو با شما را شروع کند؛ خودتان شروع کنید.',
      bothBlocked: 'دکمهٔ گفتگو برای هیچ‌کدام ساخته نشد.',
      noLink: 'دکمهٔ گفتگو ساخته نشد.',
    },
    inboxButtons: {
      app: 'باز کردن برنامه',
      open: 'دیدن این درخواست',
      chat: 'گفتگو با {name}',
      proceed: 'ادامه',
      decline: 'رد',
      summaryOff: 'خاموش کن',
    },
    inboxDone: {
      proceeded: 'ادامه دادید.',
      declined: 'رد کردید.',
      summaryOff: 'خلاصهٔ روزانه خاموش شد.',
    },
    buttonDone: 'انجام شد: {result}',
    reset: 'بازنشانی همهٔ داده‌ها',
    resetTitle: 'همهٔ داده‌های آزمایشی پاک شود؟',
    resetBody: 'ثبت‌نام شما، درخواست‌ها و پیشنهادها پاک می‌شوند و داده‌های نمونه از نو ساخته می‌شوند.',
    resetOk: 'بله، بازنشانی کن',
    promptTitle: 'تلگرام (شبیه‌سازی)',
    promptBody: 'به ربات پاس‌کشیک اجازه می‌دهید به شما پیام بدهد؟',
    promptAllow: 'اجازه',
    promptDecline: 'رد',
    botChatOpened: 'در حالت آزمایشی گفتگوی ربات باز نمی‌شود؛ پیام ربات را در پنل آزمایشی ببینید.',
    colleague: 'همکار آزمایشی {n}',
    simulateInvite: 'ورود و ثبت‌نام یک نفر تازه با لینک دعوت این کاربر',
    simulatedInvite: 'یک نفر تازه با لینک دعوت وارد ربات شد و ثبت‌نام کرد.',
    summaryNow: 'فرستادن خلاصهٔ ساعت {hour} همین حالا',
    summarySent: 'خلاصه برای {n} نفر فرستاده شد؛ پیام‌ها را در صندوق هر کاربر ببینید.',
    summaryNone: 'خلاصه‌ای فرستاده نشد: برای هیچ‌کس درخواست تازه‌ای نبود (یا خلاصه خاموش است، یا هشدار فوری فعال است).',
    shareOpened: 'در حالت آزمایشی پنجرهٔ اشتراک تلگرام باز نمی‌شود.',
  },

  diag: {
    intro: 'این صفحه وضعیت فنی برنامه را نشان می‌دهد. اگر چیزی قرمز بود، از این صفحه عکس بگیرید.',
    version: 'نسخهٔ برنامه',
    telegramScript: 'فایل telegram-web-app.js',
    scriptReal: 'نسخهٔ واقعی تلگرام',
    scriptPlaceholder: 'جایگزین نشده (فایل موقت)',
    scriptMissing: 'بارگذاری نشد',
    platform: 'پلتفرم',
    telegramVersion: 'نسخهٔ Mini App تلگرام',
    initData: 'initData',
    initDataPresent: 'موجود است؛ طول {n}',
    initDataAbsent: 'موجود نیست (خارج از تلگرام)',
    gateway: 'نشانی سرور (gateway)',
    notSet: 'تنظیم نشده',
    health: 'بررسی سلامت سرور (health)',
    database: 'پایگاه داده',
    me: 'فراخوانی me',
    meRegistered: 'ثبت‌نام‌شده',
    meNotRegistered: 'ثبت‌نام‌نشده',
    webhook: 'وضعیت وب‌هوک ربات',
    webhookOk: 'تنظیم شده',
    webhookWrong: 'تنظیم نشده یا نشانی آن نادرست است',
    pendingUpdates: 'پیام‌های در صف: {n}',
    lastError: 'آخرین خطا: {error}',
    botToken: 'توکن ربات روی سرور',
    reminders: 'زمان‌بندی یادآوری‌ها',
    remindersOn: 'فعال (هر ۵ دقیقه)',
    remindersOff: 'هنوز فعال نشده',
    running: 'در حال بررسی…',
    ok: 'درست',
    fail: 'خطا',
    skipped: 'انجام نشد',
    onlyInTelegram: 'فقط داخل تلگرام انجام می‌شود',
    needsGateway: 'اول باید نشانی سرور تنظیم شود',
    rerun: 'بررسی دوباره',
    openApp: 'بازگشت به برنامه',
  },
};

/* ------------------------------------------------------------------------ */
/* The exported configuration                                               */
/* ------------------------------------------------------------------------ */

export const CONFIG = deepFreeze({
  version: VERSION,

  /** Addresses (none of them secret). */
  app: {
    botUsername: 'PasKeshikBot',
    botLink: 'https://t.me/PasKeshikBot',
    directLink: 'https://t.me/PasKeshikBot/app',
    miniAppUrl: 'https://paskeshik-coder.github.io/pas-keshik/',
    // The "api" Edge Function of the Supabase project (project ID wrigwviqblqqdngyvsci; not a secret).
    gatewayUrl: 'https://wrigwviqblqqdngyvsci.supabase.co/functions/v1/api',
    contactEmail: 'PasKeshik@gmail.com',
  },

  /** On/off switches. */
  switches: {
    // Drawer items that belong to later slices stay hidden while false.
    drawer: { invite: true, contact: true, settings: true },
    // Allow ?mode=local to force the LocalBackend (handy inside Telegram before Supabase exists).
    allowForcedLocalMode: true,
    // Show the test panel in Local mode.
    testPanel: true,
  },

  /**
   * Limits enforced on the client (for friendly messages) and again on the
   * server, plus the ones the shared modules the Local-mode demo runs need.
   * Limits only the server uses live in server-config.js.
   */
  limits: {
    nameMin: 2,
    nameMax: 30,
    placeMax: 60,
    // مکان may not hold more digits than this in one run (digits separated
    // only by spaces or punctuation count as one run), so no phone number
    // fits in it.
    placeMaxDigitRun: 4,
    priceMin: 100000,
    priceMax: 9999999,
    maxActiveRequests: 10,
    maxStartAheadMonths: 3,
    maxShiftHours: 48,
    boardMaxItems: 200,
    universitySearchMaxResults: 60,
    // New-request alerts: claimed per database round trip, and the pace.
    alertBatch: 25,
    alertPerSecond: 20,
    // The daily summary: most requests listed in one message, users claimed
    // per database round trip, and the pace.
    summaryMaxItems: 10,
    summaryBatch: 25,
    summaryPerSecond: 20,
  },

  /** Timings. */
  timing: {
    // Tehran is UTC+3:30 all year (no daylight saving since 2022).
    tehranOffsetMinutes: 210,
    settledOfferWindowHours: 24,
    // Shift reminders to the coverer, in minutes before the shift starts
    // (the database timer checks every 5 minutes).
    reminders: [
      { key: 'day', minutes: 1440 },
      { key: 'soon', minutes: 120 },
    ],
    // A reminder more than this late (e.g. after an outage) is skipped.
    reminderGraceMinutes: 60,
    // Each of the two confirmation steps (requester, then coverer) must be
    // answered within this long; never past the shift's start. No answer
    // counts as a decline.
    matchStepMinutes: 180,
    // Longest a single run of the alert sender may take (the timer and each
    // posting start new runs).
    alertRunSeconds: 40,
    // The daily summary goes out from this hour, Tehran time (the 5-minute
    // timer sends it on its first run at or after it; each user gets at most
    // one a day), and lists requests put on the board in the last
    // summaryWindowHours. Longest a single run of its sender may take.
    summaryHour: 8,
    summaryWindowHours: 24,
    summaryRunSeconds: 40,
    requestTimeoutMs: 15000,
    toastMs: 3500,
    // Test-panel clock buttons, in minutes.
    testClockSteps: { hour: 60, sixHours: 360, day: 1440, week: 10080 },
  },

  /**
   * Fallback colours, used only where Telegram gives no theme (a plain
   * browser). Inside Telegram every colour comes from the user's theme.
   */
  colors: {
    light: {
      bg: '#ffffff',
      text: '#1f2328',
      hint: '#6b7280',
      link: '#2481cc',
      button: '#2481cc',
      buttonText: '#ffffff',
      secondaryBg: '#f1f3f5',
      sectionBg: '#ffffff',
      destructive: '#d93025',
      accent: '#2481cc',
      success: '#1e8e3e',
      warning: '#b26a00',
      border: 'rgba(0, 0, 0, 0.12)',
      overlay: 'rgba(0, 0, 0, 0.45)',
    },
    dark: {
      bg: '#17212b',
      text: '#f5f5f5',
      hint: '#8a9aa9',
      link: '#6ab3f3',
      button: '#5288c1',
      buttonText: '#ffffff',
      secondaryBg: '#232e3c',
      sectionBg: '#1c2733',
      destructive: '#ec3942',
      accent: '#6ab2f2',
      success: '#4fbf67',
      warning: '#e0a030',
      border: 'rgba(255, 255, 255, 0.14)',
      overlay: 'rgba(0, 0, 0, 0.6)',
    },
  },

  /** Layout. */
  layout: {
    // The one "wide gap" between groups of items, everywhere in the app
    // (applied as the CSS variable --wide-gap by app/theme.js).
    wideGapPx: 24,
  },

  majors: MAJORS,
  // The major the sign-up carousel starts on.
  defaultMajor: 'medicine',
  wards: WARDS,
  cities: CITIES,
  universities: UNIVERSITIES,
  // «پرتکرارها» on the university step, in this order (ids from the list
  // above; each chip shows the university's full name from that list).
  suggestedUniversities: ['tums', 'sbmu', 'iums', 'mums', 'tbzmed', 'mui', 'sums', 'bums', 'arakmu'],

  // One-tap time chips on the request form (24-hour HH:MM).
  timeChips: ['08:00', '14:00', '20:00', '00:00'],

  calendar: {
    monthNames: ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'],
    // Persian weeks start on Saturday.
    weekdayNames: ['شنبه', 'یک‌شنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'],
    weekdayShort: ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'],
  },

  text: TEXT,

  /** Fabricated data for LocalBackend (plain-browser test mode) only. */
  demo: {
    ownTelegramId: 100,
    firstNames: ['سارا', 'علی', 'مریم', 'رضا', 'نگار', 'حسین', 'زهرا', 'امیر', 'فاطمه', 'محمد', 'الهام', 'پویا', 'نرگس', 'کیان', 'مهسا', 'آرش'],
    lastNames: ['رضایی', 'محمدی', 'حسینی', 'کریمی', 'موسوی', 'احمدی', 'جعفری', 'صادقی', 'نوری', 'کاظمی', 'رحیمی', 'اکبری', 'یزدانی', 'شریفی', 'قاسمی', 'فرهادی'],
    // Cities that get pre-made colleagues and requests (plus the owner's own city at sign-up).
    seedCities: ['tehran', 'mashhad', 'shiraz', 'isfahan', 'tabriz'],
    places: {
      tehran: ['بیمارستان امام خمینی', 'بیمارستان شریعتی', 'بیمارستان سینا', 'بیمارستان لقمان حکیم', 'بیمارستان رسول اکرم', 'بیمارستان فیروزگر'],
      mashhad: ['بیمارستان امام رضا', 'بیمارستان قائم', 'بیمارستان هاشمی‌نژاد'],
      shiraz: ['بیمارستان نمازی', 'بیمارستان شهید فقیهی', 'بیمارستان چمران'],
      isfahan: ['بیمارستان الزهرا', 'بیمارستان کاشانی', 'بیمارستان خورشید'],
      tabriz: ['بیمارستان امام رضا', 'بیمارستان سینا', 'بیمارستان شهید مدنی'],
    },
    defaultPlaces: ['بیمارستان مرکزی شهر', 'بیمارستان آموزشی دانشگاه', 'درمانگاه شبانه‌روزی'],
  },
});
