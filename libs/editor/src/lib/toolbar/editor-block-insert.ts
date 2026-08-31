import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  ViewEncapsulation,
} from '@angular/core';
import type { Editor } from '@tiptap/core';
import { LucideCode2, LucideMinus, LucideTextQuote } from '@lucide/angular';
import {
  MLV_EDITOR_TOOLBAR_CONTEXT,
  MLV_EDITOR_TOOLBAR_REVISION,
} from '../editor-toolbar-context';
import { MLV_EDITOR_I18N } from '@malva-ui/i18n';
import { MlvEditorCommandButton } from './editor-command-button';
import { MlvButtonIcon } from '@malva-ui/core/button';

/** Blockquote and code-block toggles plus horizontal-rule insertion. */
@Component({
  selector: 'mlv-editor-block-insert',
  imports: [
    MlvEditorCommandButton,
    LucideCode2,
    LucideMinus,
    LucideTextQuote,
    MlvButtonIcon,
  ],
  template: `
    <mlv-editor-command-button
      [label]="_copy().blockquote"
      [pressed]="_isActive('blockquote')"
      [supports]="_canBlockquote"
      [canCommand]="_canBlockquoteNow"
      [command]="_blockquote"
      ><svg mlvButtonIcon lucideTextQuote
    /></mlv-editor-command-button>
    <mlv-editor-command-button
      [label]="_copy().codeBlock"
      [pressed]="_isActive('codeBlock')"
      [supports]="_canCodeBlock"
      [canCommand]="_canCodeBlockNow"
      [command]="_codeBlock"
      ><svg mlvButtonIcon lucideCode2
    /></mlv-editor-command-button>
    <mlv-editor-command-button
      [label]="_copy().horizontalRule"
      [supports]="_canHorizontalRule"
      [canCommand]="_canHorizontalRuleNow"
      [command]="_horizontalRule"
      ><svg mlvButtonIcon lucideMinus
    /></mlv-editor-command-button>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'mlv-editor-block-insert', role: 'group' },
})
export class MlvEditorBlockInsert {
  /** @protected Editor command state. */ protected readonly _context = inject(
    MLV_EDITOR_TOOLBAR_CONTEXT,
  );
  /** @private Triggers active-state refreshes after editor events. */ private readonly _revision =
    inject(MLV_EDITOR_TOOLBAR_REVISION);
  /** @private Optional localized copy. */ private readonly _i18n = inject(
    MLV_EDITOR_I18N,
    { optional: true },
  );
  /** @protected Resolved labels. */ protected readonly _copy = computed(
    () => ({
      blockquote: this._i18n?.().blockquote ?? 'Blockquote',
      codeBlock: this._i18n?.().codeBlock ?? 'Code block',
      horizontalRule: this._i18n?.().horizontalRule ?? 'Horizontal rule',
    }),
  );
  /** @protected Registered blockquote command. */ protected readonly _canBlockquote =
    (editor: Editor): boolean => editor.commands.toggleBlockquote !== undefined;
  /** @protected Current blockquote command availability. */ protected readonly _canBlockquoteNow =
    (editor: Editor): boolean => editor.can().chain().toggleBlockquote().run();
  /** @protected Registered code-block command. */ protected readonly _canCodeBlock =
    (editor: Editor): boolean => editor.commands.toggleCodeBlock !== undefined;
  /** @protected Current code-block command availability. */ protected readonly _canCodeBlockNow =
    (editor: Editor): boolean => editor.can().chain().toggleCodeBlock().run();
  /** @protected Registered horizontal-rule command. */ protected readonly _canHorizontalRule =
    (editor: Editor): boolean =>
      editor.commands.setHorizontalRule !== undefined;
  /** @protected Current horizontal-rule command availability. */ protected readonly _canHorizontalRuleNow =
    (editor: Editor): boolean => editor.can().chain().setHorizontalRule().run();
  /** @protected Blockquote command. */ protected readonly _blockquote = (
    editor: Editor,
  ): boolean => editor.chain().focus().toggleBlockquote().run();
  /** @protected Code-block command. */ protected readonly _codeBlock = (
    editor: Editor,
  ): boolean => editor.chain().focus().toggleCodeBlock().run();
  /** @protected Horizontal-rule command. */ protected readonly _horizontalRule =
    (editor: Editor): boolean =>
      editor.chain().focus().setHorizontalRule().run();

  /** @protected Reads command state after the toolbar receives an editor update. */
  protected readonly _isActive = (
    name: 'blockquote' | 'codeBlock',
  ): boolean => {
    this._revision();
    return this._context.isActive(name);
  };
}
