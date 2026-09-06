import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { LucideTrash2 } from '@lucide/angular';
import { MlvAvatar } from '@malva-ui/core/avatar';
import { MlvButton } from '@malva-ui/core/button';
import { MlvSwipeAction, MlvSwipeActions } from '@malva-ui/core/swipe-actions';
import { MlvSwitch } from '@malva-ui/core/switch';

@Component({
  selector: 'docs-swipe-actions-custom-controls-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MlvSwipeActions,
    MlvSwipeAction,
    MlvSwitch,
    MlvButton,
    MlvAvatar,
    LucideTrash2,
  ],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class SwipeActionsCustomControlsExampleComponent {
  /** Whether the contact is muted; the switch on the row toggles it. */
  readonly muted = signal(false);

  /** Whether the contact card is still in the list. */
  readonly present = signal(true);

  restore(): void {
    this.present.set(true);
    this.muted.set(false);
  }
}
