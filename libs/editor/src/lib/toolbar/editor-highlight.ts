import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  ViewEncapsulation,
} from '@angular/core';
import type { Editor } from '@tiptap/core';
import { LucideHighlighter } from '@lucide/angular';
import { MlvButtonIcon } from '@malva-ui/core/button';
import { MlvColorPickerPopup } from '@malva-ui/core/color-picker';
import { MLV_EDITOR_I18N } from '@malva-ui/i18n';
import { MlvEditorColorControl } from './editor-color-control';

/** Background-highlight toolbar control backed by the reusable swatch picker. */
@Component({
  selector: 'mlv-editor-highlight',
  imports: [MlvColorPickerPopup, MlvButtonIcon, LucideHighlighter],
  template: `
    <mlv-color-picker-popup
      #picker
      presentation="icon"
      clearable
      live
      [ariaLabel]="_label()"
      [value]="_activeColor()"
      [disabled]="_context.disabled()"
      [readonly]="_context.readonly()"
      (openedChange)="_onOpenedChange($event)"
      (colorChange)="_apply($event)"
    >
      <svg mlvButtonIcon lucideHighlighter aria-hidden="true" />
    </mlv-color-picker-popup>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-editor-highlight',
    '[hidden]': '!_supported()',
  },
})
export class MlvEditorHighlight extends MlvEditorColorControl {
  /** @private Optional localized editor labels. */
  private readonly _i18n = inject(MLV_EDITOR_I18N, { optional: true });

  /** @protected Localized accessible trigger and dialog label. */
  protected readonly _label = computed(
    () => this._i18n?.().highlightColor ?? 'Highlight color',
  );

  /** @protected Exact command-presence capability without command execution. */
  protected readonly _supported = computed(() => {
    this._revision?.();
    const commands = this._context.editor()?.commands as
      | Record<string, unknown>
      | undefined;
    return (
      typeof commands?.['toggleHighlight'] === 'function' &&
      typeof commands['unsetHighlight'] === 'function'
    );
  });

  /** @protected Active highlight colour rendered by the independent swatch. */
  protected readonly _activeColor = computed(() => {
    this._revision?.();
    const color = this._context.editor()?.getAttributes('highlight')['color'];
    return typeof color === 'string' && color ? color : '#ffff00';
  });

  /** @protected Applies or clears highlight colour without focusing Tiptap. */
  protected override _run(
    editor: Editor,
    selection: { readonly from: number; readonly to: number },
    color: string,
  ): boolean {
    const chain = editor.chain().setTextSelection(selection);
    return color
      ? chain.toggleHighlight({ color }).run()
      : chain.unsetHighlight().run();
  }
}
