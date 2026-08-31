import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { vi } from 'vitest';
import {
  MLV_EDITOR_OVERLAY_REGISTRY,
  MLV_EDITOR_UPLOAD_ABORT_REGISTRY,
  type MlvEditorOverlayRegistry,
  type MlvEditorUploadAbortRegistry,
} from '../editor-toolbar-context';
import { MlvEditor } from './editor';

@Component({
  imports: [MlvEditor],
  template: `
    <button #before type="button">Before</button>
    <mlv-editor
      [readonly]="readonly()"
      [disabled]="disabled()"
      (focus)="focusEvents.push($event)"
      (blur)="blurEvents.push($event)"
      (touch)="touches.update(value => value + 1)"
    >
      <button
        mlvEditorToolbarStart
        type="button"
        (click)="toolbarActivations.update(value => value + 1)"
      >
        Toolbar
      </button>
      <button
        mlvEditorStatus
        type="button"
        (click)="statusActivations.update(value => value + 1)"
        (keydown)="statusKeydowns.update(value => value + 1)"
      >
        Status
      </button>
    </mlv-editor>
    <button #after type="button">After</button>
  `,
})
class FocusHost {
  readonly readonly = signal(false);
  readonly disabled = signal(false);
  readonly editor = viewChild.required(MlvEditor);
  readonly focusEvents: FocusEvent[] = [];
  readonly blurEvents: FocusEvent[] = [];
  readonly touches = signal(0);
  readonly toolbarActivations = signal(0);
  readonly statusActivations = signal(0);
  readonly statusKeydowns = signal(0);
}

describe('MlvEditor composite focus', () => {
  async function createHost() {
    await TestBed.configureTestingModule({
      imports: [FocusHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(FocusHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    return { fixture, host: fixture.componentInstance, root };
  }

  async function settle(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
  }

  it('emits once on entry and keeps focus internal across content, toolbar, status, and owned overlays', async () => {
    const { fixture, host, root } = await createHost();
    const content = root.querySelector('.ProseMirror') as HTMLElement;
    const toolbar = root.querySelector(
      '[mlvEditorToolbarStart]',
    ) as HTMLElement;
    const status = root.querySelector('[mlvEditorStatus]') as HTMLElement;
    const registry = fixture.debugElement
      .query(By.directive(MlvEditor))
      .injector.get(MLV_EDITOR_OVERLAY_REGISTRY) as MlvEditorOverlayRegistry;
    const overlay = document.createElement('button');
    document.body.append(overlay);
    registry.register(overlay, () => overlay.remove());

    content.focus();
    await settle();
    toolbar.focus();
    await settle();
    status.focus();
    await settle();
    overlay.focus();
    await settle();

    expect(host.focusEvents).toHaveLength(1);
    expect(host.blurEvents).toHaveLength(0);
    expect(host.touches()).toBe(0);
    expect(host.editor().focused()).toBe(true);
  });

  it('emits one blur and touch only when focus really leaves the composite', async () => {
    const { fixture, host, root } = await createHost();
    const content = root.querySelector('.ProseMirror') as HTMLElement;
    const after = [...root.querySelectorAll('button')].at(-1) as HTMLElement;
    const editorHost = fixture.debugElement.query(By.directive(MlvEditor))
      .nativeElement as HTMLElement;
    document.body.append(editorHost);
    try {
      content.focus();
      await settle();
      after.focus();
      await settle();
      after.focus();
      await settle();

      expect(host.blurEvents).toHaveLength(1);
      expect(host.touches()).toBe(1);
      expect(host.editor().focused()).toBe(false);
    } finally {
      fixture.destroy();
      editorHost.remove();
    }
  });

  it('keeps readonly content focusable, selectable, and copyable while blocking mutation', async () => {
    const { fixture, host, root } = await createHost();
    const content = root.querySelector('.ProseMirror') as HTMLElement;
    const editor = host.editor().editor();
    if (!editor) throw new Error('Expected the editor to be created.');
    editor.commands.setContent('<p>Readonly text</p>');
    editor.commands.setTextSelection({ from: 1, to: 9 });
    const selectionBefore = editor.state.selection.toJSON();
    const copy = vi.fn();
    content.addEventListener('copy', copy);
    host.readonly.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    const text = content.querySelector('p')?.firstChild;
    if (!text) throw new Error('Expected rendered readonly text.');
    const range = document.createRange();
    range.setStart(text, 0);
    range.setEnd(text, 'Readonly'.length);
    const domSelection = document.getSelection();
    if (!domSelection) throw new Error('Expected a DOM selection.');
    domSelection.removeAllRanges();
    domSelection.addRange(range);
    content.focus();
    await settle();
    const copyEvent = new Event('copy', { bubbles: true, cancelable: true });
    expect(content.dispatchEvent(copyEvent)).toBe(true);

    expect(content.getAttribute('contenteditable')).toBe('false');
    expect(content.getAttribute('tabindex')).toBe('0');
    expect(host.editor().focused()).toBe(true);
    expect(editor.state.selection.toJSON()).toEqual(selectionBefore);
    expect(domSelection.toString()).toBe('Readonly');
    expect(copy).toHaveBeenCalledTimes(1);
    expect(copyEvent.defaultPrevented).toBe(false);
    expect(
      host.editor().run((instance) => instance.commands.toggleBold()),
    ).toBe(false);
  });

  it('makes the complete disabled composite inert while preserving editor state for re-enable', async () => {
    const { fixture, host, root } = await createHost();
    const content = root.querySelector('.ProseMirror') as HTMLElement;
    const toolbar = root.querySelector(
      '[mlvEditorToolbarStart]',
    ) as HTMLButtonElement;
    const status = root.querySelector('[mlvEditorStatus]') as HTMLButtonElement;
    const editor = host.editor().editor();
    if (!editor) throw new Error('Expected the editor to be created.');
    editor.commands.setContent('<p>State remains</p>');
    editor.commands.setTextSelection(3);
    editor.commands.toggleBold();
    const selectionBefore = editor.state.selection.toJSON();
    const valueBefore = host.editor().value();
    expect(host.editor().isActive('bold')).toBe(true);

    host.disabled.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(content.getAttribute('tabindex')).toBe('-1');
    expect(content.getAttribute('aria-disabled')).toBe('true');
    expect(root.querySelector('mlv-editor')?.hasAttribute('inert')).toBe(true);
    toolbar.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true }),
    );
    const enter = new KeyboardEvent('keydown', {
      bubbles: true,
      key: 'Enter',
      cancelable: true,
    });
    const space = new KeyboardEvent('keydown', {
      bubbles: true,
      key: ' ',
      cancelable: true,
    });
    status.dispatchEvent(enter);
    status.dispatchEvent(space);
    expect(enter.defaultPrevented).toBe(true);
    expect(space.defaultPrevented).toBe(true);
    expect(host.statusKeydowns()).toBe(0);
    expect(host.toolbarActivations()).toBe(0);
    expect(host.statusActivations()).toBe(0);
    expect(
      host.editor().run((instance) => instance.commands.clearContent()),
    ).toBe(false);
    expect(host.editor().can((instance) => instance.can().toggleBold())).toBe(
      false,
    );
    expect(host.editor().editor()).toBe(editor);
    expect(host.editor().value()).toBe(valueBefore);
    expect(editor.state.selection.toJSON()).toEqual(selectionBefore);
    expect(host.editor().isActive('bold')).toBe(true);

    host.disabled.set(false);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(host.editor().editor()).toBe(editor);
    expect(editor.isEditable).toBe(true);
    expect(content.getAttribute('tabindex')).toBe('0');
    expect(host.editor().isActive('bold')).toBe(true);
  });

  it('closes editor-owned overlays and removes composite focus when disabled', async () => {
    const { fixture, host, root } = await createHost();
    const registry = fixture.debugElement
      .query(By.directive(MlvEditor))
      .injector.get(MLV_EDITOR_OVERLAY_REGISTRY) as MlvEditorOverlayRegistry;
    const uploadRegistry = fixture.debugElement
      .query(By.directive(MlvEditor))
      .injector.get(
        MLV_EDITOR_UPLOAD_ABORT_REGISTRY,
      ) as MlvEditorUploadAbortRegistry;
    const overlay = document.createElement('button');
    const close = vi.fn(() =>
      (root.querySelector('.ProseMirror') as HTMLElement).focus(),
    );
    const abortFirst = vi.fn(() => {
      throw new Error('abort failed');
    });
    const abortSecond = vi.fn();
    document.body.append(overlay);
    registry.register(overlay, close);
    uploadRegistry.register(abortFirst);
    uploadRegistry.register(abortSecond);
    overlay.focus();
    await settle();

    host.disabled.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(close).toHaveBeenCalledTimes(1);
    expect(host.editor().focused()).toBe(false);
    expect(host.blurEvents).toHaveLength(0);
    expect(host.touches()).toBe(0);
    expect(abortFirst).toHaveBeenCalledTimes(1);
    expect(abortSecond).toHaveBeenCalledTimes(1);
    host.disabled.set(false);
    fixture.detectChanges();
    await fixture.whenStable();
    registry.register(overlay, vi.fn());
    uploadRegistry.register(abortSecond);
    await settle();
    fixture.destroy();
    expect(abortSecond).toHaveBeenCalledTimes(2);
    expect(close).toHaveBeenCalledTimes(1);
    expect(host.editor().focused()).toBe(false);
    overlay.remove();
  });
});
