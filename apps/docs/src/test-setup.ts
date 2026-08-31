import '@angular/compiler';
import '@analogjs/vitest-angular/setup-snapshots';
import { setupTestBed } from '@analogjs/vitest-angular/setup-testbed';

// jsdom ships no IntersectionObserver; `@defer (on viewport)` needs the
// constructor to exist. The stub never fires, so deferred blocks keep their
// placeholders in specs.
if (typeof globalThis.IntersectionObserver === 'undefined') {
  class NoopIntersectionObserver {
    readonly root = null;
    readonly rootMargin = '0px';
    readonly thresholds: readonly number[] = [];
    observe(): void {
      // Intentionally inert — entries never intersect in jsdom.
    }
    unobserve(): void {
      // Intentionally inert.
    }
    disconnect(): void {
      // Intentionally inert.
    }
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }
  globalThis.IntersectionObserver =
    NoopIntersectionObserver as unknown as typeof IntersectionObserver;
}

setupTestBed();
