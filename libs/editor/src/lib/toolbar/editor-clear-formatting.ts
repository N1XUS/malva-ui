import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  ViewEncapsulation,
} from '@angular/core';
import type { Editor } from '@tiptap/core';
import { LucideRemoveFormatting } from '@lucide/angular';
import { MlvButtonIcon } from '@malva-ui/core/button';
import { MLV_EDITOR_I18N } from '@malva-ui/i18n';
import { MlvEditorCommandButton } from './editor-command-button';

/**
 * Clear-formatting button (#514): removes every inline mark in the selection
 * except links, text styles included; with a caret it clears the marks the
 * next typed text would take. Needs `resetFormatting`
 * (`MlvEditorResetFormatting`, in the default preset).
 */
@Component({
  selector: 'mlv-editor-clear-formatting',
  imports: [MlvEditorCommandButton, LucideRemoveFormatting, MlvButtonIcon],
  template: `
    <mlv-editor-command-button
      [label]="_label()"
      [supports]="_supports"
      [canCommand]="_canReset"
      [command]="_reset"
      ><svg mlvButtonIcon lucideRemoveFormatting
    /></mlv-editor-command-button>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'mlv-editor-clear-formatting' },
})
export class MlvEditorClearFormatting {
  /** @private Optional localized copy. */
  private readonly _i18n = inject(MLV_EDITOR_I18N, { optional: true });

  /** @protected Localized button label. */
  protected readonly _label = computed(
    () => this._i18n?.().clearFormatting ?? 'Clear formatting',
  );

  /** @protected Whether the extension set registers `resetFormatting`. */
  protected readonly _supports = (editor: Editor): boolean =>
    editor.commands.resetFormatting !== undefined;

  /** @protected Whether formatting can be cleared at the selection. */
  protected readonly _canReset = (editor: Editor): boolean =>
    editor.can().chain().resetFormatting().run();

  /** @protected Clears formatting, restoring focus to the content. */
  protected readonly _reset = (editor: Editor): boolean =>
    editor.chain().focus().resetFormatting().run();
}
