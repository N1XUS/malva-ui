import type { ElementRef } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  contentChild,
  forwardRef,
  input,
  model,
  output,
  viewChild,
  ViewEncapsulation,
  computed,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import type {
  MlvFormState,
  MlvFormControl,
  MlvFormControlLabelStrategy,
} from '@malva-ui/core/form-utils';
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
import { MlvInputNative } from './input-native';
import { MLV_INPUT_VALUE } from './input-value-accessor';

export type MlvInputType =
  | 'text'
  | 'password'
  | 'email'
  | 'number'
  | 'tel'
  | 'search'
  | 'url';
/**
 * Visual/validation state of the input. Mirrors {@link MlvFormState}.
 */
export type MlvInputState = MlvFormState;
export type MlvInputInputMode =
  | 'none'
  | 'text'
  | 'decimal'
  | 'numeric'
  | 'tel'
  | 'search'
  | 'email'
  | 'url';

@Component({
  selector: 'mlv-input',
  imports: [
    NgTemplateOutlet,
    MlvLabel,
    MlvHint,
    MlvDescription,
    MlvFormControlWrapper,
    MlvFormControlWrapperControl,
    MlvMessage,
  ],
  templateUrl: './input.html',
  styleUrl: './input.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: MLV_FORM_CONTROL,
      useExisting: forwardRef(() => MlvInput),
    },
    {
      provide: MLV_INPUT_VALUE,
      useExisting: forwardRef(() => MlvInput),
    },
  ],
  host: {
    class: 'mlv-input',
    '[class.mlv-input--default]': 'resolvedState() === "default"',
    '[class.mlv-input--success]': 'resolvedState() === "success"',
    '[class.mlv-input--info]': 'resolvedState() === "info"',
    '[class.mlv-input--warning]': 'resolvedState() === "warning"',
    '[class.mlv-input--error]': 'resolvedState() === "error"',
    '[class.mlv-input--disabled]': 'disabled()',
    '[class.mlv-input--focused]': 'focused()',
  },
})
export class MlvInput
  extends MlvSignalFormControlBase<string>
  implements MlvFormControl
{
  /**
   * @protected {@link id} lands on this component's own native `<input>`,
   * which is labelable — so an `<mlv-label>` projected beside `mlv-input` into
   * `mlv-form-field` names it with a plain `for`. The exception is
   * {@link projectControl}: the native input is then the consumer's own and
   * carries whatever `id` they gave it, so the field must not point at ours.
   */
  protected override _externalLabelStrategy(): MlvFormControlLabelStrategy {
    return this.projectControl() ? 'none' : 'native';
  }

  readonly type = input<MlvInputType>('text');
  readonly placeholder = input('');

  /**
   * Native HTML `autocomplete` hint forwarded to the underlying `<input>`.
   * When empty, no `autocomplete` attribute is rendered.
   * @default ''
   */
  readonly autocomplete = input<string>('');

  /**
   * Native HTML `inputmode` attribute forwarded to the underlying `<input>`.
   * Controls the virtual keyboard on mobile devices.
   * @default null
   */
  readonly inputMode = input<MlvInputInputMode | null>(null);

  /**
   * Maximum number of characters the user may enter. Forwarded to the
   * underlying `<input>` `maxlength` attribute. `null` removes the cap.
   */
  readonly maxLength = input<number | null, number | null | undefined>(null, {
    transform: (value) => value ?? null,
  });

  /**
   * Minimum number of characters the user must enter for the form control
   * to validate. Forwarded to the underlying `<input>` `minlength` attribute.
   */
  readonly minLength = input<number | null, number | null | undefined>(null, {
    transform: (value) => value ?? null,
  });

  /**
   * Native HTML5 validation pattern (regular-expression source) forwarded
   * to the underlying `<input>` `pattern` attribute.
   */
  readonly pattern = input<
    string | null,
    string | RegExp | readonly RegExp[] | null | undefined
  >(null, {
    // Signal forms' `pattern` rule binds `readonly RegExp[]`; the native
    // attribute wants one regex source. Normalise: single source pass-through,
    // multiple sources OR-combined.
    transform: (value) => {
      if (value == null) return null;
      if (typeof value === 'string') return value;
      if (value instanceof RegExp) return value.source;
      if (value.length === 0) return null;
      return value.length === 1
        ? value[0].source
        : value.map((r) => `(?:${r.source})`).join('|');
    },
  });

  /**
   * Native HTML `name` attribute. Required for non-Angular form submission;
   * Reactive Forms / template-driven forms do not need this.
   */
  readonly name = input<string | null, string | null | undefined>(null, {
    transform: (value) => value ?? null,
  });

  /**
   * When `true`, the underlying `<input>` is focused as soon as it mounts.
   * Use sparingly — autofocus is generally an a11y anti-pattern outside of
   * dialogs and confirmation flows.
   */
  readonly autofocus = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * Numeric `min` attribute forwarded to the underlying `<input>`.
   * Only meaningful when `type` is `'number'`.
   */
  readonly min = input<
    number | string | null,
    number | string | null | undefined
  >(null, { transform: (value) => value ?? null });

  /**
   * Numeric `max` attribute forwarded to the underlying `<input>`.
   * Only meaningful when `type` is `'number'`.
   */
  readonly max = input<
    number | string | null,
    number | string | null | undefined
  >(null, { transform: (value) => value ?? null });

  /**
   * Numeric `step` attribute forwarded to the underlying `<input>`.
   * Only meaningful when `type` is `'number'`. `null` falls back to the
   * browser default of `1`.
   */
  readonly step = input<number | null, number | null | undefined>(null, {
    transform: (value) => value ?? null,
  });

  /**
   * When `true`, renders only the bare `<input>` element with no
   * `mlv-form-control-wrapper` chrome (no label, no message, no
   * prefix/suffix slots). Used by composite controls (combobox,
   * tokenizer, command-palette, color-picker) that own their own
   * surrounding container.
   */
  readonly bare = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * When `true`, `mlv-input` does not render its own internal `<input>` and
   * instead adopts a consumer-projected `<input mlvInputNative>` as the control
   * element. Opt in when an external attribute directive must sit directly on
   * the native input — e.g. `@angular/aria`'s combobox trigger, which requires
   * `[ngCombobox]` on the `<input>` itself. In this mode the projected input
   * owns its own value/keyboard wiring; `mlv-input` provides the surrounding
   * chrome, styling hook (`mlv-input__native`), and focus/select forwarding.
   *
   * Honoured unconditionally: the internal `<input>` is not rendered whether or
   * not a matching `<input mlvInputNative>` is actually projected, so setting
   * this without projecting one renders no control at all (an empty
   * `.mlv-form-control-wrapper__control-row` in the wrapped shape, nothing in
   * `bare`), and `focus()` / `select()` / `nativeElement` become no-ops. Project
   * the input, or leave `projectControl` unset.
   */
  readonly projectControl = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * Optional explicit `role` attribute forwarded to the underlying
   * `<input>`. Use for combobox-style consumers — leave `null` for
   * a vanilla text field.
   */
  readonly role = input<string | null>(null);

  /**
   * Forwarded to `aria-expanded`. Use with `role="combobox"` to
   * communicate dropdown state.
   */
  readonly ariaExpanded = input<boolean | string | null>(null);

  /**
   * Forwarded to `aria-haspopup` (typically `'listbox'`).
   */
  readonly ariaHasPopup = input<string | null>(null);

  /**
   * Forwarded to `aria-autocomplete` (typically `'list'`). Use with
   * `role="combobox"` to describe the autocomplete behaviour of the field.
   */
  readonly ariaAutocomplete = input<string | null>(null);

  /**
   * Forwarded to `aria-controls` — the id of the listbox / popup the
   * input drives.
   */
  readonly ariaControls = input<string | null>(null);

  /**
   * Forwarded to `aria-activedescendant` — the id of the currently
   * highlighted option in the listbox.
   */
  readonly ariaActiveDescendant = input<string | null>(null);

  /**
   * Explicit `aria-describedby` for the underlying `<input>`, overriding the
   * ids the control derives from its own `description` / `message`. Composite
   * controls (`mlv-pin-input`, `mlv-tokenizer`, `mlv-combobox`) that render the
   * description and message themselves point the inner input here.
   */
  readonly ariaDescribedBy = input<string | null>(null);

  /**
   * The input's text value — the signal-forms `FormValueControl` model.
   * Two-way bindable (`[(value)]`), one-way bindable by composite controls
   * (`[value]="searchQuery()"`), and kept in sync with the bound field by
   * `[formField]` / `[formControl]` / `ngModel`.
   */
  readonly value = model<string>('');

  /**
   * Emitted when the underlying native `<input>` gains focus. Re-emitted from
   * the input's own `focus` handler so composite controls (e.g. `mlv-combobox`)
   * can react to focus without relying on the non-bubbling native `focus`
   * event reaching the `mlv-input` host. Carries the original `FocusEvent`.
   */
  readonly inputFocus = output<FocusEvent>();

  /**
   * Emitted when the underlying native `<input>` loses focus. Re-emitted from
   * the input's own `blur` handler (fired after the touch output), so composite
   * controls can run blur-driven logic (close dropdowns, revert text, mark
   * touched) reliably. Carries the original `FocusEvent`.
   */
  readonly inputBlur = output<FocusEvent>();

  /**
   * @private Reference to the internally-rendered native `<input>` element so
   * the component can imperatively focus / select its contents.
   */
  private readonly _nativeRef =
    viewChild<ElementRef<HTMLInputElement>>('native');

  /**
   * @private Reference to a consumer-projected `<input mlvInputNative>` used
   * when {@link projectControl} is enabled.
   */
  private readonly _projectedNative = contentChild(MlvInputNative);

  /**
   * @private Resolves the active native `<input>` — the projected one when
   * projection is enabled and present, otherwise the internally-rendered input.
   */
  private _resolveNative(): HTMLInputElement | null {
    if (this.projectControl()) {
      return this._projectedNative()?.nativeElement ?? null;
    }
    return this._nativeRef()?.nativeElement ?? null;
  }

  /**
   * Direct access to the underlying native `<input>`. Use sparingly —
   * required only for selection-range / paste-distribution flows in
   * composite controls. Resolves to the projected input when
   * {@link projectControl} is enabled.
   */
  get nativeElement(): HTMLInputElement | null {
    return this._resolveNative();
  }

  /**
   * Focuses the underlying native input.
   */
  focus(): void {
    this._resolveNative()?.focus();
  }

  /**
   * Selects the current text inside the underlying native input.
   */
  select(): void {
    this._resolveNative()?.select();
  }

  onInput(event: Event): void {
    this.value.set((event.target as HTMLInputElement).value);
  }

  /**
   * Handles the native `<input>` focus event: sets the focused state and
   * re-emits {@link inputFocus} for composite-control consumers.
   */
  onFocus(event: FocusEvent): void {
    this.setFocused(true);
    this.inputFocus.emit(event);
  }

  onBlur(event: FocusEvent): void {
    this.setFocused(false);
    this._markTouched();
    this.inputBlur.emit(event);
  }

  /** Whether the control holds a clearable value — Non-empty text present. */
  readonly hasValue = computed(() => (this.value() ?? '').length > 0);

  /**
   * Clears the text value from application code.
   *
   * An application API, not a user path: like `value.set('')` it is **not**
   * gated by `readonly` or `disabled` — readonly locks out the user, not the
   * application. The wrapper's clear button does not call it; it calls
   * {@link _onClear}, which is gated (#301).
   */
  clearValue(): void {
    this.value.set('');
  }

  /**
   * @protected The wrapper's clear-button handler: clears the text through
   * `_write`, so it is refused while the input is readonly or disabled even
   * when a click reaches a button rendered before that state flipped.
   */
  protected _onClear(): void {
    this._write('');
  }
}
