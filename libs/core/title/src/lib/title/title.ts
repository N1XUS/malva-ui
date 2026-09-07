import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  forwardRef,
  inject,
  input,
  model,
  signal,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import type {
  MlvFormControl,
  MlvFormControlLabelStrategy,
} from '@malva-ui/core/form-utils';
import {
  MlvSignalFormControlBase,
  MLV_FORM_CONTROL,
} from '@malva-ui/core/form-utils';

export type MlvTitleLevel = 1 | 2 | 3 | 4 | 5 | 6;

function coerceTitleLevel(
  value: MlvTitleLevel | string | number | null | undefined,
): MlvTitleLevel | undefined {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 6) {
    return undefined;
  }

  return parsed as MlvTitleLevel;
}

function inferTitleLevel(tagName: string): MlvTitleLevel {
  const match = /^h([1-6])$/.exec(tagName.toLowerCase());
  return match ? (Number(match[1]) as MlvTitleLevel) : 2;
}

/**
 * Inline title component that decorates the host element with Malva UI heading
 * typography. It can render projected content, bind to a model, or act as an
 * editable control through signal, reactive, and template-driven forms.
 */
@Component({
  // Attribute-selector component — camelCase [mlvX] is the documented pattern
  // (see .claude/rules/angular-component.md); the rule only models kebab-case.
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: '[mlvTitle]',
  templateUrl: './title.html',
  styleUrl: './title.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: MLV_FORM_CONTROL,
      useExisting: forwardRef(() => MlvTitle),
    },
  ],
  host: {
    class: 'mlv-title',
    '[attr.data-level]': '_resolvedLevel()',
    '[attr.role]': '_isNativeHeading() ? null : "heading"',
    '[attr.aria-level]': '_isNativeHeading() ? null : _resolvedLevel()',
    '[class.mlv-title--editable]': 'editable()',
    '[class.mlv-title--disabled]': 'computedDisabled()',
    '[class.mlv-title--focused]': 'focused()',
  },
})
export class MlvTitle
  extends MlvSignalFormControlBase<string | null>
  implements MlvFormControl
{
  /**
   * @protected Only an editable title has a focus target at all — the
   * `<textarea>` that carries {@link _editorId}, which is labelable. A
   * read-only `[mlvTitle]` is a heading, not a control, so nothing outside it
   * may be pointed at.
   */
  protected override _externalLabelStrategy(): MlvFormControlLabelStrategy {
    return this.editable() ? 'native' : 'none';
  }

  /**
   * @protected Id of the `<textarea>` — derived from {@link id} rather than
   * equal to it.
   *
   * `[mlvTitle]`'s host is the consumer's own heading, and a **static** `id`
   * attribute is both bound to this inherited input and left on that heading
   * by the compiler. `<h2 id="overview-title" mlvTitle editable>` would
   * therefore put `overview-title` on two elements at once, and an
   * `aria-labelledby` aimed at the heading — the idiom `apps/docs` ships four
   * times over — would resolve to whichever came first in the document. The
   * suffix keeps the two distinct while staying derivable from `id`.
   */
  protected readonly _editorId = computed(() => `${this.id()}-input`);

  /**
   * @protected The `<textarea>` is the labelable element here, not the
   * heading, so that is what a projected `<mlv-label>`'s `for` must name.
   */
  protected override _labelTargetId(): string {
    return this._editorId();
  }

  /** Explicit visual title level. Falls back to the host heading tag. */
  readonly level = input<
    MlvTitleLevel | undefined,
    MlvTitleLevel | string | number | null | undefined
  >(undefined, {
    transform: coerceTitleLevel,
  });

  /** Enables the auto-sizing editable textarea overlay. */
  readonly editable = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /** Placeholder displayed when the editable field is empty. */
  readonly placeholder = input('');

  /** Signal-model API for directly binding the title text. */
  readonly value = model<string | null>(null);

  /** @private Host element ref, used to read the host tag name for level inference. */
  private readonly _hostElement = inject<ElementRef<HTMLElement>>(ElementRef);
  /** @private Reference to the projected-content span, used to hydrate text from projected content. */
  private readonly _projectionElement =
    viewChild<ElementRef<HTMLElement>>('projectionContent');
  /** @private Trimmed text extracted from projected content. */
  private readonly _projectedText = signal('');
  /** @private Whether the component is currently driven by its internal editable value. */
  private readonly _usesInternalValue = signal(false);
  /** @private Tracks whether internal state was last synced from an external `value`. */
  private _syncedFromExternalValue = false;

  /** @protected Whether the host element is a native `h1`–`h6` heading. */
  protected readonly _isNativeHeading = computed(() =>
    /^h[1-6]$/.test(this._hostTagName),
  );
  /** @protected Resolved visual heading level — explicit `level` input or inferred from the host tag. */
  protected readonly _resolvedLevel = computed<MlvTitleLevel>(
    () => this.level() ?? inferTitleLevel(this._hostTagName),
  );
  /** @protected The effective title text: bound `value`, internal editable value, or projected content. */
  protected readonly currentText = computed(() => {
    const explicitValue = this.value();
    if (explicitValue !== null && explicitValue !== undefined) {
      return explicitValue;
    }

    if (this._usesInternalValue()) {
      return this.internalValue();
    }

    return this._projectedText();
  });
  /** @protected Whether the projected `<ng-content>` should be shown (no value, not editable). */
  protected readonly showProjectedContent = computed(
    () =>
      !this.editable() &&
      !this._usesInternalValue() &&
      (this.value() === null || this.value() === undefined),
  );
  /** @protected Whether the bound value text should be shown (not editable, not projected). */
  protected readonly showValueText = computed(
    () => !this.editable() && !this.showProjectedContent(),
  );
  /** @protected Sizing text for the editable `<pre>` mirror (trailing newline keeps a blank line tall). */
  protected readonly editorMeasureText = computed(() => {
    const text = this.currentText() || this.placeholder();
    return text ? `${text}\n` : ' ';
  });
  /** @protected Whether the editable field is empty and a placeholder should be shown. */
  protected readonly editorShowsPlaceholder = computed(
    () => !this.currentText() && !!this.placeholder(),
  );
  /** @protected Current value bound to the editable `<textarea>`. */
  protected readonly textareaValue = computed(() => this.currentText());

  /** Internal text state used by editable mode and forms APIs. */
  readonly internalValue = signal('');

  /** @private The lowercased tag name of the host element (e.g. `h2`, `div`). */
  private get _hostTagName(): string {
    return this._hostElement.nativeElement.tagName.toLowerCase();
  }

  constructor() {
    super();

    effect(() => {
      const externalValue = this.value();

      if (externalValue === null || externalValue === undefined) {
        if (this._syncedFromExternalValue) {
          this.internalValue.set('');
          this._usesInternalValue.set(false);
        }

        this._syncedFromExternalValue = false;
        return;
      }

      this._syncedFromExternalValue = true;
      this.internalValue.set(externalValue);
      this._usesInternalValue.set(true);
    });

    afterNextRender(() => {
      this._hydrateProjectedText();
    });
  }

  /** Handles interactive edits from the textarea overlay. */
  onInput(event: Event): void {
    const value = (event.target as HTMLTextAreaElement).value;
    this.internalValue.set(value);
    this._usesInternalValue.set(true);
    // The `value` model is the signal-forms transport: setting it propagates
    // the edit to the bound field ([formField]/[formControl]/ngModel).
    this.value.set(value);
  }

  /** Tracks focus state for form-field styling. */
  onFocus(): void {
    this.setFocused(true);
  }

  /** Tracks blur state for form-field styling and touched state. */
  onBlur(): void {
    this.setFocused(false);
    this._markTouched();
  }

  /** Whether the control holds a clearable value — Non-empty text present. */
  readonly hasValue = computed(() => this.internalValue().length > 0);

  /** @private Reads projected text after render and seeds the editable value from it when appropriate. */
  private _hydrateProjectedText(): void {
    const projectedText =
      this._projectionElement()?.nativeElement.textContent?.trim() ?? '';

    this._projectedText.set(projectedText);

    if (
      this.editable() &&
      !this._usesInternalValue() &&
      (this.value() === null || this.value() === undefined) &&
      projectedText
    ) {
      this.internalValue.set(projectedText);
      this._usesInternalValue.set(true);
    }
  }
}
