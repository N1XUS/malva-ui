import type { ElementRef, Signal } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  forwardRef,
  inject,
  input,
  model,
  signal,
  viewChild,
  viewChildren,
  ViewEncapsulation,
} from '@angular/core';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import { LEFT_ARROW, RIGHT_ARROW } from '@angular/cdk/keycodes';
import {
  MlvDensityDirective,
  MLV_DENSITY_ELEMENT,
} from '@malva-ui/cdk/density';
import type { MlvFormState, MlvFormControl } from '@malva-ui/core/form-utils';
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
import {
  MlvPopup,
  MlvPopupContent,
  MlvPopupContainer,
} from '@malva-ui/core/popup';
import { LucideClock } from '@lucide/angular';
import { MlvButton } from '@malva-ui/core/button';
import { MlvRtlService } from '@malva-ui/cdk/utils';
import { MlvScrubber } from '@malva-ui/core/scrubber';
import { MLV_TIME_PICKER_I18N } from '@malva-ui/i18n';

/**
 * Clock mode — 24-hour or 12-hour (AM/PM).
 */
export type MlvTimeMode = '24h' | '12h';

/**
 * Visual/validation state of the time picker. Mirrors {@link MlvFormState}.
 */
export type MlvTimePickerState = MlvFormState;

/** @private Generates a range array [start, end) */
function range(start: number, end: number): number[] {
  return Array.from({ length: end - start }, (_, i) => i + start);
}

/**
 * Time picker component (`mlv-time-picker`) that allows users to select a time
 * value using a compact trigger that opens a floating popup with scrollable
 * drum-roll columns. Supports 24h and 12h (AM/PM) modes, optional seconds
 * display, and integrates with signal, reactive, and template-driven forms.
 *
 * Emits values as `HH:mm` (24h format) or `HH:mm:ss` when `showSeconds` is true.
 * In 12h mode the emitted value is still in 24h format internally.
 */
@Component({
  selector: 'mlv-time-picker',
  templateUrl: './time-picker.html',
  styleUrl: './time-picker.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MlvDescription,
    MlvLabel,
    MlvHint,
    MlvFormControlWrapper,
    MlvFormControlWrapperControl,
    MlvMessage,
    MlvPopup,
    MlvPopupContent,
    MlvPopupContainer,
    LucideClock,
    MlvButton,
    MlvScrubber,
  ],
  providers: [
    {
      provide: MLV_FORM_CONTROL,
      useExisting: forwardRef(() => MlvTimePicker),
    },
    { provide: MLV_DENSITY_ELEMENT, useValue: 'time-picker' },
  ],
  hostDirectives: [
    {
      directive: MlvDensityDirective,
      inputs: ['mlvDensity'],
    },
  ],
  host: {
    class: 'mlv-time-picker',
    '[class]': '"mlv-time-picker--" + resolvedState()',
    '[class.mlv-time-picker--disabled]': 'computedDisabled()',
    '[class.mlv-time-picker--open]': 'isOpen()',
    '[class.mlv-time-picker--12h]': 'mode() === "12h"',
    '[class.mlv-time-picker--with-seconds]': 'showSeconds()',
  },
})
export class MlvTimePicker
  extends MlvSignalFormControlBase<string>
  implements MlvFormControl
{
  /** The `HH:mm`/`HH:mm:ss` value used by all Angular forms APIs. */
  readonly value = model<string>('');
  /**
   * Clock mode — `'24h'` for 24-hour display (default) or `'12h'` for AM/PM.
   */
  readonly mode = input<MlvTimeMode>('24h');

  /**
   * When `true`, shows a seconds column in addition to hours and minutes.
   */
  readonly showSeconds = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /** @protected The component's i18n strings signal. */
  protected readonly _i18n = inject(MLV_TIME_PICKER_I18N);

  /** @protected Resolved aria-label: explicit input takes precedence over i18n default. */
  protected readonly _resolvedAriaLabel = computed(
    () => this.ariaLabel() ?? this._i18n().timePicker,
  );

  /** @private Whether the time selection popup is open. */
  readonly isOpen = signal(false);

  /** @private Internal signal for the selected hour (0–23 in 24h mode; 1–12 in 12h mode). */
  protected readonly _hour = signal(0);

  /** @private Internal signal for the selected minute (0–59). */
  protected readonly _minute = signal(0);

  /** @private Internal signal for the selected second (0–59). */
  protected readonly _second = signal(0);

  /** @private AM/PM period — `'AM'` or `'PM'`. Only relevant in 12h mode. */
  protected readonly _period = signal<'AM' | 'PM'>('AM');

  /** Unique ID for the message element, used for aria-describedby linking. */

  /** Unique ID for the popup panel, used for aria-controls linking. */
  readonly panelId = computed(() => `${this.id()}-panel`);

  /** Override focused to also be true when the popup is open. */
  override readonly focused: Signal<boolean> = computed(
    () => this._focused() || this.isOpen(),
  );

  /** @protected Formatted display value shown in the trigger. */
  protected readonly _displayValue = computed(() => {
    const is12h = this.mode() === '12h';
    const hour = is12h ? this._displayHour() : this._hour();
    const hh = String(hour).padStart(2, '0');
    const mm = String(this._minute()).padStart(2, '0');
    const ss = String(this._second()).padStart(2, '0');
    let base = `${hh}:${mm}`;
    if (this.showSeconds()) base += `:${ss}`;
    if (is12h) base += ` ${this._period()}`;
    return base;
  });

  /** @protected Hour items for the column — depends on mode. */
  protected readonly _hourItems = computed(() =>
    this.mode() === '12h' ? range(1, 13) : range(0, 24),
  );

  /** @protected Minute items for the column (0–59). */
  protected readonly _minuteItems = computed(() => range(0, 60));

  /** @protected Second items for the column (0–59). */
  protected readonly _secondItems = computed(() => range(0, 60));

  /**
   * @protected Clock formatting for the drum columns — a zero-padded two-digit
   * numeral. This is the time picker's format, not the strip's: `mlv-scrubber`
   * renders `String(value)` unless a consumer supplies one (#129). An arrow
   * property, because the strip calls it detached from this instance.
   */
  protected readonly _twoDigits = (value: number): string =>
    String(value).padStart(2, '0');

  /** @protected The hour value shown in the column (1–12 in 12h mode, 0–23 in 24h). */
  protected readonly _displayHour = computed(() => {
    if (this.mode() !== '12h') return this._hour();
    const h = this._hour() % 12;
    return h === 0 ? 12 : h;
  });

  /** @private Reference to the trigger element for focus restoration after popup close. */
  private readonly _triggerRef =
    viewChild<ElementRef<HTMLElement>>('triggerRef');

  /**
   * @private The rendered drum-roll columns (hours, minutes, optional seconds),
   * in DOM order. They are `mlv-scrubber` children declared in this component's
   * own template (inside `mlvPopupContent`), so a signal view query resolves
   * them — even though the popup content renders in a detached overlay. Used
   * for focus-on-open and inter-column Arrow navigation instead of reaching
   * into the overlay DOM by class name.
   */
  private readonly _columns = viewChildren(MlvScrubber);

  /** @private Normalizes horizontal column navigation for RTL layouts. */
  private readonly _rtlService = inject(MlvRtlService);

  /** @private Density directive instance for reading the resolved density level. */
  private readonly _densityDirective = inject(MlvDensityDirective);

  /** @protected Effective density to pass to the detached popup panel. */
  protected readonly _effectiveDensity = computed(() =>
    this._densityDirective.effectiveDensity(),
  );

  constructor() {
    super();
    effect(() => this._applyValue(this.value()));
  }

  /**
   * @protected Toggle the popup open/closed state.
   */
  protected _toggleDropdown(): void {
    if (this.computedDisabled()) return;
    this.isOpen.set(!this.isOpen());
  }

  /**
   * @private Build the time string from internal signals.
   * Always returns 24h format: `HH:mm` or `HH:mm:ss`.
   */
  private _buildValue(): string {
    let hour = this._hour();

    if (this.mode() === '12h') {
      const displayHour = this._displayHour();
      if (this._period() === 'AM') {
        hour = displayHour === 12 ? 0 : displayHour;
      } else {
        hour = displayHour === 12 ? 12 : displayHour + 12;
      }
    }

    const hh = String(hour).padStart(2, '0');
    const mm = String(this._minute()).padStart(2, '0');
    const ss = String(this._second()).padStart(2, '0');

    return this.showSeconds() ? `${hh}:${mm}:${ss}` : `${hh}:${mm}`;
  }

  /**
   * @private Parse a time string (`HH:mm` or `HH:mm:ss`) into internal signals.
   */
  private _parseValue(value: string): void {
    if (!value) return;
    const parts = value.split(':').map(Number);
    const totalHour = parts[0] ?? 0;
    const minute = parts[1] ?? 0;
    const second = parts[2] ?? 0;

    this._minute.set(minute);
    this._second.set(second);

    if (this.mode() === '12h') {
      this._period.set(totalHour >= 12 ? 'PM' : 'AM');
      const h12 = totalHour % 12;
      this._hour.set(h12 === 0 ? 0 : h12); // store 0–11, display as 12 or 1–11
    } else {
      this._hour.set(totalHour);
    }
  }

  /** Whether the control holds a clearable value — The drum always shows a time, so there is always a value. */
  readonly hasValue = computed(() => true);

  /** @private Synchronizes drum columns from an external model value. */
  private _applyValue(value: string): void {
    if (value) {
      this._parseValue(value);
    } else {
      // Default to current time on null/empty
      const now = new Date();
      this._hour.set(now.getHours());
      this._minute.set(now.getMinutes());
      this._second.set(now.getSeconds());
      if (this.mode() === '12h') {
        this._period.set(now.getHours() >= 12 ? 'PM' : 'AM');
      }
    }
  }

  /**
   * @protected Called when the popup opens. Focuses the first column listbox
   * so keyboard navigation is immediately available.
   */
  protected _onPopupOpened(): void {
    this._columns()[0]?.focusList();
  }

  /**
   * @protected Called when the popup closes. Restores focus to the trigger element.
   */
  protected _onPopupClosed(): void {
    this.setFocused(false);
    this._markTouched();
    this._triggerRef()?.nativeElement.focus();
  }

  /** @protected Marks the control touched when the trigger loses focus. */
  protected _onTriggerBlur(): void {
    this.setFocused(false);
    this._markTouched();
  }

  /**
   * @protected Handle hour column value change.
   */
  protected _onHourChange(value: number): void {
    if (this.mode() === '12h') {
      // Store 0-based: 12 → 0, 1 → 1, … 11 → 11
      this._hour.set(value === 12 ? 0 : value);
    } else {
      this._hour.set(value);
    }
    this._emitValue();
  }

  /**
   * @protected Handle minute column value change.
   */
  protected _onMinuteChange(value: number): void {
    this._minute.set(value);
    this._emitValue();
  }

  /**
   * @protected Handle second column value change.
   */
  protected _onSecondChange(value: number): void {
    this._second.set(value);
    this._emitValue();
  }

  /**
   * @protected Toggle the AM/PM period in 12h mode.
   */
  protected _onPeriodChange(period: 'AM' | 'PM'): void {
    this._period.set(period);
    this._emitValue();
  }

  /**
   * @protected Handle ArrowLeft/ArrowRight on the columns container to move
   * focus between column listboxes.
   */
  protected _onPanelKeydown(event: KeyboardEvent): void {
    const key = this._rtlService.normalizeArrowKey(event);
    if (key !== LEFT_ARROW && key !== RIGHT_ARROW) return;

    const columns = this._columns();
    if (!columns.length) return;

    const focusedIdx = columns.findIndex(
      (column) => column.listElement === document.activeElement,
    );
    if (focusedIdx === -1) return;

    event.preventDefault();

    const nextIdx = key === LEFT_ARROW ? focusedIdx - 1 : focusedIdx + 1;
    if (nextIdx < 0 || nextIdx >= columns.length) return;

    columns[nextIdx].focusList();
  }

  /**
   * @private Write the current value to the forms model.
   */
  private _emitValue(): void {
    this.value.set(this._buildValue());
  }
}
