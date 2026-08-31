import { Component, inject, signal, viewChild } from '@angular/core';
import type { WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { vi } from 'vitest';
import { MLV_EDITOR_I18N } from '@malva-ui/i18n';
import type { MlvEditorI18n } from '@malva-ui/i18n';
import {
  i18nTestProvider,
  provideMlvI18nTesting,
} from '@malva-ui/i18n/testing';
import {
  MlvEditorToolbar,
  MlvEditorToolbarDef,
  MlvEditorToolbarEndDef,
  MlvEditorToolbarStartDef,
  MlvEditorToolbarWidget,
  MLV_EDITOR_TOOLBAR_CONTEXT,
} from '../..';
import type { MlvEditorToolbarContext } from '../..';
import { MlvEditor } from '../editor/editor';
import { MlvEditorToolbarRoot } from './editor-toolbar';

@Component({
  imports: [
    MlvEditor,
    MlvEditorToolbar,
    MlvEditorToolbarDef,
    MlvEditorToolbarEndDef,
    MlvEditorToolbarStartDef,
    MlvEditorToolbarWidget,
  ],
  template: `
    <mlv-editor
      [readonly]="readonly()"
      [disabled]="disabled()"
      (blur)="blurs.update((events) => [...events, $event])"
    >
      <button
        mlvEditorToolbarStart
        mlvEditorToolbarWidget
        type="button"
        data-direct-slot="direct-start"
        [hidden]="!showDirectSlots()"
      >
        Direct start
      </button>
      @if (showStart()) {
        <ng-template mlvEditorToolbarStart let-context>
          <button
            mlvEditorToolbarWidget
            type="button"
            data-template-slot="template-start"
          >
            {{ context.format() }}
          </button>
        </ng-template>
      }
      @if (showReplacement()) {
        <ng-template mlvEditorToolbar>Replacement control</ng-template>
      }
      @if (showEnd()) {
        <ng-template mlvEditorToolbarEnd let-context>
          <button
            mlvEditorToolbarWidget
            type="button"
            data-template-slot="template-end"
          >
            {{ context.format() }}
          </button>
        </ng-template>
      }
      <button
        mlvEditorToolbarEnd
        mlvEditorToolbarWidget
        type="button"
        data-direct-slot="direct-end"
        [hidden]="!showDirectSlots()"
      >
        Direct end
      </button>
    </mlv-editor>
  `,
})
class ToolbarHost {
  readonly readonly = signal(false);
  readonly disabled = signal(false);
  readonly showStart = signal(false);
  readonly showEnd = signal(false);
  readonly showDirectSlots = signal(false);
  readonly showReplacement = signal(false);
  readonly blurs = signal<unknown[]>([]);
  readonly editor = viewChild.required(MlvEditor);
}

@Component({
  imports: [MlvEditor, MlvEditorToolbarStartDef, MlvEditorToolbarWidget],
  template: `
    <mlv-editor>
      @if (showDirect()) {
        <button
          mlvEditorToolbarStart
          mlvEditorToolbarWidget
          type="button"
          data-dynamic-direct
          (click)="clicks.update((value) => value + 1)"
        >
          Dynamic direct
        </button>
      }
    </mlv-editor>
  `,
})
class DynamicToolbarHost {
  readonly showDirect = signal(false);
  readonly clicks = signal(0);
}

@Component({
  imports: [
    MlvEditor,
    MlvEditorToolbarEndDef,
    MlvEditorToolbarStartDef,
    MlvEditorToolbarWidget,
  ],
  template: `
    <mlv-editor>
      <ng-template mlvEditorToolbarStart>
        <button
          mlvEditorToolbarWidget
          type="button"
          data-inverse="template-start"
        >
          Template start
        </button>
      </ng-template>
      <button
        mlvEditorToolbarStart
        mlvEditorToolbarWidget
        type="button"
        data-inverse="direct-start"
      >
        Direct start
      </button>
      <button
        mlvEditorToolbarEnd
        mlvEditorToolbarWidget
        type="button"
        data-inverse="direct-end"
      >
        Direct end
      </button>
      <ng-template mlvEditorToolbarEnd>
        <button
          mlvEditorToolbarWidget
          type="button"
          data-inverse="template-end"
        >
          Template end
        </button>
      </ng-template>
    </mlv-editor>
  `,
})
class InverseToolbarHost {}

@Component({
  imports: [MlvEditorToolbar],
  template: `
    <mlv-editor-toolbar
      [ariaLabel]="'Standalone toolbar'"
      [disabled]="disabled()"
      [context]="context"
      [startTemplate]="start"
      [endTemplate]="end"
    >
      <button
        mlvEditorToolbarStart
        type="button"
        data-public-slot="direct-start"
      >
        Direct start
      </button>
      <ng-template #start let-context>
        <span data-public-slot="template-start">{{ context.format() }}</span>
      </ng-template>
      <ng-template #end let-context>
        <span data-public-slot="template-end">{{ context.zoom() }}</span>
      </ng-template>
      <button mlvEditorToolbarEnd type="button" data-public-slot="direct-end">
        Direct end
      </button>
    </mlv-editor-toolbar>
  `,
})
class PublicToolbarHost {
  readonly disabled = signal(false);
  readonly context = {
    editor: signal(null),
    disabled: signal(false),
    readonly: signal(false),
    focused: signal(false),
    editable: signal(false),
    format: signal<'html'>('html'),
    zoom: signal(125),
    run: () => false,
    can: () => false,
    isActive: () => false,
    reportError: () => undefined,
  } as unknown as MlvEditorToolbarContext;
}

@Component({
  imports: [MlvEditorToolbar],
  template: '<mlv-editor-toolbar [context]="context" />',
})
class StandaloneRuntimeToolbarHost {
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

@Component({
  selector: 'mlv-editor-toolbar-context-probe',
  template: '{{ context.zoom() }}',
})
class ToolbarContextProbe {
  readonly context = inject(MLV_EDITOR_TOOLBAR_CONTEXT);
}

@Component({
  imports: [MlvEditor, MlvEditorToolbarStartDef, ToolbarContextProbe],
  template: `
    <mlv-editor>
      <mlv-editor-toolbar-context-probe mlvEditorToolbarStart />
    </mlv-editor>
    <mlv-editor>
      <mlv-editor-toolbar-context-probe mlvEditorToolbarStart />
    </mlv-editor>
  `,
})
class ToolbarContextHost {}

@Component({
  imports: [MlvEditor],
  template: '<mlv-editor [extensions]="extensions" />',
})
class MissingExtensionHost {
  readonly extensions = [StarterKit.configure({ bold: false })];
}

describe('MlvEditor toolbar', () => {
  async function completeMenuLeave(
    fixture: ComponentFixture<unknown>,
  ): Promise<void> {
    // JSDOM does not run the CSS leave animation that normally disposes a menu
    // overlay. Complete it before TestBed tears the fixture down.
    for (const panel of document.querySelectorAll('.mlv-popup--leave')) {
      panel.dispatchEvent(new Event('animationend', { bubbles: true }));
    }
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function closeMenu(
    fixture: ComponentFixture<unknown>,
    trigger: HTMLButtonElement,
  ): Promise<void> {
    trigger.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    fixture.detectChanges();
    await fixture.whenStable();
    await completeMenuLeave(fixture);
  }

  async function settleRoving(
    fixture: ComponentFixture<unknown>,
  ): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function selectedText(
    editor: NonNullable<ReturnType<MlvEditor['editor']>>,
  ): string {
    return editor.state.doc.textBetween(
      editor.state.selection.from,
      editor.state.selection.to,
      ' ',
    );
  }

  async function createHost(): Promise<ComponentFixture<ToolbarHost>> {
    await TestBed.configureTestingModule({
      imports: [ToolbarHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(ToolbarHost);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  async function createStandaloneToolbar(
    editor: Editor,
  ): Promise<ComponentFixture<StandaloneRuntimeToolbarHost>> {
    await TestBed.configureTestingModule({
      imports: [StandaloneRuntimeToolbarHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(StandaloneRuntimeToolbarHost);
    fixture.componentInstance.editor.set(editor);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('removes narrow-only groups and dividers from the rendered built-in row', async () => {
    const fixture = await createHost();
    const toolbarDebug = fixture.debugElement.query(
      By.directive(MlvEditorToolbarRoot),
    );
    const toolbarRoot = toolbarDebug.injector.get(MlvEditorToolbarRoot);
    const toolbar = toolbarDebug.nativeElement as HTMLElement;
    const inlineMarks = toolbar.querySelector(
      'mlv-editor-inline-marks',
    ) as HTMLElement;
    const overflow = toolbar.querySelector(
      ':scope > .mlv-editor-toolbar__overflow',
    ) as HTMLElement;

    expect(getComputedStyle(inlineMarks).display).not.toBe('none');
    expect(getComputedStyle(overflow).display).toBe('none');

    toolbarRoot.narrow.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    for (const selector of [
      'mlv-editor-inline-marks',
      'mlv-editor-alignment',
      'mlv-editor-block-insert',
      '.mlv-editor-toolbar__separator[hidden]',
    ]) {
      const elements = toolbar.querySelectorAll<HTMLElement>(selector);
      expect(elements.length).toBeGreaterThan(0);
      expect(
        Array.from(elements).every(
          (element) => getComputedStyle(element).display === 'none',
        ),
      ).toBe(true);
    }
    expect(getComputedStyle(overflow).display).not.toBe('none');
  });

  it('removes narrow-only groups and dividers from the rendered standalone row', async () => {
    const editor = new Editor({ extensions: [StarterKit] });
    const fixture = await createStandaloneToolbar(editor);
    const toolbarDebug = fixture.debugElement.query(
      By.directive(MlvEditorToolbarRoot),
    );
    const toolbarRoot = toolbarDebug.injector.get(MlvEditorToolbarRoot);
    const toolbar = toolbarDebug.nativeElement as HTMLElement;
    const inlineMarks = toolbar.querySelector(
      'mlv-editor-inline-marks',
    ) as HTMLElement;
    const overflow = toolbar.querySelector(
      ':scope > .mlv-editor-toolbar__overflow',
    ) as HTMLElement;

    expect(getComputedStyle(inlineMarks).display).not.toBe('none');
    expect(getComputedStyle(overflow).display).toBe('none');

    toolbarRoot.narrow.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    for (const selector of [
      'mlv-editor-inline-marks',
      'mlv-editor-alignment',
      'mlv-editor-block-insert',
      '.mlv-editor-toolbar__separator[hidden]',
    ]) {
      const elements = toolbar.querySelectorAll<HTMLElement>(selector);
      expect(elements.length).toBeGreaterThan(0);
      expect(
        Array.from(elements).every(
          (element) => getComputedStyle(element).display === 'none',
        ),
      ).toBe(true);
    }
    expect(getComputedStyle(overflow).display).not.toBe('none');

    fixture.destroy();
    editor.destroy();
  });

  it('renders the implemented core command groups in architectural order', async () => {
    const fixture = await createHost();
    const controls = Array.from(
      fixture.nativeElement.querySelectorAll(
        'mlv-editor-undo-redo, mlv-editor-zoom, mlv-editor-heading, mlv-editor-list, mlv-editor-inline-marks, mlv-editor-text-color, mlv-editor-highlight, mlv-editor-alignment, mlv-editor-link, mlv-editor-table, mlv-editor-block-insert',
      ),
    ).map((element) => element.localName);

    expect(controls).toEqual([
      'mlv-editor-undo-redo',
      'mlv-editor-zoom',
      'mlv-editor-heading',
      'mlv-editor-list',
      'mlv-editor-inline-marks',
      'mlv-editor-text-color',
      'mlv-editor-highlight',
      'mlv-editor-alignment',
      'mlv-editor-link',
      'mlv-editor-table',
      'mlv-editor-block-insert',
    ]);
  });

  it('renders only compact menu triggers alongside the direct mark and block commands', async () => {
    const fixture = await createHost();
    const labels = Array.from(
      fixture.nativeElement.querySelectorAll('button[aria-label]'),
    )
      .filter((element) => !element.closest('[hidden]'))
      .map((element) => element.getAttribute('aria-label'));

    expect(labels).toEqual([
      'Undo',
      'Redo',
      'Zoom −',
      'Zoom',
      'Zoom +',
      'Heading level',
      'Bullet list',
      'Bold',
      'Italic',
      'Strike-through',
      'Underline',
      'Text color',
      'Highlight color',
      'Alignment',
      'Link',
      'Table',
      'Blockquote',
      'Code block',
      'Horizontal rule',
    ]);
  });

  it('keeps icon groups on one fading row with semantic separators and a fixed overflow trigger', async () => {
    const fixture = await createHost();
    const root = fixture.nativeElement.querySelector(
      '.mlv-editor__toolbar',
    ) as HTMLElement;
    const fade = root.querySelector(':scope > .mlv-editor__toolbar-scroll');
    const row = fade?.querySelector(':scope > .mlv-toolbar');
    const overflow = root.querySelector(
      ':scope > .mlv-editor-toolbar__overflow',
    );
    const separators = row?.querySelectorAll(
      ':scope > mlv-divider[role="separator"][aria-orientation="vertical"]',
    );
    const visibleButtons = Array.from(
      row?.querySelectorAll<HTMLButtonElement>('button[aria-label]') ?? [],
    ).filter((button) => !button.closest('[hidden]'));

    expect(fade?.classList.contains('mlv-fade')).toBe(true);
    expect(row).not.toBeNull();
    expect(overflow).not.toBeNull();
    expect(fade?.contains(overflow)).toBe(false);
    expect(separators?.length).toBe(8);
    for (const button of visibleButtons) {
      const text = button.textContent?.trim() ?? '';
      if (!/^\d+%$/.test(text)) {
        expect(button.querySelector('svg')).not.toBeNull();
      }
      expect(text === '' || /^\d+%$/.test(text)).toBe(true);
    }
  });

  it('keeps compact formatting choices behind menu triggers and zoom in a dialog trigger', async () => {
    const fixture = await createHost();
    const triggers = Array.from(
      fixture.nativeElement.querySelectorAll('button[aria-haspopup="menu"]'),
    ).filter((trigger) => !trigger.closest('[hidden]')) as HTMLButtonElement[];

    expect(
      triggers.map((trigger) => trigger.getAttribute('aria-label')),
    ).toEqual(['Heading level', 'Bullet list', 'Alignment']);
    expect(
      triggers.every((trigger) =>
        trigger.hasAttribute('mlvEditorToolbarWidget'),
      ),
    ).toBe(true);
    const zoom = fixture.nativeElement.querySelector(
      'button[aria-label="Zoom"]',
    ) as HTMLButtonElement;
    expect(zoom.getAttribute('aria-haspopup')).toBe('dialog');
    expect(zoom.hasAttribute('mlvEditorToolbarWidget')).toBe(true);
  });

  it('uses one named roving toolbar for real native command triggers', async () => {
    const fixture = await createHost();
    const editor = fixture.componentInstance.editor().editor();
    if (!editor) throw new Error('Expected editor.');
    editor.commands.insertContent('Toolbar');
    fixture.detectChanges();
    await fixture.whenStable();
    await settleRoving(fixture);
    const toolbars = Array.from(
      fixture.nativeElement.querySelectorAll('[role="toolbar"]'),
    ) as HTMLElement[];
    const widgets = Array.from(
      toolbars[0].querySelectorAll('button[mlvEditorToolbarWidget]'),
    ) as HTMLButtonElement[];
    const enabledWidgets = widgets.filter(
      (widget) => !widget.disabled && !widget.closest('[hidden]'),
    );

    expect(toolbars).toHaveLength(1);
    expect(toolbars[0].getAttribute('aria-label')).toBe('Editor toolbar');
    expect(enabledWidgets).not.toHaveLength(0);
    expect(
      enabledWidgets.map((widget) => widget.getAttribute('aria-label')),
    ).toEqual(
      expect.arrayContaining(['Zoom −', 'Zoom', 'Zoom +', 'Heading level']),
    );
    expect(
      widgets.filter((widget) => widget.getAttribute('tabindex') === '0'),
    ).toHaveLength(1);

    const initial = fixture.nativeElement.querySelector(
      'button[aria-label="Undo"]',
    ) as HTMLButtonElement;
    const redo = fixture.nativeElement.querySelector(
      'button[aria-label="Redo"]',
    ) as HTMLButtonElement;
    expect(initial.disabled).toBe(false);
    expect(redo.disabled).toBe(true);
    initial.focus();
    initial.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
    );
    fixture.detectChanges();
    expect(
      (document.activeElement as HTMLElement).getAttribute('aria-label'),
    ).toBe('Zoom −');

    (document.activeElement as HTMLButtonElement).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'End', bubbles: true }),
    );
    fixture.detectChanges();
    const end = document.activeElement as HTMLButtonElement;
    expect(end).not.toBe(initial);

    end.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Home', bubbles: true }),
    );
    fixture.detectChanges();
    const home = document.activeElement as HTMLButtonElement;
    expect(home).not.toBe(end);

    home.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }),
    );
    fixture.detectChanges();
    expect(document.activeElement).toBe(end);
    expect(
      widgets.filter((widget) => widget.getAttribute('tabindex') === '0'),
    ).toHaveLength(1);
  });

  it('opens a heading menu from the keyboard and restores focus when it closes', async () => {
    const fixture = await createHost();
    const editor = fixture.componentInstance.editor().editor();
    if (!editor) throw new Error('Expected editor.');
    vi.spyOn(editor.view, 'scrollToSelection').mockImplementation(
      () => undefined,
    );
    editor.commands.setContent('<p>heading selection</p>');
    editor.commands.setTextSelection({ from: 2, to: 9 });
    const selection = {
      from: editor.state.selection.from,
      to: editor.state.selection.to,
    };
    const trigger = fixture.nativeElement.querySelector(
      'button[aria-label="Heading level"]',
    ) as HTMLButtonElement;

    (
      fixture.nativeElement.querySelector('.ProseMirror') as HTMLElement
    ).focus();
    expect(fixture.componentInstance.editor().focused()).toBe(true);
    trigger.focus();
    trigger.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
    );
    await new Promise((resolve) => setTimeout(resolve));

    const panel = document.getElementById(
      trigger.getAttribute('aria-controls') ?? '',
    ) as HTMLElement;
    expect(panel.getAttribute('role')).toBe('menu');
    expect(panel.querySelectorAll('[role="menuitem"]')).toHaveLength(7);
    expect((document.activeElement as HTMLElement).getAttribute('role')).toBe(
      'menuitem',
    );
    expect(fixture.componentInstance.blurs()).toHaveLength(0);

    const chain = vi.spyOn(editor, 'chain');
    (panel.querySelectorAll('[role="menuitem"]')[1] as HTMLElement).click();
    expect(chain).toHaveBeenCalledTimes(1);
    expect({
      from: editor.state.selection.from,
      to: editor.state.selection.to,
    }).toEqual(selection);

    await new Promise((resolve) => setTimeout(resolve));
    expect(fixture.componentInstance.blurs()).toHaveLength(0);
    await closeMenu(fixture, trigger);

    const outside = document.createElement('button');
    document.body.append(outside);
    outside.focus();
    await new Promise((resolve) => setTimeout(resolve));
    expect(fixture.componentInstance.blurs()).toHaveLength(1);
    outside.remove();
  });

  it('keeps template and direct slots in their exact positions around the default toolbar', async () => {
    const fixture = await createHost();
    const host = fixture.componentInstance;
    host.showStart.set(true);
    host.showEnd.set(true);
    host.showDirectSlots.set(true);
    fixture.detectChanges();
    const toolbar = fixture.nativeElement.querySelector('[role="toolbar"]');
    const orderedControls = Array.from(
      toolbar.querySelectorAll(
        '[data-template-slot], [data-direct-slot], mlv-editor-undo-redo, mlv-editor-zoom, mlv-editor-heading, mlv-editor-list, mlv-editor-inline-marks, mlv-editor-text-color, mlv-editor-highlight, mlv-editor-alignment, mlv-editor-link, mlv-editor-block-insert',
      ),
    ).map(
      (element) =>
        element.getAttribute('data-template-slot') ??
        element.getAttribute('data-direct-slot') ??
        element.localName,
    );
    expect(orderedControls).toEqual([
      'direct-start',
      'template-start',
      'mlv-editor-undo-redo',
      'mlv-editor-zoom',
      'mlv-editor-heading',
      'mlv-editor-list',
      'mlv-editor-inline-marks',
      'mlv-editor-text-color',
      'mlv-editor-highlight',
      'mlv-editor-alignment',
      'mlv-editor-link',
      'mlv-editor-block-insert',
      'template-end',
      'direct-end',
    ]);

    host.showReplacement.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Replacement control');
    expect(
      fixture.nativeElement.querySelector('mlv-editor-undo-redo'),
    ).toBeNull();
    expect(
      fixture.nativeElement.querySelectorAll('[role="toolbar"]'),
    ).toHaveLength(1);
    expect(
      fixture.nativeElement.querySelector('[data-template-slot]'),
    ).toBeNull();
    expect(
      fixture.nativeElement.querySelector('[data-direct-slot]'),
    ).toBeNull();

    host.showReplacement.set(false);
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelectorAll('[data-direct-slot]'),
    ).toHaveLength(2);
  });

  it('captures dynamic direct widgets after Angular attaches them, then tears down and re-adds them', async () => {
    await TestBed.configureTestingModule({
      imports: [DynamicToolbarHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(DynamicToolbarHost);
    fixture.detectChanges();
    fixture.componentInstance.showDirect.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const toolbar = fixture.nativeElement.querySelector('[role="toolbar"]');
    const dynamic = toolbar.querySelector(
      '[data-dynamic-direct]',
    ) as HTMLButtonElement;
    expect(dynamic).not.toBeNull();
    dynamic.click();
    expect(fixture.componentInstance.clicks()).toBe(1);

    fixture.componentInstance.showDirect.set(false);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('[data-dynamic-direct]'),
    ).toBeNull();

    fixture.componentInstance.showDirect.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(toolbar.querySelectorAll('[data-dynamic-direct]')).toHaveLength(1);
    const readded = toolbar.querySelector(
      '[data-dynamic-direct]',
    ) as HTMLButtonElement;
    const undo = toolbar.querySelector(
      'button[aria-label="Undo"]',
    ) as HTMLButtonElement;
    const redo = toolbar.querySelector(
      'button[aria-label="Redo"]',
    ) as HTMLButtonElement;
    undo.disabled = true;
    redo.disabled = true;
    await settleRoving(fixture);
    readded.focus();
    readded.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
    );
    fixture.detectChanges();
    expect(
      (document.activeElement as HTMLElement).getAttribute('aria-label'),
    ).toBe('Zoom −');
    expect(
      Array.from(
        toolbar.querySelectorAll(
          'button[mlvEditorToolbarWidget][tabindex="0"]',
        ),
      ),
    ).toHaveLength(1);
  });

  it('uses deterministic slot precedence when consumers declare the opposite source order', async () => {
    await TestBed.configureTestingModule({
      imports: [InverseToolbarHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(InverseToolbarHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const toolbar = fixture.nativeElement.querySelector('[role="toolbar"]');
    expect(
      Array.from(toolbar.querySelectorAll('[data-inverse]')).map((element) =>
        element.getAttribute('data-inverse'),
      ),
    ).toEqual(['direct-start', 'template-start', 'template-end', 'direct-end']);
  });

  it('roves across projected direct and template widgets in rendered DOM order', async () => {
    await TestBed.configureTestingModule({
      imports: [InverseToolbarHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(InverseToolbarHost);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const toolbar = fixture.nativeElement.querySelector(
      '[role="toolbar"]',
    ) as HTMLElement;
    const widgets = Array.from(
      toolbar.querySelectorAll('button[mlvEditorToolbarWidget]'),
    ) as HTMLButtonElement[];
    const directStart = toolbar.querySelector(
      '[data-inverse="direct-start"]',
    ) as HTMLButtonElement;
    const templateStart = toolbar.querySelector(
      '[data-inverse="template-start"]',
    ) as HTMLButtonElement;
    const directEnd = toolbar.querySelector(
      '[data-inverse="direct-end"]',
    ) as HTMLButtonElement;

    expect(
      widgets
        .filter((widget) => !widget.closest('[hidden]'))
        .map((widget) => widget.getAttribute('aria-label')),
    ).toEqual(expect.arrayContaining(['Zoom −', 'Zoom', 'Zoom +']));
    await settleRoving(fixture);
    expect(
      widgets.filter((widget) => widget.getAttribute('tabindex') === '0'),
    ).toHaveLength(1);
    directStart.focus();
    directStart.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
    );
    fixture.detectChanges();
    expect(document.activeElement).toBe(templateStart);

    directEnd.focus();
    directEnd.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
    );
    fixture.detectChanges();
    expect(document.activeElement).toBe(directStart);
  });

  it('keeps the standalone public toolbar component contract available', async () => {
    await TestBed.configureTestingModule({
      imports: [PublicToolbarHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(PublicToolbarHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const toolbar = fixture.nativeElement.querySelector(
      '[role="toolbar"]',
    ) as HTMLElement;
    expect(toolbar.getAttribute('aria-label')).toBe('Standalone toolbar');
    expect(
      Array.from(toolbar.querySelectorAll('[data-public-slot]')).map(
        (element) => element.getAttribute('data-public-slot'),
      ),
    ).toEqual(['direct-start', 'template-start', 'template-end', 'direct-end']);
    expect(toolbar.querySelector('mlv-editor-undo-redo')).not.toBeNull();
    const fade = toolbar.querySelector(':scope > .mlv-editor-toolbar__scroll');
    expect(fade?.classList.contains('mlv-fade')).toBe(true);
    expect(
      fade?.querySelectorAll(
        ':scope > .mlv-toolbar > mlv-divider[role="separator"]',
      ).length,
    ).toBe(8);
    expect(
      toolbar.querySelector(':scope > .mlv-editor-toolbar__overflow'),
    ).not.toBeNull();
    expect(fade?.querySelector('.mlv-editor-toolbar__overflow')).toBeNull();

    fixture.componentInstance.disabled.set(true);
    fixture.detectChanges();
    expect(toolbar.getAttribute('aria-disabled')).toBe('true');

    fixture.componentInstance.disabled.set(false);
    fixture.componentInstance.context.disabled.set(true);
    fixture.detectChanges();
    expect(toolbar.getAttribute('aria-disabled')).toBe('true');
  });

  it('reactively follows a standalone context editor through transactions and selection updates', async () => {
    const editor = new Editor({ extensions: [StarterKit] });
    const replacement = new Editor({ extensions: [StarterKit] });
    const oldOn = vi.spyOn(editor, 'on');
    const oldOff = vi.spyOn(editor, 'off');
    const replacementOn = vi.spyOn(replacement, 'on');
    const replacementOff = vi.spyOn(replacement, 'off');
    const fixture = await createStandaloneToolbar(editor);
    const undo = fixture.nativeElement.querySelector(
      'button[aria-label="Undo"]',
    ) as HTMLButtonElement;
    const redo = fixture.nativeElement.querySelector(
      'button[aria-label="Redo"]',
    ) as HTMLButtonElement;
    const bold = fixture.nativeElement.querySelector(
      'button[aria-label="Bold"]',
    ) as HTMLButtonElement;
    const blockquote = fixture.nativeElement.querySelector(
      'button[aria-label="Blockquote"]',
    ) as HTMLButtonElement;

    expect(undo.disabled).toBe(true);
    expect(redo.disabled).toBe(true);
    expect(bold.getAttribute('aria-pressed')).toBe('false');
    expect(oldOn).toHaveBeenCalledTimes(2);
    const oldTransactionOnCalls = oldOn.mock.calls.filter(
      ([event]) => event === 'transaction',
    );
    const oldSelectionUpdateOnCalls = oldOn.mock.calls.filter(
      ([event]) => event === 'selectionUpdate',
    );
    expect(oldTransactionOnCalls).toHaveLength(1);
    expect(oldSelectionUpdateOnCalls).toHaveLength(1);
    const oldTransactionCallback = oldTransactionOnCalls[0]?.[1];
    const oldSelectionUpdateCallback = oldSelectionUpdateOnCalls[0]?.[1];
    expect(oldTransactionCallback).toEqual(expect.any(Function));
    expect(oldSelectionUpdateCallback).toEqual(expect.any(Function));

    editor.commands.setContent('<p><strong>bold</strong> plain</p>');
    fixture.detectChanges();
    expect(undo.disabled).toBe(false);

    editor.commands.undo();
    fixture.detectChanges();
    expect(undo.disabled).toBe(true);
    expect(redo.disabled).toBe(false);

    editor.commands.redo();
    editor.commands.setContent('<p><strong>bold</strong> plain</p>');
    fixture.detectChanges();
    editor.commands.setTextSelection(2);
    expect(editor.isActive('bold')).toBe(true);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(bold.getAttribute('aria-pressed')).toBe('true');

    editor.commands.setContent('<blockquote><p>quote</p></blockquote>');
    editor.commands.setTextSelection(2);
    expect(editor.isActive('blockquote')).toBe(true);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(blockquote.getAttribute('aria-pressed')).toBe('true');

    fixture.componentInstance.editor.set(replacement);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(oldOn).toHaveBeenCalledTimes(2);
    expect(oldOff).toHaveBeenCalledTimes(2);
    const oldTransactionOffCalls = oldOff.mock.calls.filter(
      ([event]) => event === 'transaction',
    );
    const oldSelectionUpdateOffCalls = oldOff.mock.calls.filter(
      ([event]) => event === 'selectionUpdate',
    );
    expect(oldTransactionOffCalls).toHaveLength(1);
    expect(oldSelectionUpdateOffCalls).toHaveLength(1);
    expect(oldTransactionOffCalls[0]?.[1]).toBe(oldTransactionCallback);
    expect(oldSelectionUpdateOffCalls[0]?.[1]).toBe(oldSelectionUpdateCallback);
    expect(replacementOn).toHaveBeenCalledTimes(2);
    const replacementTransactionOnCalls = replacementOn.mock.calls.filter(
      ([event]) => event === 'transaction',
    );
    const replacementSelectionUpdateOnCalls = replacementOn.mock.calls.filter(
      ([event]) => event === 'selectionUpdate',
    );
    expect(replacementTransactionOnCalls).toHaveLength(1);
    expect(replacementSelectionUpdateOnCalls).toHaveLength(1);
    const replacementTransactionCallback =
      replacementTransactionOnCalls[0]?.[1];
    const replacementSelectionUpdateCallback =
      replacementSelectionUpdateOnCalls[0]?.[1];
    expect(replacementTransactionCallback).toEqual(expect.any(Function));
    expect(replacementSelectionUpdateCallback).toEqual(expect.any(Function));
    expect(undo.disabled).toBe(true);

    editor.commands.setContent('<p>old editor change</p>');
    fixture.detectChanges();
    expect(undo.disabled).toBe(true);

    replacement.commands.setContent('<p>replacement editor change</p>');
    fixture.detectChanges();
    expect(undo.disabled).toBe(false);

    fixture.destroy();
    expect(replacementOff).toHaveBeenCalledTimes(2);
    const replacementTransactionOffCalls = replacementOff.mock.calls.filter(
      ([event]) => event === 'transaction',
    );
    const replacementSelectionUpdateOffCalls = replacementOff.mock.calls.filter(
      ([event]) => event === 'selectionUpdate',
    );
    expect(replacementTransactionOffCalls).toHaveLength(1);
    expect(replacementSelectionUpdateOffCalls).toHaveLength(1);
    expect(replacementTransactionOffCalls[0]?.[1]).toBe(
      replacementTransactionCallback,
    );
    expect(replacementSelectionUpdateOffCalls[0]?.[1]).toBe(
      replacementSelectionUpdateCallback,
    );
    editor.destroy();
    replacement.destroy();
  });

  it('disables mutation controls for readonly and disabled editors', async () => {
    const fixture = await createHost();
    fixture.componentInstance.readonly.set(true);
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('button[aria-label="Bold"]')
        ?.disabled,
    ).toBe(true);

    const readonlyButtons = Array.from(
      fixture.nativeElement.querySelectorAll('button[mlvEditorToolbarWidget]'),
    ).filter((button) => !button.closest('[hidden]')) as HTMLButtonElement[];
    const viewOnlyLabels = new Set([
      'Zoom −',
      'Zoom',
      'Zoom +',
      'More formatting',
    ]);
    const mutationButtons = readonlyButtons.filter(
      (button) => !viewOnlyLabels.has(button.getAttribute('aria-label') ?? ''),
    );
    expect(mutationButtons.every((button) => button.disabled)).toBe(true);
    expect(
      readonlyButtons
        .filter((button) =>
          (button.getAttribute('aria-label') ?? '').startsWith('Zoom'),
        )
        .every((button) => !button.disabled),
    ).toBe(true);

    fixture.componentInstance.readonly.set(false);
    fixture.componentInstance.disabled.set(true);
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('button[aria-label="Bold"]')
        ?.disabled,
    ).toBe(true);
  });

  it('keeps registered history commands visible and updates their executable state', async () => {
    const fixture = await createHost();
    const editor = fixture.componentInstance.editor().editor();
    if (!editor) throw new Error('Expected editor.');
    const undo = fixture.nativeElement.querySelector(
      'button[aria-label="Undo"]',
    ) as HTMLButtonElement;
    const redo = fixture.nativeElement.querySelector(
      'button[aria-label="Redo"]',
    ) as HTMLButtonElement;
    expect(undo).not.toBeNull();
    editor.commands.insertContent('history');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(undo.disabled).toBe(false);
    const chain = vi.spyOn(editor, 'chain');

    undo.click();
    fixture.detectChanges();
    expect(chain).toHaveBeenCalledTimes(1);
    chain.mockClear();
    expect(undo.disabled).toBe(true);
    expect(redo.disabled).toBe(false);

    redo.click();
    fixture.detectChanges();
    expect(chain).toHaveBeenCalledTimes(1);
    expect(undo.disabled).toBe(false);
    expect(redo.disabled).toBe(true);
  });

  it('hides commands omitted from a custom extension set', async () => {
    await TestBed.configureTestingModule({
      imports: [MissingExtensionHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(MissingExtensionHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const bold = root.querySelector(
      'button[aria-label="Bold"]',
    ) as HTMLButtonElement;

    expect(bold.closest('mlv-editor-command-button')?.hidden).toBe(true);
  });

  it('updates direct toggle state after selection-only transactions', async () => {
    const fixture = await createHost();
    const editor = fixture.componentInstance.editor().editor();
    if (!editor) throw new Error('Expected editor.');
    const bold = fixture.nativeElement.querySelector(
      'button[aria-label="Bold"]',
    ) as HTMLButtonElement;
    editor.commands.setContent('<p>plain</p><p><strong>bold</strong></p>');
    editor.commands.setTextSelection(2);
    fixture.detectChanges();
    expect(bold.getAttribute('aria-pressed')).toBe('false');

    editor.commands.setTextSelection(10);
    fixture.detectChanges();
    expect(bold.getAttribute('aria-pressed')).toBe('true');
  });

  it('runs direct inline and block commands once while preserving the content selection', async () => {
    const fixture = await createHost();
    const editor = fixture.componentInstance.editor().editor();
    if (!editor) throw new Error('Expected editor.');
    editor.commands.setContent('<p>commands</p>');
    editor.commands.setTextSelection({ from: 2, to: 5 });
    const selection = {
      from: editor.state.selection.from,
      to: editor.state.selection.to,
    };
    const chain = vi.spyOn(editor, 'chain');

    for (const label of ['Bold', 'Italic', 'Strike-through', 'Underline']) {
      (
        fixture.nativeElement.querySelector(
          `button[aria-label="${label}"]`,
        ) as HTMLButtonElement
      ).click();
      fixture.detectChanges();
      expect(chain).toHaveBeenCalledTimes(1);
      chain.mockClear();
    }
    expect(editor.isActive('bold')).toBe(true);
    expect(editor.isActive('italic')).toBe(true);
    expect(editor.isActive('strike')).toBe(true);
    expect(editor.isActive('underline')).toBe(true);
    expect({
      from: editor.state.selection.from,
      to: editor.state.selection.to,
    }).toEqual(selection);

    const blockSelection = selectedText(editor);

    (
      fixture.nativeElement.querySelector(
        'button[aria-label="Blockquote"]',
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    expect(chain).toHaveBeenCalledTimes(1);
    chain.mockClear();
    expect(editor.isActive('blockquote')).toBe(true);
    expect(selectedText(editor)).toBe(blockSelection);

    (
      fixture.nativeElement.querySelector(
        'button[aria-label="Code block"]',
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    expect(chain).toHaveBeenCalledTimes(1);
    chain.mockClear();
    expect(editor.isActive('codeBlock')).toBe(true);
    expect(selectedText(editor)).toBe(blockSelection);

    (
      fixture.nativeElement.querySelector(
        'button[aria-label="Horizontal rule"]',
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    expect(chain).toHaveBeenCalledTimes(1);
    expect(editor.getHTML().match(/<hr>/g)).toHaveLength(1);
  });

  it('executes list and alignment menu commands once, after capability checks', async () => {
    const fixture = await createHost();
    const editor = fixture.componentInstance.editor().editor();
    if (!editor) throw new Error('Expected editor.');
    vi.spyOn(editor.view, 'scrollToSelection').mockImplementation(
      () => undefined,
    );
    editor.commands.setContent('<p>menu selection</p>');
    editor.commands.setTextSelection({ from: 2, to: 6 });
    const selection = selectedText(editor);

    const listTrigger = fixture.nativeElement.querySelector(
      'button[aria-label="Bullet list"]',
    ) as HTMLButtonElement;
    const chain = vi.spyOn(editor, 'chain');
    listTrigger.click();
    await new Promise((resolve) => setTimeout(resolve));
    const listPanel = document.getElementById(
      listTrigger.getAttribute('aria-controls') ?? '',
    ) as HTMLElement;
    (listPanel.querySelector('[role="menuitem"]') as HTMLElement).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    );
    expect(editor.isActive('bulletList')).toBe(true);
    expect(chain).toHaveBeenCalledTimes(1);
    expect(selectedText(editor)).toBe(selection);
    chain.mockClear();
    await closeMenu(fixture, listTrigger);

    const alignmentTrigger = fixture.nativeElement.querySelector(
      'button[aria-label="Alignment"]',
    ) as HTMLButtonElement;
    alignmentTrigger.click();
    await new Promise((resolve) => setTimeout(resolve));
    const alignmentPanel = document.getElementById(
      alignmentTrigger.getAttribute('aria-controls') ?? '',
    ) as HTMLElement;
    const alignmentItems = alignmentPanel.querySelectorAll('[role="menuitem"]');
    (alignmentItems[1] as HTMLElement).dispatchEvent(
      new KeyboardEvent('keydown', { key: ' ', bubbles: true }),
    );
    expect(editor.isActive('paragraph', { textAlign: 'center' })).toBe(true);
    expect(chain).toHaveBeenCalledTimes(1);
    expect(selectedText(editor)).toBe(selection);
    await closeMenu(fixture, alignmentTrigger);
  });

  it('types template contexts and scopes injected toolbar contexts per editor', async () => {
    await TestBed.configureTestingModule({
      imports: [ToolbarContextHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(ToolbarContextHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const probes = fixture.debugElement
      .queryAll(By.directive(ToolbarContextProbe))
      .map(
        (debugElement) => debugElement.componentInstance as ToolbarContextProbe,
      );

    expect(probes).toHaveLength(2);
    probes[0].context.zoom.set(130);
    fixture.detectChanges();
    expect(probes[0].context.zoom()).toBe(130);
    expect(probes[1].context.zoom()).toBe(100);
  });

  it('updates toolbar labels reactively when editor i18n changes', async () => {
    await TestBed.configureTestingModule({
      imports: [ToolbarHost],
      providers: [provideMlvI18nTesting(), i18nTestProvider(MLV_EDITOR_I18N)],
    }).compileComponents();
    const fixture = TestBed.createComponent(ToolbarHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const copy = TestBed.inject(
      MLV_EDITOR_I18N,
    ) as WritableSignal<MlvEditorI18n>;

    copy.update((current) => ({ ...current, bold: 'Strong' }));
    fixture.detectChanges();
    expect(
      fixture.nativeElement
        .querySelector('button[aria-label="Strong"]')
        ?.getAttribute('aria-label'),
    ).toBe('Strong');
  });
});
