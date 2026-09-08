import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  computed,
  contentChild,
  effect,
  ElementRef,
  forwardRef,
  inject,
  model,
  input,
  signal,
  untracked,
} from '@angular/core';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import { DOWN_ARROW, UP_ARROW } from '@angular/cdk/keycodes';
import type { MlvBreakpoint } from '@malva-ui/cdk/utils';
import {
  clamp,
  MlvBreakpointService,
  MlvRtlService,
} from '@malva-ui/cdk/utils';
import type { MlvSidebarContextValue } from '../sidebar-context';
import { SIDEBAR_CONTEXT } from '../sidebar-context';
import type { MlvSidebarMode } from '../sidebar-mode';
import type { MlvSidebarDrawerSide } from '../sidebar-drawer-side';
import type { MlvSidebarAppearance } from '../sidebar-appearance';
import { MlvSidebarHeader } from '../sidebar-header';
import { MlvSidebarFooter } from '../sidebar-footer';
import { SidebarContentDirective } from '../sidebar-content';
import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import type { MlvDrawerPosition } from '@malva-ui/core/drawer';
import { MlvDrawer, MlvDrawerContent } from '@malva-ui/core/drawer';
import { MLV_SIDEBAR_I18N } from '@malva-ui/i18n';
import { MlvScrollbar } from '@malva-ui/core/scrollbar';

@Component({
  selector: 'mlv-sidebar',
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvDrawer, MlvDrawerContent, NgTemplateOutlet, MlvScrollbar],
  providers: [
    {
      provide: SIDEBAR_CONTEXT,
      useExisting: forwardRef(() => MlvSidebar),
    },
  ],
  host: {
    class: 'mlv-sidebar',
    '[class.mlv-sidebar--collapsed]': '_effectiveCollapsed()',
    '[class]': '"mlv-sidebar--" + effectiveMode()',
    '[class.mlv-sidebar--raised]': 'appearance() === "raised"',
    '[class.mlv-sidebar--flat]': 'appearance() === "flat"',
    '[class.mlv-sidebar--full-height]': 'fullHeight()',
    '[style.--mlv-sidebar-expanded-width]': 'width()',
    '[style.--mlv-sidebar-collapsed-width]': 'collapsedWidth()',
    role: 'navigation',
    '[attr.aria-label]': '_resolvedAriaLabel()',
  },
})
export class MlvSidebar implements MlvSidebarContextValue {
  /** @protected The component's i18n strings signal. */
  protected readonly _i18n = inject(MLV_SIDEBAR_I18N);

  /**
   * @private Signal-based viewport breakpoint service. Wraps the CDK
   * `BreakpointObserver`, so it is SSR-safe — no direct `matchMedia` access.
   */
  private readonly _breakpoint = inject(MlvBreakpointService);
  private readonly _rtlService = inject(MlvRtlService);

  /** @private Host element; the scope the drawer edge is resolved against. */
  private readonly _elementRef = inject(ElementRef<HTMLElement>);

  /**
   * @private Direction applying to this host, resolved once and cached behind
   * the shared `dir` observer rather than re-walked whenever the drawer opens.
   */
  private readonly _direction = this._rtlService.elementDirection(
    this._elementRef,
  );

  /** @private Owning document used to preserve focus when activation opens another modal. */
  private readonly _document = inject(DOCUMENT);

  /**
   * @private Collapsed value captured when the responsive override kicked in,
   * so leaving the breakpoint restores what the author/user had before.
   * `null` while no responsive override is active.
   */
  private _collapsedBeforeAutoOffcanvas: boolean | null = null;

  /**
   * Controls expanded vs. collapsed (icon-only) mode.
   * Accepts truthy strings via `coerceBooleanProperty`.
   * Two-way bindable via `[(collapsed)]`.
   */
  readonly collapsed = model<boolean>(false);

  /**
   * Total width of the sidebar host when expanded, including border and padding.
   * Two-way bindable — updated by `setWidth()` during rail drag.
   */
  readonly width = model('260px');

  /**
   * Total width of the sidebar host when collapsed, including border and padding.
   */
  readonly collapsedWidth = input('56px');

  /**
   * MlvLayout mode controlling how the sidebar renders and collapses.
   * - `'icon'` — collapses to an icon-only rail (default).
   * - `'offcanvas'` — slides off-screen when collapsed.
   * - `'floating'` — floats over content when expanded.
   * - `'fixed'` — always fully expanded; collapse is a no-op.
   */
  readonly mode = input<MlvSidebarMode>('icon');

  /**
   * Which edge an `'offcanvas'` sidebar's drawer slides from.
   *
   * Logical, so it mirrors: `'start'` is the left edge in LTR and the right one
   * in RTL. Defaults to `'start'`, the primary navigation sidebar's edge — pass
   * `'end'` on a trailing sidebar (an inspector projected into
   * `[mlvPageEndSidebar]`), where a drawer that slid in from the opposite edge
   * would contradict the column it replaces.
   *
   * Only read in `'offcanvas'` mode; an inline sidebar takes its side from the
   * order it is projected in.
   */
  readonly drawerSide = input<MlvSidebarDrawerSide>('start');

  /** Outer surface treatment for an inline sidebar. */
  readonly appearance = input<MlvSidebarAppearance>('raised');

  /**
   * Viewport breakpoint below which the sidebar automatically behaves as an
   * `'offcanvas'` drawer, regardless of {@link mode}.
   *
   * `null` (the default) keeps the sidebar on {@link mode} at every width.
   * Setting it to `'md'` makes the sidebar an overlay drawer below 768px — it
   * closes itself on entering that range, opens from a `[mlvSidebarTrigger]`,
   * and dismisses on Escape, backdrop click, or focus leaving the drawer, like
   * any `mode="offcanvas"` sidebar. The previous collapsed state is restored
   * when the viewport grows back past the breakpoint.
   *
   * Thresholds come from `MLV_BREAKPOINT_CONFIG` (`provideMlvBreakpoints()`),
   * so they stay in sync with the SCSS `breakpoint-*` mixins.
   */
  readonly collapseBelow = input<MlvBreakpoint | null>(null);

  /**
   * Closes an open offcanvas Sidebar when an enabled projected action is
   * activated. Inline Sidebar modes are unaffected.
   *
   * Disabled by default so existing navigation keeps its authored behavior.
   */
  readonly closeOnActivation = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * When true, the sidebar stretches to full viewport height.
   * Adds the `mlv-sidebar--full-height` modifier class.
   */
  readonly fullHeight = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * Accessible name for the `navigation` landmark.
   *
   * Set this whenever a page renders more than one sidebar (or another
   * `navigation` landmark) so assistive technology can tell them apart.
   * When omitted, the localized `MLV_SIDEBAR_I18N.navigation` default is used.
   *
   * Note: a plain `aria-label` attribute on `<mlv-sidebar>` cannot be used for
   * this — the host binding owns the attribute and would overwrite it.
   */
  readonly ariaLabel = input<string | undefined>(undefined);

  /**
   * Minimum width in pixels the sidebar may be resized to via the drag rail.
   */
  readonly minWidth = input<number>(200);

  /**
   * Maximum width in pixels the sidebar may be resized to via the drag rail.
   */
  readonly maxWidth = input<number>(480);

  /**
   * @private True when {@link collapseBelow} is set and the viewport is
   * narrower than that breakpoint.
   */
  private readonly _isBelowCollapseBreakpoint = computed(() => {
    const breakpoint = this.collapseBelow();
    return breakpoint !== null && this._breakpoint.isDown(breakpoint)();
  });

  /**
   * The layout mode actually in effect.
   *
   * Equals {@link mode} unless {@link collapseBelow} is set and the viewport is
   * narrower than that breakpoint, in which case it is `'offcanvas'`. Bind
   * against this (not `mode`) when mirroring the sidebar's layout elsewhere.
   */
  readonly effectiveMode = computed<MlvSidebarMode>(() =>
    this._isBelowCollapseBreakpoint() ? 'offcanvas' : this.mode(),
  );

  /**
   * @protected Physical edge the offcanvas drawer slides from, resolved from
   * {@link drawerSide} against the direction in force at this host.
   *
   * `MlvDrawerPosition`'s `'left'` / `'right'` are physical — the drawer's own
   * position strategy calls `positionStrategy.left('0')` — so the mirroring has
   * to happen here rather than being left to the drawer.
   */
  protected readonly _drawerPosition = computed<MlvDrawerPosition>(() => {
    const isEnd = this.drawerSide() === 'end';
    const isRtl = this._direction() === 'rtl';

    return isEnd === isRtl ? 'left' : 'right';
  });

  /**
   * Effective collapsed state. Always `false` in `'fixed'` mode so the sidebar
   * never visually collapses regardless of the `collapsed` model value.
   */
  protected readonly _effectiveCollapsed = computed(
    () => this.effectiveMode() !== 'fixed' && this.collapsed(),
  );

  /**
   * @protected Accessible name bound to the host `aria-label`. Prefers the
   * author-supplied {@link ariaLabel} and falls back to the localized default.
   */
  protected readonly _resolvedAriaLabel = computed(
    () => this.ariaLabel() ?? this._i18n().navigation,
  );

  /** @protected Header slot directive reference. */
  protected readonly _headerRef = contentChild(MlvSidebarHeader);

  /** @protected Footer slot directive reference. */
  protected readonly _footerRef = contentChild(MlvSidebarFooter);

  /** @protected Content slot directive reference. */
  protected readonly _contentRef = contentChild(SidebarContentDirective);

  /** @protected True when at least one slot directive is projected. */
  protected readonly _hasSlots = computed(
    () => !!(this._headerRef() || this._footerRef() || this._contentRef()),
  );

  /** @protected Whether the current drawer leave was requested by projected activation. */
  protected readonly _activationClosePending = signal(false);

  constructor() {
    // Entering the responsive offcanvas range must start closed — an open
    // drawer covering the page on a viewport change is never what the author
    // asked for. Leaving the range restores the pre-override collapsed value.
    effect(() => {
      const below = this._isBelowCollapseBreakpoint();

      untracked(() => {
        if (below) {
          if (this._collapsedBeforeAutoOffcanvas === null) {
            this._collapsedBeforeAutoOffcanvas = this.collapsed();
            this.collapsed.set(true);
          }
          return;
        }

        if (this._collapsedBeforeAutoOffcanvas !== null) {
          this.collapsed.set(this._collapsedBeforeAutoOffcanvas);
          this._collapsedBeforeAutoOffcanvas = null;
        }
      });
    });
  }

  /**
   * Toggles the sidebar between collapsed and expanded.
   * This is a no-op when the effective mode is `'fixed'`.
   */
  toggle(): void {
    if (this.effectiveMode() === 'fixed') return;
    this.collapsed.update((v) => !v);
  }

  /** Set the sidebar width in pixels. Clamps to the [minWidth, maxWidth] range. */
  setWidth(px: number): void {
    const clamped = clamp(px, this.minWidth(), this.maxWidth());
    this.width.set(`${clamped}px`);
  }

  /** @protected Syncs drawer open/close back to collapsed model. */
  protected _onDrawerOpenedChange(opened: boolean): void {
    if (opened) this._activationClosePending.set(false);
    this.collapsed.set(!opened);
  }

  /**
   * @protected Closes only an open offcanvas Sidebar after a real enabled
   * projected action. Search fields and non-interactive layout do not dismiss.
   */
  protected _onContainerClick(event: MouseEvent): void {
    if (
      !this.closeOnActivation() ||
      this.effectiveMode() !== 'offcanvas' ||
      this._effectiveCollapsed()
    ) {
      return;
    }

    const container = event.currentTarget as HTMLElement;
    const target = event.target as Element | null;
    if (!target?.closest) return;
    const action = target.closest<HTMLElement>(
      'button, a[href], [role="button"], [role="menuitem"]',
    );
    if (
      !action ||
      !container.contains(action) ||
      action.getAttribute('aria-disabled') === 'true' ||
      action.matches('button:disabled')
    ) {
      return;
    }

    this._activationClosePending.set(true);
    this.collapsed.set(true);
  }

  /** @private Finds a modal that an activation opened above the closing Drawer. */
  private _findOpenModal(): HTMLElement | null {
    const modals = this._document.querySelectorAll<HTMLElement>(
      '.mlv-dialog-container[role="dialog"], .mlv-dialog-container[role="alertdialog"], [role="dialog"][aria-modal="true"]:not(.mlv-drawer), [role="alertdialog"][aria-modal="true"]:not(.mlv-drawer)',
    );
    return modals.item(modals.length - 1);
  }

  /**
   * @protected Lets a newly opened modal retain focus; otherwise the Drawer
   * restores the external Sidebar trigger that opened it.
   */
  protected _shouldRestoreDrawerFocus(): boolean {
    if (!this._activationClosePending()) return true;
    return this._findOpenModal() === null;
  }

  /**
   * @protected Clears activation-specific focus policy after Drawer disposal
   * and keeps focus in a still-open modal if removing the projected opener
   * caused the browser to drop focus.
   */
  protected _onDrawerAfterClosed(): void {
    const modal = this._activationClosePending() ? this._findOpenModal() : null;
    this._activationClosePending.set(false);
    if (modal?.isConnected) {
      const active = this._document.activeElement;
      const focusTarget =
        active instanceof HTMLElement && modal.contains(active)
          ? active
          : modal;
      // Re-assert focus synchronously after the lower overlay is disposed.
      // Browsers may otherwise drop focus when its captured opener disappears,
      // even though focus had already moved into the still-connected modal.
      focusTarget.focus();
    }
  }

  /**
   * @protected Handles `ArrowDown`/`ArrowUp` keydown events on the sidebar container
   * to move focus between focusable sidebar items and group triggers in DOM order.
   * Wraps around at the list boundaries and skips elements inside
   * `.cdk-overlay-container` or an `inert`/`hidden` subtree.
   */
  protected onContainerKeydown(event: Event): void {
    const e = event as KeyboardEvent;
    // Vertical-only handler: `ArrowLeft`/`ArrowRight` are never matched, so
    // mirroring is a no-op and no scoped direction is needed here.
    const key = this._rtlService.normalizeArrowKey(e);
    if (key !== DOWN_ARROW && key !== UP_ARROW) return;

    e.preventDefault();

    const container = e.currentTarget as HTMLElement;

    // Collect the focus target for each navigable row in DOM order. A
    // `mlv-sidebar-item` may itself be focusable (button-style rows) or defer
    // to a projected link/button (navigational rows), so resolve each to its
    // actual focus target and de-duplicate.
    const items: HTMLElement[] = [];
    const seen = new Set<HTMLElement>();
    const add = (el: HTMLElement | null | undefined): void => {
      // `inert`/`hidden` candidates must be dropped, not merely stepped over:
      // `HTMLElement.focus()` on one is a silent no-op, so keeping it in the
      // list parks focus on the current row for every further keypress rather
      // than moving past it. A collapsed `mlv-sidebar-group` is exactly that
      // case — it keeps its expanded header mounted and `inert` so the label
      // can fade, and that header sits between the row above and the collapsed
      // icon trigger below it.
      if (
        el &&
        !seen.has(el) &&
        !el.closest('.cdk-overlay-container, [inert], [hidden]')
      ) {
        seen.add(el);
        items.push(el);
      }
    };

    container
      .querySelectorAll<HTMLElement>(
        'mlv-sidebar-item, .mlv-sidebar-group__header, .mlv-sidebar-group__icon-btn, button, a[href]',
      )
      .forEach((el) => {
        if (el.tagName.toLowerCase() === 'mlv-sidebar-item') {
          add(
            el.hasAttribute('tabindex')
              ? el
              : el.querySelector<HTMLElement>('a[href], button, [tabindex]'),
          );
          return;
        }
        // Focusable elements inside a sidebar item are resolved via the item above.
        if (el.closest('mlv-sidebar-item')) return;
        add(el);
      });

    const idx = items.indexOf(this._document.activeElement as HTMLElement);
    if (idx === -1) return;

    if (key === DOWN_ARROW) {
      items[(idx + 1) % items.length]?.focus();
    } else {
      items[(idx - 1 + items.length) % items.length]?.focus();
    }
  }
}
