import { Injector, runInInjectionContext, signal } from '@angular/core';
import type { Signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MlvDataSource } from '@malva-ui/cdk/data-source';
import { Observable, Subject } from 'rxjs';
import {
  MlvMenuChildrenDataSource,
  MlvMenuDataSourceAdapter,
} from './menu-data-source';
import type { MlvMenuItemData } from './menu-data.types';

class StubMenuDataSource extends MlvDataSource<MlvMenuItemData<string>> {
  connectCount = 0;
  readonly totalItems = signal(0);
  private readonly _items = signal<MlvMenuItemData<string>[]>([]);

  connect(): Signal<MlvMenuItemData<string>[]> {
    this.connectCount += 1;
    return this._items.asReadonly();
  }

  setItems(items: MlvMenuItemData<string>[]): void {
    this.totalItems.set(items.length);
    this._items.set(items);
  }

  setLoading(value: boolean): void {
    this._loading.set(value);
  }
}

function item(
  id: string,
  children?: Observable<MlvMenuItemData<string>[]>,
): MlvMenuItemData<string> {
  return {
    id,
    label: id,
    data: id,
    children,
  };
}

describe('MlvMenuDataSourceAdapter', () => {
  it('renders array sources as-is', () => {
    const adapter = new MlvMenuDataSourceAdapter<MlvMenuItemData<string>>();
    const items = [item('File'), item('Edit')];

    adapter.setSource(items);

    expect(adapter.items()).toEqual(items);
    expect(adapter.loading()).toBe(false);
  });

  it('connects a data source only once per source identity', () => {
    const adapter = new MlvMenuDataSourceAdapter<MlvMenuItemData<string>>();
    const source = new StubMenuDataSource();
    source.setItems([item('View')]);

    adapter.setSource(source);
    adapter.setSource(source);

    expect(source.connectCount).toBe(1);
    expect(adapter.items()).toEqual([item('View')]);
  });

  it('mirrors the connected data source items and loading state', () => {
    const adapter = new MlvMenuDataSourceAdapter<MlvMenuItemData<string>>();
    const source = new StubMenuDataSource();
    source.setItems([item('Help')]);
    source.setLoading(true);

    adapter.setSource(source);
    expect(adapter.items()).toEqual([item('Help')]);
    expect(adapter.loading()).toBe(true);

    source.setItems([item('Window')]);
    source.setLoading(false);
    expect(adapter.items()).toEqual([item('Window')]);
    expect(adapter.loading()).toBe(false);
  });
});

describe('MlvMenuChildrenDataSource', () => {
  function create(children?: Observable<MlvMenuItemData<string>[]>) {
    const injector = TestBed.inject(Injector);
    return runInInjectionContext(
      injector,
      () => new MlvMenuChildrenDataSource(children),
    );
  }

  it('does not subscribe before ensureLoaded()', () => {
    let subscriptionCount = 0;
    const subject = new Subject<MlvMenuItemData<string>[]>();
    const children = new Observable<MlvMenuItemData<string>[]>((subscriber) => {
      subscriptionCount += 1;
      const sub = subject.subscribe(subscriber);
      return () => sub.unsubscribe();
    });
    const source = create(children);

    expect(subscriptionCount).toBe(0);
    expect(source.items()).toEqual([]);
    expect(source.loading()).toBe(false);

    source.ensureLoaded();

    expect(subscriptionCount).toBe(1);
    expect(source.loading()).toBe(true);
  });

  it('ends loading on the first emission and replaces items on later emissions', () => {
    const subject = new Subject<MlvMenuItemData<string>[]>();
    const source = create(subject.asObservable());

    source.ensureLoaded();
    expect(source.loading()).toBe(true);

    subject.next([item('Open')]);
    expect(source.items()).toEqual([item('Open')]);
    expect(source.loading()).toBe(false);

    subject.next([item('Save'), item('Save As')]);
    expect(source.items()).toEqual([item('Save'), item('Save As')]);
    expect(source.loading()).toBe(false);
  });

  it('turns errors into an empty list and clears loading', () => {
    const subject = new Subject<MlvMenuItemData<string>[]>();
    const source = create(subject.asObservable());

    source.ensureLoaded();
    subject.error(new Error('boom'));

    expect(source.items()).toEqual([]);
    expect(source.loading()).toBe(false);
  });
});
