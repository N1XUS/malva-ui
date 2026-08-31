import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { MlvExpand, MlvExpandContent } from '@malva-ui/core/expand';
import { MlvBadge } from '@malva-ui/core/badge';
import { LucideChevronDown, LucideDatabase } from '@lucide/angular';

@Component({
  selector: 'docs-expand-lazy-inner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvBadge],
  template: `
    <div
      style="padding: 1rem; display: flex; flex-direction: column; gap: 0.75rem; border-top: 1px solid var(--mlv-border-normal)"
    >
      <div style="display: flex; align-items: center; gap: 0.5rem">
        <mlv-badge tone="success" muted>Component mounted</mlv-badge>
        <span
          style="font-size: var(--mlv-typography-body-s-size); color: var(--mlv-text-secondary)"
        >
          Created only on first open — this component was never in the DOM
          before.
        </span>
      </div>
      <p
        style="margin: 0; color: var(--mlv-text-secondary); font-size: var(--mlv-typography-body-m-size); line-height: 1.6"
      >
        Imagine this is a data-heavy chart, a table with thousands of rows, or a
        complex form. Lazy mode keeps the initial page load fast by deferring
        initialization until the user explicitly expands the panel.
      </p>
    </div>
  `,
})
class LazyInnerComponent {}

@Component({
  selector: 'docs-expand-lazy-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MlvExpand,
    MlvExpandContent,
    LazyInnerComponent,
    LucideChevronDown,
    LucideDatabase,
  ],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class ExpandLazyExampleComponent {
  readonly isOpen = signal(false);
}
