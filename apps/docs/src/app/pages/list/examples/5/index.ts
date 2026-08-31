import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  MlvList,
  MlvListItemByline,
  MlvListItem,
  MlvListItemGroup,
  MlvListItemMedia,
  MlvListItemMeta,
  MlvListItemTitle,
} from '@malva-ui/core/list';
import {
  LucideBell,
  LucideGlobe,
  LucideLock,
  LucideMoon,
  LucidePalette,
  LucideShield,
  LucideSmartphone,
  LucideUserCircle,
  LucideWifi,
} from '@lucide/angular';

@Component({
  selector: 'docs-list-settings-example',
  imports: [
    MlvList,
    MlvListItemByline,
    MlvListItem,
    MlvListItemGroup,
    MlvListItemMedia,
    MlvListItemMeta,
    MlvListItemTitle,
    LucideBell,
    LucideGlobe,
    LucideLock,
    LucideMoon,
    LucidePalette,
    LucideShield,
    LucideSmartphone,
    LucideUserCircle,
    LucideWifi,
  ],
  templateUrl: './index.html',
  styleUrl: './index.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class ListSettingsExampleComponent {}
