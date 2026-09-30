import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  ViewEncapsulation,
} from '@angular/core';
import type { Editor } from '@tiptap/core';
import {
  LucideBold,
  LucideCode,
  LucideItalic,
  LucideStrikethrough,
  LucideSubscript,
  LucideSuperscript,
  LucideUnderline,
} from '@lucide/angular';
import {
  MLV_EDITOR_TOOLBAR_CONTEXT,
  MLV_EDITOR_TOOLBAR_REVISION,
} from '../editor-toolbar-context';
import { MLV_EDITOR_I18N } from '@malva-ui/i18n';
import { MlvEditorCommandButton } from './editor-command-button';
import { MlvButtonIcon } from '@malva-ui/core/button';

/**
 * One inline mark `mlv-editor-inline-marks` can render, in its fixed order:
 * bold, italic, strike-through, underline, inline code, subscript,
 * superscript.
 */
export type MlvEditorInlineMark =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strike'
  | 'code'
  | 'subscript'
  | 'superscript';

/**
 * Inline mark toggles: bold, italic, strike-through, underline, inline code,
 * subscript and superscript. Each hides while its extension is absent, and
 * `marks` narrows the group to a subset without changing the order.
 */
@Component({
  selector: 'mlv-editor-inline-marks',
  imports: [
    MlvEditorCommandButton,
    LucideBold,
    LucideCode,
    LucideItalic,
    LucideStrikethrough,
    LucideSubscript,
    LucideSuperscript,
    LucideUnderline,
    MlvButtonIcon,
  ],
  template: `
    @if (_shows('bold')) {
      <mlv-editor-command-button
        [label]="_copy().bold"
        [pressed]="_isActive('bold')"
        [supports]="_canBold"
        [canCommand]="_canBoldNow"
        [command]="_bold"
        ><svg mlvButtonIcon lucideBold
      /></mlv-editor-command-button>
    }
    @if (_shows('italic')) {
      <mlv-editor-command-button
        [label]="_copy().italic"
        [pressed]="_isActive('italic')"
        [supports]="_canItalic"
        [canCommand]="_canItalicNow"
        [command]="_italic"
        ><svg mlvButtonIcon lucideItalic
      /></mlv-editor-command-button>
    }
    @if (_shows('strike')) {
      <mlv-editor-command-button
        [label]="_copy().strike"
        [pressed]="_isActive('strike')"
        [supports]="_canStrike"
        [canCommand]="_canStrikeNow"
        [command]="_strike"
        ><svg mlvButtonIcon lucideStrikethrough
      /></mlv-editor-command-button>
    }
    @if (_shows('underline')) {
      <mlv-editor-command-button
        [label]="_copy().underline"
        [pressed]="_isActive('underline')"
        [supports]="_canUnderline"
        [canCommand]="_canUnderlineNow"
        [command]="_underline"
        ><svg mlvButtonIcon lucideUnderline
      /></mlv-editor-command-button>
    }
    @if (_shows('code')) {
      <mlv-editor-command-button
        [label]="_copy().code"
        [pressed]="_isActive('code')"
        [supports]="_canCode"
        [canCommand]="_canCodeNow"
        [command]="_code"
        ><svg mlvButtonIcon lucideCode
      /></mlv-editor-command-button>
    }
    @if (_shows('subscript')) {
      <mlv-editor-command-button
        [label]="_copy().subscript"
        [pressed]="_isActive('subscript')"
        [supports]="_canSubscript"
        [canCommand]="_canSubscriptNow"
        [command]="_subscript"
        ><svg mlvButtonIcon lucideSubscript
      /></mlv-editor-command-button>
    }
    @if (_shows('superscript')) {
      <mlv-editor-command-button
        [label]="_copy().superscript"
        [pressed]="_isActive('superscript')"
        [supports]="_canSuperscript"
        [canCommand]="_canSuperscriptNow"
        [command]="_superscript"
        ><svg mlvButtonIcon lucideSuperscript
      /></mlv-editor-command-button>
    }
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'mlv-editor-inline-marks', role: 'group' },
})
export class MlvEditorInlineMarks {
  /**
   * Marks to render, filtering the group; the fixed order above is kept
   * whatever order the list is written in. `undefined` (the default) renders
   * all seven. A mark whose extension is absent stays hidden either way, and
   * an unknown value is ignored.
   */
  readonly marks = input<readonly MlvEditorInlineMark[] | undefined>(undefined);

  /** @protected Whether a mark is in the rendered subset. */
  protected _shows(mark: MlvEditorInlineMark): boolean {
    const marks = this.marks();
    return marks === undefined || marks.includes(mark);
  }

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
      code: this._i18n?.().inlineCode ?? 'Inline code',
      subscript: this._i18n?.().subscript ?? 'Subscript',
      superscript: this._i18n?.().superscript ?? 'Superscript',
    }),
  );
  /** @protected Reads active state after the latest transaction or selection update. */
  protected _isActive(name: string): boolean {
    this._revision();
    return this._context.isActive(name);
  }
  /** @protected Bold availability. */ protected readonly _canBold = (
    editor: Editor,
  ): boolean => editor.commands.toggleBold !== undefined;
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
  /** @protected Inline-code availability. */ protected readonly _canCode = (
    editor: Editor,
  ): boolean => editor.commands.toggleCode !== undefined;
  /** @protected Current inline-code command availability. */ protected readonly _canCodeNow =
    (editor: Editor): boolean => editor.can().chain().toggleCode().run();
  /** @protected Subscript availability. */ protected readonly _canSubscript = (
    editor: Editor,
  ): boolean => editor.commands.toggleSubscript !== undefined;
  /** @protected Current subscript command availability. */ protected readonly _canSubscriptNow =
    (editor: Editor): boolean => editor.can().chain().toggleSubscript().run();
  /** @protected Superscript availability. */ protected readonly _canSuperscript =
    (editor: Editor): boolean =>
      editor.commands.toggleSuperscript !== undefined;
  /** @protected Current superscript command availability. */ protected readonly _canSuperscriptNow =
    (editor: Editor): boolean => editor.can().chain().toggleSuperscript().run();
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
  /** @protected Inline-code command. */ protected readonly _code = (
    editor: Editor,
  ): boolean => editor.chain().focus().toggleCode().run();
  /** @protected Subscript command. */ protected readonly _subscript = (
    editor: Editor,
  ): boolean => editor.chain().focus().toggleSubscript().run();
  /** @protected Superscript command. */ protected readonly _superscript = (
    editor: Editor,
  ): boolean => editor.chain().focus().toggleSuperscript().run();
}
