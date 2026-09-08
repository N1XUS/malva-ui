import { computed, Injectable, signal, type Signal } from '@angular/core';
import { resolveMlvLanguage, type MlvLanguageModule } from './language-module';
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

  /**
   * Switches language at runtime; only the newest outstanding request may win.
   *
   * Takes the same {@link MlvLanguageModule} shapes as `provideMlvI18n()`, so
   * `() => import('@malva-ui/i18n/de')` works against the published package as
   * well as against this workspace's sources (#227).
   *
   * @param loader Loads the language pack. The returned promise rejects when
   * the resolved module carries no language, or carries more than one — but
   * only for a request that is still the newest when its module arrives. A
   * superseded request never reads its module, so it resolves quietly whatever
   * it loaded. Either way the pack currently in place is left alone.
   */
  async switchLanguage(
    loader: () => Promise<MlvLanguageModule>,
  ): Promise<void> {
    const requestId = ++this._switchRequestId;
    const module = await loader();
    // Resolved inside the guard, not before it: a request that has already lost
    // the race stays a no-op, even when the pack it loaded is unreadable.
    if (requestId === this._switchRequestId) {
      this._language.set(resolveMlvLanguage(module));
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
