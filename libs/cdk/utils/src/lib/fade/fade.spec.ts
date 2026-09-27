import { Component, signal } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { bootstrapApplication } from '@angular/platform-browser';
import { renderApplication } from '@angular/platform-server';
import { Observable, Subject } from 'rxjs';
import { MlvResizeObserverService } from '../observers/resize-observer.service';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import type { MlvOrientation } from './fade';
import { MlvFade } from './fade';

describe('MlvFade', () => {
  let component: MlvFade;
  let fixture: ComponentFixture<MlvFade>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MlvFade],
    }).compileComponents();

    fixture = TestBed.createComponent(MlvFade);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('does not subscribe to resize observation during server rendering', async () => {
    let subscriptions = 0;

    @Component({
      selector: 'mlv-fade-ssr-host',
      imports: [MlvFade],
      template: '<div mlvFade>Overflowing content</div>',
    })
    class FadeSsrHost {}

    const html = await renderApplication(
      (context) =>
        bootstrapApplication(
          FadeSsrHost,
          {
            providers: [
              {
                provide: MlvResizeObserverService,
                useValue: {
                  observe: () =>
                    new Observable(() => {
                      subscriptions += 1;
                    }),
                },
              },
            ],
          },
          context,
        ),
      {
        document: '<mlv-fade-ssr-host></mlv-fade-ssr-host>',
        url: '/',
      },
    );

    expect(html).toContain('mlv-fade');
    expect(subscriptions).toBe(0);
  });
});

@Component({
  selector: 'mlv-fade-metrics-host',
  imports: [MlvFade],
  template: `<div class="scope">
    <div [mlvFade]="orientation()" class="fade">Overflowing content</div>
  </div>`,
})
class FadeMetricsHost {
  readonly orientation = signal<MlvOrientation | ''>('horizontal');
}

/** Scroll metrics a test sets on the fade element; jsdom does no layout. */
interface FadeMetrics {
  scrollLeft: number;
  scrollTop: number;
  scrollWidth: number;
  clientWidth: number;
  scrollHeight: number;
  clientHeight: number;
}

/** Resolves after the next animation frame, where `MlvFade` measures. */
function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

/**
 * Behaviour with scroll metrics. The resize observer is a subject the test
 * drives, and the element's metrics are instance getters over `metrics`, so a
 * measurement is exactly: set the metrics, emit, wait a frame, render.
 */
describe('MlvFade scroll state', () => {
  let fixture: ComponentFixture<FadeMetricsHost>;
  let resize$: Subject<ResizeObserverEntry[]>;
  let fade: HTMLElement;
  let metrics: FadeMetrics;

  beforeEach(async () => {
    resize$ = new Subject<ResizeObserverEntry[]>();
    await TestBed.configureTestingModule({
      imports: [FadeMetricsHost],
      providers: [
        {
          provide: MlvResizeObserverService,
          useValue: { observe: () => resize$ },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FadeMetricsHost);
    fixture.detectChanges();
    await fixture.whenStable();
    fade = (fixture.nativeElement as HTMLElement).querySelector(
      '.fade',
    ) as HTMLElement;

    metrics = {
      scrollLeft: 0,
      scrollTop: 0,
      scrollWidth: 0,
      clientWidth: 200,
      scrollHeight: 20,
      clientHeight: 20,
    };
    for (const key of Object.keys(metrics) as (keyof FadeMetrics)[]) {
      Object.defineProperty(fade, key, {
        configurable: true,
        get: () => metrics[key],
      });
    }
  });

  afterEach(() => vi.restoreAllMocks());

  /** Emits a resize, lets the rAF measurement run and renders its result. */
  async function measure(): Promise<void> {
    resize$.next([]);
    await nextFrame();
    await fixture.whenStable();
  }

  it('reads an RTL subpixel offset at the start as "at the start" (#341)', async () => {
    // RTL `scrollLeft` runs 0 → negative. A fractional offset a hair past the
    // start used to floor to -1 and switch the start fade on.
    (fixture.nativeElement as HTMLElement)
      .querySelector('.scope')
      ?.setAttribute('dir', 'rtl');
    Object.assign(metrics, { scrollWidth: 600, scrollLeft: -0.4 });
    await measure();

    expect(fade.classList.contains('mlv-fade--start')).toBe(false);
    expect(fade.classList.contains('mlv-fade--end')).toBe(true);

    metrics.scrollLeft = -120;
    await measure();
    expect(fade.classList.contains('mlv-fade--start')).toBe(true);
    expect(fade.classList.contains('mlv-fade--end')).toBe(true);

    // Scrolled to the RTL end: `scrollLeft` is -(scrollWidth - clientWidth).
    metrics.scrollLeft = -400;
    await measure();
    expect(fade.classList.contains('mlv-fade--start')).toBe(true);
    expect(fade.classList.contains('mlv-fade--end')).toBe(false);
  });

  it('keeps the mask transition off until the first measurement has painted (#341)', async () => {
    // Before the first real measurement the mask sits in its rest position;
    // the measurement then moves it to the overflow edge. That move is not a
    // user scroll and must not slide in over `--mlv-duration-slow`.
    expect(fade.style.transition).toBe('none');

    // What the element looked like each time its style was read — the read is
    // what forces the browser to resolve the class change before the
    // transition comes back.
    const flushes: { end: boolean; transition: string }[] = [];
    const original = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation(
      (element, pseudo) => {
        if (element === fade) {
          flushes.push({
            end: fade.classList.contains('mlv-fade--end'),
            transition: fade.style.transition,
          });
        }
        return original(element, pseudo);
      },
    );

    metrics.scrollWidth = 600;
    await measure();
    // Rendered separately from the class change, one more pass may be pending.
    await fixture.whenStable();

    expect(fade.classList.contains('mlv-fade--end')).toBe(true);
    // The style was flushed with the class applied and the transition still
    // off, so the browser jumps the mask instead of animating it…
    expect(flushes).toContainEqual({ end: true, transition: 'none' });
    // …and only afterwards does the stylesheet's transition apply again.
    expect(fade.style.transition).toBe('');

    // From here on a boundary change is a real scroll and animates.
    metrics.scrollLeft = 120;
    await measure();
    expect(fade.classList.contains('mlv-fade--start')).toBe(true);
    expect(fade.style.transition).toBe('');
  });

  it('stays settled when the first measurement changes nothing', async () => {
    metrics.scrollWidth = 200;
    await measure();
    await fixture.whenStable();

    expect(fade.classList.contains('mlv-fade--end')).toBe(false);
    expect(fade.style.transition).toBe('');
  });

  it('does not settle on a box that has no size yet', async () => {
    // A hidden fade (display: none, a closed panel) measures zero; settling
    // there would let its first real measurement animate.
    resize$.next([]);
    await nextFrame();
    await fixture.whenStable();

    expect(fade.style.transition).toBe('none');
  });

  it('re-evaluates when the orientation changes, without a scroll or resize (#341)', async () => {
    // One line, overflowing horizontally only.
    metrics.scrollWidth = 600;
    await measure();
    expect(fade.classList.contains('mlv-fade--end')).toBe(true);

    // Vertically there is nothing to scroll, so the end fade has to go — and
    // nothing but the input changed: no scroll event, no resize.
    fixture.componentInstance.orientation.set('vertical');
    fixture.detectChanges();
    await nextFrame();
    await fixture.whenStable();
    expect(fade.getAttribute('data-orientation')).toBe('vertical');
    expect(fade.classList.contains('mlv-fade--end')).toBe(false);
  });
});

@Component({
  selector: 'mlv-fade-a11y-host',
  imports: [MlvFade],
  template: `
    <div mlvFade class="bare">
      <button type="button">First</button>
      <button type="button">Second</button>
    </div>

    <div mlvFade="horizontal" class="horizontal">
      <button type="button">First</button>
      <button type="button">Second</button>
    </div>

    <div mlvFade="vertical" mlvFadeSize="2em" class="vertical">
      <ul>
        <li><a href="#one">One</a></li>
        <li><a href="#two">Two</a></li>
      </ul>
    </div>
  `,
})
class FadeA11yHost {}

/**
 * Accessibility sweep — `[mlvFade]`.
 *
 * The component contributes a wrapper element, BEM classes, a
 * `data-orientation` attribute and four inline custom properties — no role, no
 * name, no tab stop of its own. What a sweep is actually asking, then, is
 * whether wrapping projected content in that element changes how the content
 * is exposed: the wrapper sits between a consumer's container and its
 * children, so it is the shape that could break an owned-children contract or
 * hide a control. Every value `mlvFade` renders is swept, because it is the one
 * input that reaches the DOM as an attribute.
 */
describe('MlvFade accessibility', () => {
  it('has no axe violations in any orientation', async () => {
    await TestBed.configureTestingModule({
      imports: [FadeA11yHost],
    }).compileComponents();
    const fixture = TestBed.createComponent(FadeA11yHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    const bare = host.querySelector('.bare') as HTMLElement;
    const horizontal = host.querySelector('.horizontal') as HTMLElement;
    const vertical = host.querySelector('.vertical') as HTMLElement;
    // State: every value `mlvFade` reaches the DOM with. A bare attribute binds
    // the empty string (which is why `''` is in the input's type) rather than
    // the `'horizontal'` default, so it renders a third `data-orientation`.
    expect(bare.getAttribute('data-orientation')).toBe('');
    expect(horizontal.getAttribute('data-orientation')).toBe('horizontal');
    expect(vertical.getAttribute('data-orientation')).toBe('vertical');
    // The wrapper stays roleless, so it never becomes an owner of its children.
    expect(bare.getAttribute('role')).toBeNull();
    expect(horizontal.getAttribute('role')).toBeNull();
    expect(vertical.getAttribute('role')).toBeNull();

    await expectNoAxeViolations(host);
  });
});
