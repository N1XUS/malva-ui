import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  ViewEncapsulation,
  viewChild,
} from '@angular/core';
import type { Editor } from '@tiptap/core';
import {
  LucideHeading,
  LucideHeading1,
  LucideHeading2,
  LucideHeading3,
  LucideHeading4,
  LucideHeading5,
  LucideHeading6,
} from '@lucide/angular';
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

/** Heading levels supported by Tiptap's standard heading node. */
export type MlvEditorHeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

const DEFAULT_HEADING_LEVELS: readonly MlvEditorHeadingLevel[] = [
  1, 2, 3, 4, 5, 6,
];

/** Keeps valid heading levels in caller order while removing duplicates. */
function normalizeHeadingLevels(
  levels: readonly MlvEditorHeadingLevel[],
): readonly MlvEditorHeadingLevel[] {
  const normalized: MlvEditorHeadingLevel[] = [];
  for (const candidate of levels as readonly unknown[]) {
    if (
      typeof candidate === 'number' &&
      Number.isInteger(candidate) &&
      candidate >= 1 &&
      candidate <= 6 &&
      !normalized.includes(candidate as MlvEditorHeadingLevel)
    ) {
      normalized.push(candidate as MlvEditorHeadingLevel);
    }
  }
  return normalized;
}

/** Paragraph and heading-level dropdown commands. */
@Component({
  selector: 'mlv-editor-heading',
  imports: [
    MlvButton,
    MlvButtonIcon,
    MlvTooltip,
    LucideHeading,
    LucideHeading1,
    LucideHeading2,
    LucideHeading3,
    LucideHeading4,
    LucideHeading5,
    LucideHeading6,
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
      [selected]="_activeLevel() !== null"
      [mlvMenuTrigger]="_menu"
      [menuTriggerDisabled]="_triggerDisabled()"
      [attr.aria-label]="_copy().headingLevel"
      [mlvTooltip]="_label()"
      (menuOpened)="_registerOverlay()"
      (menuClosed)="_unregisterOverlay()"
    >
      @switch (_activeLevel()) {
        @case (1) {
          <svg mlvButtonIcon lucideHeading1 aria-hidden="true" />
        }
        @case (2) {
          <svg mlvButtonIcon lucideHeading2 aria-hidden="true" />
        }
        @case (3) {
          <svg mlvButtonIcon lucideHeading3 aria-hidden="true" />
        }
        @case (4) {
          <svg mlvButtonIcon lucideHeading4 aria-hidden="true" />
        }
        @case (5) {
          <svg mlvButtonIcon lucideHeading5 aria-hidden="true" />
        }
        @case (6) {
          <svg mlvButtonIcon lucideHeading6 aria-hidden="true" />
        }
        @default {
          <svg mlvButtonIcon lucideHeading aria-hidden="true" />
        }
      }
    </button>
    <mlv-menu #_menu [label]="_copy().headingLevel">
      @if (_hasParagraph()) {
        <mlv-list-item
          mlvMenuItem
          [disabled]="_disabled(_canParagraph)"
          [attr.aria-current]="_context.isActive('paragraph') ? 'true' : null"
          (itemClick)="_run(_paragraph)"
        >
          {{ _copy().paragraph }}
        </mlv-list-item>
      }
      @for (level of _levels(); track level) {
        @if (_hasHeading()) {
          <mlv-list-item
            mlvMenuItem
            [disabled]="_disabled(_canHeading(level))"
            [attr.aria-current]="
              _context.isActive('heading', { level }) ? 'true' : null
            "
            (itemClick)="_run(_heading(level))"
          >
            {{ _headingLabel(level) }}
          </mlv-list-item>
        }
      }
    </mlv-menu>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-editor-heading',
    '[hidden]': '!_supported()',
  },
})
export class MlvEditorHeading {
  /** Heading levels displayed in the menu; paragraph is always retained. */
  readonly levels = input<readonly MlvEditorHeadingLevel[]>(
    DEFAULT_HEADING_LEVELS,
  );

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

  /** @private Cleans an active overlay registration. */
  private readonly _destroyRef = inject(DestroyRef);

  /** @private Optional localized editor copy. */
  private readonly _i18n = inject(MLV_EDITOR_I18N, { optional: true });

  /** @protected Rendered Malva menu. */
  protected readonly _menu = viewChild.required<MlvMenu>('_menu');

  /** @protected Trigger owning the menu overlay. */
  protected readonly _trigger = viewChild.required(MlvMenuTrigger);

  /** @private Overlay-registration teardown. */
  private _unregister: (() => void) | undefined;

  /** @private Guards queued registration after a quick close or destroy. */
  private _menuOpen = false;

  /** @protected Normalized levels supported by the active heading extension. */
  protected readonly _levels = computed(() => {
    this._revision();
    const requested = normalizeHeadingLevels(this.levels());
    const editor = this._context.editor();
    if (!editor?.commands.toggleHeading) return [];
    const heading = editor.extensionManager.extensions.find(
      (extension) => extension.name === 'heading',
    );
    const configured = (heading?.options as { levels?: unknown } | undefined)
      ?.levels;
    if (!Array.isArray(configured)) return requested;
    return requested.filter((level) => configured.includes(level));
  });

  /** @protected Localized labels. */
  protected readonly _copy = computed(() => ({
    paragraph: this._i18n?.().paragraph ?? 'Paragraph',
    headingLevel: this._i18n?.().headingLevel ?? 'Heading level',
  }));

  /** @protected Paragraph command availability at the current selection. */
  protected readonly _canParagraph = (editor: Editor): boolean =>
    editor.can().chain().setParagraph().run();

  constructor() {
    this._destroyRef.onDestroy(() => this._unregisterOverlay());
  }

  /**
   * @protected Heading level under the caret, or `null` on a paragraph. Probes
   * every level the node supports rather than {@link _levels}: the caret can
   * land in a heading the menu deliberately omits, and the trigger still has to
   * report what the block actually is.
   *
   * Drives both the trigger glyph and its selected paint. The paint is a class,
   * not `aria-pressed` — this is a menu button, and its state semantics are
   * `aria-haspopup`/`aria-expanded` plus the level-bearing accessible name.
   */
  protected _activeLevel(): MlvEditorHeadingLevel | null {
    // Every other state-reading method here reads the revision explicitly
    // rather than leaning on a sibling binding to mark the OnPush view dirty.
    this._revision();
    return (
      DEFAULT_HEADING_LEVELS.find((level) =>
        this._context.isActive('heading', { level }),
      ) ?? null
    );
  }

  /** @protected Label describing the active block type. */
  protected _label(): string {
    const active = this._activeLevel();
    return active ? this._headingLabel(active) : this._copy().paragraph;
  }

  /** @protected Localized heading label. */
  protected _headingLabel(level: number): string {
    return `${this._copy().headingLevel} ${level}`;
  }

  /** @protected Whether a heading command is registered by the extension set. */
  protected _supported(): boolean {
    this._revision();
    const editor = this._context.editor();
    return (
      !!editor &&
      (editor.commands.setParagraph !== undefined ||
        editor.commands.toggleHeading !== undefined)
    );
  }

  /** @protected Whether the paragraph command is registered. */
  protected _hasParagraph(): boolean {
    this._revision();
    return this._context.editor()?.commands.setParagraph !== undefined;
  }

  /** @protected Whether heading commands are registered. */
  protected _hasHeading(): boolean {
    this._revision();
    return this._context.editor()?.commands.toggleHeading !== undefined;
  }

  /** @protected Whether the trigger cannot be opened. */
  protected _triggerDisabled(): boolean {
    return (
      !this._supported() || this._context.disabled() || this._context.readonly()
    );
  }

  /** @protected Whether one menu action currently cannot mutate the editor. */
  protected _disabled(command: (editor: Editor) => boolean): boolean {
    this._revision();
    return this._triggerDisabled() || !this._context.can(command);
  }

  /** @protected Paragraph command. */
  protected readonly _paragraph = (editor: Editor): boolean =>
    editor.chain().focus().setParagraph().run();

  /** @protected Heading command factory. */
  protected _heading(
    level: MlvEditorHeadingLevel,
  ): (editor: Editor) => boolean {
    return (editor) => editor.chain().focus().toggleHeading({ level }).run();
  }

  /** @protected Heading command availability factory. */
  protected _canHeading(
    level: MlvEditorHeadingLevel,
  ): (editor: Editor) => boolean {
    return (editor) => editor.can().chain().toggleHeading({ level }).run();
  }

  /** @protected Runs a selection-restoring command. */
  protected _run(command: (editor: Editor) => boolean): void {
    this._context.run(command);
  }

  /** @protected Registers the portaled panel with the editor composite. */
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

  /** @protected Removes menu panel focus ownership after close. */
  protected _unregisterOverlay(): void {
    this._menuOpen = false;
    this._unregister?.();
    this._unregister = undefined;
  }
}
