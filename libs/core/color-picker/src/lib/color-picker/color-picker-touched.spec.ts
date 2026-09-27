import { Component } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvColorPicker } from './color-picker';

@Component({
  template: `
    <mlv-color-picker [formControl]="color" />
    <button type="button" class="outside">Save</button>
  `,
  imports: [MlvColorPicker, ReactiveFormsModule],
})
class BrandHost {
  readonly color = new FormControl('#ff0000', { nonNullable: true });
}

/**
 * #347 (owner decision D22): the picker's host `focusout` reported touched on
 * every move between its own parts — the hue strip, the format tabs, the
 * channel fields. It now reports touched once focus has left the picker.
 * Every assertion reads a primitive, so a failure never pretty-prints a
 * component.
 */
describe('MlvColorPicker — touched timing (#347)', () => {
  let fixture: ComponentFixture<BrandHost>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BrandHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(BrandHost);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  function query<T extends HTMLElement>(selector: string): T {
    return (fixture.nativeElement as HTMLElement).querySelector(selector) as T;
  }

  function hue(): HTMLInputElement {
    return query('.mlv-color-picker__slider-track--hue input');
  }

  function channelField(): HTMLInputElement {
    return query('mlv-color-picker .mlv-input__native');
  }

  it('does not touch when focus moves between two parts of the picker', async () => {
    hue().focus();
    channelField().focus();
    hue().focus();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.color.touched).toBe(false);
  });

  it('marks the control touched once focus leaves the picker', async () => {
    hue().focus();
    channelField().focus();
    query<HTMLButtonElement>('.outside').focus();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.color.touched).toBe(true);
  });

  describe('a drag on the saturation / lightness plane', () => {
    /** The plane, measured as a 100px square with pointer capture stubbed. */
    function canvas(): HTMLCanvasElement {
      const element = query<HTMLCanvasElement>('.mlv-color-picker__canvas');
      element.setPointerCapture = vi.fn();
      element.getBoundingClientRect = () =>
        ({
          left: 0,
          top: 0,
          right: 100,
          bottom: 100,
          width: 100,
          height: 100,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        }) as DOMRect;
      return element;
    }

    async function drag(): Promise<void> {
      const pointer = (type: string, x: number): MouseEvent =>
        new MouseEvent(type, { bubbles: true, clientX: x, clientY: 50 });
      canvas().dispatchEvent(pointer('pointerdown', 20));
      document.dispatchEvent(pointer('pointermove', 60));
      document.dispatchEvent(pointer('pointerup', 60));
      fixture.detectChanges();
      await fixture.whenStable();
    }

    // The canvas press is `preventDefault()`ed, so focus stays where it was
    // (Chromium, Firefox and WebKit measured) — here, on the hue strip.
    it('does not touch at its end while one of its own inputs keeps focus', async () => {
      hue().focus();
      const before = fixture.componentInstance.color.value;

      await drag();

      expect(fixture.componentInstance.color.value === before).toBe(false);
      expect(fixture.componentInstance.color.touched).toBe(false);

      query<HTMLButtonElement>('.outside').focus();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(fixture.componentInstance.color.touched).toBe(true);
    });

    it('touches at its end when focus is outside the picker', async () => {
      query<HTMLButtonElement>('.outside').focus();

      await drag();

      expect(fixture.componentInstance.color.touched).toBe(true);
    });
  });
});
