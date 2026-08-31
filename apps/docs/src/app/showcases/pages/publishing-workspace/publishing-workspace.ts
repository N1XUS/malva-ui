import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Directive,
  computed,
  effect,
  inject,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import {
  LucideFileText,
  LucideHistory,
  LucideRotateCcw,
  LucideSparkles,
  LucideX,
} from '@lucide/angular';
import { MlvBreakpointService } from '@malva-ui/cdk/utils';
import { MlvAvatarGroup } from '@malva-ui/core/avatar-group';
import { MlvBadge } from '@malva-ui/core/badge';
import { MlvButton, MlvButtonIcon } from '@malva-ui/core/button';
import {
  MlvDialog,
  MlvDialogBody,
  MlvDialogClose,
  MlvDialogFooter,
  MlvDialogHeader,
  MlvDialogTemplate,
} from '@malva-ui/core/dialog';
import {
  MlvFileUpload,
  type MlvUploadedFile,
} from '@malva-ui/core/file-upload';
import { MlvNotificationService } from '@malva-ui/core/notification';
import {
  MlvPage,
  MlvPageDock,
  MlvPageDockEnd,
  MlvPageDockStart,
  MlvPageEndPane,
  MlvPageEndPaneContent,
  MlvPageEndPaneTrigger,
  MlvPageHeader,
  MlvPageHeaderActions,
  MlvPageHeaderStatus,
  MlvPageShell,
  MlvPageSidebar,
  MlvPageTitle,
} from '@malva-ui/core/page';
import {
  MlvSidebar,
  MlvSidebarGroup,
  MlvSidebarItem,
  MlvSidebarItemIcon,
  MlvSidebarTrigger,
} from '@malva-ui/core/sidebar';
import { MlvSplitPane, MlvSplitPanePanel } from '@malva-ui/core/split-pane';
import { MlvTitle } from '@malva-ui/core/title';
import { MlvEditor, type Editor } from '@malva-ui/editor';
import {
  MLV_EDITOR_AI_CONTEXT,
  MlvEditorAiMenu,
  MlvEditorAiReviewBar,
  type MlvEditorAiProvider,
  type MlvEditorAiRequest,
  type MlvEditorAiReviewSuggestion,
  type MlvEditorAiTransformKind,
} from '@malva-ui/editor/ai';
import {
  AI_CHUNK_DELAY_MS,
  AI_FALLBACK_MARKDOWN,
  ARTICLE_STATUS_META,
  ARTICLE_VERSIONS,
  CANNED_AI_MARKDOWN,
  COLLABORATORS,
  REVIEW_COMMENTS,
  UPLOAD_FAILURE_AT_PERCENT,
  UPLOAD_TICK_MS,
  UPLOAD_TICK_PERCENT,
  WORKSPACE_DOCUMENTS,
  type ArticleStatus,
  type ArticleVersion,
  type WorkspaceDocument,
} from './publishing-workspace.data';

/** Own enumerable keys only, so the lookup cannot hit `Object.prototype`. */
const CANNED_KINDS = Object.keys(CANNED_AI_MARKDOWN) as readonly string[];

/** Picks the canned response, echoing the custom-prompt instruction. */
function cannedResponse(request: MlvEditorAiRequest): string {
  if (request.kind === 'custom' && request.instruction) {
    return `**${request.instruction}** — ${CANNED_AI_MARKDOWN['custom']}`;
  }
  return CANNED_KINDS.includes(request.kind)
    ? CANNED_AI_MARKDOWN[request.kind]
    : AI_FALLBACK_MARKDOWN;
}

/** Resolves after one chunk delay, or immediately once the request aborts. */
function nextChunkDelay(signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const settle = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', settle);
      resolve();
    };
    const timer = setTimeout(settle, AI_CHUNK_DELAY_MS);
    signal.addEventListener('abort', settle, { once: true });
  });
}

/**
 * A network-free `MlvEditorAiProvider` streaming canned Markdown word by
 * word. Honouring `request.signal` is what makes the toolbar stop button and
 * Escape end the stream mid-sentence.
 */
class DocsPublishingAiProvider implements MlvEditorAiProvider {
  async *stream(request: MlvEditorAiRequest): AsyncIterable<string> {
    const chunks = cannedResponse(request).match(/\S+\s*/g) ?? [];
    for (const chunk of chunks) {
      await nextChunkDelay(request.signal);
      if (request.signal.aborted) return;
      yield chunk;
    }
  }
}

/**
 * Bridges the editor's per-instance AI context to the page. The host drives
 * review transforms and gates publishing on `hasPendingSuggestions` — a save
 * while reviewing would serialize the accepted-by-default state.
 */
@Directive({
  selector: '[docsPublishingAiGate]',
})
export class DocsPublishingAiGate {
  /** The nearest editor's AI command and review context. */
  readonly ai = inject(MLV_EDITOR_AI_CONTEXT);
}

/** Per-document working state retained while switching documents. */
interface DocumentWorkState {
  readonly title: string | null;
  readonly html: string | null;
  readonly status: ArticleStatus;
  readonly dirty: boolean;
}

@Component({
  selector: 'docs-publishing-workspace-showcase',
  imports: [
    DocsPublishingAiGate,
    MlvAvatarGroup,
    MlvBadge,
    MlvButton,
    MlvButtonIcon,
    MlvDialog,
    MlvDialogBody,
    MlvDialogClose,
    MlvDialogFooter,
    MlvDialogHeader,
    MlvDialogTemplate,
    MlvEditor,
    MlvEditorAiMenu,
    MlvEditorAiReviewBar,
    MlvFileUpload,
    MlvPage,
    MlvPageDock,
    MlvPageDockEnd,
    MlvPageDockStart,
    MlvPageEndPane,
    MlvPageEndPaneContent,
    MlvPageEndPaneTrigger,
    MlvPageHeader,
    MlvPageHeaderActions,
    MlvPageHeaderStatus,
    MlvPageShell,
    MlvPageSidebar,
    MlvPageTitle,
    MlvSidebar,
    MlvSidebarGroup,
    MlvSidebarItem,
    MlvSidebarItemIcon,
    MlvSidebarTrigger,
    MlvSplitPane,
    MlvSplitPanePanel,
    MlvTitle,
    LucideFileText,
    LucideHistory,
    LucideRotateCcw,
    LucideSparkles,
    LucideX,
  ],
  templateUrl: './publishing-workspace.html',
  styleUrl: './publishing-workspace.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublishingWorkspaceShowcaseComponent {
  private readonly _notifications = inject(MlvNotificationService);
  private readonly _breakpoints = inject(MlvBreakpointService);
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _aiGate = viewChild(DocsPublishingAiGate);
  private readonly _editorRef = viewChild(MlvEditor);
  private readonly _sidebarGroups = viewChildren(MlvSidebarGroup);
  private readonly _expandedGroups = new WeakSet<MlvSidebarGroup>();
  private readonly _documentState = new Map<string, DocumentWorkState>();
  private readonly _uploadTimers = new Map<
    string,
    ReturnType<typeof setInterval>
  >();
  private _uploadFailureShown = false;
  private _aiRun: Promise<void> = Promise.resolve();

  readonly documents = WORKSPACE_DOCUMENTS;
  readonly draftDocuments = WORKSPACE_DOCUMENTS.filter(
    (document) => document.group === 'drafts',
  );
  readonly publishedDocuments = WORKSPACE_DOCUMENTS.filter(
    (document) => document.group === 'published',
  );
  readonly versions = ARTICLE_VERSIONS;
  readonly collaborators = [...COLLABORATORS];
  readonly comments = REVIEW_COMMENTS;
  readonly aiProvider: MlvEditorAiProvider = new DocsPublishingAiProvider();

  readonly activeDocumentId = signal(WORKSPACE_DOCUMENTS[0].id);
  readonly articleTitle = signal<string | null>(WORKSPACE_DOCUMENTS[0].title);
  readonly documentHtml = signal<string | null>(
    WORKSPACE_DOCUMENTS[0].contentHtml,
  );
  readonly status = signal<ArticleStatus>(WORKSPACE_DOCUMENTS[0].status);
  readonly dirty = signal(false);
  readonly previewing = signal(false);
  readonly publishDialogOpen = signal(false);
  readonly inspectorOpened = signal(this._breakpoints.isUp('lg')());
  readonly selectedVersionId = signal<string | null>(null);
  readonly attachments = signal<MlvUploadedFile[]>([]);
  readonly workflowAnnouncement = signal('');

  readonly statusLabel = computed(
    () => ARTICLE_STATUS_META[this.status()].label,
  );
  readonly statusTone = computed(() => ARTICLE_STATUS_META[this.status()].tone);
  readonly selectedVersion = computed<ArticleVersion | null>(
    () =>
      this.versions.find(
        (version) => version.id === this.selectedVersionId(),
      ) ?? null,
  );
  readonly comparing = computed(() => this.selectedVersion() !== null);
  readonly aiBusy = computed(() => this._aiGate()?.ai.status() === 'running');
  readonly reviewSuggestion = computed<MlvEditorAiReviewSuggestion | null>(
    () => {
      const gate = this._aiGate();
      if (!gate || gate.ai.status() !== 'reviewing') return null;
      return gate.ai.suggestions()[0] ?? null;
    },
  );
  readonly publishDisabled = computed(
    () => this.status() === 'published' || this.reviewSuggestion() !== null,
  );
  readonly failedAttachments = computed(() =>
    this.attachments().filter((file) => file.state === 'error'),
  );
  readonly lastSavedLabel = computed(() => {
    if (this.dirty()) return 'Unsaved changes';
    return this.status() === 'published'
      ? 'Published just now'
      : 'All changes saved';
  });

  constructor() {
    // Auto-expand each sidebar group once so the document list is visible;
    // afterwards the user's own collapse/expand choices stand.
    effect(() => {
      for (const group of this._sidebarGroups()) {
        if (!this._expandedGroups.has(group)) {
          this._expandedGroups.add(group);
          group.expanded.set(true);
        }
      }
    });

    this._destroyRef.onDestroy(() => {
      for (const timer of this._uploadTimers.values()) clearInterval(timer);
      this._uploadTimers.clear();
      for (const file of this.attachments()) {
        if (file.previewUrl?.startsWith('blob:')) {
          URL.revokeObjectURL(file.previewUrl);
        }
      }
    });
  }

  /** Switches the workspace to another document, preserving in-session edits. */
  selectDocument(id: string): void {
    if (id === this.activeDocumentId()) return;
    const target = this.documents.find((document) => document.id === id);
    if (!target) return;
    this._saveActiveDocumentState();
    if (this.selectedVersionId() !== null) this.selectedVersionId.set(null);
    this.previewing.set(false);
    this.activeDocumentId.set(id);
    const stored = this._documentState.get(id);
    this.articleTitle.set(stored?.title ?? target.title);
    this.documentHtml.set(stored?.html ?? target.contentHtml);
    this.status.set(stored?.status ?? target.status);
    this.dirty.set(stored?.dirty ?? false);
    this.workflowAnnouncement.set(`Opened “${target.title}”.`);
  }

  /** Moves the article between the draft and in-review workflow states. */
  setStatus(status: Exclude<ArticleStatus, 'published'>): void {
    if (status === this.status()) return;
    this.status.set(status);
    this.workflowAnnouncement.set(
      `Status changed to ${ARTICLE_STATUS_META[status].label}.`,
    );
  }

  /** Marks the working copy dirty after a real editor transaction. */
  markEdited(): void {
    this.dirty.set(true);
  }

  /** Toggles the read-only preview of the article body. */
  togglePreview(): void {
    this.previewing.update((previewing) => !previewing);
  }

  /**
   * Runs a review-mode AI transform over the article's intro paragraph. The
   * result lands as tracked accept/reject suggestions in the editor.
   */
  requestSuggestion(kind: MlvEditorAiTransformKind): void {
    this._aiRun = this._runSuggestion(kind);
  }

  /** Resolves when the most recent AI run has settled. */
  aiSettled(): Promise<void> {
    return this._aiRun;
  }

  /** Accepts every pending tracked suggestion into the document. */
  acceptSuggestion(): void {
    this._aiGate()?.ai.acceptAll();
  }

  /** Rejects every pending tracked suggestion, restoring the original text. */
  rejectSuggestion(): void {
    this._aiGate()?.ai.rejectAll();
  }

  /** Opens the side-by-side comparison with a historical version. */
  selectVersion(id: string): void {
    const version = this.versions.find((candidate) => candidate.id === id);
    if (!version) return;
    this.selectedVersionId.set(id);
    this.workflowAnnouncement.set(
      `Comparing the current draft with ${version.label}.`,
    );
  }

  /** Closes the version comparison and returns to the editor. */
  closeCompare(): void {
    if (this.selectedVersionId() === null) return;
    this.selectedVersionId.set(null);
    this.workflowAnnouncement.set('Comparison closed.');
  }

  /** Opens the publish confirmation dialog; publishing waits for it. */
  openPublishDialog(): void {
    if (this.publishDisabled()) return;
    this.publishDialogOpen.set(true);
  }

  /** Publishes the article — reachable only through the confirmation. */
  confirmPublish(): void {
    if (this.status() === 'published') return;
    this.publishDialogOpen.set(false);
    this.status.set('published');
    this.dirty.set(false);
    this.workflowAnnouncement.set('Article published.');
    this._notifications.success('Article published', {
      description: `“${this.articleTitle() ?? 'Untitled article'}” is now live for readers.`,
    });
  }

  /**
   * Syncs the attachment list from the upload zone and starts the simulated
   * upload for newly added files. The first attempt in a session fails once
   * at 60% so the error and retry path stays demonstrable — everything is
   * local and deterministic; no backend is ever contacted.
   */
  onAttachmentsChange(files: MlvUploadedFile[]): void {
    const ids = new Set(files.map((file) => file.id));
    for (const [id, timer] of this._uploadTimers) {
      if (!ids.has(id)) {
        clearInterval(timer);
        this._uploadTimers.delete(id);
      }
    }
    this.attachments.set([...files]);
    for (const file of files) {
      if (file.state === 'pending' && !this._uploadTimers.has(file.id)) {
        this._startUpload(file.id);
      }
    }
  }

  /** Restarts the simulated upload for a failed attachment. */
  retryUpload(id: string): void {
    const file = this.attachments().find((candidate) => candidate.id === id);
    if (!file || file.state !== 'error' || this._uploadTimers.has(id)) return;
    this._startUpload(id);
  }

  /** @private Runs one review transform against the live editor AI context. */
  private async _runSuggestion(kind: MlvEditorAiTransformKind): Promise<void> {
    const gate = this._aiGate();
    const editor = this._editorRef()?.editor();
    if (!gate || !editor || this.comparing() || this.previewing()) return;
    if (gate.ai.status() !== 'idle') return;
    const range = this._firstParagraphRange(editor);
    if (range) editor.commands.setTextSelection(range);
    await gate.ai.runTransform(kind, { output: 'review' });
  }

  /** @private Text range of the first non-empty top-level paragraph. */
  private _firstParagraphRange(
    editor: Editor,
  ): { from: number; to: number } | null {
    let range: { from: number; to: number } | null = null;
    editor.state.doc.forEach((node, offset) => {
      if (
        range === null &&
        node.type.name === 'paragraph' &&
        node.textContent.trim().length > 0
      ) {
        range = { from: offset + 1, to: offset + 1 + node.content.size };
      }
    });
    return range;
  }

  /** @private Stores the active document's working copy before switching. */
  private _saveActiveDocumentState(): void {
    this._documentState.set(this.activeDocumentId(), {
      title: this.articleTitle(),
      html: this.documentHtml(),
      status: this.status(),
      dirty: this.dirty(),
    });
  }

  /** @private Advances one attachment through the simulated upload. */
  private _startUpload(id: string): void {
    const failThisAttempt = !this._uploadFailureShown;
    this._uploadFailureShown = true;
    this._patchAttachment(id, { state: 'uploading', progress: 0 });
    const timer = setInterval(() => {
      const file = this.attachments().find((candidate) => candidate.id === id);
      if (!file) {
        this._clearUploadTimer(id);
        return;
      }
      const progress = Math.min(
        100,
        (file.progress ?? 0) + UPLOAD_TICK_PERCENT,
      );
      if (failThisAttempt && progress >= UPLOAD_FAILURE_AT_PERCENT) {
        this._clearUploadTimer(id);
        this._patchAttachment(id, {
          state: 'error',
          progress: UPLOAD_FAILURE_AT_PERCENT,
        });
        this.workflowAnnouncement.set(
          `Upload failed for ${file.name}. Retry is available.`,
        );
        return;
      }
      if (progress >= 100) {
        this._clearUploadTimer(id);
        this._patchAttachment(id, { state: 'success', progress: 100 });
        this.workflowAnnouncement.set(`Uploaded ${file.name}.`);
        return;
      }
      this._patchAttachment(id, { progress });
    }, UPLOAD_TICK_MS);
    this._uploadTimers.set(id, timer);
  }

  /** @private Clears the interval timer of one simulated upload. */
  private _clearUploadTimer(id: string): void {
    const timer = this._uploadTimers.get(id);
    if (timer !== undefined) clearInterval(timer);
    this._uploadTimers.delete(id);
  }

  /** @private Immutably patches one attachment in the list signal. */
  private _patchAttachment(id: string, patch: Partial<MlvUploadedFile>): void {
    this.attachments.update((files) =>
      files.map((file) => (file.id === id ? { ...file, ...patch } : file)),
    );
  }
}

/** Re-exported so fixtures and specs share one document shape. */
export type { WorkspaceDocument };
