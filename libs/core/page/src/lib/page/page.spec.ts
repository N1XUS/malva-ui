import { Component, inject, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ScrollDispatcher } from '@angular/cdk/scrolling';
import { MlvPageGeometry } from './page-geometry';
import { MlvPageSnapController } from './page-snap-controller';
import { MlvPage } from './page';

@Component({
  template: `
    <main
      mlvPage
      id="project-page"
      padding="l"
      scroll="none"
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
  it('configures the native main landmark as the page surface', async () => {
    const fixture = TestBed.configureTestingModule({
      imports: [PageTestHost],
    }).createComponent(PageTestHost);
    await fixture.whenStable();

    const page = fixture.nativeElement.querySelector('main') as HTMLElement;
    expect(page.id).toBe('project-page');
    expect(page.getAttribute('tabindex')).toBe('-1');
    expect(page.classList).toContain('mlv-page--padding-l');
    expect(page.classList).toContain('mlv-page--scroll-none');
    expect(page.classList).toContain('mlv-page--surface-flat');
    expect(page.classList).not.toContain('mlv-page--sticky-header');
    expect(page.style.getPropertyValue('--mlv-page-max-width')).toBe('72rem');
    expect(page.querySelector('.content')?.textContent).toContain(
      'Page content',
    );
    expect(
      page.querySelector('.mlv-page__scrollbar.mlv-scrollbar'),
    ).toBeTruthy();
    expect(
      page
        .querySelector('.mlv-page__scrollbar')
        ?.classList.contains('mlv-scrollbar--disabled'),
    ).toBe(true);
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
    const viewport = fixture.nativeElement.querySelector(
      '.mlv-scrollbar__viewport',
    ) as HTMLElement;

    // Nothing measured itself as collapsible, so the timeline is degenerate and
    // the page keeps the override rather than handing a zero range to CSS.
    expect(page.style.getPropertyValue('--mlv-page-snap-range')).toBe('0px');
    expect(viewport.style.getPropertyValue('--mlv-page-snap-override')).toBe(
      '0',
    );

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
    expect(viewport.style.getPropertyValue('--mlv-page-snap-override')).toBe(
      '0.5',
    );

    // A behaviour the scroll timeline cannot express always keeps the override,
    // support or not.
    fixture.componentInstance.behavior.set('pinned');
    await fixture.whenStable();
    expect(viewport.style.getPropertyValue('--mlv-page-snap-override')).toBe(
      '0',
    );
  });
});
