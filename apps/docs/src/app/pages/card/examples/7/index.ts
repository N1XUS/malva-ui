import { Component, ChangeDetectionStrategy } from '@angular/core';
import {
  MlvCard,
  MlvCardHeaderDef,
  MlvCardHeader,
  MlvCardSubheaderDef,
  MlvCardSubheader,
} from '@malva-ui/core/card';
import { MlvInput } from '@malva-ui/core/input';
import { LucideMail } from '@lucide/angular';
import { MlvFormField, MlvFormControlAppend } from '@malva-ui/core/form-utils';
import { MlvToolbar } from '@malva-ui/core/toolbar';
import { MlvSpacer } from '@malva-ui/cdk/utils';
import { MlvButton } from '@malva-ui/core/button';

@Component({
  selector: 'docs-card-minimal-example',
  imports: [
    MlvCard,
    MlvCardHeader,
    MlvCardSubheader,
    MlvCardHeaderDef,
    MlvCardSubheaderDef,
    MlvInput,
    LucideMail,
    MlvFormControlAppend,
    MlvFormField,
    MlvToolbar,
    MlvSpacer,
    MlvButton,
  ],
  templateUrl: './index.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './index.scss',
})
export default class CardMinimalExampleComponent {}
