import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvAvatarGroup } from '@malva-ui/core/avatar-group';
import type { MlvAvatarGroupMember } from '@malva-ui/core/avatar-group';

@Component({
  selector: 'docs-avatar-group-overflow-example',
  imports: [MlvAvatarGroup],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class AvatarGroupOverflowExampleComponent {
  readonly team: MlvAvatarGroupMember[] = [
    { name: 'Alice Johnson', src: 'https://i.pravatar.cc/150?img=1' },
    { name: 'Bob Martinez', src: 'https://i.pravatar.cc/150?img=2' },
    { name: 'Carol White', src: 'https://i.pravatar.cc/150?img=3' },
    { name: 'David Kim', src: 'https://i.pravatar.cc/150?img=4' },
    { name: 'Eva Brown', src: 'https://i.pravatar.cc/150?img=5' },
    { name: 'Frank Lee' },
    { name: 'Grace Chen' },
  ];
}
