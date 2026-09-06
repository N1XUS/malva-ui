import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { LucideFlag, LucideTrash2 } from '@lucide/angular';
import { MlvAvatar } from '@malva-ui/core/avatar';
import {
  MlvList,
  MlvListItem,
  MlvListItemByline,
  MlvListItemMedia,
  MlvListItemTitle,
} from '@malva-ui/core/list';
import { MlvSwipeAction, MlvSwipeActions } from '@malva-ui/core/swipe-actions';

interface Message {
  id: number;
  from: string;
  subject: string;
  flagged: boolean;
}

@Component({
  selector: 'docs-swipe-actions-basic-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MlvSwipeActions,
    MlvSwipeAction,
    MlvList,
    MlvListItem,
    MlvListItemMedia,
    MlvListItemTitle,
    MlvListItemByline,
    MlvAvatar,
    LucideFlag,
    LucideTrash2,
  ],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class SwipeActionsBasicExampleComponent {
  readonly messages = signal<Message[]>([
    {
      id: 1,
      from: 'Mara Lindqvist',
      subject: 'Release notes for the combobox rework',
      flagged: false,
    },
    {
      id: 2,
      from: 'Tomás Herrera',
      subject: 'Can we ship the dark-mode fix on Friday?',
      flagged: true,
    },
    {
      id: 3,
      from: 'Design Weekly',
      subject: 'Issue 42 — motion tokens, density and the new scrubber',
      flagged: false,
    },
  ]);

  readonly status = signal(
    'Swipe a row to the left. On a desktop, scroll it sideways or Tab to an action.',
  );

  flag(message: Message): void {
    this.messages.update((all) =>
      all.map((m) => (m === message ? { ...m, flagged: !m.flagged } : m)),
    );
    this.status.set(
      `${message.from}: ${message.flagged ? 'flag removed' : 'flagged'}.`,
    );
  }

  remove(message: Message): void {
    this.messages.update((all) => all.filter((m) => m !== message));
    this.status.set(`Deleted the message from ${message.from}.`);
  }
}
