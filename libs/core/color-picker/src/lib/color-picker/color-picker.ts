import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  forwardRef,
  inject,
  Injector,
  input,
  model,
  output,
  signal,
  untracked,
  ViewEncapsulation,
  viewChild,
} from '@angular/core';
import type { ElementRef, OnInit } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import {
  MlvTab,
  MlvTabContentDef,
  MlvTabDef,
  MlvTabGroup,
} from '@malva-ui/core/tabs';
import { MlvInput } from '@malva-ui/core/input';
import {
  MLV_FORM_CONTROL,
  MlvSignalFormControlBase,
} from '@malva-ui/core/form-utils';
import { MLV_COLOR_PICKER_I18N } from '@malva-ui/i18n';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { fromEvent } from 'rxjs';
import { take, takeUntil } from 'rxjs/operators';
import type { MlvHsla, MlvColorInputMode } from '../color-utils/color-utils';
import {
  clamp,
  hslaToHex,
  hslaToModeString,
  hslToRgb,
  parseCssColor,
  rgbToHsl,
  round,
  tryParseCssColor,
} from '../color-utils/color-utils';

/**
 * The format a concrete CSS color string is written in — `'hex'`, `'rgb'` or
 * `'hsl'`, the three `tryParseCssColor` accepts. Only meaningful for a string
 * that parsed.
 */
function colorFormatOf(css: string): MlvColorInputMode {
  const str = css.trim().toLowerCase();
  if (str.startsWith('#')) return 'hex';
  return str.startsWith('hsl') ? 'hsl' : 'rgb';
}

/** Whether two parsed colors are field-for-field identical. */
function sameHsla(a: MlvHsla, b: MlvHsla): boolean {
  return a.h === b.h && a.s === b.s && a.l === b.l && a.a === b.a;
}

/**
 * The MlvColorPicker provides an HSL/HEX/RGB color picker with:
 * - A 2D saturation-lightness canvas (pointer-draggable)
 * - A hue slider
 * - An opacity slider
 * - Input mode tabs for HEX, RGB, and HSL
 * - Signal, reactive, and template-driven forms integration producing a CSS color string
 */
@Component({
  selector: 'mlv-color-picker',
  templateUrl: './color-picker.html',
  styleUrl: './color-picker.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgTemplateOutlet,
    MlvTab,
    MlvTabContentDef,
    MlvTabDef,
    MlvTabGroup,
    MlvInput,
  ],
  providers: [
    {
      provide: MLV_FORM_CONTROL,
      useExisting: forwardRef(() => MlvColorPicker),
    },
  ],
  host: {
    class: 'mlv-color-picker',
    '[class.mlv-color-picker--disabled]': 'computedDisabled()',
  },
})
export class MlvColorPicker
  extends MlvSignalFormControlBase<string>
  implements OnInit
{
  private static readonly _ALL_FORMATS: readonly MlvColorInputMode[] = [
    'hex',
    'rgb',
    'hsl',
  ];

  /** The CSS color string used by all Angular forms APIs. */
  readonly value = model<string>('#ff0000');
  /** @protected Injected i18n translations for the color picker. */
  protected readonly _i18n = inject(MLV_COLOR_PICKER_I18N);

  /** Whether to show the opacity slider. Defaults to true. */
  readonly showOpacity = input<boolean, BooleanInput>(true, {
    transform: coerceBooleanProperty,
  });

  /** The default input mode displayed when the picker opens. */
  readonly defaultMode = input<MlvColorInputMode>('hex');

  /** Available color formats, in display order. */
  readonly supportedFormats = input<readonly MlvColorInputMode[]>(
    MlvColorPicker._ALL_FORMATS,
  );

  /** Emits the CSS color string whenever the color changes. */
  readonly colorChange = output<string>();

  /** @private Current color in HSLA space. */
  protected readonly _hsla = signal<MlvHsla>({ h: 0, s: 100, l: 50, a: 1 });

  /** @private Current input mode for the text inputs. */
  protected readonly _inputMode = signal<MlvColorInputMode>('hex');

  /** Formats normalized to supported unique values, preserving caller order. */
  protected readonly _supportedFormats = computed<readonly MlvColorInputMode[]>(
    () => {
      const formats = this.supportedFormats().filter(
        (format, index, values) =>
          MlvColorPicker._ALL_FORMATS.includes(format) &&
          values.indexOf(format) === index,
      );
      return formats.length > 0 ? formats : MlvColorPicker._ALL_FORMATS;
    },
  );

  /** @private The current raw hex input string (kept separate to avoid cursor-jump on typing). */
  protected readonly _hexInput = signal<string>('#ff0000');

  /** @private The current raw red channel input. */
  protected readonly _rgbRInput = signal<string>('255');

  /** @private The current raw green channel input. */
  protected readonly _rgbGInput = signal<string>('0');

  /** @private The current raw blue channel input. */
  protected readonly _rgbBInput = signal<string>('0');

  /** @private The current raw alpha input for RGB mode. */
  protected readonly _rgbAInput = signal<string>('1');

  /** @private The current raw hue input for HSL mode. */
  protected readonly _hslHInput = signal<string>('0');

  /** @private The current raw saturation input for HSL mode. */
  protected readonly _hslSInput = signal<string>('100');

  /** @private The current raw lightness input for HSL mode. */
  protected readonly _hslLInput = signal<string>('50');

  /** @private The current raw alpha input for HSL mode. */
  protected readonly _hslAInput = signal<string>('1');

  /** @private Whether the canvas pointer is currently being dragged. */
  protected readonly _canvasDragging = signal(false);

  /**
   * @private Computed CSS string for the hue thumb gradient stop.
   * Used to show the pure hue color on the canvas gradient background.
   */
  protected readonly _hueColor = computed(() => {
    const { r, g, b } = hslToRgb(this._hsla().h, 100, 50);
    return `rgb(${r},${g},${b})`;
  });

  /**
   * @private Computed CSS color for the opacity slider checkerboard preview.
   */
  protected readonly _rgbaString = computed(() => {
    const c = this._hsla();
    const { r, g, b } = hslToRgb(c.h, c.s, c.l);
    return `rgba(${r},${g},${b},${c.a})`;
  });

  /** @private Reference to the canvas element. */
  protected readonly _canvasRef =
    viewChild<ElementRef<HTMLCanvasElement>>('slCanvas');

  /** @private Reference to the canvas container for size calculation. */
  protected readonly _canvasContainerRef =
    viewChild<ElementRef<HTMLDivElement>>('slContainer');

  /** @private DestroyRef for cleanup. */
  private readonly _destroyRef = inject(DestroyRef);

  /** @private Injector used to schedule `afterNextRender` from outside an injection context. */
  private readonly _injector = inject(Injector);

  /**
   * @private The canvas bounding rect captured once at pointerdown and reused
   * for every pointermove of that drag, avoiding a forced layout read
   * (`getBoundingClientRect`) on every move. Cleared on pointerup.
   */
  private _dragRect: DOMRect | null = null;

  /**
   * @private The `value` string {@link _hsla} currently stands for: the last
   * string this picker emitted, or the last external write it applied.
   *
   * `_hsla` is the source of truth, not the string. Every interaction emits
   * through the `value` model, and that write comes straight back into the
   * value effect — on its own, or through a two-way binding or a form. Parsing
   * it again would replace the exact state with one re-derived from the
   * emitted 8-bit hex / rgb, and on black, a grey or white, whose hex and rgb
   * spellings carry no hue, reset the hue to 0 (#315). The effect therefore
   * ignores a write equal to this string.
   */
  private _syncedValue: string | null = null;

  constructor() {
    super();
    // Touched only when focus leaves the whole control, not on a move
    // between its own parts (#347, D22).
    this._reportTouchOnFocusLeave();
    // The saturation/lightness plane is painted through the 2D canvas context,
    // which no server DOM implements — Angular's bundled domino throws
    // `NotYetImplemented` from `getContext`.
    //
    // Only two paint paths are not event handlers: this initial paint and the
    // repaint in `_applyValue`. Both are scheduled through `afterNextRender`,
    // which never runs on the server, so neither reaches `getContext` there.
    // The remaining `_drawCanvas()` calls are direct and synchronous, and are
    // SSR-safe only because they sit in pointer / input handlers that no
    // server render fires. A new non-handler call site is not covered by
    // either — schedule it through `afterNextRender` too.
    afterNextRender(() => this._drawCanvas());
    // Tracks `value` only. `_applyValue` reads `_hsla`, and tracking it made
    // every interaction re-run this effect and re-parse the unchanged string —
    // the hue slider on white snapped back to 0 because the emitted `#ffffff`
    // equalled the value it replaced (#315).
    effect(() => {
      const value = this.value();
      untracked(() => this._applyValue(value));
    });
    effect(() => {
      const formats = this._supportedFormats();
      if (!formats.includes(this._inputMode())) {
        this._inputMode.set(
          formats.includes(this.defaultMode())
            ? this.defaultMode()
            : formats[0],
        );
      }
    });
  }

  ngOnInit(): void {
    const formats = this._supportedFormats();
    this._inputMode.set(
      formats.includes(this.defaultMode()) ? this.defaultMode() : formats[0],
    );
    this._syncFromHsla();
  }

  // ---------------------------------------------------------------------------
  // Forms value
  // ---------------------------------------------------------------------------

  /** Whether the control holds a clearable value — The picker always holds a colour, so a clearable X (if enabled) is always actionable. */
  readonly hasValue = computed(() => true);

  /**
   * @private Synchronizes the color editor from a `value` write that did not
   * come from this picker.
   *
   * - A write equal to {@link _syncedValue} — the picker's own emission coming
   *   back — changes nothing.
   * - A write that parses to the same value as the picker's own spelling of
   *   its state in the written string's format — `#3366FF` or
   *   `rgb(51, 102, 255)` for a picker holding `#3366ff` — keeps the exact
   *   state rather than re-deriving it. The write is compared at its own
   *   precision, so one that says more than that spelling (an alpha of
   *   `0.125` where the picker spells `0.13`, a hue of `225.04` where it
   *   spells `225`) is applied.
   * - A hex / rgb write of black, a grey or white keeps the current hue
   *   ({@link _keepHue}); an `hsl()` write carries its own and is taken as is.
   */
  private _applyValue(value: string | null | undefined): void {
    if (value === this._syncedValue) return;
    this._syncedValue = value ?? null;
    if (!value) return;

    const parsed = tryParseCssColor(value);
    if (parsed) {
      const format = colorFormatOf(value);
      const own = tryParseCssColor(hslaToModeString(this._hsla(), format));
      if (own && sameHsla(own, parsed)) return;
      this._hsla.set(format === 'hsl' ? parsed : this._keepHue(parsed));
    } else {
      // Unparseable: the opaque-black fallback `parseCssColor` always applied.
      this._hsla.set(this._keepHue(parseCssColor(value)));
    }
    this._syncFromHsla();
    // Draw once change detection has settled. `afterNextRender` is both the
    // scheduling primitive and the SSR guard — the old `setTimeout(0)` fired
    // on the server too, after the render had finished, where it threw
    // uncatchably from `getContext`.
    afterNextRender(() => this._drawCanvas(), { injector: this._injector });
  }

  /**
   * @private A color with no chroma — black, a grey or white — has no hue of
   * its own, and one parsed from hex / rgb reports 0 (`rgbToHsl`). It keeps
   * the hue the picker holds instead, so the hue slider stays put, the plane
   * keeps its gradient, and moving off the grey axis returns to that hue.
   * Saturation, lightness and alpha are taken as parsed: at black and white
   * the plane zeroes saturation itself (`_updateColorFromCanvas`), and the
   * next plane drag sets it from the pointer.
   */
  private _keepHue(next: MlvHsla): MlvHsla {
    return next.s === 0 ? { ...next, h: this._hsla().h } : next;
  }

  // ---------------------------------------------------------------------------
  // Canvas drawing
  // ---------------------------------------------------------------------------

  /**
   * @private Draws the 2D saturation-lightness canvas for the current hue.
   * The canvas shows a gradient from white (top-left) to the pure hue (top-right)
   * to black (bottom).
   */
  protected _drawCanvas(): void {
    const canvasEl = this._canvasRef()?.nativeElement;
    if (!canvasEl) return;
    const ctx = canvasEl.getContext('2d');
    if (!ctx) return;

    const w = canvasEl.offsetWidth || canvasEl.width;
    const h = canvasEl.offsetHeight || canvasEl.height;

    // Set canvas resolution to match displayed size
    if (canvasEl.width !== w || canvasEl.height !== h) {
      canvasEl.width = w;
      canvasEl.height = h;
    }

    const hue = this._hsla().h;
    const { r, g, b } = hslToRgb(hue, 100, 50);
    const pureHue = `rgb(${r},${g},${b})`;

    // White → pure hue (horizontal)
    const hGrad = ctx.createLinearGradient(0, 0, w, 0);
    hGrad.addColorStop(0, '#ffffff');
    hGrad.addColorStop(1, pureHue);
    ctx.fillStyle = hGrad;
    ctx.fillRect(0, 0, w, h);

    // Transparent → black (vertical, overlaid)
    const vGrad = ctx.createLinearGradient(0, 0, 0, h);
    vGrad.addColorStop(0, 'rgba(0,0,0,0)');
    vGrad.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.fillStyle = vGrad;
    ctx.fillRect(0, 0, w, h);
  }

  // ---------------------------------------------------------------------------
  // Canvas pointer interaction
  // ---------------------------------------------------------------------------

  /**
   * @private Handles pointer down on the SL canvas.
   * Begins drag and updates color immediately.
   */
  protected _onCanvasPointerDown(event: PointerEvent): void {
    if (this.computedDisabled()) return;
    event.preventDefault();

    // Capture the canvas rect once, up front, and reuse it for the whole drag
    // so pointermove never forces a layout read. It is fresh here, so the
    // initial pointerdown update below also uses an up-to-date rect.
    this._dragRect =
      this._canvasRef()?.nativeElement.getBoundingClientRect() ?? null;

    this._canvasDragging.set(true);
    this._updateColorFromCanvas(event);

    const target = event.currentTarget as HTMLElement;
    target.setPointerCapture(event.pointerId);

    // Per-drag rxjs streams: the move stream completes on the first pointerup
    // (takeUntil) and both streams complete on destroy (takeUntilDestroyed),
    // so no document listener can leak or accumulate across drags — this
    // replaces an earlier bug where each drag's pointermove listener stayed
    // attached to `window`. Bound to the canvas's own document: the canvas
    // holds pointer capture, so its moves and its pointerup bubble through
    // that document — which is not the injected `DOCUMENT` (the app's) when
    // the picker is portaled into an iframe or a print window, and not the
    // ambient `window`'s either. A pointerdown only happens in a browser, so
    // nothing here runs on the server.
    const canvasDocument = target.ownerDocument;
    const pointerUp$ = fromEvent<PointerEvent>(canvasDocument, 'pointerup');

    fromEvent<PointerEvent>(canvasDocument, 'pointermove')
      .pipe(takeUntil(pointerUp$), takeUntilDestroyed(this._destroyRef))
      .subscribe((e) => {
        if (this._canvasDragging()) {
          this._updateColorFromCanvas(e);
        }
      });

    pointerUp$
      .pipe(take(1), takeUntilDestroyed(this._destroyRef))
      .subscribe(() => {
        this._canvasDragging.set(false);
        this._dragRect = null;
        // The `preventDefault()` above cancels the press's compatibility
        // `mousedown`, so a canvas drag moves no focus: whatever held focus
        // before still holds it (Chromium, Firefox and WebKit measured). If
        // that is one of the picker's own inputs, touched waits for focus to
        // leave the picker (#347, D22); if focus is elsewhere, the
        // focus-leave report never hears of this gesture and its end is the
        // only "done" signal a mouse user gives.
        if (!this._focusIsInsideControl()) this._markTouched();
      });
  }

  /**
   * @private Converts a pointer position on the canvas to saturation/lightness values.
   */
  private _updateColorFromCanvas(event: PointerEvent): void {
    const canvasEl = this._canvasRef()?.nativeElement;
    if (!canvasEl) return;
    // Reuse the rect captured at pointerdown during a drag; fall back to a live
    // read for any standalone call.
    const rect = this._dragRect ?? canvasEl.getBoundingClientRect();
    const x = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    const y = clamp((event.clientY - rect.top) / rect.height, 0, 1);

    // Convert canvas (x,y) → HSL via HSV intermediate:
    //   x  = HSV saturation (Sv),  y = 1 − HSV value (V = 1−y)
    //   L_hsl  = V · (1 − Sv/2)
    //   S_hsl  = ΔC / (1 − |2L−1|)  where ΔC = V · Sv  (NOT just Sv alone)
    const sv = x;
    const v = 1 - y;
    const lightness = v * (1 - sv / 2);
    const saturation =
      lightness === 0 || lightness === 1
        ? 0
        : (sv * v) / (1 - Math.abs(2 * lightness - 1));

    this._hsla.update((c) => ({
      ...c,
      s: round(clamp(saturation * 100, 0, 100), 1),
      l: round(clamp(lightness * 100, 0, 100), 1),
    }));
    this._syncFromHsla();
    this._emitChange();
  }

  // ---------------------------------------------------------------------------
  // Hue slider
  // ---------------------------------------------------------------------------

  /**
   * @private Handles hue slider input change.
   */
  protected _onHueChange(event: Event): void {
    if (this.computedDisabled()) return;
    const value = parseFloat((event.target as HTMLInputElement).value);
    this._hsla.update((c) => ({ ...c, h: clamp(value, 0, 360) }));
    this._syncFromHsla();
    this._drawCanvas();
    this._emitChange();
  }

  // ---------------------------------------------------------------------------
  // Opacity slider
  // ---------------------------------------------------------------------------

  /**
   * @private Handles opacity slider input change.
   */
  protected _onOpacityChange(event: Event): void {
    if (this.computedDisabled()) return;
    const value = parseFloat((event.target as HTMLInputElement).value);
    this._hsla.update((c) => ({ ...c, a: clamp(value / 100, 0, 1) }));
    this._syncFromHsla();
    this._emitChange();
  }

  // ---------------------------------------------------------------------------
  // Input mode tabs
  // ---------------------------------------------------------------------------

  /**
   * @private Switches the active input mode tab.
   */
  protected _setInputMode(mode: string): void {
    if (!this._supportedFormats().includes(mode as MlvColorInputMode)) return;
    const nextMode = mode as MlvColorInputMode;
    if (nextMode === this._inputMode()) return;
    this._inputMode.set(nextMode);
    this._emitChange();
  }

  // ---------------------------------------------------------------------------
  // HEX input
  // ---------------------------------------------------------------------------

  /**
   * @private Handles hex input changes.
   */
  protected _onHexInput(event: Event): void {
    if (this.computedDisabled()) return;
    const raw = (event.target as HTMLInputElement).value;
    this._hexInput.set(raw);
    const hex = raw.startsWith('#') ? raw : '#' + raw;
    const parsed = parseCssColor(hex);
    if (hex.replace('#', '').length >= 6) {
      this._hsla.set(this._keepHue({ ...parsed, a: this._hsla().a }));
      this._syncFromHsla('rgb', 'hsl');
      this._drawCanvas();
      this._emitChange();
    }
  }

  // ---------------------------------------------------------------------------
  // RGB inputs
  // ---------------------------------------------------------------------------

  /** @private Updates red channel from input. */
  protected _onRgbRInput(event: Event): void {
    this._rgbRInput.set((event.target as HTMLInputElement).value);
    this._applyRgbInputs();
  }

  /** @private Updates green channel from input. */
  protected _onRgbGInput(event: Event): void {
    this._rgbGInput.set((event.target as HTMLInputElement).value);
    this._applyRgbInputs();
  }

  /** @private Updates blue channel from input. */
  protected _onRgbBInput(event: Event): void {
    this._rgbBInput.set((event.target as HTMLInputElement).value);
    this._applyRgbInputs();
  }

  /** @private Updates alpha channel from RGB mode input. */
  protected _onRgbAInput(event: Event): void {
    this._rgbAInput.set((event.target as HTMLInputElement).value);
    this._applyRgbInputs();
  }

  /**
   * @private Parses all RGB inputs and updates the internal HSLA state.
   */
  private _applyRgbInputs(): void {
    if (this.computedDisabled()) return;
    const r = clamp(parseInt(this._rgbRInput(), 10), 0, 255);
    const g = clamp(parseInt(this._rgbGInput(), 10), 0, 255);
    const b = clamp(parseInt(this._rgbBInput(), 10), 0, 255);
    const a = clamp(parseFloat(this._rgbAInput()), 0, 1);
    if (!isNaN(r) && !isNaN(g) && !isNaN(b) && !isNaN(a)) {
      const { h, s, l } = rgbToHsl(r, g, b);
      this._hsla.set(this._keepHue({ h, s, l, a }));
      this._syncFromHsla('hex', 'hsl');
      this._drawCanvas();
      this._emitChange();
    }
  }

  // ---------------------------------------------------------------------------
  // HSL inputs
  // ---------------------------------------------------------------------------

  /** @private Updates hue from HSL input. */
  protected _onHslHInput(event: Event): void {
    this._hslHInput.set((event.target as HTMLInputElement).value);
    this._applyHslInputs();
  }

  /** @private Updates saturation from HSL input. */
  protected _onHslSInput(event: Event): void {
    this._hslSInput.set((event.target as HTMLInputElement).value);
    this._applyHslInputs();
  }

  /** @private Updates lightness from HSL input. */
  protected _onHslLInput(event: Event): void {
    this._hslLInput.set((event.target as HTMLInputElement).value);
    this._applyHslInputs();
  }

  /** @private Updates alpha from HSL mode input. */
  protected _onHslAInput(event: Event): void {
    this._hslAInput.set((event.target as HTMLInputElement).value);
    this._applyHslInputs();
  }

  /**
   * @private Parses all HSL inputs and updates internal state.
   */
  private _applyHslInputs(): void {
    if (this.computedDisabled()) return;
    const h = clamp(parseFloat(this._hslHInput()), 0, 360);
    const s = clamp(parseFloat(this._hslSInput()), 0, 100);
    const l = clamp(parseFloat(this._hslLInput()), 0, 100);
    const a = clamp(parseFloat(this._hslAInput()), 0, 1);
    if (!isNaN(h) && !isNaN(s) && !isNaN(l) && !isNaN(a)) {
      this._hsla.set({ h, s, l, a });
      this._syncFromHsla('hex', 'rgb');
      this._drawCanvas();
      this._emitChange();
    }
  }

  // ---------------------------------------------------------------------------
  // Input sync helper (single, channel-targeted)
  // ---------------------------------------------------------------------------

  /**
   * @private Refreshes the in-progress text-mirror signals for the requested
   * channels from the canonical `_hsla()` state. Called after every external
   * mutation (canvas drag, hue slider, opacity slider, external value write) to
   * keep the unfocused channels in sync without clobbering the channel the
   * user is currently typing into.
   */
  private _syncFromHsla(
    ...channels: ReadonlyArray<'hex' | 'rgb' | 'hsl'>
  ): void {
    const c = this._hsla();
    if (channels.length === 0 || channels.includes('hex')) {
      this._hexInput.set(hslaToHex(c));
    }
    if (channels.length === 0 || channels.includes('rgb')) {
      const { r, g, b } = hslToRgb(c.h, c.s, c.l);
      this._rgbRInput.set(String(r));
      this._rgbGInput.set(String(g));
      this._rgbBInput.set(String(b));
      this._rgbAInput.set(String(round(c.a, 2)));
    }
    if (channels.length === 0 || channels.includes('hsl')) {
      this._hslHInput.set(String(round(c.h, 1)));
      this._hslSInput.set(String(round(c.s, 1)));
      this._hslLInput.set(String(round(c.l, 1)));
      this._hslAInput.set(String(round(c.a, 2)));
    }
  }

  // ---------------------------------------------------------------------------
  // Change emission
  // ---------------------------------------------------------------------------

  /**
   * @private Emits the current color through the forms model and colorChange output.
   */
  private _emitChange(): void {
    const cssColor = hslaToModeString(this._hsla(), this._inputMode());
    // Recorded before the write, so the value effect recognizes the echo.
    this._syncedValue = cssColor;
    this.value.set(cssColor);
    this.colorChange.emit(cssColor);
  }

  /**
   * @private Returns the current CSS color string for a given mode.
   * Used by the template to display the color in the active mode.
   */
  protected _getColorString(mode: MlvColorInputMode): string {
    return hslaToModeString(this._hsla(), mode);
  }

  /**
   * @private Returns opacity value as 0-100 integer for the opacity slider.
   */
  protected _getOpacityPercent(): number {
    return Math.round(this._hsla().a * 100);
  }

  /**
   * @private Returns the hue value for the hue slider.
   */
  protected _getHue(): number {
    return this._hsla().h;
  }

  /**
   * @private Canvas thumb left position.
   * The canvas uses HSV space (x = HSV saturation, y = 1 − HSV value).
   * Converts the stored HSL to HSV to get the correct x coordinate.
   */
  protected _getThumbLeft(): string {
    const { sv } = this._hslToHsv();
    return `${clamp(sv * 100, 0, 100)}%`;
  }

  /**
   * @private Canvas thumb top position.
   * y = 1 − HSV value (top = bright/white, bottom = black).
   */
  protected _getThumbTop(): string {
    const { v } = this._hslToHsv();
    return `${clamp((1 - v) * 100, 0, 100)}%`;
  }

  /**
   * @private Converts the current HSLA state to HSV (saturation + value),
   * matching the coordinate system used by the SL canvas gradient.
   *
   * The canvas draws:
   *   - Horizontal: white (left) → pure hue (right)  → x = HSV saturation
   *   - Vertical:   full brightness (top) → black (bottom) → y = 1 − HSV value
   *
   * HSL → HSV:
   *   V  = L + S · min(L, 1−L)
   *   Sv = V > 0 ? 2·(1 − L/V) : 0
   */
  private _hslToHsv(): { sv: number; v: number } {
    const s = this._hsla().s / 100;
    const l = this._hsla().l / 100;
    const v = l + s * Math.min(l, 1 - l);
    const sv = v > 0 ? 2 * (1 - l / v) : 0;
    return { sv, v };
  }
}
