import { BreakpointObserver } from '@angular/cdk/layout';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import type { ElementRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import type { LucideIconInput } from '@lucide/angular';
import {
  LucideAccessibility,
  LucideActivity,
  LucideAlignJustify,
  LucideAlignLeft,
  LucideArrowLeftRight,
  LucideBell,
  LucideBellDot,
  LucideCalendar,
  LucideCalendarDays,
  LucideChevronRight,
  LucideChevronsDownUp,
  LucideChevronsUpDown,
  LucideCircleDot,
  LucideCirclePlus,
  LucideCircleUser,
  LucideClipboardCheck,
  LucideClipboardList,
  LucideClock,
  LucideColumns2,
  LucideCreditCard,
  LucideDynamicIcon,
  LucideFingerprint,
  LucideGauge,
  LucideHash,
  LucideHouse,
  LucideInbox,
  LucideInfo,
  LucideKanban,
  LucideKeyboard,
  LucideLanguages,
  LucideLayers,
  LucideLayoutDashboard,
  LucideLayoutGrid,
  LucideLayoutTemplate,
  LucideLink,
  LucideList,
  LucideListChecks,
  LucideListCollapse,
  LucideListEnd,
  LucideListFilter,
  LucideListTree,
  LucideLoader,
  LucideMenu,
  LucideMessageCircle,
  LucideMessageSquare,
  LucideMinus,
  LucideMousePointer2,
  LucideMousePointerClick,
  LucideNavigation,
  LucidePalette,
  LucidePanelBottom,
  LucidePanelLeft,
  LucidePanelLeftClose,
  LucidePanelLeftOpen,
  LucidePanelRight,
  LucidePipette,
  LucideRadar,
  LucideRectangleHorizontal,
  LucideRocket,
  LucideScaling,
  LucideScrollText,
  LucideSearch,
  LucideSlidersHorizontal,
  LucideSparkles,
  LucideSquareCheck,
  LucideSquareDashed,
  LucideSquareSplitHorizontal,
  LucideStar,
  LucideTable2,
  LucideTag,
  LucideTags,
  LucideTextCursorInput,
  LucideToggleLeft,
  LucideTriangleAlert,
  LucideUpload,
  LucideUsers,
  LucideWrench,
} from '@lucide/angular';
import { MlvButton } from '@malva-ui/core/button';
import { MlvPageShell, MlvPageSidebar } from '@malva-ui/core/page';
import {
  MlvSidebar,
  MlvSidebarGroup,
  MlvSidebarItem,
  MlvSidebarItemIcon,
  MlvSidebarItemTitle,
} from '@malva-ui/core/sidebar';
import type { MlvSidebarMode } from '@malva-ui/core/sidebar';
import { MlvDensityRootDirective } from '@malva-ui/cdk/density';
import { MlvThemeService } from '@malva-ui/cdk/theme';
import { MlvSpacer } from '@malva-ui/cdk/utils';
import { filter } from 'rxjs';
import { docsNavigationGroups } from '../../app.routes';
import type { DocsIconName, DocsNavigationGroup } from '../../app.routes';
import { DocsTableOfContentsComponent, DocsTocService } from '../toc';
import { MlvSearchField } from '@malva-ui/core/search-field';
import { DocsAppBarComponent } from '../docs-app-bar/docs-app-bar';

const NAV_ICONS: Readonly<Record<DocsIconName, LucideIconInput>> = {
  accessibility: LucideAccessibility,
  activity: LucideActivity,
  'align-justify': LucideAlignJustify,
  'align-left': LucideAlignLeft,
  'arrow-left-right': LucideArrowLeftRight,
  bell: LucideBell,
  'bell-dot': LucideBellDot,
  calendar: LucideCalendar,
  'calendar-days': LucideCalendarDays,
  'chevron-right': LucideChevronRight,
  'chevrons-down-up': LucideChevronsDownUp,
  'chevrons-up-down': LucideChevronsUpDown,
  'circle-dot': LucideCircleDot,
  'circle-plus': LucideCirclePlus,
  'circle-user': LucideCircleUser,
  'clipboard-check': LucideClipboardCheck,
  'clipboard-list': LucideClipboardList,
  clock: LucideClock,
  'columns-2': LucideColumns2,
  'credit-card': LucideCreditCard,
  fingerprint: LucideFingerprint,
  gauge: LucideGauge,
  hash: LucideHash,
  house: LucideHouse,
  inbox: LucideInbox,
  info: LucideInfo,
  kanban: LucideKanban,
  keyboard: LucideKeyboard,
  languages: LucideLanguages,
  layers: LucideLayers,
  'layout-dashboard': LucideLayoutDashboard,
  'layout-grid': LucideLayoutGrid,
  'layout-template': LucideLayoutTemplate,
  link: LucideLink,
  list: LucideList,
  'list-checks': LucideListChecks,
  'list-collapse': LucideListCollapse,
  'list-end': LucideListEnd,
  'list-filter': LucideListFilter,
  'list-tree': LucideListTree,
  loader: LucideLoader,
  menu: LucideMenu,
  'message-circle': LucideMessageCircle,
  'message-square': LucideMessageSquare,
  minus: LucideMinus,
  'mouse-pointer-2': LucideMousePointer2,
  'mouse-pointer-click': LucideMousePointerClick,
  navigation: LucideNavigation,
  palette: LucidePalette,
  'panel-bottom': LucidePanelBottom,
  'panel-left': LucidePanelLeft,
  'panel-right': LucidePanelRight,
  pipette: LucidePipette,
  radar: LucideRadar,
  'rectangle-horizontal': LucideRectangleHorizontal,
  rocket: LucideRocket,
  scaling: LucideScaling,
  'scroll-text': LucideScrollText,
  search: LucideSearch,
  'sliders-horizontal': LucideSlidersHorizontal,
  sparkles: LucideSparkles,
  'square-check': LucideSquareCheck,
  'square-dashed': LucideSquareDashed,
  'square-split-horizontal': LucideSquareSplitHorizontal,
  star: LucideStar,
  'table-2': LucideTable2,
  tag: LucideTag,
  tags: LucideTags,
  'text-cursor-input': LucideTextCursorInput,
  'toggle-left': LucideToggleLeft,
  'triangle-alert': LucideTriangleAlert,
  upload: LucideUpload,
  users: LucideUsers,
  wrench: LucideWrench,
};

@Component({
  selector: 'docs-shell',
  imports: [
    RouterModule,
    MlvButton,
    LucideDynamicIcon,
    MlvPageShell,
    MlvPageSidebar,
    MlvDensityRootDirective,
    MlvSpacer,
    MlvSidebar,
    MlvSidebarGroup,
    MlvSidebarItem,
    MlvSidebarItemIcon,
    MlvSidebarItemTitle,
    DocsTableOfContentsComponent,
    MlvSearchField,
    DocsAppBarComponent,
  ],
  templateUrl: './docs-shell.html',
  styleUrl: './docs-shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocsShellComponent {
  /** @private ToC service providing entries from the active page. */
  private readonly _tocService = inject(DocsTocService);

  /**
   * The resolved theme, stamped on the navigation rail as `mlvTheme`.
   *
   * `mlv-page-shell` derives the rail's text, hover and active colours from
   * its own chrome, which is right for an application frame in a brand colour
   * and wrong here — the documentation rail should look like every other
   * `mlv-sidebar` the site documents. Scoping the rail to a theme is the
   * shell's own opt-out (`&__sidebar.mlv-sidebar:not([mlvTheme])`), and
   * binding the *resolved* theme rather than a literal keeps the rail
   * following the theme switcher instead of pinning it to one.
   */
  protected readonly railTheme = inject(MlvThemeService).currentTheme;

  /** @private Router used to dismiss mobile navigation after navigation. */
  private readonly _router = inject(Router);

  /** @private Main region that receives focus after client-side navigation. */
  private readonly _mainContent =
    viewChild<ElementRef<HTMLElement>>('mainContent');

  /** Current page table-of-contents entries. */
  readonly tocEntries = this._tocService.entries;

  /** Search query applied to every navigation group. */
  readonly navigationQuery = signal('');

  /** Whether the shell is currently below its off-canvas breakpoint. */
  readonly isMobile = signal(false);

  /** Expanded/collapsed state shared by icon and off-canvas sidebar modes. */
  readonly sidebarCollapsed = signal(false);

  /** Responsive sidebar mode: off-canvas on narrow screens, icon rail otherwise. */
  readonly sidebarMode = computed<MlvSidebarMode>(() =>
    this.isMobile() ? 'offcanvas' : 'icon',
  );

  /** Accessible name for the responsive navigation toggle. */
  readonly navigationToggleLabel = computed(() =>
    this.sidebarCollapsed()
      ? 'Open documentation navigation'
      : 'Close documentation navigation',
  );

  /** Accessible label for the sidebar's own collapse/close action. */
  readonly sidebarActionLabel = computed(() => {
    if (this.isMobile()) return 'Close navigation';
    return this.sidebarCollapsed() ? 'Expand sidebar' : 'Collapse sidebar';
  });

  /** Navigation groups filtered by the current query, retaining alphabetic order. */
  readonly navigationGroups = computed<readonly DocsNavigationGroup[]>(() => {
    const query = this.navigationQuery().trim().toLocaleLowerCase();
    if (!query) return docsNavigationGroups;
    return docsNavigationGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) =>
          `${item.label} ${item.link}`.toLocaleLowerCase().includes(query),
        ),
      }))
      .filter((group) => group.items.length > 0);
  });

  /** Icons used by the collapse affordance. */
  protected readonly _collapseIcon = LucidePanelLeftClose;
  protected readonly _expandIcon = LucidePanelLeftOpen;

  constructor() {
    inject(BreakpointObserver)
      .observe('(max-width: 47.999rem)')
      .pipe(takeUntilDestroyed())
      .subscribe(({ matches }) => {
        const changed = matches !== this.isMobile();
        this.isMobile.set(matches);
        if (changed) this.sidebarCollapsed.set(matches);
      });

    this._router.events
      .pipe(
        filter(
          (event): event is NavigationEnd => event instanceof NavigationEnd,
        ),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        if (this.isMobile()) this.sidebarCollapsed.set(true);
        setTimeout(() => {
          const main = this._mainContent()?.nativeElement;
          const doc = main?.ownerDocument;
          const active = doc?.activeElement ?? null;
          // Focusing <main> on every navigation steals focus that something else
          // has already placed deliberately. Two cases matter here:
          //   1. A route-opened dialog (`/dialog/edit`,
          //      `mlvGenerateRoutableDialogRoute`) opens on this same navigation —
          //      focusing <main> would pull focus straight back out of the modal.
          //   2. That dialog closing navigates back and restores focus to its
          //      trigger, which lives inside the surviving <main> content.
          // An overlay still playing its leave animation (a drawer or dialog
          // closing while a navigation lands) also matches the `[role="dialog"]`
          // clause below, so <main> is not focused in that window either.
          // So skip the focus call when a modal surface is up, when focus already
          // sits inside the overlay container, or when it already sits on a real
          // element inside <main>. Trade-off, accepted: a non-modal overlay in the
          // CDK container (the sidebar flyout) and a link inside surviving main
          // content keep their focus instead of jumping to <main>. The scroll reset
          // always runs.
          const overlay = doc?.querySelector('.cdk-overlay-container');
          const focusAlreadyPlaced =
            !!overlay?.querySelector('[role="dialog"], [role="alertdialog"]') ||
            (!!active && !!overlay?.contains(active)) ||
            (!!active &&
              active !== main &&
              active !== doc?.body &&
              !!main?.contains(active));
          if (!focusAlreadyPlaced) main?.focus({ preventScroll: true });
          doc?.defaultView?.scrollTo({ left: 0, top: 0 });
        });
      });
  }

  /** Resolves a manifest icon key to its Lucide directive class. */
  protected _icon(name: DocsIconName): LucideIconInput {
    return NAV_ICONS[name];
  }

  /** Opens or collapses the responsive sidebar. */
  protected _toggleSidebar(): void {
    this.sidebarCollapsed.update((collapsed) => !collapsed);
  }
}
