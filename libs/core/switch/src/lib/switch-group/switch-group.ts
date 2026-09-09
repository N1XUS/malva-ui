import type { Signal } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  forwardRef,
  inject,
  input,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import { mlvNextId } from '@malva-ui/cdk/utils';
import {
  MLV_DENSITY_ELEMENT,
  MlvDensityDirective,
  provideMlvDensityContext,
} from '@malva-ui/cdk/density';
import { MlvSwitch } from '../switch/switch';
import type { MlvSwitchGroupAccessor } from '../switch-group-token';
import { SWITCH_GROUP } from '../switch-group-token';
import type {
  MlvFormControl,
  MlvFormControlAppend,
  MlvFormControlInset,
  MlvFormControlLabelTarget,
  MlvFormControlPrepend,
  MlvFormState,
} from '@malva-ui/core/form-utils';
import {
  MLV_FORM_CONTROL,
  MLV_FORM_FIELD,
  MlvLabel,
  MlvFocusableGroupBase,
} from '@malva-ui/core/form-utils';

/**
 * Visual/validation state of the switch group. Mirrors {@link MlvFormState}.
 */
export type MlvSwitchGroupState = MlvFormState;

/**
 * Constant `false`, shared by every inert boolean half of the
 * {@link MlvFormControl} contract {@link MlvSwitchGroup} satisfies. One
 * module-scoped signal rather than one per member per instance, because none of
 * them is ever written.
 */
const NEVER: Signal<boolean> = signal(false).asReadonly();

/**
 * Constant `undefined` for the three projected-slot halves of
 * {@link MlvFormControl} — `mlv-form-control-wrapper` concerns that a switch
 * group does not render.
 */
const NO_SLOT = signal(undefined).asReadonly();

@Component({
  selector: 'mlv-switch-group',
  template: `
    @if (label()) {
      <mlv-label [id]="_labelId">
        {{ label() }}
      </mlv-label>
    }
    <ng-content />
  `,
  styleUrl: './switch-group.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [{ directive: MlvDensityDirective, inputs: ['mlvDensity'] }],
  providers: [
    {
      provide: SWITCH_GROUP,
      useExisting: forwardRef(() => MlvSwitchGroup),
    },
    // The group — not whichever control happens to sit first inside it — is
    // what an enclosing `mlv-form-field` must resolve as "its" control, and
    // what the `<mlv-label>` rendered in this view must recognise as its owner.
    // Both consumers read `MLV_FORM_CONTROL`; see the connector members below.
    {
      provide: MLV_FORM_CONTROL,
      useExisting: forwardRef(() => MlvSwitchGroup),
    },
    { provide: MLV_DENSITY_ELEMENT, useValue: 'switch-group' },
    // Projects the group's resolved density to every density-aware descendant
    // — the projected `<mlv-switch>` children resolve `MLV_DENSITY_CONTEXT`
    // through their declaration-site element injector, which is this host.
    provideMlvDensityContext(MlvDensityDirective),
  ],
  host: {
    class: 'mlv-switch-group',
    role: 'group',
    '[attr.id]': '_groupId',
    '[attr.aria-labelledby]': 'label() ? _labelId : _fieldLabelId()',
    '(keydown)': 'onKeydown($event)',
  },
  imports: [MlvLabel],
})
export class MlvSwitchGroup
  extends MlvFocusableGroupBase<MlvSwitch>
  implements MlvSwitchGroupAccessor, MlvFormControl
{
  /** Accessible label for the group, rendered above the switches. */
  readonly label = input('');

  /** Visual/validation state applied to the group. */
  readonly state = input<MlvSwitchGroupState>('default');

  /**
   * @protected HTML `id` of the `role="group"` element — here the component
   * host itself, unlike `mlv-checkbox-group`, which carries the role on an
   * inner `<div>`. {@link labelTarget} points an enclosing field's
   * `<mlv-label>` here.
   */
  protected readonly _groupId = mlvNextId('mlv-switch-group');

  /**
   * @protected HTML `id` of the `<mlv-label>` this group renders from
   * {@link label}. Bound as a plain DOM `id` on the `mlv-label` host (the
   * component declares no `id` input), which is what `aria-labelledby` names
   * when the group labels itself.
   */
  protected readonly _labelId = `${this._groupId}-label`;

  /**
   * @private The enclosing `mlv-form-field`, when the group is projected into
   * one. Optional — the group works standalone.
   */
  private readonly _formField = inject(MLV_FORM_FIELD, { optional: true });

  /**
   * @protected Id of an `<mlv-label>` projected beside this group into
   * `mlv-form-field`, or `null` when there is none. Read by the host binding
   * as the fallback half of `aria-labelledby`; a label written on the group
   * wins, because it is the nearer, explicitly-authored name.
   */
  protected readonly _fieldLabelId = computed<string | null>(
    () => this._formField?.labelId() ?? null,
  );

  /**
   * The element an `<mlv-label>` projected beside this group into
   * `mlv-form-field` names, and how.
   *
   * Always the `role="group"` host, and always **non**-labelable: a
   * `<label for>` names only `button`/`input`/`meter`/`output`/`progress`/
   * `select`/`textarea`, so the field emits no `for` and the group consumes
   * the label through `aria-labelledby` instead. That is the association
   * WAI-ARIA prescribes for a group, and the same shape `mlv-radio-group`
   * ships.
   *
   * Constant rather than a `computed`: unlike a control whose strategy tracks
   * its own state (`mlv-select` swaps between its native `<select>` and a
   * `div[role="combobox"]`), a group is a group in every state.
   */
  readonly labelTarget = signal<MlvFormControlLabelTarget | null>({
    id: this._groupId,
    labelable: false,
  }).asReadonly();

  /**
   * Always `false`: a switch group is a labelled region, not a focus target.
   * Focus lives on the projected switches, each of which reports its own.
   *
   * This member and the eight below exist so the group genuinely satisfies
   * {@link MlvFormControl} rather than merely being provided as one. An
   * `ExistingProvider`'s `useExisting` is typed `any`, so nothing but the
   * `implements` clause on this class would catch a missing member — and
   * `mlv-form-control-wrapper` calls `focused()` / `disabled()` / `readonly()`
   * / `loading()` / `state()` unguarded.
   *
   * They are public members on an exported class, and that costs something a
   * consumer should know about: `group.disabled()` on a
   * `viewChild(MlvSwitchGroup)` **used to be a compile error** and now
   * compiles and always answers `false`. None of the nine is an `input()`, so
   * `[disabled]="…"` on the element still fails AOT with NG8002 — only the
   * TypeScript read changed, and it changed from loud to silent. Read
   * `computedDisabled()` on the individual `mlv-switch` children instead.
   * Hiding them is not available: `implements` requires public members, and
   * widening `MlvFormControl`'s own members to optional would break every
   * consumer calling `inject(MLV_FORM_CONTROL).focused()` under
   * `strictNullChecks`.
   */
  readonly focused = NEVER;

  /** Always `false`: disabling is per-switch, never group-wide. */
  readonly disabled = NEVER;

  /** Always `false`: the group has no editable surface to make read-only. */
  readonly readonly = NEVER;

  /** Always `false`: the group renders no busy state of its own. */
  readonly loading = NEVER;

  /** Always `false`: the group holds no value, so there is nothing to clear. */
  readonly clearable = NEVER;

  /** Always `false`: checked state belongs to each switch, not the group. */
  readonly hasValue = NEVER;

  /** Always absent: the group renders no wrapper, so it has no prefix slot. */
  readonly prepend: Signal<MlvFormControlPrepend | undefined> = NO_SLOT;

  /** Always absent: the group renders no wrapper, so it has no suffix slot. */
  readonly append: Signal<MlvFormControlAppend | undefined> = NO_SLOT;

  /** Always absent: the group renders no wrapper, so it has no inset slot. */
  readonly inset: Signal<MlvFormControlInset | undefined> = NO_SLOT;

  /**
   * @protected The projected switches in DOM order — drives the shared
   * roving-tabindex arrow navigation from {@link MlvFocusableGroupBase}.
   */
  protected readonly _items = contentChildren(MlvSwitch);

  /** @protected Skips disabled switches during arrow navigation. */
  protected _isDisabled(sw: MlvSwitch): boolean {
    return sw.computedDisabled();
  }
}
