import { normalizeForMatch } from '@malva-ui/cdk/utils';
import type { MlvSelectOption } from './select-option';

export { normalizeForMatch };

/**
 * @private Matches the first code unit that disqualifies the direct-slice fast
 * path in {@link matchSegments}: either a non-ASCII UTF-16 code unit (>= U+0080,
 * which also covers every astral code point because its surrogate halves fall in
 * U+D800-U+DFFF), or one of the **two ASCII characters that carry
 * `Diacritic=Yes`** — `^` (U+005E) and `` ` `` (U+0060). `normalizeForMatch`
 * strips those two, so a label containing either folds to a *shorter* string and
 * is no longer index-aligned with its source.
 *
 * Note the `^` sits after the range on purpose: `^` is only a negation operator
 * at the *start* of a character class, so it is a literal here.
 *
 * Module-scope so the literal is compiled once, and deliberately **without** the
 * `g` flag: a global regex carries `lastIndex` across `.test()` calls and would
 * return alternating results for the same input.
 *
 * Intentionally duplicated from the identical private constant in
 * `@malva-ui/cdk/utils`' `normalize-for-match.ts` rather than shared: exporting
 * it would add a public symbol to a frozen package surface for a one-line
 * regex. The two must stay in sync — `matchSegments`' fast path is only
 * index-aligned for exactly the strings `normalizeForMatch` fast-paths.
 */
const NEEDS_FULL_FOLD = /[\u0080-\uffff^`]/;

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
 * With the **default** matcher this runs a fused path that folds each label
 * exactly once and reuses that folded string for both the substring test and
 * the prefix ranking (the two steps used to fold every label separately). A
 * **custom** matcher keeps the original two-pass shape: the predicate is called
 * once per option and {@link rankPrefixMatchesFirst} folds the survivors for
 * ranking.
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

  if (matcher === defaultOptionMatcher) {
    // Fold once per label, then reuse it for the `includes` filter and the
    // `startsWith` ranking. A folded query of '' (e.g. a lone combining mark)
    // needs no special case: every label both contains and starts with ''.
    const nq = normalizeForMatch(q);
    const kept: MlvSelectOption<T>[] = [];
    const keptIsPrefixed: boolean[] = [];
    for (const option of options) {
      const folded = normalizeForMatch(option.label);
      if (!folded.includes(nq)) continue;
      kept.push(option);
      keptIsPrefixed.push(folded.startsWith(nq));
    }
    return rankWithinGroupRuns(kept, (_, index) => keptIsPrefixed[index]);
  }

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
  return rankWithinGroupRuns(options, (option) =>
    normalizeForMatch(option.label).startsWith(q),
  );
}

/**
 * @private Stable-partitions `options` by `isPrefixed` **within each consecutive
 * same-group run**, concatenating each run's prefixed entries before its rest.
 * Runs are delimited exactly as {@link rankPrefixMatchesFirst} documents —
 * by a change in `(group ?? '')` against the run's first option — so runs never
 * move or merge and the panel's flat-index alignment holds.
 *
 * The predicate receives the option's index in `options` so a caller that has
 * already computed the prefix flags (the fused default-matcher path in
 * {@link filterOptions}) can answer without folding the label again.
 */
function rankWithinGroupRuns<T>(
  options: readonly MlvSelectOption<T>[],
  isPrefixed: (option: MlvSelectOption<T>, index: number) => boolean,
): MlvSelectOption<T>[] {
  const ranked: MlvSelectOption<T>[] = [];
  let runStart = 0;
  for (let i = 1; i <= options.length; i++) {
    const runEnded =
      i === options.length ||
      (options[i].group ?? '') !== (options[runStart].group ?? '');
    if (!runEnded) continue;
    const prefixed: MlvSelectOption<T>[] = [];
    const rest: MlvSelectOption<T>[] = [];
    for (let j = runStart; j < i; j++) {
      (isPrefixed(options[j], j) ? prefixed : rest).push(options[j]);
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
 * with the source label. That map is keyed by folded **code unit** (not code
 * point), because the search itself is code-unit arithmetic — so a label
 * containing astral code points (emoji, CJK extensions, math alphanumerics)
 * stays aligned. Only the first match is highlighted.
 *
 * A **pure-ASCII label** skips that machinery entirely: folding such a label is
 * just `toLowerCase()`, which cannot change its length or code-point count, so
 * the folded index maps 1:1 onto the original and the slice can be taken from
 * `label` directly. The output is identical either way — this is the hot path,
 * reached per rendered option per keystroke through the `mlvHighlightMatch`
 * pipe.
 *
 * @param label - The option label to segment.
 * @param query - The query to highlight within the label.
 * @returns Ordered segments covering the whole label; a single unmatched
 *   segment when the query is empty or not found.
 */
export function matchSegments(label: string, query: string): MlvMatchSegment[] {
  const q = normalizeForMatch(query.trim());
  if (!q) return [{ text: label, matched: false }];

  if (!NEEDS_FULL_FOLD.test(label)) {
    const start = label.toLowerCase().indexOf(q);
    if (start === -1) return [{ text: label, matched: false }];
    const end = start + q.length;

    const segments: MlvMatchSegment[] = [];
    if (start > 0) {
      segments.push({ text: label.slice(0, start), matched: false });
    }
    segments.push({ text: label.slice(start, end), matched: true });
    if (end < label.length) {
      segments.push({ text: label.slice(end), matched: false });
    }
    return segments;
  }

  // Work in code points so surrogate pairs (e.g. emoji) are not split.
  const chars = [...label];
  let folded = '';
  // For each folded code *unit* position, the index of the originating code
  // point. `folded` is searched and sliced with code-unit arithmetic
  // (`indexOf`, `q.length`), so this must carry exactly one entry per code
  // unit — an astral code point contributes **two**, both pointing at the same
  // `chars` index. Walking `foldedChar` by index rather than with `for…of` is
  // what keeps `originIndex.length === folded.length`: `for…of` yields whole
  // code points, so an astral fold pushed one entry while growing `folded` by
  // two units, desynchronising the map and over-selecting past the match.
  const originIndex: number[] = [];
  chars.forEach((char, index) => {
    const foldedChar = normalizeForMatch(char);
    for (let unit = 0; unit < foldedChar.length; unit++) {
      originIndex.push(index);
    }
    folded += foldedChar;
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
