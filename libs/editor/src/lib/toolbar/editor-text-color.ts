import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  ViewEncapsulation,
} from '@angular/core';
import type { Editor } from '@tiptap/core';
import { LucideType } from '@lucide/angular';
import { MlvButtonIcon } from '@malva-ui/core/button';
import { MlvColorPickerPopup } from '@malva-ui/core/color-picker';
import { MLV_EDITOR_I18N } from '@malva-ui/i18n';
import { MlvEditorColorControl } from './editor-color-control';

/** Foreground-colour toolbar control backed by the reusable swatch picker. */
@Component({
  selector: 'mlv-editor-text-color',
  imports: [MlvColorPickerPopup, MlvButtonIcon, LucideType],
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
      <svg mlvButtonIcon lucideType aria-hidden="true" />
    </mlv-color-picker-popup>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-editor-text-color',
    '[hidden]': '!_supported()',
  },
})
export class MlvEditorTextColor extends MlvEditorColorControl {
  /** @private Optional localized editor labels. */
  private readonly _i18n = inject(MLV_EDITOR_I18N, { optional: true });

  /** @protected Localized accessible trigger and dialog label. */
  protected readonly _label = computed(
    () => this._i18n?.().textColor ?? 'Text color',
  );

  /** @protected Exact command-presence capability without command execution. */
  protected readonly _supported = computed(() => {
    this._revision?.();
    const commands = this._context.editor()?.commands as
      | Record<string, unknown>
      | undefined;
    return (
      typeof commands?.['setColor'] === 'function' &&
      typeof commands['unsetColor'] === 'function'
    );
  });

  /** @protected Active foreground colour rendered by the swatch. */
  protected readonly _activeColor = computed(() => {
    this._revision?.();
    const color = this._context.editor()?.getAttributes('textStyle')['color'];
    return typeof color === 'string' && color ? color : '#000000';
  });

  /** @protected Applies or clears foreground colour without focusing Tiptap. */
  protected override _run(
    editor: Editor,
    selection: { readonly from: number; readonly to: number },
    color: string,
  ): boolean {
    const chain = editor.chain().setTextSelection(selection);
    return color ? chain.setColor(color).run() : chain.unsetColor().run();
  }
}
