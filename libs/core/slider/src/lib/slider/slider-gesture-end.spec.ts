import { Component, DestroyRef, viewChild } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import type { MlvSliderValue } from './slider';
import { MlvSlider } from './slider';

/** jsdom ships no `PointerEvent`; the repo builds them from `MouseEvent`. */
function pointerEvent(
  type: string,
  clientX: number,
  pointerId = 1,
  button = 0,
): PointerEvent {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button,
    clientX,
  });
  Object.defineProperty(event, 'pointerId', { value: pointerId });
  return event as unknown as PointerEvent;
}

@Component({
  template: `
    <mlv-slider
      [range]="true"
      [step]="10"
      [formControl]="price"
      (valueChange)="emits = emits + 1"
    />
  `,
  imports: [MlvSlider, ReactiveFormsModule],
})
class PriceHost {
  readonly price = new FormControl<MlvSliderValue>([20, 80], {
    nonNullable: true,
  });
  readonly slider = viewChild.required(MlvSlider);
  emits = 0;
}

/**
 * #338 — the slider's drag listeners were `Renderer2.listen('window', …)`
 * disposers with one `DestroyRef.onDestroy` registered per drag and never
 * released, and every range write went out twice: the setter wrote a new
 * tuple, then `_emitChange()` wrote another, so a drag inside one step still
 * sent two identical values per pointer move into `valueChange` and the bound
 * `FormControl`. Every assertion reads a primitive.
 */
describe('MlvSlider — drag gesture end and emissions (#338)', () => {
  let fixture: ComponentFixture<PriceHost>;
  let host: PriceHost;
  let valueChanges: number;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PriceHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(PriceHost);
    host = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();

    const track = (fixture.nativeElement as HTMLElement).querySelector(
      '.mlv-slider__track',
    ) as HTMLElement;
    vi.spyOn(track, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 100,
      bottom: 10,
      width: 100,
      height: 10,
      toJSON: () => ({}),
    } as DOMRect);
    for (const thumb of thumbs()) {
      Object.defineProperty(thumb, 'setPointerCapture', {
        configurable: true,
        value: vi.fn(),
      });
    }

    valueChanges = 0;
    host.price.valueChanges.subscribe(() => valueChanges++);
    host.emits = 0;
  });

  afterEach(() => vi.restoreAllMocks());

  function thumbs(): HTMLElement[] {
    return Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(
        '.mlv-slider__thumb',
      ),
    );
  }

  function dragging(): boolean {
    return (
      (fixture.nativeElement as HTMLElement)
        .querySelector('mlv-slider')
        ?.classList.contains('mlv-slider--dragging') ?? false
    );
  }

  function high(): number {
    const value = host.price.value;
    return Array.isArray(value) ? value[1] : value;
  }

  /**
   * Counts `onDestroy` registrations still live on the component's
   * `DestroyRef` — registered and not yet unregistered — which is what a
   * finished drag must leave unchanged.
   */
  function trackLiveDestroyRegistrations(): () => number {
    const ref = fixture.debugElement
      .query(By.directive(MlvSlider))
      .injector.get(DestroyRef);
    const proto = Object.getPrototypeOf(ref) as DestroyRef;
    const original = proto.onDestroy;
    let live = 0;
    vi.spyOn(proto, 'onDestroy').mockImplementation(function (
      this: DestroyRef,
      callback: () => void,
    ) {
      live++;
      const unregister = original.call(this, callback);
      let released = false;
      return () => {
        if (!released) live--;
        released = true;
        unregister();
      };
    });
    return () => live;
  }

  it('emits nothing for a range drag that stays inside one step', async () => {
    const thumb = thumbs()[1];
    thumb.dispatchEvent(pointerEvent('pointerdown', 80));
    for (let i = 1; i <= 10; i++) {
      window.dispatchEvent(pointerEvent('pointermove', 80 + i * 0.4));
    }
    window.dispatchEvent(pointerEvent('pointerup', 84));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(high()).toBe(80);
    expect(host.emits).toBe(0);
    expect(valueChanges).toBe(0);
  });

  it('emits once per step a range drag crosses', async () => {
    const thumb = thumbs()[1];
    thumb.dispatchEvent(pointerEvent('pointerdown', 80));
    window.dispatchEvent(pointerEvent('pointermove', 90));
    window.dispatchEvent(pointerEvent('pointerup', 90));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(high()).toBe(90);
    expect(host.emits).toBe(1);
    expect(valueChanges).toBe(1);
  });

  it('emits once for one arrow key in range mode', async () => {
    thumbs()[0].dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
    );
    fixture.detectChanges();
    await fixture.whenStable();

    expect(host.price.value).toEqual([30, 80]);
    expect(host.emits).toBe(1);
    expect(valueChanges).toBe(1);
  });

  it('emits once for a track press in range mode', async () => {
    const track = (fixture.nativeElement as HTMLElement).querySelector(
      '.mlv-slider__track',
    ) as HTMLElement;
    track.dispatchEvent(pointerEvent('pointerdown', 90));
    window.dispatchEvent(pointerEvent('pointerup', 90));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(host.price.value).toEqual([20, 90]);
    expect(host.emits).toBe(1);
    expect(valueChanges).toBe(1);
  });

  it.each([
    ['track', 1],
    ['track', 2],
    ['thumb', 1],
    ['thumb', 2],
  ] as const)(
    'moves nothing and starts no drag on a %s press with button %i',
    async (where, button) => {
      const add = vi.spyOn(window, 'addEventListener');
      const target =
        where === 'track'
          ? ((fixture.nativeElement as HTMLElement).querySelector(
              '.mlv-slider__track',
            ) as HTMLElement)
          : thumbs()[1];
      target.dispatchEvent(pointerEvent('pointerdown', 90, 1, button));
      window.dispatchEvent(pointerEvent('pointermove', 90, 1, button));
      window.dispatchEvent(pointerEvent('pointerup', 90, 1, button));
      fixture.detectChanges();
      await fixture.whenStable();

      expect(host.price.value).toEqual([20, 80]);
      expect(host.emits).toBe(0);
      expect(valueChanges).toBe(0);
      expect(dragging()).toBe(false);
      expect(
        add.mock.calls.filter(([type]) => String(type).startsWith('pointer'))
          .length,
      ).toBe(0);
    },
  );

  it('leaves no DestroyRef registration behind per drag', () => {
    const live = trackLiveDestroyRegistrations();
    const thumb = thumbs()[1];
    const drag = (): void => {
      thumb.dispatchEvent(pointerEvent('pointerdown', 80));
      window.dispatchEvent(pointerEvent('pointermove', 90));
      window.dispatchEvent(pointerEvent('pointerup', 90));
    };

    // Measured after one drag, not from zero: the focus-leave report keeps one
    // press window open for 500 ms after a `pointerup` no click follows, and
    // each press replaces the last — a constant, not a per-drag growth.
    drag();
    const afterOne = live();
    drag();
    drag();

    expect(live()).toBe(afterOne);
  });

  it('ends the drag when the thumb loses pointer capture', async () => {
    const thumb = thumbs()[1];
    thumb.dispatchEvent(pointerEvent('pointerdown', 80));
    window.dispatchEvent(pointerEvent('pointermove', 90));
    fixture.detectChanges();
    expect(dragging()).toBe(true);

    thumb.dispatchEvent(pointerEvent('lostpointercapture', 90));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(dragging()).toBe(false);
    // A press on the thumb focuses nothing here (jsdom), so the gesture end
    // is the touch report, exactly as on pointerup (#347).
    expect(host.price.touched).toBe(true);

    window.dispatchEvent(pointerEvent('pointermove', 60));
    expect(high()).toBe(90);
  });

  it('releases the window listeners when destroyed mid-drag', () => {
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');
    const thumb = thumbs()[1];
    thumb.dispatchEvent(pointerEvent('pointerdown', 80));
    const attached = add.mock.calls.filter(([type]) =>
      String(type).startsWith('pointer'),
    ).length;
    expect(attached).toBeGreaterThan(0);

    fixture.destroy();

    const detached = remove.mock.calls.filter(([type]) =>
      String(type).startsWith('pointer'),
    ).length;
    expect(detached).toBe(attached);
  });
});
