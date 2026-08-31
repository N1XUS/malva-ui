import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MlvAvatar } from '@malva-ui/core/avatar';
import { MlvButton } from '@malva-ui/core/button';
import {
  MlvList,
  MlvListItemActions,
  MlvListItemByline,
  MlvListItem,
  MlvListItemMedia,
  MlvListItemTitle,
} from '@malva-ui/core/list';

interface StoreListItem {
  title: string;
  byline: string;
  avatarUrl: string;
}

@Component({
  selector: 'docs-list-rich-items-example',
  imports: [
    MlvAvatar,
    MlvButton,
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
export default class ListRichItemsExampleComponent {
  protected readonly items: StoreListItem[] = [
    {
      title: 'The Odyssey',
      byline: 'Explore unknown galaxies.',
      avatarUrl: 'https://i.pravatar.cc/160?img=12',
    },
    {
      title: 'Angry Rabbits',
      byline: 'They are coming for you.',
      avatarUrl: 'https://i.pravatar.cc/160?img=32',
    },
    {
      title: 'Ghost Town',
      byline: 'Scarry ghosts.',
      avatarUrl: 'https://i.pravatar.cc/160?img=47',
    },
    {
      title: 'Pirates in the Jungle',
      byline: 'Find the treasure.',
      avatarUrl: 'https://i.pravatar.cc/160?img=56',
    },
    {
      title: 'Lost in the Mountains',
      byline: 'Be careful.',
      avatarUrl: 'https://i.pravatar.cc/160?img=68',
    },
  ];
}
