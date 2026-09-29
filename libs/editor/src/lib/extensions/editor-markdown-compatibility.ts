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
import type { TagParseRule } from '@tiptap/pm/model';
import StarterKit, { type StarterKitOptions } from '@tiptap/starter-kit';
import {
  paintsBackground,
  skipSpansOwnedByOtherMarks,
  storedStyleSpanRules,
} from './text-style/editor-text-style-parsing';

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

/**
 * @internal Attributes Markdown never carries: block IDs and derived heading
 * anchors. Markdown drops them everywhere else, so the whole-node HTML
 * fallback drops them too; a reload reassigns IDs and re-derives anchors.
 */
const MARKDOWN_DROPPED_ATTRIBUTES: readonly string[] = ['blockId', 'anchor'];

/** @internal Copies a JSON node without the attributes Markdown never carries. */
function withoutMarkdownDroppedAttributes(node: JSONContent): JSONContent {
  const copy: JSONContent = { ...node };
  if (node.attrs) {
    const attrs = { ...node.attrs };
    for (const name of MARKDOWN_DROPPED_ATTRIBUTES) delete attrs[name];
    copy.attrs = attrs;
  }
  if (node.content) {
    copy.content = node.content.map(withoutMarkdownDroppedAttributes);
  }
  return copy;
}

/** @internal Emits a complete node as HTML rather than embedding Markdown inside an HTML fragment. */
function renderNodeAsHtml(node: JSONContent, extensions: Extensions): string {
  return generateHTML(
    {
      type: 'doc',
      content: [withoutMarkdownDroppedAttributes(node)],
    },
    extensions,
  );
}

/**
 * @internal `textStyle` attributes Markdown writes, in the fixed order they
 * appear in the one `<span style>`. The order is part of the output, so a
 * round trip is byte-stable.
 */
const MARKDOWN_TEXT_STYLE_PROPERTIES: readonly (readonly [string, string])[] = [
  ['color', 'color'],
  ['fontFamily', 'font-family'],
  ['fontSize', 'font-size'],
];

/**
 * @internal Builds the same-name TextStyle mark used by Malva's default preset:
 * colour, font family and font size are written as one inline `<span style>`,
 * each value escaped, which `@tiptap/markdown` parses back as inline HTML.
 * A span whose style only another mark owns (a highlight's
 * `background-color`, a script mark's `vertical-align`) creates no text
 * style.
 */
export function createMarkdownCompatibleTextStyle(): AnyExtension {
  return TextStyle.configure({}).extend({
    priority: 98,
    parseHTML() {
      const rules = (this.parent?.() ?? []) as readonly TagParseRule[];
      return [
        ...storedStyleSpanRules(this.editor),
        ...rules.map(skipSpansOwnedByOtherMarks),
      ];
    },
    renderMarkdown(node, helpers) {
      const children = helpers.renderChildren(node);
      const declarations = MARKDOWN_TEXT_STYLE_PROPERTIES.flatMap(
        ([attribute, property]) => {
          const value = node.attrs?.[attribute];
          return typeof value === 'string' && value.length > 0
            ? [`${property}: ${escapeAttribute(value)}`]
            : [];
        },
      );
      if (declarations.length === 0) return children;
      return `<span style="${declarations.join('; ')}">${children}</span>`;
    },
  });
}

/** @internal Builds the color-aware same-name Highlight mark used by Malva's default preset. */
export function createMarkdownCompatibleHighlight(): AnyExtension {
  const base = Highlight.configure({ multicolor: true });
  const renderParent = parentMarkdownRenderer(base);

  return base.extend({
    priority: 99,
    /**
     * `<mark>`, and a span carrying a `background-color` that paints — the
     * form Docs and Word paste. A span whose background paints nothing
     * (`transparent`, a CSS-wide keyword, alpha 0; see `paintsBackground`) is
     * no highlight: Google Docs declares `transparent` on every run it copies.
     * The span rule does not consume, so the same span's colour, font family
     * and font size still reach `textStyle`, and a span with both colour and
     * background keeps both marks.
     */
    parseHTML() {
      return [
        { tag: 'mark' },
        {
          tag: 'span[style*="background-color"]',
          consuming: false,
          getAttrs: (element) =>
            paintsBackground(element.style.backgroundColor) ? null : false,
        },
      ];
    },
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

/**
 * @internal Extends one block child with a renderer that falls back to
 * whole-node HTML when the block carries an alignment or a line height, which
 * Markdown cannot express; the attribute travels in that HTML.
 */
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
        alignment !== 'justify' &&
        !node.attrs?.['lineHeight']
      ) {
        return renderParent?.(node, helpers, context) ?? '';
      }
      return renderNodeAsHtml(node, activeExtensions());
    },
  });
}

/** @internal Builds the same-name StarterKit whose block children preserve explicit alignment and line height. */
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
