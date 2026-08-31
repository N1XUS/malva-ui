import { Component, ChangeDetectionStrategy } from '@angular/core';
import {
  MlvCard,
  MlvCardHeaderDef,
  MlvCardSubheaderDef,
  MlvCardActionsDef,
  MlvCardFooterDef,
  MlvCardHeader,
  MlvCardActions,
  MlvCardSubheader,
  MlvCardFooter,
} from '@malva-ui/core/card';
import { MlvButton, MlvButtonIcon } from '@malva-ui/core/button';
import { LucideDynamicIcon, LucideBookmark } from '@lucide/angular';

@Component({
  selector: 'docs-card-background-image-example',
  imports: [
    MlvCard,
    MlvCardHeaderDef,
    MlvCardSubheaderDef,
    MlvCardActionsDef,
    MlvCardFooterDef,
    MlvButton,
    LucideDynamicIcon,
    MlvButtonIcon,
    MlvCardHeader,
    MlvCardActions,
    MlvCardSubheader,
    MlvCardFooter,
  ],
  templateUrl: './index.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './index.scss',
})
export default class CardBackgroundImageExampleComponent {
  readonly bookmarkIcon = LucideBookmark;
}
