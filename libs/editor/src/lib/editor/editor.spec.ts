import { LiveAnnouncer } from '@angular/cdk/a11y';
import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { Extension } from '@tiptap/core';
import { Markdown } from '@tiptap/markdown';
import { closeHistory } from '@tiptap/pm/history';
import StarterKit from '@tiptap/starter-kit';
import { fileURLToPath } from 'node:url';
import { compile } from 'sass';
import { stripCssLayersFromText } from '@malva-ui/internal-testing';
import { vi } from 'vitest';
import {
  MLV_EDITOR_AI_CARET_CLASS,
  MLV_EDITOR_AI_STREAMING_CHUNK_CLASS,
  MLV_EDITOR_AI_STREAMING_CLASS,
} from '../ai/editor-ai-stream';
import {
  MLV_EDITOR_AI_SUGGESTION_CURRENT_CLASS,
  MLV_EDITOR_AI_SUGGESTION_DELETE_CLASS,
  MLV_EDITOR_AI_SUGGESTION_INSERT_CLASS,
} from '../ai/editor-ai-suggestions';
import { preflightMlvEditorExtensions } from '../editor-extension-preflight';
import type { MlvEditorFormat } from '../editor.types';
import { MlvEditor } from './editor';

@Component({
  imports: [MlvEditor],
  template:
    '<mlv-editor [value]="value()" (valueChange)="value.set($event); changes.push($event)" [format]="format()" (editorReady)="ready.set($event)" (editorError)="errors.push($event)" />',
})
class EditorHost {
  readonly value = signal<string | null>(null);
  readonly format = signal<MlvEditorFormat>('html');
  readonly editor = viewChild.required(MlvEditor);
  readonly ready = signal<unknown>(null);
  readonly changes: Array<string | null> = [];
  readonly errors: Array<{ code: string }> = [];
}

/** A document whose typed block and mark attributes HTML would flatten. */
const RICH_JSON_DOCUMENT = {
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { level: 2, textAlign: 'center' },
      content: [
        {
          type: 'text',
          text: 'Rich',
          marks: [
            { type: 'bold' },
            { type: 'textStyle', attrs: { color: '#123456' } },
          ],
        },
      ],
    },
    {
      type: 'paragraph',
      attrs: { textAlign: 'right' },
      content: [
        {
          type: 'text',
          text: 'Marked',
          marks: [{ type: 'highlight', attrs: { color: '#ffee00' } }],
        },
      ],
    },
  ],
} as const;

describe('MlvEditor', () => {
  async function createHost(): Promise<ComponentFixture<EditorHost>> {
    await TestBed.configureTestingModule({
      imports: [EditorHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(EditorHost);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  /** Mounts a host in JSON mode so `format` is JSON from editor construction. */
  function mountJsonHost(
    initialValue: string | null = null,
  ): ComponentFixture<EditorHost> {
    const fixture = TestBed.createComponent(EditorHost);
    fixture.componentInstance.format.set('json');
    fixture.componentInstance.value.set(initialValue);
    fixture.detectChanges();
    return fixture;
  }

  /** Configures the testing module and mounts one JSON-mode host. */
  async function createJsonHost(
    initialValue: string | null = null,
  ): Promise<ComponentFixture<EditorHost>> {
    await TestBed.configureTestingModule({
      imports: [EditorHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = mountJsonHost(initialValue);
    await fixture.whenStable();
    return fixture;
  }

  it('creates one Tiptap editor after its content mount has rendered', async () => {
    const fixture = await createHost();
    const component = fixture.componentInstance.editor();

    expect(
      fixture.nativeElement.querySelector('.mlv-editor__content'),
    ).not.toBeNull();
    expect(component.editor()).not.toBeNull();
    expect(fixture.componentInstance.ready()).toBe(component.editor());

    const initialEditor = component.editor();
    fixture.detectChanges();
    expect(component.editor()).toBe(initialEditor);
  });

  it('emits editorReady after the initial value and preserves commands issued by its handler', async () => {
    @Component({
      imports: [MlvEditor],
      template:
        '<mlv-editor [value]="value()" (valueChange)="value.set($event)" (editorReady)="onReady($event)" />',
    })
    class ReadyHost {
      readonly value = signal<string | null>('<p>Initial content</p>');
      readonly readyContents: string[] = [];
      readonly editor = viewChild.required(MlvEditor);

      onReady(editor: {
        getHTML(): string;
        commands: { setContent(value: string): boolean };
      }): void {
        this.readyContents.push(editor.getHTML());
        editor.commands.setContent('<p>Command from ready</p>');
      }
    }

    await TestBed.configureTestingModule({
      imports: [ReadyHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(ReadyHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const host = fixture.componentInstance;
    expect(host.readyContents).toHaveLength(1);
    expect(host.readyContents[0]).toContain('Initial content');
    expect(host.editor().editor()?.getHTML()).toContain('Command from ready');
    expect(host.value()).toContain('Command from ready');
  });

  it('loads external HTML without echoing a valueChange event', async () => {
    const fixture = await createHost();
    const host = fixture.componentInstance;
    const component = host.editor();
    host.value.set('<p>External value</p>');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.editor()?.getHTML()).toContain('External value');
    expect(component.value()).toBe('<p>External value</p>');
    expect(host.changes).toEqual([]);
  });

  it('keeps undo history empty after applying the initial value', async () => {
    await TestBed.configureTestingModule({
      imports: [EditorHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(EditorHost);
    fixture.componentInstance.value.set('<p>Initial content</p>');
    fixture.detectChanges();
    await fixture.whenStable();

    const editor = fixture.componentInstance.editor().editor();
    expect(editor?.getHTML()).toContain('Initial content');
    expect(editor?.can().undo()).toBe(false);

    editor?.commands.undo();
    expect(editor?.getHTML()).toContain('Initial content');
  });

  it('does not record external value applications or clears in undo history', async () => {
    const fixture = await createHost();
    const host = fixture.componentInstance;
    const editor = host.editor().editor();

    host.value.set('<p>First external</p>');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(editor?.can().undo()).toBe(false);

    host.value.set('<p>Second external</p>');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(editor?.can().undo()).toBe(false);

    host.value.set(null);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(editor?.isEmpty).toBe(true);
    expect(editor?.can().undo()).toBe(false);

    editor?.commands.undo();
    expect(editor?.isEmpty).toBe(true);
  });

  it('serializes user changes and emits null for a semantically empty document', async () => {
    const fixture = await createHost();
    const host = fixture.componentInstance;
    const editor = host.editor().editor();
    expect(editor).not.toBeNull();

    editor?.commands.setContent('<p>Updated</p>');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(host.editor().value()).toContain('Updated');

    editor?.commands.clearContent();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(host.editor().value()).toBeNull();
  });

  it('switches format from current JSON without recreating the editor', async () => {
    const fixture = await createHost();
    const host = fixture.componentInstance;
    const editor = host.editor().editor();
    editor?.commands.setContent('<p>Format me</p>');
    if (editor) editor.view.dispatch(closeHistory(editor.state.tr));
    editor?.commands.insertContent('!');
    editor?.commands.setTextSelection(4);
    const selectionBeforeSwitch = editor?.state.selection.from;
    fixture.detectChanges();
    await fixture.whenStable();

    host.format.set('markdown');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(host.editor().editor()).toBe(editor);
    expect(host.editor().value()).toContain('Format me!');
    expect(editor?.state.selection.from).toBe(selectionBeforeSwitch);

    host.format.set('html');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(host.editor().editor()).toBe(editor);
    expect(host.editor().value()).toContain('Format me');
    expect(editor?.state.selection.from).toBe(selectionBeforeSwitch);

    expect(editor?.commands.undo()).toBe(true);
    expect(editor?.getText()).toBe('Format me');
  });

  it('preserves rich JSON, selection, and history across HTML and Markdown format switches', async () => {
    const fixture = await createHost();
    const host = fixture.componentInstance;
    const editor = host.editor().editor();
    if (!editor) throw new Error('Expected the browser editor to be created.');
    editor.commands.setContent({
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 2, textAlign: 'center' },
          content: [
            {
              type: 'text',
              text: 'Rich',
              marks: [
                { type: 'bold' },
                { type: 'textStyle', attrs: { color: '#123456' } },
              ],
            },
          ],
        },
        {
          type: 'paragraph',
          attrs: { textAlign: 'right' },
          content: [
            {
              type: 'text',
              text: 'Marked',
              marks: [
                { type: 'italic' },
                { type: 'highlight', attrs: { color: '#ffee00' } },
              ],
            },
          ],
        },
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                {
                  type: 'tableHeader',
                  attrs: {
                    colspan: 2,
                    rowspan: 1,
                    colwidth: null,
                    align: null,
                  },
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', text: 'Merged' }],
                    },
                  ],
                },
              ],
            },
            {
              type: 'tableRow',
              content: [
                {
                  type: 'tableCell',
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', text: 'A' }],
                    },
                  ],
                },
                {
                  type: 'tableCell',
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', text: 'B' }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
    editor.view.dispatch(closeHistory(editor.state.tr));
    editor.commands.setTextSelection(2);
    editor.commands.insertContent('!');
    const jsonBeforeSwitch = editor.getJSON();
    const selectionBeforeSwitch = editor.state.selection.toJSON();

    host.format.set('markdown');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(host.editor().editor()).toBe(editor);
    expect(host.value()).toContain('<span style="color: rgb(18, 52, 86)');
    expect(host.value()).toContain('<mark data-color="#ffee00"');
    expect(host.value()).toContain('<table');
    expect(editor.getJSON()).toEqual(jsonBeforeSwitch);
    expect(editor.state.selection.toJSON()).toEqual(selectionBeforeSwitch);

    host.format.set('html');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(host.editor().editor()).toBe(editor);
    expect(host.value()).toContain('<table');
    expect(editor.getJSON()).toEqual(jsonBeforeSwitch);
    expect(editor.state.selection.toJSON()).toEqual(selectionBeforeSwitch);
    expect(editor.commands.undo()).toBe(true);
    expect(editor.getText()).not.toContain('!');
    expect(editor.getJSON().content?.[2]?.type).toBe('table');
  });

  it('loads external Markdown and keeps the default editor instance stable', async () => {
    const fixture = await createHost();
    const host = fixture.componentInstance;
    host.format.set('markdown');
    host.value.set('## External markdown');
    fixture.detectChanges();
    await fixture.whenStable();

    const editor = host.editor().editor();
    expect(editor?.getHTML()).toContain('External markdown');
    host.changes.length = 0;
    fixture.detectChanges();
    expect(host.editor().editor()).toBe(editor);
    expect(host.changes).toEqual([]);
  });

  it('accepts a Markdown value with an unclosed inline HTML tag instead of reporting a parse error', async () => {
    // Tiptap 3.30.0 keeps only the inline content of inline HTML. Under 3.29
    // `<b>` without its closing tag built an invalid document, so the strict
    // load threw and the shell reverted the value and emitted `parse` (#291).
    const fixture = await createHost();
    const host = fixture.componentInstance;
    host.format.set('markdown');
    host.value.set('Hello <b>world');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(host.errors.map(({ code }) => code)).toEqual([]);
    expect(host.value()).toBe('Hello <b>world');
    expect(host.editor().editor()?.getText()).toBe('Hello world');
  });

  it('parses initial Markdown with rich HTML fallbacks into semantic editor content', async () => {
    @Component({
      imports: [MlvEditor],
      template:
        '<mlv-editor format="markdown" [value]="value()" (valueChange)="value.set($event)" />',
    })
    class RichMarkdownHost {
      readonly value = signal<string | null>(
        '<h2 style="text-align: center"><strong><span style="color: #123456">Heading</span></strong></h2>\n\n<p style="text-align: right"><mark data-color="#ffee00" style="background-color: #ffee00; color: inherit">Marked</mark></p>\n\n<table><tbody><tr><th colspan="2"><p><strong>Merged</strong></p></th></tr><tr><td><p>A</p></td><td><p>B</p></td></tr></tbody></table>',
      );
      readonly editor = viewChild.required(MlvEditor);
    }

    await TestBed.configureTestingModule({
      imports: [RichMarkdownHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(RichMarkdownHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const json = fixture.componentInstance.editor().editor()?.getJSON();
    expect(json?.content?.[0]).toMatchObject({
      type: 'heading',
      attrs: { level: 2, textAlign: 'center' },
      content: [
        {
          text: 'Heading',
          marks: [
            { type: 'bold' },
            {
              type: 'textStyle',
              attrs: { color: '#123456' },
            },
          ],
        },
      ],
    });
    expect(json?.content?.[1]).toMatchObject({
      type: 'paragraph',
      attrs: { textAlign: 'right' },
      content: [
        {
          text: 'Marked',
          marks: [
            {
              type: 'highlight',
              attrs: { color: '#ffee00' },
            },
          ],
        },
      ],
    });
    expect(json?.content?.[2]?.content?.[0]?.content?.[0]).toMatchObject({
      type: 'tableHeader',
      attrs: { colspan: 2, rowspan: 1 },
      content: [
        {
          type: 'paragraph',
          content: [{ text: 'Merged', marks: [{ type: 'bold' }] }],
        },
      ],
    });
  });

  it('emits editor lifecycle and transaction payloads and tears down once', async () => {
    const fixture = await createHost();
    const component = fixture.componentInstance.editor();
    const editor = component.editor();
    if (!editor) throw new Error('Expected the browser editor to be created.');
    const transactions: Array<{ editor: unknown; transaction: unknown }> = [];
    const selections: Array<{ editor: unknown; transaction: unknown }> = [];
    component.transaction.subscribe((event) => transactions.push(event));
    component.selectionChange.subscribe((event) => selections.push(event));
    const destroy = vi.spyOn(editor, 'destroy');

    editor?.commands.setContent('<p>Events</p>');
    editor?.commands.focus('end');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(transactions.length).toBeGreaterThan(0);
    expect(selections.length).toBeGreaterThan(0);
    expect(transactions.at(-1)?.editor).toBe(editor);
    expect(transactions.at(-1)?.transaction).toBeDefined();
    expect(selections.at(-1)?.editor).toBe(editor);
    expect(selections.at(-1)?.transaction).toBeDefined();
    fixture.destroy();
    fixture.destroy();
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it('normalizes whitespace external values to null', async () => {
    const fixture = await createHost();
    const host = fixture.componentInstance;
    host.value.set('   ');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(host.value()).toBeNull();
    expect(host.editor().editor()?.isEmpty).toBe(true);
  });

  it('reports unsupported Markdown for a literal custom extension set without changing the document', async () => {
    @Component({
      imports: [MlvEditor],
      template:
        '<mlv-editor [value]="value()" (valueChange)="value.set($event)" [format]="format()" [extensions]="extensions" (editorError)="errors.push($event)" />',
    })
    class CustomExtensionsHost {
      readonly value = signal<string | null>('<p>Custom schema</p>');
      readonly format = signal<MlvEditorFormat>('html');
      readonly extensions = [StarterKit.configure({})];
      readonly errors: Array<{ code: string }> = [];
      readonly editor = viewChild.required(MlvEditor);
    }

    await TestBed.configureTestingModule({
      imports: [CustomExtensionsHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(CustomExtensionsHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.componentInstance;
    const editor = host.editor().editor();

    host.format.set('markdown');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(host.editor().editor()).toBe(editor);
    expect(host.value()).toBe('<p>Custom schema</p>');
    expect(host.errors.at(-1)?.code).toBe('configuration');
    expect(editor?.extensionManager.extensions).toContain(host.extensions[0]);
    expect(
      editor?.extensionManager.extensions.map((extension) => extension.name),
    ).not.toContain('markdown');
  });

  it('rejects a custom extension that only impersonates the Markdown extension name', async () => {
    const fakeMarkdown = Extension.create({ name: 'markdown' });
    const warning = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    @Component({
      imports: [MlvEditor],
      template:
        '<mlv-editor format="markdown" [extensions]="extensions" [value]="value()" (valueChange)="value.set($event)" (editorError)="errors.push($event); events.push(\'error\')" (editorReady)="events.push(\'ready\')" />',
    })
    class FakeMarkdownHost {
      readonly extensions = [StarterKit.configure({}), fakeMarkdown];
      readonly value = signal<string | null>('# Markdown');
      readonly errors: Array<{ code: string }> = [];
      readonly events: string[] = [];
      readonly editor = viewChild.required(MlvEditor);
    }

    await TestBed.configureTestingModule({
      imports: [FakeMarkdownHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(FakeMarkdownHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const host = fixture.componentInstance;
    expect(host.value()).toBe('# Markdown');
    expect(host.errors.at(-1)?.code).toBe('configuration');
    expect(host.events).toEqual(['error']);
    expect(host.editor().editor()).toBeNull();
    expect(warning).not.toHaveBeenCalled();
    warning.mockRestore();
  });

  it('rejects a Markdown lookalike with empty lifecycle, storage, and command hooks before initialization', async () => {
    const lookalikeMarkdown = Extension.create({
      name: 'markdown',
      addCommands() {
        return {};
      },
      addStorage() {
        return {};
      },
      onBeforeCreate() {
        return undefined;
      },
    });
    @Component({
      imports: [MlvEditor],
      template:
        '<mlv-editor format="markdown" [extensions]="extensions" [value]="value()" (editorError)="errors.push($event)" (editorReady)="ready += 1" />',
    })
    class MarkdownLookalikeHost {
      readonly extensions = [StarterKit.configure({}), lookalikeMarkdown];
      readonly value = signal<string | null>('# Markdown');
      readonly errors: Array<{ code: string }> = [];
      readonly editor = viewChild.required(MlvEditor);
      ready = 0;
    }

    await TestBed.configureTestingModule({
      imports: [MarkdownLookalikeHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(MarkdownLookalikeHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const host = fixture.componentInstance;
    expect(host.value()).toBe('# Markdown');
    expect(host.errors.at(-1)?.code).toBe('configuration');
    expect(host.editor().editor()).toBeNull();
    expect(host.ready).toBe(0);
  });

  it('accepts configured and extended official Markdown extensions during preflight', () => {
    const configured = Markdown.configure({});
    const extended = Markdown.extend({});

    expect(
      preflightMlvEditorExtensions(
        [StarterKit.configure({}), configured],
        'markdown',
      ),
    ).toEqual({ ok: true });
    expect(
      preflightMlvEditorExtensions(
        [StarterKit.configure({}), extended],
        'markdown',
      ),
    ).toEqual({ ok: true });
  });

  it('uses a literal custom Markdown extension array without appending defaults', async () => {
    const customStarterKit = StarterKit.configure({});
    const customMarkdown = Markdown.configure({});
    @Component({
      imports: [MlvEditor],
      template:
        '<mlv-editor format="markdown" [extensions]="extensions" [value]="value()" (valueChange)="value.set($event)" />',
    })
    class CustomMarkdownHost {
      readonly extensions = [customStarterKit, customMarkdown];
      readonly value = signal<string | null>('# Custom markdown');
      readonly editor = viewChild.required(MlvEditor);
    }

    await TestBed.configureTestingModule({
      imports: [CustomMarkdownHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(CustomMarkdownHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const host = fixture.componentInstance;
    const editor = host.editor().editor();
    expect(editor?.getHTML()).toContain('Custom markdown');
    expect(editor?.getMarkdown()).toContain('Custom markdown');
    expect(editor?.extensionManager.extensions).toContain(customStarterKit);
    expect(editor?.extensionManager.extensions).toContain(customMarkdown);
    expect(
      editor?.extensionManager.extensions.map((extension) => extension.name),
    ).not.toContain('textStyle');

    editor?.commands.setContent('## Updated markdown', {
      contentType: 'markdown',
    });
    fixture.detectChanges();
    await fixture.whenStable();
    expect(host.value()).toContain('Updated markdown');
  });

  it('does not access a destroyed view query from a queued blur', async () => {
    const fixture = await createHost();
    const component = fixture.componentInstance.editor();
    component.editor()?.view.dom.dispatchEvent(new FocusEvent('blur'));
    fixture.destroy();
    await Promise.resolve();
    expect(component.editor()).toBeNull();
  });

  it('retains the prior document and value when strict external parsing fails', async () => {
    const fixture = await createHost();
    const host = fixture.componentInstance;
    const editor = host.editor().editor();
    if (!editor) throw new Error('Expected the browser editor to be created.');
    host.value.set('<p>Stable</p>');
    fixture.detectChanges();
    await fixture.whenStable();

    host.value.set(
      '<mlv-unsupported-element>Invalid</mlv-unsupported-element>',
    );
    fixture.detectChanges();
    await fixture.whenStable();

    expect(editor.getHTML()).toContain('Stable');
    expect(host.value()).toBe('<p>Stable</p>');
    expect(host.errors.at(-1)?.code).toBe('parse');
  });

  it('retains the last valid value when serialization fails', async () => {
    const fixture = await createHost();
    const host = fixture.componentInstance;
    const editor = host.editor().editor();
    if (!editor) throw new Error('Expected the browser editor to be created.');
    editor.commands.setContent('<p>Stable</p>');
    fixture.detectChanges();
    await fixture.whenStable();
    const getHtml = vi.spyOn(editor, 'getHTML').mockImplementation(() => {
      throw new Error('serializer unavailable');
    });

    editor.commands.setContent('<p>Changed</p>');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(host.value()).toBe('<p>Stable</p>');
    expect(host.errors.at(-1)?.code).toBe('serialize');
    getHtml.mockRestore();
  });

  it('uses a visible inherited label for the ProseMirror accessible name', async () => {
    @Component({
      imports: [MlvEditor],
      template: '<mlv-editor label="Body" />',
    })
    class LabelHost {}

    await TestBed.configureTestingModule({
      imports: [LabelHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(LabelHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const label = fixture.nativeElement.querySelector(
      'mlv-label',
    ) as HTMLElement;
    const textbox = fixture.nativeElement.querySelector(
      '.ProseMirror',
    ) as HTMLElement;

    expect(textbox.getAttribute('aria-labelledby')).toBe(label.id);
    expect(textbox.getAttribute('aria-label')).toBeNull();
  });

  it('reports configuration errors for an initially-Markdown literal extension set without Markdown', async () => {
    const warning = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    @Component({
      imports: [MlvEditor],
      template:
        '<mlv-editor format="markdown" [extensions]="extensions" [value]="value()" (valueChange)="value.set($event)" (editorError)="errors.push($event)" (editorReady)="ready += 1" />',
    })
    class InitialMarkdownHost {
      readonly extensions = [StarterKit.configure({})];
      readonly value = signal<string | null>('# Markdown');
      readonly errors: Array<{ code: string }> = [];
      readonly editor = viewChild.required(MlvEditor);
      ready = 0;
    }

    await TestBed.configureTestingModule({
      imports: [InitialMarkdownHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(InitialMarkdownHost);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.value()).toBe('# Markdown');
    expect(fixture.componentInstance.errors.at(-1)?.code).toBe('configuration');
    expect(fixture.componentInstance.editor().editor()).toBeNull();
    expect(fixture.componentInstance.ready).toBe(0);
    expect(warning).not.toHaveBeenCalled();
    warning.mockRestore();
  });

  it('reports duplicate flattened extension names before creating or publishing an editor', async () => {
    const warning = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    @Component({
      imports: [MlvEditor],
      template:
        '<mlv-editor [extensions]="extensions" (editorError)="errors.push($event)" (editorReady)="ready += 1" />',
    })
    class DuplicateExtensionsHost {
      readonly extensions = [
        StarterKit.configure({}),
        Extension.create({ name: 'paragraph' }),
      ];
      readonly errors: Array<{ code: string; message: string }> = [];
      readonly editor = viewChild.required(MlvEditor);
      ready = 0;
    }

    await TestBed.configureTestingModule({
      imports: [DuplicateExtensionsHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(DuplicateExtensionsHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const host = fixture.componentInstance;
    expect(host.editor().editor()).toBeNull();
    expect(host.ready).toBe(0);
    expect(host.errors.at(-1)).toMatchObject({
      code: 'configuration',
      message: expect.stringContaining('paragraph'),
    });
    expect(warning).not.toHaveBeenCalled();
    warning.mockRestore();
  });

  it('reports a third-party addExtensions failure before editor construction', async () => {
    const brokenKit = Extension.create({
      name: 'brokenKit',
      addExtensions() {
        throw new Error('broken composition');
      },
    });
    @Component({
      imports: [MlvEditor],
      template:
        '<mlv-editor [extensions]="extensions" (editorError)="errors.push($event)" (editorReady)="ready += 1" />',
    })
    class BrokenExtensionsHost {
      readonly extensions = [StarterKit.configure({}), brokenKit];
      readonly errors: Array<{ code: string; cause?: unknown }> = [];
      readonly editor = viewChild.required(MlvEditor);
      ready = 0;
    }

    await TestBed.configureTestingModule({
      imports: [BrokenExtensionsHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(BrokenExtensionsHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const host = fixture.componentInstance;
    expect(host.editor().editor()).toBeNull();
    expect(host.ready).toBe(0);
    expect(host.errors.at(-1)?.code).toBe('configuration');
    expect(host.errors.at(-1)?.cause).toEqual(
      expect.objectContaining({ message: 'broken composition' }),
    );
  });

  it('passes an empty custom extension array literally and reports its schema error', async () => {
    @Component({
      imports: [MlvEditor],
      template:
        '<mlv-editor [extensions]="extensions" (editorError)="errors.push($event)" />',
    })
    class EmptyExtensionsHost {
      readonly extensions: [] = [];
      readonly errors: Array<{ code: string }> = [];
      readonly editor = viewChild.required(MlvEditor);
    }

    await TestBed.configureTestingModule({
      imports: [EmptyExtensionsHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(EmptyExtensionsHost);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.editor().editor()).toBeNull();
    expect(fixture.componentInstance.errors.at(-1)?.code).toBe('configuration');
  });

  it('round-trips a document supplied as JSON back into an equivalent document', async () => {
    const supplied = JSON.stringify(RICH_JSON_DOCUMENT);
    const fixture = await createJsonHost(supplied);
    const host = fixture.componentInstance;
    const editor = host.editor().editor();
    if (!editor) throw new Error('Expected the browser editor to be created.');

    expect(editor.getJSON()).toMatchObject(RICH_JSON_DOCUMENT);

    editor.commands.insertContent('!');
    fixture.detectChanges();
    await fixture.whenStable();

    const emitted = host.value();
    if (emitted === null) throw new Error('Expected a serialized JSON value.');
    expect(JSON.parse(emitted)).toEqual(editor.getJSON());
    expect(JSON.parse(emitted)).toMatchObject({
      content: [
        { type: 'heading', attrs: { level: 2, textAlign: 'center' } },
        {
          type: 'paragraph',
          attrs: { textAlign: 'right' },
          content: [
            { marks: [{ type: 'highlight', attrs: { color: '#ffee00' } }] },
          ],
        },
      ],
    });

    const reloaded = mountJsonHost(emitted);
    await reloaded.whenStable();
    expect(reloaded.componentInstance.editor().editor()?.getJSON()).toEqual(
      JSON.parse(emitted),
    );
    expect(reloaded.componentInstance.changes).toEqual([]);
  });

  it('applies external JSON without emitting a value change', async () => {
    const fixture = await createJsonHost();
    const host = fixture.componentInstance;
    const editor = host.editor().editor();
    if (!editor) throw new Error('Expected the browser editor to be created.');

    host.value.set(JSON.stringify(RICH_JSON_DOCUMENT));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(host.changes).toEqual([]);
    expect(editor.getText()).toContain('Rich');

    const canonical = editor.getJSON();
    const documentBefore = editor.getJSON();
    host.value.set(
      JSON.stringify(
        { content: canonical.content, type: canonical.type },
        null,
        2,
      ),
    );
    fixture.detectChanges();
    await fixture.whenStable();

    expect(host.changes).toEqual([]);
    expect(host.editor().editor()).toBe(editor);
    expect(editor.getJSON()).toEqual(documentBefore);
  });

  it('emits exactly one JSON value for a user transaction after a JSON load', async () => {
    const fixture = await createJsonHost(JSON.stringify(RICH_JSON_DOCUMENT));
    const host = fixture.componentInstance;
    const editor = host.editor().editor();
    if (!editor) throw new Error('Expected the browser editor to be created.');
    expect(host.changes).toEqual([]);

    editor.commands.insertContent('Typed');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(host.changes).toHaveLength(1);
    const emitted = host.changes[0];
    if (typeof emitted !== 'string') {
      throw new Error('Expected the emitted value to be a JSON string.');
    }
    expect(JSON.parse(emitted)).toEqual(editor.getJSON());
    expect(editor.getText()).toContain('Typed');
  });

  it.each([
    ['malformed JSON', '{"type":"doc",'],
    ['a JSON array', '[{"type":"doc"}]'],
    ['a JSON scalar', '42'],
    ['an object without a type', '{"content":[]}'],
    [
      'a node that is not the document node',
      '{"type":"paragraph","content":[{"type":"text","text":"Nope"}]}',
    ],
  ])(
    'reports %s as a recoverable parse error and keeps the last valid value',
    async (_label, invalidValue) => {
      const supplied = JSON.stringify(RICH_JSON_DOCUMENT);
      const fixture = await createJsonHost(supplied);
      const host = fixture.componentInstance;
      const editor = host.editor().editor();
      if (!editor)
        throw new Error('Expected the browser editor to be created.');
      const documentBefore = editor.getJSON();

      host.value.set(invalidValue);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(host.errors.at(-1)?.code).toBe('parse');
      expect(host.value()).toBe(supplied);
      expect(editor.getJSON()).toEqual(documentBefore);
    },
  );

  it('reports JSON with a node type outside the extension set without truncating the document', async () => {
    const supplied = JSON.stringify(RICH_JSON_DOCUMENT);
    const fixture = await createJsonHost(supplied);
    const host = fixture.componentInstance;
    const editor = host.editor().editor();
    if (!editor) throw new Error('Expected the browser editor to be created.');
    const documentBefore = editor.getJSON();

    host.value.set(
      '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Kept"}]},{"type":"mlvUnknownBlock","attrs":{"id":"7"}}]}',
    );
    fixture.detectChanges();
    await fixture.whenStable();

    expect(host.errors.at(-1)?.code).toBe('parse');
    expect(host.value()).toBe(supplied);
    expect(editor.getJSON()).toEqual(documentBefore);
    expect(editor.getText()).toContain('Rich');
    expect(editor.getText()).not.toContain('Kept');
  });

  it.each([
    ['empty', ''],
    ['whitespace-only', '  \n\t '],
    ['null', null],
  ])(
    'normalizes %s JSON to the nullable empty document',
    async (_label, emptyValue) => {
      const fixture = await createJsonHost(JSON.stringify(RICH_JSON_DOCUMENT));
      const host = fixture.componentInstance;

      host.value.set(emptyValue);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(host.value()).toBeNull();
      expect(host.editor().value()).toBeNull();
      expect(host.editor().editor()?.isEmpty).toBe(true);
      expect(host.errors).toEqual([]);
    },
  );

  it('cycles json → html → markdown → json from the live document without recreating the editor', async () => {
    const fixture = await createJsonHost(JSON.stringify(RICH_JSON_DOCUMENT));
    const host = fixture.componentInstance;
    const editor = host.editor().editor();
    if (!editor) throw new Error('Expected the browser editor to be created.');
    const documentBefore = editor.getJSON();

    host.format.set('html');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(host.editor().editor()).toBe(editor);
    expect(host.value()).toContain('<h2');
    expect(host.value()).toContain('<mark data-color="#ffee00"');

    host.format.set('markdown');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(host.editor().editor()).toBe(editor);
    expect(host.value()).toContain('Rich');

    host.format.set('json');
    fixture.detectChanges();
    await fixture.whenStable();
    const emitted = host.value();
    if (emitted === null) throw new Error('Expected a serialized JSON value.');
    expect(host.editor().editor()).toBe(editor);
    expect(JSON.parse(emitted)).toEqual(documentBefore);
    expect(editor.getJSON()).toEqual(documentBefore);
    expect(host.errors).toEqual([]);
  });

  it('passes preflight for JSON with any valid extension set while Markdown still fails', () => {
    expect(
      preflightMlvEditorExtensions([StarterKit.configure({})], 'json'),
    ).toEqual({ ok: true });
    expect(
      preflightMlvEditorExtensions([StarterKit.configure({})], 'markdown'),
    ).toMatchObject({ ok: false, error: { code: 'configuration' } });
  });

  it('defaults to the standard content measure and reflects contentWidth as a host modifier', async () => {
    @Component({
      imports: [MlvEditor],
      template: '<mlv-editor [contentWidth]="width()" />',
    })
    class MeasureHost {
      readonly width = signal<'default' | 'wide' | 'full'>('default');
      readonly editor = viewChild.required(MlvEditor);
    }

    await TestBed.configureTestingModule({
      imports: [MeasureHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(MeasureHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const host = fixture.nativeElement.querySelector(
      'mlv-editor',
    ) as HTMLElement;
    expect(host.classList).toContain('mlv-editor--content-width-default');

    fixture.componentInstance.width.set('wide');
    fixture.detectChanges();
    expect(host.classList).toContain('mlv-editor--content-width-wide');
    expect(host.classList).not.toContain('mlv-editor--content-width-default');

    fixture.componentInstance.width.set('full');
    fixture.detectChanges();
    expect(host.classList).toContain('mlv-editor--content-width-full');
    expect(fixture.componentInstance.editor().contentWidth()).toBe('full');
  });

  it('centres the ProseMirror column at the measure and reserves a gutter', () => {
    const liveStyle = document.createElement('style');
    // Built as a joined array rather than a literal so Vite's static
    // `new URL('literal', import.meta.url)` asset-URL analysis does not
    // rewrite this into a dev-server URL — see editor-table.spec.ts for the
    // same pattern.
    liveStyle.textContent = compile(
      fileURLToPath(new URL(['.', 'editor.scss'].join('/'), import.meta.url)),
    ).css;
    document.head.appendChild(liveStyle);
    try {
      const rules = [...(liveStyle.sheet?.cssRules ?? [])].filter(
        (rule): rule is CSSStyleRule => rule instanceof CSSStyleRule,
      );
      const find = (selector: string) =>
        rules.find((rule) => rule.selectorText === selector);

      expect(
        find('.mlv-editor')?.style.getPropertyValue('--mlv-editor-gutter'),
      ).toBe('var(--mlv-spacing-6)');
      expect(
        find('.mlv-editor--content-width-default')?.style.getPropertyValue(
          '--mlv-editor-measure',
        ),
      ).toBe('45rem');
      expect(
        find('.mlv-editor--content-width-wide')?.style.getPropertyValue(
          '--mlv-editor-measure',
        ),
      ).toBe('60rem');
      expect(
        find('.mlv-editor--content-width-full')?.style.getPropertyValue(
          '--mlv-editor-measure',
        ),
      ).toBe('100%');

      expect(find('.mlv-editor__view')?.style.position).toBe('relative');
      // jsdom's `cssstyle` package (v3.0.0, as pinned in this workspace) has no
      // named JS accessor for CSS logical properties (`paddingInline`,
      // `maxInlineSize`, `marginInline` all read back `undefined` even when
      // set), so these three read the raw property through
      // `getPropertyValue` instead of the camelCase accessor the physical
      // properties above use.
      expect(
        find('.mlv-editor__content')?.style.getPropertyValue('padding-inline'),
      ).toBe('var(--mlv-editor-gutter)');
      expect(
        find('.mlv-editor .ProseMirror')?.style.getPropertyValue(
          'max-inline-size',
        ),
      ).toBe('var(--mlv-editor-measure)');
      expect(
        find('.mlv-editor .ProseMirror')?.style.getPropertyValue(
          'margin-inline',
        ),
      ).toBe('auto');
    } finally {
      liveStyle.remove();
    }
  });

  it('tints the AI streaming region without any layout-shifting property', () => {
    const liveStyle = document.createElement('style');
    // Joined rather than a literal for the same Vite asset-URL reason as the
    // column test above.
    liveStyle.textContent = compile(
      fileURLToPath(new URL(['.', 'editor.scss'].join('/'), import.meta.url)),
    ).css;
    document.head.appendChild(liveStyle);
    try {
      const streaming = [...(liveStyle.sheet?.cssRules ?? [])]
        .filter((rule): rule is CSSStyleRule => rule instanceof CSSStyleRule)
        .find(
          (rule) => rule.selectorText === `.${MLV_EDITOR_AI_STREAMING_CLASS}`,
        );

      // The engine applies the class through an inline decoration; without
      // this rule the documented "subtle decoration" renders as nothing.
      expect(streaming).toBeDefined();
      expect(streaming?.style.getPropertyValue('background-color')).toBe(
        'var(--mlv-background-accent-1-pale)',
      );

      // The decorated region is rewritten on every streamed frame, so any
      // property that changes the box's size (padding, border, outline with
      // offset, font metrics) would reflow the document mid-stream. Pin the
      // declaration list to tint-only properties.
      // Indexed access rather than `.item()`, which jsdom's `cssstyle`
      // implementation does not provide.
      const declared = Array.from(
        { length: streaming?.style.length ?? 0 },
        (_, index) => streaming?.style[index],
      );
      expect(
        declared.every(
          (property) =>
            property === 'background-color' || property === 'border-radius',
        ),
      ).toBe(true);
    } finally {
      liveStyle.remove();
    }
  });

  it('tints AI suggestion insertions and strikes deletions without layout-shifting properties', () => {
    // Asserted against the compiled CSS text rather than a live CSSOM: jsdom's
    // `cssstyle` drops `text-decoration-line`, which this rule pins.
    // The stylesheet ships inside `@layer mlv.components`; these assertions
    // anchor rules and keyframes to the start of a line, so the wrapper is
    // flattened away first.
    const css = stripCssLayersFromText(
      compile(
        fileURLToPath(new URL(['.', 'editor.scss'].join('/'), import.meta.url)),
      ).css,
    );
    const declarationsOf = (selector: string): Map<string, string> => {
      const match = css.match(
        new RegExp(`\\.${selector}\\s*\\{([^}]*)\\}`, 'm'),
      );
      if (!match) throw new Error(`Expected a .${selector} rule.`);
      return new Map(
        match[1]
          .split(';')
          .map((declaration) => declaration.trim())
          .filter((declaration) => declaration.length > 0)
          .map((declaration) => {
            const separator = declaration.indexOf(':');
            return [
              declaration.slice(0, separator).trim(),
              declaration.slice(separator + 1).trim(),
            ];
          }),
      );
    };
    // Suggestion ranges remap through every concurrent transaction, so any
    // size-changing property (padding, border, outline offset, font metrics)
    // would shift layout during review. Pin both declaration lists to
    // non-layout properties only.
    const nonLayout = new Set([
      'background-color',
      'border-radius',
      'color',
      'text-decoration-line',
    ]);

    const insert = declarationsOf(MLV_EDITOR_AI_SUGGESTION_INSERT_CLASS);
    expect(insert.get('background-color')).toBe(
      'var(--mlv-background-success-pale)',
    );
    expect(
      [...insert.keys()].every((property) => nonLayout.has(property)),
    ).toBe(true);

    const deletion = declarationsOf(MLV_EDITOR_AI_SUGGESTION_DELETE_CLASS);
    expect(deletion.get('background-color')).toBe(
      'var(--mlv-background-danger-1-pale)',
    );
    expect(deletion.get('color')).toBe('var(--mlv-text-negative)');
    expect(deletion.get('text-decoration-line')).toBe('line-through');
    expect(
      [...deletion.keys()].every((property) => nonLayout.has(property)),
    ).toBe(true);

    // The current-suggestion navigation marker draws an outline: outlines
    // paint outside the box without occupying layout space, so moving the
    // marker can never shift the document. Pinned to outline properties only.
    const current = declarationsOf(MLV_EDITOR_AI_SUGGESTION_CURRENT_CLASS);
    expect(current.get('outline')).toBe(
      'var(--mlv-stroke-width-medium) solid var(--mlv-border-focus)',
    );
    expect(
      [...current.keys()].every(
        (property) => property === 'outline' || property === 'outline-offset',
      ),
    ).toBe(true);

    // The accepted-by-default document must print without the struck-out
    // text: the deletion widget joins the print hide list.
    const print = css.match(/@media print\s*\{([\s\S]*)/);
    expect(print?.[1]).toContain(`.${MLV_EDITOR_AI_SUGGESTION_DELETE_CLASS}`);
  });

  it('animates streamed chunks and the AI caret with compositor-only properties and collapses both for reduced motion and print', () => {
    // Compiled CSS text rather than a live CSSOM, matching the suggestion
    // pin above: keyframes and media queries are asserted as text.
    // The stylesheet ships inside `@layer mlv.components`; these assertions
    // anchor rules and keyframes to the start of a line, so the wrapper is
    // flattened away first.
    const css = stripCssLayersFromText(
      compile(
        fileURLToPath(new URL(['.', 'editor.scss'].join('/'), import.meta.url)),
      ).css,
    );
    const declarationsOf = (selector: string): Map<string, string> => {
      const match = css.match(
        new RegExp(`\\.${selector}\\s*\\{([^}]*)\\}`, 'm'),
      );
      if (!match) throw new Error(`Expected a .${selector} rule.`);
      return new Map(
        match[1]
          .split(';')
          .map((declaration) => declaration.trim())
          .filter((declaration) => declaration.length > 0)
          .map((declaration) => {
            const separator = declaration.indexOf(':');
            return [
              declaration.slice(0, separator).trim(),
              declaration.slice(separator + 1).trim(),
            ];
          }),
      );
    };
    const keyframePropertiesOf = (name: string): string[] => {
      const match = css.match(
        new RegExp(`@keyframes ${name}\\s*\\{([\\s\\S]*?)\\n\\}`, 'm'),
      );
      if (!match) throw new Error(`Expected @keyframes ${name}.`);
      return [...match[1].matchAll(/([a-z-]+)\s*:/g)].map(
        (property) => property[1],
      );
    };

    // The chunk rule declares nothing but its one-shot entrance animation,
    // and the keyframes touch only opacity and filter: compositor-only, so
    // neither the animation nor its end state can reflow the document.
    const chunk = declarationsOf(MLV_EDITOR_AI_STREAMING_CHUNK_CLASS);
    expect(chunk.get('animation')).toBe(
      'mlv-editor-ai-chunk-in var(--mlv-duration-normal) var(--mlv-ease-out)',
    );
    expect([...chunk.keys()]).toEqual(['animation']);
    expect(
      keyframePropertiesOf('mlv-editor-ai-chunk-in').every(
        (property) => property === 'opacity' || property === 'filter',
      ),
    ).toBe(true);

    // The caret wrapper occupies zero inline space (trailing text never
    // shifts) and the visible pulsing bar is its pseudo-element; the pulse
    // keyframes animate opacity only.
    const caret = declarationsOf(MLV_EDITOR_AI_CARET_CLASS);
    expect(caret.get('inline-size')).toBe('0');
    expect(caret.get('pointer-events')).toBe('none');
    const caretBar = declarationsOf(`${MLV_EDITOR_AI_CARET_CLASS}::after`);
    expect(caretBar.get('position')).toBe('absolute');
    expect(caretBar.get('animation')).toBe(
      'mlv-editor-ai-caret-pulse var(--mlv-duration-sluggish) var(--mlv-ease-in-out) infinite',
    );
    expect(
      keyframePropertiesOf('mlv-editor-ai-caret-pulse').every(
        (property) => property === 'opacity',
      ),
    ).toBe(true);

    // Reduced motion collapses both: the chunk appears instantly at full
    // opacity and the caret becomes a static bar.
    const reducedMotion = css.slice(
      css.indexOf('@media (prefers-reduced-motion: reduce)'),
    );
    expect(reducedMotion).toMatch(
      new RegExp(
        `\\.${MLV_EDITOR_AI_STREAMING_CHUNK_CLASS},\\s*\\.${MLV_EDITOR_AI_CARET_CLASS}::after\\s*\\{\\s*animation: none;\\s*\\}`,
      ),
    );

    // Print hides the caret outright; the chunk wraps real streamed text, so
    // print drops its animation instead (full opacity, never mid-fade).
    const printCss = css.slice(
      css.indexOf('@media print'),
      css.indexOf('@media (hover: none)'),
    );
    expect(printCss).toMatch(
      new RegExp(`\\.${MLV_EDITOR_AI_CARET_CLASS}\\s*\\{\\s*display: none;`),
    );
    expect(printCss).toMatch(
      new RegExp(
        `\\.${MLV_EDITOR_AI_STREAMING_CHUNK_CLASS}\\s*\\{\\s*animation: none;\\s*\\}`,
      ),
    );
  });

  it('announces a keyboard block move through the live announcer', async () => {
    const fixture = await createHost();
    const host = fixture.componentInstance;
    const editor = host.editor().editor();
    if (!editor) throw new Error('Expected the browser editor to be created.');
    const announce = vi.spyOn(TestBed.inject(LiveAnnouncer), 'announce');

    editor.commands.setContent('<p>A</p><p>B</p>');
    editor.commands.setTextSelection(2);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(editor.commands.moveBlockDown()).toBe(true);
    // The announcement is only truthful if the document actually reordered.
    expect(
      editor.getJSON().content?.map((block) => block.content?.[0]?.text),
    ).toEqual(['B', 'A']);
    expect(announce).toHaveBeenCalledWith(
      expect.stringContaining('paragraph'),
      'polite',
    );
  });

  it('refuses block moves while readonly', async () => {
    @Component({
      imports: [MlvEditor],
      template: '<mlv-editor readonly [value]="value()" />',
    })
    class ReadonlyMoveHost {
      readonly value = signal<string | null>('<p>A</p><p>B</p>');
      readonly editor = viewChild.required(MlvEditor);
    }

    await TestBed.configureTestingModule({
      imports: [ReadonlyMoveHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(ReadonlyMoveHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const editor = fixture.componentInstance.editor().editor();
    if (!editor) throw new Error('Expected the browser editor to be created.');
    const before = editor.getJSON();
    editor.commands.setTextSelection(2);

    expect(editor.commands.moveBlockDown()).toBe(false);
    expect(editor.getJSON()).toEqual(before);
  });
});
