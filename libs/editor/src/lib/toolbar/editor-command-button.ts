import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  ViewEncapsulation,
} from '@angular/core';
import type { Editor } from '@tiptap/core';
import { MlvButton, MlvButtonIcon } from '@malva-ui/core/button';
import { MlvTooltip } from '@malva-ui/core/tooltip';
import {
  MLV_EDITOR_TOOLBAR_CONTEXT,
  MLV_EDITOR_TOOLBAR_REVISION,
} from '../editor-toolbar-context';
import { MlvEditorToolbarWidget } from './editor-toolbar-widget';

/** @internal Reusable selection-preserving command button for editor toolbar modules. */
@Component({
  selector: 'mlv-editor-command-button',
  imports: [MlvButton, MlvButtonIcon, MlvTooltip, MlvEditorToolbarWidget],
  template: `
    <button
      mlvButton
      mlvEditorToolbarWidget
      type="button"
      shape="square"
      variant="transparent"
      [attr.aria-label]="label()"
      [attr.aria-pressed]="pressed() === undefined ? null : pressed()"
      [disabled]="_disabled()"
      [mlvTooltip]="label()"
      [tooltipDisabled]="_disabled()"
      mlvDensity="tight"
      (pointerdown)="_preserveSelection($event)"
      (click)="_run()"
    >
      <span mlvButtonIcon aria-hidden="true"><ng-content /></span>
    </button>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-editor-command-button',
    '[hidden]': '!supported()',
  },
})
export class MlvEditorCommandButton {
  /** Accessible action label. */
  readonly label = input.required<string>();

  /** Evaluates whether the configured extension provides this action. */
  readonly supports = input.required<(editor: Editor) => boolean>();

  /** Executes the action through a focused editor command chain. */
  readonly command = input.required<(editor: Editor) => boolean>();

  /** Checks whether the registered command can run at the current selection. */
  readonly canCommand = input<((editor: Editor) => boolean) | undefined>(
    undefined,
  );

  /** Optional current active state for toggle-like commands. */
  readonly pressed = input<boolean | undefined>(undefined);

  /** @private Editor-scoped command state. */
  private readonly _context = inject(MLV_EDITOR_TOOLBAR_CONTEXT);

  /** @private Per-editor state invalidation signal. */
  private readonly _revision = inject(MLV_EDITOR_TOOLBAR_REVISION);

  /** @protected Whether the current extension set supports this command. */
  protected readonly supported = computed(() => {
    this._revision();
    const editor = this._context.editor();
    if (!editor) return false;
    try {
      return this.supports()(editor);
    } catch {
      return false;
    }
  });

  /** @protected Whether the command currently cannot mutate the editor. */
  protected _disabled(): boolean {
    this._revision();
    const canCommand = this.canCommand();
    return (
      !this.supported() ||
      this._context.disabled() ||
      this._context.readonly() ||
      !(canCommand ? this._context.can(canCommand) : true)
    );
  }

  /** @protected Prevents the browser from moving the selection before the command chain restores content focus. */
  protected _preserveSelection(event: PointerEvent): void {
    if (!this._disabled()) event.preventDefault();
  }

  /** @protected Executes only supported, enabled commands. */
  protected _run(): void {
    if (this._disabled()) return;
    this._context.run(this.command());
  }
}
