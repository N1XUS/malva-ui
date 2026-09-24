import { NgTemplateOutlet } from '@angular/common';
import type { TemplateRef } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  effect,
  ElementRef,
  forwardRef,
  inject,
  input,
  model,
  output,
  signal,
  viewChildren,
  ViewEncapsulation,
} from '@angular/core';
import { LucideDot } from '@lucide/angular';
import { LEFT_ARROW, RIGHT_ARROW } from '@angular/cdk/keycodes';
import { MlvRtlService, clamp } from '@malva-ui/cdk/utils';
import type { MlvFormControl } from '@malva-ui/core/form-utils';
import {
  MlvHint,
  MlvDescription,
  MlvLabel,
  MLV_FORM_CONTROL,
  MlvMessage,
  MlvSignalFormControlBase,
} from '@malva-ui/core/form-utils';
import { MlvInput } from '@malva-ui/core/input';
import { MLV_PIN_INPUT_I18N, MlvI18nResolverService } from '@malva-ui/i18n';
import { MlvPinInputSeparator } from './pin-input-separator';

/**
 * OTP / PIN input component — a row of single-character `mlv-input` cells that
 * behave as one logical form control.
 *
 * - Auto-advances focus to the next cell after a character is entered.
 * - Backspace moves focus backwards and clears the cell.
 * - Arrow keys navigate between cells.
 * - Pasting a string distributes characters across cells starting from the first cell.
 * - Integrates with Angular Reactive Forms and Template-Driven Forms via CVA.
 * - Supports `mlv-label`, `mlv-hint`, and `mlv-message` via the same `label`,
 *   `hint`, `message`, and `state` inputs as every other Malva UI form control.
 *
 * @example Reactive form with label and error message
 * ```html
 * <mlv-pin-input
 *   [length]="6"
 *   [formControl]="otpControl"
 *   label="One-time code"
 *   hint="Sent to +1 ••• 1234"
 *   [state]="otpControl.invalid && otpControl.touched ? 'error' : 'default'"
 *   [message]="otpControl.invalid && otpControl.touched ? 'Code is invalid' : ''"
 * />
 * ```
 *
 * @example Password mode
 * ```html
 * <mlv-pin-input type="password" [length]="6" [formControl]="pinControl" />
 * ```
 */
@Component({
  selector: 'mlv-pin-input',
  imports: [
    MlvInput,
    MlvDescription,
    MlvLabel,
    MlvHint,
    MlvMessage,
    NgTemplateOutlet,
    LucideDot,
  ],
  templateUrl: './pin-input.html',
  styleUrl: './pin-input.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: MLV_FORM_CONTROL,
      useExisting: forwardRef(() => MlvPinInput),
    },
  ],
  host: {
    class: 'mlv-pin-input',
    '[class]': '"mlv-pin-input--state-" + resolvedState()',
    '[class.mlv-pin-input--disabled]': 'computedDisabled()',
    '[class.mlv-pin-input--focused]': 'focused()',
    '[attr.role]': '"group"',
    '[attr.aria-label]': 'label() || _i18n().pinEntry',
    '[attr.aria-disabled]': 'computedDisabled() || null',
  },
})
export class MlvPinInput
  extends MlvSignalFormControlBase<string>
  implements MlvFormControl
{
  /** @protected The component's i18n strings signal. */
  protected readonly _i18n = inject(MLV_PIN_INPUT_I18N);

  /** @private Resolver for ICU parameterized i18n strings. */
  private readonly _resolver = inject(MlvI18nResolverService);

  /**
   * Number of cells (characters) in the PIN / OTP.
   * @default 6
   */
  readonly length = input<number>(6);

  /**
   * Input type applied to each cell.
   * Use `'password'` to mask characters; `'number'` for digit-only PIN.
   * @default 'text'
   */
  readonly type = input<'text' | 'password' | 'number'>('text');

  /**
   * Placeholder character shown in each empty cell.
   * @default '·'
   */
  readonly placeholder = input<string>('·');

  /**
   * Controls separator placement between cells.
   *
   * - `''` (default) — no separators
   * - `'each'` — separator between every pair of consecutive cells
   * - comma-separated indices (e.g. `'1,3'`) — separator before the cell at
   *   each listed index. With `length=4` and `'1,3'` the result is
   *   `[0]—[1][2]—[3]`.
   *
   * By default separators render as a Lucide dot icon. Project a custom
   * template via `*mlvPinInputSeparator` to override.
   *
   * @default ''
   */
  readonly separator = input<string>('');

  /**
   * Emits the complete value string when all cells are filled.
   */
  readonly completed = output<string>();

  /** The complete PIN/OTP value used by all Angular forms APIs. */
  readonly value = model<string>('');

  // ── Internal state ─────────────────────────────────────────────────────────

  /**
   * @protected Char values per cell index. Sparse — empty cell = `''`.
   */
  protected readonly _values = signal<string[]>([]);

  /** @private Latest model value written by this component, used to avoid collapsing sparse cells. */
  private _internalModelWrite: string | null = null;

  /** @protected Stable cell indexes derived from {@link length}. */
  protected readonly _cellIndices = computed(() =>
    Array.from({ length: this.length() }, (_, index) => index),
  );

  /**
   * @private Live refs to each rendered `<mlv-input>` cell, order-aligned
   * with `_cellControls`. Used for programmatic focus / text selection.
   */
  private readonly _cells = viewChildren(MlvInput);

  /** @private Normalizes horizontal cell navigation for RTL layouts. */
  private readonly _rtlService = inject(MlvRtlService);

  /**
   * @private Host element; the scope horizontal arrow keys resolve their
   * direction against, so cell movement mirrors inside a `[dir]` subtree — or
   * inside an overlay pane, which CDK stamps with its own `dir` — and not only
   * on a document-wide flip.
   */
  private readonly _elementRef = inject(ElementRef<HTMLElement>);

  /**
   * @private Direction applying to this field, resolved once and cached behind
   * the shared `dir` observer rather than re-walked on every arrow keypress.
   */
  private readonly _direction = this._rtlService.elementDirection(
    this._elementRef,
  );

  /**
   * @protected Optional projected template used as separator content between
   * cells. When absent the component renders a default Lucide dot icon.
   */
  protected readonly _separatorDef = contentChild(MlvPinInputSeparator);

  /**
   * @protected Custom separator template, derived from `_separatorDef`.
   */
  protected readonly _separatorTemplate = computed<TemplateRef<unknown> | null>(
    () => this._separatorDef()?.templateRef ?? null,
  );

  /**
   * @protected Resolved set of cell indices that should be preceded by a
   * separator. Derived from the `separator` input and `length`.
   *
   * - `''` → empty set
   * - `'each'` → `{1, 2, …, length - 1}`
   * - `'1,3'` → `{1, 3}` (values outside `[1, length - 1]` are ignored)
   */
  protected readonly _separatorPositions = computed<Set<number>>(() => {
    const spec = this.separator().trim();
    if (!spec) return new Set();

    const len = this.length();
    if (spec === 'each') {
      return new Set(
        Array.from({ length: Math.max(0, len - 1) }, (_, i) => i + 1),
      );
    }

    const parsed = spec
      .split(',')
      .map((s) => Number.parseInt(s.trim(), 10))
      .filter((n) => Number.isInteger(n) && n > 0 && n < len);
    return new Set(parsed);
  });

  /**
   * @protected Whether a separator should be rendered before the cell at
   * `index`.
   */
  protected _hasSeparatorBefore(index: number): boolean {
    return this._separatorPositions().has(index);
  }

  /**
   * @protected Stable per-cell id. The first cell's id is referenced by the
   * optional `<mlv-label>`'s `for` attribute so clicking the label focuses
   * the first cell.
   */
  protected _cellId(index: number): string {
    return `${this.id()}-cell-${index}`;
  }

  /**
   * @protected Resolves a single cell's aria-label, e.g. "Digit 2 of 6".
   * @param index 0-based cell index.
   */
  protected _cellLabel(index: number): string {
    return this._resolver.resolve(
      this._i18n() as unknown as Record<string, string>,
      'digit',
      { position: index + 1, length: this.length() },
    );
  }

  constructor() {
    super();
    // Touched and unfocused only when focus leaves the whole row — never on
    // the cell-to-cell move every typed digit makes (#347, D22).
    this._reportTouchOnFocusLeave();
    effect(() => {
      const value = this.value() ?? '';
      const len = this.length();
      if (this._internalModelWrite === value) {
        this._internalModelWrite = null;
        return;
      }
      this._values.set(this._cellsFor(value, len));
    });
  }

  /**
   * @private Splits a joined value into exactly `length` positional cells,
   * padding with `''` and dropping characters past the last cell.
   */
  private _cellsFor(value: string, length: number): string[] {
    const chars = value.split('').slice(0, length);
    return Array.from({ length }, (_, index) => chars[index] ?? '');
  }

  // ── Forms value ────────────────────────────────────────────────────────────

  /** Whether the control holds a clearable value — At least one cell filled. */
  readonly hasValue = computed(() =>
    this._values().some((cell) => cell !== ''),
  );

  // ── Cell event handlers ────────────────────────────────────────────────────

  /**
   * @protected Reacts to cell FormControl value changes. Normalises multi-char
   * input to the last character and auto-advances focus, or distributes a
   * multi-char string across subsequent cells when triggered by IME / fast typing.
   */
  protected _onCellChange(index: number, raw: string): void {
    // Native `readOnly` / `disabled` on the cells already stop typing; this
    // covers an input that reaches the handler anyway, before `_values` moves.
    // The cell has already taken the character into its own `value` model and
    // its native field shows it. Neither binding puts it back on its own: our
    // `[value]` is unchanged, and the cell's inner `[value]` ends on the same
    // string it last rendered, so Angular writes nothing to the DOM. Restore
    // both — the model so the cell agrees with us, the field so it stops
    // showing the refused character. The re-entrant `valueChange` from the
    // model write lands here again and stops: the model already holds the
    // restored value, so the second write emits nothing.
    if (!this._canWrite()) {
      const cell = this._cellAt(index);
      const restored = this._values()[index] ?? '';
      cell?.value.set(restored);
      const field = cell?.nativeElement;
      if (field) field.value = restored;
      return;
    }
    // When a cell already holds a character and the user types again, the
    // native input accumulates (e.g. cell was '3', user types '4' → '34').
    // Strip the previous value prefix so we treat only the new keystroke.
    let effective = raw;
    if (effective.length > 1) {
      const prev = this._values()[index] ?? '';
      if (prev && effective.startsWith(prev)) {
        effective = effective.slice(prev.length);
      }
    }

    if (effective.length > 1) {
      this._distributeChars(effective, index);
      return;
    }

    const char = effective.slice(-1);
    this._setCell(index, char);

    if (!char) {
      this._emit();
      return;
    }

    if (index < this.length() - 1) {
      this._focusCell(index + 1);
    } else {
      // Last cell — no next cell to advance to. Re-select the content so the
      // next keystroke replaces this character instead of appending.
      this._cellAt(index)?.select();
    }
    this._emit();
  }

  /**
   * @protected Handles cell keyboard input — Backspace, Delete, arrows, Home/End.
   * Backspace and Delete erase only while the field may be written; the native
   * `readOnly` on a cell does not stop them, because they are handled here.
   * Navigation (arrows, Home / End, Backspace on an empty cell) always works.
   */
  protected _onCellKeydown(index: number, event: KeyboardEvent): void {
    switch (event.key) {
      case 'Backspace':
        event.preventDefault();
        if (this._values()[index]) {
          if (!this._canWrite()) break;
          this._setCell(index, '');
          this._emit();
        } else {
          this._focusCell(index - 1);
        }
        break;

      case 'Delete':
        event.preventDefault();
        if (!this._canWrite()) break;
        this._setCell(index, '');
        this._emit();
        break;

      case 'Home':
        event.preventDefault();
        this._focusCell(0);
        break;

      case 'End':
        event.preventDefault();
        this._focusCell(this.length() - 1);
        break;
    }

    switch (this._rtlService.normalizeArrowKey(event, this._direction())) {
      case LEFT_ARROW:
        event.preventDefault();
        this._focusCell(index - 1);
        break;
      case RIGHT_ARROW:
        event.preventDefault();
        this._focusCell(index + 1);
        break;
    }
  }

  /**
   * @protected Pastes a string of characters across cells starting from the
   * first cell. Whitespace is stripped before distribution. The event is
   * always cancelled, so a refused paste (readonly or disabled) leaves the
   * native cell untouched as well as the value.
   */
  protected _onCellPaste(_index: number, event: ClipboardEvent): void {
    event.preventDefault();
    if (!this._canWrite()) return;
    const text = event.clipboardData?.getData('text/plain') ?? '';
    this._distributeChars(text, 0);
  }

  /**
   * @protected Selects the contents of a cell when it receives focus so the
   * next keystroke replaces the current character.
   *
   * A cell losing focus reports nothing on its own: the focus-leave report
   * set up in the constructor (`_reportTouchOnFocusLeave`) clears
   * `focused()` and emits `touch` only once focus leaves the row. Before
   * #347 every cell blur did both, so the auto-advance after the first digit
   * marked the field touched and painted a validated code red while the user
   * was still typing it.
   */
  protected _onCellFocus(index: number): void {
    this.setFocused(true);
    this._cellAt(index)?.select();
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /**
   * @private Sets a single cell's value, preserving the length of `_values`.
   */
  private _setCell(index: number, char: string): void {
    const updated = [...this._values()];
    while (updated.length < this.length()) updated.push('');
    updated[index] = char;
    this._values.set(updated);
  }

  /**
   * @private Distributes a sequence of characters across cells starting from
   * `startIndex`, advances focus to the next empty cell, and emits.
   */
  private _distributeChars(text: string, startIndex: number): void {
    const chars = text.replace(/\s/g, '').split('');
    const updated: string[] = Array.from(
      { length: this.length() },
      (_, i) => this._values()[i] ?? '',
    );

    let lastFilled = startIndex;
    for (let i = 0; i < chars.length && startIndex + i < this.length(); i++) {
      updated[startIndex + i] = chars[i];
      lastFilled = startIndex + i;
    }

    this._values.set(updated);
    this._focusCell(lastFilled + 1);
    this._emit();
  }

  /**
   * @private Focuses the cell at the given index, clamped to `[0, length - 1]`.
   */
  private _focusCell(index: number): void {
    const clamped = clamp(index, 0, this.length() - 1);
    this._cellAt(clamped)?.focus();
  }

  /**
   * @private Returns the `MlvInput` instance rendered for the cell at
   * the given index, or `null` if the cell is not yet rendered.
   */
  private _cellAt(index: number): MlvInput | null {
    return this._cells()[index] ?? null;
  }

  /**
   * @private Pushes the current joined value to the forms model and
   * emits `completed` when every cell is filled.
   */
  private _emit(): void {
    const values = this._values();
    const full = values.join('');
    if (this.value() !== full) {
      this._internalModelWrite = full;
      // Every caller is gated on `_canWrite()` before it touches `_values`, so
      // this refusal is a backstop, not a path. Should a caller that is not be
      // added, the cells go back to the model instead of staying diverged.
      if (!this._write(full)) {
        this._internalModelWrite = null;
        this._values.set(this._cellsFor(this.value() ?? '', this.length()));
        return;
      }
    }

    if (values.length === this.length() && values.every((v) => v !== '')) {
      this.completed.emit(full);
    }
  }
}
