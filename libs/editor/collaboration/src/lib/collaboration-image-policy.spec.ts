import {
  MLV_EDITOR_DEFAULT_IMAGE_UPLOAD_OPTIONS,
  mlvEditorDefaultExtensions,
} from '@malva-ui/editor';
import { Editor } from '@tiptap/core';
import { NodeSelection } from '@tiptap/pm/state';
import {
  CollaborationRig,
  configureCollaborationTestBed,
  tiptap,
} from './testing/collaboration-harness';

/*
 * F-D23 / U5: `imageUploadOptions.urlPolicy` guarded uploads only. A peer's
 * image reaches the shared document without passing the upload coordinator,
 * so a collaborating editor renders only the sources the policy accepts.
 */

describe('Collaboration image URL policy (F-D23)', () => {
  let rig: CollaborationRig;

  beforeEach(async () => {
    await configureCollaborationTestBed();
    rig = new CollaborationRig();
  });

  afterEach(() => rig.destroy());

  /** Every rendered `<img>` in an editor's content, in document order. */
  const images = (editor: Editor): HTMLImageElement[] =>
    Array.from(editor.view.dom.querySelectorAll('img'));

  async function pair(
    options: Partial<typeof MLV_EDITOR_DEFAULT_IMAGE_UPLOAD_OPTIONS> = {},
  ) {
    const hub = rig.hub('server');
    const imageUploadOptions = {
      ...MLV_EDITOR_DEFAULT_IMAGE_UPLOAD_OPTIONS,
      ...options,
    };
    const a = await rig.mount({
      transport: hub.endpoint(),
      initialContent: '<p>Start</p>',
      imageUploadOptions,
    });
    const b = await rig.mount({
      transport: hub.endpoint(),
      initialContent: '<p>Start</p>',
      imageUploadOptions,
    });
    await rig.sync(hub);
    return { hub, editorA: tiptap(a), editorB: tiptap(b) };
  }

  /** Appends one image node, bypassing HTML parsing as a peer's update does. */
  const insertImage = (editor: Editor, src: string): void => {
    const image = editor.schema.nodes['image'].create({ src, alt: src });
    editor.view.dispatch(
      editor.state.tr.insert(editor.state.doc.content.size, image),
    );
  };

  /** The `src` of every image node in `editor`'s document, in order. */
  const documentSources = (editor: Editor): string[] => {
    const sources: string[] = [];
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'image') sources.push(node.attrs['src']);
    });
    return sources;
  };

  /** Resolves after `ms` milliseconds. */
  const wait = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms));

  it('withholds a peer image source the default policy rejects', async () => {
    const { hub, editorA, editorB } = await pair();
    insertImage(editorB, 'https://images.example.com/ok.png');
    insertImage(editorB, 'javascript:alert(1)');
    insertImage(editorB, 'data:image/svg+xml,<svg onload="alert(1)"/>');
    insertImage(editorB, 'https://user:pw@images.example.com/cat.png');
    // Relative: resolved against the document base, so it renders.
    insertImage(editorB, '/relative.png');
    await rig.sync(hub);

    const rendered = images(editorA);
    expect(rendered).toHaveLength(5);
    expect(rendered.map((img) => img.getAttribute('src'))).toEqual([
      'https://images.example.com/ok.png',
      null,
      null,
      null,
      '/relative.png',
    ]);
    expect(
      rendered.map((img) => img.hasAttribute('data-mlv-editor-image-blocked')),
    ).toEqual([false, true, true, true, false]);
    // The shared document keeps every attribute: a peer whose policy allows
    // a source still sees it, and nothing is rewritten for everyone.
    const sources = documentSources(editorA);
    expect(sources).toHaveLength(5);
    expect(sources[1]).toBe('javascript:alert(1)');
  });

  it('withholds a source a later remote update swaps in', async () => {
    const { hub, editorA, editorB } = await pair();
    insertImage(editorB, 'https://images.example.com/ok.png');
    await rig.sync(hub);
    expect(images(editorA)[0].getAttribute('src')).toBe(
      'https://images.example.com/ok.png',
    );

    let at = -1;
    editorB.state.doc.descendants((node, pos) => {
      if (node.type.name === 'image') at = pos;
    });
    editorB.view.dispatch(
      editorB.state.tr.setNodeAttribute(at, 'src', 'javascript:alert(2)'),
    );
    await rig.sync(hub);
    const [img] = images(editorA);
    expect(img.getAttribute('src')).toBeNull();
    expect(img.hasAttribute('data-mlv-editor-image-blocked')).toBe(true);
  });

  it('renders an image blocked when the host urlPolicy throws', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {
      /* y-tiptap logs a throw from a node view; asserted below */
    });
    try {
      // A host policy that throws on a host it has no rule for. It is armed
      // once B has rendered its own edit, so the throw lands where a peer's
      // image is rendered: in A's view, while A applies the remote update.
      const allow = new Map([['images.example.com', /\.png$/]]);
      let armed = false;
      const { hub, editorA, editorB } = await pair({
        urlPolicy: (url) => {
          if (!armed) return false;
          const rule = allow.get(new URL(url).host);
          if (!rule) throw new Error(`no rule for ${url}`);
          return rule.test(url);
        },
      });
      insertImage(editorB, 'https://elsewhere.example.org/x.png');
      editorB.view.dispatch(
        editorB.state.tr.insert(
          editorB.state.doc.content.size,
          editorB.schema.nodes['paragraph'].create(
            null,
            editorB.schema.text('After'),
          ),
        ),
      );
      armed = true;
      await rig.sync(hub);

      // Treated as a refusal: the image renders blocked, and the view keeps
      // every node after it (a throw used to abort the view update there).
      const [img] = images(editorA);
      expect(img.getAttribute('src')).toBeNull();
      expect(img.hasAttribute('data-mlv-editor-image-blocked')).toBe(true);
      const view = editorA.view.dom;
      expect(view.children.length).toBe(editorA.state.doc.childCount);
      expect(view.lastElementChild?.textContent).toBe('After');
      const logged = errors.mock.calls.map((call) => call.join(' '));
      expect(logged.filter((line) => line.includes('Yjs update'))).toEqual([]);
    } finally {
      errors.mockRestore();
    }
  });

  it('applies the host urlPolicy to the resolved absolute href', async () => {
    const judged = new Set<string>();
    const { hub, editorA, editorB } = await pair({
      urlPolicy: (url) => {
        judged.add(url);
        return new URL(url).pathname.startsWith('/uploads/');
      },
    });
    insertImage(editorB, '/uploads/a.png');
    insertImage(editorB, 'https://images.example.com/ok.png');
    await rig.sync(hub);
    expect(images(editorA).map((img) => img.getAttribute('src'))).toEqual([
      '/uploads/a.png',
      null,
    ]);
    expect(judged).toContain(new URL('/uploads/a.png', document.baseURI).href);
    expect(judged).not.toContain('/uploads/a.png');
  });

  it('keeps every source in getHTML() and the HTML value', async () => {
    const hub = rig.hub('server');
    const initialContent = '<p>Start</p><img src="/logo.png" alt="logo">';
    const a = await rig.mount({ transport: hub.endpoint(), initialContent });
    const b = await rig.mount({ transport: hub.endpoint(), initialContent });
    await rig.sync(hub);
    const [editorA, editorB] = [tiptap(a), tiptap(b)];
    insertImage(editorB, 'https://user:pw@images.example.com/cat.png');
    await rig.sync(hub);
    await wait(150);
    await rig.settle();

    // The rendered DOM withholds the refused source; serialization does not.
    expect(images(editorA)[1].getAttribute('src')).toBeNull();
    for (const html of [editorA.getHTML(), a.componentInstance.value() ?? '']) {
      expect(html).toContain('src="/logo.png"');
      expect(html).toContain(
        'src="https://user:pw@images.example.com/cat.png"',
      );
      expect(html).not.toContain('data-mlv-editor-image-blocked');
    }
  });

  it('survives a cut and paste of a refused image on both peers', async () => {
    const { hub, editorA, editorB } = await pair();
    const refused = 'https://user:pw@images.example.com/cat.png';
    insertImage(editorB, refused);
    await rig.sync(hub);
    expect(images(editorA)[0].getAttribute('src')).toBeNull();

    let at = -1;
    editorA.state.doc.descendants((node, pos) => {
      if (node.type.name === 'image') at = pos;
    });
    editorA.view.dispatch(
      editorA.state.tr.setSelection(
        NodeSelection.create(editorA.state.doc, at),
      ),
    );
    const { dom } = editorA.view.serializeForClipboard(
      editorA.state.selection.content(),
    );
    editorA.view.dispatch(editorA.state.tr.deleteSelection());
    editorA.commands.setTextSelection(1);
    // jsdom has no ClipboardEvent; the paste handlers read no clipboard data here.
    editorA.view.pasteHTML(dom.innerHTML, new Event('paste') as ClipboardEvent);
    await rig.sync(hub);

    expect([documentSources(editorA), documentSources(editorB)]).toEqual([
      [refused],
      [refused],
    ]);
  });

  it('renders a relative image seeded by the host', async () => {
    const hub = rig.hub('server');
    const initialContent = '<p>Start</p><img src="/logo.png" alt="logo">';
    const a = await rig.mount({ transport: hub.endpoint(), initialContent });
    const b = await rig.mount({ transport: hub.endpoint(), initialContent });
    await rig.sync(hub);
    for (const editor of [tiptap(a), tiptap(b)]) {
      const [img] = images(editor);
      expect(img.getAttribute('src')).toBe('/logo.png');
      expect(img.hasAttribute('data-mlv-editor-image-blocked')).toBe(false);
    }
  });

  it('polices the plain view when resizing is off, keeping serialization', () => {
    const editor = new Editor({
      element: document.createElement('div'),
      extensions: mlvEditorDefaultExtensions({
        resizable: false,
        collaboration: { isChangeOrigin: () => false },
      }),
      content:
        '<img src="https://images.example.com/ok.png" alt="ok">' +
        '<img src="javascript:alert(1)" alt="bad">',
    });
    try {
      const rendered = () => images(editor);
      expect(rendered().map((img) => img.getAttribute('src'))).toEqual([
        'https://images.example.com/ok.png',
        null,
      ]);
      expect(rendered()[1].hasAttribute('data-mlv-editor-image-blocked')).toBe(
        true,
      );
      expect(rendered()[1].getAttribute('alt')).toBe('bad');
      expect(editor.getHTML()).toContain('src="javascript:alert(1)"');

      // A source swapped in later rebuilds the view through the policy.
      editor.view.dispatch(
        editor.state.tr.setNodeAttribute(0, 'src', 'javascript:alert(2)'),
      );
      expect(rendered()[0].getAttribute('src')).toBeNull();
      expect(rendered()[0].hasAttribute('data-mlv-editor-image-blocked')).toBe(
        true,
      );
    } finally {
      editor.destroy();
    }
  });

  it('leaves a preset without collaboration on the plain image extension', () => {
    const plain = mlvEditorDefaultExtensions();
    const collaborating = mlvEditorDefaultExtensions({
      collaboration: { isChangeOrigin: () => false },
    });
    const image = (list: typeof plain) =>
      list.find((extension) => extension.name === 'image');
    // One parent level: the collaborating image extends the plain one.
    expect(image(plain)?.parent).toBeFalsy();
    expect(image(collaborating)?.parent?.name).toBe('image');
  });
});
