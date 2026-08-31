import { InjectionToken, type Signal } from '@angular/core';
import type { MlvTranslationContext } from '../types';

export interface MlvSidebarI18n {
  /** Fallback aria-label for the sidebar navigation landmark. */
  navigation: string;
  /**
   * ICU plural for a badge/notification count folded into a collapsed item or
   * group accessible name, e.g. "3 notifications". Params: `{ count }`.
   */
  notifications: string;
  /** ICU accessible name for the workspace switcher trigger. Params: `{ workspace }`. */
  switchWorkspace: string;
  /** Accessible name for the workspace switcher menu. */
  workspaceMenu: string;
  /** Accessible label for expanding the sidebar. */
  expand: string;
  /** Accessible label for collapsing the sidebar. */
  collapse: string;
  /** Accessible label for opening the sidebar as an overlay navigation drawer. */
  openNavigation: string;
  /** Accessible label for closing the sidebar overlay navigation drawer. */
  closeNavigation: string;
}

export const MLV_SIDEBAR_I18N = new InjectionToken<Signal<MlvSidebarI18n>>(
  'MLV_SIDEBAR_I18N',
);

export const MLV_SIDEBAR_I18N_CONTEXT: Record<
  keyof MlvSidebarI18n,
  MlvTranslationContext
> = {
  navigation: {
    component: 'mlv-sidebar',
    usage: 'aria-label',
    description: 'Landmark label for the navigation sidebar',
  },
  notifications: {
    component: 'mlv-sidebar',
    usage: 'aria-label',
    icuParams: ['count'],
    description:
      'Badge/notification count appended to a collapsed sidebar item or group accessible name, e.g. "3 notifications"',
  },
  switchWorkspace: {
    component: 'mlv-sidebar-workspace',
    usage: 'aria-label',
    icuParams: ['workspace'],
    description:
      'Accessible name for the workspace switcher trigger including the current workspace',
  },
  workspaceMenu: {
    component: 'mlv-sidebar-workspace',
    usage: 'aria-label',
    description: 'Accessible name for the workspace selection menu',
  },
  expand: {
    component: 'mlv-sidebar-trigger',
    usage: 'aria-label',
    description: 'Expand the sidebar',
  },
  collapse: {
    component: 'mlv-sidebar-trigger',
    usage: 'aria-label',
    description: 'Collapse the sidebar',
  },
  openNavigation: {
    component: 'mlv-sidebar-trigger',
    usage: 'aria-label',
    description:
      'Open the navigation menu — shown on the hamburger trigger while the sidebar is an offcanvas drawer',
  },
  closeNavigation: {
    component: 'mlv-sidebar-trigger',
    usage: 'aria-label',
    description:
      'Close the navigation menu — shown on the trigger while the offcanvas navigation drawer is open',
  },
};
