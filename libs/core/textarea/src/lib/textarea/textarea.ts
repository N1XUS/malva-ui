import {
  ChangeDetectionStrategy,
  Component,
  computed,
  type ElementRef,
  forwardRef,
  input,
  model,
  ViewEncapsulation,
  viewChild,
  effect,
} from '@angular/core';
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

  constructor() {
    super();
    // Re-run auto-resize when value changes
    effect(() => {
      this.value();
      if (this.autoResize()) {
        this._runAutoResize();
      }
    });
  }

  /** @private Adjusts textarea height to fit its content. */
  private _runAutoResize(): void {
    const el = this._textareaRef()?.nativeElement;
    if (!el) return;
    el.style.height = 'auto';
    let newHeight = el.scrollHeight;
    const minRows = this.minRows();
    const maxRows = this.maxRows();
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 24;
    const paddingTop = parseFloat(getComputedStyle(el).paddingTop) || 0;
    const paddingBottom = parseFloat(getComputedStyle(el).paddingBottom) || 0;

    if (minRows) {
      const minHeight = minRows * lineHeight + paddingTop + paddingBottom;
      newHeight = Math.max(newHeight, minHeight);
    }
    if (maxRows) {
      const maxHeight = maxRows * lineHeight + paddingTop + paddingBottom;
      newHeight = Math.min(newHeight, maxHeight);
    }
    el.style.height = `${newHeight}px`;
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
