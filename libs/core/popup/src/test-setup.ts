import '@angular/compiler';
import '@analogjs/vitest-angular/setup-snapshots';
import { setupTestBed } from '@analogjs/vitest-angular/setup-testbed';

setupTestBed({ zoneless: true });

/** @internal Minimal shape of the JSDOM virtual console used below. */
interface JsdomVirtualConsole {
  removeAllListeners(event: string): void;
  on(
    event: string,
    listener: (error: Error & { detail?: unknown }) => void,
  ): void;
}

/**
 * jsdom cannot parse the CDK overlay stylesheet's `@layer` rules and reports
 * "Could not parse CSS stylesheet" — followed by the whole sheet — once per
 * TestBed reset. It raises that as a `jsdomError` on the JSDOM virtual
 * console, which forwards to the Node console captured when the environment
 * was created, *not* the per-file console vitest swaps into `globalThis`; a
 * `console.error` filter here would never see it. So drop that one event and
 * re-forward everything else.
 */
const virtualConsole = (
  globalThis as unknown as {
    jsdom?: { virtualConsole?: JsdomVirtualConsole };
  }
).jsdom?.virtualConsole;

if (virtualConsole) {
  virtualConsole.removeAllListeners('jsdomError');
  virtualConsole.on('jsdomError', (error) => {
    if (error.message?.includes('Could not parse CSS stylesheet')) {
      return;
    }
    console.error(error.stack, error.detail);
  });
}
