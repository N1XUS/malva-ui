import { Component, viewChild } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import type { MlvSliderValue } from './slider';
import { MlvSlider } from './slider';

@Component({
  template: `
    <mlv-slider [range]="true" [formControl]="price" />
    <button type="button" class="outside">Apply</button>
  `,
  imports: [MlvSlider, ReactiveFormsModule],
})
class PriceHost {
  readonly price = new FormControl<MlvSliderValue>([20, 80], {
    nonNullable: true,
  });
  readonly slider = viewChild.required(MlvSlider);
}

/**
 * #347 (owner decision D22): the two-thumb slider reports touched when focus
 * leaves the slider, not when Tab moves from the low thumb to the high one.
 * Every assertion reads a primitive, so a failure never pretty-prints a
 * component.
 */
describe('MlvSlider — touched timing (#347)', () => {
  let fixture: ComponentFixture<PriceHost>;
  let host: PriceHost;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PriceHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(PriceHost);
    host = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  function thumbs(): HTMLElement[] {
    return Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(
        '.mlv-slider__thumb',
      ),
    );
  }

  function outside(): HTMLButtonElement {
    return (fixture.nativeElement as HTMLElement).querySelector(
      '.outside',
    ) as HTMLButtonElement;
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it('stays untouched and focused while focus moves from the low thumb to the high thumb', async () => {
    thumbs()[0].focus();
    await settle();
    const setFocused = vi.spyOn(host.slider(), 'setFocused');

    thumbs()[1].focus();
    await settle();

    expect(host.price.touched).toBe(false);
    expect(setFocused).not.toHaveBeenCalledWith(false);
    expect(host.slider().focused()).toBe(true);
  });

  it('marks the control touched and unfocused once focus leaves the slider', async () => {
    thumbs()[0].focus();
    thumbs()[1].focus();
    outside().focus();
    await settle();

    expect(host.price.touched).toBe(true);
    expect(host.slider().focused()).toBe(false);
  });

  describe('pointer gestures', () => {
    /** A `pointerdown` / `pointerup` stand-in jsdom accepts, with an id. */
    function pointerEvent(type: string, clientX: number): PointerEvent {
      const event = new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        button: 0,
        clientX,
      });
      Object.defineProperty(event, 'pointerId', { value: 1 });
      return event as unknown as PointerEvent;
    }

    function track(): HTMLElement {
      const element = (fixture.nativeElement as HTMLElement).querySelector(
        '.mlv-slider__track',
      ) as HTMLElement;
      vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
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
      return element;
    }

    /** The low end of the bound range value. */
    function low(): number {
      const value = host.price.value;
      return Array.isArray(value) ? value[0] : value;
    }

    // A press on a thumb focuses it (Chromium, Firefox and WebKit measured);
    // jsdom moves no focus for a dispatched event, so the spec focuses it.
    it('does not touch at the end of a thumb drag, while the thumb keeps focus', async () => {
      track();
      const thumb = thumbs()[0];
      Object.defineProperty(thumb, 'setPointerCapture', {
        configurable: true,
        value: vi.fn(),
      });
      thumb.focus();
      thumb.dispatchEvent(pointerEvent('pointerdown', 20));
      window.dispatchEvent(pointerEvent('pointermove', 30));
      window.dispatchEvent(pointerEvent('pointerup', 30));
      await settle();

      expect(low()).toBe(30);
      expect(host.price.touched).toBe(false);

      outside().focus();
      await settle();

      expect(host.price.touched).toBe(true);
    });

    // A press on the track focuses nothing inside the slider, so the end of
    // the gesture is the only report a mouse user gives.
    it('touches at the end of a track press, which leaves no focus in the slider', async () => {
      track().dispatchEvent(pointerEvent('pointerdown', 10));
      window.dispatchEvent(pointerEvent('pointerup', 10));
      await settle();

      expect(low()).toBe(10);
      expect(host.price.touched).toBe(true);
    });
  });
});
