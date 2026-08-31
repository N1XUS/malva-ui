import { DocsTocService } from './toc.service';
import type { TocEntry } from './toc.types';

const A: TocEntry[] = [{ level: 2, text: 'Alpha', slug: 'alpha' }];
const B: TocEntry[] = [{ level: 2, text: 'Beta', slug: 'beta' }];

describe('DocsTocService', () => {
  it('publishes (replaces) the active panel entries', () => {
    const service = new DocsTocService();

    service.publish({}, A);
    expect(service.entries()).toEqual(A);

    service.publish({}, B);
    expect(service.entries()).toEqual(B);
  });

  it('republishes on tab switch: a new owner replaces, and the old owner cannot clear', () => {
    const service = new DocsTocService();
    const examplesPanel = Symbol('examples');
    const apiPanel = Symbol('api');

    // Examples panel publishes, then the API panel takes over (tab switch).
    service.publish(examplesPanel, A);
    service.publish(apiPanel, B);
    expect(service.entries()).toEqual(B);

    // The outgoing examples panel tears down late — its owner-scoped clear is a
    // no-op because the API panel is now the owner.
    service.clear(examplesPanel);
    expect(service.entries()).toEqual(B);

    // The current owner may clear.
    service.clear(apiPanel);
    expect(service.entries()).toEqual([]);
  });

  it('force-clears regardless of owner when called with no argument', () => {
    const service = new DocsTocService();
    service.publish(Symbol('owner'), A);

    service.clear();
    expect(service.entries()).toEqual([]);
  });
});
