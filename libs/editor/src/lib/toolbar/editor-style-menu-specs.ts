import { computed, inject } from '@angular/core';
import type { Editor } from '@tiptap/core';
import { MLV_EDITOR_I18N } from '@malva-ui/i18n';
import type { MlvEditorStyleMenuSpec } from './editor-style-menu';
import { MLV_EDITOR_TEXT_STYLES } from './editor-text-styles';

/** @internal Sans-serif system stack of the built-in font list. */
export const MLV_EDITOR_FONT_FAMILY_SANS =
  'ui-sans-serif, system-ui, sans-serif';
/** @internal Serif system stack of the built-in font list. */
export const MLV_EDITOR_FONT_FAMILY_SERIF =
  "ui-serif, Georgia, 'Times New Roman', serif";
/** @internal Monospace system stack of the built-in font list. */
export const MLV_EDITOR_FONT_FAMILY_MONO =
  'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

/**
 * @internal Text shown for a CSS font size: a `px` value loses its unit
 * (`'16px'` → `'16'`), any other unit is shown as written.
 *
 * @param value A CSS font size.
 */
export function mlvEditorFontSizeLabel(value: string): string {
  const trimmed = value.trim();
  return /^\d+(?:\.\d+)?px$/u.test(trimmed) ? trimmed.slice(0, -2) : trimmed;
}

/**
 * @internal First family of a font stack, unquoted: the text shown for a
 * family outside the options (`"'Inter', sans-serif"` → `Inter`).
 *
 * @param value A CSS `font-family` value.
 */
export function mlvEditorFontFamilyLabel(value: string): string {
  return (value.split(',')[0] ?? value).trim().replace(/^['"]|['"]$/gu, '');
}

/**
 * @internal Comparison key of a font stack: families unquoted, trimmed and
 * lower-cased (CSS matches family names case-insensitively). A browser's
 * CSSOM re-serializes a stack on parse — Chromium writes
 * `'Times New Roman'` back as `"Times New Roman"` — so a value that went
 * through an HTML or Markdown round trip is compared by key, never verbatim.
 * Both sides of a comparison go through this function.
 *
 * @param value A CSS `font-family` value.
 */
export function mlvEditorFontFamilyKey(value: string): string {
  return value
    .split(',')
    .map((family) =>
      family
        .trim()
        .replace(/^['"]|['"]$/gu, '')
        .toLowerCase(),
    )
    .join(',');
}

/** @private Reads a string attribute of the text style at the selection. */
function textStyleValue(editor: Editor, name: string): string | null {
  const value: unknown = editor.getAttributes('textStyle')[name];
  return typeof value === 'string' ? value : null;
}

/**
 * @internal Font-family menu: `MLV_EDITOR_TEXT_STYLES.fontFamilies`, else the
 * localized built-in sans / serif / monospace stacks. Call in an injection
 * context.
 */
export function mlvEditorFontFamilyMenuSpec(): MlvEditorStyleMenuSpec {
  const i18n = inject(MLV_EDITOR_I18N, { optional: true });
  const styles = inject(MLV_EDITOR_TEXT_STYLES);
  const options = computed(() => {
    const copy = i18n?.();
    const families = styles.fontFamilies ?? [
      {
        label: copy?.fontFamilySans ?? 'Sans serif',
        value: MLV_EDITOR_FONT_FAMILY_SANS,
      },
      {
        label: copy?.fontFamilySerif ?? 'Serif',
        value: MLV_EDITOR_FONT_FAMILY_SERIF,
      },
      {
        label: copy?.fontFamilyMono ?? 'Monospace',
        value: MLV_EDITOR_FONT_FAMILY_MONO,
      },
    ];
    return families.map(({ label, value }) => ({
      label,
      value,
      fontFamily: value,
    }));
  });
  return {
    label: computed(() => i18n?.().fontFamily ?? 'Font'),
    options,
    commands: ['setFontFamily', 'unsetFontFamily'],
    // A stored stack equal to an option by key reads as that option's value,
    // so the trigger and `aria-current` follow a browser-re-quoted value.
    read: (editor) => {
      const value = textStyleValue(editor, 'fontFamily');
      if (value === null) return null;
      const key = mlvEditorFontFamilyKey(value);
      return (
        options().find((option) => mlvEditorFontFamilyKey(option.value) === key)
          ?.value ?? value
      );
    },
    display: mlvEditorFontFamilyLabel,
    apply: (value) => (editor) =>
      editor.chain().focus().setFontFamily(value).run(),
    canApply: (value) => (editor) =>
      editor.can().chain().setFontFamily(value).run(),
    unset: (editor) => editor.chain().focus().unsetFontFamily().run(),
    canUnset: (editor) => editor.can().chain().unsetFontFamily().run(),
  };
}

/**
 * @internal Font-size menu: `MLV_EDITOR_TEXT_STYLES.fontSizes`, labelled
 * without a `px` unit. Call in an injection context.
 */
export function mlvEditorFontSizeMenuSpec(): MlvEditorStyleMenuSpec {
  const i18n = inject(MLV_EDITOR_I18N, { optional: true });
  const styles = inject(MLV_EDITOR_TEXT_STYLES);
  return {
    label: computed(() => i18n?.().fontSize ?? 'Font size'),
    options: computed(() =>
      styles.fontSizes.map((value) => ({
        value,
        label: mlvEditorFontSizeLabel(value),
        fontFamily: null,
      })),
    ),
    commands: ['setFontSize', 'unsetFontSize'],
    read: (editor) => textStyleValue(editor, 'fontSize'),
    display: mlvEditorFontSizeLabel,
    apply: (value) => (editor) =>
      editor.chain().focus().setFontSize(value).run(),
    canApply: (value) => (editor) =>
      editor.can().chain().setFontSize(value).run(),
    unset: (editor) => editor.chain().focus().unsetFontSize().run(),
    canUnset: (editor) => editor.can().chain().unsetFontSize().run(),
  };
}

/**
 * @internal Block line-height menu: `MLV_EDITOR_TEXT_STYLES.lineHeights`, read
 * from the block holding the selection start. Call in an injection context.
 */
export function mlvEditorLineHeightMenuSpec(): MlvEditorStyleMenuSpec {
  const i18n = inject(MLV_EDITOR_I18N, { optional: true });
  const styles = inject(MLV_EDITOR_TEXT_STYLES);
  return {
    label: computed(() => i18n?.().lineHeight ?? 'Line height'),
    options: computed(() =>
      styles.lineHeights.map((value) => ({
        value,
        label: value,
        fontFamily: null,
      })),
    ),
    commands: ['setBlockLineHeight', 'unsetBlockLineHeight'],
    read: (editor) => {
      const value: unknown =
        editor.state.selection.$from.parent.attrs['lineHeight'];
      return typeof value === 'string' ? value : null;
    },
    display: (value) => value,
    apply: (value) => (editor) =>
      editor.chain().focus().setBlockLineHeight(value).run(),
    canApply: (value) => (editor) =>
      editor.can().chain().setBlockLineHeight(value).run(),
    unset: (editor) => editor.chain().focus().unsetBlockLineHeight().run(),
    canUnset: (editor) => editor.can().chain().unsetBlockLineHeight().run(),
  };
}
