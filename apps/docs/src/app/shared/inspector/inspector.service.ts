import { Injectable } from '@angular/core';

declare global {
  interface Window {
    __MLV_E2E__?: boolean;
  }
}

/**
 * Service that reports whether the docs app is running under Playwright E2E.
 * The flag is set by the Playwright `mlv` fixture via `page.addInitScript`
 * before Angular bootstraps.
 */
@Injectable({ providedIn: 'root' })
export class InspectorService {
  /**
   * True when the E2E init script has set `window.__MLV_E2E__ === true`.
   */
  isE2e(): boolean {
    return typeof window !== 'undefined' && window.__MLV_E2E__ === true;
  }
}
