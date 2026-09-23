import { Component, signal } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { MlvRtlService } from '@malva-ui/cdk/utils';
import type {
  MlvInfiniteScrollOrientation,
  MlvInfiniteScrollTrigger,
} from './infinite-scroll';
import { MlvInfiniteScroll } from './infinite-scroll';

@Component({
  imports: [MlvInfiniteScroll],
  template: `<div
    class="strip"
    mlvInfiniteScroll
    [orientation]="orientation()"
    (loadMore)="triggers.push($event)"
  ></div>`,
})
class HostComponent {
  readonly orientation = signal<MlvInfiniteScrollOrientation>('horizontal');
  readonly triggers: MlvInfiniteScrollTrigger[] = [];
}

/** Content 3000px wide in a 300px viewport: 2700px of horizontal scroll range. */
const SCROLL_WIDTH = 3000;
const CLIENT_WIDTH = 300;
const RANGE = SCROLL_WIDTH - CLIENT_WIDTH;

type Scope = 'ltr' | 'global-rtl' | 'scoped-rtl';

describe('MlvInfiniteScroll — horizontal', () => {
  let fixture: ComponentFixture<HostComponent>;
  let strip: HTMLElement;
  let scrollLeft: number;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    strip = fixture.nativeElement.querySelector('.strip') as HTMLElement;

    // jsdom does no layout: give the strip the geometry a browser reports.
    scrollLeft = 0;
    Object.defineProperties(strip, {
      scrollWidth: { configurable: true, get: () => SCROLL_WIDTH },
      clientWidth: { configurable: true, get: () => CLIENT_WIDTH },
      scrollLeft: { configurable: true, get: () => scrollLeft },
    });

    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    fixture.nativeElement.parentElement?.removeAttribute('dir');
    TestBed.inject(MlvRtlService).setDirection('ltr');
    document.documentElement.removeAttribute('dir');
  });

  function applyScope(scope: Scope): void {
    if (scope === 'global-rtl') {
      TestBed.inject(MlvRtlService).setDirection('rtl');
    }
    if (scope === 'scoped-rtl') {
      (fixture.nativeElement.parentElement as HTMLElement).setAttribute(
        'dir',
        'rtl',
      );
    }
  }

  /**
   * Scrolls to `inlineOffset` px from the inline-start edge, reporting
   * `scrollLeft` the way CSSOM View defines it: `0` at the start in both
   * directions, positive toward the end in LTR and **negative** in RTL.
   */
  function scrollTo(scope: Scope, inlineOffset: number): void {
    scrollLeft = scope === 'ltr' ? inlineOffset : -inlineOffset;
    strip.dispatchEvent(new Event('scroll'));
  }

  it('does not fire while the strip starts out scrollable', () => {
    expect(fixture.componentInstance.triggers).toEqual([]);
  });

  // #308 — `scrollWidth - scrollLeft - clientWidth` treated the negative RTL
  // `scrollLeft` as distance travelled backwards: at the end of an RTL strip it
  // read 5400 instead of 0, so `loadMore` never fired and paging stopped.
  it.each<Scope>(['ltr', 'global-rtl', 'scoped-rtl'])(
    'fires loadMore at the inline end (%s)',
    (scope) => {
      applyScope(scope);

      scrollTo(scope, RANGE);

      expect(fixture.componentInstance.triggers).toEqual([
        { distance: 0, orientation: 'horizontal' },
      ]);
    },
  );

  it.each<Scope>(['ltr', 'global-rtl', 'scoped-rtl'])(
    'fires within the threshold of the inline end, not before it (%s)',
    (scope) => {
      applyScope(scope);

      // 151px from the end: outside the default 150px threshold.
      scrollTo(scope, RANGE - 151);
      expect(fixture.componentInstance.triggers).toEqual([]);

      // 100px from the end: inside it.
      scrollTo(scope, RANGE - 100);
      expect(fixture.componentInstance.triggers).toEqual([
        { distance: 100, orientation: 'horizontal' },
      ]);
    },
  );
});
