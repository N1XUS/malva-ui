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
import { MlvDivider } from '@malva-ui/core/divider';
import { MlvEditorAiImprove } from '../ai/editor-ai-improve';
import { MLV_EDITOR_AI_CONTEXT } from '../ai/editor-ai-context';
import {
  MLV_EDITOR_TOOLBAR_CONTEXT,
  MLV_EDITOR_TOOLBAR_REVISION,
} from '../editor-toolbar-context';
import { MLV_EDITOR_INSERT_MENU } from '../insert/editor-insert-menu';
import { MlvEditorBlockType } from './editor-block-type';
import { MlvEditorBubbleMore } from './editor-bubble-more';
import { MlvEditorHighlight } from './editor-highlight';
import type { MlvEditorInlineMark } from './editor-inline-marks';
import { MlvEditorInlineMarks } from './editor-inline-marks';
import { MlvEditorInsertMenuButton } from './editor-insert-menu-button';
import { MlvEditorLink } from './editor-link';
import { MlvEditorTextColor } from './editor-text-color';

/** @internal Marks of the clean bubble, wide. */
const WIDE_MARKS: readonly MlvEditorInlineMark[] = [
  'bold',
  'italic',
  'underline',
  'strike',
  'code',
];

/** @internal Marks of the clean bubble, narrow: the rest move to More. */
const NARROW_MARKS: readonly MlvEditorInlineMark[] = ['bold', 'italic'];

/**
 * @internal The clean appearance's built-in bubble groups
 * (`toolbarAppearance="clean"`, #516), rendered in place of
 * `mlv-editor-default-toolbar-groups` inside the same toolbar template. The
 * host is `display: contents`, so the groups stay flex items of the
 * enclosing `mlv-toolbar`.
 *
 * Order: first slot — AI Improve with a selection and an AI provider, else
 * Insert block with a caret (D-B11) — · block type · inline marks ·
 * link · text colour and highlight · More. While `narrow` the marks shrink
 * to bold and italic and More lists underline, strike-through and inline
 * code; the colour buttons stay, because the colour popovers cannot open
 * from a More item (they anchor on their own trigger).
 *
 * The first slot swaps with `@if`, so its control leaves the roving
 * registry; the selection cannot change while focus is in the bubble, so the
 * swap never happens under the user's focus.
 */
@Component({
  selector: 'mlv-editor-bubble-groups',
  imports: [
    MlvDivider,
    MlvEditorAiImprove,
    MlvEditorBlockType,
    MlvEditorBubbleMore,
    MlvEditorHighlight,
    MlvEditorInlineMarks,
    MlvEditorInsertMenuButton,
    MlvEditorLink,
    MlvEditorTextColor,
  ],
  template: `
    @if (_showImprove()) {
      <mlv-editor-ai-improve [compact]="narrow()" />
      <mlv-divider
        class="mlv-editor-toolbar__separator"
        orientation="vertical"
        muted
      />
    } @else if (_showInsert()) {
      <mlv-editor-insert-menu-button />
      <mlv-divider
        class="mlv-editor-toolbar__separator"
        orientation="vertical"
        muted
      />
    }
    <mlv-editor-block-type />
    <mlv-divider
      class="mlv-editor-toolbar__separator"
      orientation="vertical"
      muted
    />
    <mlv-editor-inline-marks [marks]="_marks()" />
    <mlv-divider
      class="mlv-editor-toolbar__separator"
      orientation="vertical"
      muted
    />
    <mlv-editor-link />
    <mlv-divider
      class="mlv-editor-toolbar__separator"
      orientation="vertical"
      muted
    />
    <mlv-editor-text-color />
    <mlv-editor-highlight />
    <mlv-editor-bubble-more [narrow]="narrow()" />
  `,
  styleUrl: './editor-bubble-groups.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'mlv-editor-bubble-groups' },
})
export class MlvEditorBubbleGroups {
  /** Compact layout: icon-only Improve, bold and italic only, rest in More. */
  readonly narrow = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /** @private Editor command state. */
  private readonly _context = inject(MLV_EDITOR_TOOLBAR_CONTEXT);

  /** @private Selection and transaction invalidation signal. */
  private readonly _revision = inject(MLV_EDITOR_TOOLBAR_REVISION, {
    optional: true,
  });

  /** @private AI state of the editor, when one provides it. */
  private readonly _ai = inject(MLV_EDITOR_AI_CONTEXT, { optional: true });

  /** @private The editor's command menu, absent in the standalone shell. */
  private readonly _insertMenu = inject(MLV_EDITOR_INSERT_MENU, {
    optional: true,
  });

  /** @protected Whether the selection is empty (a caret). */
  protected readonly _selectionEmpty = computed(() => {
    this._revision?.();
    return this._context.editor()?.state.selection.empty ?? true;
  });

  /**
   * @protected Whether the first slot shows Improve: a selection and an AI
   * provider. Without a provider `mlv-editor-ai-improve` would hide itself,
   * but its divider would stay, so the slot is gated here too.
   */
  protected readonly _showImprove = computed(
    () => !this._selectionEmpty() && (this._ai?.hasProvider() ?? false),
  );

  /**
   * @protected Whether the first slot shows Insert block: a caret and an
   * editor rendering the command menu (the clean appearance). Gated like
   * Improve, so the groups slotted into a `'bar'` / `'floating'` editor or the
   * standalone shell leave no hidden button and stray divider at a caret.
   */
  protected readonly _showInsert = computed(
    () => this._selectionEmpty() && (this._insertMenu?.available() ?? false),
  );

  /** @protected Marks the marks group shows. */
  protected readonly _marks = computed(() =>
    this.narrow() ? NARROW_MARKS : WIDE_MARKS,
  );
}
