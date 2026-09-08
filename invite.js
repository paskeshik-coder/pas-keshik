/**
 * ============================================================================
 * پاس‌کشیک — INVITE CODE  (invite.js)
 * ============================================================================
 * The user's permanent invite code, their unused boost credits, and a
 * ready-made letter to send to friends.
 *
 * The code is generated once and stored with the profile. In Stage 3 the
 * server generates it at sign-up and guarantees uniqueness, which a client
 * cannot: it has no way to know what codes already exist.
 * ============================================================================
 */

const InviteScreen = {

  _bound: false,

  /**
   * This user's code, generating and storing one if they have none.
   *
   * Existing profiles predate the code, so it is filled in on first view
   * rather than requiring anyone to sign up again.
   *
   * @returns {string}
   */
  code() {
    const profile = Utils.getLocalProfile() || {};
    if (profile.myInviteCode) return profile.myInviteCode;

    const code = Utils.generateInviteCode();
    Utils.saveLocalProfile({ ...profile, myInviteCode: code });
    return code;
  },

  /** Unused boost credits. Always zero until invites are real in Stage 3. */
  credits() {
    return (Utils.getLocalProfile() || {}).boostCredits || 0;
  },

  /** The letter with its placeholders filled in. */
  letter() {
    return CONFIG.INVITE.LETTER
      .replace('[CODE]', this.code())
      .replace('[LINK]', CONFIG.INVITE.BOT_LINK);
  },

  render() {
    const text = CONFIG.INVITE;
    const credits = this.credits();

    const creditsHtml = credits > 0
      ? `<div class="credits-row">
           <span class="credits-label">${Utils.escapeHtml(text.CREDITS_LABEL)}</span>
           <span class="credits-value">
             ${Utils.toPersianDigits(credits)} ${Utils.escapeHtml(text.CREDITS_UNIT)}
           </span>
         </div>`
      : `<div class="credits-none">${Utils.escapeHtml(text.CREDITS_NONE)}</div>`;

    return `
      <div class="misc-screen">
        <div class="invite-code-card">
          <div class="invite-code-label">${Utils.escapeHtml(text.TITLE)}</div>
          <div class="invite-code">${Utils.escapeHtml(this.code())}</div>
          <div class="invite-code-note">${Utils.escapeHtml(text.CODE_NOTE)}</div>
          <button class="invite-copy ripple" data-copy-code="1">
            ${Utils.escapeHtml(text.COPY_CODE)}
          </button>
        </div>

        <div class="misc-card">${creditsHtml}</div>

        <div class="misc-card">
          <div class="invite-how">
            <div class="invite-how-title">${Utils.escapeHtml(text.HOW_TITLE)}</div>
            <div class="invite-how-text">${Utils.escapeHtml(text.HOW_TEXT)}</div>
          </div>
        </div>

        <div class="misc-section-title">${Utils.escapeHtml(text.LETTER_TITLE)}</div>
        <div class="misc-card">
          <!-- Shown exactly as it will be pasted, so what is copied is what
               was read. -->
          <div class="invite-letter">${Utils.escapeHtml(this.letter())}</div>
          <button class="misc-row ripple ripple-dark" data-copy-letter="1"
                  style="justify-content:center;color:var(--brand);font-weight:500">
            ${Utils.escapeHtml(text.COPY_LETTER)}
          </button>
        </div>

        <div class="misc-note">${Utils.escapeHtml(text.LETTER_NOTE)}</div>
      </div>`;
  },

  bindOnce() {
    if (this._bound) return;
    this._bound = true;

    document.getElementById('app-content').addEventListener('click', async event => {
      if (event.target.closest('[data-copy-code]')) {
        await Utils.copyToClipboard(this.code());
        alert(CONFIG.INVITE.COPIED);
        return;
      }

      if (event.target.closest('[data-copy-letter]')) {
        await Utils.copyToClipboard(this.letter());
        alert(CONFIG.INVITE.COPIED);
      }
    });
  },

  mount() { this.bindOnce(); }

};
