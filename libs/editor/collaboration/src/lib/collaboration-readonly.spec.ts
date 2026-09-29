import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import type { Editor } from '@tiptap/core';
import {
  CollaborationRig,
  configureCollaborationTestBed,
  tiptap,
} from './testing/collaboration-harness';

/*
 * F-D20: a readonly or disabled collaborating editor stays a live viewer —
 * remote edits render, it is in presence as `viewing`, it writes nothing —
 * and toggling back makes it an editor again. The presence component of the
 * other side names it as a viewer.
 */

describe('Readonly and disabled collaborators (F-D20)', () => {
  let rig: CollaborationRig;

  beforeEach(async () => {
    await configureCollaborationTestBed();
    rig = new CollaborationRig();
  });

  afterEach(() => rig.destroy());

  /** Appends `text` at the end of the last paragraph. */
  const type = (editor: Editor, text: string) =>
    editor.commands.insertContentAt(editor.state.doc.content.size - 1, text);

  async function pair(options: { presenceOnB?: boolean } = {}) {
    const hub = rig.hub('server');
    const a = await rig.mount({
      transport: hub.endpoint(),
      initialContent: '<p>Hello world</p>',
      user: { id: 'grace', name: 'Grace', color: '#e6574b' },
      presence: true,
    });
    const b = await rig.mount({
      transport: hub.endpoint(),
      initialContent: '<p>Hello world</p>',
      user: { id: 'ada', name: 'Ada', color: '#4387e4' },
      presence: options.presenceOnB ?? false,
    });
    await rig.sync(hub);
    return { hub, a, b, editorA: tiptap(a), editorB: tiptap(b) };
  }

  const avatarNames = (root: HTMLElement) =>
    [
      ...root.querySelectorAll('mlv-editor-presence mlv-avatar[role="img"]'),
    ].map((avatar) => avatar.getAttribute('aria-label'));

  it('keeps a readonly editor live, as a viewer with no toolbar', async () => {
    const { hub, a, b, editorA, editorB } = await pair({ presenceOnB: true });
    b.componentInstance.readonly.set(true);
    await rig.sync(hub);

    type(editorA, '!');
    await rig.sync(hub);
    expect(editorB.getText()).toBe('Hello world!');
    expect(editorB.isEditable).toBe(false);
    expect(b.componentInstance.collaboration().self()?.mode).toBe('viewing');
    expect(
      (b.nativeElement as HTMLElement).querySelector(
        '.mlv-editor__toolbar-band',
      ),
    ).toBeNull();

    // The editing side's presence names the viewer.
    expect(avatarNames(a.nativeElement as HTMLElement)).toEqual([
      'Ada (viewing)',
    ]);
    // The viewer's own presence lists the editor, with the synced status.
    const viewer = b.nativeElement as HTMLElement;
    expect(avatarNames(viewer)).toEqual(['Grace']);
    expect(
      viewer.querySelector('.mlv-editor-presence__status-text')?.textContent,
    ).toBe('All changes synced');
    await expectNoAxeViolations(viewer);
  });

  it('turns a disabled editor into a viewer and back', async () => {
    const { hub, a, b, editorA, editorB } = await pair();
    b.componentInstance.disabled.set(true);
    await rig.sync(hub);
    expect(b.componentInstance.collaboration().self()?.mode).toBe('viewing');
    expect(avatarNames(a.nativeElement as HTMLElement)).toEqual([
      'Ada (viewing)',
    ]);

    type(editorA, '?');
    await rig.sync(hub);
    expect([editorB.getText(), editorB.isEditable]).toEqual([
      'Hello world?',
      false,
    ]);

    b.componentInstance.disabled.set(false);
    await rig.sync(hub);
    expect(b.componentInstance.collaboration().self()?.mode).toBe('editing');
    expect(editorB.isEditable).toBe(true);
    expect(avatarNames(a.nativeElement as HTMLElement)).toEqual(['Ada']);

    type(editorB, '.');
    await rig.sync(hub);
    expect(editorA.getText()).toBe('Hello world?.');
  });
});
