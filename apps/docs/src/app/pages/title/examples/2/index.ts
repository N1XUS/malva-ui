import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MlvTitle } from '@malva-ui/core/title';

@Component({
  selector: 'docs-title-level-override-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvTitle],
  templateUrl: './index.html',
})
export default class TitleLevelOverrideExampleComponent {}
