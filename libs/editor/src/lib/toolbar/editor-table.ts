import type { Signal } from '@angular/core';
import {
  DOWN_ARROW,
  LEFT_ARROW,
  RIGHT_ARROW,
  UP_ARROW,
} from '@angular/cdk/keycodes';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  effect,
  inject,
  signal,
  viewChild,
  viewChildren,
  ViewEncapsulation,
} from '@angular/core';
import type { Editor } from '@tiptap/core';
import { LucideTable2 } from '@lucide/angular';
import {
  MlvButton,
  MlvButtonIcon,
  MlvButtonToggle,
} from '@malva-ui/core/button';
import { MlvDivider } from '@malva-ui/core/divider';
import { MlvListItem } from '@malva-ui/core/list';
import { MlvMenu, MlvMenuItem, MlvMenuTrigger } from '@malva-ui/core/menu';
import {
  MlvPopup,
  MlvPopupContent,
  MlvPopupTrigger,
} from '@malva-ui/core/popup';
import { MLV_EDITOR_I18N } from '@malva-ui/i18n';
import { MlvTooltip } from '@malva-ui/core/tooltip';
import { MlvRtlService } from '@malva-ui/cdk/utils';
import {
  MLV_EDITOR_OVERLAY_REGISTRY,
  MLV_EDITOR_TOOLBAR_CONTEXT,
  MLV_EDITOR_TOOLBAR_REVISION,
} from '../editor-toolbar-context';
import { MlvEditorToolbarWidget } from './editor-toolbar-widget';

interface EditorTableSize {
  readonly rows: number;
  readonly cols: number;
}

const TABLE_GRID_BOUNDARY = 10;

/** Resizable table insertion and contextual command control. */
@Component({
  selector: 'mlv-editor-table',
  imports: [
    MlvButton,
    MlvButtonIcon,
    MlvButtonToggle,
    MlvTooltip,
    LucideTable2,
    MlvEditorToolbarWidget,
    MlvPopup,
    MlvPopupContent,
    MlvPopupTrigger,
    MlvDivider,
    MlvListItem,
    MlvMenu,
    MlvMenuItem,
    MlvMenuTrigger,
  ],
  templateUrl: './editor-table.html',
  styleUrl: './editor-table.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-editor-table',
    '[hidden]': '!_supported()',
  },
})
export class MlvEditorTable {
  /** @protected Editor-scoped command and form state. */
  protected readonly _context = inject(MLV_EDITOR_TOOLBAR_CONTEXT);

  /** @private Normalizes horizontal grid movement for RTL. */
  private readonly _rtlService = inject(MlvRtlService);

  /**
   * @private Host element; the scope horizontal arrow keys resolve their
   * direction against. The grid renders in a popup pane portaled out of this
   * subtree, so the handler speaks for the host, never for `event.target`.
   */
  private readonly _elementRef = inject(ElementRef<HTMLElement>);

  /** @private Transaction and selection invalidation bridge. */
  private readonly _revision = inject(MLV_EDITOR_TOOLBAR_REVISION, {
    optional: true,
  });

  /** @private Detached popup ownership for composite editor focus. */
  private readonly _overlays = inject(MLV_EDITOR_OVERLAY_REGISTRY);

  /** @private Optional localized editor copy. */
  private readonly _i18n = inject(MLV_EDITOR_I18N, { optional: true });

  // The control renders one of two overlays, never both: the insertion grid is
  // a popup (a bespoke 10x10 roving grid, not a list of commands), while the
  // in-table commands are a real `mlv-menu`. Each branch's queries are therefore
  // optional — `required` would throw on whichever branch is not rendered.

  /** @protected Popup controller owned by the insertion-grid trigger. */
  protected readonly _popup = viewChild<MlvPopup>('_popup');

  /** @protected Connected insertion-grid popup trigger. */
  protected readonly _trigger = viewChild<MlvPopupTrigger>('_trigger');

  /** @protected Menu holding the in-table commands. */
  protected readonly _menu = viewChild<MlvMenu>('_menu');

  /** @protected Connected in-table menu trigger. */
  protected readonly _menuTrigger = viewChild(MlvMenuTrigger);

  /** @protected Native trigger restored after final popup teardown. */
  protected readonly _triggerElement = viewChild('_triggerElement', {
    read: ElementRef,
  }) as Signal<ElementRef<HTMLButtonElement> | undefined>;

  /** @private Detached popup panel used by the overlay focus registry. */
  private readonly _panel = viewChild<ElementRef<HTMLElement>>('_panel');

  /** @protected First contextual action focused when a table popup opens. */
  protected readonly _firstAction = viewChild('_firstAction', {
    read: ElementRef,
  }) as Signal<ElementRef<HTMLButtonElement> | undefined>;

  /** @private Native insertion-grid buttons in row-major order. */
  private readonly _gridCells = viewChildren('_gridCell', {
    read: ElementRef,
  }) as Signal<readonly ElementRef<HTMLButtonElement>[]>;

  /** @protected Fixed row and column choices exposed by the grid. */
  protected readonly _gridRows: readonly (readonly EditorTableSize[])[] =
    Array.from({ length: TABLE_GRID_BOUNDARY }, (_, rowIndex) =>
      Array.from({ length: TABLE_GRID_BOUNDARY }, (_, columnIndex) => ({
        rows: rowIndex + 1,
        cols: columnIndex + 1,
      })),
    );

  /** @protected Currently selected insertion dimensions. */
  protected readonly _selectedSize = signal<EditorTableSize>({
    rows: 3,
    cols: 3,
  });

  /** @protected Whether insertion creates a header first row. */
  protected readonly _withHeaderRow = signal(true);

  /** @protected Reactive localized copy for the trigger and insertion panel. */
  protected readonly _copy = computed(() => {
    const copy = this._i18n?.();
    return {
      table: copy?.table ?? 'Table',
      insertTable: copy?.insertTable ?? 'Insert table',
      addRowBefore: copy?.addRowBefore ?? 'Add row before',
      addRowAfter: copy?.addRowAfter ?? 'Add row after',
      deleteRow: copy?.deleteRow ?? 'Delete row',
      addColumnBefore: copy?.addColumnBefore ?? 'Add column before',
      addColumnAfter: copy?.addColumnAfter ?? 'Add column after',
      deleteColumn: copy?.deleteColumn ?? 'Delete column',
      mergeCells: copy?.mergeCells ?? 'Merge cells',
      splitCell: copy?.splitCell ?? 'Split cell',
      toggleHeaderRow: copy?.toggleHeaderRow ?? 'Toggle header row',
      toggleHeaderColumn: copy?.toggleHeaderColumn ?? 'Toggle header column',
      toggleHeaderCell: copy?.toggleHeaderCell ?? 'Toggle header cell',
      deleteTable: copy?.deleteTable ?? 'Delete table',
    };
  });

  /** @protected Whether the current editor registered table commands. */
  protected readonly _supported = computed(() => {
    this._revision?.();
    const commands = this._context.editor()?.commands as
      | Record<string, unknown>
      | undefined;
    return typeof commands?.['insertTable'] === 'function';
  });

  /** @protected Whether the retained selection is inside a table. */
  protected readonly _active = computed(() => {
    this._revision?.();
    return this._context.isActive('table');
  });

  /** @protected Whether editor form state blocks the complete control. */
  protected readonly _disabled = computed(
    () => this._context.disabled() || this._context.readonly(),
  );

  /** @protected Adds a row before the selected cell. */
  protected readonly _addRowBefore = (editor: Editor): boolean =>
    editor.chain().addRowBefore().run();

  /** @protected Adds a row after the selected cell. */
  protected readonly _addRowAfter = (editor: Editor): boolean =>
    editor.chain().addRowAfter().run();

  /** @protected Deletes the selected row. */
  protected readonly _deleteRow = (editor: Editor): boolean =>
    editor.chain().deleteRow().run();

  /** @protected Adds a column before the selected cell. */
  protected readonly _addColumnBefore = (editor: Editor): boolean =>
    editor.chain().addColumnBefore().run();

  /** @protected Adds a column after the selected cell. */
  protected readonly _addColumnAfter = (editor: Editor): boolean =>
    editor.chain().addColumnAfter().run();

  /** @protected Deletes the selected column. */
  protected readonly _deleteColumn = (editor: Editor): boolean =>
    editor.chain().deleteColumn().run();

  /** @protected Merges the selected rectangular cell range. */
  protected readonly _mergeCells = (editor: Editor): boolean =>
    editor.chain().mergeCells().run();

  /** @protected Splits the current merged cell. */
  protected readonly _splitCell = (editor: Editor): boolean =>
    editor.chain().splitCell().run();

  /** @protected Toggles header nodes across the first row. */
  protected readonly _toggleHeaderRow = (editor: Editor): boolean =>
    editor.chain().toggleHeaderRow().run();

  /** @protected Toggles header nodes down the first column. */
  protected readonly _toggleHeaderColumn = (editor: Editor): boolean =>
    editor.chain().toggleHeaderColumn().run();

  /** @protected Toggles the selected table cell's header node type. */
  protected readonly _toggleHeaderCell = (editor: Editor): boolean =>
    editor.chain().toggleHeaderCell().run();

  /** @protected Deletes the complete active table. */
  protected readonly _deleteTable = (editor: Editor): boolean =>
    editor.chain().deleteTable().run();

  /** @protected Non-dispatching add-row-before capability check. */
  protected readonly _canAddRowBefore = (editor: Editor): boolean =>
    editor.can().chain().addRowBefore().run();

  /** @protected Non-dispatching add-row-after capability check. */
  protected readonly _canAddRowAfter = (editor: Editor): boolean =>
    editor.can().chain().addRowAfter().run();

  /** @protected Non-dispatching delete-row capability check. */
  protected readonly _canDeleteRow = (editor: Editor): boolean =>
    editor.can().chain().deleteRow().run();

  /** @protected Non-dispatching add-column-before capability check. */
  protected readonly _canAddColumnBefore = (editor: Editor): boolean =>
    editor.can().chain().addColumnBefore().run();

  /** @protected Non-dispatching add-column-after capability check. */
  protected readonly _canAddColumnAfter = (editor: Editor): boolean =>
    editor.can().chain().addColumnAfter().run();

  /** @protected Non-dispatching delete-column capability check. */
  protected readonly _canDeleteColumn = (editor: Editor): boolean =>
    editor.can().chain().deleteColumn().run();

  /** @protected Non-dispatching merge capability check. */
  protected readonly _canMergeCells = (editor: Editor): boolean =>
    editor.can().chain().mergeCells().run();

  /** @protected Non-dispatching split capability check. */
  protected readonly _canSplitCell = (editor: Editor): boolean =>
    editor.can().chain().splitCell().run();

  /** @protected Non-dispatching header-row capability check. */
  protected readonly _canToggleHeaderRow = (editor: Editor): boolean =>
    editor.can().chain().toggleHeaderRow().run();

  /** @protected Non-dispatching header-column capability check. */
  protected readonly _canToggleHeaderColumn = (editor: Editor): boolean =>
    editor.can().chain().toggleHeaderColumn().run();

  /** @protected Non-dispatching header-cell capability check. */
  protected readonly _canToggleHeaderCell = (editor: Editor): boolean =>
    editor.can().chain().toggleHeaderCell().run();

  /** @protected Non-dispatching table-deletion capability check. */
  protected readonly _canDeleteTable = (editor: Editor): boolean =>
    editor.can().chain().deleteTable().run();

  constructor() {
    effect(() => {
      if (!this._disabled()) return;
      const popup = this._popup();
      if (popup?.opened()) popup.opened.set(false);
      this._menuTrigger()?.close();
    });

    effect((onCleanup) => {
      const panel = this._panel()?.nativeElement;
      if (!panel) return;
      const unregister = this._overlays.register(panel, () =>
        this._popup()?.opened.set(false),
      );
      onCleanup(unregister);
    });
  }

  /** @protected Initializes and focuses the default insertion-grid choice. */
  protected _onOpened(): void {
    if (this._disabled()) {
      this._popup()?.opened.set(false);
      return;
    }
    this._selectedSize.set({ rows: 3, cols: 3 });
    this._withHeaderRow.set(true);
    queueMicrotask(() => this._focusSelectedCell());
  }

  /** @protected Restores the connected toolbar trigger after final teardown. */
  protected _onClosed(): void {
    const trigger = this._triggerElement()?.nativeElement;
    if (!this._disabled() && trigger?.isConnected) trigger.focus();
  }

  /** @protected Names an exact insertion size from localized table copy. */
  protected _sizeLabel(size: EditorTableSize): string {
    return `${this._copy().insertTable}: ${size.rows} × ${size.cols}`;
  }

  /** @protected Whether a grid cell belongs to the selected dimensions. */
  protected _sizeSelected(size: EditorTableSize): boolean {
    const selected = this._selectedSize();
    return size.rows <= selected.rows && size.cols <= selected.cols;
  }

  /** @protected Updates the current pointer/focus-selected dimensions. */
  protected _selectSize(size: EditorTableSize): void {
    this._selectedSize.set(size);
  }

  /** @protected Executes insertion for a selected pointer cell. */
  protected _insertSize(size: EditorTableSize): void {
    this._selectedSize.set(size);
    const inserted = this._context.run((editor) =>
      editor
        .chain()
        .focus()
        .insertTable({
          rows: size.rows,
          cols: size.cols,
          withHeaderRow: this._withHeaderRow(),
        })
        .run(),
    );
    if (inserted) this._trigger()?.close();
  }

  /**
   * @protected Whether the caret's cell is already a header cell. Drives the
   * `aria-current` marker on the header-cell row so the menu says what the
   * table is, not only what it can become.
   */
  protected _isHeaderCell(): boolean {
    this._revision?.();
    return this._context.isActive('tableHeader');
  }

  /** @private Overlay-registration teardown for the open command menu. */
  private _unregisterMenu: (() => void) | undefined;

  /** @private Guards queued registration after a quick close or destroy. */
  private _menuOpen = false;

  /**
   * @protected Keeps the portalled menu panel inside the editor's composite
   * focus boundary. The panel exists only once the overlay has rendered, hence
   * the microtask; `_menuOpen` guards a close that beats it.
   */
  protected _registerMenuOverlay(): void {
    this._menuOpen = true;
    queueMicrotask(() => {
      const menu = this._menu();
      if (!this._menuOpen || !menu) return;
      const panel = document.getElementById(menu.panelId);
      if (!panel) return;
      this._unregisterMenu?.();
      this._unregisterMenu = this._overlays.register(panel, () => menu.close());
    });
  }

  /** @protected Drops the menu's overlay registration. */
  protected _unregisterMenuOverlay(): void {
    this._menuOpen = false;
    this._unregisterMenu?.();
    this._unregisterMenu = undefined;
  }

  /** @protected Whether current selection and form state block an action. */
  protected _commandDisabled(command: (editor: Editor) => boolean): boolean {
    this._revision?.();
    if (this._disabled()) return true;
    return !this._context.can(command);
  }

  /** @protected Executes one contextual mutation through the public guard. */
  protected _run(
    command: (editor: Editor) => boolean,
    closeAfter = false,
  ): void {
    const applied = this._context.run(command);
    if (applied && closeAfter) this._menuTrigger()?.close();
  }

  /** @protected Handles bounded grid navigation and keyboard insertion. */
  protected _onGridKeydown(event: KeyboardEvent): void {
    const current = this._selectedSize();
    let next = current;
    // Columns run along the inline axis, resolved against this control's own
    // host rather than the document, so a scoped `dir` subtree — or a CDK
    // overlay pane, which carries its own `dir` — mirrors the pair correctly.
    switch (
      this._rtlService.normalizeArrowKey(event, this._elementRef) ??
      event.key
    ) {
      case LEFT_ARROW:
        next = { ...current, cols: Math.max(1, current.cols - 1) };
        break;
      case RIGHT_ARROW:
        next = {
          ...current,
          cols: Math.min(TABLE_GRID_BOUNDARY, current.cols + 1),
        };
        break;
      case UP_ARROW:
        next = { ...current, rows: Math.max(1, current.rows - 1) };
        break;
      case DOWN_ARROW:
        next = {
          ...current,
          rows: Math.min(TABLE_GRID_BOUNDARY, current.rows + 1),
        };
        break;
      case 'Home':
        next = { rows: 1, cols: 1 };
        break;
      case 'End':
        next = { rows: TABLE_GRID_BOUNDARY, cols: TABLE_GRID_BOUNDARY };
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        this._insertSize(current);
        return;
      default:
        return;
    }
    event.preventDefault();
    this._selectedSize.set(next);
    queueMicrotask(() => this._focusSelectedCell());
  }

  /** @private Focuses the single row-major button matching selected dimensions. */
  private _focusSelectedCell(): void {
    const selected = this._selectedSize();
    const index =
      (selected.rows - 1) * TABLE_GRID_BOUNDARY + (selected.cols - 1);
    this._gridCells()[index]?.nativeElement.focus();
  }
}
