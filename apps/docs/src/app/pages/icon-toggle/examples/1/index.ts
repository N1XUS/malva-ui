import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { MlvIconToggle } from '@malva-ui/core/icon-toggle';
import { LucideBookmark } from '@lucide/angular';

@Component({
  selector: 'docs-icon-toggle-basic-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvIconToggle, LucideBookmark],
  templateUrl: './index.html',
})
export default class IconToggleBasicExampleComponent {
  readonly bookmarked = signal(false);
}
