import type Sortable from 'sortablejs';

/** Data attribute carrying a rendered card's stable identifier. */
export const MLV_TASKBOARD_CARD_ID_ATTRIBUTE = 'data-mlv-taskboard-card-id';
/** Data attribute carrying a rendered element's column identifier. */
export const MLV_TASKBOARD_COLUMN_ID_ATTRIBUTE = 'data-mlv-taskboard-column-id';
/** Data attribute carrying a rendered element's swimlane identifier. */
export const MLV_TASKBOARD_SWIMLANE_ID_ATTRIBUTE =
  'data-mlv-taskboard-swimlane-id';
/** Data attribute marking a column header the pointer may never reorder. */
export const MLV_TASKBOARD_COLUMN_LOCKED_ATTRIBUTE =
  'data-mlv-taskboard-column-locked';
/** Data attribute reflecting whether the hovered container accepts the drag. */
export const MLV_TASKBOARD_DROP_STATE_ATTRIBUTE =
  'data-mlv-taskboard-drop-state';

/** Long-press delay applied to touch pointers only, in milliseconds. */
export const MLV_TASKBOARD_TOUCH_DELAY_MS = 150;

/** Class SortableJS writes on the element the pointer picked up. */
export const MLV_TASKBOARD_CHOSEN_CLASS = 'mlv-taskboard__sortable-chosen';
/** Class SortableJS writes on the element being dragged. */
export const MLV_TASKBOARD_DRAG_CLASS = 'mlv-taskboard__sortable-drag';
/** Class SortableJS writes on the placeholder left behind while dragging. */
export const MLV_TASKBOARD_GHOST_CLASS = 'mlv-taskboard__sortable-ghost';
/** Class SortableJS writes on the fallback clone that follows the pointer. */
export const MLV_TASKBOARD_FALLBACK_CLASS = 'mlv-taskboard__sortable-fallback';

/**
 * Options both taskboard adapters share.
 *
 * `forceFallback` keeps the drag off the native HTML5 drag-and-drop engine, so
 * touch pointers and desktop pointers follow one code path, and the long-press
 * delay applies to touch only so a mouse drag starts immediately.
 */
export function mlvTaskboardSortableBaseOptions(): Sortable.Options {
  return {
    preventOnFilter: false,
    forceFallback: true,
    fallbackOnBody: true,
    fallbackTolerance: 0,
    delay: MLV_TASKBOARD_TOUCH_DELAY_MS,
    delayOnTouchOnly: true,
    removeCloneOnHide: true,
    disabled: false,
    animation: 0,
    chosenClass: MLV_TASKBOARD_CHOSEN_CLASS,
    dragClass: MLV_TASKBOARD_DRAG_CLASS,
    ghostClass: MLV_TASKBOARD_GHOST_CLASS,
    fallbackClass: MLV_TASKBOARD_FALLBACK_CLASS,
  };
}

/** Distinguishes the groups of every adapter instance created in one page. */
let groupSequence = 0;

/**
 * A SortableJS group name private to one adapter instance.
 *
 * SortableJS matches containers by group name alone, so a name shared across
 * boards would let each board `put` the other's dragged element: the receiving
 * board has no drag session for it, the drop is refused, and the source board
 * reports a spurious `invalid-drop` cancellation. One suffix per adapter keeps
 * every board's containers connected only to each other.
 */
export function mlvTaskboardGroupName(prefix: string): string {
  return `${prefix}-${++groupSequence}`;
}

/**
 * Removes a transient SortableJS clone from the accessibility tree and stops a
 * consumer entrance animation from owning the clone's `transform`.
 */
export function sanitizeMlvTaskboardClone(clone: HTMLElement): void {
  clone.setAttribute('aria-hidden', 'true');
  clone.setAttribute('inert', '');
  clone.removeAttribute('id');
  for (const element of clone.querySelectorAll('[id]')) {
    element.removeAttribute('id');
  }
  clone.style.animation = 'none';
}

/** The pre-drag state of one dragged element, captured so it can be restored. */
export interface MlvTaskboardDragResidue {
  /** The element the pointer picked up. */
  readonly item: HTMLElement;
  /** The Angular-owned container the element belongs to. */
  readonly source: HTMLElement;
  /** The sibling the element preceded, used for a defensive re-insertion. */
  readonly nextSibling: Element | null;
  /** The element's inline style before SortableJS wrote one. */
  readonly style: string | null;
  /** The element's `draggable` attribute before the drag. */
  readonly draggable: string | null;
}

/** Captures the pre-drag state a later restore returns the element to. */
export function captureMlvTaskboardDragResidue(
  item: HTMLElement,
  source: HTMLElement,
): MlvTaskboardDragResidue {
  return {
    item,
    source,
    nextSibling: item.nextElementSibling,
    style: item.getAttribute('style'),
    draggable: item.getAttribute('draggable'),
  };
}

/**
 * Strips the classes and inline geometry SortableJS wrote on a dragged element
 * and returns the node to its Angular-owned container if the engine relocated
 * it despite an `onMove` guard that always answers `false`.
 *
 * `fallbackItem` covers a drag that ended without a captured residue — the
 * classes are still removed, but no re-insertion is attempted.
 */
export function restoreMlvTaskboardDragResidue(
  residue: MlvTaskboardDragResidue | null,
  fallbackItem: HTMLElement | undefined,
): void {
  const item = residue?.item ?? fallbackItem;
  if (!item) return;
  item.classList.remove(
    MLV_TASKBOARD_CHOSEN_CLASS,
    MLV_TASKBOARD_DRAG_CLASS,
    MLV_TASKBOARD_GHOST_CLASS,
    MLV_TASKBOARD_FALLBACK_CLASS,
  );
  if (!residue) return;
  restoreMlvTaskboardAttribute(item, 'style', residue.style);
  restoreMlvTaskboardAttribute(item, 'draggable', residue.draggable);
  const source = residue.source;
  if (!item.isConnected || item.parentElement === source) return;
  const sibling = residue.nextSibling;
  if (sibling && sibling.parentNode === source)
    source.insertBefore(item, sibling);
  else source.appendChild(item);
}

/** Restores one attribute to its pre-drag value, or removes it. */
function restoreMlvTaskboardAttribute(
  element: HTMLElement,
  name: string,
  value: string | null,
): void {
  if (value === null) element.removeAttribute(name);
  else element.setAttribute(name, value);
}

/**
 * The direct children of a container carrying one class, in document order.
 *
 * SortableJS only starts drags from direct children, so a deeper query would
 * report positions the engine never reports back.
 */
export function mlvTaskboardChildrenOf(
  container: HTMLElement,
  className: string,
): HTMLElement[] {
  return Array.from(container.children).filter(
    (child): child is HTMLElement =>
      child instanceof HTMLElement && child.classList.contains(className),
  );
}

/**
 * The slot among a **block-axis** container's draggable children the pointer
 * hovers, taken from SortableJS's own `related` / `willInsertAfter` answer.
 *
 * `related` is not always one of those children: SortableJS's insert-at-end
 * branch reports the container itself, with `willInsertAfter` set, whenever
 * the pointer sits over a direct child that does not match `draggable` (the
 * live drop indicator is one). That payload means the tail slot, not the
 * first — an empty container collapses the two anyway.
 *
 * Only the card containers use this. They stack on the block axis, which never
 * mirrors, so SortableJS's physically-derived answer *is* the logical slot in
 * both directions. The column header row lays out on the inline axis and
 * cannot use this at all — `willInsertAfter` mixes a DOM-order answer (the
 * regular swap branch) with two physically-derived ones (`_ghostIsFirst` /
 * `_ghostIsLast`), so no single mirroring recovers a logical slot from it.
 * `MlvTaskboardColumnSortable` derives its slot from the pointer instead.
 */
export function mlvTaskboardInsertionIndex(
  event: Sortable.MoveEvent,
  children: readonly HTMLElement[],
): number {
  const insertAfter = event.willInsertAfter === true;
  const related: HTMLElement | null = event.related ?? null;
  const position = related === null ? -1 : children.indexOf(related);
  if (position < 0) return insertAfter ? children.length : 0;
  return insertAfter ? position + 1 : position;
}
