import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import {
  MlvList,
  MlvListItemActions,
  MlvListItemByline,
  MlvListItem,
  MlvListItemGroup,
  MlvListItemMedia,
  MlvListItemTitle,
} from '@malva-ui/core/list';
import { MlvSwitch } from '@malva-ui/core/switch';
import {
  LucideBell,
  LucideChevronRight,
  LucideClock,
  LucideEyeOff,
  LucideMail,
  LucideMessageCircle,
  LucideShieldCheck,
  LucideSmartphone,
  LucideVolume2,
} from '@lucide/angular';

@Component({
  selector: 'docs-list-notification-preferences-example',
  imports: [
    MlvList,
    MlvListItemActions,
    MlvListItemByline,
    MlvListItem,
    MlvListItemGroup,
    MlvListItemMedia,
    MlvListItemTitle,
    MlvSwitch,
    LucideBell,
    LucideChevronRight,
    LucideClock,
    LucideEyeOff,
    LucideMail,
    LucideMessageCircle,
    LucideShieldCheck,
    LucideSmartphone,
    LucideVolume2,
  ],
  templateUrl: './index.html',
  styleUrl: './index.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class ListNotificationPreferencesExampleComponent {
  protected readonly pushNotifications = signal(true);
  protected readonly sound = signal(false);
  protected readonly teamChatNotifications = signal(true);
  protected readonly mobilePush = signal(true);
  protected readonly hidePreviews = signal(false);
  protected readonly readReceipts = signal(true);
}
