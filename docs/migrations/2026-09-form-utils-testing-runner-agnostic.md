# 2026-09 — `@malva-ui/core/form-utils/testing` drops its `vitest` import

**Packages:** `@malva-ui/core/form-utils/testing` (`verifyFormsBinding`, `MlvFormsBindingAdapter<T>`, `MlvFormsBindingMatrixOptions<T>`).
**Kind:** breaking, **behaviour only**. No exported symbol, entry point, selector, token or i18n key was renamed, removed or retyped — `verifyFormsBinding` keeps its signature and its four expectations. What changed is _how a failed expectation is raised_ and _how two values are compared_. Fixes #243.

---

## Why

`@malva-ui/core/form-utils/testing` is a **published** entry point. It has its own `ng-package.json`, so ng-packagr builds it and `dist/libs/core/package.json` exports the `./form-utils/testing` subpath. Its FESM bundle therefore carried every bare specifier its sources imported — and the first line of it was:

```js
// package/fesm2022/malva-ui-core-form-utils-testing.mjs, as published in 0.1.15
import { expect } from 'vitest';
```

`@malva-ui/core` declares `vitest` in neither `dependencies` nor `peerDependencies`, and npm installs nothing else. So:

| Consumer runner                | `import { verifyFormsBinding } from '@malva-ui/core/form-utils/testing'`  |
| ------------------------------ | ------------------------------------------------------------------------- |
| Vitest                         | worked — by coincidence, because they already had `vitest` installed      |
| Jest / Karma / Web Test Runner | `Cannot find module 'vitest'`, at build time, with no install-time signal |

Nothing in this workspace could see it: every in-repo consumer resolves `vitest` from the root `package.json`, so all twenty-odd `*-binding-matrix.spec.ts` files were green forever. It was found by the dependency guard added for #242 (`scripts/check-package-dependencies.mjs`) and held there as that guard's single `DECLARATION_EXCEPTIONS` entry, marked `DEFERRED`.

### Why declaring it lost

| Option                                       | Why not                                                                                                                                                                                                                |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Required `vitest` peer                       | Installs a test runner into **every** consumer application, including the overwhelming majority that never import this entry point.                                                                                    |
| Optional peer (`peerDependenciesMeta`)       | npm does not install optional peers, so the Jest/Karma consumer still has to install `vitest` by hand — the declaration buys documentation, not resolution. It also reverses core carrying no such block at all.       |
| `allowedNonPeerDependencies`                 | An **ng-packagr build option**. It suppresses ng-packagr's own warning and appears nowhere in the published `package.json`, so the consumer's experience is byte-identical. It hides the defect rather than fixing it. |
| Unpublish the `./form-utils/testing` subpath | Removing an exported path is a major (§3) and owes a deprecation window (§5) — a long wait for an entry point that is broken for most runners _today_.                                                                 |
| **Remove the import**                        | The only option that removes the dependency instead of describing it. Taken.                                                                                                                                           |

---

## What changed

`verifyFormsBinding` now asserts with its own code. Its only remaining bare import is `fast-equals` — verifiable in `dist/libs/core/fesm2022/malva-ui-core-form-utils-testing.mjs`, whose one import line reads `import { createCustomEqual } from 'fast-equals';` — which `@malva-ui/core` already declares as a `dependency` (and already lists in `allowedNonPeerDependencies`), so the consumer has it.

|                              | Before                                                                     | After                                                          |
| ---------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Bundle's only import         | `import { expect } from 'vitest'`                                          | `import { createCustomEqual } from 'fast-equals'`              |
| Value comparison             | Vitest's `expect(...).toEqual(...)`                                        | `fast-equals`, cycle-tracking, plus a `File`/`Blob` comparator |
| Boolean comparison           | Vitest's `expect(...).toBe(...)`                                           | `===`                                                          |
| Raised on failure            | Vitest's `AssertionError`                                                  | an `AssertionError`-shaped `Error` this entry point constructs |
| Failure message              | the label, plus Vitest's own rendering of the two values appended after it | the label **plus both rendered values**, in the message itself |
| Works on a non-Vitest runner | no — `Cannot find module 'vitest'`                                         | yes                                                            |

Only the _message_ changed shape, not what a Vitest user reads: Vitest already appended its own rendering of the two values to a custom `expect` message, so the improvement is for the runners that do not.

The error deliberately carries chai's `AssertionError` shape — `name`, `actual`, `expected`, `operator`, `showDiff` — which is the shape **Vitest's reporter special-cases**. A Vitest consumer therefore still gets the same expected/received diff a failed `expect` printed; every other runner reads both values off the message, which is why they are rendered there too.

---

## Who is affected

**Nobody on Jest, Karma or Web Test Runner** — the entry point did not resolve for them at all, so there is no behaviour to lose. This is purely a fix.

**A Vitest consumer** keeps the same API, the same four expectations and the same diff. What moves is how two values are compared — `toEqual` and `fast-equals` are not the same relation, and the differences do not all run in the same direction. Measured, not reasoned about; the list is what the measurement found, not a claim of exhaustiveness:

| Compared                                                           | `toEqual` | now      | Direction |
| ------------------------------------------------------------------ | --------- | -------- | --------- |
| own property valued `undefined` vs absent                          | equal     | **not**  | stricter  |
| plain object vs class instance with the same fields                | equal     | **not**  | stricter  |
| `Object.create(null)` vs `{}` with the same fields                 | equal     | **not**  | stricter  |
| two objects from **different realms** (an iframe, a Node `vm`)     | equal     | **not**  | stricter  |
| two `File`s / `Blob`s differing in `name`, `type` or `size`        | **equal** | not      | stricter  |
| `-0` vs `+0`                                                       | **not**   | equal    | _looser_  |
| two `File`s differing only in contents                             | equal     | equal    | unchanged |
| a cyclic value                                                     | compared  | compared | unchanged |
| `NaN`, `Date`, Invalid Date, `RegExp`, `Map`, `Set`, sparse arrays | agree     | agree    | unchanged |

Four of these are worth spelling out.

1. **`undefined`-valued properties are no longer ignored.** `toEqual` treats an own property whose value is `undefined` as absent; `fast-equals` compares key sets. A form value of `{ id: 'a', note: undefined }` matched a `sample` of `{ id: 'a' }` before and does not now. If a control legitimately round-trips a sparse object, write the `sample` with the same keys.
2. **`-0` now matches `+0`.** This is the one _loosening_. `fast-equals` compares numbers with SameValueZero; `toEqual` distinguished the two. A numeric matrix whose `expectedAfterInteraction` is `0` now also passes for a control that produced `-0` — from parsing `"-0"`, from `Math.round(-0.2)`, or from `0 * -1`.
3. **`File` and `Blob` are compared by identity metadata.** `fast-equals` maps no comparator to the `[object File]` / `[object Blob]` tags and its fallthrough is `false`, so out of the box no two distinct `File`s are ever equal, whatever they hold. That would make a matrix over a value carrying one — `mlv-file-upload`'s `MlvUploadedFile`, a `writeValue` that maps to fresh objects, a model round-tripped through `structuredClone` — permanently red, with a message saying `{}`, because a `File` has no enumerable own properties. So the helper supplies a comparator: `name`, `size`, `type` and `lastModified`, the four a faithful clone preserves. It deliberately does **not** read contents, because `File.text()` is async and a comparator is not — two files with identical metadata and different bytes compare equal. This is _stricter_ than what you had: `toEqual`, for the same non-enumerability reason, reported two `File`s with different names and types as equal, i.e. never compared them at all. Build an expected `File` from the same object rather than constructing a second one — `lastModified` defaults to `Date.now()`, so two independently constructed `File`s straddling a millisecond boundary differ.
4. **The error object is ours, not Vitest's.** Code that caught the rejection and read a Vitest-internal field off it (`matcherResult`, `diff`) sees `undefined`. `name`, `message`, `actual`, `expected` and `operator` are all present, and are the documented shape — the class itself is not exported, so catch and read the fields rather than reaching for `instanceof`.

### Cyclic values

`fast-equals` ships two deep comparators and the plain one recurses into a cycle until the stack overflows. This helper uses the **circular** one, so a form value carrying a back-reference — a tree node with `parent`, a linked record, an entity graph — fails as a labelled assertion rather than as a `RangeError` that names no binding mode and reads like a bug in the helper. It costs a `WeakMap` allocation per call: 49.8 ns against 20.4 ns per comparison over the shapes this workspace's matrices compare, which is 2.44x, and **0.015 ms** across all ~500 matrix assertions in the workspace. The ratio was the only argument for the plain comparator and the absolute number retires it.

Nothing else moves: no adapter has to change, no call site has to change, and `verifyFormsBinding` still returns `Promise<void>` and still rejects on the first failed expectation.

---

## The mechanical edit

None, for almost everyone. The two cases above:

```ts
// Before — passed under `toEqual`, which ignored the undefined key.
await verifyFormsBinding({ adapter, sample: { id: 'a' }, … });
// After — say what the control actually round-trips.
await verifyFormsBinding({ adapter, sample: { id: 'a', note: undefined }, … });
```

```ts
// Before — reading a Vitest-internal field off the rejection.
catch (error) { report((error as any).matcherResult.actual); }
// After — the public fields, which every runner can read.
catch (error) { report((error as { actual?: unknown }).actual); }
```

---

## Guard

`scripts/check-package-dependencies.mjs`'s `DECLARATION_EXCEPTIONS` list is now **empty**, and the guard fails on an unused entry, so it cannot silently grow one back for this. `libs/core/form-utils/src/lib/forms-binding-matrix.spec.ts` additionally drives each of the four expectations to its failing side — an assertion helper that quietly stopped throwing would turn every binding matrix in the workspace green having verified nothing — and sweeps **every** source under the published entry point — walked recursively from `testing/src`, so the barrel is included — for an `import`, an `export … from` or a `require()` of a test runner. The matcher is driven against synthetic sources in its own test, because two of those three forms cannot be proven by ablating a real file: `require('vitest')` throws inside Vitest before any spec collects, and `export * from 'jasmine'` does not resolve at all.
