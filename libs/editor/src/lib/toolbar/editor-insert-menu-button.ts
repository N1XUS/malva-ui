import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  ViewEncapsulation,
} from '@angular/core';
import { LucidePlus } from '@lucide/angular';
import { MlvButton, MlvButtonIcon } from '@malva-ui/core/button';
import { MlvTooltip } from '@malva-ui/core/tooltip';
import { MLV_EDITOR_I18N } from '@malva-ui/i18n';
import { MLV_EDITOR_CLEAN_MODE_FALLBACKS } from '../editor-clean-mode-fallbacks';
import { MLV_EDITOR_TOOLBAR_CONTEXT } from '../editor-toolbar-context';
import { MLV_EDITOR_INSERT_MENU } from '../insert/editor-insert-menu';
import { MlvEditorToolbarWidget } from './editor-toolbar-widget';

/**
 * "Insert block" toolbar button (#516): opens the clean appearance's command
 * menu for the caret's block, as `Mod+Alt+Enter` does, with the first item
 * focused. The clean bubble renders it first while the selection is a caret.
 *
 * Icon-only, named by `aria-label` and a tooltip. Renders nothing outside an
 * editor that provides the command menu — the standalone
 * `mlv-editor-toolbar [context]` shell, or a `'bar'` / `'floating'` editor
 * (the menu renders in the clean appearance only).
 */
@Component({
  selector: 'mlv-editor-insert-menu-button',
  imports: [
    LucidePlus,
    MlvButton,
    MlvButtonIcon,
    MlvTooltip,
    MlvEditorToolbarWidget,
  ],
  template: `
    @if (_available()) {
      <button
        mlvButton
        mlvEditorToolbarWidget
        type="button"
        variant="transparent"
        shape="square"
        mlvDensity="tight"
        aria-haspopup="menu"
        [attr.aria-expanded]="_expanded()"
        [attr.aria-controls]="_expanded() ? _panelId() : null"
        [disabled]="_disabled()"
        [attr.aria-label]="_label()"
        [mlvTooltip]="_label()"
        [tooltipDisabled]="_disabled()"
        (click)="_open()"
      >
        <svg mlvButtonIcon lucidePlus aria-hidden="true" />
      </button>
    }
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-editor-insert-menu-button',
    '[hidden]': '!_available()',
  },
})
export class MlvEditorInsertMenuButton {
  /** @private The editor's command menu, absent in the standalone shell. */
  private readonly _menu = inject(MLV_EDITOR_INSERT_MENU, { optional: true });

  /** @private Editor command state. */
  private readonly _context = inject(MLV_EDITOR_TOOLBAR_CONTEXT);

  /** @private Optional localized editor copy. */
  private readonly _i18n = inject(MLV_EDITOR_I18N, { optional: true });

  /** @protected Whether an editor provides the command menu. */
  protected readonly _available = computed(
    () => this._menu?.available() ?? false,
  );

  /** @protected Accessible name and tooltip. */
  protected readonly _label = computed(
    () =>
      this._i18n?.().insertBlock ?? MLV_EDITOR_CLEAN_MODE_FALLBACKS.insertBlock,
  );

  /**
   * @protected Whether the editor refuses insertions: disabled, readonly, or
   * a collaboration session's write gate closed (the context's `editable()`).
   */
  protected readonly _disabled = computed(() => !this._context.editable());

  /**
   * @protected Whether the command menu is open, as `aria-expanded`. The
   * menu is shared with the gutter "+" and the chord, so this reports it
   * however it opened, like any menu button.
   */
  protected readonly _expanded = computed(() => this._menu?.isOpen() ?? false);

  /** @protected The open panel's id, for `aria-controls`. */
  protected readonly _panelId = computed(() => this._menu?.panelId() ?? null);

  /** @protected Opens the command menu for the caret's block. */
  protected _open(): void {
    if (!this._disabled()) this._menu?.openAtCaret();
  }
}
