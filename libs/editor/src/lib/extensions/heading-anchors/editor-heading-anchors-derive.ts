import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

/**
 * @internal Default heading slug:
 * 1. NFKC-normalize the text;
 * 2. lower-case it without a locale (`toLowerCase`, never `toLocaleLowerCase`,
 *    so the same text slugs the same on every machine);
 * 3. drop every character that is not a letter, mark, number, whitespace or
 *    `-` (punctuation, symbols and emoji go);
 * 4. trim, turn whitespace runs into `-`, collapse repeated `-` and trim `-`.
 * An empty result means "no anchor".
 */
export const slugifyHeading = (text: string): string =>
  text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/gu, '-')
    .replace(/-+/gu, '-')
    .replace(/^-|-$/gu, '');

/** @internal One anchor write: set `anchor` of the heading at `pos`. */
export interface MlvHeadingAnchorAssignment {
  readonly pos: number;
  readonly anchor: string | null;
}

/** @private Smallest memo bound, so a short document keeps some typing history. */
const MIN_SLUG_MEMO_SIZE = 512;

/**
 * @internal A memoized slug function. {@link planHeadingAnchors} calls
 * {@link MlvHeadingSlugMemo.fit} with the live heading count before it slugs,
 * so the bound always covers the document.
 */
export interface MlvHeadingSlugMemo {
  (text: string): string;
  /**
   * Sizes the bound to `max(512, 2 × headings)`: room for every live heading
   * plus as many stale texts, so a recompute of an unchanged heading hits even
   * past 512 headings.
   */
  fit(headings: number): void;
}

/**
 * @internal Memoizes a slug function per heading text. The memo is dropped
 * once it grows past its bound, since every intermediate text a user types
 * into a heading would otherwise stay in it for the editor's life; the bound
 * follows the document through {@link MlvHeadingSlugMemo.fit}.
 */
export const memoizeSlug = (
  slugify: (text: string) => string,
): MlvHeadingSlugMemo => {
  let memo = new Map<string, string>();
  let bound = MIN_SLUG_MEMO_SIZE;
  const lookup = (text: string): string => {
    const cached = memo.get(text);
    if (cached !== undefined) return cached;
    if (memo.size >= bound) memo = new Map();
    const slug = slugify(text);
    memo.set(text, slug);
    return slug;
  };
  return Object.assign(lookup, {
    fit: (headings: number): void => {
      bound = Math.max(MIN_SLUG_MEMO_SIZE, 2 * headings);
    },
  });
};

/** @private A heading's position, stored anchor and text. */
interface HeadingText {
  readonly pos: number;
  readonly current: string | null;
  readonly text: string;
}

/**
 * @internal The anchor writes that make every heading's `anchor` match its
 * text. Dedupes in document order: the first use of a slug keeps it, and a
 * repeat takes `<slug>-N` from a per-slug counter, re-checked against every
 * slug already taken. "Intro", "Intro", "Intro 1" gives `intro`, `intro-1`,
 * `intro-1-1`. Only later headings are ever suffixed, so adding a heading
 * never renames one above it. The suffixes follow github-slugger's order; the
 * slugs do not match GitHub's, since {@link slugifyHeading} strips `_`,
 * collapses `-` runs and applies NFKC.
 *
 * @param slug Slug function; a {@link MlvHeadingSlugMemo} is sized to the
 * document before any heading is slugged.
 */
export const planHeadingAnchors = (
  doc: ProseMirrorNode,
  slug: ((text: string) => string) & Partial<Pick<MlvHeadingSlugMemo, 'fit'>>,
): MlvHeadingAnchorAssignment[] => {
  const headings: HeadingText[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name === 'heading') {
      const current: unknown = node.attrs['anchor'];
      headings.push({
        pos,
        current: typeof current === 'string' && current !== '' ? current : null,
        text: node.textContent,
      });
    }
    return !node.isTextblock;
  });
  slug.fit?.(headings.length);
  const occurrences = new Map<string, number>();
  const assignments: MlvHeadingAnchorAssignment[] = [];
  for (const heading of headings) {
    const base = slug(heading.text);
    let anchor: string | null = null;
    if (base !== '') {
      anchor = base;
      while (occurrences.has(anchor)) {
        const count = (occurrences.get(base) ?? 0) + 1;
        occurrences.set(base, count);
        anchor = `${base}-${count}`;
      }
      occurrences.set(anchor, 0);
    }
    if (anchor !== heading.current) {
      assignments.push({ pos: heading.pos, anchor });
    }
  }
  return assignments;
};
