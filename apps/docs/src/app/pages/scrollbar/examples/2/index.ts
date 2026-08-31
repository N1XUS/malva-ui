import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvScrollbar } from '@malva-ui/core/scrollbar';
import { MlvBadge } from '@malva-ui/core/badge';

@Component({
  selector: 'docs-scrollbar-horizontal-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvScrollbar, MlvBadge],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class ScrollbarHorizontalExampleComponent {
  readonly tags = [
    'Angular',
    'TypeScript',
    'RxJS',
    'Signals',
    'Nx',
    'Vite',
    'Vitest',
    'SCSS',
    'BEM',
    'A11y',
    'CDK',
    'Lucide',
    'Design System',
    'Monorepo',
    'OnPush',
    'Standalone',
    'Lazy Loading',
    'Tree-shaking',
    'SSR',
  ];
}
