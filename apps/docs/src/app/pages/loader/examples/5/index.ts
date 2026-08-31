import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvLoader } from '@malva-ui/core/loader';

@Component({
  selector: 'docs-loader-circle-indeterminate-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvLoader],
  templateUrl: './index.html',
})
export default class LoaderCircleIndeterminateExampleComponent {}
