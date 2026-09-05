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

/** Data attribute carrying a rendered card's stable identifier. */
export const MLV_TASKBOARD_CARD_ID_ATTRIBUTE = 'data-mlv-taskboard-card-id';
/** Data attribute carrying a rendered element's column identifier. */
export const MLV_TASKBOARD_COLUMN_ID_ATTRIBUTE = 'data-mlv-taskboard-column-id';
/** Data attribute carrying a rendered element's swimlane identifier. */
export const MLV_TASKBOARD_SWIMLANE_ID_ATTRIBUTE =
  'data-mlv-taskboard-swimlane-id';
/** Data attribute reflecting whether the hovered container accepts the card. */
export const MLV_TASKBOARD_DROP_STATE_ATTRIBUTE =
  'data-mlv-taskboard-drop-state';

/** BEM class of a rendered card element, and the only draggable selector. */
const CARD_CLASS = 'mlv-taskboard__card';
/** Private SortableJS group shared by every registered card container. */
const CARDS_GROUP = 'mlv-taskboard-cards';
/** Long-press delay applied to touch pointers only, in milliseconds. */
const TOUCH_DELAY_MS = 150;
/** Classes SortableJS writes on the dragged card for the drag's lifetime. */
const CHOSEN_CLASS = 'mlv-taskboard__sortable-chosen';
const DRAG_CLASS = 'mlv-taskboard__sortable-drag';
const GHOST_CLASS = 'mlv-taskboard__sortable-ghost';
const FALLBACK_CLASS = 'mlv-taskboard__sortable-fallback';
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
  registerBucket(element: HTMLElement): void;
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
 */
@Injectable()
export class MlvTaskboardSortable<TItem> implements MlvTaskboardCardsRegistry {
  /** @private The injected document; never the ambient global (SSR-safe). */
  private readonly _document = inject(DOCUMENT);
  /** @private Ties every drag listener and instance to this board's lifetime. */
  private readonly _destroyRef = inject(DestroyRef);
  /** @private Live SortableJS instance per registered card container. */
  private readonly _instances = new Map<HTMLElement, Sortable>();
  /** @private Board callbacks, connected once by the owning component. */
  private _host: MlvTaskboardSortableHost<TItem> | null = null;
  /** @private Cached authorisation for the drag currently in flight. */
  private _session: MlvTaskboardDragSession<TItem> | null = null;
  /** @private Canonical key of the dragged card, `null` between drags. */
  private _draggedId: MlvTaskboardKey | null = null;
  /** @private The dragged element, kept so residue can be cleaned on drop. */
  private _dragItem: HTMLElement | null = null;
  /** @private The container the drag started in, used to restore the node. */
  private _sourceElement: HTMLElement | null = null;
  /** @private The dragged element's original sibling, for a defensive restore. */
  private _nextSibling: Element | null = null;
  /** @private The dragged element's inline style before SortableJS wrote one. */
  private _originalStyle: string | null = null;
  /** @private The dragged element's `draggable` attribute before the drag. */
  private _originalDraggable: string | null = null;
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
  registerBucket(element: HTMLElement): void {
    if (this._instances.has(element)) return;
    const sortable = Sortable.create(element, this._sortableOptions());
    sortable.option('disabled', this._disabled);
    this._instances.set(element, sortable);
  }

  /** Destroys the SortableJS instance of a container leaving the DOM. */
  unregisterBucket(element: HTMLElement): void {
    const sortable = this._instances.get(element);
    if (!sortable) return;
    this._instances.delete(element);
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
    this._dragItem = item;
    this._sourceElement = event.from;
    this._nextSibling = item.nextElementSibling;
    this._originalStyle = item.getAttribute('style');
    this._originalDraggable = item.getAttribute('draggable');
    const fallbackClone = Sortable.ghost;
    if (fallbackClone && fallbackClone !== item) {
      this._sanitizeClone(fallbackClone);
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

    const cards = this._cardsIn(container);
    const domIndex = this._insertionIndex(event, cards);
    const sourcePosition =
      this._dragItem === null ? -1 : cards.indexOf(this._dragItem);
    // Sortable reports a slot among the rendered cards, which still include the
    // dragged card in its own bucket; a board index excludes it.
    const index =
      sourcePosition >= 0 && domIndex > sourcePosition
        ? domIndex - 1
        : domIndex;
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
    this._restoreDraggedItem(event);
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
      group: { name: CARDS_GROUP, pull: true, put: true },
      draggable: `.${CARD_CLASS}`,
      filter: DRAG_FILTER,
      preventOnFilter: false,
      forceFallback: true,
      fallbackOnBody: true,
      fallbackTolerance: 0,
      delay: TOUCH_DELAY_MS,
      delayOnTouchOnly: true,
      removeCloneOnHide: true,
      disabled: false,
      animation: 0,
      chosenClass: CHOSEN_CLASS,
      dragClass: DRAG_CLASS,
      ghostClass: GHOST_CLASS,
      fallbackClass: FALLBACK_CLASS,
      onClone: (event) => this._sanitizeClone(event.clone),
      onStart: (event) => this.start(event),
      onMove: (event) => this.move(event),
      onEnd: (event) => this.end(event),
    };
  }

  /**
   * @private Removes a transient clone from the accessibility tree and stops a
   * consumer entrance animation from owning the clone's `transform`.
   */
  private _sanitizeClone(clone: HTMLElement): void {
    clone.setAttribute('aria-hidden', 'true');
    clone.setAttribute('inert', '');
    clone.removeAttribute('id');
    for (const element of clone.querySelectorAll('[id]')) {
      element.removeAttribute('id');
    }
    clone.style.animation = 'none';
  }

  /** @private The rendered card elements of a container, in document order. */
  private _cardsIn(container: HTMLElement): HTMLElement[] {
    return Array.from(container.children).filter(
      (child): child is HTMLElement =>
        child instanceof HTMLElement && child.classList.contains(CARD_CLASS),
    );
  }

  /** @private Slot among a container's rendered cards the pointer hovers. */
  private _insertionIndex(
    event: Sortable.MoveEvent,
    cards: readonly HTMLElement[],
  ): number {
    const related: HTMLElement | null = event.related ?? null;
    const position = related === null ? -1 : cards.indexOf(related);
    if (position < 0) return 0;
    return event.willInsertAfter === true ? position + 1 : position;
  }

  /**
   * @private Moves the drop-state attribute onto the hovered container and
   * publishes the preview slot the board renders its indicator from.
   */
  private _applyPreview(
    preview: MlvTaskboardDropPreview<TItem> | null,
    container: HTMLElement | null,
  ): void {
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

  /**
   * @private Strips the classes and inline geometry SortableJS wrote on the
   * dragged card, and returns the node to Angular's container if the engine
   * relocated it despite the `onMove` guard.
   */
  private _restoreDraggedItem(event: Sortable.SortableEvent): void {
    const item = this._dragItem ?? event.item;
    const source = this._sourceElement;
    if (item) {
      item.classList.remove(
        CHOSEN_CLASS,
        DRAG_CLASS,
        GHOST_CLASS,
        FALLBACK_CLASS,
      );
      this._restoreAttribute(item, 'style', this._originalStyle);
      this._restoreAttribute(item, 'draggable', this._originalDraggable);
      if (source && item.isConnected && item.parentElement !== source) {
        const sibling = this._nextSibling;
        if (sibling && sibling.parentNode === source) {
          source.insertBefore(item, sibling);
        } else {
          source.appendChild(item);
        }
      }
    }
    this._dragItem = null;
    this._sourceElement = null;
    this._nextSibling = null;
    this._originalStyle = null;
    this._originalDraggable = null;
  }

  /** @private Restores an attribute to its pre-drag value, or removes it. */
  private _restoreAttribute(
    element: HTMLElement,
    name: string,
    value: string | null,
  ): void {
    if (value === null) element.removeAttribute(name);
    else element.setAttribute(name, value);
  }

  /** @private Releases the live drag's session, token, and listeners. */
  private _endDrag(): void {
    this._session = null;
    this._draggedId = null;
    this._cancelled = false;
    this._dragEnd.next();
  }
}
