import { InjectionToken, type Signal } from '@angular/core';

/**
 * Scroll state of the owning page's scroll container, exposed to descendants
 * such as `mlv-page-header` and `mlv-page-summary` for scroll-linked
 * behaviour (sticky snap shadows, auto-collapsing summary strips).
 */
export interface MlvPageScrollState {
  /** Current vertical scroll offset of the page scroll owner, in pixels. */
  readonly scrollTop: Signal<number>;

  /** True once the page has scrolled past a small hysteresis threshold. */
  readonly scrolled: Signal<boolean>;
}

/**
 * Injection token provided by `main[mlvPage]` so descendants can react to the
 * page's scroll position without knowing which element owns scrolling.
 * Inject optionally — components keep working outside a page, just without
 * scroll-linked behaviour.
 */
export const MLV_PAGE_SCROLL = new InjectionToken<MlvPageScrollState>(
  'MLV_PAGE_SCROLL',
);
