import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { LucideArchive, LucideTrash2 } from '@lucide/angular';
import { MlvSwipeAction, MlvSwipeActions } from '@malva-ui/core/swipe-actions';
import { MlvSwitch } from '@malva-ui/core/switch';

@Component({
  selector: 'docs-swipe-actions-disabled-rtl-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MlvSwipeActions,
    MlvSwipeAction,
    MlvSwitch,
    LucideArchive,
    LucideTrash2,
  ],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class SwipeActionsDisabledRtlExampleComponent {
  readonly locked = signal(true);
}
