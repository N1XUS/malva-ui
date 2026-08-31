import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MlvResizeObserverService } from '@malva-ui/cdk/utils';
import {
  LucideBell,
  LucideCalendarDays,
  LucideCircle,
  LucideCircleCheckBig,
  LucideCircleDashed,
  LucideEllipsis,
  LucideHouse,
  LucideInbox,
  LucideMenu,
  LucidePanelsTopLeft,
  LucidePlus,
  LucideSearch,
  LucideSettings,
} from '@lucide/angular';
import {
  MlvActionBar,
  MlvActionBarActions,
  MlvActionBarLogo,
} from '@malva-ui/core/action-bar';
import { MlvAvatar } from '@malva-ui/core/avatar';
import { MlvBadge } from '@malva-ui/core/badge';
import {
  MlvBreadcrumb,
  type MlvBreadcrumbEntry,
} from '@malva-ui/core/breadcrumb';
import { MlvButton } from '@malva-ui/core/button';
import { MlvCard } from '@malva-ui/core/card';
import { MlvColorPickerPopup } from '@malva-ui/core/color-picker';
import {
  MlvPageBreadcrumb,
  MlvPage,
  MlvPageHeaderActions,
  MlvPageHeader,
  MlvPageHeaderDescription,
  MlvPageHeaderTabs,
  MlvPageEndSidebar,
  MlvPageShell,
  MlvPageSidebar,
  MlvPageTopbar,
  MlvPageTitle,
} from '@malva-ui/core/page';
import {
  MlvSidebar,
  type MlvSidebarMode,
  SidebarContentDirective,
  MlvSidebarFooter,
  MlvSidebarItem,
  MlvSidebarItemIcon,
} from '@malva-ui/core/sidebar';
import {
  MlvSearchField,
  type MlvSearchFieldPresentation,
} from '@malva-ui/core/search-field';
import { MlvTab, MlvTabDef, MlvTabGroup } from '@malva-ui/core/tabs';
import { MlvTitle } from '@malva-ui/core/title';
import { MlvToolbar } from '@malva-ui/core/toolbar';
import { MlvDensityDirective } from '@malva-ui/cdk/density';

type ShellColorMode = 'auto' | 'custom';

@Component({
  selector: 'docs-page-app-shell-example',
  imports: [
    MlvActionBar,
    MlvActionBarActions,
    MlvActionBarLogo,
    MlvAvatar,
    MlvSearchField,
    MlvBadge,
    MlvBreadcrumb,
    MlvButton,
    MlvCard,
    MlvColorPickerPopup,
    MlvPage,
    MlvPageHeader,
    MlvPageBreadcrumb,
    MlvPageHeaderActions,
    MlvPageHeaderDescription,
    MlvPageHeaderTabs,
    MlvPageEndSidebar,
    MlvPageShell,
    MlvPageSidebar,
    MlvPageTopbar,
    MlvPageTitle,
    MlvSidebar,
    SidebarContentDirective,
    MlvSidebarFooter,
    MlvSidebarItem,
    MlvSidebarItemIcon,
    MlvTab,
    MlvTabDef,
    MlvTabGroup,
    MlvTitle,
    MlvToolbar,
    LucideBell,
    LucideCalendarDays,
    LucideCircle,
    LucideCircleCheckBig,
    LucideCircleDashed,
    LucideEllipsis,
    LucideHouse,
    LucideInbox,
    LucideMenu,
    LucidePanelsTopLeft,
    LucidePlus,
    LucideSearch,
    LucideSettings,
    MlvDensityDirective,
  ],
  templateUrl: './index.html',
  styleUrl: './index.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class PageAppShellExampleComponent {
  /**
   * @private Preview width in CSS pixels below which the topbar search collapses
   * to its icon presentation.
   *
   * At this width the brand + nav side needs ~290px and the action side ~244px,
   * which together with the field's own 9rem and its margins no longer fit the
   * bar; the field is the part that gives way.
   */
  private static readonly _SEARCH_ICON_BELOW = 760;

  /**
   * @private Preview width in CSS pixels below which the sidebar stops holding a
   * column of its own and opens over the content as a drawer instead.
   *
   * Even the collapsed icon rail costs 3.5rem of a narrow shell, which is enough
   * to break the page header — the title wraps to a word per line before the
   * content is unreadable.
   */
  private static readonly _SIDEBAR_OFFCANVAS_BELOW = 560;

  readonly shellColorMode = signal<ShellColorMode>('custom');
  readonly shellColor = signal('#7138d0');
  readonly shellColorInput = computed(() =>
    this.shellColorMode() === 'custom' ? 'var(--mlv-demo-shell-color)' : null,
  );
  readonly shellColorCustomProperty = computed(() =>
    this.shellColorMode() === 'custom' ? this.shellColor() : null,
  );
  readonly collapsed = signal(false);
  readonly inspectorCollapsed = signal(false);
  readonly activeTab = signal('summary');
  /** Two-way bound topbar search text. */
  readonly searchQuery = signal('');
  readonly breadcrumbs: MlvBreadcrumbEntry[] = [
    { label: 'Workspace', href: '#workspace' },
    { label: 'Website redesign' },
  ];

  /** @private Host element, measured so the topbar follows the preview's own width. */
  private readonly _elementRef = inject(ElementRef<HTMLElement>);

  /** @private Shared observer used to measure the preview container. */
  private readonly _resizeObserver = inject(MlvResizeObserverService);

  /** @private Latest measured preview width in CSS pixels. */
  private readonly _containerWidth = signal(0);

  /**
   * Presentation of the topbar search field.
   *
   * Resolved from the width of this preview, not the viewport. The shell is a
   * box inside the documentation page, so a media query would answer the wrong
   * question — the preview can be narrow on a wide screen. Mirrors how
   * `mlv-page-content` drives its own `stackBelow` from a `ResizeObserver`.
   */
  readonly searchPresentation = computed<MlvSearchFieldPresentation>(() => {
    const width = this._containerWidth();
    const collapse =
      width > 0 && width < PageAppShellExampleComponent._SEARCH_ICON_BELOW;

    return collapse ? 'icon' : 'field';
  });

  /**
   * Mode of the primary sidebar, resolved from the same measured width.
   *
   * `'offcanvas'` makes `mlv-sidebar` render as an overlay drawer instead of a
   * column, so a narrow shell spends all of its width on the page itself. The
   * drawer's open state is the same `collapsed` model the icon rail uses.
   */
  readonly sidebarMode = computed<MlvSidebarMode>(() => {
    const width = this._containerWidth();
    const offcanvas =
      width > 0 &&
      width < PageAppShellExampleComponent._SIDEBAR_OFFCANVAS_BELOW;

    return offcanvas ? 'offcanvas' : 'icon';
  });

  constructor() {
    this._resizeObserver
      .observe(this._elementRef)
      .pipe(takeUntilDestroyed())
      .subscribe((entries) => {
        const width = entries[entries.length - 1]?.contentRect.width;
        if (width === undefined) return;

        this._containerWidth.set(width);
        if (width < PageAppShellExampleComponent._SIDEBAR_OFFCANVAS_BELOW) {
          this.collapsed.set(true);
        }
      });
  }

  /**
   * Opens or closes the sidebar.
   *
   * In `offcanvas` mode the sidebar's own trigger sits inside the drawer, so it
   * cannot reach a closed drawer — the topbar owns the control there.
   */
  toggleSidebar(): void {
    this.collapsed.update((collapsed) => !collapsed);
  }

  /** Opens or collapses the end inspector independently of navigation. */
  toggleInspector(): void {
    this.inspectorCollapsed.update((collapsed) => !collapsed);
  }

  /** Activates the saved CSS custom-property color. */
  useCustomShellColor(): void {
    this.shellColorMode.set('custom');
  }

  /** Restores the Page shell's standard theme color. */
  useAutoShellColor(): void {
    this.shellColorMode.set('auto');
  }

  /** Stores a popup selection and activates custom color mode. */
  setShellColor(color: string): void {
    this.shellColor.set(color);
    this.useCustomShellColor();
  }
}
