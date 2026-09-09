import { createCustomEqual } from 'fast-equals';

/**
 * Runner-agnostic assertion primitives for {@link verifyFormsBinding}.
 *
 * `@malva-ui/core/form-utils/testing` is a **published** entry point — it has
 * its own `ng-package.json`, so ng-packagr builds it and
 * `dist/libs/core/package.json` exports the `./form-utils/testing` subpath. Its
 * bundle therefore carries every bare specifier these sources import, and npm
 * installs only what `@malva-ui/core` itself declares. Importing `expect` from
 * `vitest` here shipped an undeclared module: a consumer on Jest, Karma or Web
 * Test Runner got `Cannot find module 'vitest'` the moment they imported the
 * helper, with no install-time signal of any kind (#243).
 *
 * So the assertions are hand-rolled and depend on nothing a test runner
 * provides. What every runner does agree on is that a throw inside a test is a
 * failure, so a failed assertion throws — and throws an error shaped like
 * chai's `AssertionError` (`name`, `actual`, `expected`, `operator`,
 * `showDiff`), which is the shape Vitest's reporter special-cases to print its
 * expected/received diff. A Vitest user therefore sees the same diff `expect`
 * produced; every other runner sees the rendered values in the message instead,
 * which is why {@link render} embeds them there as well as on the error.
 *
 * ## How {@link structurallyEqual} differs from Vitest's `toEqual`
 *
 * Structural comparison is `fast-equals` rather than `toEqual`. `fast-equals`
 * is already a declared `dependency` of `@malva-ui/core`, so the consumer has
 * it. It is **not** a drop-in: the differences below were measured against
 * `toEqual` on Vitest 3, not reasoned about, and the list is what the
 * measurement found rather than a claim of exhaustiveness.
 *
 * | Compared                                    | `toEqual` | here    |
 * | ------------------------------------------- | --------- | ------- |
 * | own property valued `undefined` vs absent   | equal     | **not** |
 * | `-0` vs `+0`                                | **not**   | equal   |
 * | plain object vs class instance, same fields | equal     | **not** |
 * | `Object.create(null)` vs `{}`, same fields  | equal     | **not** |
 * | two `File`s differing only in contents      | equal     | equal   |
 * | two `File`s differing in name / type / size | **equal** | not     |
 * | `NaN`, `Date`, Invalid Date, `RegExp`, `Map`, `Set`, sparse arrays | agree | agree |
 *
 * Note the direction is not uniform. Key sets and prototypes read **stricter**
 * here; `-0`/`+0` reads **looser**, because `fast-equals` compares numbers with
 * SameValueZero — a matrix whose `expectedAfterInteraction` is `0` now also
 * accepts a control that produced `-0`.
 *
 * ## `File` and `Blob`
 *
 * `fast-equals` maps no comparator to the `[object File]` / `[object Blob]`
 * tags and its fallthrough is `false`, so out of the box **no two distinct
 * `File`s are ever equal**, whatever they hold — which would make a matrix over
 * a value carrying one (`mlv-file-upload`'s `MlvUploadedFile`) permanently red
 * the moment a control stopped returning the identical object. `toEqual` is no
 * better in the other direction: a `File`'s own properties are not enumerable,
 * so it reports two `File`s with **different names and types** as equal, i.e.
 * it never compared them at all.
 *
 * So {@link structurallyEqual} supplies one, comparing the four pieces of
 * identity metadata a faithful clone preserves (`structuredClone` preserves all
 * four): `name`, `size`, `type`, `lastModified`. It deliberately does **not**
 * read contents — `File.text()` / `.arrayBuffer()` are async and a comparator
 * is not, so two files with identical metadata and different bytes compare
 * equal. Build an expected `File` from the same object rather than constructing
 * a second one: `lastModified` defaults to `Date.now()`, so two independently
 * constructed `File`s straddling a millisecond boundary differ.
 *
 * ## Cyclic values
 *
 * `fast-equals`' plain `deepEqual` recurses into a cycle until the stack
 * overflows, turning a failed expectation into a `RangeError` carrying no mode
 * label — so with three binding modes the report would not even say which run
 * failed. The circular variant is used instead, which is why a form value with
 * a back-reference (a tree node with `parent`, an entity graph) fails as an
 * assertion. It costs a `WeakMap` allocation per call: measured over the value
 * shapes this workspace's matrices actually compare, 49.8 ns against 20.4 ns
 * per comparison — 2.44x, which sounds like a lot and is **0.015 ms** across
 * all ~500 matrix assertions in the workspace. The ratio buys nothing worth
 * having; a labelled assertion failure does.
 *
 * ## Realms
 *
 * `fast-equals` requires matching constructors, so two structurally identical
 * plain objects from **different realms** are unequal — which is what
 * `Object.create(null)` and the class-instance row above are really saying.
 * The trap in practice is jsdom's `structuredClone`, which returns objects in
 * the jsdom realm (and drops a `File`'s metadata outright), so a spec cannot
 * use it to fake a control that clones on write.
 */

/** Longest rendering of a single value embedded in a failure message. */
const MAX_RENDERED_LENGTH = 200;

/**
 * @internal Structured-clone tags this module handles itself, because
 * `fast-equals` maps no comparator to either and `render` cannot represent
 * them. Matched by tag rather than `instanceof` so the module references no DOM
 * global: `File` is absent from Node before 20, and this entry point has to
 * load under a Node-hosted runner as well as a browser-hosted one.
 */
const BINARY_TAGS = new Set(['[object File]', '[object Blob]']);

/**
 * @internal The tag `fast-equals` dispatches on, for a value of any type.
 *
 * @param value Any value.
 */
function tagOf(value: unknown): string {
  return Object.prototype.toString.call(value);
}

/**
 * @internal Compares two `File`s (or `Blob`s) by identity metadata. Reached
 * only for a pair whose constructors already matched, so a `File` is never
 * compared to a `Blob` here. Contents are deliberately unread — see the module
 * comment.
 *
 * @param a The value observed.
 * @param b The value required.
 */
function areBinaryValuesEqual(a: unknown, b: unknown): boolean {
  const left = a as File;
  const right = b as File;

  return (
    left.size === right.size &&
    left.type === right.type &&
    left.name === right.name &&
    left.lastModified === right.lastModified
  );
}

/**
 * @internal Deep value comparison for {@link assertDeepEqual}: `fast-equals`
 * with cycle tracking on and a `File` / `Blob` comparator added. Measured
 * against plain `deepEqual` over every shape the workspace's matrices compare —
 * it agrees on all of them, and differs only on the two cases it exists for.
 */
const structurallyEqual = createCustomEqual({
  circular: true,
  createCustomConfig: () => ({
    getUnsupportedCustomComparator: (
      _a: unknown,
      _b: unknown,
      _state: unknown,
      tag: string,
    ) => (BINARY_TAGS.has(tag) ? areBinaryValuesEqual : undefined),
  }),
} as Parameters<typeof createCustomEqual>[0]);

/**
 * A failed binding-matrix assertion, shaped like chai's `AssertionError` so
 * Vitest's reporter renders an expected/received diff for it exactly as it does
 * for a failed `expect`.
 *
 * The class is **not** exported from the entry point's barrel — consumers
 * assert by calling {@link verifyFormsBinding}, never by constructing or
 * `instanceof`-ing this. What is contractual is the *shape* a caller observes
 * when it catches the rejection: `name`, `message`, `actual`, `expected` and
 * `operator`, which every runner can read.
 */
export class MlvFormsBindingAssertionError extends Error {
  /**
   * Reported by every runner as the error's label, and the name Vitest prints
   * ahead of the message. Always `'AssertionError'`.
   */
  override readonly name = 'AssertionError';

  /** The value observed. Also read by Vitest's diff renderer. */
  readonly actual: unknown;

  /** The value required. Also read by Vitest's diff renderer. */
  readonly expected: unknown;

  /**
   * How the two were compared: `'deepEqual'` for a value expectation,
   * `'strictEqual'` for a boolean one.
   */
  readonly operator: string;

  /**
   * @internal Opts this error into Vitest's diff rendering explicitly, rather
   * than relying on it inferring one from `actual`/`expected` being present.
   * A reporter hint, not part of the shape a consumer reads.
   */
  readonly showDiff = true;

  /**
   * @param message Human-readable failure, already carrying both rendered
   *   values so a runner that prints no diff still says what went wrong.
   * @param actual The value observed.
   * @param expected The value required.
   * @param operator How the two were compared.
   */
  constructor(
    message: string,
    actual: unknown,
    expected: unknown,
    operator: string,
  ) {
    super(message);
    this.actual = actual;
    this.expected = expected;
    this.operator = operator;
  }
}

/**
 * @internal Replaces the values `JSON.stringify` renders uselessly. A `File`
 * has no enumerable own properties, so it stringifies to `{}` — the failure
 * message for a `mlv-file-upload`-shaped value would otherwise say nothing at
 * all. No `Date` branch: `JSON.stringify` applies `toJSON()` **before** the
 * replacer, so a replacer never receives a `Date` (and `Date.prototype.toJSON`
 * already emits the ISO string, plus `null` for an Invalid Date, where
 * `toISOString()` would have thrown).
 *
 * @param item One value visited by `JSON.stringify`.
 */
function renderReplacer(_key: string, item: unknown): unknown {
  const tag = tagOf(item);

  if (tag === '[object File]') {
    const file = item as File;
    return `File(${file.name}, ${file.size} B, ${file.type || 'no type'})`;
  }

  if (tag === '[object Blob]') {
    const blob = item as Blob;
    return `Blob(${blob.size} B, ${blob.type || 'no type'})`;
  }

  return item;
}

/**
 * @internal Renders a value for a failure message, on every runner and with no
 * Node builtin: `node:util`'s `inspect` is unavailable in a browser-hosted
 * runner such as Karma or Web Test Runner, which this entry point must keep
 * working in.
 *
 * A cyclic value makes `JSON.stringify` throw, so it is re-rendered with the
 * repeats elided — that path is live, because {@link structurallyEqual} tracks
 * cycles and therefore *fails* on a cyclic value rather than overflowing the
 * stack. The elision runs only on the throwing path, so an acyclic value that
 * merely shares a child twice is never mislabelled. Anything still
 * unrepresentable (`undefined`, a function, a symbol) falls back to
 * `String(value)`, and the result is truncated so a large form value cannot
 * bury the label it is attached to.
 *
 * @param value Any value compared by an assertion below.
 */
export function render(value: unknown): string {
  let text: string;

  try {
    text = JSON.stringify(value, renderReplacer) ?? String(value);
  } catch {
    try {
      const seen = new WeakSet<object>();

      text =
        JSON.stringify(value, (key, item: unknown) => {
          if (typeof item === 'object' && item !== null) {
            if (seen.has(item)) return '[Circular]';
            seen.add(item);
          }

          return renderReplacer(key, item);
        }) ?? String(value);
    } catch {
      text = String(value);
    }
  }

  return text.length > MAX_RENDERED_LENGTH
    ? `${text.slice(0, MAX_RENDERED_LENGTH)}…`
    : text;
}

/**
 * @internal Throws unless `actual` deeply equals `expected`.
 *
 * @param actual The value observed.
 * @param expected The value required.
 * @param label Which assertion this is, already carrying the binding mode.
 */
export function assertDeepEqual(
  actual: unknown,
  expected: unknown,
  label: string,
): void {
  if (structurallyEqual(actual, expected)) return;

  throw new MlvFormsBindingAssertionError(
    `${label}: expected ${render(actual)} to deeply equal ${render(expected)}`,
    actual,
    expected,
    'deepEqual',
  );
}

/**
 * @internal Throws unless `actual` is exactly `expected`.
 *
 * @param actual The value observed.
 * @param expected The value required.
 * @param label Which assertion this is, already carrying the binding mode.
 */
export function assertBoolean(
  actual: boolean,
  expected: boolean,
  label: string,
): void {
  if (actual === expected) return;

  throw new MlvFormsBindingAssertionError(
    `${label}: expected ${String(expected)}, got ${String(actual)}`,
    actual,
    expected,
    'strictEqual',
  );
}
