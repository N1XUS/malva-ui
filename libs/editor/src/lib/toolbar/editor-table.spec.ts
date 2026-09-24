import { Component, signal, viewChild } from '@angular/core';
import type { WritableSignal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { OverlayContainer } from '@angular/cdk/overlay';
import { Editor, type Extensions } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { fileURLToPath } from 'node:url';
import { compile } from 'sass';
import { MlvRtlService } from '@malva-ui/cdk/utils';
import { MLV_EDITOR_I18N, type MlvEditorI18n } from '@malva-ui/i18n';
import {
  i18nTestProvider,
  provideMlvI18nTesting,
} from '@malva-ui/i18n/testing';
import {
  MlvEditor,
  MlvEditorTable,
  MlvEditorToolbar,
  mlvEditorDefaultExtensions,
  mlvEditorTableExtensions,
  type MlvEditorToolbarContext,
} from '../..';

@Component({
  imports: [MlvEditor],
  template: `
    <mlv-editor
      [extensions]="extensions()"
      [readonly]="readonly()"
      [disabled]="disabled()"
      (blur)="blurs.update((count) => count + 1)"
    />
  `,
})
class TableHost {
  readonly extensions = signal<Extensions | undefined>(undefined);
  readonly readonly = signal(false);
  readonly disabled = signal(false);
  readonly blurs = signal(0);
  readonly editor = viewChild.required(MlvEditor);
}

@Component({
  imports: [MlvEditorToolbar],
  template: '<mlv-editor-toolbar [context]="context" />',
})
class StandaloneTableToolbarHost {
  readonly editor = signal<Editor | null>(null);
  readonly disabled = signal(false);
  readonly readonly = signal(false);
  readonly format = signal<'html'>('html');
  readonly zoom = signal(100);
  readonly focused = signal(false);
  readonly editable = signal(true);
  readonly context: MlvEditorToolbarContext = {
    editor: this.editor.asReadonly(),
    disabled: this.disabled.asReadonly(),
    readonly: this.readonly.asReadonly(),
    focused: this.focused.asReadonly(),
    editable: this.editable.asReadonly(),
    format: this.format.asReadonly(),
    zoom: this.zoom,
    run: (command) => {
      const editor = this.editor();
      return editor && !this.disabled() && !this.readonly()
        ? command(editor)
        : false;
    },
    can: (command) => {
      const editor = this.editor();
      return editor && !this.disabled() && !this.readonly()
        ? command(editor)
        : false;
    },
    isActive: (name, attributes) =>
      this.editor()?.isActive(name, attributes) ?? false,
    reportError: () => undefined,
  };
}

describe('MlvEditorTable', () => {
  let fixture: ComponentFixture<TableHost>;
  let overlayContainer: OverlayContainer;
  let editorCopy: WritableSignal<MlvEditorI18n>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TableHost, StandaloneTableToolbarHost],
      providers: [provideMlvI18nTesting(), i18nTestProvider(MLV_EDITOR_I18N)],
    }).compileComponents();
    fixture = TestBed.createComponent(TableHost);
    overlayContainer = TestBed.inject(OverlayContainer);
    editorCopy = TestBed.inject(
      MLV_EDITOR_I18N,
    ) as WritableSignal<MlvEditorI18n>;
    document.body.appendChild(fixture.nativeElement);
    await settle();
  });

  afterEach(() => {
    fixture.destroy();
    (fixture.nativeElement as HTMLElement).remove();
    overlayContainer.ngOnDestroy();
    // Direction is global state: `MlvRtlService` writes it onto <html>, which
    // outlives the TestBed injector.
    TestBed.inject(MlvRtlService).setDirection('ltr');
    document.documentElement.removeAttribute('dir');
  });

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function recreateWithExtensions(extensions: Extensions): Promise<void> {
    fixture.destroy();
    (fixture.nativeElement as HTMLElement).remove();
    fixture = TestBed.createComponent(TableHost);
    fixture.componentInstance.extensions.set(extensions);
    document.body.appendChild(fixture.nativeElement);
    await settle();
  }

  async function completeClose(): Promise<void> {
    overlayContainer
      .getContainerElement()
      .querySelector('.mlv-popup--leave')
      ?.dispatchEvent(new Event('animationend', { bubbles: true }));
    await settle();
  }

  function editor() {
    const instance = fixture.componentInstance.editor().editor();
    if (!instance) throw new Error('Expected a browser editor.');
    return instance;
  }

  function tableTrigger(label = 'Table'): HTMLButtonElement {
    const trigger = (fixture.nativeElement as HTMLElement).querySelector(
      `mlv-editor-table button[aria-label="${label}"]`,
    );
    if (!(trigger instanceof HTMLButtonElement)) {
      throw new Error('Expected the table toolbar trigger.');
    }
    return trigger;
  }

  function tablePanel(): HTMLElement {
    const panel = overlayContainer
      .getContainerElement()
      .querySelector('.mlv-editor-table__panel');
    if (!(panel instanceof HTMLElement)) {
      throw new Error('Expected the table popup panel.');
    }
    return panel;
  }

  /**
   * The in-table command menu. Inside a table the trigger opens an `mlv-menu`
   * rather than the insertion popup, so its rows are portalled menu items.
   */
  function tableMenu(): HTMLElement {
    const panel = overlayContainer
      .getContainerElement()
      .querySelector('.mlv-menu__panel');
    if (!(panel instanceof HTMLElement)) {
      throw new Error('Expected the table command menu.');
    }
    return panel;
  }

  /** One row of the in-table command menu, addressed by its visible text. */
  function menuItem(text: string): HTMLElement {
    const item = [
      ...tableMenu().querySelectorAll<HTMLElement>('[role="menuitem"]'),
    ].find((candidate) => candidate.textContent?.trim() === text);
    if (!item) throw new Error(`Expected menu item "${text}".`);
    return item;
  }

  function key(target: Element, value: string): void {
    target.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: value,
        bubbles: true,
        cancelable: true,
      }),
    );
  }

  function tableRows() {
    return editor()
      .getJSON()
      .content?.find((node) => node.type === 'table')?.content;
  }

  function cellPositions(): number[] {
    const positions: number[] = [];
    editor().state.doc.descendants((node, position) => {
      if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
        positions.push(position);
      }
    });
    return positions;
  }

  it('is exported as the public standalone table toolbar control', () => {
    expect(MlvEditorTable).toBeDefined();
  });

  it('hugs the grid with plain swatches and captions the hovered size', async () => {
    tableTrigger().click();
    await settle();
    const panel = tablePanel();
    const cells = [
      ...panel.querySelectorAll<HTMLButtonElement>(
        '.mlv-editor-table__grid-cell',
      ),
    ];

    // The picker is a grid of 1.25rem swatches. `mlvButton` chrome — the height
    // ramp, the button radius, the neutral hover fill — fights a square that
    // small, so the cells are plain buttons styled by the block itself.
    expect(cells[0].classList.contains('mlv-button')).toBe(false);

    const caption = () =>
      panel.querySelector('.mlv-editor-table__size')?.textContent?.trim();
    expect(caption()).toBe('3 × 3');

    // Row 2, column 5 in row-major order.
    cells[14].dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    await settle();
    expect(caption()).toBe('2 × 5');
  });

  it('inserts the keyboard-selected 4 by 2 body-only table with one roving grid stop', async () => {
    tableTrigger().click();
    await settle();
    const panel = tablePanel();
    const grid = panel.querySelector('[role="grid"]');
    const cells = [
      ...panel.querySelectorAll<HTMLButtonElement>(
        '.mlv-editor-table__grid-cell',
      ),
    ];
    const headerToggle = panel.querySelector(
      'mlv-button-toggle button',
    ) as HTMLButtonElement | null;

    expect(grid?.getAttribute('aria-label')).toBe('Insert table');
    const gridRows = [
      ...(grid?.querySelectorAll(':scope > [role="row"]') ?? []),
    ];
    expect(gridRows).toHaveLength(10);
    expect(
      gridRows.map((row) => row.querySelectorAll('[role="gridcell"]').length),
    ).toEqual([10, 10, 10, 10, 10, 10, 10, 10, 10, 10]);
    expect(cells).toHaveLength(100);
    expect(cells.filter((cell) => cell.tabIndex === 0)).toHaveLength(1);
    expect(document.activeElement?.getAttribute('aria-label')).toBe(
      'Insert table: 3 × 3',
    );
    expect(headerToggle?.getAttribute('aria-pressed')).toBe('true');

    headerToggle?.click();
    key(document.activeElement as Element, 'ArrowLeft');
    key(document.activeElement as Element, 'ArrowDown');
    await settle();
    expect(document.activeElement?.getAttribute('aria-label')).toBe(
      'Insert table: 4 × 2',
    );
    expect(cells.filter((cell) => cell.tabIndex === 0)).toHaveLength(1);
    key(document.activeElement as Element, 'Enter');
    await settle();

    const insertedTable = editor().getJSON().content?.[0];
    expect(insertedTable?.type).toBe('table');
    expect(
      insertedTable?.content?.map((row) => ({
        type: row.type,
        cells: row.content?.map((cell) => cell.type),
      })),
    ).toEqual([
      { type: 'tableRow', cells: ['tableCell', 'tableCell'] },
      { type: 'tableRow', cells: ['tableCell', 'tableCell'] },
      { type: 'tableRow', cells: ['tableCell', 'tableCell'] },
      { type: 'tableRow', cells: ['tableCell', 'tableCell'] },
    ]);
  });

  it('mirrors grid column stepping inside a scoped [dir="rtl"] subtree while the document stays LTR', async () => {
    (fixture.nativeElement as HTMLElement).setAttribute('dir', 'rtl');
    await settle();
    tableTrigger().click();
    await settle();

    // The document is untouched — only the editor's subtree is flipped, which
    // is also the shape a CDK overlay pane takes (CDK stamps `dir` on it).
    expect(TestBed.inject(MlvRtlService).direction()).toBe('ltr');
    expect(document.activeElement?.getAttribute('aria-label')).toBe(
      'Insert table: 3 × 3',
    );

    // Columns run along the mirrored inline axis: ArrowLeft adds one.
    key(document.activeElement as Element, 'ArrowLeft');
    await settle();
    expect(document.activeElement?.getAttribute('aria-label')).toBe(
      'Insert table: 3 × 4',
    );

    key(document.activeElement as Element, 'ArrowRight');
    key(document.activeElement as Element, 'ArrowRight');
    await settle();
    expect(document.activeElement?.getAttribute('aria-label')).toBe(
      'Insert table: 3 × 2',
    );

    // Rows are the block axis and Home/End address the grid bounds — neither
    // mirrors in any direction.
    key(document.activeElement as Element, 'ArrowDown');
    await settle();
    expect(document.activeElement?.getAttribute('aria-label')).toBe(
      'Insert table: 4 × 2',
    );

    key(document.activeElement as Element, 'Home');
    await settle();
    expect(document.activeElement?.getAttribute('aria-label')).toBe(
      'Insert table: 1 × 1',
    );

    key(document.activeElement as Element, 'End');
    await settle();
    expect(document.activeElement?.getAttribute('aria-label')).toBe(
      'Insert table: 10 × 10',
    );
  });

  it('keeps grid column stepping unmirrored in an LTR island while the document is RTL', async () => {
    TestBed.inject(MlvRtlService).setDirection('rtl');
    (fixture.nativeElement as HTMLElement).setAttribute('dir', 'ltr');
    await settle();
    tableTrigger().click();
    await settle();

    key(document.activeElement as Element, 'ArrowRight');
    await settle();
    expect(document.activeElement?.getAttribute('aria-label')).toBe(
      'Insert table: 3 × 4',
    );
  });

  it('executes every row, column, header, and delete action against a real table', async () => {
    expect(
      editor().commands.insertTable({
        rows: 2,
        cols: 2,
        withHeaderRow: true,
      }),
    ).toBe(true);
    await settle();
    tableTrigger().click();
    await settle();
    const expectedActions = [
      'Add row before',
      'Add row after',
      'Delete row',
      'Add column before',
      'Add column after',
      'Delete column',
      'Merge cells',
      'Split cell',
      'Toggle header row',
      'Toggle header column',
      'Toggle header cell',
      'Delete table',
    ];
    expect(
      [...tableMenu().querySelectorAll('[role="menuitem"]')].map((item) =>
        item.textContent?.trim(),
      ),
    ).toEqual(expectedActions);

    menuItem('Add row before').click();
    await settle();
    expect(tableRows()).toHaveLength(3);
    expect(fixture.componentInstance.blurs()).toBe(0);
    menuItem('Add row after').click();
    await settle();
    expect(tableRows()).toHaveLength(4);
    menuItem('Delete row').click();
    await settle();
    expect(tableRows()).toHaveLength(3);

    menuItem('Add column before').click();
    await settle();
    expect(tableRows()?.map((row) => row.content?.length)).toEqual([3, 3, 3]);
    menuItem('Add column after').click();
    await settle();
    expect(tableRows()?.map((row) => row.content?.length)).toEqual([4, 4, 4]);
    menuItem('Delete column').click();
    await settle();
    expect(tableRows()?.map((row) => row.content?.length)).toEqual([3, 3, 3]);

    menuItem('Delete table').click();
    await settle();
    expect(
      editor()
        .getJSON()
        .content?.some((node) => node.type === 'table'),
    ).toBe(false);
  });

  it('runs the three header commands distinctly in valid real table states', async () => {
    editor().commands.insertTable({
      rows: 2,
      cols: 2,
      withHeaderRow: false,
    });
    await settle();
    tableTrigger().click();
    await settle();

    menuItem('Toggle header row').click();
    await settle();
    expect(
      tableRows()?.map((row) => row.content?.map((cell) => cell.type)),
    ).toEqual([
      ['tableHeader', 'tableHeader'],
      ['tableCell', 'tableCell'],
    ]);

    editor().commands.setContent('<p></p>');
    editor().commands.insertTable({
      rows: 2,
      cols: 2,
      withHeaderRow: false,
    });
    await settle();
    menuItem('Toggle header column').click();
    await settle();
    expect(
      tableRows()?.map((row) => row.content?.map((cell) => cell.type)),
    ).toEqual([
      ['tableHeader', 'tableCell'],
      ['tableHeader', 'tableCell'],
    ]);

    editor().commands.setContent('<p></p>');
    editor().commands.insertTable({
      rows: 2,
      cols: 2,
      withHeaderRow: false,
    });
    await settle();
    menuItem('Toggle header cell').click();
    await settle();
    expect(
      tableRows()?.map((row) => row.content?.map((cell) => cell.type)),
    ).toEqual([
      ['tableHeader', 'tableCell'],
      ['tableCell', 'tableCell'],
    ]);
  });

  it('uses real capability checks and distinct merge and split commands', async () => {
    editor().commands.insertTable({
      rows: 2,
      cols: 2,
      withHeaderRow: false,
    });
    await settle();
    tableTrigger().click();
    await settle();
    // Menu rows are `mlv-list-item` hosts, not native buttons, so availability
    // reads from `aria-disabled` rather than the `disabled` property.
    const beforeDisabled = editor().getJSON();

    expect(menuItem('Split cell').getAttribute('aria-disabled')).toBe('true');
    menuItem('Split cell').click();
    await settle();
    expect(editor().getJSON()).toEqual(beforeDisabled);

    const [firstCell, secondCell] = cellPositions();
    expect(
      editor().commands.setCellSelection({
        anchorCell: firstCell,
        headCell: secondCell,
      }),
    ).toBe(true);
    await settle();
    expect(menuItem('Merge cells').getAttribute('aria-disabled')).toBeNull();
    menuItem('Merge cells').click();
    await settle();
    expect(tableRows()?.[0]?.content).toHaveLength(1);
    expect(tableRows()?.[0]?.content?.[0]?.attrs?.['colspan']).toBe(2);

    expect(menuItem('Split cell').getAttribute('aria-disabled')).toBeNull();
    menuItem('Split cell').click();
    await settle();
    expect(tableRows()?.[0]?.content).toHaveLength(2);
    expect(tableRows()?.[0]?.content?.[0]?.attrs?.['colspan']).toBe(1);
  });

  it('supports Home/End boundaries and Space insertion without adding grid tab stops', async () => {
    tableTrigger().click();
    await settle();
    const panel = tablePanel();

    key(document.activeElement as Element, 'Home');
    await settle();
    expect(document.activeElement?.getAttribute('aria-label')).toBe(
      'Insert table: 1 × 1',
    );
    key(document.activeElement as Element, 'ArrowLeft');
    key(document.activeElement as Element, 'ArrowUp');
    await settle();
    expect(document.activeElement?.getAttribute('aria-label')).toBe(
      'Insert table: 1 × 1',
    );

    key(document.activeElement as Element, 'End');
    await settle();
    expect(document.activeElement?.getAttribute('aria-label')).toBe(
      'Insert table: 10 × 10',
    );
    key(document.activeElement as Element, 'ArrowRight');
    key(document.activeElement as Element, 'ArrowDown');
    await settle();
    expect(document.activeElement?.getAttribute('aria-label')).toBe(
      'Insert table: 10 × 10',
    );
    expect(
      panel.querySelectorAll('.mlv-editor-table__grid-cell[tabindex="0"]'),
    ).toHaveLength(1);

    key(document.activeElement as Element, ' ');
    await settle();
    expect(tableRows()).toHaveLength(10);
    expect(tableRows()?.map((row) => row.content?.length)).toEqual([
      10, 10, 10, 10, 10, 10, 10, 10, 10, 10,
    ]);
    expect(
      tableRows()?.[0]?.content?.every((cell) => cell.type === 'tableHeader'),
    ).toBe(true);
  });

  it('uses pointer selection to expose and insert the exact hovered dimensions', async () => {
    tableTrigger().click();
    await settle();
    const panel = tablePanel();
    const target = panel.querySelector(
      'button[aria-label="Insert table: 2 × 5"]',
    ) as HTMLButtonElement;

    target.dispatchEvent(new MouseEvent('mouseenter'));
    await settle();
    expect(target.tabIndex).toBe(0);
    expect(target.getAttribute('aria-selected')).toBe('true');
    expect(
      panel.querySelectorAll('.mlv-editor-table__grid-cell--selected'),
    ).toHaveLength(10);
    target.click();
    await settle();
    expect(tableRows()).toHaveLength(2);
    expect(tableRows()?.map((row) => row.content?.length)).toEqual([5, 5]);
  });

  it('hides the complete table control in both toolbar shells when extensions are replaced without tables', async () => {
    await recreateWithExtensions([StarterKit]);
    expect(
      (fixture.nativeElement as HTMLElement).querySelector(
        'mlv-editor-table:not([hidden])',
      ),
    ).toBeNull();

    const toolbarFixture = TestBed.createComponent(StandaloneTableToolbarHost);
    const instance = new Editor({
      extensions: [StarterKit],
      content: '<p>No tables</p>',
    });
    toolbarFixture.componentInstance.editor.set(instance);
    document.body.appendChild(toolbarFixture.nativeElement);
    toolbarFixture.detectChanges();
    await toolbarFixture.whenStable();
    toolbarFixture.detectChanges();
    try {
      expect(
        toolbarFixture.nativeElement.querySelector(
          'mlv-editor-table:not([hidden])',
        ),
      ).toBeNull();
    } finally {
      toolbarFixture.destroy();
      (toolbarFixture.nativeElement as HTMLElement).remove();
      instance.destroy();
    }
  });

  it('disables the table trigger and blocks an open insertion for a readonly standalone context', async () => {
    const toolbarFixture = TestBed.createComponent(StandaloneTableToolbarHost);
    const instance = new Editor({
      extensions: mlvEditorDefaultExtensions(),
      content: '<p>Tables</p>',
    });
    toolbarFixture.componentInstance.editor.set(instance);
    document.body.appendChild(toolbarFixture.nativeElement);
    const settleToolbar = async (): Promise<void> => {
      toolbarFixture.detectChanges();
      await toolbarFixture.whenStable();
      toolbarFixture.detectChanges();
    };
    try {
      await settleToolbar();
      const trigger = (
        toolbarFixture.nativeElement as HTMLElement
      ).querySelector<HTMLButtonElement>(
        'mlv-editor-table button[aria-label="Table"]',
      );
      if (!trigger) throw new Error('Expected the standalone table trigger.');
      trigger.click();
      await settleToolbar();
      const cell = tablePanel().querySelector(
        'button[aria-label="Insert table: 3 × 3"]',
      ) as HTMLButtonElement;
      const before = instance.getJSON();

      toolbarFixture.componentInstance.readonly.set(true);
      await settleToolbar();
      key(cell, 'Enter');
      await settleToolbar();
      expect(instance.getJSON()).toEqual(before);
      expect(trigger.disabled).toBe(true);
    } finally {
      toolbarFixture.destroy();
      (toolbarFixture.nativeElement as HTMLElement).remove();
      instance.destroy();
    }
  });

  it('closes and blocks already-open insertion and contextual paths for readonly and disabled state', async () => {
    const trigger = tableTrigger();
    trigger.click();
    await settle();
    const insertionPanel = tablePanel();
    const insertionCell = insertionPanel.querySelector(
      'button[aria-label="Insert table: 3 × 3"]',
    ) as HTMLButtonElement;
    const beforeInsertion = editor().getJSON();

    fixture.componentInstance.readonly.set(true);
    await settle();
    key(insertionCell, 'Enter');
    await settle();
    expect(editor().getJSON()).toEqual(beforeInsertion);
    await completeClose();
    expect(
      overlayContainer
        .getContainerElement()
        .querySelector('.mlv-editor-table__panel'),
    ).toBeNull();
    // A readonly editor renders no toolbar (#498): the trigger went with the
    // band. Its own readonly gating is pinned through the standalone shell.
    expect(trigger.isConnected).toBe(false);

    fixture.componentInstance.readonly.set(false);
    await settle();
    editor().commands.insertTable({
      rows: 2,
      cols: 2,
      withHeaderRow: false,
    });
    await settle();
    // The widget swapped branches when the caret entered the table, so the
    // popup trigger captured above is detached — re-query the menu trigger.
    const contextualTrigger = tableTrigger();
    contextualTrigger.click();
    await settle();
    const beforeContextual = editor().getJSON();

    fixture.componentInstance.disabled.set(true);
    await settle();
    menuItem('Add row after').click();
    await settle();
    expect(editor().getJSON()).toEqual(beforeContextual);
    expect(contextualTrigger.disabled).toBe(true);
  });

  it('owns popup focus, closes on Escape, restores the trigger, and emits no false blur', async () => {
    const trigger = tableTrigger();
    trigger.click();
    await settle();
    const panel = tablePanel();

    expect(panel.closest('[role="dialog"]')?.getAttribute('aria-label')).toBe(
      'Table',
    );
    expect(document.activeElement?.getAttribute('aria-label')).toBe(
      'Insert table: 3 × 3',
    );
    expect(fixture.componentInstance.blurs()).toBe(0);

    key(panel, 'Escape');
    await settle();
    await completeClose();
    expect(document.activeElement).toBe(trigger);
    expect(fixture.componentInstance.blurs()).toBe(0);
  });

  it('places table between link and block insert in the public toolbar and reacts to external selections', async () => {
    const toolbarFixture = TestBed.createComponent(StandaloneTableToolbarHost);
    const instance = new Editor({
      extensions: mlvEditorDefaultExtensions(),
      content: '<p>before</p>',
    });
    toolbarFixture.componentInstance.editor.set(instance);
    document.body.appendChild(toolbarFixture.nativeElement);
    const settleToolbar = async (): Promise<void> => {
      toolbarFixture.detectChanges();
      await toolbarFixture.whenStable();
      toolbarFixture.detectChanges();
    };
    await settleToolbar();
    try {
      expect(
        [
          ...toolbarFixture.nativeElement.querySelectorAll(
            'mlv-editor-link, mlv-editor-table, mlv-editor-block-insert',
          ),
        ].map(({ localName }) => localName),
      ).toEqual([
        'mlv-editor-link',
        'mlv-editor-table',
        'mlv-editor-block-insert',
      ]);
      const trigger = toolbarFixture.nativeElement.querySelector(
        'mlv-editor-table button[aria-label="Table"]',
      ) as HTMLButtonElement;
      // Outside a table the widget is an insert-dialog trigger; inside one it is
      // a menu button. It is never a toggle, so it carries no `aria-pressed`.
      const tableWidget = () =>
        toolbarFixture.nativeElement.querySelector(
          'mlv-editor-table button[aria-label="Table"]',
        ) as HTMLButtonElement;
      expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
      expect(trigger.classList.contains('mlv-button--selected')).toBe(false);
      expect(trigger.hasAttribute('aria-pressed')).toBe(false);

      instance.commands.insertTable({
        rows: 2,
        cols: 2,
        withHeaderRow: false,
      });
      await settleToolbar();
      expect(tableWidget().getAttribute('aria-haspopup')).toBe('menu');
      expect(tableWidget().classList.contains('mlv-button--selected')).toBe(
        true,
      );
      expect(tableWidget().hasAttribute('aria-pressed')).toBe(false);

      instance.commands.setTextSelection(instance.state.doc.content.size - 1);
      await settleToolbar();
      expect(tableWidget().getAttribute('aria-haspopup')).toBe('dialog');
      expect(tableWidget().classList.contains('mlv-button--selected')).toBe(
        false,
      );
    } finally {
      toolbarFixture.destroy();
      (toolbarFixture.nativeElement as HTMLElement).remove();
      instance.destroy();
    }
  });

  it('updates table trigger, insertion, and header-cell copy reactively', async () => {
    const trigger = tableTrigger();
    trigger.click();
    await settle();
    const panel = tablePanel();

    editorCopy.update((copy) => ({
      ...copy,
      table: 'Matrix',
      insertTable: 'Add matrix',
      toggleHeaderCell: 'Toggle heading cell',
    }));
    await settle();
    expect(trigger.getAttribute('aria-label')).toBe('Matrix');
    expect(
      panel.querySelector('[role="grid"]')?.getAttribute('aria-label'),
    ).toBe('Add matrix');
    expect(
      panel.querySelector('button[aria-label="Add matrix: 3 × 3"]'),
    ).not.toBeNull();

    key(panel, 'Escape');
    await settle();
    await completeClose();
    editor().commands.insertTable({
      rows: 2,
      cols: 2,
      withHeaderRow: false,
    });
    await settle();
    tableTrigger('Matrix').click();
    await settle();
    expect(menuItem('Toggle heading cell')).not.toBeNull();
  });

  it('keeps default tables resizable and renders selected-cell and resize selector states', async () => {
    const instance = new Editor({
      extensions: [StarterKit, ...mlvEditorTableExtensions()],
    });
    try {
      const resolvedTable = instance.extensionManager.extensions.find(
        ({ name }) => name === 'table',
      );
      expect(resolvedTable?.options['resizable']).toBe(true);
    } finally {
      instance.destroy();
    }

    editor().commands.insertTable({
      rows: 2,
      cols: 2,
      withHeaderRow: true,
    });
    const [firstCell, secondCell] = cellPositions();
    editor().commands.setCellSelection({
      anchorCell: firstCell,
      headCell: secondCell,
    });
    await settle();
    const renderedTable = editor().view.dom.querySelector(
      '.tableWrapper table',
    ) as HTMLTableElement | null;
    expect(renderedTable).not.toBeNull();
    expect(
      renderedTable?.querySelectorAll(':scope > colgroup > col'),
    ).toHaveLength(2);
    expect(renderedTable?.style.minWidth).not.toBe('');
    expect(editor().view.dom.querySelectorAll('.selectedCell')).toHaveLength(2);

    const liveStyle = document.createElement('style');
    liveStyle.textContent = compile(
      fileURLToPath(
        new URL(['..', 'editor', 'editor.scss'].join('/'), import.meta.url),
      ),
    ).css;
    document.head.appendChild(liveStyle);
    try {
      const rules = [...(liveStyle.sheet?.cssRules ?? [])].filter(
        (rule): rule is CSSStyleRule => rule instanceof CSSStyleRule,
      );
      const selectedCellRule = rules.find(
        ({ selectorText }) =>
          selectorText === '.mlv-editor .selectedCell::after',
      );
      expect(selectedCellRule?.style.background).toBe(
        'var(--mlv-background-accent-1-pale)',
      );
      const resizeHandleRule = rules.find(
        ({ selectorText }) =>
          selectorText === '.mlv-editor .column-resize-handle',
      );
      expect(resizeHandleRule?.style.background).toBe(
        'var(--mlv-border-focus)',
      );
      const resizeCursorRule = rules.find(
        ({ selectorText }) => selectorText === '.mlv-editor .resize-cursor',
      );
      expect(resizeCursorRule?.style.cursor).toBe('col-resize');
    } finally {
      liveStyle.remove();
    }
  });
});
