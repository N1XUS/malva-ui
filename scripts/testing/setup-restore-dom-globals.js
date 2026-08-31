/**
 * Vitest setup file: keeps the jsdom DOM constructors on `globalThis` pristine.
 *
 * `@angular/platform-server` runs `Object.assign(globalThis, domino.impl)` when
 * its DOM adapter is made current, which replaces `Event`, `KeyboardEvent`,
 * `HTMLElement` and every other DOM class with domino's implementation. jsdom
 * brand-checks the arguments it is handed, so after a single server-rendering
 * spec has run, `element.dispatchEvent(new Event('change'))` fails with
 * "parameter 1 is not of type 'Event'".
 *
 * Vitest reuses one jsdom window per worker process — the environment is not
 * rebuilt between test files — so the damage outlives the spec that caused it
 * and breaks every later file that shares the worker. How many files that is
 * depends on the core count, which is why this reproduces on a 2-core CI runner
 * and not on a dev machine.
 *
 * The pristine constructors are captured the first time this file loads in a
 * worker (setup files run before the spec's own imports, so nothing has had a
 * chance to pollute yet) and stashed on `globalThis`, where they survive the
 * per-file module-registry reset. They are put back around every test.
 *
 * Installed through `test.setupFiles` in every project's `vite.config.mts`. It
 * is a no-op for a worker that never server-renders.
 */

import { afterEach, beforeEach } from 'vitest';

const PRISTINE = Symbol.for('mlv.pristineDomGlobals');

/**
 * Captures the DOM classes exposed by the live jsdom window.
 *
 * Only own, uppercase-named function-valued properties are taken: that is the
 * constructor surface domino overwrites, and it excludes instance globals such
 * as `document` and `location` that a spec may legitimately reassign.
 */
function capturePristineDomGlobals() {
  const win = globalThis.jsdom?.window ?? globalThis;
  const captured = new Map();

  for (const name of Object.getOwnPropertyNames(win)) {
    if (!/^[A-Z]/.test(name)) {
      continue;
    }

    const descriptor = Object.getOwnPropertyDescriptor(win, name);
    if (typeof descriptor?.value !== 'function') {
      continue;
    }

    captured.set(name, descriptor.value);
  }

  return captured;
}

/** Puts back every captured class that something has since replaced. */
function restoreDomGlobals(captured) {
  for (const [name, value] of captured) {
    if (globalThis[name] !== value) {
      globalThis[name] = value;
    }
  }
}

if (typeof globalThis.document !== 'undefined') {
  globalThis[PRISTINE] ??= capturePristineDomGlobals();

  const captured = globalThis[PRISTINE];

  beforeEach(() => restoreDomGlobals(captured));
  afterEach(() => restoreDomGlobals(captured));
}
