import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideChevronLeft, LucideFolderKanban } from '@lucide/angular';
import { MlvButton } from '@malva-ui/core/button';
import { MlvCard } from '@malva-ui/core/card';
import { MlvLink, MlvLinkBefore } from '@malva-ui/core/link';
import {
  MlvPageAside,
  MlvPage,
  MlvPageActions,
  MlvPageContent,
  MlvPageContext,
  MlvPageDescription,
  MlvPageHeader,
  MlvPageMeta,
  MlvPageTitle,
} from '@malva-ui/core/page';
import { MlvTitle } from '@malva-ui/core/title';

@Component({
  selector: 'docs-page-header-content-example',
  imports: [
    MlvButton,
    MlvCard,
    MlvLink,
    MlvLinkBefore,
    MlvPage,
    MlvPageContent,
    MlvPageHeader,
    MlvPageAside,
    MlvPageActions,
    MlvPageContext,
    MlvPageDescription,
    MlvPageMeta,
    MlvPageTitle,
    MlvTitle,
    RouterLink,
    LucideChevronLeft,
    LucideFolderKanban,
  ],
  templateUrl: './index.html',
  styleUrl: './index.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class PageHeaderContentExampleComponent {}
