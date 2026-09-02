import '@angular/compiler';
import '@analogjs/vitest-angular/setup-snapshots';
import { setupTestBed } from '@analogjs/vitest-angular/setup-testbed';

// jsdom does not implement matchMedia, so CDK's BreakpointObserver never emits
// and MlvBreakpointService stays pinned to its initial `'sm'` tier — which
// makes the combobox's default `mobileMode="auto"` resolve to the full-screen
// mobile sheet in every spec. The combobox's existing specs assert its
// trigger-anchored desktop behaviour, so report a desktop viewport here
// (`min-width` queries match) so `auto` stays anchored. Full-screen specs opt
// in explicitly via `mobileMode="fullscreen"`, which ignores the breakpoint.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  configurable: true,
  value: (query: string): MediaQueryList =>
    ({
      matches: /min-width/.test(query),
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList,
});

setupTestBed({ zoneless: true });
