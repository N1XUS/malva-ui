import type { Type } from '@angular/core';
import type { DefaultExport, Route } from '@angular/router';

import type { MlvDrawerConfig } from './drawer.service';

/**
 * Generates a route configuration that opens a component inside a routed drawer.
 * When the drawer closes, the router navigates back to the parent route.
 *
 * The component receives the shell's `Injector`, so it can inject `ActivatedRoute`
 * to access route params, resolved data, and query params. It can also inject
 * `MlvDrawerRef` to close itself programmatically.
 *
 * @param component - The component to render inside the drawer. Can be an eager class reference
 *   or a lazy import function (e.g., `() => import('./my-drawer.component')`).
 * @param options - Route path, named outlet, and drawer configuration options.
 * @returns A `Route` object to include in your route configuration.
 *
 * @example
 * ```ts
 * // Lazy-loaded drawer route
 * {
 *   path: 'users',
 *   component: UsersListPage,
 *   children: [
 *     mlvGenerateRoutableDrawerRoute(
 *       () => import('./user-details.component'),
 *       { path: ':id', position: 'right', size: '500px' },
 *     ),
 *   ],
 * }
 *
 * // With guards and resolvers (spread the returned route)
 * {
 *   ...mlvGenerateRoutableDrawerRoute(() => import('./details'), { path: ':id' }),
 *   canActivate: [authGuard],
 *   resolve: { user: userResolver },
 * }
 * ```
 */
export function mlvGenerateRoutableDrawerRoute(
  component:
    | Type<unknown>
    | (() => Promise<DefaultExport<Type<unknown>> | Type<unknown>>),
  {
    path = '',
    outlet = '',
    ...drawerOptions
  }: { path?: string; outlet?: string } & Omit<
    MlvDrawerConfig,
    'data' | 'injector'
  > = {},
): Route {
  return {
    path,
    outlet: outlet || undefined,
    loadComponent: () => import('./routable-drawer'),
    data: {
      drawer: component,
      drawerOptions,
      backUrl: path
        .split('/')
        .map(() => '..')
        .join('/'),
      isLazy: path === '',
    },
  };
}
