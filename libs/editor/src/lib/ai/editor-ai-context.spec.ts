import { LiveAnnouncer } from '@angular/cdk/a11y';
import { Component, signal, viewChild } from '@angular/core';
import type { Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { bootstrapApplication, By } from '@angular/platform-browser';
import { renderApplication } from '@angular/platform-server';
import { MLV_EDITOR_I18N } from '@malva-ui/i18n';
import {
  i18nTestProvider,
  provideMlvI18nTesting,
} from '@malva-ui/i18n/testing';
import { vi } from 'vitest';
// The public AI surface: the context must be reachable through the
// `@malva-ui/editor/ai` facade with the same identity the editor provides.
import {
  MLV_EDITOR_AI_CONTEXT,
  MLV_EDITOR_AI_PROVIDER,
} from '@malva-ui/editor/ai';
import StarterKit from '@tiptap/starter-kit';
import type { Extensions } from '@tiptap/core';
import type { MlvEditorError } from '../editor.types';
import { MlvEditor } from '../editor/editor';
import type { MlvEditorAiContext } from './editor-ai-context';
import { MLV_EDITOR_AI_SUGGESTION_CURRENT_CLASS } from './editor-ai-suggestions';
import type {
  MlvEditorAiProvider,
  MlvEditorAiRequest,
} from './editor-ai.types';

@Component({
  imports: [MlvEditor],
  template: `<mlv-editor
    [value]="value()"
    (valueChange)="value.set($event)"
    [aiProvider]="provider()"
    [extensions]="extensions()"
    [readonly]="readonly()"
    [disabled]="disabled()"
    (editorError)="errors.push($event)"
  />`,
})
class AiHost {
  readonly value = signal<string | null>('<p>Hello world</p>');
  readonly provider = signal<MlvEditorAiProvider | undefined>(undefined);
  readonly extensions = signal<Extensions | undefined>(undefined);
  readonly readonly = signal(false);
  readonly disabled = signal(false);
  readonly editor = viewChild.required(MlvEditor);
  readonly errors: MlvEditorError[] = [];
}

/** Records every request and streams the given chunks when unblocked. */
function createRecordingProvider(chunks: readonly string[] = ['Improved']) {
  const requests: MlvEditorAiRequest[] = [];
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let gated = false;
  const provider: MlvEditorAiProvider = {
    async *stream(request) {
      requests.push(request);
      if (gated) await gate;
      yield* chunks;
    },
  };
  return {
    provider,
    requests,
    release,
    gate: () => {
      gated = true;
    },
  };
}

describe('MlvEditorAiContext', () => {
  const announcements: Array<readonly [string, string]> = [];

  async function createHost(
    providers: Provider[] = [],
    configure?: (host: AiHost) => void,
  ) {
    announcements.length = 0;
    await TestBed.configureTestingModule({
      imports: [AiHost],
      providers: [
        provideMlvI18nTesting(),
        {
          provide: LiveAnnouncer,
          useValue: {
            announce: vi.fn((message: string, politeness: string) => {
              announcements.push([message, politeness]);
              return Promise.resolve();
            }),
          },
        },
        ...providers,
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(AiHost);
    // Runs before the first change detection, so inputs the editor reads
    // only at construction (e.g. `extensions`) take effect.
    configure?.(fixture.componentInstance);
    fixture.detectChanges();
    await fixture.whenStable();
    const context = fixture.debugElement
      .query(By.directive(MlvEditor))
      .injector.get(MLV_EDITOR_AI_CONTEXT) as MlvEditorAiContext;
    return { fixture, host: fixture.componentInstance, context };
  }

  function requireEditor(host: AiHost) {
    const editor = host.editor().editor();
    if (!editor) throw new Error('Expected the editor to be created.');
    return editor;
  }

  it('prefers the aiProvider input over the injected token', async () => {
    const token = createRecordingProvider();
    const { fixture, host, context } = await createHost([
      { provide: MLV_EDITOR_AI_PROVIDER, useValue: token.provider },
    ]);
    const input = createRecordingProvider();
    host.provider.set(input.provider);
    fixture.detectChanges();

    expect(context.hasProvider()).toBe(true);
    await context.runTransform('improve');

    expect(input.requests).toHaveLength(1);
    expect(token.requests).toHaveLength(0);
    expect(host.errors).toEqual([]);
  });

  it('falls back to MLV_EDITOR_AI_PROVIDER and reacts to a later input', async () => {
    const token = createRecordingProvider();
    const { fixture, host, context } = await createHost([
      { provide: MLV_EDITOR_AI_PROVIDER, useValue: token.provider },
    ]);

    expect(context.hasProvider()).toBe(true);
    await context.runTransform('improve');
    expect(token.requests).toHaveLength(1);

    const input = createRecordingProvider(['Again']);
    host.provider.set(input.provider);
    fixture.detectChanges();
    await context.runTransform('improve');
    expect(input.requests).toHaveLength(1);
    expect(token.requests).toHaveLength(1);
  });

  it('reports a configuration error without any provider', async () => {
    const { host, context } = await createHost();

    expect(context.hasProvider()).toBe(false);
    await context.runTransform('improve');

    expect(host.errors).toHaveLength(1);
    expect(host.errors[0]).toMatchObject({
      code: 'configuration',
      recoverable: true,
    });
    expect(context.status()).toBe('idle');
  });

  it('shapes the request with Markdown context, kind, instruction, and abort signal', async () => {
    const { fixture, host, context } = await createHost();
    const source = createRecordingProvider(['Extra']);
    host.provider.set(source.provider);
    // A formatted fixture makes the Markdown serialization observable: a
    // silent fall-back to plain text would send 'Hello' / 'Hello world'
    // without any Markdown syntax and fail these assertions.
    host.value.set('<p>He<strong>llo</strong> world</p>');
    fixture.detectChanges();
    await fixture.whenStable();
    const editor = requireEditor(host);
    editor.commands.setTextSelection({ from: 1, to: 6 });

    await context.runTransform('tone', {
      instruction: 'formal',
      output: 'insert-below',
    });

    expect(source.requests).toHaveLength(1);
    const request = source.requests[0];
    expect(request.kind).toBe('tone');
    expect(request.instruction).toBe('formal');
    expect(request.context.selection).toBe('He**llo**');
    expect(request.context.document).toBe('He**llo** world');
    expect(request.signal).toBeInstanceOf(AbortSignal);
    // Insert-below streams into a new block after the selection's block.
    expect(editor.getText()).toContain('Hello world');
    expect(editor.getText()).toContain('Extra');
    expect(host.errors).toEqual([]);
  });

  it('falls back to plain-text context without a Markdown manager', async () => {
    // A literal replacement extension set without the Markdown extension:
    // the request must still carry usable plain-text context. The editor
    // reads `extensions` at construction, so the replacement is configured
    // before the first change detection.
    const { fixture, host, context } = await createHost([], (instance) => {
      instance.extensions.set([StarterKit.configure({})]);
      instance.value.set('<p>He<strong>llo</strong> world</p>');
    });
    const source = createRecordingProvider(['Extra']);
    host.provider.set(source.provider);
    fixture.detectChanges();
    await fixture.whenStable();
    const editor = requireEditor(host);
    editor.commands.setTextSelection({ from: 1, to: 6 });

    await context.runTransform('improve');

    expect(source.requests).toHaveLength(1);
    const request = source.requests[0];
    expect(request.context.selection).toBe('Hello');
    expect(request.context.document).toBe('Hello world');
    expect(host.errors).toEqual([]);
  });

  it('sends a null selection when nothing is selected and omits instruction', async () => {
    const { fixture, host, context } = await createHost();
    const source = createRecordingProvider(['Summary']);
    host.provider.set(source.provider);
    fixture.detectChanges();

    await context.runTransform('summarize');

    const request = source.requests[0];
    expect(request.kind).toBe('summarize');
    expect(request.instruction).toBeUndefined();
    expect(request.context.selection).toBeNull();
    expect(request.context.document).toBe('Hello world');
  });

  it('transitions idle -> running -> idle and commits the replacement', async () => {
    const { fixture, host, context } = await createHost();
    const source = createRecordingProvider(['Improved']);
    source.gate();
    host.provider.set(source.provider);
    fixture.detectChanges();
    const editor = requireEditor(host);
    editor.commands.setTextSelection({ from: 1, to: 6 });

    expect(context.status()).toBe('idle');
    const run = context.runTransform('improve');
    expect(context.status()).toBe('running');
    source.release();
    await run;

    expect(context.status()).toBe('idle');
    expect(editor.getText()).toBe('Improved world');
    expect(host.errors).toEqual([]);
  });

  it('refuses to start in readonly and disabled editors', async () => {
    const { fixture, host, context } = await createHost();
    const source = createRecordingProvider();
    host.provider.set(source.provider);
    host.readonly.set(true);
    fixture.detectChanges();

    await context.runTransform('improve');
    expect(source.requests).toHaveLength(0);
    expect(host.errors).toHaveLength(1);
    expect(host.errors[0].code).toBe('configuration');

    host.readonly.set(false);
    host.disabled.set(true);
    fixture.detectChanges();
    await context.runTransform('improve');
    expect(source.requests).toHaveLength(0);
    expect(host.errors).toHaveLength(2);
    expect(host.errors[1].code).toBe('configuration');
  });

  it('refuses a concurrent transform while one is running', async () => {
    const { fixture, host, context } = await createHost();
    const source = createRecordingProvider(['Improved']);
    source.gate();
    host.provider.set(source.provider);
    fixture.detectChanges();

    const first = context.runTransform('improve');
    await context.runTransform('improve');

    expect(host.errors).toHaveLength(1);
    expect(host.errors[0].code).toBe('configuration');
    expect(source.requests).toHaveLength(1);

    source.release();
    await first;
    expect(context.status()).toBe('idle');
  });

  it('cancels silently: aborts the request, restores the checkpoint, emits no error', async () => {
    const { fixture, host, context } = await createHost();
    const source = createRecordingProvider(['Never lands']);
    source.gate();
    host.provider.set(source.provider);
    fixture.detectChanges();
    const editor = requireEditor(host);
    editor.commands.setTextSelection({ from: 1, to: 6 });

    const run = context.runTransform('improve');
    expect(context.status()).toBe('running');
    context.cancel();
    await run;

    expect(source.requests[0].signal.aborted).toBe(true);
    expect(context.status()).toBe('idle');
    expect(editor.getText()).toBe('Hello world');
    expect(host.errors).toEqual([]);
    source.release();
  });

  it('cancels a running transform when Escape is pressed in the content region', async () => {
    const { fixture, host, context } = await createHost();
    const source = createRecordingProvider(['Never lands']);
    source.gate();
    host.provider.set(source.provider);
    fixture.detectChanges();
    const editor = requireEditor(host);
    editor.commands.setTextSelection({ from: 1, to: 6 });

    const run = context.runTransform('improve');
    expect(context.status()).toBe('running');
    const escape = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    });
    editor.view.dom.dispatchEvent(escape);
    await run;

    expect(escape.defaultPrevented).toBe(true);
    expect(source.requests[0].signal.aborted).toBe(true);
    expect(context.status()).toBe('idle');
    expect(editor.getText()).toBe('Hello world');
    expect(host.errors).toEqual([]);
    source.release();
  });

  it('returns to idle after an external edit abandons the stream: no error, no restore', async () => {
    const { fixture, host, context } = await createHost();
    const source = createRecordingProvider(['Never finishes']);
    source.gate();
    host.provider.set(source.provider);
    fixture.detectChanges();
    const editor = requireEditor(host);
    editor.commands.setTextSelection({ from: 1, to: 6 });

    const run = context.runTransform('improve');
    expect(context.status()).toBe('running');
    // A foreign transaction — not a session write — abandons the engine
    // session; the context must treat that as a silent stop.
    expect(editor.commands.insertContentAt(1, 'X')).toBe(true);
    await run;

    expect(context.status()).toBe('idle');
    // Silent: abandonment carries no error code...
    expect(host.errors).toEqual([]);
    // ...and no checkpoint restore is attempted — the external edit stays
    // exactly as it was made.
    expect(editor.getText()).toBe('XHello world');
    // The provider is released so a still-producing transport stops.
    expect(source.requests[0].signal.aborted).toBe(true);
    // The stop is announced like a cancellation, not like a failure.
    expect(announcements).toEqual([
      ['AI generation started', 'polite'],
      ['AI generation cancelled', 'polite'],
    ]);
    source.release();
  });

  it("maps a failing stream to a recoverable 'ai-transport' error and restores", async () => {
    const { fixture, host, context } = await createHost();
    const provider: MlvEditorAiProvider = {
      // eslint-disable-next-line require-yield
      async *stream() {
        throw new Error('network down');
      },
    };
    host.provider.set(provider);
    fixture.detectChanges();
    const editor = requireEditor(host);

    await context.runTransform('improve');

    expect(host.errors).toHaveLength(1);
    expect(host.errors[0]).toMatchObject({
      code: 'ai-transport',
      recoverable: true,
    });
    expect(editor.getText()).toBe('Hello world');
    expect(context.status()).toBe('idle');
  });

  it("maps a synchronously throwing provider to 'ai-transport' before starting", async () => {
    const { fixture, host, context } = await createHost();
    const provider: MlvEditorAiProvider = {
      stream() {
        throw new Error('misconfigured');
      },
    };
    host.provider.set(provider);
    fixture.detectChanges();

    await context.runTransform('improve');

    expect(host.errors).toHaveLength(1);
    expect(host.errors[0].code).toBe('ai-transport');
    expect(context.status()).toBe('idle');
    expect(announcements).toEqual([]);
  });

  it("maps whitespace-only output to a recoverable 'ai-result' error", async () => {
    const { fixture, host, context } = await createHost();
    const source = createRecordingProvider(['   ', '\n']);
    host.provider.set(source.provider);
    fixture.detectChanges();
    const editor = requireEditor(host);

    await context.runTransform('improve');

    expect(host.errors).toHaveLength(1);
    expect(host.errors[0]).toMatchObject({
      code: 'ai-result',
      recoverable: true,
    });
    expect(editor.getText()).toBe('Hello world');
  });

  it('announces start, finish, and cancellation politely with the i18n strings', async () => {
    // Overridden copy, deliberately different from the English defaults: those
    // equal the context's hardcoded fallbacks, so asserting them could never
    // tell the i18n path from a fallback that ignores the token entirely.
    const { fixture, host, context } = await createHost([
      i18nTestProvider(MLV_EDITOR_I18N, {
        aiStreamingStarted: 'Génération démarrée',
        aiStreamingFinished: 'Génération terminée',
        aiStreamingCancelled: 'Génération annulée',
      }),
    ]);
    const committed = createRecordingProvider(['Improved']);
    host.provider.set(committed.provider);
    fixture.detectChanges();

    await context.runTransform('improve');
    expect(announcements).toEqual([
      ['Génération démarrée', 'polite'],
      ['Génération terminée', 'polite'],
    ]);

    announcements.length = 0;
    const cancelled = createRecordingProvider(['Never']);
    cancelled.gate();
    host.provider.set(cancelled.provider);
    fixture.detectChanges();
    const run = context.runTransform('improve');
    context.cancel();
    await run;
    expect(announcements).toEqual([
      ['Génération démarrée', 'polite'],
      ['Génération annulée', 'polite'],
    ]);
    cancelled.release();
  });

  describe("the 'review' output mode", () => {
    /** Runs one review transform over the 'Hello world' fixture selection. */
    async function startReview(
      chunks: readonly string[],
      providers: Provider[] = [],
    ) {
      // Some review tests build several hosts; the testing module must be
      // reset before it can be configured again.
      TestBed.resetTestingModule();
      const created = await createHost(providers);
      const source = createRecordingProvider(chunks);
      created.host.provider.set(source.provider);
      created.fixture.detectChanges();
      const editor = requireEditor(created.host);
      editor.commands.setTextSelection({ from: 1, to: 12 });
      await created.context.runTransform('improve', { output: 'review' });
      return { ...created, source, editor };
    }

    /**
     * Same rule as a streaming replace: a review with nothing selected has no
     * region of its own, and the provider was handed the whole document, so the
     * collected result is applied over the whole document body.
     */
    it('reviews the whole document body when nothing is selected', async () => {
      TestBed.resetTestingModule();
      const created = await createHost();
      const source = createRecordingProvider(['Rewritten entirely']);
      created.host.provider.set(source.provider);
      created.fixture.detectChanges();
      const editor = requireEditor(created.host);
      editor.commands.setTextSelection(3);
      expect(editor.state.selection.empty).toBe(true);

      await created.context.runTransform('improve', { output: 'review' });

      expect(created.context.status()).toBe('reviewing');
      expect(editor.getText()).toBe('Rewritten entirely');
    });

    it('collects without writing, then applies suggestions and enters reviewing', async () => {
      const { fixture, host, context } = await createHost();
      const source = createRecordingProvider(['Hello brave world']);
      source.gate();
      host.provider.set(source.provider);
      fixture.detectChanges();
      const editor = requireEditor(host);
      editor.commands.setTextSelection({ from: 1, to: 12 });

      expect(context.status()).toBe('idle');
      const run = context.runTransform('improve', { output: 'review' });
      expect(context.status()).toBe('running');
      // Nothing is written while the review result streams in.
      expect(editor.getText()).toBe('Hello world');
      source.release();
      await run;

      // The applied-edits model: the document already carries the change...
      expect(context.status()).toBe('reviewing');
      expect(editor.getText()).toBe('Hello brave world');
      // ...tracked as one pending insert suggestion.
      expect(context.hasPendingSuggestions()).toBe(true);
      const pending = context.suggestions();
      expect(pending).toHaveLength(1);
      expect(pending[0]).toMatchObject({
        kind: 'insert',
        oldText: '',
        newText: 'brave ',
      });
      // The document range stays internal: the projection carries exactly
      // identity, shape, and the two texts.
      expect(Object.keys(pending[0]).sort()).toEqual([
        'id',
        'kind',
        'newText',
        'oldText',
      ]);
      expect(host.errors).toEqual([]);
      expect(announcements).toEqual([
        ['AI generation started', 'polite'],
        ['1 AI suggestion ready for review', 'polite'],
      ]);
    });

    it('acceptSuggestion keeps the change, announces, and returns to idle when the set empties', async () => {
      const { host, context, editor } = await startReview([
        'Hello brave world',
      ]);
      announcements.length = 0;

      context.acceptSuggestion(context.suggestions()[0].id);

      expect(editor.getText()).toBe('Hello brave world');
      expect(context.suggestions()).toEqual([]);
      expect(context.hasPendingSuggestions()).toBe(false);
      expect(context.status()).toBe('idle');
      expect(announcements).toEqual([['AI suggestion accepted', 'polite']]);
      expect(host.errors).toEqual([]);
    });

    it('rejectSuggestion restores the original text, announces, and returns to idle', async () => {
      const { host, context, editor } = await startReview([
        'Hello brave world',
      ]);
      announcements.length = 0;

      context.rejectSuggestion(context.suggestions()[0].id);

      expect(editor.getText()).toBe('Hello world');
      expect(context.suggestions()).toEqual([]);
      expect(context.status()).toBe('idle');
      expect(announcements).toEqual([['AI suggestion rejected', 'polite']]);
      expect(host.errors).toEqual([]);
    });

    it('acceptAll and rejectAll resolve every suggestion in one call', async () => {
      const first = await startReview(['Howdy world friend']);
      expect(first.context.suggestions().length).toBeGreaterThan(1);
      announcements.length = 0;
      first.context.acceptAll();
      expect(first.editor.getText()).toBe('Howdy world friend');
      expect(first.context.status()).toBe('idle');
      expect(first.context.suggestions()).toEqual([]);
      expect(announcements).toEqual([
        ['All AI suggestions accepted', 'polite'],
      ]);

      const second = await startReview(['Howdy world friend']);
      announcements.length = 0;
      second.context.rejectAll();
      expect(second.editor.getText()).toBe('Hello world');
      expect(second.context.status()).toBe('idle');
      expect(second.context.suggestions()).toEqual([]);
      expect(announcements).toEqual([
        ['All AI suggestions rejected', 'polite'],
      ]);
    });

    it('returns straight to idle with a polite announcement when the AI suggests no changes', async () => {
      const { host, context, editor } = await startReview(['Hello world']);

      expect(context.status()).toBe('idle');
      expect(context.suggestions()).toEqual([]);
      expect(context.hasPendingSuggestions()).toBe(false);
      expect(editor.getText()).toBe('Hello world');
      expect(host.errors).toEqual([]);
      expect(announcements).toEqual([
        ['AI generation started', 'polite'],
        ['The AI suggested no changes', 'polite'],
      ]);
    });

    it('announces no changes when a formatted-selection review echoes the region verbatim', async () => {
      // A bold word routes the suggestion engine through its whole-region
      // fallback; a provider echoing the input (common for fix-grammar on
      // already-correct text) must land on the no-changes path there too.
      TestBed.resetTestingModule();
      const { fixture, host, context } = await createHost();
      const source = createRecordingProvider(['He**llo** world']);
      host.provider.set(source.provider);
      host.value.set('<p>He<strong>llo</strong> world</p>');
      fixture.detectChanges();
      await fixture.whenStable();
      const editor = requireEditor(host);
      const html = editor.getHTML();
      // The value application above may already be undoable; the run must not
      // add a step of its own on top of it.
      const undoableBefore = editor.can().undo();
      editor.commands.setTextSelection({ from: 1, to: 12 });

      await context.runTransform('fix-grammar', { output: 'review' });

      expect(context.status()).toBe('idle');
      expect(context.suggestions()).toEqual([]);
      expect(context.hasPendingSuggestions()).toBe(false);
      expect(editor.getHTML()).toBe(html);
      expect(editor.can().undo()).toBe(undoableBefore);
      expect(host.errors).toEqual([]);
      expect(announcements).toEqual([
        ['AI generation started', 'polite'],
        ['The AI suggested no changes', 'polite'],
      ]);
    });

    it('refuses a new transform while reviewing with a recoverable configuration error', async () => {
      const { host, context, source } = await startReview([
        'Hello brave world',
      ]);
      expect(context.status()).toBe('reviewing');

      await context.runTransform('improve');

      expect(host.errors).toHaveLength(1);
      expect(host.errors[0]).toMatchObject({
        code: 'configuration',
        recoverable: true,
      });
      expect(host.errors[0].message).toContain('review');
      // The pending review is untouched and no second request was made.
      expect(context.status()).toBe('reviewing');
      expect(context.suggestions()).toHaveLength(1);
      expect(source.requests).toHaveLength(1);
    });

    it('refuses to apply collected suggestions when the editor became readonly mid-run', async () => {
      // The run guard passes at start; the editor flips to readonly while the
      // provider streams. Applying suggestions is a document mutation, so it
      // must re-pass the toolbar guard after settlement instead of
      // dispatching into the readonly editor.
      TestBed.resetTestingModule();
      const { fixture, host, context } = await createHost();
      const source = createRecordingProvider(['Hello brave world']);
      source.gate();
      host.provider.set(source.provider);
      fixture.detectChanges();
      const editor = requireEditor(host);
      editor.commands.setTextSelection({ from: 1, to: 12 });

      const run = context.runTransform('improve', { output: 'review' });
      expect(context.status()).toBe('running');
      host.readonly.set(true);
      fixture.detectChanges();
      source.release();
      await run;

      // Refused with the recoverable configuration error: no suggestions, no
      // document change, straight back to idle.
      expect(context.status()).toBe('idle');
      expect(context.suggestions()).toEqual([]);
      expect(context.hasPendingSuggestions()).toBe(false);
      expect(editor.getText()).toBe('Hello world');
      expect(host.errors).toHaveLength(1);
      expect(host.errors[0]).toMatchObject({
        code: 'configuration',
        recoverable: true,
      });
      expect(host.errors[0].message).toContain('readonly');

      // Back to editable, the same transform reviews normally.
      host.readonly.set(false);
      fixture.detectChanges();
      const again = createRecordingProvider(['Hello brave world']);
      host.provider.set(again.provider);
      fixture.detectChanges();
      editor.commands.setTextSelection({ from: 1, to: 12 });
      await context.runTransform('improve', { output: 'review' });
      expect(context.status()).toBe('reviewing');
      expect(editor.getText()).toBe('Hello brave world');
    });

    it('refuses accept and reject while readonly, keeping decorations visible', async () => {
      const { fixture, host, context, editor } = await startReview([
        'Hello brave world',
      ]);
      const id = context.suggestions()[0].id;
      announcements.length = 0;

      host.readonly.set(true);
      fixture.detectChanges();
      context.acceptSuggestion(id);
      context.rejectSuggestion(id);
      context.acceptAll();
      context.rejectAll();

      // Refused: still reviewing, document and suggestion set unchanged,
      // nothing announced.
      expect(context.status()).toBe('reviewing');
      expect(context.suggestions()).toHaveLength(1);
      expect(editor.getText()).toBe('Hello brave world');
      expect(announcements).toEqual([]);

      host.readonly.set(false);
      fixture.detectChanges();
      context.acceptSuggestion(id);
      expect(context.status()).toBe('idle');
      expect(editor.getText()).toBe('Hello brave world');
    });

    it('maps a failing review stream to ai-transport without touching the document', async () => {
      const { fixture, host, context } = await createHost();
      const provider: MlvEditorAiProvider = {
        // eslint-disable-next-line require-yield
        async *stream() {
          throw new Error('network down');
        },
      };
      host.provider.set(provider);
      fixture.detectChanges();
      const editor = requireEditor(host);
      editor.commands.setTextSelection({ from: 1, to: 12 });

      await context.runTransform('improve', { output: 'review' });

      expect(host.errors).toHaveLength(1);
      expect(host.errors[0]).toMatchObject({
        code: 'ai-transport',
        recoverable: true,
      });
      expect(editor.getText()).toBe('Hello world');
      expect(context.status()).toBe('idle');
      expect(context.suggestions()).toEqual([]);
    });

    it('maps whitespace-only review output to ai-result without touching the document', async () => {
      const { host, context, editor } = await startReview(['   ', '\n']);

      expect(host.errors).toHaveLength(1);
      expect(host.errors[0]).toMatchObject({
        code: 'ai-result',
        recoverable: true,
      });
      expect(editor.getText()).toBe('Hello world');
      expect(context.status()).toBe('idle');
      expect(context.suggestions()).toEqual([]);
    });

    it('cancels a running review collection silently', async () => {
      const { fixture, host, context } = await createHost();
      const source = createRecordingProvider(['Never lands']);
      source.gate();
      host.provider.set(source.provider);
      fixture.detectChanges();
      const editor = requireEditor(host);
      editor.commands.setTextSelection({ from: 1, to: 12 });

      const run = context.runTransform('improve', { output: 'review' });
      expect(context.status()).toBe('running');
      context.cancel();
      await run;

      expect(source.requests[0].signal.aborted).toBe(true);
      expect(context.status()).toBe('idle');
      expect(context.suggestions()).toEqual([]);
      expect(editor.getText()).toBe('Hello world');
      expect(host.errors).toEqual([]);
      source.release();
    });

    it('ends the review when a user edit drops the last intersecting suggestion', async () => {
      const { host, context, editor } = await startReview([
        'Hello brave world',
      ]);
      expect(context.status()).toBe('reviewing');

      // 'brave ' occupies [7, 13]; an insertion strictly inside drops it.
      expect(editor.commands.insertContentAt(9, 'x')).toBe(true);

      expect(context.suggestions()).toEqual([]);
      expect(context.hasPendingSuggestions()).toBe(false);
      expect(context.status()).toBe('idle');
      // The dropped suggestion is not reverted: the edited text stands.
      expect(editor.getText()).toBe('Hello brxave world');
      expect(host.errors).toEqual([]);
    });

    it('announces the current suggestion description on reveal, once per suggestion', async () => {
      const { host, context } = await startReview(['Howdy world friend']);
      const [replace, insert] = context.suggestions();
      announcements.length = 0;

      // Revealing announces the non-visual equivalent of the aria-hidden
      // decorations: position plus the removed/added text.
      context.revealSuggestion(replace.id);
      expect(announcements).toEqual([
        ['Suggestion 1 of 2: replaces "Hello" with "Howdy"', 'polite'],
      ]);

      // Re-revealing the same suggestion announces nothing new.
      context.revealSuggestion(replace.id);
      expect(announcements).toHaveLength(1);

      context.revealSuggestion(insert.id);
      expect(announcements[1]).toEqual([
        'Suggestion 2 of 2: inserts " friend"',
        'polite',
      ]);

      // Navigating back re-announces: the marker actually moved.
      context.revealSuggestion(replace.id);
      expect(announcements[2]).toEqual([
        'Suggestion 1 of 2: replaces "Hello" with "Howdy"',
        'polite',
      ]);
      expect(host.errors).toEqual([]);
    });

    it('keeps revealSuggestion available in readonly editors', async () => {
      // Revealing is a decoration-only affordance — no document step — so a
      // readonly editor's pending review stays navigable.
      const { fixture, host, context, editor } = await startReview([
        'Howdy world friend',
      ]);
      const [replace] = context.suggestions();
      host.readonly.set(true);
      fixture.detectChanges();
      announcements.length = 0;

      context.revealSuggestion(replace.id);

      const outlined = editor.view.dom.querySelectorAll(
        `.${MLV_EDITOR_AI_SUGGESTION_CURRENT_CLASS}`,
      );
      expect(outlined.length).toBeGreaterThan(0);
      expect(host.errors).toEqual([]);
      // The description announcement still serves readonly navigation.
      expect(announcements).toEqual([
        ['Suggestion 1 of 2: replaces "Hello" with "Howdy"', 'polite'],
      ]);
      expect(context.status()).toBe('reviewing');
    });

    it('describes pending suggestions per kind and returns null for unknown ids', async () => {
      const deletion = await startReview(['Hello']);
      const pending = deletion.context.suggestions();
      expect(pending).toHaveLength(1);
      expect(pending[0].kind).toBe('delete');
      expect(deletion.context.describeSuggestion(pending[0].id)).toBe(
        'Suggestion 1 of 1: removes " world"',
      );
      expect(deletion.context.describeSuggestion('mlv-ai-unknown')).toBeNull();

      // Outside a review there is nothing to describe.
      deletion.context.acceptAll();
      expect(deletion.context.describeSuggestion(pending[0].id)).toBeNull();
    });

    it('resolves the current-suggestion description through the localized templates', async () => {
      // Foreign templates, per the house pattern: English equals the
      // hardcoded fallbacks, so only overridden strings prove the token path.
      const { context } = await startReview(
        ['Howdy world friend'],
        [
          i18nTestProvider(MLV_EDITOR_I18N, {
            aiCurrentSuggestionReplace:
              'Suggestion {index} sur {count} : remplace "{oldText}" par "{newText}"',
            aiCurrentSuggestionInsert:
              'Suggestion {index} sur {count} : insère "{newText}"',
          }),
        ],
      );
      const [replace, insert] = context.suggestions();
      announcements.length = 0;

      context.revealSuggestion(replace.id);
      expect(announcements[0]).toEqual([
        'Suggestion 1 sur 2 : remplace "Hello" par "Howdy"',
        'polite',
      ]);
      expect(context.describeSuggestion(insert.id)).toBe(
        'Suggestion 2 sur 2 : insère " friend"',
      );
    });

    it('restoreCheckpoint while reviewing reverts the suggestions wholesale and ends the review', async () => {
      const { fixture, host, context, editor } = await startReview([
        'Hello brave world',
      ]);
      expect(context.status()).toBe('reviewing');
      expect(editor.getText()).toBe('Hello brave world');

      // Refused while readonly: the restore is a document mutation and runs
      // through the toolbar guard — document, suggestions, and status stay.
      host.readonly.set(true);
      fixture.detectChanges();
      context.restoreCheckpoint();
      expect(editor.getText()).toBe('Hello brave world');
      expect(context.suggestions()).toHaveLength(1);
      expect(context.status()).toBe('reviewing');

      host.readonly.set(false);
      fixture.detectChanges();
      context.restoreCheckpoint();

      // The whole-document restore drops every suggestion (the foreign-drop
      // policy) and ends the review.
      expect(editor.getHTML()).toBe('<p>Hello world</p>');
      expect(context.suggestions()).toEqual([]);
      expect(context.hasPendingSuggestions()).toBe(false);
      expect(context.status()).toBe('idle');
      expect(host.errors).toEqual([]);

      // The restore is itself exactly one undoable step: one undo returns to
      // the fully suggested document.
      expect(editor.commands.undo()).toBe(true);
      expect(editor.getText()).toBe('Hello brave world');
    });

    it('ends the review when the application is undone', async () => {
      const { host, context, editor } = await startReview([
        'Hello brave world',
      ]);
      expect(context.status()).toBe('reviewing');

      expect(editor.commands.undo()).toBe(true);

      expect(editor.getText()).toBe('Hello world');
      expect(context.suggestions()).toEqual([]);
      expect(context.status()).toBe('idle');
      expect(host.errors).toEqual([]);
    });

    it('announces the review lifecycle through the localized i18n strings', async () => {
      // Overridden copy, deliberately different from the English defaults —
      // the Phase 1 house pattern: English equals the hardcoded fallbacks,
      // so only foreign strings prove the token path is used.
      const overrides = [
        i18nTestProvider(MLV_EDITOR_I18N, {
          aiReviewStarted:
            '{count, plural, one {# suggestion à réviser} other {# suggestions à réviser}}',
          aiReviewNoChanges: 'Aucune modification suggérée',
          aiSuggestionAccepted: 'Suggestion acceptée',
          aiSuggestionRejected: 'Suggestion rejetée',
          aiAllSuggestionsAccepted: 'Toutes les suggestions acceptées',
          aiAllSuggestionsRejected: 'Toutes les suggestions rejetées',
        }),
      ];

      const reviewed = await startReview(['Howdy world friend'], overrides);
      expect(announcements[announcements.length - 1]).toEqual([
        '2 suggestions à réviser',
        'polite',
      ]);
      announcements.length = 0;
      reviewed.context.acceptSuggestion(reviewed.context.suggestions()[0].id);
      expect(announcements).toEqual([['Suggestion acceptée', 'polite']]);
      reviewed.context.rejectSuggestion(reviewed.context.suggestions()[0].id);
      expect(announcements).toEqual([
        ['Suggestion acceptée', 'polite'],
        ['Suggestion rejetée', 'polite'],
      ]);

      const bulk = await startReview(['Howdy world friend'], overrides);
      announcements.length = 0;
      bulk.context.rejectAll();
      expect(announcements).toEqual([
        ['Toutes les suggestions rejetées', 'polite'],
      ]);

      const unchanged = await startReview(['Hello world'], overrides);
      expect(unchanged.context.status()).toBe('idle');
      expect(announcements[announcements.length - 1]).toEqual([
        'Aucune modification suggérée',
        'polite',
      ]);
    });
  });

  it('restores the checkpoint of a committed transform, guarded by readonly', async () => {
    const { fixture, host, context } = await createHost();
    const source = createRecordingProvider(['Improved']);
    host.provider.set(source.provider);
    fixture.detectChanges();
    const editor = requireEditor(host);
    editor.commands.setTextSelection({ from: 1, to: 6 });

    await context.runTransform('improve');
    expect(editor.getText()).toBe('Improved world');

    host.readonly.set(true);
    fixture.detectChanges();
    context.restoreCheckpoint();
    expect(editor.getText()).toBe('Improved world');

    host.readonly.set(false);
    fixture.detectChanges();
    context.restoreCheckpoint();
    expect(editor.getText()).toBe('Hello world');
  });
});

describe('MlvEditorAiContext SSR safety', () => {
  it('server-renders the shell without invoking the provider or the engine', async () => {
    const stream = vi.fn();

    @Component({
      selector: 'mlv-editor-ai-ssr-host',
      imports: [MlvEditor],
      template: '<mlv-editor label="Body" />',
    })
    class SsrHost {}

    const html = await renderApplication(
      (context) =>
        bootstrapApplication(
          SsrHost,
          {
            providers: [
              provideMlvI18nTesting(),
              { provide: MLV_EDITOR_AI_PROVIDER, useValue: { stream } },
            ],
          },
          context,
        ),
      {
        document: '<mlv-editor-ai-ssr-host></mlv-editor-ai-ssr-host>',
        url: '/',
      },
    );

    expect(html).toContain('<mlv-editor');
    expect(html).not.toContain('ProseMirror');
    expect(stream).not.toHaveBeenCalled();
  });
});
