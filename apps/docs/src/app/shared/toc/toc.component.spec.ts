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
