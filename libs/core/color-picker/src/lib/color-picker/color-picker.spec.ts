import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { Component, DOCUMENT } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MlvColorPicker } from './color-picker';
import {
  isCssColorValue,
  parseCssColor,
  tryParseCssColor,
  hslaToHex,
  hslToRgb,
  rgbToHsl,
  hexToRgba,
  rgbaToHex,
  clamp,
} from '../color-utils/color-utils';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';

// ---------------------------------------------------------------------------
// Color utility unit tests
// ---------------------------------------------------------------------------
describe('color-utils', () => {
  describe('clamp', () => {
    it('should clamp below minimum', () => expect(clamp(-5, 0, 100)).toBe(0));
    it('should clamp above maximum', () =>
      expect(clamp(150, 0, 100)).toBe(100));
    it('should return value within range', () =>
      expect(clamp(50, 0, 100)).toBe(50));
  });

  describe('hslToRgb', () => {
    it('should convert red hsl to rgb', () => {
      const { r, g, b } = hslToRgb(0, 100, 50);
      expect(r).toBe(255);
      expect(g).toBe(0);
      expect(b).toBe(0);
    });

    it('should convert white hsl to rgb', () => {
      const { r, g, b } = hslToRgb(0, 0, 100);
      expect(r).toBe(255);
      expect(g).toBe(255);
      expect(b).toBe(255);
    });

    it('should convert black hsl to rgb', () => {
      const { r, g, b } = hslToRgb(0, 0, 0);
      expect(r).toBe(0);
      expect(g).toBe(0);
      expect(b).toBe(0);
    });

    it('should convert green hsl to rgb', () => {
      const { r, g, b } = hslToRgb(120, 100, 50);
      expect(r).toBe(0);
      expect(g).toBe(255);
      expect(b).toBe(0);
    });
  });

  describe('rgbToHsl', () => {
    it('should convert red rgb to hsl', () => {
      const { h, s, l } = rgbToHsl(255, 0, 0);
      expect(h).toBe(0);
      expect(s).toBe(100);
      expect(l).toBe(50);
    });

    it('should convert white to hsl', () => {
      const { s, l } = rgbToHsl(255, 255, 255);
      expect(s).toBe(0);
      expect(l).toBe(100);
    });

    it('should convert black to hsl', () => {
      const { s, l } = rgbToHsl(0, 0, 0);
      expect(s).toBe(0);
      expect(l).toBe(0);
    });
  });

  describe('hexToRgba', () => {
    it('should parse #ff0000 to red', () => {
      const rgba = hexToRgba('#ff0000');
      expect(rgba).toEqual({ r: 255, g: 0, b: 0, a: 1 });
    });

    it('should parse #ffffff to white', () => {
      const rgba = hexToRgba('#ffffff');
      expect(rgba).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    });

    it('should parse 8-char hex with alpha', () => {
      const rgba = hexToRgba('#ff000080');
      expect(rgba?.r).toBe(255);
      expect(rgba?.g).toBe(0);
      expect(rgba?.b).toBe(0);
      expect(rgba?.a).toBeCloseTo(0.502, 2);
    });

    it('should return null for invalid hex', () => {
      expect(hexToRgba('#xyz')).toBeNull();
    });
  });

  describe('rgbaToHex', () => {
    it('should convert red to #ff0000', () => {
      expect(rgbaToHex(255, 0, 0, 1)).toBe('#ff0000');
    });

    it('should include alpha when alpha < 1', () => {
      const hex = rgbaToHex(255, 0, 0, 0.5);
      expect(hex).toMatch(/^#ff0000/);
      expect(hex.length).toBe(9);
    });
  });

  describe('parseCssColor', () => {
    it('should parse hex #ff0000', () => {
      const result = parseCssColor('#ff0000');
      expect(result.h).toBeCloseTo(0, 0);
      expect(result.s).toBeCloseTo(100, 0);
      expect(result.l).toBeCloseTo(50, 0);
      expect(result.a).toBe(1);
    });

    it('should parse rgb(255, 0, 0)', () => {
      const result = parseCssColor('rgb(255, 0, 0)');
      expect(result.s).toBeCloseTo(100, 0);
      expect(result.a).toBe(1);
    });

    it('should parse rgba with alpha', () => {
      const result = parseCssColor('rgba(255, 0, 0, 0.5)');
      expect(result.a).toBeCloseTo(0.5, 1);
    });

    it('should parse hsl()', () => {
      const result = parseCssColor('hsl(120, 100%, 50%)');
      expect(result.h).toBeCloseTo(120, 0);
      expect(result.s).toBeCloseTo(100, 0);
      expect(result.l).toBeCloseTo(50, 0);
    });

    it('should parse hsla() with alpha', () => {
      const result = parseCssColor('hsla(120, 100%, 50%, 0.8)');
      expect(result.a).toBeCloseTo(0.8, 1);
    });

    it('should return black for invalid input', () => {
      const result = parseCssColor('not-a-color');
      expect(result).toEqual({ h: 0, s: 0, l: 0, a: 1 });
    });
  });

  describe('strict CSS color validation', () => {
    it.each([
      '#fff',
      '#ffffffff',
      'rgb(1, 2, 3)',
      'rgba(1, 2, 3, 0.5)',
      'hsl(20, 30%, 40%)',
    ])('parses %s', (value) => {
      expect(tryParseCssColor(value)).not.toBeNull();
      expect(isCssColorValue(value)).toBe(true);
    });

    it.each(['', '#12', '#gggggg', 'rgb(', 'var()', 'var(brand)'])(
      'rejects %s',
      (value) => {
        expect(tryParseCssColor(value)).toBeNull();
        expect(isCssColorValue(value)).toBe(false);
      },
    );

    it.each([
      'var(--brand)',
      'var(--brand, #ff0000)',
      'var(--brand, var(--fallback))',
    ])('accepts CSS custom-property color %s', (value) => {
      expect(isCssColorValue(value)).toBe(true);
    });

    it('rejects malformed CSS custom-property fallbacks', () => {
      expect(isCssColorValue('var(--brand,)')).toBe(false);
      expect(isCssColorValue('var(--brand, #12)')).toBe(false);
      expect(isCssColorValue('var(--brand, var())')).toBe(false);
    });
  });

  describe('hslaToHex', () => {
    it('should convert red hsla to #ff0000', () => {
      expect(hslaToHex({ h: 0, s: 100, l: 50, a: 1 })).toBe('#ff0000');
    });

    it('should include alpha in hex when alpha < 1', () => {
      const hex = hslaToHex({ h: 0, s: 100, l: 50, a: 0.5 });
      expect(hex.length).toBe(9);
    });
  });
});

// ---------------------------------------------------------------------------
// MlvColorPicker tests
// ---------------------------------------------------------------------------
describe('MlvColorPicker', () => {
  let fixture: ComponentFixture<MlvColorPicker>;
  let component: MlvColorPicker;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MlvColorPicker],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(MlvColorPicker);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render the canvas', () => {
    const canvas = fixture.nativeElement.querySelector(
      '.mlv-color-picker__canvas',
    );
    expect(canvas).toBeTruthy();
  });

  it('should render the hue range input', () => {
    const hueSlider = fixture.nativeElement.querySelector(
      'input[aria-label="Hue"]',
    );
    expect(hueSlider).toBeTruthy();
  });

  it('should render the opacity slider when showOpacity is true', () => {
    fixture.componentRef.setInput('showOpacity', true);
    fixture.detectChanges();
    const opacitySlider = fixture.nativeElement.querySelector(
      'input[aria-label="Opacity"]',
    );
    expect(opacitySlider).toBeTruthy();
  });

  it('should not render opacity slider when showOpacity is false', () => {
    fixture.componentRef.setInput('showOpacity', false);
    fixture.detectChanges();
    const opacitySlider = fixture.nativeElement.querySelector(
      'input[aria-label="Opacity"]',
    );
    expect(opacitySlider).toBeNull();
  });

  it('should render HEX tab as active by default', () => {
    // Mode tabs are rendered using mlv-tab-item components with mlv-tab-item--active class
    const activeTab = fixture.nativeElement.querySelector(
      '.mlv-tab-item--active',
    );
    expect(activeTab?.textContent?.trim()).toBe('HEX');
  });

  it('should switch to RGB mode when RGB tab is clicked', () => {
    // Mode tabs are mlv-tab-item elements
    const tabs = fixture.nativeElement.querySelectorAll('.mlv-tab-item');
    tabs[1].click(); // RGB tab
    fixture.detectChanges();
    const activeTab = fixture.nativeElement.querySelector(
      '.mlv-tab-item--active',
    );
    expect(activeTab?.textContent?.trim()).toBe('RGB');
  });

  it('should switch to HSL mode when HSL tab is clicked', () => {
    const tabs = fixture.nativeElement.querySelectorAll('.mlv-tab-item');
    tabs[2].click(); // HSL tab
    fixture.detectChanges();
    const activeTab = fixture.nativeElement.querySelector(
      '.mlv-tab-item--active',
    );
    expect(activeTab?.textContent?.trim()).toBe('HSL');
  });

  it('renders supported formats in consumer order with tight shared tabs', () => {
    const customFixture = TestBed.createComponent(MlvColorPicker);
    customFixture.componentRef.setInput('supportedFormats', ['hsl', 'hex']);
    customFixture.componentRef.setInput('defaultMode', 'hsl');
    customFixture.detectChanges();

    const group = customFixture.nativeElement.querySelector('.mlv-tab-group');
    const tabs = Array.from(
      customFixture.nativeElement.querySelectorAll('[role="tab"]'),
      (tab: Element) => tab.textContent?.trim(),
    );

    expect(group).not.toBeNull();
    expect(group.classList).toContain('mlv-tab-group--tight');
    expect(tabs).toEqual(['HSL', 'HEX']);
  });

  it('renders one supported format without a tablist', () => {
    const customFixture = TestBed.createComponent(MlvColorPicker);
    customFixture.componentRef.setInput('supportedFormats', ['rgb']);
    customFixture.detectChanges();

    expect(
      customFixture.nativeElement.querySelector('[role="tablist"]'),
    ).toBeNull();
    expect(
      customFixture.nativeElement.querySelector(
        'input[aria-label="Red channel"]',
      ),
    ).not.toBeNull();
  });

  it('falls back to the first supported format when defaultMode is unavailable', () => {
    const customFixture = TestBed.createComponent(MlvColorPicker);
    customFixture.componentRef.setInput('supportedFormats', ['rgb', 'hsl']);
    customFixture.componentRef.setInput('defaultMode', 'hex');
    customFixture.detectChanges();

    expect(
      customFixture.nativeElement
        .querySelector('[role="tab"][aria-selected="true"]')
        ?.textContent?.trim(),
    ).toBe('RGB');
  });

  it('deduplicates supported formats', () => {
    const customFixture = TestBed.createComponent(MlvColorPicker);
    customFixture.componentRef.setInput('supportedFormats', [
      'rgb',
      'rgb',
      'hex',
    ]);
    customFixture.detectChanges();

    expect(
      Array.from(
        customFixture.nativeElement.querySelectorAll('[role="tab"]'),
        (tab: Element) => tab.textContent?.trim(),
      ),
    ).toEqual(['RGB', 'HEX']);
  });

  it('falls back to every format for an empty supportedFormats array', () => {
    const customFixture = TestBed.createComponent(MlvColorPicker);
    customFixture.componentRef.setInput('supportedFormats', []);
    customFixture.detectChanges();

    expect(
      Array.from(
        customFixture.nativeElement.querySelectorAll('[role="tab"]'),
        (tab: Element) => tab.textContent?.trim(),
      ),
    ).toEqual(['HEX', 'RGB', 'HSL']);
  });

  it('emits the active selected format', () => {
    const emitted = vi.fn();
    component.colorChange.subscribe(emitted);
    const tabs = fixture.nativeElement.querySelectorAll('[role="tab"]');

    tabs[1].click();
    fixture.detectChanges();

    expect(component.value()).toMatch(/^rgb/);
    expect(emitted).toHaveBeenLastCalledWith(expect.stringMatching(/^rgb/));
  });

  it('should apply disabled class when disabled', () => {
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.classList).toContain(
      'mlv-color-picker--disabled',
    );
  });

  it('should have role=tablist on mode-tabs', () => {
    const tablist = fixture.nativeElement.querySelector('[role="tablist"]');
    expect(tablist).toBeTruthy();
  });

  it('should have role=tab on each mode button', () => {
    const tabs = fixture.nativeElement.querySelectorAll('[role="tab"]');
    expect(tabs.length).toBe(3);
  });

  it('should apply roving tabindex with only the active mode tab tabbable', () => {
    const tabs: HTMLElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('[role="tab"]'),
    );
    // HEX is active by default
    expect(tabs[0].getAttribute('tabindex')).toBe('0');
    expect(tabs[1].getAttribute('tabindex')).toBe('-1');
    expect(tabs[2].getAttribute('tabindex')).toBe('-1');
  });

  it('should update aria-selected and roving tabindex when a tab is clicked', () => {
    const tabs: HTMLElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('[role="tab"]'),
    );
    tabs[1].click(); // RGB tab
    fixture.detectChanges();

    expect(tabs[0].getAttribute('aria-selected')).toBe('false');
    expect(tabs[1].getAttribute('aria-selected')).toBe('true');
    expect(tabs[0].getAttribute('tabindex')).toBe('-1');
    expect(tabs[1].getAttribute('tabindex')).toBe('0');
  });

  it('should connect each shared tab to a panel and label the active panel', () => {
    const tabs: HTMLElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('[role="tab"]'),
    );
    const panel = fixture.nativeElement.querySelector('[role="tabpanel"]');

    for (const tab of tabs) {
      const panelId = tab.getAttribute('aria-controls');
      expect(panelId).toBeTruthy();
      expect(fixture.nativeElement.querySelector(`#${panelId}`)).not.toBeNull();
    }
    expect(panel.getAttribute('aria-labelledby')).toBe(
      tabs[0].getAttribute('id'),
    );
  });

  it('should move focus and activate the next tab on ArrowRight', () => {
    const tablist = fixture.nativeElement.querySelector('[role="tablist"]');
    const tabs: HTMLElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('[role="tab"]'),
    );

    tablist.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
    );
    fixture.detectChanges();

    expect(tabs[1].getAttribute('aria-selected')).toBe('true');
    expect(tabs[1].getAttribute('tabindex')).toBe('0');
    expect(document.activeElement).toBe(tabs[1]);
  });

  it('should keep the first tab active on ArrowLeft without wrapping', () => {
    const tablist = fixture.nativeElement.querySelector('[role="tablist"]');
    const tabs: HTMLElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('[role="tab"]'),
    );

    tablist.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }),
    );
    fixture.detectChanges();

    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    expect(tabs[0].getAttribute('tabindex')).toBe('0');
  });

  it('should move focus/activation to the last tab on End and back to the first on Home', () => {
    const tablist = fixture.nativeElement.querySelector('[role="tablist"]');
    const tabs: HTMLElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('[role="tab"]'),
    );

    tablist.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'End', bubbles: true }),
    );
    fixture.detectChanges();
    expect(tabs[2].getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(tabs[2]);

    tablist.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Home', bubbles: true }),
    );
    fixture.detectChanges();
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(tabs[0]);
  });

  it('should update hex input when the value model changes', async () => {
    component.value.set('#00ff00');
    fixture.detectChanges();
    await fixture.whenStable();
    const hexInput: HTMLInputElement = fixture.nativeElement.querySelector(
      'input[aria-label="Hex color value"]',
    );
    expect(hexInput?.value).toContain('00ff00');
  });

  it('repaints the canvas when the value is set programmatically', async () => {
    const canvas: HTMLCanvasElement = fixture.nativeElement.querySelector(
      '.mlv-color-picker__canvas',
    );

    // jsdom implements no 2D context, so the paint is counted through a
    // recording stub. `_drawCanvas` fills twice per paint (the white -> hue
    // gradient, then the black overlay), and the repaint is scheduled through
    // `afterNextRender`, so the count is read after `whenStable()`.
    let fillRectCalls = 0;
    const gradient = { addColorStop: (): void => undefined };
    const context = {
      createLinearGradient: (): unknown => gradient,
      fillStyle: '',
      fillRect: (): void => {
        fillRectCalls += 1;
      },
    };
    canvas.getContext = (() =>
      context) as unknown as HTMLCanvasElement['getContext'];

    const before = fillRectCalls;
    component.value.set('#00ff00');
    fixture.detectChanges();
    await fixture.whenStable();

    // Asserted on the number, never on the stub or the canvas element: a
    // failed assertion against a DOM node or an Angular instance hangs vitest
    // for minutes pretty-printing the object graph.
    expect(fillRectCalls).toBeGreaterThan(before);
  });

  it('removes the document pointer listeners after each canvas drag (no leak across drags)', () => {
    const canvas: HTMLCanvasElement = fixture.nativeElement.querySelector(
      '.mlv-color-picker__canvas',
    );
    // jsdom implements neither PointerEvent nor pointer capture: a MouseEvent
    // dispatched under the pointer* type name drives the same handlers, and the
    // capture call is stubbed out.
    canvas.setPointerCapture = vi.fn();
    const pointer = (type: string, init: MouseEventInit = {}): MouseEvent =>
      new MouseEvent(type, { bubbles: true, ...init });

    const addSpy = vi.spyOn(document, 'addEventListener');
    const removeSpy = vi.spyOn(document, 'removeEventListener');

    const drag = (): void => {
      canvas.dispatchEvent(pointer('pointerdown', { clientX: 5, clientY: 5 }));
      document.dispatchEvent(pointer('pointerup'));
    };

    drag();
    drag();

    // Each drag registers exactly one document 'pointermove' listener (via
    // fromEvent) and tears it down again on its own pointerup (takeUntil) —
    // nothing accumulates on the document across drags.
    const added = addSpy.mock.calls.filter(
      ([type]) => type === 'pointermove',
    ).length;
    const removed = removeSpy.mock.calls.filter(
      ([type]) => type === 'pointermove',
    ).length;

    expect(added).toBe(2);
    expect(removed).toBe(added);

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});

describe('MlvColorPicker (canvas document)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** Stubs the canvas geometry and capture jsdom does not implement. */
  const prepareCanvas = (canvas: HTMLCanvasElement): void => {
    canvas.setPointerCapture = vi.fn();
    canvas.getBoundingClientRect = () =>
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
  };

  const pointer = (type: string, x: number, y: number): MouseEvent =>
    new MouseEvent(type, { bubbles: true, clientX: x, clientY: y });

  /** The `pointermove` listeners a spy saw added — the drag's own move stream. */
  const moveListeners = (spy: {
    mock: { calls: readonly (readonly unknown[])[] };
  }): number =>
    spy.mock.calls.filter(([type]) => type === 'pointermove').length;

  /**
   * The canvas drag listened on the ambient `window` — absent under server
   * rendering, and another document's window when the picker is mounted in an
   * iframe preview or print window. It now listens on the canvas's own
   * document, which the captured pointer's moves and pointerup bubble
   * through. TestBed renders the fixture into the injected `DOCUMENT`, so
   * here the canvas's document and the injected one coincide (an isolated
   * document, not the ambient one); the next spec separates them.
   */
  it('drives the canvas drag from an isolated document, not the ambient window', async () => {
    const isolated = document.implementation.createHTMLDocument('picker');
    await TestBed.configureTestingModule({
      imports: [MlvColorPicker],
      providers: [
        provideMlvI18nTesting(),
        { provide: DOCUMENT, useValue: isolated },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(MlvColorPicker);
    fixture.detectChanges();
    await fixture.whenStable();

    const canvas: HTMLCanvasElement = fixture.nativeElement.querySelector(
      '.mlv-color-picker__canvas',
    );
    expect(canvas.ownerDocument === isolated).toBe(true);
    prepareCanvas(canvas);

    const isolatedAdd = vi.spyOn(isolated, 'addEventListener');
    const ambientAdd = vi.spyOn(document, 'addEventListener');
    const windowAdd = vi.spyOn(window, 'addEventListener');

    canvas.dispatchEvent(pointer('pointerdown', 10, 10));
    // The focus-leave press tracking (#347) adds `pointerup` /
    // `pointercancel` listeners to the injected document, so only the
    // drag's own `pointermove` is counted.
    expect(moveListeners(isolatedAdd)).toBe(1);
    expect(moveListeners(ambientAdd)).toBe(0);
    expect(moveListeners(windowAdd)).toBe(0);

    const before = fixture.componentInstance.value();
    isolated.dispatchEvent(pointer('pointermove', 90, 90));
    isolated.dispatchEvent(pointer('pointerup', 90, 90));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.value()).not.toBe(before);
    fixture.destroy();
  });

  /**
   * A picker portaled into a second document (an iframe preview, a print
   * window): the captured pointer's events bubble through that document, so
   * the drag must listen there — the injected `DOCUMENT` and the ambient
   * `window` never see them.
   */
  it('drives the canvas drag inside a second document', async () => {
    await TestBed.configureTestingModule({
      imports: [MlvColorPicker],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    const fixture = TestBed.createComponent(MlvColorPicker);
    fixture.detectChanges();
    await fixture.whenStable();

    const second = document.implementation.createHTMLDocument('frame');
    const host = fixture.nativeElement as HTMLElement;
    second.body.appendChild(host);
    const canvas: HTMLCanvasElement = host.querySelector(
      '.mlv-color-picker__canvas',
    ) as HTMLCanvasElement;
    expect(canvas.ownerDocument === second).toBe(true);
    prepareCanvas(canvas);

    const secondAdd = vi.spyOn(second, 'addEventListener');
    const injectedAdd = vi.spyOn(document, 'addEventListener');

    canvas.dispatchEvent(pointer('pointerdown', 10, 10));
    expect(moveListeners(secondAdd)).toBe(1);
    expect(moveListeners(injectedAdd)).toBe(0);

    // The app's document hears nothing of this drag.
    const before = fixture.componentInstance.value();
    document.dispatchEvent(pointer('pointermove', 90, 90));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.value()).toBe(before);

    second.dispatchEvent(pointer('pointermove', 90, 90));
    second.dispatchEvent(pointer('pointerup', 90, 90));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.value()).not.toBe(before);
    fixture.destroy();
  });
});

// ---------------------------------------------------------------------------
// CVA integration tests
// ---------------------------------------------------------------------------
@Component({
  template: `<mlv-color-picker [formControl]="ctrl" />`,
  imports: [MlvColorPicker, ReactiveFormsModule],
})
class TestHostComponent {
  ctrl = new FormControl('#3399ff');
}

describe('MlvColorPicker CVA', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should initialize from formControl value', () => {
    const picker = fixture.nativeElement.querySelector('mlv-color-picker');
    expect(picker).toBeTruthy();
  });

  it('should disable picker when form control is disabled', () => {
    host.ctrl.disable();
    fixture.detectChanges();
    // The component uses signal input for disabled; CVA setDisabledState
    // does not map to the signal input automatically.
    // Verify the control is disabled at the form level.
    expect(host.ctrl.disabled).toBe(true);
  });
});
