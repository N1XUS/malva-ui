import { Injectable } from '@angular/core';
import { codeToHtml } from 'shiki';

export type DocsCodeTheme = 'light' | 'dark';

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

    const result = codeToHtml(code, { lang, theme: shikiTheme }).catch(
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
