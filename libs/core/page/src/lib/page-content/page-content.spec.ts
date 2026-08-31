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
 * back through the cascade — specificity regressions between the aside,
 * placement and stacked modifiers fail here rather than only in a browser.
 */
const COMPILED_CSS = sass.compile(join(CONTENT_DIR, 'page-content.scss'), {
  style: 'expanded',
}).css;

@Component({
  template: `
    <mlv-page-content
      [asidePlacement]="asidePlacement()"
      asideWidth="18rem"
      [stackBelow]="stackBelow()"
      asideLabel="Project navigation"
    >
      <article>Main content</article>
      <ng-template mlvPageAside><nav>Sections</nav></ng-template>
    </mlv-page-content>
  `,
  imports: [MlvPageContent, MlvPageAside],
})
class PageContentTestHost {
  readonly stackBelow = signal(900);
  readonly asidePlacement = signal<'start' | 'end'>('start');
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

  it('renders a labelled complementary landmark', async () => {
    const fixture = createHost(PageContentTestHost);
    await fixture.whenStable();

    const content = fixture.nativeElement.querySelector('mlv-page-content');
    const aside = content.querySelector('aside');
    expect(content.classList).toContain('mlv-page-content--aside-start');
    expect(content.style.getPropertyValue('--mlv-page-aside-width')).toBe(
      '18rem',
    );
    expect(aside.getAttribute('aria-label')).toBe('Project navigation');
    expect(aside.textContent).toContain('Sections');
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
    fixture.componentInstance.asidePlacement.set('end');
    await fixture.whenStable();

    const content: HTMLElement =
      fixture.nativeElement.querySelector('mlv-page-content');
    expect(content.classList).toContain('mlv-page-content--has-aside');
    expect(tracks(content)).toBe(
      'minmax(0, 1fr) minmax(0, var(--mlv-page-aside-width, 20rem))',
    );
    expect(areas(content)).toBe('"main aside"');
  });

  it('keeps the aside track first for aside-start placement', async () => {
    const fixture = createHost(PageContentTestHost);
    await fixture.whenStable();

    const content: HTMLElement =
      fixture.nativeElement.querySelector('mlv-page-content');
    expect(content.classList).toContain('mlv-page-content--aside-start');
    expect(tracks(content)).toBe(
      'minmax(0, var(--mlv-page-aside-width, 20rem)) minmax(0, 1fr)',
    );
    expect(areas(content)).toBe('"aside main"');
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
    fixture.componentInstance.asidePlacement.set('end');
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

  it('keeps aside-start stacked order and a single track when stacked', async () => {
    const fixture = createHost(PageContentTestHost);
    await fixture.whenStable();

    resized.next([
      { contentRect: { width: 720 } } as unknown as ResizeObserverEntry,
    ]);
    fixture.detectChanges();

    const content: HTMLElement =
      fixture.nativeElement.querySelector('mlv-page-content');
    expect(tracks(content)).toBe('minmax(0, 1fr)');
    expect(areas(content)).toBe('"aside" "main"');
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
});
