import type { ElementRef } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  inject,
  input,
  model,
  signal,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import {
  MlvPopup,
  MlvPopupContent,
  MlvPopupContainer,
} from '@malva-ui/core/popup';
import {
  MlvCalendar,
  MLV_DATE_ADAPTER,
  MlvNativeDateAdapter,
  type MlvDateAdapter,
} from '@malva-ui/core/calendar';
import { LucideCalendar } from '@lucide/angular';
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
import { MLV_DAY_PICKER_I18N } from '@malva-ui/i18n';

/**
 * Visual/validation state of the day picker. Mirrors {@link MlvFormState}.
 */
export type MlvDayPickerState = MlvFormState;

@Component({
  selector: 'mlv-day-picker',
  imports: [
    MlvPopup,
    MlvPopupContent,
    MlvPopupContainer,
    MlvCalendar,
    LucideCalendar,
    MlvFormControlWrapper,
    MlvFormControlWrapperControl,
    MlvDescription,
    MlvLabel,
    MlvHint,
    MlvMessage,
  ],
  templateUrl: './day-picker.html',
  styleUrl: './day-picker.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: MLV_FORM_CONTROL,
      useExisting: forwardRef(() => MlvDayPicker),
    },
  ],
  host: {
    class: 'mlv-day-picker',
    '[class]': '"mlv-day-picker--" + resolvedState()',
    '[class.mlv-day-picker--disabled]': 'computedDisabled()',
    '[class.mlv-day-picker--open]': 'isOpen()',
  },
})
export class MlvDayPicker<D = Date>
  extends MlvSignalFormControlBase<D | null>
  implements MlvFormControl
{
  /** @private Active date adapter — injected token, falling back to the native adapter. */
  private readonly _dateAdapter =
    (inject(MLV_DATE_ADAPTER, {
      optional: true,
    }) as MlvDateAdapter<D> | null) ??
    (inject(MlvNativeDateAdapter) as unknown as MlvDateAdapter<D>);

  readonly value = model<D | null>(null);
  /** Custom placeholder override. Falls back to the i18n-provided placeholder. */
  readonly placeholder = input<string | undefined>(undefined);
  readonly min = input<D | null, D | null | undefined>(null, {
    transform: (value) => value ?? null,
  });
  readonly max = input<D | null, D | null | undefined>(null, {
    transform: (value) => value ?? null,
  });
  readonly dateFormat = input<string>('yyyy-MM-dd');

  /** @protected The component's i18n strings signal. */
  protected readonly _i18n = inject(MLV_DAY_PICKER_I18N);

  /** @protected Resolved placeholder: explicit input takes precedence over i18n default. */
  protected readonly _resolvedPlaceholder = computed(
    () => this.placeholder() ?? this._i18n().placeholder,
  );

  // Override focused to also be true when the calendar popup is open
  override readonly focused = computed(() => this._focused() || this.isOpen());

  readonly isOpen = signal(false);

  /**
   * The HTML `id` assigned to the visible `<mlv-label>` element. The trigger
   * references it via `aria-labelledby` (a `<label for>` cannot name a `<div>`).
   */
  readonly labelId = computed(() => `${this.id()}-label`);

  /** The HTML `id` of the calendar dialog region, for `aria-controls` linking. */
  readonly popupId = computed(() => `${this.id()}-popup`);

  /** @private Reference to the trigger element for focus restoration on close. */
  private readonly _triggerRef =
    viewChild<ElementRef<HTMLElement>>('triggerRef');

  get displayValue(): string {
    const val = this.value();
    if (!val) return '';
    return this._dateAdapter.format(val, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  toggleDropdown(): void {
    if (this.computedDisabled()) return;
    this.isOpen.set(!this.isOpen());
  }

  onDateSelected(date: D | null): void {
    this.value.set(date);
    this.isOpen.set(false);
  }

  /** @protected Marks the control touched when the trigger loses focus. */
  protected _onTriggerBlur(): void {
    this.setFocused(false);
    this._markTouched();
  }

  /**
   * @protected Called after the calendar popup opens. Moves focus into the
   * calendar dialog so keyboard users land inside the modal surface.
   */
  protected _onPopupOpened(): void {
    const panel = document.getElementById(this.popupId());
    const target = panel?.querySelector<HTMLElement>(
      '[tabindex="0"], button, [tabindex]',
    );
    target?.focus();
  }

  /**
   * @protected Called after the calendar popup closes. Restores focus to the
   * trigger element and clears the focused flag.
   */
  protected _onPopupClosed(): void {
    this.setFocused(false);
    this._markTouched();
    this._triggerRef()?.nativeElement.focus();
  }

  /** Whether the control holds a clearable value — A date is set. */
  readonly hasValue = computed(() => this.value() != null);
}
