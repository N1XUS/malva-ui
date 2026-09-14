import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvButton } from '@malva-ui/core/button';
import { MlvChip } from '@malva-ui/core/chip';
import {
  MlvItemsMore,
  MlvItemsMoreHiddenDef,
  MlvItemsMoreItem,
  MlvItemsMoreTrigger,
  MlvItemsMoreVisibleDef,
} from '@malva-ui/core/items-more';

@Component({
  selector: 'docs-items-more-external-trigger-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MlvButton,
    MlvChip,
    MlvItemsMore,
    MlvItemsMoreItem,
    MlvItemsMoreVisibleDef,
    MlvItemsMoreHiddenDef,
    MlvItemsMoreTrigger,
  ],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class ItemsMoreExternalTriggerExampleComponent {
  readonly tags: readonly string[] = [
    'Design system',
    'Accessibility',
    'Angular',
    'Signals',
    'Performance',
    'Server rendering',
    'Right-to-left',
    'Theming',
  ];
}
