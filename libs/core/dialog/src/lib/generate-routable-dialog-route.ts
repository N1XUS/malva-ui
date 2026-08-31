import type { Type } from '@angular/core';
import type { DefaultExport, Route } from '@angular/router';

import type { MlvDialogConfig } from './dialog-config';

/**
 * Generates a route configuration that opens a component inside a routed dialog.
 * When the dialog closes, the router navigates back to the parent route.
 *
 * The component receives the shell's `Injector`, so it can inject `ActivatedRoute`
 * to access route params, resolved data, and query params. It can also inject
 * `MlvDialogRef` to close itself programmatically.
 *
 * @param component - The component to render inside the dialog. Can be an eager class reference
 *   or a lazy import function (e.g., `() => import('./my-dialog.component')`).
 * @param options - Route path, named outlet, and dialog configuration options.
 * @returns A `Route` object to include in your route configuration.
 *
 * @example
 * ```ts
 * // Lazy-loaded dialog route
 * {
 *   path: 'users',
 *   component: UsersListPage,
 *   children: [
 *     mlvGenerateRoutableDialogRoute(
 *       () => import('./user-edit.component'),
 *       { path: ':id/edit', size: 'l' },
 *     ),
 *   ],
 * }
 *
 * // Eager dialog route
 * mlvGenerateRoutableDialogRoute(UserEditComponent, {
 *   path: ':id/edit',
 *   size: 'l',
 *   closeOnBackdrop: false,
 * })
 *
 * // With guards and resolvers (spread the returned route)
 * {
 *   ...mlvGenerateRoutableDialogRoute(() => import('./confirm.component'), { path: 'confirm' }),
 *   canActivate: [authGuard],
 *   resolve: { item: itemResolver },
 * }
 * ```
 */
export function mlvGenerateRoutableDialogRoute(
  component:
    | Type<unknown>
    | (() => Promise<DefaultExport<Type<unknown>> | Type<unknown>>),
  {
    path = '',
    outlet = '',
    ...dialogOptions
  }: { path?: string; outlet?: string } & Omit<
    MlvDialogConfig,
    'data' | 'injector'
  > = {},
): Route {
  return {
    path,
    outlet: outlet || undefined,
    loadComponent: () => import('./routable-dialog'),
    data: {
      dialog: component,
      dialogOptions,
      backUrl: path
        .split('/')
        .map(() => '..')
        .join('/'),
      isLazy: path === '',
    },
  };
}
