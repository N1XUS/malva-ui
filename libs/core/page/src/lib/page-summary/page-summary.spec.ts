import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as sass from 'sass';
import { MlvPageSnapController } from '../page/page-snap-controller';
import { MlvPageSummary } from './page-summary';
import { MlvPageSummaryItem } from './page-summary-item';

const SUMMARY_DIR = dirname(fileURLToPath(import.meta.url));

/**
 * The strip's own stylesheet, attached to the document so the focus reveal is
 * read back through the real cascade: the `--revealed` rule has to out-cascade
 * the block's own `--mlv-page-summary-snap` declaration.
 */
const SUMMARY_CSS = sass.compile(join(SUMMARY_DIR, 'page-summary.scss'), {
  style: 'expanded',
}).css;

@Component({
  template: `
    <mlv-page-summary summaryLabel="Key product facts">
      <mlv-page-summary-item label="Category">
        Audio Equipment
      </mlv-page-summary-item>
      <mlv-page-summary-item label="Price">
        <a href="/pricing" class="test-fact-link">Pricing</a>
      </mlv-page-summary-item>
    </mlv-page-summary>
  `,
  imports: [MlvPageSummary, MlvPageSummaryItem],
})
class PageSummaryTestHost {}

describe('MlvPageSummary', () => {
  function setup() {
    TestBed.configureTestingModule({
      imports: [PageSummaryTestHost],
      providers: [MlvPageSnapController],
    });
    const controller = TestBed.inject(MlvPageSnapController);
    const fixture = TestBed.createComponent(PageSummaryTestHost);
    return { fixture, controller };
  }

  it('renders labelled summary items in an accessible group', async () => {
    const { fixture } = setup();
    await fixture.whenStable();

    const items = fixture.nativeElement.querySelectorAll(
      '.mlv-page-summary-item',
    );
    expect(items.length).toBe(2);
    expect(
      items[0].querySelector('.mlv-page-summary-item__label')?.textContent,
    ).toBe('Category');
    expect(
      items[0].querySelector('.mlv-page-summary-item__value')?.textContent,
    ).toContain('Audio Equipment');
    expect(
      items[1].querySelector('.mlv-page-summary-item__label')?.textContent,
    ).toBe('Price');
    expect(
      fixture.nativeElement
        .querySelector('.mlv-page-summary__items')
        ?.getAttribute('aria-label'),
    ).toBe('Key product facts');
  });

  it('publishes its stagger window for the CSS scrub', async () => {
    const { fixture } = setup();
    await fixture.whenStable();

    const host = fixture.nativeElement.querySelector(
      '.mlv-page-summary',
    ) as HTMLElement;
    expect(host.style.getPropertyValue('--mlv-snap-from')).toBe('0.1');
    // 1 / (0.95 - 0.1)
    expect(Number(host.style.getPropertyValue('--mlv-snap-scale'))).toBeCloseTo(
      1.176,
      2,
    );
  });

  it('hides itself from the accessibility tree once fully snapped', async () => {
    const { fixture, controller } = setup();
    await fixture.whenStable();

    const host = fixture.nativeElement.querySelector(
      '.mlv-page-summary',
    ) as HTMLElement;
    expect(host.style.visibility).toBe('');

    controller.updateFromScroll(96, 96);
    await fixture.whenStable();
    expect(host.style.visibility).toBe('hidden');
    expect(host.classList).toContain('mlv-page-summary--snapped');

    controller.updateFromScroll(0, 96);
    await fixture.whenStable();
    expect(host.style.visibility).toBe('');
    expect(host.classList).not.toContain('mlv-page-summary--snapped');
  });

  it('keeps a focused strip visible when the scroll scrubs it away', async () => {
    const styleEl = document.createElement('style');
    styleEl.textContent = SUMMARY_CSS;
    document.head.appendChild(styleEl);
    try {
      const { fixture, controller } = setup();
      await fixture.whenStable();

      const host = fixture.nativeElement.querySelector(
        '.mlv-page-summary',
      ) as HTMLElement;
      const link = fixture.nativeElement.querySelector(
        '.test-fact-link',
      ) as HTMLAnchorElement;
      link.focus();
      expect(document.activeElement).toBe(link);

      controller.updateFromScroll(96, 96);
      await fixture.whenStable();

      // A projected fact can be interactive; scrolling must not blur it.
      expect(document.activeElement).toBe(link);
      expect(host.style.visibility).toBe('');
      expect(host.classList).toContain('mlv-page-summary--revealed');
      expect(
        getComputedStyle(host).getPropertyValue('--mlv-page-summary-snap'),
      ).toBe('0');

      // Focus leaves: the strip goes back out of view and out of the tab order.
      const outside = document.createElement('button');
      document.body.appendChild(outside);
      outside.focus();
      await fixture.whenStable();
      expect(host.style.visibility).toBe('hidden');
      expect(host.classList).not.toContain('mlv-page-summary--revealed');
      outside.remove();
    } finally {
      styleEl.remove();
    }
  });
});
