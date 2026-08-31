import '@angular/compiler';
import '@analogjs/vitest-angular/setup-snapshots';
import { setupTestBed } from '@analogjs/vitest-angular/setup-testbed';

setupTestBed({ zoneless: false });

/**
 * jsdom ships no canvas backend, and the editor toolbar mounts colour pickers
 * that paint gradients, so `getContext` has to be stubbed.
 *
 * It is stubbed once here rather than per spec because `vi.spyOn` on a
 * prototype is destructive across files: vitest reuses a single jsdom per
 * worker process, and restoring a prototype spy re-defines the property with
 * default attributes — non-configurable and non-writable. Every later file in
 * that process then threw `Cannot redefine property: getContext` on its own
 * stub, taking ~70 tests with it. Only a low-core runner packs every spec into
 * one worker, which is why this failed exclusively in CI.
 *
 * The guard keeps this idempotent: the stub is installed once and left in
 * place for every file that shares the process.
 */
const canvasContextStub = () =>
  ({
    createLinearGradient: () => ({ addColorStop: () => undefined }),
    fillRect: () => undefined,
    fillStyle: '',
  }) as unknown as CanvasRenderingContext2D;

const existing = Object.getOwnPropertyDescriptor(
  HTMLCanvasElement.prototype,
  'getContext',
);

if (!existing || existing.configurable) {
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    writable: true,
    value: canvasContextStub,
  });
}
