import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MlvAvatar } from '@malva-ui/core/avatar';
import { MlvButton } from '@malva-ui/core/button';
import {
  MlvList,
  MlvListItemActions,
  MlvListItemByline,
  MlvListItem,
  MlvListItemMedia,
  MlvListItemMeta,
  MlvListItemTitle,
} from '@malva-ui/core/list';
import { LucideArchive, LucideReply, LucideTrash2 } from '@lucide/angular';

interface InboxMessage {
  id: number;
  from: string;
  subject: string;
  preview: string;
  time: string;
  unread: boolean;
}

@Component({
  selector: 'docs-list-inbox-example',
  imports: [
    MlvAvatar,
    MlvButton,
    MlvList,
    MlvListItemActions,
    MlvListItemByline,
    MlvListItem,
    MlvListItemMedia,
    MlvListItemMeta,
    MlvListItemTitle,
    LucideArchive,
    LucideReply,
    LucideTrash2,
  ],
  templateUrl: './index.html',
  styleUrl: './index.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class ListInboxExampleComponent {
  protected readonly messages: InboxMessage[] = [
    {
      id: 1,
      from: 'Amelia Chen',
      subject: 'Release candidate is ready for review',
      preview:
        'Hey team — the build is green and I pushed the release notes to the staging channel. Could you take a quick look before Thursday?',
      time: '9:42 AM',
      unread: true,
    },
    {
      id: 2,
      from: 'Marcus Reid',
      subject: 'Design review: combobox keyboard flow',
      preview:
        'Shared the Figma board. Focus management still feels off when collapsing — want to pair on it?',
      time: '8:15 AM',
      unread: true,
    },
    {
      id: 3,
      from: 'Priya Natarajan',
      subject: 'Weekly product sync notes',
      preview:
        'Highlights from yesterday: roadmap shifts for Q3, new growth experiments, and the support backlog…',
      time: 'Yesterday',
      unread: false,
    },
    {
      id: 4,
      from: 'Dev Digest',
      subject: 'Angular 21.1.1 is now available',
      preview:
        'This minor release ships improved signal diagnostics, faster SSR hydration, and a handful of router fixes.',
      time: 'Monday',
      unread: false,
    },
    {
      id: 5,
      from: 'Sana Al-Rashid',
      subject: 'Lunch on Friday?',
      preview:
        'The new ramen place on 5th opened last week — want to try it after the retro? I can book a table.',
      time: 'Last week',
      unread: false,
    },
  ];
}
