import { Component, signal, ChangeDetectionStrategy } from '@angular/core';
import { MlvAvatarGroup } from '@malva-ui/core/avatar-group';
import type { MlvAvatarGroupMember } from '@malva-ui/core/avatar-group';

@Component({
  selector: 'docs-avatar-group-click-example',
  imports: [MlvAvatarGroup],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class AvatarGroupClickExampleComponent {
  readonly team: MlvAvatarGroupMember[] = [
    { name: 'Alice Johnson', src: 'https://i.pravatar.cc/150?img=1' },
    { name: 'Bob Martinez', src: 'https://i.pravatar.cc/150?img=2' },
    { name: 'Carol White', src: 'https://i.pravatar.cc/150?img=3' },
    { name: 'David Kim' },
    { name: 'Eva Brown' },
    { name: 'Frank Lee' },
    { name: 'Grace Chen' },
  ];

  readonly lastClickedCount = signal<number | null>(null);
  readonly lastOverflowCount = signal<number | null>(null);

  onGroupClick(members: MlvAvatarGroupMember[]): void {
    this.lastClickedCount.set(members.length);
  }

  onOverflowClick(members: MlvAvatarGroupMember[]): void {
    this.lastOverflowCount.set(members.length);
  }
}
