import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  computed,
  contentChildren,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import {
  MLV_DENSITY_ELEMENT,
  MlvDensityDirective,
} from '@malva-ui/cdk/density';
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
import { createMlvTaskboardHistory } from '../taskboard-history';
import { sameMlvTaskboardKey } from '../taskboard-keys';
import {
  createMlvTaskboardIndex,
  type MlvTaskboardIndex,
} from '../taskboard-state';
import type {
  MlvTaskboardState,
  MlvTaskboardBeforeMove,
  MlvTaskboardCanDropFn,
  MlvTaskboardColumn,
  MlvTaskboardColumnGroup,
  MlvTaskboardField,
  MlvTaskboardHistory,
  MlvTaskboardKey,
  MlvTaskboardLocation,
  MlvTaskboardMoveCancelledEvent,
  MlvTaskboardMoveResult,
  MlvTaskboardSwimlane,
  MlvTaskboardTransition,
  MlvTaskboardWipState,
} from '../taskboard.types';
import { MlvTaskboardCardsHost } from './taskboard-cards-host';
import { MlvTaskboardMoveController } from './taskboard-move-controller';
import {
  MLV_TASKBOARD_CARDS_REGISTRY,
  MLV_TASKBOARD_COLUMN_ID_ATTRIBUTE,
  MLV_TASKBOARD_SWIMLANE_ID_ATTRIBUTE,
  MlvTaskboardSortable,
  type MlvTaskboardBucket,
  type MlvTaskboardDropPreview,
} from './taskboard-sortable';

/** Payload emitted for a card activation or context-menu request. */
export interface MlvTaskboardCardEvent<TItem> {
  readonly item: TItem;
  readonly location: MlvTaskboardLocation;
  readonly selectedIds: ReadonlySet<MlvTaskboardKey>;
  readonly nativeEvent: MouseEvent;
}

/** Payload emitted when an application should add a card to a board cell. */
export interface MlvTaskboardAddRequest {
  readonly column: MlvTaskboardColumn;
  readonly swimlane: MlvTaskboardSwimlane | undefined;
  readonly wip: MlvTaskboardWipState;
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
  imports: [NgTemplateOutlet, MlvTaskboardCardsHost],
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
  ],
  hostDirectives: [{ directive: MlvDensityDirective, inputs: ['mlvDensity'] }],
  host: {
    class: 'mlv-taskboard',
    role: 'grid',
    'aria-label': 'Taskboard',
    '[class.mlv-taskboard--move-pending]': '_movePending()',
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

  /** @private Package-private SortableJS adapter provided by this component. */
  private readonly _sortable = inject(
    MlvTaskboardSortable,
  ) as MlvTaskboardSortable<TItem>;

  /** @private Guarded commit/cancel flow for one released pointer drop. */
  private readonly _moveController = new MlvTaskboardMoveController<TItem>({
    boardCore: () => this._boardCore(),
    beforeMove: () => this.beforeMove(),
    apply: (result) => this._applyMoveResult(result),
    cancelled: (event) => this.moveCancelled.emit(event),
    setPending: (pending) => this._setMovePending(pending),
  });

  /**
   * @private Replayable ledger of board-originated moves. It is seeded by the
   * first committed move and is not exposed yet — the public undo/redo surface
   * arrives with the keyboard grab feature.
   */
  private _history: MlvTaskboardHistory<TItem> | null = null;

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

  /** Context for a custom drop-indicator slot. */
  protected _dropIndicatorContext(
    column: MlvTaskboardColumn,
    swimlane: MlvTaskboardSwimlane | undefined,
  ): MlvTaskboardDropIndicatorDefContext<TItem> {
    const valid = this._dropAllowed();
    return {
      $implicit: valid,
      valid,
      target: {
        column,
        swimlane,
        index: this._dropPreview()?.index ?? 0,
        items: this._itemsFor(column, swimlane),
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
    nativeEvent: MouseEvent,
  ): void {
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

  /** Returns the stable item key used by DOM adapters and selection. */
  protected _itemId(item: TItem): MlvTaskboardKey {
    return item[this.dataKey()] as MlvTaskboardKey;
  }

  /** A string value safe for stable DOM data attributes. */
  protected _keyAttribute(key: MlvTaskboardKey): string {
    return String(key);
  }

  /** Number of column tracks occupied by a grouped header. */
  protected _groupColumnSpan(group: MlvTaskboardColumnGroup): number {
    return this.columns().filter((column) => column.groupId === group.id)
      .length;
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
      if (String(id) === attribute) return id;
    }
    return undefined;
  }

  /** @private Resolves a registered container element to its canonical bucket. */
  private _resolveBucket(element: HTMLElement): MlvTaskboardBucket | undefined {
    const columnAttribute = element.getAttribute(
      MLV_TASKBOARD_COLUMN_ID_ATTRIBUTE,
    );
    if (columnAttribute === null) return undefined;
    const column = this.columns().find(
      (candidate) => String(candidate.id) === columnAttribute,
    );
    if (!column) return undefined;
    const swimlaneAttribute = element.getAttribute(
      MLV_TASKBOARD_SWIMLANE_ID_ATTRIBUTE,
    );
    if (swimlaneAttribute === null) {
      return { columnId: column.id, swimlaneId: undefined };
    }
    const swimlane = this.swimlanes().find(
      (candidate) => String(candidate.id) === swimlaneAttribute,
    );
    return swimlane === undefined
      ? undefined
      : { columnId: column.id, swimlaneId: swimlane.id };
  }

  /** @private Writes the single replacement collection and records the move. */
  private _applyMoveResult(result: MlvTaskboardMoveResult<TItem>): void {
    const before = this._board();
    this._recordCommand(before, { ...before, items: result.items });
    this.items.set(result.items);
    this.moved.emit(result);
  }

  /** @private Records one replayable board replacement in the history ledger. */
  private _recordCommand(
    before: MlvTaskboardState<TItem>,
    after: MlvTaskboardState<TItem>,
  ): void {
    this._history ??= createMlvTaskboardHistory<TItem>(before);
    if (this._history.current() !== before) this._history.replace(before);
    this._history.push({ before, after });
  }

  /** @private Toggles the pending state and blocks drags while it is set. */
  private _setMovePending(pending: boolean): void {
    this._movePending.set(pending);
    this._sortable.setDragsDisabled(pending);
  }
}
