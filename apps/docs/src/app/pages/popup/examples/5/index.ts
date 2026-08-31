import { Component, ChangeDetectionStrategy } from '@angular/core';
import {
  MlvPopup,
  MlvPopupContent,
  MlvPopupContainer,
  MlvPopupTrigger,
} from '@malva-ui/core/popup';
import { MlvButton, MlvButtonAfter } from '@malva-ui/core/button';
import { MlvList, MlvListItem, MlvListItemPrefix } from '@malva-ui/core/list';
import {
  LucideChevronDown,
  LucidePencil,
  LucideCopy,
  LucideTrash2,
} from '@lucide/angular';

@Component({
  selector: 'docs-popup-container-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MlvPopup,
    MlvPopupContent,
    MlvPopupContainer,
    MlvPopupTrigger,
    MlvButton,
    MlvButtonAfter,
    MlvList,
    MlvListItem,
    MlvListItemPrefix,
    LucideChevronDown,
    LucidePencil,
    LucideCopy,
    LucideTrash2,
  ],
  templateUrl: './index.html',
})
export default class PopupContainerExampleComponent {}
