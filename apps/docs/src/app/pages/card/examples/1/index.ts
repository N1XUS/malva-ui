import { Component, ChangeDetectionStrategy } from '@angular/core';
import {
  MlvCard,
  MlvCardHeaderDef,
  MlvCardHeader,
  MlvCardSubheaderDef,
  MlvCardSubheader,
} from '@malva-ui/core/card';

@Component({
  selector: 'docs-card-sizes-example',
  imports: [
    MlvCard,
    MlvCardHeaderDef,
    MlvCardSubheaderDef,
    MlvCardHeader,
    MlvCardSubheader,
  ],
  templateUrl: './index.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './index.scss',
})
export default class CardSizesExampleComponent {}
