import {
  ChangeDetectionStrategy,
  Component,
  input,
  ViewEncapsulation,
} from '@angular/core';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';

/** Visual shape variant of the skeleton loader. */
export type MlvSkeletonVariant = 'text' | 'circle' | 'rectangle';

/**
 * Skeleton loader component (`mlv-skeleton`) used as a placeholder while content is loading.
 *
 * Renders a pulsing placeholder that communicates the shape of the incoming content.
 * Width and height are bound directly on the host element via `[style.width]` and
 * `[style.height]`. The component is always `aria-hidden="true"` — it carries no
 * semantic meaning for assistive technology.
 *
 * @example
 * ```html
 * <!-- Default rectangle -->
 * <mlv-skeleton />
 *
 * <!-- Circle avatar placeholder -->
 * <mlv-skeleton variant="circle" width="2.5rem" height="2.5rem" />
 *
 * <!-- Text line placeholder -->
 * <mlv-skeleton variant="text" width="60%" />
 * ```
 */
@Component({
  selector: 'mlv-skeleton',
  template: '',
  styleUrl: './skeleton.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-skeleton',
    '[class.mlv-skeleton--text]': 'variant() === "text"',
    '[class.mlv-skeleton--circle]': 'variant() === "circle"',
    '[class.mlv-skeleton--rectangle]': 'variant() === "rectangle"',
    '[class.mlv-skeleton--animated]': 'animated()',
    'aria-hidden': 'true',
    '[style.width]': 'width()',
    '[style.height]': 'height()',
    '[style.--mlv-skeleton-duration]': 'animationDuration()',
  },
})
export class MlvSkeleton {
  /**
   * Visual shape variant of the skeleton.
   * - `'rectangle'` (default) — rectangular block
   * - `'text'` — short rounded pill mimicking a line of text
   * - `'circle'` — fully rounded circle for avatar/icon placeholders
   */
  readonly variant = input<MlvSkeletonVariant>('rectangle');

  /**
   * CSS width applied to the host element.
   * Accepts any valid CSS width value (e.g. `'100%'`, `'12rem'`, `'200px'`).
   * Defaults to `'100%'`.
   */
  readonly width = input<string>('100%');

  /**
   * CSS height applied to the host element.
   * Accepts any valid CSS height value (e.g. `'1rem'`, `'48px'`).
   * Defaults to `'1rem'`.
   */
  readonly height = input<string>('1rem');

  /**
   * Whether the pulsing animation is active.
   * Set to `false` to render a static placeholder (e.g. for reduced-motion or loading states
   * that should not draw attention). Defaults to `true`.
   */
  readonly animated = input<boolean, BooleanInput>(true, {
    transform: coerceBooleanProperty,
  });

  /**
   * CSS duration for the shimmer animation (e.g. `'1s'`, `'0.8s'`, `'2s'`).
   * Passed as the `--mlv-skeleton-duration` CSS custom property on the host, which
   * controls the `animation-duration` of the shimmer keyframe.
   * Defaults to `'2s'` for a slow, professional feel.
   */
  readonly animationDuration = input<string>('2s');
}
