import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MlvResizeObserverService } from '@malva-ui/cdk/utils';
import { Subject } from 'rxjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { MlvPageDockAppearance } from './page-dock';
import { MlvPageDock } from './page-dock';
import {
  MlvPageDockCenter,
  MlvPageDockEnd,
  MlvPageDockStart,
} from './page-dock.slots';

/**
 * Angular does not attach component styles in the test environment, and jsdom
 * resolves neither `calc()` nor `var()`. The floating appearance and the
 * wrapper-tolerant geometry are CSS contracts, so the stylesheet source is
 * read directly — a class name alone does not prove the backdrop exists.
 *
 * `new URL(…, import.meta.url)` is rewritten by Vite into an asset URL, so the
 * sibling stylesheet is resolved from this file's own path instead.
 */
const dockScss = readFileSync(
  fileURLToPath(import.meta.url).replace(/\.spec\.ts$/, '.scss'),
  'utf8',
)
  // Comments explain the selectors these assertions rule out, so they would
  // otherwise satisfy the checks on their own.
  .replace(/^\s*\/\/.*$/gm, '');

@Component({
  template: `
    <mlv-page-dock [sticky]="sticky()" [appearance]="appearance()">
      <span mlvPageDockStart>6 pending changes</span>
      <div mlvPageDockCenter><button type="button">Comment</button></div>
      <div mlvPageDockEnd><button type="button">Publish</button></div>
    </mlv-page-dock>
  `,
  imports: [MlvPageDock, MlvPageDockStart, MlvPageDockCenter, MlvPageDockEnd],
})
class PageDockTestHost {
  readonly sticky = signal(true);
  readonly appearance = signal<MlvPageDockAppearance>('bar');
}

/** Emits the stubbed resize notifications the dock listens to. */
let resizeEvents: Subject<ResizeObserverEntry[]>;

function createHost() {
  resizeEvents = new Subject<ResizeObserverEntry[]>();
  return TestBed.configureTestingModule({
    imports: [PageDockTestHost],
    providers: [
      {
        provide: MlvResizeObserverService,
        useValue: { observe: () => resizeEvents.asObservable() },
      },
    ],
  }).createComponent(PageDockTestHost);
}

/** jsdom reports every element as zero-sized; fake a laid-out dock instead. */
function stubHeight(element: HTMLElement, height: number): void {
  Object.defineProperty(element, 'offsetHeight', {
    configurable: true,
    value: height,
  });
}

function publishedDockHeight(): string {
  return document.documentElement.style.getPropertyValue(
    '--mlv-page-dock-height',
  );
}

describe('MlvPageDock', () => {
  afterEach(() => {
    document.documentElement.style.removeProperty('--mlv-page-dock-height');
  });

  it('projects the three dock regions with their layout classes', async () => {
    const fixture = createHost();
    await fixture.whenStable();

    const dock = fixture.nativeElement.querySelector(
      '.mlv-page-dock',
    ) as HTMLElement;
    expect(dock.classList).toContain('mlv-page-dock--sticky');
    expect(dock.querySelector('.mlv-page-dock__start')?.textContent).toContain(
      '6 pending changes',
    );
    expect(
      dock.querySelector('.mlv-page-dock__center button')?.textContent,
    ).toBe('Comment');
    expect(dock.querySelector('.mlv-page-dock__end button')?.textContent).toBe(
      'Publish',
    );
  });

  it('drops the sticky modifier when sticky is false', async () => {
    const fixture = createHost();
    fixture.componentInstance.sticky.set(false);
    await fixture.whenStable();

    const dock = fixture.nativeElement.querySelector(
      '.mlv-page-dock',
    ) as HTMLElement;
    expect(dock.classList).not.toContain('mlv-page-dock--sticky');
  });

  describe('appearance', () => {
    it('keeps the solid bar chrome by default', async () => {
      const fixture = createHost();
      await fixture.whenStable();

      const dock = fixture.nativeElement.querySelector(
        '.mlv-page-dock',
      ) as HTMLElement;
      expect(dock.classList).not.toContain('mlv-page-dock--floating');
    });

    it('applies the floating backdrop modifier when appearance is floating', async () => {
      const fixture = createHost();
      fixture.componentInstance.appearance.set('floating');
      await fixture.whenStable();

      const dock = fixture.nativeElement.querySelector(
        '.mlv-page-dock',
      ) as HTMLElement;
      expect(dock.classList).toContain('mlv-page-dock--floating');
    });

    it('wires the shared floating-container recipe into the floating modifier', () => {
      // The docstring promises a gradient-masked backdrop plus safe-area
      // padding, so the modifier has to pull in the `[mlvFloatingContainer]`
      // mixins — a transparent surface and a class name alone are not it.
      const floatingBlock = dockScss.slice(dockScss.indexOf('&--floating'));

      expect(dockScss).toContain('floating-container.mixins');
      expect(floatingBlock).toContain('@include floating.backdrop(');
      expect(floatingBlock).toContain('--mlv-page-dock-backdrop');
      expect(floatingBlock).toContain('@include floating.safe-area-block-end(');
      // The backdrop pseudo-element sits at z-index -1 and needs a stacking
      // context of its own, or a non-sticky dock paints it out of sight.
      expect(floatingBlock).toContain('isolation: isolate');
    });

    it('derives its full-bleed margins from the inherited page inset', () => {
      // Wrapper-tolerant geometry: no `.mlv-page__inner > …` child selector is
      // involved, so a <form>/<section> between page and dock cannot break it.
      expect(dockScss).toContain(
        'margin-inline: calc(-1 * var(--mlv-page-inset, 0rem))',
      );
      expect(dockScss).toContain(
        'margin-bottom: calc(-1 * var(--mlv-page-inset, 0rem))',
      );
      expect(dockScss).not.toContain('.mlv-page__inner');
    });

    it('lets the dock regions wrap instead of overflowing the grid', () => {
      // Four actions must reflow onto a second row on a narrow canvas rather
      // than spilling out of the `1fr auto 1fr` grid column.
      const wrapRule = /&__start,\s*&__center,\s*&__end\s*\{([^}]*)\}/.exec(
        dockScss,
      );

      expect(wrapRule?.[1]).toContain('flex-wrap: wrap');
    });
  });

  describe('published dock height', () => {
    it('publishes the measured height of a sticky dock on the document root', async () => {
      const fixture = createHost();
      await fixture.whenStable();

      const dock = fixture.nativeElement.querySelector(
        '.mlv-page-dock',
      ) as HTMLElement;
      stubHeight(dock, 64);
      resizeEvents.next([]);
      await fixture.whenStable();

      expect(publishedDockHeight()).toBe('64px');
    });

    it('withdraws the height when the dock stops being sticky', async () => {
      const fixture = createHost();
      await fixture.whenStable();

      const dock = fixture.nativeElement.querySelector(
        '.mlv-page-dock',
      ) as HTMLElement;
      stubHeight(dock, 64);
      resizeEvents.next([]);
      await fixture.whenStable();
      expect(publishedDockHeight()).toBe('64px');

      fixture.componentInstance.sticky.set(false);
      await fixture.whenStable();

      expect(publishedDockHeight()).toBe('');
    });

    it('removes the property again when the dock is destroyed', async () => {
      const fixture = createHost();
      await fixture.whenStable();

      const dock = fixture.nativeElement.querySelector(
        '.mlv-page-dock',
      ) as HTMLElement;
      stubHeight(dock, 48);
      resizeEvents.next([]);
      await fixture.whenStable();
      expect(publishedDockHeight()).toBe('48px');

      fixture.destroy();

      expect(publishedDockHeight()).toBe('');
    });
  });
});
