import { computed, InjectionToken, signal, type Signal } from '@angular/core';
import type { Editor } from '@tiptap/core';
import {
  MlvEditorImageUploadControl,
  mlvEditorDefaultImageUrlPolicy,
  type MlvEditorError,
  type MlvEditorImageUploadCancelled,
  type MlvEditorImageUploadFailure,
  type MlvEditorImageUploadOptions,
  type MlvEditorImageUploadResult,
  type MlvEditorImageUploadSource,
  type MlvEditorImageUploadSuccess,
  type MlvEditorImageUploader,
  type MlvEditorPendingUpload,
} from '../editor.types';

type MlvEditorImageUploadTerminalReason =
  | 'success'
  | 'cancelled'
  | 'lifecycle-abort'
  | 'removed';

interface MlvEditorImageUploadTerminalEvent {
  readonly id: string;
  readonly reason: MlvEditorImageUploadTerminalReason;
}

/** Internal upload coordinator shared by every editor image entry point. */
export interface MlvEditorImageUploadCoordinator
  extends MlvEditorImageUploadControl {
  /** Observes explicit terminal transitions synchronously. */
  onTerminal(
    listener: (event: MlvEditorImageUploadTerminalEvent) => void,
  ): () => void;

  /** Claims live dialog ownership until the returned release is called. */
  claimDialogOwnership(id: string): () => void;

  /** Whether a live dialog owned this upload at the current terminal delivery. */
  hasDialogOwner(id: string): boolean;
}

const editorImageUploadCoordinators = new WeakMap<
  MlvEditorImageUploadControl,
  MlvEditorImageUploadCoordinator
>();

/** @internal Resolves only capabilities created by the Malva coordinator factory. */
export function resolveMlvEditorImageUploadCoordinator(
  control: MlvEditorImageUploadControl | undefined,
): MlvEditorImageUploadCoordinator | undefined {
  return control ? editorImageUploadCoordinators.get(control) : undefined;
}

/** Internal lifecycle and event connection supplied by the owning editor. */
export interface MlvEditorImageUploadCoordinatorConnection {
  /** Current Tiptap editor instance. */
  readonly editor: Signal<Editor | null>;

  /** Per-editor uploader input. */
  readonly imageUploader: Signal<MlvEditorImageUploader | undefined>;

  /** Current validation and URL-policy options. */
  readonly imageUploadOptions: Signal<MlvEditorImageUploadOptions>;

  /** Whether the full editor composite is disabled. */
  readonly disabled: () => boolean;

  /** Whether the editor content is read-only. */
  readonly readonly: () => boolean;

  /** Emits one successful upload payload. */
  readonly emitSuccess: (event: MlvEditorImageUploadSuccess) => void;

  /** Emits one failed upload payload. */
  readonly emitFailure: (event: MlvEditorImageUploadFailure) => void;

  /** Emits one explicit cancellation payload. */
  readonly emitCancelled: (event: MlvEditorImageUploadCancelled) => void;

  /** Emits the shared recoverable editor error. */
  readonly emitError: (error: MlvEditorError) => void;
}

/** Minimal abort registry contract used without coupling consumers to its class. */
export interface MlvEditorImageUploadAbortRegistryLike {
  /** Registers one active abort callback and returns its unregister function. */
  register(abort: () => void): () => void;
}

/** Internal editor-scoped coordinator token consumed by upload entry points. */
export const MLV_EDITOR_IMAGE_UPLOAD_COORDINATOR =
  new InjectionToken<MlvEditorImageUploadCoordinator>(
    'MLV_EDITOR_IMAGE_UPLOAD_COORDINATOR',
  );

interface ValidatedUploadOptions {
  readonly accept: readonly string[];
  readonly maxSize: number;
  readonly maxFiles: number;
  readonly urlPolicy: (url: string) => boolean;
}

interface UploadMetadata {
  readonly position?: number;
  /**
   * Author alt; wins over the adapter's, and `''` marks a decorative image,
   * which keeps no title at all.
   */
  readonly alt?: string;
  /** Author title; a non-empty one wins over the adapter's. */
  readonly title?: string;
}

interface UploadState extends UploadMetadata {
  readonly id: string;
  readonly file: File;
  readonly source: MlvEditorImageUploadSource;
  generation: number;
  status: 'uploading' | 'failed';
  controller?: AbortController;
  unregister?: () => void;
}

let nextUploadId = 0;

const nextStableUploadId = (): string => {
  nextUploadId += 1;
  return `mlv-editor-upload-${nextUploadId}`;
};

const isMimePattern = (value: string): boolean =>
  value === '*/*' || /^[^\s/*]+\/(?:\*|[^\s/*]+)$/u.test(value);

const createError = (
  code: Extract<
    MlvEditorError['code'],
    'upload-validation' | 'upload-transport' | 'upload-result'
  >,
  message: string,
  cause?: unknown,
): MlvEditorError => ({
  code,
  message,
  recoverable: true,
  ...(cause === undefined ? {} : { cause }),
});

/**
 * Creates one editor-scoped upload coordinator.
 *
 * @internal The returned value is exposed only through
 * `MLV_EDITOR_IMAGE_UPLOAD_COORDINATOR`.
 */
export function createMlvEditorImageUploadCoordinator(
  connection: MlvEditorImageUploadCoordinatorConnection,
  injectedUploader: MlvEditorImageUploader | undefined,
  abortRegistry: MlvEditorImageUploadAbortRegistryLike,
): MlvEditorImageUploadCoordinator {
  const coordinator = new EditorImageUploadCoordinator(
    connection,
    injectedUploader,
    abortRegistry,
  );
  editorImageUploadCoordinators.set(coordinator, coordinator);
  return coordinator;
}

class EditorImageUploadCoordinator
  extends MlvEditorImageUploadControl
  implements MlvEditorImageUploadCoordinator
{
  /** @private Mutable upload list backing the public read-only signal. */
  private readonly _pending = signal<readonly MlvEditorPendingUpload[]>([]);

  /** Active and retryable uploads owned by this editor. */
  readonly pending = this._pending.asReadonly();

  /** @private Retry metadata and active request generation keyed by stable ID. */
  private readonly _states = new Map<string, UploadState>();

  /** @private Synchronous terminal observers used by editor-owned UI. */
  private readonly _terminalListeners = new Set<
    (event: MlvEditorImageUploadTerminalEvent) => void
  >();

  /** @private Live dialog-owner reference count keyed by upload ID. */
  private readonly _dialogOwners = new Map<string, number>();

  /** @private Ownership snapshot retained for the complete terminal delivery. */
  private readonly _terminalDialogOwners = new Map<string, boolean>();

  /** @private Currently resolved adapter, with the input taking precedence. */
  private readonly _resolvedUploader = computed(
    () => this._connection.imageUploader() ?? this._injectedUploader,
  );

  /** Whether either the input or injected adapter resolves for this editor. */
  readonly adapterAvailable = computed(
    () => this._resolvedUploader() !== undefined,
  );

  /** Current editor-scoped validation options. */
  get options(): Signal<MlvEditorImageUploadOptions> {
    return this._connection.imageUploadOptions;
  }

  /** Whether this editor can currently begin image uploads. */
  readonly available = computed(
    () =>
      this._connection.editor() !== null &&
      this._resolvedUploader() !== undefined &&
      !this._connection.disabled() &&
      !this._connection.readonly(),
  );

  constructor(
    private readonly _connection: MlvEditorImageUploadCoordinatorConnection,
    private readonly _injectedUploader: MlvEditorImageUploader | undefined,
    private readonly _abortRegistry: MlvEditorImageUploadAbortRegistryLike,
  ) {
    super();
  }

  /** Observes explicit terminal transitions synchronously. */
  onTerminal(
    listener: (event: MlvEditorImageUploadTerminalEvent) => void,
  ): () => void {
    this._terminalListeners.add(listener);
    return () => this._terminalListeners.delete(listener);
  }

  /** Claims live dialog ownership until the returned release is called. */
  claimDialogOwnership(id: string): () => void {
    this._dialogOwners.set(id, (this._dialogOwners.get(id) ?? 0) + 1);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const owners = this._dialogOwners.get(id) ?? 0;
      if (owners <= 1) this._dialogOwners.delete(id);
      else this._dialogOwners.set(id, owners - 1);
    };
  }

  /** Whether a live dialog owns terminal announcements for an upload. */
  hasDialogOwner(id: string): boolean {
    return (
      this._terminalDialogOwners.get(id) ??
      (this._dialogOwners.get(id) ?? 0) > 0
    );
  }

  /** Validates and begins one file interaction. */
  start(
    files: readonly File[],
    source: MlvEditorImageUploadSource,
    metadata: UploadMetadata = {},
  ): readonly string[] {
    const editor = this._connection.editor();
    const uploader = this._resolvedUploader();
    if (
      !editor ||
      !uploader ||
      this._connection.disabled() ||
      this._connection.readonly()
    ) {
      return [];
    }

    const options = this._validateOptions(
      this._connection.imageUploadOptions(),
    );
    if (!options) {
      for (const file of files) {
        this._emitValidationFailure(
          file,
          source,
          'The image upload configuration is invalid.',
        );
      }
      return [];
    }

    const ids: string[] = [];
    const acceptedInteractionFiles = files.slice(0, options.maxFiles);
    const excessFiles = files.slice(options.maxFiles);

    for (const file of excessFiles) {
      this._emitValidationFailure(
        file,
        source,
        `Only ${options.maxFiles} image file(s) may be uploaded at once.`,
      );
    }

    for (const file of acceptedInteractionFiles) {
      const validationMessage = this._validateFile(file, options);
      if (validationMessage) {
        this._emitValidationFailure(file, source, validationMessage);
        continue;
      }

      const id = nextStableUploadId();
      const state: UploadState = {
        id,
        file,
        source,
        generation: 0,
        status: 'uploading',
        ...metadata,
      };
      this._states.set(id, state);
      this._pending.update((pending) => [
        ...pending,
        this._toPendingUpload(state, 0),
      ]);
      ids.push(id);

      if (!this._insertPlaceholder(editor, state)) {
        this._fail(
          state,
          state.generation,
          createError(
            'upload-result',
            'The editor cannot create an image upload placeholder.',
          ),
        );
        continue;
      }

      this._beginRequest(state, uploader);
    }

    return ids;
  }

  /** Cancels one active request and emits its cancellation event once. */
  cancel(id: string): void {
    const state = this._states.get(id);
    if (!state || state.status !== 'uploading' || !state.controller) return;
    this._terminate(state, 'cancelled');
  }

  /** Retries one recoverable failure with a fresh request generation. */
  retry(id: string): void {
    const state = this._states.get(id);
    const editor = this._connection.editor();
    const uploader = this._resolvedUploader();
    if (
      !state ||
      state.status !== 'failed' ||
      !editor ||
      !uploader ||
      this._connection.disabled() ||
      this._connection.readonly()
    ) {
      return;
    }

    state.status = 'uploading';
    this._replacePending(this._toPendingUpload(state, 0));

    const placeholderReset = this._updatePlaceholder(editor, state.id, 0);
    if (!placeholderReset && !this._insertPlaceholder(editor, state)) {
      this._fail(
        state,
        state.generation,
        createError(
          'upload-result',
          'The editor cannot restore the image upload placeholder.',
        ),
      );
      return;
    }

    this._beginRequest(state, uploader);
  }

  /** Removes one failed item without emitting a cancellation event. */
  remove(id: string): void {
    const state = this._states.get(id);
    if (!state || state.status !== 'failed') return;
    this._states.delete(id);
    this._removePending(id);
    this._removePlaceholder(this._connection.editor(), id);
    this._emitTerminal({ id, reason: 'removed' });
  }

  /** @private Validates and normalizes host upload configuration. */
  private _validateOptions(
    options: MlvEditorImageUploadOptions,
  ): ValidatedUploadOptions | undefined {
    const accept = Array.isArray(options?.accept)
      ? options.accept.map((value) =>
          typeof value === 'string' ? value.trim().toLowerCase() : '',
        )
      : [];
    if (
      accept.length === 0 ||
      accept.some((value) => !value || !isMimePattern(value)) ||
      !Number.isFinite(options?.maxSize) ||
      options.maxSize < 0 ||
      !Number.isInteger(options?.maxFiles) ||
      options.maxFiles < 1 ||
      (options.urlPolicy !== undefined &&
        typeof options.urlPolicy !== 'function')
    ) {
      return undefined;
    }

    return {
      accept,
      maxSize: options.maxSize,
      maxFiles: options.maxFiles,
      urlPolicy: options.urlPolicy ?? mlvEditorDefaultImageUrlPolicy,
    };
  }

  /** @private Returns the user-facing validation failure for one file. */
  private _validateFile(
    file: File,
    options: ValidatedUploadOptions,
  ): string | undefined {
    const mimeType =
      typeof file?.type === 'string' ? file.type.trim().toLowerCase() : '';
    const mimeAccepted = options.accept.some((pattern) => {
      if (pattern === '*/*') return true;
      if (!mimeType) return false;
      if (pattern.endsWith('/*')) {
        return mimeType.startsWith(`${pattern.slice(0, -1)}`);
      }
      return pattern === mimeType;
    });
    if (!mimeAccepted) {
      return 'The selected file type is not accepted for image upload.';
    }
    if (
      !Number.isFinite(file?.size) ||
      file.size < 0 ||
      file.size > options.maxSize
    ) {
      return `The selected image exceeds the ${options.maxSize}-byte size limit.`;
    }
    return undefined;
  }

  /** @private Emits a validation failure without creating upload state. */
  private _emitValidationFailure(
    file: File,
    source: MlvEditorImageUploadSource,
    message: string,
  ): void {
    const error = createError('upload-validation', message);
    this._connection.emitFailure({ file, source, error });
    this._connection.emitError(error);
  }

  /** @private Creates a fresh controller and invokes the resolved adapter. */
  private _beginRequest(
    state: UploadState,
    uploader: MlvEditorImageUploader,
  ): void {
    state.generation += 1;
    const generation = state.generation;
    const controller = new AbortController();
    state.controller = controller;
    state.unregister = this._abortRegistry.register(() =>
      this._terminateForLifecycle(state.id, generation),
    );

    let request: Promise<MlvEditorImageUploadResult>;
    try {
      request = uploader.upload(state.file, {
        source: state.source,
        signal: controller.signal,
        reportProgress: (progress) =>
          this._reportProgress(state.id, generation, progress),
      });
    } catch (cause: unknown) {
      this._fail(
        state,
        generation,
        createError(
          'upload-transport',
          'The image upload adapter failed before starting the request.',
          cause,
        ),
      );
      return;
    }

    Promise.resolve(request).then(
      (result) => this._complete(state.id, generation, result),
      (cause: unknown) =>
        this._fail(
          state,
          generation,
          createError(
            'upload-transport',
            'The image upload request failed.',
            cause,
          ),
        ),
    );
  }

  /** @private Applies finite progress only to the current request generation. */
  private _reportProgress(
    id: string,
    generation: number,
    progress: number,
  ): void {
    const state = this._currentActiveState(id, generation);
    if (!state || !Number.isFinite(progress)) return;
    const normalizedProgress = Math.max(0, Math.min(100, progress));
    this._replacePending(this._toPendingUpload(state, normalizedProgress));
    this._updatePlaceholder(this._connection.editor(), id, normalizedProgress);
  }

  /** @private Validates a result and atomically replaces its mapped placeholder. */
  private _complete(id: string, generation: number, candidate: unknown): void {
    const state = this._currentActiveState(id, generation);
    if (!state) return;
    const options = this._validateOptions(
      this._connection.imageUploadOptions(),
    );
    const result = options
      ? this._validateResult(candidate, state, options)
      : undefined;
    if (!result) {
      this._fail(
        state,
        generation,
        createError(
          'upload-result',
          'The image uploader returned invalid or unsafe image metadata.',
          candidate,
        ),
      );
      return;
    }

    const editor = this._connection.editor();
    if (!editor || !this._replacePlaceholder(editor, id, result)) {
      this._fail(
        state,
        generation,
        createError(
          'upload-result',
          'The editor cannot atomically insert the uploaded image.',
        ),
      );
      return;
    }

    this._endActiveRequest(state);
    this._states.delete(id);
    this._removePending(id);
    this._connection.emitSuccess({
      file: state.file,
      source: state.source,
      result,
    });
    this._emitTerminal({ id, reason: 'success' });
  }

  /** @private Returns normalized metadata only when the complete result is valid. */
  private _validateResult(
    candidate: unknown,
    state: UploadState,
    options: ValidatedUploadOptions,
  ): MlvEditorImageUploadResult | undefined {
    if (
      !candidate ||
      typeof candidate !== 'object' ||
      Array.isArray(candidate)
    ) {
      return undefined;
    }
    const value = candidate as Record<string, unknown>;
    if (typeof value['src'] !== 'string') return undefined;
    const src = value['src'].trim();
    if (!src) return undefined;
    if (
      (value['alt'] !== undefined && typeof value['alt'] !== 'string') ||
      (value['title'] !== undefined && typeof value['title'] !== 'string') ||
      !this._isOptionalPositiveNumber(value['width']) ||
      !this._isOptionalPositiveNumber(value['height'])
    ) {
      return undefined;
    }

    try {
      if (!options.urlPolicy(src)) return undefined;
    } catch {
      return undefined;
    }

    // The author's metadata states intent and wins; the adapter's only fills
    // what the author left out. An author `alt: ''` marks the image
    // decorative: the alt stays empty (WCAG 1.1.1) and no title is kept,
    // the author's or the adapter's, because an `alt=""` image with a title
    // is exposed as an unnamed image described by it (WCAG H67). Otherwise
    // an empty author title means no title, so the adapter's may fill it.
    const adapterAlt =
      typeof value['alt'] === 'string' ? value['alt'] : undefined;
    const adapterTitle =
      typeof value['title'] === 'string' ? value['title'] : undefined;
    const alt = state.alt ?? adapterAlt;
    const title = state.alt === '' ? undefined : state.title || adapterTitle;
    return {
      src,
      ...(alt === undefined ? {} : { alt }),
      ...(title === undefined ? {} : { title }),
      ...(typeof value['width'] === 'number' ? { width: value['width'] } : {}),
      ...(typeof value['height'] === 'number'
        ? { height: value['height'] }
        : {}),
    };
  }

  /** @private Whether an optional dimension is absent or finite and positive. */
  private _isOptionalPositiveNumber(value: unknown): boolean {
    return (
      value === undefined ||
      (typeof value === 'number' && Number.isFinite(value) && value > 0)
    );
  }

  /** @private Converts a current request failure into retryable pending state. */
  private _fail(
    state: UploadState,
    generation: number,
    error: MlvEditorError,
  ): void {
    if (
      this._states.get(state.id) !== state ||
      state.generation !== generation ||
      state.status !== 'uploading'
    ) {
      return;
    }
    this._endActiveRequest(state);
    state.status = 'failed';
    this._replacePending(this._toPendingUpload(state, 0, error));
    this._connection.emitFailure({
      file: state.file,
      source: state.source,
      error,
    });
    this._connection.emitError(error);
  }

  /** @private Stops explicit cancellation after first invalidating its generation. */
  private _terminate(
    state: UploadState,
    reason: Extract<
      MlvEditorImageUploadTerminalEvent['reason'],
      'cancelled' | 'lifecycle-abort'
    >,
  ): void {
    state.generation += 1;
    this._endActiveRequest(state, true);
    this._states.delete(state.id);
    this._removePending(state.id);
    this._removePlaceholder(this._connection.editor(), state.id);
    if (reason === 'cancelled') {
      this._connection.emitCancelled({
        file: state.file,
        source: state.source,
      });
    }
    this._emitTerminal({ id: state.id, reason });
  }

  /** @private Stops a registry-owned request without inventing a cancel event. */
  private _terminateForLifecycle(id: string, generation: number): void {
    const state = this._currentActiveState(id, generation);
    if (!state) return;
    this._terminate(state, 'lifecycle-abort');
  }

  /** @private Delivers one terminal reason to current UI observers. */
  private _emitTerminal(event: MlvEditorImageUploadTerminalEvent): void {
    this._terminalDialogOwners.set(
      event.id,
      (this._dialogOwners.get(event.id) ?? 0) > 0,
    );
    try {
      for (const listener of [...this._terminalListeners]) listener(event);
    } finally {
      this._terminalDialogOwners.delete(event.id);
    }
  }

  /** @private Unregisters and optionally aborts one controller. */
  private _endActiveRequest(state: UploadState, abort = false): void {
    const unregister = state.unregister;
    const controller = state.controller;
    state.unregister = undefined;
    state.controller = undefined;
    unregister?.();
    if (abort && controller && !controller.signal.aborted) controller.abort();
  }

  /** @private Gets a live generation and rejects cancelled or superseded work. */
  private _currentActiveState(
    id: string,
    generation: number,
  ): UploadState | undefined {
    const state = this._states.get(id);
    return state &&
      state.generation === generation &&
      state.status === 'uploading' &&
      state.controller &&
      !state.controller.signal.aborted
      ? state
      : undefined;
  }

  /** @private Builds the exact public pending shape. */
  private _toPendingUpload(
    state: UploadState,
    progress: number,
    error?: MlvEditorError,
  ): MlvEditorPendingUpload {
    return {
      id: state.id,
      file: state.file,
      source: state.source,
      progress,
      status: state.status,
      ...(error === undefined ? {} : { error }),
    };
  }

  /** @private Replaces one immutable public pending entry. */
  private _replacePending(upload: MlvEditorPendingUpload): void {
    this._pending.update((pending) =>
      pending.map((candidate) =>
        candidate.id === upload.id ? upload : candidate,
      ),
    );
  }

  /** @private Removes one public pending entry. */
  private _removePending(id: string): void {
    this._pending.update((pending) =>
      pending.filter((candidate) => candidate.id !== id),
    );
  }

  /** @private Inserts a non-serializable placeholder before invoking an adapter. */
  private _insertPlaceholder(editor: Editor, state: UploadState): boolean {
    try {
      return (
        typeof editor.commands.insertUploadPlaceholder === 'function' &&
        editor.commands.insertUploadPlaceholder({
          id: state.id,
          ...(state.position === undefined ? {} : { position: state.position }),
          progress: 0,
        })
      );
    } catch {
      return false;
    }
  }

  /** @private Updates one current placeholder without mutating the document. */
  private _updatePlaceholder(
    editor: Editor | null,
    id: string,
    progress: number,
  ): boolean {
    try {
      return (
        !!editor &&
        typeof editor.commands.updateUploadPlaceholder === 'function' &&
        editor.commands.updateUploadPlaceholder({ id, progress })
      );
    } catch {
      return false;
    }
  }

  /** @private Removes one placeholder when its extension remains available. */
  private _removePlaceholder(editor: Editor | null, id: string): void {
    try {
      if (typeof editor?.commands.removeUploadPlaceholder === 'function') {
        editor.commands.removeUploadPlaceholder({ id });
      }
    } catch {
      // A missing custom extension must not prevent coordinator cleanup.
    }
  }

  /** @private Atomically inserts an image at the placeholder's mapped position. */
  private _replacePlaceholder(
    editor: Editor,
    id: string,
    result: MlvEditorImageUploadResult,
  ): boolean {
    try {
      return (
        typeof editor.commands.replaceUploadPlaceholder === 'function' &&
        editor.commands.replaceUploadPlaceholder({
          id,
          attributes: result,
        })
      );
    } catch {
      return false;
    }
  }
}
