import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { MlvFormsBindingAdapter } from '@malva-ui/core/form-utils/testing';
import { verifyFormsBinding } from '@malva-ui/core/form-utils/testing';

/**
 * `@malva-ui/core/form-utils/testing` is a PUBLISHED entry point, and its
 * bundle carries every bare specifier its sources import. It used to open with
 * `import { expect } from 'vitest'`, which `@malva-ui/core` declares nowhere —
 * so a consumer on Jest, Karma or Web Test Runner got `Cannot find module
 * 'vitest'` (#243, shipped in `@malva-ui/core@0.1.15`).
 *
 * Removing that import makes the assertions this repo's own code, and twenty-odd
 * `*-binding-matrix.spec.ts` files depend on them THROWING. An assertion that
 * quietly never throws turns every one of those suites green having verified
 * nothing — a far worse failure than the import was — so each of the four
 * expectations is driven to its failing side here.
 */

/** @internal A mutable form side the assertions below can be made to fail on. */
class StubFormSide<T> implements MlvFormsBindingAdapter<T> {
  /** @internal Which binding mode this run reports itself as. */
  mode: MlvFormsBindingAdapter<T>['mode'] = 'reactive';

  /** @internal What {@link getValue} reports, whatever was written. */
  value: T;

  /** @internal What {@link isTouched} reports, whatever `blur` did. */
  touched = false;

  /** @internal What {@link isDisabled} reports, whatever was set. */
  disabled = false;

  /** @internal Makes the mode drop a form-side write, as a broken CVA would. */
  ignoreWrites = false;

  /** @internal Makes the mode drop a form-side disable. */
  ignoreDisable = false;

  constructor(value: T) {
    this.value = value;
  }

  setValue(value: T): void {
    if (!this.ignoreWrites) this.value = value;
  }

  getValue(): T {
    return this.value;
  }

  isTouched(): boolean {
    return this.touched;
  }

  setDisabled(disabled: boolean): void {
    if (!this.ignoreDisable) this.disabled = disabled;
  }

  isDisabled(): boolean {
    return this.disabled;
  }
}

/** @internal The error a matrix run threw; fails the test when it threw none. */
async function failureOf(
  run: Promise<void>,
): Promise<Error & { actual?: unknown; expected?: unknown }> {
  try {
    await run;
  } catch (error) {
    return error as Error & { actual?: unknown; expected?: unknown };
  }
  throw new Error('verifyFormsBinding resolved where it had to reject');
}

describe('verifyFormsBinding', () => {
  it('resolves when every expectation holds', async () => {
    const adapter = new StubFormSide('initial');

    await verifyFormsBinding({
      adapter,
      sample: 'written',
      interact: () => {
        adapter.value = 'interacted';
      },
      expectedAfterInteraction: 'interacted',
      blur: () => {
        adapter.touched = true;
      },
    });

    // The disabled leg runs last and must have left the control re-enabled.
    expect(adapter.disabled).toBe(false);
  });

  it('rejects when a form-side write does not round-trip', async () => {
    const adapter = new StubFormSide('initial');
    adapter.ignoreWrites = true;

    const error = await failureOf(
      verifyFormsBinding({
        adapter,
        sample: 'written',
        interact: () => undefined,
        expectedAfterInteraction: 'written',
      }),
    );

    expect(error.message).toContain('[reactive] form-side write round-trip');
    expect(error.actual).toBe('initial');
    expect(error.expected).toBe('written');
  });

  it('rejects when a user interaction does not reach the form side', async () => {
    const adapter = new StubFormSide('initial');

    const error = await failureOf(
      verifyFormsBinding({
        adapter,
        sample: 'written',
        interact: () => undefined,
        expectedAfterInteraction: 'interacted',
      }),
    );

    expect(error.message).toContain('[reactive] user interaction result');
    expect(error.actual).toBe('written');
  });

  it('rejects when blur does not mark the control touched', async () => {
    const adapter = new StubFormSide('initial');

    const error = await failureOf(
      verifyFormsBinding({
        adapter,
        sample: 'written',
        interact: () => undefined,
        expectedAfterInteraction: 'written',
        blur: () => undefined,
      }),
    );

    expect(error.message).toContain('[reactive] touched after blur');
  });

  it('rejects when the control was already touched before blur', async () => {
    const adapter = new StubFormSide('initial');
    adapter.touched = true;

    const error = await failureOf(
      verifyFormsBinding({
        adapter,
        sample: 'written',
        interact: () => undefined,
        expectedAfterInteraction: 'written',
        blur: () => undefined,
      }),
    );

    expect(error.message).toContain('[reactive] untouched before blur');
  });

  it('rejects when disabling from the form side does not reach the control', async () => {
    const adapter = new StubFormSide('initial');
    adapter.ignoreDisable = true;

    const error = await failureOf(
      verifyFormsBinding({
        adapter,
        sample: 'written',
        interact: () => undefined,
        expectedAfterInteraction: 'written',
      }),
    );

    expect(error.message).toContain('[reactive] disabled propagated');
  });

  // The mode label is the only thing telling three otherwise identical runs
  // apart in a report, so it has to survive into the message.
  it('names the failing binding mode', async () => {
    const adapter = new StubFormSide('initial');
    adapter.ignoreWrites = true;
    adapter.mode = 'signal-forms';

    const error = await failureOf(
      verifyFormsBinding({
        adapter,
        sample: 'written',
        interact: () => undefined,
        expectedAfterInteraction: 'written',
      }),
    );

    expect(error.message).toContain('[signal-forms]');
  });
});

/**
 * @internal A form side that rebuilds every write into a distinct object
 * graph, so the round-trip leg actually compares two graphs instead of one
 * reference to itself. Every `*-binding-matrix.spec.ts` in the workspace binds
 * a real Angular `FormControl`, which stores the value it is handed, so that
 * leg is reference-identical in all of them and `fast-equals` short-circuits
 * before comparing anything.
 *
 * The rebuild is passed in per shape rather than done with `structuredClone`:
 * jsdom's `structuredClone` returns objects in the **jsdom realm**, whose
 * `Object` / `Array` / `Date` are not the ones this file sees, and `fast-equals`
 * (like `toEqual` before it) requires matching constructors — so every such
 * clone compares unequal for a reason that has nothing to do with the value.
 * It also drops a `File`'s `name` / `size` / `type` outright.
 */
class CloningFormSide<T> extends StubFormSide<T> {
  constructor(
    value: T,
    private readonly rebuild: (value: T) => T,
  ) {
    super(value);
  }

  override setValue(value: T): void {
    if (!this.ignoreWrites) this.value = this.rebuild(value);
  }
}

describe('verifyFormsBinding value comparison', () => {
  // A real FormControl stores the array it is handed, so the round-trip leg is
  // reference-identical and short-circuits; it is the INTERACTION leg that
  // compares two distinct graphs in the shipped matrices. Both are driven
  // structurally here — the round-trip one through a stub that clones on write.
  it('compares structurally, not by reference', async () => {
    const adapter = new CloningFormSide(
      { start: new Date(2026, 6, 10), end: new Date(2026, 6, 12) },
      ({ start, end }) => ({ start: new Date(start), end: new Date(end) }),
    );

    await verifyFormsBinding({
      adapter,
      sample: { start: new Date(2026, 6, 10), end: new Date(2026, 6, 12) },
      interact: () => undefined,
      expectedAfterInteraction: {
        start: new Date(2026, 6, 10),
        end: new Date(2026, 6, 12),
      },
    });

    expect(adapter.getValue().start.getDate()).toBe(10);
  });

  it('rejects a structurally different value of the same shape', async () => {
    const adapter = new StubFormSide({ start: new Date(2026, 6, 10) });
    adapter.ignoreWrites = true;

    const error = await failureOf(
      verifyFormsBinding({
        adapter,
        sample: { start: new Date(2026, 6, 11) },
        interact: () => undefined,
        expectedAfterInteraction: { start: new Date(2026, 6, 11) },
      }),
    );

    expect(error.message).toContain('[reactive] form-side write round-trip');
  });

  it('rejects a nested array element that differs', async () => {
    const adapter = new StubFormSide([{ label: 'Angular', value: 'angular' }]);
    adapter.ignoreWrites = true;

    const error = await failureOf(
      verifyFormsBinding({
        adapter,
        sample: [{ label: 'Angular', value: 'ng' }],
        interact: () => undefined,
        expectedAfterInteraction: [{ label: 'Angular', value: 'ng' }],
      }),
    );

    expect(error.message).toContain('to deeply equal');
  });

  // #243: `fast-equals` maps no comparator to `[object File]` and falls through
  // to `false`, so out of the box NO two distinct Files are ever equal —
  // `mlv-file-upload`'s matrix would be permanently red the moment its control
  // stopped handing back the identical object. The helper supplies one.
  it('compares two distinct Files by identity metadata', async () => {
    const lastModified = 1_760_000_000_000;
    const file = (contents: string) =>
      new File([contents], 'report.txt', {
        type: 'text/plain',
        lastModified,
      });
    const adapter = new CloningFormSide(
      [{ id: 'report', file: file('report'), name: 'report.txt' }],
      (entries) =>
        entries.map((entry) => ({
          ...entry,
          file: new File(['report'], entry.file.name, {
            type: entry.file.type,
            lastModified: entry.file.lastModified,
          }),
        })),
    );

    await verifyFormsBinding({
      adapter,
      sample: [{ id: 'report', file: file('report'), name: 'report.txt' }],
      interact: () => undefined,
      expectedAfterInteraction: [
        { id: 'report', file: file('report'), name: 'report.txt' },
      ],
    });

    expect(adapter.getValue()[0].file.name).toBe('report.txt');
  });

  it('rejects two Files differing in name, which toEqual reported as equal', async () => {
    const lastModified = 1_760_000_000_000;
    const adapter = new StubFormSide([
      new File(['report'], 'report.txt', { type: 'text/plain', lastModified }),
    ]);
    adapter.ignoreWrites = true;

    const error = await failureOf(
      verifyFormsBinding({
        adapter,
        sample: [
          new File(['report'], 'other.txt', {
            type: 'text/plain',
            lastModified,
          }),
        ],
        interact: () => undefined,
        expectedAfterInteraction: [],
      }),
    );

    // A File has no enumerable own properties, so JSON.stringify renders it as
    // `{}` — the message has to name it some other way to be worth reading.
    expect(error.message).toContain('File(report.txt, 6 B, text/plain)');
    expect(error.message).toContain('File(other.txt, 6 B, text/plain)');
  });

  // Documented divergence, and in the LOOSENING direction: `toEqual`
  // distinguished -0 from +0, `fast-equals` compares numbers with SameValueZero
  // and does not. Pinned so a future comparator swap cannot move it silently.
  it('accepts -0 where +0 was expected', async () => {
    const adapter = new StubFormSide(0);

    await verifyFormsBinding({
      adapter,
      sample: -0,
      interact: () => undefined,
      expectedAfterInteraction: 0,
    });

    expect(Object.is(adapter.getValue(), -0)).toBe(true);
  });

  // Documented divergence in the STRICTER direction: `toEqual` treats an own
  // property valued `undefined` as absent, `fast-equals` compares key sets.
  it('rejects an own undefined-valued property against an absent one', async () => {
    const adapter = new StubFormSide<Record<string, unknown>>({ id: 'a' });
    adapter.ignoreWrites = true;

    const error = await failureOf(
      verifyFormsBinding({
        adapter,
        sample: { id: 'a', note: undefined },
        interact: () => undefined,
        expectedAfterInteraction: { id: 'a', note: undefined },
      }),
    );

    expect(error.message).toContain('[reactive] form-side write round-trip');
  });

  // #243: plain `deepEqual` recurses into a cycle until the stack overflows, so
  // a form value carrying a back-reference raised a RangeError with NO mode
  // label — with three modes the report could not say which run failed, and it
  // read as a bug in the helper. The circular comparator makes it an assertion.
  it('fails a cyclic value as an assertion, not a RangeError', async () => {
    const cyclic = (id: string): Record<string, unknown> => {
      const node: Record<string, unknown> = { id };
      node['parent'] = node;
      return node;
    };
    const adapter = new StubFormSide(cyclic('a'));
    adapter.ignoreWrites = true;

    const error = await failureOf(
      verifyFormsBinding({
        adapter,
        sample: cyclic('b'),
        interact: () => undefined,
        expectedAfterInteraction: cyclic('b'),
      }),
    );

    expect(error.name).toBe('AssertionError');
    expect(error.message).toContain('[reactive] form-side write round-trip');
    // The rendering falls back to eliding the repeat rather than throwing.
    expect(error.message).toContain('[Circular]');
  });

  it('accepts two structurally equal cyclic values', async () => {
    const cyclic = (): Record<string, unknown> => {
      const node: Record<string, unknown> = { id: 'a' };
      node['parent'] = node;
      return node;
    };
    const adapter = new CloningFormSide(cyclic(), () => cyclic());

    await verifyFormsBinding({
      adapter,
      sample: cyclic(),
      interact: () => undefined,
      expectedAfterInteraction: cyclic(),
    });

    expect(adapter.getValue()['id']).toBe('a');
  });
});

describe('verifyFormsBinding failure shape', () => {
  // Vitest's reporter prints its expected/received diff for any error carrying
  // this shape, not only for one `expect` threw — which is what lets the helper
  // drop its `vitest` import without a consumer of THIS repo losing the diff.
  it('throws an AssertionError vitest can diff', async () => {
    const adapter = new StubFormSide('initial');
    adapter.ignoreWrites = true;

    const error = await failureOf(
      verifyFormsBinding({
        adapter,
        sample: 'written',
        interact: () => undefined,
        expectedAfterInteraction: 'written',
      }),
    );

    expect(error.name).toBe('AssertionError');
    expect((error as { showDiff?: boolean }).showDiff).toBe(true);
    expect((error as { operator?: string }).operator).toBe('deepEqual');
  });

  // A message a runner with no diff support can still act on.
  it('renders both values into the message', async () => {
    const adapter = new StubFormSide({ id: 'a' });
    adapter.ignoreWrites = true;

    const error = await failureOf(
      verifyFormsBinding({
        adapter,
        sample: { id: 'b' },
        interact: () => undefined,
        expectedAfterInteraction: { id: 'b' },
      }),
    );

    expect(error.message).toContain('{"id":"a"}');
    expect(error.message).toContain('{"id":"b"}');
  });
});

// ─── The published surface ───────────────────────────────────────────────────

/**
 * Every source under the published `@malva-ui/core/form-utils/testing` entry
 * point, walked recursively from `testing/src` — the barrel included, since it
 * is the file most likely to grow a re-export. Resolved from this file's own
 * location rather than `process.cwd()`: the `@nx/vitest:test` executor runs
 * with the workspace root as cwd while the inferred `vite:test` target runs
 * from the project root.
 */
const testingEntryPointSources = (() => {
  const root = resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../testing/src',
  );

  const walk = (
    dir: string,
    prefix: string,
  ): { name: string; source: string }[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const name = prefix ? `${prefix}/${entry.name}` : entry.name;

      if (entry.isDirectory()) return walk(join(dir, entry.name), name);

      return entry.name.endsWith('.ts')
        ? [{ name, source: readFileSync(join(dir, entry.name), 'utf8') }]
        : [];
    });

  return walk(root, '');
})();

/** Every way a bare specifier can enter an ES module. */
const IMPORT_FORMS = ['import', 'export-from', 'require'] as const;

/**
 * Whether `source` pulls in `specifier` through one of {@link IMPORT_FORMS}.
 * Matched against import STATEMENTS rather than the file text, so the prose in
 * these sources, which names `vitest` several times, does not read as one.
 *
 * @param source The full text of one TypeScript source file.
 * @param specifier The bare module specifier to look for.
 * @param form Which of the three syntactic forms to look for.
 */
function importsSpecifier(
  source: string,
  specifier: string,
  form: (typeof IMPORT_FORMS)[number],
): boolean {
  const quoted = `['"]${specifier.replace(/[/@.]/g, '\\$&')}['"]`;
  const pattern = {
    import: `^\\s*import\\b[^;]*?${quoted}`,
    'export-from': `^\\s*export\\b[^;]*?\\bfrom\\s*${quoted}`,
    require: `\\brequire\\s*\\(\\s*${quoted}\\s*\\)`,
  }[form];

  return new RegExp(pattern, 'm').test(source);
}

describe('importsSpecifier', () => {
  // The sweep below is only as good as this matcher, and a real-file ablation
  // cannot prove two of the three forms: `require('vitest')` throws inside
  // Vitest before any spec collects, and `export * from 'jasmine'` does not
  // resolve at all. So the matcher is driven against synthetic sources here.
  it.each([
    ["import { expect } from 'vitest';", 'import'],
    ["import 'vitest';", 'import'],
    ["import {\n  expect,\n} from 'vitest';", 'import'],
    ['import { expect } from "vitest";', 'import'],
    ["export { expect } from 'vitest';", 'export-from'],
    ["export * from 'vitest';", 'export-from'],
    ["export * as v from 'vitest';", 'export-from'],
    ["const v = require('vitest');", 'require'],
    ['const v = require("vitest");', 'require'],
  ] as const)('matches %j as %s', (source, form) => {
    expect(importsSpecifier(source, 'vitest', form)).toBe(true);
  });

  it.each([
    '// a comment mentioning vitest and its expect',
    "const name = 'vitest';",
    "import { verifyFormsBinding } from '@malva-ui/core/form-utils/testing';",
    "import { deepEqual } from 'fast-equals';",
  ])('does not match %j in any form', (source) => {
    for (const form of IMPORT_FORMS) {
      expect(importsSpecifier(source, 'vitest', form)).toBe(false);
    }
  });

  // The specifier is interpolated into a regex, so its punctuation has to be
  // escaped or `node:assert` would also match `nodeXassert`.
  it('does not treat specifier punctuation as regex syntax', () => {
    expect(
      importsSpecifier("import x from 'nodeXassert';", 'node:assert', 'import'),
    ).toBe(false);
    expect(
      importsSpecifier("import x from 'node:assert';", 'node:assert', 'import'),
    ).toBe(true);
    expect(
      importsSpecifier(
        "import x from '@jestXglobals';",
        '@jest/globals',
        'import',
      ),
    ).toBe(false);
    expect(
      importsSpecifier(
        "import x from '@jest/globals';",
        '@jest/globals',
        'import',
      ),
    ).toBe(true);
  });
});

describe('@malva-ui/core/form-utils/testing published sources', () => {
  // Without this the sweep below iterates an empty list and asserts nothing —
  // and a sweep that read `lib/` only would not see the barrel at all, which is
  // exactly where an `export … from 'vitest'` would land.
  it('reads the entry point it is asserting about', () => {
    expect(testingEntryPointSources.map((file) => file.name).sort()).toEqual([
      'index.ts',
      'lib/binding-assertions.ts',
      'lib/forms-binding-matrix.ts',
    ]);
  });

  // #243: ng-packagr builds this entry point and `dist/libs/core/package.json`
  // exports it, so anything it imports must be something `@malva-ui/core`
  // declares — and a test runner is never that, because declaring one would
  // install it into every consumer application.
  it('imports no test runner', () => {
    for (const { name, source } of testingEntryPointSources) {
      for (const runner of [
        'vitest',
        'jest',
        '@jest/globals',
        'jasmine',
        'chai',
        'node:assert',
        'node:test',
      ]) {
        for (const form of IMPORT_FORMS) {
          expect(
            importsSpecifier(source, runner, form),
            `${name} must not ${form} ${runner}`,
          ).toBe(false);
        }
      }
    }
  });
});
