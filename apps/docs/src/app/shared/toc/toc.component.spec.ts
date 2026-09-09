import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TestBed } from '@angular/core/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { DocsTableOfContentsComponent } from './toc.component';
import type { TocEntry } from './toc.types';

// `@nx/vitest:test` runs with cwd = workspace root, so source paths are
// resolved from this file rather than from `process.cwd()`.
const HERE = dirname(fileURLToPath(import.meta.url));
const TOC_SCSS = resolve(HERE, './toc.component.scss');
const GLOBAL_SCSS = resolve(HERE, '../../../styles.scss');

const ENTRIES: TocEntry[] = [
  { level: 2, text: 'Alpha', slug: 'alpha' },
  { level: 3, text: 'Beta', slug: 'beta' },
];

/** The fixed docs action bar, whose height every anchor has to clear. */
const ACTION_BAR_HEIGHT_PX = 72;

describe('DocsTableOfContentsComponent', () => {
  it('renders the published headings', async () => {
    const fixture = TestBed.createComponent(DocsTableOfContentsComponent);
    fixture.componentRef.setInput('entries', ENTRIES);
    fixture.detectChanges();
    await fixture.whenStable();

    const links = (fixture.nativeElement as HTMLElement).querySelectorAll(
      '.docs-toc__link',
    );
    expect(Array.from(links, (a) => a.textContent?.trim())).toEqual([
      'Alpha',
      'Beta',
    ]);
  });

  it('has no axe violations', async () => {
    const fixture = TestBed.createComponent(DocsTableOfContentsComponent);
    fixture.componentRef.setInput('entries', ENTRIES);
    fixture.detectChanges();
    await fixture.whenStable();

    await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
  });

  // The regression this pins: the host used to take `docs-toc--hidden`
  // (`display: none`) whenever `entries` was empty, which is the whole window
  // between a navigation landing and the new panel's heading scan settling.
  // `.docs-shell__main-area` is a flex row, so that dropped the 14rem column
  // *and* the row's 1.5rem gap and moved the reading column by 248px, then
  // moved it back — measured 932px → 1180px → 932px on every navigation to an
  // uncached route.
  it('keeps its column in the flow while it has nothing to show', async () => {
    const fixture = TestBed.createComponent(DocsTableOfContentsComponent);
    fixture.componentRef.setInput('entries', []);
    fixture.detectChanges();
    await fixture.whenStable();

    const host = fixture.nativeElement as HTMLElement;

    // Empty, but still a box: only the content is conditional.
    expect(host.querySelector('.docs-toc__nav')).toBeNull();
    expect(host.className.split(/\s+/).filter(Boolean)).toEqual(['docs-toc']);
  });

  it('collapses the column only at the static narrow tier, never on state', () => {
    const scss = readFileSync(TOC_SCSS, 'utf8');

    // A `display: none` anywhere but inside the width query would be a
    // state-driven collapse again, whatever it is keyed on.
    const collapses = scss.match(/display:\s*none/g) ?? [];
    expect(collapses).toHaveLength(1);

    const query = scss.slice(scss.indexOf('@media (max-width: 1200px)'));
    expect(query).toMatch(/display:\s*none/);

    // The reserved width is what makes the gutter shell geometry.
    expect(scss).toMatch(/^\s*width:\s*14rem;$/m);
  });

  describe('heading anchors', () => {
    const mounted: HTMLElement[] = [];

    /** Mounts a heading the component can resolve by id, with a spied scroller. */
    function mountHeading(id: string, tag = 'h2'): HTMLElement {
      const el = document.createElement(tag);
      el.id = id;
      el.textContent = id;
      el.scrollIntoView = vi.fn();
      document.body.appendChild(el);
      mounted.push(el);
      return el;
    }

    /** Publishes `entries`, which is what makes the component read the URL. */
    async function publish(
      fixture: ReturnType<typeof TestBed.createComponent>,
      entries: TocEntry[],
    ): Promise<void> {
      fixture.componentRef.setInput('entries', entries);
      fixture.detectChanges();
      await fixture.whenStable();
    }

    afterEach(() => {
      mounted.splice(0).forEach((el) => el.remove());
      history.replaceState(history.state, '', location.pathname);
    });

    it('puts the clicked heading on the URL without a navigation', async () => {
      const fixture = TestBed.createComponent(DocsTableOfContentsComponent);
      await publish(fixture, ENTRIES);
      const heading = mountHeading('beta');
      const pushState = vi.spyOn(history, 'pushState');

      fixture.componentInstance.scrollTo('beta', new Event('click'));

      expect(location.hash).toBe('#beta');
      expect(heading.scrollIntoView).toHaveBeenCalled();
      // `replaceState`, not the router and not a history entry per heading:
      // a router navigation emits `NavigationEnd`, and the shell's handler
      // would scroll straight back to the top of the page.
      expect(pushState).not.toHaveBeenCalled();
      pushState.mockRestore();
    });

    it('scrolls to the heading a URL arrived with, once the panel publishes', async () => {
      const heading = mountHeading('beta');
      history.replaceState(history.state, '', '#beta');

      const fixture = TestBed.createComponent(DocsTableOfContentsComponent);
      await publish(fixture, ENTRIES);

      expect(heading.scrollIntoView).toHaveBeenCalled();
      expect(fixture.componentInstance.activeSlug()).toBe('beta');
    });

    // The example permalink addresses the wrapper (`#example-2`), which is not
    // a heading and never appears in `entries` — so the target is resolved by
    // id, not against the entry list.
    it('honours a fragment that is not one of its own entries', async () => {
      const wrapper = mountHeading('example-2', 'div');
      history.replaceState(history.state, '', '#example-2');

      const fixture = TestBed.createComponent(DocsTableOfContentsComponent);
      await publish(fixture, ENTRIES);

      expect(wrapper.scrollIntoView).toHaveBeenCalled();
    });

    it('honours a fragment once, not on every republish', async () => {
      const heading = mountHeading('beta');
      history.replaceState(history.state, '', '#beta');

      const fixture = TestBed.createComponent(DocsTableOfContentsComponent);
      await publish(fixture, ENTRIES);
      expect(heading.scrollIntoView).toHaveBeenCalledTimes(1);

      // A tab switch republishes the same headings. Re-honouring the fragment
      // here would yank the reader back up the page every time.
      await publish(fixture, [...ENTRIES]);
      expect(heading.scrollIntoView).toHaveBeenCalledTimes(1);
    });

    it('leaves a fragment naming nothing unconsumed', async () => {
      history.replaceState(history.state, '', '#late');

      const fixture = TestBed.createComponent(DocsTableOfContentsComponent);
      await publish(fixture, ENTRIES);

      // The element arrives with the next publish; the fragment still applies.
      const late = mountHeading('late');
      await publish(fixture, [
        ...ENTRIES,
        { level: 2, text: 'Late', slug: 'late' },
      ]);

      expect(late.scrollIntoView).toHaveBeenCalled();
    });
  });

  it('scrolls anchors clear of the fixed action bar', () => {
    const scss = readFileSync(GLOBAL_SCSS, 'utf8');

    // Without this the `scrollIntoView` behind a ToC click lands the heading at
    // y ≈ 0 — 71px underneath the bar, so the heading the reader asked for is
    // the one thing they cannot see.
    const match = scss.match(
      /html\s*\{[^}]*scroll-padding-top:\s*([\d.]+)rem;/,
    );
    expect(match).not.toBeNull();
    expect(Number(match?.[1]) * 16).toBeGreaterThanOrEqual(
      ACTION_BAR_HEIGHT_PX,
    );
  });
});
