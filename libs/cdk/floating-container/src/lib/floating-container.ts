import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  input,
} from '@angular/core';

/**
 * Container for sticky floating footers. The host sticks to the bottom edge
 * of its nearest scroll container while a gradient-masked backdrop fades the
 * content scrolling beneath it — the projected controls appear to float over
 * the page without a hard separator line.
 *
 * An optional first child (e.g. a hint line) renders above the main content
 * row, mirroring the two-row layout of dialog and sheet footers.
 *
 * ```html
 * <footer mlvFloatingContainer>
 *   <small>Unsaved changes are kept locally.</small>
 *   <button mlvButton>Save</button>
 * </footer>
 * ```
 */
@Component({
  // Attribute-selector component intentionally enhances the consumer's own
  // footer/landmark element instead of introducing a wrapper.
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: '[mlvFloatingContainer]',
  template: '<ng-content />',
  styleUrl: './floating-container.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-floating-container',
    '[style.--mlv-floating-container-background]': 'background() || null',
  },
})
export class MlvFloatingContainer {
  /**
   * Optional CSS background for the fading backdrop. Defaults to the raised
   * surface color when empty.
   */
  readonly background = input('', { alias: 'mlvFloatingContainer' });
}
