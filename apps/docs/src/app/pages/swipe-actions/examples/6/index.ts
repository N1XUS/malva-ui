import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import {
  LucideEye,
  LucidePencil,
  LucideShare2,
  LucideTrash2,
} from '@lucide/angular';
import { MlvButton } from '@malva-ui/core/button';
import { MlvSwipeAction, MlvSwipeActions } from '@malva-ui/core/swipe-actions';

interface Draft {
  id: number;
  title: string;
  summary: string;
}

@Component({
  selector: 'docs-swipe-actions-icon-buttons-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MlvSwipeActions,
    MlvSwipeAction,
    MlvButton,
    LucideEye,
    LucidePencil,
    LucideShare2,
    LucideTrash2,
  ],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class SwipeActionsIconButtonsExampleComponent {
  readonly drafts = signal<Draft[]>([
    {
      id: 1,
      title: 'Density tokens, explained',
      summary: 'Why every control scales from one spacing ramp.',
    },
    {
      id: 2,
      title: 'Shipping a scrubber',
      summary: 'A drum-roll picker built on scroll snap.',
    },
    {
      id: 3,
      title: 'Swipe actions without a drag handler',
      summary: 'Sticky stacks and the browser’s own momentum.',
    },
  ]);

  readonly status = signal('Swipe a card to the left to reveal its actions.');

  act(verb: string, draft: Draft): void {
    this.status.set(`${verb} “${draft.title}”.`);
  }

  remove(draft: Draft): void {
    this.drafts.update((all) => all.filter((d) => d !== draft));
    this.status.set(`Deleted “${draft.title}”.`);
  }
}
