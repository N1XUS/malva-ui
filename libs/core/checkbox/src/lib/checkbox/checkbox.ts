import {
  afterNextRender,
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
  imports: [LucideCheck, LucideMinus],
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

    afterNextRender(() => this._warnWhenUnlabelled());
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

  readonly inputId = this.id();

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
   */
  onInputChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.checked.set(target.checked);
  }

  /** Toggles the checked state from an Enter keypress on the native input. */
  toggle(event: Event): void {
    event.preventDefault();
    if (this.computedDisabled()) return;
    this.checked.set(!this.checked());
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
   * `label` and no ARIA naming has no accessible name at all. CSS decides which
   * of the two visible sources renders, so this only reports the empty case.
   */
  private _warnWhenUnlabelled(): void {
    if (!isDevMode()) return;
    const hasProjectedText =
      (this._contentRef().nativeElement.textContent ?? '').trim().length > 0;
    if (
      hasProjectedText ||
      this.label() ||
      this._resolvedAriaLabel() ||
      this._resolvedAriaLabelledBy()
    ) {
      return;
    }
    console.warn(
      '[mlv-checkbox] Rendered without an accessible name. Project text into ' +
        '<mlv-checkbox>, or set [label], [ariaLabel] or [ariaLabelledBy].',
    );
  }
}
