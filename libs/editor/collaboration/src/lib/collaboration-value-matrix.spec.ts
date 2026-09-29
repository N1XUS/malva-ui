import { Component, signal, viewChild, type Type } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { disabled, form, FormField } from '@angular/forms/signals';
import { MlvEditor, type MlvEditorError } from '@malva-ui/editor';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvEditorCollaboration } from './collaboration';
import {
  CollaborationRig,
  CollaborationTestEditor,
  tiptap,
} from './testing/collaboration-harness';
import type { MemoryTransport } from './testing/memory-relay';

/*
 * The collaboration variant of the forms binding matrix: `verifyFormsBinding`'s
 * write leg (an external value reaches the editor) is exactly what
 * collaboration forbids, so each mode asserts the output-only mirror instead.
 */

const COLLABORATION =
  'mlvEditorCollaboration [mlvEditorCollaboration]="transport" collaborationDocumentId="doc-1"';
const ERRORS = '(editorError)="errors.push($event)"';

/** What each host exposes to the shared assertions. */
interface MatrixHost {
  transport: MemoryTransport | null;
  readonly errors: MlvEditorError[];
  readonly editor: () => MlvEditor;
  value(): string | null;
  write(value: string | null): void;
  disable(value: boolean): void;
}

@Component({
  imports: [MlvEditor, MlvEditorCollaboration],
  template: `<mlv-editor
    ${COLLABORATION}
    ${ERRORS}
    [(value)]="model"
    [disabled]="off()"
  />`,
})
class DirectHost implements MatrixHost {
  transport: MemoryTransport | null = null;
  readonly errors: MlvEditorError[] = [];
  readonly model = signal<string | null>(null);
  readonly off = signal(false);
  readonly editor = viewChild.required(MlvEditor);
  value = () => this.model();
  write = (value: string | null) => this.model.set(value);
  disable = (value: boolean) => this.off.set(value);
}

@Component({
  imports: [MlvEditor, MlvEditorCollaboration, ReactiveFormsModule],
  template: `<mlv-editor ${COLLABORATION} ${ERRORS} [formControl]="control" />`,
})
class ReactiveHost implements MatrixHost {
  transport: MemoryTransport | null = null;
  readonly errors: MlvEditorError[] = [];
  readonly control = new FormControl<string | null>(null);
  readonly editor = viewChild.required(MlvEditor);
  value = () => this.control.value;
  write = (value: string | null) => this.control.setValue(value);
  disable = (value: boolean) =>
    value ? this.control.disable() : this.control.enable();
}

@Component({
  imports: [MlvEditor, MlvEditorCollaboration, FormsModule],
  template: `<mlv-editor
    ${COLLABORATION}
    ${ERRORS}
    [(ngModel)]="model"
    [disabled]="off()"
  />`,
})
class NgModelHost implements MatrixHost {
  transport: MemoryTransport | null = null;
  readonly errors: MlvEditorError[] = [];
  readonly model = signal<string | null>(null);
  readonly off = signal(false);
  readonly editor = viewChild.required(MlvEditor);
  value = () => this.model();
  write = (value: string | null) => this.model.set(value);
  disable = (value: boolean) => this.off.set(value);
}

@Component({
  imports: [MlvEditor, MlvEditorCollaboration, FormField],
  template: `<mlv-editor
    ${COLLABORATION}
    ${ERRORS}
    [formField]="field.body"
  />`,
})
class SignalFormsHost implements MatrixHost {
  transport: MemoryTransport | null = null;
  readonly errors: MlvEditorError[] = [];
  readonly off = signal(false);
  readonly model = signal<{ body: string | null }>({ body: null });
  readonly field = form(this.model, (path) =>
    disabled(path.body, () => this.off()),
  );
  readonly editor = viewChild.required(MlvEditor);
  value = () => this.model().body;
  write = (value: string | null) => this.model.set({ body: value });
  disable = (value: boolean) => this.off.set(value);
}

describe('MlvEditorCollaboration — forms bindings matrix', () => {
  let rig: CollaborationRig;

  afterEach(() => rig.destroy());

  it.each([
    ['[(value)]', DirectHost],
    ['[formControl]', ReactiveHost],
    ['[(ngModel)]', NgModelHost],
    ['[formField]', SignalFormsHost],
  ] as [string, Type<MatrixHost>][])(
    '%s mirrors the shared document and never writes it',
    async (_mode, hostType) => {
      await TestBed.configureTestingModule({
        imports: [hostType, CollaborationTestEditor],
        providers: [provideMlvI18nTesting()],
      }).compileComponents();
      rig = new CollaborationRig();
      const hub = rig.hub('server');
      const fixture: ComponentFixture<MatrixHost> =
        TestBed.createComponent(hostType);
      fixture.componentInstance.transport = hub.endpoint();
      fixture.detectChanges();
      await fixture.whenStable();
      const peer = await rig.mount({ transport: hub.endpoint() });
      const settle = async () => {
        for (let round = 0; round < 3; round++) {
          hub.flush();
          fixture.detectChanges();
          await fixture.whenStable();
          await rig.settle();
        }
      };
      await settle();
      const host = fixture.componentInstance;
      const editor = host.editor().editor();
      if (!editor) throw new Error('no editor');

      // Local edits write the model synchronously.
      editor.view.dispatch(editor.state.tr.insertText('Local', 1));
      await settle();
      expect(host.value()).toBe('<p>Local</p>');

      // Remote edits reach the model after the coalescing window.
      const peerEditor = tiptap(peer);
      peerEditor.view.dispatch(
        peerEditor.state.tr.insertText(
          ' peer',
          peerEditor.state.doc.content.size - 1,
        ),
      );
      await settle();
      await new Promise((resolve) => setTimeout(resolve, 150));
      await settle();
      expect(host.value()).toBe('<p>Local peer</p>');

      // An external write never reaches the editor; the model is restored.
      host.write('<p>External</p>');
      await settle();
      expect(editor.getText()).toBe('Local peer');
      expect(peerEditor.getText()).toBe('Local peer');
      expect(host.value()).toBe('<p>Local peer</p>');
      expect(
        host.errors.map((error) => [error.code, error.recoverable]),
      ).toEqual([['collaboration', true]]);

      // Disabled still flows through the binding and closes local input.
      host.disable(true);
      await settle();
      expect(host.editor().computedDisabled()).toBe(true);
      expect(editor.isEditable).toBe(false);
      host.disable(false);
      await settle();
      expect(editor.isEditable).toBe(true);
      fixture.destroy();
    },
  );
});
