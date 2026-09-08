import { Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MlvPageGeometry } from './page-geometry';
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
});
