import { MlvActiveDescendant, optionId } from './active-descendant';

describe('optionId', () => {
  it('formats as `<listboxId>-option-<index>`', () => {
    expect(optionId('lb', 0)).toBe('lb-option-0');
    expect(optionId('my-listbox', 3)).toBe('my-listbox-option-3');
  });

  it('matches the id format the dropdown panel stamps on each option', () => {
    // Same shape the panel's `optionId(index)` method produces, so a trigger's
    // `aria-activedescendant` and the rendered option id can never drift.
    const listboxId = 'combo-42-listbox';
    expect(optionId(listboxId, 7)).toBe(`${listboxId}-option-7`);
  });
});

describe('MlvActiveDescendant', () => {
  /** Builds an `MlvActiveDescendant` over a mutable count so tests can vary it. */
  function make(initialCount: number): {
    ad: MlvActiveDescendant;
    setCount: (n: number) => void;
  } {
    let count = initialCount;
    const ad = new MlvActiveDescendant(() => count);
    return { ad, setCount: (n) => (count = n) };
  }

  it('starts with no active option (-1)', () => {
    const { ad } = make(3);
    expect(ad.index()).toBe(-1);
  });

  describe('move', () => {
    it('a forward move from -1 activates the first option', () => {
      const { ad } = make(3);
      ad.move(1);
      expect(ad.index()).toBe(0);
    });

    it('a backward move from -1 activates the last option', () => {
      const { ad } = make(3);
      ad.move(-1);
      expect(ad.index()).toBe(2);
    });

    it('advances forward within range', () => {
      const { ad } = make(3);
      ad.move(1); // -> 0
      ad.move(1); // -> 1
      expect(ad.index()).toBe(1);
    });

    it('wraps forward from the last option to the first', () => {
      const { ad } = make(3);
      ad.move(1); // 0
      ad.move(1); // 1
      ad.move(1); // 2
      ad.move(1); // wraps -> 0
      expect(ad.index()).toBe(0);
    });

    it('wraps backward from the first option to the last', () => {
      const { ad } = make(3);
      ad.move(1); // -> 0
      ad.move(-1); // wraps -> 2
      expect(ad.index()).toBe(2);
    });

    it('resets to -1 when there are no options', () => {
      const { ad, setCount } = make(3);
      ad.move(1); // -> 0
      setCount(0);
      ad.move(1);
      expect(ad.index()).toBe(-1);
    });

    it('reads the option count lazily, reflecting the live value', () => {
      const { ad, setCount } = make(2);
      ad.move(-1); // last of 2 -> 1
      expect(ad.index()).toBe(1);
      setCount(5);
      ad.move(-1); // from 1 -> 0 (still in range; count now 5)
      expect(ad.index()).toBe(0);
    });
  });

  describe('first / last', () => {
    it('first activates index 0 when there are options', () => {
      const { ad } = make(4);
      ad.first();
      expect(ad.index()).toBe(0);
    });

    it('last activates the final index when there are options', () => {
      const { ad } = make(4);
      ad.last();
      expect(ad.index()).toBe(3);
    });

    it('first is a no-op when there are no options', () => {
      const { ad, setCount } = make(4);
      ad.last(); // -> 3
      setCount(0);
      ad.first();
      expect(ad.index()).toBe(3);
    });

    it('last is a no-op when there are no options', () => {
      const { ad, setCount } = make(4);
      ad.first(); // -> 0
      setCount(0);
      ad.last();
      expect(ad.index()).toBe(0);
    });

    it('last tracks the live count', () => {
      const { ad, setCount } = make(3);
      ad.last();
      expect(ad.index()).toBe(2);
      setCount(6);
      ad.last();
      expect(ad.index()).toBe(5);
    });
  });

  describe('reset', () => {
    it('clears the active option back to -1', () => {
      const { ad } = make(3);
      ad.first(); // -> 0
      ad.reset();
      expect(ad.index()).toBe(-1);
    });
  });
});
