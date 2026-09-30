import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  model,
  output,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import { MlvButton } from '@malva-ui/core/button';
import { MlvInput } from '@malva-ui/core/input';
import { MlvRadio, MlvRadioGroup } from '@malva-ui/core/radio';
import { MLV_EDITOR_I18N } from '@malva-ui/i18n';
import type { MlvEditorAiOutputMode } from './editor-ai.types';

/**
 * @internal The custom-prompt body shared by `mlv-editor-ai-menu`'s popup
 * and the editor's interim "Ask AI…" prompt (#516): an instruction field, the
 * output-mode radio group, and Apply / Cancel.
 *
 * Controlled: the owner holds the draft (`instruction`, `output`) so it
 * survives the panel being re-created on every open, and decides what
 * `submitted` does. The radio group renders only while `fixedOutput` is
 * unset. The host keeps the AI menu's BEM classes
 * (`.mlv-editor-ai-menu__panel`, `__output`, `__actions`) because the menu's
 * prompt markup is public and must not change (VERSIONING row 120); the
 * interim prompt reuses the same panel, classes included.
 */
@Component({
  selector: 'div[mlvEditorAiPromptPanel]',
  imports: [MlvButton, MlvInput, MlvRadio, MlvRadioGroup],
  template: `
    <mlv-input
      #_instructionInput
      [label]="_copy().aiCustom"
      [placeholder]="_copy().aiPromptPlaceholder"
      [disabled]="disabled()"
      [value]="instruction()"
      (valueChange)="instruction.set($event)"
      (keydown.enter)="submitted.emit()"
    />
    @if (fixedOutput() === undefined) {
      <mlv-radio-group
        class="mlv-editor-ai-menu__output"
        [label]="_copy().aiOutputMode"
        [value]="output()"
        (valueChange)="_onOutputChange($event)"
      >
        <mlv-radio value="replace-selection" [disabled]="disabled()">
          {{ _copy().aiReplaceSelection }}
        </mlv-radio>
        <mlv-radio value="insert-below" [disabled]="disabled()">
          {{ _copy().aiInsertBelow }}
        </mlv-radio>
        <mlv-radio value="review" [disabled]="disabled()">
          {{ _copy().aiReviewChanges }}
        </mlv-radio>
      </mlv-radio-group>
    }
    <div class="mlv-editor-ai-menu__actions">
      <button
        mlvButton
        type="button"
        variant="primary"
        [disabled]="_applyDisabled()"
        (click)="submitted.emit()"
      >
        {{ _copy().aiApply }}
      </button>
      <button
        mlvButton
        type="button"
        variant="secondary"
        (click)="dismissed.emit()"
      >
        {{ _copy().aiCancel }}
      </button>
    </div>
  `,
  styleUrl: './editor-ai-prompt-panel.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'mlv-editor-ai-menu__panel' },
})
export class MlvEditorAiPromptPanel {
  /** Instruction draft, two-way bound to the owner's signal. */
  readonly instruction = model('');

  /** Output mode chosen in the radio group, two-way bound. */
  readonly output = model<MlvEditorAiOutputMode>('replace-selection');

  /** Output mode the caller fixed; hides the radio group while set. */
  readonly fixedOutput = input<MlvEditorAiOutputMode | undefined>(undefined);

  /** Disables the field and the radios (a readonly or disabled editor). */
  readonly disabled = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * Blocks Apply even with an instruction: the editor cannot start a
   * transform now (busy, readonly or disabled).
   */
  readonly applyBlocked = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * Emits on Enter in the field and on Apply. The owner re-checks whether it
   * can apply: Enter emits even while Apply is disabled, as it always did.
   */
  readonly submitted = output<void>();

  /** Emits on Cancel. */
  readonly dismissed = output<void>();

  /** @private Optional localized editor copy. */
  private readonly _i18n = inject(MLV_EDITOR_I18N, { optional: true });

  /** @private Instruction field focused when the prompt opens. */
  private readonly _instructionInput =
    viewChild.required<MlvInput>('_instructionInput');

  /** @protected Reactive localized copy. */
  protected readonly _copy = computed(() => {
    const copy = this._i18n?.();
    return {
      aiCustom: copy?.aiCustom ?? 'Custom prompt',
      aiPromptPlaceholder:
        copy?.aiPromptPlaceholder ?? 'Describe what to do...',
      aiOutputMode: copy?.aiOutputMode ?? 'Output',
      aiReplaceSelection: copy?.aiReplaceSelection ?? 'Replace selection',
      aiInsertBelow: copy?.aiInsertBelow ?? 'Insert below',
      aiReviewChanges: copy?.aiReviewChanges ?? 'Review changes',
      aiApply: copy?.aiApply ?? 'Apply',
      aiCancel: copy?.aiCancel ?? 'Cancel',
    };
  });

  /** @protected Whether Apply cannot submit. */
  protected readonly _applyDisabled = computed(
    () => this.applyBlocked() || this.instruction().trim().length === 0,
  );

  /** Focuses the instruction field and selects its draft. */
  focusInstruction(): void {
    this._instructionInput().focus();
    this._instructionInput().select();
  }

  /** @protected Narrows the radio group's untyped value to an output mode. */
  protected _onOutputChange(value: unknown): void {
    if (
      value === 'replace-selection' ||
      value === 'insert-below' ||
      value === 'review'
    ) {
      this.output.set(value);
    }
  }
}
