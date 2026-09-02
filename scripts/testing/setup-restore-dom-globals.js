/**
 * Vitest setup file: keeps the jsdom globals that specs overwrite pristine.
 *
 * Two separate leaks share one fix, because both outlive the file that caused
 * them: Vitest reuses one jsdom window per worker process — the environment is
 * not rebuilt between test files — so whatever a spec writes onto `globalThis`
 * is still there for every later file in the same worker. How many files that
 * is depends on the worker count, which is why these reproduce on a shared
 * worker and not when a file runs on its own.
 *
 * **DOM constructors.** `@angular/platform-server` runs
 * `Object.assign(globalThis, domino.impl)` when its DOM adapter is made
 * current, which replaces `Event`, `KeyboardEvent`, `HTMLElement` and every
 * other DOM class with domino's implementation. jsdom brand-checks the
 * arguments it is handed, so after a single server-rendering spec has run,
 * `element.dispatchEvent(new Event('change'))` fails with "parameter 1 is not
 * of type 'Event'".
 *
 * **`matchMedia`.** Components guard on `typeof matchMedia !== 'undefined'` to
 * decide whether they may animate, and this jsdom build ships none. A spec that
 * installs a stub to drive a responsive layout therefore does not only change
 * what queries answer — it flips that guard on for every later file, and a
 * component that renders its final state without motion starts rendering its
 * initial one instead.
 *
 * The two are captured at different moments, because their baselines are
 * different.
 *
 * The DOM classes are captured the first time this file loads in a worker and
 * stashed on `globalThis`, where they survive the per-file module-registry
 * reset: they are jsdom's own, nothing may replace them, and one snapshot per
 * worker is the whole truth.
 *
 * `matchMedia` is captured per test file in a `beforeAll`, and deliberately not
 * at module load. A project whose components need a viewport may install a stub
 * for its whole suite from its own `src/test-setup.ts` — `libs/core/combobox`
 * and `libs/core/select` both do — and setup files run in the order the config
 * lists them, so at the moment this file is evaluated that stub does not exist
 * yet. Capturing here would record "absent" and then delete a deliberate,
 * suite-wide stub before every test. A `beforeAll` runs once the whole setup
 * chain has, so the baseline is whatever the project itself established, and
 * only what a *spec* adds on top is rolled back. It is restored by
 * *descriptor*, so a baseline of "absent" is put back by deleting the stub
 * rather than by writing `undefined` over it.
 *
 * Both are put back around every test. This file's hooks are registered before
 * the spec's own, so a spec is still free to install a stub in `beforeEach`; it
 * just no longer outlives itself.
 *
 * Installed through `test.setupFiles` in every project's `vite.config.mts`. It
 * is a no-op for a worker whose specs leave the globals alone.
 */

import { afterEach, beforeAll, beforeEach } from 'vitest';

const PRISTINE = Symbol.for('mlv.pristineDomGlobals');

/**
 * Non-constructor globals restored by descriptor. Only names a spec has a
 * legitimate reason to replace and a component reads back belong here.
 */
const INSTANCE_GLOBALS = ['matchMedia'];

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

/**
 * The objects an instance global has to be restored on. `window` and
 * `globalThis` are the same object under Vitest's jsdom environment, but a spec
 * writes through `window` and a component reads the bare global, so both are
 * covered rather than assumed identical.
 */
function instanceGlobalTargets() {
  const targets = [globalThis];
  if (globalThis.window && globalThis.window !== globalThis) {
    targets.push(globalThis.window);
  }
  return targets;
}

/**
 * Captures the own-property descriptor of each {@link INSTANCE_GLOBALS} name on
 * every object a spec could reach it through. `undefined` records that the
 * property is absent, which is a state worth restoring.
 */
function capturePristineInstanceGlobals() {
  const captured = [];

  for (const target of instanceGlobalTargets()) {
    for (const name of INSTANCE_GLOBALS) {
      captured.push([
        target,
        name,
        Object.getOwnPropertyDescriptor(target, name),
      ]);
    }
  }

  return captured;
}

/** Puts back every captured instance global, deleting the ones that were absent. */
function restoreInstanceGlobals(captured) {
  for (const [target, name, descriptor] of captured) {
    const current = Object.getOwnPropertyDescriptor(target, name);
    if (
      current?.value === descriptor?.value &&
      current?.get === descriptor?.get
    ) {
      continue;
    }

    if (descriptor === undefined) {
      delete target[name];
    } else {
      Object.defineProperty(target, name, descriptor);
    }
  }
}

if (typeof globalThis.document !== 'undefined') {
  globalThis[PRISTINE] ??= capturePristineDomGlobals();

  const domClasses = globalThis[PRISTINE];

  /** Per-file baseline for {@link INSTANCE_GLOBALS}; filled by the `beforeAll`. */
  let instanceGlobals = [];

  beforeAll(() => {
    instanceGlobals = capturePristineInstanceGlobals();
  });

  const restore = () => {
    restoreDomGlobals(domClasses);
    restoreInstanceGlobals(instanceGlobals);
  };

  beforeEach(restore);
  afterEach(restore);
}
