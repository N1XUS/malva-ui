import { Component, inject, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ScrollDispatcher } from '@angular/cdk/scrolling';
import { MlvPageGeometry } from './page-geometry';
import { MlvPageSnapController } from './page-snap-controller';
import { MlvScrollbar } from '@malva-ui/core/scrollbar';
import { MlvPage } from './page';
import { MlvPageScroller } from './page-scroller';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';

@Component({
  template: `
    <main
      mlvPage
      id="project-page"
      padding="l"
      scroll="content"
      surface="flat"
      maxWidth="72rem"
      [stickyHeader]="false"
    >
      <p class="content">Page content</p>
    </main>
  `,
  imports: [MlvPage],
})
class PageTestHost {}

describe('MlvPage', () => {
  // Page chrome reads its accessible names from the language pack, and
  // every `MLV_*_I18N` token is a bare `InjectionToken` with no factory.
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideMlvI18nTesting()] });
  });
  it('configures the native main landmark as the page surface', async () => {
    const fixture = TestBed.configureTestingModule({
      imports: [PageTestHost],
    }).createComponent(PageTestHost);
    await fixture.whenStable();

    const page = fixture.nativeElement.querySelector('main') as HTMLElement;
    expect(page.id).toBe('project-page');
    expect(page.getAttribute('tabindex')).toBe('-1');
    expect(page.classList).toContain('mlv-page--padding-l');
    expect(page.classList).toContain('mlv-page--scroll-content');
    expect(page.classList).toContain('mlv-page--surface-flat');
    expect(page.classList).not.toContain('mlv-page--sticky-header');
    expect(page.style.getPropertyValue('--mlv-page-max-width')).toBe('72rem');
    expect(page.querySelector('.content')?.textContent).toContain(
      'Page content',
    );

    // `scroll="content"` renders no scrollbar at all. It used to render one and
    // disable it, which left a live component with its full observer set, a
    // scroll listener that could never fire and a permanently zero scroll
    // offset feeding the geometry contract.
    expect(page.querySelector('.mlv-page__scrollbar')).toBeNull();
    expect(page.querySelector('.mlv-scrollbar')).toBeNull();
    expect(
      (page.querySelector('.mlv-page__inner') as HTMLElement).parentElement,
    ).toBe(page);
  });

  it('publishes its scroll offset through the geometry it provides', async () => {
    @Component({
      selector: 'mlv-test-scroll-consumer',
      template: '',
    })
    class ScrollConsumerComponent {
      readonly pageScroll = inject(MlvPageGeometry);
    }

    @Component({
      template: ` <main mlvPage><mlv-test-scroll-consumer /></main> `,
      imports: [MlvPage, ScrollConsumerComponent],
    })
    class ScrollContextTestHost {}

    const fixture = TestBed.configureTestingModule({
      imports: [ScrollContextTestHost],
    }).createComponent(ScrollContextTestHost);
    await fixture.whenStable();

    const consumer = fixture.debugElement.children[0].query(
      (el) => el.name === 'mlv-test-scroll-consumer',
    );
    const pageScroll = (consumer.componentInstance as ScrollConsumerComponent)
      .pageScroll;
    expect(pageScroll.scrollTop()).toBe(0);

    const viewport = fixture.nativeElement.querySelector(
      '.mlv-scrollbar__viewport',
    ) as HTMLElement;
    viewport.scrollTop = 100;
    viewport.dispatchEvent(new Event('scroll'));
    await fixture.whenStable();
    expect(pageScroll.scrollTop()).toBe(100);

    viewport.scrollTop = 0;
    viewport.dispatchEvent(new Event('scroll'));
    await fixture.whenStable();
    expect(pageScroll.scrollTop()).toBe(0);
  });

  it('registers its viewport with the CDK so overlays inside the page reposition', async () => {
    @Component({
      template: `<main mlvPage><p>Body</p></main>`,
      imports: [MlvPage],
    })
    class ScrollDispatcherTestHost {}

    const fixture = TestBed.configureTestingModule({
      imports: [ScrollDispatcherTestHost],
    }).createComponent(ScrollDispatcherTestHost);
    await fixture.whenStable();

    const dispatcher = TestBed.inject(ScrollDispatcher);
    const viewport = fixture.nativeElement.querySelector(
      '.mlv-scrollbar__viewport',
    ) as HTMLElement;

    // The page owns a scrollport that is not the document. Without this
    // registration a CDK overlay anchored inside the page never learns that
    // the page scrolled, so `reposition` and `close` strategies never fire.
    const ancestors = dispatcher.getAncestorScrollContainers(
      fixture.nativeElement.querySelector('p') as HTMLElement,
    );
    expect(
      ancestors.some((s) => s.getElementRef().nativeElement === viewport),
    ).toBe(true);

    const scrolled: unknown[] = [];
    const subscription = dispatcher.scrolled(0).subscribe((s) => {
      scrolled.push(s);
    });
    viewport.dispatchEvent(new Event('scroll'));
    await fixture.whenStable();
    subscription.unsubscribe();
    expect(scrolled.length).toBeGreaterThan(0);

    fixture.destroy();
    expect(
      dispatcher
        .getAncestorScrollContainers(viewport)
        .some((s) => s.getElementRef().nativeElement === viewport),
    ).toBe(false);
  });

  it('publishes the measured timeline length and hands progress to CSS when it can', async () => {
    @Component({
      template: `<main mlvPage [snapBehavior]="behavior()"><p>Body</p></main>`,
      imports: [MlvPage],
    })
    class SnapGeometryTestHost {
      readonly behavior = signal<'exitUntilCollapsed' | 'pinned'>(
        'exitUntilCollapsed',
      );
    }

    const fixture = TestBed.configureTestingModule({
      imports: [SnapGeometryTestHost],
    }).createComponent(SnapGeometryTestHost);
    await fixture.whenStable();

    const page = fixture.nativeElement.querySelector('main') as HTMLElement;

    // Nothing measured itself as collapsible, so the timeline is degenerate and
    // the page keeps the override rather than handing a zero range to CSS.
    expect(page.style.getPropertyValue('--mlv-page-snap-range')).toBe('0px');
    expect(page.style.getPropertyValue('--mlv-page-snap-override')).toBe('0');

    const controller = fixture.debugElement.children[0].injector.get(
      MlvPageSnapController,
    );
    controller.registerCollapse(signal(120));
    await fixture.whenStable();
    expect(page.style.getPropertyValue('--mlv-page-snap-range')).toBe('120px');

    // jsdom implements neither `CSS.supports` nor scroll-driven animations, so
    // this is the fallback branch: the page itself is the source of progress.
    controller.updateFromScroll(60);
    await fixture.whenStable();
    expect(page.style.getPropertyValue('--mlv-page-snap-override')).toBe('0.5');

    // A behaviour the scroll timeline cannot express always keeps the override,
    // support or not.
    fixture.componentInstance.behavior.set('pinned');
    await fixture.whenStable();
    expect(page.style.getPropertyValue('--mlv-page-snap-override')).toBe('0');
  });

  describe('scroll modes', () => {
    it('points the whole contract at the document scrollport under scroll="document"', async () => {
      @Component({
        template: `<main mlvPage scroll="document"><p>Body</p></main>`,
        imports: [MlvPage],
      })
      class DocumentScrollTestHost {}

      const fixture = TestBed.configureTestingModule({
        imports: [DocumentScrollTestHost],
      }).createComponent(DocumentScrollTestHost);
      await fixture.whenStable();

      const page = fixture.nativeElement.querySelector('main') as HTMLElement;
      expect(page.classList).toContain('mlv-page--scroll-document');
      expect(page.querySelector('.mlv-page__scrollbar')).toBeNull();

      const geometry =
        fixture.debugElement.children[0].injector.get(MlvPageGeometry);
      const root = document.documentElement;
      try {
        root.scrollTop = 140;
        // The document element's scroll event is delivered on the *document*,
        // not on the element, which is the whole reason the scrollport carries
        // its event target separately from its scroller.
        document.dispatchEvent(new Event('scroll'));
        await fixture.whenStable();
        expect(geometry.scrollTop()).toBe(140);
      } finally {
        root.scrollTop = 0;
      }
    });

    it('does not register the document with the CDK, which already watches it', async () => {
      @Component({
        template: `<main mlvPage scroll="document"><p>Body</p></main>`,
        imports: [MlvPage],
      })
      class DocumentDispatcherTestHost {}

      const fixture = TestBed.configureTestingModule({
        imports: [DocumentDispatcherTestHost],
      }).createComponent(DocumentDispatcherTestHost);
      await fixture.whenStable();

      // Registering the document element as a scrollable would make every
      // overlay in the document see one scroll twice — CDK's own global window
      // listener is already the channel for root scrolling.
      const dispatcher = TestBed.inject(ScrollDispatcher);
      const ancestors = dispatcher.getAncestorScrollContainers(
        fixture.nativeElement.querySelector('p') as HTMLElement,
      );
      expect(
        ancestors.some(
          (s) => s.getElementRef().nativeElement === document.documentElement,
        ),
      ).toBe(false);
    });

    it('connects no scrollport at all under scroll="content"', async () => {
      @Component({
        template: `<main mlvPage scroll="content"><p>Body</p></main>`,
        imports: [MlvPage],
      })
      class ContentScrollTestHost {}

      const fixture = TestBed.configureTestingModule({
        imports: [ContentScrollTestHost],
      }).createComponent(ContentScrollTestHost);
      await fixture.whenStable();

      const geometry =
        fixture.debugElement.children[0].injector.get(MlvPageGeometry);
      const updateScroll = vi.spyOn(geometry, 'updateScroll');

      // Nothing is inferred: not the document, and not the first overflowing
      // descendant either. A page that hands scrolling to its body has no
      // scrollport the page itself can name.
      document.dispatchEvent(new Event('scroll'));
      const inner = fixture.nativeElement.querySelector(
        '.mlv-page__inner',
      ) as HTMLElement;
      inner.dispatchEvent(new Event('scroll'));
      await fixture.whenStable();

      expect(updateScroll).not.toHaveBeenCalled();
    });
  });

  describe('[mlvPageScroller]', () => {
    @Component({
      template: `
        <main mlvPage scroll="content">
          <mlv-scrollbar mlvPageScroller><p>Body</p></mlv-scrollbar>
        </main>
      `,
      imports: [MlvPage, MlvPageScroller, MlvScrollbar],
    })
    class DonatedScrollerTestHost {}

    it('donates a consumer pane scroll to the page it is inside', async () => {
      const fixture = TestBed.configureTestingModule({
        imports: [DonatedScrollerTestHost],
      }).createComponent(DonatedScrollerTestHost);
      await fixture.whenStable();

      const geometry =
        fixture.debugElement.children[0].injector.get(MlvPageGeometry);
      // The scrollbar's *viewport*, not its host: the host is not the element
      // that scrolls, so registering it would measure and read the wrong box.
      const viewport = fixture.nativeElement.querySelector(
        '.mlv-scrollbar__viewport',
      ) as HTMLElement;

      viewport.scrollTop = 220;
      viewport.dispatchEvent(new Event('scroll'));
      await fixture.whenStable();
      expect(geometry.scrollTop()).toBe(220);

      // And it is the element `expand()` returns to — the page never knew it.
      const controller = fixture.debugElement.children[0].injector.get(
        MlvPageSnapController,
      );
      controller.expand();
      expect(viewport.scrollTop).toBe(0);
    });

    it('registers the donated pane with the CDK so overlays inside it reposition', async () => {
      const fixture = TestBed.configureTestingModule({
        imports: [DonatedScrollerTestHost],
      }).createComponent(DonatedScrollerTestHost);
      await fixture.whenStable();

      const dispatcher = TestBed.inject(ScrollDispatcher);
      const viewport = fixture.nativeElement.querySelector(
        '.mlv-scrollbar__viewport',
      ) as HTMLElement;
      expect(
        dispatcher
          .getAncestorScrollContainers(
            fixture.nativeElement.querySelector('p') as HTMLElement,
          )
          .some((s) => s.getElementRef().nativeElement === viewport),
      ).toBe(true);
    });

    it('refuses to donate into a page that owns a scrollport already', async () => {
      @Component({
        template: `
          <main mlvPage>
            <mlv-scrollbar mlvPageScroller><p>Body</p></mlv-scrollbar>
          </main>
        `,
        imports: [MlvPage, MlvPageScroller, MlvScrollbar],
      })
      class ConflictingScrollerTestHost {}

      const warn = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => undefined);
      const fixture = TestBed.configureTestingModule({
        imports: [ConflictingScrollerTestHost],
      }).createComponent(ConflictingScrollerTestHost);
      await fixture.whenStable();

      // Two scrollports would fight over one `registerScrollport` slot and one
      // `expand()` target, so the page keeps its own and the donation is a
      // no-op with a reason rather than a coin toss.
      expect(warn).toHaveBeenCalled();
      expect(String(warn.mock.calls[0]?.[0])).toContain('scroll="content"');

      const geometry =
        fixture.debugElement.children[0].injector.get(MlvPageGeometry);
      const nested: NodeListOf<HTMLElement> =
        fixture.nativeElement.querySelectorAll('.mlv-scrollbar__viewport');
      const donated = nested[nested.length - 1];
      donated.scrollTop = 90;
      donated.dispatchEvent(new Event('scroll'));
      await fixture.whenStable();
      expect(geometry.scrollTop()).toBe(0);

      warn.mockRestore();
    });
  });

  it('has no axe violations as a landmark with chrome', async () => {
    const fixture = TestBed.configureTestingModule({
      imports: [PageTestHost],
    }).createComponent(PageTestHost);
    await fixture.whenStable();

    await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
  });
});
