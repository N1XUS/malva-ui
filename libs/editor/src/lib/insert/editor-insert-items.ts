import type { Editor } from '@tiptap/core';
import { MLV_EDITOR_CLEAN_MODE_FALLBACKS } from '../editor-clean-mode-fallbacks';
import {
  mlvEditorInsertPosition,
  mlvEditorInsertServices,
} from './editor-insert-services';
import type {
  MlvEditorInsertContext,
  MlvEditorInsertCopy,
  MlvEditorInsertItem,
} from './editor-insert.types';

/** @internal English fallbacks of every key `MlvEditorInsertCopy` reads. */
const INSERT_COPY_FALLBACKS: Required<MlvEditorInsertCopy> = {
  askAi: MLV_EDITOR_CLEAN_MODE_FALLBACKS.askAi,
  paragraph: 'Paragraph',
  headingLevel: 'Heading level',
  blockquote: 'Blockquote',
  codeBlock: 'Code block',
  bulletList: 'Bullet list',
  orderedList: 'Ordered list',
  taskList: 'Task list',
  insertTable: 'Insert table',
  horizontalRule: 'Horizontal rule',
  uploadImage: 'Upload image',
};

/** @internal Heading levels the default items offer. */
const DEFAULT_INSERT_HEADING_LEVELS = [1, 2, 3] as const;

/** @internal Whether `editor` has the command `name` (its extension is installed). */
function hasCommand(editor: Editor, name: string): boolean {
  return (
    typeof (editor.commands as unknown as Record<string, unknown>)[name] ===
    'function'
  );
}

/** @internal Whether the heading extension offers `level`. */
function offersHeading(editor: Editor, level: number): boolean {
  if (!hasCommand(editor, 'setHeading')) return false;
  const heading = editor.extensionManager.extensions.find(
    (extension) => extension.name === 'heading',
  );
  const levels = (heading?.options as { levels?: unknown } | undefined)?.levels;
  return !Array.isArray(levels) || levels.includes(level);
}

/** @internal Whether the schema can hold the paragraph the prepare step inserts. */
function hasParagraph({ editor }: MlvEditorInsertContext): boolean {
  return !!editor.schema.nodes['paragraph'];
}

/** @internal An item available while its command and a paragraph exist. */
function commandAvailable(
  name: string,
): (context: MlvEditorInsertContext) => boolean {
  return (context) => hasParagraph(context) && hasCommand(context.editor, name);
}

/**
 * The default items of the clean-mode command menu (#516, U7), in group
 * order: AI (`Ask AI…`), basic blocks (paragraph, headings 1–3, blockquote,
 * code block), lists (bullet, ordered, task) and insert (table, divider,
 * image). Each item is available only while its extension (or service) is
 * present, so a consumer preset that drops an extension drops its item.
 *
 * `mlv-editor` uses these, with its live i18n copy, when `insertItems` is not
 * bound. To extend or reorder them, spread the result into your own array and
 * pass the editor copy so the labels follow the language:
 * `mlvEditorDefaultInsertItems(inject(MLV_EDITOR_I18N)())`. Every key is
 * optional and falls back to English.
 *
 * @param copy Editor copy the labels read; omitted keys fall back to English.
 */
export function mlvEditorDefaultInsertItems(
  copy: MlvEditorInsertCopy = {},
): MlvEditorInsertItem[] {
  const text = { ...INSERT_COPY_FALLBACKS, ...definedKeys(copy) };
  return [
    {
      id: 'ask-ai',
      label: text.askAi,
      group: 'ai',
      icon: 'sparkles',
      available: ({ editor }) =>
        mlvEditorInsertServices(editor)?.aiAvailable() ?? false,
      enabled: ({ editor }) =>
        mlvEditorInsertServices(editor)?.aiCanStart() ?? false,
      run: ({ editor, target }) => {
        const services = mlvEditorInsertServices(editor);
        if (!services) return false;
        services.askAi(target);
        return true;
      },
    },
    {
      id: 'paragraph',
      label: text.paragraph,
      group: 'style',
      icon: 'pilcrow',
      available: hasParagraph,
      run: (context) => context.chain().run(),
    },
    ...DEFAULT_INSERT_HEADING_LEVELS.map(
      (level): MlvEditorInsertItem => ({
        id: `heading-${level}`,
        label: `${text.headingLevel} ${level}`,
        group: 'style',
        icon: `heading-${level}`,
        available: (context) =>
          hasParagraph(context) && offersHeading(context.editor, level),
        run: (context) => context.chain().setHeading({ level }).run(),
      }),
    ),
    {
      id: 'blockquote',
      label: text.blockquote,
      group: 'style',
      icon: 'text-quote',
      available: commandAvailable('toggleBlockquote'),
      run: (context) => context.chain().toggleBlockquote().run(),
    },
    {
      id: 'code-block',
      label: text.codeBlock,
      group: 'style',
      icon: 'code-xml',
      available: commandAvailable('setCodeBlock'),
      run: (context) => context.chain().setCodeBlock().run(),
    },
    {
      id: 'bullet-list',
      label: text.bulletList,
      group: 'lists',
      icon: 'list',
      available: commandAvailable('toggleBulletList'),
      run: (context) => context.chain().toggleBulletList().run(),
    },
    {
      id: 'ordered-list',
      label: text.orderedList,
      group: 'lists',
      icon: 'list-ordered',
      available: commandAvailable('toggleOrderedList'),
      run: (context) => context.chain().toggleOrderedList().run(),
    },
    {
      id: 'task-list',
      label: text.taskList,
      group: 'lists',
      icon: 'list-todo',
      available: commandAvailable('toggleTaskList'),
      run: (context) => context.chain().toggleTaskList().run(),
    },
    {
      id: 'table',
      label: text.insertTable,
      group: 'insert',
      icon: 'table-2',
      available: commandAvailable('insertTable'),
      run: (context) =>
        context
          .chain()
          .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
          .run(),
    },
    {
      id: 'divider',
      label: text.horizontalRule,
      group: 'insert',
      icon: 'minus',
      available: commandAvailable('setHorizontalRule'),
      run: (context) => context.chain().setHorizontalRule().run(),
    },
    {
      id: 'image',
      label: text.uploadImage,
      group: 'insert',
      icon: 'image',
      available: (context) =>
        hasParagraph(context) &&
        (mlvEditorInsertServices(context.editor)?.imageUploadAvailable() ??
          false),
      enabled: ({ editor }) =>
        mlvEditorInsertServices(editor)?.imageUploadEnabled() ?? false,
      // No `chain()`: the paragraph it would prepare stays behind when the
      // dialog is dismissed. The upload lands at the position read on submit.
      run: ({ editor }) => {
        const services = mlvEditorInsertServices(editor);
        if (!services || mlvEditorInsertPosition(editor.state) === null) {
          return false;
        }
        services.openImageUpload(() => mlvEditorInsertPosition(editor.state));
        return true;
      },
    },
  ];
}

/** @internal `copy` without its `undefined` values, so they cannot mask a fallback. */
function definedKeys(copy: MlvEditorInsertCopy): MlvEditorInsertCopy {
  return Object.fromEntries(
    Object.entries(copy).filter(([, value]) => typeof value === 'string'),
  ) as MlvEditorInsertCopy;
}
