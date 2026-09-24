import { Component, ChangeDetectionStrategy } from '@angular/core';
import {
  MlvBreadcrumb,
  MlvBreadcrumbItem,
  MlvBreadcrumbItemHost,
} from '@malva-ui/core/breadcrumb';

@Component({
  selector: 'docs-breadcrumb-projected-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvBreadcrumb, MlvBreadcrumbItem, MlvBreadcrumbItemHost],
  template: `
    <div style="display: flex; flex-direction: column; gap: 1.5rem;">
      <div>
        <p
          style="color: var(--mlv-text-secondary); font-size: var(--mlv-typography-body-s-size); margin-bottom: 0.5rem;"
        >
          Template-driven using <code>&lt;mlv-breadcrumb-item&gt;</code>:
        </p>
        <nav mlvBreadcrumb>
          <mlv-breadcrumb-item href="/">Home</mlv-breadcrumb-item>
          <mlv-breadcrumb-item href="/docs">Documentation</mlv-breadcrumb-item>
          <mlv-breadcrumb-item [current]="true">Breadcrumb</mlv-breadcrumb-item>
        </nav>
      </div>
      <div>
        <p
          style="color: var(--mlv-text-secondary); font-size: var(--mlv-typography-body-s-size); margin-bottom: 0.5rem;"
        >
          With a disabled item:
        </p>
        <nav mlvBreadcrumb>
          <mlv-breadcrumb-item href="/">Home</mlv-breadcrumb-item>
          <mlv-breadcrumb-item [disabled]="true"
            >Restricted Section</mlv-breadcrumb-item
          >
          <mlv-breadcrumb-item [current]="true"
            >Access Denied</mlv-breadcrumb-item
          >
        </nav>
      </div>
      <div>
        <p
          style="color: var(--mlv-text-secondary); font-size: var(--mlv-typography-body-s-size); margin-bottom: 0.5rem;"
        >
          Using <code>[mlvBreadcrumbItem]</code> attribute directive on a native
          <code>&lt;li&gt;</code> — no <code>&lt;ol&gt;</code> of your own; the
          breadcrumb renders the list:
        </p>
        <nav mlvBreadcrumb>
          <li mlvBreadcrumbItem>
            <a class="mlv-breadcrumb__link" href="/">Home</a>
            <span class="mlv-breadcrumb__separator" aria-hidden="true">›</span>
          </li>
          <li mlvBreadcrumbItem>
            <a class="mlv-breadcrumb__link" href="/components">Components</a>
            <span class="mlv-breadcrumb__separator" aria-hidden="true">›</span>
          </li>
          <li mlvBreadcrumbItem>
            <span
              class="mlv-breadcrumb__link mlv-breadcrumb__link--current"
              aria-current="page"
              >Breadcrumb</span
            >
          </li>
        </nav>
      </div>
    </div>
  `,
})
export default class BreadcrumbProjectedExampleComponent {}
