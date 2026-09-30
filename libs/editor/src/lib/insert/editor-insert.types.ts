import type { ChainedCommands, Editor } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { MlvEditorI18n } from '@malva-ui/i18n';

/**
 * Group an insert item renders under in the clean-mode command menu. The four
 * built-in groups render in this order with localized labels; any other
 * string is a consumer group, rendered after them in first-seen order with no
 * label (a separator only).
 */
export type MlvEditorInsertGroup =
  | 'ai'
  | 'style'
  | 'lists'
  | 'insert'
  | (string & {});

/**
 * The block an insert item acts on, resolved from the selection when the item
 * runs — never when the menu opens, so no position is held across the open
 * menu.
 */
export interface MlvEditorInsertTarget {
  /** Document position before the source top-level block. */
  readonly pos: number;

  /** The source block node, read when the item runs. */
  readonly node: ProseMirrorNode;

  /**
   * `true` for an empty paragraph: items convert it in place instead of
   * inserting after it.
   */
  readonly empty: boolean;
}

/** What an insert item's callbacks receive. */
export interface MlvEditorInsertContext {
  /** The editor the menu belongs to. */
  readonly editor: Editor;

  /** The block the item acts on. */
  readonly target: MlvEditorInsertTarget;

  /**
   * `editor.chain().focus()` with a first step that leaves the caret in an
   * empty paragraph: the source when `target.empty`, else a new paragraph
   * after it, with stored marks cleared. Chain the block command and call
   * `.run()`: the insertion and the command are one transaction, one undo
   * step.
   */
  chain(): ChainedCommands;
}

/** One entry of the clean-mode command menu. */
export interface MlvEditorInsertItem {
  /** Stable id, unique within the menu; also the `@for` tracking key. */
  readonly id: string;

  /** Visible label. */
  readonly label: string;

  /** Group the item renders under. */
  readonly group: MlvEditorInsertGroup;

  /**
   * Lucide icon name, rendered through `LucideDynamicIcon`. The names the
   * default items use resolve inside the editor; any other name must be
   * registered by the application (`provideLucideIcons`). An unregistered
   * name renders no icon and warns once per name in dev mode; the item still
   * renders and runs.
   */
  readonly icon?: string;

  /** Hides the item when it returns `false` (e.g. its extension is absent). Default: shown. */
  readonly available?: (context: MlvEditorInsertContext) => boolean;

  /** Disables the item when it returns `false`. Default: enabled. */
  readonly enabled?: (context: MlvEditorInsertContext) => boolean;

  /**
   * Runs the item. The menu has closed already; returning `false` reports
   * nothing, and a thrown error is reported through `editorError` as a
   * recoverable `'unsupported-command'`.
   */
  readonly run: (context: MlvEditorInsertContext) => boolean | void;
}

/**
 * The editor copy `mlvEditorDefaultInsertItems` reads: a resolved
 * `MlvEditorI18n` subset. Every key is optional and falls back to English, so
 * `mlvEditorDefaultInsertItems()` with no argument yields the English items.
 */
export type MlvEditorInsertCopy = Partial<
  Pick<
    MlvEditorI18n,
    | 'askAi'
    | 'paragraph'
    | 'headingLevel'
    | 'blockquote'
    | 'codeBlock'
    | 'bulletList'
    | 'orderedList'
    | 'taskList'
    | 'insertTable'
    | 'horizontalRule'
    | 'uploadImage'
  >
>;
