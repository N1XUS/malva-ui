import { describe, expect, it } from 'vitest';
import { filteredOutCommitted, isReconciliationEmit } from './reconciliation';

const eq = (a: string, b: string) => a === b;

describe('isReconciliationEmit', () => {
  it('is true when nothing is added and every removed value is filtered out of view', () => {
    // committed A, B; visible only A (B filtered out); aria re-emits [A]
    expect(isReconciliationEmit(['A'], ['A', 'B'], ['A'], eq)).toBe(true);
  });

  it('is true when the emit exactly restates the committed selection', () => {
    expect(isReconciliationEmit(['A'], ['A'], ['A', 'B'], eq)).toBe(true);
  });

  it('is false when a value is added', () => {
    expect(isReconciliationEmit(['A', 'B'], ['A'], ['A', 'B'], eq)).toBe(false);
  });

  it('is false when a still-visible value is removed (genuine deselect)', () => {
    expect(isReconciliationEmit([], ['A'], ['A'], eq)).toBe(false);
  });

  it('is true for the empty-options initial-load case (value present, nothing rendered yet)', () => {
    expect(isReconciliationEmit([], ['A'], [], eq)).toBe(true);
  });
});

describe('filteredOutCommitted', () => {
  it('returns committed values that are neither incoming nor visible', () => {
    expect(filteredOutCommitted(['C'], ['A', 'B'], ['C'], eq)).toEqual([
      'A',
      'B',
    ]);
    expect(filteredOutCommitted(['A'], ['A', 'B'], ['A', 'B'], eq)).toEqual([]);
  });
});
