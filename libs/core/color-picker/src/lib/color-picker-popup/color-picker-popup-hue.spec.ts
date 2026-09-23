import { OverlayContainer } from '@angular/cdk/overlay';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { hslaToHex } from '../color-utils/color-utils';
import { MlvColorPickerPopup } from './color-picker-popup';

// #315 through the popup: the panel's `mlv-color-picker` is fed one-way from
// the popup's draft (`[value]="_pickerValue()"`), and the popup writes every
// `colorChange` straight back into that draft — so the inner picker sees its
// own emission return as a binding write, and a color typed into the open
// field as an external one. Assertions read strings only: a failed assertion
// on a component instance hangs vitest.

const PLANE = 1000;
const BLUE_TOP_RIGHT = hslaToHex({ h: 225, s: 100, l: 50, a: 1 });

function pointer(type: string, x: number, y: number): MouseEvent {
  return new MouseEvent(type, { bubbles: true, clientX: x, clientY: y });
}

describe('MlvColorPickerPopup — inner picker hue (#315)', () => {
  let fixture: ComponentFixture<MlvColorPickerPopup>;
  let component: MlvColorPickerPopup;
  let hostEl: HTMLElement;
  let overlayContainer: OverlayContainer;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MlvColorPickerPopup],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(MlvColorPickerPopup);
    component = fixture.componentInstance;
    hostEl = fixture.nativeElement as HTMLElement;
    document.body.appendChild(hostEl);
    overlayContainer = TestBed.inject(OverlayContainer);
    component.value.set('#3366ff');
    await settle();
  });

  afterEach(() => {
    fixture.destroy();
    hostEl.remove();
    overlayContainer.ngOnDestroy();
  });

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function input(): HTMLInputElement {
    return hostEl.querySelector(
      '.mlv-color-picker-popup__input',
    ) as HTMLInputElement;
  }

  /** Drags on the open panel's canvas, settling between events. */
  async function drag(
    points: readonly (readonly [number, number])[],
  ): Promise<void> {
    const canvas = overlayContainer
      .getContainerElement()
      .querySelector('.mlv-color-picker__canvas') as HTMLCanvasElement;
    canvas.setPointerCapture = vi.fn();
    canvas.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        right: PLANE,
        bottom: PLANE,
        width: PLANE,
        height: PLANE,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;
    const [first, ...rest] = points;
    canvas.dispatchEvent(pointer('pointerdown', first[0], first[1]));
    await settle();
    for (const [x, y] of rest) {
      window.dispatchEvent(pointer('pointermove', x, y));
      await settle();
    }
    window.dispatchEvent(pointer('pointerup', 0, 0));
    await settle();
  }

  it('keeps the hue when the panel plane is dragged through black and back (live)', async () => {
    fixture.componentRef.setInput('live', true);
    (
      hostEl.querySelector(
        '.mlv-color-picker-popup__swatch-button',
      ) as HTMLButtonElement
    ).click();
    await settle();

    await drag([
      [PLANE, PLANE],
      [PLANE, 0],
    ]);

    expect(component.value()).toBe(BLUE_TOP_RIGHT);
    expect(input().value).toBe(BLUE_TOP_RIGHT);
  });

  it('keeps the panel hue when an achromatic color is typed into the open field', async () => {
    input().focus();
    await settle();

    input().value = '#ffffff';
    input().dispatchEvent(new Event('input', { bubbles: true }));
    await settle();

    await drag([[PLANE, 0]]);

    expect(input().value).toBe(BLUE_TOP_RIGHT);
  });
});
