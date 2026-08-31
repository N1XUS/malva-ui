import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvAvatarGroup } from '@malva-ui/core/avatar-group';
import type { MlvAvatarGroupMember } from '@malva-ui/core/avatar-group';

@Component({
  selector: 'docs-avatar-group-sizes-example',
  imports: [MlvAvatarGroup],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class AvatarGroupSizesExampleComponent {
  readonly members: MlvAvatarGroupMember[] = [
    { name: 'Alice Johnson', src: 'https://i.pravatar.cc/150?img=1' },
    { name: 'Bob Martinez', src: 'https://i.pravatar.cc/150?img=2' },
    { name: 'Carol White' },
    { name: 'David Kim' },
    { name: 'Eva Brown' },
    { name: 'Frank Lee' },
  ];

  readonly sizes = ['xs', 's', 'm', 'l', 'xl'] as const;
}
