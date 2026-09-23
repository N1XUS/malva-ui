import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DOCUMENT,
  type ElementRef,
  forwardRef,
  inject,
  input,
  model,
  signal,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import { MlvTabbableElementService } from '@malva-ui/cdk/accessibility';
import {
  MlvCalendar,
  MlvCalendarSheet,
  type MlvCalendarRangeValue,
} from '@malva-ui/core/calendar';
import {
  MLV_DATE_ADAPTER,
  MlvNativeDateAdapter,
  type MlvDateAdapter,
} from '@malva-ui/core/date';
import {
  MlvPopup,
  MlvPopupContent,
  MlvPopupContainer,
  MlvPopupHeaderActions,
} from '@malva-ui/core/popup';
import {
  MlvFormControlWrapper,
  MlvFormControlWrapperControl,
  MlvHint,
  MlvDescription,
  MlvLabel,
  MLV_FORM_CONTROL,
  MlvMessage,
  MlvSignalFormControlBase,
} from '@malva-ui/core/form-utils';
import type {
  MlvFormState,
  MlvFormControl,
  MlvFormControlLabelStrategy,
} from '@malva-ui/core/form-utils';
import { LucideCalendarDays } from '@lucide/angular';
import { A11yModule } from '@angular/cdk/a11y';
import { MlvButton } from '@malva-ui/core/button';
import { MLV_CALENDAR_I18N, MLV_DATE_RANGE_PICKER_I18N } from '@malva-ui/i18n';

/**
 * Visual/validation state of the date range picker. Mirrors {@link MlvFormState}.
 */
export type MlvDateRangePickerState = MlvFormState;

/**
 * Value shape for the date range picker.
 * Both `start` and `end` can be `null` when not yet selected.
 */
export interface MlvDateRangePickerValue<D = Date> {
  /** The start date of the selected range. */
  start: D | null;
  /** The end date of the selected range. */
  end: D | null;
}

/** Accepts signal-form range constraints without changing the public date-boundary API. */
function coerceBoundaryDate<D>(
  value: D | MlvDateRangePickerValue<D> | null | undefined,
  edge: 'start' | 'end',
): D | null {
  if (value == null) return null;
  if (typeof value === 'object' && 'start' in value && 'end' in value) {
    return (value as MlvDateRangePickerValue<D>)[edge];
  }
  return value as D;
}

@Component({
  selector: 'mlv-date-range-picker',
  imports: [
    MlvPopup,
    MlvPopupContent,
    MlvPopupContainer,
    MlvPopupHeaderActions,
    MlvCalendar,
    MlvCalendarSheet,
    LucideCalendarDays,
    MlvFormControlWrapper,
    MlvFormControlWrapperControl,
    MlvDescription,
    MlvLabel,
    MlvHint,
    MlvMessage,
    MlvButton,
    A11yModule,
  ],
  templateUrl: './date-range-picker.html',
  styleUrl: './date-range-picker.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: MLV_FORM_CONTROL,
      useExisting: forwardRef(() => MlvDateRangePicker),
    },
  ],
  host: {
    class: 'mlv-date-range-picker',
    '[class]': '"mlv-date-range-picker--state-" + resolvedState()',
    '[class.mlv-date-range-picker--disabled]': 'computedDisabled()',
    '[class.mlv-date-range-picker--focused]': 'focused()',
    '[class.mlv-date-range-picker--open]': '_isOpen()',
    '[class.mlv-date-range-picker--selecting]': '_isSelecting()',
  },
})
export class MlvDateRangePicker<D = Date>
  extends MlvSignalFormControlBase<MlvDateRangePickerValue<D> | null>
  implements MlvFormControl
{
  /**
   * @protected {@link id} sits on the trigger `div[role="button"]`, which
   * `<label for>` cannot name, so a projected `<mlv-label>` reaches it through
   * `aria-labelledby`.
   */
  protected override _externalLabelStrategy(): MlvFormControlLabelStrategy {
    return 'aria';
  }

  /** The committed date range used by all Angular forms APIs. */
  readonly value = model<MlvDateRangePickerValue<D> | null>(null);
  /** @private The active date adapter — a provided `MLV_DATE_ADAPTER`, or the native fallback. */
  private readonly _dateAdapter =
    (inject(MLV_DATE_ADAPTER, {
      optional: true,
    }) as MlvDateAdapter<D> | null) ??
    (inject(MlvNativeDateAdapter) as unknown as MlvDateAdapter<D>);

  /**
   * The pending range being assembled during selection.
   * Committed to the form control only when the user clicks Apply.
   */
  protected readonly _pendingRange = signal<MlvCalendarRangeValue<D> | null>(
    null,
  );

  /**
   * The last committed range value (reflects the form control value).
   */
  readonly rangeValue = this.value;

  /** Custom placeholder override. Falls back to the i18n-provided placeholder. */
  readonly placeholder = input<string | undefined>(undefined);

  /** Minimum selectable date, passed to both calendars. */
  readonly min = input<
    D | null,
    D | MlvDateRangePickerValue<D> | null | undefined
  >(null, {
    transform: (value) => coerceBoundaryDate(value, 'start'),
  });

  /** Maximum selectable date, passed to both calendars. */
  readonly max = input<
    D | null,
    D | MlvDateRangePickerValue<D> | null | undefined
  >(null, {
    transform: (value) => coerceBoundaryDate(value, 'end'),
  });

  /** Optional callback for disabling arbitrary dates, passed to both calendars. */
  readonly disabledDates = input<((date: D) => boolean) | null>(null);

  /** @protected The component's i18n strings signal. */
  protected readonly _i18n = inject(MLV_DATE_RANGE_PICKER_I18N);

  /**
   * @protected The calendar i18n slice, for the sheet's confirm label. The
   * string belongs to the calendar sheet, which both pickers share, so it is
   * defined once there rather than duplicated per picker.
   */
  protected readonly _calendarI18n = inject(MLV_CALENDAR_I18N);

  /**
   * @private Reference to the trigger element, used to restore focus when the
   * popup closes. It is declared in this component's own template, so a signal
   * view query is the correct mechanism (was a host `querySelector`).
   */
  private readonly _triggerRef =
    viewChild<ElementRef<HTMLElement>>('triggerRef');

  /** @private Locates the first tabbable element inside the popup panel. */
  private readonly _tabbable = inject(MlvTabbableElementService);

  /** @private Document ref for locating the rendered popup panel by id. */
  private readonly _document = inject(DOCUMENT);

  /** @protected Resolved placeholder: explicit input takes precedence over i18n default. */
  protected readonly _resolvedPlaceholder = computed(
    () => this.placeholder() ?? this._i18n().placeholder,
  );

  /**
   * @internal Whether the picker popup is currently open.
   */
  protected readonly _isOpen = signal(false);

  /**
   * @private Month the user navigated the panels to, or `null` to follow the
   * selection.
   *
   * The two panels are locked one month apart and driven from this single
   * anchor, so navigating either one moves both and the left panel can never
   * overtake the right. Reset on every open, so the picker always reopens on
   * the selected range rather than wherever it was left.
   */
  private readonly _navigatedAnchor = signal<D | null>(null);

  /**
   * @internal Whether a range selection is in progress (start chosen, awaiting end click).
   */
  protected readonly _isSelecting = computed(
    () => !!this._pendingRange()?.start && !this._pendingRange()?.end,
  );

  /**
   * Override focused to also be true when the calendar popup is open.
   */
  override readonly focused = computed(() => this._focused() || this._isOpen());

  /** Unique ID for the optional message element used by aria-describedby. */

  /**
   * The HTML `id` assigned to the visible `<mlv-label>` element. The trigger
   * references it via `aria-labelledby` (a `<label for>` cannot name a
   * `div[role="button"]`), which is also what makes a label written on this
   * control win over one projected beside it into `mlv-form-field`.
   */
  readonly labelId = computed(() => `${this.id()}-label`);

  /** Unique ID for the popup panel element used by aria-controls. */
  readonly panelId = computed(() => `${this.id()}-panel`);

  /**
   * The initial date for the left (earlier-month) calendar panel.
   * Defaults to today when no range is selected.
   */
  readonly leftCalendarActiveDate = computed<D>(
    () => {
      const navigated = this._navigatedAnchor();
      if (navigated) {
        return this._dateAdapter.clone(navigated);
      }
      const pending = this._pendingRange();
      const val = this.rangeValue();
      const anchor = pending?.start ?? val?.start ?? null;
      return anchor
        ? this._dateAdapter.clone(anchor)
        : this._dateAdapter.today();
    },
    // Month-level equality, so the panels are re-bound only when the month
    // they show actually changes. `activeDate` is both the visible month and
    // the focused cell: this computed allocates a fresh date on every range
    // change, and without this every keystroke would re-bind `[activeDate]`
    // and drag each panel's focus ring back onto the range start.
    { equal: (a, b) => this._sameMonth(a, b) },
  );

  /**
   * The initial date for the right (later-month) calendar panel.
   * Always one month ahead of the left panel's month.
   */
  readonly rightCalendarActiveDate = computed<D>(
    () => {
      return this._dateAdapter.addCalendarMonths(
        this.leftCalendarActiveDate(),
        1,
      );
    },
    { equal: (a, b) => this._sameMonth(a, b) },
  );

  /**
   * The formatted start date display string.
   * Returns an empty string when no start date is selected.
   */
  get startDisplayValue(): string {
    const val = this.rangeValue();
    if (!val?.start) return '';
    return this._formatDate(val.start);
  }

  /**
   * The formatted end date display string.
   * Returns an empty string when no end date is selected.
   */
  get endDisplayValue(): string {
    const val = this.rangeValue();
    if (!val?.end) return '';
    return this._formatDate(val.end);
  }

  /**
   * Whether the Apply button should be enabled.
   * Requires both start and end dates to be set in the pending range.
   */
  readonly canApply = computed(
    () => !!this._pendingRange()?.start && !!this._pendingRange()?.end,
  );

  /**
   * Whether the clear button should be shown: `clearable`, a committed range
   * with at least one end, and a user allowed to write — neither readonly nor
   * disabled (#301; it used to check `disabled` alone, so it answered `true`
   * for a readonly picker).
   */
  readonly hasClearableValue = computed(
    () =>
      this.clearable() &&
      this._canWrite() &&
      (!!this.rangeValue()?.start || !!this.rangeValue()?.end),
  );

  /**
   * @private Whether two dates fall in the same calendar month.
   */
  private _sameMonth(a: D, b: D): boolean {
    return (
      this._dateAdapter.getYear(a) === this._dateAdapter.getYear(b) &&
      this._dateAdapter.getMonth(a) === this._dateAdapter.getMonth(b)
    );
  }

  /**
   * @private First day of the month `date` falls in.
   *
   * The anchor is always a first-of-month, so `addCalendarMonths` can never
   * clamp it: the round trip the right panel performs (`-1` on the way in,
   * `+1` on the way out) is exact only because day 1 exists in every month.
   * Anchoring on a raw `activeDate` instead loses days -- 31 Oct goes to
   * 30 Sep and comes back as 30 Oct, and 31 Mar comes back as 28 Mar.
   */
  private _startOfMonth(date: D): D {
    return this._dateAdapter.createDate(
      this._dateAdapter.getYear(date),
      this._dateAdapter.getMonth(date),
      1,
    );
  }

  /**
   * @protected Records navigation from the left panel.
   *
   * `activeDate` is both the focused cell and the visible month, and
   * `followSelection` gates only the two constructor effects -- `selectDate`
   * and every keyboard handler still write it. So a change that stays inside
   * the month the panel already shows is a day-level move (a click, an arrow
   * key) and must not touch the anchor: re-binding would drag the focus ring
   * back. Only a change of month is navigation.
   */
  protected _onLeftActiveDateChange(date: D): void {
    if (this._sameMonth(date, this.leftCalendarActiveDate())) return;
    this._navigatedAnchor.set(this._startOfMonth(date));
  }

  /**
   * @protected Records navigation from the right panel, which sits one month
   * ahead of the anchor. Same month-level guard as the left panel.
   */
  protected _onRightActiveDateChange(date: D): void {
    if (this._sameMonth(date, this.rightCalendarActiveDate())) return;
    this._navigatedAnchor.set(
      this._dateAdapter.addCalendarMonths(this._startOfMonth(date), -1),
    );
  }

  /**
   * Toggles the popup open/closed.
   * No-op when the picker is disabled.
   */
  toggleDropdown(): void {
    if (this.computedDisabled()) return;
    const wasOpen = this._isOpen();
    if (wasOpen) {
      this.closeDropdown();
    } else {
      // Initialize pending range from committed value when opening
      const val = this.rangeValue();
      this._pendingRange.set(val ? { start: val.start, end: val.end } : null);
      this._navigatedAnchor.set(null);
      this._isOpen.set(true);
    }
  }

  /**
   * @protected Moves focus into the popup panel when it opens.
   *
   * In the full-screen sheet the meaningful landing spot is the day grid's
   * roving tab stop, the way the anchored dropdown lands on a calendar day:
   * the generic first-tabbable scan would stop on the year strip's listbox,
   * which comes first in DOM order. Everywhere else it falls back to that scan,
   * and finally to the panel container (which carries `tabindex="-1"`), so
   * focus always lands inside the modal.
   */
  protected _onPanelOpened(): void {
    const panel = this._document.getElementById(this.panelId());
    if (!panel) return;
    const day = panel.querySelector<HTMLElement>(
      '.mlv-calendar-sheet__day[tabindex="0"]',
    );
    const first = day ?? this._tabbable.getTabbableElement(panel, false, true);
    (first ?? panel).focus();
  }

  /**
   * @protected Handles popup close: clears the focused state and returns focus
   * to the trigger, matching the overlay focus-restore pattern.
   */
  protected _onPanelClosed(): void {
    this.setFocused(false);
    this._markTouched();
    this._triggerRef()?.nativeElement.focus();
  }

  /**
   * @protected Focuses the trigger when the control's own `<mlv-label>` is
   * clicked.
   *
   * The trigger is a `div`, so `<label for>` cannot name it and the native
   * click-to-focus a field label owes its control never runs — the label was
   * inert on click (#216). Focus only: opening the overlay is more than a
   * native label click does, and a stray click should not raise a modal.
   */
  protected _onLabelClick(): void {
    if (this.computedDisabled()) return;
    this._triggerRef()?.nativeElement.focus();
  }

  /** @protected Marks the control touched when its trigger loses focus. */
  protected _onTriggerBlur(): void {
    this.setFocused(false);
    this._markTouched();
  }

  /**
   * Closes the popup and resets the pending selection to the committed value.
   */
  closeDropdown(): void {
    this._isOpen.set(false);
    // Reset pending range to committed value
    const val = this.rangeValue();
    this._pendingRange.set(val ? { start: val.start, end: val.end } : null);
  }

  /**
   * Handles range value changes from either calendar.
   * Updates the pending (uncommitted) range.
   *
   * @param range - The updated range value from the calendar.
   */
  onRangeChanged(range: MlvCalendarRangeValue<D> | null): void {
    this._pendingRange.set(range);
  }

  /**
   * Applies the pending range selection and closes the popup.
   * Commits the value to the form control.
   */
  applySelection(): void {
    const pending = this._pendingRange();
    const newValue: MlvDateRangePickerValue<D> | null = pending?.start
      ? { start: pending.start, end: pending.end }
      : null;

    this.rangeValue.set(newValue);
    this._isOpen.set(false);
  }

  /**
   * Clears the selected range and resets the picker.
   *
   * Also the popup footer's `Clear` handler; not gated by `readonly` here —
   * readonly on the picker's own popup is #402. The wrapper's clear button
   * does not call it; it calls {@link _onClear}, which is gated (#301).
   */
  clearSelection(): void {
    this.rangeValue.set(null);
    this._pendingRange.set(null);
  }

  /** Whether the control holds a clearable value — A committed range is set. */
  readonly hasValue = computed(() => this.rangeValue() != null);

  /**
   * @protected The wrapper's clear-button handler: clears the committed range
   * through `_write`, then drops the pending range and marks the field touched
   * — both only when the write landed.
   *
   * Before #301 nothing was bound to the wrapper's `(clear)`, so a
   * `clearable` range picker rendered an X that did nothing. The wrapper
   * withholds the X while the picker is readonly or disabled; `_write`
   * refuses independently, for a click that reaches a stale button.
   */
  protected _onClear(): void {
    if (!this._write(null)) return;
    this._pendingRange.set(null);
    this._markTouched();
  }

  /**
   * @private Formats a single date for display.
   */
  private _formatDate(date: D): string {
    return this._dateAdapter.format(date, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }
}
