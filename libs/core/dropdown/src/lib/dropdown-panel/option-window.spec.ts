import type { MlvSelectOption } from '../select-option';
import {
  ariaDefaultTabStop,
  DROPDOWN_WINDOW_PAGE,
  optionSetPositions,
  windowLimitFor,
  windowSurvival,
} from './option-window';

function option(value: string, group?: string): MlvSelectOption<string> {
  return { label: value, value, group };
}

describe('option window helpers (#318)', () => {
  describe('ariaDefaultTabStop', () => {
    const enabled = (): boolean => true;

    it('picks the first checked option aria can focus', () => {
      expect(ariaDefaultTabStop([false, true, true], enabled)).toBe(1);
      expect(ariaDefaultTabStop([true, false, true], (i) => i !== 0)).toBe(2);
    });

    it('falls back to the first option aria can focus', () => {
      expect(ariaDefaultTabStop([false, false, false], enabled)).toBe(0);
      expect(ariaDefaultTabStop([true, false, false], (i) => i === 2)).toBe(2);
    });

    it('is -1 when nothing can be focused', () => {
      expect(ariaDefaultTabStop([], enabled)).toBe(-1);
      expect(ariaDefaultTabStop([true, true], () => false)).toBe(-1);
    });
  });

  describe('windowLimitFor', () => {
    it('rounds the required row up to whole pages', () => {
      expect(windowLimitFor(-1)).toBe(0);
      expect(windowLimitFor(0)).toBe(DROPDOWN_WINDOW_PAGE);
      expect(windowLimitFor(DROPDOWN_WINDOW_PAGE - 1)).toBe(
        DROPDOWN_WINDOW_PAGE,
      );
      expect(windowLimitFor(DROPDOWN_WINDOW_PAGE)).toBe(
        2 * DROPDOWN_WINDOW_PAGE,
      );
    });
  });

  describe('windowSurvival', () => {
    const base = ['a', 'b', 'c', 'd'].map((v) => option(v));
    /** `base`'s values under the given group per position. */
    const grouped = (...groups: (string | undefined)[]) =>
      base.map((row, i) => option(row.value, groups[i]));

    it('keeps every view for the same array and for rows appended behind it', () => {
      expect(windowSurvival(base, base, 2)).toBe('views');
      expect(windowSurvival(base, [...base, option('e')], 4)).toBe('views');
    });

    it('keeps them when only rows past the window change', () => {
      expect(
        windowSurvival(base, [base[0], base[1], option('x'), option('y')], 2),
      ).toBe('views');
      expect(windowSurvival(base, grouped(undefined, undefined, 'G'), 2)).toBe(
        'views',
      );
    });

    it('is none when a rendered position holds a different value', () => {
      expect(
        windowSurvival(base, [base[1], base[0], ...base.slice(2)], 4),
      ).toBe('none');
      expect(windowSurvival(base, [option('a'), option('z')], 4)).toBe('none');
      // A different value outranks a regrouping before it.
      expect(windowSurvival(base, [option('a', 'G'), option('z')], 4)).toBe(
        'none',
      );
    });

    it('compares values with Object.is, as the row tracking does', () => {
      const nan = [{ label: 'n', value: NaN }];
      expect(windowSurvival(nan, [{ label: 'n', value: NaN }], 1)).toBe(
        'views',
      );
      const zero = [{ label: 'z', value: 0 }];
      expect(windowSurvival(zero, [{ label: 'z', value: -0 }], 1)).toBe('none');
    });

    it('is rows when a rendered row changes group run', () => {
      // Run boundary moves: c now starts a run.
      expect(
        windowSurvival(
          grouped('A', 'A', 'A', 'A'),
          grouped('B', 'B', 'A', 'A'),
          4,
        ),
      ).toBe('rows');
      // A run turns labelled or headerless.
      expect(windowSurvival(base, grouped('G', 'G', 'G', 'G'), 4)).toBe('rows');
      expect(
        windowSurvival(grouped('A', 'A', 'A', 'A'), grouped('A', 'A'), 4),
      ).toBe('rows');
    });

    it('keeps every view when a group is renamed in place', () => {
      expect(
        windowSurvival(
          grouped('A', 'A', 'B', 'B'),
          grouped('X', 'X', 'Y', 'Y'),
          4,
        ),
      ).toBe('views');
    });

    it('reads an empty group as no group, as the grouped template does', () => {
      expect(windowSurvival(base, grouped('', '', '', ''), 4)).toBe('views');
      expect(
        windowSurvival(
          grouped('A', '', undefined, 'A'),
          grouped('A', undefined, '', 'A'),
          4,
        ),
      ).toBe('views');
    });
  });

  describe('optionSetPositions', () => {
    it('numbers an ungrouped list as one set', () => {
      const positions = optionSetPositions(
        ['a', 'b', 'c'].map((v) => option(v)),
        false,
      );
      expect([0, 1, 2].map(positions.posInSet)).toEqual([1, 2, 3]);
      expect([0, 1, 2].map(positions.setSize)).toEqual([3, 3, 3]);
    });

    it('numbers each labelled group on its own and headerless runs together at listbox level', () => {
      // Rendered as: a, b, <group X: c, d>, e, <group Y: f>, <group X: g>
      const options = [
        option('a'),
        option('b'),
        option('c', 'X'),
        option('d', 'X'),
        option('e'),
        option('f', 'Y'),
        option('g', 'X'),
      ];
      const positions = optionSetPositions(options, true);
      const indices = options.map((_, i) => i);

      expect(indices.map(positions.posInSet)).toEqual([1, 2, 1, 2, 3, 1, 1]);
      expect(indices.map(positions.setSize)).toEqual([3, 3, 2, 2, 3, 1, 1]);
    });
  });
});
