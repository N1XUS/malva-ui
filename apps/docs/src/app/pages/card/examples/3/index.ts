import { Component, ChangeDetectionStrategy } from '@angular/core';
import {
  MlvCard,
  MlvCardHeaderDef,
  MlvCardSubheaderDef,
  MlvCardActionsDef,
  MlvCardHeader,
  MlvCardActions,
  MlvCardSubheader,
} from '@malva-ui/core/card';
import { MlvButton, MlvButtonIcon } from '@malva-ui/core/button';
import {
  LucideDynamicIcon,
  LucideEllipsisVertical,
  LucideHeart,
  LucideShare2,
  LucideBookmark,
  LucideTrash2,
  LucidePencil,
} from '@lucide/angular';

@Component({
  selector: 'docs-card-header-actions-example',
  imports: [
    MlvCard,
    MlvCardHeaderDef,
    MlvCardSubheaderDef,
    MlvCardActionsDef,
    MlvButton,
    LucideDynamicIcon,
    MlvButtonIcon,
    MlvCardHeader,
    MlvCardActions,
    MlvCardSubheader,
  ],
  templateUrl: './index.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './index.scss',
})
export default class CardHeaderActionsExampleComponent {
  readonly icons = {
    ellipsis: LucideEllipsisVertical,
    heart: LucideHeart,
    share: LucideShare2,
    bookmark: LucideBookmark,
    trash: LucideTrash2,
    pencil: LucidePencil,
  };
}
