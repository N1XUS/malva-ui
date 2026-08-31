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

  /** Returns a signal for a specific component's i18n slice. */
  select<K extends keyof MlvLanguage>(key: K): Signal<MlvLanguage[K]> {
    return computed(() => {
      const language = this._language();
      if (!language) {
        throw new Error(
          'MlvI18nService: no language pack loaded — was provideMlvI18n() configured?',
        );
      }
      return language[key];
    });
  }
}
