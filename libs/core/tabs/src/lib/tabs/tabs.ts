import type { AfterViewInit, TemplateRef } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  model,
  signal,
  untracked,
  viewChild,
  viewChildren,
  ViewEncapsulation,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgTemplateOutlet } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import type { IsActiveMatchOptions } from '@angular/router';
import { filter } from 'rxjs';
import { Tab, TabContent, TabList, TabPanel, Tabs } from '@angular/aria/tabs';
import { DOWN_ARROW, UP_ARROW } from '@angular/cdk/keycodes';
import { MlvTabItem } from '../tab-item/tab-item';
import { MlvTabContent } from '../tab-content/tab-content';
import type { MlvTab } from '../tab/tab';
import { MlvTabsService } from '../tabs.service';
import type {
  MlvTabGroupAccessor,
  MlvTabOrientation,
} from '../tab-group-token';
import { TAB_GROUP } from '../tab-group-token';
import {
  MlvPopup,
  MlvPopupContent,
  MlvPopupTrigger,
} from '@malva-ui/core/popup';
import { MlvList, MlvListItem } from '@malva-ui/core/list';
import { MLV_TABS_I18N } from '@malva-ui/i18n';
import {
  MLV_DENSITY_ELEMENT,
  MlvDensityDirective,
} from '@malva-ui/cdk/density';
import { MlvRtlService } from '@malva-ui/cdk/utils';

/**
 * Visual style of the tab header. Orthogonal to `orientation` — a boxed group can
 * be horizontal or vertical.
 *
 * - `'underline'` (default): a sliding indicator bar under/beside the active tab
 *   (non-active tabs show a faint underline on hover).
 * - `'boxed'`: a segmented control — a grey, content-width track holds the tabs
 *   and a white pill slides behind the active one (non-active tabs tint on hover).
 */
export type MlvTabAppearance = 'underline' | 'boxed';

@Component({
  selector: 'mlv-tab-group',
  imports: [
    NgTemplateOutlet,
    TabList,
    Tab,
    TabPanel,
    TabContent,
    MlvTabItem,
    MlvTabContent,
    MlvPopup,
    MlvPopupContent,
    MlvPopupTrigger,
    MlvList,
    MlvListItem,
  ],
  templateUrl: './tabs.html',
  styleUrl: './tabs.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  // `Tabs` (`ngTabs`) is applied to the host so the aria tab list/panels
  // register against a single container; it carries no inputs.
  // `MlvDensityDirective` exposes `mlvDensity` for content-density sizing.
  hostDirectives: [
    Tabs,
    { directive: MlvDensityDirective, inputs: ['mlvDensity: mlvDensity'] },
  ],
  providers: [
    MlvTabsService,
    { provide: MLV_DENSITY_ELEMENT, useValue: 'tab-group' },
    {
      provide: TAB_GROUP,
      useExisting: MlvTabGroup,
    },
  ],
  host: {
    class: 'mlv-tab-group',
    '[class.mlv-tab-group--horizontal]': 'orientation() === "horizontal"',
    '[class.mlv-tab-group--vertical]': 'orientation() === "vertical"',
    '[class.mlv-tab-group--appearance-boxed]': "appearance() === 'boxed'",
  },
})
export class MlvTabGroup implements MlvTabGroupAccessor, AfterViewInit {
  /** @private Scoped service tracking tab registration and visible/overflow split. */
  private readonly _tabsService = inject(MlvTabsService);
  private readonly _rtlService = inject(MlvRtlService);

  /**
   * @private Effective direction of this tab group, tracking both the global
   * direction and any `[dir]` scope above the host. Drives indicator
   * re-measurement.
   */
  private readonly _direction = this._rtlService.elementDirection(
    inject(ElementRef<HTMLElement>),
  );
  /** @private Destroy reference used to tear down the resize observer. */
  private readonly _destroyRef = inject(DestroyRef);
  /**
   * @private Router used for routed-mode active detection and navigation.
   * `null` when `RouterModule`/`provideRouter` is not present, keeping non-routed
   * tab groups fully functional without a router.
   */
  private readonly _router = inject(Router, { optional: true });

  /** @protected The component's i18n strings signal. */
  protected readonly _i18n = inject(MLV_TABS_I18N);
  /** @private Native ResizeObserver watching the tab-list header for overflow recalculation. */
  private _resizeObserver: ResizeObserver | null = null;

  /**
   * @private Trailing debounce timer for the ResizeObserver. Coalesces the burst
   * of resize callbacks fired during a drag into a single recalculation so tabs
   * do not flip between the row and the overflow menu on every frame.
   */
  private _resizeDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * @private Cache of each tab's natural (fully-rendered) header width, keyed by
   * tab value. Populated the first time all tabs are rendered and reused on every
   * subsequent recalculation so we never have to briefly expand the DOM to all
   * tabs to re-measure — which is what caused the "dizzy" flicker feedback loop.
   */
  private readonly _tabWidths = new Map<string, number>();

  /** @private Measured width of the "More (N)" overflow trigger (falls back to 100). */
  private _moreButtonWidth = 0;

  /** @private Trailing debounce (ms) applied to ResizeObserver-driven recalculation. */
  private static readonly _RESIZE_DEBOUNCE_MS = 64;

  /**
   * @private Extra px of clearance an overflowed tab must gain before it is
   * allowed back into the visible row. Provides hysteresis so a tab does not
   * oscillate in/out at boundary widths.
   */
  private static readonly _HYSTERESIS_PX = 24;

  /** @private True when popup closed because an item was selected (skip focus restoration). */
  private _popupClosedBySelection = false;

  readonly orientation = model<MlvTabOrientation>('horizontal');
  readonly activeTab = model<string>('');

  /**
   * Visual style of the tab header. `'underline'` (default) shows a sliding
   * indicator bar; `'boxed'` fills the active tab with a rounded surface and
   * hides the indicator. Orthogonal to `orientation` — composes with both
   * horizontal and vertical layouts.
   */
  readonly appearance = input<MlvTabAppearance>('underline');

  /**
   * @internal True when at least one registered tab carries a `[routerLink]`
   * (its `urlTree()` is non-null). In routed mode the active tab is derived from
   * the URL via `Router.isActive` rather than from click/keyboard selection, and
   * the auto-select-first + aria-selection paths defer to the route.
   */
  protected readonly _isRouted = computed(() =>
    this._tabsService.tabs().some((t) => t.urlTree() !== null),
  );

  /**
   * @internal Bridges the public `activeTab` model to the aria `ngTabList`
   * `selectedTab` model input (`string | undefined`). An empty `activeTab`
   * maps to `undefined` (no tab selected) so aria does not try to match a tab
   * whose value is the empty string.
   */
  protected readonly selectedTab = computed<string | undefined>(
    () => this.activeTab() || undefined,
  );

  /** @internal Tracks which overflow item has tabindex=0. */
  readonly overflowFocusedIndex = signal(0);

  readonly tabListRef = viewChild<ElementRef<HTMLElement>>('tabListRef');
  readonly indicatorRef = viewChild<ElementRef<HTMLElement>>('indicatorRef');
  readonly morePopupRef = viewChild<MlvPopup>('morePopup');
  readonly tabItems = viewChildren(MlvTabItem);

  /**
   * @private The "More (N)" overflow trigger button, present only while overflow
   * is active. An own-template element, so a signal view query replaces the
   * former `querySelector('.mlv-tab-group__more-trigger')` used when measuring
   * the trigger's width during overflow layout.
   */
  private readonly _moreTriggerRef =
    viewChild<ElementRef<HTMLButtonElement>>('moreTrigger');

  /**
   * @private The overflow popup's focusable menu-item elements, in DOM order.
   * They are declared in this component's own template (inside `mlvPopupContent`),
   * so a signal view query resolves them even though the popup renders in a
   * detached overlay — replacing a `querySelectorAll('[data-overflow-item-index]')`
   * for the Arrow-key navigation inside the overflow menu.
   */
  private readonly _overflowItemRefs = viewChildren('overflowItem', {
    read: ElementRef,
  });

  readonly visibleTabs = computed(() => this._tabsService.visibleTabs());
  readonly overflowTabs = computed(() => this._tabsService.overflowTabs());

  readonly activeContentTemplate = computed<TemplateRef<unknown> | null>(() => {
    const value = this.activeTab();
    const tabs = this._tabsService.tabs();
    const activeTabComp = tabs.find((t) => t.value() === value);
    return activeTabComp?.contentTemplate()?.templateRef ?? null;
  });

  constructor() {
    // Auto-select first tab if none is set. Suppressed in routed mode where the
    // URL owns the active tab (see `_syncActiveFromRoute`).
    effect(() => {
      if (this._isRouted()) return;
      const tabs = this._tabsService.tabs();
      const active = this.activeTab();
      if (
        tabs.length > 0 &&
        (!active || !tabs.some((t) => t.value() === active))
      ) {
        this.activeTab.set(tabs[0].value());
      }
    });

    // ─── Routed mode ─────────────────────────────────────────────────────────
    // When any child <mlv-tab> carries a [routerLink], derive `activeTab` from
    // the current URL instead of click/keyboard selection. The routerLink is a
    // URL carrier on the display:none def node; because the header tab is
    // rendered separately, routerLinkActive cannot style it, so active state is
    // owned here via Router.isActive. Intentional, not a workaround.
    const router = this._router;
    if (router) {
      router.events
        .pipe(
          filter((e): e is NavigationEnd => e instanceof NavigationEnd),
          takeUntilDestroyed(),
        )
        .subscribe(() => this._syncActiveFromRoute());

      // The router may already be settled (no further NavigationEnd will fire),
      // so run an initial sync once routed tabs register. Only `_isRouted()` /
      // `tabs()` are tracked; the set itself is untracked to avoid a feedback
      // loop through `activeTab`.
      effect(() => {
        if (!this._isRouted()) return;
        this._tabsService.tabs();
        untracked(() => this._syncActiveFromRoute());
      });
    }

    // Pin the active tab into the visible row. When overflow is active this
    // swaps the active tab into the last visible slot (identical to picking it
    // from the overflow popup) so the active tab ALWAYS keeps a rendered
    // `ngTab`. That is essential: if the active tab's `ngTab` is torn down (e.g.
    // a resize repartition pushes it into overflow), `@angular/aria` desyncs its
    // `selectedTab` model, marks the active `ngTabPanel` inert and the deferred
    // `ngTabContent` destroys the panel body permanently. Keeping the active
    // tab visible prevents that teardown, so the active content survives any
    // resize/repartition.
    effect(() => {
      const active = this.activeTab();
      this._tabsService.forcedVisibleValue.set(active || null);
    });

    // Update indicator position when active tab or visible tabs change
    effect(() => {
      this.activeTab();
      this.visibleTabs();
      this.tabItems();
      // Mirroring the header moves every tab without resizing it, so neither
      // the ResizeObserver nor the item queries fire. The direction is its own
      // dependency, scoped to this host so a `[dir]` on any ancestor counts —
      // not just a document-level flip.
      this._direction();
      this._updateIndicator();
    });
  }

  ngAfterViewInit(): void {
    this._setupResizeObserver();
    this._destroyRef.onDestroy(() => this._teardownResizeObserver());
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  selectTab(value: string): void {
    const tab = this._tabsService.tabs().find((t) => t.value() === value);
    if (tab?.disabled()) return;

    // Routed tab: navigation is the source of truth. Trigger it and let the
    // resulting NavigationEnd update `activeTab` via `_syncActiveFromRoute` — do
    // NOT set `activeTab` directly (that would desync the header from the URL).
    const urlTree = tab?.urlTree() ?? null;
    if (urlTree && this._router) {
      this._router.navigateByUrl(urlTree);
      return;
    }

    this.activeTab.set(value);
  }

  /**
   * @internal Bridges the aria `ngTabList` `selectedTab` output back to the
   * public `activeTab` model. Ignores `undefined` (aria emits it transiently
   * before the default selection settles) so the auto-select effect keeps
   * ownership of the initial value.
   */
  protected _onSelectedTabChange(value: string | undefined): void {
    // In routed mode the URL owns `activeTab`; ignore aria's optimistic
    // selection so the header cannot desync from the route (navigation,
    // triggered via `selectTab`, drives `activeTab` through NavigationEnd).
    if (this._isRouted()) return;
    if (value !== undefined && value !== this.activeTab()) {
      this.activeTab.set(value);
    }
  }

  selectOverflowTab(value: string): void {
    this._popupClosedBySelection = true;
    this._tabsService.forceVisible(value);
    this.selectTab(value);
    // Close popup then focus the newly promoted visible tab
    this.morePopupRef()?.opened.set(false);
    requestAnimationFrame(() => {
      const items = this.tabItems();
      const visibleTabs = this.visibleTabs();
      const idx = visibleTabs.findIndex((t) => t.value() === value);
      if (idx >= 0 && items[idx]) {
        items[idx].focus();
      }
    });
  }

  isActive(value: string): boolean {
    return this.activeTab() === value;
  }

  // ─── Routed mode helpers ─────────────────────────────────────────────────

  /**
   * @private Sets `activeTab` to the first tab whose routerLink target is active
   * for the current URL (per its `linkActiveOptions`). No-op when not routed or
   * when no tab matches (the route stays the source of truth).
   */
  private _syncActiveFromRoute(): void {
    if (!this._isRouted()) return;
    const match = this._tabsService
      .tabs()
      .find((t) => this._isTabActiveByRoute(t));
    if (match && match.value() !== this.activeTab()) {
      this.activeTab.set(match.value());
    }
  }

  /**
   * @private Whether a tab's routerLink `urlTree` is active for the current URL,
   * honouring its `linkActiveOptions`.
   */
  private _isTabActiveByRoute(tab: MlvTab): boolean {
    const router = this._router;
    const urlTree = tab.urlTree();
    if (!router || !urlTree) return false;
    const opts = tab.linkActiveOptions();
    // `Router.isActive` reads an object argument as raw `IsActiveMatchOptions`
    // and would silently ignore an `{ exact }` key, so map the RouterLinkActive
    // `{ exact }` shorthand through the boolean overload (matching Angular's own
    // RouterLinkActive), and pass a full `IsActiveMatchOptions` straight through.
    return this._isFullMatchOptions(opts)
      ? router.isActive(urlTree, opts)
      : router.isActive(urlTree, opts.exact);
  }

  /**
   * @private Type guard distinguishing a full `IsActiveMatchOptions` object from
   * the `{ exact: boolean }` shorthand (mirrors Angular's internal check).
   */
  private _isFullMatchOptions(
    opts: { exact: boolean } | IsActiveMatchOptions,
  ): opts is IsActiveMatchOptions {
    const o = opts as Partial<IsActiveMatchOptions>;
    return !!(o.paths || o.matrixParams || o.queryParams || o.fragment);
  }

  // ─── Overflow popup handling ─────────────────────────────────────────────

  /** Opens the overflow popup and focuses the first overflow item after render. */
  openOverflowPopup(): void {
    this.overflowFocusedIndex.set(0);
    this.morePopupRef()?.opened.set(true);
  }

  /**
   * Called when the overflow popup finishes opening.
   * Focuses the first (or active) overflow item.
   */
  onMorePopupAfterOpened(): void {
    // Active overflow tab gets initial focus, otherwise first item
    const overflowTabs = this.overflowTabs();
    const activeIdx = overflowTabs.findIndex((t) => this.isActive(t.value()));
    const targetIdx = activeIdx >= 0 ? activeIdx : 0;
    this.overflowFocusedIndex.set(targetIdx);

    this._overflowItemRefs()[targetIdx]?.nativeElement.focus();
  }

  /**
   * Called when the overflow popup finishes closing.
   * Returns focus to the active visible tab unless the popup was closed by
   * selecting an item (focus goes to the promoted tab instead).
   */
  onMorePopupAfterClosed(): void {
    if (this._popupClosedBySelection) {
      this._popupClosedBySelection = false;
      return;
    }
    const items = this.tabItems();
    const activeIdx = this.visibleTabs().findIndex((t) =>
      this.isActive(t.value()),
    );
    items[activeIdx >= 0 ? activeIdx : 0]?.focus();
  }

  /**
   * Keydown handler on the overflow list wrapper inside the popup.
   * Up/Down arrows navigate between items; Escape closes the popup.
   */
  onOverflowKeydown(event: KeyboardEvent): void {
    const items = this._overflowItemRefs().map((ref) => ref.nativeElement);
    const count = items.length;
    if (count === 0) return;

    const key = this._rtlService.normalizeArrowKey(event);
    if (key === DOWN_ARROW) {
      event.preventDefault();
      this.overflowFocusedIndex.update((i) => Math.min(i + 1, count - 1));
      items[this.overflowFocusedIndex()]?.focus();
    } else if (key === UP_ARROW) {
      event.preventDefault();
      this.overflowFocusedIndex.update((i) => Math.max(i - 1, 0));
      items[this.overflowFocusedIndex()]?.focus();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.morePopupRef()?.opened.set(false);
      // afterClosed will restore focus to last focused visible tab
    }
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  /** @private Repositions the active-tab indicator bar via CSS custom properties. */
  private _updateIndicator(): void {
    queueMicrotask(() => {
      const items = this.tabItems();
      const indicatorEl = this.indicatorRef()?.nativeElement;
      if (!indicatorEl) return;

      const activeItem = items.find(
        (_, i) =>
          this.visibleTabs()[i] && this.isActive(this.visibleTabs()[i].value()),
      );

      if (!activeItem) {
        indicatorEl.style.setProperty('--mlv-tab-indicator-width', '0');
        indicatorEl.style.setProperty('--mlv-tab-indicator-height', '0');
        return;
      }

      const el = activeItem.elementRef.nativeElement;
      if (this.orientation() === 'horizontal') {
        indicatorEl.style.setProperty(
          '--mlv-tab-indicator-left',
          `${el.offsetLeft}px`,
        );
        indicatorEl.style.setProperty(
          '--mlv-tab-indicator-width',
          `${el.offsetWidth}px`,
        );
      } else {
        indicatorEl.style.setProperty(
          '--mlv-tab-indicator-top',
          `${el.offsetTop}px`,
        );
        indicatorEl.style.setProperty(
          '--mlv-tab-indicator-height',
          `${el.offsetHeight}px`,
        );
      }
    });
  }

  /** @private Attaches a ResizeObserver to the header to recalculate overflow on width changes. */
  private _setupResizeObserver(): void {
    if (this.orientation() === 'vertical') return;

    const headerEl = this.tabListRef()?.nativeElement;
    if (!headerEl) return;

    if (typeof ResizeObserver === 'undefined') return;

    // Debounce (trailing): a drag fires the observer many times per second.
    // Coalescing them into one recalculation after the width settles is the
    // first line of defence against the flickering "dizzy" repartition.
    this._resizeObserver = new ResizeObserver(() => {
      if (this._resizeDebounceTimer !== null) {
        clearTimeout(this._resizeDebounceTimer);
      }
      this._resizeDebounceTimer = setTimeout(() => {
        this._resizeDebounceTimer = null;
        this._recalculateOverflow();
      }, MlvTabGroup._RESIZE_DEBOUNCE_MS);
    });
    this._resizeObserver.observe(headerEl);
  }

  /** @private Disconnects and clears the header ResizeObserver and its debounce timer. */
  private _teardownResizeObserver(): void {
    if (this._resizeDebounceTimer !== null) {
      clearTimeout(this._resizeDebounceTimer);
      this._resizeDebounceTimer = null;
    }
    this._resizeObserver?.disconnect();
    this._resizeObserver = null;
  }

  /**
   * @private Updates the visible/overflow split for the current header width.
   *
   * Unlike the previous implementation it does NOT reset the rendered set to
   * "show all" on every call. Tab widths are cached (keyed by value) the first
   * time every tab is rendered; afterwards the split is computed purely from the
   * cache and the container width. That removes the measure→mutate→re-measure
   * feedback loop (moving a tab to overflow no longer changes what we measure),
   * which — together with the ResizeObserver debounce and the hysteresis in
   * {@link _computeFittingCount} — kills the flickering repartition.
   */
  private _recalculateOverflow(): void {
    if (this.orientation() === 'vertical') {
      this._tabsService.maxVisibleCount.set(-1);
      return;
    }

    const headerEl = this.tabListRef()?.nativeElement;
    if (!headerEl) return;

    // Refresh the cache from whatever is currently rendered (no DOM mutation).
    this._captureRenderedWidths();

    const allTabs = this._tabsService.tabs();
    const missingWidth = allTabs.some((t) => !this._tabWidths.has(t.value()));

    if (missingWidth) {
      // Cold cache (first run) or new tabs added: render every tab once so we
      // can capture the missing widths, then apply. This is the ONLY branch
      // that expands the DOM, and only runs until the cache is warm — so
      // steady-state resizes never flash the full tab set.
      this._tabsService.maxVisibleCount.set(-1);
      requestAnimationFrame(() => {
        this._captureRenderedWidths();
        this._applyOverflowFit();
      });
      return;
    }

    this._applyOverflowFit();
  }

  /**
   * @private Captures the natural widths of the currently-rendered tab items
   * (and the "More" trigger) into the width cache, keyed by tab value. Zero
   * widths (detached / not laid out) are ignored so a transient render never
   * poisons the cache.
   */
  private _captureRenderedWidths(): void {
    const items = this.tabItems();
    const visible = this._tabsService.visibleTabs();
    items.forEach((item, i) => {
      const value = visible[i]?.value();
      const width = item.elementRef.nativeElement.offsetWidth;
      if (value && width > 0) {
        this._tabWidths.set(value, width);
      }
    });

    const moreEl = this._moreTriggerRef()?.nativeElement;
    if (moreEl && moreEl.offsetWidth > 0) {
      this._moreButtonWidth = moreEl.offsetWidth;
    }
  }

  /**
   * @private Applies the cached-width overflow computation to the service and
   * repositions the indicator.
   */
  private _applyOverflowFit(): void {
    const headerEl = this.tabListRef()?.nativeElement;
    if (!headerEl) return;

    const allTabs = this._tabsService.tabs();
    const widths = allTabs.map((t) => this._tabWidths.get(t.value()) ?? 0);
    const fittingCount = this._computeFittingCount(
      widths,
      headerEl.clientWidth,
      this._moreButtonWidth || 100,
      this._tabsService.maxVisibleCount(),
    );

    this._tabsService.maxVisibleCount.set(fittingCount);
    this._updateIndicator();
  }

  /**
   * @private Pure overflow fit calculation. Returns how many leading tabs fit in
   * `containerWidth`, or `-1` when every tab fits with no "More" button.
   *
   * Hysteresis: a tab that is currently in the overflow region
   * (`i >= currentMax`) must clear the boundary by an extra
   * {@link _HYSTERESIS_PX} before it is allowed back into the visible row. A
   * currently-visible tab leaves as soon as it no longer fits. This asymmetric
   * threshold means the two states around a boundary width can never both be
   * satisfied, so the split cannot oscillate between adjacent widths.
   *
   * @param widths Natural width of each tab, in DOM order.
   * @param containerWidth Available header content width.
   * @param moreButtonWidth Width reserved for the "More (N)" trigger.
   * @param currentMax The current `maxVisibleCount` (`-1` = all visible).
   */
  private _computeFittingCount(
    widths: number[],
    containerWidth: number,
    moreButtonWidth: number,
    currentMax: number,
  ): number {
    const total = widths.reduce((sum, w) => sum + w, 0);
    // Everything fits without needing a "More" button.
    if (total <= containerWidth) return -1;

    let accumulated = 0;
    let count = 0;
    for (let i = 0; i < widths.length; i++) {
      const wasOverflowed = currentMax >= 0 && i >= currentMax;
      const margin = wasOverflowed ? MlvTabGroup._HYSTERESIS_PX : 0;
      if (
        accumulated + widths[i] + moreButtonWidth + margin <=
        containerWidth
      ) {
        accumulated += widths[i];
        count++;
      } else {
        break;
      }
    }
    return count;
  }
}
