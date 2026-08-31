import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  ViewEncapsulation,
} from '@angular/core';
import type { Editor } from '@tiptap/core';
import {
  LucideBold,
  LucideItalic,
  LucideStrikethrough,
  LucideUnderline,
} from '@lucide/angular';
import {
  MLV_EDITOR_TOOLBAR_CONTEXT,
  MLV_EDITOR_TOOLBAR_REVISION,
} from '../editor-toolbar-context';
import { MLV_EDITOR_I18N } from '@malva-ui/i18n';
import { MlvEditorCommandButton } from './editor-command-button';
import { MlvButtonIcon } from '@malva-ui/core/button';

/** Inline bold, italic, strike-through, and underline toggles. */
@Component({
  selector: 'mlv-editor-inline-marks',
  imports: [
    MlvEditorCommandButton,
    LucideBold,
    LucideItalic,
    LucideStrikethrough,
    LucideUnderline,
    MlvButtonIcon,
  ],
  template: `
    <mlv-editor-command-button
      [label]="_copy().bold"
      [pressed]="_isActive('bold')"
      [supports]="_canBold"
      [canCommand]="_canBoldNow"
      [command]="_bold"
      ><svg mlvButtonIcon lucideBold
    /></mlv-editor-command-button>
    <mlv-editor-command-button
      [label]="_copy().italic"
      [pressed]="_isActive('italic')"
      [supports]="_canItalic"
      [canCommand]="_canItalicNow"
      [command]="_italic"
      ><svg mlvButtonIcon lucideItalic
    /></mlv-editor-command-button>
    <mlv-editor-command-button
      [label]="_copy().strike"
      [pressed]="_isActive('strike')"
      [supports]="_canStrike"
      [canCommand]="_canStrikeNow"
      [command]="_strike"
      ><svg mlvButtonIcon lucideStrikethrough
    /></mlv-editor-command-button>
    <mlv-editor-command-button
      [label]="_copy().underline"
      [pressed]="_isActive('underline')"
      [supports]="_canUnderline"
      [canCommand]="_canUnderlineNow"
      [command]="_underline"
      ><svg mlvButtonIcon lucideUnderline
    /></mlv-editor-command-button>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'mlv-editor-inline-marks', role: 'group' },
})
export class MlvEditorInlineMarks {
  /** @protected Editor command state. */ protected readonly _context = inject(
    MLV_EDITOR_TOOLBAR_CONTEXT,
  );
  /** @private Per-editor state invalidation signal. */ private readonly _revision =
    inject(MLV_EDITOR_TOOLBAR_REVISION);
  /** @private Optional localized copy. */ private readonly _i18n = inject(
    MLV_EDITOR_I18N,
    { optional: true },
  );
  /** @protected Resolved labels. */ protected readonly _copy = computed(
    () => ({
      bold: this._i18n?.().bold ?? 'Bold',
      italic: this._i18n?.().italic ?? 'Italic',
      strike: this._i18n?.().strike ?? 'Strike',
      underline: this._i18n?.().underline ?? 'Underline',
    }),
  );
  /** @protected Bold availability. */ protected readonly _canBold = (
    editor: Editor,
  ): boolean => editor.commands.toggleBold !== undefined;
  /** @protected Reads active state after the latest transaction or selection update. */
  protected _isActive(name: string): boolean {
    this._revision();
    return this._context.isActive(name);
  }
  /** @protected Current bold command availability. */ protected readonly _canBoldNow =
    (editor: Editor): boolean => editor.can().chain().toggleBold().run();
  /** @protected Italic availability. */ protected readonly _canItalic = (
    editor: Editor,
  ): boolean => editor.commands.toggleItalic !== undefined;
  /** @protected Current italic command availability. */ protected readonly _canItalicNow =
    (editor: Editor): boolean => editor.can().chain().toggleItalic().run();
  /** @protected Strike availability. */ protected readonly _canStrike = (
    editor: Editor,
  ): boolean => editor.commands.toggleStrike !== undefined;
  /** @protected Current strike command availability. */ protected readonly _canStrikeNow =
    (editor: Editor): boolean => editor.can().chain().toggleStrike().run();
  /** @protected Underline availability. */ protected readonly _canUnderline = (
    editor: Editor,
  ): boolean => editor.commands.toggleUnderline !== undefined;
  /** @protected Current underline command availability. */ protected readonly _canUnderlineNow =
    (editor: Editor): boolean => editor.can().chain().toggleUnderline().run();
  /** @protected Bold command. */ protected readonly _bold = (
    editor: Editor,
  ): boolean => editor.chain().focus().toggleBold().run();
  /** @protected Italic command. */ protected readonly _italic = (
    editor: Editor,
  ): boolean => editor.chain().focus().toggleItalic().run();
  /** @protected Strike command. */ protected readonly _strike = (
    editor: Editor,
  ): boolean => editor.chain().focus().toggleStrike().run();
  /** @protected Underline command. */ protected readonly _underline = (
    editor: Editor,
  ): boolean => editor.chain().focus().toggleUnderline().run();
}
