import {
  ChangeDetectionStrategy,
  Component,
  contentChildren,
  forwardRef,
  input,
  ViewEncapsulation,
} from '@angular/core';
import {
  MLV_DENSITY_ELEMENT,
  MlvDensityDirective,
  provideMlvDensityContext,
} from '@malva-ui/cdk/density';
import { MlvSwitch } from '../switch/switch';
import type { MlvSwitchGroupAccessor } from '../switch-group-token';
import { SWITCH_GROUP } from '../switch-group-token';
import type { MlvFormState } from '@malva-ui/core/form-utils';
import { MlvLabel, MlvFocusableGroupBase } from '@malva-ui/core/form-utils';

/**
 * Visual/validation state of the switch group. Mirrors {@link MlvFormState}.
 */
export type MlvSwitchGroupState = MlvFormState;

@Component({
  selector: 'mlv-switch-group',
  template: `
    @if (label()) {
      <mlv-label>
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
    { provide: MLV_DENSITY_ELEMENT, useValue: 'switch-group' },
    // Projects the group's resolved density to every density-aware descendant
    // — the projected `<mlv-switch>` children resolve `MLV_DENSITY_CONTEXT`
    // through their declaration-site element injector, which is this host.
    provideMlvDensityContext(MlvDensityDirective),
  ],
  host: {
    class: 'mlv-switch-group',
    role: 'group',
    '[attr.aria-label]': 'label() || null',
    '(keydown)': 'onKeydown($event)',
  },
  imports: [MlvLabel],
})
export class MlvSwitchGroup
  extends MlvFocusableGroupBase<MlvSwitch>
  implements MlvSwitchGroupAccessor
{
  /** Accessible label for the group, rendered above the switches. */
  readonly label = input('');

  /** Visual/validation state applied to the group. */
  readonly state = input<MlvSwitchGroupState>('default');

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
