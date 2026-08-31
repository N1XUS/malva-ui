import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MlvButton, MlvButtonIcon } from '@malva-ui/core/button';
import { LucidePencil, LucideTrash2, LucideEllipsis } from '@lucide/angular';

interface Row {
  id: number;
  name: string;
}

@Component({
  selector: 'docs-button-icon-only-example',
  imports: [
    MlvButton,
    MlvButtonIcon,
    LucidePencil,
    LucideTrash2,
    LucideEllipsis,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class ButtonIconOnlyExampleComponent {
  /** Rows rendered with a trailing icon-only action cluster. */
  readonly rows: Row[] = [
    { id: 1, name: 'Quarterly report' },
    { id: 2, name: 'Design tokens' },
    { id: 3, name: 'Release checklist' },
  ];
}
