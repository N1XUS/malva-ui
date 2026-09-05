import { Component, signal } from '@angular/core';
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
    expect(host.querySelector('.mlv-taskboard__card')?.tagName).toBe('BUTTON');
    expect(
      host
        .querySelector('.mlv-taskboard__live-region')
        ?.getAttribute('aria-live'),
    ).toBe('polite');
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
