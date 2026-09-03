import type { TemplateRef } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  ViewEncapsulation,
  afterNextRender,
  computed,
  contentChild,
  contentChildren,
  inject,
  Injector,
  input,
  model,
  NgZone,
  numberAttribute,
  output,
  signal,
  effect,
  untracked,
  viewChild,
  viewChildren,
} from '@angular/core';
import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import { Grid, GridRow, GridCell, GridCellWidget } from '@angular/aria/grid';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription, filter, fromEvent, take, takeUntil } from 'rxjs';
import {
  CdkVirtualScrollViewport,
  ScrollingModule,
} from '@angular/cdk/scrolling';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import {
  DOWN_ARROW,
  LEFT_ARROW,
  RIGHT_ARROW,
  UP_ARROW,
} from '@angular/cdk/keycodes';
import {
  LucideArrowUp,
  LucideArrowDown,
  LucideChevronsUpDown,
  LucideChevronRight,
  LucideFilter,
  LucideTable2,
  LucideFunnel,
  LucidePencil,
  LucideCheck,
  LucideX,
  LucidePlus,
  LucidePin,
  LucidePinOff,
  LucideEye,
  LucideTriangleAlert,
  LucideArrowUpDown,
} from '@lucide/angular';
import { MlvLoader } from '@malva-ui/core/loader';
import { MlvCheckbox } from '@malva-ui/core/checkbox';
import { MlvPagination } from '@malva-ui/core/pagination';
import type { MlvSearchFieldTrigger } from '@malva-ui/core/search-field';
import { MlvSearchField } from '@malva-ui/core/search-field';
import { MlvResizeObserverService, MlvRtlService } from '@malva-ui/cdk/utils';
import type { MlvInfiniteScrollTrigger } from '@malva-ui/cdk/infinite-scroll';
import { MlvInfiniteScroll } from '@malva-ui/cdk/infinite-scroll';
import { MlvButton, MlvButtonIcon } from '@malva-ui/core/button';
import { MlvListItem } from '@malva-ui/core/list';
import { MlvMenu, MlvMenuItem, MlvMenuTrigger } from '@malva-ui/core/menu';
import { MlvBadge } from '@malva-ui/core/badge';
import { MlvEmptyState } from '@malva-ui/core/empty-state';
import type { MlvTone } from '@malva-ui/cdk/utils';
import {
  MlvDensityDirective,
  MLV_DENSITY_ELEMENT,
} from '@malva-ui/cdk/density';
import { MLV_DATA_TABLE_I18N, MlvI18nResolverService } from '@malva-ui/i18n';
import { MlvDataSource, MlvArrayDataSource } from '../data-source';
import { MlvDataTableEditingService } from './services/data-table-editing.service';
import { MlvDataTableColumnVisibilityService } from './services/data-table-column-visibility.service';
import { MlvDataTablePinningService } from './services/data-table-pinning.service';
import { MlvDataTableCell } from '../data-table-cell';
import type { MlvDataTableCellContext } from '../data-table-cell';
import { MlvDataTableEditCell } from '../data-table-edit-cell';
import { MlvDataTableNoData } from '../data-table-no-data';
import { MlvDataTableError } from '../data-table-error';
import type { MlvDataTableErrorContext } from '../data-table-error';
import { MlvDataTableFooter } from '../data-table-footer';
import { MlvDataTableToolbarActions } from '../data-table-toolbar-actions';
import { MlvFilterDropdown } from '../filter-dropdown/filter-dropdown';
import type {
  MlvFilterState,
  MlvSortState,
  MlvSortDirection,
} from '@malva-ui/cdk/data-source';
import type {
  MlvDataTableColumn,
  MlvDataTableColumnGroup,
  MlvEditMode,
  MlvEditEvent,
  MlvEditSaveEvent,
  MlvRowClickEvent,
  MlvSelectableMode,
  MlvSelectionChangeEvent,
  MlvPaginationMode,
  MlvLoadMoreEvent,
  MlvPinSide,
  MlvFilterDisplay,
  MlvColumnResizeEvent,
  MlvColumnResizeSource,
  MlvColumnToneFn,
  MlvDataTablePresentationState,
} from '../types';
import {
  MlvPopup,
  MlvPopupContent,
  MlvPopupTrigger,
} from '@malva-ui/core/popup';
import type { MlvColumnState, MlvDataRow } from './data-table-layout';
import {
  columnCellStyles,
  columnWidthStyles,
  flattenRows,
  isColumnVisible,
  originalRow,
  parsePixelWidth,
} from './data-table-layout';

const DEFAULT_COLUMN_WIDTH = 150;
const DEFAULT_COLUMN_MIN_WIDTH = 60;
const DEFAULT_COLUMN_MAX_WIDTH = 2000;
const DEFAULT_SELECTION_COLUMN_WIDTH = 40;
const DEFAULT_ACTIONS_COLUMN_WIDTH = 80;
const COLUMN_RESIZE_KEYBOARD_STEP = 8;
const COLUMN_RESIZE_KEYBOARD_LARGE_STEP = 32;

interface ColumnResizeBounds {
  min: number;
  max: number;
}

interface AuxiliaryColumnWidths {
  selection?: number;
  actions?: number;
}

type AuxiliaryColumnKind = keyof AuxiliaryColumnWidths;

interface ActiveColumnResize extends ColumnResizeBounds {
  key: string;
  pointerId: number;
  target: HTMLElement;
  startX: number;
  startWidth: number;
  latestWidth: number;
  moved: boolean;
}

@Component({
  selector: 'mlv-data-table',
  templateUrl: './data-table.html',
  styleUrl: './data-table.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgTemplateOutlet,
    ScrollingModule,
    MlvPagination,
    MlvSearchField,
    MlvFilterDropdown,
    MlvButton,
    MlvBadge,
    LucideArrowUp,
    LucideArrowDown,
    LucideChevronsUpDown,
    LucideChevronRight,
    LucideFilter,
    LucideTable2,
    LucideFunnel,
    LucidePencil,
    LucideCheck,
    LucideX,
    LucidePlus,
    LucidePin,
    LucidePinOff,
    LucideEye,
    LucideTriangleAlert,
    LucideArrowUpDown,
    MlvEmptyState,
    MlvLoader,
    MlvCheckbox,
    MlvPopupTrigger,
    MlvPopup,
    MlvPopupContent,
    MlvInfiniteScroll,
    MlvButtonIcon,
    Grid,
    GridRow,
    GridCell,
    GridCellWidget,
    MlvListItem,
    MlvMenu,
    MlvMenuItem,
    MlvMenuTrigger,
  ],
  providers: [
    { provide: MLV_DENSITY_ELEMENT, useValue: 'data-table' },
    MlvDataTableEditingService,
    MlvDataTableColumnVisibilityService,
    MlvDataTablePinningService,
  ],
  hostDirectives: [
    {
      directive: MlvDensityDirective,
      inputs: ['mlvDensity'],
    },
  ],
  host: {
    class: 'mlv-data-table',
  },
})
export class MlvDataTable {
  /** @protected Injected i18n translations for the data table. */
  protected readonly _i18n = inject(MLV_DATA_TABLE_I18N);

  // ---- Inputs ----------------------------------------------------------------
  readonly columns = input.required<MlvDataTableColumn[]>();
  readonly data = input<MlvDataRow[] | MlvDataSource<MlvDataRow> | undefined>(
    undefined,
  );
  readonly rowHeight = input(40);
  /** Enable CDK virtual scroll for large datasets. */
  readonly virtualScroll = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });
  /** Alternating row shading. */
  readonly striped = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });
  /** Cell border lines. */
  readonly bordered = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });
  /** Sticky table header on scroll. */
  readonly stickyHeader = input<boolean, BooleanInput>(true, {
    transform: coerceBooleanProperty,
  });

  /** Maximum height of the scrollable table area (e.g. `'28rem'`, `'400px'`). Enables vertical scroll. */
  readonly maxHeight = input<string | undefined>(undefined);

  /** Column group definitions for multi-row headers. */
  readonly columnGroups = input<MlvDataTableColumnGroup[]>([]);

  /** Enable editable mode on the table. */
  readonly editable = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /** Edit granularity: `'row'` edits entire rows, `'cell'` edits individual cells. */
  readonly editMode = input<MlvEditMode>('row');

  /** Show an "Add row" button in the toolbar when editable. */
  readonly addRow = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /** Show a loading overlay on top of the table. */
  readonly loading = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * Failed-request state. `false` (default) renders normally; `true` renders the
   * error block with the localized default message; a non-empty string renders
   * that string as the message.
   *
   * While set — and while {@link loading} is falsy — the error block replaces the
   * table body, taking precedence over both the rows and the `mlvDataTableNoData`
   * template so a failed request is never mistaken for an empty result set.
   * Project `<ng-template mlvDataTableError>` to replace the default block.
   */
  readonly error = input<boolean | string>(false);

  /** Row selection mode: `'single'`, `'multi'`, or `false` to disable. */
  readonly selectable = input<MlvSelectableMode>(false);

  /**
   * Accessible name for the trailing actions column header (rendered when
   * {@link editable} is on). The actions `<th>` has no visible label, so this
   * string is exposed to assistive tech via visually-hidden text to satisfy the
   * `empty-table-header` requirement. Defaults to `'Actions'`.
   *
   * NB: this is a plain English default input rather than a `MLV_DATA_TABLE_I18N`
   * token entry — adding an i18n string is a follow-up (see `libs-data-table.md`).
   */
  readonly actionsHeaderLabel = input('Actions');

  /**
   * **Experimental.** Opt into full cell-level keyboard navigation backed by the
   * `@angular/aria` grid pattern (`ngGrid`/`ngGridRow`/`ngGridCell`/`ngGridCellWidget`).
   *
   * When `false` (default), the table keeps its stable **row-level** roving
   * navigation (ArrowUp/Down move between rows, Home/End jump, Space/Enter toggle
   * row selection). When `true`, arrow keys move focus between individual **cells**
   * (Arrow keys in both axes, Home/End within a row), interactive cells expose an
   * `ngGridCellWidget` so Enter pauses grid navigation to interact (edit inputs,
   * action buttons), and Escape returns to grid navigation.
   *
   * Limitations of the current prototype (see `libs-data-table.md`):
   * - **Requires non-virtual mode.** Cell navigation is inert while
   *   {@link virtualScroll} is `true` — CDK row recycling and the split
   *   header/body/footer tables are incompatible with the grid's DOM-registered
   *   cell/row collection. `virtualScroll` wins; the table falls back to
   *   row-level roving.
   * - Row selection stays row-level (via the checkbox widget); the aria grid's
   *   own cell-selection model is intentionally not wired.
   */
  readonly cellNavigation = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * Pagination strategy.
   * - `'paged'` (default) — renders the classic paginator footer and swaps rows per page.
   * - `'infinite'` — hides the paginator and emits `loadMore` when the user scrolls near the bottom of the scroll container. Consumers should append the new page's rows to the existing data source.
   */
  readonly paginationMode = input<MlvPaginationMode>('paged');

  /**
   * Whether more data is available to load. Only consulted in `paginationMode: 'infinite'`.
   * Bind this to the consumer's own "has more pages" flag to stop the directive from
   * firing once the backing data source has been exhausted.
   */
  readonly hasMore = input<boolean, BooleanInput>(true, {
    transform: coerceBooleanProperty,
  });

  /**
   * Distance in px from the bottom of the scrollable area at which `loadMore` fires.
   * Only consulted in `paginationMode: 'infinite'`. Defaults to `200`.
   */
  readonly infiniteScrollThreshold = input<number>(200);

  /** Where table-owned filter controls are displayed. */
  readonly filterDisplay = input<MlvFilterDisplay>('toolbar');

  /** Whether the built-in global-search field is rendered in the toolbar. */
  readonly showSearch = input<boolean, BooleanInput>(true, {
    transform: coerceBooleanProperty,
  });

  /** Whether the generic Sort menu is rendered when sortable columns exist. */
  readonly showSortMenu = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /** Whether global search executes as the user types or only on submit. */
  readonly searchTrigger = input<MlvSearchFieldTrigger>('live');

  /** Delay in milliseconds used by live global search. */
  readonly searchDebounce = input<number, number | string>(200, {
    transform: (value) => Math.max(0, numberAttribute(value, 200)),
  });

  // ---- Outputs ----------------------------------------------------------------

  /** Emits when a row enters edit mode. */
  readonly rowEditStart = output<MlvEditEvent>();

  /** Emits when the user confirms edits on a row. */
  readonly rowEditSave = output<MlvEditSaveEvent>();

  /** Emits when the user cancels editing a row. */
  readonly rowEditCancel = output<MlvEditEvent>();

  /** Emits when the user clicks "Add row". Consumer is responsible for adding the row. */
  readonly rowAdd = output<void>();

  /** Emits when the user clicks a data row. */
  readonly rowClick = output<MlvRowClickEvent>();

  /** Emits when the row selection changes. */
  readonly selectionChange = output<MlvSelectionChangeEvent>();

  /**
   * Emits when the user activates the error block's retry control (the default
   * "Retry" button, or `retry()` from a custom `mlvDataTableError` template).
   * The consumer owns the refetch and is responsible for clearing {@link error}.
   */
  readonly retry = output<void>();

  /**
   * Emits after a pointer or keyboard interaction commits a column width, or
   * after a reset removes a user width override.
   */
  readonly columnResize = output<MlvColumnResizeEvent>();

  /**
   * Emits a complete normalized durable presentation snapshot after a user
   * changes sorting, column visibility, pinning, committed widths, or page size.
   * Programmatic {@link applyPresentationState} calls deliberately do not emit.
   */
  readonly presentationStateChange = output<MlvDataTablePresentationState>();

  /**
   * Emits in `paginationMode: 'infinite'` when the user scrolls near the bottom
   * of the scroll container. The payload carries the next page number,
   * current per-page size, and remaining scroll distance.
   */
  readonly loadMore = output<MlvLoadMoreEvent>();

  /** Two-way bindable set of selected rows. */
  readonly selectedRows = model<Set<MlvDataRow>>(new Set());

  /** Applied global-search query. Submit-mode drafts are committed here on search. */
  readonly searchQuery = model('');

  // ---- Content children -------------------------------------------------------
  readonly cellTemplates = contentChildren(MlvDataTableCell, {
    descendants: true,
  });
  readonly editCellTemplates = contentChildren(MlvDataTableEditCell, {
    descendants: true,
  });
  readonly noDataTemplate = contentChildren(MlvDataTableNoData, {
    descendants: true,
  });
  readonly errorTemplate = contentChildren(MlvDataTableError, {
    descendants: true,
  });
  readonly footerTemplate = contentChildren(MlvDataTableFooter, {
    descendants: true,
  });

  /** @protected Optional host-owned actions rendered last in the table toolbar. */
  protected readonly _toolbarActions = contentChild(MlvDataTableToolbarActions);

  // ---- View children ----------------------------------------------------------
  readonly tableWrapperRef = viewChild<ElementRef<HTMLElement>>('tableWrapper');
  readonly tableRef = viewChild<ElementRef<HTMLTableElement>>('tableEl');

  /**
   * @private Rendered resize separators. Used after rendering to measure
   * non-pixel CSS widths for accurate initial ARIA values.
   */
  private readonly _resizeHandleRefs =
    viewChildren<ElementRef<HTMLElement>>('resizeHandle');

  /**
   * @private Toolbar "Filters" trigger button. Focus is returned here when the
   * filter dialog popup closes, matching the overlay focus-restore pattern.
   */
  private readonly _filterTriggerRef = viewChild('filterBtn', {
    read: ElementRef,
  });

  /** @private CDK virtual-scroll viewport (only present in virtual-scroll mode). */
  private readonly _virtualViewportRef = viewChild(CdkVirtualScrollViewport);

  // ---- Services ---------------------------------------------------------------
  /** @private DestroyRef used for observable cleanup. */
  private readonly _destroyRef = inject(DestroyRef);
  /** @private Shared resize-observer service used to track the host width. */
  private readonly _resizeService = inject(MlvResizeObserverService);
  private readonly _rtlService = inject(MlvRtlService);
  /** @private Owning document for pointer fallback listeners and DOM queries. */
  private readonly _document = inject(DOCUMENT);
  /** @private Host element ref, observed for width and used for row focus queries. */
  private readonly _el = inject(ElementRef);
  /** @private Injector used to schedule `afterNextRender` from imperative handlers. */
  private readonly _injector = inject(Injector);
  /** @private Angular zone — column-resize drag listeners run outside it so pointer moves don't trigger a full CD tick per event (see {@link onResizeStart}). */
  private readonly _ngZone = inject(NgZone);

  /** @private Resolver for ICU parameterized i18n strings. */
  private readonly _resolver = inject(MlvI18nResolverService);

  /**
   * @protected Flat-rows index of the data row that currently owns the roving
   * `tabindex="0"`. All other data rows are `tabindex="-1"`, giving the row grid
   * a single tab stop. Clamped in a constructor effect when `flatRows` changes.
   */
  readonly _focusedRowIndex = signal(0);

  // ---- Internal state ---------------------------------------------------------
  readonly containerWidth = signal(0);
  readonly activeFilters = model<MlvFilterState[]>([]);

  /** @protected Search text currently shown in the toolbar, including submit-mode drafts. */
  readonly _searchDraft = signal('');

  readonly currentSort = signal<MlvSortState | null>(null);
  readonly currentPage = signal(1);
  readonly currentPerPage = signal(10);

  /**
   * Captures durable user-controlled table presentation in declaration order.
   * The returned object is safe to persist and excludes transient page state.
   */
  getPresentationState(): MlvDataTablePresentationState {
    const columns = this.columns();
    const sort = this.currentSort();
    const widths = this._columnWidths();
    const columnWidths: Record<string, number> = {};
    const visibleColumnKeys: string[] = [];
    const pinnedStartColumnKeys: string[] = [];
    const pinnedEndColumnKeys: string[] = [];

    for (const column of columns) {
      if (!this._visibility.isHidden(column.key)) {
        visibleColumnKeys.push(column.key);
      }

      const pinSide = this._pinning.getPinSide(column);
      if (pinSide === 'left') pinnedStartColumnKeys.push(column.key);
      if (pinSide === 'right') pinnedEndColumnKeys.push(column.key);

      const width = widths.get(column.key);
      if (width !== undefined) columnWidths[column.key] = width;
    }

    return {
      sort: sort ? { ...sort } : null,
      visibleColumnKeys,
      pinnedStartColumnKeys,
      pinnedEndColumnKeys,
      columnWidths,
      perPage: this._normalizePerPage(this.currentPerPage()),
    };
  }

  /**
   * Applies only the supplied durable presentation fields after filtering stale
   * keys and normalizing widths and page size. Applying a snapshot always
   * returns the transient current page to one and never emits an echo event.
   */
  applyPresentationState(state: Partial<MlvDataTablePresentationState>): void {
    const columns = this.columns();
    const columnKeys = new Set(columns.map((column) => column.key));

    if (state.sort !== undefined) {
      this.currentSort.set(
        this._normalizePresentationSort(state.sort, columns),
      );
    }

    if (state.visibleColumnKeys !== undefined) {
      const visible = this._knownPresentationKeys(
        state.visibleColumnKeys,
        columnKeys,
      );
      for (const column of columns) {
        if (!column.hideable) visible.add(column.key);
      }
      this._visibility.replaceHiddenColumns(
        new Set(
          columns
            .filter((column) => column.hideable && !visible.has(column.key))
            .map((column) => column.key),
        ),
      );
    }

    if (
      state.pinnedStartColumnKeys !== undefined ||
      state.pinnedEndColumnKeys !== undefined
    ) {
      const start =
        state.pinnedStartColumnKeys === undefined
          ? undefined
          : this._knownPresentationKeys(
              state.pinnedStartColumnKeys,
              columnKeys,
            );
      const end =
        state.pinnedEndColumnKeys === undefined
          ? undefined
          : this._knownPresentationKeys(state.pinnedEndColumnKeys, columnKeys);

      this._pinning.replaceOverrides(
        columns.map((column) => {
          let pinSide = this._pinning.getPinSide(column);
          if (start !== undefined) {
            pinSide = start.has(column.key)
              ? 'left'
              : pinSide === 'left'
                ? null
                : pinSide;
          }
          if (end !== undefined) {
            pinSide = end.has(column.key)
              ? 'right'
              : pinSide === 'right'
                ? null
                : pinSide;
          }
          return {
            key: column.key,
            pinned: pinSide !== null,
            pinSide: pinSide ?? column.pinSide ?? 'left',
          };
        }),
      );
    }

    if (state.columnWidths !== undefined) {
      const widths = new Map<string, number>();
      for (const column of columns) {
        const width = state.columnWidths[column.key];
        if (typeof width !== 'number') continue;
        widths.set(
          column.key,
          this._normalizeColumnWidth(width, this._columnResizeBounds(column)),
        );
      }
      this._columnWidths.set(widths);
    }

    if (state.perPage !== undefined) {
      this.currentPerPage.set(this._normalizePerPage(state.perPage));
    }

    this.currentPage.set(1);
    afterNextRender(() => this._measureHeaderWidths(), {
      injector: this._injector,
    });
  }

  /** @private Set of currently expanded tree rows (by original row reference). */
  private readonly _expanded = signal<Set<MlvDataRow>>(new Set());
  /** @private User-resized column widths keyed by column key (px). Committed once per completed pointer drag. */
  private readonly _columnWidths = signal<Map<string, number>>(new Map());

  /**
   * @private Live width (px) of the column currently being drag-resized, applied
   * optimistically during the drag before the committed {@link _columnWidths} map is
   * updated on pointer release. `null` when no resize is in progress. Kept separate from
   * {@link _columnWidths} so a move updates a single lightweight signal instead of
   * cloning the whole widths map every frame.
   */
  private readonly _liveResize = signal<{ key: string; width: number } | null>(
    null,
  );

  /**
   * @private Last DOM-resolved bounds for each resize handle. CSS lengths such
   * as `rem` can be resolved to pixels from the rendered header during an
   * interaction and then reused by the separator's ARIA attributes.
   */
  private readonly _resolvedResizeBounds = signal<
    Map<string, ColumnResizeBounds>
  >(new Map());

  /**
   * @private Rendered header widths keyed by column. This supplies accurate
   * separator values when a column's declared width uses `rem`, `%`, or layout.
   */
  private readonly _measuredColumnWidths = signal<Map<string, number>>(
    new Map(),
  );

  /** @private Rendered widths of the optional selection and actions columns. */
  private readonly _measuredAuxiliaryWidths = signal<AuxiliaryColumnWidths>({});

  /** @protected Native vertical-scrollbar width inside the virtual viewport. */
  protected readonly _virtualScrollbarGutter = signal(0);

  /**
   * @protected Inert outer scroll width that reproduces the virtual viewport's
   * native horizontal range without changing any split table's layout.
   */
  protected readonly _virtualHorizontalScrollExtent = signal(0);

  /** @private Whether table geometry is currently frozen to explicit pixel widths. */
  private readonly _columnLayoutFrozen = computed(
    () => this._liveResize() !== null || this._columnWidths().size > 0,
  );

  /**
   * @private Exact measured utility-column styles used once data columns are
   * frozen. Keeping selection/actions cells and their `<col>` elements on the
   * same widths prevents fixed table layout from redistributing data columns.
   */
  private readonly _auxiliaryColumnStyles = computed<
    Record<AuxiliaryColumnKind, Readonly<Record<string, string>> | null>
  >(() => {
    const measured = this._measuredAuxiliaryWidths();
    if (!this._columnLayoutFrozen()) {
      return { selection: null, actions: null };
    }
    return {
      selection: this._fixedColumnWidthStyles(measured.selection),
      actions: this._fixedColumnWidthStyles(measured.actions),
    };
  });

  /**
   * @private Per-row cache of the cell-template `ngTemplateOutletContext`, keyed by the
   * flattened row object identity (see {@link getCellContext}). A `WeakMap` so entries
   * for rows dropped by a `flatRows()` recompute are reclaimed automatically.
   */
  private readonly _cellContextCache = new WeakMap<
    MlvDataRow,
    MlvDataTableCellContext<MlvDataRow>
  >();

  /** @private Stable one-column arrays used by repeated header filter editors. */
  private readonly _columnFilterLists = new Map<string, MlvDataTableColumn[]>();

  /** @private Editing state moved to MlvDataTableEditingService. */
  private readonly _editing = inject(MlvDataTableEditingService<MlvDataRow>);

  /** @private Column visibility state moved to MlvDataTableColumnVisibilityService. */
  private readonly _visibility = inject(MlvDataTableColumnVisibilityService);

  /** @private Pin override state moved to MlvDataTablePinningService. */
  private readonly _pinning = inject(MlvDataTablePinningService);

  // ---- Derived state ----------------------------------------------------------

  readonly effectiveDataSource = computed<MlvDataSource<MlvDataRow>>(() => {
    const d = this.data();
    if (d instanceof MlvDataSource) {
      return d;
    }
    const rows: MlvDataRow[] = Array.isArray(d) ? d : [];
    return new MlvArrayDataSource<MlvDataRow>(rows);
  });

  readonly displayRows = computed<MlvDataRow[]>(() => {
    const ds = this.effectiveDataSource();
    return ds.connect()();
  });

  readonly flatRows = computed<MlvDataRow[]>(() => {
    const rows = this.displayRows();
    const expanded = this._expanded();
    return flattenRows(rows, expanded);
  });

  /**
   * @protected Rows the virtual-scroll repeater iterates.
   *
   * Identical to {@link flatRows} except while {@link showError} is set, where
   * it empties so the error row can replace the body. The distinction exists
   * because `*cdkVirtualFor` must never be destroyed while its
   * `cdk-virtual-scroll-viewport` survives: the viewport announces its rendered
   * range on a plain `Subject`, so a repeater constructed after the viewport
   * already exists receives no range until the next scroll and renders nothing.
   * Emptying the repeater's input is the state change the viewport does react
   * to; removing the repeater is not.
   */
  protected readonly _virtualRows = computed<MlvDataRow[]>(() =>
    this.showError() ? [] : this.flatRows(),
  );

  readonly totalItems = computed(() => this.effectiveDataSource().totalItems());
  readonly shownItems = computed(() => this.flatRows().length);

  readonly visibleColumns = computed<MlvColumnState[]>(() => {
    const cols = this.columns() as MlvColumnState[];
    const containerW = this.containerWidth();
    const widths = this._columnWidths();
    const live = this._liveResize();
    const measured = this._measuredColumnWidths();
    const freezeLayout = this._columnLayoutFrozen();
    const pinOverrides = this._pinning.overrides();
    const hidden = this._visibility.hiddenColumns();

    return cols
      .map((col) => {
        const visible = isColumnVisible(col, containerW);
        // During a drag the live width wins over the committed map value so the
        // column tracks the pointer before the map is updated on pointer release.
        const w =
          live && live.key === col.key ? live.width : widths.get(col.key);
        const override = pinOverrides.get(col.key);
        return {
          ...col,
          pinned: override ? override.pinned : col.pinned,
          pinSide: override ? override.pinSide : col.pinSide,
          _currentWidth:
            w ??
            (freezeLayout
              ? (measured.get(col.key) ?? parsePixelWidth(col.width))
              : undefined),
          _visible: visible,
        } as MlvColumnState;
      })
      .filter((c) => c._visible !== false && !hidden.has(c.key))
      .sort((a, b) => {
        const order = (col: MlvColumnState): number => {
          if (col.pinned && col.pinSide !== 'right') return 0;
          if (!col.pinned) return 1;
          return 2; // pinned right
        };
        return order(a) - order(b);
      });
  });

  readonly pinnedLeftColumns = computed(() =>
    this.visibleColumns().filter((c) => c.pinned && c.pinSide !== 'right'),
  );

  readonly pinnedRightColumns = computed(() =>
    this.visibleColumns().filter((c) => c.pinned && c.pinSide === 'right'),
  );

  readonly columnOffsets = computed<Map<string, string>>(() => {
    const map = new Map<string, string>();
    const leftWidths: string[] = [];
    for (const col of this.pinnedLeftColumns()) {
      map.set(col.key + '_left', this._sumCssLengths(leftWidths));
      leftWidths.push(this._columnOffsetWidth(col));
    }
    const rightWidths: string[] = [];
    const rightCols = [...this.pinnedRightColumns()].reverse();
    for (const col of rightCols) {
      map.set(col.key + '_right', this._sumCssLengths(rightWidths));
      rightWidths.push(this._columnOffsetWidth(col));
    }
    return map;
  });

  /**
   * Exact table width used while at least one column has a live or committed
   * user override. Freezing every measured column and the table to the same
   * pixel sum prevents `width: 100%` table layout from redistributing the
   * committed width. All virtual split tables and their viewport consume this
   * same value.
   */
  readonly resizedTableWidth = computed<number | null>(() => {
    if (!this._columnLayoutFrozen()) return null;

    const measured = this._measuredColumnWidths();
    const auxiliary = this._measuredAuxiliaryWidths();
    let total = 0;
    for (const col of this.visibleColumns()) {
      total +=
        col._currentWidth ??
        measured.get(col.key) ??
        parsePixelWidth(col.width) ??
        DEFAULT_COLUMN_WIDTH;
    }
    if (this.selectable()) {
      total += auxiliary.selection ?? DEFAULT_SELECTION_COLUMN_WIDTH;
    }
    if (this.editable()) {
      total += auxiliary.actions ?? DEFAULT_ACTIONS_COLUMN_WIDTH;
    }
    return this._roundColumnWidth(total);
  });

  /**
   * @private Memoized inline `[style]` object per visible column, keyed by column key.
   * Rebuilt only when {@link visibleColumns} or {@link columnOffsets} change (width /
   * pin / visibility / responsive / live-resize changes). Cell `[style]` bindings read
   * this map through {@link getCellStyle} so they receive a *stable* object reference
   * across change-detection cycles instead of a freshly allocated `Record` per cell per
   * CD; the header and body cells of a column share one object.
   */
  private readonly _columnStyles = computed<
    Map<string, Record<string, string>>
  >(() => {
    const offsets = this.columnOffsets();
    const map = new Map<string, Record<string, string>>();
    for (const col of this.visibleColumns()) {
      map.set(col.key, columnCellStyles(col, offsets));
    }
    return map;
  });

  /**
   * @private Display cell templates resolved to a `Map<columnKey, TemplateRef>`, rebuilt
   * only when the projected {@link cellTemplates} set changes. Replaces a per-cell
   * `Array.find()` on every CD ({@link getTemplate}). First registration wins for
   * duplicate keys, preserving the previous `find()` (first-match) semantics.
   */
  private readonly _cellTemplateMap = computed(() => {
    const map = new Map<string, TemplateRef<unknown>>();
    for (const t of this.cellTemplates()) {
      const key = t.columnKey();
      if (!map.has(key)) map.set(key, t.templateRef as TemplateRef<unknown>);
    }
    return map;
  });

  /**
   * @private Edit-mode cell templates resolved to a `Map<columnKey, TemplateRef>`,
   * rebuilt only when the projected {@link editCellTemplates} set changes. Replaces a
   * per-cell `Array.find()` on every CD ({@link getEditTemplate}). First registration
   * wins for duplicate keys.
   */
  private readonly _editCellTemplateMap = computed(() => {
    const map = new Map<string, TemplateRef<unknown>>();
    for (const t of this.editCellTemplates()) {
      const key = t.columnKey();
      if (!map.has(key)) map.set(key, t.templateRef as TemplateRef<unknown>);
    }
    return map;
  });

  /**
   * @protected Whether the experimental aria cell-level grid navigation is
   * active. Gated to non-virtual mode: `virtualScroll` recycles rows out of the
   * DOM, which the aria grid's DOM-registered row/cell collection cannot track,
   * so cell navigation yields to the stable row-roving path when virtual scroll
   * is on.
   */
  readonly _cellNav = computed(
    () => this.cellNavigation() && !this.virtualScroll(),
  );

  /**
   * Whether the error block replaces the table body. An in-flight refetch wins:
   * while `loading` is truthy the previous error is suppressed so the loader is
   * not competing with a stale failure message.
   */
  readonly showError = computed(() => {
    const error = this.error();
    if (this.loading()) return false;
    return typeof error === 'string' ? error.trim().length > 0 : error === true;
  });

  /**
   * Message rendered by the error block: the `error` string when one was
   * supplied, otherwise the localized `errorMessage` default.
   */
  readonly errorMessage = computed(() => {
    const error = this.error();
    return typeof error === 'string' && error.trim().length > 0
      ? error
      : this._i18n().errorMessage;
  });

  /**
   * @private Stable `retry()` callback handed to the `mlvDataTableError`
   * template context, so the context object identity only changes with the
   * message.
   */
  private readonly _emitRetry = (): void => this.onRetry();

  /**
   * @protected `ngTemplateOutletContext` for a projected `mlvDataTableError`
   * template.
   */
  protected readonly _errorContext = computed<MlvDataTableErrorContext>(() => ({
    $implicit: this.errorMessage(),
    retry: this._emitRetry,
  }));

  /**
   * @private Per-column raw-value → label lookup, memoized from
   * `visibleColumns()`. Falls back to `filterConfig.options` when a column
   * declares no explicit `valueLabels`. Keys are stringified raw values.
   */
  private readonly _columnValueLabels = computed<
    Map<string, Map<string, string>>
  >(() => {
    const map = new Map<string, Map<string, string>>();
    for (const col of this.visibleColumns()) {
      const source = col.valueLabels ?? col.filterConfig?.options;
      if (!source) continue;
      const labels = new Map<string, string>();
      if (Array.isArray(source)) {
        for (const option of source) {
          labels.set(String(option.value), option.label);
        }
      } else {
        for (const [value, label] of Object.entries(
          source as Record<string, string>,
        )) {
          labels.set(value, label);
        }
      }
      if (labels.size > 0) map.set(col.key, labels);
    }
    return map;
  });

  readonly hasFilters = computed(() => this.activeFilters().length > 0);

  /** Columns included in the global query, independent of responsive visibility. */
  readonly searchableColumns = computed(() =>
    this.columns().filter((column) => column.searchable),
  );

  /** Stable key list passed to the data source for OR-across-columns search. */
  readonly searchableColumnKeys = computed(() =>
    this.searchableColumns().map((column) => column.key),
  );

  /** Whether a global search field belongs in the toolbar. */
  readonly hasSearchableColumns = computed(
    () => this.searchableColumns().length > 0,
  );

  /** Whether any configured column supports filtering. */
  readonly hasFilterableColumns = computed(() =>
    this.columns().some((column) => column.filterable),
  );

  /** Whether any configured column supports sorting. */
  readonly hasSortableColumns = computed(() =>
    this.columns().some((column) => column.sortable),
  );

  /** Localized active-filter summary announced when the committed set changes. */
  readonly activeFilterLabel = computed(() =>
    this._resolver.resolve(
      this._i18n() as unknown as Record<string, string>,
      'activeFilterCount',
      { count: this.activeFilters().length },
    ),
  );

  /** Total number of rendered columns (visible + selection checkbox + actions). */
  readonly totalColumnCount = computed(() => {
    let count = this.visibleColumns().length;
    if (this.selectable()) count++;
    if (this.editable()) count++;
    return count;
  });

  /**
   * Pixel/CSS height applied to the `cdk-virtual-scroll-viewport` when `virtualScroll` is on.
   * Falls back to `'24rem'` if `maxHeight` is not provided. The viewport requires an explicit
   * height because `cdk-virtual-scroll-viewport` does not derive its size from its content.
   */
  readonly virtualViewportHeight = computed(() => this.maxHeight() ?? '24rem');

  /** Whether any column has `hideable: true`. */
  readonly hasHideableColumns = computed(() =>
    this.columns().some((c) => c.hideable),
  );

  /** Whether the toolbar has a visible control or table-owned status to render. */
  readonly hasToolbarContent = computed(
    () =>
      (this.showSearch() && this.hasSearchableColumns()) ||
      (this.filterDisplay() !== 'none' && this.hasFilters()) ||
      (this.editable() && this.addRow()) ||
      (this.showSortMenu() && this.hasSortableColumns()) ||
      this.hasHideableColumns() ||
      (this.filterDisplay() === 'toolbar' && this.hasFilterableColumns()) ||
      !!this._toolbarActions(),
  );

  /** All columns (for column visibility popup). */
  readonly allColumns = computed(() => this.columns());

  /** Whether all visible rows are selected. */
  readonly allRowsSelected = computed(() => {
    const rows = this.flatRows();
    const selected = this.selectedRows();
    return rows.length > 0 && rows.every((r) => selected.has(this._ref(r)));
  });

  /** Whether some (but not all) rows are selected. */
  readonly someRowsSelected = computed(() => {
    const rows = this.flatRows();
    const selected = this.selectedRows();
    const count = rows.filter((r) => selected.has(this._ref(r))).length;
    return count > 0 && count < rows.length;
  });

  /** Whether the table has multi-row column groups defined. */
  readonly hasColumnGroups = computed(() => this.columnGroups().length > 0);

  /**
   * Computes the group header row layout.
   * Columns covered by a group get colspan in the group row.
   * Standalone columns (not in any group) get rowspan="2" in the main header row.
   */
  readonly headerLayout = computed(() => {
    const groups = this.columnGroups();
    const visible = this.visibleColumns();

    if (groups.length === 0) return null;

    const groupedKeys = new Set(groups.flatMap((g) => g.columns));

    // Build group header cells
    const groupCells: {
      type: 'group';
      group: MlvDataTableColumnGroup;
      colspan: number;
    }[] = [];
    const standaloneKeys = new Set<string>();

    // Track which visible columns belong to which group
    let colIndex = 0;
    while (colIndex < visible.length) {
      const col = visible[colIndex];
      const group = groups.find((g) => g.columns.includes(col.key));
      if (group) {
        // Count how many consecutive visible columns belong to this group
        const span = visible.filter((c) =>
          group.columns.includes(c.key),
        ).length;
        groupCells.push({ type: 'group', group, colspan: span });
        // Skip all columns in this group
        colIndex += span;
      } else {
        standaloneKeys.add(col.key);
        colIndex++;
      }
    }

    return { groupCells, standaloneKeys, groupedKeys };
  });

  // ---- Lifecycle --------------------------------------------------------------

  constructor() {
    // Detach any in-flight column-resize drag listeners if the table is destroyed
    // mid-drag (e.g. a route change while the user is resizing a column) so the dead
    // component's document listeners can't keep firing.
    this._destroyRef.onDestroy(() => this._cleanupResize());

    effect(() => {
      const ds = this.effectiveDataSource();
      ds.setSort(this.currentSort());
    });
    effect(() => {
      const ds = this.effectiveDataSource();
      const filters = this.activeFilters();
      ds.setFilters(filters);
      untracked(() => {
        if (this.currentPage() !== 1) this.currentPage.set(1);
      });
    });
    effect(() => {
      const ds = this.effectiveDataSource();
      const query = this.searchQuery();
      const keys = this.searchableColumnKeys();
      ds.setSearch(query.trim() && keys.length ? { query, keys } : null);
      untracked(() => {
        if (this._searchDraft() !== query) this._searchDraft.set(query);
        if (this.currentPage() !== 1) this.currentPage.set(1);
      });
    });
    effect(() => {
      const ds = this.effectiveDataSource();
      // In infinite or virtual-scroll mode the consumer hands over the entire
      // row set up front, so the internal data source must stay on page 1 at
      // all times — pagination is disabled in both modes.
      const unpaged =
        this.paginationMode() === 'infinite' || this.virtualScroll();
      const page = unpaged ? 1 : this.currentPage();
      // The call is untracked because a data source is free to read its own
      // state inside `setPage` — a server-backed one typically compares the
      // incoming page against the one it already holds so a no-op call does
      // not cost a round trip. Tracked, those reads would become dependencies
      // of this effect, and the sibling effect below writes one of them: the
      // base `setPerPage` resets the page to 1. The two would then retrigger
      // each other synchronously inside a single change-detection pass, which
      // never yields to a microtask and freezes the tab outright. Only the
      // inputs read above belong in this effect's dependency set.
      untracked(() => ds.setPage(page));
    });
    effect(() => {
      const ds = this.effectiveDataSource();
      // In infinite or virtual-scroll mode disable internal per-page slicing
      // so every row the consumer has provided gets rendered. Virtual scroll
      // then renders only the visible slice of that full list via CDK.
      const unpaged =
        this.paginationMode() === 'infinite' || this.virtualScroll();
      const perPage = unpaged ? Number.MAX_SAFE_INTEGER : this.currentPerPage();
      // Untracked for the same reason as the page effect above.
      untracked(() => ds.setPerPage(perPage));
    });

    // Keep the roving row index in range as the visible rows change
    // (filtering, sorting, paging, tree expand/collapse, data replacement).
    effect(() => {
      const count = this.flatRows().length;
      const current = untracked(this._focusedRowIndex);
      if (count === 0) {
        if (current !== 0) this._focusedRowIndex.set(0);
      } else if (current > count - 1) {
        this._focusedRowIndex.set(count - 1);
      }
    });

    effect(() => {
      const handles = this._resizeHandleRefs();
      if (!handles.length) return;
      afterNextRender(() => this._measureHeaderWidths(), {
        injector: this._injector,
      });
    });

    effect((onCleanup) => {
      if (!this.virtualScroll()) return;
      const wrapper = this.tableWrapperRef()?.nativeElement;
      const viewport = this._virtualViewportRef()?.elementRef.nativeElement;
      if (!wrapper || !viewport) return;

      let synchronizing = false;
      const measureVirtualGeometry = (): void => {
        this._updateVirtualScrollGeometry(wrapper, viewport);
      };

      const syncFromWrapper = (): void => {
        if (synchronizing || viewport.scrollLeft === wrapper.scrollLeft) return;
        synchronizing = true;
        try {
          viewport.scrollLeft = wrapper.scrollLeft;
        } finally {
          synchronizing = false;
        }
      };

      const syncFromViewport = (): void => {
        if (synchronizing || wrapper.scrollLeft === viewport.scrollLeft) return;
        synchronizing = true;
        try {
          wrapper.scrollLeft = viewport.scrollLeft;
          const acceptedScrollLeft = wrapper.scrollLeft;
          if (viewport.scrollLeft !== acceptedScrollLeft) {
            viewport.scrollLeft = acceptedScrollLeft;
          }
        } finally {
          synchronizing = false;
        }
      };

      // `{ passive: true }` is forwarded to `addEventListener` — a non-passive
      // scroll listener is its own performance bug, so it is not optional.
      //
      // Released from this effect's `onCleanup`, not `takeUntilDestroyed`:
      // `wrapper` and `viewport` are re-resolved every time the effect re-runs
      // (virtual scroll toggling, the viewport being re-created), and
      // `takeUntilDestroyed` fires only at destroy — it would leave every
      // earlier generation subscribed to an element this table no longer uses.
      //
      // `runOutsideAngular` is kept for consumers still on zone-based change
      // detection, where the zone would schedule its own tick on top.
      const scrollSubscriptions = new Subscription();
      this._ngZone.runOutsideAngular(() => {
        scrollSubscriptions.add(
          fromEvent(wrapper, 'scroll', { passive: true }).subscribe(
            syncFromWrapper,
          ),
        );
        scrollSubscriptions.add(
          fromEvent(viewport, 'scroll', { passive: true }).subscribe(
            syncFromViewport,
          ),
        );
        measureVirtualGeometry();
        syncFromWrapper();
      });
      scrollSubscriptions.add(
        this._resizeService.observe(viewport).subscribe(() => {
          measureVirtualGeometry();
          syncFromWrapper();
        }),
      );
      onCleanup(() => scrollSubscriptions.unsubscribe());
    });

    effect(() => {
      if (!this.virtualScroll()) return;
      this.resizedTableWidth();
      this.visibleColumns();
      this._virtualScrollbarGutter();
      afterNextRender(() => this._syncVirtualHorizontalScroll(), {
        injector: this._injector,
      });
    });

    afterNextRender(() => {
      const el = this._el.nativeElement as HTMLElement;
      this._resizeService
        .observe(el)
        .pipe(takeUntilDestroyed(this._destroyRef))
        .subscribe((entries) => {
          const width = entries[0]?.contentRect?.width ?? el.offsetWidth;
          this.containerWidth.set(width);
          afterNextRender(() => this._measureHeaderWidths(), {
            injector: this._injector,
          });
        });
      this.containerWidth.set(el.offsetWidth);
      this._measureHeaderWidths();
    });
  }

  // ---- Template helpers -------------------------------------------------------

  /** Resolves the custom display template for a column key (if any). */
  getTemplate(key: string): TemplateRef<unknown> | null {
    return this._cellTemplateMap().get(key) ?? null;
  }

  getNoDataTemplate(): TemplateRef<unknown> | null {
    const list = this.noDataTemplate();
    return list.length > 0 ? list[0].templateRef : null;
  }

  /**
   * `ngTemplateOutletContext` for a data cell's custom/edit template. Returns a
   * *stable* per-row object so the outlet's context does not churn (fresh object +
   * `NgTemplateOutlet.ngOnChanges`) every change-detection cycle. `flatRows()` rebuilds
   * its row objects on every data / sort / filter / expand change, so a cached entry's
   * `index` always matches that row's current position and stale entries (whose row
   * objects are no longer referenced) are garbage-collected.
   */
  getCellContext(
    row: MlvDataRow,
    index: number,
  ): MlvDataTableCellContext<MlvDataRow> {
    let ctx = this._cellContextCache.get(row);
    if (!ctx) {
      ctx = { $implicit: row, row, index };
      this._cellContextCache.set(row, ctx);
    }
    return ctx;
  }

  getCellValue(row: MlvDataRow, key: string): unknown {
    return (row as Record<string, unknown>)[key];
  }

  /**
   * Value rendered by the **default** cell renderer. Maps the raw value through
   * the column's `valueLabels` (or its `filterConfig.options` fallback) when a
   * label exists; otherwise returns the raw value unchanged. Custom
   * `mlvDataTableCell` templates bypass this entirely.
   */
  getCellDisplayValue(row: MlvDataRow, col: MlvDataTableColumn): unknown {
    const raw = this.getCellValue(row, col.key);
    if (raw === null || raw === undefined) return raw;
    const labels = this._columnValueLabels().get(col.key);
    if (!labels) return raw;
    return labels.get(String(raw)) ?? raw;
  }

  /**
   * Resolves the semantic tone for one default-rendered cell. Returns `null`
   * when the column declares no `tone` (or its resolver opted this row out), in
   * which case the cell renders as plain text instead of a badge.
   */
  getCellTone(row: MlvDataRow, col: MlvDataTableColumn): MlvTone | null {
    const tone = col.tone;
    if (!tone) return null;
    if (typeof tone === 'function') {
      return (tone as MlvColumnToneFn<MlvDataRow>)(row) ?? null;
    }
    return tone;
  }

  /** Retrieves the projected error template, if the consumer supplied one. */
  getErrorTemplate(): TemplateRef<MlvDataTableErrorContext> | null {
    const list = this.errorTemplate();
    return list.length > 0 ? list[0].templateRef : null;
  }

  /** Emits `retry` so the consumer can refetch the failed request. */
  onRetry(): void {
    this.retry.emit();
  }

  /** Resolves the edit-mode template for a column key (if any). */
  getEditTemplate(key: string): TemplateRef<unknown> | null {
    return this._editCellTemplateMap().get(key) ?? null;
  }

  /** Whether a given row index is currently being edited. */
  isEditing(index: number): boolean {
    return this._editing.isEditing(index);
  }

  /** Enter edit mode for a row. Clones the row for rollback. */
  startEdit(row: MlvDataRow, index: number): void {
    this._editing.start(row, index);
    this.rowEditStart.emit({ row, index });
  }

  /** Confirm edits for a row. Emits save event with original and modified row. */
  saveEdit(row: MlvDataRow, index: number): void {
    const originalRow = this._editing.save(row, index);
    this.rowEditSave.emit({ row, index, originalRow });
  }

  /** Cancel editing. Emits cancel event. */
  cancelEdit(row: MlvDataRow, index: number): void {
    this._editing.cancel(index);
    this.rowEditCancel.emit({ row, index });
  }

  /** Emit add-row event. Consumer is responsible for appending the new row. */
  onAddRow(): void {
    this.rowAdd.emit();
  }

  // ---- Row click ---------------------------------------------------------------

  /** Handle click on a data row. */
  onRowClick(row: MlvDataRow, index: number, event: MouseEvent): void {
    this._focusedRowIndex.set(index);
    this.rowClick.emit({ row, index, event });
  }

  // ---- Row keyboard navigation (grid row-focus model) --------------------------

  /**
   * @protected Roving tabindex for a data row: `0` for the focused row, `-1`
   * otherwise, so the row grid exposes a single tab stop.
   */
  _rowTabIndex(index: number): number {
    return index === this._focusedRowIndex() ? 0 : -1;
  }

  /**
   * @protected Sync the roving row index when a row receives focus (via Tab or
   * a click that focuses the `<tr>`).
   */
  _onRowFocus(index: number): void {
    this._focusedRowIndex.set(index);
  }

  /**
   * @protected Row-level keyboard navigation for the `role="grid"` table.
   * Active only when the `<tr>` itself holds focus — keys originating from an
   * interactive cell widget (checkbox, button, edit input) are left alone.
   *
   * - `ArrowUp` / `ArrowDown` — move row focus by one (clamped)
   * - `Home` / `End` — jump to the first / last row
   * - `Space` / `Enter` — toggle selection of the focused row when selectable
   */
  _onRowKeydown(index: number, row: MlvDataRow, event: KeyboardEvent): void {
    if (event.target !== event.currentTarget) return;

    const lastIndex = this.flatRows().length - 1;
    switch (this._rtlService.normalizeArrowKey(event) ?? event.key) {
      case DOWN_ARROW:
        event.preventDefault();
        this._moveRowFocus(Math.min(index + 1, lastIndex));
        break;
      case UP_ARROW:
        event.preventDefault();
        this._moveRowFocus(Math.max(index - 1, 0));
        break;
      case 'Home':
        event.preventDefault();
        this._moveRowFocus(0);
        break;
      case 'End':
        event.preventDefault();
        this._moveRowFocus(lastIndex);
        break;
      case ' ':
      case 'Enter':
        if (this.selectable()) {
          event.preventDefault();
          this.toggleRowSelection(row);
        }
        break;
    }
  }

  /**
   * @private Move the roving tabindex and DOM focus to the row at `targetIndex`.
   * In virtual-scroll mode the target may be recycled out of the DOM, so it is
   * scrolled into view first and focused after the next render.
   */
  private _moveRowFocus(targetIndex: number): void {
    if (targetIndex < 0) return;
    this._focusedRowIndex.set(targetIndex);

    if (this.virtualScroll()) {
      this._virtualViewportRef()?.scrollToIndex(targetIndex, 'smooth');
    }

    afterNextRender(() => this._focusRowElement(targetIndex), {
      injector: this._injector,
    });
  }

  /** @private Focus the rendered `<tr>` for the given flat-rows index, if present. */
  private _focusRowElement(index: number): void {
    const host = this._el.nativeElement as HTMLElement;
    const rowEl = host.querySelector(
      `[data-row-index="${index}"]`,
    ) as HTMLElement | null;
    rowEl?.focus();
  }

  // ---- Infinite scroll ---------------------------------------------------------

  /**
   * Handler wired to `MlvInfiniteScroll.loadMore` when `paginationMode === 'infinite'`.
   * Increments the tracked page counter and emits a table-level `MlvLoadMoreEvent`
   * whose `page` field tells the consumer which page to fetch next.
   */
  onInfiniteScrollLoadMore(trigger: MlvInfiniteScrollTrigger): void {
    const nextPage = this.currentPage() + 1;
    this.currentPage.set(nextPage);
    this.loadMore.emit({
      page: nextPage,
      perPage: this.currentPerPage(),
      distance: trigger.distance,
    });
  }

  /** @internal Applies a transient paginator page change without a snapshot. */
  _onPageChange(page: number): void {
    this.currentPage.set(Math.max(1, Math.floor(page)));
  }

  /** Applies a durable paginator page-size change and emits one snapshot. */
  _onPerPageChange(perPage: number): void {
    this.currentPerPage.set(this._normalizePerPage(perPage));
    this.currentPage.set(1);
    this._emitPresentationStateChange();
  }

  // ---- Row selection -----------------------------------------------------------

  /** Whether a specific row is currently selected. */
  isRowSelected(row: MlvDataRow): boolean {
    return this.selectedRows().has(this._ref(row));
  }

  /** Toggle selection for a single row. */
  toggleRowSelection(row: MlvDataRow): void {
    const ref = this._ref(row);
    const current = this.selectedRows();
    const next = new Set(current);
    const mode = this.selectable();

    if (mode === 'single') {
      if (next.has(ref)) {
        next.clear();
      } else {
        next.clear();
        next.add(ref);
      }
    } else if (mode === 'multi') {
      if (next.has(ref)) {
        next.delete(ref);
      } else {
        next.add(ref);
      }
    }

    this.selectedRows.set(next);
    this.selectionChange.emit({ selectedRows: next, row: ref });
  }

  /** Toggle select-all / deselect-all. */
  toggleSelectAll(): void {
    const rows = this.flatRows();
    const allSelected = this.allRowsSelected();
    const next = new Set<MlvDataRow>();

    if (!allSelected) {
      for (const row of rows) {
        next.add(this._ref(row));
      }
    }

    this.selectedRows.set(next);
    this.selectionChange.emit({ selectedRows: next });
  }

  // ---- Column visibility -------------------------------------------------------

  /** Whether a column is currently hidden by the user. */
  isColumnHidden(key: string): boolean {
    return this._visibility.isHidden(key);
  }

  /** Toggle visibility of a hideable column. */
  toggleColumnVisibility(key: string): void {
    this._visibility.toggle(key);
    this._emitPresentationStateChange();
  }

  /**
   * @protected Returns focus to the toolbar "Filters" trigger when the filter
   * dialog popup closes (Apply / Clear / Escape / backdrop), so keyboard focus
   * is never stranded on a destroyed overlay control.
   */
  _onFiltersClosed(): void {
    this._filterTriggerRef()?.nativeElement.focus();
  }

  /** Commits a search-field event and resets table pagination. */
  onSearch(query: string): void {
    this.searchQuery.set(query);
    this.currentPage.set(1);
  }

  /** Whether a column currently has a committed filter. */
  isColumnFiltered(key: string): boolean {
    return this.activeFilters().some((filter) => filter.key === key);
  }

  /** Accessible label for a column filter trigger. */
  getFilterLabel(col: MlvDataTableColumn): string {
    return this._resolver.resolve(
      this._i18n() as unknown as Record<string, string>,
      this.isColumnFiltered(col.key) ? 'filterColumnActive' : 'filterColumn',
      { column: col.title ?? col.key },
    );
  }

  /**
   * Merges a scoped editor result against the table's current committed state.
   * The table remains authoritative here because an overlay may hold an older
   * input snapshot while another column is committed.
   */
  onColumnFiltersChange(key: string, scopedFilters: MlvFilterState[]): void {
    this.activeFilters.update((current) => [
      ...current.filter((filter) => filter.key !== key),
      ...scopedFilters
        .filter((filter) => filter.key === key)
        .map((filter) => ({
          ...filter,
          value: Array.isArray(filter.value) ? [...filter.value] : filter.value,
        })),
    ]);
  }

  /** Single-column list consumed by the scoped filter editor. */
  getColumnFilterColumns(col: MlvDataTableColumn): MlvDataTableColumn[] {
    const cached = this._columnFilterLists.get(col.key);
    if (cached?.[0] === col) return cached;
    const next = [col];
    this._columnFilterLists.set(col.key, next);
    return next;
  }

  /** Restores focus to the header filter trigger for a popup that just closed. */
  focusColumnFilterTrigger(key: string): void {
    const host = this._el.nativeElement as HTMLElement;
    const triggers = host.querySelectorAll<HTMLButtonElement>(
      '.mlv-data-table__column-filter',
    );
    for (const trigger of triggers) {
      if (trigger.dataset['columnKey'] === key) {
        trigger.focus();
        return;
      }
    }
  }

  // ---- Footer template ----------------------------------------------------------

  /** Retrieves the footer summary template. */
  getFooterTemplate(): TemplateRef<unknown> | null {
    const list = this.footerTemplate();
    return list.length > 0 ? list[0].templateRef : null;
  }

  // ---- Pin/Unpin ---------------------------------------------------------------

  /**
   * Returns the list of sides the user may pin a column to, based on `col.pinnable`.
   * - `true` → `['left', 'right']`
   * - `'left'` / `'right'` → single-element list
   * - `MlvPinSide[]` → the list as provided (duplicates preserved by caller)
   * - falsy → `[]` (not user-pinnable)
   */
  getPinnableSides(col: MlvDataTableColumn): MlvPinSide[] {
    return this._pinning.getPinnableSides(col);
  }

  /** Pin a column to the given side, or unpin if it is already pinned. */
  togglePin(col: MlvDataTableColumn, side: MlvPinSide = 'left'): void {
    this._pinning.togglePin(col, side);
    this._emitPresentationStateChange();
  }

  /** Pin a column to a specific side, overriding any current pin state. */
  pinTo(col: MlvDataTableColumn, side: MlvPinSide): void {
    this._pinning.pinTo(col, side);
    this._emitPresentationStateChange();
  }

  /** Explicitly unpin a column, regardless of its current side. */
  unpin(col: MlvDataTableColumn): void {
    this._pinning.unpin(col);
    this._emitPresentationStateChange();
  }

  /** Whether a column is currently pinned (accounting for overrides). */
  isColumnPinned(col: MlvDataTableColumn): boolean {
    return this._pinning.isPinned(col);
  }

  /** Returns the current pin side for a column (considering overrides), or `null` if it is not pinned. */
  getColumnPinSide(col: MlvDataTableColumn): MlvPinSide | null {
    return this._pinning.getPinSide(col);
  }

  isRowExpanded(row: MlvDataRow): boolean {
    return this._expanded().has(this._ref(row));
  }

  hasChildren(row: MlvDataRow): boolean {
    const original = this._ref(row);
    return (
      Array.isArray(original['_mlvChildren']) &&
      (original['_mlvChildren'] as MlvDataRow[]).length > 0
    );
  }

  getDepth(row: MlvDataRow): number {
    return (row['_mlvDepth'] as number | undefined) ?? 0;
  }

  toggleExpand(row: MlvDataRow, event: Event): void {
    event.stopPropagation();
    const original = this._ref(row);
    const current = this._expanded();
    const next = new Set(current);
    if (next.has(original)) {
      next.delete(original);
    } else {
      next.add(original);
    }
    this._expanded.set(next);
  }

  // ---- Sorting ----------------------------------------------------------------

  onSortClick(col: MlvDataTableColumn): void {
    if (!col.sortable) return;
    const current = this.currentSort();
    if (!current || current.key !== col.key) {
      this.currentSort.set({ key: col.key, direction: 'asc' });
    } else if (current.direction === 'asc') {
      this.currentSort.set({ key: col.key, direction: 'desc' });
    } else {
      this.currentSort.set(null);
    }
    this.currentPage.set(1);
    this._emitPresentationStateChange();
  }

  /**
   * @protected Applies a Sort-menu action, resets pagination, and emits exactly
   * one presentation snapshot. Programmatic snapshot application remains silent.
   */
  protected _applyMenuSort(
    column: MlvDataTableColumn,
    direction: MlvSortDirection | null,
  ): void {
    if (!column.sortable) return;
    this.currentSort.set(
      direction === null ? null : { key: column.key, direction },
    );
    this.currentPage.set(1);
    this._emitPresentationStateChange();
  }

  getSortDirection(col: MlvDataTableColumn): MlvSortDirection | null {
    const s = this.currentSort();
    return s && s.key === col.key ? s.direction : null;
  }

  /**
   * Accessible label for a sortable column header button. Resolves the
   * `sortByColumn` ICU string ("Sort by {column}") — describing intent rather
   * than a mouse-specific "click to sort" instruction.
   */
  getSortLabel(col: MlvDataTableColumn): string {
    return this._resolver.resolve(
      this._i18n() as unknown as Record<string, string>,
      'sortByColumn',
      { column: col.title ?? col.key },
    );
  }

  // ---- Column styles ----------------------------------------------------------

  getColStyle(col: MlvColumnState): Record<string, string> {
    return columnWidthStyles(col);
  }

  /**
   * Returns the value to apply to a `<col>` element's `width` style.
   * Used by the shared `<colgroup>` template to keep column widths in sync between the
   * three split tables in virtual scroll mode (header / body / footer).
   */
  getColWidth(col: MlvColumnState): string | null {
    if (col._currentWidth !== undefined) return col._currentWidth + 'px';
    if (col.width) return col.width;
    return null;
  }

  /** Exact frozen width styles for a selection or actions utility column. */
  protected getAuxiliaryColumnStyle(
    kind: AuxiliaryColumnKind,
  ): Readonly<Record<string, string>> | null {
    return this._auxiliaryColumnStyles()[kind];
  }

  /** Exact frozen `<col>` width for a selection or actions utility column. */
  protected getAuxiliaryColumnWidth(kind: AuxiliaryColumnKind): string | null {
    return this._auxiliaryColumnStyles()[kind]?.['width'] ?? null;
  }

  /**
   * trackBy used by `*cdkVirtualFor` in virtual scroll mode. Falls back to the row index
   * for plain row references and to `_mlvRef` identity for tree rows so expanded children
   * are reconciled correctly when the user scrolls.
   */
  trackByRow = (index: number, row: MlvDataRow): unknown => {
    return row['_mlvRef'] ?? index;
  };

  /**
   * Inline `[style]` object (width / min-width, plus sticky offsets for pinned columns)
   * for a column's header and body cells. Reads the memoized {@link _columnStyles} map
   * so the returned reference is stable across change-detection cycles (no per-cell
   * allocation). Every visible column is present in the map; the on-the-fly fallback is
   * a defensive path for a column outside the current visible set.
   */
  getCellStyle(col: MlvColumnState): Record<string, string> {
    return (
      this._columnStyles().get(col.key) ??
      columnCellStyles(col, this.columnOffsets())
    );
  }

  getAlignClass(col: MlvDataTableColumn): string {
    return col.align ? `mlv-data-table__cell--align-${col.align}` : '';
  }

  // ---- Column resize ----------------------------------------------------------

  /**
   * @private In-flight pointer resize state. The originating pointer id prevents
   * secondary touches or unrelated pointers from moving or ending the drag.
   */
  private _resizeState: ActiveColumnResize | null = null;

  /**
   * @private rAF handle coalescing live-width signal writes to one per frame
   * during a pointer drag.
   */
  private _resizeRafId = 0;

  /**
   * @private Teardown for the listeners of the resize drag in progress, or
   * `null` between drags. Holds all four streams (`pointermove`, `pointerup`,
   * `pointercancel` on the document and `lostpointercapture` on the handle) so
   * every exit path releases them together through `_cleanupResize()`.
   */
  private _resizeSubscription: Subscription | null = null;

  /**
   * Starts a column resize with Pointer Events and captures the initiating
   * pointer on the separator. The rendered header width is measured instead of
   * trusting the declared CSS width, so `rem`, `%`, and flex/table layout widths
   * begin without a jump.
   */
  onResizeStart(col: MlvColumnState, event: PointerEvent): void {
    if (event.button !== 0 || this._resizeState) return;
    const target = event.currentTarget;
    if (!(target instanceof HTMLElement)) return;

    event.preventDefault();
    this._measureHeaderWidths();
    const bounds = this._resolveColumnResizeBounds(col, target);
    this._cacheColumnResizeBounds(col.key, bounds);
    const startWidth = this._clampColumnWidth(
      this._measureHeaderWidth(col, target),
      bounds,
    );

    this._resizeState = {
      key: col.key,
      pointerId: event.pointerId,
      target,
      startX: event.clientX,
      startWidth,
      latestWidth: startWidth,
      moved: false,
      ...bounds,
    };

    // A drag protocol, so the listeners take the scoped form: `takeUntil` for
    // the gesture, `takeUntilDestroyed` so a table destroyed mid-drag still
    // releases them. Both are needed — `takeUntilDestroyed` alone would keep
    // `pointermove` bound to the document for the component's whole life. The
    // `DestroyRef` is passed explicitly because this runs from an event
    // handler, which is not an injection context.
    //
    // The whole set lands in one `Subscription` that `_cleanupResize()`
    // unsubscribes, so the five exits it already serves (pointer up, cancel,
    // lost capture, width reset, `DestroyRef.onDestroy`) still converge on one
    // idempotent teardown — `unsubscribe()` on a closed `Subscription` is a
    // no-op, which is what the stable bound handler references used to buy.
    // The pointer-capture bookkeeping stays where it is; it is not a listener.
    // Scoped to the **captured pointer**, not to any `pointerup`. The table
    // deliberately ignores secondary contacts for the duration of a drag
    // (`_onResizeMove` / `_onResizeEnd` guard on `state.pointerId`), so an
    // unfiltered terminator would let an unrelated finger lifting anywhere on
    // the page end the gesture's streams while the real drag was still going.
    const capturedPointerId = event.pointerId;
    const pointerUp$ = fromEvent<PointerEvent>(
      this._document,
      'pointerup',
    ).pipe(filter((upEvent) => upEvent.pointerId === capturedPointerId));
    this._ngZone.runOutsideAngular(() => {
      const subscription = new Subscription();
      subscription.add(
        fromEvent<PointerEvent>(this._document, 'pointermove')
          .pipe(takeUntil(pointerUp$), takeUntilDestroyed(this._destroyRef))
          .subscribe((moveEvent) => this._onResizeMove(moveEvent)),
      );
      subscription.add(
        pointerUp$
          .pipe(take(1), takeUntilDestroyed(this._destroyRef))
          .subscribe((upEvent) => this._onResizeEnd(upEvent)),
      );
      subscription.add(
        fromEvent<PointerEvent>(this._document, 'pointercancel')
          .pipe(takeUntil(pointerUp$), takeUntilDestroyed(this._destroyRef))
          .subscribe((cancelEvent) => this._onResizeCancel(cancelEvent)),
      );
      subscription.add(
        fromEvent<PointerEvent>(target, 'lostpointercapture')
          .pipe(takeUntil(pointerUp$), takeUntilDestroyed(this._destroyRef))
          .subscribe((lostEvent) => this._onResizeLostCapture(lostEvent)),
      );
      this._resizeSubscription = subscription;
      if (typeof target.setPointerCapture === 'function') {
        try {
          target.setPointerCapture(event.pointerId);
        } catch {
          // Document listeners preserve drag/end behavior when capture is
          // unavailable, rejected, or exercised by a synthetic event.
        }
      }
    });
  }

  /**
   * Handles keyboard resizing for the focusable separator. ArrowLeft/ArrowRight
   * use an 8px step (32px with Shift); Home/End jump to the resolved bounds.
   */
  onColumnResizeKeydown(col: MlvColumnState, event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.resetColumnWidth(col.key);
      return;
    }

    const key = this._rtlService.normalizeArrowKey(event);
    const supported =
      key === LEFT_ARROW ||
      key === RIGHT_ARROW ||
      event.key === 'Home' ||
      event.key === 'End';
    if (!supported) return;

    const target =
      event.currentTarget instanceof HTMLElement
        ? event.currentTarget
        : undefined;
    this._measureHeaderWidths();
    const bounds = this._resolveColumnResizeBounds(col, target);
    this._cacheColumnResizeBounds(col.key, bounds);
    const currentWidth = this._clampColumnWidth(
      this._measureHeaderWidth(col, target),
      bounds,
    );
    const step = event.shiftKey
      ? COLUMN_RESIZE_KEYBOARD_LARGE_STEP
      : COLUMN_RESIZE_KEYBOARD_STEP;

    let nextWidth = currentWidth;
    if (event.key === 'Home') nextWidth = bounds.min;
    if (event.key === 'End') nextWidth = bounds.max;
    if (key === LEFT_ARROW) nextWidth = currentWidth - step;
    if (key === RIGHT_ARROW) nextWidth = currentWidth + step;

    event.preventDefault();
    this._commitColumnWidth(
      col.key,
      this._clampColumnWidth(nextWidth, bounds),
      'keyboard',
    );
  }

  /** Localized accessible name for a column's resize separator. */
  getColumnResizeLabel(col: MlvDataTableColumn): string {
    return this._resolver.resolve(
      this._i18n() as unknown as Record<string, string>,
      'resizeColumn',
      { column: col.title ?? col.key },
    );
  }

  /** Current separator value in CSS pixels for ARIA. */
  getColumnResizeValue(col: MlvColumnState): number {
    const bounds = this._columnResizeBounds(col);
    const active =
      this._resizeState?.key === col.key
        ? this._resizeState.latestWidth
        : undefined;
    const measured = this._measuredColumnWidths().get(col.key);
    return this._normalizeColumnWidth(
      active ??
        col._currentWidth ??
        measured ??
        parsePixelWidth(col.width) ??
        DEFAULT_COLUMN_WIDTH,
      bounds,
    );
  }

  /** Minimum separator value in CSS pixels for ARIA and Home. */
  getColumnResizeMin(col: MlvDataTableColumn): number {
    return this._roundColumnWidth(this._columnResizeBounds(col).min);
  }

  /** Maximum separator value in CSS pixels for ARIA and End. */
  getColumnResizeMax(col: MlvDataTableColumn): number {
    return this._roundColumnWidth(this._columnResizeBounds(col).max);
  }

  /** Localized text alternative that makes the separator's pixel unit explicit. */
  getColumnResizeValueText(col: MlvColumnState): string {
    return this._resolver.resolve(
      this._i18n() as unknown as Record<string, string>,
      'columnWidthPixels',
      { width: this.getColumnResizeValue(col) },
    );
  }

  /**
   * Removes committed user widths. Passing a key resets that column and emits a
   * reset even when no override exists (useful for clearing persisted state);
   * omitting it resets every currently overridden column.
   */
  resetColumnWidth(key?: string): void {
    const active = this._resizeState;
    if (active && (key === undefined || active.key === key)) {
      this._cleanupResize();
      this._liveResize.set(null);
    }

    const widths = this._columnWidths();
    if (key !== undefined) {
      if (!this.columns().some((column) => column.key === key)) return;
      if (widths.has(key)) {
        const updated = new Map(widths);
        updated.delete(key);
        this._columnWidths.set(updated);
      }
      this.columnResize.emit({ key, width: null, source: 'reset' });
      this._emitPresentationStateChange();
      afterNextRender(() => this._measureHeaderWidths(), {
        injector: this._injector,
      });
      return;
    }

    const resetKeys = [...widths.keys()];
    if (!resetKeys.length) return;
    this._columnWidths.set(new Map());
    for (const resetKey of resetKeys) {
      this.columnResize.emit({
        key: resetKey,
        width: null,
        source: 'reset',
      });
    }
    this._emitPresentationStateChange();
    afterNextRender(() => this._measureHeaderWidths(), {
      injector: this._injector,
    });
  }

  /**
   * @private Pointer-move handler (outside Angular). It synchronously updates
   * the latest bounded value, then publishes at most one live signal update per
   * animation frame.
   */
  private _onResizeMove(event: PointerEvent): void {
    const state = this._resizeState;
    if (!state || event.pointerId !== state.pointerId) return;
    const delta = event.clientX - state.startX;
    if (delta !== 0) state.moved = true;
    state.latestWidth = this._clampColumnWidth(state.startWidth + delta, state);
    if (!state.moved) return;
    if (this._resizeRafId) return;

    this._resizeRafId = requestAnimationFrame(() => {
      this._resizeRafId = 0;
      const s = this._resizeState;
      if (!s || s.pointerId !== event.pointerId) return;
      this._ngZone.run(() =>
        this._liveResize.set({ key: s.key, width: s.latestWidth }),
      );
    });
  }

  /**
   * @private Pointer-up handler that commits exactly once for the initiating
   * pointer. A press/release without movement remains a no-op, which keeps a
   * double-click reset from producing intermediate resize commits.
   */
  private _onResizeEnd(event: PointerEvent): void {
    const state = this._resizeState;
    if (!state || event.pointerId !== state.pointerId) return;
    this._cleanupResize();
    if (!state.moved) {
      this._ngZone.run(() => this._liveResize.set(null));
      return;
    }
    this._commitColumnWidth(state.key, state.latestWidth, 'pointer');
  }

  /**
   * @private Cancels only the matching active pointer, dropping the optimistic
   * live width while preserving the last committed map entry.
   */
  private _onResizeCancel(event: PointerEvent): void {
    const state = this._resizeState;
    if (!state || event.pointerId !== state.pointerId) return;
    this._cleanupResize();
    this._ngZone.run(() => this._liveResize.set(null));
  }

  /**
   * @private Treats unexpected capture loss as cancellation. Normal cleanup
   * removes this listener before explicitly releasing capture, so pointer-up
   * commits cannot be mistaken for cancellation.
   */
  private _onResizeLostCapture(event: PointerEvent): void {
    const state = this._resizeState;
    if (!state || event.pointerId !== state.pointerId) return;
    this._cleanupResize();
    this._ngZone.run(() => this._liveResize.set(null));
  }

  /**
   * @private Commits a bounded pixel width with one map clone and emits the
   * public persistence event in the same Angular-zone turn.
   */
  private _commitColumnWidth(
    key: string,
    width: number,
    source: Exclude<MlvColumnResizeSource, 'reset'>,
  ): void {
    const col = this.columns().find((column) => column.key === key);
    const bounds = col
      ? this._columnResizeBounds(col)
      : {
          min: DEFAULT_COLUMN_MIN_WIDTH,
          max: DEFAULT_COLUMN_MAX_WIDTH,
        };
    const committedWidth = this._normalizeColumnWidth(width, bounds);
    this._ngZone.run(() => {
      const updated = new Map(this._columnWidths());
      updated.set(key, committedWidth);
      this._columnWidths.set(updated);
      this._liveResize.set(null);
      this.columnResize.emit({ key, width: committedWidth, source });
      this._emitPresentationStateChange();
    });
  }

  /**
   * @private Returns the latest DOM-resolved bounds when available, otherwise
   * resolves strict pixel metadata with safe finite defaults.
   */
  private _columnResizeBounds(col: MlvDataTableColumn): ColumnResizeBounds {
    return (
      this._resolvedResizeBounds().get(col.key) ??
      this._resolveColumnResizeBounds(col)
    );
  }

  /** @private Stores DOM-resolved bounds with a signal-safe map replacement. */
  private _cacheColumnResizeBounds(
    key: string,
    bounds: ColumnResizeBounds,
  ): void {
    this._resolvedResizeBounds.update((current) => {
      const updated = new Map(current);
      updated.set(key, bounds);
      return updated;
    });
  }

  /**
   * @private Resolves resize bounds. Non-pixel metadata is read back from the
   * rendered header's computed style where the browser exposes a pixel value.
   */
  private _resolveColumnResizeBounds(
    col: MlvDataTableColumn,
    target?: HTMLElement,
  ): ColumnResizeBounds {
    const headerCell = target?.closest('th');
    let min = this._resolveColumnBound(col.minWidth, headerCell);
    let max = this._resolveColumnBound(col.maxWidth, headerCell);

    if (
      headerCell &&
      ((col.minWidth && min === undefined) ||
        (col.maxWidth && max === undefined))
    ) {
      const computedStyle =
        headerCell.ownerDocument.defaultView?.getComputedStyle(headerCell);
      if (computedStyle && col.minWidth && min === undefined) {
        min = parsePixelWidth(computedStyle.minWidth);
      }
      if (computedStyle && col.maxWidth && max === undefined) {
        max = parsePixelWidth(computedStyle.maxWidth);
      }
    }

    const resolvedMin = this._roundColumnWidth(min ?? DEFAULT_COLUMN_MIN_WIDTH);
    const resolvedMax = this._roundColumnWidth(
      Math.max(resolvedMin, max ?? DEFAULT_COLUMN_MAX_WIDTH),
    );
    return { min: resolvedMin, max: resolvedMax };
  }

  /**
   * @private Resolves a declared bound to CSS pixels. Complete pixel values are
   * direct; complete percentages use the rendered header table width, matching
   * the containing table against which cell percentages are laid out.
   */
  private _resolveColumnBound(
    value: string | undefined,
    headerCell?: Element | null,
  ): number | undefined {
    const pixels = parsePixelWidth(value);
    if (pixels !== undefined) return pixels;

    const percentage = this._parseCssPercentage(value);
    if (percentage === undefined || !headerCell) return undefined;

    const table = headerCell.closest('table');
    const tableRectWidth = table?.getBoundingClientRect().width ?? 0;
    const referenceWidth =
      tableRectWidth > 0 ? tableRectWidth : (table?.clientWidth ?? 0);
    if (!Number.isFinite(referenceWidth) || referenceWidth <= 0) {
      return undefined;
    }
    return this._roundColumnWidth(referenceWidth * percentage);
  }

  /** @private Parses a complete, non-negative CSS percentage as a fraction. */
  private _parseCssPercentage(value: string | undefined): number | undefined {
    if (!value) return undefined;
    const match = value.trim().match(/^(?:\d+(?:\.\d+)?|\.\d+)%$/);
    if (!match) return undefined;
    const parsed = Number.parseFloat(match[0]);
    return Number.isFinite(parsed) ? parsed / 100 : undefined;
  }

  /**
   * @private Re-applies outer horizontal position after virtual DOM/geometry
   * changes that do not themselves emit another wrapper scroll event.
   */
  private _syncVirtualHorizontalScroll(): void {
    const wrapper = this.tableWrapperRef()?.nativeElement;
    const viewport = this._virtualViewportRef()?.elementRef.nativeElement;
    if (!wrapper || !viewport) return;
    if (viewport.scrollLeft !== wrapper.scrollLeft) {
      viewport.scrollLeft = wrapper.scrollLeft;
    }
    this._updateVirtualScrollGeometry(wrapper, viewport);
  }

  /**
   * @private Publishes both the native vertical-scrollbar width and an inert
   * outer extent whose maximum scroll position exactly matches the viewport.
   */
  private _updateVirtualScrollGeometry(
    wrapper: HTMLElement,
    viewport: HTMLElement,
  ): void {
    const gutter = Math.max(0, viewport.offsetWidth - viewport.clientWidth);
    const horizontalRange = Math.max(
      0,
      viewport.scrollWidth - viewport.clientWidth,
    );
    const extent = wrapper.clientWidth + horizontalRange;
    const gutterChanged = gutter !== untracked(this._virtualScrollbarGutter);
    const extentChanged =
      extent !== untracked(this._virtualHorizontalScrollExtent);
    if (!gutterChanged && !extentChanged) return;

    this._ngZone.run(() => {
      if (gutterChanged) this._virtualScrollbarGutter.set(gutter);
      if (extentChanged) this._virtualHorizontalScrollExtent.set(extent);
    });
  }

  /**
   * @private Measures the actual rendered header cell width and falls back to
   * the current strict-pixel state only in non-layout environments such as
   * server rendering and jsdom.
   */
  private _measureHeaderWidth(
    col: MlvColumnState,
    target?: HTMLElement,
  ): number {
    const headerCell = target?.closest('th');
    const rectWidth = headerCell?.getBoundingClientRect().width ?? 0;
    if (Number.isFinite(rectWidth) && rectWidth > 0) return rectWidth;
    const offsetWidth = headerCell?.offsetWidth ?? 0;
    if (offsetWidth > 0) return offsetWidth;
    return (
      col._currentWidth ?? parsePixelWidth(col.width) ?? DEFAULT_COLUMN_WIDTH
    );
  }

  /**
   * @private Measures the rendered header once per layout change. Before the
   * first user override these values track responsive/table layout; while the
   * table is frozen, existing baselines are preserved so reset restores the
   * original widths rather than another column's resized layout.
   */
  private _measureHeaderWidths(): void {
    const host = this._el.nativeElement as HTMLElement;
    const header = host.querySelector('thead');
    if (!header) return;

    const preserveBaseline =
      this._liveResize() !== null || this._columnWidths().size > 0;
    const measured = preserveBaseline
      ? new Map(this._measuredColumnWidths())
      : new Map<string, number>();
    const resolvedBounds = preserveBaseline
      ? new Map(this._resolvedResizeBounds())
      : new Map<string, ColumnResizeBounds>();

    for (const cell of header.querySelectorAll<HTMLElement>(
      'th[data-mlv-column-key]',
    )) {
      const key = cell.getAttribute('data-mlv-column-key');
      if (!key) continue;
      const width = cell.getBoundingClientRect().width;
      if (
        (!preserveBaseline || !measured.has(key)) &&
        Number.isFinite(width) &&
        width > 0
      ) {
        measured.set(key, this._roundColumnWidth(width));
      }

      const column = this.columns().find((candidate) => candidate.key === key);
      if (column?.resizable) {
        resolvedBounds.set(key, this._resolveColumnResizeBounds(column, cell));
      }
    }

    const selectionWidth = header
      .querySelector<HTMLElement>('.mlv-data-table__cell--select')
      ?.getBoundingClientRect().width;
    const actionsWidth = header
      .querySelector<HTMLElement>('.mlv-data-table__cell--actions')
      ?.getBoundingClientRect().width;
    const auxiliary = preserveBaseline
      ? { ...this._measuredAuxiliaryWidths() }
      : {};
    if (
      selectionWidth !== undefined &&
      Number.isFinite(selectionWidth) &&
      selectionWidth > 0
    ) {
      auxiliary.selection = this._roundColumnWidth(selectionWidth);
    }
    if (
      actionsWidth !== undefined &&
      Number.isFinite(actionsWidth) &&
      actionsWidth > 0
    ) {
      auxiliary.actions = this._roundColumnWidth(actionsWidth);
    }

    this._measuredColumnWidths.set(measured);
    this._resolvedResizeBounds.set(resolvedBounds);
    this._measuredAuxiliaryWidths.set(auxiliary);
  }

  /**
   * @private CSS length used by a sticky offset. A rendered measurement is more
   * accurate than declared CSS under table redistribution; the declaration
   * remains the pre-render/SSR fallback.
   */
  private _columnOffsetWidth(col: MlvColumnState): string {
    if (col._currentWidth !== undefined) return `${col._currentWidth}px`;
    const measured = this._measuredColumnWidths().get(col.key);
    if (measured !== undefined) return `${this._roundColumnWidth(measured)}px`;
    if (col.width) return col.width;
    return `${DEFAULT_COLUMN_WIDTH}px`;
  }

  /** @private Adds heterogeneous CSS lengths without converting their units. */
  private _sumCssLengths(widths: string[]): string {
    if (!widths.length) return '0px';
    if (widths.length === 1) return widths[0];
    return `calc(${widths.join(' + ')})`;
  }

  /** @private Rounds pixel values to hundredths without changing their bounds. */
  private _roundColumnWidth(width: number): number {
    return Math.round(width * 100) / 100;
  }

  /** @private Creates immutable exact width/min/max styles for a measured column. */
  private _fixedColumnWidthStyles(
    width: number | undefined,
  ): Readonly<Record<string, string>> | null {
    if (width === undefined || !Number.isFinite(width) || width < 0)
      return null;
    const value = `${this._roundColumnWidth(width)}px`;
    return {
      width: value,
      'min-width': value,
      'max-width': value,
    };
  }

  /** @private Rounds and clamps a width against normalized finite bounds. */
  private _normalizeColumnWidth(
    width: number,
    bounds: ColumnResizeBounds,
  ): number {
    return this._clampColumnWidth(this._roundColumnWidth(width), bounds);
  }

  /** @private Returns a positive whole-number page size or the all-items sentinel. */
  private _normalizePerPage(perPage: number): number {
    if (perPage === Infinity) return Infinity;
    return Number.isFinite(perPage) ? Math.max(1, Math.floor(perPage)) : 1;
  }

  /** @private Keeps only declared keys while preserving input-order uniqueness. */
  private _knownPresentationKeys(
    keys: readonly string[],
    knownKeys: ReadonlySet<string>,
  ): Set<string> {
    return new Set(keys.filter((key) => knownKeys.has(key)));
  }

  /** @private Clones only a known sortable sort state. */
  private _normalizePresentationSort(
    sort: MlvSortState | null,
    columns: readonly MlvDataTableColumn[],
  ): MlvSortState | null {
    if (
      !sort ||
      (sort.direction !== 'asc' && sort.direction !== 'desc') ||
      !columns.some((column) => column.key === sort.key && column.sortable)
    ) {
      return null;
    }
    return { key: sort.key, direction: sort.direction };
  }

  /** @private Emits one fresh normalized snapshot after a durable user gesture. */
  private _emitPresentationStateChange(): void {
    this.presentationStateChange.emit(this.getPresentationState());
  }

  /** @private Clamps a width to finite normalized resize bounds. */
  private _clampColumnWidth(width: number, bounds: ColumnResizeBounds): number {
    const finiteWidth = Number.isFinite(width) ? width : DEFAULT_COLUMN_WIDTH;
    return Math.min(bounds.max, Math.max(bounds.min, finiteWidth));
  }

  /**
   * @private Detaches active pointer listeners, releases capture, cancels a
   * pending animation frame, and clears the drag state. Idempotent for pointer
   * up, pointer cancel, reset, and component destruction.
   */
  private _cleanupResize(): void {
    this._resizeSubscription?.unsubscribe();
    this._resizeSubscription = null;

    const state = this._resizeState;
    if (state) {
      const canRelease =
        typeof state.target.hasPointerCapture !== 'function' ||
        state.target.hasPointerCapture(state.pointerId);
      if (
        canRelease &&
        typeof state.target.releasePointerCapture === 'function'
      ) {
        try {
          state.target.releasePointerCapture(state.pointerId);
        } catch {
          // Capture may already have been released implicitly by the browser.
        }
      }
    }

    if (this._resizeRafId) {
      cancelAnimationFrame(this._resizeRafId);
      this._resizeRafId = 0;
    }
    this._resizeState = null;
  }

  // ---- Private helpers --------------------------------------------------------

  /** Returns the original (pre-spread) row reference for expand tracking. */
  private _ref(row: MlvDataRow): MlvDataRow {
    return originalRow(row);
  }
}
