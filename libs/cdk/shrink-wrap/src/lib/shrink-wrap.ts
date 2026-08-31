import {
  ChangeDetectionStrategy,
  Component,
  Directive,
  ViewEncapsulation,
  input,
} from '@angular/core';

/**
 * Inner measurement wrapper of the `[mlvShrinkWrap]` pair. Wraps its
 * projected content in a `<span>` and, together with its `::before` marker,
 * exposes two named CSS view-timelines (`--mlv-shrink-wrap-host` /
 * `--mlv-shrink-wrap-item`) that encode how much horizontal slack exists
 * between this box's natural (balanced-but-gapped) width and its widest
 * actually-rendered line. `[mlvShrinkWrap]`, applied to an ancestor box,
 * extends those timelines' scope (`timeline-scope`) and consumes them to
 * compute a negative inline correction — see `shrink-wrap.scss` and
 * {@link MlvShrinkWrap} below for the full mechanism.
 *
 * This component holds no TypeScript logic of its own — pure CSS drives the
 * whole effect. It exists only so the marker `::before` and the
 * `view-timeline`-carrying `<span>` land in the DOM at the right position; a
 * CSS-only mechanism cannot inject either into a consumer's own template.
 *
 * ```html
 * <p [mlvShrinkWrap] class="bubble">
 *   <mlv-shrink-wrap>
 *     <span>{{ message }}</span>
 *   </mlv-shrink-wrap>
 * </p>
 * ```
 */
@Component({
  selector: 'mlv-shrink-wrap',
  template: '<span><ng-content /></span>',
  styleUrl: './shrink-wrap.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-shrink-wrap',
  },
})
export class MlvShrinkWrapContent {}

/**
 * Attribute directive that hugs its host's inline size to the widest
 * rendered line of a descendant `<mlv-shrink-wrap>` ({@link MlvShrinkWrapContent}),
 * entirely through CSS scroll-driven animations — no `ResizeObserver`, no
 * `MutationObserver`, no layout measurement of any kind runs in JavaScript.
 *
 * ## The problem
 * `text-wrap: balance` only chooses which words land on which line — it
 * operates *inside* a box whose width the browser already resolved via
 * ordinary shrink-to-fit. A box sized with `width: fit-content` gets handed
 * the full available width whenever the un-balanced text would have wrapped,
 * so a shorter balanced wrap leaves a dead gap on the trailing side that
 * `balance` alone cannot close — by the time it runs, the box's width is no
 * longer negotiable.
 *
 * ## How this pair closes it
 * `<mlv-shrink-wrap>` renders `overflow: hidden` plus a zero-footprint
 * `::before` marker and a wrapping `<span>` around its content, each
 * carrying its own named `view-timeline` (`inline` axis):
 * `--mlv-shrink-wrap-host` on the marker, `--mlv-shrink-wrap-item` on the
 * content span. Two `@property`-registered custom numbers (`inherits: true`,
 * `initial-value: 0`) are driven from `0` to `1` by
 * `animation-timeline`-linked keyframes (`animation-range: entry 100% exit
 * 100%`), so their live values encode how far each element's view has
 * entered the host's own scrollport — i.e. the ratio between the box's
 * natural width and the content's actual rendered width.
 *
 * This directive, applied to an ancestor box, declares
 * `timeline-scope: --mlv-shrink-wrap-host, --mlv-shrink-wrap-item` so its own
 * `animation-timeline` can reference those descendant-declared named
 * timelines, and combines the two live ratios into `--mlv-shrink-wrap` — a
 * `calc()` that resolves to a negative (or zero) length. The
 * `[style.max-inline-size]` host binding below adds that correction to the
 * directive's own max-width input (default `100%`), shrinking the box
 * exactly as far as the widest balanced line allows — never further, never
 * less.
 *
 * ## Graceful degradation
 * Every piece here — `@property`, `timeline-scope`, `view-timeline`, and
 * scroll-driven `animation-timeline` — is currently Chromium-only. In an
 * engine that does not support them, the custom properties never leave their
 * unset/initial state, `var(--mlv-shrink-wrap, 0px)` falls back to `0px`, and
 * the box simply renders at its ordinary balanced-but-gapped width — the
 * exact pre-`mlvShrinkWrap` rendering, not a broken one. No `@supports`
 * guard is needed.
 *
 * The static `mlvShrinkWrap` host attribute below (always present,
 * independent of whether the `mlvShrinkWrap` input is bound) is what the
 * plain CSS attribute selector `[mlvShrinkWrap]` in `shrink-wrap.scss`
 * matches — Angular does not otherwise reflect an attribute-selector
 * directive's own selector onto the DOM.
 *
 * ```html
 * <p [mlvShrinkWrap]="'20rem'" class="bubble">
 *   <mlv-shrink-wrap><span>{{ message }}</span></mlv-shrink-wrap>
 * </p>
 * ```
 *
 */
@Directive({
  selector: '[mlvShrinkWrap]',
  host: {
    mlvShrinkWrap: '',
    '[style.max-inline-size]':
      '`calc(${mlvShrinkWrap() || "100%"} + var(--mlv-shrink-wrap, 0px))`',
  },
})
export class MlvShrinkWrap {
  /**
   * Upper bound the correction is subtracted from — mirrors a plain CSS
   * `max-width`/`max-inline-size` value (e.g. `'20rem'`, `'100%'`). Defaults
   * to `'100%'`, matching ordinary shrink-to-fit sizing when unset.
   */
  readonly mlvShrinkWrap = input('');
}
