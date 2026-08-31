import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from '@angular/core';
import { MlvButton } from '@malva-ui/core/button';
import { MlvEditor } from '@malva-ui/editor';
import type { JSONContent } from '@tiptap/core';

const SAMPLE_DOCUMENT: JSONContent = {
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { level: 2, textAlign: 'center' },
      content: [{ type: 'text', text: 'Structured brief' }],
    },
    {
      type: 'paragraph',
      attrs: { textAlign: 'right' },
      content: [
        {
          type: 'text',
          text: 'Highlighted',
          marks: [
            { type: 'highlight', attrs: { color: '#ffee00' } },
            { type: 'bold' },
          ],
        },
        { type: 'text', text: ' keeps its colour as a typed attribute.' },
      ],
    },
  ],
};

/** One top-level node summarised for the structural outline below the editor. */
interface DocsEditorBlockSummary {
  readonly type: string;
  readonly attrs: string;
  readonly text: string;
}

@Component({
  selector: 'docs-editor-json-example',
  imports: [MlvButton, MlvEditor],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class EditorJsonExample {
  readonly value = signal<string | null>(JSON.stringify(SAMPLE_DOCUMENT));

  /** Parsed document; the host renders it structurally instead of injecting HTML. */
  readonly document = computed<JSONContent | null>(() => {
    const json = this.value();
    if (json === null) return null;
    try {
      return JSON.parse(json) as JSONContent;
    } catch {
      return null;
    }
  });

  /** Top-level nodes with the typed attributes JSON preserves. */
  readonly blocks = computed<readonly DocsEditorBlockSummary[]>(() =>
    (this.document()?.content ?? []).map((node) => ({
      type: node.type ?? 'unknown',
      attrs: node.attrs ? JSON.stringify(node.attrs) : '—',
      text: (node.content ?? [])
        .map((child) => child.text ?? `<${child.type ?? 'node'}>`)
        .join(''),
    })),
  );

  /** Indented view of the stored string, which is emitted compact. */
  readonly prettyJson = computed(() => {
    const document = this.document();
    return document === null ? 'null' : JSON.stringify(document, null, 2);
  });

  protected restore(): void {
    this.value.set(JSON.stringify(SAMPLE_DOCUMENT));
  }
}
