import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type * as Sass from 'sass';
import { afterEach, describe, expect, it } from 'vitest';
import { MlvTaskboard } from './taskboard';
import { MlvTaskboardEmptyStateDef } from '../taskboard-defs';
import { provideTaskboardTesting } from '../testing/taskboard-test-context';

// `sass` is a Node-only dependency; loading it through `createRequire` keeps it
// out of the browser-ish module graph vitest builds for this project. The
// compiled sheet is what the two drop-indicator tests read computed styles
// through — `setup-strip-css-layers` flattens `@layer` on the way into the
// `<style>` element, so jsdom parses it.
const nodeRequire = createRequire(import.meta.url);
const sass = nodeRequire('sass') as typeof Sass;
const TASKBOARD_CSS = sass.compile(
  resolve(dirname(fileURLToPath(import.meta.url)), './taskboard.scss'),
).css;

interface Ticket {
  readonly id: string;
  readonly status: string;
}

const ITEMS: readonly Ticket[] = [{ id: 'a', status: 'todo' }];

const COLUMNS = [
  { id: 'todo', label: 'Todo' },
  { id: 'done', label: 'Done' },
];

@Component({
  imports: [MlvTaskboard],
  template: `<mlv-taskboard
    [(items)]="items"
    [columns]="columns"
    dataKey="id"
    columnField="status"
  />`,
})
class EmptyHost {
  readonly items = signal<readonly Ticket[]>(ITEMS);
  readonly columns = COLUMNS;
}

@Component({
  imports: [MlvTaskboard],
  template: `<mlv-taskboard
    [(items)]="items"
    [columns]="columns"
    [virtualItemSize]="60"
    dataKey="id"
    columnField="status"
  />`,
})
class VirtualEmptyHost {
  readonly items = signal<readonly Ticket[]>(ITEMS);
  readonly columns = COLUMNS;
}

@Component({
  imports: [MlvTaskboard, MlvTaskboardEmptyStateDef],
  template: `<mlv-taskboard
    [(items)]="items"
    [columns]="columns"
    dataKey="id"
    columnField="status"
  >
    <ng-template mlvTaskboardEmptyStateDef let-column>
      <p class="custom-empty">Nothing in {{ column.label }}</p>
    </ng-template>
  </mlv-taskboard>`,
})
class ProjectedEmptyHost {
  readonly items = signal<readonly Ticket[]>(ITEMS);
  readonly columns = COLUMNS;
}

async function mount<T>(component: new (...args: never[]) => T) {
  await TestBed.configureTestingModule({
    imports: [component],
    providers: [provideTaskboardTesting()],
  }).compileComponents();
  const fixture = TestBed.createComponent(component);
  fixture.detectChanges();
  await fixture.whenStable();
  return { fixture, host: fixture.nativeElement as HTMLElement };
}

/** The `done` cell of the default lane — the one with no cards. */
function emptyCell(host: HTMLElement): HTMLElement {
  return host.querySelector<HTMLElement>(
    '.mlv-taskboard__cell[data-mlv-taskboard-column-id="string:done"]',
  ) as HTMLElement;
}

/** Renders the tail drop indicator the board draws while a drag hovers a cell. */
function appendDropIndicator(cards: HTMLElement): HTMLElement {
  // The board renders this element from `dropIndicatorTemplate` as the last
  // child of the cards container once `_isDropTail()` is true. Appending it is
  // the same DOM without driving a whole SortableJS gesture; what is under test
  // is which rule of the shipped sheet then wins on it.
  const indicator = document.createElement('div');
  indicator.className = 'mlv-taskboard__drop-indicator';
  indicator.setAttribute('aria-hidden', 'true');
  cards.append(indicator);
  return indicator;
}

describe('MlvTaskboard empty cell', () => {
  let stylesheet: HTMLStyleElement | null = null;

  /** Puts the component's own compiled CSS in the document for one test. */
  function useTaskboardStylesheet(): void {
    stylesheet = document.createElement('style');
    stylesheet.textContent = TASKBOARD_CSS;
    document.head.append(stylesheet);
  }

  afterEach(() => {
    stylesheet?.remove();
    stylesheet = null;
  });

  it('opens an empty cell with a drop-zone box inside its cards area', async () => {
    const { host } = await mount(EmptyHost);
    const cell = emptyCell(host);

    const cards = cell.querySelector<HTMLElement>(
      '.mlv-taskboard__cards',
    ) as HTMLElement;
    const box = cell.querySelector<HTMLElement>('.mlv-taskboard__empty');
    expect(box).not.toBeNull();
    // The box is the drop slot the pointer has to reach, so it lives inside
    // the sortable container rather than beside it.
    expect(cards.contains(box)).toBe(true);
    // Presentational: the listbox stays empty of options rather than gaining
    // one that names nothing.
    expect(box?.getAttribute('aria-hidden')).toBe('true');
    expect(cards.querySelectorAll('[role="option"]').length).toBe(0);
    // The cell is marked empty so the cards area stops stretching.
    expect(cards.classList.contains('mlv-taskboard__cards--empty')).toBe(true);
  });

  it('puts the add control directly after the box in DOM order', async () => {
    const { host } = await mount(EmptyHost);
    const cell = emptyCell(host);

    const box = cell.querySelector<HTMLElement>(
      '.mlv-taskboard__empty',
    ) as HTMLElement;
    const add = cell.querySelector<HTMLElement>(
      '.mlv-taskboard__add',
    ) as HTMLElement;
    expect(box).not.toBeNull();
    expect(add).not.toBeNull();
    expect(
      box.compareDocumentPosition(add) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("stops the empty cell's scroll box stretching, so the add control sits under the box", async () => {
    const { host } = await mount(EmptyHost);
    const emptyScroller = emptyCell(host).querySelector<HTMLElement>(
      '.mlv-taskboard__cell-scroller',
    ) as HTMLElement;
    const filledScroller = host
      .querySelectorAll<HTMLElement>('.mlv-taskboard__cell')[0]
      ?.querySelector<HTMLElement>(
        '.mlv-taskboard__cell-scroller',
      ) as HTMLElement;

    // Without this the wrapper still grows to the row's height and the add
    // control lands at the bottom of the panel instead of under the box.
    expect(
      emptyScroller.classList.contains('mlv-taskboard__cell-scroller--empty'),
    ).toBe(true);
    expect(
      filledScroller.classList.contains('mlv-taskboard__cell-scroller--empty'),
    ).toBe(false);
  });

  it("marks a virtualized empty cell's scroll box so it stops stretching too", async () => {
    // A virtual cell has nothing to virtualize when it holds no cards, so it
    // collapses to the drop-zone box exactly like a plain one; without the
    // modifier the viewport keeps its 20rem `block-size` and `+ Add card`
    // lands 20rem under the box (the defect R47 was written against).
    const { host } = await mount(VirtualEmptyHost);
    const cell = emptyCell(host);

    const scroller = cell.querySelector<HTMLElement>(
      '.mlv-taskboard__cell-scroller--virtual',
    ) as HTMLElement;
    expect(scroller).not.toBeNull();
    expect(
      scroller.classList.contains('mlv-taskboard__cell-scroller--empty'),
    ).toBe(true);

    const filled = host.querySelector<HTMLElement>(
      '.mlv-taskboard__cell[data-mlv-taskboard-column-id="string:todo"] .mlv-taskboard__cell-scroller--virtual',
    ) as HTMLElement;
    expect(
      filled.classList.contains('mlv-taskboard__cell-scroller--empty'),
    ).toBe(false);
  });

  it('draws no box in a cell that has cards', async () => {
    const { host } = await mount(EmptyHost);
    const filled = host.querySelector<HTMLElement>(
      '.mlv-taskboard__cell[data-mlv-taskboard-column-id="string:todo"]',
    ) as HTMLElement;

    expect(filled.querySelector('.mlv-taskboard__empty')).toBeNull();
    expect(
      filled
        .querySelector('.mlv-taskboard__cards')
        ?.classList.contains('mlv-taskboard__cards--empty'),
    ).toBe(false);
  });

  it('stands the built-in drop indicator down behind the box that replaces it', async () => {
    useTaskboardStylesheet();
    const { host } = await mount(EmptyHost);
    const cards = emptyCell(host).querySelector<HTMLElement>(
      '.mlv-taskboard__cards',
    ) as HTMLElement;
    expect(cards.querySelector('.mlv-taskboard__empty')).not.toBeNull();

    const indicator = appendDropIndicator(cards);
    // The box already paints the accept affordance, so a bar under it would be
    // a second indicator for the same slot.
    expect(getComputedStyle(indicator).display).toBe('none');
  });

  it('keeps the built-in drop indicator in a cell whose box a consumer replaced', async () => {
    useTaskboardStylesheet();
    const { host } = await mount(ProjectedEmptyHost);
    const cards = emptyCell(host).querySelector<HTMLElement>(
      '.mlv-taskboard__cards',
    ) as HTMLElement;
    // No built-in box here — the projected empty state took its place — so
    // nothing else draws the slot and the indicator has to.
    expect(cards.querySelector('.mlv-taskboard__empty')).toBeNull();
    expect(cards.classList.contains('mlv-taskboard__cards--empty')).toBe(true);

    const indicator = appendDropIndicator(cards);
    expect(getComputedStyle(indicator).display).not.toBe('none');
  });

  it('lets a projected empty state replace the default box wholesale', async () => {
    const { host } = await mount(ProjectedEmptyHost);
    const cell = emptyCell(host);

    expect(cell.querySelector('.mlv-taskboard__empty')).toBeNull();
    const projected = cell.querySelector<HTMLElement>('.custom-empty');
    expect(projected?.textContent?.trim()).toBe('Nothing in Done');
    // A consumer slot keeps its own semantics: it stays a sibling of the
    // listbox, so interactive content inside it is still exposed.
    expect(
      cell.querySelector('.mlv-taskboard__cards')?.contains(projected),
    ).toBe(false);
  });
});
