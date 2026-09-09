import { collectTocEntries } from './toc-source.directive';

/** Builds a detached panel element from an HTML fragment. */
function panel(html: string): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = html;
  document.body.appendChild(host);
  return host;
}

/** A heading in the shape the MDX renderer and `docs-page` both emit. */
function heading(level: 2 | 3 | 4, text: string, attrs = ''): string {
  return (
    `<h${level} class="docs-heading" ${attrs}>${text}` +
    `<a class="docs-heading__anchor" href="#stale"></a></h${level}>`
  );
}

describe('collectTocEntries', () => {
  const hosts: HTMLElement[] = [];

  afterEach(() => hosts.splice(0).forEach((host) => host.remove()));

  function mount(html: string): HTMLElement {
    const host = panel(html);
    hosts.push(host);
    return host;
  }

  it('collects the marked headings in document order and slugs their text', () => {
    const host = mount(`
      ${heading(2, 'Nullable HTML value')}
      ${heading(3, 'Reactive form')}
      ${heading(4, 'Deep detail')}
    `);

    expect(collectTocEntries(host)).toEqual([
      { level: 2, text: 'Nullable HTML value', slug: 'nullable-html-value' },
      { level: 3, text: 'Reactive form', slug: 'reactive-form' },
      { level: 4, text: 'Deep detail', slug: 'deep-detail' },
    ]);
  });

  it('prefers an existing id and suffixes colliding slugs', () => {
    const host = mount(`
      ${heading(2, 'Provided', 'id="from-mdx"')}
      ${heading(2, 'Shared title')}
      ${heading(2, 'Shared title')}
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

  // The whole reason the scan is opt-in by class. Before it, the selector was
  // `h2, h3, h4` plus a growing list of exclusions — one for the Tiptap
  // document inside an `mlv-editor` preview on `/editor`, one for
  // `mlv-scheduler`'s range title, which published "31 Aug – 6 Sept 2026" once
  // per example on `/scheduler` — and every future component that renders a
  // heading of its own would have needed another.
  it('ignores a heading a component renders, and never writes an id into it', () => {
    const host = mount(`
      ${heading(2, 'Views and model binding')}
      <div class="example-container__preview">
        <mlv-scheduler><h2 class="mlv-scheduler__title">31 Aug – 6 Sept 2026</h2></mlv-scheduler>
      </div>
      <mlv-editor>
        <div contenteditable="true" class="ProseMirror"><h2>Release notes</h2></div>
      </mlv-editor>
      ${heading(2, 'All-day and multi-day events')}
    `);

    expect(collectTocEntries(host).map((e) => e.text)).toEqual([
      'Views and model binding',
      'All-day and multi-day events',
    ]);
    expect(host.querySelector('.mlv-scheduler__title')?.id).toBe('');
    expect(host.querySelector('[contenteditable] h2')?.id).toBe('');
  });

  it('skips headings with no text', () => {
    const host = mount(`${heading(2, '  ')}${heading(2, 'Kept')}`);

    expect(collectTocEntries(host).map((e) => e.text)).toEqual(['Kept']);
  });

  describe('permalink', () => {
    // `apps/docs` serves a `<base href="/">`, so a relative `#slug` resolves
    // against the base rather than the current URL: the link a reader copies
    // off `/button` used to read `/#variants` and land on the home page.
    it('rewrites the anchor to a path-absolute URL', () => {
      const host = mount(heading(2, 'Variants'));

      collectTocEntries(host);

      const anchor = host.querySelector('.docs-heading__anchor');
      expect(anchor?.getAttribute('href')).toBe(
        `${location.pathname}${location.search}#variants`,
      );
    });

    // The markup cannot know its own slug is the second "Shared title" on the
    // page, so the anchor is finished here or not at all.
    it('follows the slug the collision pass actually assigned', () => {
      const host = mount(
        `${heading(2, 'Shared title')}${heading(2, 'Shared title')}`,
      );

      collectTocEntries(host);

      expect(
        Array.from(
          host.querySelectorAll('.docs-heading__anchor'),
          (a) => a.getAttribute('href')?.split('#')[1],
        ),
      ).toEqual(['shared-title', 'shared-title-2']);
    });

    it('names each permalink after its own heading', () => {
      const host = mount(`${heading(2, 'Variants')}${heading(2, 'Sizes')}`);

      collectTocEntries(host);

      expect(
        Array.from(host.querySelectorAll('.docs-heading__anchor'), (a) =>
          a.getAttribute('aria-label'),
        ),
      ).toEqual(['Link to Variants', 'Link to Sizes']);
    });

    // The shipped anchor is empty — its glyph is a CSS mask — but it is a link
    // inside the heading, so anything it ever spells out (a visually-hidden
    // label, say) would otherwise land in both the ToC entry and the slug.
    it('keeps a permalink label out of the heading text and slug', () => {
      const host = mount(
        '<h2 class="docs-heading">Variants' +
          '<a class="docs-heading__anchor" href="#stale">Permalink</a></h2>',
      );

      expect(collectTocEntries(host)).toEqual([
        { level: 2, text: 'Variants', slug: 'variants' },
      ]);
    });
  });
});
