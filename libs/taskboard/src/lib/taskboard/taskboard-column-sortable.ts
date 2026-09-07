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
import { mlvTaskboardKeyToken } from '../taskboard-keys';
import { Subject, filter, fromEvent, takeUntil } from 'rxjs';
import Sortable from 'sortablejs';
import type {
  MlvTaskboardCanReorderColumnFn,
  MlvTaskboardColumn,
} from '../taskboard.types';
import {
  adoptMlvTaskboardCloneStyle,
  MLV_TASKBOARD_COLUMN_ID_ATTRIBUTE,
  MLV_TASKBOARD_COLUMN_LOCKED_ATTRIBUTE,
  MLV_TASKBOARD_DROP_EDGE_ATTRIBUTE,
  MLV_TASKBOARD_DROP_STATE_ATTRIBUTE,
  captureMlvTaskboardDragResidue,
  mlvTaskboardChildrenOf,
  mlvTaskboardGroupName,
  mlvTaskboardSortableBaseOptions,
  restoreMlvTaskboardDragResidue,
  sanitizeMlvTaskboardClone,
  type MlvTaskboardDragResidue,
} from './taskboard-sortable-dom';

/** The shapes a SortableJS move payload's `originalEvent` can arrive in. */
interface MlvTaskboardPointerPayload {
  readonly clientX?: unknown;
  readonly touches?: ArrayLike<{ readonly clientX?: unknown }>;
  readonly changedTouches?: ArrayLike<{ readonly clientX?: unknown }>;
}

/**
 * The pointer's physical `clientX` for one move payload, or `null` when the
 * engine reported no usable coordinate.
 *
 * SortableJS hands `onMove` the event that produced the hover as
 * `originalEvent`: a synthesized `{ clientX, clientY, target }` object in
 * fallback mode (which both taskboard adapters force), a `dragover` on the
 * native path, and a `TouchEvent` on touch, where the coordinate lives on the
 * first touch. The engine reads `(touch || evt).clientX` itself; this mirrors
 * that, and treats anything else as "no answer" rather than guessing a slot.
 */
function mlvTaskboardPointerClientX(event: Sortable.MoveEvent): number | null {
  const original = (event as { originalEvent?: unknown }).originalEvent;
  if (original === null || typeof original !== 'object') return null;
  const payload = original as MlvTaskboardPointerPayload;
  const touch = payload.touches?.[0] ?? payload.changedTouches?.[0];
  const clientX = touch === undefined ? payload.clientX : touch.clientX;
  return typeof clientX === 'number' && Number.isFinite(clientX)
    ? clientX
    : null;
}

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
 *
 * Unlike the card adapter it ignores `related` / `willInsertAfter` entirely
 * and derives the drop slot from the pointer's `clientX`. The header row is
 * the one taskboard container on the **inline axis**, and that flag cannot be
 * turned into a logical slot there:
 *
 * - Over a sibling header, `willInsertAfter` comes from `_getSwapDirection`'s
 *   regular branch, which returns `_getInsertDirection(target)` —
 *   `index(dragEl) < index(target)`, a **DOM-order** answer that is already
 *   logical and must not be mirrored. (Its inverted branch is unreachable
 *   here: it needs `targetMoveDistance`, which SortableJS assigns only after
 *   an `onMove` that did not answer `false`.)
 * - Over free space at either end, the flag comes from `_ghostIsLast` /
 *   `_ghostIsFirst`, which compare raw screen coordinates with the first or
 *   last child's edges — **physical**, and paired with a `related` that
 *   changes with the branch, so its meaning is not a fixed offset either.
 *
 * Counting the remaining headers the pointer has passed answers all of those
 * cases with one physical → logical conversion, at the boundary, and drops
 * the incidental coupling to `targetMoveDistance`, which is module-global in
 * SortableJS and therefore writable by any other consumer on the page.
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
   * inline axis, so the pointer's physical `clientX` becomes a logical slot
   * only once this is known — see `_slotFor`.
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
  /** @private The header currently carrying the insertion bar, if any. */
  private _edgeHeader: HTMLElement | null = null;
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
      (column) => mlvTaskboardKeyToken(column.id) === attribute,
    );
    // A locked column is already excluded by `filter`; this is the guard for a
    // drag started before the lock reached the DOM.
    if (fromIndex < 0 || columns[fromIndex]?.locked === true) return;

    this._fromIndex = fromIndex;
    this._residue = captureMlvTaskboardDragResidue(item, event.from);
    const fallbackClone = Sortable.ghost;
    if (fallbackClone && fallbackClone !== item) {
      sanitizeMlvTaskboardClone(fallbackClone);
      // The clone lives on `<body>`, where none of the board's inherited
      // values reach it; it takes them from the element it was cloned from.
      adoptMlvTaskboardCloneStyle(fallbackClone, item);
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
    const clientX = mlvTaskboardPointerClientX(event);
    if (
      !host ||
      !row ||
      this._fromIndex < 0 ||
      event.to !== row ||
      clientX === null
    ) {
      this._applyPreview(null);
      return false;
    }
    const headers = mlvTaskboardChildrenOf(row, COLUMN_HEADER_CLASS);
    const dragged = this._residue?.item ?? event.dragged;
    const toIndex = this._slotFor(headers, dragged, clientX);
    const next = this._candidateOrder(host, this._fromIndex, toIndex);
    this._applyPreview(next);
    // A refused order shows no accept affordance — the row's `invalid` drop
    // state is the whole feedback there.
    this._applyEdge(
      next === null
        ? null
        : this._edgeFor(
            headers.filter((header) => header !== dragged),
            toIndex,
          ),
    );
    return false;
  }

  /** Ends a drag: cleans SortableJS residue, then commits the last order. */
  end(event: Sortable.SortableEvent): void {
    const host = this._host;
    const next = this._next;
    const cancelled = this._cancelled;
    restoreMlvTaskboardDragResidue(this._residue, event.item);
    this._applyPreview(null);
    this._applyEdge(null);
    this._endDrag();
    if (!host || cancelled || next === null) return;
    host.reorderColumns(next);
  }

  /** Destroys the registered instance and releases the live drag state. */
  destroy(): void {
    this._host = null;
    this._applyPreview(null);
    this._applyEdge(null);
    this._endDrag();
    this._dragEnd.complete();
    this._row = null;
    this._sortable?.destroy();
    this._sortable = null;
  }

  /**
   * @private The slot the pointer names among the header row's *remaining*
   * columns — the count of rendered headers, the dragged one excluded, whose
   * inline midpoint the pointer has already passed.
   *
   * That count is the target index directly: `_candidateOrder` splices the
   * moved column out first, so it inserts into a list of exactly these
   * headers. It answers a pointer over a sibling header, over free space at
   * either end, and over the dragged column's own header (which yields the
   * source index, and so no move) with one expression.
   *
   * `getBoundingClientRect()` is physical, so the comparison — and only the
   * comparison — flips with the direction: "already passed" is a midpoint to
   * the pointer's left in LTR and to its right in RTL. Rects are read fresh
   * every move; autoscroll shifts them under a stationary pointer.
   */
  private _slotFor(
    headers: readonly HTMLElement[],
    dragged: HTMLElement,
    clientX: number,
  ): number {
    const rtl = this._direction() === 'rtl';
    let slot = 0;
    for (const header of headers) {
      if (header === dragged) continue;
      const rect = header.getBoundingClientRect();
      const middle = (rect.left + rect.right) / 2;
      if (rtl ? middle > clientX : middle < clientX) slot++;
    }
    return slot;
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

  /**
   * @private The header and inline edge the insertion bar belongs on for a
   * landing at `toIndex` among the row's *remaining* headers — the same list
   * `_slotFor` counts and `_candidateOrder` splices into, so the bar and the
   * order it previews can never disagree.
   *
   * The side is logical: `'start'` mirrors to the physical right edge under
   * `[dir="rtl"]` through `inset-inline-start`, with no second conversion here.
   */
  private _edgeFor(
    rest: readonly HTMLElement[],
    toIndex: number,
  ): { readonly header: HTMLElement; readonly side: 'start' | 'end' } | null {
    const before = rest[toIndex];
    if (before !== undefined) return { header: before, side: 'start' };
    const last = rest[rest.length - 1];
    return last === undefined ? null : { header: last, side: 'end' };
  }

  /** @private Moves the insertion bar to one header edge, or removes it. */
  private _applyEdge(
    edge: {
      readonly header: HTMLElement;
      readonly side: 'start' | 'end';
    } | null,
  ): void {
    if (this._edgeHeader !== null && this._edgeHeader !== edge?.header) {
      this._edgeHeader.removeAttribute(MLV_TASKBOARD_DROP_EDGE_ATTRIBUTE);
    }
    this._edgeHeader = edge?.header ?? null;
    edge?.header.setAttribute(MLV_TASKBOARD_DROP_EDGE_ATTRIBUTE, edge.side);
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
    this._applyEdge(null);
    this._dragEnd.next();
  }
}
