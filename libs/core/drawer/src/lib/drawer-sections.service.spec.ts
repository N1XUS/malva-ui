import { ElementRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import type {
  MlvDrawerSectionIntersection,
  MlvDrawerSectionState,
} from './drawer-sections.service';
import { MlvDrawerSectionsService } from './drawer-sections.service';

/**
 * Pins the two computations `MlvDrawerSectionsService` used to delegate to
 * `lodash-es` (#295): the `cloneDeep` of the intersection record in the
 * observer callback, and the `sortBy(…, ['threshold']).reverse()[0]` that
 * picks `currentScrolledSection`. Both were replaced with native code so that
 * `@malva-ui/core` no longer ships `lodash-es`; these specs are what says the
 * replacement is the same function.
 *
 * Every spec is synchronous on purpose. The service's constructor registers an
 * `afterRenderEffect` that calls `initObservers()`, and `initObservers()`
 * resets `intersectedSections` to `{}` — so a render tick landing between a
 * write and a read would clobber the state under test.
 */
describe('MlvDrawerSectionsService', () => {
  /** Callback handed to the newest `IntersectionObserver` double. */
  let deliver: IntersectionObserverCallback | null = null;

  beforeAll(() => {
    // jsdom ships no `IntersectionObserver`. The double only captures the
    // callback so a spec can play the platform's part and deliver entries.
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: IntersectionObserverCallback) {
          deliver = callback;
        }
        observe(): void {
          /* no-op */
        }
        unobserve(): void {
          /* no-op */
        }
        disconnect(): void {
          /* no-op */
        }
      },
    );
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  let service: MlvDrawerSectionsService;

  beforeEach(() => {
    deliver = null;
    TestBed.configureTestingModule({ providers: [MlvDrawerSectionsService] });
    service = TestBed.inject(MlvDrawerSectionsService);
  });

  /** A registered section whose host element carries the matching DOM `id`. */
  function section(id: string): MlvDrawerSectionState {
    const element = document.createElement('section');
    element.id = id;
    const state: MlvDrawerSectionState = {
      id: signal(id),
      label: signal(`Label ${id}`),
      elementRef: new ElementRef(element),
    };
    service.register(state);
    return state;
  }

  function entry(
    id: string,
    intersectionRatio: number,
  ): IntersectionObserverEntry {
    const target = document.createElement('section');
    target.id = id;
    return {
      target,
      isIntersecting: intersectionRatio > 0,
      intersectionRatio,
    } as unknown as IntersectionObserverEntry;
  }

  /** Plays the platform: one observer delivery carrying `entries`. */
  function emit(...entries: IntersectionObserverEntry[]): void {
    if (!deliver) throw new Error('emit(): no IntersectionObserver was built.');
    deliver(entries, {} as IntersectionObserver);
  }

  function intersection(
    id: string,
    threshold: number,
  ): MlvDrawerSectionIntersection {
    return { id, threshold, intersecting: threshold > 0 };
  }

  /** The resolved section's id, or `null` when none resolves. */
  function currentId(): string | null {
    return service.currentScrolledSection()?.id() ?? null;
  }

  describe('currentScrolledSection', () => {
    it('resolves no section before anything has intersected', () => {
      section('a');

      expect(currentId()).toBeNull();
    });

    it.each([
      ['first', ['a', 'b', 'c'], [1, 0.5, 0.25]],
      ['in the middle', ['a', 'b', 'c'], [0.25, 1, 0.5]],
      ['last', ['a', 'b', 'c'], [0.25, 0.5, 1]],
    ])(
      'picks the highest intersection ratio wherever it sits (%s)',
      (_position, ids, ratios) => {
        const record: Record<string, MlvDrawerSectionIntersection> = {};
        ids.forEach((id, index) => {
          section(id);
          record[id] = intersection(id, ratios[index]);
        });
        service.intersectedSections.set(record);

        const expected = ids[ratios.indexOf(Math.max(...ratios))];
        expect(currentId()).toBe(expected);
      },
    );

    // The tie-break the `sortBy(values, ['threshold']).reverse()[0]` chain
    // produced: lodash `sortBy` is stable, so tied entries kept their
    // `Object.values` order and `reverse()` put the **last** of them first.
    it('resolves a tie at the highest ratio to the entry recorded last', () => {
      ['a', 'b', 'c'].forEach(section);

      service.intersectedSections.set({
        a: intersection('a', 1),
        b: intersection('b', 0.5),
        c: intersection('c', 1),
      });
      expect(currentId()).toBe('c');

      service.intersectedSections.set({
        a: intersection('a', 1),
        b: intersection('b', 1),
        c: intersection('c', 0.5),
      });
      expect(currentId()).toBe('b');
    });

    it('resolves a record where nothing intersects to the entry recorded last', () => {
      ['a', 'b'].forEach(section);

      service.intersectedSections.set({
        a: intersection('a', 0),
        b: intersection('b', 0),
      });

      expect(currentId()).toBe('b');
    });

    // `IntersectionObserverEntry.intersectionRatio` is never NaN, so this is
    // reachable only through a hand-written `intersectedSections.set()`. It is
    // pinned because the native pass and the former lodash chain differ on
    // thresholds that are not numbers: lodash's `compareAscending` sorted
    // `NaN` — and, outside strict TypeScript, `null`, `undefined` or a missing
    // field — after every number, so `reverse()` made it **win**. NaN is the
    // only one of these `threshold: number` admits. A ratio that is not a
    // number is not a measurement, and now never beats one.
    it('never lets a NaN ratio beat a measured one', () => {
      ['a', 'b', 'c'].forEach(section);

      service.intersectedSections.set({
        a: intersection('a', 0.25),
        b: intersection('b', Number.NaN),
        c: intersection('c', 0.5),
      });

      expect(currentId()).toBe('c');
    });

    it('resolves no section when the winning id is not registered', () => {
      section('a');

      service.intersectedSections.set({
        a: intersection('a', 0.25),
        ghost: intersection('ghost', 1),
      });

      expect(currentId()).toBeNull();
    });

    it('leaves the intersection record untouched when read', () => {
      ['a', 'b', 'c'].forEach(section);
      const record = {
        c: intersection('c', 0.5),
        a: intersection('a', 1),
        b: intersection('b', 0.25),
      };
      const before = structuredClone(record);
      service.intersectedSections.set(record);

      service.currentScrolledSection();

      expect(service.intersectedSections()).toBe(record);
      expect(Object.keys(record)).toEqual(['c', 'a', 'b']);
      expect(record).toEqual(before);
    });
  });

  describe('observer callback', () => {
    beforeEach(() => {
      ['a', 'b', 'c'].forEach(section);
      service.initObservers();
    });

    it('records each delivered entry keyed by the target id', () => {
      emit(entry('a', 1), entry('b', 0.25));

      expect(service.intersectedSections()).toEqual({
        a: { intersecting: true, threshold: 1, id: 'a' },
        b: { intersecting: true, threshold: 0.25, id: 'b' },
      });
      expect(currentId()).toBe('a');
    });

    it('merges a later delivery, keeping the entries it does not carry', () => {
      emit(entry('a', 1), entry('b', 0.25));
      emit(entry('a', 0), entry('c', 0.5));

      expect(service.intersectedSections()).toEqual({
        a: { intersecting: false, threshold: 0, id: 'a' },
        b: { intersecting: true, threshold: 0.25, id: 'b' },
        c: { intersecting: true, threshold: 0.5, id: 'c' },
      });
      expect(currentId()).toBe('c');
    });

    // What `cloneDeep` bought, and what a shallow copy still guarantees
    // because every entry is replaced wholesale, never written in place: each
    // delivery stores a **new** record (a signal compares with `Object.is`, so
    // the same reference would notify nobody) and the snapshot a reader
    // already holds keeps its keys and values.
    it('stores a new record per delivery and leaves the previous snapshot intact', () => {
      emit(entry('a', 1), entry('b', 0.25));
      const previous = service.intersectedSections();
      const previousCopy = structuredClone(previous);

      emit(entry('b', 0.75));

      expect(service.intersectedSections()).not.toBe(previous);
      expect(previous).toEqual(previousCopy);
      expect(service.intersectedSections()).toEqual({
        a: { intersecting: true, threshold: 1, id: 'a' },
        b: { intersecting: true, threshold: 0.75, id: 'b' },
      });
    });
  });
});
