import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MlvResizeObserverService } from '@malva-ui/cdk/utils';
import { Subject } from 'rxjs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { stripCssLayersFromText } from '@malva-ui/internal-testing';
import * as sass from 'sass';
import { MlvPage } from './page';
import { MlvPageHeader } from '../page-header/page-header';
import { MlvPageTitle } from '../page-header/page-header.directives';
import { MlvPageSummary } from '../page-summary/page-summary';
import { MlvPageSummaryItem } from '../page-summary/page-summary-item';
import { MlvPageDock } from '../page-dock/page-dock';
import { MlvPageDockEnd } from '../page-dock/page-dock.slots';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';

/** This spec file's own directory; the compiled stylesheets resolve from it. */
const SPEC_DIR = dirname(fileURLToPath(import.meta.url));

/** Whitespace-stripped, matching how the compiled CSS is normalised below. */
function strip(value: string): string {
  return value.replace(/\s+/g, '');
}

/**
 * jsdom lays nothing out, so every measured element reports zero. Each spec
 * fakes the one dimension the coordinator reads and then pushes a resize tick,
 * which is the same path a real layout change takes.
 */
function stubOffsetHeight(element: HTMLElement, height: number): void {
  Object.defineProperty(element, 'offsetHeight', {
    configurable: true,
    value: height,
  });
}

function stubClientHeight(element: HTMLElement, height: number): void {
  Object.defineProperty(element, 'clientHeight', {
    configurable: true,
    value: height,
  });
}

/** Emits the stubbed resize notifications every registered region listens to. */
let resizeEvents: Subject<ResizeObserverEntry[]>;

function configureTestBed(host: unknown): void {
  resizeEvents = new Subject<ResizeObserverEntry[]>();
  TestBed.configureTestingModule({
    imports: [host as never],
    providers: [
      {
        provide: MlvResizeObserverService,
        useValue: { observe: () => resizeEvents.asObservable() },
      },
    ],
  });
}

function readProperty(element: HTMLElement, property: string): string {
  return element.style.getPropertyValue(property);
}

@Component({
  template: `
    <main mlvPage [stickyHeader]="stickyHeader()">
      @if (showHeader()) {
        <mlv-page-header>
          <ng-template mlvPageTitle><h1>Invoice 4821</h1></ng-template>
        </mlv-page-header>
      }
      @if (showSummary()) {
        <mlv-page-summary>
          <div mlvPageSummaryItem label="Owner">Dana R.</div>
        </mlv-page-summary>
      }
      @if (showDock()) {
        <mlv-page-dock [sticky]="dockSticky()">
          <div mlvPageDockEnd><button type="button">Save</button></div>
        </mlv-page-dock>
      }
    </main>
  `,
  imports: [
    MlvPage,
    MlvPageHeader,
    MlvPageTitle,
    MlvPageSummary,
    MlvPageSummaryItem,
    MlvPageDock,
    MlvPageDockEnd,
  ],
})
class GeometryTestHost {
  readonly stickyHeader = signal(true);
  readonly showHeader = signal(true);
  readonly showSummary = signal(false);
  readonly showDock = signal(false);
  readonly dockSticky = signal(true);
}

describe('page geometry contract', () => {
  // Page chrome reads its accessible names from the language pack, and
  // every `MLV_*_I18N` token is a bare `InjectionToken` with no factory.
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideMlvI18nTesting()] });
  });
  afterEach(() => {
    document.documentElement.style.removeProperty(
      '--mlv-viewport-inset-block-end',
    );
    document.documentElement.style.removeProperty('--mlv-page-dock-height');
  });

  it('publishes the measured top chrome on the page host', async () => {
    configureTestBed(GeometryTestHost);
    const fixture = TestBed.createComponent(GeometryTestHost);
    await fixture.whenStable();

    const page = fixture.nativeElement.querySelector('main') as HTMLElement;
    const header = page.querySelector('.mlv-page-header') as HTMLElement;
    stubOffsetHeight(header, 120);
    resizeEvents.next([]);
    await fixture.whenStable();

    expect(readProperty(page, '--mlv-page-chrome-block-size')).toBe('120px');
    expect(readProperty(page, '--mlv-page-sticky-inset-block-start')).toBe(
      '120px',
    );
  });

  it('separates how tall the chrome is from how much it reserves', async () => {
    configureTestBed(GeometryTestHost);
    const fixture = TestBed.createComponent(GeometryTestHost);
    fixture.componentInstance.stickyHeader.set(false);
    await fixture.whenStable();

    const page = fixture.nativeElement.querySelector('main') as HTMLElement;
    stubOffsetHeight(page.querySelector('.mlv-page-header') as HTMLElement, 96);
    resizeEvents.next([]);
    await fixture.whenStable();

    // A header that is not sticky still occupies block size, and owes the
    // scrollport no clearance at all. Publishing one number for both is what
    // made the old single-height reading wrong.
    expect(readProperty(page, '--mlv-page-chrome-block-size')).toBe('96px');
    expect(readProperty(page, '--mlv-page-sticky-inset-block-start')).toBe('');
  });

  it('registers a header rendered later by a conditional', async () => {
    configureTestBed(GeometryTestHost);
    const fixture = TestBed.createComponent(GeometryTestHost);
    fixture.componentInstance.showHeader.set(false);
    await fixture.whenStable();

    const page = fixture.nativeElement.querySelector('main') as HTMLElement;
    expect(readProperty(page, '--mlv-page-chrome-block-size')).toBe('');

    fixture.componentInstance.showHeader.set(true);
    await fixture.whenStable();
    stubOffsetHeight(page.querySelector('.mlv-page-header') as HTMLElement, 80);
    resizeEvents.next([]);
    await fixture.whenStable();

    expect(readProperty(page, '--mlv-page-chrome-block-size')).toBe('80px');
  });

  it('withdraws a region when it is removed again', async () => {
    configureTestBed(GeometryTestHost);
    const fixture = TestBed.createComponent(GeometryTestHost);
    await fixture.whenStable();

    const page = fixture.nativeElement.querySelector('main') as HTMLElement;
    stubOffsetHeight(page.querySelector('.mlv-page-header') as HTMLElement, 64);
    resizeEvents.next([]);
    await fixture.whenStable();
    expect(readProperty(page, '--mlv-page-chrome-block-size')).toBe('64px');

    fixture.componentInstance.showHeader.set(false);
    await fixture.whenStable();
    expect(readProperty(page, '--mlv-page-chrome-block-size')).toBe('');
  });

  it('sums a sibling summary strip alongside the header', async () => {
    configureTestBed(GeometryTestHost);
    const fixture = TestBed.createComponent(GeometryTestHost);
    fixture.componentInstance.showSummary.set(true);
    await fixture.whenStable();

    const page = fixture.nativeElement.querySelector('main') as HTMLElement;
    stubOffsetHeight(page.querySelector('.mlv-page-header') as HTMLElement, 90);
    stubOffsetHeight(
      page.querySelector('.mlv-page-summary') as HTMLElement,
      40,
    );
    resizeEvents.next([]);
    await fixture.whenStable();

    expect(readProperty(page, '--mlv-page-chrome-block-size')).toBe('130px');
    // The strip is never `position: sticky` itself, so only the header's own
    // box is clearance the scrollport owes.
    expect(readProperty(page, '--mlv-page-sticky-inset-block-start')).toBe(
      '90px',
    );
  });

  it('counts a summary projected inside the header only once', async () => {
    @Component({
      template: `
        <main mlvPage>
          <mlv-page-header>
            <ng-template mlvPageTitle><h1>Invoice 4821</h1></ng-template>
            <mlv-page-summary>
              <div mlvPageSummaryItem label="Owner">Dana R.</div>
            </mlv-page-summary>
          </mlv-page-header>
        </main>
      `,
      imports: [
        MlvPage,
        MlvPageHeader,
        MlvPageTitle,
        MlvPageSummary,
        MlvPageSummaryItem,
      ],
    })
    class NestedSummaryHost {}

    configureTestBed(NestedSummaryHost);
    const fixture = TestBed.createComponent(NestedSummaryHost);
    await fixture.whenStable();

    const page = fixture.nativeElement.querySelector('main') as HTMLElement;
    const header = page.querySelector('.mlv-page-header') as HTMLElement;
    const summary = page.querySelector('.mlv-page-summary') as HTMLElement;
    expect(header.contains(summary)).toBe(true);

    // The header's own box already contains the strip; a blind sum of every
    // registered descendant would reserve those 40px twice.
    stubOffsetHeight(header, 130);
    stubOffsetHeight(summary, 40);
    resizeEvents.next([]);
    await fixture.whenStable();

    expect(readProperty(page, '--mlv-page-chrome-block-size')).toBe('130px');
  });

  it('publishes the scrollport size from the element that actually scrolls', async () => {
    configureTestBed(GeometryTestHost);
    const fixture = TestBed.createComponent(GeometryTestHost);
    await fixture.whenStable();

    const page = fixture.nativeElement.querySelector('main') as HTMLElement;
    const viewport = page.querySelector(
      '.mlv-scrollbar__viewport',
    ) as HTMLElement;
    stubClientHeight(viewport, 600);
    resizeEvents.next([]);
    await fixture.whenStable();

    expect(readProperty(page, '--mlv-page-scrollport-block-size')).toBe(
      '600px',
    );
  });

  it('reserves the dock at the block end of the page', async () => {
    configureTestBed(GeometryTestHost);
    const fixture = TestBed.createComponent(GeometryTestHost);
    fixture.componentInstance.showDock.set(true);
    await fixture.whenStable();

    const page = fixture.nativeElement.querySelector('main') as HTMLElement;
    stubOffsetHeight(page.querySelector('.mlv-page-dock') as HTMLElement, 56);
    resizeEvents.next([]);
    await fixture.whenStable();

    expect(readProperty(page, '--mlv-page-dock-block-size')).toBe('56px');
    expect(readProperty(page, '--mlv-page-sticky-inset-block-end')).toBe(
      '56px',
    );

    fixture.componentInstance.dockSticky.set(false);
    await fixture.whenStable();
    // Still occupies block size; no longer pinned, so nothing is reserved.
    expect(readProperty(page, '--mlv-page-dock-block-size')).toBe('56px');
    expect(readProperty(page, '--mlv-page-sticky-inset-block-end')).toBe('');
  });

  it('publishes the viewport inset under both the new and the bridged name', async () => {
    configureTestBed(GeometryTestHost);
    const fixture = TestBed.createComponent(GeometryTestHost);
    fixture.componentInstance.showDock.set(true);
    await fixture.whenStable();

    const dock = fixture.nativeElement.querySelector(
      '.mlv-page-dock',
    ) as HTMLElement;
    stubOffsetHeight(dock, 56);
    resizeEvents.next([]);
    await fixture.whenStable();

    const root = document.documentElement.style;
    expect(root.getPropertyValue('--mlv-viewport-inset-block-end')).toBe(
      '56px',
    );
    // `mlv-toast` reads the old name; both carry the identical value until it
    // is retired.
    expect(root.getPropertyValue('--mlv-page-dock-height')).toBe('56px');

    fixture.destroy();
    expect(root.getPropertyValue('--mlv-viewport-inset-block-end')).toBe('');
    expect(root.getPropertyValue('--mlv-page-dock-height')).toBe('');
  });

  describe('published stylesheet contract', () => {
    // Component styles are not injected under the vitest/jsdom setup, and
    // jsdom resolves neither `var()` nor `calc()`, so the compiled stylesheet
    // is the only observable surface for a declaration whose whole point is
    // the fallback chain inside it.
    function compile(relative: string): string {
      return stripCssLayersFromText(
        sass.compile(join(SPEC_DIR, relative), { style: 'expanded' }).css,
      ).replace(/\s+/g, '');
    }

    const pageCss = compile('page.scss');
    const contentCss = compile('../page-content/page-content.scss');

    it('scrolls focus clear of the measured sticky inset, not a constant', () => {
      // WCAG 2.2 SC 2.4.11, Focus Not Obscured (AA). The header collapses as
      // the page scrolls, so any constant is wrong at every progress but one.
      expect(pageCss).toContain(
        strip(
          'scroll-padding-block-start: var(--mlv-page-header-offset, var(--mlv-page-sticky-inset-block-start));',
        ),
      );
      // The old declaration read a name nothing ever wrote, behind a 6rem
      // guess, and used the physical property.
      expect(pageCss).not.toContain('scroll-padding-top');
      expect(pageCss).not.toContain('--mlv-page-header-offset,6rem');
    });

    it('derives the available block size instead of publishing a fourth number', () => {
      expect(pageCss).toContain(strip('--mlv-page-available-block-size: max('));
      expect(pageCss).toContain(strip('var(--mlv-page-scrollport-block-size)'));
      // Clamped at zero: a negative length makes every `calc()` reading it
      // invalid at computed-value time rather than merely small.
      expect(pageCss).toContain(strip('max(0px,'));
    });

    it('keeps a consumer override ahead of the published aside offset', () => {
      expect(contentCss).toContain(
        strip('inset-block-start: var(--mlv-page-aside-offset,'),
      );
      expect(contentCss).toContain(
        strip('var(--mlv-page-sticky-inset-block-start, 0px)'),
      );
    });
  });
});
