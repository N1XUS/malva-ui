import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvLink, MlvLinkAfter, MlvLinkBefore } from '@malva-ui/core/link';
import { LucideChevronLeft, LucideChevronRight } from '@lucide/angular';
import { MlvBadge } from '@malva-ui/core/badge';

@Component({
  selector: 'docs-link-side-variants-example',
  imports: [
    MlvLink,
    LucideChevronLeft,
    MlvLinkBefore,
    MlvLinkAfter,
    LucideChevronRight,
    MlvBadge,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class LinkSideVariantsExampleComponent {}
