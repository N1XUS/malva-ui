import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MlvTitle } from '@malva-ui/core/title';

@Component({
  selector: 'docs-title-semantic-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvTitle],
  templateUrl: './index.html',
})
export default class TitleSemanticExampleComponent {}
