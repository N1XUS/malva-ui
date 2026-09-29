import {
  ChangeDetectionStrategy,
  Component,
  inject,
  ViewEncapsulation,
} from '@angular/core';
import { MlvDivider } from '@malva-ui/core/divider';
import { MlvEditorAlignment } from './editor-alignment';
import { MlvEditorBlockInsert } from './editor-block-insert';
import { MlvEditorClearFormatting } from './editor-clear-formatting';
import { MlvEditorFontFamily } from './editor-font-family';
import { MlvEditorFontSize } from './editor-font-size';
import { MlvEditorHeading } from './editor-heading';
import { MlvEditorHighlight } from './editor-highlight';
import { MlvEditorImageUpload } from './editor-image-upload';
import { MlvEditorInlineMarks } from './editor-inline-marks';
import { MlvEditorLineHeight } from './editor-line-height';
import { MlvEditorLink } from './editor-link';
import { MlvEditorList } from './editor-list';
import { MlvEditorTable } from './editor-table';
import { MlvEditorTextColor } from './editor-text-color';
import { MlvEditorToolbarRoot } from './editor-toolbar-root';
import { MlvEditorUndoRedo } from './editor-undo-redo';
import { MlvEditorZoom } from './editor-zoom';

/**
 * @internal The built-in toolbar groups, declared once (N1-D11, #514) and
 * rendered by both `mlv-editor`'s docked bar / selection bubble and the
 * standalone `mlv-editor-toolbar`. The host is `display: contents`, so the
 * groups stay flex items of the enclosing `mlv-toolbar`. In narrow mode the
 * groups the overflow menu repeats, and every divider after the block
 * controls, are hidden.
 *
 * Each element has exactly one `hidden` owner. This template hides the
 * dividers, inline marks, Clear formatting and block inserts, whose hosts
 * bind no `hidden`. Font family, font size, alignment and line height hide
 * themselves — their host already hides when the extension set lacks the
 * command, and a second `[hidden]` here would win whenever it changed last,
 * re-showing an unsupported control after a narrow → wide change.
 */
@Component({
  selector: 'mlv-editor-default-toolbar-groups',
  imports: [
    MlvDivider,
    MlvEditorAlignment,
    MlvEditorBlockInsert,
    MlvEditorClearFormatting,
    MlvEditorFontFamily,
    MlvEditorFontSize,
    MlvEditorHeading,
    MlvEditorHighlight,
    MlvEditorImageUpload,
    MlvEditorInlineMarks,
    MlvEditorLineHeight,
    MlvEditorLink,
    MlvEditorList,
    MlvEditorTable,
    MlvEditorTextColor,
    MlvEditorUndoRedo,
    MlvEditorZoom,
  ],
  template: `
    <mlv-editor-undo-redo />
    <mlv-divider
      class="mlv-editor-toolbar__separator"
      orientation="vertical"
      muted
    />
    <mlv-editor-zoom />
    <mlv-divider
      class="mlv-editor-toolbar__separator"
      orientation="vertical"
      muted
    />
    <mlv-editor-heading />
    <mlv-editor-list />
    <mlv-divider
      class="mlv-editor-toolbar__separator"
      orientation="vertical"
      muted
      [hidden]="_root.narrow()"
    />
    <mlv-editor-font-family />
    <mlv-editor-font-size />
    <mlv-divider
      class="mlv-editor-toolbar__separator"
      orientation="vertical"
      muted
      [hidden]="_root.narrow()"
    />
    <mlv-editor-inline-marks [hidden]="_root.narrow()" />
    <mlv-divider
      class="mlv-editor-toolbar__separator"
      orientation="vertical"
      muted
      [hidden]="_root.narrow()"
    />
    <mlv-editor-text-color />
    <mlv-editor-highlight />
    <mlv-editor-clear-formatting [hidden]="_root.narrow()" />
    <mlv-divider
      class="mlv-editor-toolbar__separator"
      orientation="vertical"
      muted
      [hidden]="_root.narrow()"
    />
    <mlv-editor-alignment />
    <mlv-editor-line-height />
    <mlv-divider
      class="mlv-editor-toolbar__separator"
      orientation="vertical"
      muted
      [hidden]="_root.narrow()"
    />
    <mlv-editor-link />
    <mlv-editor-table />
    <mlv-divider
      class="mlv-editor-toolbar__separator"
      orientation="vertical"
      muted
      [hidden]="_root.narrow()"
    />
    <mlv-editor-block-insert [hidden]="_root.narrow()" />
    <mlv-divider
      class="mlv-editor-toolbar__separator"
      orientation="vertical"
      muted
      [hidden]="_root.narrow()"
    />
    <mlv-editor-image-upload />
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'mlv-editor-default-toolbar-groups' },
})
export class MlvEditorDefaultToolbarGroups {
  /** @protected The enclosing toolbar root, whose `narrow` state hides groups. */
  protected readonly _root = inject(MlvEditorToolbarRoot);
}
