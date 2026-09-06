import { CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MlvScrollbar } from '@malva-ui/core/scrollbar';
import { describe, expect, it } from 'vitest';
import { MlvTaskboard } from './taskboard';
import { provideTaskboardTesting } from '../testing/taskboard-test-context';

interface Ticket {
  readonly id: string;
  readonly status: string;
}

const ITEMS: readonly Ticket[] = [
  { id: 'a', status: 'todo' },
  { id: 'b', status: 'todo' },
  { id: 'x', status: 'done' },
];

const COLUMNS = [
  { id: 'todo', label: 'Todo' },
  { id: 'done', label: 'Done' },
];

@Component({
  imports: [MlvTaskboard],
  template: `<mlv-taskboard
    [(items)]="items"
    [columns]="columns"
    [virtualItemSize]="virtualItemSize()"
    dataKey="id"
    columnField="status"
  />`,
})
class ScrollbarHost {
  readonly items = signal<readonly Ticket[]>(ITEMS);
  readonly columns = COLUMNS;
  readonly virtualItemSize = signal<number | undefined>(undefined);
}

async function mount(virtualItemSize?: number) {
  await TestBed.configureTestingModule({
    imports: [ScrollbarHost],
    providers: [provideTaskboardTesting()],
  }).compileComponents();
  const fixture = TestBed.createComponent(ScrollbarHost);
  if (virtualItemSize !== undefined) {
    fixture.componentInstance.virtualItemSize.set(virtualItemSize);
  }
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  const scrollbars = fixture.debugElement
    .queryAll(By.directive(MlvScrollbar))
    .map((debugElement) => debugElement.injector.get(MlvScrollbar));
  return {
    fixture,
    host: fixture.nativeElement as HTMLElement,
    scrollbars,
  };
}

describe('MlvTaskboard scrollbars', () => {
  it('scrolls the column strip through a horizontal mlv-scrollbar', async () => {
    const { host, scrollbars } = await mount();

    const strip = host.querySelector<HTMLElement>('.mlv-taskboard__strip');
    expect(strip?.tagName.toLowerCase()).toBe('mlv-scrollbar');
    const stripScrollbar = scrollbars.find(
      (scrollbar) => scrollbar.viewportElement.parentElement === strip,
    );
    expect(stripScrollbar?.orientation()).toBe('horizontal');
    // The surface keeps the row group role and stops owning the overflow.
    expect(
      strip?.querySelector('.mlv-taskboard__surface')?.getAttribute('role'),
    ).toBe('rowgroup');
  });

  it('wraps every plain cell in an mlv-scrollbar whose viewport is the scroller', async () => {
    const { host, scrollbars } = await mount();

    const cells = Array.from(
      host.querySelectorAll<HTMLElement>('.mlv-taskboard__cards'),
    );
    expect(cells.length).toBe(2);
    for (const cards of cells) {
      const scroller = cards.closest<HTMLElement>('.mlv-scrollbar__viewport');
      expect(scroller).not.toBeNull();
      const owner = scrollbars.find(
        (scrollbar) => scrollbar.viewportElement === scroller,
      );
      // The scroller the board writes offsets to is the one `mlv-scrollbar`
      // reports, not the cards list it wraps.
      expect(owner?.viewportElement).toBe(scroller);
    }
  });

  it('points a virtualized cell scrollbar at the CDK viewport itself', async () => {
    const { fixture, host, scrollbars } = await mount(40);

    const viewports = fixture.debugElement
      .queryAll(By.directive(CdkVirtualScrollViewport))
      .map((debugElement) =>
        debugElement.injector.get(CdkVirtualScrollViewport),
      );
    expect(viewports.length).toBe(2);
    for (const viewport of viewports) {
      const element = viewport.elementRef.nativeElement;
      const owner = scrollbars.find(
        (scrollbar) => scrollbar.viewportElement === element,
      );
      expect(owner).toBeDefined();
      expect(owner?.scroller()).not.toBeNull();
    }
    // External mode never wraps the CDK viewport in a second scroll box.
    expect(
      host.querySelectorAll('.mlv-scrollbar--external').length,
    ).toBeGreaterThanOrEqual(2);
  });

  it('adds no tab stop, role or name on any board scrollbar viewport', async () => {
    const { host } = await mount();

    for (const viewport of host.querySelectorAll('.mlv-scrollbar__viewport')) {
      expect(viewport.hasAttribute('tabindex')).toBe(false);
      expect(viewport.hasAttribute('role')).toBe(false);
      expect(viewport.hasAttribute('aria-label')).toBe(false);
    }
  });
});
