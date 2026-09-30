import type { EditorView } from '@tiptap/pm/view';

/** @internal ProseMirror's default `scrollMargin`. */
const PROSEMIRROR_DEFAULT_SCROLL_MARGIN = 5;

/** @internal What one active-tracking frame reads from the scroller. */
export interface MlvEditorTocScrollerFrame {
  /** Client-coordinate top of the scroller's content box (`0` for the page). */
  readonly top: number;
  /** Client-coordinate bottom of the scroller's visible area. */
  readonly bottom: number;
  /** Whether the scroller overflows and is scrolled to its end. */
  readonly atEnd: boolean;
}

/**
 * @internal The element whose scrolling moves the editor's headings:
 * a capped editor's viewport (only capped editors scroll), else the nearest
 * ancestor of the content that scrolls on the block axis and overflows, else
 * the document's scrolling element. Walks until the first match.
 */
export function mlvEditorTocScroller(
  content: HTMLElement,
  document: Document,
): HTMLElement {
  const viewport = content.closest<HTMLElement>('.mlv-editor__viewport');
  if (
    viewport?.closest('.mlv-editor')?.classList.contains('mlv-editor--capped')
  ) {
    return viewport;
  }
  const root = mlvEditorTocRootScroller(document);
  const view = document.defaultView;
  for (
    let node = content.parentElement;
    node && node !== root && node !== document.body;
    node = node.parentElement
  ) {
    const overflow = view?.getComputedStyle(node).overflowY;
    if (
      (overflow === 'auto' ||
        overflow === 'scroll' ||
        overflow === 'overlay') &&
      node.scrollHeight > node.clientHeight
    ) {
      return node;
    }
  }
  return root;
}

/** @internal The document's scrolling element. */
export function mlvEditorTocRootScroller(document: Document): HTMLElement {
  return (
    (document.scrollingElement as HTMLElement | null) ??
    document.documentElement
  );
}

/**
 * @internal The scroller's edges and end state. One `getBoundingClientRect`
 * for a nested scroller, none for the page.
 */
export function mlvEditorTocScrollerFrame(
  scroller: HTMLElement,
  document: Document,
): MlvEditorTocScrollerFrame {
  const scrollable = scroller.scrollHeight > scroller.clientHeight + 1;
  const atEnd =
    scrollable &&
    scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1;
  if (scroller === mlvEditorTocRootScroller(document)) {
    const height = document.defaultView?.innerHeight ?? scroller.clientHeight;
    return { top: 0, bottom: height, atEnd };
  }
  const rect = scroller.getBoundingClientRect();
  const top = rect.top + scroller.clientTop;
  return { top, bottom: top + scroller.clientHeight, atEnd };
}

/**
 * @internal ProseMirror's live `scrollMargin.top` — the sticky toolbar
 * band's clearance when `mlv-editor` publishes one, else ProseMirror's
 * default.
 */
export function mlvEditorTocProseMirrorMargin(view: EditorView): number {
  const margin = view.someProp('scrollMargin');
  if (typeof margin === 'number') return margin;
  return margin?.top ?? PROSEMIRROR_DEFAULT_SCROLL_MARGIN;
}

/** @internal A heading's computed `scroll-margin-block-start`, in px. */
export function mlvEditorTocHeadingMargin(element: Element): number {
  const view = element.ownerDocument.defaultView;
  const value = view?.getComputedStyle(element).scrollMarginBlockStart ?? '';
  const margin = Number.parseFloat(value);
  return Number.isFinite(margin) ? margin : 0;
}

/**
 * @internal A heading's viewport top, or `null` when it is not laid out: a
 * missing element, or one with an all-zero rect (`display: none`, e.g.
 * inside a collapsed block), whose `top` of 0 says nothing about where it
 * sits.
 */
export function mlvEditorTocPlacedTop(element: Element | null): number | null {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  return rect.width === 0 && rect.height === 0 && rect.top === 0
    ? null
    : rect.top;
}

/**
 * @internal Index of the last of `count` non-decreasing tops that is at or
 * above `threshold` (`strict`: above it), or `-1`. A binary search: at most
 * ⌈log₂(count + 1)⌉ calls to `top`. The caller keeps the tops
 * non-decreasing; an unplaced heading takes the next placed one's top.
 */
export function mlvEditorTocLastIndexAbove(
  count: number,
  top: (index: number) => number,
  threshold: number,
  strict: boolean,
): number {
  let low = 0;
  let high = count - 1;
  let found = -1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    const value = top(middle);
    if (strict ? value < threshold : value <= threshold) {
      found = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return found;
}
