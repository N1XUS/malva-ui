import {
  ChangeDetectionStrategy,
  Component,
  forwardRef,
  input,
  ViewEncapsulation,
} from '@angular/core';
import { MLV_LIST } from './list-token';

/**
 * Visual variant of the list container.
 *
 * - `plain` — spaced rows with no container styling (default).
 * - `inset` — grouped, elevated appearance: rows sit on a raised surface
 *   inside a sunken background, connected by inset dividers and topped with
 *   sticky group headers. The iOS/Apple Settings look.
 */
export type MlvListVariant = 'plain' | 'inset';

/**
 * Context-specific styling for the list. `mlv-list` is a shared primitive
 * used both as a standalone content list and as the panel container inside
 * overlays (select/combobox/autocomplete dropdowns, popover menus) — the two
 * contexts want different row rhythm, so `appearance` (orthogonal to
 * {@link MlvListVariant}) picks which one applies.
 *
 * - `default` — the airy standalone-list look: hairline separators between
 *   rows, taller row padding, square row corners (SL-R5).
 * - `menu` — compact overlay look: no hairline separators, tighter row
 *   padding, and rounded row corners for the hover/selection pill. Matches
 *   the pre-harmonization dropdown/menu rhythm. Set this on every `mlv-list`
 *   rendered inside an overlay panel.
 */
export type MlvListAppearance = 'default' | 'menu';

@Component({
  selector: 'mlv-list',
  templateUrl: './list.html',
  styleUrl: './list.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Published so descendants can adapt to the variant without importing the
  // concrete class. `MlvListItemGroup` is the one consumer today: `inset`
  // pins its content open, so it renders a plain section label instead of a
  // disclosure toggler.
  providers: [{ provide: MLV_LIST, useExisting: forwardRef(() => MlvList) }],
  host: {
    class: 'mlv-list',
    '[class]': '"mlv-list--" + variant()',
    '[class.mlv-list--appearance-menu]': 'appearance() === "menu"',
    '[attr.role]': 'listRole()',
  },
})
export class MlvList {
  /**
   * WAI-ARIA role for the list host element.
   * Override when the list is used in a context requiring a different role
   * (e.g. `'menu'` when used as a menu panel container).
   * Defaults to `'list'`.
   */
  readonly listRole = input<string>('list');

  /**
   * Visual variant of the list. See {@link MlvListVariant}.
   */
  readonly variant = input<MlvListVariant>('plain');

  /**
   * Context-specific styling. See {@link MlvListAppearance}. Defaults to
   * `'default'` (the standalone airy list look); every overlay panel
   * consumer (select/combobox/autocomplete dropdown, `mlv-menu`, popup
   * menus) sets `'menu'`.
   */
  readonly appearance = input<MlvListAppearance>('default');
}
