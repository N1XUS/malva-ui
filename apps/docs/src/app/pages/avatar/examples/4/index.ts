import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvAvatar } from '@malva-ui/core/avatar';

@Component({
  selector: 'docs-avatar-initials-example',
  imports: [MlvAvatar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class AvatarInitialsExampleComponent {
  readonly team = [
    { initials: 'JD', color: 'hsl(217, 60%, 75%)', label: 'John Doe' },
    { initials: 'MG', color: 'hsl(340, 60%, 80%)', label: 'Maria Garcia' },
    { initials: 'RK', color: 'hsl(140, 60%, 75%)', label: 'Ravi Kumar' },
    { initials: 'LS', color: 'hsl(30, 70%, 78%)', label: 'Lisa Smith' },
    { initials: 'TC', color: 'hsl(270, 60%, 80%)', label: 'Tom Chen' },
  ];
}
