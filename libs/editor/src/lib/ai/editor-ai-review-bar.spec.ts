import type { WritableSignal } from '@angular/core';
import { Component, signal, viewChild } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { fileURLToPath } from 'node:url';
import { compile } from 'sass';
import { MLV_EDITOR_I18N, type MlvEditorI18n } from '@malva-ui/i18n';
import {
  i18nTestProvider,
  provideMlvI18nTesting,
} from '@malva-ui/i18n/testing';
import { vi } from 'vitest';
// The documented public surface: the bar must be reachable through the
// `@malva-ui/editor/ai` facade with the same identity the primary entry has.
import { MlvEditorAiReviewBar } from '@malva-ui/editor/ai';
import type { MlvEditorError } from '../editor.types';
import { MLV_EDITOR_OVERLAY_REGISTRY } from '../editor-toolbar-context';
import type { MlvEditorOverlayRegistry } from '../editor-toolbar-context';
import { MlvEditor } from '../editor/editor';
import { MLV_EDITOR_AI_CONTEXT } from './editor-ai-context';
import type { MlvEditorAiContext } from './editor-ai-context';
import { MLV_EDITOR_AI_SUGGESTION_CURRENT_CLASS } from './editor-ai-suggestions';
import type {
  MlvEditorAiProvider,
  MlvEditorAiRequest,
} from './editor-ai.types';

@Component({
  imports: [MlvEditor, MlvEditorAiReviewBar],
  template: `
    <mlv-editor
      [value]="value()"
      (valueChange)="value.set($event)"
      [aiProvider]="provider()"
      [readonly]="readonly()"
      [disabled]="disabled()"
      (editorError)="errors.push($event)"
      (blur)="blurs.update((count) => count + 1)"
    >
      @if (showBar()) {
        <mlv-editor-ai-review-bar mlvEditorStatus />
      }
    </mlv-editor>
  `,
})
class ReviewBarHost {
  readonly value = signal<string | null>('<p>Hello world</p>');
  readonly provider = signal<MlvEditorAiProvider | undefined>(undefined);
  readonly readonly = signal(false);
  readonly disabled = signal(false);
  readonly showBar = signal(true);
  readonly blurs = signal(0);
  readonly editor = viewChild.required(MlvEditor);
  readonly errors: MlvEditorError[] = [];
}

/**
 * Compiles the bar's stylesheet through Sass. The path is joined rather than
 * a literal so Vite's static `new URL('literal', import.meta.url)` asset
 * analysis does not rewrite it into a dev-server URL — the block-handle and
 * table specs use the same pattern.
 */
function compileBarStylesheet(): string {
  return compile(
    fileURLToPath(
      new URL(['.', 'editor-ai-review-bar.scss'].join('/'), import.meta.url),
    ),
  ).css;
}

/** Records every request and streams the given chunks when unblocked. */
function createRecordingProvider(chunks: readonly string[]) {
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

describe('MlvEditorAiReviewBar', () => {
  let fixture: ComponentFixture<ReviewBarHost>;
  let editorCopy: WritableSignal<MlvEditorI18n>;
  const scrollIntoView = vi.fn();

  beforeAll(() => {
    // jsdom has no scrollIntoView; the context guards on its presence.
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      writable: true,
      value: scrollIntoView,
    });
  });

  afterAll(() => {
    delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
    vi.restoreAllMocks();
  });

  beforeEach(async () => {
    scrollIntoView.mockClear();
    await TestBed.configureTestingModule({
      imports: [ReviewBarHost],
      providers: [provideMlvI18nTesting(), i18nTestProvider(MLV_EDITOR_I18N)],
    }).compileComponents();
    fixture = TestBed.createComponent(ReviewBarHost);
    editorCopy = TestBed.inject(
      MLV_EDITOR_I18N,
    ) as WritableSignal<MlvEditorI18n>;
    document.body.appendChild(fixture.nativeElement);
    await settle();
  });

  afterEach(() => {
    fixture.destroy();
    (fixture.nativeElement as HTMLElement).remove();
  });

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function aiContext(): MlvEditorAiContext {
    return fixture.debugElement
      .query(By.directive(MlvEditor))
      .injector.get(MLV_EDITOR_AI_CONTEXT) as MlvEditorAiContext;
  }

  function overlayRegistry(): MlvEditorOverlayRegistry {
    return fixture.debugElement
      .query(By.directive(MlvEditor))
      .injector.get(MLV_EDITOR_OVERLAY_REGISTRY) as MlvEditorOverlayRegistry;
  }

  function requireEditor() {
    const editor = fixture.componentInstance.editor().editor();
    if (!editor) throw new Error('Expected the editor to be created.');
    return editor;
  }

  function barHost(): HTMLElement {
    const host = (fixture.nativeElement as HTMLElement).querySelector(
      'mlv-editor-ai-review-bar',
    );
    if (!(host instanceof HTMLElement)) {
      throw new Error('Expected the review bar host.');
    }
    return host;
  }

  function labelledButton(label: string): HTMLButtonElement {
    const button = barHost().querySelector(`button[aria-label="${label}"]`);
    if (!(button instanceof HTMLButtonElement)) {
      throw new Error(`Expected the "${label}" button.`);
    }
    return button;
  }

  function textButton(text: string): HTMLButtonElement {
    const button = [...barHost().querySelectorAll('button')].find(
      (candidate) => candidate.textContent?.trim() === text,
    );
    if (!(button instanceof HTMLButtonElement)) {
      throw new Error(`Expected the "${text}" button.`);
    }
    return button;
  }

  function currentTexts(): (string | null)[] {
    return [
      ...requireEditor().view.dom.querySelectorAll(
        `.${MLV_EDITOR_AI_SUGGESTION_CURRENT_CLASS}`,
      ),
    ].map((element) => element.textContent);
  }

  /**
   * Runs one review transform over the 'Hello world' fixture selection.
   * 'Howdy world friend' yields two suggestions: a replace ('Hello' ->
   * 'Howdy') and an insert (' friend').
   */
  async function startReview(
    chunks: readonly string[] = ['Howdy world friend'],
  ) {
    const source = createRecordingProvider(chunks);
    fixture.componentInstance.provider.set(source.provider);
    await settle();
    const editor = requireEditor();
    editor.commands.setTextSelection({ from: 1, to: 12 });
    await aiContext().runTransform('improve', { output: 'review' });
    await settle();
    return { source, editor };
  }

  it('stays hidden while the AI context is idle', async () => {
    expect(barHost().hasAttribute('hidden')).toBe(true);

    const source = createRecordingProvider(['Improved']);
    fixture.componentInstance.provider.set(source.provider);
    await settle();

    // A provider alone does not show the bar — only running/reviewing do.
    expect(barHost().hasAttribute('hidden')).toBe(true);

    // The attribute must actually remove the bar from layout: the block's
    // own `display: inline-flex` overrides the UA `[hidden]` rule, so the
    // stylesheet carries an explicit guard. With it loaded, the idle bar
    // computes to `display: none` instead of a zero-size flex item.
    const style = document.createElement('style');
    style.textContent = compileBarStylesheet();
    document.head.appendChild(style);
    try {
      expect(getComputedStyle(barHost()).display).toBe('none');
    } finally {
      style.remove();
    }
  });

  it('ships the [hidden] display guard in its stylesheet', () => {
    // Pins the SCSS rule the way the other Sass-compilation specs pin theirs:
    // an author `display` declaration on the block would otherwise override
    // the UA `[hidden] { display: none }` rule wherever a host renders the
    // bar.
    const css = compileBarStylesheet();
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    try {
      const rules = [...(style.sheet?.cssRules ?? [])].filter(
        (rule): rule is CSSStyleRule => rule instanceof CSSStyleRule,
      );
      const hiddenRule = rules.find(
        ({ selectorText }) =>
          selectorText === '.mlv-editor-ai-review-bar[hidden]',
      );
      expect(hiddenRule?.style.display).toBe('none');
    } finally {
      style.remove();
    }
  });

  it('shows a stop affordance while running that cancels the transform', async () => {
    const source = createRecordingProvider(['Never lands']);
    source.gate();
    fixture.componentInstance.provider.set(source.provider);
    await settle();
    requireEditor().commands.setTextSelection({ from: 1, to: 6 });

    const run = aiContext().runTransform('improve');
    await settle();
    expect(aiContext().status()).toBe('running');
    expect(barHost().hasAttribute('hidden')).toBe(false);

    const stop = textButton('Stop generating');
    expect(stop.disabled).toBe(false);
    stop.click();
    await settle();
    source.release();
    await run;
    await settle();

    expect(source.requests[0]?.signal.aborted).toBe(true);
    expect(aiContext().status()).toBe('idle');
    expect(requireEditor().getText()).toBe('Hello world');
    expect(barHost().hasAttribute('hidden')).toBe(true);
    expect(fixture.componentInstance.errors).toEqual([]);
  });

  it('appears while reviewing with the pending count and named controls', async () => {
    await startReview();

    const host = barHost();
    expect(host.hasAttribute('hidden')).toBe(false);
    expect(host.getAttribute('role')).toBe('group');
    expect(host.getAttribute('aria-label')).toBe('AI suggestion review');
    expect(
      host.querySelector('.mlv-editor-ai-review-bar__count')?.textContent,
    ).toContain('2 suggestions');

    // Icon controls carry aria-labels; text controls their visible text.
    expect(labelledButton('Previous suggestion')).toBeInstanceOf(
      HTMLButtonElement,
    );
    expect(labelledButton('Next suggestion')).toBeInstanceOf(HTMLButtonElement);
    expect(labelledButton('Accept suggestion')).toBeInstanceOf(
      HTMLButtonElement,
    );
    expect(labelledButton('Reject suggestion')).toBeInstanceOf(
      HTMLButtonElement,
    );
    expect(textButton('Accept all')).toBeInstanceOf(HTMLButtonElement);
    expect(textButton('Reject all')).toBeInstanceOf(HTMLButtonElement);
    // Every rendered control has an accessible name.
    for (const button of host.querySelectorAll('button')) {
      const name =
        button.getAttribute('aria-label') ?? button.textContent?.trim();
      expect(name).toBeTruthy();
    }
    // The count is deliberately not a live region: the AI context already
    // announces the review lifecycle, so a live count would double-announce.
    expect(host.querySelector('[aria-live]')).toBeNull();
  });

  it('outlines the current suggestion, scrolls it into view, and cycles with next/prev', async () => {
    await startReview();

    // The first suggestion (the 'Hello' -> 'Howdy' replace) is current from
    // the start: its inserted span and removed-text widget are outlined.
    expect(currentTexts().sort()).toEqual(['Hello', 'Howdy']);
    expect(scrollIntoView).toHaveBeenCalled();

    const scrollsAfterStart = scrollIntoView.mock.calls.length;
    labelledButton('Next suggestion').click();
    await settle();
    expect(currentTexts()).toEqual([' friend']);
    expect(scrollIntoView.mock.calls.length).toBeGreaterThan(scrollsAfterStart);

    // Next from the last suggestion wraps to the first.
    labelledButton('Next suggestion').click();
    await settle();
    expect(currentTexts().sort()).toEqual(['Hello', 'Howdy']);

    // Previous from the first wraps back to the last.
    labelledButton('Previous suggestion').click();
    await settle();
    expect(currentTexts()).toEqual([' friend']);
  });

  it('describes the current suggestion to the accept/reject buttons via aria-describedby', async () => {
    await startReview();

    // The removed text lives only in the aria-hidden strikethrough widget;
    // the buttons must reference a real, non-visual description of the
    // change under decision.
    const accept = labelledButton('Accept suggestion');
    const reject = labelledButton('Reject suggestion');
    const descriptionId = accept.getAttribute('aria-describedby');
    expect(descriptionId).toBeTruthy();
    expect(reject.getAttribute('aria-describedby')).toBe(descriptionId);

    const description = document.getElementById(String(descriptionId));
    if (!description) throw new Error('Expected the description element.');
    expect(barHost().contains(description)).toBe(true);
    expect(description.textContent).toBe(
      'Suggestion 1 of 2: replaces "Hello" with "Howdy"',
    );

    // Navigation moves the description with the cursor.
    labelledButton('Next suggestion').click();
    await settle();
    expect(description.textContent).toBe(
      'Suggestion 2 of 2: inserts " friend"',
    );
  });

  it('accepting the current suggestion delegates its id and advances the cursor', async () => {
    const { editor } = await startReview();
    const first = aiContext().suggestions()[0];
    const accept = vi.spyOn(aiContext(), 'acceptSuggestion');

    labelledButton('Accept suggestion').click();
    await settle();

    expect(accept).toHaveBeenCalledExactlyOnceWith(first.id);
    // The accepted change stays; the remaining suggestion becomes current.
    expect(editor.getText()).toBe('Howdy world friend');
    expect(aiContext().suggestions()).toHaveLength(1);
    expect(
      barHost().querySelector('.mlv-editor-ai-review-bar__count')?.textContent,
    ).toContain('1 suggestion');
    expect(currentTexts()).toEqual([' friend']);
  });

  it('rejecting the current suggestion delegates its id, restores it, and advances', async () => {
    const { editor } = await startReview();
    const first = aiContext().suggestions()[0];
    const reject = vi.spyOn(aiContext(), 'rejectSuggestion');

    labelledButton('Reject suggestion').click();
    await settle();

    expect(reject).toHaveBeenCalledExactlyOnceWith(first.id);
    expect(editor.getText()).toBe('Hello world friend');
    expect(aiContext().suggestions()).toHaveLength(1);
    expect(currentTexts()).toEqual([' friend']);
  });

  it('accept all and reject all resolve the whole review and hide the bar', async () => {
    const first = await startReview();
    textButton('Accept all').click();
    await settle();
    expect(first.editor.getText()).toBe('Howdy world friend');
    expect(aiContext().status()).toBe('idle');
    expect(barHost().hasAttribute('hidden')).toBe(true);
    expect(currentTexts()).toEqual([]);

    // A fresh document for the second review — accept-all left the first
    // result in place.
    fixture.componentInstance.value.set('<p>Hello world</p>');
    await settle();
    const second = await startReview();
    expect(second.editor.getText()).toBe('Howdy world friend');
    textButton('Reject all').click();
    await settle();
    expect(second.editor.getText()).toBe('Hello world');
    expect(aiContext().status()).toBe('idle');
    expect(barHost().hasAttribute('hidden')).toBe(true);
    expect(fixture.componentInstance.errors).toEqual([]);
  });

  it('disables every control while the editor is readonly or disabled', async () => {
    await startReview();
    const controls = () => [...barHost().querySelectorAll('button')];
    expect(controls().every((button) => !button.disabled)).toBe(true);

    fixture.componentInstance.readonly.set(true);
    await settle();
    // Still reviewing — decorations and the bar stay visible, controls
    // disable to make the context's silent refusal visible.
    expect(aiContext().status()).toBe('reviewing');
    expect(barHost().hasAttribute('hidden')).toBe(false);
    expect(controls().every((button) => button.disabled)).toBe(true);

    fixture.componentInstance.readonly.set(false);
    fixture.componentInstance.disabled.set(true);
    await settle();
    expect(controls().every((button) => button.disabled)).toBe(true);

    fixture.componentInstance.disabled.set(false);
    await settle();
    expect(controls().every((button) => !button.disabled)).toBe(true);
  });

  it('joins the composite-overlay registry so bar focus never emits an editor blur', async () => {
    await startReview();
    const acceptAll = textButton('Accept all');
    expect(overlayRegistry().contains(acceptAll)).toBe(true);

    acceptAll.focus();
    await settle();
    labelledButton('Next suggestion').focus();
    await settle();
    expect(fixture.componentInstance.blurs()).toBe(0);

    // Disabling force-clears the registry; re-enabling re-registers the bar.
    fixture.componentInstance.disabled.set(true);
    await settle();
    expect(overlayRegistry().contains(acceptAll)).toBe(false);
    fixture.componentInstance.disabled.set(false);
    await settle();
    expect(overlayRegistry().contains(acceptAll)).toBe(true);
  });

  it('reacts to editor i18n changes on the group label, controls, and count', async () => {
    await startReview();
    editorCopy.update((copy) => ({
      ...copy,
      aiReviewBar: 'Révision des suggestions IA',
      aiReviewCount:
        '{count, plural, one {# suggestion à traiter} other {# suggestions à traiter}}',
      aiPreviousSuggestion: 'Suggestion précédente',
      aiAcceptAll: 'Tout accepter',
    }));
    await settle();

    expect(barHost().getAttribute('aria-label')).toBe(
      'Révision des suggestions IA',
    );
    expect(
      barHost().querySelector('.mlv-editor-ai-review-bar__count')?.textContent,
    ).toContain('2 suggestions à traiter');
    expect(labelledButton('Suggestion précédente')).toBeInstanceOf(
      HTMLButtonElement,
    );
    expect(textButton('Tout accepter')).toBeInstanceOf(HTMLButtonElement);
  });

  it('clears the current outline when the bar is destroyed mid-review', async () => {
    await startReview();
    expect(currentTexts().sort()).toEqual(['Hello', 'Howdy']);

    // Removing the bar (e.g. a host @if) must not strand a stale outline:
    // the destroy hook reveals null while the review itself continues.
    fixture.componentInstance.showBar.set(false);
    await settle();

    expect(currentTexts()).toEqual([]);
    expect(aiContext().suggestions()).toHaveLength(2);
    expect(aiContext().status()).toBe('reviewing');

    // A re-rendered bar picks the review back up and outlines the current
    // suggestion again.
    fixture.componentInstance.showBar.set(true);
    await settle();
    expect(currentTexts().sort()).toEqual(['Hello', 'Howdy']);
  });

  it('hides once a user edit drops the last suggestion', async () => {
    const { editor } = await startReview(['Hello brave world']);
    expect(barHost().hasAttribute('hidden')).toBe(false);
    expect(aiContext().suggestions()).toHaveLength(1);

    // 'brave ' occupies [7, 13]; an insertion strictly inside drops it.
    expect(editor.commands.insertContentAt(9, 'x')).toBe(true);
    await settle();

    expect(aiContext().status()).toBe('idle');
    expect(barHost().hasAttribute('hidden')).toBe(true);
    expect(currentTexts()).toEqual([]);
    expect(fixture.componentInstance.errors).toEqual([]);
  });
});
