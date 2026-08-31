import { Component, signal, viewChild } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { OverlayContainer } from '@angular/cdk/overlay';
import type { Extensions } from '@tiptap/core';
import { MLV_EDITOR_I18N } from '@malva-ui/i18n';
import {
  i18nTestProvider,
  provideMlvI18nTesting,
} from '@malva-ui/i18n/testing';
import { MlvEditor, mlvEditorDefaultExtensions } from '../..';

@Component({
  imports: [MlvEditor],
  template: `
    <mlv-editor [extensions]="extensions()" [readonly]="readonly()" />
    <mlv-editor [extensions]="secondExtensions()" />
  `,
})
class ControlsHost {
  readonly secondExtensions = signal<Extensions | undefined>(undefined);
  readonly extensions = signal<Extensions | undefined>(undefined);
  readonly readonly = signal(false);
  readonly editor = viewChild.required(MlvEditor);
}

describe('MlvEditorTableControls', () => {
  let fixture: ComponentFixture<ControlsHost>;
  let overlayContainer: OverlayContainer;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ControlsHost],
      providers: [provideMlvI18nTesting(), i18nTestProvider(MLV_EDITOR_I18N)],
    }).compileComponents();
    fixture = TestBed.createComponent(ControlsHost);
    fixture.componentInstance.extensions.set(mlvEditorDefaultExtensions());
    // A second editor on the page. Extension instances are per-editor, so it
    // gets its own set rather than sharing the first editor's.
    fixture.componentInstance.secondExtensions.set(mlvEditorDefaultExtensions());
    overlayContainer = TestBed.inject(OverlayContainer);
    document.body.appendChild(fixture.nativeElement);
    await settle();
  });

  afterEach(() => {
    fixture.destroy();
    (fixture.nativeElement as HTMLElement).remove();
    overlayContainer.ngOnDestroy();
  });

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function editor() {
    const instance = fixture.componentInstance.editor().editor();
    if (!instance) throw new Error('Expected a browser editor.');
    return instance;
  }

  async function insertTable(): Promise<void> {
    editor().chain().focus().insertTable({ rows: 3, cols: 3 }).run();
    await settle();
  }

  /** The `td` at the given zero-based body row and column. */
  function cell(row: number, column: number): HTMLTableCellElement {
    const table = (fixture.nativeElement as HTMLElement).querySelector('table');
    const target = table?.rows[row]?.cells[column];
    if (!(target instanceof HTMLTableCellElement)) {
      throw new Error(`Expected a cell at ${row},${column}.`);
    }
    return target;
  }

  async function hover(target: Element): Promise<void> {
    target.dispatchEvent(new MouseEvent('pointermove', { bubbles: true }));
    await settle();
  }

  function grips(): HTMLButtonElement[] {
    return [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(
        '.mlv-editor-table-controls__grip',
      ),
    ];
  }

  function grip(kind: 'row' | 'column' | 'corner'): HTMLButtonElement {
    const found = grips().find((candidate) =>
      candidate.classList.contains(`mlv-editor-table-controls__grip--${kind}`),
    );
    if (!found) throw new Error(`Expected the ${kind} grip.`);
    return found;
  }

  function menuItem(text: string): HTMLElement {
    const item = [
      ...overlayContainer
        .getContainerElement()
        .querySelectorAll<HTMLElement>('[role="menuitem"]'),
    ].find((candidate) => candidate.textContent?.trim() === text);
    if (!item) throw new Error(`Expected menu item "${text}".`);
    return item;
  }

  function rowCount(): number {
    return (
      (fixture.nativeElement as HTMLElement).querySelectorAll('table tr')
        .length ?? 0
    );
  }

  it('shows no grips until the pointer is inside a table', async () => {
    expect(grips()).toHaveLength(0);

    await insertTable();
    expect(grips()).toHaveLength(0);

    await hover(cell(1, 1));
    expect(grips()).toHaveLength(3);
  });

  it('keeps the grips out of the tab order and out of the accessibility tree', async () => {
    await insertTable();
    await hover(cell(1, 1));

    // The content region stays the single `role="textbox"` tab stop; the
    // toolbar control is the keyboard route to the same commands.
    const host = (fixture.nativeElement as HTMLElement).querySelector(
      'mlv-editor-table-controls',
    );
    expect(host?.getAttribute('aria-hidden')).toBe('true');
    expect(grips().every((candidate) => candidate.tabIndex === -1)).toBe(true);
  });

  it('drops the grips when the pointer leaves the table', async () => {
    await insertTable();
    await hover(cell(1, 1));
    expect(grips()).toHaveLength(3);

    const paragraph = (fixture.nativeElement as HTMLElement).querySelector(
      '.ProseMirror > p',
    );
    if (!paragraph) throw new Error('Expected a paragraph outside the table.');
    await hover(paragraph);

    expect(grips()).toHaveLength(0);
  });

  it('runs the row grip command against the row the grip points at', async () => {
    await insertTable();
    // Caret is left in the first body row; the grip points at the last one.
    await hover(cell(2, 0));
    const before = rowCount();
    grip('row').click();
    await settle();
    menuItem('Add row after').click();
    await settle();

    expect(rowCount()).toBe(before + 1);
    // The new row is below the row the grip addressed, not below the caret.
    const table = (fixture.nativeElement as HTMLElement).querySelector('table');
    expect(table?.rows).toHaveLength(before + 1);
  });

  it('offers the whole-table commands from the corner grip', async () => {
    await insertTable();
    await hover(cell(1, 1));

    grip('corner').click();
    await settle();

    expect(menuItem('Delete table')).toBeTruthy();
    menuItem('Delete table').click();
    await settle();

    expect(
      (fixture.nativeElement as HTMLElement).querySelector('table'),
    ).toBeNull();
    // The table is gone, so the grips must not survive it.
    expect(grips()).toHaveLength(0);
  });

  it('ignores a table belonging to another editor on the page', async () => {
    await insertTable();
    await hover(cell(1, 1));

    // One editor is hovered, so exactly one set of three grips may exist. The
    // pointer listener is on the document — every other editor's controls sees
    // the same event and must reject a cell outside its own layer, or a page of
    // editors stacks a full set of grips per instance at identical coordinates.
    expect(grips()).toHaveLength(3);
  });

  it('shows no grips in a readonly editor', async () => {
    await insertTable();
    fixture.componentInstance.readonly.set(true);
    await settle();

    await hover(cell(1, 1));
    expect(grips()).toHaveLength(0);
  });
});
