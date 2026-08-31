import { Component, ChangeDetectionStrategy } from '@angular/core';
import type { MlvButtonVariant } from '@malva-ui/core/button';
import { MlvButton } from '@malva-ui/core/button';

@Component({
  selector: 'docs-button-variants-example',
  imports: [MlvButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class ButtonVariantsExampleComponent {
  /**
   * Everyday variants. At most two saturated fills render together —
   * `primary` and `accent` — the rest are achromatic or text-only (AB-R8).
   */
  readonly variants: MlvButtonVariant[] = [
    'primary',
    'secondary',
    'outlined',
    'accent',
    'transparent',
    'elevated',
  ];

  /**
   * Reserved for a single blocking call to action — never rendered alongside
   * `primary` in the same view (AB-R8).
   */
  readonly reservedVariants: MlvButtonVariant[] = ['error', 'warning', 'info'];
}
