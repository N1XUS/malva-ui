import { Directive, input } from '@angular/core';

/**
 * Canvas widths at which a page region is withheld.
 *
 * Resolved by a container query in the components layer, never by a signal: a
 * breakpoint read in TypeScript needs a listener, re-renders the region on
 * every resize, and has no answer at all on the server. An attribute a
 * stylesheet reads has none of those problems, which is why Primer moved to
 * exactly this form — and is deprecating the JavaScript one it shipped first.
 */
export type MlvPageRegionHide = 'narrow' | 'wide' | null;

/**
 * Shared base for the projected element regions of the page chrome — header
 * regions and dock regions alike.
 *
 * It carries exactly one thing, because responsive withholding is the only
 * behaviour every region shares. Everything else a region needs it declares
 * for itself, which is the point of regions being classes rather than named
 * slots on a parent: a new behaviour is a new default on one region instead of
 * a new input on the component that hosts it, and a header with nine slots
 * does not grow to nine inputs times as many knobs.
 */
@Directive({
  host: {
    '[attr.data-hide-on]': 'hideOn()',
  },
})
export abstract class MlvPageChromeRegion {
  /**
   * Withholds this region on a narrow page canvas (`'narrow'`) or on a wide
   * one (`'wide'`). Serialised onto the host as `data-hide-on` and resolved by
   * one container query in `page.scss`, so it costs no change detection, needs
   * no resize listener, and renders correctly on the server.
   *
   * The width it is measured against is the **page canvas**, not the viewport,
   * and the region is only withheld inside `main[mlvPage]` — outside a page
   * there is no canvas to be narrow.
   */
  readonly hideOn = input<MlvPageRegionHide>(null);
}
