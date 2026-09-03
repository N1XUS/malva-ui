import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from '@angular/core';
import { MlvSpacer } from '@malva-ui/cdk/utils';
import { MlvAvatar } from '@malva-ui/core/avatar';
import { MlvButton } from '@malva-ui/core/button';
import {
  MlvDrawerBody,
  MlvDrawer,
  MlvDrawerContent,
  MlvDrawerHeader,
} from '@malva-ui/core/drawer';
import {
  MlvList,
  MlvListItem,
  MlvListItemActions,
  MlvListItemByline,
  MlvListItemMedia,
  MlvListItemMeta,
  MlvListItemTitle,
} from '@malva-ui/core/list';

interface DocsNotification {
  id: number;
  author: string;
  title: string;
  byline: string;
  when: string;
  unread: boolean;
}

/**
 * A notification tray that drops from the top edge. Resizable with two snap
 * points (a peek and an expanded state); the header carries a bulk action
 * that sits on the same 36px row as the close button.
 */
@Component({
  selector: 'docs-drawer-top-tray-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MlvSpacer,
    MlvAvatar,
    MlvButton,
    MlvDrawerBody,
    MlvDrawer,
    MlvDrawerContent,
    MlvDrawerHeader,
    MlvList,
    MlvListItem,
    MlvListItemActions,
    MlvListItemByline,
    MlvListItemMedia,
    MlvListItemMeta,
    MlvListItemTitle,
  ],
  templateUrl: './index.html',
})
export default class DrawerTopTrayExampleComponent {
  readonly showTray = signal(false);
  readonly snapPoints = [35, 70];

  readonly notifications = signal<DocsNotification[]>([
    {
      id: 1,
      author: 'Mara Ellison',
      title: 'Mara approved your request',
      byline: 'Access to the billing workspace was granted.',
      when: '2 min',
      unread: true,
    },
    {
      id: 2,
      author: 'Deploy bot',
      title: 'Build #4821 finished',
      byline: 'docs · main · 3m 12s · 0 warnings',
      when: '18 min',
      unread: true,
    },
    {
      id: 3,
      author: 'Tomas Reyes',
      title: 'Tomas mentioned you in "Q3 roadmap"',
      byline: '“@you can we move the drawer work to the next sprint?”',
      when: '1 h',
      unread: true,
    },
    {
      id: 4,
      author: 'Priya Natarajan',
      title: 'Priya shared "Design tokens v2"',
      byline: 'You have edit access.',
      when: 'Yesterday',
      unread: false,
    },
    {
      id: 5,
      author: 'Security',
      title: 'New sign-in from Firefox on macOS',
      byline: 'If this was not you, review your sessions.',
      when: 'Yesterday',
      unread: false,
    },
    {
      id: 6,
      author: 'Ola Berg',
      title: 'Ola left a comment on "Empty states"',
      byline: '“Love the illustration, can we tone the copy down a bit?”',
      when: '2 d',
      unread: false,
    },
  ]);

  readonly unreadCount = computed(
    () => this.notifications().filter((n) => n.unread).length,
  );

  markAllRead(): void {
    this.notifications.update((all) =>
      all.map((n) => ({ ...n, unread: false })),
    );
  }

  markRead(id: number): void {
    this.notifications.update((all) =>
      all.map((n) => (n.id === id ? { ...n, unread: false } : n)),
    );
  }
}
