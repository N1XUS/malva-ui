import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import type { Signal } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import { LucideCircleStop, LucideSparkles } from '@lucide/angular';
import { MlvButton, MlvButtonIcon } from '@malva-ui/core/button';
import { MlvInput } from '@malva-ui/core/input';
import { MlvListItem } from '@malva-ui/core/list';
import { MlvMenu, MlvMenuItem, MlvMenuTrigger } from '@malva-ui/core/menu';
import {
  MlvPopup,
  MlvPopupContainer,
  MlvPopupContent,
} from '@malva-ui/core/popup';
import { MlvRadio, MlvRadioGroup } from '@malva-ui/core/radio';
import { MlvTooltip } from '@malva-ui/core/tooltip';
import { MLV_EDITOR_I18N } from '@malva-ui/i18n';
import {
  MLV_EDITOR_OVERLAY_REGISTRY,
  MLV_EDITOR_TOOLBAR_CONTEXT,
} from '../editor-toolbar-context';
import type { MlvEditorOverlayRegistry } from '../editor-toolbar-context';
import { MlvEditorToolbarWidget } from '../toolbar/editor-toolbar-widget';
import { mlvEditorAiDefaultActions } from './editor-ai-actions';
import { MLV_EDITOR_AI_CONTEXT } from './editor-ai-context';
import type {
  MlvEditorAiAction,
  MlvEditorAiOutputMode,
} from './editor-ai.types';

/**
 * Toolbar command group for the editor's AI transforms.
 *
 * A sparkles trigger opens a Malva menu with one item per action; an action
 * runs its kind through the context with `output: 'replace-selection'` unless
 * it says otherwise, while the custom-prompt item opens a Malva popup with an
 * instruction field and an output-mode choice (replace selection, insert
 * below, or land as reviewable suggestions). While a transform is running the
 * same trigger becomes a stop affordance that cancels the in-flight request,
 * so the control stays one roving tab stop throughout.
 *
 * The action list is a thin layer over {@link MlvEditorAiContext.runTransform}:
 * the seven built-in kinds are only the default. `actions` replaces them
 * literally with a host-authored list — any kind string, a fixed instruction,
 * a per-action output mode, or an own `run` callback — and
 * `showCustomPrompt="false"` drops the custom-prompt item and its popup.
 *
 * The group hides entirely when the nearest {@link MLV_EDITOR_AI_CONTEXT}
 * resolves no provider (presence), and its actions disable — without hiding —
 * while the editor is readonly or disabled or a transform is already running
 * (executability), matching the toolbar's presence-vs-executability rule.
 */
@Component({
  selector: 'mlv-editor-ai-menu',
  imports: [
    NgTemplateOutlet,
    MlvButton,
    MlvButtonIcon,
    MlvTooltip,
    LucideCircleStop,
    LucideSparkles,
    MlvEditorToolbarWidget,
    MlvInput,
    MlvListItem,
    MlvMenu,
    MlvMenuItem,
    MlvMenuTrigger,
    MlvPopup,
    MlvPopupContainer,
    MlvPopupContent,
    MlvRadio,
    MlvRadioGroup,
  ],
  templateUrl: './editor-ai-menu.html',
  styleUrl: './editor-ai-menu.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-editor-ai-menu',
    '[hidden]': '!_hasProvider()',
  },
})
export class MlvEditorAiMenu {
  /**
   * The menu's action list, replacing the built-in kinds literally — the
   * house rule for list-shaped inputs (`extensions`, the toolbar definitions):
   * a supplied array is never merged with the defaults.
   *
   * Omitted (the default), the menu renders the seven built-in transforms
   * labelled from `MLV_EDITOR_I18N`. To keep them and add to them, spread
   * `mlvEditorAiDefaultActions(copy)` — the very list this component uses.
   * The custom-prompt item is independent of this input; drop it with
   * {@link showCustomPrompt}.
   */
  readonly actions = input<readonly MlvEditorAiAction[] | undefined>(undefined);

  /**
   * Whether the built-in custom-prompt item and its popup exist at all.
   *
   * `false` removes the menu item and never renders the prompt popup, for
   * hosts whose action list already covers everything they want offered.
   */
  readonly showCustomPrompt = input<BooleanInput, boolean | string>(true, {
    transform: coerceBooleanProperty,
  });

  /** @protected AI command state of the nearest editor, if provided. */
  protected readonly _ai = inject(MLV_EDITOR_AI_CONTEXT, { optional: true });

  /** @protected Editor-scoped form state gating executability. */
  protected readonly _context = inject(MLV_EDITOR_TOOLBAR_CONTEXT);

  /** @private Detached panel ownership for composite focus. */
  private readonly _overlays = inject<MlvEditorOverlayRegistry>(
    MLV_EDITOR_OVERLAY_REGISTRY,
  );

  /** @private Document used to resolve the public menu panel id. */
  private readonly _document = inject(DOCUMENT);

  /** @private Cleans an active menu-overlay registration. */
  private readonly _destroyRef = inject(DestroyRef);

  /** @private Optional localized editor copy. */
  private readonly _i18n = inject(MLV_EDITOR_I18N, { optional: true });

  /** @protected Rendered Malva transforms menu. */
  protected readonly _menu = viewChild.required<MlvMenu>('_menu');

  /** @protected Trigger owning the menu overlay. */
  protected readonly _menuTrigger = viewChild.required(MlvMenuTrigger);

  /**
   * @protected Custom-prompt popup opened programmatically. Optional because
   * `showCustomPrompt="false"` removes it from the template entirely.
   */
  protected readonly _popup = viewChild<MlvPopup>('_popup');

  /** @protected Native trigger restored after popup teardown. */
  protected readonly _triggerElement = viewChild.required('_triggerElement', {
    read: ElementRef,
  }) as Signal<ElementRef<HTMLButtonElement>>;

  /** @protected Instruction field focused when the prompt opens. */
  protected readonly _instructionInput =
    viewChild.required<MlvInput>('_instructionInput');

  /** @private Detached prompt panel queried through Angular rather than selectors. */
  private readonly _panel = viewChild<ElementRef<HTMLElement>>('_panel');

  /** @protected Custom-prompt instruction draft, retained across opens. */
  protected readonly _instruction = signal('');

  /** @protected Output mode applied to the custom transform. */
  protected readonly _output =
    signal<MlvEditorAiOutputMode>('replace-selection');

  /** @private Menu-overlay registration teardown. */
  private _unregisterMenu: (() => void) | undefined;

  /** @private Guards queued menu registration after a quick close or destroy. */
  private _menuOpen = false;

  /**
   * @protected Action entries rendered before the custom-prompt item: the
   * host's list when supplied, otherwise the localized built-ins. The factory
   * is the single source of the built-in label table.
   */
  protected readonly _actions = computed<readonly MlvEditorAiAction[]>(
    () => this.actions() ?? mlvEditorAiDefaultActions(this._i18n?.()),
  );

  /** @protected Reactive localized copy for the trigger and prompt. */
  protected readonly _copy = computed(() => {
    const copy = this._i18n?.();
    return {
      aiMenu: copy?.aiMenu ?? 'AI assist',
      aiCustom: copy?.aiCustom ?? 'Custom prompt',
      aiPromptPlaceholder:
        copy?.aiPromptPlaceholder ?? 'Describe what to do...',
      aiOutputMode: copy?.aiOutputMode ?? 'Output',
      aiReplaceSelection: copy?.aiReplaceSelection ?? 'Replace selection',
      aiInsertBelow: copy?.aiInsertBelow ?? 'Insert below',
      aiReviewChanges: copy?.aiReviewChanges ?? 'Review changes',
      aiApply: copy?.aiApply ?? 'Apply',
      aiCancel: copy?.aiCancel ?? 'Cancel',
    };
  });

  /** @protected Whether an AI provider is resolvable; the group hides without one. */
  protected readonly _hasProvider = computed(
    () => this._ai?.hasProvider() ?? false,
  );

  /** @protected Whether a transform is streaming, swapping the trigger to stop. */
  protected readonly _running = computed(
    () => this._ai?.status() === 'running',
  );

  /** @protected Whether readonly/disabled state blocks every AI mutation. */
  protected readonly _disabled = computed(
    () => this._context.disabled() || this._context.readonly(),
  );

  /** @protected Whether menu items cannot currently start a transform. */
  protected readonly _itemsDisabled = computed(
    () => (this._ai?.status() ?? 'idle') !== 'idle' || this._disabled(),
  );

  /** @protected Whether the apply action cannot submit the custom prompt. */
  protected readonly _applyDisabled = computed(
    () => this._itemsDisabled() || this._instruction().trim().length === 0,
  );

  constructor() {
    this._destroyRef.onDestroy(() => this._unregisterMenuOverlay());

    // Readonly and disabled editors refuse AI mutation, so the detached
    // prompt closes rather than lingering over a surface it cannot edit.
    effect(() => {
      const popup = this._popup();
      if (popup && this._disabled() && popup.opened()) {
        popup.opened.set(false);
      }
    });

    // The prompt panel joins the editor composite while rendered so focus
    // inside it never emits a false editor blur. Without the prompt there is
    // no panel to render, so nothing registers.
    effect((onCleanup) => {
      const panel = this._panel()?.nativeElement;
      if (!panel) return;
      const unregister = this._overlays.register(panel, () =>
        this._popup()?.opened.set(false),
      );
      onCleanup(unregister);
    });
  }

  /** @protected Stops the running transform; the menu trigger opens otherwise. */
  protected _onTriggerClick(): void {
    if (this._running()) this._ai?.cancel();
  }

  /**
   * @protected Runs one action: its own `run` callback when it has one,
   * otherwise its kind through the context with the action's instruction and
   * output mode. The executability guard is re-checked here so a host `run`
   * callback cannot fire on a readonly, disabled, or busy editor either.
   */
  protected _runAction(action: MlvEditorAiAction): void {
    const ai = this._ai;
    if (!ai || this._itemsDisabled()) return;
    if (action.run) {
      action.run(ai);
      return;
    }
    void ai.runTransform(action.kind, {
      ...(action.instruction === undefined
        ? {}
        : { instruction: action.instruction }),
      output: action.output ?? 'replace-selection',
    });
  }

  /** @protected Opens the custom-prompt popup from its menu item. */
  protected _openPrompt(): void {
    this._popup()?.opened.set(true);
  }

  /** @protected Closes the custom-prompt popup without running a transform. */
  protected _closePrompt(): void {
    this._popup()?.opened.set(false);
  }

  /** @protected Runs the custom transform with the drafted instruction and mode. */
  protected _apply(): void {
    if (this._applyDisabled()) return;
    const instruction = this._instruction().trim();
    void this._ai?.runTransform('custom', {
      instruction,
      output: this._output(),
    });
    this._popup()?.opened.set(false);
  }

  /** @protected Focuses and selects the instruction draft once the prompt opens. */
  protected _onPromptOpened(): void {
    const popup = this._popup();
    if (!popup) return;
    if (this._disabled()) {
      popup.opened.set(false);
      return;
    }
    queueMicrotask(() => {
      if (!popup.opened()) return;
      this._instructionInput().focus();
      this._instructionInput().select();
    });
  }

  /** @protected Restores the connected toolbar trigger after final teardown. */
  protected _onPromptClosed(): void {
    if (!this._disabled() && this._triggerElement().nativeElement.isConnected) {
      this._triggerElement().nativeElement.focus();
    }
  }

  /** @protected Narrows the radio group's untyped value to an output mode. */
  protected _onOutputChange(value: unknown): void {
    if (
      value === 'replace-selection' ||
      value === 'insert-below' ||
      value === 'review'
    ) {
      this._output.set(value);
    }
  }

  /** @protected Registers the portaled menu panel with the editor composite. */
  protected _registerMenuOverlay(): void {
    this._menuOpen = true;
    queueMicrotask(() => {
      if (!this._menuOpen) return;
      const panel = this._document.getElementById(this._menu().panelId);
      if (!panel) return;
      this._unregisterMenu?.();
      this._unregisterMenu = this._overlays.register(panel, () =>
        this._menuTrigger().close(),
      );
    });
  }

  /** @protected Removes menu panel focus ownership after close. */
  protected _unregisterMenuOverlay(): void {
    this._menuOpen = false;
    this._unregisterMenu?.();
    this._unregisterMenu = undefined;
  }
}
