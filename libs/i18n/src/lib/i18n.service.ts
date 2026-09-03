import { computed, Injectable, signal, type Signal } from '@angular/core';
import type { MlvLanguage } from './types';

/**
 * Central service managing the active language pack.
 * Populated via `APP_INITIALIZER` in `provideMlvI18n()`.
 */
@Injectable()
export class MlvI18nService {
  /** @private Internal language state. */
  private readonly _language = signal<MlvLanguage | null>(null);

  /** @private Monotonic identifier used to ignore stale async pack loads. */
  private _switchRequestId = 0;

  /**
   * @private Memoized slice signals, one per `MlvLanguage` key.
   *
   * The key space is the fixed set of `MlvLanguage` properties, so the map is
   * bounded by the interface, not by the number of callers. It is an instance
   * field rather than a module-level cache on purpose: `MlvI18nService` is
   * provided by `provideMlvI18n()` (no `providedIn: 'root'`), so a lazy route
   * that re-provides it, a per-spec `TestBed`, and a per-request SSR injector
   * each get their own service — and each must get its own slices, since the
   * cached nodes close over this instance's `_language`.
   */
  private readonly _slices = new Map<
    keyof MlvLanguage,
    Signal<MlvLanguage[keyof MlvLanguage]>
  >();

  /** Sets the active language pack. Called by the APP_INITIALIZER. */
  setLanguage(lang: MlvLanguage): void {
    this._language.set(lang);
  }

  /** Switches language at runtime; only the newest outstanding request may win. */
  async switchLanguage(
    loader: () => Promise<{ default: MlvLanguage }>,
  ): Promise<void> {
    const requestId = ++this._switchRequestId;
    const module = await loader();
    if (requestId === this._switchRequestId) {
      this._language.set(module.default);
    }
  }

  /**
   * Returns a signal for a specific component's i18n slice.
   *
   * The signal is memoized per key, so every caller asking for the same slice
   * shares one reactive node: repeated calls return the identical reference,
   * and a language switch recomputes the slice once rather than once per
   * caller. The node is created lazily and lives for the lifetime of this
   * service instance.
   *
   * Reading the returned signal before a language pack has loaded throws, and
   * keeps throwing until one arrives — the error is not latched, so a signal
   * obtained before `setLanguage()` produces the value on the next read after
   * it.
   */
  select<K extends keyof MlvLanguage>(key: K): Signal<MlvLanguage[K]> {
    const cached = this._slices.get(key);
    if (cached) return cached as Signal<MlvLanguage[K]>;

    const slice = computed(() => {
      const language = this._language();
      if (!language) {
        throw new Error(
          'MlvI18nService: no language pack loaded — was provideMlvI18n() configured?',
        );
      }
      return language[key];
    });
    this._slices.set(key, slice);
    return slice;
  }
}
