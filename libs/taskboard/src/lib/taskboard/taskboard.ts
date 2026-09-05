import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import {
  DOWN_ARROW,
  LEFT_ARROW,
  RIGHT_ARROW,
  UP_ARROW,
} from '@angular/cdk/keycodes';
import {
  CdkFixedSizeVirtualScroll,
  CdkVirtualForOf,
  CdkVirtualScrollViewport,
} from '@angular/cdk/scrolling';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  ViewEncapsulation,
  afterNextRender,
  computed,
  contentChildren,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
  viewChildren,
} from '@angular/core';
import {
  MLV_DENSITY_ELEMENT,
  MlvDensityDirective,
} from '@malva-ui/cdk/density';
import { MlvRtlService } from '@malva-ui/cdk/utils';
import {
  MLV_TASKBOARD_I18N,
  MlvI18nResolverService,
  type MlvTaskboardI18n,
} from '@malva-ui/i18n';
import {
  MlvTaskboardCardAddDef,
  MlvTaskboardColumnContentDef,
  MlvTaskboardColumnGroupDef,
  MlvTaskboardColumnHeaderDef,
  MlvTaskboardDropIndicatorDef,
  MlvTaskboardEmptyStateDef,
  MlvTaskboardHeaderDef,
  MlvTaskboardItemDef,
  MlvTaskboardSwimlaneDef,
  type MlvTaskboardCardAddDefContext,
  type MlvTaskboardColumnContentDefContext,
  type MlvTaskboardColumnGroupDefContext,
  type MlvTaskboardColumnHeaderDefContext,
  type MlvTaskboardDropIndicatorDefContext,
  type MlvTaskboardEmptyStateDefContext,
  type MlvTaskboardHeaderDefContext,
  type MlvTaskboardItemDefContext,
  type MlvTaskboardSwimlaneDefContext,
} from '../taskboard-defs';
import { createMlvTaskboardDragSession } from '../taskboard-drag-session';
import {
  exportMlvTaskboardCsv,
  serializeMlvTaskboard,
} from '../taskboard-export';
import {
  createMlvTaskboardHistory,
  createMlvTaskboardSnapshot,
} from '../taskboard-history';
import {
  mlvTaskboardBucketToken,
  mlvTaskboardKeyToken,
  sameMlvTaskboardKey,
} from '../taskboard-keys';
import {
  createMlvTaskboardIndex,
  type MlvTaskboardIndex,
} from '../taskboard-state';
import type {
  MlvTaskboardState,
  MlvTaskboardBeforeMove,
  MlvTaskboardCanDropFn,
  MlvTaskboardCanReorderColumnFn,
  MlvTaskboardColumn,
  MlvTaskboardDenialReason,
  MlvTaskboardColumnGroup,
  MlvTaskboardCsvField,
  MlvTaskboardField,
  MlvTaskboardHistory,
  MlvTaskboardKey,
  MlvTaskboardLocation,
  MlvTaskboardMoveCancelReason,
  MlvTaskboardMoveCancelledEvent,
  MlvTaskboardMoveResult,
  MlvTaskboardSerialized,
  MlvTaskboardSnapshot,
  MlvTaskboardSwimlane,
  MlvTaskboardTransition,
  MlvTaskboardWipState,
} from '../taskboard.types';
import { MlvTaskboardCardsHost } from './taskboard-cards-host';
import {
  MLV_TASKBOARD_COLUMNS_REGISTRY,
  MlvTaskboardColumnSortable,
} from './taskboard-column-sortable';
import { MlvTaskboardColumnsHost } from './taskboard-columns-host';
import {
  MlvTaskboardKeyboardController,
  type MlvTaskboardKeyboardFocus,
  type MlvTaskboardKeyboardStep,
} from './taskboard-keyboard';
import { MlvTaskboardMoveController } from './taskboard-move-controller';
import {
  MLV_TASKBOARD_CARDS_REGISTRY,
  MlvTaskboardSortable,
  type MlvTaskboardBucket,
  type MlvTaskboardDropPreview,
} from './taskboard-sortable';
import { mlvTaskboardRenderedIndex } from './taskboard-virtual';
import {
  MLV_TASKBOARD_CARD_ID_ATTRIBUTE,
  MLV_TASKBOARD_COLUMN_ID_ATTRIBUTE,
  MLV_TASKBOARD_SWIMLANE_ID_ATTRIBUTE,
} from './taskboard-sortable-dom';

/**
 * The localized reason phrase each move cancellation is announced with, so a
 * screen-reader user hears why a card came back rather than only that it did.
 */
const MLV_TASKBOARD_CANCEL_REASONS: Record<
  MlvTaskboardMoveCancelReason,
  keyof MlvTaskboardI18n
> = {
  'invalid-drop': 'reasonInvalidDrop',
  cancelled: 'reasonCancelled',
  'before-move-rejected': 'reasonBeforeMoveRejected',
  'before-move-error': 'reasonBeforeMoveError',
  stale: 'reasonStale',
};

/**
 * The localized reason phrase each recorded drag-session denial is announced
 * with. The session decides *why* a slot refused a card while it enumerates
 * the board; this map only names the string that states it.
 */
const MLV_TASKBOARD_DENIAL_REASONS: Record<
  MlvTaskboardDenialReason,
  keyof MlvTaskboardI18n
> = {
  locked: 'reasonLocked',
  transition: 'reasonTransition',
  wip: 'reasonWip',
  policy: 'reasonPolicy',
};

/** @private Distinguishes one board's keyboard-instruction element from another's. */
let nextTaskboardId = 0;

/** Payload emitted for a card activation or context-menu request. */
export interface MlvTaskboardCardEvent<TItem> {
  readonly item: TItem;
  readonly location: MlvTaskboardLocation;
  readonly selectedIds: ReadonlySet<MlvTaskboardKey>;
  /**
   * The gesture that produced the request: a pointer event for a click or
   * context menu, and the `Enter` keydown for a keyboard activation.
   */
  readonly nativeEvent: MouseEvent | KeyboardEvent;
}

/** Payload emitted when an application should add a card to a board cell. */
export interface MlvTaskboardAddRequest {
  readonly column: MlvTaskboardColumn;
  readonly swimlane: MlvTaskboardSwimlane | undefined;
  readonly wip: MlvTaskboardWipState;
}

/** One rendered span of consecutive columns sharing a group. */
interface MlvTaskboardGroupRun {
  /** Stable `@for` key: the run's first column index plus its group. */
  readonly key: string;
  /** The shared group identifier, `undefined` for an ungrouped run. */
  readonly groupId: MlvTaskboardKey | undefined;
  /** The matching group definition, `undefined` for a spacer run. */
  readonly group: MlvTaskboardColumnGroup | undefined;
  /** Number of column tracks the run occupies. */
  span: number;
}

/** Where the live drop indicator renders inside one board cell. */
interface MlvTaskboardDropAnchor {
  readonly columnId: MlvTaskboardKey;
  readonly swimlaneId: MlvTaskboardKey | undefined;
  /** The card the indicator precedes, or `null` to render after the last one. */
  readonly anchorId: MlvTaskboardKey | null;
}

/**
 * Controlled taskboard rendering shell with guarded pointer and touch sorting.
 * It renders immutable item data, emits application-owned card actions, and
 * commits a released drop only through the pure move engine.
 */
@Component({
  selector: 'mlv-taskboard',
  imports: [
    CdkFixedSizeVirtualScroll,
    CdkVirtualForOf,
    CdkVirtualScrollViewport,
    NgTemplateOutlet,
    MlvTaskboardCardsHost,
    MlvTaskboardColumnsHost,
  ],
  templateUrl: './taskboard.html',
  styleUrl: './taskboard.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: MLV_DENSITY_ELEMENT, useValue: 'taskboard' },
    MlvTaskboardSortable,
    {
      provide: MLV_TASKBOARD_CARDS_REGISTRY,
      useExisting: MlvTaskboardSortable,
    },
    MlvTaskboardColumnSortable,
    {
      provide: MLV_TASKBOARD_COLUMNS_REGISTRY,
      useExisting: MlvTaskboardColumnSortable,
    },
  ],
  hostDirectives: [{ directive: MlvDensityDirective, inputs: ['mlvDensity'] }],
  host: {
    class: 'mlv-taskboard',
    '[class.mlv-taskboard--move-pending]': '_movePending()',
    '[style.--mlv-taskboard-virtual-item-size]': '_virtualItemSizeVar()',
    '[attr.aria-busy]': '_movePending() || null',
  },
})
export class MlvTaskboard<TItem> {
  /** Canonical, application-owned card collection. */
  readonly items = model.required<readonly TItem[]>();
  /** Application-owned board column collection. */
  readonly columns = model.required<readonly MlvTaskboardColumn[]>();
  /** Property whose string or numeric value uniquely identifies each card. */
  readonly dataKey = input.required<MlvTaskboardField<TItem>>();
  /** Property holding each card's current column identifier. */
  readonly columnField = input.required<MlvTaskboardField<TItem>>();
  /** Optional phase/group labels for adjacent columns. */
  readonly columnGroups = input<readonly MlvTaskboardColumnGroup[]>([]);
  /** Optional rows that split every column into swimlane cells. */
  readonly swimlanes = input<readonly MlvTaskboardSwimlane[]>([]);
  /** Optional filtered card view; canonical items remain authoritative for WIP. */
  readonly visibleItems = input<readonly TItem[] | undefined>(undefined);
  /** Optional property holding each card's swimlane identifier. */
  readonly swimlaneField = input<MlvTaskboardField<TItem> | undefined>(
    undefined,
  );
  /** Optional transition policy consumed by the pure board state. */
  readonly transitions = input<readonly MlvTaskboardTransition[] | undefined>(
    undefined,
  );
  /** Optional immutable card lock identifiers consumed by the pure board state. */
  readonly lockedItemIds = input<readonly MlvTaskboardKey[] | undefined>(
    undefined,
  );
  /** Optional synchronous permission policy consumed by the pure board state. */
  readonly canDropFn = input<MlvTaskboardCanDropFn<TItem> | undefined>(
    undefined,
  );
  /**
   * Optional application guard consulted once per released drop. It may answer
   * asynchronously; the board blocks further drags and leaves `items`
   * referentially unchanged until the guard settles.
   */
  readonly beforeMove = input<MlvTaskboardBeforeMove<TItem> | undefined>(
    undefined,
  );
  /**
   * Optional application policy consulted for every candidate column order a
   * pointer drag hovers. Returning `false` rejects that order and leaves the
   * controlled `columns` collection referentially unchanged.
   */
  readonly canReorderColumnFn = input<
    MlvTaskboardCanReorderColumnFn | undefined
  >(undefined);
  /**
   * Fixed block size, in pixels, of one card in a virtualized cell. Supplying
   * a positive finite number opts the whole board into virtual card cells;
   * leaving it unset renders every card of every cell.
   */
  readonly virtualItemSize = input<number | undefined>(undefined);
  /** Application-owned selected card identifiers. */
  readonly selection = model<ReadonlySet<MlvTaskboardKey>>(new Set());
  /** Application-owned collapsed column identifiers. */
  readonly collapsedColumnIds = model<ReadonlySet<MlvTaskboardKey>>(new Set());
  /** Application-owned collapsed swimlane identifiers. */
  readonly collapsedSwimlaneIds = model<ReadonlySet<MlvTaskboardKey>>(
    new Set(),
  );

  /** Emits an application-owned card activation request. */
  readonly cardActivated = output<MlvTaskboardCardEvent<TItem>>();
  /** Emits an application-owned card context-menu request. */
  readonly contextMenu = output<MlvTaskboardCardEvent<TItem>>();
  /** Emits an application-owned request to add a card in a specific cell. */
  readonly addRequested = output<MlvTaskboardAddRequest>();
  /** Emits once per committed move, after `items` holds the replacement. */
  readonly moved = output<MlvTaskboardMoveResult<TItem>>();
  /** Emits when a started move ends without changing the controlled `items`. */
  readonly moveCancelled = output<MlvTaskboardMoveCancelledEvent<TItem>>();

  /** Projected board header definition, when supplied. */
  protected readonly _headerDefs = contentChildren(MlvTaskboardHeaderDef);
  /** Projected group header definition, when supplied. */
  protected readonly _groupDefs = contentChildren(MlvTaskboardColumnGroupDef);
  /** Projected column header definition, when supplied. */
  protected readonly _columnHeaderDefs = contentChildren(
    MlvTaskboardColumnHeaderDef,
  );
  /** Projected cell-content definition, when supplied. */
  protected readonly _columnContentDefs = contentChildren(
    MlvTaskboardColumnContentDef,
  );
  /** Projected swimlane definition, when supplied. */
  protected readonly _swimlaneDefs = contentChildren(MlvTaskboardSwimlaneDef);
  /** Projected card definition, when supplied. */
  protected readonly _itemDefs = contentChildren(MlvTaskboardItemDef);
  /** Projected add-card definition, when supplied. */
  protected readonly _cardAddDefs = contentChildren(MlvTaskboardCardAddDef);
  /** Projected empty-state definition, when supplied. */
  protected readonly _emptyStateDefs = contentChildren(
    MlvTaskboardEmptyStateDef,
  );
  /** Projected drop-indicator definition, when supplied. */
  protected readonly _dropIndicatorDefs = contentChildren(
    MlvTaskboardDropIndicatorDef,
  );

  /**
   * @private Structural board snapshot. It deliberately omits selection and
   * `canDropFn`, so neither re-indexes the board nor invalidates a pending
   * asynchronous move.
   */
  private readonly _boardCore = computed<MlvTaskboardState<TItem>>(() => ({
    items: this.items(),
    columns: this.columns(),
    columnGroups: this.columnGroups(),
    swimlanes: this.swimlanes(),
    visibleItems: this.visibleItems(),
    dataKey: this.dataKey(),
    columnField: this.columnField(),
    swimlaneField: this.swimlaneField(),
    transitions: this.transitions(),
    lockedItemIds: this.lockedItemIds(),
  }));

  /** Pure indexed state derived from the immutable structural inputs. */
  protected readonly _index = computed<MlvTaskboardIndex<TItem>>(() =>
    createMlvTaskboardIndex(this._boardCore()),
  );

  /** @private Full board snapshot a drag session and its policies run against. */
  private readonly _board = computed<MlvTaskboardState<TItem>>(() => ({
    ...this._boardCore(),
    selectedIds: this.selection(),
    canDropFn: this.canDropFn(),
  }));

  /** @protected The slot a live pointer drag would drop into, when dragging. */
  protected readonly _dropPreview =
    signal<MlvTaskboardDropPreview<TItem> | null>(null);

  /** @protected Whether an asynchronous `beforeMove` guard is still pending. */
  protected readonly _movePending = signal(false);

  /** @private Whether the board is expanded for one in-flight `print()` call. */
  private readonly _printing = signal(false);

  /** @private Where the live drop indicator renders, resolved by card key. */
  private readonly _dropAnchor = computed<MlvTaskboardDropAnchor | null>(() => {
    const preview = this._dropPreview();
    if (!preview) return null;
    const rendered = this._index().itemsFor(
      preview.columnId,
      preview.swimlaneId,
    );
    const remaining = rendered.filter(
      (item) => !sameMlvTaskboardKey(this._itemId(item), preview.itemId),
    );
    const anchor = remaining[preview.index];
    return {
      columnId: preview.columnId,
      swimlaneId: preview.swimlaneId,
      anchorId: anchor === undefined ? null : this._itemId(anchor),
    };
  });

  /**
   * Group header runs: maximal spans of consecutive columns sharing one
   * `groupId`. A run whose columns carry no group — or one whose `groupId` has
   * no matching definition — renders as an unlabeled spacer, so a reordered
   * column never makes a group header span columns it no longer covers.
   */
  protected readonly _groupRuns = computed<readonly MlvTaskboardGroupRun[]>(
    () => {
      const groups = this.columnGroups();
      const columns = this.columns();
      const runs: MlvTaskboardGroupRun[] = [];
      for (let index = 0; index < columns.length; index++) {
        const column = columns[index];
        if (column === undefined) continue;
        const previous = runs[runs.length - 1];
        if (
          previous !== undefined &&
          sameMlvTaskboardKey(previous.groupId, column.groupId)
        ) {
          previous.span += 1;
          continue;
        }
        runs.push({
          key: `${index}:${mlvTaskboardKeyToken(column.groupId)}`,
          groupId: column.groupId,
          group: groups.find((group) =>
            sameMlvTaskboardKey(group.id, column.groupId),
          ),
          span: 1,
        });
      }
      return runs;
    },
  );

  /**
   * @protected Text the polite live region currently carries. It is replaced,
   * never appended to, so a screen reader reads only the latest board event.
   */
  protected readonly _announcement = signal('');

  /**
   * @private The card a shift-click ranges from: the last card selected by a
   * plain or modifier click. A shift-click never moves it, so a run of
   * shift-clicks keeps growing and shrinking the same range.
   */
  private readonly _selectionAnchor = signal<MlvTaskboardKey | null>(null);

  /**
   * @private Every rendered card key in board reading order — swimlane
   * row-major, then column order, then card index inside the cell. This is the
   * order a shift-click ranges over, so the range a user sees selected is
   * exactly the run of cards between the anchor and the clicked card.
   */
  private readonly _renderedOrder = computed<readonly MlvTaskboardKey[]>(() => {
    const index = this._index();
    const lanes = this.swimlanes();
    const rows: readonly (MlvTaskboardKey | undefined)[] =
      lanes.length === 0 ? [undefined] : lanes.map((lane) => lane.id);
    const order: MlvTaskboardKey[] = [];
    for (const swimlaneId of rows) {
      for (const column of this.columns()) {
        for (const item of index.itemsFor(column.id, swimlaneId)) {
          order.push(this._itemId(item));
        }
      }
    }
    return order;
  });

  /**
   * @private Columns keyboard navigation walks. A collapsed column hides its
   * cards, so it owns no tab stop and no keyboard drop target.
   */
  private readonly _navigableColumnIds = computed<readonly MlvTaskboardKey[]>(
    () =>
      this.columns()
        .filter((column) => !this._isColumnCollapsed(column))
        .map((column) => column.id),
  );

  /**
   * @private Lanes keyboard navigation walks. A board without swimlanes still
   * has exactly one row, reported as the single unlaned `undefined`.
   */
  private readonly _navigableSwimlaneIds = computed<
    readonly (MlvTaskboardKey | undefined)[]
  >(() => {
    const lanes = this.swimlanes();
    if (lanes.length === 0) return [undefined];
    return lanes
      .filter((lane) => !this._isSwimlaneCollapsed(lane))
      .map((lane) => lane.id);
  });

  /**
   * @private The card that owns the board's tab stop before anything has been
   * focused: the first card of the first navigable cell in reading order.
   */
  private readonly _firstNavigableCard = computed<MlvTaskboardKey | undefined>(
    () => {
      const index = this._index();
      for (const swimlaneId of this._navigableSwimlaneIds()) {
        for (const columnId of this._navigableColumnIds()) {
          const first = index.itemsFor(columnId, swimlaneId)[0];
          if (first !== undefined) return this._itemId(first);
        }
      }
      return undefined;
    },
  );

  /**
   * @private Key tokens of every card keyboard navigation can currently reach:
   * present in `items`, kept by `visibleItems`, and in an expanded cell.
   */
  private readonly _navigableCardTokens = computed<ReadonlySet<string>>(() => {
    const index = this._index();
    const tokens = new Set<string>();
    for (const swimlaneId of this._navigableSwimlaneIds()) {
      for (const columnId of this._navigableColumnIds()) {
        for (const item of index.itemsFor(columnId, swimlaneId)) {
          tokens.add(mlvTaskboardKeyToken(this._itemId(item)));
        }
      }
    }
    return tokens;
  });

  /**
   * @private The card that owns the board's single tab stop. The focused card
   * keeps it only while the board still renders it: once it is filtered out,
   * removed, or collapsed away the stop falls back to the first card in
   * reading order, so the board never drops out of the tab sequence.
   */
  private readonly _tabbableCardId = computed<MlvTaskboardKey | undefined>(
    () => {
      const focus = this._keyboard.focus();
      if (
        focus !== null &&
        this._navigableCardTokens().has(mlvTaskboardKeyToken(focus.itemId))
      ) {
        return focus.itemId;
      }
      return this._firstNavigableCard();
    },
  );

  /** @protected Localized board copy; template-facing, so it has no prefix. */
  protected readonly _i18n = inject(MLV_TASKBOARD_I18N);

  /** @private Compiles the ICU strings the board announces and renders. */
  private readonly _i18nResolver = inject(MlvI18nResolverService);

  /**
   * @protected The validated card size a virtualized cell renders with, or
   * `null` when this board renders plain, fully-rendered card lists.
   */
  protected readonly _virtualItemSize = computed<number | null>(() => {
    // Printing renders every card of every cell: a printed page cannot be
    // scrolled, so a virtual window would drop most of the board.
    if (this._printing()) return null;
    const size = this.virtualItemSize();
    return size !== undefined && Number.isFinite(size) && size > 0
      ? size
      : null;
  });

  /** @protected Publishes the card size to CSS, for cell sizing. */
  protected _virtualItemSizeVar(): string | null {
    const size = this._virtualItemSize();
    return size === null ? null : `${size}px`;
  }

  /** @private Every rendered virtual cell viewport, keyed later by its bucket. */
  private readonly _cardViewports = viewChildren(CdkVirtualScrollViewport);

  /** @private Runs a post-render callback outside an injection context. */
  private readonly _injector = inject(Injector);

  /** @private Host element, used to resolve a card key back to its element. */
  private readonly _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  /** @private The injected document; never the ambient global (SSR-safe). */
  private readonly _document = inject(DOCUMENT);

  /** @private Mirrors the horizontal arrow keys inside an RTL subtree. */
  private readonly _rtlService = inject(MlvRtlService);

  /**
   * @private Prefix every id this board mints shares, so two boards on one page
   * never collide on a header or instruction id.
   */
  private readonly _idPrefix = `mlv-taskboard-${nextTaskboardId++}`;

  /** @protected Id of the shared keyboard-instruction element cards describe. */
  protected readonly _instructionsId = `${this._idPrefix}-keys`;

  /**
   * @private Id minted for each column header, keyed by the column's key token.
   * Indexed rather than derived from the key, because a key token carries a
   * colon and would not survive as an id fragment.
   */
  private readonly _columnHeaderIds = computed(() => {
    const ids = new Map<string, string>();
    this.columns().forEach((column, index) => {
      ids.set(
        mlvTaskboardKeyToken(column.id),
        `${this._idPrefix}-column-${index}`,
      );
    });
    return ids;
  });

  /** @private Id minted for each swimlane header, keyed by its key token. */
  private readonly _laneHeaderIds = computed(() => {
    const ids = new Map<string, string>();
    this.swimlanes().forEach((swimlane, index) => {
      ids.set(
        mlvTaskboardKeyToken(swimlane.id),
        `${this._idPrefix}-lane-${index}`,
      );
    });
    return ids;
  });

  /** @private Package-private SortableJS card adapter provided by this board. */
  private readonly _sortable = inject(
    MlvTaskboardSortable,
  ) as MlvTaskboardSortable<TItem>;

  /** @private Package-private SortableJS column adapter for header dragging. */
  private readonly _columnSortable = inject(MlvTaskboardColumnSortable);

  /** @private Guarded commit/cancel flow for one released pointer drop. */
  private readonly _moveController = new MlvTaskboardMoveController<TItem>({
    boardCore: () => this._boardCore(),
    beforeMove: () => this.beforeMove(),
    apply: (result) => this._applyMoveResult(result),
    cancelled: (event) => {
      this.moveCancelled.emit(event);
      // A keyboard cancellation carries no authorised request, so the
      // controller's own `cancelMove` announces that one instead.
      if (event.request !== undefined) {
        this._announceMoveOutcome(event.reason, event.request.itemId);
      }
    },
    setPending: (pending) => this._setMovePending(pending),
  });

  /**
   * @private Roving focus and keyboard grab state machine. It is handed the
   * board's own geometry and the very commit flow the pointer path enters, so
   * a keyboard move and a dropped drag cannot diverge.
   */
  private readonly _keyboard = new MlvTaskboardKeyboardController<TItem>({
    columnIds: () => this._navigableColumnIds(),
    swimlaneIds: () => this._navigableSwimlaneIds(),
    cardsIn: (columnId, swimlaneId) =>
      this._index()
        .itemsFor(columnId, swimlaneId)
        .map((item) => this._itemId(item)),
    createSession: (itemId) =>
      createMlvTaskboardDragSession(this._board(), itemId, this.canDropFn()),
    setDropPreview: (preview) => this._dropPreview.set(preview),
    commitMove: (request) => this._moveController.commit(request),
    cancelMove: (reason, itemId) => {
      this._moveController.cancel(reason);
      this._announceMoveOutcome(reason, itemId);
    },
    announce: (key, params) => this._announce(key, params),
    columnLabel: (columnId) =>
      this._index().columnById.get(columnId)?.label ?? String(columnId),
    laneLabel: (swimlaneId) => this._laneAnnouncement(swimlaneId),
    cardLabel: (itemId) => String(itemId),
    denialReason: (reason) =>
      this._translate(MLV_TASKBOARD_DENIAL_REASONS[reason]),
    focusCard: (focus) => this._focusCardElement(focus),
  });

  /**
   * @private Replayable ledger of board-originated moves. It is seeded by the
   * first committed move and is not exposed yet — the public undo/redo surface
   * arrives with the keyboard grab feature.
   */
  private _history: MlvTaskboardHistory<TItem> | null = null;

  /** @private The `items` value this board itself last wrote. */
  private _committedItems: readonly TItem[] | null = null;

  /** @private The `columns` value this board itself last wrote. */
  private _committedColumns: readonly MlvTaskboardColumn[] | null = null;

  constructor() {
    this._sortable.connect({
      sessionBoard: () => this._board(),
      cardIdFor: (attribute) => this._resolveItemId(attribute),
      bucketOf: (element) => this._resolveBucket(element),
      setDropPreview: (preview) => this._dropPreview.set(preview),
      commitMove: (request) => this._moveController.commit(request),
      cancelMove: (reason, request) =>
        this._moveController.cancel(reason, request),
    });
    this._columnSortable.connect({
      columns: () => this.columns(),
      canReorderColumn: () => this.canReorderColumnFn(),
      reorderColumns: (next) => this._applyColumnOrder(next),
    });
    // Logical focus outlives the element it names, so a card the board stops
    // rendering would keep every later arrow step anchored to a cell that is
    // no longer there.
    effect(() => {
      const focus = this._keyboard.focus();
      const tokens = this._navigableCardTokens();
      if (this._keyboard.grabbed()) return;
      if (focus === null || tokens.has(mlvTaskboardKeyToken(focus.itemId)))
        return;
      untracked(() => this._keyboard.clearFocus());
    });
    // An application that rewrites `items` or `columns` has replaced the board
    // the ledger replays against, so the recorded commands no longer describe
    // it. The board's own writes are recognised by identity and never reset it.
    effect(() => {
      const items = this.items();
      const columns = this.columns();
      untracked(() => {
        if (this._history === null) return;
        if (
          items === this._committedItems &&
          columns === this._committedColumns
        )
          return;
        this._history.replace(this._boardCore());
        this._noteCommitted();
      });
    });
  }

  /**
   * Reverts the newest board-originated move or column reorder, writing the
   * replacement collections back through the controlled models.
   *
   * @returns Whether there was anything left to undo.
   */
  undo(): boolean {
    return this._applyHistoryBoard(this._history?.undo() ?? null);
  }

  /**
   * Replays the move an {@link undo} reverted.
   *
   * @returns Whether there was anything left to redo.
   */
  redo(): boolean {
    return this._applyHistoryBoard(this._history?.redo() ?? null);
  }

  /**
   * The board's serializable UI state: column order, collapsed columns and
   * lanes, the selection, the focused card, and each cell's scroll offset.
   * It deliberately carries no card data — {@link exportJson} does that.
   */
  snapshot(): MlvTaskboardSnapshot {
    const focusedId = this._keyboard.focus()?.itemId;
    return createMlvTaskboardSnapshot({
      columnIds: this.columns().map((column) => column.id),
      collapsedColumnIds: [...this.collapsedColumnIds()],
      collapsedSwimlaneIds: [...this.collapsedSwimlaneIds()],
      selectedIds: [...this.selection()],
      ...(focusedId === undefined ? {} : { focusedId }),
      cellScrollPositions: this._cellScrollPositions(),
    });
  }

  /**
   * Restores the UI state of a {@link snapshot}. Identifiers the current board
   * does not know — a removed column, a filtered-out card, a cell that no
   * longer renders — are dropped silently, so a stored snapshot never throws
   * against a board that has moved on. Scroll offsets are applied after the
   * next render, once the cells they address exist.
   */
  restore(snapshot: MlvTaskboardSnapshot): void {
    const index = this._index();
    this.collapsedColumnIds.set(
      new Set(
        snapshot.collapsedColumnIds.filter((id) => index.columnById.has(id)),
      ),
    );
    this.collapsedSwimlaneIds.set(
      new Set(
        snapshot.collapsedSwimlaneIds.filter((id) =>
          index.swimlaneById.has(id),
        ),
      ),
    );
    this._setSelection(
      new Set(snapshot.selectedIds.filter((id) => index.itemById.has(id))),
    );
    this._restoreFocus(snapshot.focusedId);
    afterNextRender(
      () => this._applyCellScrollPositions(snapshot.cellScrollPositions),
      { injector: this._injector },
    );
  }

  /** The whole board — cards, structure, and {@link snapshot} — as plain data. */
  exportJson(): MlvTaskboardSerialized<TItem> {
    return serializeMlvTaskboard(this._boardCore(), this.snapshot());
  }

  /**
   * One column's cards as CSV, one row per card in board order.
   *
   * @param columnId The column to export; cards in other columns are skipped.
   * @param fields The card properties to emit, in order, with their headings.
   */
  exportCsv(
    columnId: MlvTaskboardKey,
    fields: readonly MlvTaskboardCsvField<TItem>[],
  ): string {
    return exportMlvTaskboardCsv(this._boardCore(), columnId, fields);
  }

  /**
   * Expands every virtual cell, then asks the browser to print.
   *
   * It is a no-op during a server render, where the injected document has no
   * view to print through.
   */
  print(): void {
    const view = this._document.defaultView;
    if (view === null) return;
    this._printing.set(true);
    afterNextRender(
      () => {
        view.print();
        this._printing.set(false);
      },
      { injector: this._injector },
    );
  }

  /** Header context used by the optional projected board-header template. */
  protected _headerContext(): MlvTaskboardHeaderDefContext {
    return {
      $implicit: this.columns(),
      columns: this.columns(),
      columnGroups: this.columnGroups(),
      swimlanes: this.swimlanes(),
    };
  }

  /** Context for a group header slot. */
  protected _groupContext(
    group: MlvTaskboardColumnGroup,
  ): MlvTaskboardColumnGroupDefContext {
    return {
      $implicit: group,
      group,
      wip: this._index().groupWipFor(group.id),
    };
  }

  /** Context for a column header slot. */
  protected _columnContext(
    column: MlvTaskboardColumn,
  ): MlvTaskboardColumnHeaderDefContext {
    return { $implicit: column, column, wip: this._index().wipFor(column.id) };
  }

  /** Context for a lane header slot. */
  protected _swimlaneContext(
    swimlane: MlvTaskboardSwimlane,
  ): MlvTaskboardSwimlaneDefContext {
    return {
      $implicit: swimlane,
      swimlane,
      wip: this._index().swimlaneWipFor(swimlane.id),
    };
  }

  /** Context for a column/lane content slot. */
  protected _contentContext(
    column: MlvTaskboardColumn,
    swimlane: MlvTaskboardSwimlane | undefined,
  ): MlvTaskboardColumnContentDefContext<TItem> {
    const items = this._itemsFor(column, swimlane);
    return {
      $implicit: items,
      items,
      column,
      swimlane,
      wip: this._wipFor(column, swimlane),
    };
  }

  /** Context for an individual card slot. */
  protected _itemContext(
    item: TItem,
    column: MlvTaskboardColumn,
    swimlane: MlvTaskboardSwimlane | undefined,
    index: number,
  ): MlvTaskboardItemDefContext<TItem> {
    const id = this._itemId(item);
    return {
      $implicit: item,
      card: item,
      column,
      swimlane,
      location: {
        columnId: column.id,
        ...(swimlane === undefined ? {} : { swimlaneId: swimlane.id }),
        index,
      },
      selected: this.selection().has(id),
      wip: this._wipFor(column, swimlane),
    };
  }

  /** Context for an empty cell slot. */
  protected _emptyContext(
    column: MlvTaskboardColumn,
    swimlane: MlvTaskboardSwimlane | undefined,
  ): MlvTaskboardEmptyStateDefContext {
    return {
      $implicit: column,
      column,
      swimlane,
      wip: this._wipFor(column, swimlane),
    };
  }

  /** Context for a custom add-card slot. */
  protected _addContext(
    column: MlvTaskboardColumn,
    swimlane: MlvTaskboardSwimlane | undefined,
  ): MlvTaskboardCardAddDefContext {
    const requestAdd = () => this.requestAdd(column, swimlane);
    return {
      $implicit: requestAdd,
      requestAdd,
      column,
      swimlane,
      wip: this._wipFor(column, swimlane),
    };
  }

  /**
   * Context for a custom drop-indicator slot.
   *
   * `target.index` counts the cell's cards with the dragged one removed, so
   * `target.items` is that same remaining list — `items[index]` is the card
   * the indicator sits before, and `index === items.length` is the tail.
   */
  protected _dropIndicatorContext(
    column: MlvTaskboardColumn,
    swimlane: MlvTaskboardSwimlane | undefined,
  ): MlvTaskboardDropIndicatorDefContext<TItem> {
    const valid = this._dropAllowed();
    const preview = this._dropPreview();
    const rendered = this._itemsFor(column, swimlane);
    const items =
      preview === null
        ? rendered
        : rendered.filter(
            (item) => !sameMlvTaskboardKey(this._itemId(item), preview.itemId),
          );
    return {
      $implicit: valid,
      valid,
      target: {
        column,
        swimlane,
        index: preview?.index ?? 0,
        items,
        wip: this._wipFor(column, swimlane),
      },
    };
  }

  /** Returns cards rendered in a stable column/lane cell. */
  protected _itemsFor(
    column: MlvTaskboardColumn,
    swimlane: MlvTaskboardSwimlane | undefined,
  ): readonly TItem[] {
    return this._index().itemsFor(column.id, swimlane?.id);
  }

  /** Returns the authoritative WIP state for a column/lane cell. */
  protected _wipFor(
    column: MlvTaskboardColumn,
    swimlane: MlvTaskboardSwimlane | undefined,
  ): MlvTaskboardWipState {
    return this._index().wipFor(column.id, swimlane?.id);
  }

  /** Whether a column hides its rendered card cells. */
  protected _isColumnCollapsed(column: MlvTaskboardColumn): boolean {
    return this.collapsedColumnIds().has(column.id);
  }

  /** Whether a swimlane hides its rendered card cells. */
  protected _isSwimlaneCollapsed(
    swimlane: MlvTaskboardSwimlane | undefined,
  ): boolean {
    return (
      swimlane !== undefined && this.collapsedSwimlaneIds().has(swimlane.id)
    );
  }

  /** Whether the live drop indicator renders immediately before this card. */
  protected _isDropAnchor(
    column: MlvTaskboardColumn,
    swimlane: MlvTaskboardSwimlane | undefined,
    item: TItem,
  ): boolean {
    const anchor = this._dropAnchor();
    return (
      anchor !== null &&
      anchor.anchorId !== null &&
      this._isDropCell(anchor, column, swimlane) &&
      sameMlvTaskboardKey(anchor.anchorId, this._itemId(item))
    );
  }

  /** Whether the live drop indicator renders after this cell's last card. */
  protected _isDropTail(
    column: MlvTaskboardColumn,
    swimlane: MlvTaskboardSwimlane | undefined,
  ): boolean {
    const anchor = this._dropAnchor();
    return (
      anchor !== null &&
      anchor.anchorId === null &&
      this._isDropCell(anchor, column, swimlane)
    );
  }

  /** Whether the previewed slot is a target the drag session authorised. */
  protected _dropAllowed(): boolean {
    return this._dropPreview()?.allowed ?? false;
  }

  /** Emits an add request for the specified cell. */
  protected requestAdd(
    column: MlvTaskboardColumn,
    swimlane: MlvTaskboardSwimlane | undefined,
  ): void {
    this.addRequested.emit({
      column,
      swimlane,
      wip: this._wipFor(column, swimlane),
    });
  }

  /** Emits a card activation without opening an application editor. */
  protected _activate(
    item: TItem,
    column: MlvTaskboardColumn,
    swimlane: MlvTaskboardSwimlane | undefined,
    index: number,
    nativeEvent: MouseEvent | KeyboardEvent,
  ): void {
    this._selectFromPointer(this._itemId(item), nativeEvent);
    this.cardActivated.emit({
      item,
      location: this._itemContext(item, column, swimlane, index).location,
      selectedIds: this.selection(),
      nativeEvent,
    });
  }

  /** Emits a context-menu request without creating an application menu. */
  protected _requestContextMenu(
    item: TItem,
    column: MlvTaskboardColumn,
    swimlane: MlvTaskboardSwimlane | undefined,
    index: number,
    nativeEvent: MouseEvent,
  ): void {
    nativeEvent.preventDefault();
    this.contextMenu.emit({
      item,
      location: this._itemContext(item, column, swimlane, index).location,
      selectedIds: this.selection(),
      nativeEvent,
    });
  }

  /**
   * @protected Whether this card owns the board's single tab stop. Before
   * anything is focused that is the first card in reading order, so a `Tab`
   * into the board always lands somewhere predictable.
   */
  protected _isCardTabbable(item: TItem): boolean {
    return sameMlvTaskboardKey(this._tabbableCardId(), this._itemId(item));
  }

  /** @protected Records focus arriving on a card without moving it again. */
  protected _onCardFocus(
    item: TItem,
    column: MlvTaskboardColumn,
    swimlane: MlvTaskboardSwimlane | undefined,
  ): void {
    this._keyboard.noteFocus({
      columnId: column.id,
      swimlaneId: swimlane?.id,
      itemId: this._itemId(item),
    });
  }

  /**
   * @protected Cancels a grab the user walked away from. Arrow keys move the
   * target slot, not the DOM focus, so a blur while grabbed always means the
   * card was abandoned rather than navigated past.
   */
  protected _onCardBlur(): void {
    this._keyboard.releaseFocus();
  }

  /**
   * @protected Routes one card keydown to the roving focus or the live grab.
   *
   * The horizontal pair goes through `MlvRtlService.normalizeArrowKey`, so
   * `ArrowLeft` means "next column" inside an RTL subtree and the board reads
   * the same way in both directions.
   */
  protected _onCardKeydown(
    event: KeyboardEvent,
    item: TItem,
    column: MlvTaskboardColumn,
    swimlane: MlvTaskboardSwimlane | undefined,
    index: number,
  ): void {
    const step = this._keyboardStep(event);
    let handled = false;
    if (step !== null) {
      handled = this._keyboard.step(step);
    } else if (event.key === ' ' || event.key === 'Spacebar') {
      handled = this._keyboard.toggleGrab();
    } else if (event.key === 'Escape') {
      handled = this._keyboard.cancel();
    } else if (event.key === 'Enter' && !this._keyboard.grabbed()) {
      this._activate(item, column, swimlane, index, event);
      handled = true;
    }
    if (handled) event.preventDefault();
  }

  /** @private Resolves a keydown to the logical navigation command it means. */
  private _keyboardStep(event: KeyboardEvent): MlvTaskboardKeyboardStep | null {
    switch (this._rtlService.normalizeArrowKey(event) ?? event.key) {
      case RIGHT_ARROW:
        return 'next-column';
      case LEFT_ARROW:
        return 'previous-column';
      case DOWN_ARROW:
        return 'next-card';
      case UP_ARROW:
        return 'previous-card';
      case 'Home':
        return 'first-card';
      case 'End':
        return 'last-card';
      default:
        return null;
    }
  }

  /**
   * @private Scrolls a newly focused card into view, then focuses it. The
   * card may sit outside the scrolled cell, so the scroll runs first.
   */
  private _focusCardElement(focus: MlvTaskboardKeyboardFocus): void {
    const viewport = this._viewportFor(focus.columnId, focus.swimlaneId);
    if (viewport !== undefined) {
      const bucketIndex = this._index()
        .itemsFor(focus.columnId, focus.swimlaneId)
        .findIndex((item) =>
          sameMlvTaskboardKey(this._itemId(item), focus.itemId),
        );
      const range = viewport.getRenderedRange();
      const rendered = mlvTaskboardRenderedIndex(bucketIndex, {
        start: range.start,
        rendered: range.end - range.start,
        total: viewport.getDataLength(),
      });
      if (bucketIndex !== -1 && rendered === null) {
        // The card has no element yet, so it is scrolled back into the window
        // first and focused once that render has landed.
        viewport.scrollToIndex(bucketIndex);
        afterNextRender(() => this._focusCardNode(focus.itemId), {
          injector: this._injector,
        });
        return;
      }
    }
    this._focusCardNode(focus.itemId);
  }

  /** @private Scrolls one rendered card into view and moves DOM focus onto it. */
  private _focusCardNode(itemId: MlvTaskboardKey): void {
    const element = this._elementRef.nativeElement.querySelector<HTMLElement>(
      `[${MLV_TASKBOARD_CARD_ID_ATTRIBUTE}="${mlvTaskboardKeyToken(itemId)}"]`,
    );
    if (element === null) return;
    if (typeof element.scrollIntoView === 'function') {
      element.scrollIntoView({ block: 'nearest' });
    }
    element.focus();
  }

  /** @private The virtual viewport rendering one column/lane cell, if any. */
  private _viewportFor(
    columnId: MlvTaskboardKey,
    swimlaneId: MlvTaskboardKey | undefined,
  ): CdkVirtualScrollViewport | undefined {
    return this._cardViewports().find((viewport) => {
      const bucket = this._resolveBucket(viewport.elementRef.nativeElement);
      return (
        bucket !== undefined &&
        sameMlvTaskboardKey(bucket.columnId, columnId) &&
        sameMlvTaskboardKey(bucket.swimlaneId, swimlaneId)
      );
    });
  }

  /** @private Stable identity `*cdkVirtualFor` re-uses a card view by. */
  protected _trackCard = (_index: number, item: TItem): MlvTaskboardKey =>
    this._itemId(item);

  /**
   * @private The lane qualifier an announcement carries, or `''` on a board
   * with no swimlanes — `_translate` collapses the empty slot away.
   */
  private _laneAnnouncement(swimlaneId: MlvTaskboardKey | undefined): string {
    if (swimlaneId === undefined) return '';
    const lane = this._index().swimlaneById.get(swimlaneId);
    return this._translate('laneName', {
      lane: lane?.label ?? String(swimlaneId),
    });
  }

  /** @private States the outcome of a move that never changed the board. */
  private _announceMoveOutcome(
    reason: MlvTaskboardMoveCancelReason,
    itemId: MlvTaskboardKey,
  ): void {
    const label = String(itemId);
    if (reason === 'cancelled') {
      this._announce('moveCancelled', { label });
      return;
    }
    this._announce('moveRejected', {
      label,
      reason: this._translate(MLV_TASKBOARD_CANCEL_REASONS[reason]),
    });
  }

  /**
   * @private Applies the selection gesture a card click carries.
   *
   * A plain click replaces the selection, `Ctrl`/`Cmd` toggles the clicked
   * card, and `Shift` selects the inclusive run between the anchor and the
   * clicked card in rendered board order. A shift-click with no anchor — or
   * one whose anchor is no longer rendered — has no run to describe, so it
   * falls back to a plain replacement.
   */
  private _selectFromPointer(
    id: MlvTaskboardKey,
    event: MouseEvent | KeyboardEvent,
  ): void {
    if (event.shiftKey) {
      const range = this._selectionRange(id);
      if (range !== null) {
        this._setSelection(range);
        return;
      }
    }
    if (event.ctrlKey || event.metaKey) {
      const next = new Set(this.selection());
      if (next.has(id)) next.delete(id);
      else next.add(id);
      this._selectionAnchor.set(id);
      this._setSelection(next);
      return;
    }
    this._selectionAnchor.set(id);
    this._setSelection(new Set([id]));
  }

  /**
   * @private The inclusive run of rendered keys between the anchor and `id`,
   * or `null` when either end is not currently rendered.
   */
  private _selectionRange(
    id: MlvTaskboardKey,
  ): ReadonlySet<MlvTaskboardKey> | null {
    const anchor = this._selectionAnchor();
    if (anchor === null) return null;
    const order = this._renderedOrder();
    const from = order.findIndex((key) => sameMlvTaskboardKey(key, anchor));
    const to = order.findIndex((key) => sameMlvTaskboardKey(key, id));
    if (from === -1 || to === -1) return null;
    const start = Math.min(from, to);
    const end = Math.max(from, to);
    return new Set(order.slice(start, end + 1));
  }

  /**
   * @private Writes the selection model when the set really changed.
   *
   * The board owns no selection state of its own, so an unchanged set must not
   * reach `selection.set` — a controlled application would otherwise see a
   * `selectionChange` per click on an already-selected card. Keys the
   * `visibleItems` filter hides are never removed here: only an explicit
   * gesture changes the selection, so a filtered-away card stays selected.
   */
  private _setSelection(next: ReadonlySet<MlvTaskboardKey>): void {
    const current = this.selection();
    if (
      current.size === next.size &&
      [...next].every((key) => current.has(key))
    )
      return;
    this.selection.set(next);
    this._announce('selectionCount', { count: next.size });
  }

  /** @private Replaces the polite live-region text with one localized event. */
  private _announce(
    key: keyof MlvTaskboardI18n,
    params?: Record<string, string | number>,
  ): void {
    this._announcement.set(this._translate(key, params));
  }

  /**
   * @protected Resolves one localized string.
   *
   * Runs of whitespace are collapsed and the result trimmed, because several
   * announcement messages carry an optional `{lane}` slot that is empty on a
   * board without swimlanes; without the collapse an unlaned board would
   * announce a trailing gap in every locale that keeps the slot inline.
   */
  protected _translate(
    key: keyof MlvTaskboardI18n,
    params?: Record<string, string | number>,
  ): string {
    return this._i18nResolver
      .resolve(this._i18n() as unknown as Record<string, string>, key, params)
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** @protected Text of the built-in card surface, when no card is projected. */
  protected _cardLabel(item: TItem): string {
    return this._translate('cardLabel', { label: String(this._itemId(item)) });
  }

  /**
   * @protected Work-in-progress readout of a built-in column header. A column
   * that declares no limit has nothing to state a ratio against, so it renders
   * the bare count instead of a localized phrase.
   */
  protected _wipLabel(column: MlvTaskboardColumn): string {
    const wip = this._wipFor(column, undefined);
    return wip.limit === undefined
      ? String(wip.count)
      : this._translate('wipState', { count: wip.count, limit: wip.limit });
  }

  /** Returns the stable item key used by DOM adapters and selection. */
  protected _itemId(item: TItem): MlvTaskboardKey {
    return item[this.dataKey()] as MlvTaskboardKey;
  }

  /**
   * The canonical key token a DOM data attribute carries.
   *
   * The token keeps the value's runtime type, so the number `1` and the
   * string `'1'` address different elements and an attribute read back
   * resolves to exactly the key it was written from.
   */
  protected _keyAttribute(key: MlvTaskboardKey): string {
    return mlvTaskboardKeyToken(key);
  }

  /** @protected Id carried by one column's header cell. */
  protected _columnHeaderId(column: MlvTaskboardColumn): string | null {
    return this._columnHeaderIds().get(mlvTaskboardKeyToken(column.id)) ?? null;
  }

  /** @protected Id carried by one swimlane's row header cell. */
  protected _laneHeaderId(swimlane: MlvTaskboardSwimlane): string | null {
    return this._laneHeaderIds().get(mlvTaskboardKeyToken(swimlane.id)) ?? null;
  }

  /**
   * @protected Accessible name of one cell's card listbox: its column header,
   * plus the lane header when the board is laned.
   */
  protected _cellLabelledBy(
    column: MlvTaskboardColumn,
    swimlane: MlvTaskboardSwimlane | undefined,
  ): string | null {
    const columnId = this._columnHeaderId(column);
    const laneId = swimlane === undefined ? null : this._laneHeaderId(swimlane);
    const ids = [columnId, laneId].filter((id): id is string => id !== null);
    return ids.length > 0 ? ids.join(' ') : null;
  }

  /** Whether a column is pinned to its absolute index. */
  protected _isColumnLocked(column: MlvTaskboardColumn): boolean {
    return column.locked === true;
  }

  /** @private Whether a resolved drop anchor addresses this column/lane cell. */
  private _isDropCell(
    anchor: MlvTaskboardDropAnchor,
    column: MlvTaskboardColumn,
    swimlane: MlvTaskboardSwimlane | undefined,
  ): boolean {
    return (
      sameMlvTaskboardKey(anchor.columnId, column.id) &&
      sameMlvTaskboardKey(anchor.swimlaneId, swimlane?.id)
    );
  }

  /** @private Resolves a card element's data attribute to its canonical key. */
  private _resolveItemId(attribute: string): MlvTaskboardKey | undefined {
    for (const id of this._index().itemById.keys()) {
      if (mlvTaskboardKeyToken(id) === attribute) return id;
    }
    return undefined;
  }

  /** @private Resolves a registered container element to its canonical bucket. */
  private _resolveBucket(element: HTMLElement): MlvTaskboardBucket | undefined {
    // A virtualized cell registers the viewport's content wrapper, which
    // carries no board attributes of its own; `closest` walks out to the
    // viewport host and matches the element itself for a plain cell.
    const cell = element.closest<HTMLElement>(
      `[${MLV_TASKBOARD_COLUMN_ID_ATTRIBUTE}]`,
    );
    if (cell === null) return undefined;
    const columnAttribute = cell.getAttribute(
      MLV_TASKBOARD_COLUMN_ID_ATTRIBUTE,
    );
    if (columnAttribute === null) return undefined;
    const column = this.columns().find(
      (candidate) => mlvTaskboardKeyToken(candidate.id) === columnAttribute,
    );
    if (!column) return undefined;
    const swimlaneAttribute = cell.getAttribute(
      MLV_TASKBOARD_SWIMLANE_ID_ATTRIBUTE,
    );
    if (swimlaneAttribute === null) {
      return { columnId: column.id, swimlaneId: undefined };
    }
    const swimlane = this.swimlanes().find(
      (candidate) => mlvTaskboardKeyToken(candidate.id) === swimlaneAttribute,
    );
    return swimlane === undefined
      ? undefined
      : { columnId: column.id, swimlaneId: swimlane.id };
  }

  /**
   * @private Writes both controlled collections back from one replayed board
   * state, and marks them as this board's own writes so the external-change
   * effect does not read the replay as an application rewrite.
   */
  private _applyHistoryBoard(board: MlvTaskboardState<TItem> | null): boolean {
    if (board === null) return false;
    this.items.set(board.items);
    this.columns.set(board.columns);
    this._noteCommitted();
    return true;
  }

  /** @private Remembers the collections this board itself just wrote. */
  private _noteCommitted(): void {
    this._committedItems = this.items();
    this._committedColumns = this.columns();
  }

  /** @private Every rendered cell's scroll offset, keyed by its bucket token. */
  private _cellScrollPositions(): Record<string, number> {
    const positions: Record<string, number> = {};
    const cells = this._elementRef.nativeElement.querySelectorAll<HTMLElement>(
      '.mlv-taskboard__cards',
    );
    for (const cell of cells) {
      const bucket = this._resolveBucket(cell);
      if (bucket === undefined) continue;
      positions[mlvTaskboardBucketToken(bucket.columnId, bucket.swimlaneId)] =
        cell.scrollTop;
    }
    return positions;
  }

  /** @private Puts each rendered cell back at the offset it was captured at. */
  private _applyCellScrollPositions(
    positions: Readonly<Record<string, number>>,
  ): void {
    const cells = this._elementRef.nativeElement.querySelectorAll<HTMLElement>(
      '.mlv-taskboard__cards',
    );
    for (const cell of cells) {
      const bucket = this._resolveBucket(cell);
      if (bucket === undefined) continue;
      const offset =
        positions[mlvTaskboardBucketToken(bucket.columnId, bucket.swimlaneId)];
      if (offset === undefined) continue;
      cell.scrollTop = offset;
    }
  }

  /**
   * @private Restores the roving tab stop onto a card the board still renders.
   * An unknown card leaves the focus untouched, so the board falls back to its
   * first card rather than to a tab stop that cannot be reached.
   */
  private _restoreFocus(focusedId: MlvTaskboardKey | undefined): void {
    if (focusedId === undefined) return;
    const index = this._index();
    for (const swimlaneId of this._navigableSwimlaneIds()) {
      for (const columnId of this._navigableColumnIds()) {
        const found = index
          .itemsFor(columnId, swimlaneId)
          .some((item) => sameMlvTaskboardKey(this._itemId(item), focusedId));
        if (!found) continue;
        this._keyboard.noteFocus({ columnId, swimlaneId, itemId: focusedId });
        return;
      }
    }
  }

  /** @private Whether DOM focus currently rests inside this board. */
  private _ownsDomFocus(): boolean {
    const active = this._document.activeElement;
    return active !== null && this._elementRef.nativeElement.contains(active);
  }

  /** @private Writes the single replacement collection and records the move. */
  private _applyMoveResult(result: MlvTaskboardMoveResult<TItem>): void {
    const before = this._boardCore();
    // A cross-cell commit destroys the card's element and rebuilds it in the
    // destination, so DOM focus would fall to the document body. Read the
    // ownership before the write, so a pointer drop from outside the board
    // never has focus pulled into it.
    const hadFocus = this._ownsDomFocus();
    this.items.set(result.items);
    const landed: MlvTaskboardKeyboardFocus = {
      columnId: result.target.columnId,
      swimlaneId: result.target.swimlaneId,
      itemId: this._itemId(result.item),
    };
    this._keyboard.noteFocus(landed);
    if (hadFocus) {
      afterNextRender(() => this._focusCardElement(landed), {
        injector: this._injector,
      });
    }
    this._recordCommand(before);
    this._announce('moved', {
      label: String(this._itemId(result.item)),
      column:
        this._index().columnById.get(result.target.columnId)?.label ??
        String(result.target.columnId),
      lane: this._laneAnnouncement(result.target.swimlaneId),
      position: result.target.index + 1,
    });
    this.moved.emit(result);
  }

  /** @private Writes the replacement column order and records the command. */
  private _applyColumnOrder(next: readonly MlvTaskboardColumn[]): void {
    const before = this._boardCore();
    this.columns.set(next);
    this._recordCommand(before);
  }

  /**
   * @private Records one replayable board replacement in the history ledger.
   *
   * The command's `after` is read back from `_boardCore()` *after* the model
   * write, so it is the very snapshot the next command's `before` resolves to
   * and consecutive moves chain onto one stack. Recording a hand-built literal
   * instead would leave every later `before` unequal to the ledger's current
   * board, and `replace` would clear both stacks on every move. `_boardCore`
   * also excludes selection and `canDropFn`, so neither counts as a board
   * change: `replace` fires only for a board that really changed outside this
   * component.
   */
  private _recordCommand(before: MlvTaskboardState<TItem>): void {
    this._history ??= createMlvTaskboardHistory<TItem>(before);
    if (this._history.current() !== before) this._history.replace(before);
    this._history.push({ before, after: this._boardCore() });
    this._noteCommitted();
  }

  /**
   * @private Toggles the pending state and blocks drags while it is set.
   *
   * Both adapters are disabled: a column drag while a card move is pending
   * would write `columns`, change the board snapshot the guard captured, and
   * make the settling move report `stale`.
   */
  private _setMovePending(pending: boolean): void {
    this._movePending.set(pending);
    this._sortable.setDragsDisabled(pending);
    this._columnSortable.setDragsDisabled(pending);
  }
}
