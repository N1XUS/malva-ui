import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { MlvTaskboard } from './taskboard';
import { MlvTaskboardEmptyStateDef } from '../taskboard-defs';
import { provideTaskboardTesting } from '../testing/taskboard-test-context';

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

describe('MlvTaskboard empty cell', () => {
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
