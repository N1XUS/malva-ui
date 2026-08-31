import type { ElementRef } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  forwardRef,
  inject,
  input,
  model,
  signal,
  untracked,
  ViewEncapsulation,
  viewChild,
} from '@angular/core';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import type { MlvFormControl } from '@malva-ui/core/form-utils';
import {
  MlvSignalFormControlBase,
  MlvDescription,
  MlvFormControlWrapper,
  MlvFormControlWrapperControl,
  MlvHint,
  MlvLabel,
  MLV_FORM_CONTROL,
  MlvMessage,
} from '@malva-ui/core/form-utils';
import {
  MlvCompactComfortableDensity,
  MLV_DENSITY_ELEMENT,
} from '@malva-ui/cdk/density';
import { DOWN_ARROW, UP_ARROW } from '@angular/cdk/keycodes';
import { MlvRtlService, clamp } from '@malva-ui/cdk/utils';
import { LucideMinus, LucidePlus } from '@lucide/angular';
import { MLV_NUMBER_INPUT_I18N } from '@malva-ui/i18n';

/** Delay before long-press acceleration kicks in (ms). */
const LONG_PRESS_DELAY = 400;
/** Interval between repeated steps during long press (ms). */
const LONG_PRESS_INTERVAL = 150;
/** Time after which long press switches to largeStep cadence (ms). */
const LONG_PRESS_LARGE_STEP_THRESHOLD = 1500;

/** MlvLayout direction for the increment/decrement controls. */
export type MlvNumberInputControlStack = 'horizontal' | 'vertical';

/** Side used for the vertical control stack. */
export type MlvNumberInputControlAlignment = 'left' | 'right';

@Component({
  selector: 'mlv-number-input',
  templateUrl: './number-input.html',
  styleUrl: './number-input.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [
    {
      directive: MlvCompactComfortableDensity,
      inputs: ['mlvDensity'],
    },
  ],
  providers: [
    {
      provide: MLV_DENSITY_ELEMENT,
      useValue: 'number-input',
    },
    {
      provide: MLV_FORM_CONTROL,
      useExisting: forwardRef(() => MlvNumberInput),
    },
  ],
  imports: [
    NgTemplateOutlet,
    MlvLabel,
    MlvHint,
    MlvDescription,
    MlvFormControlWrapper,
    MlvFormControlWrapperControl,
    MlvMessage,
    LucideMinus,
    LucidePlus,
  ],
  host: {
    class: 'mlv-number-input',
    '[class]': '"mlv-number-input--" + resolvedState()',
    '[class.mlv-number-input--disabled]': 'computedDisabled()',
    '[class.mlv-number-input--focused]': 'focused()',
    '[class.mlv-number-input--stack-horizontal]': 'stack() === "horizontal"',
    '[class.mlv-number-input--stack-vertical]': 'stack() === "vertical"',
    '[class.mlv-number-input--control-left]': 'controlAlignment() === "left"',
    '[class.mlv-number-input--control-right]': 'controlAlignment() === "right"',
  },
})
export class MlvNumberInput
  extends MlvSignalFormControlBase<number | null>
  implements MlvFormControl
{
  /** @protected The component's i18n strings signal. */
  protected readonly _i18n = inject(MLV_NUMBER_INPUT_I18N);

  /**
   * Minimum allowed value. Also a signal-forms field binding: a `min` schema
   * rule on the bound field binds this input (`NonNullable<number>|undefined`),
   * so the write type widens to accept `undefined` (normalised to `null`).
   */
  readonly min = input<number | null, number | null | undefined>(null, {
    transform: (value) => value ?? null,
  });

  /**
   * Maximum allowed value. Also a signal-forms field binding: a `max` schema
   * rule on the bound field binds this input (`NonNullable<number>|undefined`),
   * so the write type widens to accept `undefined` (normalised to `null`).
   */
  readonly max = input<number | null, number | null | undefined>(null, {
    transform: (value) => value ?? null,
  });

  /**
   * Step increment for arrow keys and stepper buttons. Default: 1. Write type
   * widened to accept `undefined` (normalised to the `1` default) for
   * signal-forms constraint-binding parity with the other numeric inputs.
   */
  readonly step = input<number, number | null | undefined>(1, {
    transform: (value) => value ?? 1,
  });

  /**
   * Large step for Shift+Arrow keys.
   * Defaults to 10 × step when null.
   */
  readonly largeStep = input<number | null>(null);

  /** Placeholder text shown when the input is empty. */
  readonly placeholder = input<string>('');

  /**
   * Decimal precision for displayed value.
   * When null, precision is inferred from the step value.
   */
  readonly precision = input<number | null>(null);

  /**
   * Whether scroll-wheel stepping is enabled when the input is focused.
   * Default: true.
   */
  readonly scrollable = input<boolean, BooleanInput>(true, {
    transform: coerceBooleanProperty,
  });

  /** MlvLayout direction for the increment/decrement controls. */
  readonly stack = input<MlvNumberInputControlStack>('horizontal');

  /**
   * Side used for the vertical control stack.
   * Has no visual effect while `stack` is `'horizontal'`.
   */
  readonly controlAlignment = input<MlvNumberInputControlAlignment>('right');

  /** @private Reference to the native input element. */
  protected readonly _inputRef =
    viewChild<ElementRef<HTMLInputElement>>('inputRef');

  /**
   * The committed numeric value — the signal-forms `FormValueControl` model
   * (`null` when empty/cleared). Kept in sync with the bound field by
   * `[formField]` / `[formControl]` / `ngModel`. Out-of-range form-side writes
   * are re-clamped into `[min, max]` by the constructor effect (the
   * replacement for the old CVA `writeValue` clamp).
   */
  readonly value = model<number | null>(null);

  /** @private Raw string held while the user is typing. */
  protected readonly _internalStringValue = signal<string>('');

  /** @private Whether the input currently has focus. */
  protected readonly _isFocused = signal(false);

  /** True when the current value equals or is below min. */
  readonly isAtMin = computed(() => {
    const mn = this.min();
    const val = this.value();
    return mn !== null && val !== null && val <= mn;
  });

  /** True when the current value equals or is above max. */
  readonly isAtMax = computed(() => {
    const mx = this.max();
    const val = this.value();
    return mx !== null && val !== null && val >= mx;
  });

  /** Effective large step: largeStep input or 10 × step. */
  readonly effectiveLargeStep = computed(
    () => this.largeStep() ?? this.step() * 10,
  );

  /**
   * Effective decimal precision.
   * Uses the precision input if set; otherwise infers from the step string.
   */
  readonly effectivePrecision = computed<number>(() => {
    const precision = this.precision();
    if (precision !== null) return precision;
    const s = this.step().toString();
    const dot = s.indexOf('.');
    return dot === -1 ? 0 : s.length - dot - 1;
  });

  /** @private DestroyRef used for long-press timer cleanup. */
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _rtlService = inject(MlvRtlService);

  /** @private Long-press delay timer handle. */
  private _longPressDelayTimer: ReturnType<typeof setTimeout> | null = null;
  /** @private Long-press repeat interval handle. */
  private _longPressIntervalTimer: ReturnType<typeof setInterval> | null = null;
  /** @private Timestamp when long-press started (for large-step threshold). */
  private _longPressStartTime = 0;

  constructor() {
    super();
    // Clamp form-side (model) writes into [min, max] and mirror the committed
    // value into the display string — the signal-forms replacement for the old
    // CVA `writeValue` clamp. min/max are read untracked so the effect fires
    // only on a `value` write (exactly like `writeValue` ran only on a form
    // write); the out-of-range set-back re-triggers the effect once and then
    // converges (next run: clamped === value → no further write, no loop).
    effect(() => {
      const next = this.value();
      untracked(() => {
        if (next === null || next === undefined) {
          this._internalStringValue.set('');
          return;
        }
        const clamped = this._clamp(next);
        if (clamped !== next) {
          this.value.set(clamped);
          return;
        }
        this._internalStringValue.set(this._format(next));
      });
    });
    this._destroyRef.onDestroy(() => this._clearLongPress());
  }

  // ---------------------------------------------------------------------------
  // Value / clear
  // ---------------------------------------------------------------------------

  /**
   * Clears the current value. Called by the MlvFormControlWrapper clear button.
   */
  clearValue(): void {
    this.value.set(null);
    this._internalStringValue.set('');
  }

  /** Whether the control holds a clearable value — A numeric value is set. */
  readonly hasValue = computed(() => this.value() !== null);

  // ---------------------------------------------------------------------------
  // Input event handlers
  // ---------------------------------------------------------------------------

  /**
   * @protected Handles native input events — stores raw string while typing.
   */
  protected _onNativeInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    this._internalStringValue.set(raw);
  }

  /**
   * @protected Commits typed value on blur: parse, clamp, round, emit, then
   * reports {@link MlvSignalFormUiControlBase.touch} (replaces CVA `onTouched`).
   */
  protected _onBlur(): void {
    this._isFocused.set(false);
    this.setFocused(false);
    this._commitTypedValue();
    this._markTouched();
  }

  /**
   * @protected Commits on Enter key press.
   */
  protected _onEnter(): void {
    this._commitTypedValue();
  }

  /**
   * @protected Handles keyboard navigation on the native input.
   */
  protected _onKeydown(event: KeyboardEvent): void {
    if (this.computedDisabled()) return;

    switch (this._rtlService.normalizeArrowKey(event) ?? event.key) {
      case UP_ARROW:
        event.preventDefault();
        this._step(event.shiftKey ? this.effectiveLargeStep() : this.step());
        break;
      case DOWN_ARROW:
        event.preventDefault();
        this._step(event.shiftKey ? -this.effectiveLargeStep() : -this.step());
        break;
      case 'Home':
        event.preventDefault();
        {
          const min = this.min();
          if (min !== null) this._setValue(min);
        }
        break;
      case 'End':
        event.preventDefault();
        {
          const max = this.max();
          if (max !== null) this._setValue(max);
        }
        break;
    }
  }

  /**
   * @protected Handles scroll-wheel input when scrollable and focused.
   * The wheel listener is attached via fromEvent with { passive: false } so
   * preventDefault() actually suppresses page scroll.
   */
  protected _onWheel(event: WheelEvent): void {
    if (!this.scrollable() || !this._isFocused() || this.computedDisabled()) {
      return;
    }
    event.preventDefault();
    this._step(event.deltaY > 0 ? -this.step() : this.step());
  }

  // ---------------------------------------------------------------------------
  // Stepper button long-press
  // ---------------------------------------------------------------------------

  /**
   * @protected Starts a long-press sequence for increment (positive delta) or decrement.
   */
  protected _onStepperPointerDown(delta: 1 | -1): void {
    if (this.computedDisabled()) return;
    this._longPressStartTime = Date.now();
    const step = delta > 0 ? this.step() : -this.step();
    this._step(step);
    this._clearLongPress();

    this._longPressDelayTimer = setTimeout(() => {
      this._longPressIntervalTimer = setInterval(() => {
        const elapsed = Date.now() - this._longPressStartTime;
        const useStep =
          elapsed >= LONG_PRESS_LARGE_STEP_THRESHOLD
            ? delta > 0
              ? this.effectiveLargeStep()
              : -this.effectiveLargeStep()
            : step;
        this._step(useStep);
      }, LONG_PRESS_INTERVAL);
    }, LONG_PRESS_DELAY);

    this._refocusInput();
  }

  /**
   * @protected Cancels long-press on pointer release.
   */
  protected _onStepperPointerUp(): void {
    this._clearLongPress();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * @private Parses the typed string, clamps, rounds, and commits to `value`.
   */
  private _commitTypedValue(): void {
    const raw = this._internalStringValue().trim();
    if (raw === '') {
      if (this.clearable()) {
        this.value.set(null);
        this._internalStringValue.set('');
      } else {
        const last = this.value();
        this._internalStringValue.set(last !== null ? this._format(last) : '');
      }
      return;
    }
    const parsed = parseFloat(raw);
    if (isNaN(parsed)) {
      const last = this.value();
      this._internalStringValue.set(last !== null ? this._format(last) : '');
      return;
    }
    this._setValue(parsed);
  }

  /**
   * @private Applies a numeric delta to the current value, clamping the result.
   */
  private _step(delta: number): void {
    const current = this.value() ?? 0;
    this._setValue(current + delta);
  }

  /**
   * @private Sets the numeric value: clamp → round → commit to the `value`
   * model (which propagates to the bound field).
   */
  private _setValue(raw: number): void {
    const clamped = this._clamp(raw);
    const rounded = this._round(clamped);
    this._internalStringValue.set(this._format(rounded));
    this.value.set(rounded);
  }

  /**
   * @private Clamps a value to [min, max].
   */
  private _clamp(value: number): number {
    return clamp(value, this.min() ?? -Infinity, this.max() ?? Infinity);
  }

  /**
   * @private Rounds a value to the effective precision.
   */
  private _round(value: number): number {
    const p = this.effectivePrecision();
    return parseFloat(value.toFixed(p));
  }

  /**
   * @private Formats a number to the effective precision string.
   */
  private _format(value: number): string {
    return value.toFixed(this.effectivePrecision());
  }

  /**
   * @private Clears long-press timers.
   */
  private _clearLongPress(): void {
    if (this._longPressDelayTimer !== null) {
      clearTimeout(this._longPressDelayTimer);
      this._longPressDelayTimer = null;
    }
    if (this._longPressIntervalTimer !== null) {
      clearInterval(this._longPressIntervalTimer);
      this._longPressIntervalTimer = null;
    }
  }

  /**
   * @private Focuses the native input after a stepper button click.
   */
  private _refocusInput(): void {
    this._inputRef()?.nativeElement.focus();
  }
}
