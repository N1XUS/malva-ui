import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  input,
} from '@angular/core';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';

@Component({
  selector: 'mlv-toolbar',
  template: '<ng-content />',
  styleUrl: './toolbar.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-toolbar',
    '[style.gap.rem]': 'gap()',
    '[class.mlv-toolbar--equal]': 'equalSize()',
  },
})
export class MlvToolbar {
  readonly gap = input(0.25);
  readonly equalSize = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });
}
