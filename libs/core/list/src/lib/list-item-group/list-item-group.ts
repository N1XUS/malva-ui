import {
  ChangeDetectionStrategy,
  Component,
  input,
  model,
  ViewEncapsulation,
} from '@angular/core';
import { LucideChevronRight } from '@lucide/angular';
import type { BooleanInput } from '@angular/cdk/coercion';
import { mlvNextId } from '@malva-ui/cdk/utils';

@Component({
  selector: 'mlv-list-item-group',
  imports: [LucideChevronRight],
  templateUrl: './list-item-group.html',
  styleUrl: './list-item-group.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-list-item-group',
    '[class.mlv-list-item-group--toggled]': 'open()',
  },
})
export class MlvListItemGroup {
  readonly label = input.required<string>();

  readonly open = model<BooleanInput>(false);

  /** @protected Unique ID for the collapsible content region. */
  protected readonly _contentId = mlvNextId('mlv-list-group-content');

  toggle(): void {
    this.open.update((value) => !value);
  }
}
