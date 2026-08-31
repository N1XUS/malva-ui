import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MlvSidebar, MlvSidebarItem } from '@malva-ui/core/sidebar';

@Component({
  selector: 'docs-sidebar-appearance-example',
  imports: [MlvSidebar, MlvSidebarItem],
  templateUrl: './index.html',
  styleUrl: './index.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class SidebarAppearanceExampleComponent {}
