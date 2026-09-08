import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as sass from 'sass';
import { MlvPageSnapController } from '../page/page-snap-controller';
import { MlvPageSummary } from '../page-summary/page-summary';
import { MlvPageSummaryItem } from '../page-summary/page-summary-item';
import {
  MlvPageBreadcrumb,
  MlvPageHeaderActions,
  MlvPageHeaderDescription,
  MlvPageHeaderMeta,
  MlvPageHeaderStatus,
  MlvPageHeaderTabsActions,
  MlvPageHeaderTabs,
  MlvPageTitle,
} from './page-header.directives';
import { MlvPageHeader } from './page-header';

@Component({ template: '' })
class EmptyRouteComponent {}

const HEADER_DIR = dirname(fileURLToPath(import.meta.url));

/**
 * The snap behaviours live in `page.scss`, not in the header stylesheet, and
 * the focus reveal only works if its rule out-cascades the `--hide` rule that
 * declares the same custom property. The test compiler injects neither, so the
 * real compiled CSS is attached to the document and read back through the
 * cascade — a reordering or specificity regression fails here instead of only
 * in a browser.
 */
const PAGE_CSS = sass.compile(join(HEADER_DIR, '../page/page.scss'), {
  style: 'expanded',
}).css;

@Component({
  template: `
    <mlv-page-header back="/projects" (backClick)="backClicks = backClicks + 1">
      <ng-template mlvPageBreadcrumb><span>Workspace</span></ng-template>
      <ng-template mlvPageTitle><h1>Project Atlas</h1></ng-template>
      <ng-template mlvPageHeaderActions
        ><button type="button">Share</button></ng-template
      >
      <ng-template mlvPageHeaderDescription><p>Description</p></ng-template>
      <ng-template mlvPageHeaderMeta><span>Updated today</span></ng-template>
      <ng-template mlvPageHeaderTabs><span>Overview</span></ng-template>
      <ng-template mlvPageHeaderTabsActions
        ><button type="button">Filter</button></ng-template
      >
    </mlv-page-header>
  `,
  imports: [
    MlvPageHeader,
    MlvPageBreadcrumb,
    MlvPageTitle,
    MlvPageHeaderActions,
    MlvPageHeaderDescription,
    MlvPageHeaderMeta,
    MlvPageHeaderTabs,
    MlvPageHeaderTabsActions,
  ],
})
class PageHeaderTestHost {
  backClicks = 0;
}

describe('MlvPageHeader', () => {
  it('renders structured slots in a predictable hierarchy', async () => {
    const fixture = TestBed.configureTestingModule({
      imports: [PageHeaderTestHost],
      providers: [
        provideRouter([{ path: 'projects', component: EmptyRouteComponent }]),
      ],
    }).createComponent(PageHeaderTestHost);
    await fixture.whenStable();

    const header = fixture.nativeElement.querySelector('mlv-page-header');
    expect(header.querySelector('h1')?.textContent).toBe('Project Atlas');
    expect(
      header.querySelector('.mlv-page-header__breadcrumb')?.textContent,
    ).toContain('Workspace');
    expect(
      header.querySelector('.mlv-page-header__description')?.textContent,
    ).toContain('Description');
    expect(
      header.querySelector('.mlv-page-header__meta')?.textContent,
    ).toContain('Updated today');
    expect(
      header.querySelector('.mlv-page-header__tabs-row')?.textContent,
    ).toContain('Overview');
  });

  it('emits when the back link is activated', async () => {
    const fixture = TestBed.configureTestingModule({
      imports: [PageHeaderTestHost],
      providers: [
        provideRouter([{ path: 'projects', component: EmptyRouteComponent }]),
      ],
    }).createComponent(PageHeaderTestHost);
    await fixture.whenStable();

    const back = fixture.nativeElement.querySelector(
      '.mlv-page-header__back',
    ) as HTMLAnchorElement;
    back.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.backClicks).toBe(1);
  });

  it('renders the compact size, status slot, and centered tabs', async () => {
    @Component({
      template: `
        <mlv-page-header size="s" tabsAlign="center">
          <ng-template mlvPageTitle><h1>Wireless Headphones</h1></ng-template>
          <ng-template mlvPageHeaderStatus><span>Draft</span></ng-template>
          <ng-template mlvPageHeaderTabs><span>Details</span></ng-template>
        </mlv-page-header>
      `,
      imports: [
        MlvPageHeader,
        MlvPageTitle,
        MlvPageHeaderStatus,
        MlvPageHeaderTabs,
      ],
    })
    class CompactHeaderTestHost {}

    const fixture = TestBed.configureTestingModule({
      imports: [CompactHeaderTestHost],
    }).createComponent(CompactHeaderTestHost);
    await fixture.whenStable();

    const header = fixture.nativeElement.querySelector(
      '.mlv-page-header',
    ) as HTMLElement;
    expect(header.classList).toContain('mlv-page-header--size-s');
    expect(header.classList).toContain('mlv-page-header--tabs-center');
    expect(
      header.querySelector('.mlv-page-header__status')?.textContent,
    ).toContain('Draft');
  });

  it('marks itself scrolled once the chrome sits over content', async () => {
    @Component({
      template: `
        <mlv-page-header>
          <ng-template mlvPageTitle><h1>Scrolled page</h1></ng-template>
        </mlv-page-header>
      `,
      imports: [MlvPageHeader, MlvPageTitle],
    })
    class ScrolledHeaderTestHost {}

    TestBed.configureTestingModule({
      imports: [ScrolledHeaderTestHost],
      providers: [MlvPageSnapController],
    });
    const controller = TestBed.inject(MlvPageSnapController);
    const fixture = TestBed.createComponent(ScrolledHeaderTestHost);
    await fixture.whenStable();

    const header = fixture.nativeElement.querySelector(
      '.mlv-page-header',
    ) as HTMLElement;
    expect(header.classList).not.toContain('mlv-page-header--scrolled');

    // Overlap, not collapse: a snap range wide enough that 64px of scroll is
    // barely any progress still puts the header over content.
    controller.updateFromScroll(64, 2000);
    await fixture.whenStable();
    expect(controller.snapped()).toBe(false);
    expect(header.classList).toContain('mlv-page-header--scrolled');
  });

  it('shows the expand chevron only while snapped, and expanding returns to the top', async () => {
    @Component({
      template: `
        <mlv-page-header snapControls>
          <ng-template mlvPageTitle><h1>Record</h1></ng-template>
        </mlv-page-header>
      `,
      imports: [MlvPageHeader, MlvPageTitle],
    })
    class SnapControlsTestHost {}

    TestBed.configureTestingModule({
      imports: [SnapControlsTestHost],
      providers: [MlvPageSnapController],
    });
    const controller = TestBed.inject(MlvPageSnapController);
    const fixture = TestBed.createComponent(SnapControlsTestHost);
    await fixture.whenStable();

    const chevron = (): HTMLButtonElement | null =>
      fixture.nativeElement.querySelector('.mlv-page-header__expand');

    // Expanded chrome has nothing to expand, so the control is not a tab stop.
    expect(chevron()).toBeNull();

    controller.updateFromScroll(96, 96);
    await fixture.whenStable();
    const button = chevron();
    expect(button).toBeTruthy();
    expect(button?.getAttribute('aria-label')).toBe('Expand header');

    // Nothing registered a scroller, so the reveal closes on its own fallback
    // rather than on a scroll that never arrives.
    button?.click();
    await fixture.whenStable();
    expect(controller.revealing()).toBe(true);
  });

  it('projects a summary strip as the chrome bottom row inside the header', async () => {
    @Component({
      template: `
        <mlv-page-header>
          <ng-template mlvPageTitle><h1>Record</h1></ng-template>
          <mlv-page-summary summaryLabel="Facts">
            <mlv-page-summary-item label="Price">329</mlv-page-summary-item>
          </mlv-page-summary>
        </mlv-page-header>
      `,
      imports: [
        MlvPageHeader,
        MlvPageTitle,
        MlvPageSummary,
        MlvPageSummaryItem,
      ],
    })
    class ProjectedSummaryTestHost {}

    const fixture = TestBed.configureTestingModule({
      imports: [ProjectedSummaryTestHost],
    }).createComponent(ProjectedSummaryTestHost);
    await fixture.whenStable();

    const header = fixture.nativeElement.querySelector(
      '.mlv-page-header',
    ) as HTMLElement;
    const summary = header.querySelector('.mlv-page-summary');
    expect(summary).toBeTruthy();
    expect(
      summary?.querySelector('.mlv-page-summary-item__label')?.textContent,
    ).toBe('Price');
  });

  it('renders no snap controls outside a page snap context', async () => {
    @Component({
      template: `
        <mlv-page-header snapControls>
          <ng-template mlvPageTitle><h1>Standalone</h1></ng-template>
        </mlv-page-header>
      `,
      imports: [MlvPageHeader, MlvPageTitle],
    })
    class StandaloneTestHost {}

    const fixture = TestBed.configureTestingModule({
      imports: [StandaloneTestHost],
    }).createComponent(StandaloneTestHost);
    await fixture.whenStable();

    expect(
      fixture.nativeElement.querySelector('.mlv-page-header__expand'),
    ).toBeNull();
  });
  describe('scrubbed tabs row and keyboard focus', () => {
    @Component({
      template: `
        <mlv-page-header>
          <ng-template mlvPageTitle><h1>Record</h1></ng-template>
          <ng-template mlvPageHeaderTabs>
            <button type="button" class="test-tab">Overview</button>
          </ng-template>
        </mlv-page-header>
      `,
      imports: [MlvPageHeader, MlvPageTitle, MlvPageHeaderTabs],
    })
    class SnapFocusTestHost {}

    /** Progress 1 — past the tabs row's own `snapTo` of 0.85. */
    const FULLY_SNAPPED = 96;

    let styleEl: HTMLStyleElement;
    let outsideButton: HTMLButtonElement;

    beforeAll(() => {
      styleEl = document.createElement('style');
      styleEl.textContent = PAGE_CSS;
      document.head.appendChild(styleEl);
    });

    afterAll(() => {
      styleEl.remove();
    });

    beforeEach(() => {
      // A focus target outside the header, so "focus left the region" is a
      // real focus move rather than a blur into nothing.
      outsideButton = document.createElement('button');
      outsideButton.type = 'button';
      document.body.appendChild(outsideButton);
    });

    afterEach(() => {
      outsideButton.remove();
    });

    async function createSnapFocusHost() {
      TestBed.configureTestingModule({
        imports: [SnapFocusTestHost],
        providers: [MlvPageSnapController],
      });
      const controller = TestBed.inject(MlvPageSnapController);
      const fixture = TestBed.createComponent(SnapFocusTestHost);
      await fixture.whenStable();
      const tabsRow = fixture.nativeElement.querySelector(
        '.mlv-page-header__tabs-row',
      ) as HTMLElement;
      const tab = fixture.nativeElement.querySelector(
        '.test-tab',
      ) as HTMLButtonElement;
      return { controller, fixture, tabsRow, tab };
    }

    it('takes the elapsed tabs row out of the tab order while nothing in it has focus', async () => {
      const { controller, fixture, tabsRow } = await createSnapFocusHost();
      expect(tabsRow.style.visibility).toBe('');
      expect(tabsRow.classList).not.toContain('mlv-page-snap--revealed');

      controller.updateFromScroll(FULLY_SNAPPED, 96);
      await fixture.whenStable();

      // Hidden from view *and* from the tab order — never an invisible tab stop.
      expect(controller.progress()).toBe(1);
      expect(tabsRow.style.visibility).toBe('hidden');
      expect(tabsRow.classList).not.toContain('mlv-page-snap--revealed');
      expect(
        getComputedStyle(tabsRow).getPropertyValue('--mlv-snap-progress'),
      ).not.toBe('0');
    });

    it('keeps a focused tabs row visible and focused when the scroll scrubs it away', async () => {
      const { controller, fixture, tabsRow, tab } = await createSnapFocusHost();
      tab.focus();
      expect(document.activeElement).toBe(tab);

      controller.updateFromScroll(FULLY_SNAPPED, 96);
      await fixture.whenStable();

      // Scrolling must never relocate focus to <body>.
      expect(controller.progress()).toBe(1);
      expect(document.activeElement).toBe(tab);
      expect(tabsRow.style.visibility).toBe('');
      expect(tabsRow.classList).toContain('mlv-page-snap--revealed');
      // The reveal is a real visual reveal, not a focusable-but-invisible row.
      expect(
        getComputedStyle(tabsRow).getPropertyValue('--mlv-snap-progress'),
      ).toBe('0');
    });

    it('re-hides the scrubbed row as soon as focus leaves it', async () => {
      const { controller, fixture, tabsRow, tab } = await createSnapFocusHost();
      tab.focus();
      controller.updateFromScroll(FULLY_SNAPPED, 96);
      await fixture.whenStable();
      expect(tabsRow.style.visibility).toBe('');

      outsideButton.focus();
      await fixture.whenStable();

      expect(document.activeElement).toBe(outsideButton);
      expect(tabsRow.style.visibility).toBe('hidden');
      expect(tabsRow.classList).not.toContain('mlv-page-snap--revealed');
    });

    it('keeps the reveal while focus moves between controls inside the row', async () => {
      const { controller, fixture, tabsRow, tab } = await createSnapFocusHost();
      const second = document.createElement('button');
      second.type = 'button';
      tabsRow.appendChild(second);

      tab.focus();
      controller.updateFromScroll(FULLY_SNAPPED, 96);
      await fixture.whenStable();

      // focusout fires for an in-region move too; the reveal must survive it.
      second.focus();
      await fixture.whenStable();

      expect(document.activeElement).toBe(second);
      expect(tabsRow.style.visibility).toBe('');
      expect(tabsRow.classList).toContain('mlv-page-snap--revealed');
    });

    it('reveals the collapsed row on expand() so a consumer focus() lands', async () => {
      const { controller, fixture, tabsRow, tab } = await createSnapFocusHost();
      controller.updateFromScroll(FULLY_SNAPPED, 96);
      await fixture.whenStable();
      expect(tabsRow.style.visibility).toBe('hidden');

      // Synchronously focusable again — host bindings have not flushed yet.
      controller.expand();
      expect(tabsRow.style.visibility).toBe('');

      tab.focus();
      expect(document.activeElement).toBe(tab);

      await fixture.whenStable();
      expect(tabsRow.style.visibility).toBe('');
      // The page is what knows how to scroll; with a scroller registered the
      // reveal closes when the scroll *arrives*, not on a timer of its own.
      controller.registerScroller(() => controller.updateFromScroll(0, 96));
      controller.expand();
      await vi.waitFor(() => expect(controller.progress()).toBe(0));
      await fixture.whenStable();
      expect(controller.revealing()).toBe(false);
      expect(tabsRow.style.visibility).toBe('');
    });

    it('re-hides an unfocused row when the expand scroll never arrives', async () => {
      const { controller, fixture, tabsRow } = await createSnapFocusHost();
      controller.updateFromScroll(FULLY_SNAPPED, 96);
      await fixture.whenStable();

      // Nothing registers a scroller, so `expand()` asks for a scroll that
      // never happens. The fallback must still close the reveal: a bridge left
      // open strands the row visible-but-scrubbed — an invisible tab stop.
      controller.expand();
      expect(controller.revealing()).toBe(true);
      expect(tabsRow.style.visibility).toBe('');

      await vi.waitFor(() => expect(controller.revealing()).toBe(false), {
        timeout: 2000,
      });
      await fixture.whenStable();
      expect(controller.progress()).toBe(1);
      expect(tabsRow.style.visibility).toBe('hidden');
    });
  });
});
