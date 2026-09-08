import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MlvPageSnapController } from './page-snap-controller';
import type { MlvPageSnapRegion } from './page-snap-state';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';

/**
 * The three behaviours are the platform triad, and the whole point of naming
 * them is that each one answers scrolling differently. These are the
 * distinctions, asserted directly on the controller — the component layer only
 * forwards `snapBehavior` and a scroll offset into it.
 */
describe('MlvPageSnapController — behaviours and derived distance', () => {
  // Page chrome reads its accessible names from the language pack, and
  // every `MLV_*_I18N` token is a bare `InjectionToken` with no factory.
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideMlvI18nTesting()] });
  });
  function setup(distance = 100) {
    TestBed.configureTestingModule({ providers: [MlvPageSnapController] });
    const controller = TestBed.inject(MlvPageSnapController);
    const collapsible = signal(distance);
    controller.registerCollapse(collapsible);
    return { controller, collapsible };
  }

  it('derives the timeline length from what the chrome measured, not an input', () => {
    const { controller, collapsible } = setup(100);
    expect(controller.collapseDistance()).toBe(100);

    // A second region — the flagship case is a header whose title block and
    // summary strip both collapse.
    controller.registerCollapse(signal(60));
    expect(controller.collapseDistance()).toBe(160);

    // A font load, a locale change or a responsive rewrap lengthens the
    // timeline instead of leaving it calibrated against a stale number.
    collapsible.set(140);
    expect(controller.collapseDistance()).toBe(200);
  });

  it('reports no progress at all when nothing measures itself as collapsible', () => {
    TestBed.configureTestingModule({ providers: [MlvPageSnapController] });
    const controller = TestBed.inject(MlvPageSnapController);

    controller.updateFromScroll(500);

    expect(controller.collapseDistance()).toBe(0);
    expect(controller.progress()).toBe(0);
    // …and yet it still knows it is over content. That is the whole reason the
    // two signals are separate.
    expect(controller.overlapped()).toBe(true);
  });

  it('unregisters a collapsing region when it is destroyed', () => {
    const { controller } = setup(100);
    const unregister = controller.registerCollapse(signal(50));
    expect(controller.collapseDistance()).toBe(150);

    unregister();
    expect(controller.collapseDistance()).toBe(100);
  });

  describe('exitUntilCollapsed (default)', () => {
    it('maps scroll linearly onto the collapse distance and needs the top to fully expand', () => {
      const { controller } = setup(100);

      controller.updateFromScroll(50);
      expect(controller.progress()).toBe(0.5);

      controller.updateFromScroll(400);
      expect(controller.progress()).toBe(1);

      // Scrolling back up stays collapsed for the whole document below the
      // first screenful; only returning into the timeline re-expands it.
      controller.updateFromScroll(300);
      expect(controller.progress()).toBe(1);

      controller.updateFromScroll(0);
      expect(controller.progress()).toBe(0);
    });
  });

  describe('pinned', () => {
    it('never collapses, at any scroll offset', () => {
      const { controller } = setup(100);
      controller.setBehavior('pinned');

      controller.updateFromScroll(1000);

      expect(controller.progress()).toBe(0);
      expect(controller.snapped()).toBe(false);
      expect(controller.overlapped()).toBe(true);
    });
  });

  describe('enterAlways', () => {
    it('comes back on any pull down, wherever the reader is', () => {
      const { controller } = setup(100);
      controller.setBehavior('enterAlways');

      // Deep into the document and fully collapsed.
      controller.updateFromScroll(400);
      controller.updateFromScroll(800);
      expect(controller.progress()).toBe(1);

      // A pull down of half the distance re-expands by half — 700px from the
      // top, where `exitUntilCollapsed` would still be pinned at 1.
      controller.updateFromScroll(750);
      expect(controller.progress()).toBe(0.5);

      controller.updateFromScroll(700);
      expect(controller.progress()).toBe(0);
    });

    it('is fully expanded at the top however it got there', () => {
      const { controller } = setup(100);
      controller.setBehavior('enterAlways');
      controller.updateFromScroll(500);
      expect(controller.progress()).toBe(1);

      // A jump to the top (an anchor link, `expand()`) must not leave the
      // accumulated progress stranded mid-collapse.
      controller.updateFromScroll(0);
      expect(controller.progress()).toBe(0);
    });
  });

  describe('prefers-reduced-motion', () => {
    const nativeMatchMedia = window.matchMedia;

    afterEach(() => {
      window.matchMedia = nativeMatchMedia;
    });

    it('steps between the two ends instead of scrubbing', () => {
      window.matchMedia = ((query: string) =>
        ({
          matches: query.includes('prefers-reduced-motion'),
          media: query,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
        }) as unknown as MediaQueryList) as typeof window.matchMedia;

      const { controller } = setup(100);

      // A title that resized on every wheel notch is what the criterion is
      // about, so there is no intermediate value to land on.
      controller.updateFromScroll(30);
      expect(controller.progress()).toBe(0);

      controller.updateFromScroll(49);
      expect(controller.progress()).toBe(0);

      controller.updateFromScroll(50);
      expect(controller.progress()).toBe(1);

      controller.updateFromScroll(90);
      expect(controller.progress()).toBe(1);
    });
  });

  /**
   * `expand()` is the one imperative affordance, and its whole reason to exist
   * is a focus move: `focus()` on a `visibility: hidden` element is silently
   * refused, so the reveal has to land before the scroll it asks for, in the
   * same task as the caller's `focus()`.
   */
  describe('expand()', () => {
    /** A registered region that records the order it was asked to reveal in. */
    function region(log: string[], name: string): MlvPageSnapRegion {
      return {
        reveal: () => log.push(`reveal:${name}`),
        syncHiddenState: () => log.push(`sync:${name}`),
      };
    }

    it('reveals every registered region before it scrolls anything', () => {
      const { controller } = setup(100);
      const log: string[] = [];
      controller.registerRegion(region(log, 'description'));
      controller.registerRegion(region(log, 'meta'));
      controller.registerScroller(() => log.push('scroll'));

      controller.updateFromScroll(400);
      expect(controller.snapped()).toBe(true);

      controller.expand();

      // Both reveals, then the scroll — not the other way round, and not a
      // scroll the caller has to wait for before focusing.
      expect(log).toEqual(['reveal:description', 'reveal:meta', 'scroll']);
    });

    it('keeps the regions revealed until the scroll it asked for lands', () => {
      const { controller } = setup(100);
      const log: string[] = [];
      controller.registerRegion(region(log, 'description'));
      // No scroller: nothing moves on its own, which is the standalone-chrome
      // case as well as a page whose viewport has not rendered yet.
      controller.updateFromScroll(400);

      controller.expand();
      expect(controller.revealing()).toBe(true);

      // Arriving anywhere short of the top does not end it…
      controller.updateFromScroll(60);
      TestBed.tick();
      expect(controller.revealing()).toBe(true);

      // …reaching the top does, and every region is handed back its own
      // hidden state rather than being left latched open.
      controller.updateFromScroll(0);
      TestBed.tick();
      expect(controller.revealing()).toBe(false);
      expect(log).toEqual(['reveal:description', 'sync:description']);
    });

    it('closes a reveal whose scroll never arrives', async () => {
      vi.useFakeTimers();
      try {
        const { controller } = setup(100);
        const log: string[] = [];
        controller.registerRegion(region(log, 'description'));
        controller.updateFromScroll(400);

        // A refused scroll, an interrupted smooth scroll, or no scroller at
        // all — a reveal that never closed would leave invisible tab stops
        // behind, which is the defect the hidden state exists to prevent.
        controller.expand();
        expect(controller.revealing()).toBe(true);

        vi.advanceTimersByTime(700);
        expect(controller.revealing()).toBe(false);
        expect(log).toEqual(['reveal:description', 'sync:description']);
      } finally {
        vi.useRealTimers();
      }
    });

    it('stops asking a scroller that has been unregistered', () => {
      const { controller } = setup(100);
      const log: string[] = [];
      const unregister = controller.registerScroller(() => log.push('scroll'));

      controller.expand();
      expect(log).toEqual(['scroll']);

      unregister();
      controller.expand();
      expect(log).toEqual(['scroll']);
    });
  });
});
