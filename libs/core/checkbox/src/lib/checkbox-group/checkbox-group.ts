import {
  ChangeDetectionStrategy,
  Component,
  contentChildren,
  forwardRef,
  input,
  ViewEncapsulation,
} from '@angular/core';
import { MlvCheckbox } from '../checkbox/checkbox';
import type { MlvCheckboxGroupAccessor } from '../checkbox-group-token';
import { CHECKBOX_GROUP } from '../checkbox-group-token';
import type { MlvFormState } from '@malva-ui/core/form-utils';
import { MlvLabel, MlvFocusableGroupBase } from '@malva-ui/core/form-utils';

/**
 * Visual/validation state of the checkbox group. Mirrors {@link MlvFormState}.
 */
export type MlvCheckboxGroupState = MlvFormState;

@Component({
  selector: 'mlv-checkbox-group',
  template: `
    <div
      class="mlv-checkbox-group"
      role="group"
      [attr.aria-label]="label()"
      (keydown)="onKeydown($event)"
    >
      @if (label()) {
        <mlv-label>
          {{ label() }}
        </mlv-label>
      }
      <ng-content />
    </div>
  `,
  styleUrl: './checkbox-group.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: CHECKBOX_GROUP,
      useExisting: forwardRef(() => MlvCheckboxGroup),
    },
  ],
  imports: [MlvLabel],
})
export class MlvCheckboxGroup
  extends MlvFocusableGroupBase<MlvCheckbox>
  implements MlvCheckboxGroupAccessor
{
  /** Accessible label for the group, rendered above the checkboxes. */
  readonly label = input('');

  /** Visual/validation state applied to the group. */
  readonly state = input<MlvCheckboxGroupState>('default');

  /**
   * @protected The projected checkboxes in DOM order — drives the shared
   * roving-tabindex arrow navigation from {@link MlvFocusableGroupBase}.
   */
  protected readonly _items = contentChildren(MlvCheckbox);

  /** @protected Skips disabled checkboxes during arrow navigation. */
  protected _isDisabled(checkbox: MlvCheckbox): boolean {
    return checkbox.computedDisabled();
  }
}
