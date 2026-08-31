import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideArrowRight } from '@lucide/angular';
import { MlvBadge } from '@malva-ui/core/badge';
import { SHOWCASES } from '../../showcases/showcase.registry';

const CATEGORY_LABELS: Record<string, string> = {
  workspaces: 'Workspaces',
  communication: 'Communication',
  data: 'Data',
  content: 'Content',
  settings: 'Settings',
};

/**
 * Horizontal scroll-snap reel of the full-size showcase compositions, fed by
 * the showcase registry so cards, previews, and routes never drift from the
 * catalog.
 */
@Component({
  selector: 'docs-home-showcase-reel',
  templateUrl: './home-showcase-reel.html',
  styleUrl: './home-showcase-reel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgOptimizedImage, RouterLink, LucideArrowRight, MlvBadge],
})
export class HomeShowcaseReelComponent {
  protected readonly showcases = SHOWCASES;

  /** @internal Human label for a registry category id. */
  protected categoryLabel(category: string): string {
    return CATEGORY_LABELS[category] ?? category;
  }
}
