import { Extension } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { EditorState } from '@tiptap/pm/state';
import { NodeSelection, Plugin, TextSelection } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';

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
   * editor zoom transform so the handle shares its coordinate space.
   */
  readonly mount: () => HTMLElement | null;

  /** Accessible label for the handle, read live so locale changes apply. */
  readonly label: () => string;

  /** Receives every completed move; the host formats and announces it. */
  readonly announceMove: (move: MlvEditorBlockMove) => void;

  /** Whether block moving is currently permitted; false while readonly or disabled. */
  readonly enabled: () => boolean;
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
 * @internal Marks the editor DOM while a block drag is in flight, so the
 * stylesheet — not this file — owns the partition's transition and its
 * reduced-motion fallback. JavaScript writes only the `transform` itself.
 */
const MLV_EDITOR_DRAGGING_CLASS = 'ProseMirror--block-dragging';

/** @internal Marks the block currently on the cursor, dimmed in place. */
const MLV_EDITOR_DRAG_SOURCE_CLASS = 'mlv-editor__block--dragging';

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

/** @internal Reads the live scale of the mount layer instead of trusting a CSS variable. */
function layerScale(mount: HTMLElement): number {
  const width = mount.offsetWidth;
  if (!width) return 1;
  const scaled = mount.getBoundingClientRect().width;
  return scaled > 0 ? scaled / width : 1;
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
 * Rendered children lay out in document order, so the scan stops at the first
 * one starting below the pointer, costing one `getBoundingClientRect()` and
 * one index mapping per child down to the hovered one.
 *
 * Mapping inside the loop is what makes widget decorations skippable as a
 * category rather than by class name, and it is not free: `posAtDOM`,
 * `nodeDOM`, and `childStart` each walk linearly to the child they address, so
 * the scan down to index `k` is quadratic in `k` — measured at roughly 4x per
 * doubling, against 2x for the map-only-the-winner scan this replaced. That
 * one was abandoned because it could not tell a widget from a block, and
 * pairing a block's index with a widget's box drops the block on the wrong
 * side of its neighbour. Correctness first; the cost is only paid down to the
 * *hovered* child, so it is deep hovering in a long document that degrades.
 * Restoring the linear scan without losing the category skip means deferring
 * the mapping until a winner is picked and walking back over the few
 * consecutive widgets — the clamp above the first block is what makes that
 * more than a one-liner, so it is deliberately left as follow-up.
 */
function blockAtPoint(
  view: EditorView,
  clientY: number,
): MlvEditorBlockHit | null {
  const children = view.dom.children;
  let candidate: MlvEditorBlockHit | null = null;

  for (let i = 0; i < children.length; i += 1) {
    const element = children[i];
    // A widget decoration owns no top-level node, and its box is a sliver
    // rather than a block's. Letting one become the candidate would pair a
    // neighbouring block's index with the widget's geometry, so
    // `dropTargetIndex` would take that block's midpoint from the wrong box
    // and land the drop on the wrong side of it — silently, in one undo step.
    const index = topLevelIndexOfDom(view, element);
    if (index === null) continue;

    const rect = element.getBoundingClientRect();
    if (clientY < rect.top) {
      // Above the first block clamps to it; in the gap between two blocks the
      // preceding one was already recorded on the previous iteration.
      candidate ??= { index, top: rect.top, bottom: rect.bottom };
      break;
    }
    candidate = { index, top: rect.top, bottom: rect.bottom };
    if (clientY <= rect.bottom) break;
  }
  return candidate;
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
 * @internal One top-level block measured into the drag snapshot: its box in the
 * mount's own unscaled space, paired with the element that rendered it.
 *
 * Carrying the element is what keeps everything after `dragstart` off
 * `topLevelIndexOfDom`. The partition has to decide, for every rendered child,
 * whether it sits at or after the insertion point; resolving that through the
 * index mapping per child would reintroduce the same quadratic walk the scan
 * pays, on every target change. Mapped once here, the rest is array work.
 */
interface MlvEditorBlockSlot extends MlvEditorBlockHit {
  /** The element ProseMirror rendered for this top-level child. */
  readonly element: HTMLElement;
}

/**
 * @internal Measures every top-level block once, in the mount's unscaled space.
 *
 * Taken at `dragstart` and read by everything downstream, which is a
 * correctness requirement rather than an optimisation. The partition applies
 * `transform` to blocks, and a transform *is* reflected in
 * `getBoundingClientRect()`. Resolving the target from live rects after moving
 * them would feed this plugin's own output back into its input: the gap opens,
 * the pointer is now over a different block, the target changes, the gap moves.
 * A snapshot taken before any transform breaks that loop.
 *
 * Mount-relative rather than viewport-relative so drag-autoscroll cannot
 * invalidate it — only the mount's own rect is re-read per event, one layout
 * read instead of one per block. Unscaled for the same reason the handle's
 * `top` is: a CSS length on a child of the zoom layer applies in that layer's
 * space, while `getBoundingClientRect()` reports scaled screen pixels.
 */
function snapshotBlocks(
  view: EditorView,
  mount: HTMLElement,
): MlvEditorBlockSlot[] {
  const scale = layerScale(mount);
  const mountTop = mount.getBoundingClientRect().top;
  const slots: MlvEditorBlockSlot[] = [];
  const children = view.dom.children;

  for (let i = 0; i < children.length; i += 1) {
    const element = children[i];
    // Same category check the hover scan uses: a widget decoration owns no
    // top-level node and must not occupy a slot, or the partition would shift
    // it as though it were a block.
    const index = topLevelIndexOfDom(view, element);
    if (index === null) continue;
    const rect = element.getBoundingClientRect();
    slots.push({
      index,
      top: (rect.top - mountTop) / scale,
      bottom: (rect.bottom - mountTop) / scale,
      element: element as HTMLElement,
    });
  }
  return slots;
}

/**
 * @internal Slot the given mount-space y falls on, or the nearest one above it.
 *
 * Reproduces `blockAtPoint`'s clamping exactly — above the first block resolves
 * to the first, a point in the gap between two blocks resolves to the
 * preceding one, below the last resolves to the last — but against a static
 * array, so it is a binary search rather than a scan that maps every child it
 * passes.
 */
function slotAt(
  slots: readonly MlvEditorBlockSlot[],
  y: number,
): MlvEditorBlockSlot | null {
  if (slots.length === 0) return null;
  if (y < slots[0].top) return slots[0];

  let low = 0;
  let high = slots.length - 1;
  while (low < high) {
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
 * Deliberately the *pre-partition* boundary: the indicator is offset into the
 * opened space by half the gap in CSS, so the gap's size stays a single token
 * and this never has to resolve a rem into pixels.
 */
function gapOffset(slots: readonly MlvEditorBlockSlot[], gap: number): number {
  if (gap <= 0) return slots[0].top;
  if (gap >= slots.length) return slots[slots.length - 1].bottom;
  return (slots[gap - 1].bottom + slots[gap].top) / 2;
}

/**
 * @internal Deep-clones an element with every computed style written inline.
 *
 * The clone is handed to `setDragImage` from `document.body`, outside every
 * `.mlv-editor`/`.ProseMirror` selector that styles it in place. Inlining the
 * resolved styles makes it self-contained, which is sturdier than rebuilding
 * an ancestor class chain that would have to track whichever selectors happen
 * to exist. Adapted from `@tiptap/extension-drag-handle`'s `cloneElement`.
 *
 * Note what this cannot carry: computed styles are used values, and an
 * ancestor `transform: scale()` never reaches them. The editor's zoom is
 * applied to the wrapper instead — see `createGhostElement`.
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
 * @internal Builds the off-screen element handed to `setDragImage`.
 *
 * `position: absolute; top: -10000px` keeps it rendered — which the drag image
 * requires — without ever being seen. `zoom` rather than `transform` carries
 * the editor's scale because it affects layout, so the wrapper's own box
 * reflects it before the browser rasterizes; a `transform` is honoured
 * inconsistently across engines for drag images.
 */
function createGhostElement(source: HTMLElement, scale: number): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = MLV_EDITOR_DRAG_GHOST_CLASS;
  wrapper.setAttribute('aria-hidden', 'true');
  wrapper.style.position = 'absolute';
  wrapper.style.top = '-10000px';
  wrapper.style.insetInlineStart = '0';
  wrapper.style.inlineSize = `${source.offsetWidth}px`;
  if (scale !== 1) wrapper.style.setProperty('zoom', String(scale));
  wrapper.appendChild(cloneWithComputedStyles(source));
  document.body.appendChild(wrapper);
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

/** @internal Creates the single floating drop indicator element. */
function createIndicatorElement(): HTMLElement {
  const element = document.createElement('div');
  element.className = MLV_EDITOR_DROP_INDICATOR_CLASS;
  element.setAttribute('aria-hidden', 'true');
  element.setAttribute('data-visible', 'false');
  return element;
}

/** @internal Creates the single floating handle element. */
function createHandleElement(label: string): HTMLElement {
  const element = document.createElement('div');
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

      return [
        new Plugin({
          view: (view) => {
            const mount = options.mount();
            if (!mount) return { destroy: () => undefined };

            const handle = createHandleElement(options.label());
            mount.appendChild(handle);

            // The indicator lives beside the handle rather than inside the
            // document. As a `Decoration.widget` it could never move: a widget
            // at a new position is a *different* decoration, so ProseMirror
            // destroys and rebuilds its DOM on every change, and an element in
            // normal flow has no `top` to transition anyway. Out here it is
            // also further from the document than a decoration ever was — the
            // mount is a sibling of `view.dom`, so no serializer can reach it.
            const indicator = createIndicatorElement();
            mount.appendChild(indicator);

            const hide = () => handle.setAttribute('data-visible', 'false');

            const onMouseMove = (event: MouseEvent) => {
              if (!options.enabled()) return hide();
              const hit = blockAtPoint(view, event.clientY);
              if (!hit) return hide();

              // `getBoundingClientRect()` reports scaled screen pixels, but a
              // CSS `top` on a child of the scaled layer is applied in the
              // layer's own unscaled space. Convert once, deriving the scale
              // from the DOM rather than `--mlv-editor-zoom`, so the handle
              // stays correct if anything else ever transforms this layer.
              const scale = layerScale(mount);
              const mountTop = mount.getBoundingClientRect().top;
              handle.style.top = `${(hit.top - mountTop) / scale}px`;
              handle.dataset['index'] = String(hit.index);
              handle.title = options.label();
              handle.setAttribute('data-visible', 'true');
            };

            /** Top-level index being dragged, or null when no drag is active. */
            let source: number | null = null;

            /** The dimmed element the drag started from. */
            let sourceElement: HTMLElement | null = null;

            /** Geometry measured once at `dragstart`; empty while no drag runs. */
            let slots: MlvEditorBlockSlot[] = [];

            /** The off-screen element handed to `setDragImage`. */
            let ghost: HTMLElement | null = null;

            /** Gap the partition is currently opened at, or null when closed. */
            let gap: number | null = null;

            /** Converts a viewport y into the mount's own unscaled space. */
            const toMountSpace = (clientY: number): number =>
              (clientY - mount.getBoundingClientRect().top) / layerScale(mount);

            /**
             * Gap a resolved target index sits on. `dropTargetIndex` folds the
             * `slots.length + 1` gaps onto `moveBlock`'s pre-move convention,
             * where `to` names the block the moved one ends up after when
             * moving down; this is that fold inverted, so the previewed space
             * and the committed move come from one resolved index.
             */
            const gapForTarget = (to: number, from: number): number =>
              to <= from ? to : to + 1;

            /** Opens the partition at `next`, or closes it when null. */
            const setGap = (next: number | null) => {
              if (gap === next) return;
              gap = next;

              for (const slot of slots) {
                // The gap is a token rather than a number here, so the size
                // stays owned by the stylesheet.
                slot.element.style.transform =
                  next !== null && slot.index >= next
                    ? 'translateY(var(--mlv-editor-drop-gap))'
                    : '';
              }

              if (next === null) {
                indicator.setAttribute('data-visible', 'false');
                return;
              }
              // The *pre-partition* boundary: the stylesheet offsets the line
              // into the opened space by half the gap, so this never has to
              // resolve the token into pixels.
              indicator.style.top = `${gapOffset(slots, next)}px`;
              indicator.setAttribute('data-visible', 'true');
            };

            const endDrag = () => {
              for (const slot of slots) slot.element.style.transform = '';
              indicator.setAttribute('data-visible', 'false');
              view.dom.classList.remove(MLV_EDITOR_DRAGGING_CLASS);
              sourceElement?.classList.remove(MLV_EDITOR_DRAG_SOURCE_CLASS);
              ghost?.remove();
              slots = [];
              gap = null;
              source = null;
              sourceElement = null;
              ghost = null;
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
             *
             * Uses the Web Animations API rather than a transition: nothing has
             * to force a reflow between setting and clearing the offset, the
             * animation cleans itself up, and it never collides with the inline
             * `transform` the partition writes.
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
              const scale = layerScale(mount);
              const mountTop = mount.getBoundingClientRect().top;
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
              const slot = measured.find(
                (candidate) => candidate.index === index,
              );
              // The hovered index outliving its block means the snapshot and
              // `data-index` disagree; refusing is the same answer as a drag
              // that never hovered.
              if (!slot) {
                event.preventDefault();
                return;
              }

              slots = measured;
              source = index;

              // Firefox refuses to begin a drag whose dataTransfer carries no
              // data. The payload stays empty on purpose: the reorder replays
              // `source` through `moveBlock`, never a parsed slice, so this
              // drag cannot reparent into a list or a table cell and cannot be
              // dropped into a different editor.
              event.dataTransfer?.setData('text/plain', '');
              if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';

              // A `dragstart` that arrives while one is already recorded would
              // otherwise strand the previous drag image on `document.body`,
              // where nothing else reaches it.
              ghost?.remove();
              // Cloned *before* the source is dimmed: the clone carries
              // resolved computed styles, so dimming first would bake the
              // reduced opacity into the drag image.
              ghost = createGhostElement(slot.element, layerScale(mount));
              event.dataTransfer?.setDragImage(
                ghost,
                getComputedStyle(view.dom).direction === 'rtl'
                  ? ghost.offsetWidth
                  : 0,
                0,
              );

              sourceElement = slot.element;
              sourceElement.classList.add(MLV_EDITOR_DRAG_SOURCE_CLASS);
              view.dom.classList.add(MLV_EDITOR_DRAGGING_CLASS);
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
              // Only the preview goes — the partition closes and the line
              // retracts. The drag itself is still in flight, and re-entering
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
              // Captured before `endDrag` discards the snapshot. These are the
              // pre-partition tops, which is exactly the FLIP's "before": the
              // partition's transforms are cleared by `endDrag` in the same
              // turn, so nothing the user saw shifted is measured as movement.
              const tops = slots.map((slot) => slot.top);

              endDrag();
              if (to === null) return;
              editor.commands.moveBlock({ from, to });
              settle(tops, from, to);
            };

            const onKeyDown = (event: KeyboardEvent) => {
              if (event.key === 'Escape' && source !== null) endDrag();
            };

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
            // independent of that.
            document.addEventListener('keydown', onKeyDown);

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
                if (previous.doc !== updated.state.doc && source !== null) {
                  endDrag();
                }

                if (options.enabled()) return;
                hide();
                // Retracts the preview and drops the in-flight source, so
                // releasing the button after the revocation cannot reorder
                // anything. Previously the line went through `decorations`,
                // which read `enabled()` itself; a mount-owned element has to
                // be told.
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
                document.removeEventListener('keydown', onKeyDown);
                handle.remove();
                indicator.remove();
                // A drag interrupted by teardown leaves its drag image on
                // `document.body`, outside everything else this removes.
                ghost?.remove();
              },
            };
          },
        }),
      ];
    },
  });
