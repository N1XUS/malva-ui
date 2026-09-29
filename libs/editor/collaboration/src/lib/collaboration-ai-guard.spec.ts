import { OverlayContainer } from '@angular/cdk/overlay';
import { Component, viewChild } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import {
  MLV_EDITOR_AI_CONTEXT,
  MlvEditor,
  MlvEditorAiMenu,
  runMlvEditorAiStream,
  type MlvEditorAiProvider,
  type MlvEditorAiRequest,
  type MlvEditorError,
} from '@malva-ui/editor';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvEditorCollaboration } from './collaboration';
import { MemoryCollaborationHub } from './testing/memory-relay';

/*
 * F-D15, F1 guard: AI transforms are unsupported while collaborating. The
 * engine streams interim chunks into the document, which the shared document
 * would push to every peer and then revert; its whole-document restore would
 * erase peers' edits. Every entry point refuses: the context, the menu and a
 * direct stream.
 */

@Component({
  selector: 'mlv-collaboration-ai-host',
  imports: [MlvEditor, MlvEditorCollaboration, MlvEditorAiMenu],
  template: `
    <mlv-editor
      [aiProvider]="provider"
      [mlvEditorCollaboration]="transport"
      collaborationDocumentId="doc-ai"
      collaborationInitialContent="<p>Hello world</p>"
      (editorError)="errors.push($event)"
    >
      <mlv-editor-ai-menu mlvEditorToolbarStart />
    </mlv-editor>
  `,
})
class CollaborationAiHost {
  readonly hub = new MemoryCollaborationHub('server');
  readonly transport = this.hub.endpoint();
  readonly requests: MlvEditorAiRequest[] = [];
  readonly provider: MlvEditorAiProvider = {
    stream: async function* (
      this: void,
      request: MlvEditorAiRequest,
    ): AsyncGenerator<string> {
      host.requests.push(request);
      yield 'Rewritten';
    },
  };
  readonly errors: MlvEditorError[] = [];
  readonly editor = viewChild.required(MlvEditor);
}

/** The host under test, for the provider's closure. */
let host: CollaborationAiHost;

describe('AI while collaborating (F-D15 F1 guard)', () => {
  let fixture: ComponentFixture<CollaborationAiHost>;

  const settle = async () => {
    for (let round = 0; round < 4; round++) {
      host.hub.flush();
      await Promise.resolve();
      fixture.detectChanges();
      await fixture.whenStable();
    }
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CollaborationAiHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(CollaborationAiHost);
    host = fixture.componentInstance;
    fixture.detectChanges();
    await settle();
  });

  afterEach(() => {
    fixture.destroy();
    host.hub.destroy();
  });

  const tiptap = () => {
    const editor = host.editor().editor();
    if (!editor) throw new Error('no Tiptap editor');
    return editor;
  };

  it('refuses runTransform with a configuration error and stays idle', async () => {
    const ai = fixture.debugElement
      .query((node) => node.name === 'mlv-editor')
      .injector.get(MLV_EDITOR_AI_CONTEXT);
    expect(tiptap().getText()).toBe('Hello world');

    await ai.runTransform('improve');
    expect(ai.status()).toBe('idle');
    expect(host.requests).toHaveLength(0);
    expect(
      host.errors.map((error) => [
        error.code,
        error.message,
        error.recoverable,
      ]),
    ).toEqual([
      [
        'configuration',
        'AI transforms are not supported while collaborating (yet)',
        true,
      ],
    ]);
    expect(tiptap().getText()).toBe('Hello world');
  });

  it('settles a direct stream as abandoned, without writing', async () => {
    async function* chunks(): AsyncGenerator<string> {
      yield 'Never lands';
    }
    const session = runMlvEditorAiStream(tiptap(), {
      chunks: chunks(),
      output: 'replace-selection',
    });
    const result = await session.done;
    expect([result.status, result.aborted, result.text]).toEqual([
      'abandoned',
      true,
      '',
    ]);
    expect(session.restoreCheckpoint()).toBe(false);
    expect(tiptap().getText()).toBe('Hello world');
  });

  it('disables every AI menu item', async () => {
    const trigger = (fixture.nativeElement as HTMLElement).querySelector(
      'mlv-editor-ai-menu button[aria-label="AI assist"]',
    ) as HTMLButtonElement;
    trigger.click();
    await settle();
    const items = [
      ...TestBed.inject(OverlayContainer)
        .getContainerElement()
        .querySelectorAll<HTMLElement>('[role="menu"] [role="menuitem"]'),
    ];
    expect(items.length).toBeGreaterThan(0);
    expect(items.map((item) => item.getAttribute('aria-disabled'))).toEqual(
      items.map(() => 'true'),
    );
  });
});
