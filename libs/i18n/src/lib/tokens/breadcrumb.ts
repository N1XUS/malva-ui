import { InjectionToken, type Signal } from '@angular/core';
import type { MlvTranslationContext } from '../types';

export interface MlvBreadcrumbI18n {
  /** aria-label for the overflow menu trigger. */
  hiddenItems: string;
  /** aria-label for the breadcrumb navigation landmark (host `<nav>`). */
  label: string;
  /**
   * aria-label for the ellipsis overflow button.
   * ICU: "{count, plural, one {Show # more breadcrumb item} other {Show # more breadcrumb items}}".
   */
  showMore: string;
}

export const MLV_BREADCRUMB_I18N = new InjectionToken<
  Signal<MlvBreadcrumbI18n>
>('MLV_BREADCRUMB_I18N');

export const MLV_BREADCRUMB_I18N_CONTEXT: Record<
  keyof MlvBreadcrumbI18n,
  MlvTranslationContext
> = {
  hiddenItems: {
    component: 'mlv-breadcrumb',
    usage: 'aria-label',
    description: 'Trigger button showing collapsed breadcrumb items',
  },
  label: {
    component: 'mlv-breadcrumb',
    usage: 'aria-label',
    maxLength: 20,
    description: 'Landmark label for the breadcrumb navigation region',
  },
  showMore: {
    component: 'mlv-breadcrumb',
    usage: 'aria-label',
    icuParams: ['count'],
    description: 'Ellipsis button that reveals N collapsed breadcrumb items',
  },
};
