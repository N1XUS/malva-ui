import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvExpand } from '@malva-ui/core/expand';
import { MlvBadge } from '@malva-ui/core/badge';
import {
  LucideShield,
  LucideTriangleAlert,
  LucideCheck,
  LucideChevronDown,
} from '@lucide/angular';

@Component({
  selector: 'docs-expand-advanced-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MlvExpand,
    MlvBadge,
    LucideShield,
    LucideTriangleAlert,
    LucideCheck,
    LucideChevronDown,
  ],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class ExpandAdvancedExampleComponent {}
