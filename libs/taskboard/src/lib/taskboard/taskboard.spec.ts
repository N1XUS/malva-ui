import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
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
        .querySelector('[data-mlv-taskboard-column-id="done"]')
        ?.getAttribute('data-collapsed'),
    ).toBe('true');
    expect(
      host
        .querySelector('[data-mlv-taskboard-group-id="work"]')
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
    }).compileComponents();
    const fixture = TestBed.createComponent(TaskboardHost);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('.mlv-taskboard__card')?.tagName).toBe('DIV');
    expect(
      host.querySelector('mlv-taskboard')?.getAttribute('aria-label'),
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

  it('maps grouped headers and lanes to deterministic board columns', async () => {
    await TestBed.configureTestingModule({
      imports: [TaskboardHost],
    }).compileComponents();
    const fixture = TestBed.createComponent(TaskboardHost);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(
      host
        .querySelector('[data-mlv-taskboard-group-id="work"]')
        ?.getAttribute('aria-colspan'),
    ).toBe('2');
    expect(
      host.querySelectorAll(
        '.mlv-taskboard__column-row > [role="columnheader"]',
      ),
    ).toHaveLength(2);
    expect(
      host.querySelectorAll(
        '[data-mlv-taskboard-swimlane-id="engineering"] > [role="gridcell"]',
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
      '[data-mlv-taskboard-card-id="one"]',
    ) as HTMLElement;
    card.click();
    card.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));

    expect(activated).toEqual(['one']);
    expect(contextual).toEqual(['one']);
    expect(card.getAttribute('role')).toBeNull();
    expect(card.getAttribute('tabindex')).toBeNull();
  });

  it('keeps the default card surface keyboard-operable', async () => {
    await TestBed.configureTestingModule({
      imports: [DefaultCardHost],
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
