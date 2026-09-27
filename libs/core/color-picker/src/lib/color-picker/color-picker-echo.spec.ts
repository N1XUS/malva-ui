import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import type { MockInstance } from 'vitest';
import type * as ColorUtils from '../color-utils/color-utils';
import { MlvColorPicker } from './color-picker';

// #315: an interaction emits through the `value` model and that write returns
// to the value effect. The picker recognizes its own emission and does not
// parse it back — which is what kept the hue on the grey axis
// (`color-picker-hue.spec.ts`) and also what stops each pointermove costing a
// CSS parse, a second full re-sync of the nine text-mirror signals and a
// canvas repaint for an unchanged hue.
//
// The parsers are counted through a behaviour-identical passthrough; `vi.mock`
// is hoisted above the imports, so the component resolves the counted copy.
const parses = vi.hoisted(() => ({ calls: 0 }));

vi.mock('../color-utils/color-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof ColorUtils>();
  return {
    ...actual,
    parseCssColor: (css: string) => {
      parses.calls += 1;
      return actual.parseCssColor(css);
    },
    tryParseCssColor: (css: string) => {
      parses.calls += 1;
      return actual.tryParseCssColor(css);
    },
  };
});

const PLANE = 1000;

describe('MlvColorPicker — own emission is not re-parsed (#315)', () => {
  let fixture: ComponentFixture<MlvColorPicker>;
  let syncs: MockInstance;
  let paints: MockInstance;

  beforeEach(async () => {
    // Prototype spies, installed before the instance exists, so `this._x()`
    // resolves through them.
    const proto = MlvColorPicker.prototype as unknown as Record<
      string,
      (...args: unknown[]) => unknown
    >;
    syncs = vi.spyOn(proto, '_syncFromHsla');
    paints = vi.spyOn(proto, '_drawCanvas');

    await TestBed.configureTestingModule({
      imports: [MlvColorPicker],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(MlvColorPicker);
    fixture.componentInstance.value.set('#3366ff');
    await settle();
  });

  afterEach(() => vi.restoreAllMocks());

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function resetCounts(): void {
    parses.calls = 0;
    syncs.mockClear();
    paints.mockClear();
  }

  it('parses nothing, re-syncs once and repaints nothing per plane pointermove', async () => {
    const canvas = fixture.nativeElement.querySelector(
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
    const pointer = (type: string, x: number, y: number): MouseEvent =>
      new MouseEvent(type, { bubbles: true, clientX: x, clientY: y });

    canvas.dispatchEvent(pointer('pointerdown', 500, 500));
    await settle();
    resetCounts();

    const moves = 20;
    for (let i = 1; i <= moves; i += 1) {
      document.dispatchEvent(
        pointer('pointermove', 500 + i * 20, 500 - i * 20),
      );
      await settle();
    }
    document.dispatchEvent(pointer('pointerup', 0, 0));

    // Before #315: 20 parses, 40 re-syncs, 20 repaints.
    expect(parses.calls).toBe(0);
    expect(syncs.mock.calls.length).toBe(moves);
    expect(paints.mock.calls.length).toBe(0);
  });

  it('parses nothing and paints once per hue input', async () => {
    const hue = fixture.nativeElement.querySelector(
      '.mlv-color-picker__slider-track--hue input',
    ) as HTMLInputElement;
    resetCounts();

    const inputs = 10;
    for (let i = 1; i <= inputs; i += 1) {
      hue.value = String(100 + i * 10);
      hue.dispatchEvent(new Event('input', { bubbles: true }));
      await settle();
    }

    // Before #315: 10 parses, 20 re-syncs, 20 paints.
    expect(parses.calls).toBe(0);
    expect(syncs.mock.calls.length).toBe(inputs);
    expect(paints.mock.calls.length).toBe(inputs);
  });

  it('still parses an external write', async () => {
    resetCounts();

    fixture.componentInstance.value.set('#00ff00');
    await settle();

    expect(parses.calls).toBeGreaterThan(0);
    expect(syncs.mock.calls.length).toBe(1);
  });
});
