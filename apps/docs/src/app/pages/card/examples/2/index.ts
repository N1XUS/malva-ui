import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvCard, MlvCardHeaderDef, MlvCardHeader } from '@malva-ui/core/card';

@Component({
  selector: 'docs-card-elevation-example',
  imports: [MlvCard, MlvCardHeaderDef, MlvCardHeader],
  templateUrl: './index.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './index.scss',
})
export default class CardElevationExampleComponent {}
