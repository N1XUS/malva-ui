import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { docsNavigationGroups, docsPages, pageRoutes } from '../../app.routes';

const pageDirectory = dirname(fileURLToPath(import.meta.url));

describe('editor documentation page', () => {
  it('registers the editor route, metadata, navigation, and public API target', async () => {
    const route = pageRoutes.find((candidate) => candidate.path === 'editor');
    const page = docsPages.find((candidate) => candidate.path === 'editor');
    const editorGroup = docsNavigationGroups.find(
      (candidate) => candidate.id === 'editor',
    );

    expect(route?.loadComponent).toBeTypeOf('function');
    expect(page).toMatchObject({
      path: 'editor',
      label: 'Editor',
      group: 'editor',
      icon: 'scroll-text',
      api: { family: 'editor', entry: '' },
    });
    expect(page?.route.title).toBe('Editor | Malva UI');
    expect(editorGroup?.items.map((item) => item.link)).toContain('/editor');

    const component = await route?.loadComponent?.();
    if (!component) throw new Error('Expected the editor page to lazy load.');
    const instance = new component();
    expect(instance.examples).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(instance.meta.title).toBe('Editor');
    // `loadComponent()` pulls the whole editor page graph — `@malva-ui/editor`,
    // Tiptap and all of this page's examples — through Vite's transform inside
    // the test. That is ~3s warm here and took 28.7s on a loaded CI runner,
    // overrunning the 20s this once carried. It is transform cost, not a hang.
  }, 60_000);

  it('keeps every editor example on the grouped public entry point', () => {
    for (let index = 1; index <= 12; index += 1) {
      const source = readFileSync(
        join(pageDirectory, 'examples', String(index), 'index.ts'),
        'utf8',
      );
      const editorImports = [
        ...source.matchAll(/from ['"]([^'"]*editor[^'"]*)['"]/g),
      ].map((match) => match[1]);

      expect(editorImports).toContain('@malva-ui/editor');
      expect(editorImports).not.toContain('@malva-ui/core/editor');
      expect(
        editorImports.some((specifier) => specifier.startsWith('libs/editor/')),
      ).toBe(false);
    }
  });
});
