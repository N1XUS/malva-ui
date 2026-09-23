import { LiveAnnouncer } from '@angular/cdk/a11y';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import { isPlatformBrowser, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  DestroyRef,
  ElementRef,
  effect,
  forwardRef,
  inject,
  Injector,
  input,
  model,
  output,
  PLATFORM_ID,
  signal,
  untracked,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import type { AfterViewInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { fromEvent } from 'rxjs';
import type { Content, Extensions, SetContentOptions } from '@tiptap/core';
import type { Mark } from '@tiptap/pm/model';
import { Editor } from '@tiptap/core';
import type {} from '@tiptap/markdown';
import { MlvFade, MlvSpacer } from '@malva-ui/cdk/utils';
import type { MlvFormControl } from '@malva-ui/core/form-utils';
import {
  MlvFormControlWrapper,
  MlvFormControlWrapperControl,
  MlvHint,
  MlvLabel,
  MlvMessage,
  MlvSignalFormControlBase,
  MLV_FORM_CONTROL,
} from '@malva-ui/core/form-utils';
import { MlvToolbar } from '@malva-ui/core/toolbar';
import { MlvDivider } from '@malva-ui/core/divider';
import { MLV_EDITOR_I18N } from '@malva-ui/i18n';
import {
  MLV_EDITOR_OVERLAY_REGISTRY,
  MLV_EDITOR_TOOLBAR_CONTEXT,
  MLV_EDITOR_TOOLBAR_ROVING,
  MLV_EDITOR_TOOLBAR_REVISION,
  MLV_EDITOR_UPLOAD_ABORT_REGISTRY,
  MlvEditorOverlayRegistry,
  MlvEditorToolbarRevision,
  MlvEditorToolbarRovingRegistry,
  MlvEditorUploadAbortRegistry,
  type MlvEditorToolbarContext,
} from '../editor-toolbar-context';
import {
  MLV_EDITOR_DEFAULT_IMAGE_UPLOAD_OPTIONS,
  MLV_EDITOR_IMAGE_UPLOADER,
} from '../editor.tokens';
import {
  MLV_EDITOR_AI_CONTEXT,
  MLV_EDITOR_AI_INPUT_PROVIDER,
  MlvEditorAiContext,
} from '../ai/editor-ai-context';
import type { MlvEditorAiProvider } from '../ai/editor-ai.types';
import {
  editorValuesAreEquivalent,
  normalizeEditorValue,
  parseEditorJsonDocument,
  serializeEditorValue,
} from '../editor-serialization';
import { preflightMlvEditorExtensions } from '../editor-extension-preflight';
import type {
  MlvEditorContentWidth,
  MlvEditorError,
  MlvEditorFocusEvent,
  MlvEditorFormat,
  MlvEditorImageUploadCancelled,
  MlvEditorImageUploadFailure,
  MlvEditorImageUploadControl,
  MlvEditorImageUploadOptions,
  MlvEditorImageUploadSuccess,
  MlvEditorImageUploader,
  MlvEditorSelectionChange,
  MlvEditorToolbarAppearance,
  MlvEditorToolbarPosition,
  MlvEditorTransactionEvent,
} from '../editor.types';
import {
  createMlvEditorLiveScrollSides,
  mlvEditorCssLength,
} from './editor-layout';
import type { MlvEditorBlockMove } from '../extensions/editor-block-handle';
import { mlvEditorDefaultExtensions } from '../extensions/editor-extensions';
import {
  createMlvEditorImageUploadCoordinator,
  MLV_EDITOR_IMAGE_UPLOAD_COORDINATOR,
} from '../upload/editor-image-upload-coordinator';
import { MlvEditorAlignment } from '../toolbar/editor-alignment';
import { MlvEditorBlockInsert } from '../toolbar/editor-block-insert';
import { MlvEditorHeading } from '../toolbar/editor-heading';
import { MlvEditorHighlight } from '../toolbar/editor-highlight';
import { MlvEditorInlineMarks } from '../toolbar/editor-inline-marks';
import { MlvEditorList } from '../toolbar/editor-list';
import { MlvEditorLink } from '../toolbar/editor-link';
import {
  MlvEditorImageUpload,
  MlvEditorImageUploadStatus,
} from '../toolbar/editor-image-upload';
import { MlvEditorTable } from '../toolbar/editor-table';
import { MlvEditorTableControls } from '../table/editor-table-controls';
import {
  MlvEditorToolbarDef,
  MlvEditorToolbarEndDef,
  MlvEditorToolbarStartDef,
} from '../toolbar/editor-toolbar.defs';
import {
  MlvEditorToolbarOverflow,
  MlvEditorToolbarRoot,
} from '../toolbar/editor-toolbar';
import { MlvEditorUndoRedo } from '../toolbar/editor-undo-redo';
import { MlvEditorZoom } from '../toolbar/editor-zoom';
import { MlvEditorTextColor } from '../toolbar/editor-text-color';
import { MlvEditorStatus } from '../status/editor-status';

/** @internal Tiptap content and options prepared from one external value. */
type MlvEditorPreparedContent =
  | {
      readonly ok: true;
      readonly content: Content;
      readonly options: SetContentOptions;
    }
  | { readonly ok: false; readonly cause: unknown };

/**
 * Browser-only Tiptap form control with nullable HTML, Markdown, or JSON
 * values.
 *
 * The component is a pure Angular `FormValueControl`; it deliberately does
 * not implement a `ControlValueAccessor` or provide `NG_VALUE_ACCESSOR`.
 */
@Component({
  selector: 'mlv-editor',
  imports: [
    MlvFormControlWrapper,
    MlvFormControlWrapperControl,
    MlvHint,
    MlvLabel,
    MlvMessage,
    NgTemplateOutlet,
    MlvFade,
    MlvToolbar,
    MlvDivider,
    MlvEditorToolbarRoot,
    MlvEditorToolbarOverflow,
    MlvEditorUndoRedo,
    MlvEditorZoom,
    MlvEditorHeading,
    MlvEditorList,
    MlvEditorInlineMarks,
    MlvEditorTextColor,
    MlvEditorStatus,
    MlvEditorHighlight,
    MlvEditorLink,
    MlvEditorImageUpload,
    MlvEditorImageUploadStatus,
    MlvEditorTable,
    MlvEditorTableControls,
    MlvEditorAlignment,
    MlvEditorBlockInsert,
    MlvSpacer,
  ],
  templateUrl: './editor.html',
  styleUrl: './editor.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    MlvEditorOverlayRegistry,
    MlvEditorToolbarRevision,
    MlvEditorToolbarRovingRegistry,
    MlvEditorUploadAbortRegistry,
    {
      provide: MLV_FORM_CONTROL,
      useExisting: forwardRef(() => MlvEditor),
    },
    {
      provide: MLV_EDITOR_TOOLBAR_CONTEXT,
      useExisting: forwardRef(() => MlvEditor),
    },
    {
      provide: MLV_EDITOR_TOOLBAR_REVISION,
      useFactory: (state: MlvEditorToolbarRevision) => state.revision,
      deps: [MlvEditorToolbarRevision],
    },
    {
      provide: MLV_EDITOR_TOOLBAR_ROVING,
      useExisting: MlvEditorToolbarRovingRegistry,
    },
    {
      provide: MLV_EDITOR_OVERLAY_REGISTRY,
      useExisting: MlvEditorOverlayRegistry,
    },
    {
      provide: MLV_EDITOR_UPLOAD_ABORT_REGISTRY,
      useExisting: MlvEditorUploadAbortRegistry,
    },
    MlvEditorAiContext,
    {
      provide: MLV_EDITOR_AI_CONTEXT,
      useExisting: MlvEditorAiContext,
    },
    {
      provide: MLV_EDITOR_AI_INPUT_PROVIDER,
      useFactory: () => {
        const owner = inject(
          forwardRef(() => MlvEditor),
        ) as unknown as MlvEditor;
        return owner.aiProvider;
      },
    },
    {
      provide: MLV_EDITOR_IMAGE_UPLOAD_COORDINATOR,
      useFactory: () => {
        const owner = inject(
          forwardRef(() => MlvEditor),
        ) as unknown as MlvEditor;
        return createMlvEditorImageUploadCoordinator(
          {
            editor: owner.editor,
            imageUploader: owner.imageUploader,
            imageUploadOptions: owner.imageUploadOptions,
            disabled: () => owner.computedDisabled(),
            readonly: () => owner.readonly(),
            emitSuccess: (event) => owner.imageUploadSuccess.emit(event),
            emitFailure: (event) => owner.imageUploadFailure.emit(event),
            emitCancelled: (event) => owner.imageUploadCancelled.emit(event),
            emitError: (error) => owner.editorError.emit(error),
          },
          inject(MLV_EDITOR_IMAGE_UPLOADER, { optional: true }) ?? undefined,
          inject(MLV_EDITOR_UPLOAD_ABORT_REGISTRY),
        );
      },
    },
  ],
  host: {
    class: 'mlv-editor',
    '[class]': '"mlv-editor--content-width-" + contentWidth()',
    '[class.mlv-editor--disabled]': 'computedDisabled()',
    '[class.mlv-editor--readonly]': 'readonly()',
    '[class.mlv-editor--focused]': 'focused()',
    '[class.mlv-editor--capped]': '_capped()',
    '[class.mlv-editor--toolbar-top]': 'toolbarPosition() === "top"',
    '[class.mlv-editor--toolbar-bottom]': 'toolbarPosition() === "bottom"',
    '[class.mlv-editor--toolbar-bar]': 'toolbarAppearance() === "bar"',
    '[class.mlv-editor--toolbar-floating]':
      'toolbarAppearance() === "floating"',
    '[class.mlv-editor--toolbar-sticky]': 'toolbarSticky()',
    '[attr.aria-disabled]': 'computedDisabled() || null',
    '[attr.inert]': 'computedDisabled() ? "" : null',
    '[style.--mlv-editor-zoom]': 'zoom() / 100',
    '[style.--mlv-editor-height]': '_heightStyle()',
    '[style.--mlv-editor-min-height]': '_minHeightStyle()',
    '[style.--mlv-editor-max-height]': '_maxHeightStyle()',
  },
})
export class MlvEditor
  extends MlvSignalFormControlBase<string | null>
  implements MlvFormControl, AfterViewInit, MlvEditorToolbarContext
{
  /** @private Tiptap instance owned exclusively by this component. */
  private readonly _editor = signal<Editor | null>(null);

  /** Nullable editor model used by direct, reactive, template, and signal forms. */
  readonly value = model<string | null>(null);

  /** Serialization format for the visual editor. */
  readonly format = input<MlvEditorFormat>('html');

  /** Width of the centred content column; a gutter is reserved at every value. */
  readonly contentWidth = input<MlvEditorContentWidth>('default');

  /**
   * Fixed block size of the editor surface (toolbar plus content viewport).
   * A number is px; a string is any CSS length, passed through verbatim.
   *
   * Setting it **caps** the editor: `.mlv-editor__viewport` becomes the only
   * scroll container. With neither `height` nor `maxHeight`, the editor grows
   * with its content, never shows a scrollbar, and never stops a scroll meant
   * for the page. Writing `--mlv-editor-height` in CSS alone does not cap.
   */
  readonly height = input<number | string | undefined>(undefined);

  /**
   * Minimum block size of the editable content area; the viewport adds its
   * 1rem padding around it. A number is px; a string is any CSS length. `undefined` keeps the `8rem` floor. Setting only this input
   * leaves the editor in auto mode. `--mlv-editor-min-height` may also be set
   * in CSS.
   *
   * Under a cap (`height` / `maxHeight`) the cap wins, even over a larger
   * `minHeight`: the viewport shrinks to fit the surface, and the floor moves
   * to the content inside the scroller, at every zoom level. A `minHeight`
   * above what the cap leaves the content (the cap minus the toolbar band and
   * the viewport padding) scrolls an empty document; for a fixed size set
   * `height` rather than `minHeight` equal to `maxHeight`.
   */
  readonly minHeight = input<number | string | undefined>(undefined);

  /**
   * Largest block size of the editor surface. The surface grows with its
   * content up to this cap, and then the viewport scrolls. A number is px; a
   * string is any CSS length. Like `height`, this caps the editor; writing
   * `--mlv-editor-max-height` in CSS alone does not.
   */
  readonly maxHeight = input<number | string | undefined>(undefined);

  /**
   * Toolbar placement. The DOM order follows it, so the Tab order matches the
   * visual order (WCAG 2.4.3). Changing it re-creates the toolbar view, which
   * closes any open toolbar popup.
   */
  readonly toolbarPosition = input<MlvEditorToolbarPosition>('top');

  /**
   * Toolbar drawing: `'bar'` is the docked row with a hairline; `'floating'` is
   * a centred pill overlapping the content edge by
   * `--mlv-editor-toolbar-block-size` plus a gap.
   */
  readonly toolbarAppearance = input<MlvEditorToolbarAppearance>('bar');

  /**
   * Keeps the toolbar `position: sticky` against the nearest scroll container
   * while the surface is on screen, offset by
   * `--mlv-editor-toolbar-sticky-offset` (default `0`). When capped, the
   * toolbar already sits outside the scrolling viewport, so this only affects
   * page scroll, within the surface's box.
   */
  readonly toolbarSticky = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /** Complete Tiptap extension replacement; omit it for Malva's fresh preset. */
  readonly extensions = input<Extensions | undefined>(undefined);

  /** Placeholder displayed by the default extension preset. */
  readonly placeholder = input('Write something…');

  /** Maximum character count for Malva's default extension preset. */
  readonly characterLimit = input<number | null>(null);

  /** IDREF(s) naming the editable content region. */
  readonly ariaLabelledBy = input<string | undefined>(undefined);

  /** IDREF(s) describing the editable content region. */
  readonly ariaDescribedBy = input<string | undefined>(undefined);

  /** Per-editor image upload adapter, taking precedence over an injected adapter. */
  readonly imageUploader = input<MlvEditorImageUploader | undefined>(undefined);

  /** Image upload restrictions used by the later upload controls. */
  readonly imageUploadOptions = input<MlvEditorImageUploadOptions>(
    MLV_EDITOR_DEFAULT_IMAGE_UPLOAD_OPTIONS,
  );

  /**
   * Per-editor AI transport, taking precedence over an injected
   * `MLV_EDITOR_AI_PROVIDER`. Without either, AI UI modules hide and AI
   * commands report a recoverable `configuration` error.
   */
  readonly aiProvider = input<MlvEditorAiProvider | undefined>(undefined);

  /** Read-only signal exposing the one Tiptap editor instance after browser mount. */
  readonly editor = this._editor.asReadonly();

  /** Exact editor-owned image upload capability forwarded to public toolbars. */
  get imageUpload(): MlvEditorImageUploadControl {
    return this._injector.get(MLV_EDITOR_IMAGE_UPLOAD_COORDINATOR);
  }

  /** View-only zoom percentage shared with the nearest toolbar. */
  readonly zoom = signal(100);

  /** @protected Resolved `height`, written into `--mlv-editor-height`; `null` writes nothing. */
  protected readonly _heightStyle = computed(() =>
    mlvEditorCssLength(this.height()),
  );

  /** @protected Resolved `minHeight`, written into `--mlv-editor-min-height`; `null` writes nothing. */
  protected readonly _minHeightStyle = computed(() =>
    mlvEditorCssLength(this.minHeight()),
  );

  /** @protected Resolved `maxHeight`, written into `--mlv-editor-max-height`; `null` writes nothing. */
  protected readonly _maxHeightStyle = computed(() =>
    mlvEditorCssLength(this.maxHeight()),
  );

  /**
   * @protected Whether the editor is capped. Only `height` or `maxHeight`
   * switches it on; `minHeight` alone stays in auto mode. It is the one input
   * that turns `.mlv-editor__viewport` into a scroll container.
   */
  protected readonly _capped = computed(
    () => this._heightStyle() !== null || this._maxHeightStyle() !== null,
  );

  /** Whether the mounted editor currently accepts document mutations. */
  readonly editable = computed(
    () =>
      this._editor() !== null && !this.computedDisabled() && !this.readonly(),
  );

  /** Emits after the browser-only Tiptap editor has been created. */
  readonly editorReady = output<Editor>();

  /** Emits when focus enters the editable Tiptap content. */
  // The public API deliberately mirrors the documented editor focus event.
  // eslint-disable-next-line @angular-eslint/no-output-native
  readonly focus = output<MlvEditorFocusEvent>();

  /** Emits when focus leaves the editor composite. */
  // The public API deliberately mirrors the documented editor blur event.
  // eslint-disable-next-line @angular-eslint/no-output-native
  readonly blur = output<MlvEditorFocusEvent>();

  /** Emits Tiptap selection updates. */
  readonly selectionChange = output<MlvEditorSelectionChange>();

  /** Emits every Tiptap transaction. */
  readonly transaction = output<MlvEditorTransactionEvent>();

  /** Emits recoverable construction, parsing, and serialization errors. */
  readonly editorError = output<MlvEditorError>();

  /** Emits after an image upload succeeds. */
  readonly imageUploadSuccess = output<MlvEditorImageUploadSuccess>();

  /** Emits after an image upload fails. */
  readonly imageUploadFailure = output<MlvEditorImageUploadFailure>();

  /** Emits after an image upload is cancelled. */
  readonly imageUploadCancelled = output<MlvEditorImageUploadCancelled>();

  /** Whether the nullable model contains meaningful serialized content. */
  readonly hasValue = computed(() => this.value() !== null);

  /** @private Browser-only mount element for Tiptap's ProseMirror DOM. */
  private readonly _content =
    viewChild.required<ElementRef<HTMLDivElement>>('content');

  /**
   * @private Zoomed layer (CSS `zoom`) the floating block handle is mounted into.
   *
   * Deliberately optional rather than `viewChild.required`: the block-handle
   * `mount` capability is typed `() => HTMLElement | null`, and the extension
   * may call it from a ProseMirror plugin view during a user interaction. A
   * required query throws `NG0951` while unresolved, which would surface as an
   * uncaught error rather than the absent mount the contract already allows.
   */
  private readonly _view = viewChild<ElementRef<HTMLDivElement>>('view');

  /**
   * @private Toolbar band currently stamped before or after the viewport.
   * Queried by declaration, so it follows the band across position changes.
   */
  private readonly _toolbarBand =
    viewChild<ElementRef<HTMLElement>>('toolbarBand');

  /** @protected Complete projected toolbar replacement, if the consumer provides one. */
  protected readonly _toolbarDefs = contentChildren(MlvEditorToolbarDef);

  /** @protected Projected controls displayed before the built-in toolbar groups. */
  protected readonly _toolbarStartDefs = contentChildren(
    MlvEditorToolbarStartDef,
  );

  /** @protected Projected controls displayed after the built-in toolbar groups. */
  protected readonly _toolbarEndDefs = contentChildren(MlvEditorToolbarEndDef);

  /** @protected Whether a consumer declared a complete toolbar replacement. */
  protected readonly _hasToolbarDef = computed(
    () => this._toolbarDefs().length > 0,
  );

  /** @protected Context supplied as the implicit value of projected toolbar templates. */
  protected readonly _toolbarContext: MlvEditorToolbarContext = this;

  /** @private Platform marker used to keep all editor construction out of SSR. */
  private readonly _isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** @private Teardown registration for the browser editor instance. */
  private readonly _destroyRef = inject(DestroyRef);

  /** @private Registry for overlay roots logically owned by this composite control. */
  private readonly _overlayRegistry = inject(MlvEditorOverlayRegistry);

  /** @private Injector used after construction to resolve the editor coordinator safely. */
  private readonly _injector = inject(Injector);

  /** @private Invalidates built-in command state after Tiptap state changes. */
  private readonly _toolbarRevision = inject(MlvEditorToolbarRevision);

  /** @private Registry of in-flight upload abort callbacks. */
  private readonly _uploadAbortRegistry = inject(MlvEditorUploadAbortRegistry);

  /** @private Physical host used to determine the composite focus boundary. */
  private readonly _host = inject<ElementRef<HTMLElement>>(ElementRef);

  /**
   * @private Live ProseMirror `scrollMargin` (WCAG 2.2 SC 2.4.11). One stable
   * object passed on every `editorProps` write; its sides re-measure per read.
   * Read untracked: ProseMirror scrolls synchronously inside `updateState`,
   * which can run within `_synchronizeEditor`'s effect, and that effect must
   * not start depending on the toolbar inputs.
   */
  private readonly _scrollMargin = createMlvEditorLiveScrollSides(
    'margin',
    () => untracked(this.toolbarPosition),
    () => untracked(() => this._obscuredToolbarExtent()),
  );

  /** @private Live ProseMirror `scrollThreshold`, paired with `_scrollMargin`. */
  private readonly _scrollThreshold = createMlvEditorLiveScrollSides(
    'threshold',
    () => untracked(this.toolbarPosition),
    () => untracked(() => this._obscuredToolbarExtent()),
  );

  /** @private Optional translated accessible defaults. */
  private readonly _i18n = inject(MLV_EDITOR_I18N, { optional: true });

  /** @private Announces block moves politely; the editor content itself is not a live region. */
  private readonly _liveAnnouncer = inject(LiveAnnouncer);

  /** @private Last external value applied to Tiptap without an update event. */
  private _lastAppliedValue: string | null | undefined;

  /** @private Last value emitted from a user transaction or format conversion. */
  private _lastEmittedValue: string | null | undefined;

  /** @private Active serialization mode for the current editor document. */
  private _activeFormat: MlvEditorFormat | undefined;

  /** @private Guards against duplicate Tiptap teardown. */
  private _destroyed = false;

  /** @private Suppresses document-transaction serialization while applying an external value. */
  private _applyingExternalValue = false;

  /** @private Tracks the disabled edge so overlays/uploads close once per transition. */
  private _wasDisabled = false;

  /** @private Tracks the readonly edge so uploads stop before they can mutate content. */
  private _wasReadonly = false;

  /** @private Text selection retained while ProseMirror is made non-editable. */
  private _disabledSelection: { from: number; to: number } | undefined;

  /** @private Stored marks retained with a collapsed selection while disabled. */
  private _disabledStoredMarks: readonly Mark[] | null | undefined;

  /** @private Avoids duplicate queued focus-leave checks. */
  private _blurCheckQueued = false;

  /** @private The last boundary event, retained until the microtask resolves focus ownership. */
  private _pendingBlurEvent: FocusEvent | undefined;

  /** @private Blocks disabled keyboard activation; the other three subscribe to their handler directly. */
  private readonly _onDisabledKeydown = (event: KeyboardEvent): void => {
    if (
      event.key !== 'Enter' &&
      event.key !== ' ' &&
      event.key !== 'Spacebar'
    ) {
      return;
    }
    this._blockDisabledInteraction(event);
  };

  /** @protected Fallback-accessible name when no visible label is supplied. */
  protected readonly _resolvedAriaLabel = computed(
    () => this.ariaLabel() ?? this._i18n?.().editorLabel ?? 'Rich text editor',
  );

  /** @protected Descriptions supplied explicitly or by the inherited validation message. */
  protected readonly _resolvedAriaDescribedBy = computed(
    () =>
      this.ariaDescribedBy() ??
      (this.message() ? `${this.id()}-message` : undefined),
  );

  /** @protected ID used to connect a visible inherited label to ProseMirror. */
  protected readonly _labelId = computed(() => `${this.id()}-label`);

  /** @protected Accessible label for the projected toolbar region. */
  protected readonly _toolbarAriaLabel = computed(
    () => this._i18n?.().toolbarLabel ?? 'Editor toolbar',
  );

  constructor() {
    super();

    effect(() => {
      const editor = this._editor();
      const disabled = this.computedDisabled();
      const readonly = this.readonly();
      const wasDisabled = this._wasDisabled;
      if (disabled && !wasDisabled) {
        this._disabledSelection = editor
          ? { from: editor.state.selection.from, to: editor.state.selection.to }
          : undefined;
        this._disabledStoredMarks = editor
          ? (editor.state.storedMarks ?? editor.state.selection.$from.marks())
          : undefined;
        this._removeCompositeFocusForDisabledState();
        this._overlayRegistry.closeAll();
        this._abortInFlightUploads();
      }
      this._wasDisabled = disabled;
      if (readonly && !this._wasReadonly) {
        this._abortInFlightUploads();
      }
      this._wasReadonly = readonly;

      if (!editor) return;
      editor.setEditable(!disabled && !readonly);
      if (!disabled && wasDisabled && this._disabledSelection) {
        editor.commands.setTextSelection(this._disabledSelection);
        if (this._disabledStoredMarks) {
          editor.view.dispatch(
            editor.state.tr.setStoredMarks(this._disabledStoredMarks),
          );
        }
        this._disabledSelection = undefined;
        this._disabledStoredMarks = undefined;
      }
      this._synchronizeContentSurfaceState(editor);
    });

    effect(() => this._synchronizeEditor());

    this._overlayRegistry.setFocusHandlers(
      (event) => this._handleCompositeFocusIn(event),
      (event) => this._handleCompositeFocusOut(event),
    );
    this._destroyRef.onDestroy(() => {
      this._destroyed = true;
      this._removeCompositeFocusForDisabledState();
      this._overlayRegistry.closeAll();
      this._abortInFlightUploads();
      this._overlayRegistry.destroy();
      this._destroyEditor();
    });
  }

  /** Creates the one Tiptap editor after Angular has rendered the mount element. */
  ngAfterViewInit(): void {
    if (!this._isBrowser || this._editor() || this._destroyed) return;
    this._bindCompositeFocusEvents();

    const initialFormat = this.format();
    const initialRawValue = this.value();
    const initialValue = normalizeEditorValue(initialRawValue);
    if (initialRawValue !== initialValue) {
      this._lastEmittedValue = initialValue;
      this.value.set(initialValue);
    }

    try {
      // A consumer array remains a literal replacement. Defaults are selected
      // once so preflight and Tiptap receive the identical extension objects.
      const selectedExtensions =
        this.extensions() ??
        mlvEditorDefaultExtensions({
          format: 'markdown',
          placeholder: this.placeholder(),
          characterLimit: this.characterLimit(),
          allowedMimeTypes: ['image/*'],
          fileHandlingEnabled: () => {
            if (this._destroyed || this.computedDisabled() || this.readonly()) {
              return false;
            }
            return this._injector
              .get(MLV_EDITOR_IMAGE_UPLOAD_COORDINATOR)
              .available();
          },
          acceptsMimeType: (mimeType) => this._acceptsImageMimeType(mimeType),
          onFiles: ({ files, source, position }) => {
            if (this._destroyed || this.computedDisabled() || this.readonly()) {
              return;
            }
            const acceptedImages = files.filter(
              (file) =>
                file.type.startsWith('image/') &&
                this._acceptsImageMimeType(file.type),
            );
            if (!acceptedImages.length) return;
            this._injector
              .get(MLV_EDITOR_IMAGE_UPLOAD_COORDINATOR)
              .start(acceptedImages, source, {
                ...(position === undefined ? {} : { position }),
              });
          },
          blockHandle: {
            mount: () => this._view()?.nativeElement ?? null,
            label: () => this._i18n?.().dragBlock ?? 'Drag block',
            enabled: () =>
              !this._destroyed && !this.computedDisabled() && !this.readonly(),
            announceMove: (move) => this._announceBlockMove(move),
          },
        });
      const preflight = preflightMlvEditorExtensions(
        selectedExtensions,
        initialFormat,
      );
      if (!preflight.ok) {
        this.editorError.emit(preflight.error);
        return;
      }

      const editor = new Editor({
        element: this._content().nativeElement,
        ...this._emptyDocumentOptions(initialFormat),
        // The factory itself deliberately adds Markdown only for `format:
        // 'markdown'`. The shell always keeps that capability so an in-place
        // switch between any two formats can serialize the existing document
        // without constructing a second editor. A supplied array remains
        // literal.
        extensions: selectedExtensions,
        editable: !this.computedDisabled() && !this.readonly(),
        enableContentCheck: true,
        editorProps: {
          attributes: this._editorAttributes(),
          scrollMargin: this._scrollMargin,
          scrollThreshold: this._scrollThreshold,
        },
        onTransaction: ({ editor: changedEditor, transaction }) => {
          if (this._destroyed) return;
          this.transaction.emit({ editor: changedEditor, transaction });
          this._toolbarRevision.revision.update((revision) => revision + 1);
          if (transaction.docChanged && !this._applyingExternalValue) {
            this._serializeAndWrite(changedEditor, this.format());
          }
        },
        onSelectionUpdate: ({ editor: changedEditor, transaction }) => {
          if (this._destroyed) return;
          this.selectionChange.emit({ editor: changedEditor, transaction });
          this._toolbarRevision.revision.update((revision) => revision + 1);
        },
        onContentError: ({ error }) => {
          if (this._destroyed) return;
          this.editorError.emit({
            code: 'parse',
            message:
              'Unable to parse the editor value with the configured extensions.',
            recoverable: true,
            cause: error,
          });
        },
      });

      this._activeFormat = initialFormat;
      this._lastAppliedValue = null;
      this._editor.set(editor);
      this._applyInitialValue(editor, initialValue, initialFormat);
      // Consumers may immediately issue commands from `editorReady`; emit only
      // after the initial model has either been applied or recovered from.
      this.editorReady.emit(editor);
    } catch (cause: unknown) {
      this.editorError.emit({
        code: 'configuration',
        message: 'Unable to create the editor with the configured extensions.',
        recoverable: true,
        cause,
      });
    }
  }

  /**
   * @protected Focuses the editable content when the control's own
   * `<mlv-label>` is clicked.
   *
   * ProseMirror's contenteditable root is focusable but not HTML-labelable, so
   * `<label for>` can never name it and the native click-to-focus a field
   * label owes its control never ran — the visible label was inert (#216), the
   * same gap the three date/time pickers close. `readonly` still focuses (a
   * read-only `<textarea>` does), `disabled` returns early (the host is
   * `inert` anyway), and Tiptap's `focus` command restores the stored
   * selection rather than dropping the caret at the document start.
   */
  protected _onLabelClick(): void {
    if (this.computedDisabled()) return;
    this._editor()?.commands.focus();
  }

  /** Clears the document through Tiptap when the shared form wrapper is clearable. */
  clearValue(): void {
    if (this.computedDisabled() || this.readonly()) return;
    this._editor()?.commands.clearContent();
  }

  /** @private Formats a completed block move and announces it politely. */
  private _announceBlockMove(move: MlvEditorBlockMove): void {
    if (this._destroyed) return;
    const template = this._i18n?.().blockMoved;
    const message = template
      ? template
          .replace('{type}', move.type)
          .replace('{position}', String(move.position))
          .replace('{total}', String(move.total))
      : `Moved ${move.type} to position ${move.position} of ${move.total}`;
    this._liveAnnouncer.announce(message, 'polite');
  }

  /** @private Whether a browser MIME type matches the current coordinator options. */
  private _acceptsImageMimeType(mimeType: string): boolean {
    const normalizedMimeType = mimeType.trim().toLowerCase();
    if (!normalizedMimeType.startsWith('image/')) return false;
    return this.imageUploadOptions().accept.some((pattern) => {
      const normalizedPattern = pattern.trim().toLowerCase();
      if (normalizedPattern === '*/*') return true;
      if (normalizedPattern.endsWith('/*')) {
        return normalizedMimeType.startsWith(normalizedPattern.slice(0, -1));
      }
      return normalizedMimeType === normalizedPattern;
    });
  }

  /** Runs a Tiptap mutation command when the editor is available and editable. */
  run(command: (editor: Editor) => boolean): boolean {
    if (this.computedDisabled() || this.readonly()) return false;
    const editor = this._editor();
    if (!editor) return false;
    try {
      return command(editor) === true;
    } catch {
      return false;
    }
  }

  /** Checks a Tiptap command when the editor is available and editable. */
  can(command: (editor: Editor) => boolean): boolean {
    if (this.computedDisabled() || this.readonly()) return false;
    const editor = this._editor();
    if (!editor) return false;
    try {
      return command(editor) === true;
    } catch {
      return false;
    }
  }

  /** Safely reads a Tiptap active state without requiring a particular extension. */
  isActive(name: string, attributes?: Record<string, unknown>): boolean {
    this._toolbarRevision.revision();
    const editor = this._editor();
    if (!editor) return false;
    try {
      return editor.isActive(name, attributes);
    } catch {
      return false;
    }
  }

  /** Reports a typed recoverable error through the owning editor output. */
  reportError(error: MlvEditorError): void {
    this.editorError.emit(error);
  }

  /** @private Applies the current inputs to the already-created editor instance. */
  private _synchronizeEditor(): void {
    const editor = this._editor();
    if (!editor) return;

    const requestedFormat = this.format();
    editor.setOptions({
      // `setOptions` replaces Tiptap's stored `editorProps` wholesale. The
      // live view keeps its props (ProseMirror's `setProps` merges), but a
      // later `mount()` rebuilds the view from the stored copy, so the scroll
      // props travel with every call.
      editorProps: {
        attributes: this._editorAttributes(),
        scrollMargin: this._scrollMargin,
        scrollThreshold: this._scrollThreshold,
      },
    });
    this._synchronizeContentSurfaceState(editor);
    const rawIncoming = this.value();
    const incoming = normalizeEditorValue(rawIncoming);
    // Tracked values were produced under the currently active format, so the
    // comparison runs in that format rather than the requested one. JSON is
    // compared structurally there; a host value that only reorders keys or
    // reflows whitespace describes the mounted document and is not an
    // external change.
    const trackedFormat = this._activeFormat ?? requestedFormat;
    const hasExternalValue =
      !editorValuesAreEquivalent(
        incoming,
        this._lastAppliedValue,
        trackedFormat,
      ) &&
      !editorValuesAreEquivalent(
        incoming,
        this._lastEmittedValue,
        trackedFormat,
      );

    if (this._activeFormat !== requestedFormat) {
      if (hasExternalValue) {
        if (requestedFormat === 'markdown' && !this._supportsMarkdown(editor)) {
          this._emitUnsupportedMarkdownError('configuration');
          return;
        }
        this._activeFormat = requestedFormat;
        this._applyExternalValue(editor, incoming, requestedFormat);
        return;
      }
      if (this._activeFormat !== undefined) {
        if (!this._supportsMarkdown(editor) && requestedFormat === 'markdown') {
          this._emitUnsupportedMarkdownError('configuration');
          return;
        }
        if (!this._serializeAndWrite(editor, requestedFormat)) return;
      }
      this._activeFormat = requestedFormat;
    }

    if (rawIncoming !== incoming) {
      this._lastEmittedValue = incoming;
      this.value.set(incoming);
    }
    if (!hasExternalValue) {
      this._lastAppliedValue = incoming;
      return;
    }

    this._applyExternalValue(editor, incoming, requestedFormat);
  }

  /** @private Applies an external value without reflecting it back through `onUpdate`. */
  private _applyExternalValue(
    editor: Editor,
    value: string | null,
    format: MlvEditorFormat,
  ): void {
    const prepared =
      value === null ? null : this._prepareContent(editor, value, format);
    if (prepared !== null && !prepared.ok) {
      this._recoverFromInvalidValue(prepared.cause);
      return;
    }

    try {
      this._applyingExternalValue = true;
      // External applications must stay invisible to user undo history:
      // Tiptap's setContent/clearContent never set `addToHistory`, so a bare
      // command would land the initial or programmatic document as an undoable
      // step whose undo empties the editor. The chain shares one transaction,
      // so the meta covers the whole application.
      if (prepared === null) {
        editor.chain().setMeta('addToHistory', false).clearContent(false).run();
      } else {
        editor
          .chain()
          .setMeta('addToHistory', false)
          .setContent(prepared.content, prepared.options)
          .run();
      }
      this._lastAppliedValue = value;
      this._lastEmittedValue = undefined;
    } catch (cause: unknown) {
      this._recoverFromInvalidValue(cause);
    } finally {
      this._applyingExternalValue = false;
    }
  }

  /**
   * @private Converts one nonempty external value into Tiptap content and
   * options.
   *
   * The branch is exhaustive over every format rather than special-casing one:
   * HTML is parsed from its own markup, Markdown declares its content type so
   * the Markdown manager parses it, and JSON is handed over as an
   * already-parsed document node because Tiptap reads any string argument as
   * HTML. A rejected JSON value carries its cause instead of a document.
   */
  private _prepareContent(
    editor: Editor,
    value: string,
    format: MlvEditorFormat,
  ): MlvEditorPreparedContent {
    switch (format) {
      case 'html':
        return {
          ok: true,
          content: value,
          options: { emitUpdate: false, errorOnInvalidContent: true },
        };
      case 'markdown':
        return {
          ok: true,
          content: value,
          options: {
            emitUpdate: false,
            errorOnInvalidContent: true,
            contentType: 'markdown',
          },
        };
      case 'json': {
        const parsed = parseEditorJsonDocument(
          value,
          editor.schema.topNodeType.name,
        );
        return parsed.ok
          ? {
              ok: true,
              content: parsed.document,
              options: { emitUpdate: false, errorOnInvalidContent: true },
            }
          : { ok: false, cause: parsed.cause };
      }
    }
  }

  /**
   * @private Construction options mounting an empty document for one format.
   *
   * Tiptap is always constructed against an empty document so every real
   * value travels the same strict parsing path. Markdown still declares its
   * content type here because the Markdown manager validates that declaration
   * against the supplied content before the first document is published. HTML
   * needs no declaration, and JSON never reaches Tiptap as a string at all.
   */
  private _emptyDocumentOptions(format: MlvEditorFormat): {
    readonly content: string;
    readonly contentType?: 'markdown';
  } {
    switch (format) {
      case 'html':
        return { content: '' };
      case 'markdown':
        return { content: '', contentType: 'markdown' };
      case 'json':
        return { content: '' };
    }
  }

  /** @private Restores the last valid value and reports a recoverable parse failure. */
  private _recoverFromInvalidValue(cause: unknown): void {
    const lastValidValue = this._lastAppliedValue ?? null;
    this._lastEmittedValue = lastValidValue;
    if (this.value() !== lastValidValue) {
      this.value.set(lastValidValue);
    }
    this.editorError.emit({
      code: 'parse',
      message:
        'Unable to parse the editor value with the configured extensions.',
      recoverable: true,
      cause,
    });
  }

  /**
   * @private Serializes an editor transaction and writes only valid distinct
   * values.
   *
   * The distinctness check runs in the serialized format, so a JSON document
   * that differs from the model only by key order or whitespace is not
   * re-emitted. An emission therefore follows only a real user transaction or
   * an explicit format conversion.
   */
  private _serializeAndWrite(editor: Editor, format: MlvEditorFormat): boolean {
    const result = serializeEditorValue(editor, format);
    if (!result.ok) {
      this.editorError.emit(result.error);
      return false;
    }

    this._lastAppliedValue = result.value;
    this._lastEmittedValue = result.value;
    if (!editorValuesAreEquivalent(this.value(), result.value, format)) {
      this.value.set(result.value);
    }
    return true;
  }

  /**
   * @private Applies the initial model through the same strict parsing path as
   * later updates.
   *
   * Only Markdown has a capability requirement; HTML and JSON mount against
   * any valid extension set.
   */
  private _applyInitialValue(
    editor: Editor,
    value: string | null,
    format: MlvEditorFormat,
  ): void {
    switch (format) {
      case 'markdown':
        if (!this._supportsMarkdown(editor)) {
          this._emitUnsupportedMarkdownError('configuration');
          this._lastAppliedValue = null;
          this._lastEmittedValue = null;
          if (this.value() !== null) this.value.set(null);
          return;
        }
        break;
      case 'html':
      case 'json':
        break;
    }

    this._applyExternalValue(editor, value, format);
  }

  /** @private Whether the runtime editor exposes Tiptap Markdown serialization. */
  private _supportsMarkdown(editor: Editor): boolean {
    return typeof editor.getMarkdown === 'function';
  }

  /** @private Emits the stable unsupported-Markdown error without throwing through Angular. */
  private _emitUnsupportedMarkdownError(
    code: Extract<MlvEditorError['code'], 'configuration' | 'serialize'>,
  ): void {
    this.editorError.emit({
      code,
      message:
        'Markdown requires the configured extensions to include Tiptap Markdown.',
      recoverable: true,
    });
  }

  /**
   * @private Block extent the toolbar hides on its own side, in px.
   *
   * - A sticky band hides its height plus its offset, at the page scroller.
   * - A floating band in a capped editor hides its height, at the viewport.
   * - Anything else hides nothing: a docked bar sits outside the content, and
   *   an uncapped floating band scrolls away with the page.
   *
   * Read by ProseMirror at scroll time, never for layout. ProseMirror applies
   * one margin at every scroll ancestor, so a capped editor with a sticky
   * toolbar keeps the caret clear of the page-stuck band at the viewport too,
   * and a capped floating one keeps a band-height margin at the page scroller,
   * where nothing covers the caret. Both are accepted: they err toward
   * visibility.
   */
  private _obscuredToolbarExtent(): number {
    const sticky = this.toolbarSticky();
    const floatingCapped =
      this.toolbarAppearance() === 'floating' && this._capped();
    if (!sticky && !floatingCapped) return 0;
    const band = this._toolbarBand()?.nativeElement;
    if (!band) return 0;
    let extent = band.getBoundingClientRect().height;
    if (sticky) {
      const side =
        this.toolbarPosition() === 'top'
          ? 'inset-block-start'
          : 'inset-block-end';
      const view = band.ownerDocument.defaultView;
      extent += view
        ? Number.parseFloat(
            view.getComputedStyle(band).getPropertyValue(side),
          ) || 0
        : 0;
    }
    return extent;
  }

  /** @private Builds the exact accessible attributes assigned to Tiptap's contenteditable root. */
  private _editorAttributes(): Record<string, string> {
    const attributes: Record<string, string> = {
      id: this.id(),
      role: 'textbox',
      'aria-multiline': 'true',
    };

    const labelledBy = this.ariaLabelledBy();
    if (labelledBy) {
      attributes['aria-labelledby'] = labelledBy;
    } else if (this.ariaLabel()) {
      attributes['aria-label'] = this._resolvedAriaLabel();
    } else if (this.label()) {
      attributes['aria-labelledby'] = this._labelId();
    } else {
      attributes['aria-label'] = this._resolvedAriaLabel();
    }

    const describedBy = this._resolvedAriaDescribedBy();
    if (describedBy) {
      attributes['aria-describedby'] = describedBy;
    }

    if (this.resolvedState() === 'error') {
      attributes['aria-invalid'] = 'true';
    }

    if (this.computedDisabled()) {
      attributes['aria-disabled'] = 'true';
      attributes['tabindex'] = '-1';
    } else {
      attributes['tabindex'] = '0';
    }

    if (this.readonly()) {
      attributes['aria-readonly'] = 'true';
    }

    return attributes;
  }

  /** @internal Capture handler for focus entering the host or an owned overlay root. */
  _handleCompositeFocusIn(event: FocusEvent): void {
    if (this._destroyed || this.computedDisabled() || this.focused()) return;
    const editor = this._editor();
    if (!editor) return;
    this.setFocused(true);
    this.focus.emit({ editor, event });
  }

  /** @internal Capture handler for focus leaving the host or an owned overlay root. */
  _handleCompositeFocusOut(event: FocusEvent): void {
    if (this._destroyed || !this.focused()) return;
    this._pendingBlurEvent = event;
    if (this._blurCheckQueued) return;
    this._blurCheckQueued = true;
    queueMicrotask(() => {
      this._blurCheckQueued = false;
      const pendingEvent = this._pendingBlurEvent;
      this._pendingBlurEvent = undefined;
      if (
        !pendingEvent ||
        this._destroyed ||
        this._isFocusInsideComposite(pendingEvent.relatedTarget)
      ) {
        return;
      }
      const editor = this._editor();
      if (!editor) return;
      this.setFocused(false);
      this._markTouched();
      this.blur.emit({ editor, event: pendingEvent });
    });
  }

  /** @private Whether the browser's current focus remains in the host or an owned overlay. */
  private _isFocusInsideComposite(relatedTarget: EventTarget | null): boolean {
    if (typeof Node !== 'undefined' && relatedTarget instanceof Node) {
      return this._isOwnedFocusNode(relatedTarget);
    }
    if (typeof document === 'undefined') return false;
    return this._isOwnedFocusNode(document.activeElement);
  }

  /** @private Whether a node belongs to the physical shell or an owned overlay. */
  private _isOwnedFocusNode(node: Node | null): boolean {
    return (
      node !== null &&
      (this._host.nativeElement.contains(node) ||
        this._overlayRegistry.contains(node))
    );
  }

  /**
   * @private Subscribes the composite's host listeners, because overlay focus
   * happens outside Angular's view tree.
   *
   * Every one is registered in the **capture** phase, which is load-bearing
   * rather than incidental: ProseMirror binds its own handlers to `view.dom`,
   * a descendant of this host, so only a capture-phase listener on the host
   * runs ahead of them. The disabled handlers depend on that to call
   * `stopImmediatePropagation()` while the event is still travelling down —
   * from the bubble phase ProseMirror would already have acted on it. Capture
   * is carried through `fromEvent`'s third argument, and `editor-focus.spec.ts`
   * pins the ordering against descendant listeners.
   *
   * Called from `ngAfterViewInit`, which is not an injection context, so
   * `takeUntilDestroyed` is given the ref explicitly.
   */
  private _bindCompositeFocusEvents(): void {
    const host = this._host.nativeElement;

    fromEvent<FocusEvent>(host, 'focusin', { capture: true })
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe((event) => this._handleCompositeFocusIn(event));
    fromEvent<FocusEvent>(host, 'focusout', { capture: true })
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe((event) => this._handleCompositeFocusOut(event));
    fromEvent(host, 'pointerdown', { capture: true })
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe((event) => this._blockDisabledInteraction(event));
    fromEvent(host, 'click', { capture: true })
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe((event) => this._blockDisabledInteraction(event));
    fromEvent<KeyboardEvent>(host, 'keydown', { capture: true })
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe((event) => this._onDisabledKeydown(event));
  }

  /** @private Stops all pointer/click/activation-key command surfaces while disabled. */
  private _blockDisabledInteraction(event: Event): void {
    if (!this.computedDisabled()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  /** @private Removes browser focus when the composite becomes disabled without marking it touched. */
  private _removeCompositeFocusForDisabledState(): void {
    if (typeof document === 'undefined' || typeof HTMLElement === 'undefined') {
      return;
    }
    const activeElement = document.activeElement;
    if (
      !(activeElement instanceof HTMLElement) ||
      !this._isOwnedFocusNode(activeElement)
    ) {
      return;
    }
    this.setFocused(false);
    activeElement.blur();
  }

  /** @private Keeps the real ProseMirror root in sync with dynamic ARIA/tabindex state. */
  private _synchronizeContentSurfaceState(editor: Editor): void {
    const element = editor.view.dom as HTMLElement;
    const attributes = this._editorAttributes();
    const managedAttributes = [
      'aria-disabled',
      'aria-readonly',
      'tabindex',
      'aria-invalid',
    ];
    for (const name of managedAttributes) {
      const value = attributes[name];
      if (value === undefined) {
        element.removeAttribute(name);
      } else {
        element.setAttribute(name, value);
      }
    }
  }

  /** @private Aborts registered upload work while preserving the document/editor instance. */
  private _abortInFlightUploads(): void {
    this._uploadAbortRegistry.abortAll();
  }

  /** @private Destroys the owned Tiptap editor exactly once. */
  private _destroyEditor(): void {
    const editor = this._editor();
    if (!editor) return;
    this._editor.set(null);
    editor?.destroy();
  }
}
