import { DecimalPipe, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  DestroyRef,
  ElementRef,
  Injector,
  PLATFORM_ID,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  LucideGauge,
  LucideMenu,
  LucidePlay,
  LucideRotateCcw,
  LucideX,
} from '@lucide/angular';
import { MlvAlert, MlvAlertTitle } from '@malva-ui/core/alert';
import { MlvBadge } from '@malva-ui/core/badge';
import { MlvButton, MlvButtonIcon } from '@malva-ui/core/button';
import {
  MlvDataTable,
  MlvDataTableCell,
  type MlvDataTablePresentationState,
  type MlvFilterState,
} from '@malva-ui/core/data-table';
import { MlvNumberInput } from '@malva-ui/core/number-input';
import {
  MlvPage,
  MlvPageContent,
  MlvPageHeader,
  MlvPageActions,
  MlvPageDescription,
  MlvPageShell,
  MlvPageSidebar,
  MlvPageTitle,
} from '@malva-ui/core/page';
import { MlvSegmented, MlvSegmentedItem } from '@malva-ui/core/segmented';
import { MlvSelect } from '@malva-ui/core/select';
import { MlvSidebar, MlvSidebarTrigger } from '@malva-ui/core/sidebar';
import { MlvSwitch } from '@malva-ui/core/switch';
import {
  MlvViewVariantList,
  MlvViewVariantStatus,
  mlvViewStateEqual,
  type MlvViewVariant,
  type MlvViewVariantScope,
} from '@malva-ui/core/view-variant';
import {
  SCALE_BENCHMARK_FILTER,
  SCALE_COLUMNS,
  SCALE_DATASET_SIZES,
  SCALE_DEFAULT_LATENCY_MS,
  SCALE_DEFAULT_TABLE_STATE,
  SCALE_DEFAULT_VIEW,
  SCALE_MAX_SCROLLABLE_PX,
  SCALE_SEED,
  SCALE_TABLE_HEIGHT,
  SCALE_VIEW_VARIANTS,
  readScaleRootFontPx,
  scaleMaxVirtualRows,
  scaleRowHeightPx,
  type ScaleTableMode,
  type ScaleViewState,
} from './data-at-scale.data';
import {
  SCALE_INTERACTION_LABELS,
  SCALE_LONG_FRAME_MS,
  SCALE_SCROLL_SAMPLE_MS,
  measureAfterPaint,
  prefersReducedMotion,
  runScrollBenchmark,
  type ScaleFrameSample,
  type ScaleInteraction,
  type ScaleQuerySample,
  type ScaleRenderSample,
} from './data-at-scale.metrics';
import { SCALE_ALL_ROWS } from './backend/scale-protocol';
import { SCALE_BACKEND_FACTORY } from './scale-backend';
import { ScaleDataSource, type ScaleQueryMetrics } from './scale-data-source';
import { createScaleBackend } from './scale-worker-backend';

/** @private Monotonic clock used for every measurement on this page. */
function now(): number {
  return typeof performance === 'undefined' ? Date.now() : performance.now();
}

/** @private Deep-copies a presentation snapshot so later table edits cannot reach it. */
function cloneTableState(
  state: MlvDataTablePresentationState,
): MlvDataTablePresentationState {
  return {
    ...state,
    visibleColumnKeys: [...state.visibleColumnKeys],
    pinnedStartColumnKeys: [...state.pinnedStartColumnKeys],
    pinnedEndColumnKeys: [...state.pinnedEndColumnKeys],
    columnWidths: { ...state.columnWidths },
    sort: state.sort ? { ...state.sort } : null,
  };
}

/**
 * Freezes the ordering of everything a saved view compares by.
 *
 * `mlvViewStateEqual` compares JSON, so two identical views authored in a
 * different filter order would otherwise read as dirty forever.
 */
export function normalizeScaleViewState(state: ScaleViewState): ScaleViewState {
  return {
    search: state.search.trim().toLocaleLowerCase(),
    filters: [...state.filters]
      .map((filter) => ({
        key: filter.key,
        operator: filter.operator,
        value: Array.isArray(filter.value) ? [...filter.value] : filter.value,
      }))
      .sort((a, b) =>
        a.key === b.key
          ? a.operator.localeCompare(b.operator)
          : a.key.localeCompare(b.key),
      ),
    table: cloneTableState(state.table),
  };
}

/**
 * "Data at Scale" — the showcase that answers the scaling question about
 * `mlv-data-table` before an evaluator has to ask it.
 *
 * A Web Worker generates and owns 100,000+ deterministic rows and runs every
 * sort, filter, search and page inside itself; the main thread only ever
 * receives a slice. The page then measures its own initial render, scroll frame
 * rate and filter round trip live, in the visitor's browser, and documents what
 * each number does and does not include.
 *
 * Four constraints shape the composition, and all four are stated on the page
 * rather than hidden:
 *
 * 1. **Virtual scroll and server-side paging are mutually exclusive.** With
 *    `virtualScroll` on, `MlvDataTable` forces `page = 1` and
 *    `perPage = Number.MAX_SAFE_INTEGER` onto its source, so the backend returns
 *    the whole result set. The mode control makes that a deliberate choice.
 * 2. **Row identity is object identity.** Selection and tree expansion are
 *    `Set<row>`, so `ScaleDataSource` hands back the same instance per row id
 *    across refetches. Nothing here may clone rows between the source and
 *    `[data]`.
 * 3. **Virtual scroll strides by one fixed row height.** The table measures it
 *    itself (no `[rowHeight]` is bound, #363); the page pins it to
 *    `comfortable` so `SCALE_ROW_HEIGHT_REM` cannot drift out of sync with the
 *    docs-wide density control, and resolves it against the root font size
 *    (see {@link rowHeight}), because the table's pitch follows that too.
 * 4. **A virtual viewport cannot be taller than the browser will scroll.**
 *    `rowHeight × rowCount` past `SCALE_MAX_SCROLLABLE_PX` can no longer be
 *    scrolled to its end, so above {@link maxVirtualRows} the mode falls back
 *    to server-side paging — see {@link effectiveMode}.
 */
@Component({
  selector: 'docs-data-at-scale-showcase',
  imports: [
    DecimalPipe,
    MlvAlert,
    MlvAlertTitle,
    MlvBadge,
    MlvButton,
    MlvButtonIcon,
    MlvDataTable,
    MlvDataTableCell,
    MlvNumberInput,
    MlvPage,
    MlvPageContent,
    MlvPageHeader,
    MlvPageActions,
    MlvPageDescription,
    MlvPageShell,
    MlvPageSidebar,
    MlvPageTitle,
    MlvSegmented,
    MlvSegmentedItem,
    MlvSelect,
    MlvSidebar,
    MlvSidebarTrigger,
    MlvSwitch,
    MlvViewVariantList,
    MlvViewVariantStatus,
    LucideGauge,
    LucideMenu,
    LucidePlay,
    LucideRotateCcw,
    LucideX,
  ],
  templateUrl: './data-at-scale.html',
  styleUrl: './data-at-scale.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataAtScaleShowcaseComponent {
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _injector = inject(Injector);
  private readonly _host: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly _destroyRef = inject(DestroyRef);

  /**
   * @private Whether this component is running in a browser.
   *
   * Not `typeof document !== 'undefined'`: `@angular/platform-server` installs
   * domino's DOM onto `globalThis`, so `document` exists on a server render and
   * that test answers `true` there. The platform id is the only thing that
   * actually distinguishes the two.
   */
  private readonly _isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** @private Document the root font size is read from, in a browser only. */
  private readonly _document = inject(DOCUMENT);

  /**
   * @private Aborts an in-flight scroll benchmark.
   *
   * A run is two seconds of frame callbacks that each write `scrollTop`.
   * Navigating away half a second in would otherwise keep scrolling a detached
   * element for the remaining second and a half and then write its result onto
   * a destroyed component.
   */
  private _scrollRun: AbortController | null = null;

  /**
   * @private The backend factory.
   *
   * Optional so a spec can substitute a synchronous in-memory backend: jsdom has
   * no `Worker` at all. Without an override the shared factory decides, and
   * degrades to the main thread rather than failing to render — which the page
   * then says out loud, because main-thread numbers are not worker numbers.
   */
  private readonly _backendFactory =
    inject(SCALE_BACKEND_FACTORY, { optional: true }) ?? createScaleBackend;

  /** @protected The table instance, for the live selection count and view application. */
  protected readonly table = viewChild(MlvDataTable);

  /** @private Request id of the newest query already turned into a sample. */
  private _lastSampledRequestId = 0;

  /** @private The interaction whose commit-to-paint span is still being timed. */
  private _pending: {
    readonly interaction: ScaleInteraction;
    readonly startedAt: number;
  } | null = null;

  /** @private Clock reading of the most recent dataset (re)generation request. */
  private _datasetStartedAt = now();

  /** @private Whether the next settled query is the first paint of a new dataset. */
  private _awaitingFirstPaint = true;

  /** The worker-backed source. Owns its backend; destroyed with the route. */
  readonly source = new ScaleDataSource(this._backendFactory(), {
    config: {
      seed: SCALE_SEED,
      rowCount: SCALE_DATASET_SIZES[0].rows,
      tree: false,
    },
    latencyMs: SCALE_DEFAULT_LATENCY_MS,
  });

  /** Column definitions rendered by the table. */
  readonly columns = SCALE_COLUMNS;

  /** Row counts offered by the dataset-size control. */
  readonly datasetSizeValues = SCALE_DATASET_SIZES.map((size) => size.rows);

  /**
   * Row pitch the table renders and strides by, in CSS pixels: the
   * comfortable `3.75rem` resolved against the root font size — 60px on a
   * 16px root, 75px under a browser font setting of 20px. Quoted in the page
   * copy and the paging fallback's status message, and the divisor of
   * {@link maxVirtualRows}. Not bound to the table, which measures its own
   * row pitch (#363).
   *
   * Read once, when the page is created: a browser font-size change while the
   * page is open takes effect on the next visit. A server render assumes the
   * CSS initial 16px.
   */
  readonly rowHeight = scaleRowHeightPx(
    readScaleRootFontPx(this._isBrowser ? this._document : null),
  );

  /** Height of the table's scroll surface. */
  readonly tableHeight = SCALE_TABLE_HEIGHT;

  /** Frames slower than this are reported as jank. */
  readonly longFrameMs = SCALE_LONG_FRAME_MS;

  /**
   * Most rows one virtual scroller can address before the browser stops
   * scrolling it — {@link maxScrollablePx} over {@link rowHeight}, so fewer
   * under a larger root font size.
   */
  readonly maxVirtualRows = scaleMaxVirtualRows(this.rowHeight);

  /** The browser's maximum scrollable height, in CSS pixels. */
  readonly maxScrollablePx = SCALE_MAX_SCROLLABLE_PX;

  /** The mode the visitor asked for. {@link effectiveMode} is what is in force. */
  readonly mode = signal<ScaleTableMode>('virtual');

  /** Top-level rows the backend generates. */
  readonly rowCount = signal(SCALE_DATASET_SIZES[0].rows);

  /** Artificial per-query backend delay. */
  readonly latencyMs = signal(SCALE_DEFAULT_LATENCY_MS);

  /** Whether accounts carry expandable workspace children. */
  readonly treeRows = signal(false);

  /** Applied global search string. */
  readonly search = signal('');

  /**
   * Applied column predicates.
   *
   * Mutable rather than `readonly`: `mlv-data-table`'s `activeFilters` model is
   * declared `MlvFilterState[]`, and a readonly element type is not assignable
   * to it.
   */
  readonly filters = signal<MlvFilterState[]>([]);

  /** Durable table presentation the active view is compared against. */
  readonly tableState = signal<MlvDataTablePresentationState>(
    cloneTableState(SCALE_DEFAULT_TABLE_STATE),
  );

  /** Saved views. In-memory only — this showcase persists nothing. */
  readonly variants =
    signal<readonly MlvViewVariant<ScaleViewState>[]>(SCALE_VIEW_VARIANTS);

  /** Id of the selected saved view. */
  readonly activeId = signal(
    this._resolveViewId(this._route.snapshot.queryParamMap.get('view')),
  );

  /** Local filter text of the saved-view list. */
  readonly viewQuery = signal('');

  /** Normalized state of the active view, for dirty comparison. */
  readonly baselineState = signal<ScaleViewState>(
    normalizeScaleViewState(SCALE_DEFAULT_VIEW.state),
  );

  /** First painted frame after the current dataset was generated. */
  readonly initialRender = signal<ScaleRenderSample | null>(null);

  /** Most recent query of any kind. */
  readonly lastQuery = signal<ScaleQuerySample | null>(null);

  /** Most recent query started by a filter or a search. */
  readonly filterSample = signal<ScaleQuerySample | null>(null);

  /** Most recent scroll frame-rate sample. */
  readonly scrollSample = signal<ScaleFrameSample | null>(null);

  /** Whether a scroll sample is currently running. */
  readonly scrollRunning = signal(false);

  /** Polite status line describing the last benchmark action. */
  readonly benchmarkStatus = signal('');

  /** Where sort, filter, search and paging actually run. */
  readonly backendKind = this.source.backendKind;

  /** Whether the fallback backend is in use, so the numbers are main-thread numbers. */
  readonly onMainThread = this.backendKind === 'main-thread';

  /**
   * Whether the selected dataset still fits inside one virtual scroller.
   *
   * `cdk-virtual-scroll-viewport` reserves `rowHeight × rowCount` pixels of
   * scrollable height, and past {@link SCALE_MAX_SCROLLABLE_PX} a browser
   * stops scrolling it: Firefox drops the height outright, leaving only the
   * first screen of rows, and Chrome and WebKit clamp it a little further on.
   * Nothing is logged either way. The threshold follows the root font size
   * through {@link rowHeight}.
   */
  readonly virtualScrollFits = computed(
    () => this.rowCount() <= this.maxVirtualRows,
  );

  /**
   * The mode actually in force.
   *
   * A dataset too tall for one scroller falls back to server-side paging
   * whatever the segmented control says, and the page explains why rather than
   * rendering an empty table.
   */
  readonly effectiveMode = computed<ScaleTableMode>(() =>
    this.virtualScrollFits() ? this.mode() : 'paged',
  );

  /**
   * What picking each offered size actually costs, said at the size control.
   *
   * Virtual scroll makes the dataset size a transfer decision, not just a
   * generation one: `mlv-data-table` asks its source for every matching row, so
   * an option that still fits in one scroller structured-clones the whole
   * result set onto the main thread on every sort, filter and search. The page
   * explains that in prose further down, but the control itself was silent
   * about which options it applies to — and picking 250,000 rows there is a
   * quarter of a million rows over `postMessage`, per interaction.
   */
  readonly datasetSizeDescription = computed(() => {
    if (this.mode() !== 'virtual') {
      return 'Server-side paging returns one page whatever the size, so a larger dataset costs generation time in the backend, not rows on the main thread.';
    }
    // How many sizes land on each side depends on the root font size (see
    // `maxVirtualRows`), so the list reads correctly at any length.
    const format = (predicate: (rows: number) => boolean): string => {
      const sizes = SCALE_DATASET_SIZES.filter((size) =>
        predicate(size.rows),
      ).map((size) => size.rows.toLocaleString());
      return sizes.length > 2
        ? `${sizes.slice(0, -1).join(', ')} and ${sizes[sizes.length - 1]}`
        : sizes.join(' and ');
    };
    const wholeSet = format((rows) => rows <= this.maxVirtualRows);
    const paged = format((rows) => rows > this.maxVirtualRows);
    return `With virtual scroll on, ${wholeSet} rows transfer the whole result set to the main thread on every sort, filter and search — not one page. ${paged} rows are more than one scroller can address, so they fall back to server-side paging.`;
  });

  /** The selected saved view, or `null` when its id no longer exists. */
  readonly activeVariant = computed(
    () =>
      this.variants().find((variant) => variant.id === this.activeId()) ?? null,
  );

  /** The state the controls currently describe. */
  readonly workingState = computed<ScaleViewState>(() => ({
    search: this.search(),
    filters: this.filters(),
    table: this.tableState(),
  }));

  /** Whether the working state has drifted from the active view. */
  readonly dirty = computed(() =>
    this.activeVariant() === null
      ? false
      : !mlvViewStateEqual(
          this.baselineState(),
          this.workingState(),
          normalizeScaleViewState,
        ),
  );

  /** Rows currently selected in the table — survives every refetch by design. */
  readonly selectedCount = computed(
    () => this.table()?.selectedRows().size ?? 0,
  );

  /** What the backend reported about the generated dataset. */
  readonly dataset = this.source.dataset;

  /** Human label of the interaction behind {@link lastQuery}. */
  readonly lastQueryLabel = computed(() => {
    const sample = this.lastQuery();
    return sample ? SCALE_INTERACTION_LABELS[sample.interaction] : '';
  });

  constructor() {
    if (this._route.snapshot.queryParamMap.get('view') !== this.activeId()) {
      this._writeViewToUrl(this.activeId());
    }
    this._loadVariant(this.activeId());
    this._route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const id = this._resolveViewId(params.get('view'));
      if (params.get('view') !== id) this._writeViewToUrl(id);
      if (id !== this.activeId()) this._loadVariant(id, 'filter');
    });

    // Every settled query is measured, not just the benchmarked ones: the panel
    // is meant to keep telling the truth while the visitor plays with the page.
    effect(() => {
      const metrics = this.source.metrics();
      if (!metrics) return;
      untracked(() => this._onQuerySettled(metrics));
    });

    // Re-run the opening query once the visitor is actually looking at the
    // page, so a showcase opened in a background tab still ends up with a real
    // initial-render number instead of a permanent placeholder.
    if (this._isBrowser) {
      const onVisibilityChange = (): void => {
        if (!document.hidden && this.initialRender() === null) {
          this._remeasureInitialRender();
        }
      };
      document.addEventListener('visibilitychange', onVisibilityChange);
      this._destroyRef.onDestroy(() =>
        document.removeEventListener('visibilitychange', onVisibilityChange),
      );
    }

    this._destroyRef.onDestroy(() => {
      this._scrollRun?.abort();
      this.source.destroy();
    });
  }

  /** Maps a row count to the option shape `mlv-select` renders. */
  readonly toSizeOption = (rows: number) => ({
    label:
      SCALE_DATASET_SIZES.find((size) => size.rows === rows)?.label ??
      `${rows} rows`,
    value: rows,
  });

  /**
   * Switches between a server-side page and every matching row in one scroller.
   *
   * The order of the two writes below is load bearing. `[virtualScroll]` reads
   * `mode()` directly, so it flips in the very next change detection pass —
   * while the source is still holding the answer the *previous* mode asked for.
   * Coming out of virtual scroll that answer is every matching row, and the
   * table would render all of it unvirtualised, with a selection checkbox added
   * to each. {@link ScaleDataSource.switchPageSize} drops those rows and
   * reshapes the query in the same synchronous step, so the pass that follows
   * renders an empty table under the existing loading overlay instead.
   *
   * Typed `unknown` because `mlv-segmented` is a generic signal-form control; a
   * value that is not a known mode is ignored rather than trusted.
   */
  setMode(mode: unknown): void {
    if (mode !== 'paged' && mode !== 'virtual') return;
    if (mode === this.mode()) return;
    this._markInteraction('page');
    this.mode.set(mode);
    this._applyPagingShape();
    this.benchmarkStatus.set(
      this.effectiveMode() === 'virtual'
        ? 'Virtual scroll: the backend returns every matching row and the viewport renders only what fits.'
        : 'Server-side paging: the backend returns one page and the table renders exactly that.',
    );
  }

  /**
   * Regenerates the dataset at a new size.
   *
   * A size can change the mode on its own: past {@link maxVirtualRows} one
   * virtual scroller is taller than the browser will scroll, so
   * {@link effectiveMode} falls back to paging and {@link _regenerate} reshapes
   * the query to match before the first one goes out.
   *
   * @param value - The select's emitted value. `mlv-select` types it as
   *   `T | T[] | null` for its multi-select mode; only a single number applies here.
   */
  setRowCount(value: number | number[] | null): void {
    const rows = typeof value === 'number' ? value : null;
    if (rows === null || rows === this.rowCount()) return;
    this.rowCount.set(rows);
    this._regenerate();
    if (!this.virtualScrollFits() && this.mode() === 'virtual') {
      this.benchmarkStatus.set(
        `${rows.toLocaleString()} rows at ${this.rowHeight} px is taller than the ${this.maxScrollablePx.toLocaleString()} px a browser will scroll, so the table is paging on the backend instead.`,
      );
    }
  }

  /** Turns expandable workspace children on or off. */
  setTreeRows(tree: boolean): void {
    if (tree === this.treeRows()) return;
    this.treeRows.set(tree);
    this._regenerate();
  }

  /** Sets the artificial delay applied to every subsequent query. */
  setLatency(value: number | null): void {
    const latency = Math.max(0, Math.round(value ?? 0));
    this.latencyMs.set(latency);
    this.source.setLatency(latency);
  }

  /** Records the commit time of a search, then applies it. */
  onSearchChange(query: string): void {
    if (query === this.search()) return;
    this._markInteraction('search');
    this.search.set(query);
  }

  /** Records the commit time of a filter change, then applies it. */
  onFiltersChange(filters: readonly MlvFilterState[]): void {
    this._markInteraction('filter');
    this.filters.set([...filters]);
  }

  /** Captures durable presentation, attributing sorts and page-size changes. */
  onPresentationStateChange(state: MlvDataTablePresentationState): void {
    const previous = this.tableState();
    const sortChanged =
      previous.sort?.key !== state.sort?.key ||
      previous.sort?.direction !== state.sort?.direction;
    if (sortChanged) this._markInteraction('sort');
    else if (previous.perPage !== state.perPage) this._markInteraction('page');
    this.tableState.set(cloneTableState(state));
  }

  /** Applies or removes the benchmark predicate and times the round trip. */
  measureFilterLatency(): void {
    const applied = this.filters().some(
      (filter) => filter.key === SCALE_BENCHMARK_FILTER.key,
    );
    const rest = this.filters().filter(
      (filter) => filter.key !== SCALE_BENCHMARK_FILTER.key,
    );
    this.onFiltersChange(applied ? rest : [...rest, SCALE_BENCHMARK_FILTER]);
    this.benchmarkStatus.set(
      applied
        ? 'Removed Status = Active and timed the round trip to the painted frame.'
        : 'Applied Status = Active and timed the round trip to the painted frame.',
    );
  }

  /**
   * Re-runs the current query after a backend failure.
   *
   * Bound to `mlv-data-table`'s `(retry)`, whose default error block renders a
   * Retry button. The source clears its own error when a response finally
   * lands, so nothing has to be reset here — but a backend that is genuinely
   * gone will simply fail again, which is the honest outcome.
   */
  retryQuery(): void {
    this.benchmarkStatus.set('Re-running the last query.');
    this.source.refresh();
  }

  /**
   * Scrolls the table for `durationMs` and reports the frames the browser
   * actually presented.
   *
   * Refused outright when the visitor has asked their system to reduce motion:
   * the benchmark is two seconds of unrequested scrolling, which is exactly the
   * kind of movement that preference is about. There is no reduced version of
   * it worth publishing — a run that does not scroll measures an idle page —
   * so the page says why instead of quietly reporting a meaningless number.
   *
   * @param durationMs - Sample length; the default is what the page's button uses.
   */
  async measureScroll(durationMs = SCALE_SCROLL_SAMPLE_MS): Promise<void> {
    if (this.scrollRunning()) return;
    if (prefersReducedMotion()) {
      this.benchmarkStatus.set(
        'Skipped: the benchmark scrolls the table for two seconds, and this system asks for reduced motion. Every other number on this page is still measured.',
      );
      return;
    }
    if (this._documentHidden()) {
      this.benchmarkStatus.set(
        'Frame sampling needs a visible tab — browsers stop delivering frames to a hidden one.',
      );
      return;
    }
    const element = this._scrollTarget();
    if (!element) {
      this.benchmarkStatus.set(
        'The table has not rendered a scroll surface yet.',
      );
      return;
    }
    const run = new AbortController();
    this._scrollRun = run;
    this.scrollRunning.set(true);
    this.benchmarkStatus.set('Sampling frames while scrolling the table…');
    try {
      const sample = await runScrollBenchmark({
        element,
        durationMs,
        signal: run.signal,
      });
      // The run outlived the page: whatever it sampled describes a table the
      // visitor has already navigated away from.
      if (run.signal.aborted || this._destroyRef.destroyed) return;
      this.scrollSample.set(sample);
      this.benchmarkStatus.set(
        sample
          ? `Sampled ${sample.frames} frames over ${Math.round(sample.durationMs)} ms of scrolling.`
          : 'Too few frames were presented to describe a frame rate.',
      );
    } finally {
      if (this._scrollRun === run) this._scrollRun = null;
      this.scrollRunning.set(false);
    }
  }

  /** Selects a saved view and mirrors it into the URL. */
  selectVariant(id: string): void {
    const resolved = this._resolveViewId(id);
    this._loadVariant(resolved, 'filter');
    this._writeViewToUrl(resolved);
  }

  /** Restores the active view, discarding local edits. */
  resetWorkingState(): void {
    this._applyState(this.baselineState(), 'filter');
    this.benchmarkStatus.set('Restored the saved view.');
  }

  /** Replaces the active view's state with the current one. */
  updateActiveView(): void {
    const source = this.activeVariant();
    if (!source?.capabilities.update || !this.dirty()) return;
    const state = normalizeScaleViewState(this.workingState());
    this.variants.update((items) =>
      items.map((item) => (item.id === source.id ? { ...item, state } : item)),
    );
    this.baselineState.set(state);
    this.benchmarkStatus.set(`Updated “${source.name}”.`);
  }

  /** Copies the active view into a new personal view. */
  duplicateActiveView(): void {
    const source = this.activeVariant();
    if (!source?.capabilities.clone) return;
    this.createView('personal', `${source.name} copy`);
  }

  /** Saves the current controls as a new view in the requested scope. */
  createView(
    scope: Exclude<MlvViewVariantScope, 'system'>,
    name?: string,
  ): void {
    const ordinal =
      this.variants().filter((variant) => variant.id.startsWith('saved-view'))
        .length + 1;
    const variant: MlvViewVariant<ScaleViewState> = {
      id: `saved-view-${ordinal}`,
      name: name ?? `Saved view ${ordinal}`,
      scope,
      capabilities: {
        clone: false,
        update: true,
        rename: false,
        delete: false,
        share: false,
      },
      state: normalizeScaleViewState(this.workingState()),
    };
    this.variants.update((items) => [...items, variant]);
    this.activeId.set(variant.id);
    this.baselineState.set(variant.state);
    this._writeViewToUrl(variant.id);
    this.benchmarkStatus.set(`Saved “${variant.name}” for this session only.`);
  }

  /** @private Rebuilds the dataset and restarts the initial-render measurement. */
  private _regenerate(): void {
    this._markInteraction('dataset');
    this._datasetStartedAt = now();
    this._awaitingFirstPaint = true;
    this.initialRender.set(null);
    this.source.configure({
      rowCount: this.rowCount(),
      tree: this.treeRows(),
    });
    // A size change can flip the mode by itself, and both writes have to land
    // before the change detection pass that reads them — see
    // {@link _applyPagingShape}. Both calls coalesce into the single query the
    // source dispatches on the next microtask.
    this._applyPagingShape();
  }

  /**
   * @private Hands the source the page size the mode on screen implies, and
   * drops whatever the previous shape delivered.
   *
   * `MlvDataTable` pushes `perPage` onto its source from an `effect()`, which
   * does not run until the change detection pass *after* `virtualScroll`
   * changed. Left to itself that means one query answered for the old shape —
   * out of virtual scroll, every matching row rendered unvirtualised — followed
   * by a second, correct one. Doing it here keeps the whole switch to a single
   * round trip and never lets the wrong shape reach the DOM.
   */
  private _applyPagingShape(): void {
    this.source.switchPageSize(
      this.effectiveMode() === 'virtual'
        ? SCALE_ALL_ROWS
        : this.tableState().perPage,
    );
  }

  /** @private Starts timing the commit-to-paint span of one interaction. */
  private _markInteraction(interaction: ScaleInteraction): void {
    this._pending = { interaction, startedAt: now() };
  }

  /**
   * @private Schedules the paint measurement for one settled query.
   *
   * `afterNextRender` runs after the DOM write of the change-detection pass this
   * response triggered; {@link measureAfterPaint} then waits one further frame,
   * which is the first frame whose presentation contains the new rows.
   */
  private _onQuerySettled(metrics: ScaleQueryMetrics): void {
    if (metrics.requestId === this._lastSampledRequestId) return;
    this._lastSampledRequestId = metrics.requestId;
    const arrivedAt = now();
    const hiddenAtArrival = this._documentHidden();
    const pending = this._pending;
    this._pending = null;
    afterNextRender(
      () =>
        measureAfterPaint((paintedAt) => {
          // A hidden tab is not throttled — it stops receiving frames entirely,
          // and the queued callback runs whenever the visitor comes back. That
          // interval is browser scheduling, not render cost, so the sample is
          // discarded rather than published as a spectacular number.
          if (hiddenAtArrival || this._documentHidden()) {
            this.benchmarkStatus.set(
              'A measurement was discarded because the tab was hidden while the rows arrived.',
            );
            return;
          }
          this._publishSample(metrics, pending, arrivedAt, paintedAt);
        }),
      { injector: this._injector },
    );
  }

  /** @private Whether the document is currently hidden. Always false off-browser. */
  private _documentHidden(): boolean {
    return this._isBrowser && document.hidden;
  }

  /**
   * @private Re-runs the opening query so the initial render can be measured
   * with the table actually on screen.
   *
   * The dataset itself is not rebuilt, so its already-measured generation cost
   * is folded back into the start mark — the end-to-end figure keeps meaning
   * "generate, query, wait, transfer, render" instead of counting the interval
   * the visitor spent in another tab.
   */
  private _remeasureInitialRender(): void {
    this._datasetStartedAt = now() - (this.dataset()?.generateMs ?? 0);
    this.source.refresh();
  }

  /** @private Turns one settled query into the published numbers. */
  private _publishSample(
    metrics: ScaleQueryMetrics,
    pending: { interaction: ScaleInteraction; startedAt: number } | null,
    arrivedAt: number,
    paintedAt: number,
  ): void {
    const renderMs = Math.max(0, paintedAt - arrivedAt);
    const sample: ScaleQuerySample = {
      interaction:
        pending?.interaction ?? (this._awaitingFirstPaint ? 'load' : 'query'),
      rowsReturned: metrics.rowsReturned,
      total: metrics.total,
      computeMs: metrics.computeMs,
      latencyMs: metrics.latencyMs,
      transferMs: metrics.transferMs,
      identifyMs: metrics.identifyMs,
      renderMs,
      commitToPaintMs: pending
        ? Math.max(0, paintedAt - pending.startedAt)
        : null,
      unpaged: metrics.unpaged,
    };
    this.lastQuery.set(sample);
    if (sample.interaction === 'filter' || sample.interaction === 'search') {
      this.filterSample.set(sample);
    }
    if (this._awaitingFirstPaint) {
      this._awaitingFirstPaint = false;
      const dataset = this.source.dataset();
      this.initialRender.set({
        rowsReturned: metrics.rowsReturned,
        datasetRows: dataset?.totalRows ?? 0,
        generateMs: dataset?.generateMs ?? 0,
        renderMs,
        endToEndMs: Math.max(0, paintedAt - this._datasetStartedAt),
      });
    }
  }

  /**
   * @private The element that actually scrolls.
   *
   * Both class names are public: `cdk-virtual-scroll-viewport` is the CDK's own,
   * and `mlv-data-table__wrapper` is the table's BEM element. The viewport is
   * checked first because in virtual mode it lives *inside* the wrapper.
   */
  private _scrollTarget(): HTMLElement | null {
    const host = this._host.nativeElement;
    return (
      host.querySelector<HTMLElement>('.cdk-virtual-scroll-viewport') ??
      host.querySelector<HTMLElement>('.mlv-data-table__wrapper')
    );
  }

  /** @private Selects a view and makes its state the new baseline. */
  private _loadVariant(id: string, interaction?: ScaleInteraction): void {
    const variant =
      this.variants().find((item) => item.id === id) ?? SCALE_DEFAULT_VIEW;
    this.activeId.set(variant.id);
    this.baselineState.set(normalizeScaleViewState(variant.state));
    this._applyState(variant.state, interaction);
  }

  /**
   * @private Pushes a saved state onto the controls and the table.
   *
   * The presentation half has to wait a microtask: `applyPresentationState`
   * writes the table's own signals, and the table may not have picked up the
   * search/filter writes made a line earlier yet.
   */
  private _applyState(
    state: ScaleViewState,
    interaction?: ScaleInteraction,
  ): void {
    if (interaction) this._markInteraction(interaction);
    this.search.set(state.search);
    this.filters.set([...state.filters]);
    const table = cloneTableState(state.table);
    this.tableState.set(table);
    queueMicrotask(() => {
      if (!this._destroyRef.destroyed)
        this.table()?.applyPresentationState(table);
    });
  }

  /** @private Falls back to the default view for an unknown `?view=` value. */
  private _resolveViewId(candidate: string | null): string {
    return candidate && this.variants().some((view) => view.id === candidate)
      ? candidate
      : SCALE_DEFAULT_VIEW.id;
  }

  /** @private Mirrors the active view into the URL without growing history. */
  private _writeViewToUrl(view: string): void {
    void this._router.navigate([], {
      relativeTo: this._route,
      queryParams: { view },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
