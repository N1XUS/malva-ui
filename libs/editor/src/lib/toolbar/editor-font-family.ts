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
import { mlvEditorFontFamilyMenuSpec } from './editor-style-menu-specs';
import { MlvEditorToolbarWidget } from './editor-toolbar-widget';

/**
 * Font-family menu (#514). The trigger shows the current family's label, or
 * "Default", and is named "Font: Serif"; each item renders in its own family.
 * Options come from `MLV_EDITOR_TEXT_STYLES.fontFamilies`, or the built-in
 * sans / serif / monospace system stacks. Hidden unless the extension set
 * registers `setFontFamily` / `unsetFontFamily` (`FontFamily` from
 * `@tiptap/extension-text-style`, in the default preset).
 */
@Component({
  selector: 'mlv-editor-font-family',
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
    class: 'mlv-editor-style-menu mlv-editor-font-family',
    '[hidden]': '_hidden()',
  },
})
export class MlvEditorFontFamily extends MlvEditorStyleMenuBase {
  /** @protected State and commands of the font-family menu. */
  protected readonly _model = createMlvEditorStyleMenuModel(
    mlvEditorFontFamilyMenuSpec(),
  );
}
