import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvKbd } from '@malva-ui/core/kbd';

@Component({
  selector: 'docs-kbd-keys-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvKbd],
  templateUrl: './index.html',
})
export default class KbdKeysExampleComponent {}
