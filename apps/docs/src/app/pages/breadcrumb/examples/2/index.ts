import { Component, ChangeDetectionStrategy } from '@angular/core';
import type { MlvBreadcrumbEntry } from '@malva-ui/core/breadcrumb';
import {
  MlvBreadcrumb,
  MlvBreadcrumbSeparator,
} from '@malva-ui/core/breadcrumb';
import { LucideSlash } from '@lucide/angular';

@Component({
  selector: 'docs-breadcrumb-separator-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvBreadcrumb, MlvBreadcrumbSeparator, LucideSlash],
  template: `
    <div style="display: flex; flex-direction: column; gap: 1.5rem;">
      <div>
        <p
          style="color: var(--mlv-text-secondary); font-size: var(--mlv-typography-body-s-size); margin-bottom: 0.5rem;"
        >
          Default separator (LucideChevronRight icon):
        </p>
        <nav
          mlvBreadcrumb
          ariaLabel="Report trail, default separator"
          [items]="items"
        ></nav>
      </div>
      <div>
        <p
          style="color: var(--mlv-text-secondary); font-size: var(--mlv-typography-body-s-size); margin-bottom: 0.5rem;"
        >
          Custom text separator via <code>ng-template mlvSeparator</code>:
        </p>
        <nav
          mlvBreadcrumb
          ariaLabel="Report trail, text separator"
          [items]="items"
        >
          <ng-template mlvSeparator>›</ng-template>
        </nav>
      </div>
      <div>
        <p
          style="color: var(--mlv-text-secondary); font-size: var(--mlv-typography-body-s-size); margin-bottom: 0.5rem;"
        >
          Custom icon separator:
        </p>
        <nav
          mlvBreadcrumb
          ariaLabel="Report trail, icon separator"
          [items]="items"
        >
          <ng-template mlvSeparator>
            <svg
              lucideSlash
              [size]="14"
              style="color: var(--mlv-text-secondary);"
            />
          </ng-template>
        </nav>
      </div>
    </div>
  `,
})
export default class BreadcrumbSeparatorExampleComponent {
  readonly items: MlvBreadcrumbEntry[] = [
    { label: 'Dashboard', href: '/' },
    { label: 'Reports', href: '/reports' },
    { label: 'Annual Summary' },
  ];
}
