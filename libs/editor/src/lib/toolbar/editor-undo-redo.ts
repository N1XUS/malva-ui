import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  ViewEncapsulation,
} from '@angular/core';
import type { Editor } from '@tiptap/core';
import { LucideRedo2, LucideUndo2 } from '@lucide/angular';
import { MLV_EDITOR_I18N } from '@malva-ui/i18n';
import { MlvEditorCommandButton } from './editor-command-button';

/** Undo and redo actions backed by Tiptap history commands. */
@Component({
  selector: 'mlv-editor-undo-redo',
  imports: [MlvEditorCommandButton, LucideRedo2, LucideUndo2],
  template: `
    <mlv-editor-command-button
      [label]="_copy().undo"
      [supports]="_canUndo"
      [canCommand]="_canExecuteUndo"
      [command]="_undo"
      ><svg lucideUndo2
    /></mlv-editor-command-button>
    <mlv-editor-command-button
      [label]="_copy().redo"
      [supports]="_canRedo"
      [canCommand]="_canExecuteRedo"
      [command]="_redo"
      ><svg lucideRedo2
    /></mlv-editor-command-button>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'mlv-editor-undo-redo', role: 'group' },
})
export class MlvEditorUndoRedo {
  /** @private Optional localized editor copy. */
  private readonly _i18n = inject(MLV_EDITOR_I18N, { optional: true });

  /** @protected Resolved copy with SSR-safe English fallbacks. */
  protected readonly _copy = computed(() => ({
    undo: this._i18n?.().undo ?? 'Undo',
    redo: this._i18n?.().redo ?? 'Redo',
  }));

  /** @protected Tiptap availability query for undo. */
  protected readonly _canUndo = (editor: Editor): boolean =>
    editor.commands.undo !== undefined;
  /** @protected Tiptap availability query for redo. */
  protected readonly _canRedo = (editor: Editor): boolean =>
    editor.commands.redo !== undefined;
  /** @protected Current history availability for undo. */
  protected readonly _canExecuteUndo = (editor: Editor): boolean =>
    editor.can().undo();
  /** @protected Current history availability for redo. */
  protected readonly _canExecuteRedo = (editor: Editor): boolean =>
    editor.can().redo();
  /** @protected Selection-restoring undo command. */
  protected readonly _undo = (editor: Editor): boolean =>
    editor.chain().focus().undo().run();
  /** @protected Selection-restoring redo command. */
  protected readonly _redo = (editor: Editor): boolean =>
    editor.chain().focus().redo().run();
}
