/**
 * Vitest setup file: proves each suite really is running zoneless.
 *
 * The library is zoneless-only. Every component, directive and service is
 * `OnPush` and signal-based, authored for `provideZonelessChangeDetection()`,
 * and the docs app bootstraps that way. Each project declares the same mode in
 * its own `src/test-setup.ts` — `setupTestBed({ zoneless: true })` — but that
 * declaration does not enforce itself in either direction:
 *
 *   - It cannot fail loudly when it is wrong. Angular's `TestBed` puts
 *     `provideZonelessChangeDetectionInternal()` into its root scope module
 *     unconditionally, and `ZONELESS_ENABLED` has a `() => true` default
 *     factory, so a project passing `{ zoneless: false }` still resolves
 *     `NoopNgZone` and still auto-detects. Nothing goes red. That silence is
 *     how the workspace ended up with 85 setups declaring a mode they did not
 *     use, while `zone.js` was never actually loaded by any of them.
 *   - It may stop being true without anything being edited. Those two
 *     behaviours are private framework internals. An Angular release that
 *     restored a zone-based default for `TestBed` would flip every suite to
 *     zone change detection while all 86 declarations still read "zoneless".
 *
 * So the assertion reads the *resolved* injector rather than the config
 * literal: the declaration is checked statically by the workspace guard
 * (`scripts/testing/assert-zoneless-config.spec.js`, run by
 * `nx run @malva-ui/source:test`), and what Angular actually built is checked
 * here, once per spec file, in every project whose `vite.config.mts` lists
 * this file in `test.setupFiles`.
 *
 * `beforeAll` rather than module scope on purpose: setup files are evaluated in
 * `setupFiles` order, but hooks run only after every one of them has finished,
 * so the check does not depend on this entry sitting after `src/test-setup.ts`.
 */

import { NgZone, ɵPROVIDED_ZONELESS, ɵZONELESS_ENABLED } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeAll } from 'vitest';

/**
 * Reports every way the environment departs from zoneless, so a failure names
 * all of them at once instead of one per re-run.
 */
function collectZoneProblems() {
  const problems = [];

  // zone.js is not a runtime dependency of the test environment. If it is on
  // `globalThis`, something pulled it in and Angular's own NG0914 warning is
  // firing too. Nothing in the workspace imports it, so this catches a
  // transitive load that no config literal would reveal.
  if (typeof globalThis.Zone !== 'undefined') {
    problems.push('`globalThis.Zone` is defined — zone.js has been loaded.');
  }

  // Set only by the public `provideZonelessChangeDetection()`, which
  // `setupTestBed` calls only for `{ zoneless: true }`. This is the assertion
  // that catches a setup declaring the wrong mode, because the two internal
  // markers below are true either way under Angular's current TestBed.
  //
  // Angular provides the marker under `ngDevMode` only. Vitest never enables
  // production mode, so a `false` here means the flag, not the mode — but say
  // so, rather than send the next reader to a `test-setup.ts` that is right.
  if (TestBed.inject(ɵPROVIDED_ZONELESS) !== true) {
    problems.push(
      typeof ngDevMode === 'undefined' || ngDevMode
        ? 'the TestBed environment never called `provideZonelessChangeDetection()` — ' +
            "this project's `src/test-setup.ts` is not calling " +
            '`setupTestBed({ zoneless: true })`.'
        : 'the `PROVIDED_ZONELESS` marker is unreadable because Angular is in ' +
            'production mode, where it is not provided at all. Run the suite in ' +
            'development mode, or drop this check.',
    );
  }

  // What Angular resolved, independent of how it was asked.
  if (TestBed.inject(ɵZONELESS_ENABLED) !== true) {
    problems.push(
      '`ZONELESS_ENABLED` resolved to something other than `true`.',
    );
  }

  // Zoneless resolves `NgZone` to `NoopNgZone`, which is a separate class
  // rather than an `NgZone` subclass — so an injected value that *is* an
  // `NgZone` is exactly the zone-backed case this excludes.
  if (TestBed.inject(NgZone) instanceof NgZone) {
    problems.push(
      'a real `NgZone` was injected — change detection is zone-driven, not zoneless.',
    );
  }

  return problems;
}

beforeAll(() => {
  // A spec file that opts into Vitest's `node` environment
  // (`// @vitest-environment node`) runs with no DOM on purpose — it proves a
  // helper works on a server. `BrowserTestingModule` cannot be instantiated
  // there (its `DOCUMENT` factory reads the `document` global), and such a
  // file mounts no Angular view, so there is no change detection to pin.
  if (typeof document === 'undefined') return;

  let problems;
  try {
    problems = collectZoneProblems();
  } finally {
    // Injecting instantiates the testing module. Angular's own global
    // `beforeEach` resets it before the first test anyway; resetting here as
    // well keeps this check invisible to a spec that configures the module in
    // its own `beforeAll`.
    TestBed.resetTestingModule();
  }

  if (problems.length > 0) {
    throw new Error(
      'The Malva UI test environment must be zoneless.\n' +
        problems.map((problem) => `  - ${problem}`).join('\n') +
        '\nSee `scripts/testing/setup-assert-zoneless.js`.',
    );
  }
});
