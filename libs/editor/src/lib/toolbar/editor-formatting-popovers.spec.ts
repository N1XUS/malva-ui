import type { InputSignal, WritableSignal } from '@angular/core';
import { Component, forwardRef, signal, viewChild } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { OverlayContainer } from '@angular/cdk/overlay';
import { Editor, type Extensions } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { MLV_EDITOR_I18N, type MlvEditorI18n } from '@malva-ui/i18n';
import {
  i18nTestProvider,
  provideMlvI18nTesting,
} from '@malva-ui/i18n/testing';
import { expectTypeOf, vi } from 'vitest';
import { MlvEditorLink, MlvEditorToolbar } from '../..';
import { MlvEditor } from '../editor/editor';
import { mlvEditorDefaultExtensions } from '../extensions/editor-extensions';
import {
  MLV_EDITOR_OVERLAY_REGISTRY,
  MLV_EDITOR_TOOLBAR_CONTEXT,
  MLV_EDITOR_TOOLBAR_REVISION,
  MLV_EDITOR_TOOLBAR_ROVING,
  MlvEditorOverlayRegistry,
  MlvEditorToolbarRevision,
  MlvEditorToolbarRovingRegistry,
  type MlvEditorToolbarContext,
} from '../editor-toolbar-context';

@Component({
  imports: [MlvEditor],
  template: `
    <mlv-editor
      [extensions]="extensions()"
      [readonly]="readonly()"
      [disabled]="disabled()"
      (blur)="blurs.update((count) => count + 1)"
    />
  `,
})
class FormattingPopoverHost {
  readonly extensions = signal<Extensions | undefined>(undefined);
  readonly readonly = signal(false);
  readonly focused = signal(false);
  readonly editable = signal(true);
  readonly disabled = signal(false);
  readonly blurs = signal(0);
  readonly editor = viewChild.required(MlvEditor);
}

@Component({
  imports: [MlvEditorLink],
  template: ` <mlv-editor-link [allowedProtocols]="protocols()" /> `,
  providers: [
    MlvEditorOverlayRegistry,
    MlvEditorToolbarRevision,
    MlvEditorToolbarRovingRegistry,
    {
      provide: MLV_EDITOR_TOOLBAR_CONTEXT,
      useExisting: forwardRef(() => LinkProtocolHost),
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
  ],
})
class LinkProtocolHost implements MlvEditorToolbarContext {
  readonly protocols = signal<readonly string[]>([' CUSTOM: ', 'https:']);
  readonly editor = signal<Editor | null>(null);
  readonly disabled = signal(false);
  readonly readonly = signal(false);
  readonly format = signal<'html'>('html');
  readonly zoom = signal(100);

  run(command: (editor: Editor) => boolean): boolean {
    const editor = this.editor();
    return editor ? command(editor) : false;
  }

  can(command: (editor: Editor) => boolean): boolean {
    const editor = this.editor();
    return editor ? command(editor) : false;
  }

  isActive(name: string, attributes?: Record<string, unknown>): boolean {
    return this.editor()?.isActive(name, attributes) ?? false;
  }

  reportError(): void {
    return undefined;
  }
}

@Component({
  imports: [MlvEditorToolbar],
  template: '<mlv-editor-toolbar [context]="context" />',
})
class StandaloneFormattingToolbarHost {
  readonly editor = signal<Editor | null>(null);
  readonly disabled = signal(false);
  readonly readonly = signal(false);
  readonly format = signal<'html'>('html');
  readonly zoom = signal(100);
  readonly focused = signal(false);
  readonly editable = signal(true);
  readonly context: MlvEditorToolbarContext = {
    editor: this.editor.asReadonly(),
    disabled: this.disabled.asReadonly(),
    readonly: this.readonly.asReadonly(),
    focused: this.focused.asReadonly(),
    editable: this.editable.asReadonly(),
    format: this.format.asReadonly(),
    zoom: this.zoom,
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

describe('MlvEditor formatting popovers', () => {
  let fixture: ComponentFixture<FormattingPopoverHost>;
  let overlayContainer: OverlayContainer;
  let editorCopy: WritableSignal<MlvEditorI18n>;

  beforeAll(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      createLinearGradient: () => ({ addColorStop: () => undefined }),
      fillRect: () => undefined,
      fillStyle: '',
    } as unknown as CanvasRenderingContext2D);
  });

  afterAll(async () => {
    await new Promise((resolve) => setTimeout(resolve));
    vi.restoreAllMocks();
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        FormattingPopoverHost,
        LinkProtocolHost,
        StandaloneFormattingToolbarHost,
      ],
      providers: [provideMlvI18nTesting(), i18nTestProvider(MLV_EDITOR_I18N)],
    }).compileComponents();
    fixture = TestBed.createComponent(FormattingPopoverHost);
    overlayContainer = TestBed.inject(OverlayContainer);
    editorCopy = TestBed.inject(
      MLV_EDITOR_I18N,
    ) as WritableSignal<MlvEditorI18n>;
    document.body.appendChild(fixture.nativeElement);
    await settle();
  });

  afterEach(() => {
    fixture.destroy();
    (fixture.nativeElement as HTMLElement).remove();
    overlayContainer.ngOnDestroy();
  });

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function recreateWithExtensions(extensions: Extensions): Promise<void> {
    fixture.destroy();
    (fixture.nativeElement as HTMLElement).remove();
    fixture = TestBed.createComponent(FormattingPopoverHost);
    fixture.componentInstance.extensions.set(extensions);
    document.body.appendChild(fixture.nativeElement);
    await settle();
  }

  function editor() {
    const instance = fixture.componentInstance.editor().editor();
    if (!instance) throw new Error('Expected a browser editor.');
    return instance;
  }

  function toolbarButton(label: string): HTMLButtonElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector(
      `button[aria-label="${label}"]`,
    );
  }

  function overlayPanel(selector: string): HTMLElement | null {
    return overlayContainer.getContainerElement().querySelector(selector);
  }

  function type(input: HTMLInputElement, value: string): void {
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function buttonByText(root: ParentNode, text: string): HTMLButtonElement {
    const button = [...root.querySelectorAll('button')].find(
      (candidate) => candidate.textContent?.trim() === text,
    );
    if (!(button instanceof HTMLButtonElement)) {
      throw new Error(`Expected button "${text}".`);
    }
    return button;
  }

  async function completeClose(): Promise<void> {
    overlayContainer
      .getContainerElement()
      .querySelector('.mlv-popup--leave')
      ?.dispatchEvent(new Event('animationend', { bubbles: true }));
    await settle();
  }

  it('composes separate text-color, highlight, and link controls in the documented order', () => {
    const controls = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll(
        'mlv-editor-inline-marks, mlv-editor-text-color, mlv-editor-highlight, mlv-editor-alignment, mlv-editor-link',
      ),
    ].map(({ localName }) => localName);

    expect(controls).toEqual([
      'mlv-editor-inline-marks',
      'mlv-editor-text-color',
      'mlv-editor-highlight',
      'mlv-editor-alignment',
      'mlv-editor-link',
    ]);
    expect(toolbarButton('Text color')).not.toBeNull();
    expect(toolbarButton('Highlight color')).not.toBeNull();
    expect(toolbarButton('Link')).not.toBeNull();
  });

  it('keeps one visible roving tab stop and navigates through color and link controls', async () => {
    await new Promise((resolve) => setTimeout(resolve));
    await settle();
    const toolbar = (fixture.nativeElement as HTMLElement).querySelector(
      '[role="toolbar"]',
    );
    if (!(toolbar instanceof HTMLElement)) {
      throw new Error('Expected editor toolbar.');
    }
    const visibleEnabled = [...toolbar.querySelectorAll('button')].filter(
      (button) => !button.disabled && !button.closest('[hidden]'),
    );
    expect(
      visibleEnabled.filter(
        (button) => button.getAttribute('tabindex') === '0',
      ),
    ).toHaveLength(1);

    const underline = toolbarButton('Underline');
    const textColor = toolbarButton('Text color');
    const highlight = toolbarButton('Highlight color');
    const alignment = toolbarButton('Alignment');
    const link = toolbarButton('Link');
    if (!underline || !textColor || !highlight || !alignment || !link) {
      throw new Error('Expected formatting navigation controls.');
    }

    underline.focus();
    for (const expected of [textColor, highlight, alignment, link]) {
      (document.activeElement as HTMLElement).dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'ArrowRight',
          bubbles: true,
          cancelable: true,
        }),
      );
      await settle();
      expect(document.activeElement).toBe(expected);
    }
    expect(
      visibleEnabled.filter(
        (button) => button.getAttribute('tabindex') === '0',
      ),
    ).toHaveLength(1);
  });

  it('applies and clears foreground and multicolour highlight independently without stealing picker focus', async () => {
    const instance = editor();
    instance.commands.setContent('<p>colourful text</p>');
    instance.commands.setTextSelection({ from: 2, to: 11 });
    const selection = {
      from: instance.state.selection.from,
      to: instance.state.selection.to,
    };

    const textTrigger = toolbarButton('Text color');
    expect(textTrigger).not.toBeNull();
    if (!textTrigger) return;
    textTrigger.click();
    await settle();
    const textPanel = overlayPanel('.mlv-color-picker-popup__panel');
    expect(textPanel).not.toBeNull();
    if (!textPanel) return;
    const textInput = textPanel.querySelector(
      'input[aria-label="Hex color value"]',
    ) as HTMLInputElement;
    textInput.focus();
    type(textInput, '#123456');
    await settle();

    expect(document.activeElement).toBe(textInput);
    expect(instance.getAttributes('textStyle')['color']).toBe('#123456');
    expect(instance.getAttributes('highlight')['color']).toBeUndefined();
    expect({
      from: instance.state.selection.from,
      to: instance.state.selection.to,
    }).toEqual(selection);
    expect(fixture.componentInstance.blurs()).toBe(0);
    buttonByText(textPanel, 'Clear').click();
    await settle();
    expect(instance.getAttributes('textStyle')['color']).toBeUndefined();

    const textEscape = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    });
    textPanel.dispatchEvent(textEscape);
    await settle();
    await completeClose();
    expect(document.activeElement).toBe(textTrigger);

    const highlightTrigger = toolbarButton('Highlight color');
    expect(highlightTrigger).not.toBeNull();
    if (!highlightTrigger) return;
    highlightTrigger.click();
    await settle();
    const highlightPanel = overlayPanel('.mlv-color-picker-popup__panel');
    if (!highlightPanel) throw new Error('Expected highlight picker.');
    const highlightInput = highlightPanel.querySelector(
      'input[aria-label="Hex color value"]',
    ) as HTMLInputElement;
    highlightInput.focus();
    type(highlightInput, '#abcdef');
    await settle();
    expect(document.activeElement).toBe(highlightInput);
    expect(instance.getAttributes('highlight')['color']).toBe('#abcdef');
    expect(instance.getAttributes('textStyle')['color']).toBeUndefined();
    expect(fixture.componentInstance.blurs()).toBe(0);
    buttonByText(highlightPanel, 'Clear').click();
    await settle();
    expect(instance.getAttributes('highlight')['color']).toBeUndefined();
  });

  it('renders distinct icon triggers and keeps capability checks mutation-free', async () => {
    const instance = editor();
    instance.commands.setContent('<p>active colours</p>');
    instance.commands.setTextSelection({ from: 2, to: 8 });
    instance.commands.setColor('#112233');
    instance.commands.toggleHighlight({ color: '#ffeeaa' });
    const before = instance.getJSON();
    await settle();

    const foreground = (
      fixture.nativeElement as HTMLElement
    ).querySelector<SVGElement>(
      'mlv-editor-text-color button[aria-label="Text color"] svg',
    );
    const background = (
      fixture.nativeElement as HTMLElement
    ).querySelector<SVGElement>(
      'mlv-editor-highlight button[aria-label="Highlight color"] svg',
    );
    expect(foreground?.getAttribute('class')).toContain('lucide-type');
    expect(background?.getAttribute('class')).toContain('lucide-highlighter');
    expect(foreground?.isSameNode(background ?? null)).toBe(false);
    expect(instance.getJSON()).toEqual(before);
  });

  it('preloads, applies, updates, and removes the whole containing link mark with Malva controls', async () => {
    const instance = editor();
    instance.commands.setContent(
      '<p>before <a href="https://old.example" target="_blank" rel="noopener noreferrer">linked words</a> after</p>',
    );
    instance.commands.setTextSelection(10);
    const trigger = toolbarButton('Link');
    expect(trigger).not.toBeNull();
    if (!trigger) return;
    trigger.click();
    await settle();

    let panel = overlayPanel('.mlv-editor-link__panel');
    expect(panel).not.toBeNull();
    if (!panel) return;
    let inputs = panel.querySelectorAll('mlv-input input');
    expect(inputs).toHaveLength(2);
    expect((inputs[0] as HTMLInputElement).value).toBe('https://old.example');
    expect((inputs[1] as HTMLInputElement).value).toBe('linked words');
    const newTabSwitch = panel.querySelector(
      'mlv-switch input[role="switch"]',
    ) as HTMLInputElement;
    expect(newTabSwitch).not.toBeNull();
    expect(newTabSwitch.checked).toBe(true);
    expect(newTabSwitch.getAttribute('aria-checked')).toBe('true');
    expect(fixture.componentInstance.blurs()).toBe(0);

    type(inputs[0] as HTMLInputElement, 'https://new.example/path');
    type(inputs[1] as HTMLInputElement, 'updated label');
    newTabSwitch.click();
    buttonByText(panel, 'Apply link').click();
    await settle();
    await completeClose();
    const updatedAnchor = instance.view.dom.querySelector('a');
    expect(updatedAnchor?.getAttribute('href')).toBe(
      'https://new.example/path',
    );
    expect(updatedAnchor?.getAttribute('target')).toBeNull();
    expect(updatedAnchor?.getAttribute('rel')).toBeNull();
    expect(updatedAnchor?.textContent).toBe('updated label');
    expect(document.activeElement).toBe(trigger);
    expect(fixture.componentInstance.blurs()).toBe(0);

    instance.commands.setTextSelection(10);
    trigger.click();
    await settle();
    panel = overlayPanel('.mlv-editor-link__panel');
    if (!panel) throw new Error('Expected reopened link editor.');
    inputs = panel.querySelectorAll('mlv-input input');
    expect((inputs[0] as HTMLInputElement).value).toBe(
      'https://new.example/path',
    );
    expect((inputs[1] as HTMLInputElement).value).toBe('updated label');
    buttonByText(panel, 'Remove link').click();
    await settle();
    await completeClose();
    expect(instance.getHTML()).toContain('updated label');
    expect(instance.getHTML()).not.toContain('<a');
  });

  it('closes the link panel on Escape, restores its trigger, and preserves composite focus', async () => {
    const instance = editor();
    instance.commands.setContent('<p>escape link</p>');
    instance.commands.setTextSelection({ from: 2, to: 8 });
    const trigger = toolbarButton('Link');
    if (!trigger) throw new Error('Expected Link trigger.');
    trigger.click();
    await settle();
    const panel = overlayPanel('.mlv-editor-link__panel');
    if (!panel) throw new Error('Expected link panel.');
    const input = panel.querySelector('mlv-input input') as HTMLInputElement;

    expect(document.activeElement).toBe(input);
    expect(fixture.componentInstance.blurs()).toBe(0);
    panel.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    await completeClose();

    expect(document.activeElement).toBe(trigger);
    expect(fixture.componentInstance.blurs()).toBe(0);
  });

  it('rejects non-allowlisted and ambiguous URLs while keeping the invalid draft visible', async () => {
    const instance = editor();
    instance.commands.setContent('<p>safe link</p>');
    instance.commands.setTextSelection({ from: 2, to: 6 });
    const trigger = toolbarButton('Link');
    expect(trigger).not.toBeNull();
    if (!trigger) return;
    trigger.click();
    await settle();
    const panel = overlayPanel('.mlv-editor-link__panel');
    if (!panel) throw new Error('Expected link panel.');
    const url = panel.querySelector('mlv-input input') as HTMLInputElement;

    for (const invalid of [
      'javascript:alert(1)',
      '//example.com',
      '/relative',
      '?query=1',
      '#fragment',
      'example.com',
    ]) {
      type(url, invalid);
      buttonByText(panel, 'Apply link').click();
      await settle();
      expect(instance.getHTML()).not.toContain('<a');
      expect(url.value).toBe(invalid);
      expect(panel.textContent).toContain('Enter a valid link URL.');
    }
  });

  it('treats markup-looking link labels as literal text content', async () => {
    const instance = editor();
    instance.commands.setContent('<p>replace me</p>');
    instance.commands.setTextSelection({ from: 2, to: 9 });
    const trigger = toolbarButton('Link');
    if (!trigger) throw new Error('Expected Link trigger.');
    trigger.click();
    await settle();
    const panel = overlayPanel('.mlv-editor-link__panel');
    if (!panel) throw new Error('Expected link panel.');
    const inputs = panel.querySelectorAll('mlv-input input');
    type(inputs[0] as HTMLInputElement, 'https://safe.example');
    type(inputs[1] as HTMLInputElement, '<em>literal</em>');
    buttonByText(panel, 'Apply link').click();
    await settle();

    const anchor = instance.view.dom.querySelector('a');
    expect(anchor?.textContent).toBe('<em>literal</em>');
    expect(anchor?.querySelector('em')).toBeNull();
  });

  it('normalizes a custom allowlist but still intersects it with the active Link extension policy', async () => {
    const protocolFixture = TestBed.createComponent(LinkProtocolHost);
    const instance = new Editor({
      extensions: [
        StarterKit.configure({
          link: {
            protocols: ['custom'],
            openOnClick: false,
            HTMLAttributes: { target: null, rel: null },
          },
        }),
      ],
      content: '<p>custom target</p>',
    });
    protocolFixture.componentInstance.editor.set(instance);
    document.body.appendChild(protocolFixture.nativeElement);
    protocolFixture.detectChanges();
    await protocolFixture.whenStable();
    protocolFixture.detectChanges();

    try {
      instance.commands.setTextSelection({ from: 2, to: 8 });
      const trigger = protocolFixture.nativeElement.querySelector(
        'button[aria-label="Link"]',
      ) as HTMLButtonElement;
      trigger.click();
      protocolFixture.detectChanges();
      await protocolFixture.whenStable();
      const panel = overlayPanel('.mlv-editor-link__panel');
      if (!panel) throw new Error('Expected link panel.');
      const url = panel.querySelector('mlv-input input') as HTMLInputElement;
      type(url, 'custom:item-42');
      buttonByText(panel, 'Apply link').click();
      protocolFixture.detectChanges();
      await protocolFixture.whenStable();
      overlayContainer
        .getContainerElement()
        .querySelector('.mlv-popup--leave')
        ?.dispatchEvent(new Event('animationend', { bubbles: true }));
      protocolFixture.detectChanges();
      await protocolFixture.whenStable();

      expect(instance.getHTML()).toContain('href="custom:item-42"');
    } finally {
      protocolFixture.destroy();
      (protocolFixture.nativeElement as HTMLElement).remove();
      instance.destroy();
    }
  });

  it('retains the draft and reports invalid when the active Link extension rejects an allowlisted scheme', async () => {
    const protocolFixture = TestBed.createComponent(LinkProtocolHost);
    const instance = new Editor({
      extensions: mlvEditorDefaultExtensions(),
      content: '<p>policy target</p>',
    });
    protocolFixture.componentInstance.editor.set(instance);
    document.body.appendChild(protocolFixture.nativeElement);
    protocolFixture.detectChanges();
    await protocolFixture.whenStable();
    protocolFixture.detectChanges();

    try {
      instance.commands.setTextSelection({ from: 2, to: 8 });
      const beforeApply = instance.getJSON();
      const trigger = protocolFixture.nativeElement.querySelector(
        'button[aria-label="Link"]',
      ) as HTMLButtonElement;
      trigger.click();
      protocolFixture.detectChanges();
      await protocolFixture.whenStable();
      const panel = overlayPanel('.mlv-editor-link__panel');
      if (!panel) throw new Error('Expected link panel.');
      const inputs = panel.querySelectorAll('mlv-input input');
      const url = inputs[0] as HTMLInputElement;
      const label = inputs[1] as HTMLInputElement;
      type(url, 'custom:item-42');
      type(label, 'rejected replacement');
      buttonByText(panel, 'Apply link').click();
      protocolFixture.detectChanges();
      await protocolFixture.whenStable();

      expect(instance.getJSON()).toEqual(beforeApply);
      expect(instance.getHTML()).not.toContain('<a');
      expect(url.value).toBe('custom:item-42');
      expect(label.value).toBe('rejected replacement');
      expect(panel.textContent).toContain('Enter a valid link URL.');
    } finally {
      protocolFixture.destroy();
      (protocolFixture.nativeElement as HTMLElement).remove();
      instance.destroy();
    }
  });

  it('hides unavailable controls and blocks already-open mutations when readonly or disabled', async () => {
    await recreateWithExtensions([StarterKit.configure({ link: false })]);
    expect(
      (fixture.nativeElement as HTMLElement).querySelector(
        'mlv-editor-text-color:not([hidden]), mlv-editor-highlight:not([hidden]), mlv-editor-link:not([hidden])',
      ),
    ).toBeNull();

    await recreateWithExtensions(mlvEditorDefaultExtensions());
    const before = editor().getJSON();
    const trigger = toolbarButton('Text color');
    expect(trigger).not.toBeNull();
    if (!trigger) return;
    trigger.click();
    await settle();
    fixture.componentInstance.readonly.set(true);
    await settle();
    await completeClose();
    expect(overlayPanel('.mlv-color-picker-popup__panel')).toBeNull();
    expect(toolbarButton('Text color')?.disabled).toBe(true);
    expect(toolbarButton('Highlight color')?.disabled).toBe(true);
    expect(toolbarButton('Link')?.disabled).toBe(true);
    expect(editor().getJSON()).toEqual(before);

    fixture.componentInstance.readonly.set(false);
    fixture.componentInstance.disabled.set(true);
    await settle();
    expect(toolbarButton('Text color')?.disabled).toBe(true);
    expect(toolbarButton('Highlight color')?.disabled).toBe(true);
    expect(toolbarButton('Link')?.disabled).toBe(true);
    expect(editor().getJSON()).toEqual(before);
  });

  it('runs all three formatting controls from the standalone public toolbar context', async () => {
    const toolbarFixture = TestBed.createComponent(
      StandaloneFormattingToolbarHost,
    );
    const instance = new Editor({
      extensions: mlvEditorDefaultExtensions(),
      content: '<p>standalone toolbar</p>',
    });
    toolbarFixture.componentInstance.editor.set(instance);
    document.body.appendChild(toolbarFixture.nativeElement);
    toolbarFixture.detectChanges();
    await toolbarFixture.whenStable();
    toolbarFixture.detectChanges();

    const localTrigger = (label: string): HTMLButtonElement => {
      const trigger = toolbarFixture.nativeElement.querySelector(
        `button[aria-label="${label}"]`,
      );
      if (!(trigger instanceof HTMLButtonElement)) {
        throw new Error(`Expected standalone ${label} trigger.`);
      }
      return trigger;
    };
    const settleToolbar = async (): Promise<void> => {
      toolbarFixture.detectChanges();
      await toolbarFixture.whenStable();
      toolbarFixture.detectChanges();
    };
    const closeToolbarPanel = async (panel: HTMLElement): Promise<void> => {
      panel.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Escape',
          bubbles: true,
          cancelable: true,
        }),
      );
      await settleToolbar();
      overlayContainer
        .getContainerElement()
        .querySelector('.mlv-popup--leave')
        ?.dispatchEvent(new Event('animationend', { bubbles: true }));
      await settleToolbar();
    };

    try {
      instance.commands.setTextSelection({ from: 2, to: 11 });
      localTrigger('Text color').click();
      await settleToolbar();
      let panel = overlayPanel('.mlv-color-picker-popup__panel');
      if (!panel) throw new Error('Expected standalone text-color picker.');
      type(
        panel.querySelector(
          'input[aria-label="Hex color value"]',
        ) as HTMLInputElement,
        '#123456',
      );
      await settleToolbar();
      expect(instance.getAttributes('textStyle')['color']).toBe('#123456');
      await closeToolbarPanel(panel);

      instance.commands.setTextSelection({ from: 2, to: 11 });
      localTrigger('Highlight color').click();
      await settleToolbar();
      panel = overlayPanel('.mlv-color-picker-popup__panel');
      if (!panel) throw new Error('Expected standalone highlight picker.');
      type(
        panel.querySelector(
          'input[aria-label="Hex color value"]',
        ) as HTMLInputElement,
        '#abcdef',
      );
      await settleToolbar();
      expect(instance.getAttributes('highlight')['color']).toBe('#abcdef');
      await closeToolbarPanel(panel);

      instance.commands.setTextSelection({ from: 2, to: 11 });
      localTrigger('Link').click();
      await settleToolbar();
      panel = overlayPanel('.mlv-editor-link__panel');
      if (!panel) throw new Error('Expected standalone link panel.');
      type(
        panel.querySelector('mlv-input input') as HTMLInputElement,
        'https://standalone.example',
      );
      buttonByText(panel, 'Apply link').click();
      await settleToolbar();
      overlayContainer
        .getContainerElement()
        .querySelector('.mlv-popup--leave')
        ?.dispatchEvent(new Event('animationend', { bubbles: true }));
      await settleToolbar();
      expect(instance.view.dom.querySelector('a')?.getAttribute('href')).toBe(
        'https://standalone.example',
      );
    } finally {
      toolbarFixture.destroy();
      (toolbarFixture.nativeElement as HTMLElement).remove();
      instance.destroy();
    }
  });

  it('updates formatting trigger, link field, and link action copy reactively', async () => {
    const trigger = toolbarButton('Link');
    if (!trigger) throw new Error('Expected Link trigger.');
    trigger.click();
    await settle();
    const panel = overlayPanel('.mlv-editor-link__panel');
    if (!panel) throw new Error('Expected link panel.');

    editorCopy.update((copy) => ({
      ...copy,
      textColor: 'Foreground',
      highlightColor: 'Marker',
      link: 'Hyperlink',
      linkUrl: 'Destination',
      linkText: 'Caption',
      openInNewTab: 'New window',
      applyLink: 'Save hyperlink',
      removeLink: 'Delete hyperlink',
    }));
    await settle();

    expect(toolbarButton('Foreground')).not.toBeNull();
    expect(toolbarButton('Marker')).not.toBeNull();
    expect(toolbarButton('Hyperlink')).not.toBeNull();
    expect(panel.textContent).toContain('Destination');
    expect(panel.textContent).toContain('Caption');
    expect(panel.textContent).toContain('New window');
    expect(buttonByText(panel, 'Save hyperlink')).not.toBeNull();

    panel.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    await completeClose();
  });

  it('configures default links for same-tab attributes and non-navigating rendered clicks', async () => {
    const instance = editor();
    instance.commands.setContent('<p>ordinary link</p>');
    instance.commands.setTextSelection({ from: 2, to: 10 });
    expect(instance.commands.setLink({ href: 'https://safe.example' })).toBe(
      true,
    );
    await settle();
    const anchor = instance.view.dom.querySelector('a') as HTMLAnchorElement;
    expect(anchor.getAttribute('target')).toBeNull();
    expect(anchor.getAttribute('rel')).toBeNull();

    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    const before = window.location.href;
    anchor.addEventListener('click', (event) => event.preventDefault(), {
      once: true,
    });
    anchor.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true }),
    );
    await Promise.resolve();
    expect(open).not.toHaveBeenCalled();
    expect(window.location.href).toBe(before);
    open.mockRestore();
  });

  it('publishes the exact readonly allowed-protocol signal contract', () => {
    expectTypeOf<MlvEditorLink['allowedProtocols']>().toEqualTypeOf<
      InputSignal<readonly string[]>
    >();
  });
});
