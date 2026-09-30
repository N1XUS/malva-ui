import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  ViewEncapsulation,
  viewChild,
} from '@angular/core';
import type { Editor } from '@tiptap/core';
import { LucideChevronRight, LucideEllipsis } from '@lucide/angular';
import { MlvButton, MlvButtonIcon } from '@malva-ui/core/button';
import { MlvListItem, MlvListItemSuffix } from '@malva-ui/core/list';
import {
  MlvMenu,
  MlvMenuItem,
  MlvMenuSeparator,
  MlvMenuTrigger,
} from '@malva-ui/core/menu';
import { MlvTooltip } from '@malva-ui/core/tooltip';
import { MLV_EDITOR_I18N } from '@malva-ui/i18n';
import {
  MLV_EDITOR_OVERLAY_REGISTRY,
  MLV_EDITOR_TOOLBAR_CONTEXT,
  MLV_EDITOR_TOOLBAR_REVISION,
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
import { MlvEditorToolbarWidget } from './editor-toolbar-widget';

/** @internal A submenu row; the chevron mirrors in RTL. */
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

/** @internal A mark toggle row, gated by its command and by `gate`. */
function toggleRow(gate: string, mark: string, label: string): string {
  return `
      @if (${gate}_supported('toggle${mark}')) {
        <mlv-list-item
          mlvMenuItem
          [disabled]="_commandDisabled(_canToggle('${mark}'))"
          [attr.aria-current]="_context.isActive('${label}') ? 'true' : null"
          (itemClick)="_run(_toggle('${mark}'))"
          >{{ _copy().${label} }}</mlv-list-item
        >
      }`;
}

/**
 * @internal "More formatting" menu of the clean appearance's bubble
 * (`toolbarAppearance="clean"`, #516), for the commands the compact bubble
 * leaves out: alignment, subscript and superscript, clear formatting, the
 * font family / size and line-height submenus and "Copy link to heading".
 * While `narrow`, it also lists underline, strike-through and inline code,
 * which the bubble's marks group drops. Each row appears only when the
 * extension set registers its command; the button hides when none does.
 *
 * Not `mlv-editor-toolbar-overflow`: that menu is the bar's narrow overflow,
 * hidden unless narrow, and lists what the bar's narrow row hides.
 */
@Component({
  selector: 'mlv-editor-bubble-more',
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
    MlvMenuSeparator,
    MlvMenuTrigger,
    MlvEditorToolbarWidget,
  ],
  template:
    `
    <button
      #_moreTrigger
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
    <mlv-menu #_menu [label]="_copy().moreFormatting">
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
    toggleRow('narrow() && ', 'Underline', 'underline') +
    toggleRow('narrow() && ', 'Strike', 'strike') +
    toggleRow('narrow() && ', 'Code', 'code') +
    toggleRow('', 'Subscript', 'subscript') +
    toggleRow('', 'Superscript', 'superscript') +
    `
      @if (_supported('resetFormatting')) {
        <mlv-list-item
          mlvMenuItem
          [disabled]="_commandDisabled(_canResetFormatting)"
          (itemClick)="_run(_resetFormatting)"
          >{{ _copy().clearFormatting }}</mlv-list-item
        >
      }` +
    submenuRow('_fontFamilyMenu', '_fontFamily') +
    submenuRow('_fontSizeMenu', '_fontSize') +
    submenuRow('_lineHeightMenu', '_lineHeight') +
    `
      @if (_hasCopyLink()) {
        <mlv-menu-separator />
        <mlv-list-item
          mlvMenuItem
          [disabled]="_commandDisabled(_canCopyLink)"
          (itemClick)="_run(_copyLink)"
          >{{ _copy().copyHeadingLink }}</mlv-list-item
        >
      }
    </mlv-menu>` +
    mlvEditorStyleMenuTemplate('_fontFamilyMenu', '_fontFamily') +
    mlvEditorStyleMenuTemplate('_fontSizeMenu', '_fontSize') +
    mlvEditorStyleMenuTemplate('_lineHeightMenu', '_lineHeight'),
  styleUrl: './editor-bubble-more.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-editor-bubble-more',
    '[hidden]': '!_hasItems()',
  },
})
export class MlvEditorBubbleMore {
  /** Also lists underline, strike-through and inline code. */
  readonly narrow = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /** @protected Editor-scoped command state. */
  protected readonly _context = inject(MLV_EDITOR_TOOLBAR_CONTEXT);
  /** @private Command-state invalidation signal. */
  private readonly _revision = inject(MLV_EDITOR_TOOLBAR_REVISION, {
    optional: true,
  });
  /** @private Detached overlay registry. */
  private readonly _overlays = inject<MlvEditorOverlayRegistry>(
    MLV_EDITOR_OVERLAY_REGISTRY,
  );
  /** @private Document used to find the portaled menu panel. */
  private readonly _document = inject(DOCUMENT);
  /** @private Optional reactive localized editor copy. */
  private readonly _i18n = inject(MLV_EDITOR_I18N, { optional: true });
  /** @private Registers open submenu panels with the editor composite. */
  private readonly _submenus = createMlvEditorMenuRegistration(
    this._overlays,
    this._document,
  );
  /** @protected Rendered menu. */
  protected readonly _menu = viewChild.required<MlvMenu>('_menu');
  /** @private Trigger that owns the menu. */
  private readonly _trigger = viewChild.required('_moreTrigger', {
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

  /** @protected Reactive localized copy. */
  protected readonly _copy = computed(() => {
    const copy = this._i18n?.();
    return {
      moreFormatting: copy?.moreFormatting ?? 'More formatting',
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
      copyHeadingLink: copy?.copyHeadingLink ?? 'Copy link to heading',
    };
  });

  /** @protected Alignment rows, in the bar's order. */
  protected readonly _alignments = computed(() => [
    { value: 'left', label: this._copy().alignLeft },
    { value: 'center', label: this._copy().alignCenter },
    { value: 'right', label: this._copy().alignRight },
    { value: 'justify', label: this._copy().alignJustify },
  ]);

  /** @protected Whether at least one row renders; the button hides otherwise. */
  protected readonly _hasItems = computed(
    () =>
      [
        'setTextAlign',
        'toggleSubscript',
        'toggleSuperscript',
        'resetFormatting',
      ].some((command) => this._supported(command)) ||
      (this.narrow() &&
        ['toggleUnderline', 'toggleStrike', 'toggleCode'].some((command) =>
          this._supported(command),
        )) ||
      this._fontFamily.supported() ||
      this._fontSize.supported() ||
      this._lineHeight.supported() ||
      this._hasCopyLink(),
  );

  /** @protected Clear-formatting command. */
  protected readonly _resetFormatting = (editor: Editor): boolean =>
    editor.chain().focus().resetFormatting().run();
  /** @protected Non-mutating clear-formatting check. */
  protected readonly _canResetFormatting = (editor: Editor): boolean =>
    editor.can().chain().resetFormatting().run();
  /** @protected Copies the caret heading's link (N1 heading anchors). */
  protected readonly _copyLink = (editor: Editor): boolean =>
    editor.chain().focus().copyHeadingLink().run();
  /** @protected Non-mutating copy-link check. */
  protected readonly _canCopyLink = (editor: Editor): boolean =>
    editor.can().copyHeadingLink();

  /** @private Current detached-overlay registration. */
  private _unregister: (() => void) | undefined;
  /** @private Guards queued registration after close. */
  private _menuOpen = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
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

  /**
   * @protected Whether the menu offers "Copy link to heading": the caret
   * block is a heading and `MlvEditorHeadingAnchors` registered its command.
   */
  protected _hasCopyLink(): boolean {
    this._revision?.();
    return (
      this._supported('copyHeadingLink') && this._context.isActive('heading')
    );
  }

  /** @protected Mark toggle command factory (`toggle<Mark>`). */
  protected _toggle(mark: string): (editor: Editor) => boolean {
    return (editor) => {
      const chain = editor.chain().focus() as unknown as Record<
        string,
        () => { run(): boolean }
      >;
      return chain[`toggle${mark}`]().run();
    };
  }

  /** @protected Non-mutating mark toggle check factory. */
  protected _canToggle(mark: string): (editor: Editor) => boolean {
    return (editor) => {
      const chain = editor.can().chain() as unknown as Record<
        string,
        () => { run(): boolean }
      >;
      return chain[`toggle${mark}`]().run();
    };
  }

  /** @protected Alignment command factory. */
  protected _align(value: string): (editor: Editor) => boolean {
    return (editor) => editor.chain().focus().setTextAlign(value).run();
  }

  /** @protected Non-mutating alignment check factory. */
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

  /** @protected Executes one command through the context guard. */
  protected _run(command: (editor: Editor) => boolean): void {
    this._context.run(command);
  }

  /** @protected Registers the portaled menu panel with composite focus. */
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
