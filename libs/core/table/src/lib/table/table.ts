import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  input,
} from '@angular/core';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import {
  MlvDensityDirective,
  MLV_DENSITY_ELEMENT,
} from '@malva-ui/cdk/density';

/** The table surface that receives pointer hover feedback. */
export type MlvTableHoverable = false | 'row' | 'cell';

@Component({
  // Attribute-selector component — the host is the semantic native table.
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'table[mlvTable]',
  templateUrl: './table.html',
  styleUrl: './table.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: MLV_DENSITY_ELEMENT, useValue: 'table' }],
  hostDirectives: [
    {
      directive: MlvDensityDirective,
      inputs: ['mlvDensity'],
    },
  ],
  host: {
    class: 'mlv-table',
    '[class.mlv-table--bordered]': 'bordered()',
    '[class.mlv-table--responsive]': 'responsive()',
    '[class.mlv-table--pop-in]': 'popIn()',
    '[class.mlv-table--hover-row]': 'hoverable() === "row"',
    '[class.mlv-table--hover-cell]': 'hoverable() === "cell"',
  },
})
export class MlvTable {
  /** Shows a cell grid and an outer table boundary. */
  readonly bordered = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /** Enables horizontal overflow behavior for narrow viewports. */
  readonly responsive = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /** Enables the mobile paired-row Pop In presentation. */
  readonly popIn = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /** Chooses whether rows or individual cells receive hover feedback. */
  readonly hoverable = input<MlvTableHoverable>(false);
}
