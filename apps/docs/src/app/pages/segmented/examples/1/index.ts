import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { LucideArchive, LucideInbox, LucideSend } from '@lucide/angular';
import { MlvBadge } from '@malva-ui/core/badge';
import { MlvSegmented, MlvSegmentedItem } from '@malva-ui/core/segmented';

@Component({
  selector: 'docs-segmented-basic-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MlvSegmented,
    MlvSegmentedItem,
    MlvBadge,
    LucideInbox,
    LucideSend,
    LucideArchive,
  ],
  templateUrl: './index.html',
})
export default class SegmentedBasicExampleComponent {
  readonly folder = signal<'inbox' | 'sent' | 'archive'>('inbox');
}
