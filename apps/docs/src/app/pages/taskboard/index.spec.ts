import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { docsNavigationGroups, docsPages, pageRoutes } from '../../app.routes';

const pageDirectory = dirname(fileURLToPath(import.meta.url));

const EXAMPLE_COUNT = 8;

describe('taskboard documentation page', () => {
  it('registers the taskboard route, metadata, navigation, and public API target', async () => {
    const route = pageRoutes.find(
      (candidate) => candidate.path === 'taskboard',
    );
    const page = docsPages.find((candidate) => candidate.path === 'taskboard');
    const dataDisplayGroup = docsNavigationGroups.find(
      (candidate) => candidate.id === 'data-display',
    );

    expect(route?.loadComponent).toBeTypeOf('function');
    expect(page).toMatchObject({
      path: 'taskboard',
      label: 'Taskboard',
      group: 'data-display',
      icon: 'kanban',
      // The package is standalone, so the API tab resolves the package root
      // rather than a `@malva-ui/core` leaf entry point.
      api: { family: 'taskboard', entry: '' },
    });
    expect(page?.route.title).toBe('Taskboard | Malva UI');
    expect(dataDisplayGroup?.items.map((item) => item.link)).toContain(
      '/taskboard',
    );

    const component = await route?.loadComponent?.();
    if (!component)
      throw new Error('Expected the taskboard page to lazy load.');
    const instance = new component();
    expect(instance.examples).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(instance.meta.title).toBe('Taskboard');
    // Lazy-loading the page pulls all eight examples plus `@malva-ui/taskboard`
    // through Vite's transform inside the test, which is transform cost rather
    // than a hang — the editor page carries the same allowance.
  }, 60_000);

  it('keeps every taskboard example on the published entry points', () => {
    for (let index = 1; index <= EXAMPLE_COUNT; index += 1) {
      const source = readFileSync(
        join(pageDirectory, 'examples', String(index), 'index.ts'),
        'utf8',
      );
      const specifiers = [...source.matchAll(/from ['"]([^'"]+)['"]/g)].map(
        (match) => match[1],
      );

      expect(specifiers).toContain('@malva-ui/taskboard');
      // The taskboard is not a core subpath and never was.
      expect(specifiers).not.toContain('@malva-ui/core/taskboard');
      expect(
        specifiers.some((specifier) => specifier.startsWith('libs/')),
      ).toBe(false);
      expect(
        specifiers.some(
          (specifier) =>
            specifier.startsWith('@malva-ui/') &&
            specifier.includes('/src/lib/'),
        ),
      ).toBe(false);
    }
  });
});
