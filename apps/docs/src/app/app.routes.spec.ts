import {
  appRoutes,
  docsNavigationGroups,
  docsPages,
  pageRoutes,
} from './app.routes';
import { ShowcaseShellComponent } from './showcases/showcase-shell/showcase-shell';

describe('documentation page manifest', () => {
  it('defines every page route exactly once', () => {
    const routePaths = pageRoutes.map((route) => route.path);
    const manifestPaths = docsPages.map((page) => page.path);

    expect(new Set(routePaths).size).toBe(routePaths.length);
    expect(manifestPaths).toEqual(routePaths);
  });

  it('places every page in exactly one navigation group', () => {
    const navigationPaths = docsNavigationGroups
      .filter((group) => group.id !== 'overview')
      .flatMap((group) => group.items.map((item) => item.link.slice(1)));

    expect(navigationPaths).toHaveLength(docsPages.length);
    expect(new Set(navigationPaths)).toEqual(
      new Set(docsPages.map((page) => page.path)),
    );
  });

  it('sorts every sidebar group alphabetically', () => {
    const groupLabels = docsNavigationGroups
      .filter((group) => group.id !== 'overview')
      .map((group) => group.label);
    expect(groupLabels).toEqual(
      [...groupLabels].sort((a, b) => a.localeCompare(b)),
    );

    for (const group of docsNavigationGroups) {
      const labels = group.items.map((item) => item.label);
      expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b)));
    }
  });

  it('provides a browser title for every documented page', () => {
    for (const page of docsPages) {
      expect(page.route.title).toBe(`${page.label} | Malva UI`);
    }
  });

  it('preserves page-specific sidebar icons', () => {
    const icons = Object.fromEntries(
      docsPages.map((page) => [page.path, page.icon]),
    );

    expect(icons).toMatchObject({
      'action-bar': 'navigation',
      'animated-presence': 'sparkles',
      avatar: 'circle-user',
      'button-group': 'mouse-pointer-2',
      'data-table': 'table-2',
      table: 'table-2',
      dialog: 'square-dashed',
      editor: 'scroll-text',
      select: 'chevrons-up-down',
    });
  });

  it('gives the editor family its own sidebar group with the AI Kit and Collaboration pages', () => {
    const forms = docsNavigationGroups.find((group) => group.id === 'forms');
    const editorGroup = docsNavigationGroups.find(
      (group) => group.id === 'editor',
    );

    expect(forms?.items.map((item) => item.link)).not.toContain('/editor');
    expect(editorGroup?.label).toBe('Editor');
    expect(editorGroup?.items.map((item) => item.label)).toEqual([
      'AI Kit',
      'Collaboration',
      'Editor',
    ]);

    const route = pageRoutes.find((candidate) => candidate.path === 'editor');
    expect(route?.loadComponent).toBeTypeOf('function');
  });

  it('keeps showcase routes outside docs-shell children with their own lazy shell', async () => {
    const showcaseRoute = appRoutes.find((route) => route.path === 'showcases');
    const docsShellRoute = appRoutes.find(
      (route) => route.path === '' && !!route.children,
    );

    expect(
      docsShellRoute?.children?.some((route) => route.path === 'showcases'),
    ).toBe(false);
    expect(showcaseRoute?.loadComponent).toBeTypeOf('function');
    await expect(showcaseRoute?.loadComponent?.()).resolves.toBe(
      ShowcaseShellComponent,
    );
  });

  it('registers Tailwind as a standalone overview guide without an API tab', () => {
    const docsShellRoute = appRoutes.find(
      (route) => route.path === '' && !!route.children,
    );
    const tailwindRoute = docsShellRoute?.children?.find(
      (route) => route.path === 'tailwind',
    );
    const overview = docsNavigationGroups.find(
      (group) => group.id === 'overview',
    );

    expect(tailwindRoute?.title).toBe('Tailwind | Malva UI');
    expect(tailwindRoute?.loadComponent).toBeTypeOf('function');
    expect(overview?.items.filter((item) => item.link === '/tailwind')).toEqual(
      [{ label: 'Tailwind', link: '/tailwind', icon: 'palette' }],
    );
    expect(docsPages.some((page) => page.path === 'tailwind')).toBe(false);
  });
});
