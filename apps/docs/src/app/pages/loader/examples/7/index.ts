import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvLoader } from '@malva-ui/core/loader';
import type { MlvLoaderTone } from '@malva-ui/core/loader';

@Component({
  selector: 'docs-loader-tones-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvLoader],
  templateUrl: './index.html',
})
export default class LoaderTonesExampleComponent {
  readonly tones: MlvLoaderTone[] = [
    'default',
    'success',
    'info',
    'warning',
    'danger',
  ];
}
