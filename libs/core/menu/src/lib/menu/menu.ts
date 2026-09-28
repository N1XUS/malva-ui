import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  ViewEncapsulation,
  afterRenderEffect,
  computed,
  contentChild,
  contentChildren,
  effect,
  forwardRef,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { FocusKeyManager } from '@angular/cdk/a11y';
import { LEFT_ARROW, RIGHT_ARROW } from '@angular/cdk/keycodes';
import type { Subscription } from 'rxjs';
import { MlvPopup, MlvPopupContent } from '@malva-ui/core/popup';
import { MlvList } from '@malva-ui/core/list';
import { MlvLoader } from '@malva-ui/core/loader';
import { MlvRtlService, mlvNextId } from '@malva-ui/cdk/utils';
import { MLV_DENSITY_CONTEXT } from '@malva-ui/cdk/density';
import type { MlvDensity } from '@malva-ui/cdk/density';
import { MlvMenuItem } from './menu-item';
import { MlvMenuDataRenderer } from './menu-data-renderer';
import { MlvMenuDataSourceAdapter } from './menu-data-source';
import type { MlvMenuDataSource, MlvMenuItemData } from './menu-data.types';
import { MlvMenuItemDef } from './menu-item-def';
import {
  MLV_MENU_ITEM_REGISTRY,
  MlvMenuItemRegistryStore,
  type MenuKeyItem,
} from './menu-item-registry';
import { MENU_TOKEN } from './menu.types';
import type { MlvMenuAccessor } from './menu.types';
import type { MlvMenubarMenuController } from './menubar.types';

/**
 * Whether two item snapshots hold the same members in the same order.
 * Used to skip key-manager rebuilds when a change-detection pass re-runs the
 * content query without actually changing the projected items.
 * @private
 */
interface MlvMenuItemSnapshot {
  readonly item: MenuKeyItem;
  readonly disabled: boolean;
}

function mlvSameMenuItems(
  a: readonly MlvMenuItemSnapshot[],
  b: readonly MenuKeyItem[],
): boolean {
  return (
    a.length === b.length &&
    a.every(
      (item, index) =>
        item.item === b[index] && item.disabled === b[index].disabledBoolean,
    )
  );
}

/**
 * The first item at or after `start` that is not disabled, falling back to the
 * closest enabled item before `start`. Returns `null` when every item is
 * disabled (or the list is empty).
 * @private
 */
function mlvNearestEnabledItem(
  items: readonly MenuKeyItem[],
  start: number,
): MenuKeyItem | null {
  for (let index = Math.max(start, 0); index < items.length; index++) {
    if (!items[index].disabledBoolean) return items[index];
  }
  for (let index = Math.min(start, items.length) - 1; index >= 0; index--) {
    if (!items[index].disabledBoolean) return items[index];
  }
  return null;
}

/**
 * Dropdown menu panel (`mlv-menu`).
 *
 * Renders a `role="menu"` panel containing `mlv-menu-item`, `mlv-menu-separator`,
 * and `mlv-menu-group` children. Manages keyboard navigation (ArrowUp, ArrowDown,
 * Home, End, Escape) via `FocusKeyManager`.
 *
 * The menu uses `mlv-popup` for visual chrome (background, border, radius, shadow,
 * animations). The panel is rendered inside the popup's content template via
 * `[mlvPopupContent]`, so no DOM manipulation is required.
 *
 * @example
 * ```html
 * <button [mlvMenuTrigger]="myMenu">Open</button>
 * <mlv-menu #myMenu>
 *   <mlv-menu-item (itemClick)="onEdit()">Edit</mlv-menu-item>
 *   <mlv-menu-separator />
 *   <mlv-menu-item (itemClick)="onDelete()">Delete</mlv-menu-item>
 * </mlv-menu>
 * ```
 */
@Component({
  selector: 'mlv-menu',
  template: `
    <mlv-popup
      #_popup
      [position]="['bottom-start', 'top-start', 'bottom-end', 'top-end']"
      [hasShadow]="true"
      [restrictPosition]="false"
      [mlvDensity]="mlvDensity()"
      [class]="'mlv-menu__popup'"
    >
      <ng-template mlvPopupContent>
        <mlv-list
          listRole="menu"
          appearance="menu"
          class="mlv-menu__panel"
          tabindex="-1"
          [id]="panelId"
          [attr.aria-label]="label() || null"
          (keydown)="_onKeydown($event)"
          (focusin)="_onFocusIn($event)"
        >
          @if (_dataMode()) {
            @if (_dataSourceLoading()) {
              <div class="mlv-menu__loader">
                <mlv-loader variant="circle" indeterminate [size]="20" />
              </div>
            } @else {
              <mlv-menu-data-renderer
                [items]="_dataSourceItems()"
                [itemDef]="_itemDef()"
                mode="menu"
              />
            }
          } @else {
            <ng-content />
          }
        </mlv-list>
      </ng-template>
    </mlv-popup>
  `,
  styleUrl: './menu.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MlvPopup,
    MlvPopupContent,
    MlvList,
    MlvLoader,
    forwardRef(() => MlvMenuDataRenderer),
  ],
  host: {
    class: 'mlv-menu',
    '[class.mlv-menu--open]': '_isOpen()',
  },
  providers: [
    {
      provide: MENU_TOKEN,
      useExisting: MlvMenu,
    },
    {
      provide: MLV_MENU_ITEM_REGISTRY,
      useFactory: () => new MlvMenuItemRegistryStore(),
    },
    // Consumer-projected items are declared in the consumer's template, so
    // their node injector reaches this host, not the `mlv-popup` they render
    // inside (#364). Hand them the same scope the popup hands its own content.
    {
      provide: MLV_DENSITY_CONTEXT,
      useFactory: () => inject(MlvMenu)._scopeDensity,
    },
  ],
})
export class MlvMenu<
  TItem extends MlvMenuItemData<unknown> = MlvMenuItemData<unknown>,
> implements MlvMenuAccessor
{
  // ─── Injected services ────────────────────────────────────────────────────

  /**
   * @private Element reference for the host element.
   */
  readonly _elementRef = inject(ElementRef<HTMLElement>);
  private readonly _itemRegistry = inject(MLV_MENU_ITEM_REGISTRY);
  private readonly _dataSourceAdapter = new MlvMenuDataSourceAdapter<TItem>();

  // ─── View children ────────────────────────────────────────────────────────

  /**
   * @private The popup component managing the overlay chrome (background, border, shadow, animations).
   * Accessed by `MlvMenuTrigger` to open the overlay and manage animation state.
   * The menu panel (`mlv-list`) is declared inside this popup's `[mlvPopupContent]` template.
   */
  readonly _popup = viewChild.required<MlvPopup>('_popup');

  // ─── Content children ────────────────────────────────────────────────────

  private readonly _projectedItems = contentChildren(MlvMenuItem);

  /** @protected The projected row definition used by data-driven rendering. */
  protected readonly _itemDef = contentChild(MlvMenuItemDef<TItem>);

  /** @protected All registered menu items, in render order. */
  protected readonly _items = this._itemRegistry.items;

  /** @protected Items currently rendered in this menu panel. */
  protected readonly _navigationItems = computed(() => {
    const items = this._items() as readonly MenuKeyItem[];
    items.forEach((item) => void item.disabledBoolean);
    if (!this._dataMode()) return items;

    return items.filter((item) =>
      item._elementRef?.nativeElement.closest('[role="menu"]'),
    );
  });

  // ─── Inputs ───────────────────────────────────────────────────────────────

  /**
   * Accessible label for the menu panel (`aria-label`).
   * Use when there is no visible heading that labels the menu.
   */
  readonly label = input<string>('');

  /**
   * Density applied to the menu panel's item rows.
   *
   * The panel is portaled to the CDK overlay container, outside the trigger's
   * DOM tree, so ancestor density classes cannot cascade into it. Forwarded to
   * the underlying `mlv-popup`, which stamps the resolved `mlv--{density}`
   * class on the detached panel, and handed to the items through
   * `MLV_DENSITY_CONTEXT` — projected and data-driven alike — which is what
   * each `mlv-list-item` row stamps its own modifier from (#364). When
   * omitted, the nearest ancestor density scope applies, then the global
   * `MlvDensityService`. Submenus are separate `mlv-menu` instances; one
   * declared inside this menu's content inherits this value as its scope, and
   * its own input overrides it.
   */
  readonly mlvDensity = input<MlvDensity | undefined>(undefined);

  /**
   * @private Density scope inherited from above this menu. `skipSelf`: the menu
   * provides the token for its own items.
   */
  private readonly _densityContext = inject(MLV_DENSITY_CONTEXT, {
    optional: true,
    skipSelf: true,
  });

  /**
   * @internal The density scope this menu hands to its items through
   * `MLV_DENSITY_CONTEXT`: the explicit {@link mlvDensity}, else the inherited
   * scope, else `undefined` (no opinion — the service applies below). Read by
   * this component's own provider only.
   */
  readonly _scopeDensity = computed<MlvDensity | undefined>(
    () => this.mlvDensity() ?? this._densityContext?.(),
  );

  /**
   * Optional data source for this menu. Arrays render immediately; an
   * `MlvDataSource` supplies the current collection and loading state.
   */
  readonly dataSource = input<MlvMenuDataSource<TItem> | undefined>(undefined);

  // ─── Public identifiers ────────────────────────────────────────────────────

  /**
   * Stable DOM id of the menu panel (`role="menu"` list). Consumed by
   * `MlvMenuTrigger` to wire `aria-controls` from the trigger to the panel.
   */
  readonly panelId = mlvNextId('mlv-menu-panel');

  // ─── Outputs ──────────────────────────────────────────────────────────────

  /**
   * Emits when the menu requests to be closed (e.g., Escape key, Tab key,
   * or after a menu item is activated).
   */
  readonly closed = output<void>();

  // ─── Internal state ───────────────────────────────────────────────────────

  /**
   * @private Whether the panel is currently open. Set by `MlvMenuTrigger`.
   */
  readonly _isOpen = signal(false);

  /** @protected Whether this menu is using data-driven rather than projected content. */
  protected readonly _dataMode = computed(
    () => this.dataSource() !== undefined,
  );

  /** @protected Current data-driven items normalized from the active source. */
  protected readonly _dataSourceItems = this._dataSourceAdapter.items;

  /** @protected Current loading state normalized from the active source. */
  protected readonly _dataSourceLoading = this._dataSourceAdapter.loading;

  /**
   * @private Parent menu that opened this menu as a submenu.
   */
  private _parentMenu: MlvMenuAccessor | null = null;

  /**
   * @private Controller supplied by the opening `MlvMenuTrigger` when this
   * menu is a top-level menubar dropdown. Enables ArrowRight / ArrowLeft at the
   * top level of the panel to cross to the adjacent menubar menu. `null` for
   * standalone menus and submenus.
   */
  private _menubarController: MlvMenubarMenuController | null = null;

  /** @private Normalizes horizontal menu navigation for RTL layouts. */
  private readonly _rtlService = inject(MlvRtlService);

  /**
   * @private `FocusKeyManager` managing the menu items.
   * Initialized lazily when items are first available.
   */
  private _keyManager: FocusKeyManager<MenuKeyItem> | null = null;

  /**
   * @private Subscription to the key manager's `change` stream, used to keep the
   * roving tabindex in sync when type-ahead moves the active item asynchronously.
   */
  private _changeSub: Subscription | null = null;

  /**
   * @private Snapshot of the items the current `_keyManager` was built from.
   * Compared member-by-member so a change-detection pass that re-runs the content
   * query without changing the projected items does not rebuild the manager —
   * a rebuild resets `activeItemIndex` and would wipe the roving tabindex.
   */
  private _managedItems: readonly MlvMenuItemSnapshot[] | null = null;

  /** @private The last menu item that received focus, retained across row removal. */
  private _focusedItem: MenuKeyItem | null = null;

  constructor() {
    effect(() => {
      const source = this.dataSource();
      untracked(() => this._dataSourceAdapter.setSource(source ?? []));
    });

    afterRenderEffect(() => this._itemRegistry.resync());
    afterRenderEffect(() => {
      if (!this._dataMode()) return;
      this._dataSourceItems();
      untracked(() => this._syncKeyManager(this._navigationItems()));
    });
    effect(() => {
      const projectedItems =
        this._projectedItems() as unknown as readonly MenuKeyItem[];
      untracked(() => this._itemRegistry.syncOrder(projectedItems));
    });

    // Rebuild the key manager only when the projected item set actually changes.
    //
    // The work runs `untracked` on purpose. `_syncTabIndices()` reads
    // `FocusKeyManager.activeItem`, which CDK backs with a signal; reading it in
    // the effect's reactive context made the effect depend on the active item, so
    // *every* arrow keypress re-ran the effect, replaced the manager and reset
    // `activeItemIndex` to -1 — no item ever kept `tabindex="0"` and ArrowDown /
    // ArrowUp always snapped back to the first / last item. `_navigationItems()`
    // must stay the effect's only dependency.
    effect(() => {
      const items = this._navigationItems();
      if (this._dataMode()) this._dataSourceItems();
      untracked(() => this._syncKeyManager(items));
    });

    inject(DestroyRef).onDestroy(() => this._teardownKeyManager());
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  /**
   * Focuses the first non-disabled item in the menu.
   * Called by `MlvMenuTrigger` when the menu opens via keyboard ArrowDown or Enter.
   */
  focusFirstItem(): void {
    this._keyManager?.setFirstItemActive();
    this._syncTabIndices();
  }

  /**
   * Focuses the last non-disabled item in the menu.
   * Called by `MlvMenuTrigger` when the menu opens via keyboard ArrowUp.
   */
  focusLastItem(): void {
    this._keyManager?.setLastItemActive();
    this._syncTabIndices();
  }

  // ─── MlvMenuAccessor ─────────────────────────────────────────────────────────

  /**
   * Closes the menu panel by emitting the `closed` output.
   * Called by `MlvMenuItem` after item activation and by the keyboard handler.
   */
  close(): void {
    this._isOpen.set(false);
    this.closed.emit();
  }

  /**
   * Closes this menu panel and any ancestor menu panels.
   * Called by submenu items so selecting a nested action dismisses the full menu stack.
   */
  closeAll(): void {
    this.close();
    this._parentMenu?.closeAll();
  }

  /**
   * Registers the parent menu that owns this menu when it is opened as a submenu.
   * Called by `MlvMenuTrigger` while opening submenu overlays.
   */
  registerParentMenu(parentMenu: MlvMenuAccessor | null): void {
    this._parentMenu = parentMenu;
  }

  /**
   * Registers (or clears) the menubar controller when this menu is opened as a
   * top-level menubar dropdown. Called by `MlvMenuTrigger` while opening.
   */
  registerMenubarController(controller: MlvMenubarMenuController | null): void {
    this._menubarController = controller;
  }

  // ─── Protected handlers ──────────────────────────────────────────────────

  /**
   * @protected Routes keydown events to `FocusKeyManager` and handles Escape / Tab.
   */
  protected _onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
      return;
    }

    if (event.key === 'Tab') {
      // Close the menu and let the trigger restore focus (see MlvMenuTrigger).
      event.preventDefault();
      event.stopPropagation();
      this.close();
      return;
    }

    // Resolved against the panel the handler is bound to, NOT `_elementRef`.
    // `<mlv-menu>` stays at its declaration site while its panel is portaled
    // into a CDK overlay pane whose `dir` comes from the *trigger*
    // (`MlvPopupService` → `resolveDirection(config.origin)`). A menu declared
    // once at page level and triggered from inside a `[dir="rtl"]` subtree
    // would otherwise resolve LTR from its own host while the pane it renders
    // into is mirrored — arrow keys running the opposite way to the layout,
    // which is the exact #147 symptom this call site exists to fix.
    // `currentTarget` is the `<mlv-list>` panel, always inside the pane.
    //
    // This is the one arrow-key handler that resolves per event instead of
    // reading a cached `elementDirection` signal: the element that scopes it is
    // the panel, which is re-created per overlay attach and can be attached
    // from triggers in different `[dir]` scopes, so there is no static target
    // to cache against. The walk is a handful of `parentElement` hops inside a
    // menu panel.
    const panel =
      event.currentTarget instanceof Element
        ? event.currentTarget
        : this._elementRef;
    const key = this._rtlService.normalizeArrowKey(
      event,
      this._rtlService.resolveDirection(panel),
    );

    // Top-level menubar dropdown: ArrowRight / ArrowLeft cross to the adjacent
    // menubar menu. A focused submenu-trigger item handles ArrowRight itself
    // (and stops propagation), so the submenu opens instead — submenu wins.
    if (this._menubarController) {
      if (key === RIGHT_ARROW) {
        event.preventDefault();
        event.stopPropagation();
        this._menubarController.openNextItemMenu();
        return;
      }
      if (key === LEFT_ARROW && !this._parentMenu) {
        event.preventDefault();
        event.stopPropagation();
        this._menubarController.openPreviousItemMenu();
        return;
      }
    }

    // ArrowLeft inside a submenu closes it and returns focus to the parent
    // trigger item (handled by the submenu trigger's close-focus restore).
    if (key === LEFT_ARROW && this._parentMenu) {
      event.preventDefault();
      event.stopPropagation();
      this.close();
      return;
    }

    this._keyManager?.onKeydown(event);
    this._syncTabIndices();
  }

  /** @protected Remembers item focus before a live data update can remove its row. */
  protected _onFocusIn(event: FocusEvent): void {
    const target = event.target;
    this._focusedItem =
      this._navigationItems().find(
        (item) => item._elementRef?.nativeElement === target,
      ) ?? null;
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  /**
   * @private Reconciles the `FocusKeyManager` with the projected items.
   *
   * No-ops when the item set is unchanged — rebuilding a manager throws away its
   * `activeItemIndex`, which is what previously broke arrow navigation. When the
   * set really did change the manager is replaced and the active item carried
   * over, so the roving tabindex survives adding or removing an item.
   */
  private _syncKeyManager(items: readonly MenuKeyItem[]): void {
    if (this._managedItems && mlvSameMenuItems(this._managedItems, items)) {
      return;
    }

    const previousItem = this._keyManager?.activeItem ?? null;
    const previousIndex = this._keyManager?.activeItemIndex ?? -1;

    // Snapshot so later in-place mutation of the query result cannot make the
    // comparison above lie, and so the manager holds a stable item array.
    const snapshot = Array.from(items);
    this._managedItems = snapshot.map((item) => ({
      item,
      disabled: item.disabledBoolean,
    }));
    this._teardownKeyManager();

    if (snapshot.length > 0) {
      this._initKeyManager(snapshot);
      this._restoreActiveItem(snapshot, previousItem, previousIndex);
    }

    this._syncTabIndices();
  }

  /**
   * @private Creates the `FocusKeyManager` for `items`.
   * Skips items whose `disabled` property is `true`.
   *
   * `withTypeAhead()` enables type-to-focus (press a letter to jump to the
   * first matching item by its `getLabel()`). Type-ahead matching is debounced
   * and can move the active item outside of `_onKeydown`, so the manager's
   * `change` stream is used to keep the roving tabindex in sync.
   */
  private _initKeyManager(items: readonly MenuKeyItem[]): void {
    this._keyManager = new FocusKeyManager(items)
      .withVerticalOrientation()
      .withWrap()
      .withHomeAndEnd()
      .withTypeAhead()
      .skipPredicate((item) => item.disabledBoolean);
    this._changeSub = this._keyManager.change.subscribe(() =>
      this._syncTabIndices(),
    );
  }

  /**
   * @private Disposes the current key manager and its `change` subscription.
   */
  private _teardownKeyManager(): void {
    this._changeSub?.unsubscribe();
    this._changeSub = null;
    this._keyManager?.destroy();
    this._keyManager = null;
  }

  /**
   * @private Carries the active item of the previous key manager over to a freshly
   * built one, using `updateActiveItem()` so the roving tabindex is restored
   * without stealing DOM focus. When the previously active item was removed (or
   * became disabled) the nearest enabled item to its old position takes over.
   * Does nothing when no item was active yet.
   */
  private _restoreActiveItem(
    items: readonly MenuKeyItem[],
    previousItem: MenuKeyItem | null,
    previousIndex: number,
  ): void {
    const keyManager = this._keyManager;
    if (!keyManager || previousIndex < 0) return;
    const shouldRestoreFocus = this._focusedItem === previousItem;

    if (
      previousItem &&
      !previousItem.disabledBoolean &&
      items.indexOf(previousItem) > -1
    ) {
      keyManager.updateActiveItem(previousItem);
      return;
    }

    const fallback = mlvNearestEnabledItem(items, previousIndex);
    if (fallback) keyManager.updateActiveItem(fallback);

    if (fallback && shouldRestoreFocus && this._isOpen()) {
      this._focusedItem = fallback;
      fallback.focus();
    }
  }

  /**
   * @private Updates `_tabIndex` on every item so that exactly one item has
   * `tabindex="0"` (roving tabindex pattern) and all others have `-1`.
   *
   * That is the active item once keyboard navigation has started. Before then —
   * a pointer-opened panel puts focus on the `role="menu"` list itself — the first
   * enabled item is the tab stop, so the open menu is never entirely untabbable.
   */
  private _syncTabIndices(): void {
    const items = this._navigationItems();
    const activeItem = (this._keyManager?.activeItem ??
      null) as MenuKeyItem | null;
    const tabbableItem = activeItem ?? mlvNearestEnabledItem(items, 0);
    items.forEach((item) => item._tabIndex.set(item === tabbableItem ? 0 : -1));
  }
}
