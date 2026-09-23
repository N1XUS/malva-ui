import {
  ChangeDetectionStrategy,
  Component,
  contentChildren,
  DestroyRef,
  effect,
  ElementRef,
  forwardRef,
  inject,
  input,
  model,
  untracked,
  ViewEncapsulation,
  computed,
} from '@angular/core';
import { FocusKeyManager } from '@angular/cdk/a11y';
import {
  DOWN_ARROW,
  LEFT_ARROW,
  RIGHT_ARROW,
  UP_ARROW,
} from '@angular/cdk/keycodes';
import type { FocusableOption } from '@angular/cdk/a11y';
import { MlvRadio } from '../radio/radio';
import type { MlvRadioGroupAccessor } from '../radio-group-token';
import { RADIO_GROUP } from '../radio-group-token';
import type {
  MlvFormState,
  MlvFormControlLabelStrategy,
} from '@malva-ui/core/form-utils';
import {
  MlvDescription,
  MlvLabel,
  MlvMessage,
  MLV_FORM_CONTROL,
  MlvSignalFormControlBase,
} from '@malva-ui/core/form-utils';
import { MlvRtlService, mlvNextId } from '@malva-ui/cdk/utils';

/**
 * Visual/validation state of the group. Structurally identical to
 * {@link MlvFormState}; retained as a public alias for backwards compatibility.
 */
export type MlvRadioGroupState = MlvFormState;

type RadioFocusItem = MlvRadio & FocusableOption;

@Component({
  selector: 'mlv-radio-group',
  template: `
    @if (label()) {
      <mlv-label [id]="labelId()" [required]="required()">
        {{ label() }}
      </mlv-label>
    }
    <div class="mlv-radio-group__content">
      <ng-content />
    </div>
    @if (description()) {
      <mlv-description [id]="_descriptionId()">{{
        description()
      }}</mlv-description>
    }
    @if (message()) {
      <mlv-message [id]="_messageId()" [state]="resolvedState()">{{
        message()
      }}</mlv-message>
    }
  `,
  styleUrl: './radio-group.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: RADIO_GROUP,
      useExisting: forwardRef(() => MlvRadioGroup),
    },
    {
      provide: MLV_FORM_CONTROL,
      useExisting: forwardRef(() => MlvRadioGroup),
    },
  ],
  imports: [MlvLabel, MlvDescription, MlvMessage],
  host: {
    class: 'mlv-radio-group',
    '[class]': '"mlv-radio-group--state-" + resolvedState()',
    '[class.mlv-radio-group--disabled]': 'computedDisabled()',
    '[class.mlv-radio-group--readonly]': 'readonly()',
    '[attr.id]': 'id()',
    role: 'radiogroup',
    '[attr.aria-labelledby]': 'label() ? labelId() : _fieldLabelId()',
    '[attr.aria-label]': 'label() || _fieldLabelId() ? null : ariaLabel()',
    '[attr.aria-required]': 'required() || null',
    '[attr.aria-describedby]': '_describedBy()',
    '[attr.aria-disabled]': 'computedDisabled() || null',
    '[attr.aria-readonly]': 'readonly() || null',
    '(keydown)': '_onKeydown($event)',
  },
})
export class MlvRadioGroup
  extends MlvSignalFormControlBase<unknown>
  implements MlvRadioGroupAccessor
{
  /**
   * @protected {@link id} sits on the `role="radiogroup"` host. A group is
   * never labelable, so a projected `<mlv-label>` names it through
   * `aria-labelledby` — the pattern WAI-ARIA prescribes for a radiogroup.
   */
  protected override _externalLabelStrategy(): MlvFormControlLabelStrategy {
    return 'aria';
  }

  /**
   * The HTML `id` assigned to the visible `<mlv-label>` element. The
   * `role="radiogroup"` host references it via `aria-labelledby` (a
   * `<label for>` cannot name a group), which is also what makes a label
   * written on this control win over one projected beside it into
   * `mlv-form-field`.
   */
  readonly labelId = computed(() => `${this.id()}-label`);

  /** Two-way bindable selected value of the group. */
  readonly value = model<unknown>();

  /** Shared `name` applied to the native radio inputs in the group. */
  readonly name = input<string, string | undefined>(
    mlvNextId('mlv-radio-group'),
    { transform: (value) => value ?? mlvNextId('mlv-radio-group') },
  );

  readonly radios = contentChildren(MlvRadio);

  /** @private FocusKeyManager driving roving focus + arrow-key navigation across the radios. */
  private _keyManager!: FocusKeyManager<MlvRadio>;

  /** @private Normalizes horizontal radio navigation for RTL layouts. */
  private readonly _rtlService = inject(MlvRtlService);

  /**
   * @private Host element; the scope horizontal arrow keys resolve their
   * direction against, so the group mirrors inside a `[dir]` subtree — or
   * inside an overlay pane, which CDK stamps with its own `dir` — and not only
   * on a document-wide flip.
   */
  private readonly _elementRef = inject(ElementRef<HTMLElement>);

  /**
   * @private Direction applying to this group, resolved once and cached behind
   * the shared `dir` observer rather than re-walked on every arrow keypress.
   */
  private readonly _direction = this._rtlService.elementDirection(
    this._elementRef,
  );

  constructor() {
    super();
    inject(DestroyRef).onDestroy(() => this._keyManager?.destroy());

    effect(() => {
      const items = [...this.radios()];
      const groupName = this.name();
      if (items.length === 0) return;

      this._keyManager?.destroy();
      this._keyManager = new FocusKeyManager<MlvRadio>(
        items as RadioFocusItem[],
      )
        .skipPredicate((radio) => radio.disabled())
        .withVerticalOrientation()
        .withWrap();

      items.forEach((radio) => radio.name.set(groupName));
      untracked(() => this._updateSelection());
    });

    effect(() => {
      this.value();
      untracked(() => this._updateSelection());
    });
  }

  onChildFocus(radio: MlvRadio): void {
    const index = this.radios().indexOf(radio);
    if (index >= 0) {
      this._keyManager.setActiveItem(index);
    }
  }

  /**
   * @protected Host keydown handler. Handles all four arrow keys for WAI-ARIA
   * radiogroup semantics, moving focus + selection via the FocusKeyManager.
   */
  _onKeydown(event: KeyboardEvent): void {
    const key = this._rtlService.normalizeArrowKey(event, this._direction());
    const isPrev = key === UP_ARROW || key === LEFT_ARROW;
    const isNext = key === DOWN_ARROW || key === RIGHT_ARROW;
    if (!isPrev && !isNext) return;

    // Handle all four arrows for WAI-ARIA radiogroup semantics and suppress the
    // native radio-group navigation so focus + selection stay in sync with the
    // FocusKeyManager (which skips disabled radios and wraps).
    event.preventDefault();

    // A disabled group's radios are natively disabled and cannot take focus,
    // so stop before the key manager moves, or its active item drifts from the
    // focused element. A readonly group is different: `aria-readonly` must not
    // restrict navigation, so its arrows still move focus — the key manager
    // focuses whatever it activates — and `selectRadio` refuses the selection.
    if (this.computedDisabled()) return;

    if (!this._keyManager.activeItem) {
      this._keyManager.setFirstItemActive();
    } else if (isPrev) {
      this._keyManager.setPreviousItemActive();
    } else {
      this._keyManager.setNextItemActive();
    }

    const active = this._keyManager.activeItem;
    if (active) {
      this.selectRadio(active);
    }
  }

  /**
   * Selects `radio` as a user interaction would: writes the group value,
   * focuses the radio and moves the roving tab stop to it.
   *
   * Refused while the group is readonly or disabled. A refusal also puts every
   * native input back to the group's value — a selection that reached here
   * through `(change)` has already been checked by the browser — and leaves
   * focus alone: in a readonly group the arrow keys still move it.
   *
   * @param radio The radio to select; must belong to this group.
   */
  selectRadio(radio: MlvRadio): void {
    if (!this._write(radio.value())) {
      this.radios().forEach((r) => r._restoreNativeChecked());
      return;
    }
    radio.focus();
    const radioValue = radio.value();
    this.radios().forEach((r) => r.checked.set(r.value() === radioValue));
    this._updateTabIndices();
    this._markTouched();
  }

  /**
   * @internal Whether a user interaction may change the selection — the
   * group's {@link _canWrite}, exposed to its radios through `RADIO_GROUP` so
   * each can cancel its native click before the browser checks it.
   */
  canSelect(): boolean {
    return this._canWrite();
  }

  /** Whether the control holds a clearable value — A radio value is selected. */
  readonly hasValue = computed(() => this.value() != null);

  /** @private Syncs each radio's checked state to the current group value and refreshes tab indices. */
  private _updateSelection(): void {
    this.radios().forEach((radio) => {
      radio.checked.set(radio.value() === this.value());
    });
    this._updateTabIndices();
  }

  /** @private Applies the roving tabindex: only the checked radio (or first when none checked) is tabbable. */
  private _updateTabIndices(): void {
    const radios = this.radios();
    const hasChecked = radios.some((r) => r.checked());
    radios.forEach((radio, i) => {
      radio.tabIndex.set(
        hasChecked ? (radio.checked() ? 0 : -1) : i === 0 ? 0 : -1,
      );
    });
  }
}
