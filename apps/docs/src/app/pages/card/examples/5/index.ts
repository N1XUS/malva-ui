import { Component, ChangeDetectionStrategy } from '@angular/core';
import {
  MlvCard,
  MlvCardHeaderDef,
  MlvCardSubheaderDef,
  MlvCardFooterDef,
  MlvCardHeader,
  MlvCardFooter,
  MlvCardSubheader,
} from '@malva-ui/core/card';
import { MlvButtonAfter, MlvButton } from '@malva-ui/core/button';
import { LucideExternalLink } from '@lucide/angular';

@Component({
  selector: 'docs-card-footer-variations-example',
  imports: [
    MlvCard,
    MlvCardHeaderDef,
    MlvCardSubheaderDef,
    MlvCardFooterDef,
    MlvButton,
    MlvButtonAfter,
    LucideExternalLink,
    MlvCardHeader,
    MlvCardFooter,
    MlvCardSubheader,
  ],
  templateUrl: './index.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './index.scss',
})
export default class CardFooterVariationsExampleComponent {}
