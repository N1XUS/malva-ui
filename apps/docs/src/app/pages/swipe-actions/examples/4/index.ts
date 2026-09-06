import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  LucideBellOff,
  LucideCheck,
  LucideEllipsis,
  LucideInfo,
  LucideSparkles,
  LucideTrash2,
  LucideTriangleAlert,
} from '@lucide/angular';
import { MlvSwipeAction, MlvSwipeActions } from '@malva-ui/core/swipe-actions';

@Component({
  selector: 'docs-swipe-actions-tones-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MlvSwipeActions,
    MlvSwipeAction,
    LucideEllipsis,
    LucideSparkles,
    LucideInfo,
    LucideCheck,
    LucideTriangleAlert,
    LucideTrash2,
    LucideBellOff,
  ],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class SwipeActionsTonesExampleComponent {}
