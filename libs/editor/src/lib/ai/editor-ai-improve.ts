import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  ViewEncapsulation,
} from '@angular/core';
import { AllSelection, TextSelection } from '@tiptap/pm/state';
import { LucideSparkles } from '@lucide/angular';
import { MlvButton, MlvButtonIcon } from '@malva-ui/core/button';
import { MlvTooltip } from '@malva-ui/core/tooltip';
import { MLV_EDITOR_I18N } from '@malva-ui/i18n';
import {
  MLV_EDITOR_TOOLBAR_CONTEXT,
  MLV_EDITOR_TOOLBAR_REVISION,
} from '../editor-toolbar-context';
import { MlvEditorToolbarWidget } from '../toolbar/editor-toolbar-widget';
import { mlvEditorAiDefaultActions } from './editor-ai-actions';
import { MLV_EDITOR_AI_CONTEXT } from './editor-ai-context';

/**
 * "Improve writing" toolbar button: runs the default `improve` AI action over
 * the selection, replacing it (the same request `mlv-editor-ai-menu`'s Improve
 * item sends, taken from `mlvEditorAiDefaultActions`).
 *
 * Renders nothing unless an AI provider resolves for the editor (the
 * `aiProvider` input or `MLV_EDITOR_AI_PROVIDER`). Disabled while a transform
 * runs or a review is pending, while the editor is disabled or readonly, and
 * unless the selection is a non-empty **text** selection (or select-all): an
 * empty selection would hand the provider the whole document and replace it,
 * and a node or cell selection (an image, a table) would replace the node
 * with text.
 *
 * `compact` drops the visible label: icon-only, named by `aria-label` and a
 * tooltip. The clean appearance (`toolbarAppearance="clean"`) renders it
 * first in its bubble while there is a selection, compact when narrow.
 */
@Component({
  selector: 'mlv-editor-ai-improve',
  imports: [
    MlvButton,
    MlvButtonIcon,
    MlvTooltip,
    LucideSparkles,
    MlvEditorToolbarWidget,
  ],
  template: `
    <button
      mlvButton
      mlvEditorToolbarWidget
      type="button"
      variant="transparent"
      mlvDensity="tight"
      [shape]="compact() ? 'square' : 'default'"
      [disabled]="_disabled()"
      [attr.aria-label]="compact() ? _label() : null"
      [mlvTooltip]="_label()"
      [tooltipDisabled]="!compact() || _disabled()"
      (pointerdown)="_preserveSelection($event)"
      (click)="_improve()"
    >
      <svg mlvButtonIcon lucideSparkles aria-hidden="true" />
      @if (!compact()) {
        <span class="mlv-editor-ai-improve__label">{{ _label() }}</span>
      }
    </button>
  `,
  styleUrl: './editor-ai-improve.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-editor-ai-improve',
    '[class.mlv-editor-ai-improve--compact]': 'compact()',
    '[hidden]': '!_hasProvider()',
  },
})
export class MlvEditorAiImprove {
  /** Icon-only, named by `aria-label` and a tooltip instead of visible text. */
  readonly compact = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /** @private AI state of the nearest editor, if provided. */
  private readonly _ai = inject(MLV_EDITOR_AI_CONTEXT, { optional: true });

  /** @private Editor command state. */
  private readonly _context = inject(MLV_EDITOR_TOOLBAR_CONTEXT);

  /** @private Per-editor selection and transaction invalidation signal. */
  private readonly _revision = inject(MLV_EDITOR_TOOLBAR_REVISION, {
    optional: true,
  });

  /** @private Optional localized editor copy. */
  private readonly _i18n = inject(MLV_EDITOR_I18N, { optional: true });

  /**
   * @protected Visible label, or the name in compact mode: the default
   * `improve` action's label, so this button and `mlv-editor-ai-menu`'s
   * Improve item always read the same.
   */
  protected readonly _label = computed(
    () =>
      mlvEditorAiDefaultActions(this._i18n?.()).find(
        (action) => action.kind === 'improve',
      )?.label ?? 'Improve writing',
  );

  /** @protected Whether an AI provider resolves; the button hides without one. */
  protected readonly _hasProvider = computed(
    () => this._ai?.hasProvider() ?? false,
  );

  /**
   * @protected Whether the selection is one Improve can rewrite: a non-empty
   * text selection or select-all. A node selection (image, horizontal rule)
   * or a table cell selection is excluded: the provider would receive the
   * node's Markdown or one cell, and the answer would replace the node.
   */
  protected readonly _rewritableSelection = computed(() => {
    this._revision?.();
    const selection = this._context.editor()?.state.selection;
    if (!selection || selection.empty) return false;
    return (
      selection instanceof TextSelection || selection instanceof AllSelection
    );
  });

  /** @protected Whether the button cannot start a transform now. */
  protected readonly _disabled = computed(
    () => !(this._ai?.canStart() ?? false) || !this._rewritableSelection(),
  );

  /**
   * @protected Keeps focus and the selection in the content on a pointer
   * press, so the transform runs over the selection the user made.
   */
  protected _preserveSelection(event: PointerEvent): void {
    if (!this._disabled()) event.preventDefault();
  }

  /**
   * @protected Runs the default improve action over the selection: the same
   * request `mlv-editor-ai-menu`'s Improve item sends (no instruction,
   * replacing the selection).
   */
  protected _improve(): void {
    if (!this._ai || this._disabled()) return;
    void this._ai.runTransform('improve', { output: 'replace-selection' });
  }
}
