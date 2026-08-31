import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvAvatar } from '@malva-ui/core/avatar';
import { MlvColorFromTextPipe } from '@malva-ui/core/avatar';

@Component({
  selector: 'docs-avatar-sizes-shapes-example',
  imports: [MlvAvatar, MlvColorFromTextPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class AvatarSizesShapesExampleComponent {
  readonly circleNames = [
    'Alex Chen',
    'Maria Garcia',
    'James Wilson',
    'Priya Patel',
    'Tom Brown',
    'Sara Lee',
  ];
  readonly squareNames = [
    'David Kim',
    'Laura White',
    'Nick Jones',
    'Emma Davis',
    'Ryan Clark',
    'Amy Taylor',
  ];
  readonly sizes = ['xs', 's', 'm', 'l', 'xl', 'xxl'] as const;
}
