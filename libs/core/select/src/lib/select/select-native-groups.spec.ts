import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component, signal, viewChild } from '@angular/core';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvSelect } from './select';
import type { MlvSelectOption } from '../select-option';

/** Mirrors the component's internal `NativeOption<T>` (not exported). */
interface OracleNativeOption<T> {
  readonly key: string;
  readonly label: string;
  readonly value: T;
  readonly group?: string;
  readonly disabled?: boolean;
}

/** Mirrors the component's internal `NativeOptionGroup<T>` (not exported). */
interface OracleNativeOptionGroup<T> {
  readonly label: string | null;
  readonly options: readonly OracleNativeOption<T>[];
}

/**
 * The `_nativeOptionGroups` body as it stood before #373, copied verbatim
 * (origin/main `871cf9bc`, `select.ts`). Kept as the equality oracle: the
 * one-pass rewrite must produce exactly this output — same runs, same order,
 * same keys — only without re-copying the current run for every option, which
 * made an ungrouped list (one run) cost n²/2 element copies.
 */
function oracleNativeOptionGroups<T>(
  resolvedOptions: readonly MlvSelectOption<T>[],
): readonly OracleNativeOptionGroup<T>[] {
  const groups: OracleNativeOptionGroup<T>[] = [];
  resolvedOptions.forEach((option, index) => {
    const nativeOption: OracleNativeOption<T> = {
      key: String(index),
      label: option.label,
      value: option.value,
      group: option.group,
      disabled: option.disabled,
    };
    const label = option.group || null;
    const previous = groups[groups.length - 1];
    if (previous?.label === label) {
      groups[groups.length - 1] = {
        label,
        options: [...previous.options, nativeOption],
      };
    } else {
      groups.push({ label, options: [nativeOption] });
    }
  });
  return groups;
}

/** A rendered `<option>`, read the way the browser exposes it. */
interface RenderedOption {
  readonly value: string;
  readonly text: string;
  readonly disabled: boolean;
}

/** One element child of the native `<select>`, placeholder excluded. */
type RenderedNode =
  | {
      readonly tag: 'OPTGROUP';
      readonly label: string | null;
      readonly options: RenderedOption[];
    }
  | ({ readonly tag: 'OPTION' } & RenderedOption);

function readOption(option: HTMLOptionElement): RenderedOption {
  return {
    value: option.value,
    text: (option.textContent ?? '').trim(),
    disabled: option.disabled,
  };
}

/** The native `<select>`'s element children, minus the single-mode placeholder. */
function renderedTree(select: HTMLSelectElement): RenderedNode[] {
  return Array.from(select.children)
    .filter(
      (child) => !(child instanceof HTMLOptionElement && child.value === ''),
    )
    .map(
      (child): RenderedNode =>
        child instanceof HTMLOptGroupElement
          ? {
              tag: 'OPTGROUP',
              label: child.getAttribute('label'),
              options: Array.from(child.children).map((option) =>
                readOption(option as HTMLOptionElement),
              ),
            }
          : { tag: 'OPTION', ...readOption(child as HTMLOptionElement) },
    );
}

/**
 * The DOM the template stamps from a group list: a labelled run becomes one
 * `<optgroup>`, an unlabelled run becomes bare `<option>`s at the top level.
 */
function expectedTree<T>(
  groups: readonly OracleNativeOptionGroup<T>[],
): RenderedNode[] {
  const toOption = (option: OracleNativeOption<T>): RenderedOption => ({
    value: option.key,
    text: option.label,
    disabled: option.disabled || false,
  });
  return groups.flatMap((group): RenderedNode[] =>
    group.label
      ? [
          {
            tag: 'OPTGROUP',
            label: group.label,
            options: group.options.map(toOption),
          },
        ]
      : group.options.map((option) => ({
          tag: 'OPTION' as const,
          ...toOption(option),
        })),
  );
}

function option(
  index: number,
  group?: string,
  disabled?: boolean,
): MlvSelectOption<string> {
  return { label: `Option ${index}`, value: `v${index}`, group, disabled };
}

@Component({
  imports: [MlvSelect],
  template: `<mlv-select label="Item" native [options]="options()" />`,
})
class NativeGroupsHost {
  readonly options = signal<MlvSelectOption<string>[]>([]);
  readonly select = viewChild.required(MlvSelect);
}

const CASES: readonly {
  readonly name: string;
  readonly options: MlvSelectOption<string>[];
  readonly labels: readonly (string | null)[];
}[] = [
  { name: 'empty', options: [], labels: [] },
  {
    name: 'ungrouped (one run)',
    options: Array.from({ length: 6 }, (_, i) => option(i, undefined, i === 2)),
    labels: [null],
  },
  {
    name: 'grouped by 50',
    options: Array.from({ length: 150 }, (_, i) =>
      option(i, `Group ${Math.floor(i / 50)}`, i % 7 === 0),
    ),
    labels: ['Group 0', 'Group 1', 'Group 2'],
  },
  {
    name: 'interleaved groups (each non-contiguous run splits)',
    options: Array.from({ length: 6 }, (_, i) => option(i, i % 2 ? 'B' : 'A')),
    labels: ['A', 'B', 'A', 'B', 'A', 'B'],
  },
  {
    name: "undefined and '' group labels (both unlabelled, one run when adjacent)",
    options: [
      option(0),
      option(1, ''),
      option(2, 'A'),
      option(3, 'A', true),
      option(4, ''),
      option(5),
      option(6, 'B'),
      option(7),
    ],
    labels: [null, 'A', null, 'B', null],
  },
  {
    name: 'ungrouped head, then a group that recurs after another',
    options: [
      option(0),
      option(1),
      option(2, 'X'),
      option(3, 'X'),
      option(4, 'Y'),
      option(5, 'X'),
    ],
    labels: [null, 'X', 'Y', 'X'],
  },
];

describe('MlvSelect — native option groups (#373)', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NativeGroupsHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
  });

  async function render(
    options: MlvSelectOption<string>[],
  ): Promise<ComponentFixture<NativeGroupsHost>> {
    const fixture = TestBed.createComponent(NativeGroupsHost);
    fixture.componentInstance.options.set(options);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  it.each(CASES)(
    'matches the pre-#373 grouping, in the computed and in the DOM: $name',
    async ({ options, labels }) => {
      const fixture = await render(options);
      const select = fixture.componentInstance.select();
      const groups = select['_nativeOptionGroups']();
      const oracle = oracleNativeOptionGroups(select.resolvedOptions());

      expect(groups).toStrictEqual(oracle);
      expect(groups.map((group) => group.label)).toEqual(labels);
      expect(
        groups.flatMap((group) => group.options.map((o) => o.key)),
      ).toEqual(options.map((_, index) => String(index)));

      const nativeSelect = fixture.nativeElement.querySelector(
        'select',
      ) as HTMLSelectElement;
      expect(renderedTree(nativeSelect)).toEqual(expectedTree(oracle));
    },
  );

  it('builds fresh run arrays per computation and never mutates an earlier result', async () => {
    const first = Array.from({ length: 4 }, (_, i) => option(i));
    const fixture = await render(first);
    const select = fixture.componentInstance.select();
    const before = select['_nativeOptionGroups']();
    // Same-realm deep copy (`structuredClone` hands back objects whose
    // constructor `toStrictEqual` does not accept as equal).
    const snapshot = before.map((group) => ({
      label: group.label,
      options: group.options.map((o) => ({ ...o })),
    }));

    // Same unlabelled run, two options longer: the case a run array shared
    // across computations would silently grow in the earlier result.
    fixture.componentInstance.options.set([...first, option(4), option(5)]);
    fixture.detectChanges();
    await fixture.whenStable();
    const after = select['_nativeOptionGroups']();

    expect(before).toStrictEqual(snapshot);
    expect(after).not.toBe(before);
    expect(after[0].options).not.toBe(before[0].options);
    expect(after).toStrictEqual(
      oracleNativeOptionGroups(select.resolvedOptions()),
    );
  });

  // Complexity pin, not a tight wall-clock bound: measured under this runner,
  // the one-pass build takes 4-9 ms and the pre-#373 build 6-16 s (n²/2
  // copies of the one run), so 250 ms fails the quadratic by more than 20x
  // and passes the linear build by about 30x. The component is not in native
  // mode: the computed does not depend on it, and rendering 50,000 <option>
  // views in jsdom would time the renderer instead of the grouping.
  it('groups 50,000 ungrouped options in linear time', () => {
    const n = 50_000;
    const fixture = TestBed.createComponent(MlvSelect);
    fixture.componentRef.setInput(
      'options',
      Array.from({ length: n }, (_, i) => option(i)),
    );
    const select = fixture.componentInstance;
    // Resolve the options first so only the grouping is timed.
    expect(select.resolvedOptions().length).toBe(n);

    const start = performance.now();
    const groups = select['_nativeOptionGroups']();
    const elapsed = Math.round(performance.now() - start);

    expect(groups.length).toBe(1);
    expect(groups[0].label).toBeNull();
    expect(groups[0].options.length).toBe(n);
    expect(groups[0].options[n - 1].key).toBe(String(n - 1));
    expect(elapsed).toBeLessThan(250);
  }, 30_000);
});
