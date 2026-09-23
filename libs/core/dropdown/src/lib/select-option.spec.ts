import {
  defaultOptionTransform,
  isSelectOption,
  resolveOptions,
} from './select-option';
import type { MlvSelectOption } from './select-option';

/**
 * `isSelectOption` decides whether an item is already an option (used as-is)
 * or a raw item (wrapped as `{ label: String(item), value: item }`). It is the
 * default `toOption` of `mlv-select`, `mlv-combobox` and `[mlvAutocomplete]`
 * through `defaultOptionTransform`, so a wrong answer here turns an option into
 * a row reading "[object Object]" whose value is the whole object (#300).
 */
describe('isSelectOption / defaultOptionTransform — falsy label or value (#300)', () => {
  const falsyValues: readonly [string, unknown][] = [
    ['false', false],
    ['0', 0],
    ["''", ''],
    ['NaN', Number.NaN],
    ['null', null],
    ['undefined', undefined],
  ];

  describe.each(falsyValues)('an option whose value is %s', (_, value) => {
    const option = { label: 'Label', value };

    it('is recognised as an option', () => {
      expect(isSelectOption(option)).toBe(true);
    });

    it('is used as-is by the default transform, value intact', () => {
      const resolved = defaultOptionTransform<unknown>(option);
      expect(resolved).toBe(option);
      expect(resolved.label).toBe('Label');
      expect(resolved.value).toBe(value);
    });
  });

  it('recognises an option whose label is the empty string', () => {
    const option = { label: '', value: 'blank' };
    expect(isSelectOption(option)).toBe(true);
    expect(defaultOptionTransform<unknown>(option)).toBe(option);
  });

  it('recognises an option whose label and value are both falsy', () => {
    const option = { label: '', value: false };
    expect(isSelectOption(option)).toBe(true);
    expect(defaultOptionTransform<unknown>(option)).toBe(option);
  });

  it('recognises an option whose value is inherited rather than own', () => {
    // `in` walks the prototype chain, as the old `candidate.value` read did.
    class Answer {
      readonly label = 'No';
      get value(): boolean {
        return false;
      }
    }
    const option = new Answer();
    expect(isSelectOption(option)).toBe(true);
    expect(defaultOptionTransform<unknown>(option)).toBe(option);
  });

  it('keeps every carried field (group, disabled) on a falsy-valued option', () => {
    const option: MlvSelectOption<number> = {
      label: 'Zero',
      value: 0,
      group: 'Numbers',
      disabled: true,
    };
    expect(defaultOptionTransform(option)).toBe(option);
  });

  it('never labels a falsy-valued option "[object Object]" when resolving a list', () => {
    const items: unknown[] = [
      { label: 'No', value: false },
      { label: 'Yes', value: true },
      { label: 'Zero', value: 0 },
      { label: 'Empty', value: '' },
      { label: 'None', value: null },
      { label: '', value: 'blank' },
    ];
    const resolved = resolveOptions(items, defaultOptionTransform);
    expect(resolved.map((o) => o.label)).toEqual([
      'No',
      'Yes',
      'Zero',
      'Empty',
      'None',
      '',
    ]);
    expect(resolved.map((o) => o.value)).toEqual([
      false,
      true,
      0,
      '',
      null,
      'blank',
    ]);
  });

  describe('unchanged answers', () => {
    it('still recognises a truthy label / value pair', () => {
      const option = { label: 'Apple', value: 'apple' };
      expect(isSelectOption(option)).toBe(true);
      expect(defaultOptionTransform<unknown>(option)).toBe(option);
    });

    it('still recognises a non-string label, as it did while the label was truthy', () => {
      // Outside the `label: string` contract, but an untyped API payload
      // (`{ label: 2024, value: 2024 }`) rendered correctly before #300. A
      // `typeof label === 'string'` guard would have turned it into
      // "[object Object]"; the guard only rejects a missing label.
      const year = { label: 2024, value: 2024 };
      expect(isSelectOption(year)).toBe(true);
      expect(defaultOptionTransform<unknown>(year)).toBe(year);
    });

    it.each<[string, unknown]>([
      ['null', null],
      ['undefined', undefined],
      ['a string', 'Apple'],
      ['false', false],
      ['0', 0],
      ["''", ''],
      ['an object with no value key', { label: 'Orphan' }],
      ['an object with no label key', { value: 1 }],
      ['an object whose label is null', { label: null, value: 1 }],
      ['an object whose label is undefined', { label: undefined, value: 1 }],
    ])('still wraps %s as a raw item', (_, item) => {
      expect(isSelectOption(item)).toBe(false);
      const resolved = defaultOptionTransform<unknown>(item);
      expect(resolved).toEqual({ label: String(item), value: item });
      expect(resolved.value).toBe(item);
    });
  });
});
