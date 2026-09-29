import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
} from '@angular/core';
import { LucideUnfoldVertical } from '@lucide/angular';
import { MlvButton, MlvButtonIcon } from '@malva-ui/core/button';
import { MlvListItem } from '@malva-ui/core/list';
import { MlvMenu, MlvMenuItem, MlvMenuTrigger } from '@malva-ui/core/menu';
import { MlvTooltip } from '@malva-ui/core/tooltip';
import {
  createMlvEditorStyleMenuModel,
  MLV_EDITOR_STYLE_MENU_TEMPLATE,
  MlvEditorStyleMenuBase,
} from './editor-style-menu';
import { mlvEditorLineHeightMenuSpec } from './editor-style-menu-specs';
import { MlvEditorToolbarWidget } from './editor-toolbar-widget';

/**
 * Block line-height menu (#514). An icon trigger named with the current value
 * ("Line height: 1.5", or "Default"); the menu sets `line-height` on every
 * paragraph and heading the selection touches. Options come from
 * `MLV_EDITOR_TEXT_STYLES.lineHeights`. Hidden unless the extension set
 * registers `setBlockLineHeight` / `unsetBlockLineHeight`
 * (`MlvEditorBlockLineHeight`, in the default preset).
 */
@Component({
  selector: 'mlv-editor-line-height',
  imports: [
    MlvButton,
    MlvButtonIcon,
    MlvTooltip,
    LucideUnfoldVertical,
    MlvListItem,
    MlvMenu,
    MlvMenuItem,
    MlvMenuTrigger,
    MlvEditorToolbarWidget,
  ],
  template:
    `
    <button
      mlvButton
      mlvEditorToolbarWidget
      type="button"
      shape="square"
      variant="transparent"
      mlvDensity="tight"
      [disabled]="_model.triggerDisabled()"
      [selected]="_model.current() !== null"
      [mlvMenuTrigger]="_menu"
      [menuTriggerDisabled]="_model.triggerDisabled()"
      [attr.aria-label]="_model.triggerName()"
      [mlvTooltip]="_model.triggerName()"
      (menuOpened)="_registerOverlay()"
      (menuClosed)="_unregisterOverlay()"
    >
      <svg mlvButtonIcon lucideUnfoldVertical aria-hidden="true" />
    </button>
  ` + MLV_EDITOR_STYLE_MENU_TEMPLATE,
  styleUrl: './editor-style-menu.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-editor-style-menu mlv-editor-line-height',
    '[hidden]': '_hidden()',
  },
})
export class MlvEditorLineHeight extends MlvEditorStyleMenuBase {
  /** @protected State and commands of the line-height menu. */
  protected readonly _model = createMlvEditorStyleMenuModel(
    mlvEditorLineHeightMenuSpec(),
  );
}
