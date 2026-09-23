import { Component, signal } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { MlvResizeObserverFactory } from '@malva-ui/cdk/utils';
import { stripCssLayersFromText } from '@malva-ui/internal-testing';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as sass from 'sass';
import {
  MlvPageDescription,
  MlvPageMeta,
} from '../page-header/page-header.directives';
import { MlvPageSnapController } from './page-snap-controller';
import type { MlvPageSnapMode } from './page-snap.directive';
import { MlvPageSnap } from './page-snap.directive';

const SPEC_DIR = dirname(fileURLToPath(import.meta.url));

/** Height of one line of the modelled content, in pixels. */
const LINE = 20;

/** Characters that fit on one modelled line. */
const LINE_CHARS = 40;

const SHORT = 'Shared header and footer.';
const LONG =
  'The homepage content section. The shared header and footer are shown for context and cannot be edited here.';

/**
 * Stand-in for the platform observer; jsdom implements none. It delivers
 * **nothing on its own**: a spec decides which boxes changed, which is the
 * whole point — a clamped host's box does not change when its content grows,
 * so a browser reports nothing for it.
 */
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

  /** Delivers an entry for `target` only, the way the platform would. */
  emitFor(target: Element): void {
    if (this.targets.has(target)) {
      this._callback([{ target } as ResizeObserverEntry], this);
    }
  }
}

@Component({
  template: `
    <p mlvPageDescription>{{ text() }}</p>
    <div mlvPageMeta>
      @if (owner(); as name) {
        <span>{{ name }}</span>
      }
    </div>
  `,
  imports: [MlvPageDescription, MlvPageMeta],
})
class SnapMeasureHost {
  readonly text = signal(SHORT);
  readonly owner = signal<string | null>(null);
}

@Component({
  template: `<p [mlvPageSnap]="mode()">{{ text() }}</p>`,
  imports: [MlvPageSnap],
})
class SnapModeHost {
  readonly mode = signal<MlvPageSnapMode>('fade');
  readonly text = signal(SHORT);
}

/**
 * Models layout for one region: jsdom lays nothing out, so every box is
 * zero-sized. The natural block size follows the text — one line per
 * {@link LINE_CHARS} characters, scaled by the current font — and is what
 * `scrollHeight` reports on a clamped box in a browser.
 */
function modelContentHeight(element: HTMLElement, font: { scale: number }) {
  // Each read is counted: in a browser a read after a DOM change forces a
  // layout, which is the cost a region that is never clamped should not pay.
  const probe = { reads: 0 };
  Object.defineProperty(element, 'scrollHeight', {
    configurable: true,
    get: () => {
      probe.reads++;
      const text = (element.textContent ?? '').trim();
      return Math.ceil(text.length / LINE_CHARS) * LINE * font.scale;
    },
  });
  return probe;
}

describe('MlvPageSnap — measuring the content, not the clamped box', () => {
  let font: { scale: number };

  beforeEach(() => {
    FakeResizeObserver.instances = [];
    font = { scale: 1 };
    TestBed.configureTestingModule({
      imports: [SnapMeasureHost],
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
  });

  /**
   * Lets a content mutation reach the region: change detection writes the
   * DOM, the mutation is delivered at the next microtask checkpoint, and the
   * measurement it writes is flushed by one more pass.
   */
  async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
    await fixture.whenStable();
    await Promise.resolve();
    await fixture.whenStable();
  }

  async function createHost() {
    const controller = TestBed.inject(MlvPageSnapController);
    // Chrome the page collapses besides these two regions — the header's own
    // title block. Scrolled into the timeline so the regions are mid-scrub:
    // clamped below their natural size, which is exactly when a browser's
    // observer has nothing to report for them.
    controller.registerCollapse(signal(100));
    controller.updateFromScroll(40);

    const fixture = TestBed.createComponent(SnapMeasureHost);
    const description = fixture.nativeElement.querySelector(
      '[mlvPageDescription]',
    ) as HTMLElement;
    const meta = fixture.nativeElement.querySelector(
      '[mlvPageMeta]',
    ) as HTMLElement;
    modelContentHeight(description, font);
    modelContentHeight(meta, font);
    await fixture.whenStable();
    return { controller, fixture, description, meta };
  }

  function snapSize(element: HTMLElement): string {
    return element.style.getPropertyValue('--mlv-snap-size');
  }

  it('measures each region once rendered', async () => {
    const { controller, description, meta } = await createHost();

    expect(snapSize(description)).toBe('20px');
    expect(snapSize(meta)).toBe('0px');
    expect(controller.progress()).toBeGreaterThan(0);
    expect(controller.collapseDistance()).toBe(100 + 20);
  });

  it('re-measures when the host box itself changes', async () => {
    const { fixture, description } = await createHost();
    expect(snapSize(description)).toBe('20px');

    // The canvas narrowed: the row rewraps onto two lines, and its inline
    // size changing is a box change the observer does report.
    font.scale = 2;
    for (const observer of FakeResizeObserver.instances) {
      observer.emitFor(description);
    }
    await fixture.whenStable();

    expect(snapSize(description)).toBe('40px');
  });

  it('re-measures when projected text grows while the host box stays clamped', async () => {
    const { controller, fixture, description } = await createHost();
    expect(snapSize(description)).toBe('20px');

    // No observer delivers anything: the clamped host box did not change.
    fixture.componentInstance.text.set(LONG);
    await settle(fixture);

    expect(snapSize(description)).toBe('60px');
    // The timeline the page compensates for follows the new height too.
    expect(controller.collapseDistance()).toBe(100 + 60);
  });

  it('shows a region that renders empty once content arrives', async () => {
    const { controller, fixture, meta } = await createHost();
    expect(snapSize(meta)).toBe('0px');

    fixture.componentInstance.owner.set('Owned by Design Systems');
    await settle(fixture);

    expect(snapSize(meta)).toBe('20px');
    expect(controller.collapseDistance()).toBe(100 + 20 + 20);
  });

  it('re-measures after a web font swap rewraps the content', async () => {
    const fonts = new EventTarget();
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: fonts,
    });
    try {
      const { fixture, description } = await createHost();
      expect(snapSize(description)).toBe('20px');

      // Wider glyphs: the same text now takes more block size, and nothing
      // in the DOM changed to say so.
      font.scale = 1.5;
      fonts.dispatchEvent(new Event('loadingdone'));
      await fixture.whenStable();

      expect(snapSize(description)).toBe('30px');
    } finally {
      delete (document as { fonts?: unknown }).fonts;
    }
  });

  it('releases the content observers when the region is destroyed', async () => {
    const fonts = new EventTarget();
    const removeListener = vi.spyOn(fonts, 'removeEventListener');
    const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect');
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: fonts,
    });
    try {
      const { controller, fixture } = await createHost();
      disconnect.mockClear();

      fixture.destroy();

      // One mutation observer and one font listener per region.
      expect(disconnect).toHaveBeenCalledTimes(2);
      expect(
        removeListener.mock.calls.filter(([type]) => type === 'loadingdone'),
      ).toHaveLength(2);
      expect(controller.collapseDistance()).toBe(100);
    } finally {
      disconnect.mockRestore();
      delete (document as { fonts?: unknown }).fonts;
    }
  });

  it('leaves a region that is never clamped to the box observer', async () => {
    const fonts = new EventTarget();
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: fonts,
    });
    try {
      const controller = TestBed.inject(MlvPageSnapController);
      controller.registerCollapse(signal(100));
      controller.updateFromScroll(40);
      const fixture = TestBed.createComponent(SnapModeHost);
      const region = fixture.nativeElement.querySelector('p') as HTMLElement;
      const probe = modelContentHeight(region, font);
      await fixture.whenStable();
      expect(snapSize(region)).toBe('20px');
      const readsAfterFirstRender = probe.reads;

      // A `fade` region is not clamped, so neither a DOM change nor a font
      // swap reads its size: its box grows with it, and that is the box
      // observer's to report.
      fixture.componentInstance.text.set(LONG);
      await settle(fixture);
      fonts.dispatchEvent(new Event('loadingdone'));
      await fixture.whenStable();
      expect(probe.reads).toBe(readsAfterFirstRender);

      for (const observer of FakeResizeObserver.instances) {
        observer.emitFor(region);
      }
      await fixture.whenStable();
      expect(snapSize(region)).toBe('60px');

      // Turning into a `hide` region needs no measurement of its own: the
      // box observer kept the number current while nothing clamped it.
      fixture.componentInstance.mode.set('hide');
      await fixture.whenStable();
      expect(controller.collapseDistance()).toBe(100 + 60);

      // Clamped now, so the content is watched again — the mode is read per
      // change, not fixed at the first render.
      fixture.componentInstance.text.set(SHORT);
      await settle(fixture);
      expect(snapSize(region)).toBe('20px');
      expect(controller.collapseDistance()).toBe(100 + 20);
    } finally {
      delete (document as { fonts?: unknown }).fonts;
    }
  });

  describe('published stylesheet contract', () => {
    /**
     * The `max-block-size` the compiled `.mlv-page-snap--hide` rule declares,
     * whitespace removed. jsdom resolves neither `var()` nor `calc()`, so the
     * declaration is evaluated here instead: `--mlv-snap-size` and
     * `--mlv-page-snap` are substituted and the arithmetic run in JS.
     */
    const declaration = (() => {
      const css = stripCssLayersFromText(
        sass.compile(join(SPEC_DIR, 'page.scss'), { style: 'expanded' }).css,
      );
      const rule = /\.mlv-page-snap--hide\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
      const value = /max-block-size:([^;]*);/.exec(rule)?.[1] ?? '';
      return value.replace(/\s+/g, '');
    })();

    function maxBlockSize(size: number, progress: number): number {
      const expression = declaration
        .replaceAll('var(--mlv-snap-size,0px)', `(${size})`)
        .replaceAll('var(--mlv-page-snap,0)', `(${progress})`)
        .replaceAll('calc(', '(')
        .replaceAll('max(', 'Math.max(')
        .replaceAll('min(', 'Math.min(')
        .replaceAll('px', '');
      // Only numbers, arithmetic and the two Math calls may remain.
      expect(expression.replace(/Math\.(max|min)/g, '')).toMatch(
        /^[\d.()+\-*/,]+$/,
      );
      return Function(`return ${expression};`)() as number;
    }

    it('scrubs the region between its measured size and nothing', () => {
      expect(maxBlockSize(60, 0.25)).toBeCloseTo(45);
      expect(maxBlockSize(60, 0.5)).toBeCloseTo(30);
      expect(maxBlockSize(60, 1)).toBeCloseTo(0);
      // The first scrubbed thousandth — the finest progress the page's own
      // override writes — is already clamped to the measurement.
      expect(maxBlockSize(60, 0.001)).toBeCloseTo(59.94);
    });

    it('does not clamp the region at rest, where there is nothing to scrub', () => {
      // A clamp at progress 0 would pin the box at the size measured last,
      // and a box that cannot change is one no ResizeObserver reports.
      expect(maxBlockSize(20, 0)).toBeGreaterThanOrEqual(10_000);
      // Including a region measured empty, which is otherwise clamped to
      // nothing at every progress.
      expect(maxBlockSize(0, 0)).toBeGreaterThanOrEqual(10_000);
    });
  });
});
