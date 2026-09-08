import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MlvPageSnapController } from './page-snap-controller';

/**
 * The three behaviours are the platform triad, and the whole point of naming
 * them is that each one answers scrolling differently. These are the
 * distinctions, asserted directly on the controller — the component layer only
 * forwards `snapBehavior` and a scroll offset into it.
 */
describe('MlvPageSnapController — behaviours and derived distance', () => {
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
});
