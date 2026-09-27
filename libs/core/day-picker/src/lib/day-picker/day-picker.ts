import type { ElementRef } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  computed,
  effect,
  forwardRef,
  inject,
  input,
  model,
  signal,
  untracked,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import {
  MlvPopup,
  MlvPopupContent,
  MlvPopupContainer,
  MlvPopupHeaderActions,
} from '@malva-ui/core/popup';
import { MlvCalendar, MlvCalendarSheet } from '@malva-ui/core/calendar';
import {
  MLV_DATE_ADAPTER,
  MlvNativeDateAdapter,
  type MlvDateAdapter,
} from '@malva-ui/core/date';
import { MlvButton } from '@malva-ui/core/button';
import { LucideCalendar } from '@lucide/angular';
import type {
  MlvFormState,
  MlvFormControl,
  MlvFormControlLabelStrategy,
} from '@malva-ui/core/form-utils';
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
import { MLV_CALENDAR_I18N, MLV_DAY_PICKER_I18N } from '@malva-ui/i18n';

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
    MlvPopupHeaderActions,
    MlvCalendar,
    MlvCalendarSheet,
    MlvButton,
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
  /**
   * @protected {@link id} sits on the trigger `div[role="combobox"]`, which
   * `<label for>` cannot name, so a projected `<mlv-label>` reaches it through
   * `aria-labelledby`.
   */
  protected override _externalLabelStrategy(): MlvFormControlLabelStrategy {
    return 'aria';
  }

  /**
   * @private The document the popup renders into — the injected `DOCUMENT`,
   * never the ambient global, which is a different object under server
   * rendering and in an isolated document.
   */
  private readonly _document = inject(DOCUMENT);

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

  /**
   * @protected The calendar i18n slice, for the sheet's confirm label. The
   * string belongs to the calendar sheet, which both pickers share, so it is
   * defined once there rather than duplicated per picker.
   */
  protected readonly _calendarI18n = inject(MLV_CALENDAR_I18N);

  /**
   * @protected The selection the full-screen sheet is assembling.
   *
   * The anchored dropdown commits on tap and is unchanged. The sheet does not:
   * it has an explicit confirm, so a tap only moves this pending value and
   * `Done` is the single path to the committed {@link value}. Seeded from the
   * committed value on every open, and dropped on close.
   */
  protected readonly _pendingValue = signal<D | null>(null);

  constructor() {
    super();

    // Keyed on the open flag rather than on the trigger, because `isOpen` is a
    // public signal a consumer can set directly — seeding only inside
    // `toggleDropdown()` would leave such an open showing no selection, and
    // `Done` would then commit that empty pending value over the committed
    // date. The committed value is read untracked so a form patch arriving
    // while the sheet is open does not overwrite what the user has tapped.
    effect(() => {
      this.isOpen();
      untracked(() => this._pendingValue.set(this.value()));
    });
  }

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

  /**
   * @protected Commits the sheet's pending selection and closes.
   *
   * Only the full-screen sheet reaches this — `Done` is projected into the
   * popup's header, which the popup stamps only while it is full-screen.
   */
  protected _applyPending(): void {
    this.value.set(this._pendingValue());
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
    const panel = this._document.getElementById(this.popupId());
    // The sheet's roving day tab stop is the meaningful landing spot; without
    // this the generic scan would stop on the year strip's listbox instead.
    const target =
      panel?.querySelector<HTMLElement>(
        '.mlv-calendar-sheet__day[tabindex="0"]',
      ) ??
      panel?.querySelector<HTMLElement>('[tabindex="0"], button, [tabindex]');
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

  /** Whether the control holds a clearable value — A date is set. */
  readonly hasValue = computed(() => this.value() != null);

  /**
   * @protected The wrapper's clear-button handler: clears the date through
   * `_write` and marks the field touched only when the write landed.
   *
   * Before #301 nothing was bound to the wrapper's `(clear)`, so a
   * `clearable` day picker rendered an X that did nothing. The wrapper
   * withholds the X while the picker is readonly or disabled; `_write`
   * refuses independently, for a click that reaches a stale button.
   */
  protected _onClear(): void {
    if (this._write(null)) this._markTouched();
  }
}
