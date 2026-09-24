import {
  afterNextRender,
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  forwardRef,
  HostAttributeToken,
  inject,
  input,
  isDevMode,
  model,
  Renderer2,
  signal,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import type { MlvFormState, MlvFormControl } from '@malva-ui/core/form-utils';
import {
  MlvDescription,
  MlvMessage,
  MlvSignalCheckboxControlBase,
  MLV_FORM_CONTROL,
} from '@malva-ui/core/form-utils';
import { LucideCheck, LucideMinus } from '@lucide/angular';
import type { MlvCheckboxGroupAccessor } from '../checkbox-group-token';
import { CHECKBOX_GROUP } from '../checkbox-group-token';

/**
 * Visual/validation state of the checkbox. Mirrors {@link MlvFormState}.
 */
export type MlvCheckboxState = MlvFormState;

/**
 * Whether a `<label>` other than the checkbox's own wrapping one names
 * `input` with some text — an external `<label for>` pointing at the consumer
 * `id`, which reaches the native input since #323.
 */
function hasExternalLabel(input: HTMLInputElement): boolean {
  return Array.from(input.labels ?? []).some(
    (label) =>
      !label.contains(input) && (label.textContent ?? '').trim().length > 0,
  );
}

@Component({
  selector: 'mlv-checkbox',
  templateUrl: './checkbox.html',
  styleUrl: './checkbox.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: MLV_FORM_CONTROL,
      useExisting: forwardRef(() => MlvCheckbox),
    },
  ],
  host: {
    class: 'mlv-checkbox',
    '[class.mlv-checkbox--disabled]': 'computedDisabled()',
    '[class.mlv-checkbox--checked]': 'checked()',
    '[class.mlv-checkbox--indeterminate]': 'indeterminate()',
  },
  imports: [LucideCheck, LucideMinus, MlvDescription, MlvMessage],
})
export class MlvCheckbox
  extends MlvSignalCheckboxControlBase
  implements MlvFormControl
{
  /** @private Optional parent checkbox group used for roving-focus coordination. */
  private readonly _group = inject<MlvCheckboxGroupAccessor>(CHECKBOX_GROUP, {
    optional: true,
  });

  /** @private Host element reference, used to strip the moved ARIA attributes. */
  private readonly _elementRef = inject(ElementRef<HTMLElement>);

  /** @private Renderer used to imperatively remove host ARIA attributes. */
  private readonly _renderer = inject(Renderer2);

  /**
   * @private The `aria-label` a consumer placed directly on the `<mlv-checkbox>`
   * host, captured before host bindings run. The host is role-less, so ARIA
   * prohibits an `aria-label` there (axe `aria-prohibited-attr`); it is moved to
   * the inner `<input type="checkbox">` instead (see the constructor).
   */
  private readonly _hostAriaLabel = inject(
    new HostAttributeToken('aria-label'),
    { optional: true },
  );

  /**
   * @private The `aria-labelledby` a consumer placed directly on the
   * `<mlv-checkbox>` host, captured before host bindings run. Moved to the inner
   * input for the same reason as {@link _hostAriaLabel}.
   */
  private readonly _hostAriaLabelledBy = inject(
    new HostAttributeToken('aria-labelledby'),
    { optional: true },
  );

  /**
   * @private A static `id` attribute the consumer wrote on the
   * `<mlv-checkbox>` host. Angular feeds it to the `id` input **and** leaves
   * it on the host element, so once the native input carries {@link id} the
   * same value would name two elements. The constructor strips it from the
   * host: the id belongs to the focus target, which `getElementById`, an
   * external `<label for>`, `aria-controls` and `aria-errormessage` then reach
   * (#323). A bound `[id]` feeds only the input and never lands on the host.
   *
   * `null` for a `createComponent(…, { hostElement })` root host, whose own
   * attributes never reach the input — so an id there is left alone.
   */
  private readonly _hostId = inject(new HostAttributeToken('id'), {
    optional: true,
  });

  /**
   * Id reference(s) naming the inner native input (`aria-labelledby`). Use this
   * input (not a host `[attr.aria-labelledby]` binding) when the reference is
   * dynamic — the role-less host must not carry ARIA naming attributes
   * (axe `aria-prohibited-attr`). A static host `aria-labelledby` attribute is
   * also supported and forwarded automatically (see the constructor); this
   * input takes precedence when both are present.
   *
   * The inherited `ariaLabel` input behaves the same way for `aria-label`.
   */
  readonly ariaLabelledBy = input<string | undefined>(undefined);

  /**
   * @internal The accessible name forwarded onto the native input, sourced from a
   * host `aria-label`. `null` when the consumer supplied none, so no empty
   * `aria-label` is emitted on the input.
   */
  readonly _ariaLabel = signal<string | null>(null);

  /**
   * @internal The `aria-labelledby` forwarded onto the native input, sourced from
   * a host `aria-labelledby`. `null` when the consumer supplied none.
   */
  readonly _ariaLabelledBy = signal<string | null>(null);

  /**
   * @internal The final `aria-label` for the native input: the `ariaLabel` input
   * wins over a captured static host attribute; `null` emits no attribute.
   */
  readonly _resolvedAriaLabel = computed(
    () => this.ariaLabel() ?? this._ariaLabel(),
  );

  /**
   * @internal The final `aria-labelledby` for the native input, with the same
   * precedence as {@link _resolvedAriaLabel}.
   */
  readonly _resolvedAriaLabelledBy = computed(
    () => this.ariaLabelledBy() ?? this._ariaLabelledBy(),
  );

  constructor() {
    super();
    // A host `aria-label`/`aria-labelledby` lands on the role-less custom
    // element (axe `aria-prohibited-attr`). Move it onto the inner input — the
    // component's real accessible-name target — and strip it from the host.
    const host = this._elementRef.nativeElement;
    if (this._hostAriaLabel !== null) {
      this._ariaLabel.set(this._hostAriaLabel);
      this._renderer.removeAttribute(host, 'aria-label');
    }
    if (this._hostAriaLabelledBy !== null) {
      this._ariaLabelledBy.set(this._hostAriaLabelledBy);
      this._renderer.removeAttribute(host, 'aria-labelledby');
    }
    // The static host `id` already reached the `id` input, which the native
    // input carries; leaving it on the host would duplicate it.
    if (this._hostId !== null) {
      this._renderer.removeAttribute(host, 'id');
    }

    afterNextRender(() => this._warnWhenUnlabelled());

    // `indeterminate` is a DOM property with no HTML attribute behind it. A
    // template `[indeterminate]` binding therefore cannot survive a server
    // render: the check `@angular/core` runs is `'indeterminate' in element`,
    // which domino's `HTMLInputElement` answers `false`, so *every* rendered
    // checkbox logged an NG0303 to `console.error` — one line per instance,
    // i.e. one per row of a data table (issue #124). The binding bought
    // nothing there either: a DOM property cannot serialise into markup, and
    // the visible tri-state already comes from `[attr.aria-checked]`, the
    // `mlv-checkbox--indeterminate` host class and the minus glyph, none of
    // which this touches.
    //
    // `afterRenderEffect`, specifically:
    // - it never runs on the server, so the error class is gone *by
    //   construction* rather than suppressed — an `isPlatformBrowser`-guarded
    //   `effect` would still be a code path that runs there, and this repo's
    //   SSR guidance prefers the primitive that structurally cannot;
    // - it re-runs when `indeterminate()` changes, which a one-shot
    //   `afterNextRender` would not — the property has to track the input, not
    //   just its initial value.
    //
    // Timing is not visually load-bearing: no stylesheet selects
    // `:indeterminate`, and the native input is visually hidden anyway (it is
    // kept in the a11y tree by the clip-path pattern), so the only consumer of
    // this property is assistive tech and code reading `input.indeterminate`.
    afterRenderEffect(() => {
      this._nativeInput().nativeElement.indeterminate = this.indeterminate();
    });
  }

  /**
   * The checked state — the signal-forms `FormCheckboxControl` model. Two-way
   * bindable (`[(checked)]`) and kept in sync with the bound field by
   * `[formField]` / `[formControl]` / `ngModel`. The `FormCheckboxControl`
   * contract forbids a sibling `value` member, so the previous group-membership
   * `value` input was removed in the signal-forms cutover.
   */
  readonly checked = model(false);

  /** Renders mixed-state visuals (minus icon). */
  readonly indeterminate = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * When `false`, forces the native input out of the tab order (`tabindex="-1"`)
   * regardless of group roving state. Composite parents that own a single tab
   * stop — e.g. `mlv-tree` multi-select rows or `mlv-data-table` rows — set
   * `[tabbable]="false"` so the checkbox does not add an extra tab stop while
   * remaining operable via the row (Space) and the mouse.
   */
  readonly tabbable = input<boolean, BooleanInput>(true, {
    transform: coerceBooleanProperty,
  });

  /**
   * Id of the native checkbox input — always the current {@link id}.
   *
   * A getter rather than a field: a field initializer runs before Angular
   * sets inputs, so `readonly inputId = this.id()` froze the generated
   * default and a consumer `id` never reached the input (#323). Read inside a
   * reactive context it tracks {@link id}.
   */
  get inputId(): string {
    return this.id();
  }

  /**
   * Roving tabindex applied to the native checkbox input — the single focus
   * target. `0` for the tabbable checkbox, `-1` for the rest of a group.
   * Managed by `MlvCheckboxGroup`.
   */
  readonly tabIndex = signal(0);

  /** @internal Effective tabindex on the native input, gated by `tabbable`. */
  readonly _resolvedTabIndex = computed(() =>
    this.tabbable() ? this.tabIndex() : -1,
  );

  /**
   * @private Reference to the visually-hidden native input, which is the
   * component's focus target (kept in the a11y tree via the clip-path pattern).
   */
  private readonly _nativeInput =
    viewChild.required<ElementRef<HTMLInputElement>>('nativeInput');

  /**
   * Moves focus to the native checkbox input. Satisfies CDK `FocusableOption`
   * so `MlvCheckboxGroup`'s `FocusKeyManager` focuses the input, not the host.
   */
  focus(): void {
    this._nativeInput().nativeElement.focus();
  }

  /** @internal Notifies the parent group when the native input gains focus. */
  onFocus(): void {
    this._group?.onChildFocus(this);
  }

  /**
   * Reflects the native `change` event (Space / click): the `checked` model
   * emits, propagating to the bound field. Touched is reported on blur (see
   * {@link onBlur}), matching the signal-forms `touch` contract.
   *
   * A browser flips the native `checked` before `change` runs, so a refused
   * write (readonly or disabled) puts the DOM back rather than leaving it
   * showing a state the model does not hold.
   */
  onInputChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (!this._write(target.checked)) target.checked = this.checked();
  }

  /**
   * The native input's `(keydown.enter)` handler: toggles the checked state as
   * the user's Enter keypress, and cancels the event.
   *
   * A **user interaction**, not an application API — it writes through
   * `_write`, so it does nothing while the checkbox is readonly or disabled.
   * To set the state from code (which readonly does not lock out), write the
   * {@link checked} model instead.
   *
   * @param event The Enter `keydown`; its default is prevented.
   */
  toggle(event: Event): void {
    event.preventDefault();
    this._write(!this.checked());
  }

  /**
   * @protected Cancels a click (a pointer click, a click on the label, or the
   * click Space synthesises) while the checkbox may not be written. A native
   * checkbox ignores the `readonly` attribute, but it honours a cancelled
   * click: the browser restores `checked` and `indeterminate` and fires no
   * `change`, so the DOM never drifts from the model.
   */
  protected _onNativeClick(event: MouseEvent): void {
    if (!this._canWrite()) event.preventDefault();
  }

  /**
   * @internal Marks the control touched when focus leaves the native input —
   * the signal-forms `touch` output replacing the CVA `onTouched` callback.
   */
  onBlur(): void {
    this._markTouched();
  }

  /** Whether the control holds a clearable value — Checked state counts as the clearable value (clear unchecks). */
  readonly hasValue = computed(() => this.checked());

  /**
   * @private The wrapper around the projected content, used once after the
   * first render to tell whether the consumer supplied visible text.
   */
  private readonly _contentRef =
    viewChild.required<ElementRef<HTMLElement>>('content');

  /**
   * @private Dev-mode diagnostic: a checkbox with no projected text, no
   * `label`, no ARIA naming and no external `<label for>` naming its native
   * input has no accessible name at all. CSS decides which of the two visible
   * sources renders, so this only reports the empty case.
   *
   * One-shot, at first render (`afterNextRender`): a name that arrives later
   * — an external `<label for>` inside an `@if` that turns true afterwards,
   * say — is not seen, and the warning still logs.
   */
  private _warnWhenUnlabelled(): void {
    if (!isDevMode()) return;
    const hasProjectedText =
      (this._contentRef().nativeElement.textContent ?? '').trim().length > 0;
    if (
      hasProjectedText ||
      this.label() ||
      this._resolvedAriaLabel() ||
      this._resolvedAriaLabelledBy() ||
      hasExternalLabel(this._nativeInput().nativeElement)
    ) {
      return;
    }
    console.warn(
      '[mlv-checkbox] Rendered without an accessible name. Project text into ' +
        '<mlv-checkbox>, or set [label], [ariaLabel] or [ariaLabelledBy].',
    );
  }
}
