import { Extension } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { EditorState } from '@tiptap/pm/state';
import {
  NodeSelection,
  Plugin,
  PluginKey,
  TextSelection,
} from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import {
  mlvEditorCollaborationBindingFor,
  mlvEditorIsRemoteEdit,
} from '../editor/editor-collaboration.contract';
import {
  trackMlvEditorPosition,
  type MlvEditorTrackedPosition,
} from './editor-position-tracker';

/** A completed block move, reported so the host can announce it. */
export interface MlvEditorBlockMove {
  /** ProseMirror node type name of the moved block, untranslated. */
  readonly type: string;

  /** One-based position the block now occupies among the blocks counted by `total`. */
  readonly position: number;

  /**
   * Top-level block count of the document the move was computed against, i.e.
   * **before** the move — the same snapshot `position` is derived from. Reading
   * it after the move instead would announce schema-maintained artifacts the
   * user never authored: `trailingNode` appends an empty paragraph whenever the
   * last block is not a textblock, so moving a horizontal rule to the end would
   * otherwise report "3 of 4".
   */
  readonly total: number;
}

/** Host-supplied capabilities for the block drag handle. */
export interface MlvEditorBlockHandleOptions {
  /**
   * Container the floating handle is appended to. Must be the layer carrying the
   * editor zoom (CSS `zoom`) so the handle shares its coordinate space.
   */
  readonly mount: () => HTMLElement | null;

  /** Accessible label for the handle, read live so locale changes apply. */
  readonly label: () => string;

  /** Receives every completed move; the host formats and announces it. */
  readonly announceMove: (move: MlvEditorBlockMove) => void;

  /** Whether block moving is currently permitted; false while readonly or disabled. */
  readonly enabled: () => boolean;

  /**
   * Called when a peer's edit cancels an in-progress drag (collaboration only):
   * the dragged block was deleted or changed. The host announces it. A peer's
   * edit that leaves the block intact keeps the drag, re-measured.
   */
  readonly announceCollaborationCancel?: () => void;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mlvEditorBlockHandle: {
      /**
       * Moves one top-level block. Both indices address the document as it stands
       * **before** the move, so moving index 0 to index 2 of three blocks yields
       * the order `[1, 2, 0]`.
       */
      moveBlock: (options: { from: number; to: number }) => ReturnType;

      /** Moves the top-level block containing the selection one position earlier. */
      moveBlockUp: () => ReturnType;

      /** Moves the top-level block containing the selection one position later. */
      moveBlockDown: () => ReturnType;
    };
  }
}

/** @internal Class of the floating drop indicator. */
const MLV_EDITOR_DROP_INDICATOR_CLASS = 'mlv-editor__drop-indicator';

/** @internal Class of the off-screen wrapper handed to `setDragImage`. */
const MLV_EDITOR_DRAG_GHOST_CLASS = 'mlv-editor__drag-ghost';

/**
 * @internal Marks the block currently on the cursor, dimmed in place. Applied
 * as a node decoration, never written onto the element — see
 * `MLV_EDITOR_DRAG_SOURCE_KEY`.
 */
const MLV_EDITOR_DRAG_SOURCE_CLASS = 'mlv-editor__block--dragging';

/**
 * @internal Plugin state holding the dimmed source's node decoration: empty
 * while no block drag is in flight, one `Decoration.node` while one is.
 *
 * The dim has to travel through ProseMirror's own render path because nothing
 * written directly onto a block's element survives a drag. ProseMirror's
 * `DOMObserver` treats an attribute mutation on any node it rendered — a class,
 * an inline style — as an external DOM change, marks that node dirty and
 * redraws it, **replacing** the element. Measured in Chromium, 22 of 25
 * top-level elements were replaced by the first `dragover`: the dim class and
 * the old partition's transforms all ended up on detached nodes, so none of it
 * was ever visible. A decoration is part of the view description instead, so a
 * redraw re-applies it rather than discarding it.
 */
const MLV_EDITOR_DRAG_SOURCE_KEY = new PluginKey<DecorationSet>(
  'mlvEditorBlockDragSource',
);

/**
 * @internal Whether `node` is still the block snapshotted at `dragstart`
 * (F-D14): the same `blockId` when the block carries one, else the same type
 * and content.
 */
function sameBlock(node: ProseMirrorNode, expected: ProseMirrorNode): boolean {
  const id = expected.attrs['blockId'];
  if (typeof id === 'string' && id !== '') return node.attrs['blockId'] === id;
  return node.type === expected.type && node.eq(expected);
}

/**
 * @internal Clears a source dim a freshly built plugin view inherited rather
 * than published.
 *
 * Plugin state outlives the plugin view. `EditorState.reconfigure` — what
 * Tiptap's `registerPlugin` / `unregisterPlugin` call, e.g. when an AI stream
 * or suggestion session settles — keeps every state field but destroys and
 * rebuilds every plugin view. A reconfigure mid-drag therefore takes the view
 * that owned the drag, and its `dragend` listener, while the dim stays in
 * state; the replacing view never saw the drag, so without this the block
 * would stay dimmed until the next document change.
 *
 * Deferred to a microtask because this runs from the view factory, inside
 * ProseMirror's `updatePluginViews`, where a dispatch would re-enter
 * `updateState` while the views are still being built. The old view's
 * `destroy` cannot clear it either: it runs inside that same update, or inside
 * `EditorView.destroy()` before `isDestroyed` turns true. Every other teardown
 * discards the state (a destroyed editor) or the field (the plugin removed)
 * along with the dim. The clear only drops the exact set inherited, so it can
 * never undo a newer drag's dim.
 */
function clearInheritedDragSource(view: EditorView): void {
  const inherited = MLV_EDITOR_DRAG_SOURCE_KEY.getState(view.state);
  if (inherited === undefined || inherited === DecorationSet.empty) return;
  queueMicrotask(() => {
    if (view.isDestroyed) return;
    if (MLV_EDITOR_DRAG_SOURCE_KEY.getState(view.state) !== inherited) return;
    view.dispatch(
      view.state.tr.setMeta(MLV_EDITOR_DRAG_SOURCE_KEY, DecorationSet.empty),
    );
  });
}

/** @internal Duration of the post-drop settle, matching `--mlv-duration-normal`. */
const MLV_EDITOR_SETTLE_DURATION = 200;

/** @internal Sub-pixel movement not worth animating after a drop. */
const MLV_EDITOR_SETTLE_EPSILON = 0.5;

/** @internal Document position where the given top-level child begins. */
function childStart(doc: ProseMirrorNode, index: number): number {
  let position = 0;
  for (let i = 0; i < index; i += 1) {
    position += doc.child(i).nodeSize;
  }
  return position;
}

/**
 * @internal Document position `moveBlock({ from, to })` inserts at, expressed
 * against the document as it stands **before** the move.
 *
 * Shared by the command and the drop indicator so the line the user sees can
 * never point at a gap other than the one the drop actually uses.
 */
function insertAnchor(doc: ProseMirrorNode, from: number, to: number): number {
  return to > from
    ? childStart(doc, to) + doc.child(to).nodeSize
    : childStart(doc, to);
}

/**
 * @internal The mount layer's frame: the viewport y its box starts at, and its
 * live scale — both from **one** `getBoundingClientRect()`.
 *
 * Every caller needs the pair, and reading them separately meant two rect reads
 * per pointer event for one box. The scale is measured rather than taken from
 * `--mlv-editor-zoom` so the conversion stays right if anything else ever
 * transforms this layer.
 */
interface MlvEditorMountFrame {
  /** Viewport y of the mount's own box, in scaled screen pixels. */
  readonly top: number;

  /** `rect.width / offsetWidth`, or 1 when the layer has no measurable width. */
  readonly scale: number;
}

/** @internal Measures the mount layer's frame from a single rect read. */
function mountFrame(mount: HTMLElement): MlvEditorMountFrame {
  const rect = mount.getBoundingClientRect();
  const width = mount.offsetWidth;
  const scale = width && rect.width > 0 ? rect.width / width : 1;
  return { top: rect.top, scale };
}

/**
 * @internal A top-level block resolved from a pointer position.
 *
 * The coordinate space is the caller's: `blockAtPoint` produces viewport-space
 * boxes in scaled pixels, `snapshotBlocks` produces mount-relative boxes in the
 * layer's unscaled space. `dropTargetIndex` only compares a y against this
 * box's own midpoint, so it serves both — provided the caller passes a y from
 * the same space it took the box from.
 */
interface MlvEditorBlockHit {
  /** Top-level child index of the resolved block. */
  readonly index: number;

  /** Top edge of the block's rendered box. */
  readonly top: number;

  /**
   * Bottom edge of the same box. Read from the rect the producer already
   * measured, so deciding which of the block's two edges a drop belongs to
   * costs no second layout read.
   */
  readonly bottom: number;
}

/**
 * @internal Top-level child index for one rendered child of the editor DOM, or
 * null when that child is not a top-level node at all.
 *
 * Indexing `view.dom.children` positionally would not do: widget decorations
 * are rendered children that own no document node, so the two sequences do not
 * line up. This library alone puts three of them at the top level — the drop
 * indicator below, `MlvEditorUploadPlaceholder`'s pending image, and
 * StarterKit's gap cursor — and any future block-level decoration joins them.
 *
 * `posAtDOM` on its own does not discriminate either, which is the whole
 * difficulty: a widget anchored in a top-level gap maps to a perfectly valid
 * index — the one belonging to the block it sits beside. So the resolved index
 * is handed back to `nodeDOM`, and only the element ProseMirror actually
 * rendered *for* that child may claim it. Containment rather than identity,
 * because an outer node decoration wraps a node's own DOM in another element.
 */
function topLevelIndexOfDom(view: EditorView, element: Element): number | null {
  let position: number;
  try {
    position = view.posAtDOM(element, 0);
  } catch {
    // `posAtDOM` throws for DOM the editor view does not own. A foreign child
    // must not take a pointer handler down with it.
    return null;
  }
  const doc = view.state.doc;
  const index = doc.resolve(position).index(0);
  if (index >= doc.childCount) return null;
  return element.contains(view.nodeDOM(childStart(doc, index))) ? index : null;
}

/**
 * @internal The hit one rendered child stands for, or null when that child is
 * not a top-level block.
 *
 * A widget decoration owns no top-level node, and its box is a sliver rather
 * than a block's. Letting one stand in for a block would pair a neighbouring
 * block's index with the widget's geometry, so `dropTargetIndex` would take
 * that block's midpoint from the wrong box and land the drop on the wrong side
 * of it — silently, in one undo step. `topLevelIndexOfDom` answering null is
 * what makes that a *category* rejection rather than a class-name test, so a
 * block-level decoration added later is covered without touching this file.
 *
 * Both edges come off one rect read, so nothing can pair a `top` from one
 * layout with a `bottom` from another.
 */
function blockHit(
  view: EditorView,
  element: Element,
): MlvEditorBlockHit | null {
  const index = topLevelIndexOfDom(view, element);
  if (index === null) return null;
  const rect = element.getBoundingClientRect();
  return { index, top: rect.top, bottom: rect.bottom };
}

/**
 * @internal One rendered child at or before `from` — but never before `floor` —
 * that is a top-level block, paired with its own child index. Null when that
 * span holds nothing but widgets.
 *
 * This is the only way the search below reaches a rect, and that is the point:
 * **no geometry is ever read off a child that owns no top-level node.** A
 * widget's box is a sliver where a block's is a block, and one taken out of
 * flow reports a box that says nothing about where it sits — `display: none`
 * gives an all-zero rect, and `prosemirror-gapcursor`'s shipped stylesheet
 * makes exactly that: `position: absolute; display: none`, lifted to `block`
 * only under `.ProseMirror-focused`, so a gap-cursor selection surviving a blur
 * parks an all-zero-rect child at top level. Comparing a pointer against that
 * box would drag a search past real blocks.
 */
function blockAtOrBefore(
  view: EditorView,
  children: HTMLCollection,
  from: number,
  floor: number,
): { readonly childIndex: number; readonly hit: MlvEditorBlockHit } | null {
  for (let i = from; i >= floor; i -= 1) {
    const hit = blockHit(view, children[i]);
    if (hit) return { childIndex: i, hit };
  }
  return null;
}

/**
 * @internal Top-level block the given viewport y falls on, or the nearest one
 * above it. Null for an empty document, or for a point the view cannot map.
 *
 * Resolves geometrically instead of through `EditorView.posAtCoords`, which
 * cannot serve this affordance at all. `.ProseMirror` is the
 * `max-inline-size: var(--mlv-editor-measure)` text column, so the gutter the
 * handle lives in is outside `view.dom`'s rect by construction — and
 * `posAtCoords` falls back to an `inRect(coords, view.dom.getBoundingClientRect())`
 * test and returns null for every point outside it, in a real browser as much
 * as under a test DOM.
 *
 * **Assumes the top-level blocks are vertically ordered and non-overlapping** —
 * `top` non-decreasing down the blocks, and no block's box reaching into the
 * next one's. Normal flow guarantees it for blocks, which are the only children
 * this reads a box from. Violating it (a float, `position: absolute`, a
 * negative margin on a *block*) resolves the handle to a neighbouring block
 * rather than throwing. `slotAt` assumes the same, and so did the scan this
 * replaced, which stopped at the first child starting below the pointer.
 *
 * Under that ordering the answer is *the last block starting at or above the
 * pointer*, clamped to the first block when every block starts below it. The
 * search probes child indices, but every comparison is against a **block**: a
 * probe landing on a widget resolves back to the nearest block at or before it,
 * and that block's own child index — not the widget's — bounds the next step.
 * Widget geometry therefore cannot move the search, which is the same category
 * rejection `blockHit` performs, extended to the probe itself. Pairing a
 * block's index with a widget's box is what that prevents: `dropTargetIndex`
 * would take the deciding midpoint from the wrong box and land the drop on the
 * wrong side of its neighbour — silently, in one undo step.
 *
 * Cost, against the mapping-per-child scan this replaced. `posAtDOM`, `nodeDOM`
 * and `childStart` each walk linearly to the child they address, so mapping the
 * child at index `k` is Θ(k) and scanning down to it was Θ(k²) — 500 mappings
 * and ~125k node walks for a hover at the bottom of a 500-block document, per
 * `mousemove`. Here it is Θ(log n) mappings, one per probe plus the widgets a
 * probe walks over, and ~4.5k node walks at the same size. Deferring to a
 * single mapping overall is only possible by trusting widget geometry, which
 * is the trade this deliberately refuses.
 */
function blockAtPoint(
  view: EditorView,
  clientY: number,
): MlvEditorBlockHit | null {
  const children = view.dom.children;
  // `high` is -1 for a view that renders no children at all, so both loops
  // below are skipped and the answer is null without a bounds check.
  let low = 0;
  let high = children.length - 1;
  let best: MlvEditorBlockHit | null = null;
  let bestChild = -1;

  while (low <= high) {
    const middle = (low + high) >> 1;
    const found = blockAtOrBefore(view, children, middle, low);
    if (found === null) {
      // Nothing but widgets in [low, middle]: every block still in range
      // starts after it. Discarding the span is what bounds the walk-backs.
      low = middle + 1;
    } else if (found.hit.top <= clientY) {
      // A candidate, and every block before it is one too; only a later block
      // can improve on it.
      best = found.hit;
      bestChild = found.childIndex;
      low = found.childIndex + 1;
    } else {
      high = found.childIndex - 1;
    }
  }

  if (best === null) {
    // Every block starts below the pointer, which is the clamp: offer the
    // first block rather than blink the handle out. Null only for a view
    // rendering no top-level block at all.
    for (let i = 0; i < children.length; i += 1) {
      const hit = blockHit(view, children[i]);
      if (hit) return hit;
    }
    return null;
  }

  // A pointer exactly on a block's leading edge belongs to the block above it
  // when the two boxes touch, which is where the scan this replaced ended up:
  // it broke on the first box whose `bottom` reached the pointer. The shipped
  // stylesheet keeps `0.75rem` between paragraph border boxes so nothing can
  // land here, but the answer is a silent one to change. The predecessor is
  // only resolved for a pointer exactly on `best.top`, so a well-formed
  // document pays for it on one pixel per block and never elsewhere.
  if (clientY === best.top && bestChild > 0) {
    const previous = blockAtOrBefore(view, children, bestChild - 1, 0);
    if (previous !== null && previous.hit.bottom >= clientY)
      return previous.hit;
  }
  return best;
}

/**
 * @internal Pre-move `to` index for dropping the block at `from` onto `hit`,
 * or null when that drop would leave the document unchanged.
 *
 * `blockAtPoint` clamps to the nearest block and carries no before/after bias,
 * so the hovered block's own midpoint decides which of its two edges the
 * dragged block would land on. That yields one of the `childCount + 1` gaps,
 * which is then folded back onto `moveBlock`'s pre-move index convention:
 * `to` names the block the moved one ends up *after* when moving down and
 * *before* when moving up, so both gaps bordering the source are no-ops.
 */
function dropTargetIndex(
  hit: MlvEditorBlockHit,
  clientY: number,
  from: number,
): number | null {
  const gap = clientY < (hit.top + hit.bottom) / 2 ? hit.index : hit.index + 1;
  const to = gap <= from ? gap : gap - 1;
  return to === from ? null : to;
}

/**
 * @internal Measures every top-level block once, in the mount's unscaled space.
 *
 * Taken at `dragstart` and read by everything downstream — target resolution,
 * the indicator's `top` and the settle's "before" — so no pointer event during
 * the drag reads a block's rect. Mount-relative rather than viewport-relative
 * so drag-autoscroll cannot invalidate it: only the mount's own rect is re-read
 * per event, one layout read instead of one per block. Unscaled for the same
 * reason the handle's `top` is: a CSS length on a child of the zoom layer
 * applies in that layer's space, while `getBoundingClientRect()` reports scaled
 * screen pixels.
 *
 * Boxes only, deliberately **no element**. ProseMirror replaces top-level
 * elements during a drag (see `MLV_EDITOR_DRAG_SOURCE_KEY`), so an element
 * captured here is detached by the first `dragover`, and anything written to it
 * afterwards is written to nothing. Everything after `dragstart` that needs a
 * live element resolves it from a document position instead.
 */
function snapshotBlocks(
  view: EditorView,
  mount: HTMLElement,
): MlvEditorBlockHit[] {
  const { top: mountTop, scale } = mountFrame(mount);
  const slots: MlvEditorBlockHit[] = [];
  const children = view.dom.children;

  for (let i = 0; i < children.length; i += 1) {
    const element = children[i];
    // Same category check the hover path uses: a widget decoration owns no
    // top-level node and must not occupy a slot, or its sliver of a box would
    // decide a neighbour's drop side. Mapping every child once here is what the
    // drag pays instead of the hover path's deferred single mapping — the
    // settle needs a box per block regardless.
    const index = topLevelIndexOfDom(view, element);
    if (index === null) continue;
    const rect = element.getBoundingClientRect();
    slots.push({
      index,
      top: (rect.top - mountTop) / scale,
      bottom: (rect.bottom - mountTop) / scale,
    });
  }
  return slots;
}

/**
 * @internal Slot the given mount-space y falls on, or the nearest one above it.
 *
 * Reproduces `blockAtPoint`'s clamping exactly — above the first block resolves
 * to the first, a point in the gap between two blocks resolves to the
 * preceding one, below the last resolves to the last. Both are the same
 * "last block starting at or above the pointer" search on the same ordering
 * assumption; this one runs against an array the drag already mapped, so it
 * needs no widget walk-back and reads no rect at all.
 */
function slotAt(
  slots: readonly MlvEditorBlockHit[],
  y: number,
): MlvEditorBlockHit | null {
  if (slots.length === 0) return null;
  if (y < slots[0].top) return slots[0];

  let low = 0;
  let high = slots.length - 1;
  while (low < high) {
    // `ceil`, not `floor`: this converges by raising `low` *to* the midpoint,
    // so a `floor` midpoint of `low` for an adjacent pair would set `low` to
    // itself and spin forever.
    const middle = Math.ceil((low + high) / 2);
    if (slots[middle].top <= y) low = middle;
    else high = middle - 1;
  }
  return slots[low];
}

/**
 * @internal Mount-space y of the boundary the given gap sits on, where `gap`
 * counts the `slots.length + 1` positions a block can be inserted at.
 *
 * An interior gap is the middle of the **natural** space between two blocks —
 * the midpoint of the previous block's bottom and the next block's top — since
 * nothing parts the blocks to preview a drop. The outer two sit on the first
 * block's top and the last block's bottom. The stylesheet centres the line on
 * this y (`translateY(-50%)`), so its own thickness never has to be resolved
 * here.
 */
function gapOffset(slots: readonly MlvEditorBlockHit[], gap: number): number {
  if (gap <= 0) return slots[0].top;
  if (gap >= slots.length) return slots[slots.length - 1].bottom;
  return (slots[gap - 1].bottom + slots[gap].top) / 2;
}

/**
 * @internal Deep-clones an element with every computed style written inline.
 *
 * The clone is handed to `setDragImage` from its document's `body`, outside every
 * `.mlv-editor`/`.ProseMirror` selector that styles it in place. Inlining the
 * resolved styles makes it self-contained, which is sturdier than rebuilding
 * an ancestor class chain that would have to track whichever selectors happen
 * to exist. Adapted from `@tiptap/extension-drag-handle`'s `cloneElement`.
 *
 * Note what this cannot carry: computed styles are the element's own values
 * and never carry an ancestor's `zoom`. The editor's zoom is applied to the
 * wrapper instead — see `createGhostElement`.
 */
function cloneWithComputedStyles(source: HTMLElement): HTMLElement {
  const clone = source.cloneNode(true) as HTMLElement;
  const sources: HTMLElement[] = [
    source,
    ...source.querySelectorAll<HTMLElement>('*'),
  ];
  const targets: HTMLElement[] = [
    clone,
    ...clone.querySelectorAll<HTMLElement>('*'),
  ];

  sources.forEach((element, index) => {
    const target = targets[index];
    if (!target) return;
    const computed = getComputedStyle(element);
    let declarations = '';
    for (let i = 0; i < computed.length; i += 1) {
      declarations += `${computed[i]}:${computed.getPropertyValue(computed[i])};`;
    }
    target.style.cssText = declarations;
  });

  // The block's own margins would otherwise pad the drag image with empty
  // space, since the clone has no siblings to collapse against.
  clone.style.margin = '0';
  return clone;
}

/**
 * @internal Builds the off-screen element handed to `setDragImage`, on the
 * `body` of the source block's own document — the global `document` is
 * another document when the editor is mounted in an iframe preview or a print
 * window.
 *
 * `position: absolute; top: -10000px` keeps it rendered — which the drag image
 * requires — without ever being seen. `zoom` rather than `transform` carries
 * the editor's scale because it affects layout, so the wrapper's own box
 * reflects it before the browser rasterizes; a `transform` is honoured
 * inconsistently across engines for drag images, and the source's computed
 * styles carry no ancestor `zoom`.
 */
function createGhostElement(source: HTMLElement, scale: number): HTMLElement {
  const ownerDocument = source.ownerDocument;
  const wrapper = ownerDocument.createElement('div');
  wrapper.className = MLV_EDITOR_DRAG_GHOST_CLASS;
  wrapper.setAttribute('aria-hidden', 'true');
  wrapper.style.position = 'absolute';
  wrapper.style.top = '-10000px';
  wrapper.style.insetInlineStart = '0';
  wrapper.style.inlineSize = `${source.offsetWidth}px`;
  if (scale !== 1) wrapper.style.setProperty('zoom', String(scale));
  wrapper.appendChild(cloneWithComputedStyles(source));
  ownerDocument.body.appendChild(wrapper);
  return wrapper;
}

/**
 * @internal Whether the user asked for reduced motion.
 *
 * Guarded because jsdom implements no `matchMedia`; absent the query, motion
 * is allowed and the animation itself is separately guarded on `animate`.
 */
function prefersReducedMotion(): boolean {
  return (
    typeof matchMedia === 'function' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * @internal Creates the single floating drop indicator element in `ownerDocument`
 * — the mount's, which is not the global one in an iframe preview.
 */
function createIndicatorElement(ownerDocument: Document): HTMLElement {
  const element = ownerDocument.createElement('div');
  element.className = MLV_EDITOR_DROP_INDICATOR_CLASS;
  element.setAttribute('aria-hidden', 'true');
  element.setAttribute('data-visible', 'false');
  return element;
}

/**
 * @internal Creates the single floating handle element in `ownerDocument` — the
 * mount's, which is not the global one in an iframe preview.
 */
function createHandleElement(
  label: string,
  ownerDocument: Document,
): HTMLElement {
  const element = ownerDocument.createElement('div');
  element.className = 'mlv-editor__block-handle';
  element.setAttribute('draggable', 'true');
  element.setAttribute('aria-hidden', 'true');
  element.setAttribute('data-visible', 'false');
  element.title = label;
  element.innerHTML =
    // Sized from `.mlv-editor__block-handle svg`; no intrinsic width/height
    // attributes, so the icon scales with the block's tokens.
    '<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">' +
    '<circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/>' +
    '<circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>' +
    '<circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>';
  return element;
}

/** @internal Top-level index containing the selection, or null for an empty document. */
function topLevelIndexAtSelection(state: EditorState): number | null {
  if (state.doc.childCount === 0) return null;
  const index = state.selection.$from.index(0);
  return index < state.doc.childCount ? index : null;
}

/**
 * Tiptap extension supplying top-level block reordering.
 *
 * The pointer handle and the keyboard shortcuts both route through `moveBlock`,
 * so the two paths cannot drift apart. The handle itself is rendered by this
 * extension's ProseMirror plugin into the host-supplied mount container and is
 * never part of the document, so no serialized representation can contain it.
 */
export const MlvEditorBlockHandle =
  Extension.create<MlvEditorBlockHandleOptions>({
    name: 'mlvEditorBlockHandle',

    addOptions() {
      return {
        mount: () => null,
        label: () => 'Drag block',
        announceMove: () => undefined,
        enabled: () => true,
      };
    },

    addCommands() {
      return {
        moveBlock:
          ({ from, to }) =>
          ({ state, tr, dispatch }) => {
            if (!this.options.enabled()) return false;
            if (!Number.isInteger(from) || !Number.isInteger(to)) return false;

            const total = state.doc.childCount;
            if (from < 0 || from >= total) return false;
            if (to < 0 || to >= total) return false;
            if (from === to) return false;
            if (!dispatch) return true;

            const node = state.doc.child(from);
            const start = childStart(state.doc, from);
            const end = start + node.nodeSize;
            const anchor = insertAnchor(state.doc, from, to);

            tr.delete(start, end);
            const insertAt = tr.mapping.map(anchor);
            tr.insert(insertAt, node);
            // The selection must land *inside* the moved node so a following
            // moveBlockUp/Down keeps acting on it. An atom has no position
            // inside it — `insertAt + 1` is already past a leaf such as
            // horizontalRule, and TextSelection.near's forward bias would then
            // walk into the next block — so select the node itself instead.
            tr.setSelection(
              node.isAtom && NodeSelection.isSelectable(node)
                ? NodeSelection.create(tr.doc, insertAt)
                : TextSelection.near(
                    tr.doc.resolve(Math.min(insertAt + 1, tr.doc.content.size)),
                  ),
            );
            dispatch(tr);

            // Fires before the document actually changes: props `dispatch` is a
            // no-op and CommandManager runs the real `view.dispatch(tr)` only
            // after this command returns. A host callback therefore still sees
            // the pre-move `editor.state` and must rely on this payload alone.
            this.options.announceMove({
              type: node.type.name,
              position: to + 1,
              total,
            });
            return true;
          },

        moveBlockUp:
          () =>
          ({ state, commands }) => {
            const index = topLevelIndexAtSelection(state);
            return (
              index !== null &&
              index > 0 &&
              commands.moveBlock({ from: index, to: index - 1 })
            );
          },

        moveBlockDown:
          () =>
          ({ state, commands }) => {
            const index = topLevelIndexAtSelection(state);
            return (
              index !== null &&
              index < state.doc.childCount - 1 &&
              commands.moveBlock({ from: index, to: index + 1 })
            );
          },
      };
    },

    addKeyboardShortcuts() {
      return {
        'Alt-Shift-ArrowUp': () => this.editor.commands.moveBlockUp(),
        'Alt-Shift-ArrowDown': () => this.editor.commands.moveBlockDown(),
      };
    },

    addProseMirrorPlugins() {
      const options = this.options;
      // The plugin view receives an `EditorView`, which carries no command
      // interface; the drop path has to reach `moveBlock` through Tiptap.
      const editor = this.editor;
      /**
       * Set by `apply` when a transaction other than a peer's edit changed the
       * document; read and cleared by the view's `update` (F-D14). Without a
       * collaboration binding every change is local.
       */
      let localDocChange = false;

      return [
        new Plugin<DecorationSet>({
          key: MLV_EDITOR_DRAG_SOURCE_KEY,
          state: {
            init: () => DecorationSet.empty,
            // Set and cleared only through a meta, from the plugin view (and
            // `clearInheritedDragSource`). A document change also ends the
            // drag (see `update` below), so the decoration is dropped in that
            // same transaction rather than mapped onto a block that may no
            // longer be the one on the pointer. That transaction therefore
            // never renders a set built against the previous document, and
            // `update`'s `endDrag` finds nothing left to dispatch.
            apply: (tr, decorations) => {
              if (tr.docChanged && !mlvEditorIsRemoteEdit(editor, tr)) {
                localDocChange = true;
              }
              return (
                tr.getMeta(MLV_EDITOR_DRAG_SOURCE_KEY) ??
                (tr.docChanged ? DecorationSet.empty : decorations)
              );
            },
          },
          props: {
            decorations: (state) => MLV_EDITOR_DRAG_SOURCE_KEY.getState(state),
          },
          view: (view) => {
            // First, before the mount check: a rebuilt view with no mount
            // still inherits whatever dim its predecessor left in state.
            clearInheritedDragSource(view);

            const mount = options.mount();
            if (!mount) return { destroy: () => undefined };

            // Everything document-level below goes through the mount's own
            // document: in an iframe preview or a print window the global
            // `document` is the parent's, which hears none of the editor's keys.
            const ownerDocument = mount.ownerDocument;
            const handle = createHandleElement(options.label(), ownerDocument);
            mount.appendChild(handle);

            // The indicator lives beside the handle rather than inside the
            // document. As a `Decoration.widget` it could never move: a widget
            // at a new position is a *different* decoration, so ProseMirror
            // destroys and rebuilds its DOM on every change, and an element in
            // normal flow has no `top` to transition anyway. Out here it is
            // also further from the document than a decoration ever was — the
            // mount is a sibling of `view.dom`, so no serializer can reach it.
            const indicator = createIndicatorElement(ownerDocument);
            mount.appendChild(indicator);

            /**
             * What the handle currently publishes, or null while it is
             * retracted.
             *
             * Comparing against this is what keeps a pointer move that resolves
             * an unchanged hit from touching the DOM at all, and the write it
             * saves is the smaller half of the point: an attribute write on the
             * handle dirties the layout tree, so the *next* move's rect reads
             * have to force a fresh layout before they can answer. Skipping the
             * writes leaves layout clean, and a hover that stays on one block
             * then forces no layout at all.
             *
             * Keyed on the values written rather than on `hit.index`, because
             * two of the three can change while the index does not: scrolling
             * moves the block under a stationary pointer, and `label()` is a
             * signal read that answers differently on a locale change.
             */
            let published: {
              top: string;
              index: string;
              label: string;
            } | null = null;

            const hide = () => {
              if (published === null) return;
              published = null;
              handle.setAttribute('data-visible', 'false');
            };

            const onMouseMove = (event: MouseEvent) => {
              if (!options.enabled()) return hide();
              const hit = blockAtPoint(view, event.clientY);
              if (!hit) return hide();

              // `getBoundingClientRect()` reports zoomed screen pixels, but a
              // CSS `top` on a child of the zoomed layer is applied in the
              // layer's own unzoomed space. Convert once, off one rect read of
              // the mount.
              const { top: mountTop, scale } = mountFrame(mount);
              const top = `${(hit.top - mountTop) / scale}px`;
              const index = String(hit.index);
              const label = options.label();

              if (
                published !== null &&
                published.top === top &&
                published.index === index &&
                published.label === label
              ) {
                return;
              }

              published = { top, index, label };
              handle.style.top = top;
              handle.dataset['index'] = index;
              handle.title = label;
              handle.setAttribute('data-visible', 'true');
            };

            /** Top-level index being dragged, or null when no drag is active. */
            let source: number | null = null;

            /** Geometry measured once at `dragstart`; empty while no drag runs. */
            let slots: MlvEditorBlockHit[] = [];

            /** The off-screen element handed to `setDragImage`. */
            let ghost: HTMLElement | null = null;

            /**
             * While collaborating, the dragged block's start, tracked across
             * peers' edits, and the block as it was at `dragstart` (F-D14).
             */
            let tracked: MlvEditorTrackedPosition | null = null;
            let sourceNode: ProseMirrorNode | null = null;

            /** Gap the indicator currently marks, or null while it is retracted. */
            let gap: number | null = null;

            /**
             * Converts a viewport y into the mount's own unscaled space, off
             * one rect read — this runs on every `dragover`.
             */
            const toMountSpace = (clientY: number): number => {
              const { top, scale } = mountFrame(mount);
              return (clientY - top) / scale;
            };

            /**
             * Gap a resolved target index sits on. `dropTargetIndex` folds the
             * `slots.length + 1` gaps onto `moveBlock`'s pre-move convention,
             * where `to` names the block the moved one ends up after when
             * moving down; this is that fold inverted, so the previewed line
             * and the committed move come from one resolved index.
             */
            const gapForTarget = (to: number, from: number): number =>
              to <= from ? to : to + 1;

            /**
             * Moves the indicator to `next`, or retracts it when null. Only
             * the mount-owned line is written: nothing parts the blocks, so no
             * element ProseMirror rendered is touched during a drag.
             */
            const setGap = (next: number | null) => {
              if (gap === next) return;
              gap = next;

              if (next === null) {
                indicator.setAttribute('data-visible', 'false');
                return;
              }
              indicator.style.top = `${gapOffset(slots, next)}px`;
              indicator.setAttribute('data-visible', 'true');
            };

            /**
             * Publishes the source's dim, or clears it with `null`, through
             * plugin state. Skipped when nothing would change, so the several
             * paths that end one drag (`drop`, then `dragend`) dispatch once.
             */
            const setSourceDecoration = (from: number | null) => {
              const current = MLV_EDITOR_DRAG_SOURCE_KEY.getState(view.state);
              if (from === null && current === DecorationSet.empty) return;
              const node = from === null ? null : view.state.doc.nodeAt(from);
              const next =
                from === null || node === null
                  ? DecorationSet.empty
                  : DecorationSet.create(view.state.doc, [
                      Decoration.node(from, from + node.nodeSize, {
                        class: MLV_EDITOR_DRAG_SOURCE_CLASS,
                      }),
                    ]);
              // A meta-only transaction: no step, so nothing for history to
              // record (prosemirror-history returns its state unchanged for a
              // step-less transaction, so no `addToHistory` flag is needed)
              // and no model emission. `update` below compares documents by
              // identity, so this does not read as a document change and end
              // the drag.
              view.dispatch(
                view.state.tr.setMeta(MLV_EDITOR_DRAG_SOURCE_KEY, next),
              );
            };

            const endDrag = () => {
              indicator.setAttribute('data-visible', 'false');
              tracked?.release();
              tracked = null;
              sourceNode = null;
              ghost?.remove();
              slots = [];
              gap = null;
              source = null;
              ghost = null;
              // Last, once the closure no longer records a drag: the dispatch
              // re-enters `update`, which must not see one still in flight.
              setSourceDecoration(null);
            };

            /** Target index for the pointer, or null when the drop is a no-op. */
            const targetAt = (clientY: number): number | null => {
              if (source === null) return null;
              const y = toMountSpace(clientY);
              const slot = slotAt(slots, y);
              return slot === null ? null : dropTargetIndex(slot, y, source);
            };

            /**
             * FLIP the blocks the move displaced: ProseMirror has already
             * re-rendered them at their new positions, so each is offset back
             * to where it was and released. Read after `moveBlock` because the
             * DOM update is applied synchronously inside `dispatch`.
             *
             * Which block was where is derived from the move's own permutation
             * rather than by matching DOM elements against their old boxes.
             * `moveBlock` deletes the dragged node and reinserts it, so its
             * element is not the one that was measured — identity matching
             * would silently skip the one block the user actually dragged, and
             * leave every other block sliding around it.
             *
             * Only the span between the two indices moved, so the walk is
             * bounded by the distance dragged rather than by document length.
             * Each element is resolved live through `nodeDOM` after the move,
             * never taken from the snapshot: ProseMirror has replaced most of
             * the elements measured at `dragstart` by now.
             *
             * Uses the Web Animations API rather than a transition or an inline
             * `transform`: nothing has to force a reflow between setting and
             * clearing the offset, the animation cleans itself up, and it
             * writes no attribute — an inline style is a DOM mutation
             * ProseMirror would answer by redrawing the block mid-animation.
             */
            const settle = (
              tops: readonly number[],
              from: number,
              to: number,
            ) => {
              if (prefersReducedMotion()) return;
              // Pre-move index now occupying each post-move index.
              const order = tops.map((_, index) => index);
              order.splice(from, 1);
              order.splice(to, 0, from);

              const doc = view.state.doc;
              const { top: mountTop, scale } = mountFrame(mount);
              const first = Math.min(from, to);
              const last = Math.max(from, to);

              for (let index = first; index <= last; index += 1) {
                const element = view.nodeDOM(childStart(doc, index));
                if (!(element instanceof HTMLElement)) continue;
                // jsdom implements no WAAPI, and neither did older engines.
                if (typeof element.animate !== 'function') return;
                const previous = tops[order[index]];
                if (previous === undefined) continue;
                const current =
                  (element.getBoundingClientRect().top - mountTop) / scale;
                const delta = previous - current;
                if (Math.abs(delta) < MLV_EDITOR_SETTLE_EPSILON) continue;
                element.animate(
                  [
                    { transform: `translateY(${delta}px)` },
                    { transform: 'translateY(0)' },
                  ],
                  {
                    duration: MLV_EDITOR_SETTLE_DURATION,
                    easing: 'cubic-bezier(0.2, 0, 0, 1)',
                  },
                );
              }
            };

            /**
             * A peer's edit landed during the drag (F-D14): re-finds the
             * dragged block through its tracked start. When it is intact, the
             * drag continues with fresh geometry and index; when it was deleted
             * or changed, the drag is cancelled and announced.
             */
            const followRemoteEdit = (): void => {
              const pos = tracked?.pos ?? null;
              const doc = view.state.doc;
              const expected = sourceNode;
              const $pos =
                pos === null || pos >= doc.content.size
                  ? null
                  : doc.resolve(pos);
              const node = $pos?.depth === 0 ? $pos.nodeAfter : null;
              if (!expected || !$pos || !node || !sameBlock(node, expected)) {
                endDrag();
                options.announceCollaborationCancel?.();
                return;
              }
              const measured = snapshotBlocks(view, mount);
              const index = $pos.index(0);
              if (!measured.some((candidate) => candidate.index === index)) {
                endDrag();
                options.announceCollaborationCancel?.();
                return;
              }
              slots = measured;
              source = index;
              gap = null;
              indicator.setAttribute('data-visible', 'false');
              setSourceDecoration(pos);
            };

            const onDragStart = (event: DragEvent) => {
              // `data-index` is absent until the first successful hover, and a
              // revoked `enabled()` must not start a drag that could never be
              // applied. Either way, refuse the drag outright.
              const attribute = handle.dataset['index'];
              const index = attribute === undefined ? NaN : Number(attribute);
              if (!options.enabled() || !Number.isInteger(index)) {
                event.preventDefault();
                return;
              }

              const measured = snapshotBlocks(view, mount);
              const from =
                index < view.state.doc.childCount
                  ? childStart(view.state.doc, index)
                  : null;
              // Resolved now, from the document position, and used only in
              // this handler — see `snapshotBlocks` for why no element is kept.
              const element = from === null ? null : view.nodeDOM(from);
              // The hovered index outliving its block means the snapshot and
              // `data-index` disagree; refusing is the same answer as a drag
              // that never hovered.
              if (
                from === null ||
                !(element instanceof HTMLElement) ||
                !measured.some((candidate) => candidate.index === index)
              ) {
                event.preventDefault();
                return;
              }

              slots = measured;
              source = index;
              tracked?.release();
              tracked = null;
              sourceNode = null;
              if (mlvEditorCollaborationBindingFor(editor)) {
                tracked = trackMlvEditorPosition(editor, from);
                sourceNode = view.state.doc.child(index);
              }

              // Firefox refuses to begin a drag whose dataTransfer carries no
              // data. The payload stays empty on purpose: the reorder replays
              // `source` through `moveBlock`, never a parsed slice, so this
              // drag cannot reparent into a list or a table cell and cannot be
              // dropped into a different editor.
              event.dataTransfer?.setData('text/plain', '');
              if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';

              // A `dragstart` that arrives while one is already recorded would
              // otherwise strand the previous drag image on the document body,
              // where nothing else reaches it.
              ghost?.remove();
              // Cloned *before* the source is dimmed: the clone carries
              // resolved computed styles, so dimming first would bake the
              // reduced opacity into the drag image.
              ghost = createGhostElement(element, mountFrame(mount).scale);
              // The pointer rides the image's inline-start edge: its right
              // edge in RTL. The offset is in CSS pixels against the image as
              // painted, and the wrapper carries the editor zoom as CSS
              // `zoom`, which `offsetWidth` leaves out (measured 475 against
              // 594 at 125%): only the rendered width puts the pointer on
              // that edge.
              event.dataTransfer?.setDragImage(
                ghost,
                getComputedStyle(view.dom).direction === 'rtl'
                  ? Math.round(ghost.getBoundingClientRect().width)
                  : 0,
                0,
              );

              setSourceDecoration(from);
            };

            const onDragOver = (event: DragEvent) => {
              if (source === null) return;
              // Claimed in the capture phase on the mount, so ProseMirror's own
              // `view.dom` drop handler never sees the event and cannot fall
              // back to its native slice path.
              event.stopPropagation();
              event.preventDefault();
              if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';

              const to = targetAt(event.clientY);
              setGap(to === null ? null : gapForTarget(to, source));
            };

            /**
             * Whether a `dragleave` is the pointer leaving the mount outright,
             * rather than crossing between two elements inside it — the event
             * fires for both, and only the first should retract the indicator.
             */
            const leavesMount = (event: DragEvent): boolean => {
              const entered = event.relatedTarget;
              // Where the browser populates it, `relatedTarget` names the
              // element being entered; one inside the mount means the drag
              // never left.
              if (entered instanceof Node) return !mount.contains(entered);
              // Chromium leaves it null on every drag event, so fall back to
              // the pointer itself. Leaving the window reports (0, 0) in some
              // browsers, which may read as inside; the drag's own `dragend`
              // still clears the indicator there, exactly as it did before.
              const rect = mount.getBoundingClientRect();
              return (
                event.clientX < rect.left ||
                event.clientX > rect.right ||
                event.clientY < rect.top ||
                event.clientY > rect.bottom
              );
            };

            const onDragLeave = (event: DragEvent) => {
              // Only the line retracts; the source stays dimmed. The drag
              // itself is still in flight, and re-entering
              // the editor must resolve a target again rather than leave the
              // user dragging something that can no longer be dropped.
              if (source !== null && leavesMount(event)) setGap(null);
            };

            const onDrop = (event: DragEvent) => {
              if (source === null) return;
              event.stopPropagation();
              event.preventDefault();

              const from = source;
              // Resolved from the drop's own coordinates rather than the last
              // `dragover`, so the release position always wins.
              const to = targetAt(event.clientY);
              // Captured before `endDrag` discards the snapshot. Nothing moves
              // a block during the drag, so the `dragstart` tops are exactly
              // the FLIP's "before".
              const tops = slots.map((slot) => slot.top);

              endDrag();
              if (to === null) return;
              editor.commands.moveBlock({ from, to });
              settle(tops, from, to);
            };

            const onKeyDown = (event: KeyboardEvent) => {
              if (event.key === 'Escape' && source !== null) endDrag();
            };

            // These eight stay raw `addEventListener`s rather than becoming
            // `fromEvent` + `takeUntilDestroyed`, deliberately and for two
            // reasons.
            //
            // There is no `DestroyRef` to take. This file is a plain
            // ProseMirror plugin with no Angular import at all, constructed by
            // Tiptap outside any injection context, so `inject()` would throw.
            // The lifetime that matters here is not the editor component's
            // either: it is this plugin *view's*, which is torn down and
            // rebuilt whenever the editor is recreated (a format switch, an
            // extension-set change). `destroy()` below is that boundary, and it
            // unbinds all eight with the capture flags they were bound with.
            //
            // And the three capture-phase drag listeners are protocol-sensitive.
            // ProseMirror installs its own `dragover`/`drop` handlers on
            // `view.dom`, a descendant of `mount`; capturing on the ancestor is
            // what lets `onDrop` claim the drop and `stopPropagation()` before
            // ProseMirror inserts the dragged slice itself. Nothing in the unit
            // suite can drive a native HTML5 drag, so that ordering cannot be
            // pinned by a test here — and an unprovable reordering of block
            // drag-and-drop is not worth a stylistic conversion.
            mount.addEventListener('mousemove', onMouseMove);
            mount.addEventListener('mouseleave', hide);
            handle.addEventListener('dragstart', onDragStart);
            handle.addEventListener('dragend', endDrag);
            // On the mount rather than `view.dom`: `.ProseMirror` is the text
            // column, so a drag that never leaves the gutter the handle lives
            // in would otherwise produce no `dragover` and no droppable target.
            mount.addEventListener('dragover', onDragOver, true);
            mount.addEventListener('dragleave', onDragLeave, true);
            mount.addEventListener('drop', onDrop, true);
            // Escape aborts a native drag in a real browser, which fires
            // `dragend` anyway; this keeps the cancellation deterministic and
            // independent of that. On the mount's document, where the key is
            // pressed; the global one belongs to the parent of an iframe.
            ownerDocument.addEventListener('keydown', onKeyDown);

            return {
              // `enabled()` is checked on every pointer move too, but a host
              // can revoke it *between* moves. Disabling the editor puts
              // `pointer-events: none` on the surface containing the mount, so
              // no further mousemove or mouseleave can ever arrive to retract
              // a handle that was left visible. This runs on every state
              // update, which is what a `disabled`/`readonly` flip produces.
              update: (updated, previous) => {
                // `source` is a pre-move top-level index, exactly like the
                // anchor `apply` drops on `docChanged`, and it is the one that
                // decides *which* block moves. An insertion before it makes it
                // name a different block, so the indicator would repaint at the
                // gap the user aimed at while the drop silently moved the wrong
                // block — one undo step, no error. Abort rather than map: a
                // source block that was itself deleted has no mapped index, and
                // aborting matches what already happens to the anchor.
                //
                // Identity, not `Node.eq`: ProseMirror only replaces
                // `state.doc` when a step is applied — a meta- or
                // selection-only transaction carries the same reference — so
                // this is exactly `docChanged` at O(1), where a structural
                // compare would walk the whole document on every keystroke.
                // The same change has already emptied the source decoration in
                // plugin state (`apply`), so this `endDrag` dispatches nothing.
                //
                // Collaboration (F-D14): a peer's edit is not the user's, and
                // peers type all the time, so instead of aborting,
                // `followRemoteEdit` re-finds the block through its tracked
                // start. Any local change in the same update still aborts.
                const local = localDocChange;
                localDocChange = false;
                if (previous.doc !== updated.state.doc && source !== null) {
                  if (local) endDrag();
                  else followRemoteEdit();
                }

                if (options.enabled()) return;
                hide();
                // Retracts the preview and drops the in-flight source, so
                // releasing the button after the revocation cannot reorder
                // anything. Previously the line went through `decorations`,
                // which read `enabled()` itself; a mount-owned element has to
                // be told. Clearing the dim dispatches from inside `update`;
                // that re-entry finds no drag recorded and returns, so it runs
                // once.
                if (source !== null) endDrag();
              },
              destroy: () => {
                mount.removeEventListener('mousemove', onMouseMove);
                mount.removeEventListener('mouseleave', hide);
                handle.removeEventListener('dragstart', onDragStart);
                handle.removeEventListener('dragend', endDrag);
                mount.removeEventListener('dragover', onDragOver, true);
                mount.removeEventListener('dragleave', onDragLeave, true);
                mount.removeEventListener('drop', onDrop, true);
                ownerDocument.removeEventListener('keydown', onKeyDown);
                handle.remove();
                indicator.remove();
                // A drag interrupted by teardown leaves its drag image on
                // the document body, outside everything else this removes.
                ghost?.remove();
                // The dim stays in plugin state, where this cannot dispatch;
                // see `clearInheritedDragSource`.
              },
            };
          },
        }),
      ];
    },
  });
