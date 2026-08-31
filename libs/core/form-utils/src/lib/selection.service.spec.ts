import { MlvSelectionService } from './selection.service';

interface Item {
  id: number;
  name: string;
}

describe('MlvSelectionService', () => {
  it('uses reference equality for membership by default', () => {
    const service = new MlvSelectionService<Item>();
    const a = { id: 1, name: 'A' };
    service.setValues([a]);
    expect(service.isSelected(a)).toBe(true);
    // A structurally-equal but distinct object does not match by default.
    expect(service.isSelected({ id: 1, name: 'A' })).toBe(false);
  });

  describe('with a custom compareWith', () => {
    let service: MlvSelectionService<Item>;
    const a: Item = { id: 1, name: 'A' };
    const b: Item = { id: 2, name: 'B' };

    beforeEach(() => {
      service = new MlvSelectionService<Item>();
      service.compareWith.set((x, y) => x.id === y.id);
      service.setValues([a, b]);
    });

    it('isSelected matches by the comparator, not reference', () => {
      expect(service.isSelected({ id: 1, name: 'renamed' })).toBe(true);
      expect(service.isSelected({ id: 3, name: 'C' })).toBe(false);
    });

    it('deselect removes the comparator-matched value', () => {
      service.deselect({ id: 1, name: 'anything' });
      expect(service.selectedValues()).toEqual([b]);
    });

    it('toggle de-dups via the comparator in multi-select mode', () => {
      service.multiple.set(true);
      // Already present by id -> toggling removes it.
      service.toggle({ id: 1, name: 'anything' });
      expect(service.selectedValues()).toEqual([b]);
      // Not present -> toggling adds it.
      service.toggle({ id: 9, name: 'Z' });
      expect(service.selectedValues().map((v) => v.id)).toEqual([2, 9]);
    });
  });
});
