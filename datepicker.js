/**
 * ============================================================================
 * پاس‌کشیک — DATE AND TIME PICKERS  (datepicker.js)
 * ============================================================================
 * A Jalali month grid and a clock-time entry, both presented in the bottom
 * sheet that the search screen already uses.
 *
 * WHY A MONTH GRID
 * Choosing a shift means asking "which day of the week is that", and a grid
 * answers it at a glance where a list of dates cannot. The columns are the
 * Persian week starting شنبه.
 *
 * WHY TYPED TIME
 * Hours and minutes are typed rather than spun. A wheel with sixty minute
 * values would need dozens of taps to reach ۴۵ now that swiping is gone, so
 * two short numeric fields are both faster and simpler. Common shift times sit
 * beside them as one-tap chips for the usual cases.
 *
 * Both call back with a plain value and hold no state of their own, so they
 * can be reused anywhere a sheet is available.
 * ============================================================================
 */

const DatePicker = {

  /**
   * Show the month grid.
   *
   * @param {object}   options
   * @param {object}   options.sheet     Something with openSheet/closeSheet.
   * @param {object}   [options.initial] {jy, jm, jd} to open on.
   * @param {object}   [options.min]     {jy, jm, jd}; earlier days are disabled.
   * @param {Function} options.onPick    Called with {jy, jm, jd}.
   */
  openDate({ sheet, initial, min, onPick }) {
    const today = Jalali.today();
    const start = initial || { jy: today[0], jm: today[1], jd: today[2] };

    // The month currently on display, which moves independently of whatever
    // day is selected.
    let viewYear = start.jy;
    let viewMonth = start.jm;

    /**
     * Compare two Jalali dates.
     *
     * Packing the parts into a single number rather than comparing field by
     * field: year * 10000 + month * 100 + day orders correctly because no
     * field can overflow into the next, and it makes the comparison a single
     * expression instead of a nest of conditions.
     */
    const rank = d => d.jy * 10000 + d.jm * 100 + d.jd;
    const floor = min ? rank(min) : 0;

    const draw = () => {
      const monthName = CONFIG.JALALI_MONTHS[viewMonth - 1];
      const dayCount = Jalali.monthLength(viewYear, viewMonth);
      const firstColumn = Jalali.weekday(viewYear, viewMonth, 1);

      // Blank cells before the first, so day 1 lands under its weekday.
      let cells = '';
      for (let i = 0; i < firstColumn; i++) {
        cells += '<div class="cal-cell cal-blank"></div>';
      }

      for (let day = 1; day <= dayCount; day++) {
        const value = { jy: viewYear, jm: viewMonth, jd: day };
        const disabled = rank(value) < floor;
        const selected = rank(value) === rank(start);
        const isToday = viewYear === today[0] && viewMonth === today[1] && day === today[2];

        cells += `<button class="cal-cell ${selected ? 'selected' : ''}
                                          ${isToday ? 'today' : ''}"
                          ${disabled ? 'disabled' : ''}
                          data-day="${day}">
                    ${Utils.toPersianDigits(day)}
                  </button>`;
      }

      const headers = CONFIG.WEEKDAYS_SHORT
        .map(name => `<div class="cal-head">${name}</div>`).join('');

      // Paging backward past the minimum is pointless, so the arrow is
      // disabled rather than leading to a month of dead cells.
      const atFloor = min && (viewYear * 100 + viewMonth) <= (min.jy * 100 + min.jm);

      sheet.openSheet(CONFIG.CREATE.PICK_DATE, `
        <div class="cal-nav">
          <button class="cal-arrow ripple ripple-dark" id="cal-prev"
                  ${atFloor ? 'disabled' : ''}>‹</button>
          <div class="cal-title">
            ${monthName} ${Utils.toPersianDigits(viewYear)}
          </div>
          <button class="cal-arrow ripple ripple-dark" id="cal-next">›</button>
        </div>
        <div class="cal-grid">${headers}${cells}</div>`);

      document.getElementById('cal-prev').addEventListener('click', () => {
        viewMonth--;
        if (viewMonth < 1) { viewMonth = 12; viewYear--; }
        draw();
      });

      document.getElementById('cal-next').addEventListener('click', () => {
        viewMonth++;
        if (viewMonth > 12) { viewMonth = 1; viewYear++; }
        draw();
      });

      // One listener on the grid rather than one per cell, since the whole
      // grid is rebuilt every time the month changes.
      document.querySelector('.cal-grid').addEventListener('click', event => {
        const cell = event.target.closest('[data-day]');
        if (!cell || cell.disabled) return;

        sheet.closeSheet();
        onPick({ jy: viewYear, jm: viewMonth, jd: Number(cell.dataset.day) });
      });
    };

    draw();
  },

  /**
   * Show the time entry.
   *
   * @param {object}   options
   * @param {object}   options.sheet    Something with openSheet/closeSheet.
   * @param {object}   [options.initial] {hour, minute} to open on.
   * @param {Function} options.onPick   Called with {hour, minute}.
   */
  openTime({ sheet, initial, onPick }) {
    const start = initial || { hour: 8, minute: 0 };

    const pad = n => String(n).padStart(2, '0');

    const chips = CONFIG.CREATE.TIME_PRESETS.map(preset => {
      const [h, m] = preset.split(':').map(Number);
      return `<button class="time-chip ripple ripple-dark"
                      data-hour="${h}" data-minute="${m}">
                ${Utils.toPersianDigits(preset)}
              </button>`;
    }).join('');

    sheet.openSheet(CONFIG.CREATE.PICK_TIME, `
      <div class="time-row">
        <div class="time-field">
          <label class="time-label">ساعت</label>
          <input class="time-input" id="time-hour" type="tel" inputmode="numeric"
                 maxlength="2" value="${Utils.toPersianDigits(pad(start.hour))}">
        </div>
        <div class="time-colon">:</div>
        <div class="time-field">
          <label class="time-label">دقیقه</label>
          <input class="time-input" id="time-minute" type="tel" inputmode="numeric"
                 maxlength="2" value="${Utils.toPersianDigits(pad(start.minute))}">
        </div>
      </div>
      <div class="time-chips">${chips}</div>
      <div class="time-error" id="time-error"></div>
      <div class="bid-actions">
        <button class="btn btn-primary ripple" id="time-ok">تأیید</button>
        <button class="btn btn-flat ripple ripple-dark" id="time-cancel">انصراف</button>
      </div>`);

    const hourInput   = document.getElementById('time-hour');
    const minuteInput = document.getElementById('time-minute');
    const error       = document.getElementById('time-error');

    // Digits are typed in whatever the keyboard produces and shown in Persian.
    // Both fields are two characters, so the cursor can safely sit at the end.
    const normalise = input => {
      input.addEventListener('input', () => {
        const digits = Utils.digitsOnly(input.value).slice(0, 2);
        input.value = Utils.toPersianDigits(digits);
        input.setSelectionRange(input.value.length, input.value.length);
        error.textContent = '';
      });
    };
    normalise(hourInput);
    normalise(minuteInput);

    document.querySelector('.time-chips').addEventListener('click', event => {
      const chip = event.target.closest('[data-hour]');
      if (!chip) return;
      hourInput.value   = Utils.toPersianDigits(pad(chip.dataset.hour));
      minuteInput.value = Utils.toPersianDigits(pad(chip.dataset.minute));
      error.textContent = '';
    });

    document.getElementById('time-cancel')
            .addEventListener('click', () => sheet.closeSheet());

    document.getElementById('time-ok').addEventListener('click', () => {
      const hour   = Number(Utils.digitsOnly(hourInput.value));
      const minute = Number(Utils.digitsOnly(minuteInput.value));

      // Empty fields read as 0 through Number(''), which would silently accept
      // midnight for a blank form. The length check catches that separately.
      const hourOk = Utils.digitsOnly(hourInput.value).length > 0
                  && hour >= 0 && hour <= 23;
      const minuteOk = Utils.digitsOnly(minuteInput.value).length > 0
                    && minute >= 0 && minute <= 59;

      if (!hourOk || !minuteOk) {
        error.textContent = 'ساعت بین ۰ تا ۲۳ و دقیقه بین ۰ تا ۵۹ باشد';
        return;
      }

      sheet.closeSheet();
      onPick({ hour, minute });
    });
  }

};
