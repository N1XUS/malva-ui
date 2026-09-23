import { vi } from 'vitest';
import { Component, signal } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvRtlService } from '@malva-ui/cdk/utils';
import { MlvSlider } from './slider';
import { MlvSliderTooltipDef } from './slider-tooltip-def';

function pointerEvent(
  type: string,
  clientX: number,
  pointerId = 1,
): PointerEvent {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    clientX,
  });
  Object.defineProperty(event, 'pointerId', { value: pointerId });
  return event as unknown as PointerEvent;
}

function domRect({
  left = 0,
  top = 0,
  width = 100,
  height = 100,
}: Partial<DOMRect> = {}): DOMRect {
  return {
    x: left,
    y: top,
    top,
    right: left + width,
    bottom: top + height,
    left,
    width,
    height,
    toJSON: () => ({}),
  } as DOMRect;
}

/** The element's bound inline `inset-inline-start`, or `''` when unset. */
function inlineStart(element: HTMLElement): string {
  return element.style.getPropertyValue('inset-inline-start');
}

describe('Slider', () => {
  let component: MlvSlider;
  let fixture: ComponentFixture<MlvSlider>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MlvSlider],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(MlvSlider);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    // `MlvRtlService` writes the direction onto <html>, which outlives the
    // TestBed injector and would otherwise leak RTL into the next test.
    TestBed.inject(MlvRtlService).setDirection('ltr');
    document.documentElement.removeAttribute('dir');
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('coerces the tooltip input and renders the current value only when enabled', () => {
    expect(component.tooltip()).toBe(false);
    expect(
      fixture.nativeElement.querySelector('.mlv-slider__tooltip'),
    ).toBeNull();

    fixture.componentRef.setInput('tooltip', '');
    fixture.componentRef.setInput('value', 42);
    fixture.detectChanges();

    const tooltip = fixture.nativeElement.querySelector(
      '.mlv-slider__tooltip',
    ) as HTMLElement;
    expect(component.tooltip()).toBe(true);
    expect(tooltip.textContent?.trim()).toBe('42');
    expect(tooltip.getAttribute('aria-hidden')).toBe('true');

    fixture.componentRef.setInput('tooltip', false);
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('.mlv-slider__tooltip'),
    ).toBeNull();
  });

  it('renders one tooltip next to each range thumb', () => {
    fixture.componentRef.setInput('tooltip', true);
    fixture.componentRef.setInput('range', true);
    fixture.componentRef.setInput('value', [20, 80]);
    fixture.detectChanges();

    const thumbs = fixture.nativeElement.querySelectorAll(
      '.mlv-slider__thumb',
    ) as NodeListOf<HTMLElement>;
    const tooltips = fixture.nativeElement.querySelectorAll(
      '.mlv-slider__tooltip',
    ) as NodeListOf<HTMLElement>;

    expect(tooltips).toHaveLength(2);
    expect(
      Array.from(tooltips, (tooltip) => tooltip.textContent?.trim()),
    ).toEqual(['20', '80']);
    expect(thumbs[0].nextElementSibling).toBe(tooltips[0]);
    expect(thumbs[1].nextElementSibling).toBe(tooltips[1]);
    expect(thumbs[0].hasAttribute('aria-describedby')).toBe(false);
    expect(thumbs[1].hasAttribute('aria-describedby')).toBe(false);
  });

  it('positions tooltip feedback along the configured orientation', () => {
    fixture.componentRef.setInput('tooltip', true);
    fixture.componentRef.setInput('value', 25);
    fixture.detectChanges();

    const horizontalTooltip = fixture.nativeElement.querySelector(
      '.mlv-slider__tooltip',
    ) as HTMLElement;
    expect(inlineStart(horizontalTooltip)).toBe('25%');
    expect(horizontalTooltip.style.bottom).toBe('');

    fixture.componentRef.setInput('orientation', 'vertical');
    fixture.detectChanges();

    const verticalTooltip = fixture.nativeElement.querySelector(
      '.mlv-slider__tooltip',
    ) as HTMLElement;
    expect(inlineStart(verticalTooltip)).toBe('');
    expect(verticalTooltip.style.left).toBe('');
    expect(verticalTooltip.style.bottom).toBe('25%');
  });

  describe('horizontal geometry is logical, like the fill (#308)', () => {
    /**
     * The fill is laid out by `inset-inline-start: var(--mlv-slider-fill-start)`
     * (pinned in `slider-styles.spec.ts`), so it starts from the right edge in RTL.
     * Every other horizontal position must hang off that same edge — a
     * physical `left` put the thumb on the opposite side of the fill it ends
     * (measured in Chrome: RTL fill 320..400, thumb centre 80 on a 400px track).
     * jsdom does no layout, so the edge is pinned on the bound property;
     * `slider-styles.spec.ts` pins the centring transforms and transitions
     * that go with it.
     */
    type Scope = 'ltr' | 'global-rtl' | 'scoped-rtl';

    async function render(scope: Scope): Promise<void> {
      if (scope === 'global-rtl') {
        TestBed.inject(MlvRtlService).setDirection('rtl');
      }
      if (scope === 'scoped-rtl') {
        (fixture.nativeElement.parentElement as HTMLElement).setAttribute(
          'dir',
          'rtl',
        );
      }
      fixture.componentRef.setInput('tooltip', true);
      fixture.componentRef.setInput('showTicks', true);
      fixture.componentRef.setInput('step', 20);
      fixture.componentRef.setInput('range', true);
      fixture.componentRef.setInput('value', [20, 60]);
      fixture.detectChanges();
      await fixture.whenStable();
    }

    afterEach(() => {
      (fixture.nativeElement.parentElement as HTMLElement).removeAttribute(
        'dir',
      );
    });

    it.each<Scope>(['ltr', 'global-rtl', 'scoped-rtl'])(
      'binds thumbs, tooltips and ticks to inset-inline-start (%s)',
      async (scope) => {
        await render(scope);
        const host = fixture.nativeElement as HTMLElement;
        if (scope === 'scoped-rtl') {
          // Only the subtree is flipped; the document stays LTR.
          expect(TestBed.inject(MlvRtlService).direction()).toBe('ltr');
        }

        const positions = (selector: string): string[] =>
          Array.from(
            host.querySelectorAll<HTMLElement>(selector),
            (element) => `${inlineStart(element)}|${element.style.left}`,
          );

        // `inset-inline-start|left` — the physical property stays unset.
        expect(positions('.mlv-slider__thumb')).toEqual(['20%|', '60%|']);
        expect(positions('.mlv-slider__tooltip')).toEqual(['20%|', '60%|']);
        expect(positions('.mlv-slider__tick')).toEqual([
          '0%|',
          '20%|',
          '40%|',
          '60%|',
          '80%|',
          '100%|',
        ]);
        // The fill's start variable is the same edge-relative percentage.
        expect(host.style.getPropertyValue('--mlv-slider-fill-start')).toBe(
          '20%',
        );
      },
    );

    it('leaves the vertical orientation on `bottom`', async () => {
      await render('scoped-rtl');
      fixture.componentRef.setInput('orientation', 'vertical');
      fixture.detectChanges();

      const thumb = fixture.nativeElement.querySelector(
        '.mlv-slider__thumb--low',
      ) as HTMLElement;
      expect(thumb.style.bottom).toBe('20%');
      expect(inlineStart(thumb)).toBe('');
      expect(thumb.style.left).toBe('');
    });
  });

  it('maps a track click from the inline-start edge in RTL', () => {
    TestBed.inject(MlvRtlService).setDirection('rtl');
    fixture.componentRef.setInput('step', 1);
    fixture.componentRef.setInput('value', 0);
    fixture.detectChanges();

    const track = fixture.nativeElement.querySelector(
      '.mlv-slider__track',
    ) as HTMLElement;
    vi.spyOn(track, 'getBoundingClientRect').mockReturnValue(
      domRect({ left: 0, width: 100 }),
    );

    // In RTL the minimum sits at the track's right edge, so a click 20px from
    // the left edge is 80% along the track, not 20%.
    track.dispatchEvent(pointerEvent('pointerdown', 20, 3));
    fixture.detectChanges();

    expect(component.value()).toBe(80);
  });

  it('mirrors arrow stepping inside a scoped [dir="rtl"] subtree while the document stays LTR', async () => {
    const scope = fixture.nativeElement.parentElement as HTMLElement;
    scope.setAttribute('dir', 'rtl');
    fixture.componentRef.setInput('step', 1);
    fixture.componentRef.setInput('value', 50);
    fixture.detectChanges();
    await fixture.whenStable();

    // The document is untouched — only this subtree is flipped.
    expect(TestBed.inject(MlvRtlService).direction()).toBe('ltr');

    const thumb = fixture.nativeElement.querySelector(
      '.mlv-slider__thumb--low',
    ) as HTMLElement;

    // ArrowRight is "previous" once the track is mirrored.
    thumb.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
    );
    fixture.detectChanges();
    expect(component.value()).toBe(49);

    thumb.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }),
    );
    fixture.detectChanges();
    expect(component.value()).toBe(50);

    // Vertical arrows and Home/End never mirror.
    thumb.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }),
    );
    fixture.detectChanges();
    expect(component.value()).toBe(51);

    thumb.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Home', bubbles: true }),
    );
    fixture.detectChanges();
    expect(component.value()).toBe(0);

    scope.removeAttribute('dir');
  });

  it('keeps arrow stepping unmirrored in an LTR island while the document is RTL', async () => {
    TestBed.inject(MlvRtlService).setDirection('rtl');
    const scope = fixture.nativeElement.parentElement as HTMLElement;
    scope.setAttribute('dir', 'ltr');
    fixture.componentRef.setInput('step', 1);
    fixture.componentRef.setInput('value', 50);
    fixture.detectChanges();
    await fixture.whenStable();

    const thumb = fixture.nativeElement.querySelector(
      '.mlv-slider__thumb--low',
    ) as HTMLElement;
    thumb.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
    );
    fixture.detectChanges();

    expect(component.value()).toBe(51);

    scope.removeAttribute('dir');
  });

  it('keeps the active thumb tooltip attached to smooth drag geometry and cleans up on pointer cancel', () => {
    fixture.componentRef.setInput('tooltip', true);
    fixture.componentRef.setInput('step', 10);
    fixture.componentRef.setInput('value', 20);
    fixture.detectChanges();

    const track = fixture.nativeElement.querySelector(
      '.mlv-slider__track',
    ) as HTMLElement;
    const thumb = fixture.nativeElement.querySelector(
      '.mlv-slider__thumb--low',
    ) as HTMLElement;
    const setPointerCapture = vi.fn();
    Object.defineProperty(thumb, 'setPointerCapture', {
      configurable: true,
      value: setPointerCapture,
    });
    vi.spyOn(track, 'getBoundingClientRect').mockReturnValue(
      domRect({ width: 100 }),
    );

    thumb.dispatchEvent(pointerEvent('pointerdown', 20, 7));
    fixture.detectChanges();

    expect(setPointerCapture).toHaveBeenCalledWith(7);
    expect(thumb.classList.contains('mlv-slider__thumb--dragging')).toBe(true);
    expect(
      fixture.nativeElement.classList.contains('mlv-slider--dragging'),
    ).toBe(true);

    window.dispatchEvent(pointerEvent('pointermove', 64, 7));
    fixture.detectChanges();

    const tooltip = fixture.nativeElement.querySelector(
      '.mlv-slider__tooltip',
    ) as HTMLElement;
    expect(tooltip.textContent?.trim()).toBe('60');
    expect(inlineStart(tooltip)).toBe('64%');

    window.dispatchEvent(pointerEvent('pointercancel', 64, 7));
    fixture.detectChanges();

    expect(thumb.classList.contains('mlv-slider__thumb--dragging')).toBe(false);
    expect(
      fixture.nativeElement.classList.contains('mlv-slider--dragging'),
    ).toBe(false);
    expect(inlineStart(tooltip)).toBe('60%');
  });
});

@Component({
  template: `
    <mlv-slider tooltip [value]="singleValue()">
      <ng-template mlvSliderTooltipDef let-value let-thumb="thumb">
        <span class="single-tooltip">{{ thumb }}:{{ value }}</span>
      </ng-template>
    </mlv-slider>

    <mlv-slider tooltip [range]="true" [value]="rangeValue()">
      <ng-template
        mlvSliderTooltipDef
        let-current
        let-value="value"
        let-thumb="thumb"
      >
        <span class="custom-tooltip">
          {{ thumb }}:{{ current }}/{{ value }}
        </span>
      </ng-template>
    </mlv-slider>
  `,
  imports: [MlvSlider, MlvSliderTooltipDef],
})
class SliderTooltipHost {
  readonly singleValue = signal(40);
  readonly rangeValue = signal<[number, number]>([10, 90]);
}

describe('MlvSliderTooltipDef', () => {
  let fixture: ComponentFixture<SliderTooltipHost>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SliderTooltipHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(SliderTooltipHost);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('renders a typed custom template for both range thumbs and updates it live', () => {
    const tooltipText = () =>
      Array.from(
        fixture.nativeElement.querySelectorAll<HTMLElement>('.custom-tooltip'),
        (tooltip) => tooltip.textContent?.replace(/\s+/g, ''),
      );

    expect(tooltipText()).toEqual(['min:10/10', 'max:90/90']);

    fixture.componentInstance.rangeValue.set([25, 75]);
    fixture.detectChanges();

    expect(tooltipText()).toEqual(['min:25/25', 'max:75/75']);
  });

  it('identifies a single slider thumb as value', () => {
    const tooltip = () =>
      fixture.nativeElement
        .querySelector<HTMLElement>('.single-tooltip')
        ?.textContent?.trim();

    expect(tooltip()).toBe('value:40');

    fixture.componentInstance.singleValue.set(55);
    fixture.detectChanges();

    expect(tooltip()).toBe('value:55');
  });
});
