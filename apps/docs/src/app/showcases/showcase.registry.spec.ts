import {
  SHOWCASES,
  showcaseRouteForComponent,
  showcaseRoutes,
  showcasesForComponent,
} from './showcase.registry';

describe('showcase registry', () => {
  it('defines seven unique showcase routes', () => {
    expect(SHOWCASES.map((item) => item.slug)).toEqual([
      'project-workspace',
      'support-inbox',
      'publishing-workspace',
      'data-operations',
      'settings-access',
      'website-builder',
      'data-at-scale',
    ]);
    expect(new Set(SHOWCASES.map((item) => item.slug)).size).toBe(7);
  });

  it('derives showcase child routes from the same registry', () => {
    expect(showcaseRoutes.map((route) => route.path)).toEqual([
      '',
      ...SHOWCASES.map((item) => item.slug),
    ]);
  });

  it('records the approved component inventories for every showcase', () => {
    expect(SHOWCASES.map((item) => item.componentNames)).toEqual([
      [
        'page',
        'sidebar',
        'tabs',
        'data-table',
        'timeline',
        'progress',
        'avatar',
        'badge',
        'menu',
        'drawer',
      ],
      [
        'sidebar',
        'list',
        'chat',
        'search-field',
        'segmented',
        'textarea',
        'menu',
        'toolbar',
        'title',
        'timeline',
        'progress',
        'copy-to-clipboard',
        'status-indicator',
        'empty-state',
        'scrollbar',
        'tooltip',
        'toast',
        'avatar',
        'badge',
        'chip',
        'divider',
        'action-bar',
        'layout',
      ],
      [
        'editor',
        'editor-ai',
        'page',
        'split-pane',
        'toolbar',
        'title',
        'avatar-group',
        'badge',
        'file-upload',
        'drawer',
        'dialog',
        'notification',
      ],
      [
        'view-variant',
        'filter',
        'data-table',
        'search-field',
        'toolbar',
        'pagination',
        'badge',
        'page',
      ],
      [
        'page',
        'sidebar',
        'tabs',
        'data-table',
        'form',
        'form-field',
        'input',
        'select',
        'radio',
        'checkbox',
        'switch',
        'tokenizer',
        'time-picker',
        'pin-input',
        'dialog',
        'drawer',
        'alert',
        'toast',
      ],
      [
        'tile',
        'page',
        'tabs',
        'dialog',
        'form',
        'switch',
        'number-input',
        'select',
        'menu',
        'badge',
        'empty-state',
        'segmented',
        'button',
        'tooltip',
        'breadcrumb',
        'textarea',
        'tokenizer',
        'checkbox',
        'color-picker',
        'file-upload',
        'alert',
        'toast',
      ],
      [
        'data-table',
        'view-variant',
        'pagination',
        'page',
        'sidebar',
        'segmented',
        'select',
        'number-input',
        'switch',
        'badge',
        'alert',
        'button',
      ],
    ]);
  });

  it('finds every showcase that uses a documented component', () => {
    expect(showcasesForComponent('page').map((item) => item.slug)).toEqual([
      'project-workspace',
      'publishing-workspace',
      'data-operations',
      'settings-access',
      'website-builder',
      'data-at-scale',
    ]);
    expect(showcasesForComponent('view-variant').map((item) => item.slug)).toEqual([
      'data-operations',
      'data-at-scale',
    ]);
    expect(showcasesForComponent('chat').map((item) => item.slug)).toEqual([
      'support-inbox',
    ]);
    expect(showcasesForComponent('tile').map((item) => item.slug)).toEqual([
      'website-builder',
    ]);
    expect(showcasesForComponent('skeleton')).toEqual([]);
  });

  it('returns the first contextual showcase route for a canonical docs path', () => {
    // data-at-scale also documents `data-table`, but the first registry match
    // wins — appending a showcase must not move an existing component's link.
    expect(showcaseRouteForComponent('data-table')).toBe(
      '/showcases/project-workspace',
    );
    expect(showcaseRouteForComponent('form')).toBe(
      '/showcases/settings-access',
    );
    expect(showcaseRouteForComponent('tile')).toBe(
      '/showcases/website-builder',
    );
    expect(showcaseRouteForComponent('skeleton')).toBeNull();
  });
});
