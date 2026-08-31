import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvAvatarGroup } from '@malva-ui/core/avatar-group';
import type { MlvAvatarGroupMember } from '@malva-ui/core/avatar-group';

@Component({
  selector: 'docs-avatar-group-basic-example',
  imports: [MlvAvatarGroup],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class AvatarGroupBasicExampleComponent {
  readonly members: MlvAvatarGroupMember[] = [
    { name: 'Alice Johnson' },
    { name: 'Bob Martinez' },
    { name: 'Carol White' },
  ];
}
