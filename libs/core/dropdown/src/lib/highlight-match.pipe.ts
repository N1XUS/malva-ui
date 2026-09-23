import { Pipe } from '@angular/core';
import type { PipeTransform } from '@angular/core';
import type { MlvMatchSegment } from './option-matcher';
import { matchSegments } from './option-matcher';

/**
 * Splits a label into matched / unmatched {@link MlvMatchSegment}s for the given
 * query so a template can emphasise the matched substring (case- and
 * diacritic-insensitive; see {@link matchSegments}). Used by
 * `mlv-dropdown-panel` to highlight the query inside each suggestion.
 *
 * @example
 * ```html
 * @for (seg of option.label | mlvHighlightMatch:query; track $index) {
 *   @if (seg.matched) { <mark>{{ seg.text }}</mark> }
 *   @else { {{ seg.text }} }
 * }
 * ```
 */
@Pipe({ name: 'mlvHighlightMatch' })
export class MlvHighlightMatchPipe implements PipeTransform {
  /**
   * @param label - The label to segment. Nullish input yields an empty result;
   *   the empty string is a label like any other and yields its one (empty)
   *   unmatched segment (#300).
   * @param query - The query to highlight; empty query returns one unmatched
   *   segment containing the whole label.
   */
  transform(
    label: string | null | undefined,
    query: string,
  ): MlvMatchSegment[] {
    if (label == null) return [];
    return matchSegments(label, query ?? '');
  }
}
