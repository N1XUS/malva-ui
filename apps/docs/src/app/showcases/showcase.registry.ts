import type { Type } from '@angular/core';
import type { Route } from '@angular/router';
import type { ShowcaseDefinition } from './showcase.types';

/** Internal route-ready refinement of the public showcase catalog contract. */
interface ShowcaseRouteDefinition extends ShowcaseDefinition {
  readonly loadComponent: () => Promise<Type<unknown>>;
}

/** Linkable category choices for the showcase catalog. */
export const SHOWCASE_CATEGORIES = [
  { value: 'all', label: 'All' },
  { value: 'workspaces', label: 'Workspaces' },
  { value: 'communication', label: 'Communication' },
  { value: 'data', label: 'Data' },
  { value: 'content', label: 'Content' },
  { value: 'settings', label: 'Settings' },
] as const;

/** Single source of truth for showcase catalog cards and their lazy routes. */
export const SHOWCASES: readonly ShowcaseRouteDefinition[] = [
  {
    slug: 'project-workspace',
    title: 'Project Workspace',
    summary:
      'Plan, track, and inspect delivery work across navigation, tasks, progress, and project activity.',
    category: 'workspaces',
    componentNames: [
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
    previewAsset: '/showcases/project-workspace.png',
    loadComponent: () =>
      import('./pages/project-workspace/project-workspace').then(
        (module) => module.ProjectWorkspaceShowcaseComponent,
      ),
  },
  {
    slug: 'support-inbox',
    title: 'Support Inbox',
    summary:
      'Triage, answer, and resolve customer conversations in a dark-rail helpdesk with SLA clocks, teammate assignment, and a full context panel.',
    category: 'communication',
    componentNames: [
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
    previewAsset: '/showcases/support-inbox.png',
    loadComponent: () =>
      import('./pages/support-inbox/support-inbox').then(
        (module) => module.SupportInboxShowcaseComponent,
      ),
  },
  {
    slug: 'publishing-workspace',
    title: 'Publishing Workspace',
    summary:
      'Create, review, and publish rich content with a focused editor workflow and shared team context.',
    category: 'content',
    componentNames: [
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
    previewAsset: '/showcases/publishing-workspace.png',
    loadComponent: () =>
      import('./pages/publishing-workspace/publishing-workspace').then(
        (module) => module.PublishingWorkspaceShowcaseComponent,
      ),
  },
  {
    slug: 'data-operations',
    title: 'Data Operations',
    summary:
      'Turn account signals into action with saved views, natural-language filters, and an inspectable table.',
    category: 'data',
    componentNames: [
      'view-variant',
      'filter',
      'data-table',
      'search-field',
      'toolbar',
      'pagination',
      'badge',
      'page',
    ],
    previewAsset: '/showcases/data-operations.png',
    loadComponent: () =>
      import('./pages/data-operations/data-operations').then(
        (module) => module.DataOperationsShowcaseComponent,
      ),
  },
  {
    slug: 'settings-access',
    title: 'Settings & Access',
    summary:
      'Manage profile, preferences, security, and team access in one practical forms workflow.',
    category: 'settings',
    componentNames: [
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
    previewAsset: '/showcases/settings-access.png',
    loadComponent: () =>
      import('./pages/settings-access/settings-access').then(
        (module) => module.SettingsAccessShowcaseComponent,
      ),
  },
  {
    slug: 'website-builder',
    title: 'Website Builder',
    summary:
      'Compose CMS page layouts from nested, drag-sortable sections, containers, rows, and blocks with per-breakpoint grid settings.',
    category: 'content',
    componentNames: [
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
    previewAsset: '/showcases/website-builder.png',
    loadComponent: () =>
      import('./pages/website-builder/website-builder').then(
        (module) => module.WebsiteBuilderShowcaseComponent,
      ),
  },
];

/** Showcase child routes derived from the catalog registry. */
export const showcaseRoutes: Route[] = [
  {
    path: '',
    pathMatch: 'full',
    title: 'Showcases | Malva UI',
    loadComponent: () =>
      import('./showcase-index/showcase-index').then(
        (module) => module.ShowcaseIndexComponent,
      ),
  },
  ...SHOWCASES.map((showcase) => ({
    path: showcase.slug,
    title: `${showcase.title} | Malva UI`,
    loadComponent: showcase.loadComponent,
  })),
];

/** Returns the showcase compositions that include a documented component route. */
export function showcasesForComponent(
  componentName: string,
): readonly ShowcaseDefinition[] {
  return SHOWCASES.filter((showcase) =>
    showcase.componentNames.includes(componentName),
  );
}

/** Returns the first showcase route that includes an exact canonical docs path. */
export function showcaseRouteForComponent(
  componentName: string,
): string | null {
  const showcase = SHOWCASES.find((item) =>
    item.componentNames.includes(componentName),
  );

  return showcase ? `/showcases/${showcase.slug}` : null;
}
