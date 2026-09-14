import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import {
  LucideEllipsis,
  LucideEye,
  LucideHistory,
  LucideSend,
  LucideShare2,
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
import { MlvSegmented, MlvSegmentedItem } from '@malva-ui/core/segmented';

@Component({
  selector: 'docs-items-more-pinned-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MlvButton,
    MlvSegmented,
    MlvSegmentedItem,
    MlvItemsMore,
    MlvItemsMoreItem,
    MlvItemsMoreVisibleDef,
    MlvItemsMoreHiddenDef,
    MlvItemsMoreTriggerDef,
    MlvItemsMoreTrigger,
    LucideEye,
    LucideShare2,
    LucideHistory,
    LucideSend,
    LucideEllipsis,
  ],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class ItemsMorePinnedExampleComponent {
  readonly version = signal('draft');
}
