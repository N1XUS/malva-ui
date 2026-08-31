import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import type { MlvCardBodyLayout, MlvCardSize } from '@malva-ui/core/card';
import {
  MlvCard,
  MlvCardHeader,
  MlvCardHeaderDef,
  MlvCardSubheader,
  MlvCardSubheaderDef,
} from '@malva-ui/core/card';
import { MlvBadge } from '@malva-ui/core/badge';
import { MlvButton } from '@malva-ui/core/button';

@Component({
  selector: 'docs-card-body-layout-example',
  imports: [
    MlvCard,
    MlvCardHeader,
    MlvCardHeaderDef,
    MlvCardSubheader,
    MlvCardSubheaderDef,
    MlvBadge,
    MlvButton,
  ],
  templateUrl: './index.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class CardBodyLayoutExampleComponent {
  /** Body layout applied to the interactive card. */
  readonly bodyLayout = signal<MlvCardBodyLayout>('stack');

  /** Size preset — the body gap scales with it. */
  readonly size = signal<MlvCardSize>('m');

  /** Sizes offered by the size switcher. */
  readonly sizes: readonly MlvCardSize[] = ['s', 'm', 'l'];

  /** Flips between the default `none` body and the `stack` body. */
  toggleLayout(): void {
    this.bodyLayout.update((layout) => (layout === 'stack' ? 'none' : 'stack'));
  }
}
