import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { vi } from 'vitest';
import type { MlvEditorError } from './editor.types';
import {
  MLV_EDITOR_OVERLAY_REGISTRY,
  MLV_EDITOR_TOOLBAR_CONTEXT,
  MLV_EDITOR_UPLOAD_ABORT_REGISTRY,
  type MlvEditorOverlayRegistry,
  type MlvEditorToolbarContext,
  type MlvEditorUploadAbortRegistry,
} from './editor-toolbar-context';
import { MlvEditor } from './editor/editor';

@Component({
  imports: [MlvEditor],
  template: '<mlv-editor [readonly]="readonly()" />',
})
class ContextHost {
  readonly editor = viewChild.required(MlvEditor);
  readonly readonly = signal(false);
}

describe('MlvEditorToolbarContext', () => {
  async function createHost() {
    await TestBed.configureTestingModule({
      imports: [ContextHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(ContextHost);
    fixture.detectChanges();
    await fixture.whenStable();
    return { fixture, host: fixture.componentInstance };
  }

  it('is editor-scoped and runs available commands safely', async () => {
    const { fixture, host } = await createHost();
    const context = fixture.debugElement
      .query(By.directive(MlvEditor))
      .injector.get(MLV_EDITOR_TOOLBAR_CONTEXT) as MlvEditorToolbarContext;
    const editor = host.editor().editor();
    if (!editor) throw new Error('Expected the editor to be created.');

    expect(context.editor()).toBe(editor);
    expect(context.run((instance) => instance.commands.toggleBold())).toBe(
      true,
    );
    expect(context.isActive('bold')).toBe(true);
    expect(context.can((instance) => instance.can().toggleBold())).toBe(true);
    expect(context.focused()).toBe(false);
    expect(context.editable()).toBe(true);

    const errors: MlvEditorError[] = [];
    host.editor().editorError.subscribe((error) => errors.push(error));
    const reported: MlvEditorError = {
      code: 'unsupported-command',
      message: 'Consumer command failed.',
      recoverable: true,
    };
    context.reportError(reported);
    expect(errors).toEqual([reported]);

    (
      fixture.nativeElement.querySelector('.ProseMirror') as HTMLElement
    ).focus();
    expect(context.focused()).toBe(true);

    host.readonly.set(true);
    fixture.detectChanges();
    expect(context.editable()).toBe(false);
  });

  it('returns false rather than throwing for unavailable commands or no editor', async () => {
    const { fixture } = await createHost();
    const context = fixture.debugElement
      .query(By.directive(MlvEditor))
      .injector.get(MLV_EDITOR_TOOLBAR_CONTEXT) as MlvEditorToolbarContext;

    expect(
      context.run(() => {
        throw new Error('missing command');
      }),
    ).toBe(false);
    expect(
      context.can(() => {
        throw new Error('missing command');
      }),
    ).toBe(false);
    expect(context.isActive('does-not-exist')).toBe(false);
    fixture.destroy();
    expect(context.run(() => true)).toBe(false);
    expect(context.can(() => true)).toBe(false);
  });

  it('isolates context zoom and internal cleanup registries per editor', async () => {
    @Component({
      imports: [MlvEditor],
      template: '<mlv-editor /><mlv-editor />',
    })
    class TwoEditorsHost {}

    await TestBed.configureTestingModule({
      imports: [TwoEditorsHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(TwoEditorsHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const editors = fixture.debugElement.queryAll(By.directive(MlvEditor));
    const first = editors[0].injector.get(
      MLV_EDITOR_TOOLBAR_CONTEXT,
    ) as MlvEditorToolbarContext;
    const second = editors[1].injector.get(
      MLV_EDITOR_TOOLBAR_CONTEXT,
    ) as MlvEditorToolbarContext;
    const firstOverlays = editors[0].injector.get(
      MLV_EDITOR_OVERLAY_REGISTRY,
    ) as MlvEditorOverlayRegistry;
    const secondOverlays = editors[1].injector.get(
      MLV_EDITOR_OVERLAY_REGISTRY,
    ) as MlvEditorOverlayRegistry;
    const firstUploads = editors[0].injector.get(
      MLV_EDITOR_UPLOAD_ABORT_REGISTRY,
    ) as MlvEditorUploadAbortRegistry;
    const secondUploads = editors[1].injector.get(
      MLV_EDITOR_UPLOAD_ABORT_REGISTRY,
    ) as MlvEditorUploadAbortRegistry;

    first.zoom.set(125);
    expect(second.zoom()).toBe(100);
    expect(first.editor()).not.toBe(second.editor());
    expect(firstOverlays).not.toBe(secondOverlays);
    expect(firstUploads).not.toBe(secondUploads);
  });

  it('makes duplicate overlay registration idempotent and continues cleanup after a close failure', async () => {
    const { fixture } = await createHost();
    const overlays = fixture.debugElement
      .query(By.directive(MlvEditor))
      .injector.get(MLV_EDITOR_OVERLAY_REGISTRY) as MlvEditorOverlayRegistry;
    const one = document.createElement('div');
    const two = document.createElement('div');
    const failedClose = vi.fn(() => {
      throw new Error('close failed');
    });
    const secondClose = vi.fn();
    document.body.append(one, two);
    overlays.register(one, failedClose);
    overlays.register(one, failedClose);
    overlays.register(two, secondClose);

    expect(() => overlays.closeAll()).not.toThrow();
    expect(failedClose).toHaveBeenCalledTimes(1);
    expect(secondClose).toHaveBeenCalledTimes(1);
    one.remove();
    two.remove();
  });
});
