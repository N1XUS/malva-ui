import { DOCUMENT } from '@angular/common';
import {
  DestroyRef,
  ElementRef,
  Injectable,
  InjectionToken,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MlvRtlService } from '@malva-ui/cdk/utils';
import { Subject, filter, fromEvent, takeUntil } from 'rxjs';
import Sortable from 'sortablejs';
import type {
  MlvTaskboardCanReorderColumnFn,
  MlvTaskboardColumn,
} from '../taskboard.types';
import {
  MLV_TASKBOARD_COLUMN_ID_ATTRIBUTE,
  MLV_TASKBOARD_COLUMN_LOCKED_ATTRIBUTE,
  MLV_TASKBOARD_DROP_STATE_ATTRIBUTE,
  captureMlvTaskboardDragResidue,
  mlvTaskboardChildrenOf,
  mlvTaskboardGroupName,
  mlvTaskboardInsertionIndex,
  mlvTaskboardSortableBaseOptions,
  restoreMlvTaskboardDragResidue,
  sanitizeMlvTaskboardClone,
  type MlvTaskboardDragResidue,
} from './taskboard-sortable-dom';

/** BEM class of a rendered column header, and the only draggable selector. */
const COLUMN_HEADER_CLASS = 'mlv-taskboard__column-header';
/** Prefix of the per-board SortableJS group of the column header row. */
const COLUMNS_GROUP_PREFIX = 'mlv-taskboard-columns';
/** Locked columns never leave their absolute index, so they never drag. */
const COLUMN_DRAG_FILTER = `[${MLV_TASKBOARD_COLUMN_LOCKED_ATTRIBUTE}="true"]`;

/** Board-owned services the column adapter needs while a drag is live. */
export interface MlvTaskboardColumnSortableHost {
  /** The current controlled column collection, in rendered order. */
  columns(): readonly MlvTaskboardColumn[];
  /** The application policy consulted for every hovered candidate order. */
  canReorderColumn(): MlvTaskboardCanReorderColumnFn | undefined;
  /** Writes the single immutable replacement column collection. */
  reorderColumns(next: readonly MlvTaskboardColumn[]): void;
}

/** Registration surface the board's private columns-host directive consumes. */
export interface MlvTaskboardColumnsRegistry {
  registerColumnRow(element: HTMLElement): void;
  unregisterColumnRow(element: HTMLElement): void;
}

/**
 * Token the board provides so its package-private columns-host directive can
 * register the header row without importing the component (and its template).
 */
export const MLV_TASKBOARD_COLUMNS_REGISTRY =
  new InjectionToken<MlvTaskboardColumnsRegistry>(
    'MLV_TASKBOARD_COLUMNS_REGISTRY',
  );

/**
 * Package-private SortableJS adapter for pointer and touch column reordering.
 *
 * Like the card adapter, `onMove` always returns `false`: SortableJS never
 * reorders the header row, and an accepted drop is expressed as one immutable
 * replacement column collection instead. The adapter is provided by
 * `MlvTaskboard` and is not part of the public barrel.
 */
@Injectable()
export class MlvTaskboardColumnSortable implements MlvTaskboardColumnsRegistry {
  /** @private The injected document; never the ambient global (SSR-safe). */
  private readonly _document = inject(DOCUMENT);
  /** @private Ties every drag listener and the instance to the board's life. */
  private readonly _destroyRef = inject(DestroyRef);
  /**
   * @private The direction applying to the board, following any `[dir]` scope
   * above it. The header row is the one taskboard container laid out on the
   * inline axis, so the physical insert side SortableJS reports mirrors here.
   */
  private readonly _direction = inject(MlvRtlService).elementDirection(
    inject(ElementRef<HTMLElement>),
  );
  /** @private This board's own group, so a sibling board never accepts it. */
  private readonly _group = mlvTaskboardGroupName(COLUMNS_GROUP_PREFIX);
  /** @private Board callbacks, connected once by the owning component. */
  private _host: MlvTaskboardColumnSortableHost | null = null;
  /** @private The registered header row element, `null` before first render. */
  private _row: HTMLElement | null = null;
  /** @private The single SortableJS instance covering the header row. */
  private _sortable: Sortable | null = null;
  /** @private The dragged header's pre-drag state, restored when it drops. */
  private _residue: MlvTaskboardDragResidue | null = null;
  /** @private Index of the dragged column, `-1` between drags. */
  private _fromIndex = -1;
  /** @private The order the drag would commit if released right now. */
  private _next: readonly MlvTaskboardColumn[] | null = null;
  /** @private Whether Escape abandoned the drag currently in flight. */
  private _cancelled = false;
  /** @private Ends the current drag's document listeners on drop. */
  private readonly _dragEnd = new Subject<void>();
  /** @private Whether a pending guarded move currently blocks new drags. */
  private _disabled = false;

  constructor() {
    this._destroyRef.onDestroy(() => this.destroy());
  }

  /** Binds the adapter to its owning board. Called once, from the component. */
  connect(host: MlvTaskboardColumnSortableHost): void {
    this._host = host;
  }

  /** Creates the SortableJS instance for the rendered column header row. */
  registerColumnRow(element: HTMLElement): void {
    if (this._row === element && this._sortable) return;
    // Angular can render a replacement row before the destroy hook of the row
    // it replaces has run. Keeping the old instance would leave the live row
    // unregistered, and that destroy would then take the only instance with it.
    this._sortable?.destroy();
    this._row = element;
    this._sortable = Sortable.create(element, this._sortableOptions());
    this._sortable.option('disabled', this._disabled);
  }

  /** Destroys the instance of a header row leaving the DOM. */
  unregisterColumnRow(element: HTMLElement): void {
    if (this._row !== element) return;
    this._row = null;
    this._sortable?.destroy();
    this._sortable = null;
  }

  /** Blocks or restores pointer dragging while a guarded move is pending. */
  setDragsDisabled(disabled: boolean): void {
    this._disabled = disabled;
    this._sortable?.option('disabled', disabled);
  }

  /** Begins a drag: records the dragged column and watches for Escape. */
  start(event: Sortable.SortableEvent): void {
    this._endDrag();
    const host = this._host;
    const item = event.item;
    const attribute = item.getAttribute(MLV_TASKBOARD_COLUMN_ID_ATTRIBUTE);
    if (!host || attribute === null) return;
    const columns = host.columns();
    const fromIndex = columns.findIndex(
      (column) => String(column.id) === attribute,
    );
    // A locked column is already excluded by `filter`; this is the guard for a
    // drag started before the lock reached the DOM.
    if (fromIndex < 0 || columns[fromIndex]?.locked === true) return;

    this._fromIndex = fromIndex;
    this._residue = captureMlvTaskboardDragResidue(item, event.from);
    const fallbackClone = Sortable.ghost;
    if (fallbackClone && fallbackClone !== item) {
      sanitizeMlvTaskboardClone(fallbackClone);
    }

    fromEvent<KeyboardEvent>(this._document, 'keydown')
      .pipe(
        filter((keyboardEvent) => keyboardEvent.key === 'Escape'),
        takeUntil(this._dragEnd),
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe(() => {
        this._cancelled = true;
      });
  }

  /**
   * Records the hovered candidate order and always answers `false`, so
   * SortableJS never reorders the board's Angular-owned header row.
   */
  move(event: Sortable.MoveEvent): false {
    const host = this._host;
    const row = this._row;
    if (!host || !row || this._fromIndex < 0 || event.to !== row) {
      this._applyPreview(null);
      return false;
    }
    const headers = mlvTaskboardChildrenOf(row, COLUMN_HEADER_CLASS);
    const domIndex = mlvTaskboardInsertionIndex(
      event,
      headers,
      this._direction() === 'rtl',
    );
    const sourcePosition =
      this._residue === null ? -1 : headers.indexOf(this._residue.item);
    // Sortable reports a slot among the rendered headers, which still include
    // the dragged header; a column index counts the order without it.
    const toIndex =
      sourcePosition >= 0 && domIndex > sourcePosition
        ? domIndex - 1
        : domIndex;
    this._applyPreview(this._candidateOrder(host, this._fromIndex, toIndex));
    return false;
  }

  /** Ends a drag: cleans SortableJS residue, then commits the last order. */
  end(event: Sortable.SortableEvent): void {
    const host = this._host;
    const next = this._next;
    const cancelled = this._cancelled;
    restoreMlvTaskboardDragResidue(this._residue, event.item);
    this._applyPreview(null);
    this._endDrag();
    if (!host || cancelled || next === null) return;
    host.reorderColumns(next);
  }

  /** Destroys the registered instance and releases the live drag state. */
  destroy(): void {
    this._host = null;
    this._applyPreview(null);
    this._endDrag();
    this._dragEnd.complete();
    this._row = null;
    this._sortable?.destroy();
    this._sortable = null;
  }

  /** @private Options for the single registered column header row. */
  private _sortableOptions(): Sortable.Options {
    return {
      ...mlvTaskboardSortableBaseOptions(),
      group: { name: this._group, pull: true, put: true },
      draggable: `.${COLUMN_HEADER_CLASS}`,
      filter: COLUMN_DRAG_FILTER,
      onClone: (event) => sanitizeMlvTaskboardClone(event.clone),
      onStart: (event) => this.start(event),
      onMove: (event) => this.move(event),
      onEnd: (event) => this.end(event),
    };
  }

  /**
   * @private The replacement collection a drop at `toIndex` would produce, or
   * `null` when that order is not a permitted one.
   *
   * An order is permitted when it actually moves the column, when every locked
   * column keeps its absolute index, and when the application policy does not
   * veto it.
   */
  private _candidateOrder(
    host: MlvTaskboardColumnSortableHost,
    fromIndex: number,
    toIndex: number,
  ): readonly MlvTaskboardColumn[] | null {
    const columns = host.columns();
    const column = columns[fromIndex];
    if (
      column === undefined ||
      toIndex === fromIndex ||
      toIndex < 0 ||
      toIndex >= columns.length
    ) {
      return null;
    }
    const next = columns.slice();
    next.splice(fromIndex, 1);
    next.splice(toIndex, 0, column);
    for (let index = 0; index < next.length; index++) {
      if (next[index]?.locked === true && next[index] !== columns[index]) {
        return null;
      }
    }
    if (
      host.canReorderColumn()?.(column, fromIndex, toIndex, columns) === false
    ) {
      return null;
    }
    return this._adoptNeighbourGroup(next, toIndex);
  }

  /**
   * @private Gives the moved column the group of its new neighbours, so a
   * column dragged into another run joins it. Landing between two ungrouped
   * columns clears the moved column's own group.
   */
  private _adoptNeighbourGroup(
    next: readonly MlvTaskboardColumn[],
    toIndex: number,
  ): readonly MlvTaskboardColumn[] {
    const moved = next[toIndex];
    if (moved === undefined) return next;
    const groupId = next[toIndex - 1]?.groupId ?? next[toIndex + 1]?.groupId;
    if (moved.groupId === groupId) return next;
    const adopted = next.slice();
    adopted[toIndex] = { ...moved, groupId };
    return adopted;
  }

  /** @private Reflects the hovered order's validity on the header row. */
  private _applyPreview(next: readonly MlvTaskboardColumn[] | null): void {
    this._next = next;
    const row = this._row;
    if (!row) return;
    if (this._fromIndex < 0) {
      row.removeAttribute(MLV_TASKBOARD_DROP_STATE_ATTRIBUTE);
      return;
    }
    row.setAttribute(
      MLV_TASKBOARD_DROP_STATE_ATTRIBUTE,
      next === null ? 'invalid' : 'valid',
    );
  }

  /** @private Releases the live drag's tracked column and listeners. */
  private _endDrag(): void {
    this._fromIndex = -1;
    this._residue = null;
    this._cancelled = false;
    this._row?.removeAttribute(MLV_TASKBOARD_DROP_STATE_ATTRIBUTE);
    this._dragEnd.next();
  }
}
