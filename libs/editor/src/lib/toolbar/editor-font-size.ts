import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
} from '@angular/core';
import { LucideChevronDown } from '@lucide/angular';
import { MlvButton } from '@malva-ui/core/button';
import { MlvListItem } from '@malva-ui/core/list';
import { MlvMenu, MlvMenuItem, MlvMenuTrigger } from '@malva-ui/core/menu';
import { MlvTooltip } from '@malva-ui/core/tooltip';
import {
  createMlvEditorStyleMenuModel,
  MLV_EDITOR_STYLE_MENU_TEMPLATE,
  MLV_EDITOR_STYLE_TEXT_TRIGGER_TEMPLATE,
  MlvEditorStyleMenuBase,
} from './editor-style-menu';
import { mlvEditorFontSizeMenuSpec } from './editor-style-menu-specs';
import { MlvEditorToolbarWidget } from './editor-toolbar-widget';

/**
 * Font-size menu (#514). The trigger shows the current size ("16", or
 * "Default") and is named "Font size: 16"; a size outside the configured list
 * is still shown. Options come from `MLV_EDITOR_TEXT_STYLES.fontSizes`. Hidden
 * unless the extension set registers `setFontSize` / `unsetFontSize`
 * (`FontSize` from `@tiptap/extension-text-style`, in the default preset).
 */
@Component({
  selector: 'mlv-editor-font-size',
  imports: [
    MlvButton,
    MlvTooltip,
    LucideChevronDown,
    MlvListItem,
    MlvMenu,
    MlvMenuItem,
    MlvMenuTrigger,
    MlvEditorToolbarWidget,
  ],
  template:
    MLV_EDITOR_STYLE_TEXT_TRIGGER_TEMPLATE + MLV_EDITOR_STYLE_MENU_TEMPLATE,
  styleUrl: './editor-style-menu.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-editor-style-menu mlv-editor-font-size',
    '[hidden]': '_hidden()',
  },
})
export class MlvEditorFontSize extends MlvEditorStyleMenuBase {
  /** @protected State and commands of the font-size menu. */
  protected readonly _model = createMlvEditorStyleMenuModel(
    mlvEditorFontSizeMenuSpec(),
  );
}
