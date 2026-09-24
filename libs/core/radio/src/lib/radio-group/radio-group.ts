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
    '[attr.aria-invalid]': '_ariaInvalid()',
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

  /**
   * Two-way bindable selected value of the group. A radio is checked while its
   * own `value` is identical (`===`) to this one, re-evaluated whenever either
   * changes — so options whose objects are re-created on refresh must keep
   * their identity, or this must be pointed at the new object, for the
   * selection to stay visible.
   */
  readonly value = model<unknown>();

  /** Shared `name` applied to the native radio inputs in the group. */
  readonly name = input<string, string | undefined>(
    mlvNextId('mlv-radio-group'),
    { transform: (value) => value ?? mlvNextId('mlv-radio-group') },
  );

  readonly radios = contentChildren(MlvRadio);

  /**
   * @private FocusKeyManager driving roving focus + arrow-key navigation across
   * the radios. `undefined` while the group has no radio — before the first
   * radio renders, and again once every radio is removed — so an arrow key
   * reaching the host then moves nothing, instead of throwing or driving a
   * stale manager over detached radios.
   */
  private _keyManager: FocusKeyManager<MlvRadio> | undefined;

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
    // Touched when focus leaves the group, chosen or not — never from a
    // selection while focus stays inside (#347, D22).
    this._reportTouchOnFocusLeave();
    inject(DestroyRef).onDestroy(() => this._keyManager?.destroy());

    effect(() => {
      const items = [...this.radios()];
      const groupName = this.name();

      // Untracked: the previous manager's `activeItem` is signal-backed in CDK
      // 22, and reading it tracked would rebuild the manager on every focus
      // move.
      untracked(() => {
        // Carry the active radio over when it survives, so a radio added or
        // removed while the user is in the group does not send the next arrow
        // key back to the first radio.
        const previous = this._keyManager?.activeItem ?? null;
        this._keyManager?.destroy();
        this._keyManager = undefined;
        // No radio, no manager: one kept over the removed radios would let a
        // later arrow key select a detached radio's value.
        if (items.length === 0) return;

        const keyManager = new FocusKeyManager<MlvRadio>(
          items as RadioFocusItem[],
        )
          .skipPredicate((radio) => radio.disabled())
          .withVerticalOrientation()
          .withWrap();
        if (previous !== null && items.includes(previous)) {
          keyManager.updateActiveItem(previous);
        }
        this._keyManager = keyManager;
      });

      items.forEach((radio) => radio.name.set(groupName));
    });

    // Checked state mirrors `radio.value() === value` — for the group value and
    // for each radio's own `value`, whenever either changes. Each radio's
    // `value` is read tracked on purpose: a radio projected through `@for` has
    // its inputs bound after this view's effects run, so an untracked read
    // matched every radio against `undefined` (with no group value, every radio
    // claimed `checked`), and a later `[value]` change left `checked` stale.
    // The comparison is identity: an option object re-created on refresh no
    // longer equals the group value, so no radio is checked until `value` is
    // pointed at the new object.
    effect(() => {
      const value = this.value();
      this.radios().forEach((radio) =>
        radio.checked.set(radio.value() === value),
      );
    });

    // Roving tab stop. Tracked, so it follows the checked radio and each
    // radio's `disabled` flag as they change, not only the selection.
    effect(() => this._updateTabIndices());
  }

  onChildFocus(radio: MlvRadio): void {
    const index = this.radios().indexOf(radio);
    if (index >= 0) {
      this._keyManager?.setActiveItem(index);
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

    // A group with no radio has nothing to move and no native navigation to
    // suppress, so the key is left alone.
    const keyManager = this._keyManager;
    if (!keyManager) return;

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

    if (!keyManager.activeItem) {
      keyManager.setFirstItemActive();
    } else if (isPrev) {
      keyManager.setPreviousItemActive();
    } else {
      keyManager.setNextItemActive();
    }

    const active = keyManager.activeItem;
    if (active) {
      this.selectRadio(active);
    }
  }

  /**
   * Selects `radio` as a user interaction would: writes the group value,
   * focuses the radio and moves the roving tab stop to it.
   *
   * Does **not** mark the field touched. The group reports touched when focus
   * leaves it (the host `focusout`, #347): before, it touched here and only
   * here, so a required group the user tabbed through without choosing never
   * showed its error, and touched and valid arrived together.
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

  /**
   * @private Applies the roving tabindex: exactly one radio is tabbable — the
   * checked one while it is enabled, otherwise the first enabled radio. None
   * is while every radio is disabled.
   *
   * A disabled native radio cannot take focus, so a tab stop left on one
   * leaves the group with no tab stop at all. The checked-but-disabled case
   * follows the browsers' own radio groups: natively, Chromium and Firefox then
   * Tab to the first enabled radio. WebKit reaches no radio of such a group —
   * natively, or with the `tabindex="0"` on the checked radio or on an enabled
   * one — so nothing here can give it a stop. A disabled *group* disables
   * every native radio, so it has no tab stop either way.
   */
  private _updateTabIndices(): void {
    const radios = this.radios();
    const checked = radios.find((radio) => radio.checked());
    const stop =
      checked && !checked.disabled()
        ? checked
        : radios.find((radio) => !radio.disabled());
    radios.forEach((radio) => radio.tabIndex.set(radio === stop ? 0 : -1));
  }
}
