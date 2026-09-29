import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  ViewEncapsulation,
  viewChild,
} from '@angular/core';
import type { Editor } from '@tiptap/core';
import { LucideChevronRight, LucideEllipsis } from '@lucide/angular';
import { MlvButton, MlvButtonIcon } from '@malva-ui/core/button';
import { MlvListItem, MlvListItemSuffix } from '@malva-ui/core/list';
import { MlvMenu, MlvMenuItem, MlvMenuTrigger } from '@malva-ui/core/menu';
import { MlvTooltip } from '@malva-ui/core/tooltip';
import { MLV_EDITOR_I18N } from '@malva-ui/i18n';
import {
  MLV_EDITOR_OVERLAY_REGISTRY,
  MLV_EDITOR_TOOLBAR_CONTEXT,
  MLV_EDITOR_TOOLBAR_REVISION,
  MLV_EDITOR_TOOLBAR_ROVING,
} from '../editor-toolbar-context';
import type { MlvEditorOverlayRegistry } from '../editor-toolbar-context';
import { createMlvEditorMenuRegistration } from './editor-menu-registration';
import {
  createMlvEditorStyleMenuModel,
  mlvEditorStyleMenuTemplate,
} from './editor-style-menu';
import {
  mlvEditorFontFamilyMenuSpec,
  mlvEditorFontSizeMenuSpec,
  mlvEditorLineHeightMenuSpec,
} from './editor-style-menu-specs';
import { MlvEditorToolbarRoot } from './editor-toolbar-root';
import { MlvEditorToolbarWidget } from './editor-toolbar-widget';

/**
 * @internal A submenu row of the overflow menu. The chevron mirrors in RTL
 * through `.mlv-editor-toolbar__submenu-chevron`.
 */
function submenuRow(menuRef: string, model: string): string {
  return `
      @if (${model}.supported()) {
        <mlv-list-item
          mlvMenuItem
          [mlvMenuTrigger]="${menuRef}"
          [isSubmenuTrigger]="true"
          [disabled]="${model}.triggerDisabled()"
          (menuOpened)="_registerSubmenu(${menuRef})"
          (menuClosed)="_unregisterSubmenu(${menuRef})"
          >{{ ${model}.label()
          }}<svg
            mlvListItemSuffix
            class="mlv-editor-toolbar__submenu-chevron"
            lucideChevronRight
            [size]="16"
            aria-hidden="true"
        /></mlv-list-item>
      }`;
}

/** @internal A toggle row of the overflow menu, gated by one command. */
function toggleRow(
  command: string,
  can: string,
  run: string,
  active: string,
  label: string,
): string {
  return `
      @if (_supported('${command}')) {
        <mlv-list-item
          mlvMenuItem
          [disabled]="_commandDisabled(${can})"
          [attr.aria-current]="_context.isActive('${active}') ? 'true' : null"
          (itemClick)="_run(${run})"
          >{{ _copy().${label} }}</mlv-list-item
        >
      }`;
}

/**
 * @internal Responsive menu holding the commands removed from the primary row
 * in narrow mode, in row order: font and size submenus, the inline marks,
 * clear formatting, alignment, the line-height submenu and the block
 * commands. Each row appears only when the extension set registers its
 * commands.
 */
@Component({
  selector: 'mlv-editor-toolbar-overflow',
  imports: [
    MlvButton,
    MlvButtonIcon,
    MlvTooltip,
    LucideChevronRight,
    LucideEllipsis,
    MlvListItem,
    MlvListItemSuffix,
    MlvMenu,
    MlvMenuItem,
    MlvMenuTrigger,
    MlvEditorToolbarWidget,
  ],
  template:
    `
    <button
      #_overflowTrigger
      mlvButton
      mlvEditorToolbarWidget
      type="button"
      shape="circle"
      variant="transparent"
      [attr.aria-label]="_copy().moreFormatting"
      [disabled]="_context.disabled()"
      [mlvMenuTrigger]="_menu"
      [menuTriggerDisabled]="_context.disabled()"
      [mlvTooltip]="_copy().moreFormatting"
      (menuOpened)="_registerOverlay()"
      (menuClosed)="_unregisterOverlay()"
    >
      <svg mlvButtonIcon lucideEllipsis aria-hidden="true" />
    </button>
    <mlv-menu #_menu [label]="_copy().moreFormatting">` +
    submenuRow('_fontFamilyMenu', '_fontFamily') +
    submenuRow('_fontSizeMenu', '_fontSize') +
    toggleRow('toggleBold', '_canBold', '_bold', 'bold', 'bold') +
    toggleRow('toggleItalic', '_canItalic', '_italic', 'italic', 'italic') +
    toggleRow('toggleStrike', '_canStrike', '_strike', 'strike', 'strike') +
    toggleRow(
      'toggleUnderline',
      '_canUnderline',
      '_underline',
      'underline',
      'underline',
    ) +
    toggleRow('toggleCode', '_canCode', '_code', 'code', 'code') +
    toggleRow(
      'toggleSubscript',
      '_canSubscript',
      '_subscript',
      'subscript',
      'subscript',
    ) +
    toggleRow(
      'toggleSuperscript',
      '_canSuperscript',
      '_superscript',
      'superscript',
      'superscript',
    ) +
    `
      @if (_supported('resetFormatting')) {
        <mlv-list-item
          mlvMenuItem
          [disabled]="_commandDisabled(_canResetFormatting)"
          (itemClick)="_run(_resetFormatting)"
          >{{ _copy().clearFormatting }}</mlv-list-item
        >
      }
      @if (_supported('setTextAlign')) {
        @for (alignment of _alignments(); track alignment.value) {
          <mlv-list-item
            mlvMenuItem
            [disabled]="_commandDisabled(_canAlign(alignment.value))"
            [attr.aria-current]="
              _context.isActive('paragraph', { textAlign: alignment.value })
                ? 'true'
                : null
            "
            (itemClick)="_run(_align(alignment.value))"
            >{{ alignment.label }}</mlv-list-item
          >
        }
      }` +
    submenuRow('_lineHeightMenu', '_lineHeight') +
    toggleRow(
      'toggleBlockquote',
      '_canBlockquote',
      '_blockquote',
      'blockquote',
      'blockquote',
    ) +
    toggleRow(
      'toggleCodeBlock',
      '_canCodeBlock',
      '_codeBlock',
      'codeBlock',
      'codeBlock',
    ) +
    `
      @if (_supported('setHorizontalRule')) {
        <mlv-list-item
          mlvMenuItem
          [disabled]="_commandDisabled(_canHorizontalRule)"
          (itemClick)="_run(_horizontalRule)"
          >{{ _copy().horizontalRule }}</mlv-list-item
        >
      }
    </mlv-menu>` +
    mlvEditorStyleMenuTemplate('_fontFamilyMenu', '_fontFamily') +
    mlvEditorStyleMenuTemplate('_fontSizeMenu', '_fontSize') +
    mlvEditorStyleMenuTemplate('_lineHeightMenu', '_lineHeight'),
  styleUrl: './editor-toolbar-overflow.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-editor-toolbar__overflow',
    '[hidden]': '!_root.narrow()',
  },
})
export class MlvEditorToolbarOverflow {
  /** @protected Responsive state owned by the enclosing toolbar root. */
  protected readonly _root = inject(MlvEditorToolbarRoot);
  /** @protected Editor-scoped command state. */
  protected readonly _context = inject(MLV_EDITOR_TOOLBAR_CONTEXT);
  /** @private Command-state invalidation signal. */
  private readonly _revision = inject(MLV_EDITOR_TOOLBAR_REVISION, {
    optional: true,
  });
  /** @private Roving coordinator used to recover focus after wide layout returns. */
  private readonly _roving = inject(MLV_EDITOR_TOOLBAR_ROVING);
  /** @private Detached overlay registry. */
  private readonly _overlays = inject<MlvEditorOverlayRegistry>(
    MLV_EDITOR_OVERLAY_REGISTRY,
  );
  /** @private Document used after a browser menu opens. */
  private readonly _document = inject(DOCUMENT);
  /** @private Teardown scope for a currently open menu. */
  private readonly _destroyRef = inject(DestroyRef);
  /** @private Optional reactive localized editor copy. */
  private readonly _i18n = inject(MLV_EDITOR_I18N, { optional: true });
  /** @private Registers open submenu panels with the editor composite. */
  private readonly _submenus = createMlvEditorMenuRegistration(
    this._overlays,
    this._document,
  );
  /** @protected Rendered overflow menu. */
  protected readonly _menu = viewChild.required<MlvMenu>('_menu');
  /** @protected Trigger that owns the overflow menu. */
  protected readonly _trigger = viewChild.required('_overflowTrigger', {
    read: MlvMenuTrigger,
  });
  /** @protected Font-family submenu, shared with `mlv-editor-font-family`. */
  protected readonly _fontFamily = createMlvEditorStyleMenuModel(
    mlvEditorFontFamilyMenuSpec(),
  );
  /** @protected Font-size submenu, shared with `mlv-editor-font-size`. */
  protected readonly _fontSize = createMlvEditorStyleMenuModel(
    mlvEditorFontSizeMenuSpec(),
  );
  /** @protected Line-height submenu, shared with `mlv-editor-line-height`. */
  protected readonly _lineHeight = createMlvEditorStyleMenuModel(
    mlvEditorLineHeightMenuSpec(),
  );
  /** @private Current detached-overlay registration. */
  private _unregister: (() => void) | undefined;
  /** @private Guards queued registration after close. */
  private _menuOpen = false;
  /** @private Previous responsive state used to identify a narrow-to-wide edge. */
  private _wasNarrow = false;
  /** @protected Formatting order retained when controls move into overflow. */
  protected readonly _alignments = computed(() => [
    { value: 'left', label: this._copy().alignLeft },
    { value: 'center', label: this._copy().alignCenter },
    { value: 'right', label: this._copy().alignRight },
    { value: 'justify', label: this._copy().alignJustify },
  ]);
  /** @protected Reactive localized copy for every overflow command. */
  protected readonly _copy = computed(() => {
    const copy = this._i18n?.();
    return {
      moreFormatting: copy?.moreFormatting ?? 'More formatting',
      bold: copy?.bold ?? 'Bold',
      italic: copy?.italic ?? 'Italic',
      strike: copy?.strike ?? 'Strike-through',
      underline: copy?.underline ?? 'Underline',
      code: copy?.inlineCode ?? 'Inline code',
      subscript: copy?.subscript ?? 'Subscript',
      superscript: copy?.superscript ?? 'Superscript',
      clearFormatting: copy?.clearFormatting ?? 'Clear formatting',
      alignLeft: copy?.alignLeft ?? 'Align left',
      alignCenter: copy?.alignCenter ?? 'Align center',
      alignRight: copy?.alignRight ?? 'Align right',
      alignJustify: copy?.alignJustify ?? 'Justify',
      blockquote: copy?.blockquote ?? 'Blockquote',
      codeBlock: copy?.codeBlock ?? 'Code block',
      horizontalRule: copy?.horizontalRule ?? 'Horizontal rule',
    };
  });

  /** @protected Bold toggle command. */
  protected readonly _bold = (editor: Editor): boolean =>
    editor.chain().focus().toggleBold().run();
  /** @protected Italic toggle command. */
  protected readonly _italic = (editor: Editor): boolean =>
    editor.chain().focus().toggleItalic().run();
  /** @protected Strike toggle command. */
  protected readonly _strike = (editor: Editor): boolean =>
    editor.chain().focus().toggleStrike().run();
  /** @protected Underline toggle command. */
  protected readonly _underline = (editor: Editor): boolean =>
    editor.chain().focus().toggleUnderline().run();
  /** @protected Inline-code toggle command. */
  protected readonly _code = (editor: Editor): boolean =>
    editor.chain().focus().toggleCode().run();
  /** @protected Subscript toggle command. */
  protected readonly _subscript = (editor: Editor): boolean =>
    editor.chain().focus().toggleSubscript().run();
  /** @protected Superscript toggle command. */
  protected readonly _superscript = (editor: Editor): boolean =>
    editor.chain().focus().toggleSuperscript().run();
  /** @protected Clear-formatting command. */
  protected readonly _resetFormatting = (editor: Editor): boolean =>
    editor.chain().focus().resetFormatting().run();
  /** @protected Blockquote toggle command. */
  protected readonly _blockquote = (editor: Editor): boolean =>
    editor.chain().focus().toggleBlockquote().run();
  /** @protected Code-block toggle command. */
  protected readonly _codeBlock = (editor: Editor): boolean =>
    editor.chain().focus().toggleCodeBlock().run();
  /** @protected Horizontal-rule insertion command. */
  protected readonly _horizontalRule = (editor: Editor): boolean =>
    editor.chain().focus().setHorizontalRule().run();
  /** @protected Non-mutating bold capability check. */
  protected readonly _canBold = (editor: Editor): boolean =>
    editor.can().chain().toggleBold().run();
  /** @protected Non-mutating italic capability check. */
  protected readonly _canItalic = (editor: Editor): boolean =>
    editor.can().chain().toggleItalic().run();
  /** @protected Non-mutating strike capability check. */
  protected readonly _canStrike = (editor: Editor): boolean =>
    editor.can().chain().toggleStrike().run();
  /** @protected Non-mutating underline capability check. */
  protected readonly _canUnderline = (editor: Editor): boolean =>
    editor.can().chain().toggleUnderline().run();
  /** @protected Non-mutating inline-code capability check. */
  protected readonly _canCode = (editor: Editor): boolean =>
    editor.can().chain().toggleCode().run();
  /** @protected Non-mutating subscript capability check. */
  protected readonly _canSubscript = (editor: Editor): boolean =>
    editor.can().chain().toggleSubscript().run();
  /** @protected Non-mutating superscript capability check. */
  protected readonly _canSuperscript = (editor: Editor): boolean =>
    editor.can().chain().toggleSuperscript().run();
  /** @protected Non-mutating clear-formatting capability check. */
  protected readonly _canResetFormatting = (editor: Editor): boolean =>
    editor.can().chain().resetFormatting().run();
  /** @protected Non-mutating blockquote capability check. */
  protected readonly _canBlockquote = (editor: Editor): boolean =>
    editor.can().chain().toggleBlockquote().run();
  /** @protected Non-mutating code-block capability check. */
  protected readonly _canCodeBlock = (editor: Editor): boolean =>
    editor.can().chain().toggleCodeBlock().run();
  /** @protected Non-mutating horizontal-rule capability check. */
  protected readonly _canHorizontalRule = (editor: Editor): boolean =>
    editor.can().chain().setHorizontalRule().run();

  constructor() {
    effect(() => {
      const narrow = this._root.narrow();
      const wasNarrow = this._wasNarrow;
      this._wasNarrow = narrow;
      if (narrow || !wasNarrow || !this._menuOpen) return;
      this._menu().close();
      queueMicrotask(() => this._roving.focusBoundary('start'));
    });
    this._destroyRef.onDestroy(() => {
      this._unregisterOverlay();
      this._submenus.releaseAll();
    });
  }

  /** @protected Whether the active extension set registered a command. */
  protected _supported(command: string): boolean {
    this._revision?.();
    const editor = this._context.editor();
    if (!editor) return false;
    return (
      typeof (editor.commands as unknown as Record<string, unknown>)[
        command
      ] === 'function'
    );
  }

  /** @protected Alignment command factory. */
  protected _align(value: string): (editor: Editor) => boolean {
    return (editor) => editor.chain().focus().setTextAlign(value).run();
  }

  /** @protected Non-mutating alignment capability factory. */
  protected _canAlign(value: string): (editor: Editor) => boolean {
    return (editor) => editor.can().chain().setTextAlign(value).run();
  }

  /** @protected Whether the command is blocked or unsupported. */
  protected _commandDisabled(command: (editor: Editor) => boolean): boolean {
    this._revision?.();
    if (this._context.disabled() || this._context.readonly()) return true;
    try {
      return !this._context.can(command);
    } catch {
      return true;
    }
  }

  /** @protected Executes one overflow command through the context guard. */
  protected _run(command: (editor: Editor) => boolean): void {
    this._context.run(command);
  }

  /** @protected Registers the detached overflow panel with composite focus. */
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

  /** @protected Releases focus ownership after close. */
  protected _unregisterOverlay(): void {
    this._menuOpen = false;
    this._unregister?.();
    this._unregister = undefined;
  }

  /** @protected Registers an open text-style submenu panel. */
  protected _registerSubmenu(menu: MlvMenu): void {
    this._submenus.opened(menu, () => menu.close());
  }

  /** @protected Releases a text-style submenu registration after close. */
  protected _unregisterSubmenu(menu: MlvMenu): void {
    this._submenus.closed(menu);
  }
}
