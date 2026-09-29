import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  ViewEncapsulation,
  viewChild,
} from '@angular/core';
import type { Editor } from '@tiptap/core';
import { LucideAlignLeft } from '@lucide/angular';
import { MlvButton, MlvButtonIcon } from '@malva-ui/core/button';
import { MlvListItem } from '@malva-ui/core/list';
import { MlvMenu, MlvMenuItem, MlvMenuTrigger } from '@malva-ui/core/menu';
import { MlvTooltip } from '@malva-ui/core/tooltip';
import { MLV_EDITOR_I18N } from '@malva-ui/i18n';
import {
  MLV_EDITOR_OVERLAY_REGISTRY,
  MLV_EDITOR_TOOLBAR_CONTEXT,
  MLV_EDITOR_TOOLBAR_REVISION,
} from '../editor-toolbar-context';
import type { MlvEditorOverlayRegistry } from '../editor-toolbar-context';
import { MlvEditorToolbarRoot } from './editor-toolbar-root';
import { MlvEditorToolbarWidget } from './editor-toolbar-widget';

/** Left, center, right, and justified paragraph alignment commands in a menu. */
@Component({
  selector: 'mlv-editor-alignment',
  imports: [
    MlvButton,
    MlvButtonIcon,
    MlvTooltip,
    LucideAlignLeft,
    MlvListItem,
    MlvMenu,
    MlvMenuItem,
    MlvMenuTrigger,
    MlvEditorToolbarWidget,
  ],
  template: `
    <button
      mlvButton
      mlvEditorToolbarWidget
      type="button"
      shape="square"
      mlvDensity="tight"
      variant="transparent"
      [disabled]="_triggerDisabled()"
      [mlvMenuTrigger]="_menu"
      [menuTriggerDisabled]="_triggerDisabled()"
      [attr.aria-label]="_copy().alignment"
      [mlvTooltip]="_label(_activeAlignment())"
      (menuOpened)="_registerOverlay()"
      (menuClosed)="_unregisterOverlay()"
    >
      <svg mlvButtonIcon lucideAlignLeft aria-hidden="true" />
    </button>
    <mlv-menu #_menu [label]="_copy().alignment">
      @for (alignment of _alignments; track alignment) {
        <mlv-list-item
          mlvMenuItem
          [disabled]="_disabled(alignment)"
          [attr.aria-current]="_isActive(alignment) ? 'true' : null"
          (itemClick)="_run(alignment)"
        >
          {{ _label(alignment) }}
        </mlv-list-item>
      }
    </mlv-menu>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-editor-alignment',
    '[hidden]': '_hidden()',
  },
})
export class MlvEditorAlignment {
  /** @protected Editor command state. */
  protected readonly _context = inject(MLV_EDITOR_TOOLBAR_CONTEXT);

  /** @private Per-editor state invalidation signal. */
  private readonly _revision = inject(MLV_EDITOR_TOOLBAR_REVISION);

  /** @private The editor-owned overlay registry. */
  private readonly _overlays = inject<MlvEditorOverlayRegistry>(
    MLV_EDITOR_OVERLAY_REGISTRY,
  );

  /** @private Document used to resolve the public menu panel id. */
  private readonly _document = inject(DOCUMENT);

  /** @private Removes a pending or active overlay registration. */
  private readonly _destroyRef = inject(DestroyRef);

  /** @private Optional localized editor copy. */
  private readonly _i18n = inject(MLV_EDITOR_I18N, { optional: true });

  /** @protected Rendered Malva menu. */
  protected readonly _menu = viewChild.required<MlvMenu>('_menu');

  /** @protected Trigger owning the menu overlay. */
  protected readonly _trigger = viewChild.required(MlvMenuTrigger);

  /** @private Tears down the active panel registration. */
  private _unregister: (() => void) | undefined;

  /** @private Guards queued registration after a quick close or destroy. */
  private _menuOpen = false;

  /** @protected Supported alignments in visual order. */
  protected readonly _alignments = [
    'left',
    'center',
    'right',
    'justify',
  ] as const;

  /** @protected Resolved localized copy. */
  protected _copy(): {
    alignment: string;
    left: string;
    center: string;
    right: string;
    justify: string;
  } {
    const copy = this._i18n?.();
    return {
      alignment: copy?.alignment ?? 'Alignment',
      left: copy?.alignLeft ?? 'Align left',
      center: copy?.alignCenter ?? 'Align center',
      right: copy?.alignRight ?? 'Align right',
      justify: copy?.alignJustify ?? 'Justify',
    };
  }

  constructor() {
    this._destroyRef.onDestroy(() => this._unregisterOverlay());
  }

  /** @protected Resolves a translated alignment label. */
  protected _label(alignment: (typeof this._alignments)[number]): string {
    return this._copy()[alignment];
  }

  /** @protected Current alignment, with left as the semantic default. */
  protected _activeAlignment(): (typeof this._alignments)[number] {
    return (
      this._alignments.find((alignment) => this._isActive(alignment)) ?? 'left'
    );
  }

  /** @protected Whether the current selection has this alignment. */
  protected _isActive(alignment: (typeof this._alignments)[number]): boolean {
    return (
      this._context.isActive('paragraph', { textAlign: alignment }) ||
      this._context.isActive('heading', { textAlign: alignment })
    );
  }

  /**
   * @private Enclosing toolbar root. Resolved only inside the root's own view
   * (the default groups of the docked bar, the bubble and the standalone
   * shell); a control in a consumer toolbar template or projected into the
   * shell is declared outside it, gets `null` and never hides for narrow mode.
   */
  private readonly _root = inject(MlvEditorToolbarRoot, { optional: true });

  /**
   * @protected Sole owner of the host `hidden`: unsupported by the extension
   * set, or moved into the narrow overflow. One binding, so a narrow → wide
   * change cannot re-show a control its editor cannot run.
   */
  protected readonly _hidden = computed(
    () => !this._supported() || (this._root?.narrow() ?? false),
  );

  /** @protected Whether alignment is registered by the active extension set. */
  protected _supported(): boolean {
    this._revision();
    return this._context.editor()?.commands.setTextAlign !== undefined;
  }

  /** @protected Whether the menu trigger cannot be opened. */
  protected _triggerDisabled(): boolean {
    return (
      !this._supported() || this._context.disabled() || this._context.readonly()
    );
  }

  /** @protected Whether an alignment cannot be applied at the current selection. */
  protected _disabled(alignment: (typeof this._alignments)[number]): boolean {
    this._revision();
    return (
      this._triggerDisabled() || !this._context.can(this._canAlign(alignment))
    );
  }

  /** @private Checks whether alignment can be applied without changing focus or selection. */
  private _canAlign(
    alignment: (typeof this._alignments)[number],
  ): (editor: Editor) => boolean {
    return (editor) => editor.can().chain().setTextAlign(alignment).run();
  }

  /** @protected Alignment command factory. */
  protected _align(
    alignment: (typeof this._alignments)[number],
  ): (editor: Editor) => boolean {
    return (editor) => editor.chain().focus().setTextAlign(alignment).run();
  }

  /** @protected Runs a selection-restoring alignment command. */
  protected _run(alignment: (typeof this._alignments)[number]): void {
    const command = this._align(alignment);
    this._context.run(command);
  }

  /** @protected Registers the portaled panel as editor-owned focus. */
  protected _registerOverlay(): void {
    this._menuOpen = true;
    queueMicrotask(() => {
      if (!this._menuOpen) return;
      const panel = this._document.getElementById(this._menu().panelId);
      if (!panel) return;
      this._unregister?.();
      this._unregister = this._overlays.register(panel, () =>
        this._trigger().close(),
      );
    });
  }

  /** @protected Removes menu-panel focus ownership after close. */
  protected _unregisterOverlay(): void {
    this._menuOpen = false;
    this._unregister?.();
    this._unregister = undefined;
  }
}
