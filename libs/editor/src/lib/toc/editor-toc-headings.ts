import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { MlvEditorHeadingLevel } from '../toolbar/editor-heading';

/** One entry of `nav[mlvEditorToc]`. */
export interface MlvEditorTocItem {
  /** The heading's unprefixed anchor (`attrs.anchor`, from `headingAnchors`). */
  readonly anchor: string;
  /** The heading element's `id`: the extension's `idPrefix` + `anchor`. */
  readonly id: string;
  /** The heading level. */
  readonly level: MlvEditorHeadingLevel;
  /** The heading text, trimmed with its whitespace collapsed. */
  readonly text: string;
  /**
   * The link from `MLV_EDITOR_HEADING_LINKS`. `null` until the first browser
   * render: the builder may read browser globals, so a server-rendered TOC
   * carries its items without links until hydration.
   *
   * Resolved once per item, against the location when the item is built, and
   * kept while the heading's id, level and text are unchanged. In-app
   * navigation that leaves the editor mounted (a new query string, say) does
   * not rebuild it, so a builder reading the current URL goes stale.
   */
  readonly href: string | null;
}

/** @internal A heading as the walk finds it, before filtering and links. */
export interface MlvEditorTocHeading {
  readonly anchor: string;
  readonly level: MlvEditorHeadingLevel;
  readonly text: string;
}

/** @internal One node of the rendered tree; `depth` is its nesting depth. */
export interface MlvEditorTocNode {
  readonly item: MlvEditorTocItem;
  readonly depth: number;
  readonly children: readonly MlvEditorTocNode[];
}

/**
 * @internal Headings per top-level block, reused while the block node is the
 * same object (ProseMirror shares unchanged nodes between documents).
 */
export type MlvEditorTocMemo = Pick<
  WeakMap<ProseMirrorNode, readonly MlvEditorTocHeading[]>,
  'get' | 'set'
>;

/** @internal No headings, shared so an empty block allocates nothing. */
const NONE: readonly MlvEditorTocHeading[] = [];

/**
 * @internal Every anchored heading of `doc`, in document order, including
 * headings nested in blockquotes and list items (the walk N1's decorations
 * use). A heading without an anchor, or with a level outside 1–6, is left
 * out. Unchanged top-level blocks are read from `memo`.
 */
export function collectMlvEditorTocHeadings(
  doc: ProseMirrorNode,
  memo: MlvEditorTocMemo,
): readonly MlvEditorTocHeading[] {
  const headings: MlvEditorTocHeading[] = [];
  doc.forEach((block) => {
    let found = memo.get(block);
    if (!found) {
      found = blockHeadings(block);
      memo.set(block, found);
    }
    for (const heading of found) headings.push(heading);
  });
  return headings;
}

/** @internal The anchored headings in one top-level block. */
function blockHeadings(block: ProseMirrorNode): readonly MlvEditorTocHeading[] {
  if (block.type.name === 'heading') {
    const heading = toHeading(block);
    return heading ? [heading] : NONE;
  }
  // A paragraph or code block holds no heading: skip the walk.
  if (block.isTextblock || block.isLeaf) return NONE;
  const found: MlvEditorTocHeading[] = [];
  block.descendants((node) => {
    if (node.type.name !== 'heading') return !node.isTextblock;
    const heading = toHeading(node);
    if (heading) found.push(heading);
    return false;
  });
  return found.length ? found : NONE;
}

/** @internal A heading entry, or `null` without an anchor or a known level. */
function toHeading(node: ProseMirrorNode): MlvEditorTocHeading | null {
  const anchor: unknown = node.attrs['anchor'];
  const level: unknown = node.attrs['level'];
  if (typeof anchor !== 'string' || anchor === '') return null;
  if (!isHeadingLevel(level)) return null;
  return {
    anchor,
    level,
    text: node.textContent.replace(/\s+/g, ' ').trim(),
  };
}

/** @internal Whether `value` is a heading level Tiptap's node supports. */
function isHeadingLevel(value: unknown): value is MlvEditorHeadingLevel {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 6
  );
}

/** @internal Entry-wise equality on anchor, level and text. */
export function mlvEditorTocHeadingsEqual(
  a: readonly MlvEditorTocHeading[],
  b: readonly MlvEditorTocHeading[],
): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let index = 0; index < a.length; index++) {
    const left = a[index];
    const right = b[index];
    if (
      left.anchor !== right.anchor ||
      left.level !== right.level ||
      left.text !== right.text
    ) {
      return false;
    }
  }
  return true;
}

/**
 * @internal Nests `items` with a level stack: a deeper item nests under the
 * previous shallower one, and a skipped level (h1 → h3) nests one step with
 * no empty wrapper.
 */
export function nestMlvEditorTocItems(
  items: readonly MlvEditorTocItem[],
): readonly MlvEditorTocNode[] {
  const roots: MlvEditorTocNode[] = [];
  const stack: { level: number; children: MlvEditorTocNode[] }[] = [];
  for (const item of items) {
    while (stack.length && stack[stack.length - 1].level >= item.level) {
      stack.pop();
    }
    const children: MlvEditorTocNode[] = [];
    const node: MlvEditorTocNode = { item, depth: stack.length, children };
    (stack.length ? stack[stack.length - 1].children : roots).push(node);
    stack.push({ level: item.level, children });
  }
  return roots;
}

/** @internal Position of the first heading carrying `anchor`, or `null`. */
export function mlvEditorTocHeadingPos(
  doc: ProseMirrorNode,
  anchor: string,
): number | null {
  let found: number | null = null;
  doc.descendants((node, pos) => {
    if (found !== null) return false;
    if (node.type.name !== 'heading') return !node.isTextblock;
    if (node.attrs['anchor'] === anchor) found = pos;
    return false;
  });
  return found;
}
