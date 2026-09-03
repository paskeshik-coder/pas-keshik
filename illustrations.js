/**
 * ============================================================================
 * پاس‌کشیک — ARTWORK  (illustrations.js)
 * ============================================================================
 * Every piece of drawn artwork in the app, kept apart from both logic and
 * configuration so it can be replaced without touching either.
 *
 * WHY currentColor
 * Each shape is filled with `currentColor` rather than a fixed colour, which
 * means it inherits whatever text colour applies where it sits. One logo file
 * therefore renders black on the white light-mode screen and white on the
 * black dark-mode screen, with no second file and no switching logic.
 *
 * TO REPLACE ARTWORK
 *   Vector : overwrite the SVG markup between the backticks below.
 *   Image  : leave this file alone. In config.js give the intro page an
 *            `image:` path instead of an `illustration:` name, or set the
 *            logo MODE to 'image'. Uploaded files go in an assets/ folder.
 * ============================================================================
 */

const ART = {

  /* ------------------------------------------------------------------------
     LOGO — rod of Asclepius with a forward arrow.
     Traced from the supplied bitmap at 4x resolution, simplified to 223
     points at 99.3% shape fidelity. The viewBox is cropped tight to the mark,
     so its aspect ratio is roughly 1 wide by 2.13 tall; sizing rules in
     config.js constrain both dimensions so any future logo shape still fits.
     --------------------------------------------------------------------- */
  LOGO: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 249.2 531.8"><path fill="currentColor" fill-rule="evenodd" d="M107.00,447.75 L88.75,450.75 L88.00,452.75 L88.75,522.75 L89.75,526.50 L90.75,528.00 L93.00,530.00 L96.75,531.50 L99.00,531.50 L102.75,530.00 L105.50,527.00 L106.50,524.00 L107.50,450.00 Z M137.25,346.75 L125.50,342.75 L118.75,341.50 L118.00,364.50 L119.00,365.50 L124.00,366.75 L133.00,370.50 L137.75,374.00 L142.50,379.50 L144.75,384.50 L145.25,390.75 L143.75,397.25 L140.75,402.25 L134.00,408.50 L122.75,413.75 L107.75,417.75 L81.00,422.75 L73.00,425.00 L63.50,428.75 L56.75,432.75 L52.75,436.00 L48.00,441.00 L45.25,445.25 L42.00,453.25 L41.00,460.25 L41.75,469.00 L43.00,472.75 L45.50,478.00 L49.75,483.50 L55.00,488.25 L61.25,492.25 L68.75,495.50 L77.00,497.75 L76.50,496.75 L67.25,489.75 L64.25,486.50 L58.75,478.75 L56.50,473.25 L55.50,468.00 L56.50,459.50 L59.50,454.00 L64.00,449.75 L71.75,445.50 L80.25,442.75 L96.25,439.50 L123.00,435.50 L137.25,431.25 L146.50,426.50 L152.25,422.25 L159.50,414.75 L164.50,406.75 L166.50,401.75 L168.25,393.00 L167.75,381.25 L164.50,370.50 L159.50,362.75 L152.75,356.00 L145.75,351.00 Z M86.25,289.75 L87.50,411.00 L88.75,411.75 L105.25,408.50 L108.00,407.25 L109.50,295.25 L109.00,294.50 Z M175.25,195.75 L165.75,189.00 L152.75,182.75 L136.00,177.75 L120.75,175.25 L120.25,176.25 L120.00,202.25 L122.25,203.25 L134.25,205.50 L145.75,209.50 L153.25,213.75 L159.25,219.25 L163.25,226.25 L164.50,233.50 L163.75,240.25 L161.75,245.25 L156.50,251.50 L152.00,254.50 L143.75,257.75 L137.00,259.00 L127.00,259.50 L118.25,258.75 L84.75,252.00 L74.75,251.00 L65.25,251.00 L57.50,251.75 L48.25,253.75 L42.50,255.75 L34.00,260.00 L27.50,264.75 L21.25,271.25 L17.50,276.50 L13.75,284.25 L11.00,295.50 L10.75,305.00 L13.00,317.00 L16.75,325.50 L23.75,335.00 L33.50,343.25 L44.50,349.50 L58.50,354.50 L77.25,358.25 L77.00,333.50 L76.25,332.75 L63.50,329.50 L52.50,324.50 L45.75,319.75 L41.25,314.75 L39.50,311.75 L37.50,305.75 L37.50,298.00 L39.75,291.25 L44.50,285.50 L48.50,282.50 L58.00,278.75 L64.50,277.75 L73.00,277.75 L85.50,279.50 L111.75,285.50 L124.25,286.75 L140.00,286.50 L151.00,284.50 L160.00,281.50 L169.50,276.50 L177.75,270.00 L184.25,262.25 L189.25,252.75 L192.00,241.50 L192.25,228.75 L190.50,219.25 L186.50,209.50 L180.50,201.00 Z M84.00,103.00 L85.50,242.00 L109.25,247.50 L110.00,245.50 L111.50,103.25 L111.00,102.75 Z M249.00,79.00 L148.25,20.00 L148.00,20.75 L164.50,64.50 L163.75,65.25 L66.75,65.25 L58.25,66.00 L48.75,67.75 L41.75,69.75 L34.50,72.75 L25.25,78.00 L18.25,83.50 L11.75,90.50 L8.00,96.00 L4.75,102.25 L1.00,114.25 L0.00,121.75 L0.00,132.50 L1.75,142.75 L4.75,151.75 L9.75,161.00 L16.75,169.50 L27.25,178.50 L39.50,185.50 L48.50,189.25 L62.75,193.50 L75.00,195.50 L75.50,194.75 L75.00,167.50 L74.00,166.75 L65.25,164.75 L56.50,161.75 L44.75,155.75 L36.50,148.75 L32.75,143.75 L29.75,137.50 L28.50,133.00 L28.00,127.75 L28.50,120.50 L29.50,116.50 L33.25,109.25 L40.50,102.00 L46.50,98.50 L51.75,96.50 L60.00,94.50 L68.25,93.50 L164.25,93.50 L164.75,94.50 L148.50,137.50 L148.50,138.50 L149.50,138.50 L248.50,80.00 Z M92.25,1.00 L88.75,3.00 L86.50,5.25 L84.50,8.50 L83.25,12.75 L83.50,55.00 L84.00,55.50 L111.50,55.50 L112.00,52.25 L112.25,12.75 L111.50,9.75 L108.75,5.00 L104.75,1.75 L99.00,0.00 L96.25,0.00 Z"/></svg>`,


  /* ------------------------------------------------------------------------
     INTRO ILLUSTRATIONS
     Referenced by name from CONFIG.INTRO.PAGES. The names below must match
     the `illustration:` values there. Add a new entry here and reference it
     from config.js to introduce new artwork.
     --------------------------------------------------------------------- */
  /* ------------------------------------------------------------------------
     MAJOR ICONS — one per رشته, shown on the sign-up carousel.
     Referenced by the `icon` name in CONFIG.SIGNUP.MAJORS. Adding a major
     means adding an entry here and one there; nothing else changes.
     --------------------------------------------------------------------- */
  /* ------------------------------------------------------------------------
     NAV ICONS — one per drawer item.
     Drawn as strokes in currentColor so they take the drawer's text colour and
     shift automatically between the active and inactive states, and between
     light and dark mode. Emoji were the alternative and were rejected: they
     ignore text colour entirely and render differently on every Android build.
     --------------------------------------------------------------------- */
  NAV: {
    search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="11" cy="11" r="7"/><path d="M20 20l-4.2-4.2"/></svg>`,

    clipboard: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M9 3h6v3H9z"/>
      <path d="M15 4.5h2.5A1.5 1.5 0 0119 6v13a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 015 19V6a1.5 1.5 0 011.5-1.5H9"/>
      <path d="M8.5 11h7M8.5 15h4.5"/></svg>`,

    briefcase: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="7.5" width="18" height="12.5" rx="2"/>
      <path d="M9 7.5V6a2 2 0 012-2h2a2 2 0 012 2v1.5"/>
      <path d="M3 12.5h18"/></svg>`,

    // Ticket. Drawn as a rounded rectangle with two notches bitten out of the
    // sides and a single dashed line, rather than the many short strokes of a
    // realistic stub — at 22px those strokes merge into a grey smear that
    // reads as a film strip.
    ticket: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 9V7.5A1.5 1.5 0 015.5 6h13A1.5 1.5 0 0120 7.5V9a3 3 0 000 6v1.5a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 014 16.5V15a3 3 0 000-6z"/>
      <path d="M13.5 9.5v5" stroke-dasharray="1.5 2.2"/></svg>`,

    mail: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="5.5" width="18" height="13" rx="2"/>
      <path d="M3.5 7l8.5 6 8.5-6"/></svg>`,

    // Gear. Six broad teeth instead of the usual eight or twelve, and a large
    // hub: at 22px, fine teeth blur into a soft blob with no recognisable
    // silhouette. Fewer, bigger shapes survive being shrunk.
    gear: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="3.4"/>
      <path d="M12 2.6v2.9M12 18.5v2.9M20.1 7.3l-2.5 1.45M6.4 15.25L3.9 16.7M20.1 16.7l-2.5-1.45M6.4 8.75L3.9 7.3"/></svg>`,
    menu: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="2" stroke-linecap="round">
      <path d="M4 7h16M4 12h16M4 17h16"/></svg>`
  },
  MAJORS: {

    // Stethoscope.
    medicine: `
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="none"
           stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">
        <path d="M28 16v20a17 17 0 0034 0V16"/>
        <path d="M22 16h12M56 16h12"/>
        <path d="M45 53v10a19 19 0 0038 0v-6"/>
        <circle cx="83" cy="43" r="10"/>
      </svg>`,

    // Nurse's cap with a heart.
    nursing: `
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="none"
           stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 62V30a4 4 0 014-4h56a4 4 0 014 4v32"/>
        <path d="M12 62h76"/>
        <path d="M50 34v14M43 41h14"/>
        <path d="M32 74c8 8 28 8 36 0"/>
      </svg>`,

    // Parent cradling an infant.
    midwifery: `
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="none"
           stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="38" cy="26" r="13"/>
        <path d="M17 84c0-16 9-27 21-27s21 11 21 27"/>
        <circle cx="70" cy="55" r="9"/>
        <path d="M56 84c0-9 6-15 14-15s14 6 14 15"/>
      </svg>`,

    // Mortar and pestle.
    pharmacy: `
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="none"
           stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 48h56v6a28 28 0 01-28 28 28 28 0 01-28-28z"/>
        <path d="M50 82v6M34 88h32"/>
        <path d="M60 44L82 18a7 7 0 0110 10L64 48"/>
      </svg>`
  },
  INTRO: {

    // Page 1: one figure handing a clipboard to another.
    handover: `
      <svg viewBox="0 0 240 180" xmlns="http://www.w3.org/2000/svg">
        <circle cx="120" cy="92" r="72" fill="var(--brand)" opacity=".07"/>
        <circle cx="72" cy="58" r="17" fill="var(--brand)"/>
        <path d="M46 142c0-16 12-28 26-28s26 12 26 28z" fill="var(--brand)"/>
        <circle cx="168" cy="58" r="17" fill="var(--brand-light)"/>
        <path d="M142 142c0-16 12-28 26-28s26 12 26 28z" fill="var(--brand-light)"/>
        <rect x="100" y="76" width="40" height="50" rx="4" fill="#fff"
              stroke="var(--brand)" stroke-width="3"/>
        <rect x="112" y="70" width="16" height="10" rx="2" fill="var(--accent)"/>
        <line x1="109" y1="94"  x2="131" y2="94"  stroke="var(--brand)" stroke-width="3" stroke-linecap="round"/>
        <line x1="109" y1="105" x2="131" y2="105" stroke="var(--brand)" stroke-width="3" stroke-linecap="round"/>
        <line x1="109" y1="116" x2="123" y2="116" stroke="var(--brand)" stroke-width="3" stroke-linecap="round"/>
      </svg>`,

    // Page 2: a shield with a lock, two silhouettes held apart on either side.
    privacy: `
      <svg viewBox="0 0 240 180" xmlns="http://www.w3.org/2000/svg">
        <circle cx="120" cy="92" r="72" fill="var(--brand)" opacity=".07"/>
        <circle cx="34" cy="76" r="13" fill="var(--brand)" opacity=".35"/>
        <path d="M14 122c0-12 9-21 20-21s20 9 20 21z" fill="var(--brand)" opacity=".35"/>
        <circle cx="206" cy="76" r="13" fill="var(--brand)" opacity=".35"/>
        <path d="M186 122c0-12 9-21 20-21s20 9 20 21z" fill="var(--brand)" opacity=".35"/>
        <path d="M120 34l44 18v34c0 30-19 52-44 60-25-8-44-30-44-60V52z" fill="var(--brand)"/>
        <path d="M108 92v-9a12 12 0 0124 0v9" fill="none" stroke="#fff"
              stroke-width="5" stroke-linecap="round"/>
        <rect x="102" y="92" width="36" height="28" rx="4" fill="#fff"/>
        <circle cx="120" cy="105" r="4" fill="var(--brand)"/>
      </svg>`,

    // Page 3: a figure stepping through a lit doorway.
    doorway: `
      <svg viewBox="0 0 240 180" xmlns="http://www.w3.org/2000/svg">
        <circle cx="120" cy="92" r="72" fill="var(--brand)" opacity=".07"/>
        <rect x="86" y="34" width="68" height="112" rx="6" fill="var(--accent)" opacity=".30"/>
        <rect x="86" y="34" width="68" height="112" rx="6" fill="none"
              stroke="var(--brand)" stroke-width="5"/>
        <circle cx="120" cy="76" r="15" fill="var(--brand)"/>
        <path d="M97 146c0-14 10-25 23-25s23 11 23 25z" fill="var(--brand)"/>
        <path d="M164 90h28M182 80l10 10-10 10" fill="none" stroke="var(--brand)"
              stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`
  }

};
