import { collectTocEntries } from './toc-source.directive';

/** Builds a detached panel element from an HTML fragment. */
function panel(html: string): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = html;
  return host;
}

describe('collectTocEntries', () => {
  it('collects h2–h4 in document order and slugs their text', () => {
    const host = panel(`
      <h2>Nullable HTML value</h2>
      <h3>Reactive form</h3>
      <h4>Deep detail</h4>
    `);

    expect(collectTocEntries(host)).toEqual([
      { level: 2, text: 'Nullable HTML value', slug: 'nullable-html-value' },
      { level: 3, text: 'Reactive form', slug: 'reactive-form' },
      { level: 4, text: 'Deep detail', slug: 'deep-detail' },
    ]);
  });

  it('prefers an existing id and suffixes colliding slugs', () => {
    const host = panel(`
      <h2 id="from-mdx">Provided</h2>
      <h2>Shared title</h2>
      <h2>Shared title</h2>
    `);

    const entries = collectTocEntries(host);

    expect(entries.map((e) => e.slug)).toEqual([
      'from-mdx',
      'shared-title',
      'shared-title-2',
    ]);
    expect(Array.from(host.querySelectorAll('h2')).map((el) => el.id)).toEqual([
      'from-mdx',
      'shared-title',
      'shared-title-2',
    ]);
  });

  it('skips headings inside an editable region and leaves their ids untouched', () => {
    // The `/editor` page renders live `mlv-editor` previews whose Tiptap
    // document contains its own headings. They are user content, not page
    // structure — and writing an id into ProseMirror-managed DOM makes the
    // editor revert it on its next DOM flush.
    const host = panel(`
      <h2>Nullable HTML value</h2>
      <mlv-editor>
        <div contenteditable="true" class="ProseMirror">
          <h2>Release notes</h2>
        </div>
      </mlv-editor>
      <h2>Markdown mode</h2>
    `);

    const entries = collectTocEntries(host);

    expect(entries.map((e) => e.text)).toEqual([
      'Nullable HTML value',
      'Markdown mode',
    ]);
    expect(host.querySelector('[contenteditable] h2')?.id).toBe('');
  });

  it('skips headings inside a non-editable (readonly) editor region', () => {
    const host = panel(`
      <div contenteditable="false" class="ProseMirror">
        <h3>Readonly document heading</h3>
      </div>
      <h2>Real page heading</h2>
    `);

    expect(collectTocEntries(host).map((e) => e.text)).toEqual([
      'Real page heading',
    ]);
  });

  it('skips headings with no text', () => {
    const host = panel(`<h2>  </h2><h2>Kept</h2>`);

    expect(collectTocEntries(host).map((e) => e.text)).toEqual(['Kept']);
  });
});
