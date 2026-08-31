import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvAvatar } from '@malva-ui/core/avatar';
import { MlvColorFromTextPipe } from '@malva-ui/core/avatar';

@Component({
  selector: 'docs-avatar-image-example',
  imports: [MlvAvatar, MlvColorFromTextPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class AvatarImageExampleComponent {
  readonly users = [
    { name: 'Alice Johnson', src: 'https://i.pravatar.cc/150?img=1' },
    { name: 'Bob Martinez', src: 'https://i.pravatar.cc/150?img=2' },
    { name: 'Carol White', src: 'https://i.pravatar.cc/150?img=3' },
    { name: 'David Kim', src: 'https://i.pravatar.cc/150?img=4' },
    { name: 'Eva Brown', src: 'https://broken-url.invalid/avatar.jpg' },
  ];
}
