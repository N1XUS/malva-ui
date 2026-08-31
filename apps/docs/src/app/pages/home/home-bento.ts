import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  LucideArrowRight,
  LucideBookmark,
  LucideHeart,
} from '@lucide/angular';
import { MlvAvatar, MlvColorFromTextPipe } from '@malva-ui/core/avatar';
import { MlvBadge } from '@malva-ui/core/badge';
import { MlvChip } from '@malva-ui/core/chip';
import { MlvIconToggle } from '@malva-ui/core/icon-toggle';
import { MlvKbd } from '@malva-ui/core/kbd';
import { MlvLink } from '@malva-ui/core/link';
import { MlvPinInput } from '@malva-ui/core/pin-input';
import { MlvProgress } from '@malva-ui/core/progress';
import { MlvRating } from '@malva-ui/core/rating';
import { MlvSegmented, MlvSegmentedItem } from '@malva-ui/core/segmented';
import { MlvSlider } from '@malva-ui/core/slider';
import { MlvStatusIndicator } from '@malva-ui/core/status-indicator';
import { MlvSwitch } from '@malva-ui/core/switch';

/**
 * "Play with it" bento grid: a wall of small, genuinely interactive Malva
 * controls, each tile linking to its documentation page.
 */
@Component({
  selector: 'docs-home-bento',
  templateUrl: './home-bento.html',
  styleUrl: './home-bento.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    LucideArrowRight,
    LucideBookmark,
    LucideHeart,
    MlvAvatar,
    MlvBadge,
    MlvChip,
    MlvColorFromTextPipe,
    MlvIconToggle,
    MlvKbd,
    MlvLink,
    MlvPinInput,
    MlvProgress,
    MlvRating,
    MlvSegmented,
    MlvSegmentedItem,
    MlvSlider,
    MlvStatusIndicator,
    MlvSwitch,
  ],
})
export class HomeBentoComponent {
  /** @internal Live rating tile value. */
  protected readonly rating = signal(4);

  /** @internal Live slider tile value. */
  protected readonly volume = signal(64);

  /** @internal Live switch tile states. */
  protected readonly autoSave = signal(true);
  protected readonly weeklyDigest = signal(false);

  /** @internal Live icon-toggle tile states. */
  protected readonly liked = signal(true);
  protected readonly bookmarked = signal(false);

  /** @internal Live pin-input tile value. */
  protected readonly pin = signal('2026');

  /** @internal Live segmented tile value. */
  protected readonly view = signal<'board' | 'list' | 'table'>('board');
}
