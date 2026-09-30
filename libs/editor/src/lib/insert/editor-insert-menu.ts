import { DOCUMENT } from '@angular/common';
import type { Signal } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  InjectionToken,
  Injector,
  input,
  isDevMode,
  signal,
  untracked,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { Editor } from '@tiptap/core';
import { timer, type Subscription } from 'rxjs';
import { LUCIDE_ICONS, LucideDynamicIcon } from '@lucide/angular';
import { MlvRtlService } from '@malva-ui/cdk/utils';
import { MlvDialogService, type MlvDialogRef } from '@malva-ui/core/dialog';
import { MlvListItem, MlvListItemPrefix } from '@malva-ui/core/list';
import {
  MlvContextMenuTrigger,
  MlvMenu,
  MlvMenuGroup,
  MlvMenuGroupLabel,
  MlvMenuItem,
  MlvMenuSeparator,
} from '@malva-ui/core/menu';
import { MLV_EDITOR_I18N } from '@malva-ui/i18n';
import { MLV_EDITOR_AI_CONTEXT } from '../ai/editor-ai-context';
import { MLV_EDITOR_AI_PROMPT } from '../ai/editor-ai-prompt';
import {
  MLV_EDITOR_OVERLAY_REGISTRY,
  MLV_EDITOR_TOOLBAR_CONTEXT,
  MLV_EDITOR_TOOLBAR_REVISION,
  mlvEditorFocusContent,
} from '../editor-toolbar-context';
import { MLV_EDITOR_CLEAN_MODE_FALLBACKS } from '../editor-clean-mode-fallbacks';
import type { MlvEditorOverlayRegistry } from '../editor-toolbar-context';
import type { MlvEditorBlockHandleInsertRequest } from '../extensions/editor-block-handle';
import {
  mlvEditorBlockInserter,
  mlvEditorInsertSlotRect,
  mlvEditorInsertSourcePos,
} from '../extensions/editor-block-inserter';
import { openMlvEditorImageUploadDialog } from '../toolbar/editor-image-upload-opener';
import { createMlvEditorMenuRegistration } from '../toolbar/editor-menu-registration';
import { resolveMlvEditorImageUploadCoordinator } from '../upload/editor-image-upload-coordinator';
import type { MlvEditorInsertItem } from './editor-insert.types';
import {
  createMlvEditorInsertContext,
  mlvEditorCollapseIntoInsertSource,
  registerMlvEditorInsertServices,
  type MlvEditorInsertServices,
} from './editor-insert-services';
import {
  mlvEditorInsertMenuGroups,
  mlvEditorMissingInsertIcons,
  type MlvEditorInsertMenuGroup,
} from './editor-insert-menu-groups';

/** @internal The clean appearance's command menu (#516, U7). */
export interface MlvEditorInsertMenuHost {
  /** Opens the menu for the block at `request.pos`, anchored to `request.rect`. */
  open(request: MlvEditorBlockHandleInsertRequest): void;
  /** Opens the menu for the caret's block as the keyboard would (the bubble's "+"). */
  openAtCaret(): void;
  /** Whether the menu is open. */
  readonly isOpen: Signal<boolean>;
  /** Whether a menu is rendered (the clean appearance). */
  readonly available: Signal<boolean>;
  /** The panel's id, for a trigger's `aria-controls`; `null` with no menu. */
  readonly panelId: Signal<string | null>;
}

/**
 * @internal Opens the command menu. Provided by `mlv-editor` as a stable
 * delegate; the menu renders in the clean appearance only, so `open` does
 * nothing in `'bar'` / `'floating'`.
 */
export const MLV_EDITOR_INSERT_MENU =
  new InjectionToken<MlvEditorInsertMenuHost>('MLV_EDITOR_INSERT_MENU');

/** @internal A stable host forwarding to whichever menu is rendered now. */
export function mlvEditorInsertMenuDelegate(
  host: () => MlvEditorInsertMenuHost | undefined,
): MlvEditorInsertMenuHost {
  return {
    open: (request) => host()?.open(request),
    openAtCaret: () => host()?.openAtCaret(),
    isOpen: computed(() => host()?.isOpen() ?? false),
    available: computed(() => !!host()),
    panelId: computed(() => host()?.panelId() ?? null),
  };
}

/**
 * @internal The clean appearance's command menu and gutter stylesheet
 * (#516, U6 / U7): a hidden context-menu trigger opening a point-anchored
 * `mlv-menu` of insert items grouped AI / basic blocks / lists / insert. The
 * target is resolved from the selection when an item runs; while the menu is
 * open the target is previewed as a decoration only (D-B2). Rendered for the
 * whole clean lifetime, readonly included, because its stylesheet carries
 * the two-slot gutter geometry.
 */
@Component({
  selector: 'mlv-editor-insert-menu',
  imports: [
    LucideDynamicIcon,
    MlvContextMenuTrigger,
    MlvListItem,
    MlvListItemPrefix,
    MlvMenu,
    MlvMenuGroup,
    MlvMenuGroupLabel,
    MlvMenuItem,
    MlvMenuSeparator,
  ],
  templateUrl: './editor-insert-menu.html',
  styleUrls: ['./editor-insert-menu.scss', './editor-clean-gutter.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'mlv-editor-insert-menu' },
})
export class MlvEditorInsertMenu implements MlvEditorInsertMenuHost {
  /** Items of the menu, in declaration order within each group. */
  readonly items = input.required<readonly MlvEditorInsertItem[]>();

  /** @private Editor command state. */
  private readonly _context = inject(MLV_EDITOR_TOOLBAR_CONTEXT);
  /** @private Transaction invalidation, re-reading item availability. */
  private readonly _revision = inject(MLV_EDITOR_TOOLBAR_REVISION, {
    optional: true,
  });
  /** @private Optional localized editor copy. */
  private readonly _i18n = inject(MLV_EDITOR_I18N, { optional: true });
  /** @private AI state of the editor, for the Ask AI item. */
  private readonly _ai = inject(MLV_EDITOR_AI_CONTEXT, { optional: true });
  /** @private The editor's AI prompt, opened by the Ask AI item. */
  private readonly _aiPrompt = inject(MLV_EDITOR_AI_PROMPT, { optional: true });
  /** @private Direction of the point the panel opens at. */
  private readonly _rtl = inject(MlvRtlService);
  /**
   * @private The Lucide registry the item icons render against — the same
   * one `LucideDynamicIcon` reads, since it resolves through this view.
   */
  private readonly _icons = inject(LUCIDE_ICONS);
  /** @private Unregistered icon names already warned about. */
  private readonly _missingIcons = new Set<string>();
  /** @private Dialog service for the image item. */
  private readonly _dialogs = inject(MlvDialogService);
  /** @private Parent of the image dialog's injector. */
  private readonly _injector = inject(Injector);
  /** @private Detached panel ownership for composite focus. */
  private readonly _overlays = inject<MlvEditorOverlayRegistry>(
    MLV_EDITOR_OVERLAY_REGISTRY,
  );
  /** @private Registers the open panel with the overlay registry. */
  private readonly _registration = createMlvEditorMenuRegistration(
    this._overlays,
    inject(DOCUMENT),
  );

  /** @private The hidden trigger the panel is opened through. */
  private readonly _trigger = viewChild.required(MlvContextMenuTrigger);
  /** @protected The panel. */
  protected readonly _menu = viewChild.required<MlvMenu>('_menu');

  /** @private Open state, set before the panel renders so items resolve. */
  private readonly _open = signal(false);
  /** @private How the current open started. */
  private _via: MlvEditorBlockHandleInsertRequest['via'] = 'pointer';
  /** @private Open image-upload dialog, preventing duplicates. */
  private _imageDialog: MlvDialogRef<void> | undefined;
  /** @private Releases the menu's listeners and pending work on destroy. */
  private readonly _destroyRef = inject(DestroyRef);
  /**
   * @private The pending first-item focus of a keyboard open: one per open,
   * released when the panel closes or the menu is destroyed.
   */
  private _focusFirst: Subscription | undefined;

  /** Whether the menu is open. */
  readonly isOpen = this._open.asReadonly();

  /** Always `true`: this menu is rendered. */
  readonly available = signal(true).asReadonly();

  /** The panel's id, for a trigger's `aria-controls`. */
  readonly panelId = computed(() => this._menu().panelId);

  /** @protected Localized copy the menu reads. */
  protected readonly _copy = computed(() => {
    const copy = this._i18n?.();
    return {
      insertBlock:
        copy?.insertBlock ?? MLV_EDITOR_CLEAN_MODE_FALLBACKS.insertBlock,
      uploadImage: copy?.uploadImage ?? 'Upload image',
    };
  });

  /**
   * @private Whether the editor accepts insertions now: the context's
   * `editable()`, which also closes a collaboration session's write gate
   * (before the first sync, and once it fails or closes), as `run()` does.
   */
  private readonly _editable = computed(() => this._context.editable());

  /** @protected Groups of available items, resolved while the menu is open. */
  protected readonly _groups = computed<readonly MlvEditorInsertMenuGroup[]>(
    () => {
      this._revision?.();
      const editor = this._context.editor();
      if (!this._open() || !editor || editor.isDestroyed) return [];
      const context = createMlvEditorInsertContext(editor);
      if (!context) return [];
      return mlvEditorInsertMenuGroups(
        this.items(),
        context,
        this._i18n?.(),
        this._icons,
      );
    },
  );

  /** @private Image-upload coordinator of the editor, if uploads are wired. */
  private readonly _coordinator = computed(() =>
    resolveMlvEditorImageUploadCoordinator(this._context.imageUpload),
  );

  /** @private What the default items need beyond Tiptap. */
  private readonly _services: MlvEditorInsertServices = {
    aiAvailable: () => this._ai?.hasProvider() ?? false,
    aiCanStart: () => this._ai?.canStart() ?? false,
    askAi: (target) => {
      const view = this._context.editor()?.view;
      const block = view?.nodeDOM(target.pos);
      const anchor =
        block instanceof HTMLElement
          ? block.getBoundingClientRect()
          : view?.dom.getBoundingClientRect();
      if (anchor) this._aiPrompt?.open({ anchor, output: 'insert-below' });
    },
    imageUploadAvailable: () => this._imageUploadAvailable(),
    imageUploadEnabled: () =>
      this._editable() && !!this._coordinator()?.available(),
    openImageUpload: (position) => this._openImageUpload(position),
  };

  constructor() {
    effect((onCleanup) => {
      const editor = this._context.editor();
      if (!editor) return;
      onCleanup(registerMlvEditorInsertServices(editor, this._services));
    });
    // An unregistered icon name renders no icon; say so once per name.
    effect(() => {
      const missing = mlvEditorMissingInsertIcons(this._groups());
      untracked(() => missing.forEach((name) => this._warnMissingIcon(name)));
    });
    // An editor that stops accepting insertions (readonly, disabled, or a
    // collaboration session that failed or closed) closes the menu and the
    // image dialog it opened.
    effect(() => {
      if (this._editable()) return;
      untracked(() => {
        if (this._open()) this._trigger().close();
        this._imageDialog?.close();
      });
    });
    this._destroyRef.onDestroy(() => {
      this._registration.releaseAll();
      this._imageDialog?.close();
      // Leaving the clean appearance while open: no `menuClosed` follows.
      const editor = this._context.editor();
      if (editor && !editor.isDestroyed) {
        mlvEditorBlockInserter(editor.view)?.hidePreview();
      }
    });
  }

  /** Opens the menu for the block at `request.pos`, anchored to `request.rect`. */
  open(request: MlvEditorBlockHandleInsertRequest): void {
    const view = this._context.editor()?.view;
    if (!view || !this._editable()) return;
    // Dismiss the bubble (and any other editor popup) first, so its hide
    // returns focus to the content before the menu takes it. `closeOthers`,
    // not `closeAll`: entries stay for their owners, so the AI review bar
    // keeps its focus listeners. `view.dom` is never a registered root.
    this._overlays.closeOthers(view.dom as HTMLElement);
    mlvEditorCollapseIntoInsertSource(view, request.pos);
    const rtl = this._rtl.resolveDirection(view.dom) === 'rtl';
    this._via = request.via;
    this._open.set(true);
    this._trigger().openAt(
      rtl ? request.rect.left : request.rect.right,
      request.rect.top,
      view.dom as HTMLElement,
    );
  }

  /** Opens the menu for the caret's block as the keyboard would. */
  openAtCaret(): void {
    const view = this._context.editor()?.view;
    const pos = view ? mlvEditorInsertSourcePos(view.state) : null;
    if (!view || pos === null) return;
    this.open({
      pos,
      rect: mlvEditorInsertSlotRect(view, pos),
      via: 'keyboard',
    });
  }

  /** @protected The panel opened: register it, focus, preview the target. */
  protected _onOpened(): void {
    const menu = this._menu();
    this._registration.opened(menu, () => this._trigger().close());
    const view = this._context.editor()?.view;
    if (view) mlvEditorBlockInserter(view)?.showPreview();
    if (this._via !== 'keyboard') return;
    // Items render with the panel; the first is focusable a task later
    // (§ 17 item 10).
    this._focusFirst?.unsubscribe();
    this._focusFirst = timer(0)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe(() => {
        if (this._open()) menu.focusFirstItem();
      });
  }

  /** @protected The panel closed: release it and the preview. */
  protected _onClosed(): void {
    this._focusFirst?.unsubscribe();
    this._focusFirst = undefined;
    this._open.set(false);
    this._registration.closed(this._menu());
    const editor = this._context.editor();
    if (editor && !editor.isDestroyed) {
      mlvEditorBlockInserter(editor.view)?.hidePreview();
    }
  }

  /** @protected Runs `item` after closing the menu; a throw is reported. */
  protected _run(item: MlvEditorInsertItem): void {
    const editor = this._context.editor();
    this._trigger().close();
    if (!editor || editor.isDestroyed || !this._editable()) return;
    const context = createMlvEditorInsertContext(editor);
    if (!context) return;
    try {
      item.run(context);
    } catch (cause) {
      this._context.reportError({
        code: 'unsupported-command',
        message: `Insert item "${item.id}" failed.`,
        recoverable: true,
        cause,
      });
    }
  }

  /**
   * @private An item names an icon the application never registered: it
   * renders without one, and dev mode says so once per name.
   */
  private _warnMissingIcon(name: string): void {
    if (!isDevMode() || this._missingIcons.has(name)) return;
    this._missingIcons.add(name);
    console.warn(
      `mlv-editor: the insert item icon '${name}' is not registered, so the ` +
        'item renders without an icon. Register it with provideLucideIcons().',
    );
  }

  /** @private Whether the image item belongs in the menu. */
  private _imageUploadAvailable(): boolean {
    const commands = this._context.editor()?.commands as
      | Record<string, unknown>
      | undefined;
    return (
      !!this._coordinator()?.adapterAvailable() &&
      !this._context.readonly() &&
      typeof commands?.['setImage'] === 'function' &&
      typeof commands?.['insertUploadPlaceholder'] === 'function' &&
      typeof commands?.['replaceUploadPlaceholder'] === 'function'
    );
  }

  /**
   * @private Opens the shared upload dialog, landing the upload at
   * `position` (read on submit); focus returns to the content.
   */
  private _openImageUpload(position: () => number | null): void {
    const coordinator = this._coordinator();
    if (!coordinator || this._imageDialog || !this._editable()) return;
    const ref = openMlvEditorImageUploadDialog({
      dialogs: this._dialogs,
      injector: this._injector,
      coordinator,
      title: this._copy().uploadImage,
      position,
    });
    this._imageDialog = ref;
    ref.afterClosed().subscribe(() => {
      if (this._imageDialog === ref) this._imageDialog = undefined;
      const editor: Editor | null = this._context.editor();
      if (editor && !this._context.disabled()) mlvEditorFocusContent(editor);
    });
  }
}
