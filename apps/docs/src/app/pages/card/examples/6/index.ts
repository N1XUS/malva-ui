import { Component, ChangeDetectionStrategy } from '@angular/core';
import {
  MlvCard,
  MlvCardHeaderDef,
  MlvCardHeader,
  MlvCardSubheaderDef,
  MlvCardSubheader,
} from '@malva-ui/core/card';

@Component({
  selector: 'docs-card-minimal-example',
  imports: [
    MlvCard,
    MlvCardHeader,
    MlvCardSubheader,
    MlvCardHeaderDef,
    MlvCardSubheaderDef,
  ],
  templateUrl: './index.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './index.scss',
})
export default class CardMinimalExampleComponent {}
