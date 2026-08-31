import { Component, ChangeDetectionStrategy } from '@angular/core';
import type { MlvBreadcrumbEntry } from '@malva-ui/core/breadcrumb';
import { MlvBreadcrumb } from '@malva-ui/core/breadcrumb';

@Component({
  selector: 'docs-breadcrumb-basic-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvBreadcrumb],
  template: `
    <div style="display: flex; flex-direction: column; gap: 1rem;">
      <nav mlvBreadcrumb [items]="simpleItems"></nav>
      <nav mlvBreadcrumb [items]="deepItems"></nav>
      <nav mlvBreadcrumb [items]="groupedItems"></nav>
    </div>
  `,
})
export default class BreadcrumbBasicExampleComponent {
  readonly simpleItems: MlvBreadcrumbEntry[] = [
    { label: 'Home', href: '/' },
    { label: 'Products', href: '/products' },
    { label: 'Widget Pro' },
  ];

  readonly deepItems: MlvBreadcrumbEntry[] = [
    { label: 'Home', href: '/' },
    { label: 'Settings', href: '/settings' },
    { label: 'Security', href: '/settings/security' },
    { label: 'Two-Factor Auth' },
  ];

  /**
   * "Settings" and "Personal" are grouping ancestors with no page of their
   * own. Omitting `href`/`routerLink` renders them as plain, readable,
   * non-interactive crumbs — do not reach for `disabled`, which means a
   * destination that exists but is switched off.
   */
  readonly groupedItems: MlvBreadcrumbEntry[] = [
    { label: 'Settings' },
    { label: 'Personal' },
    { label: 'Profile' },
  ];
}
