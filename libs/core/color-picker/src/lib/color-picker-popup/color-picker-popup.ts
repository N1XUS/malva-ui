import type { Signal } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DOCUMENT,
  ElementRef,
  effect,
  forwardRef,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
  ViewEncapsulation,
  viewChild,
} from '@angular/core';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
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
import type { MlvFormControlLabelStrategy } from '@malva-ui/core/form-utils';
import { MlvButton, MlvButtonIcon } from '@malva-ui/core/button';
import { MlvTooltip } from '@malva-ui/core/tooltip';
import {
  MlvPopup,
  MlvPopupContainer,
  MlvPopupContent,
} from '@malva-ui/core/popup';
import { MlvTabbableElementService } from '@malva-ui/cdk/accessibility';
import { mlvNextId } from '@malva-ui/cdk/utils';
import {
  MLV_COLOR_PICKER_I18N,
  MLV_FORM_UTILS_I18N,
  MlvI18nResolverService,
} from '@malva-ui/i18n';
import { MlvColorPicker } from '../color-picker/color-picker';
import type { MlvColorInputMode } from '../color-utils/color-utils';
import { isCssColorValue, tryParseCssColor } from '../color-utils/color-utils';

/**
 * Input-like CSS color control that opens the full `mlv-color-picker` in a
 * connected popup with a light-dismiss backdrop.
 *
 * The editable draft stays separate from the committed forms value. Valid
 * concrete colors and `var(--custom-property)` references commit on blur or
 * popup close by default; `live` publishes every valid draft immediately.
 * Invalid drafts roll back to the most recent valid draft.
 */
@Component({
  selector: 'mlv-color-picker-popup',
  templateUrl: './color-picker-popup.html',
  styleUrl: './color-picker-popup.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MlvColorPicker,
    MlvButton,
    MlvTooltip,
    MlvFormControlWrapper,
    MlvFormControlWrapperControl,
    MlvHint,
    MlvDescription,
    MlvLabel,
    MlvMessage,
    MlvPopup,
    MlvPopupContainer,
    MlvPopupContent,
    MlvButtonIcon,
  ],
  providers: [
    {
      provide: MLV_FORM_CONTROL,
      useExisting: forwardRef(() => MlvColorPickerPopup),
    },
  ],
  host: {
    class: 'mlv-color-picker-popup',
    '[class]': '"mlv-color-picker-popup--state-" + resolvedState()',
    '[class.mlv-color-picker-popup--disabled]': 'computedDisabled()',
    '[class.mlv-color-picker-popup--readonly]': 'readonly()',
    '[class.mlv-color-picker-popup--open]': 'opened()',
    '[class.mlv-color-picker-popup--swatch]': 'presentation() !== "field"',
  },
})
export class MlvColorPickerPopup extends MlvSignalFormControlBase<string> {
  /**
   * @protected In field presentation {@link id} lands on the native text
   * `<input>`, which is labelable. The swatch and icon presentations render a
   * button trigger that carries no `id`, so nothing outside can be pointed at
   * and the control names itself from {@link ariaLabel} instead.
   */
  protected override _externalLabelStrategy(): MlvFormControlLabelStrategy {
    return this.presentation() === 'field' ? 'native' : 'none';
  }

  /** The committed CSS color string used by all Angular forms APIs. */
  readonly value = model<string>('#ff0000');

  /** Visual trigger presentation. Field mode preserves the input-like control. */
  readonly presentation = input<'field' | 'swatch' | 'icon'>('field');

  /** Two-way bindable connected-overlay state. */
  readonly opened = model(false);

  /** Emits after the detached picker panel has opened. */
  readonly afterOpened = output<void>();

  /** Emits after the detached picker panel has closed and torn down. */
  readonly afterClosed = output<void>();

  /** Whether to show the opacity slider inside the picker. */
  readonly showOpacity = input<boolean, BooleanInput>(true, {
    transform: coerceBooleanProperty,
  });

  /** The default input mode for the picker's text tabs. */
  readonly defaultMode = input<MlvColorInputMode>('hex');

  /** Available picker formats, in display order. */
  readonly supportedFormats = input<readonly MlvColorInputMode[]>([
    'hex',
    'rgb',
    'hsl',
  ]);

  /** Whether every valid draft is published immediately. */
  readonly live = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /** Emits when user interaction commits a new CSS color string. */
  readonly colorChange = output<string>();

  /** Whether the committed value is non-empty and can be cleared. */
  readonly hasValue = computed(() => this.value().length > 0);

  /**
   * `true` while readonly, which suppresses the wrapper-owned clear button.
   *
   * Redundant since #301: the wrapper itself withholds its clear button while
   * the control is readonly **or disabled** (this workaround covered readonly
   * only, so a disabled picker kept a focusable X that did nothing). Kept
   * because it is a public member of an exported class; its value is
   * unchanged. The picker draws no clear button of its own in `field`
   * presentation.
   */
  readonly ownsClearButton = computed(() => this.readonly());

  /** @protected Injected i18n translations for the color picker. */
  protected readonly _i18n = inject(MLV_COLOR_PICKER_I18N);

  /** @protected Localized copy used by the swatch-mode clear action. */
  protected readonly _formI18n = inject(MLV_FORM_UTILS_I18N);

  /** @private Resolver for ICU parameterized i18n strings. */
  private readonly _resolver = inject(MlvI18nResolverService);

  /** @protected Whether the connected popup is open. */
  /** Keep the wrapper focus treatment active while its popup is visible. */
  override readonly focused = computed(() => this._focused() || this.opened());

  /** @protected Editable text that has not necessarily been committed. */
  protected readonly _draftValue = signal(this.value());

  /** @private Most recent valid draft used for invalid-input rollback. */
  private readonly _lastValidDraft = signal(this.value());

  /** @protected Concrete color used to initialize the visual picker. */
  protected readonly _pickerValue = signal('#ff0000');

  /** @protected Stable id linked from the input's `aria-controls`. */
  protected readonly _panelId = mlvNextId('mlv-color-picker-popup-panel');

  /** @protected Stable id used by the input's `aria-describedby`. */

  /**
   * @protected Resolved accessible name for the swatch button, e.g.
   * "Pick color: #ff0000".
   */
  protected readonly _pickColorLabel = computed(() =>
    this._resolver.resolve(
      this._i18n() as unknown as Record<string, string>,
      'pickColor',
      { color: this._draftValue() },
    ),
  );

  /** @private Native input used for synchronous rollback of invalid drafts. */
  private readonly _inputRef =
    viewChild<ElementRef<HTMLInputElement>>('nativeInput');

  /** @private Rounded color square used for computed CSS-variable resolution. */
  private readonly _fieldSwatchColorRef =
    viewChild<ElementRef<HTMLElement>>('fieldSwatchColor');

  /** @private Swatch-only presentation color layer. */
  private readonly _swatchTriggerColorRef =
    viewChild<ElementRef<HTMLElement>>('swatchTriggerColor');

  /** @private Field-mode swatch button used for keyboard focus restoration. */
  private readonly _fieldSwatchButtonRef = viewChild('fieldSwatchButton', {
    read: ElementRef,
  }) as Signal<ElementRef<HTMLButtonElement> | undefined>;

  /** @private Swatch-mode Malva trigger used by detached composition. */
  private readonly _swatchTriggerRef = viewChild('swatchTrigger', {
    read: ElementRef,
  }) as Signal<ElementRef<HTMLButtonElement> | undefined>;

  /** @private Field-mode detached picker surface. */
  private readonly _fieldPanelRef =
    viewChild<ElementRef<HTMLElement>>('fieldPickerPanel');

  /** @private Swatch-mode detached picker surface. */
  private readonly _swatchPanelRef =
    viewChild<ElementRef<HTMLElement>>('swatchPickerPanel');

  /** Public trigger element for toolbar/composite registration. */
  readonly triggerElement: Signal<HTMLElement | null> = computed(
    () =>
      (this.presentation() !== 'field'
        ? this._swatchTriggerRef()
        : this._fieldSwatchButtonRef()
      )?.nativeElement ?? null,
  );

  /** Public detached panel element for overlay ownership registration. */
  readonly panelElement: Signal<HTMLElement | null> = computed(
    () =>
      (this.presentation() !== 'field'
        ? this._swatchPanelRef()
        : this._fieldPanelRef()
      )?.nativeElement ?? null,
  );

  /** @private Locates the first tabbable picker control for keyboard opening. */
  private readonly _tabbable = inject(MlvTabbableElementService);

  /**
   * @private The document the panel renders into — the injected `DOCUMENT`,
   * never the ambient global, which is a different object under server
   * rendering and in an isolated document.
   */
  private readonly _document = inject(DOCUMENT);

  /** @private Whether the next completed close should restore swatch focus. */
  private _restoreSwatchFocus = false;

  /** @private Whether `afterOpened` should transfer focus into the picker. */
  private _focusPickerAfterOpen = false;

  /** @private Whether the shared overlay is attached or playing its leave animation. */
  private _popupAttached = false;

  /** @private Previous open state used to detect every close request once. */
  private _wasOpen = false;

  /** @private Reopens after a click/focus that occurs during the leave animation. */
  private _reopenAfterClose = false;

  constructor() {
    super();

    // External form/model writes replace all local draft state.
    effect(() => {
      const committed = this.value();
      this._draftValue.set(committed);
      this._lastValidDraft.set(committed);
      if (untracked(() => this.opened())) {
        const swatch = this._swatchColorElement();
        if (swatch) {
          swatch.style.backgroundColor = committed || 'transparent';
        }
        this._syncPickerValue(committed);
      }
    });

    // State changes can make an already-open picker inert. Close it
    // immediately and discard any uncommitted draft in that case.
    effect(() => {
      if (!this._isInert() || !this.opened()) return;
      this._restoreCommittedValue();
      this._focusPickerAfterOpen = false;
      this._restoreSwatchFocus = false;
      this.opened.set(false);
    });

    // Commit at close intent rather than after the leave animation. This covers
    // backdrop, Escape, programmatic, and reduced-motion close paths uniformly.
    effect(() => {
      const isOpen = this.opened();
      const inert = this._isInert();
      if (this._wasOpen && !isOpen && !inert) {
        untracked(() => this._commitDraft());
      }
      this._wasOpen = isOpen;
    });
  }

  /** @protected Stores text input without publishing a partial forms value. */
  protected _onInput(event: Event): void {
    if (this._isInert()) return;
    const draft = (event.target as HTMLInputElement).value;
    this._setDraftValue(draft);
    if (draft === '' || isCssColorValue(draft)) {
      this._lastValidDraft.set(draft);
      if (this.live()) this._commitValue(draft);
    }
  }

  /** @protected Opens the popup when the editable field receives focus. */
  protected _onInputFocus(): void {
    this.setFocused(true);
    if (this._isInert()) return;
    this._restoreSwatchFocus = false;
    this._open(false);
  }

  /**
   * @protected Reopens after Escape when the input retained focus (and thus
   * cannot emit another native focus event).
   */
  protected _onInputClick(): void {
    if (this._isInert()) return;
    this._restoreSwatchFocus = false;
    this._open(false);
  }

  /** @protected Commits or rolls back the draft when focus leaves the input. */
  protected _onInputBlur(): void {
    this.setFocused(false);
    if (this._isInert()) return;
    this._commitDraft();
    this._markTouched();
  }

  /** @protected Closes the popup from the input on Escape. */
  protected _onInputKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this._restoreSwatchFocus = false;
      this.opened.set(false);
      this._markTouched();
    }
  }

  /**
   * @protected Opens from the rounded square. Keyboard activation opts into
   * focus transfer; pointer activation leaves focus on the trigger.
   */
  protected _openFromSwatch(focusPicker = false): void {
    if (this._isInert()) return;
    if (this.presentation() !== 'field') this._restoreSwatchFocus = true;
    if (focusPicker) {
      this._focusPickerAfterOpen = true;
      this._restoreSwatchFocus = true;
    }
    this._open(focusPicker);
  }

  /** @private Opens the connected popup and refreshes the picker's color. */
  private _open(focusPicker: boolean): void {
    if (this._isInert()) return;
    this._syncPickerValue(this._draftValue());

    // PopupContainer keeps the overlay attached while its leave animation
    // runs. Queue a fresh attach instead of toggling the model back to true:
    // the closing handle would otherwise finish and overwrite it with false.
    if (!this.opened() && this._popupAttached) {
      this._reopenAfterClose = true;
      return;
    }

    if (this.opened()) {
      if (focusPicker) queueMicrotask(() => this._focusPicker());
      return;
    }

    this.opened.set(true);
  }

  /** @protected Performs post-attach focus work requested by keyboard opening. */
  protected _onPopupOpened(): void {
    this._popupAttached = true;
    this.afterOpened.emit();
    if (!this._focusPickerAfterOpen) return;
    this._focusPickerAfterOpen = false;
    queueMicrotask(() => this._focusPicker());
  }

  /** @protected Restores swatch focus only for keyboard/panel close flows. */
  protected _onPopupClosed(): void {
    this._popupAttached = false;
    if (this._reopenAfterClose) {
      this._reopenAfterClose = false;
      this._open(this._focusPickerAfterOpen);
      return;
    }

    if (this._restoreSwatchFocus) {
      this._restoreSwatchFocus = false;
      this.triggerElement()?.focus();
    }
    this.afterClosed.emit();
  }

  /** @protected Closes from the panel and commits the current draft. */
  protected _onPanelEscape(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this._restoreSwatchFocus = true;
    this.opened.set(false);
    this._markTouched();
  }

  /** @protected Clears the committed forms value through the shared X button. */
  protected _clearValue(): void {
    if (this._isInert()) return;
    this._lastValidDraft.set('');
    this._commitValue('');
  }

  /** @protected Updates the picker draft and optionally publishes it live. */
  protected _onColorChange(cssColor: string): void {
    if (this._isInert()) return;
    this._lastValidDraft.set(cssColor);
    this._setDraftValue(cssColor);
    if (this.live()) this._commitValue(cssColor);
  }

  /** @private Commits valid/empty input or the most recent valid draft. */
  private _commitDraft(): void {
    const draft = this._draftValue().trim();
    if (draft === '' || isCssColorValue(draft)) {
      this._lastValidDraft.set(draft);
      this._commitValue(draft);
      return;
    }

    const lastValid = this._lastValidDraft();
    this._setDraftValue(lastValid);
    const input = this._inputRef()?.nativeElement;
    if (input) input.value = lastValid;
    this._commitValue(lastValid);
  }

  /**
   * @private Restores local state from the committed value without publishing.
   */
  private _restoreCommittedValue(): void {
    const committed = this.value();
    this._lastValidDraft.set(committed);
    this._setDraftValue(committed);
    const input = this._inputRef()?.nativeElement;
    if (input) input.value = committed;
  }

  /** @private Synchronizes all visual draft consumers without committing. */
  private _setDraftValue(value: string): void {
    this._draftValue.set(value);
    const swatch = this._swatchColorElement();
    if (swatch) swatch.style.backgroundColor = value || 'transparent';
    this._syncPickerValue(value);
  }

  /** @private Publishes one committed user change across forms and output. */
  private _commitValue(value: string): void {
    this._setDraftValue(value);
    this._lastValidDraft.set(value);
    if (value === this.value()) return;
    this.value.set(value);
    this.colorChange.emit(value);
  }

  /**
   * @private Initializes the visual picker without replacing the committed
   * source string. Concrete formats pass through. CSS variables are resolved
   * from the swatch's computed background in the trigger's cascade.
   */
  private _syncPickerValue(source = this._draftValue()): void {
    if (tryParseCssColor(source)) {
      this._pickerValue.set(source);
      return;
    }

    const swatch = this._swatchColorElement();
    // Reached from the value `effect()` while open, so it can run during
    // server change detection, where Node has no global `getComputedStyle`.
    const resolved = swatch
      ? (this._document.defaultView?.getComputedStyle(swatch).backgroundColor ??
        '')
      : '';
    this._pickerValue.set(tryParseCssColor(resolved) ? resolved : '#ff0000');
  }

  /** @private Moves focus into the picker after a keyboard swatch activation. */
  private _focusPicker(): void {
    const panel = this._document.getElementById(this._panelId);
    if (!panel) return;
    const first = this._tabbable.getTabbableElement(panel, false, true);
    (first ?? panel).focus();
  }

  /** @private Current presentation's rendered colour layer. */
  private _swatchColorElement(): HTMLElement | undefined {
    const ref =
      this.presentation() === 'swatch'
        ? this._swatchTriggerColorRef()
        : this.presentation() === 'field'
          ? this._fieldSwatchColorRef()
          : undefined;
    return ref?.nativeElement;
  }

  /** @private Whether disabled/readonly state blocks all user mutation. */
  private _isInert(): boolean {
    return this.computedDisabled() || this.readonly();
  }
}
