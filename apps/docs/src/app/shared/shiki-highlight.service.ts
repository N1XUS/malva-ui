import { inject, Injectable, InjectionToken } from '@angular/core';
import { codeToHtml } from 'shiki';

export type DocsCodeTheme = 'light' | 'dark';

/** The Shiki theme names this app highlights with. */
export type DocsShikiThemeName = 'github-light' | 'github-dark';

/**
 * The one call `ShikiHighlightService` makes into Shiki.
 *
 * Behind a token rather than a direct import so the service can be tested
 * without `vi.mock('shiki')`. Vitest cannot mock an externalised dependency
 * that another spec in the same worker has already pulled through Node's own
 * ESM registry, so that mock silently stopped applying whenever this spec
 * shared a worker with one that loads the real package — the whole suite in a
 * single-worker run. A provider override has no such ordering.
 */
export type DocsCodeHighlighter = (
  code: string,
  options: { lang: string; theme: DocsShikiThemeName },
) => Promise<string>;

/** Resolves to Shiki's `codeToHtml` unless a consumer or spec overrides it. */
export const DOCS_CODE_HIGHLIGHTER = new InjectionToken<DocsCodeHighlighter>(
  'DOCS_CODE_HIGHLIGHTER',
  { providedIn: 'root', factory: () => codeToHtml },
);

/**
 * App-wide Shiki result cache.
 *
 * Example panels are destroyed when the routed Examples/API tab changes. Keeping
 * the cache at the application root lets a revisited code tab reuse both
 * in-flight and completed highlighting work across those remounts.
 */
@Injectable({ providedIn: 'root' })
export class ShikiHighlightService {
  private static readonly _MAX_CACHE_ENTRIES = 256;
  private readonly _cache = new Map<string, Promise<string>>();

  /**
   * @private The Shiki entry point. Injected so specs replace it with a
   * provider instead of a module mock.
   */
  private readonly _codeToHtml = inject(DOCS_CODE_HIGHLIGHTER);

  highlight(code: string, lang: string, theme: DocsCodeTheme): Promise<string> {
    const shikiTheme = theme === 'dark' ? 'github-dark' : 'github-light';
    const key = `${shikiTheme}::${lang}::${code}`;
    const cached = this._cache.get(key);

    if (cached) {
      // Refresh insertion order so the bounded map behaves as an LRU cache.
      this._cache.delete(key);
      this._cache.set(key, cached);
      return cached;
    }

    const result = this._codeToHtml(code, { lang, theme: shikiTheme }).catch(
      (error: unknown) => {
        // A transient failure must not poison this cache key permanently.
        if (this._cache.get(key) === result) this._cache.delete(key);
        throw error;
      },
    );

    this._cache.set(key, result);
    this._evictOldestEntry();
    return result;
  }

  private _evictOldestEntry(): void {
    if (this._cache.size <= ShikiHighlightService._MAX_CACHE_ENTRIES) return;

    const oldestKey = this._cache.keys().next().value;
    if (oldestKey !== undefined) this._cache.delete(oldestKey);
  }
}
