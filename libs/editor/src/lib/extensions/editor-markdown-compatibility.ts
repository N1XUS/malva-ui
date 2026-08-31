import {
  generateHTML,
  getExtensionField,
  type AnyExtension,
  type Extensions,
  type JSONContent,
  type MarkdownRendererHelpers,
  type RenderContext,
} from '@tiptap/core';
import Highlight from '@tiptap/extension-highlight';
import { TextStyle } from '@tiptap/extension-text-style';
import { TableKit, type TableKitOptions } from '@tiptap/extension-table';
import StarterKit, { type StarterKitOptions } from '@tiptap/starter-kit';

/** @internal Markdown renderer signature resolved from a Tiptap extension. */
type MarkdownRenderer = (
  node: JSONContent,
  helpers: MarkdownRendererHelpers,
  context: RenderContext,
) => string;

/** @internal Escapes a value before it is interpolated into an HTML attribute. */
function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** @internal Resolves an extension's inherited Markdown renderer through Tiptap's public API. */
function parentMarkdownRenderer(
  extension: AnyExtension,
): MarkdownRenderer | undefined {
  return getExtensionField<MarkdownRenderer>(extension, 'renderMarkdown', {
    name: extension.name,
    options: extension.options,
    storage: extension.storage,
  });
}

/** @internal Emits a complete node as HTML rather than embedding Markdown inside an HTML fragment. */
function renderNodeAsHtml(node: JSONContent, extensions: Extensions): string {
  return generateHTML(
    {
      type: 'doc',
      content: [node],
    },
    extensions,
  );
}

/** @internal Builds the color-aware same-name TextStyle mark used by Malva's default preset. */
export function createMarkdownCompatibleTextStyle(): AnyExtension {
  return TextStyle.configure({}).extend({
    priority: 98,
    renderMarkdown(node, helpers) {
      const color = node.attrs?.['color'];
      const children = helpers.renderChildren(node);
      if (typeof color !== 'string' || color.length === 0) return children;
      return `<span style="color: ${escapeAttribute(color)}">${children}</span>`;
    },
  });
}

/** @internal Builds the color-aware same-name Highlight mark used by Malva's default preset. */
export function createMarkdownCompatibleHighlight(): AnyExtension {
  const base = Highlight.configure({ multicolor: true });
  const renderParent = parentMarkdownRenderer(base);

  return base.extend({
    priority: 99,
    renderMarkdown(node, helpers, context) {
      const color = node.attrs?.['color'];
      if (typeof color !== 'string' || color.length === 0) {
        return renderParent?.(node, helpers, context) ?? '';
      }
      const escaped = escapeAttribute(color);
      return `<mark data-color="${escaped}" style="background-color: ${escaped}; color: inherit">${helpers.renderChildren(node)}</mark>`;
    },
  });
}

/** @internal Extends one block child with an alignment-preserving renderer. */
function alignedBlockExtension(
  extension: AnyExtension,
  activeExtensions: () => Extensions,
): AnyExtension {
  const renderParent = parentMarkdownRenderer(extension);

  return extension.extend({
    renderMarkdown(node, helpers, context) {
      const alignment = node.attrs?.['textAlign'];
      if (
        alignment !== 'left' &&
        alignment !== 'center' &&
        alignment !== 'right' &&
        alignment !== 'justify'
      ) {
        return renderParent?.(node, helpers, context) ?? '';
      }
      return renderNodeAsHtml(node, activeExtensions());
    },
  });
}

/** @internal Builds the same-name StarterKit whose block children preserve explicit alignment. */
export function createMarkdownCompatibleStarterKit(
  options: Partial<StarterKitOptions>,
): AnyExtension {
  let editorExtensions: Extensions = [];
  const base = StarterKit.configure(options);

  return base.extend({
    addExtensions() {
      return (this.parent?.() ?? []).map((extension) =>
        extension.name === 'paragraph' || extension.name === 'heading'
          ? alignedBlockExtension(extension, () => editorExtensions)
          : extension,
      );
    },
    onBeforeCreate() {
      editorExtensions = this.editor.options.extensions;
    },
  });
}

/** @internal Whether a table can be represented without loss by the GFM table renderer. */
function isLosslessGfmTable(node: JSONContent): boolean {
  const rows = node.content;
  if (!rows?.length) return false;
  const columnCount = rows[0]?.content?.length ?? 0;
  if (columnCount === 0) return false;
  const columnAlignments: Array<unknown> = Array.from({
    length: columnCount,
  });

  return rows.every((row, rowIndex) => {
    const cells = row.type === 'tableRow' ? row.content : undefined;
    if (!cells || cells.length !== columnCount) return false;

    return cells.every((cell, columnIndex) => {
      if (
        (rowIndex === 0 && cell.type !== 'tableHeader') ||
        (rowIndex > 0 && cell.type !== 'tableCell')
      ) {
        return false;
      }
      const attrs = cell.attrs ?? {};
      if (
        (attrs['colspan'] ?? 1) !== 1 ||
        (attrs['rowspan'] ?? 1) !== 1 ||
        attrs['colwidth'] != null
      ) {
        return false;
      }
      const alignment = attrs['align'] ?? null;
      if (
        alignment !== null &&
        alignment !== 'left' &&
        alignment !== 'center' &&
        alignment !== 'right'
      ) {
        return false;
      }
      if (rowIndex === 0) {
        columnAlignments[columnIndex] = alignment;
      } else if (columnAlignments[columnIndex] !== alignment) {
        return false;
      }
      const content = cell.content;
      if (content?.length !== 1 || content[0]?.type !== 'paragraph') {
        return false;
      }
      const paragraphAlignment = content[0].attrs?.['textAlign'];
      return paragraphAlignment == null;
    });
  });
}

/** @internal Builds the same-name TableKit whose table child falls back to complete HTML. */
export function createMarkdownCompatibleTableKit(
  options: Partial<TableKitOptions>,
): AnyExtension {
  let editorExtensions: Extensions = [];
  const base = TableKit.configure(options);

  return base.extend({
    addExtensions() {
      return (this.parent?.() ?? []).map((extension) => {
        if (extension.name !== 'table') return extension;
        const renderParent = parentMarkdownRenderer(extension);
        return extension.extend({
          renderMarkdown(node, helpers, context) {
            return isLosslessGfmTable(node)
              ? (renderParent?.(node, helpers, context) ?? '')
              : renderNodeAsHtml(node, editorExtensions);
          },
        });
      });
    },
    onBeforeCreate() {
      editorExtensions = this.editor.options.extensions;
    },
  });
}
