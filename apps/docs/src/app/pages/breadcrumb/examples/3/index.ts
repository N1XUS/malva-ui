import { Component, ChangeDetectionStrategy } from '@angular/core';
import type { MlvBreadcrumbEntry } from '@malva-ui/core/breadcrumb';
import { MlvBreadcrumb } from '@malva-ui/core/breadcrumb';

@Component({
  selector: 'docs-breadcrumb-overflow-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvBreadcrumb],
  template: `
    <div style="display: flex; flex-direction: column; gap: 1rem;">
      <p
        style="color: var(--mlv-text-secondary); font-size: var(--mlv-typography-body-s-size);"
      >
        maxItems="4" — middle items collapse to ellipsis:
      </p>
      <nav mlvBreadcrumb [items]="longItems" [maxItems]="4"></nav>
      <p
        style="color: var(--mlv-text-secondary); font-size: var(--mlv-typography-body-s-size);"
      >
        maxItems="3":
      </p>
      <nav mlvBreadcrumb [items]="longItems" [maxItems]="3"></nav>
    </div>
  `,
})
export default class BreadcrumbOverflowExampleComponent {
  readonly longItems: MlvBreadcrumbEntry[] = [
    { label: 'Home', href: '/' },
    { label: 'Organization', href: '/org' },
    { label: 'Projects', href: '/org/projects' },
    { label: 'Web Platform', href: '/org/projects/web' },
    { label: 'Frontend', href: '/org/projects/web/frontend' },
    { label: 'Components' },
  ];
}
