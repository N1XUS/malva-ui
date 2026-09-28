import type { TemplateRef } from '@angular/core';
import {
  afterRenderEffect,
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
import {
  MlvResizeObserverFactory,
  MlvRtlService,
  mlvComputeHiddenFlags,
  mlvCssPx,
  mlvInlineContentSize,
  mlvNextId,
  mlvOverflowRevealGuard,
  provideMlvScopedDirectionality,
} from '@malva-ui/cdk/utils';

/**
 * @private One overflow split, as {@link MlvTabGroup} commits it: how many tabs
 * go to the "More" menu, and the width that was computed against (which the
 * oscillation guard needs to tell a wider row from the one that failed).
 */
interface MlvTabSplit {
  readonly hiddenCount: number;
  readonly available: number;
}

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

/** Where a tab group renders its panels. See `MlvTabGroup.panels`. */
export type MlvTabPanelPlacement = 'inline' | 'external';

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
  // `@angular/aria`'s `TabList` (`ngTabList` in this template) injects the CDK
  // `Directionality` to decide which horizontal arrow means *next*. The scoped
  // provider makes it follow the nearest `[dir]` above the group, as the
  // group's logical CSS and indicator geometry already do. `viewProviders`,
  // because `TabList` is in the view: projected tab content keeps its own.
  viewProviders: [provideMlvScopedDirectionality()],
  host: {
    class: 'mlv-tab-group',
    '[class.mlv-tab-group--horizontal]': 'orientation() === "horizontal"',
    '[class.mlv-tab-group--vertical]': 'orientation() === "vertical"',
    '[class.mlv-tab-group--appearance-boxed]': "appearance() === 'boxed'",
  },
})
export class MlvTabGroup implements MlvTabGroupAccessor {
  /** @private Scoped service tracking tab registration and visible/overflow split. */
  private readonly _tabsService = inject(MlvTabsService);
  private readonly _rtlService = inject(MlvRtlService);

  /**
   * @private The host element: the scope the direction resolves against, and
   * the box whose content width is the room the tab row has (see
   * {@link _computeSplit}).
   */
  private readonly _hostRef = inject(ElementRef<HTMLElement>);

  /**
   * @private Effective direction of this tab group, tracking both the global
   * direction and any `[dir]` scope above the host. Drives indicator
   * re-measurement.
   */
  private readonly _direction = this._rtlService.elementDirection(
    this._hostRef,
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
  /**
   * @private DI seam for the platform `ResizeObserver`. `create()` answers
   * `null` where the constructor is absent — server rendering — which is the
   * documented server case of the shared factory (see its `NullFactory` spec),
   * and is what keeps the raw global out of this component so a spec can hand
   * it a double without patching `globalThis`.
   */
  private readonly _resizeObserverFactory = inject(MlvResizeObserverFactory);

  /**
   * @private Native ResizeObserver watching every box the overflow split reads:
   * the host (the room available), the tab-list header (its padding and gap),
   * each rendered tab item and the "More" trigger (the width consumed).
   */
  private _resizeObserver: ResizeObserver | null = null;

  /**
   * @private The elements {@link _resizeObserver} currently watches, kept in
   * lockstep with the observer itself: every `add` here is paired with an
   * `observe()` and every `delete` with an `unobserve()`, so the set is the
   * observer's target list rather than a snapshot of it. That is what lets
   * {@link _syncResizeTargets} add and remove observations incrementally
   * instead of disconnecting, which would re-notify every settled box.
   */
  private readonly _observedTargets = new Set<Element>();

  /** @private Trailing debounce (ms) applied to a resize-driven reveal. */
  private static readonly _REVEAL_DEBOUNCE_MS = 64;

  /**
   * @private How soon (ms) after a reveal a hide must follow for the pair to
   * count as the reveal undoing itself. The same window `mlv-items-more` uses.
   * Declared before {@link _revealGuard}, whose initializer reads it (TS2729).
   */
  private static readonly _OSCILLATION_WINDOW_MS = 100;

  /**
   * @private Trailing debounce timer, used for revealing only. A resize that
   * withholds more tabs commits in the notification that reported it; one
   * that would return tabs waits for {@link _REVEAL_DEBOUNCE_MS} of quiet, so
   * a drag does not re-render the row on every frame on its way wider.
   */
  private _revealTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * @private Natural header width of each tab, keyed by the tab instance, as
   * read from `getBoundingClientRect()` with any flex growth switched off
   * ({@link _naturalWidths}) — fractional, because `offsetWidth` rounds and
   * five rounded widths can be off by two pixels together.
   *
   * Read from whatever is rendered, so a withheld tab keeps the width it had
   * when it was last on screen; the only time the DOM is expanded to every
   * tab is when a width is missing ({@link _commit}). Entries for tabs that
   * have unregistered are dropped on every capture, and the whole cache is
   * dropped while the group is vertical, where a tab is as wide as the column.
   */
  private readonly _tabWidths = new Map<MlvTab, number>();

  /**
   * @private The tabs the previous capture measured, or `null` before the
   * first one. A width change only says something about the withheld tabs
   * when the same tabs are rendered as last time: across a repartition the
   * difference is the repartition's own doing (see
   * {@link _captureRenderedWidths}).
   */
  private _lastRenderedTabs: ReadonlySet<MlvTab> | null = null;

  /**
   * @private Set when a capture drops the withheld tabs' widths, and cleared
   * once the current task's microtasks run. Backstop against a render loop:
   * however the widths behave, at most one invalidation — and so at most one
   * expanded render — happens per task, which is the scope of the render loop
   * Angular runs after an after-render effect writes a signal.
   */
  private _invalidatedThisTask = false;

  /**
   * @private Measured width of the "More (N)" trigger, or `null` while it has
   * never rendered. Kept across overflow episodes: the trigger renders only
   * while something is withheld, so the first split that hides anything is
   * computed with nothing reserved for it — which can only keep a tab visible,
   * never withhold one that fits — and the trigger's own render re-runs the
   * split in the same tick, before the browser paints, now with the measured
   * width. There is no default width: a guess that runs high withholds a tab
   * that fits, which is the defect #358 fixed.
   */
  private _moreTriggerWidth: number | null = null;

  /**
   * @private Refuses a reveal that has already undone itself — the answer to
   * a feedback loop outside the row (a reveal adds a page scrollbar that
   * narrows the row), in place of the fixed 24px hysteresis band this group
   * used to hold a fitting tab back with. Shared with `mlv-items-more`; the
   * reasoning lives on `mlvOverflowRevealGuard` (`@malva-ui/cdk/utils`).
   */
  private readonly _revealGuard = mlvOverflowRevealGuard(
    MlvTabGroup._OSCILLATION_WINDOW_MS,
  );

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
   * Where the tab panels are rendered.
   *
   * `'inline'` (default) renders them below the strip, inside this component.
   * `'external'` renders **no panel body at all** — the strip is the whole
   * component, and one `[mlvTabPanel]` elsewhere in the document carries the
   * content.
   *
   * The external mode exists because a tab strip is routinely part of a page's
   * sticky chrome while its content belongs in the page body: the two are in
   * different places in the layout and cannot be one element's children. The
   * shape that arrangement used to take was one empty `mlvTabContent` per tab,
   * which rendered a stub panel purely so `aria-controls` resolved to
   * *something*. A reference that resolves to an empty element is not a panel
   * relationship; it is a valid id pointing at nothing a reader can use.
   */
  readonly panels = input<MlvTabPanelPlacement>('inline');

  /**
   * DOM id of the tab element currently selected, or `null` when the selected
   * tab is not rendered in the visible row (it is in the overflow menu, or
   * nothing is selected).
   *
   * `[mlvTabPanel]` points its `aria-labelledby` at this, which is the half of
   * the tabs relationship an external panel can still express: the panel names
   * itself after its tab even though the tab cannot point back at a panel that
   * is outside its own DI scope.
   */
  readonly activeTabId = computed<string | null>(() => {
    const active = this.activeTab();
    return this.visibleTabs().some((tab) => tab.value() === active)
      ? this._tabDomId(active)
      : null;
  });

  /** @private Stable id prefix for this group's tab elements. */
  private readonly _idBase = mlvNextId('mlv-tab');

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

  /**
   * @internal DOM id for one tab element. Deterministic, so the strip and an
   * external panel derive the same value without either querying the DOM.
   * Non-id characters in a tab value are folded to `-`; two values that differ
   * only in those characters would collide, which is why the prefix is unique
   * per group rather than per document.
   */
  protected _tabDomId(value: string): string {
    return `${this._idBase}-${value.replace(/[^A-Za-z0-9_-]/g, '-')}`;
  }

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
      // not just a document-level flip. The same holds for the orientation
      // (the indicator switches between its left/width and top/height pair)
      // and the appearance (the boxed track's padding and gap move every tab
      // inside a header that need not change size).
      this._direction();
      this.orientation();
      this.appearance();
      this._updateIndicator();
    });

    // Keep the resize observer pointed at every box the split is derived from.
    // The rendered tab set changes on every repartition, so this is a tracked
    // effect rather than a one-shot `ngAfterViewInit` call: a tab (or the
    // "More" trigger) that appears later still gets observed.
    //
    // `afterRenderEffect`, not `effect`: the body constructs a `ResizeObserver`,
    // which must not happen during a server render, and this is the primitive
    // that structurally cannot run there (`libs/core/src/ssr-smoke.spec.ts`
    // asks for exactly this over a `typeof` guard the suite cannot see fail).
    // It is still signal-tracked, so the query-driven re-observation above is
    // unchanged; it simply runs after the render that produced the new boxes.
    afterRenderEffect(() => {
      const items = this.tabItems();
      const moreTrigger = this._moreTriggerRef();
      const header = this.tabListRef();
      untracked(() => this._syncResizeTargets(header, items, moreTrigger));
    });

    // Re-derive the split whenever what it is computed from changes without
    // necessarily resizing an observed box: the rendered tab set, the trigger
    // appearing or leaving, the pinned (active) tab, the orientation and the
    // appearance. An orientation flip in particular used to recalculate only
    // if its relayout happened to deliver a resize notification (#269).
    //
    // The `read` phase is where layout reads belong: writes have already
    // flushed. A split committed here re-renders the header within the same
    // `ApplicationRef.tick()`, before the browser paints, which is what lets
    // the first hide be computed before the trigger has ever been measured
    // (see `_moreTriggerWidth`).
    afterRenderEffect({
      read: () => {
        this.tabItems();
        this._moreTriggerRef();
        this.tabListRef();
        this.orientation();
        this.appearance();
        this._tabsService.tabs();
        this._tabsService.forcedVisibleValue();
        untracked(() => this._recalculateOverflow());
      },
    });

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

    // Vertical-only: this handler answers `ArrowUp` / `ArrowDown` / `Escape`
    // inside the overflow popup and never the horizontal pair, so
    // `normalizeArrowKey` is deliberately called without a direction target.
    // (`mlv-tabs` has no horizontal arrow navigation at all — its tab strip
    // binds only `keydown.enter` / `keydown.space`. That missing roving
    // Left/Right on a `role="tablist"` is a separate WAI-ARIA gap.)
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

  /**
   * @private Creates the ResizeObserver on first use, or returns the existing
   * one. `null` where the factory has no `ResizeObserver` to give — server
   * rendering, so the overflow split simply never engages there.
   */
  private _ensureResizeObserver(): ResizeObserver | null {
    if (this._resizeObserver) return this._resizeObserver;
    this._resizeObserver = this._resizeObserverFactory.create(() =>
      this._onResizeBatch(),
    );
    return this._resizeObserver;
  }

  /**
   * @private Handles one batch of resize notifications.
   *
   * The indicator is re-measured first, in both orientations: a relabel, a
   * webfont swap or a density change moves or resizes the active tab without
   * changing any signal the indicator effect reads, so a vertical group's
   * `--mlv-tab-indicator-top` used to stay where the tab had been (#269).
   *
   * The split is asymmetric on purpose. Withholding more is applied in the
   * notification that reported the shrink: a tab that no longer fits is
   * clipped by the header until it goes, so waiting only prolongs a visibly
   * broken row. Returning tabs waits for {@link _REVEAL_DEBOUNCE_MS} of quiet,
   * so a drag does not re-render the row on every frame on its way wider; the
   * timer recomputes from fresh widths rather than committing this batch's.
   */
  private _onResizeBatch(): void {
    this._updateIndicator();

    if (this.orientation() === 'vertical') {
      this._recalculateOverflow();
      return;
    }

    this._captureRenderedWidths();
    const split = this._computeSplit();
    if (split === null) return;

    this._cancelReveal();
    if (
      split === 'unmeasured' ||
      split.hiddenCount >= this.overflowTabs().length
    ) {
      this._commit(split);
      return;
    }

    this._revealTimer = setTimeout(() => {
      this._revealTimer = null;
      this._recalculateOverflow();
    }, MlvTabGroup._REVEAL_DEBOUNCE_MS);
  }

  /** @private Clears a pending reveal. */
  private _cancelReveal(): void {
    if (this._revealTimer === null) return;
    clearTimeout(this._revealTimer);
    this._revealTimer = null;
  }

  /**
   * @private Points the ResizeObserver at every box the overflow split is
   * derived from: the host (the room available), the header (its padding and
   * gap) **and** each rendered tab plus the "More" trigger (the width
   * consumed).
   *
   * The host is observed because a boxed header is `width: fit-content`: once
   * a tab is withheld the header shrinks to the tabs that remain and never
   * grows with its container again, so a group observing only the header
   * never saw the room to return the tab into (#358).
   *
   * Observing only the header was also the defect behind #232. The split is a
   * function of the tabs' widths, but the only thing that re-ran it was a
   * change in the header's own size — and a header whose width comes from its
   * parent never resizes when its children finally get theirs. So a measuring
   * pass that landed before the tabs had a laid-out box (every width reading
   * `0`, leaving the width cache empty) committed "no overflow" for the
   * lifetime of the component. The same held for widths that changed without
   * moving the header: a webfont swap, a density change, a label retranslation.
   *
   * Diffed rather than `disconnect()`-and-re-observe. Per the spec a fresh
   * `ResizeObservation` starts at `lastReportedSizes = [(-1,-1)]`, so
   * `observe()` on a not-currently-observed target always delivers an initial
   * notification (a `0x0` and a `display: none` box included) while `observe()`
   * on a live target is a no-op. Disconnecting therefore re-arms every target
   * and re-notifies every already-settled box on each repartition — each one a
   * batch that re-reads every width — and retains the detached tab elements a
   * repartition destroys until the next callback. Measured, not assumed:
   * `tabs.spec.ts` asserts the header — a box that never moves and never
   * leaves the set — is notified exactly once.
   *
   * A vertical group is observed too, even though it never overflows: its
   * batches still re-measure the indicator (see {@link _onResizeBatch}), and
   * {@link _recalculateOverflow} resets its split to "all visible". The
   * switch back to horizontal needs no notification of its own: the
   * orientation is a dependency of the read-phase effect that recalculates.
   */
  private _syncResizeTargets(
    header: ElementRef<HTMLElement> | undefined,
    items: readonly MlvTabItem[],
    moreTrigger: ElementRef<HTMLButtonElement> | undefined,
  ): void {
    const observer = this._ensureResizeObserver();
    if (!observer) return;

    const targets = new Set<Element>([this._hostRef.nativeElement]);
    if (header) targets.add(header.nativeElement);
    for (const item of items) {
      targets.add(item.elementRef.nativeElement);
    }
    if (moreTrigger) targets.add(moreTrigger.nativeElement);

    // Deleting the element the `for…of` is standing on is well-defined for a
    // Set, so both passes mutate `_observedTargets` in place, keeping it in
    // lockstep with the observer rather than swapping in a fresh snapshot.
    for (const el of this._observedTargets) {
      if (!targets.has(el)) {
        observer.unobserve(el);
        this._observedTargets.delete(el);
      }
    }
    for (const el of targets) {
      if (!this._observedTargets.has(el)) {
        observer.observe(el);
        this._observedTargets.add(el);
      }
    }
  }

  /** @private Disconnects and clears the ResizeObserver and its reveal timer. */
  private _teardownResizeObserver(): void {
    this._cancelReveal();
    this._resizeObserver?.disconnect();
    this._resizeObserver = null;
    this._observedTargets.clear();
  }

  /**
   * @private Re-reads the rendered widths and commits the split they give,
   * in either direction. The render-driven path and the end of a reveal's
   * debounce; a resize batch goes through {@link _onResizeBatch} instead.
   *
   * A vertical group never overflows: its split is "all visible", and its
   * width cache is dropped, because a vertical tab is as wide as the column
   * rather than its label. Switching back to horizontal renders every tab,
   * so the next capture re-measures them all at their natural width.
   */
  private _recalculateOverflow(): void {
    this._cancelReveal();

    if (this.orientation() === 'vertical') {
      this._tabWidths.clear();
      this._lastRenderedTabs = null;
      this._revealGuard.reset();
      this._tabsService.maxVisibleCount.set(-1);
      return;
    }

    this._captureRenderedWidths();
    this._commit(this._computeSplit());
  }

  /**
   * @private Reads the natural width of every rendered tab item, and of the
   * "More" trigger, into the cache.
   *
   * **Natural**, not laid out: a tab that grows into free room (`flex: 1` on
   * the tab items, the full-width pattern `mlv-color-picker` uses) is wider
   * the fewer tabs are rendered, so its box says how much room the row had
   * left, not how much the tab needs — and a split computed from it would
   * hide tabs to make room that the remaining ones then filled. See
   * {@link _naturalWidths}.
   *
   * `getBoundingClientRect().width` rather than `offsetWidth`: the latter
   * rounds to an integer, and five rounded widths can be two pixels off
   * together — enough to keep a tab that does not fit, or withhold one that
   * does. A zero width (a detached or not-laid-out box: a `display: none`
   * ancestor) is skipped, so a transient render never poisons the cache.
   *
   * A withheld tab cannot be measured, so its entry is the width it had when
   * it was last rendered. That is only still true while the widths it
   * depends on are: when **every** rendered tab, or two or more of them,
   * change width in one pass, the cause is almost certainly one that reaches
   * the withheld tabs too — a webfont swap, a density change, a
   * retranslation — so their entries are dropped, and {@link _commit} renders
   * every tab once to re-read them. A single rendered tab changing among
   * others that did not is its own label, and says nothing about the rest.
   *
   * Two conditions keep that invalidation from feeding itself (#358 review):
   *
   * - It only counts a change against a capture of the **same** rendered
   *   tabs. Across a repartition any difference is the repartition's own
   *   doing — a stretch the natural read cannot undo (a grid track, a
   *   percentage width) — and invalidating on it would expand the row, whose
   *   capture would differ again, without end.
   * - At most once per task ({@link _invalidatedThisTask}), whatever the
   *   widths do, so no layout can turn it into Angular's render loop.
   */
  private _captureRenderedWidths(): void {
    const registered = new Set(this._tabsService.tabs());
    for (const tab of this._tabWidths.keys()) {
      if (!registered.has(tab)) this._tabWidths.delete(tab);
    }

    const items = this.tabItems();
    const visible = this._tabsService.visibleTabs();
    const trigger = this._moreTriggerRef()?.nativeElement ?? null;
    // The item query and the visible list describe the same render once it
    // has flushed, which is every place this runs from. Should they ever
    // disagree, pairing them by index would file one tab's width under
    // another, so no tab is read.
    const paired = items.length === visible.length;
    const elements: HTMLElement[] = paired
      ? items.map((item) => item.elementRef.nativeElement)
      : [];
    if (trigger) elements.push(trigger);
    const widths = this._naturalWidths(elements);

    if (paired) {
      const rendered = new Set<MlvTab>();
      let measured = 0;
      let changed = 0;
      visible.forEach((tab, i) => {
        const width = widths[i];
        if (width <= 0) return;
        const previous = this._tabWidths.get(tab);
        measured++;
        if (previous !== undefined && previous !== width) changed++;
        rendered.add(tab);
        this._tabWidths.set(tab, width);
      });

      const previousRender = this._lastRenderedTabs;
      this._lastRenderedTabs = rendered;
      const sameRender =
        previousRender !== null &&
        previousRender.size === rendered.size &&
        [...rendered].every((tab) => previousRender.has(tab));

      if (
        sameRender &&
        !this._invalidatedThisTask &&
        (changed >= 2 || (changed > 0 && changed === measured))
      ) {
        for (const tab of this._tabWidths.keys()) {
          if (!rendered.has(tab)) this._tabWidths.delete(tab);
        }
        this._invalidatedThisTask = true;
        queueMicrotask(() => (this._invalidatedThisTask = false));
      }
    }

    const triggerWidth = trigger ? widths[widths.length - 1] : 0;
    if (triggerWidth > 0) this._moreTriggerWidth = triggerWidth;
  }

  /**
   * @private The border-box inline size of each element with any flex
   * growth switched off — the width it takes when the row has no room to
   * give it.
   *
   * An element whose computed `flex-grow` is positive gets an inline
   * `flex-grow: 0 !important` for the duration of the reads, and its own
   * inline value and priority back afterwards; the whole batch is read under
   * one forced layout. Every computed value is read before the first write,
   * so the batch costs one style recalculation, not one per growing element.
   * Nothing is written when nothing grows, which is the default: a tab item's
   * `flex-grow` is `0`. The write is undone in a `finally` before this
   * returns, so no frame is painted with it and a `ResizeObserver` sees no
   * change.
   *
   * Inline `!important` outranks every consumer declaration of `flex-grow`,
   * in any cascade layer, and a keyframe animation of it — but not a
   * transition. A consumer `transition` covering `flex-grow`
   * (`transition: all` on the items) starts one on the write, the read
   * returns its start value — the laid-out width — and the row takes the
   * non-flex path below.
   *
   * Only growth is undone. A stretch that is not flex growth — a grid track,
   * a percentage width — is read as laid out; the same-render rule in
   * {@link _captureRenderedWidths} keeps it from invalidating the cache on
   * its own.
   */
  private _naturalWidths(elements: readonly HTMLElement[]): number[] {
    const growing = elements.filter(
      (el) => Number.parseFloat(getComputedStyle(el).flexGrow) > 0,
    );
    const restore: (() => void)[] = [];
    try {
      for (const el of growing) {
        const value = el.style.getPropertyValue('flex-grow');
        const priority = el.style.getPropertyPriority('flex-grow');
        const hadStyle = el.hasAttribute('style');
        el.style.setProperty('flex-grow', '0', 'important');
        restore.push(() => {
          if (value) {
            el.style.setProperty('flex-grow', value, priority);
          } else {
            el.style.removeProperty('flex-grow');
            if (!hadStyle && !el.getAttribute('style')) {
              el.removeAttribute('style');
            }
          }
        });
      }
      return elements.map((el) => el.getBoundingClientRect().width);
    } finally {
      for (const undo of restore) undo();
    }
  }

  /**
   * @private The split the cached widths give for the room the header has
   * now, or `'unmeasured'` while a registered tab has no width on record, or
   * `null` when there is nothing to measure against.
   *
   * The room is the **host's** content box less the header's own inline
   * padding and border — not the header's `clientWidth`, which is what #358
   * was about. `clientWidth` includes the padding the tabs cannot use (the
   * boxed track's 0.1875rem either side) and is rounded, and a boxed header
   * is `width: fit-content`, so once it had shrunk around fewer tabs it no
   * longer reported how much room its container had. The header is
   * `border-box` under the shipped base layer, which is what makes the host's
   * content width its maximum border-box width. The header's `column-gap`
   * between every pair of boxes is part of the arithmetic too; the underline
   * appearance has neither padding nor gap, so for it this is the old
   * comparison without the rounding.
   *
   * The active tab is pinned: it is kept whatever its position, with its own
   * width reserved first — the same slot `MlvTabsService` swaps it into. So
   * the split can never demote a narrow tab to make room for a wide active
   * one that then overflows anyway.
   *
   * `null` when the host has no layout box at all (a `display: none`
   * ancestor, a detached view, a test environment without layout): a split
   * computed against zero room would withhold every tab.
   */
  private _computeSplit(): MlvTabSplit | 'unmeasured' | null {
    const header = this.tabListRef()?.nativeElement;
    if (!header) return null;

    const host = this._hostRef.nativeElement;
    const hostRect = host.getBoundingClientRect();
    if (hostRect.width <= 0 && hostRect.height <= 0) return null;

    const pinned = this._tabsService.forcedVisibleValue();
    const candidates: { width: number; collapsible: boolean }[] = [];
    for (const tab of this._tabsService.tabs()) {
      const width = this._tabWidths.get(tab);
      if (width === undefined) return 'unmeasured';
      candidates.push({ width, collapsible: tab.value() !== pinned });
    }

    const headerStyles = getComputedStyle(header);
    const available = mlvInlineContentSize(
      mlvInlineContentSize(hostRect.width, getComputedStyle(host)),
      headerStyles,
    );
    const flags = mlvComputeHiddenFlags({
      candidates,
      available,
      gap: mlvCssPx(headerStyles.columnGap),
      triggerWidth: this._moreTriggerWidth ?? 0,
    });
    return {
      hiddenCount: flags.filter((hidden) => hidden).length,
      available,
    };
  }

  /**
   * @private Commits a split through the oscillation guard.
   *
   * `'unmeasured'` renders every tab so the missing widths can be read — the
   * only path that expands the DOM, taken on first render, when a tab
   * registers, and when a width change invalidated the withheld tabs'
   * entries. The render it causes re-runs the split in the same tick, so the
   * expanded row is never painted. It resets the guard and expands only from
   * a row that withholds tabs, so it happens once per render, however many
   * notifications in a batch find a width missing; with the once-per-task
   * invalidation in {@link _captureRenderedWidths}, no layout can make it the
   * step of a loop.
   *
   * A split withholding `n` tabs becomes `maxVisibleCount = tabs − n`, which
   * `MlvTabsService` turns back into the same set: the leading tabs, with the
   * pinned one swapped into the last slot when it would otherwise be
   * withheld. A hide always commits; a reveal commits unless the guard has
   * already seen that same reveal, at this width or narrower, undo itself.
   */
  private _commit(split: MlvTabSplit | 'unmeasured' | null): void {
    if (split === null) return;

    if (split === 'unmeasured') {
      // Nothing withheld: every tab is rendered, or is on the render already
      // asked for (a second notification in the same batch reads the old DOM
      // against the new split), so the missing widths are read there and the
      // guard keeps what it learned.
      if (this.overflowTabs().length === 0) return;
      // What the guard learned was about widths that are no longer on record.
      this._revealGuard.reset();
      this._tabsService.maxVisibleCount.set(-1);
      return;
    }

    const { hiddenCount, available } = split;
    if (
      !this._revealGuard.admit(
        hiddenCount,
        this.overflowTabs().length,
        available,
      )
    ) {
      return;
    }

    this._tabsService.maxVisibleCount.set(
      hiddenCount > 0 ? this._tabsService.tabs().length - hiddenCount : -1,
    );
  }
}
