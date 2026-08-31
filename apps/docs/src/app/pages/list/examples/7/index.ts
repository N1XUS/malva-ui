import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MlvAvatar } from '@malva-ui/core/avatar';
import { MlvBadge } from '@malva-ui/core/badge';
import {
  MlvList,
  MlvListItemActions,
  MlvListItemByline,
  MlvListItem,
  MlvListItemMedia,
  MlvListItemTitle,
} from '@malva-ui/core/list';

interface ConversationItem {
  id: number;
  name: string;
  preview: string;
  time: string;
  unreadCount: number;
  avatarUrl?: string;
}

@Component({
  selector: 'docs-list-conversations-example',
  imports: [
    MlvAvatar,
    MlvBadge,
    MlvList,
    MlvListItemActions,
    MlvListItemByline,
    MlvListItem,
    MlvListItemMedia,
    MlvListItemTitle,
  ],
  templateUrl: './index.html',
  styleUrl: './index.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class ListConversationsExampleComponent {
  protected readonly conversations: ConversationItem[] = [
    {
      id: 1,
      name: 'Priya Natarajan',
      preview: 'Can you take a look at the release notes before EOD?',
      time: '9:41 AM',
      unreadCount: 2,
      avatarUrl: 'https://i.pravatar.cc/160?img=47',
    },
    {
      id: 2,
      name: 'Marcus Reid',
      preview: 'Pairing on the combobox focus bug now, join when free.',
      time: '9:12 AM',
      unreadCount: 0,
      avatarUrl: 'https://i.pravatar.cc/160?img=12',
    },
    {
      id: 3,
      name: 'Amelia Chen',
      preview: "Pushed the fix — build's green again.",
      time: 'Yesterday',
      unreadCount: 0,
      avatarUrl: 'https://i.pravatar.cc/160?img=32',
    },
    {
      id: 4,
      name: 'Support triage',
      preview: '3 new tickets need attention this morning.',
      time: 'Yesterday',
      unreadCount: 5,
    },
    {
      id: 5,
      name: 'Sana Al-Rashid',
      preview: 'Lunch on Friday? The new ramen place opened last week.',
      time: 'Monday',
      unreadCount: 0,
      avatarUrl: 'https://i.pravatar.cc/160?img=68',
    },
  ];
}
