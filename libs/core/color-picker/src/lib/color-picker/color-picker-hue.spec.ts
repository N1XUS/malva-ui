import { Component, signal, viewChild } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { form, FormField } from '@angular/forms/signals';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvColorPicker } from './color-picker';
import {
  hslaToHex,
  hslaToModeString,
  parseCssColor,
} from '../color-utils/color-utils';

// #315: the picker must keep its hue across achromatic colors. HSLA is the
// interaction state; an emitted string echoing back through the `value` model
// must not be re-parsed into it, and an external hex/rgb write of black, a
// grey or white — which cannot carry a hue — must not reset it to 0.
//
// Every assertion reads a primitive (a number or a string). A failed
// assertion on a component instance or a DOM node hangs vitest while it
// pretty-prints the object graph.

/** Plane size the stubbed canvas rect reports; pointer coords are in these units. */
const PLANE = 1000;

/** `#3366ff` — hue 225°, the color the audit's failure scenario starts from. */
const BLUE = '#3366ff';

/** The fully saturated, mid-lightness color at the plane's top-right corner. */
function topRight(hue: number): string {
  return hslaToHex({ h: hue, s: 100, l: 50, a: 1 });
}

function hueOf(picker: MlvColorPicker): number {
  return picker['_hsla']().h;
}

function alphaOf(picker: MlvColorPicker): number {
  return picker['_hsla']().a;
}

async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
}

/**
 * jsdom lays nothing out and implements no pointer capture, so the canvas
 * reports a fixed `PLANE`-sized rect at the origin and capture is stubbed.
 */
function stubCanvas(root: HTMLElement): HTMLCanvasElement {
  const canvas = root.querySelector(
    '.mlv-color-picker__canvas',
  ) as HTMLCanvasElement;
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
  return canvas;
}

/** A MouseEvent under a pointer* type name drives the same handlers in jsdom. */
function pointer(type: string, x: number, y: number): MouseEvent {
  return new MouseEvent(type, { bubbles: true, clientX: x, clientY: y });
}

/**
 * Presses at the first point and moves through the rest, letting change
 * detection (and so the `value` effect) run between every event — as a
 * browser does between frames.
 */
async function drag(
  fixture: ComponentFixture<unknown>,
  root: HTMLElement,
  points: readonly (readonly [number, number])[],
): Promise<void> {
  const canvas = stubCanvas(root);
  const [first, ...rest] = points;
  canvas.dispatchEvent(pointer('pointerdown', first[0], first[1]));
  await settle(fixture);
  for (const [x, y] of rest) {
    document.dispatchEvent(pointer('pointermove', x, y));
    await settle(fixture);
  }
  document.dispatchEvent(pointer('pointerup', 0, 0));
  await settle(fixture);
}

async function slide(
  fixture: ComponentFixture<unknown>,
  root: HTMLElement,
  track: 'hue' | 'opacity',
  value: number,
): Promise<void> {
  const input = root.querySelector(
    `.mlv-color-picker__slider-track--${track} input`,
  ) as HTMLInputElement;
  input.value = String(value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await settle(fixture);
}

async function type(
  fixture: ComponentFixture<unknown>,
  root: HTMLElement,
  ariaLabel: string,
  value: string,
): Promise<void> {
  const input = root.querySelector(
    `.mlv-color-picker__inputs input[aria-label="${ariaLabel}"]`,
  ) as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await settle(fixture);
}

async function selectTab(
  fixture: ComponentFixture<unknown>,
  root: HTMLElement,
  label: string,
): Promise<void> {
  const tab = Array.from(
    root.querySelectorAll<HTMLElement>('[role="tab"]'),
  ).find((element) => element.textContent?.trim() === label);
  tab?.click();
  await settle(fixture);
}

describe('MlvColorPicker — hue across achromatic values (#315)', () => {
  let fixture: ComponentFixture<MlvColorPicker>;
  let picker: MlvColorPicker;
  let root: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MlvColorPicker],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(MlvColorPicker);
    picker = fixture.componentInstance;
    root = fixture.nativeElement as HTMLElement;
    await settle(fixture);
  });

  async function write(value: string): Promise<void> {
    picker.value.set(value);
    await settle(fixture);
  }

  it('keeps the hue when the plane is dragged through black and back', async () => {
    await write(BLUE);
    expect(hueOf(picker)).toBe(225);

    // Bottom edge = black, then the top-right corner.
    await drag(fixture, root, [
      [PLANE, PLANE],
      [PLANE, 0],
    ]);

    expect(hueOf(picker)).toBe(225);
    expect(picker.value()).toBe(topRight(225));
  });

  it('keeps the hue when the plane is dragged through white and back', async () => {
    await write(BLUE);

    await drag(fixture, root, [
      [0, 0],
      [PLANE, 0],
    ]);

    expect(hueOf(picker)).toBe(225);
    expect(picker.value()).toBe(topRight(225));
  });

  it('moves the hue with the hue slider while the color is white', async () => {
    await write('#ffffff');

    await slide(fixture, root, 'hue', 200);
    expect(hueOf(picker)).toBe(200);

    await drag(fixture, root, [[PLANE, 0]]);
    expect(picker.value()).toBe(topRight(200));
  });

  it('keeps the exact hue near the grey axis instead of re-deriving it from the 8-bit hex', async () => {
    await slide(fixture, root, 'hue', 200);

    // 2% in from the plane's left edge at mid value: rgb(125, 127, 127),
    // whose own hue is 180°.
    await drag(fixture, root, [
      [20, PLANE / 2],
      [20, PLANE / 2 + 10],
      [20, PLANE / 2 - 10],
    ]);

    expect(hueOf(picker)).toBe(200);
    // The emitted string is still the 8-bit quantisation of the exact state.
    expect(picker.value()).toBe(hslaToHex(picker['_hsla']()));

    await drag(fixture, root, [[PLANE, 0]]);
    expect(picker.value()).toBe(topRight(200));
  });

  it('keeps the hue for an external hex or rgb write of black, a grey or white', async () => {
    await write(BLUE);

    await write('#000000');
    expect(hueOf(picker)).toBe(225);
    expect(picker['_hsla']().l).toBe(0);

    await write('rgb(128, 128, 128)');
    expect(hueOf(picker)).toBe(225);
    expect(picker['_hsla']().s).toBe(0);

    await write('#FFF');
    expect(hueOf(picker)).toBe(225);
    expect(picker['_hsla']().l).toBe(100);

    const hueSlider = root.querySelector(
      '.mlv-color-picker__slider-track--hue input',
    ) as HTMLInputElement;
    expect(hueSlider.value).toBe('225');
  });

  it('takes the hue an external hsl() write carries, achromatic or not', async () => {
    await write(BLUE);

    await write('hsl(120, 0%, 50%)');
    expect(hueOf(picker)).toBe(120);

    await write('hsl(300, 0%, 100%)');
    expect(hueOf(picker)).toBe(300);

    await write('hsl(40, 80%, 50%)');
    expect(hueOf(picker)).toBe(40);
  });

  it('applies an external write equal to an earlier emission once another write came between', async () => {
    await slide(fixture, root, 'hue', 120);
    expect(picker.value()).toBe('#00ff00');

    await write('#0000ff');
    expect(hueOf(picker)).toBe(240);

    await write('#00ff00');
    expect(hueOf(picker)).toBe(120);
  });

  // The same-color check reads the write at its own precision. The picker
  // spells alpha to 2 decimals and rgb channels as integers, so comparing the
  // two spellings would drop a write that says more than the picker's own.
  it.each([
    [
      'rgba() alpha',
      'RGB',
      'rgba(51, 102, 255, 0.13)',
      'rgba(51, 102, 255, 0.125)',
    ],
    [
      'hsla() alpha',
      'HSL',
      'hsla(225, 100%, 60%, 0.13)',
      'hsla(225, 100%, 60%, 0.125)',
    ],
  ])(
    'applies a write whose %s is finer than its own emission',
    async (_, tab, emitted, written) => {
      await write(BLUE);
      await selectTab(fixture, root, tab);
      await slide(fixture, root, 'opacity', 13);
      expect(picker.value()).toBe(emitted);

      await write(written);
      expect(alphaOf(picker)).toBe(0.125);

      await selectTab(fixture, root, 'HEX');
      expect(picker.value()).toBe('#3366ff20');
    },
  );

  it('applies a write whose hsl() hue is finer than its own emission', async () => {
    await write(BLUE);
    await selectTab(fixture, root, 'HSL');
    expect(picker.value()).toBe('hsl(225, 100%, 60%)');

    await write('hsl(225.04, 100%, 60%)');
    expect(hueOf(picker)).toBe(225.04);
  });

  it('keeps the hue when an achromatic hex or rgb value is typed, and takes a typed HSL hue', async () => {
    await write(BLUE);

    await type(fixture, root, 'Hex color value', '#000000');
    expect(hueOf(picker)).toBe(225);

    // Typing one channel at a time passes through chromatic triples, which
    // carry hues of their own; an input event on an achromatic triple is the
    // case that must not reset the hue.
    await selectTab(fixture, root, 'RGB');
    await type(fixture, root, 'Red channel', '0');
    expect(hueOf(picker)).toBe(225);

    await selectTab(fixture, root, 'HSL');
    await type(fixture, root, 'Hue', '120');
    expect(hueOf(picker)).toBe(120);
  });

  it('keeps the hue when the format changes on an achromatic color', async () => {
    await write(BLUE);
    await drag(fixture, root, [[0, 0]]);
    expect(picker.value()).toBe('#ffffff');

    await selectTab(fixture, root, 'RGB');
    expect(picker.value()).toBe('rgb(255, 255, 255)');
    expect(hueOf(picker)).toBe(225);

    await selectTab(fixture, root, 'HSL');
    expect(picker.value()).toBe('hsl(225, 0%, 100%)');
  });
});

// ---------------------------------------------------------------------------
// Consumers bound to the value
// ---------------------------------------------------------------------------

@Component({
  template: `<mlv-color-picker [(value)]="color" />`,
  imports: [MlvColorPicker],
})
class TwoWayHost {
  readonly color = signal(BLUE);
  readonly picker = viewChild.required(MlvColorPicker);
}

/** Writes each emission back through `respell` — same color, other spelling. */
@Component({
  template: `<mlv-color-picker
    [value]="color()"
    (valueChange)="color.set(respell($event))"
  />`,
  imports: [MlvColorPicker],
})
class RespellingHost {
  readonly color = signal(BLUE);
  respell: (value: string) => string = (value) => value;
  readonly picker = viewChild.required(MlvColorPicker);
}

/**
 * Refuses transparency: every emission is written back fully opaque. It starts
 * translucent, so its first write-back differs from what it held and Angular
 * re-applies the binding — a write-back equal to the parent's previous value
 * never reaches the child at all.
 */
@Component({
  template: `<mlv-color-picker
    [value]="color()"
    (valueChange)="color.set(opaque($event))"
  />`,
  imports: [MlvColorPicker],
})
class OpaqueHost {
  readonly color = signal(`${BLUE}80`);
  readonly picker = viewChild.required(MlvColorPicker);
  opaque(value: string): string {
    return value.length === 9 ? value.slice(0, 7) : value;
  }
}

@Component({
  template: `<mlv-color-picker [formControl]="control" />`,
  imports: [MlvColorPicker, ReactiveFormsModule],
})
class ReactiveHost {
  readonly control = new FormControl(BLUE, { nonNullable: true });
  readonly picker = viewChild.required(MlvColorPicker);
}

@Component({
  template: `<mlv-color-picker [formField]="fields.color" />`,
  imports: [MlvColorPicker, FormField],
})
class SignalFormsHost {
  readonly model = signal({ color: BLUE });
  readonly fields = form(this.model);
  readonly picker = viewChild.required(MlvColorPicker);
}

describe('MlvColorPicker — hue with a bound consumer (#315)', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
  });

  async function mount<T>(host: new () => T): Promise<ComponentFixture<T>> {
    const fixture = TestBed.createComponent(host);
    await settle(fixture);
    return fixture;
  }

  it('does not re-parse its own emission coming back through [(value)]', async () => {
    const fixture = await mount(TwoWayHost);
    const root = fixture.nativeElement as HTMLElement;

    await drag(fixture, root, [
      [PLANE, PLANE],
      [PLANE, 0],
    ]);

    expect(hueOf(fixture.componentInstance.picker())).toBe(225);
    expect(fixture.componentInstance.color()).toBe(topRight(225));
  });

  it.each([
    ['upper-cased hex', (value: string) => value.toUpperCase()],
    ['rgb()', (value: string) => hslaToModeString(parseCssColor(value), 'rgb')],
  ])(
    'keeps its exact state when the consumer writes the same color back as %s',
    async (_, respell) => {
      const fixture = await mount(RespellingHost);
      fixture.componentInstance.respell = respell;
      const root = fixture.nativeElement as HTMLElement;

      // Half a percent in from white: `#fefeff` / rgb(254, 254, 255), whose
      // own hue is 240°. Re-parsing the respelled string would take that hue.
      await drag(fixture, root, [
        [5, 0],
        [PLANE, 0],
      ]);

      expect(hueOf(fixture.componentInstance.picker())).toBe(225);
      expect(fixture.componentInstance.color()).toBe(respell(topRight(225)));
    },
  );

  it('applies a consumer write that changes the emitted color', async () => {
    const fixture = await mount(OpaqueHost);
    const root = fixture.nativeElement as HTMLElement;

    expect(alphaOf(fixture.componentInstance.picker())).toBe(0.5);

    // Emits `#33ff3380`; the consumer writes `#33ff33` back.
    await slide(fixture, root, 'hue', 120);

    expect(fixture.componentInstance.color()).toBe('#33ff33');
    expect(alphaOf(fixture.componentInstance.picker())).toBe(1);
    expect(hueOf(fixture.componentInstance.picker())).toBe(120);
  });

  it('keeps the hue through reactive-forms writes and echoes', async () => {
    const fixture = await mount(ReactiveHost);
    const root = fixture.nativeElement as HTMLElement;
    const { control } = fixture.componentInstance;

    await drag(fixture, root, [
      [PLANE, PLANE],
      [PLANE, 0],
    ]);
    expect(control.value).toBe(topRight(225));

    control.setValue('#808080');
    await settle(fixture);
    expect(hueOf(fixture.componentInstance.picker())).toBe(225);

    await drag(fixture, root, [[PLANE, 0]]);
    expect(control.value).toBe(topRight(225));
  });

  it('keeps the hue through [formField] writes and echoes', async () => {
    const fixture = await mount(SignalFormsHost);
    const root = fixture.nativeElement as HTMLElement;
    const { fields, model } = fixture.componentInstance;

    await drag(fixture, root, [
      [PLANE, PLANE],
      [PLANE, 0],
    ]);
    expect(fields.color().value()).toBe(topRight(225));

    model.set({ color: '#ffffff' });
    await settle(fixture);
    expect(hueOf(fixture.componentInstance.picker())).toBe(225);

    await drag(fixture, root, [[PLANE, 0]]);
    expect(fields.color().value()).toBe(topRight(225));
  });
});
