import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ErrorHandler,
  inject,
  input,
  output,
  untracked,
  ViewEncapsulation,
} from '@angular/core';
import {
  ActivatedRoute,
  isActive,
  Router,
  RouterLink,
  RouterLinkActive,
} from '@angular/router';
import type { IsActiveMatchOptions, UrlTree } from '@angular/router';
import { LucideDynamicIcon } from '@lucide/angular';
import type { MlvNavItem } from '@malva-ui/cdk/utils';
import { MlvMenu, MlvMenuItem, MlvMenuTrigger } from '@malva-ui/core/menu';
import { MlvListItem, MlvListItemPrefix } from '@malva-ui/core/list';
import { MLV_BOTTOM_NAV_I18N } from '@malva-ui/i18n';

/** Maximum visible items before overflow is triggered. */
const MAX_VISIBLE = 5;

/**
 * When a route counts as the current destination: the whole path and the
 * query must match, fragment and matrix parameters are ignored. This is what
 * `routerLinkActiveOptions: { exact: true }` resolves to inside
 * `RouterLinkActive`, written out so the bar's links and the overflow items
 * read one object and cannot disagree.
 */
const ACTIVE_MATCH_OPTIONS: IsActiveMatchOptions = {
  paths: 'exact',
  queryParams: 'exact',
  fragment: 'ignored',
  matrixParams: 'ignored',
};

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
 * An item moved into the "More" menu keeps its contract: a disabled item is
 * inert there too, a relative `route` resolves as it would on a bar link, and
 * when the current item is behind "More" the trigger shows it (`--active`,
 * `aria-current="true"`) and the menu row carries `aria-current="page"`.
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
   * Emits the index of the clicked item in managed mode — its index in
   * `items`, so an item chosen from the "More" menu emits its global index.
   * Not emitted for disabled items (in the bar or in the "More" menu) or in
   * router mode.
   */
  readonly itemClick = output<number>();

  /** @private Router for programmatic navigation from overflow menu items. */
  private readonly _router = inject(Router);

  /**
   * @private The route the bar's `routerLink`s resolve relative paths
   * against — `RouterLink` injects the same `ActivatedRoute` from this
   * component's injector — so an overflow item resolves `route` exactly as a
   * bar item would.
   *
   * Optional: `ActivatedRoute` is provided only by `provideRouter()` /
   * `RouterModule.forRoot()`, while `Router` is root-provided, and managed
   * mode renders no `routerLink` — it must work in an app with no router
   * providers at all. `null` makes `createUrlTree` resolve from the root.
   */
  private readonly _route = inject(ActivatedRoute, { optional: true });

  /**
   * @private Receives a failed overflow navigation, where `RouterLink` sends
   * a failed bar navigation, instead of leaving an unhandled rejection.
   */
  private readonly _errorHandler = inject(ErrorHandler);

  /** @protected Match options shared by the bar's `routerLinkActive` and the overflow items. */
  protected readonly _activeMatchOptions = ACTIVE_MATCH_OPTIONS;

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
   * @protected Per overflow item, whether it is the current destination — the
   * answer the bar gives for its own items. Managed mode: its global index is
   * `activeIndex`, disabled or not (as a bar button is). Router mode: an
   * enabled item whose URL matches the router's under
   * {@link ACTIVE_MATCH_OPTIONS}, which is when `routerLinkActive` marks a bar
   * link; a disabled bar item renders no link and is never router-active, so
   * a disabled overflow item is not either.
   *
   * Router mode reads `lastSuccessfulNavigation()` itself rather than relying
   * on the signal `isActive()` returns: a relative route's URL tree depends on
   * the `ActivatedRoute` snapshot, so the trees are rebuilt on every
   * navigation, as `RouterLink` rebuilds its own. Before the first navigation
   * nothing is active, matching `RouterLinkActive`'s `router.navigated` guard.
   */
  protected readonly _overflowActive = computed<readonly boolean[]>(() => {
    const overflow = this._overflowItems();
    if (this._isManaged()) {
      const offset = this._displayItems().length;
      const active = this.activeIndex();
      return overflow.map((_, index) => offset + index === active);
    }
    if (!this._router.lastSuccessfulNavigation()) {
      return overflow.map(() => false);
    }
    return overflow.map((item) => {
      if (item.disabled) return false;
      const urlTree = this._urlTreeFor(item);
      return (
        urlTree !== null &&
        untracked(isActive(urlTree, this._router, ACTIVE_MATCH_OPTIONS))
      );
    });
  });

  /**
   * @protected Whether the current destination sits behind "More". The bar
   * then has no current item of its own, so the "More" trigger carries the
   * active look and `aria-current="true"`; the menu row itself carries
   * `aria-current="page"`.
   */
  protected readonly _moreActive = computed(() =>
    this._overflowActive().includes(true),
  );

  /**
   * @protected Handles click on a visible item in managed mode.
   * Emits the item's index on `itemClick`.
   */
  protected _onItemClick(index: number): void {
    this.itemClick.emit(index);
  }

  /**
   * @protected Handles activation of an overflow menu item. A disabled item
   * does nothing — its menu row is disabled too, this guards any other path.
   * In managed mode, emits the item's global index on `itemClick`.
   * In router mode, navigates to the same URL tree a bar `routerLink` builds.
   */
  protected _onOverflowItemClick(overflowIndex: number): void {
    const item = this._overflowItems()[overflowIndex];
    if (!item || item.disabled) return;

    if (this._isManaged()) {
      this.itemClick.emit(this._displayItems().length + overflowIndex);
      return;
    }

    const urlTree = this._urlTreeFor(item);
    if (urlTree) {
      this._router
        .navigateByUrl(urlTree)
        .catch((error: unknown) => this._errorHandler.handleError(error));
    }
  }

  /**
   * @private The URL tree an item's `route` resolves to, built the way
   * `RouterLink` builds one: a non-array value is wrapped in an array and
   * resolved relative to the injected route, and a nullish one yields no tree.
   * A leading `/` stays absolute; anything else is relative, as on a bar link.
   */
  private _urlTreeFor(item: MlvNavItem): UrlTree | null {
    if (item.route == null) return null;
    return this._router.createUrlTree([item.route], {
      relativeTo: this._route,
    });
  }
}
