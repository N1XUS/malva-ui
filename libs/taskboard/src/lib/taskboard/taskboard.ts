import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  computed,
  contentChildren,
  input,
  model,
  output,
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
  MlvTaskboardEmptyStateDef,
  MlvTaskboardHeaderDef,
  MlvTaskboardItemDef,
  MlvTaskboardSwimlaneDef,
  type MlvTaskboardCardAddDefContext,
  type MlvTaskboardColumnContentDefContext,
  type MlvTaskboardColumnGroupDefContext,
  type MlvTaskboardColumnHeaderDefContext,
  type MlvTaskboardEmptyStateDefContext,
  type MlvTaskboardHeaderDefContext,
  type MlvTaskboardItemDefContext,
  type MlvTaskboardSwimlaneDefContext,
} from '../taskboard-defs';
import {
  createMlvTaskboardIndex,
  type MlvTaskboardIndex,
} from '../taskboard-state';
import type {
  MlvTaskboard as MlvTaskboardState,
  MlvTaskboardCanDropFn,
  MlvTaskboardColumn,
  MlvTaskboardColumnGroup,
  MlvTaskboardField,
  MlvTaskboardKey,
  MlvTaskboardLocation,
  MlvTaskboardSwimlane,
  MlvTaskboardTransition,
  MlvTaskboardWipState,
} from '../taskboard.types';

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

/**
 * Controlled taskboard rendering shell. It renders immutable item data and
 * emits application-owned card actions; editing and drag adapters are added by
 * their dedicated taskboard features.
 */
@Component({
  selector: 'mlv-taskboard',
  imports: [NgTemplateOutlet],
  templateUrl: './taskboard.html',
  styleUrl: './taskboard.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: MLV_DENSITY_ELEMENT, useValue: 'taskboard' }],
  hostDirectives: [{ directive: MlvDensityDirective, inputs: ['mlvDensity'] }],
  host: {
    class: 'mlv-taskboard',
    role: 'grid',
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

  /** Pure indexed state derived from the immutable controlled inputs. */
  protected readonly _index = computed<MlvTaskboardIndex<TItem>>(() =>
    createMlvTaskboardIndex(this._board()),
  );

  /** Stable board state handed to the pure indexing API. */
  private readonly _board = computed<MlvTaskboardState<TItem>>(() => ({
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
    selectedIds: this.selection(),
    canDropFn: this.canDropFn(),
  }));

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
}
