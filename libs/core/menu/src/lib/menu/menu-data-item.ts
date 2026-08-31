import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  ViewContainerRef,
  ViewEncapsulation,
  afterRenderEffect,
  computed,
  effect,
  forwardRef,
  inject,
  input,
  runInInjectionContext,
  Renderer2,
  signal,
  viewChild,
} from '@angular/core';
import { MlvLoader } from '@malva-ui/core/loader';
import {
  MLV_MENU_ITEM_REGISTRY,
  type MlvMenuItemRegistry,
} from './menu-item-registry';
import {
  MLV_MENUBAR_ITEM_REGISTRY,
  type MlvMenubarItemRegistry,
} from './menubar-item-registry';
import { MlvMenu } from './menu';
import { MlvMenuChildrenDataSource } from './menu-data-source';
import type { MlvMenuItemData, MlvMenuItemDefContext } from './menu-data.types';
import type { MlvMenuItemDef } from './menu-item-def';
import { MlvMenuItem } from './menu-item';
import { MlvMenuOverlayController } from './menu-overlay-controller';
import { MENUBAR_TOKEN } from './menubar.types';
import type { MlvMenubarAccessor, MlvMenubarItem } from './menubar.types';
import { MLV_MENU_DATA_ITEM, MENU_TOKEN } from './menu.types';
import type { MlvMenuAccessor, MlvMenuDataItemContext } from './menu.types';
import { MlvListItem } from '@malva-ui/core/list';

/** Internal generated row host for one data-driven menu item. */
@Component({
  selector: 'mlv-menu-data-item',
  template: `
    <ng-container
      [ngTemplateOutlet]="itemDef()?.templateRef ?? _defaultItemDef"
      [ngTemplateOutletContext]="context()"
      [ngTemplateOutletInjector]="rowInjector()"
    />

    @if (hasChildren()) {
      <mlv-menu #childMenu [label]="item().label">
        @if (loading()) {
          <div class="mlv-menu-data-renderer__loader">
            <mlv-loader variant="circle" indeterminate />
          </div>
        } @else {
          <mlv-menu-data-renderer
            [items]="childItems()"
            [itemDef]="itemDef()"
            mode="menu"
            [parentMenu]="childMenu"
            [menubar]="menubar()"
          />
        }
      </mlv-menu>
    }

    <ng-template #_defaultItemDef let-item>
      <mlv-list-item mlvMenuItem>{{ item.label }}</mlv-list-item>
    </ng-template>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgTemplateOutlet,
    MlvListItem,
    MlvLoader,
    forwardRef(() => MlvMenu),
    MlvMenuItem,
    forwardRef(() => MlvMenuDataRenderer),
  ],
  host: {
    class: 'mlv-menu-data-item',
  },
})
export class MlvMenuDataItem<
  TItem extends MlvMenuItemData<unknown> = MlvMenuItemData<unknown>,
> {
  private readonly _injector = inject(Injector);
  private readonly _viewContainerRef = inject(ViewContainerRef);
  private readonly _menuItemRegistry = inject<MlvMenuItemRegistry | null>(
    MLV_MENU_ITEM_REGISTRY,
    { optional: true },
  );
  private readonly _menubarItemRegistry = inject<MlvMenubarItemRegistry | null>(
    MLV_MENUBAR_ITEM_REGISTRY,
    { optional: true },
  );
  private readonly _hostElement = inject(ElementRef<HTMLElement>);
  private readonly _renderer = inject(Renderer2);
  private readonly _childMenu = viewChild<MlvMenu>(forwardRef(() => MlvMenu));
  private readonly _childrenSource =
    signal<MlvMenuChildrenDataSource<unknown> | null>(null);
  private _childrenIdentity: MlvMenuItemData<unknown>['children'] | undefined;
  private _registeredMenubarItem = false;

  /** Current row data. */
  readonly item = input.required<TItem>();

  /** Zero-based row index within the current level. */
  readonly index = input.required<number>();

  /** Optional projected row definition to stamp for this item. */
  readonly itemDef = input<MlvMenuItemDef<TItem> | undefined>(undefined);

  /** Menu/menubar rendering mode for this level. */
  readonly mode = input<'menu' | 'menubar'>('menu');

  /** Owning parent menu accessor. */
  readonly parentMenu = input<MlvMenuAccessor | null>(null);

  /** Root menubar accessor when relevant. */
  readonly menubar = input<MlvMenubarAccessor | null>(null);

  /** Menubar registry façade for a generated root data row. */
  private readonly _menubarItem: MlvMenubarItem = this._createMenubarItem();

  /** Typed template context for the stamped row. */
  protected readonly context = computed<MlvMenuItemDefContext<TItem>>(() => ({
    $implicit: this.item(),
    index: this.index(),
    hasChildren: this.hasChildren(),
    loading: this.loading(),
  }));

  /** Injector that reconnects generated rows to the menu contracts. */
  protected readonly rowInjector = computed(() =>
    Injector.create({
      providers: [
        {
          provide: MENU_TOKEN,
          useValue: this.parentMenu(),
        },
        {
          provide: MLV_MENU_ITEM_REGISTRY,
          useValue: this._menuItemRegistry,
        },
        {
          provide: MENUBAR_TOKEN,
          useValue: this.mode() === 'menubar' ? this.menubar() : null,
        },
        {
          provide: MLV_MENU_DATA_ITEM,
          useValue: this._dataItemContext,
        },
      ],
      parent: this._injector,
    }),
  );

  /**
   * @private Overlay origin for the generated submenu.
   *
   * Must be a real `ElementRef` instance: CDK's
   * `FlexibleConnectedPositionStrategy` only measures the DOM node when the
   * origin passes `instanceof ElementRef` (or `instanceof Element`), and reads
   * anything else as an `{x, y}` point — which anchors the submenu to the
   * viewport origin instead of its row. The `nativeElement` accessor stays
   * lazy because the row is stamped by `ngTemplateOutlet` after construction.
   */
  private readonly _originElement = Object.defineProperty(
    new ElementRef<HTMLElement>(this._hostElement.nativeElement),
    'nativeElement',
    {
      configurable: true,
      get: () =>
        this._getRenderedRowElement() ?? this._hostElement.nativeElement,
    },
  );

  private readonly _parentMenuProxy: MlvMenuAccessor = {
    close: () => this.parentMenu()?.close(),
    closeAll: () => this.parentMenu()?.closeAll(),
  };

  private readonly _menubarProxy: MlvMenubarAccessor =
    this._createMenubarProxy();

  private readonly _overlayController = new MlvMenuOverlayController({
    getMenu: () => {
      const menu = this._childMenu();
      if (!menu) {
        throw new Error('Generated submenu menu is not available.');
      }
      return menu;
    },
    origin: this._originElement,
    vcr: this._viewContainerRef,
    parentMenu: this._parentMenuProxy,
    menubar: null,
    isSubmenu: () => this.hasChildren(),
    isMenubarChild: false,
    isDisabled: () => !!this.item().disabled,
    getMenubarItem: () => {
      throw new Error('Generated data rows are not menubar triggers.');
    },
  });

  private readonly _menubarOverlayController = new MlvMenuOverlayController({
    getMenu: () => {
      const menu = this._childMenu();
      if (!menu) {
        throw new Error('Generated submenu menu is not available.');
      }
      return menu;
    },
    origin: this._originElement,
    vcr: this._viewContainerRef,
    parentMenu: null,
    menubar: this._menubarProxy,
    isSubmenu: () => false,
    isMenubarChild: true,
    isDisabled: () => !!this.item().disabled,
    getMenubarItem: () => this._menubarItem,
  });

  private readonly _dataItemContext: MlvMenuDataItemContext = {
    hasChildren: () => this.hasChildren(),
    loading: () => this.loading(),
    isOpen: () => this._activeOverlayController().isOpen(),
    panelId: () => this._childMenu()?.panelId ?? null,
    isDisabled: () => !!this.item().disabled,
    open: () => {
      this._ensureLoaded();
      this._activeOverlayController().open();
    },
    close: () => this._activeOverlayController().close(),
    toggle: () => {
      this._ensureLoaded();
      this._activeOverlayController().toggle();
    },
    openWithFirstItemFocused: () => {
      this._ensureLoaded();
      this._activeOverlayController().openWithFirstItemFocused();
    },
    openWithLastItemFocused: () => {
      this._ensureLoaded();
      this._activeOverlayController().openWithLastItemFocused();
    },
    onMouseEnter: () => {
      this._ensureLoaded();
      this._activeOverlayController().onMouseEnter();
    },
    onMouseLeave: (event: MouseEvent) =>
      this._activeOverlayController().onMouseLeave(event),
  };

  constructor() {
    const source = this._childrenSource;
    const injector = this._injector;

    effect(() => {
      const isMenubarItem =
        this.mode() === 'menubar' && this.menubar() !== null;
      if (
        isMenubarItem &&
        this._menubarItemRegistry &&
        !this._registeredMenubarItem
      ) {
        this._menubarItemRegistry.register(this._menubarItem);
        this._registeredMenubarItem = true;
      } else if (!isMenubarItem && this._registeredMenubarItem) {
        this._menubarItemRegistry?.unregister(this._menubarItem);
        this._registeredMenubarItem = false;
      }
    });

    afterRenderEffect(() => {
      const tabIndex = this._menubarItem._tabIndex();
      if (this.mode() !== 'menubar') return;
      const row = this._getRenderedRowElement();
      if (row) this._renderer.setAttribute(row, 'tabindex', String(tabIndex));
    });

    inject(DestroyRef).onDestroy(() => {
      if (this._registeredMenubarItem) {
        this._menubarItemRegistry?.unregister(this._menubarItem);
      }
    });

    effect(() => {
      const children = this.item().children;
      if (children === this._childrenIdentity) return;

      this._childrenSource()?.destroy();
      this._childrenIdentity = children;

      const nextSource = children
        ? runInInjectionContext(
            injector,
            () => new MlvMenuChildrenDataSource(children),
          )
        : null;
      source.set(nextSource);

      if (nextSource && this._activeOverlayController().isOpen()) {
        nextSource.ensureLoaded();
      }
    });
  }

  /** Whether this row currently advertises a generated submenu. */
  protected readonly hasChildren = computed(() => !!this.item().children);

  /** Whether the submenu is still waiting for its first child emission. */
  protected readonly loading = computed(
    () => this._childrenSource()?.loading() ?? false,
  );

  /** Current child collection for the generated submenu. */
  protected readonly childItems = computed(
    () => this._childrenSource()?.items() ?? [],
  );

  private _ensureLoaded(): void {
    this._childrenSource()?.ensureLoaded();
  }

  private _getRenderedRowElement(): HTMLElement | null {
    return this._hostElement.nativeElement.querySelector('mlv-list-item');
  }

  private _activeOverlayController(): MlvMenuOverlayController {
    return this.mode() === 'menubar'
      ? this._menubarOverlayController
      : this._overlayController;
  }

  private _createMenubarItem(): MlvMenubarItem {
    const item = {
      _elementRef: this._hostElement,
      _tabIndex: signal(-1),
      focus: () =>
        this._getRenderedRowElement()?.focus() ??
        this._hostElement.nativeElement.focus(),
      getLabel: () =>
        this._getRenderedRowElement()?.textContent?.trim() ?? this.item().label,
      isMenuOpen: () => this._menubarOverlayController.isOpen(),
      openMenu: () => {
        if (this.hasChildren()) this._menubarOverlayController.open();
      },
      closeMenu: () => this._menubarOverlayController.close(),
      openMenuWithFirstItemFocused: () => {
        if (this.hasChildren())
          this._menubarOverlayController.openWithFirstItemFocused();
      },
      openMenuWithLastItemFocused: () => {
        if (this.hasChildren())
          this._menubarOverlayController.openWithLastItemFocused();
      },
    } as MlvMenubarItem;
    Object.defineProperty(item, 'disabledBoolean', {
      get: () => !!this.item().disabled,
    });
    return item;
  }

  private _createMenubarProxy(): MlvMenubarAccessor {
    const proxy = {
      notifyItemOpened: (item) => this.menubar()?.notifyItemOpened(item),
      notifyItemClosed: (item) => this.menubar()?.notifyItemClosed(item),
      onItemPointerEnter: (item) => this.menubar()?.onItemPointerEnter(item),
      hasOpenMenu: () => this.menubar()?.hasOpenMenu() ?? false,
      openAdjacentItemMenu: (from, dir) =>
        this.menubar()?.openAdjacentItemMenu(from, dir),
    } as MlvMenubarAccessor;
    Object.defineProperty(proxy, 'hostElement', {
      get: () => this.menubar()?.hostElement ?? this._hostElement.nativeElement,
    });
    return proxy;
  }
}

import { MlvMenuDataRenderer } from './menu-data-renderer';
