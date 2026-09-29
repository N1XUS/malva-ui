import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import type { Editor } from '@tiptap/core';
import type { Awareness } from 'y-protocols/awareness';
import type { MlvEditorCollaboration } from './collaboration';
import {
  CollaborationRig,
  configureCollaborationTestBed,
  tiptap,
} from './testing/collaboration-harness';

/*
 * F-D18: remote carets are Malva's own widgets over y-tiptap's cursor plugin
 * — BEM classes, validated names and colours, a label colour that holds
 * 4.5:1, hidden from AT and from serialization, and not shown for this
 * client or for peers who only view.
 */

describe('Remote carets (F-D18)', () => {
  let rig: CollaborationRig;

  beforeEach(async () => {
    await configureCollaborationTestBed();
    rig = new CollaborationRig();
  });

  afterEach(() => rig.destroy());

  /** The session awareness behind a directive; spec-only private access. */
  const awarenessOf = (collaboration: MlvEditorCollaboration): Awareness =>
    (
      collaboration as unknown as {
        _session: () => { awareness: Awareness } | null;
      }
    )._session()?.awareness as Awareness;

  /** Focuses `editor` with a selection, so y-tiptap publishes its cursor. */
  const focusAt = (editor: Editor, from: number, to = from) => {
    editor.commands.setTextSelection({ from, to });
    editor.view.dom.dispatchEvent(new FocusEvent('focusin'));
    vi.spyOn(editor.view, 'hasFocus').mockReturnValue(true);
    editor.view.dispatch(editor.state.tr.setMeta('focus', true));
  };

  /**
   * Delivers awareness, then waits the task y-tiptap batches awareness
   * repaints into (`setMeta` runs on a zero timeout).
   */
  const settle = async (hub: ReturnType<CollaborationRig['hub']>) => {
    await rig.sync(hub);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await rig.sync(hub);
  };

  const carets = (editor: Editor) => [
    ...editor.view.dom.querySelectorAll<HTMLElement>('.mlv-editor__caret'),
  ];

  async function pair(options: { readonlyB?: boolean } = {}) {
    const hub = rig.hub('server');
    const a = await rig.mount({
      transport: hub.endpoint(),
      initialContent: '<p>Hello world</p>',
      user: { id: 'grace', name: 'Grace', color: '#e6574b' },
    });
    const b = await rig.mount({
      transport: hub.endpoint(),
      initialContent: '<p>Hello world</p>',
      user: { id: 'ada', name: 'Ada', color: '#4387e4' },
    });
    if (options.readonlyB) b.componentInstance.readonly.set(true);
    await rig.sync(hub);
    return { hub, a, b, editorA: tiptap(a), editorB: tiptap(b) };
  }

  it('renders a peer caret and selection with Malva classes and colours', async () => {
    const { hub, a, b, editorA, editorB } = await pair();
    focusAt(editorB, 1, 6);
    await settle(hub);

    const [caret] = carets(editorA);
    expect(carets(editorA)).toHaveLength(1);
    expect(caret.getAttribute('aria-hidden')).toBe('true');
    expect(caret.dataset['clientId']).toBe(
      String(b.componentInstance.collaboration().self()?.clientId),
    );
    expect(caret.style.getPropertyValue('--mlv-editor-caret-color')).toBe(
      '#4387e4',
    );
    expect(caret.style.getPropertyValue('--mlv-editor-caret-label-color')).toBe(
      '#000000',
    );
    expect(caret.querySelector('.mlv-editor__caret-label')?.textContent).toBe(
      'Ada',
    );
    const selection = editorA.view.dom.querySelector<HTMLElement>(
      '.mlv-editor__caret-selection',
    );
    expect(selection?.textContent).toBe('Hello');
    expect(selection?.getAttribute('style')).toContain('#4387e4');
    // The first-line flip selector matches the real mount: Tiptap puts
    // `.ProseMirror` inside `.mlv-editor__content`, not on it.
    expect(
      caret.closest('.mlv-editor__content .ProseMirror > :first-child'),
    ).not.toBeNull();

    // Never this client's own caret, never in the serialized value.
    expect(carets(editorB)).toEqual([]);
    expect(editorA.getHTML()).not.toContain('caret');
    expect(a.componentInstance.value()).not.toContain('caret');

    // TestBed keeps only the latest root in the document; put A's back for
    // the sweep, since axe needs a connected element.
    document.body.append(a.nativeElement as HTMLElement);
    await expectNoAxeViolations(a.nativeElement as HTMLElement);
  });

  it('shows no caret for a peer who only views', async () => {
    const { hub, b, editorA, editorB } = await pair({ readonlyB: true });
    expect(b.componentInstance.collaboration().self()?.mode).toBe('viewing');
    focusAt(editorB, 3);
    await settle(hub);
    expect(carets(editorA)).toEqual([]);
  });

  it('maps carets through a multi-step local transaction and hides them for a structural one', async () => {
    const { hub, editorA, editorB } = await pair();
    focusAt(editorB, 12);
    await settle(hub);
    expect(carets(editorA)).toHaveLength(1);

    // Insert, then delete past the start document's end (13): y-tiptap 3.0.9
    // resolved the deletion there and threw `RangeError` from `apply`.
    expect(() =>
      editorA.view.dispatch(
        editorA.state.tr.insertText('abcdefghijklmnopqrst', 1).delete(20, 25),
      ),
    ).not.toThrow();
    expect(editorA.getText()).toBe('abcdefghijklmnopqrso world');
    expect(carets(editorA)).toHaveLength(1);
    expect(
      carets(editorA)[0].querySelector('.mlv-editor__caret-label')?.textContent,
    ).toBe('Ada');

    // A block inserted after another step is structural: hidden, as upstream,
    // until the peer republishes its cursor.
    const paragraph = editorA.schema.nodes['paragraph'].create();
    editorA.view.dispatch(
      editorA.state.tr
        .insertText('!', 1)
        .insert(editorA.state.doc.content.size + 1, paragraph),
    );
    expect(carets(editorA)).toEqual([]);
  });

  it('validates a raw remote name and colour, and does not write y-tiptap defaults back', async () => {
    const { hub, a, b, editorA, editorB } = await pair();
    awarenessOf(b.componentInstance.collaboration()).setLocalStateField(
      'user',
      { name: 42, color: 'red', mode: 'editing' },
    );
    focusAt(editorB, 3);
    await settle(hub);

    const [caret] = carets(editorA);
    expect(caret.querySelector('.mlv-editor__caret-label')?.textContent).toBe(
      'Anonymous',
    );
    expect(caret.style.getPropertyValue('--mlv-editor-caret-color')).toMatch(
      /^#[0-9a-f]{6}$/,
    );
    const [peer] = a.componentInstance.collaboration().peers();
    expect([peer.name, peer.color]).toEqual([
      'Anonymous',
      caret.style.getPropertyValue('--mlv-editor-caret-color'),
    ]);
  });
});
