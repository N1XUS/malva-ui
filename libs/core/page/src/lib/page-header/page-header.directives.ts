import { Directive } from '@angular/core';
import { MlvStructural } from '@malva-ui/cdk/utils';
import { MlvPageChromeRegion } from '../page/page-region';
import { MLV_PAGE_SNAP_WINDOW, MlvPageSnap } from '../page/page-snap.directive';

/**
 * Leading context above the page title: a breadcrumb, a back link, an icon, or
 * any combination of them.
 *
 * One region covers all three affordances the header used to stack separately.
 * It also replaces the header's built-in back link, which forwarded a
 * restricted destination to a router link *and* emitted a click — conflating
 * "navigate to this destination" with "go back" — and made every consumer of
 * the header pull in `@angular/router` for a link most of them never rendered.
 *
 * ```html
 * <nav mlvBreadcrumb mlvPageContext [items]="crumbs"></nav>
 * ```
 */
@Directive({
  selector: '[mlvPageContext]',
  host: { class: 'mlv-page-header__context', 'data-slot': 'page-context' },
})
export class MlvPageContext extends MlvPageChromeRegion {}

/**
 * The page title. **The one template in the header family**, and for the same
 * structural reason the end pane keeps one: it is rendered into two mutually
 * exclusive nodes.
 *
 * The header renders the title twice, at two complete type roles, and
 * crossfades between them as the chrome collapses — which is what keeps each
 * role's own weight and tracking instead of interpolating a font size. A
 * projected element is one DOM node and can only land in one place, so the
 * title cannot be an element without either giving up the crossfade or
 * interpolating type again. Consumers project exactly one semantic `<h1>`.
 */
@Directive({ selector: '[mlvPageTitle]' })
export class MlvPageTitle extends MlvStructural {}

/**
 * Inline status rendered directly after the page title — a draft/live badge,
 * an unsaved-changes indicator.
 */
@Directive({
  selector: '[mlvPageStatus]',
  host: { class: 'mlv-page-header__status', 'data-slot': 'page-status' },
})
export class MlvPageStatus extends MlvPageChromeRegion {}

/** Primary actions rendered at the trailing edge of the title row. */
@Directive({
  selector: '[mlvPageActions]',
  host: { class: 'mlv-page-header__actions', 'data-slot': 'page-actions' },
})
export class MlvPageActions extends MlvPageChromeRegion {}

/**
 * Supporting description below the title row. Collapses with the title block
 * as the page scrolls, over the first three fifths of the timeline.
 */
@Directive({
  selector: '[mlvPageDescription]',
  hostDirectives: [MlvPageSnap],
  providers: [
    { provide: MLV_PAGE_SNAP_WINDOW, useValue: { from: 0, to: 0.6 } },
  ],
  host: {
    class: 'mlv-page-header__description',
    'data-slot': 'page-description',
  },
})
export class MlvPageDescription extends MlvPageChromeRegion {}

/**
 * Page metadata — ownership, visibility, last-updated time. Collapses with the
 * title block, a beat behind the description so the two read as one motion.
 */
@Directive({
  selector: '[mlvPageMeta]',
  hostDirectives: [MlvPageSnap],
  providers: [
    { provide: MLV_PAGE_SNAP_WINDOW, useValue: { from: 0.15, to: 0.75 } },
  ],
  host: { class: 'mlv-page-header__meta', 'data-slot': 'page-meta' },
})
export class MlvPageMeta extends MlvPageChromeRegion {}

/**
 * The navigation row at the bottom of the header. **Never collapses** — it is
 * the thing a reader needs most once scrolled.
 *
 * It is one region, not a tab strip plus a trailing action slot: the region is
 * a flex row, so a projected tab group takes the free inline size and anything
 * after it sits at the trailing edge.
 */
@Directive({
  selector: '[mlvPageTabs]',
  host: { class: 'mlv-page-header__tabs', 'data-slot': 'page-tabs' },
})
export class MlvPageTabs extends MlvPageChromeRegion {}
