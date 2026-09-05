/**
 * Matches the first code unit that disqualifies the `toLowerCase()` fast path:
 * a non-ASCII UTF-16 code unit (which also covers every astral code point,
 * because its surrogate halves fall in U+D800-U+DFFF), or one of the two ASCII
 * characters carrying `Diacritic=Yes` — `^` (U+005E) and `` ` `` (U+0060).
 *
 * The `^` sits after the range on purpose: it is only a negation operator at
 * the *start* of a character class, so it is a literal here.
 *
 * Deliberately without the `g` flag: a global regex carries `lastIndex` across
 * `.test()` calls and would alternate results for the same input.
 */
const NEEDS_FULL_FOLD = /[\u0080-\uffff^`]/;

/**
 * NFD-folds, strips combining diacritics, and lower-cases text for matching.
 *
 * This is a deliberate local copy of `normalizeForMatch` from
 * `@malva-ui/cdk/utils`: the worker bundle is built without the TypeScript
 * path-alias resolver, so nothing reachable from `scale.worker.ts` can import
 * across the workspace. Keeping the two implementations identical is what makes
 * the worker's search results indistinguishable from `MlvArrayDataSource`'s.
 */
export function normalizeScaleText(text: string): string {
  if (!NEEDS_FULL_FOLD.test(text)) return text.toLowerCase();
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}+/gu, '')
    .toLowerCase();
}
