import type { Editor } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { EditorState, Transaction } from '@tiptap/pm/state';
import { NodeSelection, Plugin, PluginKey } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import type {
  MlvEditorBlockHandleInsertOptions,
  MlvEditorBlockHandleInsertRequest,
} from './editor-block-handle';

/**
 * @internal The clean-mode block inserter (#516, U6): the gutter "+" beside
 * the drag handle, its touch placement, the `Mod-Alt-Enter` chord and the
 * command menu's target preview (D-B2). Created by the block-handle plugin
 * view when `MlvEditorBlockHandleOptions.insert` is set; nothing here is in
 * the public barrel.
 */

/** @internal Plugin key of the chord plugin, one per editor. */
export const MLV_EDITOR_BLOCK_INSERT_KEY = new PluginKey(
  'mlvEditorBlockInsert',
);

/** @internal BEM class of the gutter "+". */
export const MLV_EDITOR_BLOCK_ADD_CLASS = 'mlv-editor__block-add';

/** @internal BEM class of the empty-paragraph target preview. */
export const MLV_EDITOR_BLOCK_TARGET_CLASS = 'mlv-editor__block-target';

/**
 * @internal Whether ProseMirror reads `Mod` as Meta here. The same test
 * `prosemirror-keymap` uses, so the chord, its `aria-keyshortcuts` spelling
 * and every other `Mod-` binding agree on one platform answer.
 */
export function mlvEditorIsApplePlatform(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    /Mac|iP(hone|[oa]d)/.test(navigator.platform ?? '')
  );
}

/**
 * @internal Whether a keydown is the `Mod-Alt-Enter` chord.
 *
 * A keydown reporting `AltGraph` is ignored (D-B6): on layouts where AltGr
 * types characters, AltGr+Enter must never open a menu. Firefox reports
 * `AltGraph` for more than AltGr (see the #516 report), which this guard
 * accepts as ruled.
 */
export function mlvEditorIsInsertChord(
  event: KeyboardEvent,
  apple = mlvEditorIsApplePlatform(),
): boolean {
  if (event.key !== 'Enter' || !event.altKey || event.shiftKey) return false;
  if (event.getModifierState?.('AltGraph')) return false;
  return apple
    ? event.metaKey && !event.ctrlKey
    : event.ctrlKey && !event.metaKey;
}

/** @internal Document position where the given top-level child begins. */
function topLevelStart(doc: ProseMirrorNode, index: number): number {
  let position = 0;
  for (let i = 0; i < index; i += 1) position += doc.child(i).nodeSize;
  return position;
}

/**
 * @internal Position before the top-level block the selection speaks for: a
 * top-level `NodeSelection`'s own node, else the block holding the head.
 * `null` for an empty document. Takes a state or a transaction (both carry
 * `doc` and `selection`), so a chain step resolves against its own steps.
 */
export function mlvEditorInsertSourcePos(
  state: Pick<EditorState, 'doc' | 'selection'>,
): number | null {
  const { doc, selection } = state;
  if (doc.childCount === 0) return null;
  if (selection instanceof NodeSelection && selection.$from.depth === 0) {
    return selection.from;
  }
  const { $head } = selection;
  if ($head.depth > 0) return $head.before(1);
  return topLevelStart(doc, Math.min($head.index(0), doc.childCount - 1));
}

/** @internal Whether a block is an empty paragraph, converted in place. */
export function mlvEditorIsEmptyParagraph(node: ProseMirrorNode): boolean {
  return node.type.name === 'paragraph' && node.content.size === 0;
}

/** @internal A plain `DOMRect`-shaped value; jsdom has no `DOMRect` constructor. */
function rectOf(left: number, top: number, width: number, height: number) {
  return {
    x: left,
    y: top,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    toJSON: () => ({ left, top, width, height }),
  } as DOMRect;
}

/** @internal The mount's viewport top and live zoom, from one rect read. */
function frameOf(mount: HTMLElement): { top: number; scale: number } {
  const rect = mount.getBoundingClientRect();
  const width = mount.offsetWidth;
  return {
    top: rect.top,
    scale: width && rect.width > 0 ? rect.width / width : 1,
  };
}

/**
 * @internal Whether `element` sits in a right-to-left scope: the nearest
 * explicit `dir` (`auto` is transparent), as `MlvRtlService.resolveDirection`
 * walks it. A plugin view has no injector, so the walk is repeated here; the
 * root element's `dir` ends it, the document default being LTR.
 */
function isRtlScope(element: Element): boolean {
  for (let node: Element | null = element; node; node = node.parentElement) {
    const dir = node.getAttribute('dir')?.toLowerCase();
    if (dir === 'rtl' || dir === 'ltr') return dir === 'rtl';
  }
  return false;
}

/** @internal The rendered box of the top-level block at `pos`, if any. */
function blockElement(view: EditorView, pos: number): HTMLElement | null {
  const dom = view.nodeDOM(pos);
  return dom instanceof HTMLElement ? dom : null;
}

/** @internal What the handle plugin view hands its inserter. */
export interface MlvEditorBlockInserterHost {
  readonly view: EditorView;
  readonly editor: Editor;
  readonly mount: HTMLElement;
  /** The drag's drop line, reused as the "after the source" preview. */
  readonly indicator: HTMLElement;
  readonly insert: MlvEditorBlockHandleInsertOptions;
}

/** @internal The inserter half the handle plugin view drives. */
export interface MlvEditorBlockInserter {
  /** Shows the "+" beside the block the handle just published. */
  publish(top: string, index: number): void;
  /** Retracts the "+" with the handle. */
  hide(): void;
  /** Runs from the handle's `update`: gate, touch placement, preview. */
  update(): void;
  /** Viewport rect of the "+" slot beside the block box `block`. */
  slotRect(block: DOMRect): DOMRect;
  /** Shows the command menu's target preview for the selection (D-B2). */
  showPreview(): void;
  /** Retracts the preview. */
  hidePreview(): void;
  /** Unbinds everything; the handle's `destroy` calls it. */
  destroy(): void;
}

/** @internal Inserters by view, for the chord plugin and the command menu. */
const INSERTERS = new WeakMap<EditorView, MlvEditorBlockInserter>();

/** @internal The inserter living in `view`'s handle plugin view, if any. */
export function mlvEditorBlockInserter(
  view: EditorView,
): MlvEditorBlockInserter | undefined {
  return INSERTERS.get(view);
}

/**
 * @internal Viewport rect of the "+" slot beside the top-level block at
 * `pos`: the menu anchor for the chord and the bubble's insert button. With
 * no inserter (no mount), the block's own inline-start edge stands in.
 */
export function mlvEditorInsertSlotRect(
  view: EditorView,
  pos: number,
): DOMRect {
  const box =
    blockElement(view, pos)?.getBoundingClientRect() ?? rectOf(0, 0, 0, 0);
  const inserter = INSERTERS.get(view);
  if (inserter) return inserter.slotRect(box);
  const rtl = isRtlScope(view.dom);
  return rectOf(rtl ? box.right : box.left, box.top, 0, box.height);
}

/**
 * @internal Opens the insert menu for the caret's top-level block, scrolled
 * into view first: the chord's action.
 */
export function mlvEditorOpenInsertForCaret(
  view: EditorView,
  insert: MlvEditorBlockHandleInsertOptions,
): void {
  const pos = mlvEditorInsertSourcePos(view.state);
  if (pos === null) return;
  blockElement(view, pos)?.scrollIntoView?.({ block: 'nearest' });
  insert.open({
    pos,
    rect: mlvEditorInsertSlotRect(view, pos),
    via: 'keyboard',
  });
}

/**
 * @internal The chord plugin. A keymap binding cannot see the event's
 * `AltGraph` state, so the chord is a `handleKeyDown` prop; outside an
 * enabled inserter it returns `false` and the key reaches the browser.
 */
export function mlvEditorBlockInsertPlugin(
  insert: MlvEditorBlockHandleInsertOptions,
): Plugin {
  return new Plugin({
    key: MLV_EDITOR_BLOCK_INSERT_KEY,
    props: {
      handleKeyDown: (view, event) => {
        if (!mlvEditorIsInsertChord(event) || !insert.enabled()) return false;
        mlvEditorOpenInsertForCaret(view, insert);
        return true;
      },
    },
  });
}

/**
 * @internal How long a touch press on the "+" keeps it shown without content
 * focus, and how long after its release a stray `click` is ignored (§ 17
 * item 8: the prevented press keeps content focus in Chromium and WebKit; a
 * real device's virtual keyboard is unmeasured).
 */
const MLV_EDITOR_BLOCK_ADD_PRESS_GRACE = 750;

/**
 * @internal How far, in CSS px, a touch or pen press on the "+" may travel
 * and still count as a tap. Past it the release is a drag — a scroll the
 * page did not claim with a `pointercancel` — and opens nothing.
 */
export const MLV_EDITOR_BLOCK_ADD_PRESS_SLOP = 10;

/**
 * @internal Creates the gutter "+" in `ownerDocument`, the mount's. A static
 * Lucide `plus` built as markup, as the handle builds its grip; sized and
 * stroked by the clean stylesheet.
 */
function createAddElement(ownerDocument: Document): HTMLElement {
  const element = ownerDocument.createElement('div');
  element.className = MLV_EDITOR_BLOCK_ADD_CLASS;
  element.setAttribute('aria-hidden', 'true');
  element.setAttribute('data-visible', 'false');
  element.innerHTML =
    '<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">' +
    '<path d="M5 12h14"/><path d="M12 5v14"/></svg>';
  return element;
}

/** @internal Creates the empty-paragraph target preview (D-B2). */
function createTargetElement(ownerDocument: Document): HTMLElement {
  const element = ownerDocument.createElement('div');
  element.className = MLV_EDITOR_BLOCK_TARGET_CLASS;
  element.setAttribute('aria-hidden', 'true');
  element.setAttribute('data-visible', 'true');
  return element;
}

/**
 * @internal Creates the inserter for one handle plugin view.
 *
 * The "+" is attached to the mount only while `insert.enabled()` holds, so
 * an appearance that never enables it (`'bar'`, `'floating'`) keeps the
 * mount exactly as before. It shows beside the block the handle publishes;
 * under `(hover: none)` it follows the caret's block instead while the
 * content has focus. Its block position is mapped through every document
 * change and it hides when that block's opening token is deleted, which
 * covers a whole-document replace.
 *
 * Raw listeners: the handle's documented exception (a ProseMirror plugin view
 * with its own `destroy()`, no injection context); `destroy()` unbinds them.
 */
export function createMlvEditorBlockInserter(
  host: MlvEditorBlockInserterHost,
): MlvEditorBlockInserter {
  const { view, editor, mount, indicator, insert } = host;
  const ownerDocument = mount.ownerDocument;
  const element = createAddElement(ownerDocument);
  let attached = false;

  /** Position before the block the "+" speaks for, or null while hidden. */
  let pos: number | null = null;
  /** The document `pos` addresses, so mapping never runs twice. */
  let posDoc: ProseMirrorNode | null = null;
  /** A touch press on the "+" is in flight (item 8 fallback). */
  let pressing = false;
  /**
   * A touch or pen release already handled the press (opened the menu, or
   * found a drag); its click is ignored.
   */
  let openedByPress = false;
  let pressTimer: ReturnType<typeof setTimeout> | undefined;
  /** Where the touch or pen press started, for the tap slop. */
  let pressX = 0;
  let pressY = 0;

  let previewing = false;
  let target: HTMLElement | null = null;
  /** The indicator `top` the preview wrote, so a drag's is never retracted. */
  let indicatorTop: string | null = null;

  const touchQuery =
    ownerDocument.defaultView?.matchMedia?.('(hover: none)') ?? null;
  let touch = touchQuery?.matches ?? false;

  const detach = () => {
    pos = null;
    posDoc = null;
    if (!attached) return;
    element.remove();
    element.setAttribute('data-visible', 'false');
    attached = false;
  };

  const show = (top: string, at: number) => {
    if (!insert.enabled()) return detach();
    if (!attached) {
      mount.appendChild(element);
      attached = true;
    }
    pos = at;
    posDoc = view.state.doc;
    const label = insert.label();
    if (element.style.top !== top) element.style.top = top;
    if (element.title !== label) element.title = label;
    if (element.getAttribute('data-visible') !== 'true') {
      element.setAttribute('data-visible', 'true');
    }
  };

  const hide = () => {
    pos = null;
    posDoc = null;
    if (attached && element.getAttribute('data-visible') !== 'false') {
      element.setAttribute('data-visible', 'false');
    }
  };

  const placeAtCaret = () => {
    const at = mlvEditorInsertSourcePos(view.state);
    const box = at === null ? null : blockElement(view, at);
    if (at === null || !box) return hide();
    const frame = frameOf(mount);
    show(
      `${(box.getBoundingClientRect().top - frame.top) / frame.scale}px`,
      at,
    );
  };

  const releaseIndicator = () => {
    if (indicatorTop !== null && indicator.style.top === indicatorTop) {
      indicator.setAttribute('data-visible', 'false');
    }
    indicatorTop = null;
  };

  const renderPreview = () => {
    const at = mlvEditorInsertSourcePos(view.state);
    const node = at === null ? null : view.state.doc.nodeAt(at);
    const box = at === null ? null : blockElement(view, at);
    if (at === null || !node || !box) {
      target?.remove();
      return releaseIndicator();
    }
    const frame = frameOf(mount);
    const rect = box.getBoundingClientRect();
    if (mlvEditorIsEmptyParagraph(node)) {
      releaseIndicator();
      target ??= createTargetElement(ownerDocument);
      if (!target.isConnected) mount.appendChild(target);
      target.style.top = `${(rect.top - frame.top) / frame.scale}px`;
      target.style.height = `${rect.height / frame.scale}px`;
      return;
    }
    target?.remove();
    const next = blockElement(view, at + node.nodeSize);
    const y = next
      ? (rect.bottom + next.getBoundingClientRect().top) / 2
      : rect.bottom;
    indicatorTop = `${(y - frame.top) / frame.scale}px`;
    indicator.style.top = indicatorTop;
    indicator.setAttribute('data-visible', 'true');
  };

  const update = () => {
    if (!insert.enabled()) {
      detach();
    } else if (touch) {
      if (view.hasFocus() || pressing) placeAtCaret();
      else hide();
    }
    if (previewing) renderPreview();
  };

  const onTransaction = ({
    transaction,
    appendedTransactions,
  }: {
    transaction: Transaction;
    appendedTransactions: readonly Transaction[];
  }) => {
    for (const tr of [transaction, ...appendedTransactions]) {
      if (pos === null || tr.before !== posDoc) continue;
      const mapped = tr.mapping.mapResult(pos, 1);
      if (mapped.deletedAfter) return hide();
      pos = mapped.pos;
      posDoc = tr.doc;
    }
  };

  const clearPress = () => {
    clearTimeout(pressTimer);
    pressTimer = undefined;
    pressing = false;
    openedByPress = false;
  };

  const openMenu = () => {
    if (pos === null || !insert.enabled()) return;
    const request: MlvEditorBlockHandleInsertRequest = {
      pos,
      rect: element.getBoundingClientRect(),
      via: 'pointer',
    };
    insert.open(request);
  };

  // The content keeps focus and selection, as the bubble pane does; the
  // handle's `draggable` is not on this element, so no drag starts either.
  const onPointerDown = (event: PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    clearPress();
    pressing = event.pointerType !== 'mouse';
    pressX = event.clientX;
    pressY = event.clientY;
  };

  // A touch or pen press opens on release: WebKit sends no `click` after a
  // touch `pointerdown` whose default is prevented (measured in the #516
  // e2e), so waiting for one would leave the tap dead there. A `pointercancel`
  // (the page started panning) clears the press first, so a pan opens nothing;
  // a press that travelled past the slop without one is a drag and opens
  // nothing either.
  const onPointerUp = (event: PointerEvent) => {
    if (!pressing) return;
    openedByPress = true;
    const travelled = Math.hypot(
      event.clientX - pressX,
      event.clientY - pressY,
    );
    if (travelled <= MLV_EDITOR_BLOCK_ADD_PRESS_SLOP) openMenu();
    clearTimeout(pressTimer);
    pressTimer = setTimeout(clearPress, MLV_EDITOR_BLOCK_ADD_PRESS_GRACE);
  };

  // Cancels the compatibility mouse events and `click` after a touch release
  // (Chromium sends them), so the popup's document click listener never
  // counts the press as a click outside the menu it just opened. Explicitly
  // not passive: the handler calls `preventDefault()`.
  const onTouchEnd = (event: TouchEvent) => {
    if (event.cancelable) event.preventDefault();
  };

  const onClick = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const pressed = openedByPress;
    clearPress();
    if (!pressed) openMenu();
  };

  const onTouchChange = (event: MediaQueryListEvent) => {
    touch = event.matches;
    hide();
    update();
  };

  element.addEventListener('pointerdown', onPointerDown);
  element.addEventListener('pointerup', onPointerUp);
  element.addEventListener('pointercancel', clearPress);
  element.addEventListener('touchend', onTouchEnd, { passive: false });
  element.addEventListener('click', onClick);
  touchQuery?.addEventListener?.('change', onTouchChange);
  editor.on('transaction', onTransaction);

  const inserter: MlvEditorBlockInserter = {
    publish: (top, index) => {
      if (touch) return;
      const { doc } = view.state;
      if (index < 0 || index >= doc.childCount) return hide();
      show(top, topLevelStart(doc, index));
    },
    hide,
    update,
    slotRect: (block) => {
      const own = attached ? element.getBoundingClientRect() : null;
      if (own && own.width > 0) {
        return rectOf(own.left, block.top, own.width, own.height);
      }
      const rtl = isRtlScope(view.dom);
      return rectOf(rtl ? block.right : block.left, block.top, 0, block.height);
    },
    showPreview: () => {
      previewing = true;
      renderPreview();
    },
    hidePreview: () => {
      previewing = false;
      target?.remove();
      releaseIndicator();
    },
    destroy: () => {
      element.removeEventListener('pointerdown', onPointerDown);
      element.removeEventListener('pointerup', onPointerUp);
      element.removeEventListener('pointercancel', clearPress);
      element.removeEventListener('touchend', onTouchEnd);
      element.removeEventListener('click', onClick);
      touchQuery?.removeEventListener?.('change', onTouchChange);
      editor.off('transaction', onTransaction);
      clearPress();
      element.remove();
      target?.remove();
      releaseIndicator();
      INSERTERS.delete(view);
    },
  };
  INSERTERS.set(view, inserter);
  return inserter;
}
