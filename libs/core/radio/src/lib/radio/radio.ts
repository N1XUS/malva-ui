import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  HostAttributeToken,
  inject,
  input,
  Renderer2,
  signal,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import {
  MLV_DENSITY_ELEMENT,
  MlvDensityDirective,
} from '@malva-ui/cdk/density';
import type { MlvRadioGroupAccessor } from '../radio-group-token';
import { RADIO_GROUP } from '../radio-group-token';

@Component({
  selector: 'mlv-radio',
  templateUrl: './radio.html',
  styleUrl: './radio.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Density: stamps `mlv-radio--<density>` from `mlvDensity`, else the
  // nearest density scope, else the service (#364).
  providers: [{ provide: MLV_DENSITY_ELEMENT, useValue: 'radio' }],
  hostDirectives: [{ directive: MlvDensityDirective, inputs: ['mlvDensity'] }],
  host: {
    class: 'mlv-radio',
    '[class.mlv-radio--checked]': 'checked()',
    '[class.mlv-radio--disabled]': 'disabled()',
  },
})
export class MlvRadio {
  /** @private Optional parent radio group accessor injected via `RADIO_GROUP`. */
  private readonly _group = inject<MlvRadioGroupAccessor>(RADIO_GROUP, {
    optional: true,
  });

  /** @private Host element reference, used to strip the moved ARIA attributes. */
  private readonly _elementRef = inject(ElementRef<HTMLElement>);

  /** @private Renderer used to imperatively remove host ARIA attributes. */
  private readonly _renderer = inject(Renderer2);

  /**
   * @private The `aria-label` a consumer placed directly on the `<mlv-radio>`
   * host, captured before host bindings run. The host is role-less, so ARIA
   * prohibits an `aria-label` there (axe `aria-prohibited-attr`); it is moved to
   * the inner `<input type="radio">` instead (see the constructor).
   */
  private readonly _hostAriaLabel = inject(
    new HostAttributeToken('aria-label'),
    { optional: true },
  );

  /**
   * @private The `aria-labelledby` a consumer placed directly on the
   * `<mlv-radio>` host, captured before host bindings run. Moved to the inner
   * input for the same reason as {@link _hostAriaLabel}.
   */
  private readonly _hostAriaLabelledBy = inject(
    new HostAttributeToken('aria-labelledby'),
    { optional: true },
  );

  /**
   * Accessible name applied to the inner native input (`aria-label`). Use this
   * input (not a host `[attr.aria-label]` binding) when the label is dynamic —
   * the role-less host must not carry ARIA naming attributes
   * (axe `aria-prohibited-attr`). A static host `aria-label` attribute is also
   * supported and forwarded automatically (see the constructor); this input
   * takes precedence when both are present.
   */
  readonly ariaLabel = input<string | undefined>(undefined);

  /**
   * Id reference(s) naming the inner native input (`aria-labelledby`). Same
   * rationale and precedence as {@link ariaLabel}.
   */
  readonly ariaLabelledBy = input<string | undefined>(undefined);

  /**
   * @internal The accessible name forwarded onto the native input, sourced from a
   * host `aria-label`. `null` when the consumer supplied none, so no empty
   * `aria-label` is emitted on the input (and any group-provided naming is left
   * untouched).
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
    // A host `aria-label`/`aria-labelledby` lands on the role-less custom
    // element (axe `aria-prohibited-attr`). Move it onto the inner input — the
    // component's real accessible-name target — and strip it from the host. The
    // signals stay `null` when nothing was supplied, so the `[attr.*]` bindings
    // omit the attribute and never clobber a group-provided labelling mechanism.
    const host = this._elementRef.nativeElement;
    if (this._hostAriaLabel !== null) {
      this._ariaLabel.set(this._hostAriaLabel);
      this._renderer.removeAttribute(host, 'aria-label');
    }
    if (this._hostAriaLabelledBy !== null) {
      this._ariaLabelledBy.set(this._hostAriaLabelledBy);
      this._renderer.removeAttribute(host, 'aria-labelledby');
    }
  }

  readonly value = input<unknown>();
  readonly disabled = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });
  readonly checked = signal(false);
  readonly name = signal('');

  /**
   * Roving tabindex applied to the native `<input type="radio">` — the single
   * focus target. `0` for the tabbable radio, `-1` for the rest. Managed by
   * `MlvRadioGroup`.
   */
  readonly tabIndex = signal(0);

  /**
   * @private Reference to the visually-hidden native radio input, which is the
   * focus target (kept in the a11y tree via the clip-path pattern so native
   * radio semantics — Space selection, grouping — are preserved).
   */
  private readonly _nativeInput =
    viewChild.required<ElementRef<HTMLInputElement>>('nativeInput');

  /**
   * Moves focus to the native radio input. Satisfies CDK `FocusableOption` so
   * the group's `FocusKeyManager` focuses the input rather than the host.
   */
  focus(): void {
    this._nativeInput().nativeElement.focus();
  }

  /** @internal Notifies the parent group when the native input gains focus. */
  onFocus(): void {
    this._group?.onChildFocus(this);
  }

  /** @internal Handles native selection (click, Space, native arrow keys). */
  onSelect(): void {
    if (this.disabled()) return;
    this._group?.selectRadio(this);
  }

  /**
   * @protected Native `disabled` for the inner input: this radio's own
   * {@link disabled}, or its group's. The host's `mlv-radio--disabled` class
   * stays this radio's own state (the public BEM surface); a disabled group
   * reaches its radios' disabled surface in CSS through
   * `.mlv-radio-group--disabled .mlv-radio` instead (SF-R4, #366).
   */
  protected readonly _nativeDisabled = computed(
    () => this.disabled() || (this._group?.computedDisabled() ?? false),
  );

  /**
   * @protected Cancels a click (a pointer click, a click on the label, or the
   * click Space synthesises) while the group may not change its selection. A
   * native radio honours a cancelled click — the browser puts the previously
   * checked radio back and fires no `change` — so a readonly group's DOM can
   * never show a selection its value does not hold.
   */
  protected _onNativeClick(event: MouseEvent): void {
    if (this._group && !this._group.canSelect()) event.preventDefault();
  }

  /**
   * @internal Re-asserts the native `checked` from {@link checked}. Called by
   * the group when it refuses a selection that reached `(change)` anyway: the
   * browser has already flipped the DOM by then, and because the `[checked]`
   * binding's value did not change, Angular would never write it back.
   */
  _restoreNativeChecked(): void {
    this._nativeInput().nativeElement.checked = this.checked();
  }
}
