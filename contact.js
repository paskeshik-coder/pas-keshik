/**
 * ============================================================================
 * پاس‌کشیک — CONTACT  (contact.js)
 * ============================================================================
 * A short form that hands a composed message to the phone's mail app.
 *
 * Nothing is sent from inside the app — there is no mail server, and adding
 * one to deliver a handful of messages a week would be a poor trade. The
 * screen says so plainly rather than implying a send that will not happen.
 * ============================================================================
 */

const ContactScreen = {

  subject: null,
  message: '',
  _bound: false,

  render() {
    const text = CONFIG.CONTACT;

    const chips = text.SUBJECTS.map(subject => `
      <button class="subject-chip ripple ripple-dark ${this.subject === subject.id ? 'selected' : ''}"
              data-subject="${subject.id}">
        ${Utils.escapeHtml(subject.label)}
      </button>`).join('');

    return `
      <div class="misc-screen">
        <p class="contact-intro">${Utils.escapeHtml(text.INTRO)}</p>

        <div class="field-label">${Utils.escapeHtml(text.SUBJECT_LABEL)}</div>
        <div class="contact-subjects">${chips}</div>

        <div class="field-label">${Utils.escapeHtml(text.MESSAGE_LABEL)}</div>
        <textarea class="contact-textarea" id="contact-message"
                  maxlength="${text.MESSAGE_MAX}"
                  placeholder="${Utils.escapeHtml(text.MESSAGE_PLACEHOLDER)}"
                  >${Utils.escapeHtml(this.message)}</textarea>
        <div class="contact-count" id="contact-count">
          ${Utils.toPersianDigits(this.message.length)} /
          ${Utils.toPersianDigits(text.MESSAGE_MAX)}
        </div>

        <button class="btn btn-primary btn-block ripple" data-send="1"
                style="margin-top:16px">
          ${Utils.escapeHtml(text.SEND_BUTTON)}
        </button>

        <div class="misc-note" style="text-align:center;padding-top:12px">
          ${Utils.escapeHtml(text.NOTE)}
        </div>
      </div>`;
  },

  /**
   * Hand the message to the mail app.
   *
   * The profile details are appended because a report saying only "it does not
   * work" is unanswerable — knowing the رشته and university narrows almost
   * every question about what someone was looking at.
   */
  send() {
    const text = CONFIG.CONTACT;

    if (!this.message.trim()) {
      const field = document.getElementById('contact-message');
      field.classList.add('invalid');
      alert(text.ERROR_EMPTY);
      return;
    }

    const subject = text.SUBJECTS.find(s => s.id === this.subject);
    const profile = Utils.getLocalProfile() || {};
    const major = CONFIG.SIGNUP.PAGE_MAJOR.MAJORS
      .find(m => m.id === profile.major)?.label || '—';

    const body = this.message.trim()
      + '\n\n---\n'
      + `رشته: ${major}\n`
      + `دانشگاه: ${profile.universityName || '—'}\n`
      + `شهر: ${profile.city || '—'}`;

    /*
      encodeURIComponent, not encodeURI. The message is a value inside the
      mailto URL, so characters like & and # have to be escaped or they would
      be read as URL syntax and silently truncate the message at that point.
    */
    const url = `mailto:${text.EMAIL}`
      + `?subject=${encodeURIComponent('پاس‌کشیک — ' + (subject?.label || 'پیام'))}`
      + `&body=${encodeURIComponent(body)}`;

    window.location.href = url;
  },

  bindOnce() {
    if (this._bound) return;
    this._bound = true;

    const content = document.getElementById('app-content');

    content.addEventListener('click', event => {
      const chip = event.target.closest('[data-subject]');
      if (chip) {
        this.subject = chip.dataset.subject;
        // Only the chips change, so the textarea is left alone — redrawing the
        // whole screen would close the keyboard and lose the cursor.
        document.querySelectorAll('[data-subject]').forEach(c =>
          c.classList.toggle('selected', c.dataset.subject === this.subject)
        );
        return;
      }

      if (event.target.closest('[data-send]')) this.send();
    });

    content.addEventListener('input', event => {
      const field = event.target.closest('#contact-message');
      if (!field) return;

      this.message = field.value;
      field.classList.remove('invalid');

      const counter = document.getElementById('contact-count');
      if (counter) {
        counter.textContent =
          `${Utils.toPersianDigits(this.message.length)} / `
          + Utils.toPersianDigits(CONFIG.CONTACT.MESSAGE_MAX);
      }
    });
  },

  mount() { this.bindOnce(); }

};
