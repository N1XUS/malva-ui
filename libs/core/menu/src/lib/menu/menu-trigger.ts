import {
  DestroyRef,
  Directive,
  ElementRef,
  Renderer2,
  ViewContainerRef,
  afterRenderEffect,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import { DOWN_ARROW, RIGHT_ARROW, UP_ARROW } from '@angular/cdk/keycodes';
import { MlvRtlService } from '@malva-ui/cdk/utils';
import { MLV_MENUBAR_ITEM_REGISTRY } from './menubar-item-registry';
import {
  MlvMenuOverlayController,
  type MlvMenuOverlayTarget,
} from './menu-overlay-controller';
import { MENU_TOKEN } from './menu.types';
import type { MlvMenuAccessor } from './menu.types';
import { MENUBAR_TOKEN } from './menubar.types';
import type { MlvMenubarAccessor, MlvMenubarItem } from './menubar.types';

/**
 * Trigger directive for `mlv-menu`.
 *
 * Attach to any element to open a `mlv-menu` panel on click. Uses `MlvPopupService`
 * from `@malva-ui/core/popup` to create the CDK overlay with the popup component's
 * template for visual chrome (background, border, radius, shadow, animations).
 * The menu panel and items are declared inside `[mlvPopupContent]` in the menu's
 * template and are rendered directly into the overlay — no DOM manipulation required.
 *
 * When used as a submenu trigger (`[isSubmenuTrigger]="true"`), the panel opens on
 * mouseenter and the triangle-pointer-tracking algorithm keeps it open while the
 * cursor moves diagonally toward it.
 *
 * Hover intent is resolved by what the pointer is over, with geometry used only
 * for the ambiguous space between item and panel:
 * - over the trigger item — stays open, whatever the trajectory;
 * - over a different row of the same menu — closes;
 * - in between (including the 8px `SUBMENU_POSITIONS` gap) — the safe cone
 *   decides, and a short grace timer absorbs jitter and gap crossings.
 *
 * Once the cursor enters the submenu panel, triangle tracking stops and the
 * panel's own `mouseleave` schedules the close.
 *
 * @example Simple trigger
 * ```html
 * <button [mlvMenuTrigger]="menu">Open menu</button>
 * <mlv-menu #menu>
 *   <mlv-menu-item (itemClick)="onEdit()">Edit</mlv-menu-item>
 *   <mlv-menu-separator />
 *   <mlv-menu-item (itemClick)="onDelete()">Delete</mlv-menu-item>
 * </mlv-menu>
 * ```
 *
 * @example Submenu trigger on a menu item
 * ```html
 * <mlv-menu-item [mlvMenuTrigger]="sub" [isSubmenuTrigger]="true">
 *   More options
 * </mlv-menu-item>
 * <mlv-menu #sub>
 *   <mlv-menu-item (itemClick)="onOption()">Option A</mlv-menu-item>
 * </mlv-menu>
 * ```
 */
@Directive({
  selector: '[mlvMenuTrigger]',
  host: {
    '[attr.aria-haspopup]': '"menu"',
    '[attr.aria-expanded]': '_isOpen()',
    '[attr.aria-controls]': '_isOpen() ? mlvMenuTrigger().panelId : null',
    // NB: `role="menuitem"` and the roving `tabindex` are applied imperatively
    // (see the constructor) *only* for menubar children. They are deliberately
    // NOT host bindings: a submenu trigger co-hosts `MlvMenuItem`, which
    // already owns `[attr.role]`/`[attr.tabindex]`, and two directives binding
    // the same attribute would clobber each other.
    '(click)': '_onTriggerClick()',
    '(mouseenter)': '_onTriggerMouseEnter()',
    '(mouseleave)': '_onTriggerMouseLeave($event)',
    '(keydown)': '_onKeydown($event)',
  },
})
export class MlvMenuTrigger {
  /** @private Normalizes horizontal submenu opening for RTL layouts. */
  private readonly _rtlService = inject(MlvRtlService);

  // ─── Injected services ────────────────────────────────────────────────────

  /** @private Host element reference. */
  readonly _elementRef = inject(ElementRef<HTMLElement>);

  /** @private DestroyRef for cleanup on directive destruction. */
  private readonly _destroyRef = inject(DestroyRef);

  /** @private Parent menu for submenu triggers, if this trigger lives inside one. */
  private readonly _parentMenu = inject<MlvMenuAccessor | null>(MENU_TOKEN, {
    optional: true,
  });

  /**
   * @private Parent menubar, if this trigger is a direct child of a `mlv-menubar`
   * (i.e. a top-level File / Edit / View item). `null` for standalone triggers
   * and submenu triggers.
   */
  private readonly _menubar = inject<MlvMenubarAccessor | null>(MENUBAR_TOKEN, {
    optional: true,
  });
  private readonly _menubarItemRegistry = inject(MLV_MENUBAR_ITEM_REGISTRY, {
    optional: true,
  });

  /**
   * @private Whether this trigger is a top-level menubar item. When `true` the
   * host exposes `role="menuitem"` + a roving tabindex, and open/close state is
   * coordinated with the parent `mlv-menubar`.
   */
  readonly _isMenubarChild = this._menubar !== null;

  // ─── Inputs ───────────────────────────────────────────────────────────────

  /**
   * The `mlv-menu` panel to open. Required.
   */
  readonly mlvMenuTrigger = input.required<MlvMenuOverlayTarget>();

  /**
   * When true, treats this trigger as a submenu trigger:
   * - Opens the panel using submenu positions (right-of-parent).
   * - Activates triangle pointer tracking while the submenu is open.
   * - Opens on `mouseenter` in addition to `click`.
   */
  readonly isSubmenuTrigger = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * When `true`, disables the trigger — no overlay will open.
   */
  readonly menuTriggerDisabled = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  // ─── Outputs ──────────────────────────────────────────────────────────────

  /** Emits when the menu panel opens. */
  readonly menuOpened = output<void>();

  /** Emits when the menu panel closes. */
  readonly menuClosed = output<void>();

  // ─── Internal state ───────────────────────────────────────────────────────

  /**
   * @private Roving tabindex for menubar top-level items — `0` for the active
   * item, `-1` otherwise. Written by the parent `mlv-menubar`; only reflected
   * on the host when `_isMenubarChild` is `true`.
   */
  readonly _tabIndex = signal(-1);

  /** @private Shared overlay and submenu hover-intent controller. */
  readonly _overlayController = new MlvMenuOverlayController({
    getMenu: () => this.mlvMenuTrigger(),
    origin: this._elementRef,
    vcr: inject(ViewContainerRef),
    parentMenu: this._parentMenu,
    menubar: this._menubar,
    isSubmenu: () => this.isSubmenuTrigger(),
    isMenubarChild: this._isMenubarChild,
    isDisabled: () => this.menuTriggerDisabled(),
    getMenubarItem: () => this as unknown as MlvMenubarItem,
    requestClose: () => this.close(),
    onOpened: () => this.menuOpened.emit(),
    onClosed: () => this.menuClosed.emit(),
  });

  /** @private Whether the menu overlay is currently open. */
  readonly _isOpen = this._overlayController.isOpen;

  constructor() {
    if (this._isMenubarChild) {
      this._menubarItemRegistry?.register(this as unknown as MlvMenubarItem);
      afterRenderEffect(() => this._menubarItemRegistry?.resync());
    }

    this._destroyRef.onDestroy(() => {
      if (this._isMenubarChild) {
        this._menubarItemRegistry?.unregister(
          this as unknown as MlvMenubarItem,
        );
      }
    });

    // Menubar top-level item: apply `role="menuitem"` + a roving tabindex
    // imperatively. Only done for menubar children (never co-hosted with
    // `MlvMenuItem`), so it cannot collide with that directive's own
    // `role`/`tabindex` host bindings on submenu triggers.
    if (this._isMenubarChild) {
      const renderer = inject(Renderer2);
      const el = this._elementRef.nativeElement;
      renderer.setAttribute(el, 'role', 'menuitem');
      effect(() => {
        renderer.setAttribute(el, 'tabindex', String(this._tabIndex()));
      });
    }
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  /**
   * Opens the menu overlay programmatically.
   * No-op if the overlay is already open or the trigger is disabled.
   */
  open(): void {
    this._overlayController.open();
  }

  /**
   * Closes the menu overlay programmatically.
   * No-op if the overlay is not open.
   */
  close(): void {
    this._overlayController.close();
  }

  /**
   * Toggles the menu overlay open/closed.
   */
  toggle(): void {
    this._overlayController.toggle();
  }

  // ─── MlvMenubarItem (used by the parent `mlv-menubar`) ─────────────────────

  /**
   * Whether this trigger is disabled. Bridges the `menuTriggerDisabled` signal
   * to the `MlvMenubarItem` / `FocusKeyManager.skipPredicate` contract.
   */
  get disabledBoolean(): boolean {
    return !!this.menuTriggerDisabled();
  }

  /**
   * Focuses the trigger host element. Required by CDK `FocusableOption` for the
   * menubar's `FocusKeyManager` roving tabindex.
   */
  focus(): void {
    this._elementRef.nativeElement.focus();
  }

  /**
   * Returns the trigger's trimmed visible text, used by the menubar's
   * `FocusKeyManager` type-ahead. Required by `FocusKeyManager.withTypeAhead()`.
   */
  getLabel(): string {
    return this._elementRef.nativeElement.textContent?.trim() ?? '';
  }

  /** Whether this item's dropdown menu is currently open (`MlvMenubarItem`). */
  isMenuOpen(): boolean {
    return this._isOpen();
  }

  /** Opens this item's dropdown without moving focus into the panel (`MlvMenubarItem`). */
  openMenu(): void {
    this.open();
  }

  /** Closes this item's dropdown (`MlvMenubarItem`). */
  closeMenu(): void {
    this.close();
  }

  /**
   * Opens this item's dropdown and moves focus to its first item (`MlvMenubarItem`).
   */
  openMenuWithFirstItemFocused(): void {
    this._overlayController.openWithFirstItemFocused();
  }

  /**
   * Opens this item's dropdown and moves focus to its last item (`MlvMenubarItem`).
   */
  openMenuWithLastItemFocused(): void {
    this._overlayController.openWithLastItemFocused();
  }

  // ─── Protected host event handlers ───────────────────────────────────────

  /**
   * @protected Click handler — toggles the menu.
   */
  protected _onTriggerClick(): void {
    if (this.menuTriggerDisabled()) return;
    this.toggle();
  }

  /**
   * @protected Mouseenter handler.
   *
   * - Menubar top-level item: delegates to the bar's hover-follow, which opens
   *   this item's menu only while another dropdown in the bar is already open.
   * - Submenu trigger: opens the submenu on hover (triangle tracking).
   * - Standalone trigger: no-op (opens on click only).
   */
  protected _onTriggerMouseEnter(): void {
    this._overlayController.onMouseEnter();
  }

  /**
   * @protected Mouseleave handler — for submenu triggers, starts a delayed close
   * unless the cursor is heading into the submenu triangle.
   * Once the cursor has entered the submenu panel, the submenu overlay's own
   * mouseleave listener handles closing — no triangle tracking needed here.
   */
  protected _onTriggerMouseLeave(event: MouseEvent): void {
    this._overlayController.onMouseLeave(event);
  }

  /**
   * @protected Keyboard handler — Enter/Space opens; Escape closes;
   * ArrowDown/Up opens with keyboard focus.
   */
  protected _onKeydown(event: KeyboardEvent): void {
    if (this.menuTriggerDisabled()) return;

    const key = this._rtlService.normalizeArrowKey(event);
    switch (key ?? event.key) {
      case 'Enter':
      case ' ':
        event.preventDefault();
        this.toggle();
        if (this._isOpen()) {
          setTimeout(() => this.mlvMenuTrigger().focusFirstItem(), 0);
        }
        break;
      case DOWN_ARROW:
        if (!this._isOpen()) {
          event.preventDefault();
          this.open();
          setTimeout(() => this.mlvMenuTrigger().focusFirstItem(), 0);
        }
        break;
      case UP_ARROW:
        if (!this._isOpen()) {
          event.preventDefault();
          this.open();
          setTimeout(() => this.mlvMenuTrigger().focusLastItem(), 0);
        }
        break;
      case RIGHT_ARROW:
        // On a submenu trigger (a menu item), ArrowRight opens the submenu and
        // moves focus to its first item.
        if (this.isSubmenuTrigger() && !this._isOpen()) {
          event.preventDefault();
          event.stopPropagation();
          this.open();
          setTimeout(() => this.mlvMenuTrigger().focusFirstItem(), 0);
        }
        break;
      case 'Escape':
        if (this._isOpen()) {
          event.preventDefault();
          this.close();
          this._elementRef.nativeElement.focus();
        }
        break;
    }
  }
}
