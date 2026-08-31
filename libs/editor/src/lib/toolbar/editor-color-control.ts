import { Directive, effect, inject, untracked, viewChild } from '@angular/core';
import type { Editor } from '@tiptap/core';
import type { MlvColorPickerPopup } from '@malva-ui/core/color-picker';
import {
  MLV_EDITOR_OVERLAY_REGISTRY,
  MLV_EDITOR_TOOLBAR_CONTEXT,
  MLV_EDITOR_TOOLBAR_REVISION,
  MLV_EDITOR_TOOLBAR_ROVING,
} from '../editor-toolbar-context';

interface EditorSelectionRange {
  readonly from: number;
  readonly to: number;
}

/** @internal Shared selection, roving, and overlay lifecycle for colour controls. */
@Directive()
export abstract class MlvEditorColorControl {
  /** @protected Editor-scoped command and state boundary. */
  protected readonly _context = inject(MLV_EDITOR_TOOLBAR_CONTEXT);

  /** @protected Reactive toolbar invalidation state. */
  protected readonly _revision = inject(MLV_EDITOR_TOOLBAR_REVISION, {
    optional: true,
  });

  /** @protected Public color-picker composition surface. */
  protected readonly _picker =
    viewChild.required<MlvColorPickerPopup>('picker');

  /** @private Editor toolbar roving-focus owner. */
  private readonly _roving = inject(MLV_EDITOR_TOOLBAR_ROVING);

  /** @private Editor composite detached-overlay owner. */
  private readonly _overlays = inject(MLV_EDITOR_OVERLAY_REGISTRY);

  /** @private ProseMirror selection retained while focus is inside the picker. */
  private _selection: EditorSelectionRange | null = null;

  constructor() {
    effect((onCleanup) => {
      const trigger = this._picker().triggerElement();
      if (!trigger) return;
      const activate = () => this._roving.activate(trigger);
      trigger.addEventListener('focus', activate);
      trigger.addEventListener('pointerdown', activate);
      const unregister = untracked(() => this._roving.register(trigger));
      onCleanup(() => {
        unregister();
        trigger.removeEventListener('focus', activate);
        trigger.removeEventListener('pointerdown', activate);
      });
    });

    effect(() => {
      const trigger = this._picker().triggerElement();
      if (trigger) trigger.tabIndex = this._roving.isActive(trigger) ? 0 : -1;
    });

    effect((onCleanup) => {
      const panel = this._picker().panelElement();
      if (!panel) return;
      const unregister = this._overlays.register(panel, () =>
        this._picker().opened.set(false),
      );
      onCleanup(unregister);
    });
  }

  /** @protected Snapshots the document selection at open intent. */
  protected _onOpenedChange(opened: boolean): void {
    if (!opened) return;
    const selection = this._context.editor()?.state.selection;
    this._selection = selection
      ? { from: selection.from, to: selection.to }
      : null;
  }

  /** @protected Restores the snapshot and delegates the distinct colour command. */
  protected _apply(color: string): void {
    const selection = this._selection;
    if (!selection) return;
    this._context.run((editor) => this._run(editor, selection, color));
  }

  /** @protected Distinct foreground/highlight command policy. */
  protected abstract _run(
    editor: Editor,
    selection: EditorSelectionRange,
    color: string,
  ): boolean;
}
