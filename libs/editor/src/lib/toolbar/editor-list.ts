import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  ViewEncapsulation,
  viewChild,
} from '@angular/core';
import type { Editor } from '@tiptap/core';
import { LucideList } from '@lucide/angular';
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
import { MlvEditorToolbarWidget } from './editor-toolbar-widget';

/** Bullet, ordered, and task-list toolbar commands in a compact menu. */
@Component({
  selector: 'mlv-editor-list',
  imports: [
    MlvButton,
    MlvButtonIcon,
    MlvTooltip,
    LucideList,
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
      [attr.aria-label]="_copy().bullet"
      [mlvTooltip]="_label()"
      (menuOpened)="_registerOverlay()"
      (menuClosed)="_unregisterOverlay()"
    >
      <svg mlvButtonIcon lucideList aria-hidden="true" />
    </button>
    <mlv-menu #_menu [label]="_copy().bullet">
      @if (_hasBullet()) {
        <mlv-list-item
          mlvMenuItem
          [disabled]="_disabled(_canBullet)"
          [attr.aria-current]="_context.isActive('bulletList') ? 'true' : null"
          (itemClick)="_run(_bullet)"
        >
          {{ _copy().bullet }}
        </mlv-list-item>
      }
      @if (_hasOrdered()) {
        <mlv-list-item
          mlvMenuItem
          [disabled]="_disabled(_canOrdered)"
          [attr.aria-current]="_context.isActive('orderedList') ? 'true' : null"
          (itemClick)="_run(_ordered)"
        >
          {{ _copy().ordered }}
        </mlv-list-item>
      }
      @if (_hasTask()) {
        <mlv-list-item
          mlvMenuItem
          [disabled]="_disabled(_canTask)"
          [attr.aria-current]="_context.isActive('taskList') ? 'true' : null"
          (itemClick)="_run(_task)"
        >
          {{ _copy().task }}
        </mlv-list-item>
      }
    </mlv-menu>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-editor-list',
    '[hidden]': '!_supported()',
  },
})
export class MlvEditorList {
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

  /** @protected Resolved menu labels. */
  protected readonly _copy = computed(() => ({
    bullet: this._i18n?.().bulletList ?? 'Bullet list',
    ordered: this._i18n?.().orderedList ?? 'Ordered list',
    task: this._i18n?.().taskList ?? 'Task list',
  }));

  /** @protected Bullet-list command availability at the current selection. */
  protected readonly _canBullet = (editor: Editor): boolean =>
    editor.can().chain().toggleBulletList().run();

  /** @protected Ordered-list command availability at the current selection. */
  protected readonly _canOrdered = (editor: Editor): boolean =>
    editor.can().chain().toggleOrderedList().run();

  /** @protected Task-list command availability at the current selection. */
  protected readonly _canTask = (editor: Editor): boolean =>
    editor.can().chain().toggleTaskList().run();

  /** @protected Bullet-list command. */
  protected readonly _bullet = (editor: Editor): boolean =>
    editor.chain().focus().toggleBulletList().run();

  /** @protected Ordered-list command. */
  protected readonly _ordered = (editor: Editor): boolean =>
    editor.chain().focus().toggleOrderedList().run();

  /** @protected Task-list command. */
  protected readonly _task = (editor: Editor): boolean =>
    editor.chain().focus().toggleTaskList().run();

  constructor() {
    this._destroyRef.onDestroy(() => this._unregisterOverlay());
  }

  /** @protected The list style currently active at the selection. */
  protected _label(): string {
    if (this._context.isActive('orderedList')) return this._copy().ordered;
    if (this._context.isActive('taskList')) return this._copy().task;
    return this._copy().bullet;
  }

  /** @protected Whether one list command is registered by the active extension set. */
  protected _supported(): boolean {
    this._revision();
    const editor = this._context.editor();
    return (
      !!editor &&
      (editor.commands.toggleBulletList !== undefined ||
        editor.commands.toggleOrderedList !== undefined ||
        editor.commands.toggleTaskList !== undefined)
    );
  }

  /** @protected Whether the bullet-list command is registered. */
  protected _hasBullet(): boolean {
    this._revision();
    return this._context.editor()?.commands.toggleBulletList !== undefined;
  }

  /** @protected Whether the ordered-list command is registered. */
  protected _hasOrdered(): boolean {
    this._revision();
    return this._context.editor()?.commands.toggleOrderedList !== undefined;
  }

  /** @protected Whether the task-list command is registered. */
  protected _hasTask(): boolean {
    this._revision();
    return this._context.editor()?.commands.toggleTaskList !== undefined;
  }

  /** @protected Whether the menu trigger cannot be opened. */
  protected _triggerDisabled(): boolean {
    return (
      !this._supported() || this._context.disabled() || this._context.readonly()
    );
  }

  /** @protected Whether an available menu item currently cannot mutate. */
  protected _disabled(command: (editor: Editor) => boolean): boolean {
    this._revision();
    return this._triggerDisabled() || !this._context.can(command);
  }

  /** @protected Runs a selection-restoring list command. */
  protected _run(command: (editor: Editor) => boolean): void {
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
