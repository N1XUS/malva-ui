import {
  ChangeDetectionStrategy,
  Component,
  computed,
  type ElementRef,
  forwardRef,
  inject,
  input,
  model,
  PLATFORM_ID,
  ViewEncapsulation,
  viewChild,
  effect,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { MlvFormControl } from '@malva-ui/core/form-utils';
import {
  MlvSignalFormControlBase,
  MlvDescription,
  MlvFormControlWrapper,
  MlvFormControlWrapperControl,
  MlvHint,
  MlvLabel,
  MLV_FORM_CONTROL,
  MlvMessage,
} from '@malva-ui/core/form-utils';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import { MlvScrollbar } from '@malva-ui/core/scrollbar';

/**
 * What `_runAutoResize()` remembers about the previous resize so it can decide,
 * before touching the DOM, whether the next one may skip the `height: auto`
 * reset.
 *
 * Deliberately **not** exported: an internal detail of `MlvTextarea`, not part
 * of the public API.
 *
 * Note that nothing resolved from the computed style (line height, padding)
 * lives here loose: the resolved font metrics are carried in `metrics` so the
 * fast path can prove they have not moved before it trusts `heightPx`.
 */
interface AutoResizeState {
  /** The textarea's `value` at the moment the height below was measured. */
  readonly value: string;

  /** The height that was applied to the textarea, in pixels. */
  readonly heightPx: number;

  /**
   * The textarea's content-box width when it was measured, in pixels. A change
   * here re-wraps the text, so the remembered height says nothing about the
   * new layout.
   */
  readonly widthPx: number;

  /** `minRows` at measurement time — a change re-clamps the height. */
  readonly minRows: number | undefined;

  /** `maxRows` at measurement time — a change re-clamps the height. */
  readonly maxRows: number | undefined;

  /**
   * The font metrics `heightPx` was derived from.
   *
   * `heightPx` is a number computed from the line height and padding, so
   * trusting it later is trusting those. Nothing else in the record can notice
   * them moving: the field is `width: 100%; box-sizing: border-box`, so
   * `clientWidth` reports the *container* width and does not budge when the
   * font size or padding changes. The fast path therefore re-reads the metrics
   * and compares them against this before it reuses `heightPx`.
   */
  readonly metrics: TextareaMetrics;

  /**
   * Whether the remembered `value` contains any joining-script character.
   *
   * Lets the fast path check only the appended suffix instead of rescanning the
   * whole value on every keystroke — the property is a union over characters,
   * so `has(a + b)` is `has(a) || has(b)`.
   */
  readonly hasJoiningScript: boolean;
}

/** The resolved font metrics a row clamp is expressed in, in pixels. */
interface TextareaMetrics {
  /** Resolved `line-height`. */
  readonly lineHeightPx: number;
  /** Resolved `padding-top`. */
  readonly paddingTopPx: number;
  /** Resolved `padding-bottom`. */
  readonly paddingBottomPx: number;
}

/**
 * Matches any character from a cursive, joining script.
 *
 * The fast path in `_runAutoResize()` rests on appended text never being able
 * to remove a wrapped line. That holds for scripts whose glyphs have one form,
 * because line breaking is greedy and left-to-right. It does **not** hold for
 * joining scripts: appending a joining letter switches the *preceding* letter
 * to a narrower medial form, which can shrink the rendered width of the text
 * that was already there and pull a line back. Measured in Chrome 145 at 220px,
 * `'wwwww ' + 'ب'.repeat(26)` occupies two lines and appending one `'ه'` brings
 * it back to one.
 *
 * Matching is deliberately content-based rather than keyed off `direction`:
 * Arabic-script text appears in `dir="ltr"` fields too. Over-matching is
 * harmless — it only sends a resize down the slow path, which is always
 * correct.
 */
const JOINING_SCRIPT_PATTERN =
  /[\p{Script_Extensions=Arabic}\p{Script_Extensions=Syriac}\p{Script_Extensions=Thaana}\p{Script_Extensions=Nko}\p{Script_Extensions=Mongolian}\p{Script_Extensions=Adlam}\p{Script_Extensions=Mandaic}\p{Script_Extensions=Hanifi_Rohingya}\p{Script_Extensions=Manichaean}\p{Script_Extensions=Psalter_Pahlavi}\p{Script_Extensions=Sogdian}\p{Script_Extensions=Chorasmian}\p{Script_Extensions=Old_Uyghur}]/u;

@Component({
  selector: 'mlv-textarea',
  imports: [
    MlvLabel,
    MlvHint,
    MlvDescription,
    MlvFormControlWrapper,
    MlvFormControlWrapperControl,
    MlvMessage,
    MlvScrollbar,
  ],
  templateUrl: './textarea.html',
  styleUrl: './textarea.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: MLV_FORM_CONTROL,
      useExisting: forwardRef(() => MlvTextarea),
    },
  ],
  host: {
    class: 'mlv-textarea',
    '[class.mlv-textarea--default]': 'resolvedState() === "default"',
    '[class.mlv-textarea--success]': 'resolvedState() === "success"',
    '[class.mlv-textarea--info]': 'resolvedState() === "info"',
    '[class.mlv-textarea--warning]': 'resolvedState() === "warning"',
    '[class.mlv-textarea--error]': 'resolvedState() === "error"',
    '[class.mlv-textarea--disabled]': 'computedDisabled()',
    '[class.mlv-textarea--focused]': 'focused()',
    '[class.mlv-textarea--auto-resize]': 'autoResize()',
  },
})
export class MlvTextarea
  extends MlvSignalFormControlBase<string>
  implements MlvFormControl
{
  /** Placeholder text shown inside the textarea when empty. */
  readonly placeholder = input('');

  /** Number of visible text rows. Determines the default height. */
  readonly rows = input<number>(3);

  /** Minimum number of rows when autoResize is enabled. */
  readonly minRows = input<number | undefined>(undefined);

  /** Maximum number of rows when autoResize is enabled. */
  readonly maxRows = input<number | undefined>(undefined);

  /**
   * When true, the textarea grows vertically with content.
   * Respects minRows and maxRows constraints.
   */
  readonly autoResize = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * Maximum number of characters allowed.
   * When set, a character counter is displayed below the textarea.
   */
  readonly maxLength = input<number | undefined>(undefined);

  /** The character count ID for aria-describedby linking to the count element. */
  readonly countId = computed(() => `${this.id()}-count`);

  /**
   * @protected The textarea's `aria-describedby`: the shared description /
   * message ids from the base plus the character counter when one is rendered.
   * `null` when nothing describes the field, so no dangling IDREF is emitted.
   */
  protected readonly _textareaDescribedBy = computed(() => {
    const ids = this._describedBy();
    if (!this.maxLength()) return ids;
    return ids ? `${ids} ${this.countId()}` : this.countId();
  });

  /**
   * The textarea's text value — the signal-forms `FormValueControl` model.
   * Two-way bindable (`[(value)]`) and kept in sync with the bound field by
   * `[formField]` / `[formControl]` / `ngModel`. Replaces the former
   * `internalValue` signal + CVA transport.
   */
  readonly value = model<string>('');

  /** @private Reference to the native textarea element. */
  protected readonly _textareaRef =
    viewChild<ElementRef<HTMLTextAreaElement>>('textareaEl');

  /**
   * The current character count.
   */
  readonly charCount = computed(() => (this.value() ?? '').length);

  /**
   * Whether the character count is approaching the limit (>90%).
   */
  readonly isCountWarning = computed(() => {
    const max = this.maxLength();
    if (!max) return false;
    const ratio = this.charCount() / max;
    return ratio >= 0.9 && ratio < 1;
  });

  /**
   * Whether the character limit has been reached.
   */
  readonly isCountError = computed(() => {
    const max = this.maxLength();
    if (!max) return false;
    return this.charCount() >= max;
  });

  /**
   * Computed minimum height style for the scrollbar wrapper.
   * When rows = 1, matches `--mlv-height-m` (same as mlv-input).
   * For multi-row, grows proportionally: each additional row adds 1.5em.
   */
  readonly minHeightStyle = computed(() => {
    const rows = this.minRows() ?? this.rows();
    if (rows === 1) {
      return 'var(--mlv-height-m)';
    }
    // Base height for a single row equals --mlv-height-m (2.75rem).
    // Each extra row adds one line (1.5em at font-size ~0.875rem ≈ 1.3125rem).
    return `calc(var(--mlv-height-m) + ${rows - 1} * 1.5em)`;
  });

  /**
   * Computed maximum height style for the scrollbar wrapper based on maxRows input.
   */
  readonly maxHeightStyle = computed(() => {
    const maxRows = this.maxRows();
    if (!maxRows) return undefined;
    if (maxRows === 1) {
      return 'var(--mlv-height-m)';
    }
    return `calc(var(--mlv-height-m) + ${maxRows - 1} * 1.5em)`;
  });

  /**
   * @private Whether the component is running in a browser. Auto-resize
   * measures the DOM — `getComputedStyle` and layout do not exist on the
   * server, where reaching them throws and takes the effect down with it.
   */
  private readonly _isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /**
   * @private State of the last auto-resize, or `null` when nothing usable has
   * been measured yet. Consumed and refreshed by `_runAutoResize()`.
   *
   * A measurement taken while the textarea was not laid out (`display: none`,
   * detached, pre-hydration) is deliberately never stored: `getComputedStyle`
   * returns empty strings there, `parseFloat` yields `NaN`, and the `|| 24` /
   * `|| 0` fallbacks fabricate a line height. Those fallbacks are fine for the
   * one frame that asked, but storing them would pin the textarea to an
   * invented 24px line height for the rest of its life.
   */
  private _autoResizeState: AutoResizeState | null = null;

  constructor() {
    super();
    // Re-run auto-resize when value changes. `_runAutoResize()` reads
    // `minRows()` / `maxRows()` / `_textareaRef()` from inside this effect, so
    // those stay tracked too — do not hoist them out.
    effect(() => {
      this.value();
      if (this.autoResize()) {
        this._runAutoResize();
      } else {
        // Heights are not maintained while auto-resize is off, so anything
        // remembered from before is not a description of the current layout.
        this._autoResizeState = null;
      }
    });
  }

  /**
   * @private Adjusts the textarea height to fit its content.
   *
   * The obvious implementation forces a synchronous reflow on every keystroke:
   * writing `height: auto` invalidates layout and reading `scrollHeight`
   * immediately afterwards forces the browser to recompute it, and the closing
   * write then invalidates it again for the next frame. That reset is what
   * makes *shrinking* work — while an explicit height is applied `scrollHeight`
   * saturates at it and can never report that the content got shorter.
   *
   * It is only needed when the content may actually have shrunk. For a
   * non-joining script, appending cannot remove a wrapped line: line breaking
   * is greedy and left-to-right, so text added at the end never moves where the
   * earlier lines break. (Joining scripts break exactly that premise, which is
   * why `JOINING_SCRIPT_PATTERN` sends them down the reset path — see its own
   * comment.) So when the new value merely extends the old one, contains no
   * joining-script character, and the content-box width, the resolved font
   * metrics and the row clamps are all unchanged, reading `scrollHeight`
   * *without* the reset settles it:
   *
   * - `scrollHeight` no greater than the height already applied — the content
   *   still fits, the height is unchanged, and nothing is written at all;
   * - otherwise the content overflows the box, so `scrollHeight` *is* the
   *   content height and the new height follows from it directly: one write —
   *   and none at all if the clamp maps it back to the height already
   *   applied — with no invalidating write before the read.
   *
   * Every other edit — a deletion, a mid-string splice, a width change, a font
   * metric change, a `minRows`/`maxRows` change, joining-script text, the first
   * run — takes the reset path. There the single write is followed by *all* of
   * the reads, so the invalidation is paid for once instead of once per read.
   *
   * Both paths read the computed style exactly once, and neither caches what it
   * finds beyond the single comparison in `AutoResizeState.metrics`. The values
   * depend on the resolved font size, which this component cannot observe:
   * density reaches it only as ancestor custom properties
   * (`--form-ctrl-font-size`) and an ancestor `[class*='--compact']` selector,
   * and `line-height` is the unitless `1.5` from the stylesheet, so it tracks
   * every font-size change (theme, root font size, browser zoom, a web font
   * finishing load, consumer CSS). None of that arrives as a signal, so the
   * metrics are re-read and compared rather than trusted.
   */
  private _runAutoResize(): void {
    const el = this._textareaRef()?.nativeElement;
    if (!el || !this._isBrowser) return;

    const minRows = this.minRows();
    const maxRows = this.maxRows();
    // The element's own value, not `value()`: the fast path reasons about the
    // text that is currently laid out, which is what `scrollHeight` measures.
    const value = el.value;
    const previous = this._autoResizeState;

    if (
      previous &&
      previous.minRows === minRows &&
      previous.maxRows === maxRows &&
      value.startsWith(previous.value) &&
      !previous.hasJoiningScript &&
      !JOINING_SCRIPT_PATTERN.test(value.slice(previous.value.length))
    ) {
      // Layout reads first, then the computed style: forcing layout settles
      // style on the way, so the style read that follows is served from the
      // same clean pass. No write separates any of them.
      const widthPx = el.clientWidth;
      const scrollHeight = el.scrollHeight;
      const metrics = this._readMetrics(el);

      if (
        widthPx === previous.widthPx &&
        metrics.lineHeightPx === previous.metrics.lineHeightPx &&
        metrics.paddingTopPx === previous.metrics.paddingTopPx &&
        metrics.paddingBottomPx === previous.metrics.paddingBottomPx
      ) {
        if (scrollHeight <= previous.heightPx) {
          // Still fits: the height is unchanged, so the DOM is left untouched.
          this._autoResizeState = { ...previous, value };
          return;
        }

        const newHeight = this._clampToRows(
          scrollHeight,
          metrics,
          minRows,
          maxRows,
        );
        // At the `maxRows` ceiling `scrollHeight` runs ahead of the clamped
        // height forever, so without this the branch would rewrite the same
        // value on every further keystroke.
        if (newHeight !== previous.heightPx) {
          el.style.height = `${newHeight}px`;
        }
        this._autoResizeState = {
          value,
          heightPx: newHeight,
          widthPx,
          minRows,
          maxRows,
          metrics,
          hasJoiningScript: false,
        };
        return;
      }
    }

    // Slow path — one write, then every read, so one recalculation serves all
    // of them.
    el.style.height = 'auto';
    const widthPx = el.clientWidth;
    const contentHeight = el.scrollHeight;
    const metrics = this._readMetrics(el);
    const newHeight = this._clampToRows(
      contentHeight,
      metrics,
      minRows,
      maxRows,
    );
    el.style.height = `${newHeight}px`;

    // Only a genuine measurement is remembered. A detached textarea reports a
    // width of 0 and a height built from the fabricated fallbacks in
    // `_readMetrics()`; storing that would keep the fast path answering from
    // invented numbers even after the element is attached.
    this._autoResizeState =
      widthPx > 0
        ? {
            value,
            heightPx: newHeight,
            widthPx,
            minRows,
            maxRows,
            metrics,
            hasJoiningScript: JOINING_SCRIPT_PATTERN.test(value),
          }
        : null;
  }

  /**
   * @private Reads the resolved line height and vertical padding off a single
   * `getComputedStyle` declaration.
   *
   * Reading them from three separate calls, as this used to, costs three
   * property reads off the same recalculation rather than three
   * recalculations — no write separates them — but there is no reason to pay
   * even that.
   *
   * A **detached** element resolves every longhand to an empty string, so
   * `parseFloat` yields `NaN` and the `|| 24` / `|| 0` fallbacks fabricate a
   * line height. (A `display: none` element that is still in the document is
   * not affected: Chrome resolves real values for it.) The fallbacks are fine
   * for the frame that asked; `_runAutoResize()` is what refuses to *remember*
   * a result measured on an element that was not laid out.
   */
  private _readMetrics(el: HTMLTextAreaElement): TextareaMetrics {
    const style = getComputedStyle(el);
    return {
      lineHeightPx: parseFloat(style.lineHeight) || 24,
      paddingTopPx: parseFloat(style.paddingTop) || 0,
      paddingBottomPx: parseFloat(style.paddingBottom) || 0,
    };
  }

  /**
   * @private Clamps a measured content height into the `minRows` / `maxRows`
   * window and returns the height to apply.
   *
   * The window is expressed in rows, so converting it to pixels needs the
   * metrics; with neither clamp configured the content height is returned
   * unchanged.
   *
   * `lineHeightPx` is the unitless `1.5` from the stylesheet resolved against
   * the font size, so it is routinely fractional. The clamp it produces is
   * fractional too while `scrollHeight` is an integer, which can leave the
   * applied height up to 1px above what an exact computation would give. It is
   * self-limiting — the next measurement starts from the clamp again, not from
   * the rounded value — and invisible at one device pixel.
   */
  private _clampToRows(
    contentHeight: number,
    metrics: TextareaMetrics,
    minRows: number | undefined,
    maxRows: number | undefined,
  ): number {
    if (!minRows && !maxRows) return contentHeight;

    const padding = metrics.paddingTopPx + metrics.paddingBottomPx;
    let result = contentHeight;
    if (minRows) {
      result = Math.max(result, minRows * metrics.lineHeightPx + padding);
    }
    if (maxRows) {
      result = Math.min(result, maxRows * metrics.lineHeightPx + padding);
    }
    return result;
  }

  /** Handles the native input event. */
  onInput(event: Event): void {
    this.value.set((event.target as HTMLTextAreaElement).value);
  }

  /** Handles the native blur event. */
  onBlur(): void {
    this.setFocused(false);
    this._markTouched();
  }

  /** Whether the control holds a clearable value — Non-empty text present. */
  readonly hasValue = computed(() => (this.value() ?? '').length > 0);

  /** Clears the textarea value and marks the field touched. */
  clearValue(): void {
    this.value.set('');
    this._markTouched();
  }
}
