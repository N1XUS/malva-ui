import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { Editor } from '@tiptap/core';
import type { MlvEditorToolbarContext } from '../editor-toolbar-context';
import { MlvEditor } from '../editor/editor';
import { mlvEditorDefaultExtensions } from '../extensions/editor-extensions';
import { MlvEditorToolbar } from './editor-toolbar';
import { MlvEditorToolbarRoot } from './editor-toolbar-root';

@Component({
  imports: [MlvEditor],
  template: `<mlv-editor
    label="Doc"
    [toolbarAppearance]="appearance()"
    [(value)]="value"
  />`,
})
class EditorHost {
  value = '<p><a href="https://example.com">Link</a> <strong>bold</strong></p>';
  readonly appearance = signal<'bar' | 'floating'>('bar');
  readonly editor = viewChild.required(MlvEditor);
}

@Component({
  imports: [MlvEditorToolbar],
  template: '<mlv-editor-toolbar [context]="context" />',
})
class StandaloneHost {
  readonly editor = signal<Editor | null>(null);
  readonly context: MlvEditorToolbarContext = {
    editor: this.editor.asReadonly(),
    disabled: signal(false).asReadonly(),
    readonly: signal(false).asReadonly(),
    focused: signal(false).asReadonly(),
    editable: signal(true).asReadonly(),
    format: signal<'html'>('html').asReadonly(),
    zoom: signal(100),
    run: (command) => {
      const editor = this.editor();
      return editor ? command(editor) : false;
    },
    can: (command) => {
      const editor = this.editor();
      return editor ? command(editor) : false;
    },
    isActive: (name, attributes) =>
      this.editor()?.isActive(name, attributes) ?? false,
    reportError: () => undefined,
  };
}

/** Editors created outside a component, destroyed after each spec. */
const standaloneEditors: Editor[] = [];
afterEach(() => {
  for (const editor of standaloneEditors.splice(0)) editor.destroy();
});

/** The rendered group sequence, `|` for a divider. */
function sequence(root: HTMLElement): string[] {
  return [
    ...root.querySelectorAll<HTMLElement>(
      'mlv-editor-default-toolbar-groups > *',
    ),
  ].map((element) =>
    element.tagName === 'MLV-DIVIDER'
      ? '|'
      : element.tagName.toLowerCase().replace('mlv-editor-', ''),
  );
}

/** Accessible names of every toolbar widget, rendered or hidden. */
function widgetNames(root: HTMLElement): string[] {
  return [
    ...root.querySelectorAll<HTMLElement>(
      'mlv-editor-default-toolbar-groups [mlvEditorToolbarWidget]',
    ),
  ].map((element) => element.getAttribute('aria-label') ?? '');
}

async function mountEditor(configure?: (host: EditorHost) => void): Promise<{
  host: HTMLElement;
  editor: Editor;
  root: MlvEditorToolbarRoot;
  settle(): Promise<void>;
}> {
  await TestBed.configureTestingModule({
    imports: [EditorHost, StandaloneHost],
    providers: [provideMlvI18nTesting()],
  }).compileComponents();
  const fixture = TestBed.createComponent(EditorHost);
  configure?.(fixture.componentInstance);
  fixture.detectChanges();
  await fixture.whenStable();
  const editor = fixture.componentInstance.editor().editor();
  if (!editor) throw new Error('Expected a browser editor.');
  const settle = async (): Promise<void> => {
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const rootDebug = fixture.debugElement.query(
    By.directive(MlvEditorToolbarRoot),
  );
  return {
    host: fixture.nativeElement as HTMLElement,
    editor,
    root: rootDebug?.injector.get(MlvEditorToolbarRoot),
    settle,
  };
}

async function mountStandalone(editor: Editor): Promise<HTMLElement> {
  const fixture = TestBed.createComponent(StandaloneHost);
  fixture.componentInstance.editor.set(editor);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

const EXPECTED_ORDER = [
  'undo-redo',
  '|',
  'zoom',
  '|',
  'heading',
  'list',
  '|',
  'font-family',
  'font-size',
  '|',
  'inline-marks',
  '|',
  'text-color',
  'highlight',
  'clear-formatting',
  '|',
  'alignment',
  'line-height',
  '|',
  'link',
  'table',
  '|',
  'block-insert',
  '|',
  'image-upload',
];

describe('default toolbar groups (#514)', () => {
  it('renders the N1 group order', async () => {
    const { host } = await mountEditor();
    expect(sequence(host)).toEqual(EXPECTED_ORDER);
  });

  it('renders the same control set in the standalone toolbar (N1-D11)', async () => {
    const { host } = await mountEditor();
    const editor = new Editor({ extensions: mlvEditorDefaultExtensions() });
    standaloneEditors.push(editor);
    const standalone = await mountStandalone(editor);
    expect(sequence(standalone)).toEqual(sequence(host));
    expect(widgetNames(standalone).filter(Boolean)).toEqual(
      widgetNames(host).filter(Boolean),
    );
  });

  it('adds inline code, subscript and superscript toggles to the inline marks', async () => {
    const { host, editor, settle } = await mountEditor();
    const button = (name: string): HTMLButtonElement =>
      host.querySelector(
        `mlv-editor-inline-marks button[aria-label="${name}"]`,
      ) as HTMLButtonElement;
    expect(
      [...host.querySelectorAll('mlv-editor-inline-marks button')].map(
        (element) => element.getAttribute('aria-label'),
      ),
    ).toEqual([
      'Bold',
      'Italic',
      'Strike-through',
      'Underline',
      'Inline code',
      'Subscript',
      'Superscript',
    ]);

    editor.commands.setTextSelection({ from: 7, to: 11 });
    await settle();
    button('Subscript').click();
    await settle();
    expect(editor.isActive('subscript')).toBe(true);
    expect(button('Subscript').getAttribute('aria-pressed')).toBe('true');
    expect(button('Superscript').disabled).toBe(false);
    button('Superscript').click();
    await settle();
    expect(editor.isActive('subscript')).toBe(false);
    expect(button('Superscript').getAttribute('aria-pressed')).toBe('true');
  });

  it('has no axe violations with the text-style controls on the row', async () => {
    const { host, editor, settle } = await mountEditor();
    editor.commands.setTextSelection({ from: 7, to: 11 });
    editor.commands.setFontSize('18px');
    await settle();
    expect(
      host.querySelector('mlv-editor-font-size button')?.textContent?.trim(),
    ).toBe('18');
    await expectNoAxeViolations(host);
  });

  it('clears formatting but keeps the link', async () => {
    const { host, editor, settle } = await mountEditor();
    editor.commands.selectAll();
    await settle();
    (
      host.querySelector(
        'mlv-editor-clear-formatting button[aria-label="Clear formatting"]',
      ) as HTMLButtonElement
    ).click();
    await settle();
    expect(editor.getHTML()).toBe(
      '<p><a href="https://example.com">Link</a> bold</p>',
    );
  });
});
