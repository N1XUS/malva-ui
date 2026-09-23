import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { beforeEach, describe, expect, it } from 'vitest';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvInput } from '@malva-ui/core/input';
import { MlvDataTable } from './data-table';
import type { MlvDataRow } from './data-table-layout';
import { MlvDataTableEditCell } from '../data-table-edit-cell';
import type {
  MlvDataTableColumn,
  MlvEditEvent,
  MlvEditSaveEvent,
  MlvRowClickEvent,
  MlvSelectableMode,
  MlvSelectionChangeEvent,
} from '../types';

interface Person {
  id: number;
  name: string;
  _mlvChildren?: Person[];
}

/** A class-instance row: `fullName` exists only on the prototype. */
class Employee implements Person {
  constructor(
    public id: number,
    public name: string,
    public surname: string,
  ) {}

  get fullName(): string {
    return `${this.name} ${this.surname}`;
  }
}

/**
 * A prototype with a getter-only `name`. An instance can still carry an own
 * `name` data property (defined, not assigned), which shadows the accessor.
 */
class ReadOnlyName {
  constructor(public id: number) {}

  get name(): string {
    return 'from prototype';
  }
}

/** Every value {@link Tagged}'s prototype setter has received. */
const taggedSetterWrites: string[] = [];

/** A prototype with a `tag` accessor pair whose setter only records. */
class Tagged {
  constructor(
    public id: number,
    public name: string,
  ) {}

  get tag(): string {
    return 'from prototype';
  }

  set tag(value: string) {
    taggedSetterWrites.push(value);
  }
}

/** Gives `row` an own enumerable data property, shadowing any accessor. */
function withOwn<T extends object>(row: T, key: string, value: unknown): T {
  Object.defineProperty(row, key, {
    value,
    writable: true,
    enumerable: true,
    configurable: true,
  });
  return row;
}

/**
 * How the host writes a saved row back into its data:
 * - `none` — not at all (or not yet: an async save);
 * - `replace` — the documented pattern, the saved `row` object replaces
 *   `sourceRow` in a new array;
 * - `assign` — in place, `Object.assign(sourceRow, row)`, then a new array.
 */
type WriteBack = 'none' | 'replace' | 'assign';

const DEFAULT_COLUMNS: MlvDataTableColumn[] = [
  { key: 'id', title: 'ID', sortable: true },
  { key: 'name', title: 'Name', searchable: true },
];

/**
 * Edit state must follow the row it was started on, not the view position it
 * happened to occupy (#297). Every assertion below is on the row **object** —
 * its `id`, and `toBe` against the consumer's own reference — because the
 * defect was precisely that an index kept pointing at a position while a
 * different row moved into it.
 */
@Component({
  imports: [FormsModule, MlvDataTable, MlvDataTableEditCell, MlvInput],
  template: `
    <mlv-data-table
      [data]="data()"
      [columns]="columns()"
      [cellNavigation]="cellNavigation()"
      [selectable]="selectable()"
      [virtualScroll]="virtualScroll()"
      [rowHeight]="40"
      [(selectedRows)]="selected"
      editable
      (rowEditStart)="starts.push($event)"
      (rowEditSave)="onSave($event)"
      (rowEditCancel)="cancels.push($event)"
      (rowClick)="clicks.push($event)"
      (selectionChange)="selectionEvents.push($event)"
    >
      <mlv-input
        *mlvDataTableEditCell="'name'; let row; from: data()"
        [ngModel]="row.name"
        (ngModelChange)="row.name = $event"
        ariaLabel="Name"
      />
    </mlv-data-table>
  `,
})
class EditHostComponent {
  readonly data = signal<Person[]>([]);
  readonly columns = signal<MlvDataTableColumn[]>(DEFAULT_COLUMNS);
  readonly cellNavigation = signal(false);
  readonly selectable = signal<MlvSelectableMode>(false);
  readonly virtualScroll = signal(false);
  readonly writeBack = signal<WriteBack>('none');
  readonly selected = signal<Set<MlvDataRow>>(new Set());
  readonly starts: MlvEditEvent[] = [];
  readonly saves: MlvEditSaveEvent[] = [];
  readonly cancels: MlvEditEvent[] = [];
  readonly clicks: MlvRowClickEvent[] = [];
  readonly selectionEvents: MlvSelectionChangeEvent[] = [];

  onSave(event: MlvEditSaveEvent): void {
    this.saves.push(event);
    const source = event.sourceRow as unknown as Person;
    const saved = event.row as unknown as Person;
    switch (this.writeBack()) {
      case 'replace':
        this.data.update((rows) =>
          rows.map((row) => (row === source ? saved : row)),
        );
        break;
      case 'assign':
        Object.assign(source, saved);
        this.data.update((rows) => [...rows]);
        break;
    }
  }
}

interface MountOptions {
  cellNavigation?: boolean;
  selectable?: MlvSelectableMode;
  virtualScroll?: boolean;
  writeBack?: WriteBack;
  columns?: MlvDataTableColumn[];
}

function people(...names: string[]): Person[] {
  return names.map((name, index) => ({ id: index + 1, name }));
}

/** Keys the table used to stamp onto the rows it handed out. */
function internalKeys(row: object): string[] {
  return Object.keys(row).filter((key) => key.startsWith('_mlv'));
}

describe('MlvDataTable — row edits follow row identity (#297)', () => {
  let fixture: ComponentFixture<EditHostComponent>;
  let host: HTMLElement;

  function hostCmp(): EditHostComponent {
    return fixture.componentInstance;
  }

  function table(): MlvDataTable {
    return fixture.debugElement.query(By.directive(MlvDataTable))
      .componentInstance as MlvDataTable;
  }

  function rows(): HTMLTableRowElement[] {
    return Array.from(
      host.querySelectorAll<HTMLTableRowElement>('.mlv-data-table__row--data'),
    );
  }

  /** The `id` rendered in each data row, in view order. */
  function renderedIds(): number[] {
    return rows().map((row) =>
      Number(
        row
          .querySelector(
            '.mlv-data-table__cell--data:not(.mlv-data-table__cell--actions):not(.mlv-data-table__cell--select)',
          )
          ?.textContent?.trim(),
      ),
    );
  }

  /** The view indexes of the rows currently rendered in edit mode. */
  function editingPositions(): number[] {
    return rows()
      .map((row, index) => ({ row, index }))
      .filter(({ row }) =>
        row.classList.contains('mlv-data-table__row--editing'),
      )
      .map(({ index }) => index);
  }

  /** The `id`s of the rows currently rendered in edit mode. */
  function editingIds(): number[] {
    const ids = renderedIds();
    return editingPositions().map((index) => ids[index]);
  }

  function rowById(id: number): HTMLTableRowElement {
    const index = renderedIds().indexOf(id);
    if (index < 0) throw new Error(`row ${id} is not rendered`);
    return rows()[index];
  }

  function actionButtons(row: HTMLElement): HTMLButtonElement[] {
    return Array.from(
      row.querySelectorAll<HTMLButtonElement>(
        '.mlv-data-table__actions button',
      ),
    );
  }

  function nameInput(row: HTMLElement): HTMLInputElement | null {
    return row.querySelector<HTMLInputElement>('mlv-input input');
  }

  /**
   * One `setTimeout` in the middle because the virtual viewport recomputes its
   * rendered range one task after the rows change.
   */
  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function startEditing(id: number): Promise<void> {
    actionButtons(rowById(id))[0].click();
    await settle();
  }

  async function typeInto(row: HTMLElement, value: string): Promise<void> {
    const input = nameInput(row);
    if (!input) throw new Error('row renders no edit input');
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
  }

  async function typeName(id: number, value: string): Promise<void> {
    await typeInto(rowById(id), value);
  }

  function nameInputValue(id: number): string | null {
    return nameInput(rowById(id))?.value ?? null;
  }

  async function save(id: number): Promise<void> {
    actionButtons(rowById(id))[0].click();
    await settle();
  }

  async function cancel(id: number): Promise<void> {
    actionButtons(rowById(id))[1].click();
    await settle();
  }

  async function sortByIdDescending(): Promise<void> {
    const idColumn = table()
      .visibleColumns()
      .find((column) => column.key === 'id');
    if (!idColumn) throw new Error('no id column');
    table().onSortClick(idColumn); // asc
    table().onSortClick(idColumn); // desc
    await settle();
  }

  async function mount(
    data: Person[],
    options: MountOptions = {},
  ): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [EditHostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(EditHostComponent);
    hostCmp().data.set(data);
    hostCmp().cellNavigation.set(options.cellNavigation ?? false);
    hostCmp().selectable.set(options.selectable ?? false);
    hostCmp().virtualScroll.set(options.virtualScroll ?? false);
    hostCmp().writeBack.set(options.writeBack ?? 'none');
    if (options.columns) hostCmp().columns.set(options.columns);
    host = fixture.nativeElement as HTMLElement;
    await settle();
  }

  describe.each([
    ['row navigation', false],
    ['cell navigation', true],
  ])('after a sort (%s)', (_label, cellNavigation) => {
    beforeEach(async () => {
      await mount(people('Alice', 'Bob', 'Carol'), { cellNavigation });
    });

    it('keeps the edit on the row that started it and saves that row', async () => {
      const alice = hostCmp().data()[0];

      await startEditing(1);
      await typeName(1, 'Alice Liddell');
      await sortByIdDescending();

      expect(renderedIds()).toEqual([3, 2, 1]);
      // Carol moved into Alice's old position; she must not inherit the edit.
      expect(editingIds()).toEqual([1]);
      expect(table().isEditing(0)).toBe(false);
      expect(table().isEditing(2)).toBe(true);
      // The in-progress draft survived the re-order.
      expect(nameInputValue(1)).toBe('Alice Liddell');

      await save(1);

      expect(hostCmp().saves).toHaveLength(1);
      const event = hostCmp().saves[0];
      expect(event.row['id']).toBe(1);
      expect(event.row['name']).toBe('Alice Liddell');
      expect(event.sourceRow).toBe(alice);
      expect(event.originalRow).toEqual({ id: 1, name: 'Alice' });
      expect(event.originalRow).not.toBe(alice);
      // `index` keeps its documented meaning: the view index of the saved row.
      expect(event.index).toBe(2);
      expect(internalKeys(event.row)).toEqual([]);
      expect(internalKeys(event.originalRow)).toEqual([]);
      // The table never writes to the consumer's object; write-back is theirs.
      expect(alice.name).toBe('Alice');
      expect(editingIds()).toEqual([]);
    });
  });

  describe('after a filter', () => {
    beforeEach(async () => {
      await mount(people('Alice', 'Bob', 'Bonnie', 'Boris'));
    });

    it('keeps the edit on its row when the rows before it are filtered out', async () => {
      const bob = hostCmp().data()[1];

      await startEditing(2);
      await typeName(2, 'Robert');
      table().onSearch('bo');
      await settle();

      expect(renderedIds()).toEqual([2, 3, 4]);
      // Bonnie now sits at Bob's old index 1.
      expect(editingIds()).toEqual([2]);
      expect(table().isEditing(1)).toBe(false);
      expect(nameInputValue(2)).toBe('Robert');

      await save(2);

      const event = hostCmp().saves[0];
      expect(event.row['id']).toBe(2);
      expect(event.row['name']).toBe('Robert');
      expect(event.sourceRow).toBe(bob);
      expect(event.index).toBe(0);
    });
  });

  describe('after a page change', () => {
    beforeEach(async () => {
      await mount(
        Array.from({ length: 12 }, (_, index) => ({
          id: index + 1,
          name: `Person ${index + 1}`,
        })),
      );
    });

    it('does not carry the edit onto the row at the same index of the next page', async () => {
      const first = hostCmp().data()[0];

      await startEditing(1);
      await typeName(1, 'First edited');
      table().currentPage.set(2);
      await settle();

      expect(renderedIds()).toEqual([11, 12]);
      expect(editingIds()).toEqual([]);

      table().currentPage.set(1);
      await settle();

      expect(editingIds()).toEqual([1]);
      expect(nameInputValue(1)).toBe('First edited');

      await save(1);

      const event = hostCmp().saves[0];
      expect(event.row['id']).toBe(1);
      expect(event.row['name']).toBe('First edited');
      expect(event.sourceRow).toBe(first);
    });
  });

  describe('inside tree rows', () => {
    let childB1: Person;

    beforeEach(async () => {
      childB1 = { id: 21, name: 'Child B1' };
      await mount([
        {
          id: 1,
          name: 'Parent A',
          _mlvChildren: [
            { id: 11, name: 'Child A1' },
            { id: 12, name: 'Child A2' },
          ],
        },
        { id: 2, name: 'Parent B', _mlvChildren: [childB1] },
      ]);
    });

    async function expand(id: number): Promise<void> {
      rowById(id)
        .querySelector<HTMLButtonElement>('.mlv-data-table__expand-btn')
        ?.click();
      await settle();
    }

    it('keeps the edit on a child row when expanding a node above shifts it', async () => {
      await expand(2);
      expect(renderedIds()).toEqual([1, 2, 21]);

      await startEditing(21);
      await typeName(21, 'Kid');
      await expand(1);

      expect(renderedIds()).toEqual([1, 11, 12, 2, 21]);
      // Child A2 now sits at the child's old index 2.
      expect(editingIds()).toEqual([21]);
      expect(table().isEditing(2)).toBe(false);
      expect(nameInputValue(21)).toBe('Kid');
      // Depth still renders for the nested row.
      expect(rowById(21).getAttribute('aria-level')).toBe('2');
      expect(rowById(1).getAttribute('aria-level')).toBeNull();
      // The public by-row read agrees, for the source row and for its draft.
      expect(table().getDepth(childB1)).toBe(1);
      expect(table().getDepth(hostCmp().starts[0].row)).toBe(1);
      expect(table().getDepth(hostCmp().data()[0])).toBe(0);

      await save(21);

      const event = hostCmp().saves[0];
      expect(event.row['id']).toBe(21);
      expect(event.row['name']).toBe('Kid');
      expect(event.sourceRow).toBe(childB1);
      expect(event.index).toBe(4);
      expect(internalKeys(event.row)).toEqual([]);
      expect(childB1.name).toBe('Child B1');
    });

    it('indents a nested row on the inline-start side', async () => {
      await expand(2);

      const indent = rowById(21).querySelector<HTMLElement>(
        '.mlv-data-table__indent',
      );
      expect(indent?.style.getPropertyValue('padding-inline-start')).toBe(
        '1.25rem',
      );
      expect(indent?.style.getPropertyValue('padding-left')).toBe('');
    });
  });

  describe('row objects handed to the consumer', () => {
    beforeEach(async () => {
      await mount(people('Alice', 'Bob', 'Carol'));
    });

    it('renders the consumer rows themselves when nothing is expanded', () => {
      expect(table().flatRows()).toBe(table().displayRows());
      table()
        .flatRows()
        .forEach((row, index) => expect(row).toBe(hostCmp().data()[index]));
    });

    it('emits the consumer row itself from rowClick', async () => {
      const bob = hostCmp().data()[1];
      rowById(2).click();
      await settle();

      expect(hostCmp().clicks).toHaveLength(1);
      expect(hostCmp().clicks[0].row).toBe(bob);
      expect(internalKeys(hostCmp().clicks[0].row)).toEqual([]);
    });

    it('hands the edit template a draft and leaves the consumer row untouched on cancel', async () => {
      const alice = hostCmp().data()[0];

      await startEditing(1);
      const start = hostCmp().starts[0];
      expect(start.sourceRow).toBe(alice);
      expect(start.row).not.toBe(alice);
      expect(start.row).toEqual({ id: 1, name: 'Alice' });
      expect(table().getCellContext(alice, 0).row).toBe(start.row);

      await typeName(1, 'Mallory');
      expect(alice.name).toBe('Alice');

      await cancel(1);

      expect(hostCmp().cancels).toHaveLength(1);
      expect(hostCmp().cancels[0].sourceRow).toBe(alice);
      expect(alice.name).toBe('Alice');
      expect(editingIds()).toEqual([]);
      // The discarded draft is gone from the screen, not merely unsaved.
      expect(rowById(1).textContent).toContain('Alice');
      expect(rowById(1).textContent).not.toContain('Mallory');
      expect(table().getCellContext(alice, 0).row).toBe(alice);
    });

    it('renders the pre-edit values after a save the consumer has not written back', async () => {
      await startEditing(1);
      await typeName(1, 'Alice Liddell');
      await save(1);

      expect(hostCmp().saves[0].row['name']).toBe('Alice Liddell');
      expect(rowById(1).textContent).toContain('Alice');
      expect(rowById(1).textContent).not.toContain('Liddell');
    });
  });

  describe('a row object listed twice', () => {
    beforeEach(async () => {
      const shared: Person = { id: 1, name: 'Shared' };
      await mount([shared, { id: 2, name: 'Other' }, shared]);
    });

    it('edits both positions together, with one shared draft', async () => {
      actionButtons(rows()[0])[0].click();
      await settle();

      expect(editingPositions()).toEqual([0, 2]);
      await typeInto(rows()[0], 'Both');
      expect(nameInput(rows()[2])?.value).toBe('Both');
      expect(hostCmp().starts).toHaveLength(1);
    });
  });

  describe('in virtual-scroll mode', () => {
    beforeEach(async () => {
      await mount(people('Ann', 'Ben', 'Cid', 'Dee'), { virtualScroll: true });
    });

    it('keeps the edit on its row when a sort moves it to another index', async () => {
      const ben = hostCmp().data()[1];
      expect(renderedIds()).toEqual([1, 2, 3, 4]);

      await startEditing(2);
      await typeName(2, 'Benedict');
      await sortByIdDescending();

      expect(renderedIds()).toEqual([4, 3, 2, 1]);
      // Cid moved into Ben's old index 1.
      expect(editingIds()).toEqual([2]);
      expect(nameInputValue(2)).toBe('Benedict');

      await save(2);

      const event = hostCmp().saves[0];
      expect(event.row['name']).toBe('Benedict');
      expect(event.sourceRow).toBe(ben);
      expect(event.index).toBe(2);
    });
  });

  describe('class-instance rows', () => {
    beforeEach(async () => {
      await mount(
        [new Employee(1, 'Ada', 'Lovelace'), new Employee(2, 'Alan', 'Turing')],
        {
          columns: [
            ...DEFAULT_COLUMNS,
            { key: 'fullName', title: 'Full name' },
          ],
        },
      );
    });

    it('keeps the prototype on the draft, so getters still render while editing', async () => {
      await startEditing(1);
      expect(rowById(1).textContent).toContain('Ada Lovelace');

      await typeName(1, 'Augusta');
      expect(rowById(1).textContent).toContain('Augusta Lovelace');

      await save(1);
      const event = hostCmp().saves[0];
      expect(event.row).toBeInstanceOf(Employee);
      expect(event.originalRow).toBeInstanceOf(Employee);
      expect((event.row as unknown as Employee).fullName).toBe(
        'Augusta Lovelace',
      );
    });
  });

  describe('rows whose own property shadows a prototype accessor', () => {
    it('clones an own property that shadows a getter-only prototype accessor', async () => {
      const row = withOwn(new ReadOnlyName(1), 'name', 'Own');
      await mount([row as unknown as Person]);

      // An assigning clone threw "Cannot set property name of #<ReadOnlyName>
      // which has only a getter" here.
      expect(() =>
        table().startEdit(row as unknown as MlvDataRow, 0),
      ).not.toThrow();
      await settle();

      expect(editingIds()).toEqual([1]);
      expect(nameInputValue(1)).toBe('Own');
      await typeName(1, 'Changed');
      await save(1);

      const event = hostCmp().saves[0];
      expect(event.sourceRow).toBe(row);
      expect(event.row).toBeInstanceOf(ReadOnlyName);
      expect(event.row['name']).toBe('Changed');
      expect(event.originalRow['name']).toBe('Own');
      expect(row.name).toBe('Own');
    });

    it('defines an own property instead of handing it to a prototype setter', async () => {
      taggedSetterWrites.length = 0;
      const row = withOwn(new Tagged(1, 'Ada'), 'tag', 'own');
      await mount([row as unknown as Person], {
        columns: [...DEFAULT_COLUMNS, { key: 'tag', title: 'Tag' }],
      });

      await startEditing(1);

      const draft = hostCmp().starts[0].row;
      expect(Object.getOwnPropertyDescriptor(draft, 'tag')?.value).toBe('own');
      expect(draft['tag']).toBe('own');
      expect(rowById(1).textContent).toContain('own');
      expect(rowById(1).textContent).not.toContain('from prototype');

      await save(1);
      expect(hostCmp().saves[0].originalRow['tag']).toBe('own');
      // Neither the draft nor the snapshot went through the setter.
      expect(taggedSetterWrites).toEqual([]);
    });

    it('clones a frozen row as a spread reads it: writable, symbol keys kept, hidden keys skipped, getters read', async () => {
      const tag = Symbol('tag');
      const row: Person = { id: 1, name: 'Ada' };
      Object.defineProperty(row, tag, { value: 'tagged', enumerable: true });
      Object.defineProperty(row, 'hidden', {
        value: 'secret',
        enumerable: false,
      });
      Object.defineProperty(row, 'label', {
        get(this: Person) {
          return `#${this.id}`;
        },
        enumerable: true,
      });
      Object.freeze(row);
      await mount([row]);

      await startEditing(1);

      const draft = hostCmp().starts[0].row;
      // Writable although the source is frozen: descriptors were not copied.
      expect(Object.isFrozen(draft)).toBe(false);
      expect(Object.getOwnPropertyDescriptor(draft, 'name')?.writable).toBe(
        true,
      );
      // An own enumerable symbol key is copied, as a spread copies it.
      expect(Object.getOwnPropertyDescriptor(draft, tag)?.value).toBe('tagged');
      // A non-enumerable own key is not, as a spread skips it.
      expect(Object.getOwnPropertyNames(draft)).not.toContain('hidden');
      // An own getter is read once into a plain data value, not copied live.
      const label = Object.getOwnPropertyDescriptor(draft, 'label');
      expect(label?.value).toBe('#1');
      expect(label?.get).toBeUndefined();

      await typeName(1, 'Augusta');
      await save(1);
      expect(hostCmp().saves[0].row['name']).toBe('Augusta');
      expect(row.name).toBe('Ada');
    });
  });

  describe('selection and expansion across the documented write-back', () => {
    it('keeps a saved row selected when its saved object replaces it', async () => {
      await mount(people('Alice', 'Bob'), {
        selectable: 'multi',
        writeBack: 'replace',
      });
      const alice = hostCmp().data()[0];
      table().toggleRowSelection(alice);
      await settle();

      await startEditing(1);
      await typeName(1, 'Alice Liddell');
      await save(1);

      const saved = hostCmp().saves[0].row;
      expect(hostCmp().data()[0]).toBe(saved);
      expect(rowById(1).textContent).toContain('Alice Liddell');
      expect(rowById(1).classList).toContain('mlv-data-table__row--selected');
      expect(table().isRowSelected(table().flatRows()[0])).toBe(true);
      // The selection now holds the object in the data, not the stale one.
      expect([...hostCmp().selected()][0]).toBe(saved);
      expect(hostCmp().selected().size).toBe(1);
      expect(hostCmp().selected().has(alice)).toBe(false);
      const last = hostCmp().selectionEvents.at(-1);
      expect(last?.selectedRows.has(saved)).toBe(true);
    });

    it('keeps a saved tree parent expanded when its saved object replaces it', async () => {
      await mount(
        [
          {
            id: 1,
            name: 'Parent',
            _mlvChildren: [
              { id: 11, name: 'Child 1' },
              { id: 12, name: 'Child 2' },
            ],
          },
        ],
        { writeBack: 'replace' },
      );
      rowById(1)
        .querySelector<HTMLButtonElement>('.mlv-data-table__expand-btn')
        ?.click();
      await settle();
      expect(renderedIds()).toEqual([1, 11, 12]);

      await startEditing(1);
      await typeName(1, 'Parent renamed');
      await save(1);

      const saved = hostCmp().saves[0].row;
      expect(hostCmp().data()[0]).toBe(saved);
      expect(renderedIds()).toEqual([1, 11, 12]);
      expect(table().isRowExpanded(saved)).toBe(true);
    });

    it('keeps a saved tree child selected when its saved object replaces it inside its parent', async () => {
      const child: Person = { id: 11, name: 'Child 1' };
      const parent: Person = {
        id: 1,
        name: 'Parent',
        _mlvChildren: [child, { id: 12, name: 'Child 2' }],
      };
      await mount([parent], { selectable: 'multi' });
      rowById(1)
        .querySelector<HTMLButtonElement>('.mlv-data-table__expand-btn')
        ?.click();
      await settle();
      table().toggleRowSelection(child);
      await settle();

      await startEditing(11);
      await typeName(11, 'Kid');
      await save(11);

      // The child is written back inside the same parent object, so only the
      // child is a new object: the carry-over has to find it below the roots.
      const saved = hostCmp().saves[0].row as unknown as Person;
      parent._mlvChildren = (parent._mlvChildren ?? []).map((row) =>
        row === child ? saved : row,
      );
      hostCmp().data.update((rows) => [...rows]);
      await settle();

      expect(renderedIds()).toEqual([1, 11, 12]);
      expect(rowById(11).textContent).toContain('Kid');
      expect(rowById(11).classList).toContain('mlv-data-table__row--selected');
      expect([...hostCmp().selected()][0]).toBe(saved);
      expect(hostCmp().selected().size).toBe(1);
    });

    it('keeps the selection of a row written back in place', async () => {
      await mount(people('Alice', 'Bob'), {
        selectable: 'multi',
        writeBack: 'assign',
      });
      const alice = hostCmp().data()[0];
      table().toggleRowSelection(alice);
      await settle();

      await startEditing(1);
      await typeName(1, 'Alice Liddell');
      await save(1);

      expect(hostCmp().data()[0]).toBe(alice);
      expect(alice.name).toBe('Alice Liddell');
      expect(rowById(1).classList).toContain('mlv-data-table__row--selected');
      expect([...hostCmp().selected()][0]).toBe(alice);
      expect(hostCmp().selected().size).toBe(1);
    });

    it('carries the selection to a write-back that arrives later, as the next emission', async () => {
      await mount(people('Alice', 'Bob'), { selectable: 'multi' });
      const alice = hostCmp().data()[0];
      table().toggleRowSelection(alice);
      await settle();

      await startEditing(1);
      await typeName(1, 'Alice Liddell');
      await save(1);
      // An async save: nothing written back yet, the row is still Alice.
      expect(rowById(1).classList).toContain('mlv-data-table__row--selected');
      expect(hostCmp().selected().has(alice)).toBe(true);

      const saved = hostCmp().saves[0].row as unknown as Person;
      hostCmp().data.update((rows) =>
        rows.map((row) => (row === alice ? saved : row)),
      );
      await settle();

      expect(rowById(1).classList).toContain('mlv-data-table__row--selected');
      expect([...hostCmp().selected()][0]).toBe(saved);
      expect(hostCmp().selected().size).toBe(1);
    });

    it('drops a pending carry-over at the first emission that does not hold the saved row', async () => {
      await mount(people('Alice', 'Bob'), { selectable: 'multi' });
      const alice = hostCmp().data()[0];
      table().toggleRowSelection(alice);
      await settle();

      await startEditing(1);
      await typeName(1, 'Alice Liddell');
      await save(1);

      // An unrelated emission first (the same rows, a new array)…
      hostCmp().data.update((rows) => [...rows]);
      await settle();
      // …so the late write-back is a plain replacement: a new, unselected row.
      const saved = hostCmp().saves[0].row as unknown as Person;
      hostCmp().data.update((rows) =>
        rows.map((row) => (row === alice ? saved : row)),
      );
      await settle();

      expect(rowById(1).classList).not.toContain(
        'mlv-data-table__row--selected',
      );
      expect(hostCmp().selected().has(saved)).toBe(false);
    });
  });
});
