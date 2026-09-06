import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MLV_TASKBOARD_I18N } from '@malva-ui/i18n';
import { i18nTestProvider } from '@malva-ui/i18n/testing';
import { describe, expect, it } from 'vitest';
import {
  MlvTaskboardColumnHeaderDef,
  MlvTaskboardEmptyStateDef,
  MlvTaskboardItemDef,
} from '../taskboard-defs';
import { MlvTaskboard } from './taskboard';
import {
  TASKBOARD_TEST_COLUMNS,
  TASKBOARD_TEST_GROUPS,
  TASKBOARD_TEST_ITEMS,
  TASKBOARD_TEST_LANES,
  provideTaskboardTesting,
  type TaskboardTestTicket,
} from '../testing/taskboard-test-context';

@Component({
  imports: [
    MlvTaskboard,
    MlvTaskboardColumnHeaderDef,
    MlvTaskboardEmptyStateDef,
    MlvTaskboardItemDef,
  ],
  template: `
    <mlv-taskboard
      [items]="items()"
      [columns]="columns"
      [columnGroups]="groups"
      [swimlanes]="lanes"
      [collapsedColumnIds]="collapsedColumnIds()"
      dataKey="id"
      columnField="status"
      swimlaneField="lane"
      mlvDensity="compact"
      dir="rtl"
    >
      <ng-template mlvTaskboardColumnHeaderDef let-column let-wip="wip">
        {{ column.label }} ({{ wip.count }})
      </ng-template>
      <ng-template
        mlvTaskboardItemDef
        [mlvTaskboardItemDefFrom]="itemType"
        let-card
        let-column="column"
      >
        <span class="custom-card">{{ card.title }} / {{ column.label }}</span>
      </ng-template>
      <ng-template mlvTaskboardEmptyStateDef let-column let-lane="swimlane">
        Empty {{ column.label }} {{ lane?.label }}
      </ng-template>
    </mlv-taskboard>
  `,
})
class TaskboardHost {
  readonly columns = TASKBOARD_TEST_COLUMNS;
  readonly groups = TASKBOARD_TEST_GROUPS;
  readonly lanes = TASKBOARD_TEST_LANES;
  readonly items = signal(TASKBOARD_TEST_ITEMS);
  readonly collapsedColumnIds = signal<ReadonlySet<string>>(new Set(['done']));
  readonly itemType: TaskboardTestTicket = TASKBOARD_TEST_ITEMS[0];
  readonly board = viewChild.required(MlvTaskboard<TaskboardTestTicket>);
}

describe('MlvTaskboard', () => {
  it('renders grouped lanes with projected cards, header state, and empty slots', async () => {
    await TestBed.configureTestingModule({
      imports: [TaskboardHost],
      providers: [provideTaskboardTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(TaskboardHost);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('Todo (2)');
    expect(host.querySelectorAll('[data-mlv-taskboard-card-id]')).toHaveLength(
      3,
    );
    expect(host.querySelector('.custom-card')?.textContent).toContain(
      'First card / Todo',
    );
    expect(host.textContent).toContain('Empty Done Design');
    expect(
      host
        .querySelector('[data-mlv-taskboard-column-id="string:done"]')
        ?.getAttribute('data-collapsed'),
    ).toBe('true');
    expect(
      host
        .querySelector('[data-mlv-taskboard-group-id="string:work"]')
        ?.getAttribute('role'),
    ).toBe('columnheader');
    expect(host.querySelector('mlv-taskboard')?.classList).toContain(
      'mlv-taskboard--compact',
    );
    expect(host.querySelector('mlv-taskboard')?.getAttribute('dir')).toBe(
      'rtl',
    );
  });

  it('exposes keyboard-operable cards and a polite live region', async () => {
    await TestBed.configureTestingModule({
      imports: [TaskboardHost],
      providers: [provideTaskboardTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(TaskboardHost);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('.mlv-taskboard__card')?.tagName).toBe('DIV');
    expect(
      host.querySelector('.mlv-taskboard__grid')?.getAttribute('aria-label'),
    ).toBe('Taskboard');
    expect(
      host.querySelector(
        '.mlv-taskboard__surface > [role="row"] > [role="gridcell"]',
      ),
    ).toBeTruthy();
    expect(
      host
        .querySelector('.mlv-taskboard__live-region')
        ?.getAttribute('aria-live'),
    ).toBe('polite');
  });

  it('keeps the grid rows away from the hidden instruction and live nodes', async () => {
    await TestBed.configureTestingModule({
      imports: [TaskboardHost],
      providers: [provideTaskboardTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(TaskboardHost);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const grid = host.querySelector('.mlv-taskboard__grid') as HTMLElement;
    expect(grid.getAttribute('role')).toBe('grid');
    expect(grid.getAttribute('aria-label')).toBe('Taskboard');
    expect(
      host.querySelector('mlv-taskboard')?.getAttribute('role'),
    ).toBeNull();
    expect(
      [...grid.children].map((child) => child.getAttribute('role')),
    ).toEqual(['rowgroup']);
    expect(
      grid.contains(host.querySelector('.mlv-taskboard__instructions')),
    ).toBe(false);
    expect(
      grid.contains(host.querySelector('.mlv-taskboard__live-region')),
    ).toBe(false);
  });

  it('owns the cards of one cell through a labelled multiselect listbox', async () => {
    await TestBed.configureTestingModule({
      imports: [TaskboardHost],
      providers: [provideTaskboardTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(TaskboardHost);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const cards = host.querySelector('.mlv-taskboard__cards') as HTMLElement;
    expect(cards.getAttribute('role')).toBe('listbox');
    expect(cards.getAttribute('aria-multiselectable')).toBe('true');
    expect(
      (cards.getAttribute('aria-labelledby') ?? '')
        .split(' ')
        .map((id) => host.querySelector(`#${id}`)?.textContent?.trim()),
      // This host projects a column header, so that half is its own markup;
      // the lane header is the built-in one — a title span plus a count pill,
      // which stays in the accessible name so the cell announces its load.
    ).toEqual(['Todo (2)', 'Engineering 2']);
    expect(
      host.querySelector('.mlv-taskboard__card')?.getAttribute('role'),
    ).toBe('option');
    // The listbox owns options only: the empty state and the add affordance
    // render as siblings of the cards host inside the same gridcell.
    expect(cards.querySelector('.mlv-taskboard__add')).toBeNull();
    expect(cards.querySelector('.mlv-taskboard__empty')).toBeNull();
  });

  it('maps grouped headers and lanes to deterministic board columns', async () => {
    await TestBed.configureTestingModule({
      imports: [TaskboardHost],
      providers: [provideTaskboardTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(TaskboardHost);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(
      host
        .querySelector('[data-mlv-taskboard-group-id="string:work"]')
        ?.getAttribute('aria-colspan'),
    ).toBe('2');
    expect(
      host.querySelectorAll(
        '.mlv-taskboard__column-row > [role="columnheader"]',
      ),
    ).toHaveLength(2);
    expect(
      host.querySelectorAll(
        '[data-mlv-taskboard-swimlane-id="string:engineering"] > [role="gridcell"]',
      ),
    ).toHaveLength(2);
    expect(
      host.querySelector(
        '.mlv-taskboard__group-row > .mlv-taskboard__lane-spacer',
      ),
    ).toBeTruthy();
    expect(
      host.querySelector(
        '.mlv-taskboard__column-row > .mlv-taskboard__lane-spacer',
      ),
    ).toBeTruthy();
  });

  it('does not nest projected interactive card content in a board button', async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectedInteractiveHost],
      providers: [provideTaskboardTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(ProjectedInteractiveHost);
    fixture.detectChanges();

    const projectedButton = fixture.nativeElement.querySelector(
      '.projected-card-button',
    ) as HTMLButtonElement;
    expect(projectedButton.closest('button')?.classList).not.toContain(
      'mlv-taskboard__card',
    );
  });

  it('emits projected card pointer actions without changing projected control semantics', async () => {
    await TestBed.configureTestingModule({
      imports: [TaskboardHost],
      providers: [provideTaskboardTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(TaskboardHost);
    fixture.detectChanges();
    const activated: string[] = [];
    const contextual: string[] = [];
    fixture.componentInstance
      .board()
      .cardActivated.subscribe((event) => activated.push(event.item.id));
    fixture.componentInstance
      .board()
      .contextMenu.subscribe((event) => contextual.push(event.item.id));

    const card = fixture.nativeElement.querySelector(
      '[data-mlv-taskboard-card-id="string:one"]',
    ) as HTMLElement;
    card.click();
    card.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));

    expect(activated).toEqual(['one']);
    expect(contextual).toEqual(['one']);
    // The card is the option of its cell's listbox and owns the board's roving
    // tab stop; the projected control keeps its own native semantics inside it.
    expect(card.getAttribute('role')).toBe('option');
    expect(card.getAttribute('tabindex')).toBe('0');
  });

  it('keeps the default card surface keyboard-operable', async () => {
    await TestBed.configureTestingModule({
      imports: [DefaultCardHost],
      providers: [provideTaskboardTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(DefaultCardHost);
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('.mlv-taskboard__card')?.tagName,
    ).toBe('BUTTON');
  });

  it('keeps a density-aware logical grid inside a scoped RTL direction', async () => {
    await TestBed.configureTestingModule({
      imports: [TaskboardHost],
      providers: [provideTaskboardTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(TaskboardHost);
    fixture.detectChanges();

    const board = fixture.nativeElement.querySelector(
      'mlv-taskboard',
    ) as HTMLElement;
    expect(board.classList).toContain('mlv-taskboard--compact');
    expect(board.getAttribute('dir')).toBe('rtl');
    expect(board.querySelector('[role="gridcell"]')).toBeTruthy();
  });
  describe('selection', () => {
    async function mountSelection() {
      await TestBed.configureTestingModule({
        imports: [SelectionHost],
        providers: [provideTaskboardTesting()],
      }).compileComponents();
      const fixture = TestBed.createComponent(SelectionHost);
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;
      const click = (id: string, modifiers: MouseEventInit = {}) => {
        const card = host.querySelector(
          `[data-mlv-taskboard-card-id="string:${id}"]`,
        ) as HTMLElement;
        card.dispatchEvent(
          new MouseEvent('click', { bubbles: true, ...modifiers }),
        );
        fixture.detectChanges();
      };
      const selected = () => [...fixture.componentInstance.board().selection()];
      return { fixture, host, click, selected };
    }

    it('replaces the selection on a plain click', async () => {
      const { click, selected } = await mountSelection();

      click('b');
      expect(selected()).toEqual(['b']);

      click('d');
      expect(selected()).toEqual(['d']);
    });

    it('toggles one card on a modifier click', async () => {
      const { click, selected } = await mountSelection();

      click('b');
      click('d', { ctrlKey: true });
      expect(selected()).toEqual(['b', 'd']);

      click('d', { metaKey: true });
      expect(selected()).toEqual(['b']);
    });

    it('selects an inclusive range in rendered board order on a shift click', async () => {
      const { click, selected } = await mountSelection();

      click('b');
      click('d', { shiftKey: true });

      // Rendered order is lane row-major, then column order, then card index:
      // eng/todo a, eng/doing b, eng/done c, design/todo d, design/doing e.
      expect(selected()).toEqual(['b', 'c', 'd']);
    });

    it('keeps a selected key the visible-item filter hides', async () => {
      const { fixture, click, selected } = await mountSelection();

      click('c');
      fixture.componentInstance.visibleItems.set(
        fixture.componentInstance.items.filter((item) => item.id !== 'c'),
      );
      fixture.detectChanges();
      await fixture.whenStable();

      expect(selected()).toEqual(['c']);
      expect(
        fixture.nativeElement.querySelector(
          '[data-mlv-taskboard-card-id="string:c"]',
        ),
      ).toBeNull();
    });

    it('emits selectionChange only when the selected set really changes', async () => {
      const { fixture, click } = await mountSelection();

      click('b');
      click('b');
      click('b', { ctrlKey: true });

      expect(fixture.componentInstance.emissions).toEqual([['b'], []]);
    });

    it('marks the selected card in the DOM and announces the selection size', async () => {
      const { host, click } = await mountSelection();

      click('b');
      const card = host.querySelector(
        '[data-mlv-taskboard-card-id="string:b"]',
      ) as HTMLElement;
      expect(card.getAttribute('data-mlv-taskboard-selected')).toBe('true');
      expect(card.getAttribute('aria-selected')).toBe('true');
      expect(
        host.querySelector('.mlv-taskboard__live-region')?.textContent?.trim(),
      ).toBe('1 card selected');

      click('d', { shiftKey: true });
      expect(
        host.querySelector('.mlv-taskboard__live-region')?.textContent?.trim(),
      ).toBe('3 cards selected');
    });
  });

  it('renders every built-in board string through the taskboard i18n token', async () => {
    await TestBed.configureTestingModule({
      imports: [LocalizedHost],
      providers: [
        provideTaskboardTesting(),
        i18nTestProvider(MLV_TASKBOARD_I18N, {
          boardLabel: 'Board',
          addCard: 'New card',
          emptyCell: 'Nothing here',
          cardLabel: 'Ticket {label}',
          wipState: '{count}/{limit}',
        }),
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(LocalizedHost);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const headers = host.querySelectorAll('.mlv-taskboard__column-header');
    expect(
      host.querySelector('.mlv-taskboard__grid')?.getAttribute('aria-label'),
    ).toBe('Board');
    expect(host.querySelector('.mlv-taskboard__add')?.textContent?.trim()).toBe(
      'New card',
    );
    expect(
      host.querySelector('.mlv-taskboard__empty')?.textContent?.trim(),
    ).toBe('Nothing here');
    expect(
      host.querySelector('.mlv-taskboard__card')?.textContent?.trim(),
    ).toBe('Ticket one');
    // The built-in header renders the label and the count as two elements —
    // a title span and a pill — so the concatenated text carries no bracket,
    // but it does carry the interpolated space the markup emits between them,
    // which is what keeps the accessible name from reading "Todo1/2".
    // A column with a limit still states the translated `wipState` ratio.
    expect(headers[0]?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Todo 1/2',
    );
    expect(headers[1]?.textContent?.replace(/\s+/g, ' ').trim()).toBe('Done 0');
  });
});

@Component({
  imports: [MlvTaskboard, MlvTaskboardItemDef],
  template: `
    <mlv-taskboard
      [items]="items"
      [columns]="columns"
      [columnGroups]="groups"
      dataKey="id"
      columnField="status"
    >
      <ng-template
        mlvTaskboardItemDef
        [mlvTaskboardItemDefFrom]="itemType"
        let-card
      >
        <button type="button" class="projected-card-button">
          {{ card.title }}
        </button>
      </ng-template>
    </mlv-taskboard>
  `,
})
class ProjectedInteractiveHost {
  readonly items = TASKBOARD_TEST_ITEMS;
  readonly columns = TASKBOARD_TEST_COLUMNS;
  readonly groups = TASKBOARD_TEST_GROUPS;
  readonly itemType: TaskboardTestTicket = TASKBOARD_TEST_ITEMS[0];
}

@Component({
  imports: [MlvTaskboard],
  template: `<mlv-taskboard
    [items]="items"
    [columns]="columns"
    dataKey="id"
    columnField="status"
  />`,
})
class DefaultCardHost {
  readonly items = [{ id: 'one', status: 'todo' }];
  readonly columns = [{ id: 'todo', label: 'Todo' }];
}

@Component({
  imports: [MlvTaskboard],
  template: `<mlv-taskboard
    [items]="items"
    [columns]="columns"
    dataKey="id"
    columnField="status"
  />`,
})
class LocalizedHost {
  readonly items = [{ id: 'one', status: 'todo' }];
  readonly columns = [
    { id: 'todo', label: 'Todo', wipLimit: 2 },
    { id: 'done', label: 'Done' },
  ];
}

@Component({
  imports: [MlvTaskboard],
  template: `<mlv-taskboard
    [items]="items"
    [columns]="columns"
    [swimlanes]="lanes"
    [visibleItems]="visibleItems()"
    dataKey="id"
    columnField="status"
    swimlaneField="lane"
    (selectionChange)="record($event)"
  />`,
})
class SelectionHost {
  readonly columns = [
    { id: 'todo', label: 'Todo' },
    { id: 'doing', label: 'Doing' },
    { id: 'done', label: 'Done' },
  ];
  readonly lanes = [
    { id: 'eng', label: 'Engineering' },
    { id: 'design', label: 'Design' },
  ];
  readonly items = [
    { id: 'a', status: 'todo', lane: 'eng' },
    { id: 'b', status: 'doing', lane: 'eng' },
    { id: 'c', status: 'done', lane: 'eng' },
    { id: 'd', status: 'todo', lane: 'design' },
    { id: 'e', status: 'doing', lane: 'design' },
  ];
  readonly visibleItems = signal<
    readonly { id: string; status: string; lane: string }[] | undefined
  >(undefined);
  readonly emissions: string[][] = [];
  readonly board = viewChild.required(
    MlvTaskboard<{ id: string; status: string; lane: string }>,
  );

  record(next: ReadonlySet<string>): void {
    this.emissions.push([...next]);
  }
}
