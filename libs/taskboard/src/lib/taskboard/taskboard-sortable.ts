import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, InjectionToken, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, filter, fromEvent, takeUntil } from 'rxjs';
import Sortable from 'sortablejs';
import {
  createMlvTaskboardDragSession,
  type MlvTaskboardDragSession,
} from '../taskboard-drag-session';
import { sameMlvTaskboardKey } from '../taskboard-keys';
import type {
  MlvTaskboardState,
  MlvTaskboardKey,
  MlvTaskboardMoveCancelReason,
  MlvTaskboardMoveRequest,
} from '../taskboard.types';
import {
  mlvTaskboardBucketIndex,
  type MlvTaskboardVirtualWindow,
} from './taskboard-virtual';
import {
  adoptMlvTaskboardCloneStyle,
  MLV_TASKBOARD_CARD_ID_ATTRIBUTE,
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

/** BEM class of a rendered card element, and the only draggable selector. */
const CARD_CLASS = 'mlv-taskboard__card';
/** Prefix of the per-board SortableJS group every card container joins. */
const CARDS_GROUP_PREFIX = 'mlv-taskboard-cards';
/**
 * Elements that must keep their own pointer semantics inside a card. The card
 * root itself is a `button` in the default rendering, so the interactive
 * selectors deliberately exclude it.
 */
const DRAG_FILTER = [
  `input:not(.${CARD_CLASS})`,
  'textarea',
  'select',
  'label',
  `button:not(.${CARD_CLASS})`,
  'a[href]',
  '[contenteditable="true"]',
  '[data-mlv-taskboard-no-drag]',
].join(', ');

/** A canonical column, optionally narrowed to one swimlane. */
export interface MlvTaskboardBucket {
  readonly columnId: MlvTaskboardKey;
  readonly swimlaneId: MlvTaskboardKey | undefined;
}

/** The slot a live pointer drag would drop into if released right now. */
export interface MlvTaskboardDropPreview<TItem> {
  readonly columnId: MlvTaskboardKey;
  readonly swimlaneId: MlvTaskboardKey | undefined;
  /** Position among the bucket's rendered cards with the dragged card removed. */
  readonly index: number;
  /** The dragged card, excluded when the board resolves the indicator anchor. */
  readonly itemId: MlvTaskboardKey;
  /** Whether the drag session authorised this exact slot. */
  readonly allowed: boolean;
  /** Whether the slot is the one the dragged card already occupies. */
  readonly isSourceSlot: boolean;
  /** The frozen, session-authorised request this slot would commit. */
  readonly request: MlvTaskboardMoveRequest<TItem> | undefined;
}

/**
 * Whether two previews name the same slot with the same verdict.
 *
 * Every field is compared: the scalars by value, and `request` by identity,
 * because a session memoizes one frozen request per authorised slot and hands
 * back that same object every time the slot is asked for.
 */
function sameMlvTaskboardDropPreview<TItem>(
  a: MlvTaskboardDropPreview<TItem> | null,
  b: MlvTaskboardDropPreview<TItem> | null,
): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  return (
    sameMlvTaskboardKey(a.columnId, b.columnId) &&
    sameMlvTaskboardKey(a.swimlaneId, b.swimlaneId) &&
    a.index === b.index &&
    sameMlvTaskboardKey(a.itemId, b.itemId) &&
    a.allowed === b.allowed &&
    a.isSourceSlot === b.isSourceSlot &&
    a.request === b.request
  );
}

/** Board-owned services the adapter needs while a pointer drag is live. */
export interface MlvTaskboardSortableHost<TItem> {
  /** The current controlled board snapshot a drag session is built from. */
  sessionBoard(): MlvTaskboardState<TItem>;
  /** Resolves a card element's data attribute back to its canonical key. */
  cardIdFor(attribute: string): MlvTaskboardKey | undefined;
  /** Resolves a registered container element to its canonical bucket. */
  bucketOf(element: HTMLElement): MlvTaskboardBucket | undefined;
  /** Publishes the live preview slot so the board can render its indicator. */
  setDropPreview(preview: MlvTaskboardDropPreview<TItem> | null): void;
  /** Runs the guarded commit flow for a released, authorised slot. */
  commitMove(request: MlvTaskboardMoveRequest<TItem>): void;
  /** Reports a drag that ended without producing a replacement collection. */
  cancelMove(
    reason: MlvTaskboardMoveCancelReason,
    request?: MlvTaskboardMoveRequest<TItem>,
  ): void;
}

/** Registration surface the board's private cards-host directive consumes. */
export interface MlvTaskboardCardsRegistry {
  /**
   * Registers one card container. A virtualized cell also supplies the window
   * of cards it currently has in the DOM, because a slot read back from the
   * DOM then counts only that window and not the whole bucket.
   */
  registerBucket(
    element: HTMLElement,
    virtualWindow?: () => MlvTaskboardVirtualWindow,
  ): void;
  unregisterBucket(element: HTMLElement): void;
}

/**
 * Token the board provides so its package-private cards-host directive can
 * register a container without importing the component (and its template).
 */
export const MLV_TASKBOARD_CARDS_REGISTRY =
  new InjectionToken<MlvTaskboardCardsRegistry>('MLV_TASKBOARD_CARDS_REGISTRY');

/**
 * Package-private SortableJS adapter for pointer and touch card sorting.
 *
 * SortableJS never reorders the board's DOM: `onMove` always returns `false`,
 * so the rendered card list stays owned by Angular and every accepted drop is
 * expressed as a Task 2 move request instead. The adapter is provided by
 * `MlvTaskboard` and is not part of the public barrel.
 *
 * Card containers stack on the **block axis**, which never mirrors, so this
 * adapter takes the hovered slot straight from SortableJS's `related` /
 * `willInsertAfter` answer through `mlvTaskboardInsertionIndex` — the physical
 * answer is the logical one in both directions. `MlvTaskboardColumnSortable`
 * is on the inline axis and cannot; it derives its slot from the pointer.
 */
@Injectable()
export class MlvTaskboardSortable<TItem> implements MlvTaskboardCardsRegistry {
  /** @private The injected document; never the ambient global (SSR-safe). */
  private readonly _document = inject(DOCUMENT);
  /** @private Ties every drag listener and instance to this board's lifetime. */
  private readonly _destroyRef = inject(DestroyRef);
  /** @private Live SortableJS instance per registered card container. */
  private readonly _instances = new Map<HTMLElement, Sortable>();
  /** @private Rendered-window accessor of each virtualized card container. */
  private readonly _virtualWindows = new Map<
    HTMLElement,
    () => MlvTaskboardVirtualWindow
  >();
  /** @private This board's own group, so a sibling board never accepts it. */
  private readonly _group = mlvTaskboardGroupName(CARDS_GROUP_PREFIX);
  /** @private Board callbacks, connected once by the owning component. */
  private _host: MlvTaskboardSortableHost<TItem> | null = null;
  /** @private Cached authorisation for the drag currently in flight. */
  private _session: MlvTaskboardDragSession<TItem> | null = null;
  /** @private Canonical key of the dragged card, `null` between drags. */
  private _draggedId: MlvTaskboardKey | null = null;
  /** @private The dragged card's pre-drag state, restored when the drag ends. */
  private _residue: MlvTaskboardDragResidue | null = null;
  /** @private The slot the drag would commit if released right now. */
  private _preview: MlvTaskboardDropPreview<TItem> | null = null;
  /** @private Container currently carrying the drop-state attribute. */
  private _dropStateElement: HTMLElement | null = null;
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
  connect(host: MlvTaskboardSortableHost<TItem>): void {
    this._host = host;
  }

  /** Creates the SortableJS instance for one rendered card container. */
  registerBucket(
    element: HTMLElement,
    virtualWindow?: () => MlvTaskboardVirtualWindow,
  ): void {
    if (this._instances.has(element)) return;
    if (virtualWindow !== undefined) {
      this._virtualWindows.set(element, virtualWindow);
    }
    const sortable = Sortable.create(element, this._sortableOptions());
    sortable.option('disabled', this._disabled);
    this._instances.set(element, sortable);
  }

  /** Destroys the SortableJS instance of a container leaving the DOM. */
  unregisterBucket(element: HTMLElement): void {
    const sortable = this._instances.get(element);
    if (!sortable) return;
    this._instances.delete(element);
    this._virtualWindows.delete(element);
    if (this._dropStateElement === element) this._dropStateElement = null;
    sortable.destroy();
  }

  /** Blocks or restores pointer dragging while a guarded move is pending. */
  setDragsDisabled(disabled: boolean): void {
    this._disabled = disabled;
    for (const sortable of this._instances.values()) {
      sortable.option('disabled', disabled);
    }
  }

  /** Begins a drag: caches the authorised targets and watches for Escape. */
  start(event: Sortable.SortableEvent): void {
    this._endDrag();
    const host = this._host;
    const item = event.item;
    const attribute = item.getAttribute(MLV_TASKBOARD_CARD_ID_ATTRIBUTE);
    const itemId =
      host && attribute !== null ? host.cardIdFor(attribute) : undefined;
    if (!host || itemId === undefined) return;

    const board = host.sessionBoard();
    let session: MlvTaskboardDragSession<TItem>;
    try {
      session = createMlvTaskboardDragSession(board, itemId, board.canDropFn);
    } catch {
      return;
    }

    this._session = session;
    this._draggedId = itemId;
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
   * Previews the hovered slot and always answers `false`, so SortableJS never
   * inserts the dragged node into the board's Angular-owned DOM.
   */
  move(event: Sortable.MoveEvent): false {
    const host = this._host;
    const session = this._session;
    const itemId = this._draggedId;
    const container = event.to;
    if (
      !host ||
      !session ||
      itemId === null ||
      !this._instances.has(container)
    ) {
      this._applyPreview(null, null);
      return false;
    }
    const bucket = host.bucketOf(container);
    if (!bucket) {
      this._applyPreview(null, null);
      return false;
    }

    const cards = mlvTaskboardChildrenOf(container, CARD_CLASS);
    const domIndex = mlvTaskboardInsertionIndex(event, cards);
    const sourcePosition =
      this._residue === null ? -1 : cards.indexOf(this._residue.item);
    // Sortable reports a slot among the rendered cards, which still include the
    // dragged card in its own bucket; a board index excludes it. A virtualized
    // cell renders only a window of its bucket, so the slot is then offset by
    // where that window starts.
    const index = mlvTaskboardBucketIndex(
      sourcePosition >= 0 && domIndex > sourcePosition
        ? domIndex - 1
        : domIndex,
      this._virtualWindows.get(container)?.() ?? null,
    );
    const request = session.requestFor(
      bucket.columnId,
      bucket.swimlaneId,
      index,
    );
    this._applyPreview(
      {
        columnId: bucket.columnId,
        swimlaneId: bucket.swimlaneId,
        index,
        itemId,
        allowed: request !== undefined,
        isSourceSlot:
          sameMlvTaskboardKey(bucket.columnId, session.card.source.columnId) &&
          sameMlvTaskboardKey(
            bucket.swimlaneId,
            session.card.source.swimlaneId,
          ) &&
          index === session.card.source.index,
        request,
      },
      container,
    );
    return false;
  }

  /** Ends a drag: cleans SortableJS residue, then commits or cancels. */
  end(event: Sortable.SortableEvent): void {
    const host = this._host;
    const session = this._session;
    const preview = this._preview;
    const cancelled = this._cancelled;
    restoreMlvTaskboardDragResidue(this._residue, event.item);
    this._applyPreview(null, null);
    this._endDrag();
    if (!host || !session) return;
    if (cancelled) {
      host.cancelMove('cancelled');
      return;
    }
    if (preview?.isSourceSlot) return;
    if (preview?.request) {
      host.commitMove(preview.request);
      return;
    }
    host.cancelMove('invalid-drop');
  }

  /** Destroys every registered instance and releases the live drag state. */
  destroy(): void {
    this._host = null;
    this._applyPreview(null, null);
    this._endDrag();
    this._dragEnd.complete();
    for (const sortable of this._instances.values()) sortable.destroy();
    this._instances.clear();
  }

  /** @private Shared options for every registered card container. */
  private _sortableOptions(): Sortable.Options {
    return {
      ...mlvTaskboardSortableBaseOptions(),
      group: { name: this._group, pull: true, put: true },
      draggable: `.${CARD_CLASS}`,
      filter: DRAG_FILTER,
      onClone: (event) => sanitizeMlvTaskboardClone(event.clone),
      onStart: (event) => this.start(event),
      onMove: (event) => this.move(event),
      onEnd: (event) => this.end(event),
    };
  }

  /**
   * @private Moves the drop-state attribute onto the hovered container and
   * publishes the preview slot the board renders its indicator from.
   *
   * A pointer that travels inside one slot re-derives that same slot on every
   * `pointermove`, so an unchanged preview writes nothing: the attribute is
   * already on this container with this value, and publishing a fresh object
   * would notify the board's signal — and re-run the indicator — for a slot
   * that did not move.
   */
  private _applyPreview(
    preview: MlvTaskboardDropPreview<TItem> | null,
    container: HTMLElement | null,
  ): void {
    if (
      container === this._dropStateElement &&
      sameMlvTaskboardDropPreview(this._preview, preview)
    ) {
      return;
    }
    const previous = this._dropStateElement;
    if (previous && previous !== container) {
      previous.removeAttribute(MLV_TASKBOARD_DROP_STATE_ATTRIBUTE);
    }
    this._dropStateElement = container;
    container?.setAttribute(
      MLV_TASKBOARD_DROP_STATE_ATTRIBUTE,
      preview?.allowed === true ? 'valid' : 'invalid',
    );
    this._preview = preview;
    this._host?.setDropPreview(preview);
  }

  /** @private Releases the live drag's session, token, and listeners. */
  private _endDrag(): void {
    this._session = null;
    this._draggedId = null;
    this._residue = null;
    this._cancelled = false;
    this._dragEnd.next();
  }
}
