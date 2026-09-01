/**
 * Matches the first code unit that disqualifies the `toLowerCase()` fast path:
 * either a non-ASCII UTF-16 code unit (>= U+0080, which also covers every
 * astral code point because its surrogate halves fall in U+D800-U+DFFF), or one
 * of the **two ASCII characters that carry `Diacritic=Yes`** — `^` (U+005E) and
 * `` ` `` (U+0060). The full pipeline strips those two via `\p{Diacritic}`, so
 * a string containing either must not be short-circuited.
 *
 * Note the `^` sits after the range on purpose: `^` is only a negation operator
 * at the *start* of a character class, so it is a literal here.
 *
 * Module-scope so the literal is compiled once, and deliberately **without** the
 * `g` flag: a global regex carries `lastIndex` across `.test()` calls and would
 * return alternating results for the same input.
 */
const NEEDS_FULL_FOLD = /[\u0080-\uffff^`]/;

/**
 * Normalises text for matching / highlighting: NFD-folds, strips combining
 * diacritics, and lower-cases. Shared by option matching in
 * `@malva-ui/core/dropdown` and by `MlvArrayDataSource` search.
 *
 * A string of ASCII characters other than `^` and `` ` `` takes a fast path
 * that collapses the whole pipeline to `toLowerCase()`: every ASCII code point
 * is NFD-stable, `\p{Diacritic}` matches nothing else in the ASCII range, and
 * ASCII `toLowerCase()` is a 1:1, length-preserving map — so the result is
 * identical, cheaper, and (load bearing for the dropdown's highlight slicing)
 * provably index-aligned with the input.
 */
export function normalizeForMatch(text: string): string {
  if (!NEEDS_FULL_FOLD.test(text)) return text.toLowerCase();
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}+/gu, '')
    .toLowerCase();
}
