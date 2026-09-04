import type { Route, Routes } from '@angular/router';
import { showcaseRoutes } from './showcases/showcase.registry';

/**
 * Wraps a component-page route so that `/<name>` (Examples) and `/<name>/api`
 * (API) both resolve to the **same** page-component instance.
 *
 * The `api` segment is registered as a **componentless child route** — it
 * renders nothing itself; the page's routed `mlv-tab-group` derives the active
 * tab from the URL via `Router.isActive`. Because only a child route changes
 * when navigating `/<name>` ↔ `/<name>/api`, Angular's default route-reuse keeps
 * the parent page component mounted, so switching tabs never tears the page down
 * (scroll position and tab animation are preserved). This avoids hand-editing a
 * duplicate `api` route for every page.
 *
 * A route cannot declare both `children` and `loadChildren`, so for the two
 * pages that already lazy-load children (dialog, drawer) the `api` marker is
 * prepended to the loaded child routes instead.
 *
 * The marker carries `children: []` so it is a **valid** componentless route:
 * Angular rejects a route with none of component/loadComponent/redirectTo/
 * children/loadChildren (`NG04014`), which would invalidate the whole config.
 * An empty `children` array renders nothing (no outlet needed in the page
 * component) while still matching the `/api` segment.
 */
function withApiTab(route: Route): Route {
  const apiChild: Route = { path: 'api', children: [] };

  if (route.loadChildren) {
    const loadChildren = route.loadChildren;
    return {
      ...route,
      loadChildren: async (): Promise<Routes> => {
        const loaded = await loadChildren();
        const routes = Array.isArray(loaded)
          ? loaded
          : (loaded as { default: Routes }).default;
        return [apiChild, ...routes];
      },
    };
  }

  return { ...route, children: [apiChild, ...(route.children ?? [])] };
}

/**
 * Every component-documentation page. Each is wrapped by {@link withApiTab} so it
 * also answers `/<name>/api` for the API tab (see the helper for the reuse
 * mechanism). The home and Getting Started routes are registered separately
 * and get no API tab.
 */
export const pageRoutes = [
  {
    path: 'accessibility',
    loadComponent: () =>
      import('./pages/accessibility/index').then(
        (m) => m.AccessibilityPageComponent,
      ),
  },
  {
    path: 'accordion',
    loadComponent: () =>
      import('./pages/accordion/index').then((m) => m.AccordionPageComponent),
  },
  {
    path: 'action-bar',
    loadComponent: () =>
      import('./pages/action-bar/index').then((m) => m.ActionBarPage),
  },
  {
    path: 'animated-presence',
    loadComponent: () =>
      import('./pages/animated-presence/index').then(
        (m) => m.AnimatedPresencePageComponent,
      ),
  },
  {
    path: 'alert',
    loadComponent: () =>
      import('./pages/alert/index').then((m) => m.AlertPageComponent),
  },
  {
    path: 'avatar',
    loadComponent: () =>
      import('./pages/avatar/index').then((m) => m.AvatarPageComponent),
  },
  {
    path: 'avatar-group',
    loadComponent: () =>
      import('./pages/avatar-group/index').then(
        (m) => m.AvatarGroupPageComponent,
      ),
  },
  {
    path: 'badge',
    loadComponent: () =>
      import('./pages/badge/index').then((m) => m.BadgePageComponent),
  },
  {
    path: 'bottom-nav',
    loadComponent: () =>
      import('./pages/bottom-nav/index').then((m) => m.BottomNavPageComponent),
  },
  {
    path: 'chip',
    loadComponent: () =>
      import('./pages/chip/index').then((m) => m.ChipPageComponent),
  },
  {
    path: 'breadcrumb',
    loadComponent: () =>
      import('./pages/breadcrumb/index').then((m) => m.BreadcrumbPageComponent),
  },
  {
    path: 'button',
    loadComponent: () =>
      import('./pages/button/index').then((m) => m.ButtonPageComponent),
  },
  {
    path: 'button-group',
    loadComponent: () =>
      import('./pages/button-group/index').then(
        (m) => m.ButtonGroupPageComponent,
      ),
  },
  {
    path: 'button-split',
    loadComponent: () =>
      import('./pages/button-split/index').then(
        (m) => m.ButtonSplitPageComponent,
      ),
  },
  {
    path: 'button-toggle',
    loadComponent: () =>
      import('./pages/button-toggle/index').then(
        (m) => m.ButtonTogglePageComponent,
      ),
  },
  {
    path: 'input',
    loadComponent: () =>
      import('./pages/input/index').then((m) => m.InputPageComponent),
  },
  {
    path: 'number-input',
    loadComponent: () =>
      import('./pages/number-input/index').then(
        (m) => m.NumberInputPageComponent,
      ),
  },
  {
    path: 'empty-state',
    loadComponent: () =>
      import('./pages/empty-state/index').then(
        (m) => m.EmptyStatePageComponent,
      ),
  },
  {
    path: 'expand',
    loadComponent: () =>
      import('./pages/expand/index').then((m) => m.ExpandPageComponent),
  },
  {
    path: 'form',
    loadComponent: () =>
      import('./pages/form/index').then((m) => m.FormPageComponent),
  },
  {
    path: 'form-field',
    loadComponent: () =>
      import('./pages/form-field/index').then((m) => m.FormFieldPageComponent),
  },
  {
    path: 'filter',
    loadComponent: () =>
      import('./pages/filter/index').then((m) => m.FilterPageComponent),
  },
  {
    path: 'select',
    loadComponent: () =>
      import('./pages/select/index').then((m) => m.SelectPageComponent),
  },
  {
    path: 'autocomplete',
    loadComponent: () =>
      import('./pages/autocomplete/index').then(
        (m) => m.AutocompletePageComponent,
      ),
  },
  {
    path: 'combobox',
    loadComponent: () =>
      import('./pages/combobox/index').then((m) => m.ComboboxPageComponent),
  },
  {
    path: 'compare',
    loadComponent: () =>
      import('./pages/compare/index').then((m) => m.ComparePageComponent),
  },
  {
    path: 'copy-to-clipboard',
    loadComponent: () =>
      import('./pages/copy-to-clipboard/index').then(
        (m) => m.CopyToClipboardPageComponent,
      ),
  },
  {
    path: 'data-table',
    loadComponent: () =>
      import('./pages/data-table/index').then((m) => m.DataTablePageComponent),
  },
  {
    path: 'table',
    loadComponent: () =>
      import('./pages/table/index').then((m) => m.TablePageComponent),
  },
  {
    path: 'search-field',
    loadComponent: () =>
      import('./pages/search-field/index').then(
        (m) => m.SearchFieldPageComponent,
      ),
  },
  {
    path: 'segmented',
    loadComponent: () =>
      import('./pages/segmented/index').then((m) => m.SegmentedPageComponent),
  },
  {
    path: 'tokenizer',
    loadComponent: () =>
      import('./pages/tokenizer/index').then((m) => m.TokenizerPageComponent),
  },
  {
    path: 'checkbox',
    loadComponent: () =>
      import('./pages/checkbox/index').then((m) => m.CheckboxPageComponent),
  },
  {
    path: 'color-picker',
    loadComponent: () =>
      import('./pages/color-picker/index').then(
        (m) => m.ColorPickerPageComponent,
      ),
  },
  {
    path: 'radio',
    loadComponent: () =>
      import('./pages/radio/index').then((m) => m.RadioPageComponent),
  },
  {
    path: 'rating',
    loadComponent: () =>
      import('./pages/rating/index').then((m) => m.RatingPageComponent),
  },
  {
    path: 'calendar',
    loadComponent: () =>
      import('./pages/calendar/index').then((m) => m.CalendarPageComponent),
  },
  {
    path: 'day-picker',
    loadComponent: () =>
      import('./pages/day-picker/index').then((m) => m.DayPickerPageComponent),
  },
  {
    path: 'date-range-picker',
    loadComponent: () =>
      import('./pages/date-range-picker/index').then(
        (m) => m.DateRangePickerPageComponent,
      ),
  },
  {
    path: 'density',
    loadComponent: () =>
      import('./pages/density/index').then((m) => m.DensityPageComponent),
  },
  {
    path: 'dropdown',
    loadComponent: () =>
      import('./pages/dropdown/index').then((m) => m.DropdownPageComponent),
  },
  {
    path: 'editor',
    loadComponent: () =>
      import('./pages/editor/index').then((m) => m.EditorPageComponent),
  },
  {
    path: 'editor-ai',
    loadComponent: () =>
      import('./pages/editor-ai/index').then((m) => m.EditorAiPageComponent),
  },
  {
    path: 'divider',
    loadComponent: () =>
      import('./pages/divider/index').then((m) => m.DividerPageComponent),
  },
  {
    path: 'popup',
    loadComponent: () =>
      import('./pages/popup/index').then((m) => m.PopupPageComponent),
  },
  {
    path: 'link',
    loadComponent: () =>
      import('./pages/link/index').then((m) => m.LinkPageComponent),
  },
  {
    path: 'dialog',
    loadComponent: () =>
      import('./pages/dialog/index').then((m) => m.DialogPageComponent),
    loadChildren: () =>
      import('./pages/dialog/dialog.routes').then((m) => m.dialogChildRoutes),
  },
  {
    path: 'drawer',
    loadComponent: () =>
      import('./pages/drawer/index').then((m) => m.DrawerPageComponent),
    loadChildren: () =>
      import('./pages/drawer/drawer.routes').then((m) => m.drawerChildRoutes),
  },
  {
    path: 'list',
    loadComponent: () =>
      import('./pages/list/index').then((m) => m.ListPageComponent),
  },
  {
    path: 'scheduler',
    loadComponent: () =>
      import('./pages/scheduler/index').then((m) => m.SchedulerPageComponent),
  },
  {
    path: 'scrollbar',
    loadComponent: () =>
      import('./pages/scrollbar/index').then((m) => m.ScrollbarPageComponent),
  },
  {
    path: 'sidebar',
    loadComponent: () =>
      import('./pages/sidebar/index').then((m) => m.SidebarPageComponent),
  },
  {
    path: 'page',
    loadComponent: () =>
      import('./pages/page/index').then((m) => m.PagePageComponent),
  },
  {
    path: 'skeleton',
    loadComponent: () =>
      import('./pages/skeleton/index').then((m) => m.SkeletonPageComponent),
  },
  {
    path: 'slider',
    loadComponent: () =>
      import('./pages/slider/index').then((m) => m.SliderPageComponent),
  },
  {
    path: 'speed-dial',
    loadComponent: () =>
      import('./pages/speed-dial/index').then((m) => m.SpeedDialPageComponent),
  },
  {
    path: 'split-pane',
    loadComponent: () =>
      import('./pages/split-pane/index').then((m) => m.SplitPanePageComponent),
  },
  {
    path: 'status-indicator',
    loadComponent: () =>
      import('./pages/status-indicator/index').then(
        (m) => m.StatusIndicatorPageComponent,
      ),
  },
  {
    path: 'chat',
    loadComponent: () =>
      import('./pages/chat/index').then((m) => m.ChatPageComponent),
  },
  {
    path: 'stepper',
    loadComponent: () =>
      import('./pages/stepper/index').then((m) => m.StepperPageComponent),
  },
  {
    path: 'timeline',
    loadComponent: () =>
      import('./pages/timeline/index').then((m) => m.TimelinePageComponent),
  },
  {
    path: 'toolbar',
    loadComponent: () =>
      import('./pages/toolbar/index').then((m) => m.ToolbarPageComponent),
  },
  {
    path: 'tooltip',
    loadComponent: () =>
      import('./pages/tooltip/index').then((m) => m.TooltipPageComponent),
  },
  {
    path: 'switch',
    loadComponent: () =>
      import('./pages/switch/index').then((m) => m.SwitchPageComponent),
  },
  {
    path: 'card',
    loadComponent: () =>
      import('./pages/card/index').then((m) => m.CardPageComponent),
  },
  {
    path: 'tabs',
    loadComponent: () =>
      import('./pages/tabs/index').then((m) => m.TabsPageComponent),
  },
  {
    path: 'title',
    loadComponent: () =>
      import('./pages/title/index').then((m) => m.TitlePageComponent),
  },
  {
    path: 'loader',
    loadComponent: () =>
      import('./pages/loader/index').then((m) => m.LoaderPageComponent),
  },
  {
    path: 'menu',
    loadComponent: () =>
      import('./pages/menu/index').then((m) => m.MenuPageComponent),
  },
  {
    path: 'notification',
    loadComponent: () =>
      import('./pages/notification/index').then(
        (m) => m.NotificationPageComponent,
      ),
  },
  {
    path: 'pagination',
    loadComponent: () =>
      import('./pages/pagination/index').then((m) => m.PaginationPageComponent),
  },
  {
    path: 'pin-input',
    loadComponent: () =>
      import('./pages/pin-input/index').then((m) => m.PinInputPageComponent),
  },
  {
    path: 'progress',
    loadComponent: () =>
      import('./pages/progress/index').then((m) => m.ProgressPageComponent),
  },
  {
    path: 'toast',
    loadComponent: () =>
      import('./pages/toast/index').then((m) => m.ToastPageComponent),
  },
  {
    path: 'textarea',
    loadComponent: () =>
      import('./pages/textarea/index').then((m) => m.TextareaPageComponent),
  },
  {
    path: 'time-picker',
    loadComponent: () =>
      import('./pages/time-picker/index').then(
        (m) => m.TimePickerPageComponent,
      ),
  },
  {
    path: 'tile',
    loadComponent: () =>
      import('./pages/tile/index').then((m) => m.TilePageComponent),
  },
  {
    path: 'tree',
    loadComponent: () =>
      import('./pages/tree/index').then((m) => m.TreePageComponent),
  },
  {
    path: 'file-upload',
    loadComponent: () =>
      import('./pages/file-upload/index').then(
        (m) => m.FileUploadPageComponent,
      ),
  },
  {
    path: 'kbd',
    loadComponent: () =>
      import('./pages/kbd/index').then((m) => m.KbdPageComponent),
  },
  {
    path: 'icon-toggle',
    loadComponent: () =>
      import('./pages/icon-toggle/index').then(
        (m) => m.IconTogglePageComponent,
      ),
  },
  {
    path: 'infinite-scroll',
    loadComponent: () =>
      import('./pages/infinite-scroll/index').then(
        (m) => m.InfiniteScrollPageComponent,
      ),
  },
  {
    path: 'internationalization',
    loadComponent: () =>
      import('./pages/internationalization/index').then(
        (m) => m.InternationalizationPageComponent,
      ),
  },
  {
    path: 'layout',
    loadComponent: () =>
      import('./pages/layout/index').then((m) => m.LayoutPageComponent),
  },
  {
    path: 'overlay',
    loadComponent: () =>
      import('./pages/overlay/index').then((m) => m.OverlayPageComponent),
  },
  {
    path: 'theming',
    loadComponent: () =>
      import('./pages/theming/index').then((m) => m.ThemingPageComponent),
  },
  {
    path: 'utils',
    loadComponent: () =>
      import('./pages/utils/index').then((m) => m.UtilsPageComponent),
  },
] as const satisfies readonly Route[];

export type DocsPagePath = NonNullable<(typeof pageRoutes)[number]['path']>;

export type DocsNavigationGroupId =
  | 'overview'
  | 'actions'
  | 'forms'
  | 'editor'
  | 'navigation'
  | 'layout'
  | 'data-display'
  | 'feedback'
  | 'utils';

export type DocsIconName =
  | 'accessibility'
  | 'activity'
  | 'align-justify'
  | 'align-left'
  | 'arrow-left-right'
  | 'bell'
  | 'bell-dot'
  | 'calendar'
  | 'calendar-days'
  | 'chevron-right'
  | 'chevrons-down-up'
  | 'chevrons-up-down'
  | 'circle-dot'
  | 'circle-plus'
  | 'circle-user'
  | 'clipboard-check'
  | 'clipboard-list'
  | 'clock'
  | 'columns-2'
  | 'credit-card'
  | 'fingerprint'
  | 'gauge'
  | 'hash'
  | 'house'
  | 'inbox'
  | 'info'
  | 'keyboard'
  | 'languages'
  | 'layers'
  | 'layout-dashboard'
  | 'layout-grid'
  | 'layout-template'
  | 'link'
  | 'list'
  | 'list-checks'
  | 'list-collapse'
  | 'list-end'
  | 'list-filter'
  | 'list-tree'
  | 'loader'
  | 'menu'
  | 'message-circle'
  | 'message-square'
  | 'minus'
  | 'mouse-pointer-2'
  | 'mouse-pointer-click'
  | 'navigation'
  | 'palette'
  | 'panel-bottom'
  | 'panel-left'
  | 'panel-right'
  | 'pipette'
  | 'radar'
  | 'rectangle-horizontal'
  | 'rocket'
  | 'scaling'
  | 'scroll-text'
  | 'search'
  | 'sliders-horizontal'
  | 'sparkles'
  | 'square-check'
  | 'square-dashed'
  | 'square-split-horizontal'
  | 'star'
  | 'table-2'
  | 'tag'
  | 'tags'
  | 'text-cursor-input'
  | 'toggle-left'
  | 'triangle-alert'
  | 'upload'
  | 'users'
  | 'wrench';

export interface DocsApiTarget {
  family: 'core' | 'cdk' | 'i18n' | 'editor' | 'scheduler';
  entry: string;
}

export interface DocsPageDefinition {
  path: DocsPagePath;
  label: string;
  group: DocsNavigationGroupId;
  icon: DocsIconName;
  api: DocsApiTarget | null;
  route: Route;
}

export interface DocsNavigationItem {
  label: string;
  link: string;
  icon: DocsIconName;
  exact?: boolean;
}

export interface DocsNavigationGroup {
  id: DocsNavigationGroupId;
  label: string;
  icon: DocsIconName;
  items: readonly DocsNavigationItem[];
}

const GROUP_DEFINITIONS = [
  {
    id: 'actions',
    label: 'Actions',
    icon: 'mouse-pointer-click',
    paths: [
      'button',
      'button-group',
      'button-split',
      'button-toggle',
      'copy-to-clipboard',
      'icon-toggle',
      'link',
      'speed-dial',
    ],
  },
  {
    id: 'forms',
    label: 'Forms',
    icon: 'clipboard-list',
    paths: [
      'autocomplete',
      'checkbox',
      'color-picker',
      'combobox',
      'date-range-picker',
      'day-picker',
      'dropdown',
      'file-upload',
      'filter',
      'form-field',
      'input',
      'number-input',
      'pin-input',
      'radio',
      'rating',
      'search-field',
      'select',
      'slider',
      'switch',
      'textarea',
      'time-picker',
      'tokenizer',
    ],
  },
  {
    id: 'editor',
    label: 'Editor',
    icon: 'scroll-text',
    paths: ['editor', 'editor-ai'],
  },
  {
    id: 'navigation',
    label: 'Navigation',
    icon: 'navigation',
    paths: [
      'bottom-nav',
      'breadcrumb',
      'pagination',
      'segmented',
      'sidebar',
      'tabs',
    ],
  },
  {
    id: 'layout',
    label: 'Layout',
    icon: 'layout-template',
    paths: [
      'action-bar',
      'card',
      'divider',
      'drawer',
      'expand',
      'form',
      'layout',
      'page',
      'split-pane',
      'toolbar',
    ],
  },
  {
    id: 'data-display',
    label: 'Data display',
    icon: 'layout-grid',
    paths: [
      'accordion',
      'avatar',
      'avatar-group',
      'badge',
      'calendar',
      'scheduler',
      'chat',
      'chip',
      'compare',
      'data-table',
      'empty-state',
      'kbd',
      'list',
      'loader',
      'progress',
      'skeleton',
      'status-indicator',
      'stepper',
      'table',
      'tile',
      'timeline',
      'title',
      'tree',
    ],
  },
  {
    id: 'feedback',
    label: 'Feedback & overlays',
    icon: 'message-square',
    paths: [
      'alert',
      'dialog',
      'menu',
      'notification',
      'popup',
      'toast',
      'tooltip',
    ],
  },
  {
    id: 'utils',
    label: 'Utilities',
    icon: 'wrench',
    paths: [
      'accessibility',
      'animated-presence',
      'density',
      'infinite-scroll',
      'internationalization',
      'overlay',
      'scrollbar',
      'theming',
      'utils',
    ],
  },
] as const;

const LABEL_OVERRIDES: Partial<Record<DocsPagePath, string>> = {
  'editor-ai': 'AI Kit',
  kbd: 'Kbd',
  'pin-input': 'PIN Input',
  'button-split': 'Split Button',
  'button-toggle': 'Toggle Button',
  internationalization: 'Internationalization',
  utils: 'CDK Utilities',
};

/** Per-page icons retained from the original hand-authored sidebar. */
const PAGE_ICONS: Record<DocsPagePath, DocsIconName> = {
  accessibility: 'accessibility',
  accordion: 'list-collapse',
  'action-bar': 'navigation',
  'animated-presence': 'sparkles',
  alert: 'triangle-alert',
  autocomplete: 'list-filter',
  avatar: 'circle-user',
  'avatar-group': 'users',
  badge: 'tag',
  'bottom-nav': 'panel-bottom',
  breadcrumb: 'chevron-right',
  button: 'mouse-pointer-click',
  'button-group': 'mouse-pointer-2',
  'button-split': 'columns-2',
  'button-toggle': 'toggle-left',
  calendar: 'calendar',
  card: 'credit-card',
  checkbox: 'square-check',
  chip: 'tags',
  'color-picker': 'pipette',
  combobox: 'search',
  compare: 'square-split-horizontal',
  chat: 'message-circle',
  'copy-to-clipboard': 'clipboard-check',
  'data-table': 'table-2',
  table: 'table-2',
  'date-range-picker': 'calendar-days',
  'day-picker': 'calendar-days',
  density: 'scaling',
  dialog: 'square-dashed',
  divider: 'minus',
  drawer: 'panel-right',
  dropdown: 'list-filter',
  editor: 'scroll-text',
  'editor-ai': 'sparkles',
  'empty-state': 'inbox',
  expand: 'chevrons-down-up',
  'file-upload': 'upload',
  filter: 'list-filter',
  form: 'list-checks',
  'form-field': 'clipboard-list',
  'icon-toggle': 'toggle-left',
  'infinite-scroll': 'list-end',
  input: 'text-cursor-input',
  internationalization: 'languages',
  kbd: 'keyboard',
  layout: 'layout-dashboard',
  link: 'link',
  list: 'list',
  loader: 'loader',
  menu: 'menu',
  notification: 'bell',
  'number-input': 'hash',
  overlay: 'layers',
  page: 'layout-template',
  pagination: 'arrow-left-right',
  'pin-input': 'fingerprint',
  popup: 'message-square',
  progress: 'gauge',
  radio: 'circle-dot',
  rating: 'star',
  scheduler: 'calendar-days',
  scrollbar: 'scroll-text',
  'search-field': 'search',
  segmented: 'columns-2',
  select: 'chevrons-up-down',
  sidebar: 'panel-left',
  skeleton: 'rectangle-horizontal',
  slider: 'sliders-horizontal',
  'speed-dial': 'circle-plus',
  'split-pane': 'columns-2',
  'status-indicator': 'radar',
  stepper: 'list-checks',
  switch: 'toggle-left',
  tabs: 'layout-template',
  textarea: 'align-left',
  theming: 'palette',
  'time-picker': 'clock',
  tile: 'layout-grid',
  timeline: 'activity',
  title: 'text-cursor-input',
  toast: 'bell-dot',
  tokenizer: 'tags',
  toolbar: 'align-justify',
  tooltip: 'info',
  tree: 'list-tree',
  utils: 'wrench',
};

const API_OVERRIDES: Partial<Record<DocsPagePath, DocsApiTarget | null>> = {
  accessibility: { family: 'cdk', entry: 'accessibility' },
  'animated-presence': { family: 'cdk', entry: 'utils' },
  density: { family: 'cdk', entry: 'density' },
  editor: { family: 'editor', entry: '' },
  'editor-ai': { family: 'editor', entry: '' },
  'infinite-scroll': { family: 'cdk', entry: 'infinite-scroll' },
  internationalization: { family: 'i18n', entry: '' },
  overlay: { family: 'cdk', entry: 'overlay' },
  scheduler: { family: 'scheduler', entry: '' },
  theming: null,
  utils: { family: 'cdk', entry: 'utils' },
  'button-group': { family: 'core', entry: 'button' },
  'button-split': { family: 'core', entry: 'button' },
  'button-toggle': { family: 'core', entry: 'button' },
  'form-field': { family: 'core', entry: 'form-utils' },
};

function pageLabel(path: DocsPagePath): string {
  return (
    LABEL_OVERRIDES[path] ??
    path
      .split('-')
      .map((part) => part[0]?.toUpperCase() + part.slice(1))
      .join(' ')
  );
}

function groupFor(path: DocsPagePath) {
  const group = GROUP_DEFINITIONS.find((candidate) =>
    (candidate.paths as readonly string[]).includes(path),
  );
  if (!group)
    throw new Error(`Docs page "${path}" is missing a navigation group.`);
  return group;
}

function apiFor(path: DocsPagePath): DocsApiTarget | null {
  if (Object.prototype.hasOwnProperty.call(API_OVERRIDES, path)) {
    return API_OVERRIDES[path] ?? null;
  }
  return { family: 'core', entry: path };
}

/**
 * Single typed page manifest. Routes, page titles, grouped navigation, and API
 * extraction all consume this collection.
 */
export const docsPages: readonly DocsPageDefinition[] = pageRoutes.map(
  (route) => {
    const path = route.path as DocsPagePath;
    const group = groupFor(path);
    const label = pageLabel(path);
    const api = apiFor(path);
    return {
      path,
      label,
      group: group.id,
      icon: PAGE_ICONS[path],
      api,
      route: { ...route, title: `${label} | Malva UI` },
    };
  },
);

/** Data-driven, alphabetically sorted sidebar groups. */
export const docsNavigationGroups: readonly DocsNavigationGroup[] = [
  {
    id: 'overview',
    label: 'Overview',
    icon: 'house',
    items: [
      { label: 'Getting Started', link: '/getting-started', icon: 'rocket' },
      { label: 'Home', link: '/', icon: 'house', exact: true },
      { label: 'Tailwind', link: '/tailwind', icon: 'palette' },
    ],
  },
  ...GROUP_DEFINITIONS.map((group) => ({
    id: group.id,
    label: group.label,
    icon: group.icon,
    items: docsPages
      .filter((page) => page.group === group.id)
      .map((page) => ({
        label: page.label,
        link: `/${page.path}`,
        icon: page.icon,
      }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  })).sort((a, b) => a.label.localeCompare(b.label)),
];

export const appRoutes: Route[] = [
  {
    path: '',
    pathMatch: 'full',
    title: 'Malva UI — Angular component library',
    loadComponent: () =>
      import('./pages/home/home').then((m) => m.HomePageComponent),
  },
  {
    path: 'showcases',
    loadComponent: () =>
      import('./showcases/showcase-shell/showcase-shell').then(
        (module) => module.ShowcaseShellComponent,
      ),
    children: showcaseRoutes,
  },
  {
    path: '',
    loadComponent: () =>
      import('./shared/docs-shell/docs-shell').then(
        (m) => m.DocsShellComponent,
      ),
    children: [
      {
        path: 'getting-started',
        title: 'Getting Started | Malva UI',
        loadComponent: () =>
          import('./pages/getting-started/index').then(
            (m) => m.GettingStartedPageComponent,
          ),
      },
      {
        path: 'tailwind',
        title: 'Tailwind | Malva UI',
        loadComponent: () =>
          import('./pages/tailwind/index').then((m) => m.TailwindPageComponent),
      },
      ...docsPages.map((page) =>
        page.api ? withApiTab(page.route) : page.route,
      ),
      {
        path: '**',
        title: 'Page not found | Malva UI',
        loadComponent: () =>
          import('./pages/not-found/index').then(
            (m) => m.NotFoundPageComponent,
          ),
      },
    ],
  },
];
