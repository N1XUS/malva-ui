import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from '@angular/core';
import {
  LucideMoonStar,
  LucideSparkles,
  LucideSunMedium,
} from '@lucide/angular';
import { MlvAvatar, MlvColorFromTextPipe } from '@malva-ui/core/avatar';
import { MlvBadge } from '@malva-ui/core/badge';
import { MlvChip } from '@malva-ui/core/chip';
import { MlvKbd } from '@malva-ui/core/kbd';
import { MlvProgress } from '@malva-ui/core/progress';
import { MlvSlider, type MlvSliderValue } from '@malva-ui/core/slider';

/**
 * Split-screen theme comparison: the same Malva scene rendered on the light
 * and dark token sets, revealed through a draggable divider. The divider is
 * driven by `mlv-slider`, so the comparison stays keyboard-accessible; both
 * scene copies are decorative.
 */
@Component({
  selector: 'docs-home-theme-split',
  templateUrl: './home-theme-split.html',
  styleUrl: './home-theme-split.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgTemplateOutlet,
    LucideMoonStar,
    LucideSparkles,
    LucideSunMedium,
    MlvAvatar,
    MlvBadge,
    MlvChip,
    MlvColorFromTextPipe,
    MlvKbd,
    MlvProgress,
    MlvSlider,
  ],
})
export class HomeThemeSplitComponent {
  /** @internal Divider position, percentage of the stage width. */
  protected readonly split = signal(52);

  /** @internal Inline clip variable consumed by the dark overlay. */
  protected readonly splitStyle = computed(() => `${this.split()}%`);

  /** @internal Updates the divider from the slider control. */
  protected onSplitChange(value: MlvSliderValue): void {
    if (typeof value === 'number') {
      this.split.set(value);
    }
  }
}
