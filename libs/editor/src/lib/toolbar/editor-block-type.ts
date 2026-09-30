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
import type { ChainedCommands, Editor } from '@tiptap/core';
import { LucideChevronDown } from '@lucide/angular';
import { MlvButton } from '@malva-ui/core/button';
import { MlvListItem } from '@malva-ui/core/list';
import { MlvMenu, MlvMenuItem, MlvMenuTrigger } from '@malva-ui/core/menu';
import type { MlvEditorI18n } from '@malva-ui/i18n';
import { MLV_EDITOR_I18N, MlvI18nResolverService } from '@malva-ui/i18n';
import { MLV_EDITOR_CLEAN_MODE_FALLBACKS } from '../editor-clean-mode-fallbacks';
import {
  MLV_EDITOR_OVERLAY_REGISTRY,
  MLV_EDITOR_TOOLBAR_CONTEXT,
  MLV_EDITOR_TOOLBAR_REVISION,
} from '../editor-toolbar-context';
import type { MlvEditorOverlayRegistry } from '../editor-toolbar-context';
import type { MlvEditorHeadingLevel } from './editor-heading';
import { createMlvEditorMenuRegistration } from './editor-menu-registration';
import { MlvEditorToolbarWidget } from './editor-toolbar-widget';

/**
 * @internal English fallbacks of the optional `MlvEditorI18n` keys this
 * control reads (#516), so a hand-written pack that omits them still names the
 * trigger and the menu.
 */
const OPTIONAL_MESSAGE_FALLBACKS: Required<
  Pick<MlvEditorI18n, 'blockType' | 'turnInto' | 'styleValue'>
> = {
  blockType: MLV_EDITOR_CLEAN_MODE_FALLBACKS.blockType,
  turnInto: MLV_EDITOR_CLEAN_MODE_FALLBACKS.turnInto,
  styleValue: '{label}: {value}',
};

/** @internal Heading levels offered when `levels` is not bound. */
const DEFAULT_BLOCK_TYPE_LEVELS: readonly MlvEditorHeadingLevel[] = [1, 2, 3];

/** @internal Block kinds the control reads and converts between. */
type MlvEditorBlockKind =
  | 'paragraph'
  | 'heading'
  | 'bulletList'
  | 'orderedList'
  | 'taskList'
  | 'blockquote'
  | 'codeBlock';

/** @internal The block at the selection head: its kind and heading level. */
interface MlvEditorBlockTypeState {
  readonly kind: MlvEditorBlockKind;
  readonly level: MlvEditorHeadingLevel | null;
}

/** @internal One "Turn into" item. */
interface MlvEditorBlockTypeItem {
  /** Tracking key and `aria-current` comparison. */
  readonly id: string;
  /** Visible label. */
  readonly label: string;
  /** Kind the item converts to. */
  readonly kind: MlvEditorBlockKind;
  /** Heading level for a heading item, else `null`. */
  readonly level: MlvEditorHeadingLevel | null;
  /** Command the item needs registered. */
  readonly command: string;
  /** Appends the type command to a chain that already ran `clearNodes()`. */
  readonly apply: (chain: ChainedCommands) => ChainedCommands;
}

/** @internal Node names mapped to kinds, innermost wins. */
const NODE_KINDS: Readonly<Record<string, MlvEditorBlockKind>> = {
  codeBlock: 'codeBlock',
  heading: 'heading',
  taskList: 'taskList',
  orderedList: 'orderedList',
  bulletList: 'bulletList',
  blockquote: 'blockquote',
};

/**
 * Block-type dropdown ("Turn into"): the trigger shows the type of the block
 * at the selection head as text, and the menu converts the selected blocks to
 * a paragraph, a heading level, a bullet / ordered / task list, a quote or a
 * code block. Each item renders only while the extension set registers its
 * command.
 *
 * A choice runs `clearNodes()` and the type command in **one transaction**, so
 * one undo step restores the previous blocks, and a list item turned into a
 * heading leaves the list rather than failing on list-item content rules.
 * Choosing the current type does nothing (no toggle-off).
 *
 * The trigger's accessible name is "Block type: <current>", built from the
 * `styleValue` template, so it contains the visible text (WCAG 2.5.3).
 * Usable in `mlv-editor`'s toolbar, its selection bubble and the standalone
 * `mlv-editor-toolbar`. The clean appearance (`toolbarAppearance="clean"`)
 * renders it in its bubble.
 */
@Component({
  selector: 'mlv-editor-block-type',
  imports: [
    MlvButton,
    LucideChevronDown,
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
      variant="transparent"
      mlvDensity="tight"
      [disabled]="_triggerDisabled()"
      [mlvMenuTrigger]="_menu"
      [menuTriggerDisabled]="_triggerDisabled()"
      [attr.aria-label]="_triggerName()"
      (menuOpened)="_registerOverlay()"
      (menuClosed)="_unregisterOverlay()"
    >
      <span class="mlv-editor-block-type__label">{{ _currentLabel() }}</span>
      <svg
        class="mlv-editor-block-type__chevron"
        lucideChevronDown
        [size]="14"
        aria-hidden="true"
      />
    </button>
    <mlv-menu #_menu [label]="_copy().turnInto">
      @for (item of _items(); track item.id) {
        <mlv-list-item
          mlvMenuItem
          [disabled]="_itemDisabled(item)"
          [attr.aria-current]="_isCurrent(item) ? 'true' : null"
          (itemClick)="_choose(item)"
        >
          {{ item.label }}
        </mlv-list-item>
      }
    </mlv-menu>
  `,
  styleUrl: './editor-block-type.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-editor-block-type',
    '[hidden]': '!_supported()',
  },
})
export class MlvEditorBlockType {
  /**
   * Heading levels offered in the menu, in caller order; duplicates and values
   * outside 1–6 are dropped, and so is a level the heading extension does not
   * configure. The paragraph and the other types are always offered while
   * their commands are registered. The trigger still reports a heading of a
   * level the menu omits.
   */
  readonly levels = input<readonly MlvEditorHeadingLevel[]>(
    DEFAULT_BLOCK_TYPE_LEVELS,
  );

  /** @protected Editor command state. */
  protected readonly _context = inject(MLV_EDITOR_TOOLBAR_CONTEXT);

  /** @private Per-editor state invalidation signal. */
  private readonly _revision = inject(MLV_EDITOR_TOOLBAR_REVISION);

  /** @private Optional localized editor copy. */
  private readonly _i18n = inject(MLV_EDITOR_I18N, { optional: true });

  /** @private Compiles the `styleValue` ICU template in the active locale. */
  private readonly _resolver = inject(MlvI18nResolverService);

  /** @private Registers the open menu panel with the editor composite. */
  private readonly _registration = createMlvEditorMenuRegistration(
    inject<MlvEditorOverlayRegistry>(MLV_EDITOR_OVERLAY_REGISTRY),
    inject(DOCUMENT),
  );

  /** @protected Rendered "Turn into" menu. */
  protected readonly _menu = viewChild.required<MlvMenu>('_menu');

  /** @protected Trigger owning the menu overlay. */
  protected readonly _trigger = viewChild.required(MlvMenuTrigger);

  /** @protected Localized labels, with the optional keys' English fallbacks. */
  protected readonly _copy = computed(() => {
    const copy = this._i18n?.();
    return {
      blockType: copy?.blockType ?? OPTIONAL_MESSAGE_FALLBACKS.blockType,
      turnInto: copy?.turnInto ?? OPTIONAL_MESSAGE_FALLBACKS.turnInto,
      styleValue: copy?.styleValue ?? OPTIONAL_MESSAGE_FALLBACKS.styleValue,
      paragraph: copy?.paragraph ?? 'Paragraph',
      headingLevel: copy?.headingLevel ?? 'Heading level',
      bulletList: copy?.bulletList ?? 'Bullet list',
      orderedList: copy?.orderedList ?? 'Ordered list',
      taskList: copy?.taskList ?? 'Task list',
      blockquote: copy?.blockquote ?? 'Blockquote',
      codeBlock: copy?.codeBlock ?? 'Code block',
    };
  });

  /**
   * @protected Menu items whose command is registered: paragraph, the
   * configured heading levels, the three lists, quote and code block.
   */
  protected readonly _items = computed<readonly MlvEditorBlockTypeItem[]>(
    () => {
      this._revision();
      const editor = this._context.editor();
      if (!editor) return [];
      const copy = this._copy();
      const items: MlvEditorBlockTypeItem[] = [
        {
          id: 'paragraph',
          label: copy.paragraph,
          kind: 'paragraph',
          level: null,
          command: 'setParagraph',
          // `clearNodes` already turns every textblock into the default
          // paragraph; a trailing `setParagraph` would find nothing to change
          // and fail the whole chain.
          apply: (chain) => chain,
        },
        ...this._headingLevels(editor).map(
          (level): MlvEditorBlockTypeItem => ({
            id: `heading-${level}`,
            label: `${copy.headingLevel} ${level}`,
            kind: 'heading',
            level,
            command: 'setHeading',
            apply: (chain) => chain.setHeading({ level }),
          }),
        ),
        {
          id: 'bulletList',
          label: copy.bulletList,
          kind: 'bulletList',
          level: null,
          command: 'toggleBulletList',
          apply: (chain) => chain.toggleBulletList(),
        },
        {
          id: 'orderedList',
          label: copy.orderedList,
          kind: 'orderedList',
          level: null,
          command: 'toggleOrderedList',
          apply: (chain) => chain.toggleOrderedList(),
        },
        {
          id: 'taskList',
          label: copy.taskList,
          kind: 'taskList',
          level: null,
          command: 'toggleTaskList',
          apply: (chain) => chain.toggleTaskList(),
        },
        {
          id: 'blockquote',
          label: copy.blockquote,
          kind: 'blockquote',
          level: null,
          command: 'toggleBlockquote',
          apply: (chain) => chain.toggleBlockquote(),
        },
        {
          id: 'codeBlock',
          label: copy.codeBlock,
          kind: 'codeBlock',
          level: null,
          command: 'setCodeBlock',
          apply: (chain) => chain.setCodeBlock(),
        },
      ];
      const commands = editor.commands as unknown as Record<string, unknown>;
      return items.filter(
        (item) =>
          typeof commands[item.command] === 'function' &&
          typeof commands['clearNodes'] === 'function',
      );
    },
  );

  /** @protected The block at the selection head, innermost type first. */
  protected readonly _current = computed<MlvEditorBlockTypeState>(() => {
    this._revision();
    const editor = this._context.editor();
    if (!editor) return { kind: 'paragraph', level: null };
    const { $head } = editor.state.selection;
    for (let depth = $head.depth; depth >= 0; depth -= 1) {
      const node = $head.node(depth);
      const kind = NODE_KINDS[node.type.name];
      if (!kind) continue;
      const level = kind === 'heading' ? Number(node.attrs['level']) : null;
      return {
        kind,
        level:
          level !== null && level >= 1 && level <= 6
            ? (level as MlvEditorHeadingLevel)
            : null,
      };
    }
    return { kind: 'paragraph', level: null };
  });

  /** @protected Visible trigger text: the current type's label. */
  protected readonly _currentLabel = computed(() => {
    const { kind, level } = this._current();
    const copy = this._copy();
    return kind === 'heading'
      ? `${copy.headingLevel} ${level ?? ''}`.trim()
      : copy[kind];
  });

  /** @protected Trigger name, e.g. "Block type: Heading level 2". */
  protected readonly _triggerName = computed(() =>
    this._resolver.resolve(
      { styleValue: this._copy().styleValue },
      'styleValue',
      {
        label: this._copy().blockType,
        value: this._currentLabel(),
      },
    ),
  );

  /** @protected Whether any conversion command is registered. */
  protected readonly _supported = computed(() => this._items().length > 0);

  /** @protected Whether the trigger cannot open the menu. */
  protected readonly _triggerDisabled = computed(
    () =>
      !this._supported() ||
      this._context.disabled() ||
      this._context.readonly(),
  );

  constructor() {
    inject(DestroyRef).onDestroy(() => this._registration.releaseAll());
  }

  /** @protected Whether an item describes the block at the selection head. */
  protected _isCurrent(item: MlvEditorBlockTypeItem): boolean {
    const current = this._current();
    return current.kind === item.kind && current.level === item.level;
  }

  /**
   * @protected Whether one conversion is blocked. The current type is never
   * disabled: choosing it is the documented no-op.
   */
  protected _itemDisabled(item: MlvEditorBlockTypeItem): boolean {
    this._revision();
    if (this._triggerDisabled()) return true;
    if (this._isCurrent(item)) return false;
    try {
      return !this._context.can((editor) =>
        item.apply(editor.can().chain().clearNodes()).run(),
      );
    } catch {
      return true;
    }
  }

  /** @protected Converts the selected blocks in one transaction. */
  protected _choose(item: MlvEditorBlockTypeItem): void {
    if (this._itemDisabled(item) || this._isCurrent(item)) return;
    this._context.run((editor) =>
      item.apply(editor.chain().focus().clearNodes()).run(),
    );
  }

  /** @protected Registers the portaled panel with the editor composite. */
  protected _registerOverlay(): void {
    this._registration.opened(this._menu(), () => this._trigger().close());
  }

  /** @protected Releases panel ownership after close. */
  protected _unregisterOverlay(): void {
    this._registration.closed(this._menu());
  }

  /** @private Requested levels the heading extension configures. */
  private _headingLevels(editor: Editor): readonly MlvEditorHeadingLevel[] {
    if (typeof editor.commands.setHeading !== 'function') return [];
    const requested: MlvEditorHeadingLevel[] = [];
    for (const candidate of this.levels() as readonly unknown[]) {
      if (
        typeof candidate === 'number' &&
        Number.isInteger(candidate) &&
        candidate >= 1 &&
        candidate <= 6 &&
        !requested.includes(candidate as MlvEditorHeadingLevel)
      ) {
        requested.push(candidate as MlvEditorHeadingLevel);
      }
    }
    const heading = editor.extensionManager.extensions.find(
      (extension) => extension.name === 'heading',
    );
    const configured = (heading?.options as { levels?: unknown } | undefined)
      ?.levels;
    return Array.isArray(configured)
      ? requested.filter((level) => configured.includes(level))
      : requested;
  }
}
