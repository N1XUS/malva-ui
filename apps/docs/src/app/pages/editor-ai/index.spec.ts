import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { docsNavigationGroups, docsPages, pageRoutes } from '../../app.routes';

const pageDirectory = dirname(fileURLToPath(import.meta.url));

describe('editor AI Kit documentation page', () => {
  it('registers the editor-ai route, metadata, navigation, and public API target', async () => {
    const route = pageRoutes.find(
      (candidate) => candidate.path === 'editor-ai',
    );
    const page = docsPages.find((candidate) => candidate.path === 'editor-ai');
    const editorGroup = docsNavigationGroups.find(
      (candidate) => candidate.id === 'editor',
    );

    expect(route?.loadComponent).toBeTypeOf('function');
    expect(page).toMatchObject({
      path: 'editor-ai',
      label: 'AI Kit',
      group: 'editor',
      icon: 'sparkles',
      api: { family: 'editor', entry: '' },
    });
    expect(page?.route.title).toBe('AI Kit | Malva UI');
    expect(editorGroup?.items.map((item) => item.link)).toEqual([
      '/editor-ai',
      '/editor',
    ]);

    const component = await route?.loadComponent?.();
    if (!component) throw new Error('Expected the AI Kit page to lazy load.');
    const instance = new component();
    expect(instance.examples).toEqual([1, 2]);
    expect(instance.meta.title).toBe('AI Kit');
    // `loadComponent()` pulls the whole editor page graph — `@malva-ui/editor`,
    // Tiptap and all of this page's examples — through Vite's transform inside
    // the test. That is ~3s warm here and took 28.7s on a loaded CI runner,
    // overrunning the 20s this once carried. It is transform cost, not a hang.
  }, 60_000);

  it('keeps every AI Kit example on the grouped public entry points', () => {
    for (let index = 1; index <= 2; index += 1) {
      const source = readFileSync(
        join(pageDirectory, 'examples', String(index), 'index.ts'),
        'utf8',
      );
      const editorImports = [
        ...source.matchAll(/from ['"]([^'"]*editor[^'"]*)['"]/g),
      ].map((match) => match[1]);

      expect(editorImports).toContain('@malva-ui/editor');
      expect(editorImports).toContain('@malva-ui/editor/ai');
      expect(editorImports).not.toContain('@malva-ui/core/editor');
      expect(
        editorImports.some((specifier) => specifier.startsWith('libs/editor/')),
      ).toBe(false);
    }
  });
});
