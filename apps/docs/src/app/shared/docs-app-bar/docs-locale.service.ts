import { Injectable, signal } from '@angular/core';
import type { DocsLocale } from './docs-locales';

/** Shared active locale for every route-local documentation app bar. */
@Injectable({ providedIn: 'root' })
export class DocsLocaleService {
  readonly locale = signal<DocsLocale>('en');

  private _requestId = 0;

  setLocale(locale: DocsLocale): void {
    this.locale.set(locale);
  }

  beginLocaleRequest(locale: DocsLocale): number {
    this.setLocale(locale);
    return ++this._requestId;
  }

  isCurrentRequest(requestId: number): boolean {
    return requestId === this._requestId;
  }
}
