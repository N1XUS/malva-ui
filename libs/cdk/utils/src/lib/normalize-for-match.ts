/**
 * Normalises text for matching / highlighting: NFD-folds, strips combining
 * diacritics, and lower-cases. Shared by option matching in
 * `@malva-ui/core/dropdown` and by `MlvArrayDataSource` search.
 */
export function normalizeForMatch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}+/gu, '')
    .toLowerCase();
}
