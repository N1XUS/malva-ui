import { normalizeForMatch } from '@malva-ui/cdk/utils';
import type { MlvSelectOption } from './select-option';

export { normalizeForMatch };

/**
 * A contiguous slice of a label produced by {@link matchSegments}, tagged with
 * whether it is part of the query match. Rendered by consumers (e.g. the
 * dropdown panel's suggestion highlighting) as `<mark>` for matched slices and
 * plain text otherwise.
 */
export interface MlvMatchSegment {
  /** The original (non-folded) label text for this slice. */
  readonly text: string;
  /** Whether this slice is part of the matched query substring. */
  readonly matched: boolean;
}

/**
 * Predicate deciding whether an option satisfies the current query. The default
 * ({@link defaultOptionMatcher}) is a case- and diacritic-insensitive substring
 * match on the option label. Provide a custom matcher to a combobox / the
 * `[mlvAutocomplete]` directive to change how suggestions are filtered (e.g.
 * fuzzy, token-prefix, or matching against a secondary field).
 *
 * A matcher receives the already-trimmed, non-empty query — an empty query is
 * short-circuited by {@link filterOptions} to return every option.
 */
export type MlvOptionMatcher<T> = (
  option: MlvSelectOption<T>,
  query: string,
) => boolean;

/**
 * The default option matcher: a case- and diacritic-insensitive substring match
 * on {@link MlvSelectOption.label}. An empty (or whitespace-only) query matches
 * every option.
 *
 * @param option - The option to test.
 * @param query - The current search query (already trimmed by callers).
 * @returns Whether the option label contains the query.
 */
export function defaultOptionMatcher<T>(
  option: MlvSelectOption<T>,
  query: string,
): boolean {
  const q = normalizeForMatch(query.trim());
  if (!q) return true;
  return normalizeForMatch(option.label).includes(q);
}

/**
 * Filters a list of resolved options against a query using `matcher`
 * ({@link defaultOptionMatcher} by default), then ranks **prefix matches
 * first** ({@link rankPrefixMatchesFirst}) so the top suggestion is the one an
 * inline completion can extend (`"Pe"` ranks `"Pear"` above `"Grape"`). A blank
 * query returns a shallow copy of every option — the "show everything" state a
 * combobox / autocomplete shows on focus. This is the single shared
 * implementation of the substring filter that previously lived inline in
 * `mlv-combobox`.
 *
 * @param options - The resolved options to filter.
 * @param query - The raw search query (trimmed internally).
 * @param matcher - Optional custom predicate; defaults to substring matching.
 * @returns The matcher-satisfying options, prefix matches ranked first (all
 *   options, unranked, for a blank query).
 */
export function filterOptions<T>(
  options: readonly MlvSelectOption<T>[],
  query: string,
  matcher: MlvOptionMatcher<T> = defaultOptionMatcher,
): MlvSelectOption<T>[] {
  const q = query.trim();
  if (!q) return [...options];
  return rankPrefixMatchesFirst(
    options.filter((option) => matcher(option, q)),
    q,
  );
}

/**
 * Stable-partitions filtered options so labels that **start with** the query
 * (case- and diacritic-insensitive) come before the remaining matches, keeping
 * the original relative order inside each partition.
 *
 * Grouped options ({@link MlvSelectOption.group}) are ranked **within each
 * consecutive same-group run** only — runs themselves never move or merge, so
 * the panel's consecutive-run group rendering (sticky headers, flat-index
 * alignment) is preserved. An ungrouped list is a single run and gets the full
 * prefix-first ordering.
 *
 * @param options - The already-filtered options.
 * @param query - The trimmed, non-empty query.
 * @returns The options with prefix matches ranked first per group run.
 */
export function rankPrefixMatchesFirst<T>(
  options: readonly MlvSelectOption<T>[],
  query: string,
): MlvSelectOption<T>[] {
  const q = normalizeForMatch(query);
  const ranked: MlvSelectOption<T>[] = [];
  let runStart = 0;
  for (let i = 1; i <= options.length; i++) {
    const runEnded =
      i === options.length ||
      (options[i].group ?? '') !== (options[runStart].group ?? '');
    if (!runEnded) continue;
    const run = options.slice(runStart, i);
    const prefixed: MlvSelectOption<T>[] = [];
    const rest: MlvSelectOption<T>[] = [];
    for (const option of run) {
      (normalizeForMatch(option.label).startsWith(q) ? prefixed : rest).push(
        option,
      );
    }
    ranked.push(...prefixed, ...rest);
    runStart = i;
  }
  return ranked;
}

/**
 * Splits `label` into matched / unmatched {@link MlvMatchSegment}s for the first
 * occurrence of `query`, so consumers can emphasise the matched substring in a
 * suggestion (e.g. wrapping matched slices in `<mark>`).
 *
 * Matching is case- and diacritic-insensitive ({@link normalizeForMatch}); the
 * returned segment `text` preserves the **original** label casing/diacritics.
 * Because NFD folding can change string length (e.g. `"é"` → `"e"` + combining
 * mark), the search runs over a per-code-point folded projection with an index
 * map back to the original code points, keeping the highlighted slice aligned
 * with the source label. Only the first match is highlighted.
 *
 * @param label - The option label to segment.
 * @param query - The query to highlight within the label.
 * @returns Ordered segments covering the whole label; a single unmatched
 *   segment when the query is empty or not found.
 */
export function matchSegments(label: string, query: string): MlvMatchSegment[] {
  const q = normalizeForMatch(query.trim());
  if (!q) return [{ text: label, matched: false }];

  // Work in code points so surrogate pairs (e.g. emoji) are not split.
  const chars = [...label];
  let folded = '';
  // For each folded code-unit position, the index of the originating code point.
  const originIndex: number[] = [];
  chars.forEach((char, index) => {
    const foldedChar = normalizeForMatch(char);
    for (const unit of foldedChar) {
      folded += unit;
      originIndex.push(index);
    }
  });

  const start = folded.indexOf(q);
  if (start === -1) return [{ text: label, matched: false }];

  const originStart = originIndex[start];
  const originEnd = originIndex[start + q.length - 1];

  const before = chars.slice(0, originStart).join('');
  const match = chars.slice(originStart, originEnd + 1).join('');
  const after = chars.slice(originEnd + 1).join('');

  const segments: MlvMatchSegment[] = [];
  if (before) segments.push({ text: before, matched: false });
  segments.push({ text: match, matched: true });
  if (after) segments.push({ text: after, matched: false });
  return segments;
}
