import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  ViewEncapsulation,
} from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { inject } from '@angular/core';
import { LucideDynamicIcon } from '@lucide/angular';
import type { MlvNavItem } from '@malva-ui/cdk/utils';
import { MlvMenu, MlvMenuItem, MlvMenuTrigger } from '@malva-ui/core/menu';
import { MlvListItem, MlvListItemPrefix } from '@malva-ui/core/list';
import { MLV_BOTTOM_NAV_I18N } from '@malva-ui/i18n';

/** Maximum visible items before overflow is triggered. */
const MAX_VISIBLE = 5;

/** MlvLayout direction for icon and label within each navigation item. */
export type MlvBottomNavStacking = 'vertical' | 'horizontal';

/** Controls when item labels are visible. */
export type MlvBottomNavLabelVisibility = 'always' | 'active-only';

/**
 * Fixed bottom navigation bar for mobile contexts.
 * Renders up to 5 items; overflows into a synthetic "More" item
 * that opens a menu with the hidden items.
 *
 * Supports two activation modes:
 * - **Router mode** (default): active state is driven by `routerLinkActive`.
 *   Items are rendered as `<a>` elements with `routerLink`.
 * - **Managed mode**: when `activeIndex` is provided, active state is
 *   controlled by the consumer. Items are rendered as `<button>` elements
 *   and clicks emit on the `itemClick` output.
 *
 * Also supports vertical/horizontal stacking, active-only label visibility,
 * and per-item disabled state.
 *
 * @example
 * <mlv-bottom-nav *mlvBreakpointDown="'md'" [items]="navItems" />
 *
 * @example
 * <mlv-bottom-nav [items]="navItems" [activeIndex]="selected" (itemClick)="selected = $event" />
 */
@Component({
  selector: 'mlv-bottom-nav',
  templateUrl: './bottom-nav.html',
  styleUrl: './bottom-nav.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    RouterLinkActive,
    LucideDynamicIcon,
    MlvMenu,
    MlvMenuItem,
    MlvMenuTrigger,
    MlvListItem,
    MlvListItemPrefix,
  ],
  host: {
    class: 'mlv-bottom-nav',
    '[class.mlv-bottom-nav--horizontal]': 'stacking() === "horizontal"',
    '[class.mlv-bottom-nav--label-active-only]':
      'labelVisibility() === "active-only"',
    role: 'navigation',
    '[attr.aria-label]': 'ariaLabel() || _i18n().navigation',
  },
})
export class MlvBottomNav {
  /** @protected The component's i18n strings signal. */
  protected readonly _i18n = inject(MLV_BOTTOM_NAV_I18N);

  /**
   * Navigation items to display.
   * Up to 5 items are shown; if more than 5 are provided,
   * the first 4 are rendered and a "More" button opens a menu with the overflow items.
   */
  readonly items = input.required<MlvNavItem[]>();

  /** Accessible label for the nav landmark. */
  readonly ariaLabel = input<string>();

  /**
   * MlvLayout direction for icon and label within each item.
   * - `'vertical'` (default): icon on top, label below.
   * - `'horizontal'`: icon on the left, label on the right, vertically centered.
   */
  readonly stacking = input<MlvBottomNavStacking>('vertical');

  /**
   * Controls when item labels are visible.
   * - `'always'` (default): labels are always shown on all items.
   * - `'active-only'`: labels are hidden by default and smoothly revealed
   *   only on the active (current route) item. The "More" button label
   *   is always visible regardless of this setting.
   */
  readonly labelVisibility = input<MlvBottomNavLabelVisibility>('always');

  /**
   * Index of the active item in managed mode.
   * When provided (even as `0`), the component switches to managed mode:
   * items render as `<button>` elements instead of `<a routerLink>` and
   * the active class is driven by this index rather than the router.
   */
  readonly activeIndex = input<number>();

  /**
   * Emits the index of the clicked item in managed mode.
   * Not emitted for disabled items or in router mode.
   */
  readonly itemClick = output<number>();

  /** @private Router for programmatic navigation from overflow menu items. */
  private readonly _router = inject(Router);

  /**
   * @protected Whether the component is in managed (non-router) mode.
   * True when `activeIndex` has been explicitly provided.
   */
  protected readonly _isManaged = computed(
    () => this.activeIndex() !== undefined,
  );

  /**
   * @protected Items displayed as direct nav links in the bar.
   * All items if total <= MAX_VISIBLE, otherwise the first (MAX_VISIBLE - 1).
   */
  protected readonly _displayItems = computed(() => {
    const all = this.items();
    if (all.length <= MAX_VISIBLE) return all;
    return all.slice(0, MAX_VISIBLE - 1);
  });

  /**
   * @protected Items that overflow into the "More" menu.
   * Empty if total <= MAX_VISIBLE.
   */
  protected readonly _overflowItems = computed(() => {
    const all = this.items();
    if (all.length <= MAX_VISIBLE) return [];
    return all.slice(MAX_VISIBLE - 1);
  });

  /**
   * @protected Whether the bar has overflow items requiring a "More" button.
   */
  protected readonly _hasOverflow = computed(
    () => this._overflowItems().length > 0,
  );

  /**
   * @protected Handles click on a visible item in managed mode.
   * Emits the item's index on `itemClick`.
   */
  protected _onItemClick(index: number): void {
    this.itemClick.emit(index);
  }

  /**
   * @protected Handles click on an overflow menu item.
   * In managed mode, emits the global index on `itemClick`.
   * In router mode, navigates to the item's route.
   */
  protected _onOverflowItemClick(overflowIndex: number): void {
    if (this._isManaged()) {
      const globalIndex = this._displayItems().length + overflowIndex;
      this.itemClick.emit(globalIndex);
    } else {
      const item = this._overflowItems()[overflowIndex];
      if (item?.route) {
        this._router.navigateByUrl(item.route);
      }
    }
  }
}
