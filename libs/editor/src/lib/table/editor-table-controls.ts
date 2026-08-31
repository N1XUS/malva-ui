import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import type { Editor } from '@tiptap/core';
import {
  LucideEllipsis,
  LucideGripHorizontal,
  LucideGripVertical,
} from '@lucide/angular';
import { MlvListItem } from '@malva-ui/core/list';
import { MlvMenu, MlvMenuItem, MlvMenuTrigger } from '@malva-ui/core/menu';
import { MLV_EDITOR_I18N } from '@malva-ui/i18n';
import {
  MLV_EDITOR_OVERLAY_REGISTRY,
  MLV_EDITOR_TOOLBAR_CONTEXT,
  MLV_EDITOR_TOOLBAR_REVISION,
} from '../editor-toolbar-context';
import {
  mlvEditorTableGeometry,
  type MlvEditorTableBox,
  type MlvEditorTableGeometry,
} from './editor-table-geometry';

/**
 * @internal Rendered thickness of a grip, in the zoom layer's unscaled pixels.
 * Mirrors `--mlv-editor-table-grip-size` in the stylesheet; the two are read in
 * different coordinate systems (JS lays out, CSS paints) so both must agree.
 */
const GRIP_SIZE = 14;

/** @internal Reads the live scale of the layer instead of trusting a CSS variable. */
function layerScale(layer: HTMLElement): number {
  const width = layer.offsetWidth;
  if (!width) return 1;
  const scaled = layer.getBoundingClientRect().width;
  return scaled > 0 ? scaled / width : 1;
}

/** @internal Narrows an event target to the `td`/`th` it lands in, if any. */
function cellFromEvent(event: Event): HTMLTableCellElement | null {
  const target = event.target;
  if (!(target instanceof Element)) return null;
  const cell = target.closest('td, th');
  return cell instanceof HTMLTableCellElement ? cell : null;
}

/**
 * Hover affordances for the table under the pointer: a grip beside the hovered
 * row, one above the hovered column and one in the table's corner, each opening
 * the commands scoped to what it points at.
 *
 * Pointer-only by design, matching `MlvEditorBlockHandle`: the grips are
 * `aria-hidden` and never focusable, so the content region stays the single
 * `role="textbox"` tab stop. Keyboard and assistive-technology users reach the
 * same commands through `mlv-editor-table` in the toolbar, which acts on the
 * cell the caret is already in.
 */
@Component({
  selector: 'mlv-editor-table-controls',
  imports: [
    LucideEllipsis,
    LucideGripHorizontal,
    LucideGripVertical,
    MlvListItem,
    MlvMenu,
    MlvMenuItem,
    MlvMenuTrigger,
  ],
  templateUrl: './editor-table-controls.html',
  styleUrl: './editor-table-controls.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-editor-table-controls',
    'aria-hidden': 'true',
  },
})
export class MlvEditorTableControls {
  /**
   * The positioned, zoom-carrying layer the grips are laid out inside. Grips
   * are placed in its unscaled coordinate space, so they follow the content at
   * every zoom level without a second transform of their own.
   */
  readonly layer = input.required<HTMLElement>();

  /** @protected Editor-scoped command and form state. */
  protected readonly _context = inject(MLV_EDITOR_TOOLBAR_CONTEXT);

  /** @private Transaction and selection invalidation bridge. */
  private readonly _revision = inject(MLV_EDITOR_TOOLBAR_REVISION, {
    optional: true,
  });

  /** @private Keeps grip menus inside the editor's composite focus boundary. */
  private readonly _overlays = inject(MLV_EDITOR_OVERLAY_REGISTRY, {
    optional: true,
  });

  /** @private Document used to resolve the public menu panel id. */
  private readonly _document = inject(DOCUMENT);

  /** @private Reactive localized copy source. */
  private readonly _i18n = inject(MLV_EDITOR_I18N, { optional: true });

  /**
   * @private The cell the grips currently address. Held as an element rather
   * than a document position so a re-measure after a scroll or a zoom change
   * needs no second `posAtDOM` round trip.
   */
  private readonly _cell = signal<HTMLTableCellElement | null>(null);

  /** @protected Placement of the three grips, or null while none are shown. */
  protected readonly _geometry = signal<MlvEditorTableGeometry | null>(null);

  /**
   * @private Set while a grip menu is open. The grips must survive the pointer
   * leaving the table to reach the menu, which is portalled outside it.
   */
  private readonly _pinned = signal(false);

  /** @private Overlay-registration teardown for the open grip menu. */
  private _unregister: (() => void) | undefined;

  /** @private Guards queued registration after a quick close or destroy. */
  private _menuOpen = false;

  /** @protected Localized labels for the three grips. */
  protected readonly _copy = computed(() => {
    const copy = this._i18n?.();
    return {
      rowActions: copy?.rowActions ?? 'Row actions',
      columnActions: copy?.columnActions ?? 'Column actions',
      tableActions: copy?.tableActions ?? 'Table actions',
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

  /** @protected Whether the grips may act at all. */
  protected readonly _enabled = computed(() => this._context.editable());

  constructor() {
    const destroyRef = inject(DestroyRef);
    const onPointerMove = (event: Event) => this._track(event);
    const onPointerLeave = () => this._release();

    // Registered on the document rather than on the editor DOM: the ProseMirror
    // element is replaced whenever the editor is recreated (a format switch, an
    // extension-set change), and a listener bound to the old node would go
    // quiet without ever erroring. Capture is not needed — the events bubble.
    document.addEventListener('pointermove', onPointerMove, { passive: true });
    document.addEventListener('pointerleave', onPointerLeave, {
      passive: true,
    });
    destroyRef.onDestroy(() => {
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerleave', onPointerLeave);
      this._unregisterOverlay();
    });
  }

  /** @protected Inline placement for one grip box. */
  protected _style(box: MlvEditorTableBox): Record<string, string> {
    return {
      top: `${box.top}px`,
      left: `${box.left}px`,
      width: `${box.width}px`,
      height: `${box.height}px`,
    };
  }

  /**
   * @protected Keeps the grips mounted while their menu is open and keeps the
   * portalled panel inside the editor's composite focus boundary.
   *
   * The panel only exists once the overlay has rendered, hence the microtask;
   * `_menuOpen` guards a close that beats it.
   */
  protected _openMenu(menu: MlvMenu): void {
    this._pinned.set(true);
    this._menuOpen = true;
    queueMicrotask(() => {
      if (!this._menuOpen) return;
      const panel = this._document.getElementById(menu.panelId);
      if (!panel) return;
      this._unregister?.();
      this._unregister = this._overlays?.register(panel, () => menu.close());
    });
  }

  /** @protected Releases the pin and re-measures against the current pointer. */
  protected _closeMenu(): void {
    this._pinned.set(false);
    this._unregisterOverlay();
    this._measure();
  }

  /** @private Drops any active overlay registration. */
  private _unregisterOverlay(): void {
    this._menuOpen = false;
    this._unregister?.();
    this._unregister = undefined;
  }

  /**
   * @protected Runs one table command against the cell the grip points at.
   *
   * The Tiptap table commands all act on the current selection, so the caret is
   * moved into the grip's own cell first. That is also what makes the grips
   * honest: the command a user picks from the row grip cannot land on whichever
   * row the caret happened to be sitting in.
   */
  protected _run(command: (editor: Editor) => boolean): void {
    const cell = this._cell();
    if (!cell || !this._enabled()) return;

    this._context.run((editor) => {
      const position = editor.view.posAtDOM(cell, 0);
      if (position < 0) return false;
      return editor.chain().focus().setTextSelection(position).run();
    });
    this._context.run(command);
    this._measure();
  }

  /** @protected Whether a command is currently unavailable for the grip's cell. */
  protected _disabled(command: (editor: Editor) => boolean): boolean {
    this._revision?.();
    return !this._enabled() || !this._context.can(command);
  }

  // Each command comes in two forms. The dispatching one runs on activation;
  // the `can` one is a dry run and is what the disabled bindings read, because a
  // template binding is evaluated on every change detection pass. Handing the
  // dispatching form to a guard would mutate the document just by rendering —
  // it deleted the table the grips were pointing at.
  /** @protected `addRowBefore` in dispatching form. */
  protected readonly _addRowBefore = (editor: Editor) =>
    editor.chain().focus().addRowBefore().run();

  /** @protected Non-dispatching `addRowBefore` capability check. */
  protected readonly _canAddRowBefore = (editor: Editor): boolean =>
    editor.can().chain().addRowBefore().run();

  /** @protected `addRowAfter` in dispatching form. */
  protected readonly _addRowAfter = (editor: Editor) =>
    editor.chain().focus().addRowAfter().run();

  /** @protected Non-dispatching `addRowAfter` capability check. */
  protected readonly _canAddRowAfter = (editor: Editor): boolean =>
    editor.can().chain().addRowAfter().run();

  /** @protected `deleteRow` in dispatching form. */
  protected readonly _deleteRow = (editor: Editor) =>
    editor.chain().focus().deleteRow().run();

  /** @protected Non-dispatching `deleteRow` capability check. */
  protected readonly _canDeleteRow = (editor: Editor): boolean =>
    editor.can().chain().deleteRow().run();

  /** @protected `addColumnBefore` in dispatching form. */
  protected readonly _addColumnBefore = (editor: Editor) =>
    editor.chain().focus().addColumnBefore().run();

  /** @protected Non-dispatching `addColumnBefore` capability check. */
  protected readonly _canAddColumnBefore = (editor: Editor): boolean =>
    editor.can().chain().addColumnBefore().run();

  /** @protected `addColumnAfter` in dispatching form. */
  protected readonly _addColumnAfter = (editor: Editor) =>
    editor.chain().focus().addColumnAfter().run();

  /** @protected Non-dispatching `addColumnAfter` capability check. */
  protected readonly _canAddColumnAfter = (editor: Editor): boolean =>
    editor.can().chain().addColumnAfter().run();

  /** @protected `deleteColumn` in dispatching form. */
  protected readonly _deleteColumn = (editor: Editor) =>
    editor.chain().focus().deleteColumn().run();

  /** @protected Non-dispatching `deleteColumn` capability check. */
  protected readonly _canDeleteColumn = (editor: Editor): boolean =>
    editor.can().chain().deleteColumn().run();

  /** @protected `mergeCells` in dispatching form. */
  protected readonly _mergeCells = (editor: Editor) =>
    editor.chain().focus().mergeCells().run();

  /** @protected Non-dispatching `mergeCells` capability check. */
  protected readonly _canMergeCells = (editor: Editor): boolean =>
    editor.can().chain().mergeCells().run();

  /** @protected `splitCell` in dispatching form. */
  protected readonly _splitCell = (editor: Editor) =>
    editor.chain().focus().splitCell().run();

  /** @protected Non-dispatching `splitCell` capability check. */
  protected readonly _canSplitCell = (editor: Editor): boolean =>
    editor.can().chain().splitCell().run();

  /** @protected `toggleHeaderRow` in dispatching form. */
  protected readonly _toggleHeaderRow = (editor: Editor) =>
    editor.chain().focus().toggleHeaderRow().run();

  /** @protected Non-dispatching `toggleHeaderRow` capability check. */
  protected readonly _canToggleHeaderRow = (editor: Editor): boolean =>
    editor.can().chain().toggleHeaderRow().run();

  /** @protected `toggleHeaderColumn` in dispatching form. */
  protected readonly _toggleHeaderColumn = (editor: Editor) =>
    editor.chain().focus().toggleHeaderColumn().run();

  /** @protected Non-dispatching `toggleHeaderColumn` capability check. */
  protected readonly _canToggleHeaderColumn = (editor: Editor): boolean =>
    editor.can().chain().toggleHeaderColumn().run();

  /** @protected `toggleHeaderCell` in dispatching form. */
  protected readonly _toggleHeaderCell = (editor: Editor) =>
    editor.chain().focus().toggleHeaderCell().run();

  /** @protected Non-dispatching `toggleHeaderCell` capability check. */
  protected readonly _canToggleHeaderCell = (editor: Editor): boolean =>
    editor.can().chain().toggleHeaderCell().run();

  /** @protected `deleteTable` in dispatching form. */
  protected readonly _deleteTable = (editor: Editor) =>
    editor.chain().focus().deleteTable().run();

  /** @protected Non-dispatching `deleteTable` capability check. */
  protected readonly _canDeleteTable = (editor: Editor): boolean =>
    editor.can().chain().deleteTable().run();

  /** @private Resolves the cell under the pointer and re-places the grips. */
  private _track(event: Event): void {
    if (this._pinned() || !this._enabled()) return;

    const cell = cellFromEvent(event);
    // The listener is on the document, so this instance also sees cells that
    // belong to another editor on the same page. Without this test every editor
    // on a docs page renders its own full set of grips, stacked at the hovered
    // cell's coordinates.
    if (cell && !this.layer().contains(cell)) {
      this._release();
      return;
    }
    if (!cell) {
      // Leaving the table hides the grips, but leaving *into* a grip must not:
      // the grips are siblings of the content, not descendants of the cell.
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest('.mlv-editor-table-controls')
      ) {
        return;
      }
      this._release();
      return;
    }

    this._cell.set(cell);
    this._measure();
  }

  /** @private Drops the grips. */
  private _release(): void {
    if (this._pinned()) return;
    this._cell.set(null);
    this._geometry.set(null);
  }

  /** @private Re-measures the pinned cell against the live layout. */
  private _measure(): void {
    const cell = this._cell();
    const layer = this.layer();
    const table = cell?.closest('table');
    if (!cell || !table || !cell.isConnected) {
      this._geometry.set(null);
      return;
    }

    this._geometry.set(
      mlvEditorTableGeometry({
        cell: cell.getBoundingClientRect(),
        table: table.getBoundingClientRect(),
        layer: layer.getBoundingClientRect(),
        scale: layerScale(layer),
        gripSize: GRIP_SIZE,
      }),
    );
  }
}
