import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostAttributeToken,
  ViewEncapsulation,
  afterRenderEffect,
  computed,
  contentChild,
  contentChildren,
  effect,
  forwardRef,
  inject,
  input,
  untracked,
} from '@angular/core';
import { FocusKeyManager } from '@angular/cdk/a11y';
import { DOWN_ARROW, UP_ARROW } from '@angular/cdk/keycodes';
import type { Subscription } from 'rxjs';
import { MlvRtlService } from '@malva-ui/cdk/utils';
import { MlvLoader } from '@malva-ui/core/loader';
import { MlvMenuTrigger } from './menu-trigger';
import { MlvMenuDataRenderer } from './menu-data-renderer';
import { MlvMenuDataSourceAdapter } from './menu-data-source';
import { MlvMenuItemDef } from './menu-item-def';
import type { MlvMenuItemData, MlvMenubarEntry } from './menu-data.types';
import type { MlvMenubarDataSource } from './menubar.types';
import {
  MLV_MENUBAR_ITEM_REGISTRY,
  MlvMenubarItemRegistryStore,
} from './menubar-item-registry';
import { MENUBAR_TOKEN } from './menubar.types';
import type { MlvMenubarAccessor, MlvMenubarItem } from './menubar.types';

/**
 * Horizontal application menu bar (`mlv-menubar`) — a File / Edit / View style
 * row of top-level menu triggers, implementing the
 * [WAI-ARIA Menubar pattern](https://www.w3.org/WAI/ARIA/apg/patterns/menubar/).
 *
 * Wrap a set of `[mlvMenuTrigger]` elements. Each trigger opens a standard
 * `mlv-menu` dropdown; the bar coordinates them:
 *
 * - `role="menubar"` container with a **roving tabindex** across the top-level
 *   items (only the active item is in the tab order).
 * - `ArrowLeft` / `ArrowRight` move between top-level items (wrapping); `Home` /
 *   `End` jump to the first / last; printable characters type-ahead by label.
 * - `ArrowDown` / `Enter` / `Space` open the focused item's menu with focus on
 *   its first item; `ArrowUp` opens with focus on the last item (handled by the
 *   trigger).
 * - While any dropdown is open, hovering or arrowing to another top-level item
 *   closes the current menu and opens the sibling (hover-follow only-while-open).
 * - `ArrowRight` / `ArrowLeft` at the top level of an open dropdown cross to the
 *   adjacent menubar menu; a focused submenu trigger's own `ArrowRight` wins.
 * - `Escape` closes the menu and restores focus to its top-level item.
 *
 * Declare the `mlv-menu` panels **as siblings of the menubar** (outside its
 * content), so the bar's `contentChildren` query only picks up the top-level
 * triggers — see the example below.
 *
 * @example
 * ```html
 * <mlv-menubar aria-label="Main">
 *   <button mlvButton variant="transparent" [mlvMenuTrigger]="fileMenu">File</button>
 *   <button mlvButton variant="transparent" [mlvMenuTrigger]="editMenu">Edit</button>
 * </mlv-menubar>
 *
 * <mlv-menu #fileMenu label="File">
 *   <mlv-list-item mlvMenuItem (itemClick)="onNew()">New</mlv-list-item>
 * </mlv-menu>
 * <mlv-menu #editMenu label="Edit">
 *   <mlv-list-item mlvMenuItem (itemClick)="onUndo()">Undo</mlv-list-item>
 * </mlv-menu>
 * ```
 */
@Component({
  selector: 'mlv-menubar',
  template: `
    @if (_dataMode()) {
      @if (_dataSourceLoading()) {
        <mlv-loader variant="circle" indeterminate [size]="20" />
      } @else {
        <mlv-menu-data-renderer
          [items]="_dataSourceItems()"
          [itemDef]="_itemDef()"
          mode="menubar"
        />
      }
    } @else {
      <ng-content />
    }
  `,
  styleUrl: './menubar.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvLoader, forwardRef(() => MlvMenuDataRenderer)],
  host: {
    class: 'mlv-menubar',
    role: 'menubar',
    '[attr.aria-orientation]': '"horizontal"',
    '[attr.aria-label]': 'label() || _initialAriaLabel || null',
    '(keydown)': '_onKeydown($event)',
  },
  providers: [
    {
      provide: MENUBAR_TOKEN,
      useExisting: MlvMenubar,
    },
    {
      provide: MLV_MENUBAR_ITEM_REGISTRY,
      useFactory: () => new MlvMenubarItemRegistryStore(),
    },
  ],
})
export class MlvMenubar<
  TItem extends MlvMenuItemData<unknown> = MlvMenuItemData<unknown>,
> implements MlvMenubarAccessor
{
  // ─── Injected services ────────────────────────────────────────────────────

  /** @private Host element reference. */
  private readonly _elementRef = inject(ElementRef<HTMLElement>);
  private readonly _itemRegistry = inject(MLV_MENUBAR_ITEM_REGISTRY);
  private readonly _rtlService = inject(MlvRtlService);
  private readonly _dataSourceAdapter = new MlvMenuDataSourceAdapter<
    MlvMenubarEntry<TItem>
  >();

  /**
   * @private The `aria-label` the consumer placed directly on the `<mlv-menubar>`
   * element, captured before the host binding runs. Used as the accessible-name
   * fallback so a natively-provided `aria-label` is preserved when the `label`
   * input is not used — without it the `[attr.aria-label]` host binding would
   * clobber the consumer's attribute with `null`.
   */
  protected readonly _initialAriaLabel = inject(
    new HostAttributeToken('aria-label'),
    { optional: true },
  );

  // ─── Content children ─────────────────────────────────────────────────────

  private readonly _projectedItems = contentChildren(MlvMenuTrigger);

  /** @protected The projected row definition used by data-driven rendering. */
  protected readonly _itemDef = contentChild(MlvMenuItemDef<TItem>);

  /** @protected The registered top-level menu triggers, in render order. */
  protected readonly _items = this._itemRegistry.items;

  // ─── Inputs ───────────────────────────────────────────────────────────────

  /**
   * Accessible label for the menubar (`aria-label`). Use when there is no
   * visible heading that labels the bar.
   */
  readonly label = input<string>('');

  /**
   * Optional reactive source for the root menubar entries. Entries may be
   * menu-item data or `{ kind: 'divider', id }` separator records.
   */
  readonly dataSource = input<MlvMenubarDataSource<TItem> | undefined>(
    undefined,
  );

  // ─── Internal state ───────────────────────────────────────────────────────

  /**
   * @private `FocusKeyManager` managing the roving tabindex and horizontal
   * arrow / Home / End / type-ahead navigation across top-level items.
   */
  private _keyManager: FocusKeyManager<MlvMenubarItem> | null = null;

  /**
   * @private Subscription to the key manager's `change` stream, keeping the
   * roving tabindex in sync when type-ahead moves the active item.
   */
  private _changeSub: Subscription | null = null;

  /**
   * @private The top-level item whose dropdown is currently open, or `null`
   * when the whole bar is closed.
   */
  private _openItem: MlvMenubarItem | null = null;

  /** @protected Whether the bar is rendering reactive data instead of projected triggers. */
  protected readonly _dataMode = computed(
    () => this.dataSource() !== undefined,
  );

  /** @protected Current entries normalized from the active reactive source. */
  protected readonly _dataSourceItems = this._dataSourceAdapter.items;

  /** @protected Current source loading state. */
  protected readonly _dataSourceLoading = this._dataSourceAdapter.loading;

  constructor() {
    effect(() => {
      const source = this.dataSource();
      untracked(() => this._dataSourceAdapter.setSource(source ?? []));
    });

    afterRenderEffect(() => this._itemRegistry.resync());
    effect(() => {
      const projectedItems =
        this._projectedItems() as unknown as readonly MlvMenubarItem[];
      if (this._dataMode()) return;
      untracked(() => this._itemRegistry.syncOrder(projectedItems));
    });

    // (Re)build the key manager whenever the set of top-level items changes.
    //
    // The effect deliberately depends ONLY on the `_items()` query. All the
    // imperative work below both READS reactive signals (`menuTriggerDisabled()`
    // via the key manager's `skipPredicate`) and WRITES them (`_tabIndex` in
    // `_syncTabIndices`). Because writing `_tabIndex` dirties the child trigger
    // effects — and therefore the view — leaving those reads tracked would let
    // the effect re-notify itself on every view refresh, spinning synchronously.
    // Running the side effects in `untracked` keeps the sole reactive dependency
    // the item set, which is the only thing that should trigger a rebuild.
    effect(() => {
      const items = this._items() as unknown as MlvMenubarItem[];
      const direction = this._rtlService.direction();
      untracked(() => {
        if (items.length > 0) {
          this._initKeyManager(items, direction);
          this._syncTabIndices();
        }
      });
    });

    inject(DestroyRef).onDestroy(() => this._changeSub?.unsubscribe());
  }

  // ─── MlvMenubarAccessor ──────────────────────────────────────────────────────

  /** Host element of the menubar (used as a click-outside exclusion). */
  get hostElement(): HTMLElement {
    return this._elementRef.nativeElement;
  }

  /**
   * Records `item` as the open dropdown, closing any previously-open sibling
   * and syncing the roving tabindex so the bar's active item follows the open
   * menu. Called by a child trigger from its open path.
   */
  notifyItemOpened(item: MlvMenubarItem): void {
    const previous = this._openItem;
    this._openItem = item;
    if (previous && previous !== item) {
      previous.closeMenu();
    }
    this._keyManager?.setActiveItem(item);
    this._syncTabIndices();
  }

  /** Clears the open-item record when `item`'s dropdown closes. */
  notifyItemClosed(item: MlvMenubarItem): void {
    if (this._openItem === item) {
      this._openItem = null;
    }
  }

  /** Whether any dropdown in the bar is currently open. */
  hasOpenMenu(): boolean {
    return this._openItem !== null;
  }

  /**
   * Hover-follow: while a dropdown is already open, opening the hovered item's
   * dropdown (which, via `notifyItemOpened`, closes the previous one). Does
   * nothing when the bar is fully closed or the item is disabled/already open.
   */
  onItemPointerEnter(item: MlvMenubarItem): void {
    if (!this.hasOpenMenu()) return;
    if (item === this._openItem || item.disabledBoolean) return;
    item.openMenu();
  }

  /**
   * Crosses from the open dropdown to an adjacent top-level item's menu,
   * wrapping over disabled items, and opens it with focus on its first item.
   */
  openAdjacentItemMenu(from: MlvMenubarItem, dir: 1 | -1): void {
    const items = this._navigableItems();
    const index = items.indexOf(from);
    if (index === -1 || items.length === 0) return;

    const target = items[(index + dir + items.length) % items.length];
    if (target === from) return;

    from.closeMenu();
    this._keyManager?.setActiveItem(target);
    this._syncTabIndices();
    target.openMenuWithFirstItemFocused();
  }

  // ─── Protected handlers ───────────────────────────────────────────────────

  /**
   * @protected Menubar-level keyboard handler.
   *
   * Opening keys (`Enter`, `Space`, `ArrowDown`, `ArrowUp`) are handled by the
   * focused trigger itself, so they are ignored here. Everything else is routed
   * to `FocusKeyManager` for horizontal navigation, Home/End, and type-ahead.
   * If a dropdown is open when the active item changes, the newly-focused item's
   * menu is opened (open-follow).
   */
  protected _onKeydown(event: KeyboardEvent): void {
    const key = this._rtlService.normalizeArrowKey(event);
    switch (key ?? event.key) {
      case 'Enter':
      case ' ':
      case DOWN_ARROW:
      case UP_ARROW:
        return;
    }

    const keyManager = this._keyManager;
    if (!keyManager) return;

    const before = keyManager.activeItem;
    keyManager.onKeydown(event);
    const after = keyManager.activeItem;

    if (after && after !== before) {
      this._syncTabIndices();
      if (this._openItem && after !== this._openItem) {
        after.openMenu();
      }
    }
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  /**
   * @private Creates or replaces the `FocusKeyManager` with the current items,
   * using horizontal orientation, wrap, Home/End and type-ahead, skipping
   * disabled items. Sets the first item active so the bar has a tabbable entry.
   */
  private _initKeyManager(
    items: MlvMenubarItem[],
    direction: 'ltr' | 'rtl',
  ): void {
    this._changeSub?.unsubscribe();
    this._keyManager = new FocusKeyManager<MlvMenubarItem>(items)
      .withHorizontalOrientation(direction)
      .withWrap()
      .withHomeAndEnd()
      .withTypeAhead()
      .skipPredicate((item) => item.disabledBoolean);
    this._changeSub = this._keyManager.change.subscribe(() =>
      this._syncTabIndices(),
    );
    if (!this._keyManager.activeItem) {
      this._keyManager.setFirstItemActive();
    }
  }

  /**
   * @private Updates `_tabIndex` on every item so that only the active item has
   * `tabindex="0"` (roving tabindex). All others get `-1`.
   */
  private _syncTabIndices(): void {
    const active = this._keyManager?.activeItem;
    (this._items() as unknown as MlvMenubarItem[]).forEach((item) => {
      item._tabIndex.set(item === active ? 0 : -1);
    });
  }

  /** @private The non-disabled top-level items, in DOM order. */
  private _navigableItems(): MlvMenubarItem[] {
    return (this._items() as unknown as MlvMenubarItem[]).filter(
      (item) => !item.disabledBoolean,
    );
  }
}
