import {
  ChangeDetectionStrategy,
  Component,
  computed,
  viewChild,
} from '@angular/core';
import { MlvButton } from '@malva-ui/core/button';
import {
  MlvEditor,
  MlvEditorToolbarDef,
  MlvEditorToolbarEndDef,
  MlvEditorToolbarStartDef,
  MlvEditorToolbarWidget,
  mlvEditorDefaultExtensions,
  type MlvEditorToolbarContext,
} from '@malva-ui/editor';
import { Extension } from '@tiptap/core';

const DocsTelemetryExtension = Extension.create({
  name: 'docsTelemetry',
});

@Component({
  selector: 'docs-editor-extension-toolbar-example',
  imports: [
    MlvButton,
    MlvEditor,
    MlvEditorToolbarDef,
    MlvEditorToolbarEndDef,
    MlvEditorToolbarStartDef,
    MlvEditorToolbarWidget,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class EditorExtensionToolbarExample {
  readonly extensions = [
    ...mlvEditorDefaultExtensions(),
    DocsTelemetryExtension,
  ];
  readonly firstEditor = viewChild<MlvEditor>('firstEditor');
  readonly customLoaded = computed(
    () =>
      this.firstEditor()
        ?.editor()
        ?.extensionManager.extensions.some(
          (extension) => extension.name === 'docsTelemetry',
        ) ?? false,
  );

  protected insertFromProjectedControl(text: string): void {
    this.firstEditor()?.run((editor) =>
      editor.chain().focus().insertContent(text).run(),
    );
  }

  protected insertFromContext(
    context: MlvEditorToolbarContext,
    text: string,
  ): void {
    context.run((editor) => editor.chain().focus().insertContent(text).run());
  }

  protected clearFromContext(context: MlvEditorToolbarContext): void {
    context.run((editor) => editor.commands.clearContent());
  }
}
