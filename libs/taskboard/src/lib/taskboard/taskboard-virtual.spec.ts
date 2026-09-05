import { CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import Sortable from 'sortablejs';
import { describe, expect, it, vi } from 'vitest';
import type { MlvTaskboardKey } from '../taskboard.types';
import { provideTaskboardTesting } from '../testing/taskboard-test-context';
import { MlvTaskboard } from './taskboard';
import {
  mlvTaskboardBucketIndex,
  mlvTaskboardRenderedIndex,
  type MlvTaskboardVirtualWindow,
} from './taskboard-virtual';

const window: MlvTaskboardVirtualWindow = { start: 5, rendered: 5, total: 40 };

describe('taskboard virtual window', () => {
  it('translates a rendered DOM index to the full bucket index', () => {
    expect(mlvTaskboardBucketIndex(0, window)).toBe(5);
    expect(mlvTaskboardBucketIndex(3, window)).toBe(8);
  });

  it('never reports a slot past the end of the bucket', () => {
    expect(mlvTaskboardBucketIndex(99, window)).toBe(40);
    expect(mlvTaskboardBucketIndex(-9, window)).toBe(0);
  });

  it('leaves a plain, unvirtualized cell index untouched', () => {
    expect(mlvTaskboardBucketIndex(3, null)).toBe(3);
    expect(mlvTaskboardRenderedIndex(3, null)).toBe(3);
  });

  it('translates a bucket index back into the rendered window', () => {
    expect(mlvTaskboardRenderedIndex(5, window)).toBe(0);
    expect(mlvTaskboardRenderedIndex(9, window)).toBe(4);
  });

  it('reports a card outside the rendered window as unrendered', () => {
    expect(mlvTaskboardRenderedIndex(4, window)).toBeNull();
    expect(mlvTaskboardRenderedIndex(10, window)).toBeNull();
  });
});

interface Ticket {
  readonly id: string;
  readonly status: string;
}

const MANY_CARDS: readonly Ticket[] = [
  ...Array.from({ length: 40 }, (_unused, index) => ({
    id: `c${index}`,
    status: 'todo',
  })),
  { id: 'x', status: 'done' },
];

@Component({
  imports: [MlvTaskboard],
  template: `<mlv-taskboard
    [(items)]="items"
    [columns]="columns"
    [virtualItemSize]="40"
    dataKey="id"
    columnField="status"
  />`,
})
class VirtualHost {
  readonly items = signal<readonly Ticket[]>(MANY_CARDS);
  readonly columns = [
    { id: 'todo', label: 'Todo' },
    { id: 'done', label: 'Done' },
  ];
}

/** The board's live drop preview, which is protected on the component. */
function previewIndexOf(board: MlvTaskboard<Ticket>): number | undefined {
  return (
    board as unknown as {
      _dropPreview: () => { readonly index: number } | null;
    }
  )._dropPreview()?.index;
}

describe('MlvTaskboard virtual cells', () => {
  async function mountVirtual() {
    await TestBed.configureTestingModule({
      imports: [VirtualHost],
      providers: [provideTaskboardTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(VirtualHost);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const viewports = fixture.debugElement
      .queryAll(By.directive(CdkVirtualScrollViewport))
      .map((debugElement) =>
        debugElement.injector.get(CdkVirtualScrollViewport),
      );
    // jsdom lays nothing out, so a viewport measures zero and renders no card
    // at all. Give each one a real block size and re-measure.
    for (const viewport of viewports) {
      viewport.elementRef.nativeElement.getBoundingClientRect = () =>
        ({
          top: 0,
          left: 0,
          right: 300,
          bottom: 200,
          width: 300,
          height: 200,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        }) as DOMRect;
      viewport.checkViewportSize();
    }
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const viewportFor = (columnId: MlvTaskboardKey) => {
      const viewport = viewports.find(
        (candidate) =>
          candidate.elementRef.nativeElement.getAttribute(
            'data-mlv-taskboard-column-id',
          ) === `string:${String(columnId)}`,
      );
      if (!viewport) throw new Error(`Expected a viewport for ${columnId}`);
      return viewport;
    };
    const wrapperFor = (columnId: MlvTaskboardKey) => {
      const wrapper = viewportFor(
        columnId,
      ).elementRef.nativeElement.querySelector(
        '.cdk-virtual-scroll-content-wrapper',
      );
      if (!wrapper) throw new Error('Expected a rendered content wrapper');
      return wrapper as HTMLElement;
    };
    const card = (id: string) =>
      host.querySelector(
        `[data-mlv-taskboard-card-id="string:${id}"]`,
      ) as HTMLElement;
    return { fixture, host, viewportFor, wrapperFor, card };
  }

  it('registers the viewport content wrapper as the sortable container', async () => {
    const { host, wrapperFor } = await mountVirtual();

    expect(host.querySelectorAll('cdk-virtual-scroll-viewport')).toHaveLength(
      2,
    );
    expect(
      host.querySelector('mlv-taskboard')?.getAttribute('style'),
    ).toContain('--mlv-taskboard-virtual-item-size: 40px');
    expect(Sortable.get(wrapperFor('todo'))).toBeTruthy();
  });

  it('offsets a hovered slot by the cell rendered start', async () => {
    const { fixture, viewportFor, wrapperFor, card } = await mountVirtual();
    const target = viewportFor('todo');
    vi.spyOn(target, 'getRenderedRange').mockReturnValue({ start: 5, end: 10 });
    vi.spyOn(target, 'getDataLength').mockReturnValue(40);

    const source = wrapperFor('done');
    const destination = wrapperFor('todo');
    const dragged = card('x');
    const sortable = Sortable.get(source);
    sortable?.options.onStart?.({
      item: dragged,
      from: source,
      to: source,
    } as unknown as Sortable.SortableEvent);
    sortable?.options.onMove?.(
      {
        dragged,
        draggedRect: dragged.getBoundingClientRect(),
        from: source,
        related: card('c0'),
        relatedRect: card('c0').getBoundingClientRect(),
        to: destination,
        willInsertAfter: false,
      } as unknown as Sortable.MoveEvent,
      new Event('pointermove'),
    );
    fixture.detectChanges();

    const board = fixture.debugElement
      .query(By.directive(MlvTaskboard))
      .injector.get<MlvTaskboard<Ticket>>(MlvTaskboard);
    expect(previewIndexOf(board)).toBe(5);
  });

  it('scrolls a card outside the rendered window back in before focusing it', async () => {
    const { fixture, viewportFor, card } = await mountVirtual();
    const target = viewportFor('todo');
    vi.spyOn(target, 'getRenderedRange').mockReturnValue({ start: 0, end: 2 });
    vi.spyOn(target, 'getDataLength').mockReturnValue(40);
    // jsdom has no scroller, so the real CDK call is replaced: the board's
    // contract is that it asks the viewport for that index before focusing.
    const scrollToIndex = vi
      .spyOn(target, 'scrollToIndex')
      .mockImplementation(() => undefined);

    card('c0').dispatchEvent(new FocusEvent('focus'));
    card('c0').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
    );
    fixture.detectChanges();
    expect(scrollToIndex).not.toHaveBeenCalled();

    card('c1').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
    );
    fixture.detectChanges();
    expect(scrollToIndex).toHaveBeenCalledWith(2);
  });
});
