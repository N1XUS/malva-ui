import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { MlvTextarea } from './textarea';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';

describe('MlvTextarea', () => {
  let component: MlvTextarea;
  let fixture: ComponentFixture<MlvTextarea>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MlvTextarea],
      providers: [provideMlvI18nTesting(), provideAnimations()],
    }).compileComponents();

    fixture = TestBed.createComponent(MlvTextarea);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should update value on input', () => {
    component.onInput({ target: { value: 'hello' } } as unknown as Event);
    expect(component.value()).toBe('hello');
  });

  it('should compute charCount correctly', () => {
    component.value.set('test');
    expect(component.charCount()).toBe(4);
  });

  it('should detect warning state when >90% of maxLength', async () => {
    fixture.componentRef.setInput('maxLength', 10);
    component.value.set('123456789'); // 9/10 = 90%
    await fixture.whenStable();
    expect(component.isCountWarning()).toBe(true);
    expect(component.isCountError()).toBe(false);
  });

  it('should detect error state when at maxLength', async () => {
    fixture.componentRef.setInput('maxLength', 5);
    component.value.set('12345');
    await fixture.whenStable();
    expect(component.isCountError()).toBe(true);
  });

  it('should reflect a value written through the model', () => {
    component.value.set('written');
    expect(component.value()).toBe('written');
    expect(component.hasValue()).toBe(true);
  });

  it('should emit touch on blur', () => {
    let touched = false;
    component.touch.subscribe(() => (touched = true));
    component.onBlur();
    expect(touched).toBe(true);
  });

  it('should clear the value and mark touched via clearValue', () => {
    let touched = false;
    component.value.set('draft');
    component.touch.subscribe(() => (touched = true));
    component.clearValue();
    expect(component.value()).toBe('');
    expect(touched).toBe(true);
  });

  it('should set focused state on focus/blur', () => {
    component.setFocused(true);
    expect(component.focused()).toBe(true);
    component.onBlur();
    expect(component.focused()).toBe(false);
  });

  describe('below-control chrome', () => {
    function textarea(): HTMLTextAreaElement {
      return fixture.nativeElement.querySelector(
        'textarea',
      ) as HTMLTextAreaElement;
    }

    it('renders the character counter in the DOM and describes the textarea with it', async () => {
      fixture.componentRef.setInput('maxLength', 10);
      component.value.set('abc');
      await fixture.whenStable();

      const counter = fixture.nativeElement.querySelector(
        '.mlv-textarea__count',
      ) as HTMLElement;
      expect(counter).not.toBeNull();
      expect(counter.textContent?.trim()).toBe('3/10');
      expect(counter.id).toBe(component.countId());
      expect(textarea().getAttribute('aria-describedby')).toBe(
        component.countId(),
      );
    });

    it('renders no counter and no aria-describedby without maxLength', () => {
      expect(
        fixture.nativeElement.querySelector('.mlv-textarea__count'),
      ).toBeNull();
      expect(textarea().getAttribute('aria-describedby')).toBeNull();
    });

    it('renders the description and message with the ids aria-describedby points at', async () => {
      fixture.componentRef.setInput('description', 'Markdown is supported.');
      fixture.componentRef.setInput('message', 'Too short');
      await fixture.whenStable();

      const description = fixture.nativeElement.querySelector(
        'mlv-description',
      ) as HTMLElement;
      const message = fixture.nativeElement.querySelector(
        'mlv-message',
      ) as HTMLElement;
      expect(description.textContent?.trim()).toBe('Markdown is supported.');

      const describedBy = textarea().getAttribute('aria-describedby') ?? '';
      expect(describedBy.split(' ')).toEqual([description.id, message.id]);
      // Every referenced id must resolve to a real element.
      for (const id of describedBy.split(' ')) {
        expect(fixture.nativeElement.querySelector(`#${id}`)).not.toBeNull();
      }
    });

    it('forwards ariaLabel and required onto the native textarea', async () => {
      fixture.componentRef.setInput('ariaLabel', 'Release notes');
      fixture.componentRef.setInput('required', true);
      await fixture.whenStable();

      expect(textarea().getAttribute('aria-label')).toBe('Release notes');
      expect(textarea().getAttribute('aria-required')).toBe('true');
    });
  });
});

/**
 * Auto-resize measures the DOM, and jsdom has no layout engine: `scrollHeight`
 * and `clientWidth` are always 0 and `getComputedStyle` reports nothing that
 * was not set inline. Every test below therefore installs a small layout model
 * on the native textarea, so the arithmetic under test runs on real numbers
 * instead of falling through `parseFloat('') || 24`.
 */
describe('MlvTextarea auto-resize', () => {
  /** Line height, in px, that the tests set inline so `parseFloat` sees a real value. */
  const LINE_HEIGHT = 20;
  /** Top padding, in px. */
  const PAD_TOP = 4;
  /** Bottom padding, in px. */
  const PAD_BOTTOM = 6;
  /** Combined vertical padding — every clamp adds this to `rows * LINE_HEIGHT`. */
  const PAD = PAD_TOP + PAD_BOTTOM; // 10
  /** Characters the model fits on one visual line before wrapping. */
  const CHARS_PER_LINE = 10;
  /** Content-box width the model reports while the element is "laid out". */
  const WIDTH = 300;

  /** Wrapped line count for a string, mirroring greedy left-to-right wrapping. */
  const lineCount = (text: string, perLine: number = CHARS_PER_LINE): number =>
    text
      .split('\n')
      .reduce(
        (total, line) => total + Math.max(1, Math.ceil(line.length / perLine)),
        0,
      );

  interface Harness {
    fixture: ComponentFixture<MlvTextarea>;
    el: HTMLTextAreaElement;
    /** Every value assigned to `style.height`, oldest first. */
    heightWrites: string[];
    /** `getComputedStyle` calls, reset by `resetCounters()`. */
    styleReads: () => number;
    resetCounters: () => void;
    /** Simulates a keystroke/paste: DOM value first, then the input event. */
    type: (text: string) => Promise<void>;
    /** Puts the element in / takes it out of the "laid out" state. */
    setLaidOut: (laidOut: boolean) => void;
    /**
     * Re-resolves the font metrics, as a density flip / theme swap / web font
     * load would. Deliberately does not touch `clientWidth`: the field is
     * `width: 100%; box-sizing: border-box`, so its container width does not
     * move when the font does.
     */
    setMetrics: (next: {
      lineHeight?: number;
      paddingTop?: number;
      paddingBottom?: number;
    }) => void;
    /** Resizes the container, which re-wraps the text. */
    setWidth: (widthPx: number) => void;
    /**
     * The height HEAD's implementation would apply for the current state:
     * the true content height, clamped to the row window. The reference the
     * fuzz checks every step against.
     */
    expectedHeight: () => number;
    currentHeight: () => string;
  }

  const setup = async (opts: {
    minRows?: number;
    maxRows?: number;
    /** When false the element starts unlaid-out: width 0, no computed styles. */
    laidOut?: boolean;
    /**
     * Overrides the wrapping model. Used to reproduce cursive shaping, where
     * appending a joining letter can *reduce* the rendered line count.
     */
    linesFor?: (value: string) => number;
  }): Promise<Harness> => {
    const fixture = TestBed.createComponent(MlvTextarea);
    fixture.componentRef.setInput('autoResize', true);
    if (opts.minRows !== undefined) {
      fixture.componentRef.setInput('minRows', opts.minRows);
    }
    if (opts.maxRows !== undefined) {
      fixture.componentRef.setInput('maxRows', opts.maxRows);
    }
    await fixture.whenStable();

    const el = fixture.nativeElement.querySelector(
      'textarea',
    ) as HTMLTextAreaElement;

    let laidOut = opts.laidOut ?? true;
    let widthPx = WIDTH;
    let lineHeight = LINE_HEIGHT;
    let paddingTop = PAD_TOP;
    let paddingBottom = PAD_BOTTOM;

    const applyMetrics = (): void => {
      el.style.lineHeight = `${lineHeight}px`;
      el.style.paddingTop = `${paddingTop}px`;
      el.style.paddingBottom = `${paddingBottom}px`;
    };

    const setLaidOut = (next: boolean): void => {
      laidOut = next;
      if (next) {
        applyMetrics();
      } else {
        el.style.lineHeight = '';
        el.style.paddingTop = '';
        el.style.paddingBottom = '';
      }
    };

    const setMetrics = (next: {
      lineHeight?: number;
      paddingTop?: number;
      paddingBottom?: number;
    }): void => {
      lineHeight = next.lineHeight ?? lineHeight;
      paddingTop = next.paddingTop ?? paddingTop;
      paddingBottom = next.paddingBottom ?? paddingBottom;
      if (laidOut) applyMetrics();
    };

    // Intercept height writes and keep the value ourselves — jsdom would
    // otherwise let the real accessor swallow `auto` vs px distinctions we
    // need to model `scrollHeight` against.
    const heightWrites: string[] = [];
    let heightValue = '';
    Object.defineProperty(el.style, 'height', {
      configurable: true,
      get: () => heightValue,
      set: (next: string) => {
        heightValue = next;
        heightWrites.push(next);
      },
    });

    /** Characters that fit on one line at the current width. */
    const charsPerLine = (): number =>
      Math.max(1, Math.floor(widthPx / (WIDTH / CHARS_PER_LINE)));

    /** True content height of the current text, in px. */
    const measureLines =
      opts.linesFor ?? ((value: string) => lineCount(value, charsPerLine()));
    const contentHeight = (): number =>
      laidOut
        ? measureLines(el.value) * lineHeight + paddingTop + paddingBottom
        : 0;

    // Faithful `scrollHeight`: with an explicit height applied it saturates at
    // the box height (which is exactly why the `height: auto` reset exists);
    // with `auto` or nothing applied it reports the real content height.
    Object.defineProperty(el, 'scrollHeight', {
      configurable: true,
      get: () => {
        const applied = heightValue;
        if (applied === '' || applied === 'auto') return contentHeight();
        return Math.max(contentHeight(), parseFloat(applied));
      },
    });
    Object.defineProperty(el, 'clientWidth', {
      configurable: true,
      get: () => (laidOut ? widthPx : 0),
    });

    setLaidOut(laidOut);

    let styleReadCount = 0;
    const realGetComputedStyle = globalThis.getComputedStyle.bind(
      globalThis,
    ) as typeof getComputedStyle;
    vi.spyOn(globalThis, 'getComputedStyle').mockImplementation(((
      ...args: Parameters<typeof getComputedStyle>
    ) => {
      if (args[0] !== el) return realGetComputedStyle(...args);
      styleReadCount++;
      const declaration = realGetComputedStyle(...args);
      if (laidOut) return declaration;
      // A detached / not-yet-laid-out element reports empty strings for every
      // longhand, which is precisely what drives `parseFloat` to NaN and hands
      // the arithmetic to the `|| 24` / `|| 0` fallbacks. jsdom still resolves
      // the component stylesheet here, so the empty result is modelled
      // explicitly rather than by clearing inline styles.
      return new Proxy(declaration, {
        get: (target, prop, receiver) =>
          prop === 'lineHeight' ||
          prop === 'paddingTop' ||
          prop === 'paddingBottom'
            ? ''
            : Reflect.get(target, prop, receiver),
      });
    }) as typeof getComputedStyle);

    const type = async (text: string): Promise<void> => {
      el.value = text;
      el.dispatchEvent(new Event('input'));
      await fixture.whenStable();
    };

    return {
      fixture,
      el,
      heightWrites,
      styleReads: () => styleReadCount,
      resetCounters: () => {
        styleReadCount = 0;
        heightWrites.length = 0;
      },
      type,
      setLaidOut,
      setMetrics,
      setWidth: (next: number) => {
        widthPx = next;
      },
      expectedHeight: () => {
        const padding = paddingTop + paddingBottom;
        const minRows = fixture.componentInstance.minRows();
        const maxRows = fixture.componentInstance.maxRows();
        let result = measureLines(el.value) * lineHeight + padding;
        if (minRows) {
          result = Math.max(result, minRows * lineHeight + padding);
        }
        if (maxRows) {
          result = Math.min(result, maxRows * lineHeight + padding);
        }
        return result;
      },
      currentHeight: () => heightValue,
    };
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MlvTextarea],
      providers: [provideMlvI18nTesting(), provideAnimations()],
    }).compileComponents();
  });

  describe('style reads per keystroke', () => {
    it('reads the computed style exactly once per keystroke on every path', async () => {
      // Bound: the resize needs `lineHeight`, `paddingTop` and `paddingBottom`.
      // The previous implementation took one `getComputedStyle(el)` call per
      // property — 3 per keystroke. They now come off one declaration, and the
      // fast path needs that same declaration anyway to prove the font metrics
      // have not moved before it trusts the remembered height. So the bound is
      // 1 on every path, never 0: a 0 would mean the metrics went unchecked.
      const h = await setup({ minRows: 1, maxRows: 20 });
      await h.type('aaa'); // first keystroke: slow path, primes the state
      h.resetCounters();

      // Typing within the current line — height cannot change.
      await h.type('aaaa');
      expect(h.styleReads()).toBe(1);

      // Typing past the wrap point — height grows.
      h.resetCounters();
      await h.type('aaaaaaaaaaaa'); // 12 chars => 2 lines
      expect(h.styleReads()).toBe(1);

      // A deletion cannot use the fast path; it still costs only one read.
      h.resetCounters();
      await h.type('a');
      expect(h.styleReads()).toBe(1);
    });

    it('still reads the computed style once when neither minRows nor maxRows is set', async () => {
      // Without a row window there is no clamp to convert into pixels, but the
      // metrics are still needed: a font-size *shrink* leaves the content
      // shorter while `scrollHeight` saturates at the applied height, so
      // without the metrics comparison the fast path would keep dead space.
      const h = await setup({});
      await h.type('aaa');
      h.resetCounters();

      await h.type('aaaa');
      expect(h.styleReads()).toBe(1);
    });
  });

  describe('reflow bracket', () => {
    it('writes style.height twice on the reset path and not at all when the height is unchanged', async () => {
      const h = await setup({ minRows: 1, maxRows: 20 });
      await h.type('aaa');
      h.resetCounters();

      // Unchanged height: no `auto` reset, no restore — the DOM is untouched,
      // so there is no write to force a recalculation for the next frame.
      await h.type('aaaa');
      expect(h.heightWrites).toEqual([]);

      // Growth: one write, and crucially no `auto` before it, so the read that
      // preceded it was not forced by an invalidation of our own making.
      h.resetCounters();
      await h.type('aaaaaaaaaaaa');
      expect(h.heightWrites).toEqual([`${2 * LINE_HEIGHT + PAD}px`]);

      // Shrink: the `auto` reset is unavoidable, so the bracket is paid.
      h.resetCounters();
      await h.type('a');
      expect(h.heightWrites).toEqual(['auto', `${1 * LINE_HEIGHT + PAD}px`]);
    });
  });

  describe('clamp arithmetic on real computed values', () => {
    it('honours minRows using the measured line height, not the 24px fallback', async () => {
      const h = await setup({ minRows: 3 });
      await h.type('a'); // one line of content

      // 3 * 20 + 10 = 70. The `|| 24` / `|| 0` fallbacks would give 3 * 24 = 72,
      // so this assertion fails if the computed style was never really read.
      expect(h.currentHeight()).toBe(`${3 * LINE_HEIGHT + PAD}px`);
      expect(h.currentHeight()).not.toBe('72px');
    });

    it('honours maxRows using the measured line height, not the 24px fallback', async () => {
      const h = await setup({ maxRows: 4 });
      await h.type('a'.repeat(CHARS_PER_LINE * 9)); // 9 lines of content

      // 4 * 20 + 10 = 90; the fallback arithmetic would give 4 * 24 = 96.
      expect(h.currentHeight()).toBe(`${4 * LINE_HEIGHT + PAD}px`);
      expect(h.currentHeight()).not.toBe('96px');
    });

    it('leaves a height between the two clamps untouched', async () => {
      const h = await setup({ minRows: 2, maxRows: 8 });
      await h.type('a'.repeat(CHARS_PER_LINE * 5)); // 5 lines, inside the range

      expect(h.currentHeight()).toBe(`${5 * LINE_HEIGHT + PAD}px`);
    });

    it('re-clamps when maxRows tightens while the content still fits', async () => {
      // 55 characters wrap onto 6 lines and leave room on the last one, so the
      // content height does not move. `scrollHeight` therefore reports exactly
      // the height already applied and cannot reveal that anything changed —
      // only the remembered `maxRows` can.
      const h = await setup({ maxRows: 8 });
      const text = 'a'.repeat(CHARS_PER_LINE * 6 - 5);
      await h.type(text);
      expect(h.currentHeight()).toBe(`${6 * LINE_HEIGHT + PAD}px`);

      h.fixture.componentRef.setInput('maxRows', 3);
      await h.fixture.whenStable();
      expect(h.currentHeight()).toBe(`${3 * LINE_HEIGHT + PAD}px`);

      // And it stays clamped across a subsequent append that adds no line.
      await h.type(text + 'a');
      expect(h.currentHeight()).toBe(`${3 * LINE_HEIGHT + PAD}px`);
    });

    it('re-clamps when minRows grows while the content still fits', async () => {
      const h = await setup({ minRows: 1 });
      const text = 'a'.repeat(CHARS_PER_LINE * 3 - 5);
      await h.type(text);
      expect(h.currentHeight()).toBe(`${3 * LINE_HEIGHT + PAD}px`);

      h.fixture.componentRef.setInput('minRows', 6);
      await h.fixture.whenStable();
      expect(h.currentHeight()).toBe(`${6 * LINE_HEIGHT + PAD}px`);

      await h.type(text + 'a');
      expect(h.currentHeight()).toBe(`${6 * LINE_HEIGHT + PAD}px`);
    });
  });

  describe('element that is not laid out', () => {
    it('uses the fabricated defaults for that call but never remembers them', async () => {
      const h = await setup({ minRows: 2, laidOut: false });

      // Not laid out: no computed styles, so `parseFloat('')` is NaN and the
      // `|| 24` / `|| 0` fallbacks decide. 2 * 24 + 0 = 48.
      await h.type('a');
      expect(h.currentHeight()).toBe('48px');

      // Now the element gets laid out. If the fabricated 24px line height had
      // been cached, the clamp would still say 48px forever.
      h.setLaidOut(true);
      await h.type('ab');
      expect(h.currentHeight()).toBe(`${2 * LINE_HEIGHT + PAD}px`); // 50px
    });

    it('takes the reset path on the first keystroke after becoming laid out', async () => {
      const h = await setup({ minRows: 1, maxRows: 20, laidOut: false });
      await h.type('a');
      h.setLaidOut(true);
      h.resetCounters();

      // 'a' -> 'ab' is an append, but the unlaid-out measurement was never
      // stored, so the fast path is not available and the reset runs.
      await h.type('ab');
      expect(h.heightWrites).toEqual(['auto', `${1 * LINE_HEIGHT + PAD}px`]);
    });
  });

  describe('font metrics changing under the fast path', () => {
    // `clientWidth` cannot see any of these: the field is
    // `width: 100%; box-sizing: border-box`, so it reports the container width
    // and does not move when the font size or padding does.

    it('re-measures when the line height grows mid-typing', async () => {
      const h = await setup({ minRows: 4 });
      await h.type('hello');
      expect(h.currentHeight()).toBe(`${4 * LINE_HEIGHT + PAD}px`); // 90px

      // A density flip / theme swap / web font load: 20px -> 25px line height.
      h.setMetrics({ lineHeight: 25 });
      await h.type('hello!');

      // minRows must be honoured against the NEW metrics: 4 * 25 + 10 = 110.
      // Reusing the remembered 90px would silently violate minRows, and the
      // overflow would scroll behind `scrollbar-width: none`.
      expect(h.currentHeight()).toBe('110px');

      // ...and it stays correct on subsequent appends rather than latching.
      await h.type('hello!!');
      expect(h.currentHeight()).toBe('110px');
    });

    it('re-measures when the line height shrinks mid-typing', async () => {
      const h = await setup({ minRows: 4 });
      await h.type('hello');
      expect(h.currentHeight()).toBe(`${4 * LINE_HEIGHT + PAD}px`); // 90px

      h.setMetrics({ lineHeight: 15 });
      await h.type('hello!');

      // 4 * 15 + 10 = 70. Keeping 90px would leave 20px of dead space forever.
      expect(h.currentHeight()).toBe('70px');
    });

    it('re-measures when only the padding changes', async () => {
      const h = await setup({ minRows: 3 });
      await h.type('hi');
      expect(h.currentHeight()).toBe(`${3 * LINE_HEIGHT + PAD}px`); // 70px

      h.setMetrics({ paddingTop: 14, paddingBottom: 16 });
      await h.type('hit');
      expect(h.currentHeight()).toBe(`${3 * LINE_HEIGHT + 30}px`); // 90px
    });

    it('re-measures without clamps too, where a font shrink would otherwise leave dead space', async () => {
      // No minRows/maxRows: the height is the raw content height, but
      // `scrollHeight` still saturates at the applied height, so a font shrink
      // is invisible without the metrics comparison.
      const h = await setup({});
      await h.type('a'.repeat(CHARS_PER_LINE * 3));
      expect(h.currentHeight()).toBe(`${3 * LINE_HEIGHT + PAD}px`); // 70px

      h.setMetrics({ lineHeight: 10 });
      await h.type('a'.repeat(CHARS_PER_LINE * 3) + 'a'); // 4 lines at 10px

      expect(h.currentHeight()).toBe(`${4 * 10 + PAD}px`); // 50px
    });
  });

  describe('joining scripts', () => {
    // Chrome 145, 220px, dir="rtl", 16px/1.5: appending a joining letter
    // switches the preceding letter to a narrower medial form, so the text that
    // was already there gets narrower and a line is pulled back.
    const ARABIC_TWO_LINES = 'wwwww ' + '\u0628'.repeat(26);
    const ARABIC_ONE_LINE = ARABIC_TWO_LINES + '\u0647';

    /** Reproduces the measured shaping: the append *reduces* the line count. */
    const cursiveLines = (value: string): number =>
      value === ARABIC_ONE_LINE ? 1 : value === ARABIC_TWO_LINES ? 2 : 1;

    it('shrinks when appending a joining letter reflows the prefix onto fewer lines', async () => {
      const h = await setup({
        minRows: 1,
        maxRows: 20,
        linesFor: cursiveLines,
      });

      await h.type(ARABIC_TWO_LINES);
      expect(h.currentHeight()).toBe(`${2 * LINE_HEIGHT + PAD}px`); // 50px

      // This is an append by `startsWith`, so only the joining-script gate can
      // send it down the reset path. Without it the height stays at 50px and
      // the field keeps one blank line.
      await h.type(ARABIC_ONE_LINE);
      expect(h.currentHeight()).toBe(`${1 * LINE_HEIGHT + PAD}px`); // 30px
    });

    it('takes the reset path for joining-script content', async () => {
      const h = await setup({ minRows: 1, maxRows: 20 });
      await h.type('\u0628\u0628');
      h.resetCounters();

      await h.type('\u0628\u0628\u0647'); // a pure append
      expect(h.heightWrites[0]).toBe('auto');
    });

    it('detects joining script regardless of writing direction', async () => {
      // Arabic-script text appears in dir="ltr" fields too, so the gate must be
      // content-based. The element here is never given `dir="rtl"`.
      const h = await setup({ minRows: 1, maxRows: 20 });
      await h.type('note: \u0628');
      h.resetCounters();

      await h.type('note: \u0628\u0628');
      expect(h.heightWrites[0]).toBe('auto');
    });

    // Latin, CJK and Hebrew are not cursive-joining; gating on them would give
    // up the optimisation for no reason. One test each — a single test cannot
    // call `setup()` repeatedly, because each call spies on `getComputedStyle`
    // and the spies would nest.
    const nonJoining: ReadonlyArray<readonly [string, string]> = [
      ['Latin', 'hello'],
      ['CJK', '\u4f60\u597d'],
      ['Hebrew', '\u05d0\u05d1'],
    ];
    for (const [label, text] of nonJoining) {
      it(`keeps the fast path for ${label}, which does not join`, async () => {
        const h = await setup({ minRows: 1, maxRows: 20 });
        await h.type(text);
        h.resetCounters();

        await h.type(text + text[0]);
        expect(h.heightWrites).toEqual([]);
      });
    }
  });

  describe('maxRows ceiling', () => {
    it('stops writing once the clamped height stops changing', async () => {
      const h = await setup({ maxRows: 2 });

      // Fill well past the ceiling.
      await h.type('a'.repeat(CHARS_PER_LINE * 5));
      expect(h.currentHeight()).toBe(`${2 * LINE_HEIGHT + PAD}px`); // 50px
      h.resetCounters();

      // At the ceiling `scrollHeight` runs ahead of the clamped height forever,
      // so the grow branch is entered on every keystroke — but the height it
      // computes is identical, so nothing may be written.
      for (let i = 0; i < 20; i++) {
        await h.type('a'.repeat(CHARS_PER_LINE * 5 + i + 1));
      }

      expect(h.heightWrites).toEqual([]);
      expect(h.currentHeight()).toBe(`${2 * LINE_HEIGHT + PAD}px`);
    });
  });

  describe('fuzz against the reference height', () => {
    /**
     * The invariant every path must hold: the applied height is the true
     * content height clamped to the row window — exactly what the previous
     * implementation computed by always resetting to `height: auto`. Any fast
     * path that diverges from it is a bug, so the fuzz drives long random
     * sequences of every edit shape and checks the invariant after each step.
     *
     * Each step applies an optional environment change (width, font metrics,
     * row clamps) and then always a value edit. The edit is what makes the
     * effect run — resizing is driven by `value`, so a density flip alone does
     * not resize, and in the real component the correction lands on the next
     * keystroke. That is exactly the sequence being checked.
     */
    const EDITS = ['append', 'truncate', 'splice', 'joining'] as const;
    const ENVS = ['none', 'none', 'width', 'metrics', 'clamps'] as const;

    /** Deterministic PRNG, so a failure names a reproducible seed. */
    const prng = (seed: number) => () =>
      ((seed = (seed * 1664525 + 1013904223) >>> 0) >>> 0) / 4294967296;

    for (const seed of [1, 7, 13, 42, 99]) {
      it(`holds the invariant across 120 random edits (seed ${seed})`, async () => {
        const rnd = prng(seed);
        const pick = <T>(xs: readonly T[]): T =>
          xs[Math.floor(rnd() * xs.length)];

        const h = await setup({ minRows: 2, maxRows: 8 });
        let value = 'seed';
        await h.type(value);

        for (let step = 0; step < 120; step++) {
          switch (pick(ENVS)) {
            case 'width':
              h.setWidth(pick([150, 210, 300, 390]));
              break;
            case 'metrics':
              h.setMetrics({
                lineHeight: pick([12, 16, 20, 25]),
                paddingTop: pick([0, 4, 8]),
                paddingBottom: pick([0, 6, 10]),
              });
              break;
            case 'clamps':
              h.fixture.componentRef.setInput('minRows', pick([1, 2, 4]));
              h.fixture.componentRef.setInput('maxRows', pick([3, 8, 12]));
              break;
            default:
              break;
          }

          const before = value;
          switch (pick(EDITS)) {
            case 'append':
              value += pick(['a', 'bb', 'ccc', 'dddd ', 'ee ff ', '\n']);
              break;
            case 'truncate':
              value = value.slice(
                0,
                Math.max(0, value.length - 1 - Math.floor(rnd() * 6)),
              );
              break;
            case 'splice': {
              const at = Math.floor(rnd() * (value.length + 1));
              value =
                value.slice(0, at) + pick(['x', 'yy', '\n']) + value.slice(at);
              break;
            }
            case 'joining':
              // Arabic-script text must route through the reset path; the
              // invariant is what proves it still lands on the right height.
              value += pick(['\u0628', '\u0647\u0628', '\u06cc']);
              break;
          }
          // The effect is driven by `value`, so an edit that changed nothing
          // would not resize and the step would assert against a stale height.
          if (value === before) value += 'z';

          await h.type(value);

          expect(
            h.currentHeight(),
            `seed ${seed} diverged at step ${step} for ${JSON.stringify(value)}`,
          ).toBe(`${h.expectedHeight()}px`);
        }
      });
    }
  });

  describe('growth and shrink', () => {
    it('grows as lines are added', async () => {
      const h = await setup({ minRows: 1, maxRows: 20 });

      await h.type('a'.repeat(CHARS_PER_LINE));
      expect(h.currentHeight()).toBe(`${1 * LINE_HEIGHT + PAD}px`);

      await h.type('a'.repeat(CHARS_PER_LINE * 3));
      expect(h.currentHeight()).toBe(`${3 * LINE_HEIGHT + PAD}px`);

      await h.type('a'.repeat(CHARS_PER_LINE * 7));
      expect(h.currentHeight()).toBe(`${7 * LINE_HEIGHT + PAD}px`);
    });

    it('shrinks below the current height when lines are removed', async () => {
      const h = await setup({ minRows: 1, maxRows: 20 });

      await h.type('a'.repeat(CHARS_PER_LINE * 6));
      expect(h.currentHeight()).toBe(`${6 * LINE_HEIGHT + PAD}px`);

      // Deleting is not an append, so the reset path must run — this is the
      // case any "skip the bracket" optimisation is most likely to break.
      await h.type('a'.repeat(CHARS_PER_LINE * 2));
      expect(h.currentHeight()).toBe(`${2 * LINE_HEIGHT + PAD}px`);

      await h.type('a');
      expect(h.currentHeight()).toBe(`${1 * LINE_HEIGHT + PAD}px`);
    });

    it('shrinks after a mid-string edit that removes a line', async () => {
      const h = await setup({ minRows: 1, maxRows: 20 });

      await h.type('aaa\nbbb\nccc');
      expect(h.currentHeight()).toBe(`${3 * LINE_HEIGHT + PAD}px`);

      // Splicing out the middle line keeps the length above zero but is not an
      // append, so the height must still come down.
      await h.type('aaa\nccc');
      expect(h.currentHeight()).toBe(`${2 * LINE_HEIGHT + PAD}px`);
    });

    it('re-measures from scratch when the content width changes', async () => {
      const h = await setup({ minRows: 1, maxRows: 20 });
      await h.type('a'.repeat(CHARS_PER_LINE * 2));
      expect(h.currentHeight()).toBe(`${2 * LINE_HEIGHT + PAD}px`);

      // A narrower box re-wraps the same text onto more lines. The edit is a
      // pure append, so only the width check can force the re-measure.
      Object.defineProperty(h.el, 'clientWidth', {
        configurable: true,
        get: () => WIDTH / 2,
      });
      h.resetCounters();
      await h.type('a'.repeat(CHARS_PER_LINE * 2) + 'a');

      expect(h.heightWrites[0]).toBe('auto');
    });
  });
});
