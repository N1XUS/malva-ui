import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from '@angular/core';
import { MlvEditor } from '@malva-ui/editor';
import type { JSONContent } from '@tiptap/core';

/**
 * HTML carrying every text style: a serif span, a size, a block line height,
 * subscript, superscript, inline code, and bold italic text beside a link for
 * Clear formatting to act on.
 */
const STYLED_HTML = [
  '<h2>Typography sample</h2>',
  '<p style="line-height: 2">This paragraph has a line height of 2. ',
  '<span style="font-family: ui-serif, Georgia, \'Times New Roman\', serif">',
  'This sentence uses the serif stack</span>, and ',
  '<span style="font-size: 20px">this one is 20 pixels</span>.</p>',
  '<p>Water is H<sub>2</sub>O and energy is E = mc<sup>2</sup>. ',
  'Run <code>yarn nx test editor</code> to check.</p>',
  '<p><strong><em>Select this bold italic text</em></strong> and press ',
  'Clear formatting: the <a href="https://tiptap.dev">link</a> stays.</p>',
].join('');

/** A stored document: every block already carries the ID it was saved with. */
const SAMPLE_DOCUMENT: JSONContent = {
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { level: 2, blockId: 'h8k2m4q1za' },
      content: [{ type: 'text', text: 'Release notes' }],
    },
    {
      type: 'paragraph',
      attrs: { blockId: 'p3n7x0c5vb' },
      content: [
        {
          type: 'text',
          text: 'Press Enter to add a block and watch it get an ID.',
        },
      ],
    },
    {
      type: 'heading',
      attrs: { level: 3, blockId: 'h1r9t6w2yd' },
      content: [{ type: 'text', text: 'Getting started' }],
    },
    {
      type: 'heading',
      attrs: { level: 3, blockId: 'h5e4u8i3oa' },
      content: [{ type: 'text', text: 'Getting started' }],
    },
  ],
};

/** One top-level block as the JSON pane lists it. */
interface DocsEditorBlockId {
  readonly type: string;
  readonly blockId: unknown;
  readonly text: string;
}

/** Plain text of a JSON node, for the outline. */
const textOf = (node: JSONContent): string =>
  node.text ?? (node.content ?? []).map(textOf).join('');

@Component({
  selector: 'docs-editor-text-styles-example',
  imports: [MlvEditor],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class EditorTextStylesExample {
  /** HTML value of the text-styles editor. */
  readonly styles = signal<string | null>(STYLED_HTML);

  /** JSON value of the block-ID draft, shared with the readonly preview. */
  readonly value = signal<string | null>(JSON.stringify(SAMPLE_DOCUMENT));

  /** Top-level blocks with their IDs, as indented JSON. */
  readonly outline = computed(() => {
    const json = this.value();
    if (json === null) return '[]';
    try {
      const document = JSON.parse(json) as JSONContent;
      const blocks: DocsEditorBlockId[] = (document.content ?? []).map(
        (node) => ({
          type: node.type ?? 'unknown',
          blockId: node.attrs?.['blockId'] ?? null,
          text: textOf(node),
        }),
      );
      return JSON.stringify(blocks, null, 2);
    } catch {
      return '[]';
    }
  });
}
