import { Component, ChangeDetectionStrategy } from '@angular/core';
import {
  LucideArchive,
  LucideCopy,
  LucideDownload,
  LucideEllipsis,
  LucidePencil,
  LucideShare2,
  LucideTrash2,
} from '@lucide/angular';
import { MlvButton } from '@malva-ui/core/button';
import {
  MlvItemsMore,
  MlvItemsMoreHiddenDef,
  MlvItemsMoreItem,
  MlvItemsMoreTrigger,
  MlvItemsMoreTriggerDef,
  MlvItemsMoreVisibleDef,
} from '@malva-ui/core/items-more';

@Component({
  selector: 'docs-items-more-basic-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MlvButton,
    MlvItemsMore,
    MlvItemsMoreItem,
    MlvItemsMoreVisibleDef,
    MlvItemsMoreHiddenDef,
    MlvItemsMoreTriggerDef,
    MlvItemsMoreTrigger,
    LucidePencil,
    LucideCopy,
    LucideShare2,
    LucideDownload,
    LucideArchive,
    LucideTrash2,
    LucideEllipsis,
  ],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class ItemsMoreBasicExampleComponent {}
