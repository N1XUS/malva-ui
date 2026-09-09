import { Component, Directive, inject, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MlvResizeObserverFactory } from '@malva-ui/cdk/utils';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as sass from 'sass';
import { MlvPageSnapController } from '../page/page-snap-controller';
import { MlvPageSummary } from '../page-summary/page-summary';
import { MlvPageSummaryItem } from '../page-summary/page-summary-item';
import { MLV_PAGE_HEADER_STATE } from './page-header-state';
import type { MlvPageHeaderState } from './page-header-state';
import {
  MlvPageActions,
  MlvPageContext,
  MlvPageDescription,
  MlvPageMeta,
  MlvPageStatus,
  MlvPageTabs,
  MlvPageTitle,
} from './page-header.directives';
import { MlvPageHeader } from './page-header';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';

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

/**
 * The header's own stylesheet, for the one contract jsdom cannot answer: it
 * resolves no `var()`, so every type role here computes to `''` and a
 * `getComputedStyle` comparison between the node and its projected heading
 * would pass whatever the rule said.
 */
const HEADER_CSS = sass.compile(join(HEADER_DIR, 'page-header.scss'), {
  style: 'expanded',
}).css;

@Component({
  template: `
    <mlv-page-header>
      <div mlvPageContext><span>Workspace</span></div>
      <ng-template mlvPageTitle><h1>Project Atlas</h1></ng-template>
      <div mlvPageActions><button type="button">Share</button></div>
      <p mlvPageDescription id="host-description" class="host-owned">
        Description
      </p>
      <div mlvPageMeta><span>Updated today</span></div>
      <div mlvPageTabs>
        <span>Overview</span>
        <button type="button">Filter</button>
      </div>
    </mlv-page-header>
  `,
  imports: [
    MlvPageHeader,
    MlvPageContext,
    MlvPageTitle,
    MlvPageActions,
    MlvPageDescription,
    MlvPageMeta,
    MlvPageTabs,
  ],
})
class PageHeaderTestHost {}

describe('MlvPageHeader', () => {
  // Page chrome reads its accessible names from the language pack, and
  // every `MLV_*_I18N` token is a bare `InjectionToken` with no factory.
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideMlvI18nTesting()] });
  });
  it('renders every projected region in a predictable hierarchy', async () => {
    const fixture = TestBed.configureTestingModule({
      imports: [PageHeaderTestHost],
    }).createComponent(PageHeaderTestHost);
    await fixture.whenStable();

    const header = fixture.nativeElement.querySelector('mlv-page-header');
    expect(header.querySelector('h1')?.textContent).toBe('Project Atlas');
    expect(
      header.querySelector('.mlv-page-header__context')?.textContent,
    ).toContain('Workspace');
    expect(
      header.querySelector('.mlv-page-header__description')?.textContent,
    ).toContain('Description');
    expect(
      header.querySelector('.mlv-page-header__meta')?.textContent,
    ).toContain('Updated today');

    // One tabs region, not a strip plus a trailing action slot: whatever the
    // consumer puts after the tab group sits at the trailing edge of the same
    // flex row.
    const tabs = header.querySelector('.mlv-page-header__tabs') as HTMLElement;
    expect(tabs.textContent).toContain('Overview');
    expect(tabs.querySelector('button')?.textContent).toContain('Filter');
  });

  it('projects the consumer own element, not a wrapper around it', async () => {
    const fixture = TestBed.configureTestingModule({
      imports: [PageHeaderTestHost],
    }).createComponent(PageHeaderTestHost);
    await fixture.whenStable();

    // The whole point of an element region over a template slot: the node in
    // the DOM is the one the consumer wrote, so their tag, id and class are on
    // the same element the library styles — selectable and stylable without
    // piercing encapsulation.
    const description = fixture.nativeElement.querySelector(
      '.mlv-page-header__description',
    ) as HTMLElement;
    expect(description.tagName).toBe('P');
    expect(description.id).toBe('host-description');
    expect(description.classList).toContain('host-owned');
  });

  it('renders the compact size, status region, and centered tabs', async () => {
    @Component({
      template: `
        <mlv-page-header size="s" tabsAlign="center">
          <ng-template mlvPageTitle><h1>Wireless Headphones</h1></ng-template>
          <span mlvPageStatus>Draft</span>
          <div mlvPageTabs><span>Details</span></div>
        </mlv-page-header>
      `,
      imports: [MlvPageHeader, MlvPageTitle, MlvPageStatus, MlvPageTabs],
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

  it('names every structural part with a data-slot handle', async () => {
    const fixture = TestBed.configureTestingModule({
      imports: [PageHeaderTestHost],
    }).createComponent(PageHeaderTestHost);
    await fixture.whenStable();

    // A test, a screenshot diff and a consumer override all need a handle that
    // is not a BEM class, because a BEM class is also the styling surface: it
    // cannot be renamed without breaking overrides, and it cannot be queried
    // without coupling the query to the visual API.
    const slots = [
      ...fixture.nativeElement.querySelectorAll('[data-slot]'),
    ].map((element: Element) => element.getAttribute('data-slot'));
    expect(slots).toEqual(
      expect.arrayContaining([
        'page-header',
        'page-context',
        'page-actions',
        'page-description',
        'page-meta',
        'page-tabs',
      ]),
    );
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

    // Overlap, not collapse: a collapse distance wide enough that 64px of
    // scroll is barely any progress still puts the header over content.
    controller.registerCollapse(signal(2000));
    controller.updateFromScroll(64);
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

    controller.registerCollapse(signal(96));
    controller.updateFromScroll(96);
    await fixture.whenStable();
    const button = chevron();
    expect(button).toBeTruthy();
    expect(button?.getAttribute('aria-label')).toBe('Expand header');
    // The default is the language pack's, not an English literal in the
    // component — so a localized application gets a localized control.
    expect(button?.getAttribute('data-slot')).toBe('page-header-expand');

    // Nothing registered a scroller, so the reveal closes on its own fallback
    // rather than on a scroll that never arrives.
    button?.click();
    await fixture.whenStable();
    expect(controller.revealing()).toBe(true);
  });

  it('lets the consumer override the packaged chevron label', async () => {
    @Component({
      template: `
        <mlv-page-header snapControls expandLabel="Show the full header">
          <ng-template mlvPageTitle><h1>Record</h1></ng-template>
        </mlv-page-header>
      `,
      imports: [MlvPageHeader, MlvPageTitle],
    })
    class LabelledSnapControlsTestHost {}

    TestBed.configureTestingModule({
      imports: [LabelledSnapControlsTestHost],
      providers: [MlvPageSnapController],
    });
    const controller = TestBed.inject(MlvPageSnapController);
    const fixture = TestBed.createComponent(LabelledSnapControlsTestHost);
    controller.registerCollapse(signal(96));
    controller.updateFromScroll(96);
    await fixture.whenStable();

    expect(
      fixture.nativeElement
        .querySelector('.mlv-page-header__expand')
        ?.getAttribute('aria-label'),
    ).toBe('Show the full header');
  });

  it('projects a summary strip as the chrome bottom row inside the header', async () => {
    @Component({
      template: `
        <mlv-page-header>
          <ng-template mlvPageTitle><h1>Record</h1></ng-template>
          <mlv-page-summary summaryLabel="Facts">
            <div mlvPageSummaryItem label="Price">329</div>
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

  describe('responsive withholding', () => {
    @Component({
      template: `
        <mlv-page-header>
          <ng-template mlvPageTitle><h1>Record</h1></ng-template>
          <div mlvPageMeta hideOn="narrow"><span>Updated today</span></div>
          <div mlvPageTabs><span>Overview</span></div>
        </mlv-page-header>
      `,
      imports: [MlvPageHeader, MlvPageTitle, MlvPageMeta, MlvPageTabs],
    })
    class HideOnTestHost {}

    it('serialises the decision onto the region as an attribute', async () => {
      const fixture = TestBed.configureTestingModule({
        imports: [HideOnTestHost],
      }).createComponent(HideOnTestHost);
      await fixture.whenStable();

      // The whole mechanism: an attribute one container query reads. No
      // breakpoint signal, no resize listener, nothing to be wrong about on
      // the server — and a region that declares nothing emits no attribute at
      // all rather than a `data-hide-on="null"` for a stylesheet to trip over.
      const meta = fixture.nativeElement.querySelector(
        '.mlv-page-header__meta',
      ) as HTMLElement;
      const tabs = fixture.nativeElement.querySelector(
        '.mlv-page-header__tabs',
      ) as HTMLElement;
      expect(meta.getAttribute('data-hide-on')).toBe('narrow');
      expect(tabs.hasAttribute('data-hide-on')).toBe(false);
    });

    it('is resolved against the page canvas, in one place', () => {
      // Both halves of the contract are asserted on the compiled stylesheet
      // rather than in jsdom, which resolves no container query: the canvas is
      // a *named* container so a nested scroller cannot answer for it, and the
      // two rules use range syntax so neither width is matched by both.
      expect(PAGE_CSS).toContain('container-name: mlv-page');
      expect(PAGE_CSS).toContain('@container mlv-page (width <= 40rem)');
      expect(PAGE_CSS).toContain('@container mlv-page (width > 40rem)');
      expect(PAGE_CSS).toContain('[data-hide-on=narrow]');
      expect(PAGE_CSS).toContain('[data-hide-on=wide]');
    });
  });

  describe('collapse state is readable without wiring', () => {
    /** A projected region reading the collapse the way a consumer would. */
    @Directive({ selector: '[mlvTestStateProbe]' })
    class StateProbe {
      readonly state = inject<MlvPageHeaderState>(MLV_PAGE_HEADER_STATE);
    }

    @Component({
      template: `
        <mlv-page-header #header="mlvPageHeader">
          <ng-template mlvPageTitle><h1>Record</h1></ng-template>
          <div mlvPageMeta mlvTestStateProbe><span>Updated today</span></div>
        </mlv-page-header>
        <!-- Outside the header: the template reference is the point, and the
             header projects only the regions it declares slots for. -->
        <span class="test-readout">{{ header.collapsed() }}</span>
      `,
      imports: [MlvPageHeader, MlvPageTitle, MlvPageMeta, StateProbe],
    })
    class HeaderStateTestHost {}

    it('publishes the collapse to a projected region and to a template ref', async () => {
      TestBed.configureTestingModule({
        imports: [HeaderStateTestHost],
        providers: [MlvPageSnapController],
      });
      const controller = TestBed.inject(MlvPageSnapController);
      const fixture = TestBed.createComponent(HeaderStateTestHost);
      await fixture.whenStable();

      const probe = fixture.debugElement
        .query((node) => !!node.injector.get(StateProbe, null))
        .injector.get(StateProbe);
      const readout = (): string =>
        (
          fixture.nativeElement.querySelector('.test-readout') as HTMLElement
        ).textContent?.trim() ?? '';

      expect(probe.state.collapsed()).toBe(false);
      expect(probe.state.progress()).toBe(0);
      expect(readout()).toBe('false');

      controller.registerCollapse(signal(96));
      controller.updateFromScroll(96);
      await fixture.whenStable();

      // Same three signals, two ways in, no output to forward and no state
      // mirrored into the consumer's component.
      expect(probe.state.collapsed()).toBe(true);
      expect(probe.state.progress()).toBe(1);
      expect(readout()).toBe('true');
    });
  });

  describe('title clipping is reported, never acted on', () => {
    /** Stand-in for the platform observer; jsdom implements none. */
    class FakeResizeObserver implements ResizeObserver {
      static instances: FakeResizeObserver[] = [];

      readonly targets = new Set<Element>();

      constructor(private readonly _callback: ResizeObserverCallback) {
        FakeResizeObserver.instances.push(this);
      }

      observe(target: Element): void {
        this.targets.add(target);
      }

      unobserve(target: Element): void {
        this.targets.delete(target);
      }

      disconnect(): void {
        this.targets.clear();
      }

      /** Delivers a batch the way the platform would. */
      emit(): void {
        this._callback(
          [...this.targets].map(
            (target) => ({ target }) as ResizeObserverEntry,
          ),
          this,
        );
      }
    }

    @Component({
      template: `
        <mlv-page-header #header="mlvPageHeader">
          <ng-template mlvPageTitle
            ><h1>A very long record title</h1></ng-template
          >
        </mlv-page-header>
      `,
      imports: [MlvPageHeader, MlvPageTitle],
    })
    class ClippedTitleTestHost {}

    beforeEach(() => {
      FakeResizeObserver.instances = [];
    });

    /** Fakes layout for one node: jsdom reports every box as zero-sized. */
    function setInlineOverflow(
      element: HTMLElement,
      scrollWidth: number,
      clientWidth: number,
    ): void {
      Object.defineProperty(element, 'scrollWidth', {
        configurable: true,
        value: scrollWidth,
      });
      Object.defineProperty(element, 'clientWidth', {
        configurable: true,
        value: clientWidth,
      });
    }

    it('follows whichever title role is currently on screen', async () => {
      TestBed.configureTestingModule({
        imports: [ClippedTitleTestHost],
        providers: [
          MlvPageSnapController,
          {
            provide: MlvResizeObserverFactory,
            useValue: {
              create: (callback: ResizeObserverCallback) =>
                new FakeResizeObserver(callback),
            },
          },
        ],
      });
      const controller = TestBed.inject(MlvPageSnapController);
      const fixture = TestBed.createComponent(ClippedTitleTestHost);
      await fixture.whenStable();

      const header = fixture.debugElement
        .query((node) => !!node.injector.get(MlvPageHeader, null))
        .injector.get(MlvPageHeader);
      const [large, small] = [
        ...fixture.nativeElement.querySelectorAll(
          '.mlv-page-header__title-node',
        ),
      ] as HTMLElement[];

      expect(header.titleClipped()).toBe(false);

      // Only the expanded role overflows. The smaller role is the whole point
      // of the crossfade: a title that does not fit at h4 may well fit at h6.
      setInlineOverflow(large, 480, 240);
      setInlineOverflow(small, 200, 240);
      for (const observer of FakeResizeObserver.instances) {
        observer.emit();
      }
      await fixture.whenStable();
      expect(header.titleClipped()).toBe(true);

      controller.registerCollapse(signal(96));
      controller.updateFromScroll(96);
      await fixture.whenStable();

      // Reported, not fixed: the header changes nothing about the title, it
      // only stops claiming the hidden role's overflow as the visible one's.
      expect(header.collapsed()).toBe(true);
      expect(header.titleClipped()).toBe(false);
      expect(large.style.textOverflow).toBe('');
    });
  });

  describe('scrubbed meta row and keyboard focus', () => {
    // The *title block* collapses and the navigation stays, so the scrubbed
    // region under test is the meta row — the tabs row is deliberately not one.
    @Component({
      template: `
        <mlv-page-header>
          <ng-template mlvPageTitle><h1>Record</h1></ng-template>
          <div mlvPageMeta>
            <button type="button" class="test-tab">Owner</button>
          </div>
        </mlv-page-header>
      `,
      imports: [MlvPageHeader, MlvPageTitle, MlvPageMeta],
    })
    class SnapFocusTestHost {}

    /** Progress 1 — past the meta row's own `snapTo` of 0.75. */
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
      // The timeline is exactly as long as the chrome measured itself giving
      // up, and jsdom lays nothing out, so the spec supplies the measurement
      // the tabs row would have contributed in a browser.
      controller.registerCollapse(signal(FULLY_SNAPPED));
      const fixture = TestBed.createComponent(SnapFocusTestHost);
      await fixture.whenStable();
      const tabsRow = fixture.nativeElement.querySelector(
        '.mlv-page-header__meta',
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

      controller.updateFromScroll(FULLY_SNAPPED);
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

      controller.updateFromScroll(FULLY_SNAPPED);
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
      controller.updateFromScroll(FULLY_SNAPPED);
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
      controller.updateFromScroll(FULLY_SNAPPED);
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
      controller.updateFromScroll(FULLY_SNAPPED);
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
      controller.registerScroller(() => controller.updateFromScroll(0));
      controller.expand();
      await vi.waitFor(() => expect(controller.progress()).toBe(0));
      await fixture.whenStable();
      expect(controller.revealing()).toBe(false);
      expect(tabsRow.style.visibility).toBe('');
    });

    it('re-hides an unfocused row when the expand scroll never arrives', async () => {
      const { controller, fixture, tabsRow } = await createSnapFocusHost();
      controller.updateFromScroll(FULLY_SNAPPED);
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

  describe('two titles, exactly one exposed', () => {
    @Component({
      template: `
        <mlv-page-header>
          <ng-template mlvPageTitle><h1>Quarterly report</h1></ng-template>
          <div mlvPageMeta><span>Updated today</span></div>
          <div mlvPageTabs>
            <button type="button" class="test-tab">Overview</button>
          </div>
        </mlv-page-header>
      `,
      imports: [MlvPageHeader, MlvPageTitle, MlvPageMeta, MlvPageTabs],
    })
    class TwoTitleTestHost {}

    async function createTwoTitleHost() {
      TestBed.configureTestingModule({
        imports: [TwoTitleTestHost],
        providers: [MlvPageSnapController],
      });
      const controller = TestBed.inject(MlvPageSnapController);
      controller.registerCollapse(signal(96));
      const fixture = TestBed.createComponent(TwoTitleTestHost);
      await fixture.whenStable();
      const nodes = fixture.nativeElement.querySelectorAll(
        '.mlv-page-header__title-node',
      ) as NodeListOf<HTMLElement>;
      return { controller, fixture, nodes };
    }

    // A bare `<h1>` is what every consumer in this repo projects — six
    // showcases and the `/page` examples — and the UA gives it
    // `font-size: 2em`, so it rendered the node's role at double size:
    // measured on `/page`'s record editor, `size="s"` asks for a 20px title
    // and got 40px, wrapping to three lines and taking 165px of a 538px header
    // on a 390px canvas. That defeats `size`, and the collapse with it, since
    // the crossfade's clipped cell is sized from these two nodes.
    it('makes a projected heading adopt the node type role', async () => {
      const { nodes } = await createTwoTitleHost();

      expect(nodes[0].querySelector('h1')).not.toBeNull();
      expect(HEADER_CSS).toMatch(
        /\.mlv-page-header__title-node :is\(h1, h2, h3, h4, h5, h6\) \{[^}]*font-size: inherit;/,
      );
      // Weight, leading and tracking travel with the size — a role is all four
      // or it is a size change wearing the UA's other three.
      for (const property of [
        'font-weight: inherit',
        'line-height: inherit',
        'letter-spacing: inherit',
      ]) {
        expect(HEADER_CSS).toContain(property);
      }
    });

    it('renders both type roles and exposes exactly one at a time', async () => {
      const { controller, fixture, nodes } = await createTwoTitleHost();

      // Both nodes exist — that is what makes the collapse a crossfade rather
      // than an interpolated font size, and what makes both roles measurable.
      expect(nodes.length).toBe(2);
      expect(nodes[0].textContent).toContain('Quarterly report');
      expect(nodes[1].textContent).toContain('Quarterly report');

      // An opacity-zero heading is still announced on the web, so the
      // semantics switch hard rather than following the fade.
      expect(nodes[0].getAttribute('aria-hidden')).toBeNull();
      expect(nodes[0].hasAttribute('inert')).toBe(false);
      expect(nodes[1].getAttribute('aria-hidden')).toBe('true');
      expect(nodes[1].hasAttribute('inert')).toBe(true);

      controller.updateFromScroll(96);
      await fixture.whenStable();

      expect(nodes[0].getAttribute('aria-hidden')).toBe('true');
      expect(nodes[0].hasAttribute('inert')).toBe(true);
      expect(nodes[1].getAttribute('aria-hidden')).toBeNull();
      expect(nodes[1].hasAttribute('inert')).toBe(false);
    });

    it('has no axe violations expanded or snapped', async () => {
      const { controller, fixture } = await createTwoTitleHost();
      const root = fixture.nativeElement as HTMLElement;

      await expectNoAxeViolations(root);

      // The snapped state is the header's defining state and the one where the
      // markup actually changes — a duplicated heading, an inert subtree, and
      // a control that only exists here.
      controller.updateFromScroll(96);
      await fixture.whenStable();
      await expectNoAxeViolations(root);
    });

    it('focuses whichever title role is live, never the inert copy', async () => {
      const { controller, fixture, nodes } = await createTwoTitleHost();
      const header = fixture.debugElement.query(By.directive(MlvPageHeader))
        .componentInstance as MlvPageHeader;

      expect(header.focusTitle()).toBe(true);
      expect(document.activeElement).toBe(nodes[0]);

      controller.updateFromScroll(96);
      await fixture.whenStable();

      // A route handler that had queried the DOM itself would still be holding
      // the first copy, which is now `inert` and silently refuses focus.
      expect(header.focusTitle()).toBe(true);
      expect(document.activeElement).toBe(nodes[1]);
    });

    it('says so when the projected title carries an id of its own', async () => {
      const warn = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => undefined);
      try {
        @Component({
          template: `
            <mlv-page-header>
              <ng-template mlvPageTitle>
                <h1 id="page-title">Quarterly report</h1>
              </ng-template>
            </mlv-page-header>
          `,
          imports: [MlvPageHeader, MlvPageTitle],
        })
        class IdentifiedTitleTestHost {}

        TestBed.configureTestingModule({ imports: [IdentifiedTitleTestHost] });
        const fixture = TestBed.createComponent(IdentifiedTitleTestHost);
        await fixture.whenStable();

        // The id is in the document twice, so `getElementById` answers with
        // the copy that is inert half the time. That is a defect a consumer
        // cannot see from their own template.
        expect(
          fixture.nativeElement.querySelectorAll('#page-title'),
        ).toHaveLength(2);
        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls[0][0]).toContain('page-title');
        expect(warn.mock.calls[0][0]).toContain('focusTitle()');
      } finally {
        warn.mockRestore();
      }
    });

    it('stays quiet when the title only carries generated ids', async () => {
      const warn = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => undefined);
      try {
        const { fixture } = await createTwoTitleHost();
        expect(fixture.nativeElement).toBeTruthy();
        expect(warn).not.toHaveBeenCalled();
      } finally {
        warn.mockRestore();
      }
    });
  });
});
