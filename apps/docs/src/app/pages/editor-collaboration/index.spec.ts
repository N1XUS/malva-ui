import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { docsNavigationGroups, docsPages, pageRoutes } from '../../app.routes';

const pageDirectory = dirname(fileURLToPath(import.meta.url));

describe('editor collaboration documentation page', () => {
  it('registers the route, metadata, navigation and the collaboration API target', async () => {
    const route = pageRoutes.find(
      (candidate) => candidate.path === 'editor-collaboration',
    );
    const page = docsPages.find(
      (candidate) => candidate.path === 'editor-collaboration',
    );
    const editorGroup = docsNavigationGroups.find(
      (candidate) => candidate.id === 'editor',
    );

    expect(route?.loadComponent).toBeTypeOf('function');
    expect(page).toMatchObject({
      path: 'editor-collaboration',
      label: 'Collaboration',
      group: 'editor',
      icon: 'users',
      api: { family: 'editor', entry: 'collaboration' },
    });
    expect(page?.route.title).toBe('Collaboration | Malva UI');
    expect(editorGroup?.items.map((item) => item.link)).toContain(
      '/editor-collaboration',
    );

    const component = await route?.loadComponent?.();
    if (!component)
      throw new Error('Expected the collaboration page to lazy load.');
    const instance = new component();
    expect(instance.examples).toEqual([1, 2]);
    expect(instance.meta.title).toBe('Collaboration');
    // `loadComponent()` pulls the editor, Tiptap and Yjs through Vite's
    // transform inside the test: transform cost, not a hang (see the AI Kit
    // page spec).
  }, 60_000);

  it('keeps every example on the public entry points and self-contained', () => {
    for (let index = 1; index <= 2; index += 1) {
      const source = readFileSync(
        join(pageDirectory, 'examples', String(index), 'index.ts'),
        'utf8',
      );
      const specifiers = [...source.matchAll(/from ['"]([^'"]+)['"]/g)].map(
        (match) => match[1],
      );

      expect(specifiers).toContain('@malva-ui/editor');
      expect(specifiers).toContain('@malva-ui/editor/collaboration');
      // A copyable reference transport: no docs-local import, so the example
      // lifts into a playground project as it stands.
      expect(
        specifiers.filter((specifier) => specifier.startsWith('.')),
      ).toEqual([]);
      expect(source).toContain('extends MlvEditorCollaborationTransport');
      expect(source).toContain('override readonly relay = true');
    }
  });
});
