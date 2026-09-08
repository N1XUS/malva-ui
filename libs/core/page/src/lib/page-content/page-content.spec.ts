import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as sass from 'sass';
import { Subject } from 'rxjs';
import { MlvResizeObserverService } from '@malva-ui/cdk/utils';
import { MlvPageAside } from './page-aside';
import { MlvPageContent } from './page-content';

const CONTENT_DIR = dirname(fileURLToPath(import.meta.url));

/**
 * The component stylesheet is not injected by the test compiler, so the real
 * compiled CSS is attached to the document and the grid tracks are then read
 * back through the cascade — specificity regressions between the aside and
 * stacked modifiers fail here rather than only in a browser.
 */
const COMPILED_CSS = sass.compile(join(CONTENT_DIR, 'page-content.scss'), {
  style: 'expanded',
}).css;

@Component({
  template: `
    <mlv-page-content asideWidth="18rem" [stackBelow]="stackBelow()">
      <article>Main content</article>
      <aside mlvPageAside aria-label="Project navigation">
        <nav>Sections</nav>
      </aside>
    </mlv-page-content>
  `,
  imports: [MlvPageContent, MlvPageAside],
})
class PageContentTestHost {
  readonly stackBelow = signal(900);
}

@Component({
  template: `
    <mlv-page-content [stackBelow]="stackBelow()">
      <article>Main content</article>
    </mlv-page-content>
  `,
  imports: [MlvPageContent],
})
class PageContentNoAsideHost {
  readonly stackBelow = signal(900);
}

/** Collapses authoring whitespace so multi-line track lists compare cleanly. */
function tracks(element: HTMLElement): string {
  return getComputedStyle(element)
    .gridTemplateColumns.replace(/\s+/g, ' ')
    .trim();
}

/** Collapses authoring whitespace in the resolved `grid-template-areas` value. */
function areas(element: HTMLElement): string {
  return getComputedStyle(element)
    .gridTemplateAreas.replace(/\s+/g, ' ')
    .trim();
}

describe('MlvPageContent', () => {
  const resized = new Subject<ResizeObserverEntry[]>();
  let styleEl: HTMLStyleElement;

  beforeAll(() => {
    styleEl = document.createElement('style');
    styleEl.textContent = COMPILED_CSS;
    document.head.appendChild(styleEl);
  });

  afterAll(() => {
    styleEl.remove();
  });

  function createHost<T>(type: new (...args: never[]) => T) {
    return TestBed.configureTestingModule({
      imports: [type],
      providers: [
        {
          provide: MlvResizeObserverService,
          useValue: { observe: () => resized.asObservable() },
        },
      ],
    }).createComponent(type);
  }

  beforeEach(() => {
    resized.next([]);
  });

  it('renders the consumer own labelled complementary landmark', async () => {
    const fixture = createHost(PageContentTestHost);
    await fixture.whenStable();

    const content = fixture.nativeElement.querySelector('mlv-page-content');
    const aside = content.querySelector('aside') as HTMLElement;

    // The landmark, its role and its name are all the consumer's own element —
    // the component contributes the grid area and nothing else. That is what
    // makes `aria-labelledby`, a `<section>` inside it, or any other landmark
    // decision expressible without a new input here.
    expect(aside.classList).toContain('mlv-page-content__aside');
    expect(aside.getAttribute('data-slot')).toBe('page-aside');
    expect(aside.getAttribute('aria-label')).toBe('Project navigation');
    expect(aside.textContent).toContain('Sections');
    expect(content.style.getPropertyValue('--mlv-page-aside-width')).toBe(
      '18rem',
    );
  });

  it('keeps the aside after the main column in the DOM', async () => {
    const fixture = createHost(PageContentTestHost);
    await fixture.whenStable();

    const content: HTMLElement =
      fixture.nativeElement.querySelector('mlv-page-content');
    const main = content.querySelector(
      '.mlv-page-content__main',
    ) as HTMLElement;
    const aside = content.querySelector('aside') as HTMLElement;

    // There is no placement input any more. A `start` placement moved the
    // column visually while leaving it after the main content in the DOM, so
    // reading order and focus order disagreed with the rendered page — and
    // neither `order` nor `grid-template-areas` can fix that, because
    // assistive technology and sequential focus follow the DOM.
    expect(
      main.compareDocumentPosition(aside) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(areas(content)).toBe('"main aside"');
  });

  it('stacks from the measured container width', async () => {
    const fixture = createHost(PageContentTestHost);
    await fixture.whenStable();

    resized.next([
      { contentRect: { width: 720 } } as unknown as ResizeObserverEntry,
    ]);
    fixture.detectChanges();

    const content = fixture.nativeElement.querySelector('mlv-page-content');
    expect(content.classList).toContain('mlv-page-content--stacked');
  });

  it('reserves the complementary track only while an aside is projected', async () => {
    const fixture = createHost(PageContentTestHost);
    await fixture.whenStable();

    const content: HTMLElement =
      fixture.nativeElement.querySelector('mlv-page-content');
    expect(content.classList).toContain('mlv-page-content--has-aside');
    expect(tracks(content)).toBe(
      'minmax(0, 1fr) minmax(0, var(--mlv-page-aside-width, 20rem))',
    );
    expect(areas(content)).toBe('"main aside"');
  });

  it('collapses to a single track when no aside is projected', async () => {
    const fixture = createHost(PageContentNoAsideHost);
    await fixture.whenStable();

    const content: HTMLElement =
      fixture.nativeElement.querySelector('mlv-page-content');
    expect(content.querySelector('aside')).toBeNull();
    expect(content.classList).not.toContain('mlv-page-content--has-aside');
    expect(tracks(content)).toBe('minmax(0, 1fr)');
    expect(areas(content)).toBe('"main"');
  });

  it('stacks the aside into a second row at the stacked breakpoint', async () => {
    const fixture = createHost(PageContentTestHost);
    await fixture.whenStable();

    resized.next([
      { contentRect: { width: 720 } } as unknown as ResizeObserverEntry,
    ]);
    fixture.detectChanges();

    const content: HTMLElement =
      fixture.nativeElement.querySelector('mlv-page-content');
    expect(content.classList).toContain('mlv-page-content--stacked');
    expect(content.classList).toContain('mlv-page-content--has-aside');
    expect(tracks(content)).toBe('minmax(0, 1fr)');
    expect(areas(content)).toBe('"main" "aside"');
  });

  it('stays a single track without an aside at the stacked breakpoint', async () => {
    const fixture = createHost(PageContentNoAsideHost);
    await fixture.whenStable();

    resized.next([
      { contentRect: { width: 720 } } as unknown as ResizeObserverEntry,
    ]);
    fixture.detectChanges();

    const content: HTMLElement =
      fixture.nativeElement.querySelector('mlv-page-content');
    expect(content.classList).toContain('mlv-page-content--stacked');
    expect(tracks(content)).toBe('minmax(0, 1fr)');
    expect(areas(content)).toBe('"main"');
  });

  describe('landmark warnings', () => {
    let warn: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    });

    afterEach(() => {
      warn.mockRestore();
    });

    it('says so when the region is not on a landmark element', async () => {
      @Component({
        template: `
          <mlv-page-content>
            <article>Main content</article>
            <div mlvPageAside aria-label="Related">Related</div>
          </mlv-page-content>
        `,
        imports: [MlvPageContent, MlvPageAside],
      })
      class DivAsideHost {}

      const fixture = createHost(DivAsideHost);
      await fixture.whenStable();

      // Warned from the region itself: a parent cannot introspect a projected
      // element to tell an author what is wrong with it, and by the time it
      // could the markup is somewhere else in the file.
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('complementary landmark'),
      );
    });

    it('says so when the landmark has no accessible name', async () => {
      @Component({
        template: `
          <mlv-page-content>
            <article>Main content</article>
            <aside mlvPageAside>Related</aside>
          </mlv-page-content>
        `,
        imports: [MlvPageContent, MlvPageAside],
      })
      class UnnamedAsideHost {}

      const fixture = createHost(UnnamedAsideHost);
      await fixture.whenStable();

      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('accessible name'),
      );
    });

    it('stays quiet for a named landmark', async () => {
      const fixture = createHost(PageContentTestHost);
      await fixture.whenStable();

      expect(warn).not.toHaveBeenCalled();
    });
  });
});
