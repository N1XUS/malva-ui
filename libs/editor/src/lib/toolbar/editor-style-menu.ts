import { DOCUMENT } from '@angular/common';
import {
  computed,
  DestroyRef,
  Directive,
  inject,
  type Signal,
  viewChild,
} from '@angular/core';
import type { Editor } from '@tiptap/core';
import type { MlvMenu } from '@malva-ui/core/menu';
import { MLV_EDITOR_I18N, MlvI18nResolverService } from '@malva-ui/i18n';
import {
  MLV_EDITOR_OVERLAY_REGISTRY,
  MLV_EDITOR_TOOLBAR_CONTEXT,
  MLV_EDITOR_TOOLBAR_REVISION,
} from '../editor-toolbar-context';
import { createMlvEditorMenuRegistration } from './editor-menu-registration';
import { MlvEditorToolbarRoot } from './editor-toolbar-root';

/** @internal One item of a text-style menu. */
export interface MlvEditorStyleMenuOption {
  /**
   * Stored value, compared verbatim with what the spec's `read()` returns;
   * `read()` maps an equivalent stored value (a re-quoted font stack) onto it.
   */
  readonly value: string;
  /** Menu label, and the text a text trigger shows for this value. */
  readonly label: string;
  /** Family the label renders in, or `null` to inherit. */
  readonly fontFamily: string | null;
}

/** @internal What distinguishes one text-style menu from another. */
export interface MlvEditorStyleMenuSpec {
  /** Menu label, also the first half of the trigger name. */
  readonly label: Signal<string>;
  /** Options after "Default", in menu order. */
  readonly options: Signal<readonly MlvEditorStyleMenuOption[]>;
  /** Commands whose presence makes the control available. */
  readonly commands: readonly string[];
  /** The explicit value at the selection start, `null` for none. */
  read(editor: Editor): string | null;
  /** Text shown for a value outside the options. */
  display(value: string): string;
  /** Applies one value, restoring focus to the content. */
  readonly apply: (value: string) => (editor: Editor) => boolean;
  /** Non-mutating check for {@link apply}. */
  readonly canApply: (value: string) => (editor: Editor) => boolean;
  /** Removes the explicit value, restoring focus to the content. */
  readonly unset: (editor: Editor) => boolean;
  /** Non-mutating check for {@link unset}. */
  readonly canUnset: (editor: Editor) => boolean;
}

/** @internal English fallback of the `styleValue` trigger-name template. */
const STYLE_VALUE_FALLBACK = '{label}: {value}';

/**
 * @internal State and commands of one text-style menu: the current value read
 * at the selection start, the trigger's accessible name built from the
 * `styleValue` template ("Font size: 16") and command gating. Shared by the
 * toolbar controls and the narrow-mode overflow submenus, so both read and
 * write the same way. Create with {@link createMlvEditorStyleMenuModel}.
 */
export class MlvEditorStyleMenuModel {
  /** Menu label. */
  readonly label: Signal<string>;
  /** Options after "Default". */
  readonly options: Signal<readonly MlvEditorStyleMenuOption[]>;
  /** Localized label of the "Default" item and state. */
  readonly defaultLabel: Signal<string>;
  /** Applies one value. */
  readonly apply: (value: string) => (editor: Editor) => boolean;
  /** Non-mutating check for {@link apply}. */
  readonly canApply: (value: string) => (editor: Editor) => boolean;
  /** Removes the explicit value. */
  readonly unset: (editor: Editor) => boolean;
  /** Non-mutating check for {@link unset}. */
  readonly canUnset: (editor: Editor) => boolean;

  /** @private Editor command state. */
  private readonly _context = inject(MLV_EDITOR_TOOLBAR_CONTEXT);
  /** @private Per-editor state invalidation signal. */
  private readonly _revision = inject(MLV_EDITOR_TOOLBAR_REVISION, {
    optional: true,
  });
  /** @private Optional localized editor copy. */
  private readonly _i18n = inject(MLV_EDITOR_I18N, { optional: true });
  /** @private Compiles the `styleValue` ICU template in the active locale. */
  private readonly _resolver = inject(MlvI18nResolverService);
  /** @private The menu's options, reader and commands. */
  private readonly _spec: MlvEditorStyleMenuSpec;

  /**
   * Must run in an injection context.
   *
   * @param spec The menu's options, reader and commands.
   */
  constructor(spec: MlvEditorStyleMenuSpec) {
    this._spec = spec;
    this.label = spec.label;
    this.options = spec.options;
    this.apply = spec.apply;
    this.canApply = spec.canApply;
    this.unset = spec.unset;
    this.canUnset = spec.canUnset;
    this.defaultLabel = computed(
      () => this._i18n?.().defaultStyle ?? 'Default',
    );
  }

  /** Current explicit value, re-read after every transaction. */
  current(): string | null {
    this._revision?.();
    const editor = this._context.editor();
    if (!editor) return null;
    const value = this._spec.read(editor);
    return typeof value === 'string' && value.length > 0 ? value : null;
  }

  /** Text for the current state: the option label, else "Default". */
  valueText(): string {
    const current = this.current();
    if (current === null) return this.defaultLabel();
    return (
      this.options().find((option) => option.value === current)?.label ??
      this._spec.display(current)
    );
  }

  /** Trigger name carrying the current value, e.g. "Font size: 16". */
  triggerName(): string {
    return this._resolver.resolve(
      { styleValue: this._i18n?.().styleValue ?? STYLE_VALUE_FALLBACK },
      'styleValue',
      { label: this.label(), value: this.valueText() },
    );
  }

  /** Whether the extension set registers every command. */
  supported(): boolean {
    this._revision?.();
    const commands = this._context.editor()?.commands as
      | Record<string, unknown>
      | undefined;
    return (
      !!commands &&
      this._spec.commands.every((name) => typeof commands[name] === 'function')
    );
  }

  /** Whether the trigger cannot open. */
  triggerDisabled(): boolean {
    return (
      !this.supported() || this._context.disabled() || this._context.readonly()
    );
  }

  /** Whether one menu action currently cannot mutate the editor. */
  disabled(command: (editor: Editor) => boolean): boolean {
    this._revision?.();
    if (this.triggerDisabled()) return true;
    try {
      return !this._context.can(command);
    } catch {
      return true;
    }
  }

  /** Runs a selection-restoring command. */
  run(command: (editor: Editor) => boolean): void {
    this._context.run(command);
  }
}

/**
 * @internal Creates a {@link MlvEditorStyleMenuModel}; call in an injection
 * context.
 *
 * @param spec The menu's options, reader and commands.
 */
export function createMlvEditorStyleMenuModel(
  spec: MlvEditorStyleMenuSpec,
): MlvEditorStyleMenuModel {
  return new MlvEditorStyleMenuModel(spec);
}

/**
 * @internal Trigger of the font-family and font-size menus: it shows the
 * current value as text, so the name ("Font size: 16") contains the visible
 * label (WCAG 2.5.3). The tooltip repeats the name, so it adds no description.
 */
export const MLV_EDITOR_STYLE_TEXT_TRIGGER_TEMPLATE = `
  <button
    mlvButton
    mlvEditorToolbarWidget
    type="button"
    variant="transparent"
    mlvDensity="tight"
    class="mlv-editor-style-menu__trigger"
    [disabled]="_model.triggerDisabled()"
    [mlvMenuTrigger]="_menu"
    [menuTriggerDisabled]="_model.triggerDisabled()"
    [attr.aria-label]="_model.triggerName()"
    [mlvTooltip]="_model.triggerName()"
    (menuOpened)="_registerOverlay()"
    (menuClosed)="_unregisterOverlay()"
  >
    <span class="mlv-editor-style-menu__value">{{ _model.valueText() }}</span>
    <svg
      class="mlv-editor-style-menu__chevron"
      lucideChevronDown
      [size]="14"
      aria-hidden="true"
    />
  </button>
`;

/**
 * @internal Menu of one text-style model: "Default" first (it unsets the
 * value), then the options, the current one marked `aria-current`. An item's
 * label renders in the option's own family where it has one.
 *
 * @param menuRef Template reference name of the `mlv-menu`.
 * @param model Template expression of the {@link MlvEditorStyleMenuModel}.
 */
export function mlvEditorStyleMenuTemplate(
  menuRef: string,
  model: string,
): string {
  return `
  <mlv-menu #${menuRef} [label]="${model}.label()">
    <mlv-list-item
      mlvMenuItem
      [disabled]="${model}.disabled(${model}.canUnset)"
      [attr.aria-current]="${model}.current() === null ? 'true' : null"
      (itemClick)="${model}.run(${model}.unset)"
      >{{ ${model}.defaultLabel() }}</mlv-list-item
    >
    @for (option of ${model}.options(); track option.value) {
      <mlv-list-item
        mlvMenuItem
        [disabled]="${model}.disabled(${model}.canApply(option.value))"
        [attr.aria-current]="${model}.current() === option.value ? 'true' : null"
        (itemClick)="${model}.run(${model}.apply(option.value))"
        ><span
          class="mlv-editor-style-menu__option"
          [style.font-family]="option.fontFamily"
          >{{ option.label }}</span
        ></mlv-list-item
      >
    }
  </mlv-menu>
`;
}

/** @internal Menu of a toolbar control: `#_menu` over its `_model`. */
export const MLV_EDITOR_STYLE_MENU_TEMPLATE = mlvEditorStyleMenuTemplate(
  '_menu',
  '_model',
);

/**
 * @internal Base of the font-family, font-size and line-height toolbar
 * controls: a {@link MlvEditorStyleMenuModel} from the subclass's spec, and
 * the portaled panel's overlay registration.
 */
@Directive()
export abstract class MlvEditorStyleMenuBase {
  /** @protected State and commands of this menu. */
  protected abstract readonly _model: MlvEditorStyleMenuModel;
  /** @private Registers the open panel with the editor composite. */
  private readonly _registration = createMlvEditorMenuRegistration(
    inject(MLV_EDITOR_OVERLAY_REGISTRY),
    inject(DOCUMENT),
  );
  /** @protected Rendered menu. */
  protected readonly _menu = viewChild.required<MlvMenu>('_menu');
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
    () => !this._model.supported() || (this._root?.narrow() ?? false),
  );

  constructor() {
    inject(DestroyRef).onDestroy(() => this._registration.releaseAll());
  }

  /** @protected Registers the portaled panel with the editor composite. */
  protected _registerOverlay(): void {
    const menu = this._menu();
    this._registration.opened(menu, () => menu.close());
  }

  /** @protected Releases the panel registration after close. */
  protected _unregisterOverlay(): void {
    this._registration.closed(this._menu());
  }
}
