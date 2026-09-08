import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewEncapsulation,
  computed,
  contentChild,
  inject,
  input,
  output,
} from '@angular/core';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import { RouterLink } from '@angular/router';
import { LucideChevronLeft, LucideChevronUp } from '@lucide/angular';
import { MlvButton } from '@malva-ui/core/button';
import { MlvLink, MlvLinkBefore } from '@malva-ui/core/link';
import { MlvPageSnapController } from '../page/page-snap-controller';
import { registerPageRegion } from '../page/page-geometry';
import { MlvPageSnap } from '../page/page-snap.directive';
import {
  MlvPageBreadcrumb,
  MlvPageHeaderActions,
  MlvPageHeaderDescription,
  MlvPageHeaderIcon,
  MlvPageHeaderMeta,
  MlvPageHeaderStatus,
  MlvPageHeaderTabsActions,
  MlvPageHeaderTabs,
  MlvPageTitle,
} from './page-header.directives';

/** Visual scale of the page header. */
export type MlvPageHeaderSize = 'm' | 's';

/** Horizontal alignment of the tabs row inside the page header. */
export type MlvPageHeaderTabsAlign = 'start' | 'center';

/**
 * Structured page heading with optional breadcrumb, actions, status, metadata,
 * and tabs. `size="s"` renders the compact record-editor header.
 *
 * Inside `main[mlvPage]` the header participates in the scroll-scrubbed snap
 * timeline (`--mlv-page-snap`): the title interpolates down one type scale and
 * the breadcrumb and tabs rows collapse, each over its own stagger window.
 * With `snapControls`, a chevron appears in the title row once the chrome has
 * snapped; activating it reveals every collapsed region and scrolls the page
 * back to the top, which is what expands the chrome again.
 */
@Component({
  selector: 'mlv-page-header',
  imports: [
    NgTemplateOutlet,
    RouterLink,
    LucideChevronLeft,
    LucideChevronUp,
    MlvButton,
    MlvLink,
    MlvLinkBefore,
    MlvPageSnap,
  ],
  templateUrl: './page-header.html',
  styleUrl: './page-header.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-page-header',
    '[class.mlv-page-header--sticky]': 'sticky()',
    '[class.mlv-page-header--size-s]': 'size() === "s"',
    '[class.mlv-page-header--tabs-center]': 'tabsAlign() === "center"',
    '[class.mlv-page-header--scrolled]': '_scrolled()',
  },
})
export class MlvPageHeader {
  /** Optional router destination for the built-in back link. */
  readonly back = input<string | string[] | null>(null);

  /** Accessible and visible text for the built-in back link. */
  readonly backLabel = input('Back');

  /** Makes this header sticky independently of the containing page. */
  readonly sticky = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * Visual scale. `'m'` is the default hero header; `'s'` is the compact
   * single-row variant for record-editor pages, with a smaller title scale.
   */
  readonly size = input<MlvPageHeaderSize>('m');

  /** Aligns the tabs row to the start (default) or centers it. */
  readonly tabsAlign = input<MlvPageHeaderTabsAlign>('start');

  /**
   * Shows the chevron that expands snapped chrome, as a trailing control in
   * the title row. Requires the header to be inside `main[mlvPage]`.
   */
  readonly snapControls = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /** Accessible label for the chevron that expands the snapped chrome. */
  readonly expandLabel = input('Expand header');

  /** Emits when the built-in back link is activated. */
  readonly backClick = output<MouseEvent>();

  /** @protected Breadcrumb template projected via `[mlvPageBreadcrumb]`. */
  protected readonly _breadcrumbRef = contentChild(MlvPageBreadcrumb);

  /** @protected Decorative leading icon projected via `[mlvPageHeaderIcon]`. */
  protected readonly _iconRef = contentChild(MlvPageHeaderIcon);

  /** @protected Page title template projected via `[mlvPageTitle]`. */
  protected readonly _titleRef = contentChild(MlvPageTitle);

  /** @protected Inline status content projected via `[mlvPageHeaderStatus]`. */
  protected readonly _statusRef = contentChild(MlvPageHeaderStatus);

  /** @protected Header actions projected via `[mlvPageHeaderActions]`. */
  protected readonly _actionsRef = contentChild(MlvPageHeaderActions);

  /** @protected Description projected via `[mlvPageHeaderDescription]`. */
  protected readonly _descriptionRef = contentChild(MlvPageHeaderDescription);

  /** @protected Metadata projected via `[mlvPageHeaderMeta]`. */
  protected readonly _metaRef = contentChild(MlvPageHeaderMeta);

  /** @protected Tabs projected via `[mlvPageHeaderTabs]`. */
  protected readonly _tabsRef = contentChild(MlvPageHeaderTabs);

  /** @protected Trailing tabs-row actions projected via `[mlvPageHeaderTabsActions]`. */
  protected readonly _tabsActionsRef = contentChild(MlvPageHeaderTabsActions);

  /** @private Snap controller of the owning page, when rendered inside one. */
  private readonly _snap = inject(MlvPageSnapController, { optional: true });

  /** @protected True while the chrome is closer to snapped than expanded. */
  protected readonly _snapped = computed(() => this._snap?.snapped() ?? false);

  /**
   * @protected The controller behind the expand chevron, exposed only while
   * the chrome is actually snapped: expanding an expanded header does nothing,
   * so the control would be a dead tab stop the rest of the time.
   */
  protected readonly _expandControl = computed(() =>
    this.snapControls() && this._snap && this._snapped() ? this._snap : null,
  );

  /**
   * @protected True while the header sits over content rather than at the head
   * of it. Deliberately the *overlap* signal, not the collapse fraction: chrome
   * pinned at full height still has to paint its separation from the content
   * scrolling underneath it.
   */
  protected readonly _scrolled = computed(
    () => this._snap?.overlapped() ?? false,
  );

  constructor() {
    // The header is the page's block-start chrome. It registers rather than
    // being found by a selector, so a header rendered by an `@if` or wrapped
    // in a `<form>` publishes its geometry like any other. `followsChromeDefault`
    // because `main[mlvPage][stickyHeader]` makes it sticky without its own
    // `sticky` input being set.
    registerPageRegion({
      element: inject<ElementRef<HTMLElement>>(ElementRef).nativeElement,
      edge: 'block-start',
      sticky: this.sticky,
      followsChromeDefault: true,
    });
  }
}
