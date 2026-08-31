import { ChangeDetectionStrategy, Component } from '@angular/core';
import { LucideFolderKanban } from '@lucide/angular';
import { MlvButton } from '@malva-ui/core/button';
import { MlvCard } from '@malva-ui/core/card';
import {
  MlvPageAside,
  MlvPage,
  MlvPageContent,
  MlvPageHeaderActions,
  MlvPageHeader,
  MlvPageHeaderDescription,
  MlvPageHeaderIcon,
  MlvPageHeaderMeta,
  MlvPageTitle,
} from '@malva-ui/core/page';
import { MlvTitle } from '@malva-ui/core/title';

@Component({
  selector: 'docs-page-header-content-example',
  imports: [
    MlvButton,
    MlvCard,
    MlvPage,
    MlvPageContent,
    MlvPageHeader,
    MlvPageAside,
    MlvPageHeaderActions,
    MlvPageHeaderDescription,
    MlvPageHeaderIcon,
    MlvPageHeaderMeta,
    MlvPageTitle,
    MlvTitle,
    LucideFolderKanban,
  ],
  templateUrl: './index.html',
  styleUrl: './index.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class PageHeaderContentExampleComponent {}
