import type { Signal } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  InjectionToken,
  signal,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import {
  MlvPopup,
  MlvPopupContainer,
  MlvPopupContent,
} from '@malva-ui/core/popup';
import { MLV_EDITOR_I18N } from '@malva-ui/i18n';
import {
  MLV_EDITOR_OVERLAY_REGISTRY,
  MLV_EDITOR_TOOLBAR_CONTEXT,
  mlvEditorFocusContent,
} from '../editor-toolbar-context';
import type { MlvEditorOverlayRegistry } from '../editor-toolbar-context';
import { MLV_EDITOR_AI_CONTEXT } from './editor-ai-context';
import { MlvEditorAiPromptPanel } from './editor-ai-prompt-panel';
import type { MlvEditorAiOutputMode } from './editor-ai.types';

/** @internal One request to open the editor's AI prompt. */
export interface MlvEditorAiPromptRequest {
  /** Viewport rectangle the prompt anchors to (below it, flipping above). */
  readonly anchor: DOMRect;
  /**
   * Output mode the prompt applies; `undefined` shows the output-mode
   * choice. The command menu (phase B) passes `'insert-below'`.
   */
  readonly output?: MlvEditorAiOutputMode;
}

/**
 * @internal The editor's AI prompt seam (#516, B-D18). Internal so C can
 * replace the interim prompt with its prompt bar and change the request
 * freely.
 */
export interface MlvEditorAiPromptHost {
  /** Opens the prompt anchored to `request.anchor`. */
  open(request: MlvEditorAiPromptRequest): void;
  /** Whether the prompt is open. */
  readonly isOpen: Signal<boolean>;
}

/**
 * @internal Opens the editor's AI prompt. Provided by `mlv-editor`; the
 * interim implementation is `mlv-editor-ai-prompt`, rendered in the clean
 * appearance only, so `open` does nothing in `'bar'` / `'floating'`.
 */
export const MLV_EDITOR_AI_PROMPT = new InjectionToken<MlvEditorAiPromptHost>(
  'MLV_EDITOR_AI_PROMPT',
);

/**
 * @internal A stable `MlvEditorAiPromptHost` forwarding to whichever host
 * is rendered now: the token is resolved once, while the prompt component
 * comes and goes with the appearance.
 */
export function mlvEditorAiPromptDelegate(
  host: () => MlvEditorAiPromptHost | undefined,
): MlvEditorAiPromptHost {
  return {
    open: (request) => host()?.open(request),
    isOpen: computed(() => host()?.isOpen() ?? false),
  };
}

/**
 * @internal Interim "Ask AI…" prompt of the clean appearance (#516, D-B3):
 * the AI menu's custom-prompt panel in a modal popup anchored to a viewport
 * rectangle. Apply runs `runTransform('custom', { instruction, output })`;
 * closing returns focus to the content. The panel registers with the editor
 * overlay registry, so focus inside it is not an editor blur and a readonly
 * flip closes it.
 *
 * The anchor is a fixed, zero-interaction element placed at the rectangle,
 * which the popup container uses as its overlay origin.
 */
@Component({
  selector: 'mlv-editor-ai-prompt',
  imports: [
    MlvPopup,
    MlvPopupContainer,
    MlvPopupContent,
    MlvEditorAiPromptPanel,
  ],
  template: `
    <mlv-popup-container
      class="mlv-editor-ai-prompt__anchor"
      [style.left.px]="_rect().left"
      [style.top.px]="_rect().top"
      [style.width.px]="_rect().width"
      [style.height.px]="_rect().height"
    >
      <mlv-popup
        #_popup
        panelRole="dialog"
        [modal]="true"
        [position]="['bottom-start', 'top-start', 'bottom-end', 'top-end']"
        [ariaLabel]="_label()"
        (afterOpened)="_onOpened()"
        (afterClosed)="_onClosed()"
      >
        <ng-template mlvPopupContent>
          <div
            #_panel
            mlvEditorAiPromptPanel
            [(instruction)]="_instruction"
            [(output)]="_output"
            [fixedOutput]="_fixedOutput()"
            [disabled]="_disabled()"
            [applyBlocked]="_applyBlocked()"
            (submitted)="_apply()"
            (dismissed)="_close()"
          ></div>
        </ng-template>
      </mlv-popup>
    </mlv-popup-container>
  `,
  styleUrl: './editor-ai-prompt.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'mlv-editor-ai-prompt' },
})
export class MlvEditorAiPrompt implements MlvEditorAiPromptHost {
  /** @private AI state of the editor. */
  private readonly _ai = inject(MLV_EDITOR_AI_CONTEXT, { optional: true });
  /** @private Editor command state. */
  private readonly _context = inject(MLV_EDITOR_TOOLBAR_CONTEXT);
  /** @private Detached panel ownership for composite focus. */
  private readonly _overlays = inject<MlvEditorOverlayRegistry>(
    MLV_EDITOR_OVERLAY_REGISTRY,
  );
  /** @private Optional localized editor copy. */
  private readonly _i18n = inject(MLV_EDITOR_I18N, { optional: true });

  /** @private The modal popup. */
  private readonly _popup = viewChild.required<MlvPopup>('_popup');
  /** @private The portaled panel, registered while rendered. */
  private readonly _panel = viewChild('_panel', { read: ElementRef }) as Signal<
    ElementRef<HTMLElement> | undefined
  >;
  /** @private The panel component, focused on open. */
  private readonly _promptPanel = viewChild(MlvEditorAiPromptPanel);

  /** @protected Anchor rectangle of the current request. */
  protected readonly _rect = signal({ left: 0, top: 0, width: 0, height: 0 });
  /** @protected Output mode fixed by the current request. */
  protected readonly _fixedOutput = signal<MlvEditorAiOutputMode | undefined>(
    undefined,
  );
  /** @protected Instruction draft, retained across opens like the menu's. */
  protected readonly _instruction = signal('');
  /** @protected Output mode chosen when the request fixes none. */
  protected readonly _output =
    signal<MlvEditorAiOutputMode>('replace-selection');

  /** Whether the prompt is open. */
  readonly isOpen = computed(() => this._popup().opened());

  /** @protected Accessible name of the dialog. */
  protected readonly _label = computed(
    () => this._i18n?.().aiCustom ?? 'Custom prompt',
  );
  /** @protected Whether the editor refuses AI mutation (readonly / disabled). */
  protected readonly _disabled = computed(
    () => this._context.disabled() || this._context.readonly(),
  );
  /** @protected Whether a transform cannot start now. */
  protected readonly _applyBlocked = computed(
    () => !(this._ai?.canStart() ?? false),
  );

  constructor() {
    // A readonly or disabled editor refuses AI mutation: close the prompt.
    effect(() => {
      if (this._disabled() && this._popup().opened()) {
        this._popup().opened.set(false);
      }
    });

    effect((onCleanup) => {
      const panel = this._panel()?.nativeElement;
      if (!panel) return;
      onCleanup(this._overlays.register(panel, () => this._close()));
    });
  }

  /** Opens the prompt anchored to `request.anchor`. */
  open(request: MlvEditorAiPromptRequest): void {
    if (this._disabled()) return;
    const { left, top, width, height } = request.anchor;
    this._rect.set({ left, top, width, height });
    this._fixedOutput.set(request.output);
    this._popup().opened.set(true);
  }

  /** @protected Closes the prompt without running a transform. */
  protected _close(): void {
    this._popup().opened.set(false);
  }

  /** @protected Runs the custom transform with the drafted instruction. */
  protected _apply(): void {
    const instruction = this._instruction().trim();
    if (this._applyBlocked() || !instruction) return;
    void this._ai?.runTransform('custom', {
      instruction,
      output: this._fixedOutput() ?? this._output(),
    });
    this._popup().opened.set(false);
  }

  /** @protected Moves focus into the instruction field once open. */
  protected _onOpened(): void {
    const popup = this._popup();
    queueMicrotask(() => {
      if (popup.opened()) this._promptPanel()?.focusInstruction();
    });
  }

  /** @protected Returns focus to the content after the popup closes. */
  protected _onClosed(): void {
    const editor = this._context.editor();
    if (editor && !this._disabled()) mlvEditorFocusContent(editor);
  }
}
