import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { docsNavigationGroups, docsPages, pageRoutes } from '../../app.routes';

const pageDirectory = dirname(fileURLToPath(import.meta.url));

describe('scheduler documentation page', () => {
  it('registers the scheduler route, metadata, navigation, and public API target', async () => {
    const route = pageRoutes.find(
      (candidate) => candidate.path === 'scheduler',
    );
    const page = docsPages.find((candidate) => candidate.path === 'scheduler');
    const dataDisplayGroup = docsNavigationGroups.find(
      (candidate) => candidate.id === 'data-display',
    );

    expect(route?.loadComponent).toBeTypeOf('function');
    // `api.family` is the second published package, not `core`: `resolveLib`
    // silently skips a page whose resolved barrel does not exist, so a wrong
    // target would ship an empty API tab with every other gate still green.
    expect(page).toMatchObject({
      path: 'scheduler',
      label: 'Scheduler',
      group: 'data-display',
      icon: 'calendar-days',
      api: { family: 'scheduler', entry: '' },
    });
    expect(page?.route.title).toBe('Scheduler | Malva UI');
    expect(dataDisplayGroup?.items.map((item) => item.link)).toContain(
      '/scheduler',
    );

    const component = await route?.loadComponent?.();
    if (!component)
      throw new Error('Expected the scheduler page to lazy load.');
    const instance = new component();
    expect(instance.examples).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(instance.meta.title).toBe('Scheduler');
  }, 60_000);

  it('keeps every scheduler example on the grouped public entry point', () => {
    for (let index = 1; index <= 7; index += 1) {
      const source = readFileSync(
        join(pageDirectory, 'examples', String(index), 'index.ts'),
        'utf8',
      );
      const schedulerImports = [
        ...source.matchAll(/from ['"]([^'"]*scheduler[^'"]*)['"]/g),
      ].map((match) => match[1]);

      expect(schedulerImports).toContain('@malva-ui/scheduler');
      expect(schedulerImports).not.toContain('@malva-ui/core/scheduler');
      expect(
        schedulerImports.some((specifier) =>
          specifier.startsWith('libs/scheduler/'),
        ),
      ).toBe(false);
    }
  });
});
