import { from, of, type Observable } from 'rxjs';

/**
 * Normalises every supported search result into a one-shot observable. Shared
 * by `MlvOptionsAdapter` and `[mlvAutocomplete]`.
 */
export function toOptionsResult<T>(
  result: T[] | Promise<T[]> | Observable<T[]>,
): Observable<T[]> {
  return Array.isArray(result)
    ? of(result)
    : from(result as Promise<T[]> | Observable<T[]>);
}
