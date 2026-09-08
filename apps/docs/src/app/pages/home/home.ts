import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import {
  LucideArrowRight,
  LucideBell,
  LucideCalendarDays,
  LucideCheck,
  LucideCircleCheck,
  LucideCommand,
  LucideFolderKanban,
  LucideInbox,
  LucideLayers3,
  LucideLayoutDashboard,
  LucideMenu,
  LucidePanelLeftClose,
  LucidePanelLeftOpen,
  LucidePlus,
  LucideRocket,
  LucideSearch,
  LucideSettings,
  LucideSparkles,
  LucideTrendingUp,
  LucideUsers,
  LucideX,
} from '@lucide/angular';
import { MlvAvatar, MlvColorFromTextPipe } from '@malva-ui/core/avatar';
import { MlvBadge } from '@malva-ui/core/badge';
import { MlvButton } from '@malva-ui/core/button';
import { MlvCalendar } from '@malva-ui/core/calendar';
import { MlvCard } from '@malva-ui/core/card';
import { MlvCheckbox } from '@malva-ui/core/checkbox';
import { MlvChip } from '@malva-ui/core/chip';
import { MlvCopyToClipboard } from '@malva-ui/core/copy-to-clipboard';
import { MlvEmptyState } from '@malva-ui/core/empty-state';
import { MlvFormControlPrepend } from '@malva-ui/core/form-utils';
import { MlvInput } from '@malva-ui/core/input';
import { MlvKbd } from '@malva-ui/core/kbd';
import { MlvLink } from '@malva-ui/core/link';
import {
  MlvList,
  MlvListItemActions,
  MlvListItemByline,
  MlvListItem,
  MlvListItemMeta,
  MlvListItemTitle,
} from '@malva-ui/core/list';
import { MlvThemeService } from '@malva-ui/cdk/theme';
import { MlvSelect } from '@malva-ui/core/select';
import {
  MlvPageContent,
  MlvPageHeader,
  MlvPageActions,
  MlvPageDescription,
  MlvPageShell,
  MlvPageSidebar,
  MlvPageSummary,
  MlvPageSummaryItem,
  MlvPageTitle,
  MlvPageTopbar,
} from '@malva-ui/core/page';
import { MlvProgress } from '@malva-ui/core/progress';
import { MlvSkeleton } from '@malva-ui/core/skeleton';
import {
  MlvSidebar,
  MlvSidebarFooter,
  MlvSidebarItem,
  MlvSidebarItemIcon,
  MlvSidebarItemTitle,
  MlvSidebarTrigger,
  MlvSidebarWorkspace,
  SidebarContentDirective,
} from '@malva-ui/core/sidebar';
import { MlvStep, MlvStepper } from '@malva-ui/core/stepper';
import {
  MlvTimeline,
  MlvTimelineItem,
  MlvTimelineItemIcon,
  MlvTimelineItemMeta,
} from '@malva-ui/core/timeline';
import { DocsAppBarComponent } from '../../shared/docs-app-bar/docs-app-bar';
import { HomeBentoComponent } from './home-bento';
import { HomeMarqueeComponent } from './home-marquee';
import { HomeShowcaseReelComponent } from './home-showcase-reel';
import { HomeStatsComponent } from './home-stats';
import { HomeThemeSplitComponent } from './home-theme-split';
import { DocsReveal } from './reveal';

/** Rotating hero qualities; the first entry is also the static SR text. */
const HERO_WORDS = ['finished.', 'accessible.', 'themeable.', 'alive.'];

@Component({
  selector: 'docs-home',
  templateUrl: './home.html',
  styleUrl: './home.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'malva-home' },
  imports: [
    RouterLink,
    DocsAppBarComponent,
    DocsReveal,
    FormField,
    HomeBentoComponent,
    HomeMarqueeComponent,
    HomeShowcaseReelComponent,
    HomeStatsComponent,
    HomeThemeSplitComponent,
    MlvAvatar,
    MlvBadge,
    MlvButton,
    MlvCalendar,
    MlvCard,
    MlvCheckbox,
    MlvChip,
    MlvCopyToClipboard,
    MlvEmptyState,
    MlvFormControlPrepend,
    MlvInput,
    MlvKbd,
    MlvLink,
    MlvList,
    MlvListItem,
    MlvListItemTitle,
    MlvListItemByline,
    MlvListItemMeta,
    MlvListItemActions,
    MlvSelect,
    MlvPageContent,
    MlvPageHeader,
    MlvPageActions,
    MlvPageDescription,
    MlvPageShell,
    MlvPageSidebar,
    MlvPageSummary,
    MlvPageSummaryItem,
    MlvPageTitle,
    MlvPageTopbar,
    MlvProgress,
    MlvSkeleton,
    MlvSidebar,
    MlvSidebarFooter,
    MlvSidebarItem,
    MlvSidebarItemIcon,
    MlvSidebarItemTitle,
    MlvSidebarTrigger,
    MlvSidebarWorkspace,
    SidebarContentDirective,
    MlvStepper,
    MlvStep,
    MlvTimeline,
    MlvTimelineItem,
    MlvTimelineItemIcon,
    MlvTimelineItemMeta,
    LucideArrowRight,
    LucideBell,
    LucideCalendarDays,
    LucideCheck,
    LucideCircleCheck,
    LucideCommand,
    LucideFolderKanban,
    LucideInbox,
    LucideLayoutDashboard,
    LucideLayers3,
    LucideMenu,
    LucidePanelLeftClose,
    LucidePanelLeftOpen,
    LucideRocket,
    LucidePlus,
    LucideSearch,
    LucideSettings,
    LucideSparkles,
    LucideTrendingUp,
    LucideUsers,
    LucideX,
    MlvColorFromTextPipe,
  ],
})
export class HomePageComponent {
  private readonly _document = inject(DOCUMENT);
  private readonly _themeService = inject(MlvThemeService);
  private readonly _destroyRef = inject(DestroyRef);

  /** @private Writable model backing the homepage signal-form composition. */
  private readonly _projectModel = signal({
    projectName: 'Autumn product launch',
    workspace: 'Growth design',
    includeReview: true,
  });

  /** @internal Signal-form field tree bound to the homepage controls. */
  protected readonly _projectForm = form(this._projectModel);

  protected readonly workspaceOptions = [
    'Growth design',
    'Product platform',
    'Brand studio',
  ];

  /** @internal Workspace data shown by the page-shell composition demo. */
  protected readonly previewWorkspaces = [
    {
      id: 'arc-studio',
      label: 'Arc Studio',
      description: 'Team workspace',
    },
  ];

  /** @internal Rotating hero qualities; index drives the crossfade. */
  protected readonly heroWords = HERO_WORDS;

  /** @internal Currently highlighted hero word. */
  protected readonly heroWordIndex = signal(0);

  /** @internal Theme-matched generated hero artwork. */
  protected readonly heroArt = computed(() =>
    this._themeService.currentTheme() === 'dark'
      ? '/malva-ui-hero-glass-dark.webp'
      : '/malva-ui-hero-glass-light.webp',
  );

  /** @internal Pointer-parallax offset applied to the hero float chips. */
  protected readonly heroParallax = signal({ x: 0, y: 0 });

  /** @private Whether motion extras (word rotation, parallax) may run. */
  private readonly _motionOk =
    typeof matchMedia !== 'undefined' &&
    !matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor() {
    effect(() => {
      this._document.documentElement.setAttribute(
        'mlvTheme',
        this._themeService.currentTheme(),
      );
    });

    if (this._motionOk) {
      const interval = setInterval(() => {
        this.heroWordIndex.update(
          (index) => (index + 1) % this.heroWords.length,
        );
      }, 2800);
      this._destroyRef.onDestroy(() => clearInterval(interval));
    }
  }

  /** @internal Tracks pointer position over the hero for the float parallax. */
  protected onHeroPointerMove(event: PointerEvent): void {
    if (!this._motionOk || event.pointerType !== 'mouse') {
      return;
    }
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    this.heroParallax.set({
      x: ((event.clientX - rect.left) / rect.width - 0.5) * 2,
      y: ((event.clientY - rect.top) / rect.height - 0.5) * 2,
    });
  }

  /** @internal Eases the floats back when the pointer leaves the hero. */
  protected onHeroPointerLeave(): void {
    this.heroParallax.set({ x: 0, y: 0 });
  }
}
