import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MlvEditor, type MlvEditorTransactionEvent } from '@malva-ui/editor';
import type { Editor } from '@tiptap/core';
import {
  CollaborationRig,
  configureCollaborationTestBed,
  tiptap,
} from './testing/collaboration-harness';
import type { MemoryTransport } from './testing/memory-relay';

/** A plain editor, no collaboration. */
@Component({
  imports: [MlvEditor],
  template: `<mlv-editor
    [(value)]="value"
    (transaction)="events.push($event)"
  />`,
})
class PlainEditorHost {
  readonly value = signal<string | null>('<p>Start</p>');
  readonly events: MlvEditorTransactionEvent[] = [];
  readonly editor = viewChild.required(MlvEditor);
}

describe('MlvEditorCollaboration — transaction origin (F-D9)', () => {
  let rig: CollaborationRig;

  beforeEach(async () => {
    await configureCollaborationTestBed([PlainEditorHost]);
    rig = new CollaborationRig();
  });

  afterEach(() => rig.destroy());

  const type = (editor: Editor, pos: number, text: string): void =>
    editor.view.dispatch(editor.state.tr.insertText(text, pos));

  /** Origins of the transactions recorded since `from`. */
  const origins = (
    events: readonly MlvEditorTransactionEvent[],
    from = 0,
  ): string[] => events.slice(from).map((event) => event.origin);

  it('marks the first render and the seed as remote', async () => {
    const hub = rig.hub('server');
    const a = await rig.mount({
      transport: hub.endpoint(),
      initialContent: '<p>Seed</p>',
    });
    await rig.sync(hub);
    const seeded = a.componentInstance.transactions.filter(
      (event) => event.editor.getText() === 'Seed',
    );
    expect(seeded.length).toBeGreaterThan(0);
    expect(new Set(origins(seeded))).toEqual(new Set(['remote']));
    expect(origins(a.componentInstance.transactions)).not.toContain('local');
  });

  it('marks user input, commands, clearValue and undo / redo as local, and peer updates as remote', async () => {
    const hub = rig.hub('server');
    const a = await rig.mount({ transport: hub.endpoint() });
    const b = await rig.mount({ transport: hub.endpoint() });
    await rig.sync(hub);
    const [editorA, editorB] = [tiptap(a), tiptap(b)];
    const events = a.componentInstance.transactions;

    let from = events.length;
    type(editorA, 1, 'typed');
    expect(origins(events, from)).toEqual(['local']);

    from = events.length;
    a.componentInstance
      .editor()
      .run((editor) => editor.commands.insertContent(' run'));
    editorA.commands.insertContent(' direct');
    expect(new Set(origins(events, from))).toEqual(new Set(['local']));
    await rig.sync(hub);

    from = events.length;
    type(editorB, 1, 'peer ');
    await rig.sync(hub);
    expect(origins(events, from)).toContain('remote');
    expect(origins(events, from)).not.toContain('local');

    from = events.length;
    editorA.commands.undo();
    editorA.commands.redo();
    expect(origins(events, from).length).toBeGreaterThan(0);
    expect(new Set(origins(events, from))).toEqual(new Set(['local']));

    from = events.length;
    a.componentInstance.editor().clearValue();
    expect(new Set(origins(events, from))).toEqual(new Set(['local']));
    expect(editorA.getText()).toBe('');
  });

  it('refuses clearValue while the gate is closed', async () => {
    const hub = rig.hub('server', { autoConnect: false });
    const fixture = await rig.mount({ transport: hub.endpoint() });
    const editor = tiptap(fixture);
    const before = fixture.componentInstance.transactions.length;
    fixture.componentInstance.editor().clearValue();
    expect(fixture.componentInstance.transactions.length).toBe(before);
    (hub.endpoints[0] as MemoryTransport).goOnline();
    await rig.sync(hub);
    expect(editor.isEditable).toBe(true);
  });

  it('keeps every transaction of a non-collaborating editor local', async () => {
    const fixture = TestBed.createComponent(PlainEditorHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.componentInstance;
    const editor = host.editor().editor() as Editor;
    type(editor, 1, 'typed ');
    host.value.set('<p>Loaded</p>');
    fixture.detectChanges();
    await fixture.whenStable();
    editor.commands.undo();
    expect(host.events.length).toBeGreaterThan(2);
    expect(new Set(origins(host.events))).toEqual(new Set(['local']));
    fixture.destroy();
  });
});
