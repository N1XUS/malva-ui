import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  ViewEncapsulation,
  computed,
  contentChild,
  inject,
  input,
  signal,
} from '@angular/core';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MlvResizeObserverService } from '@malva-ui/cdk/utils';
import { MlvPageAside } from './page-aside';

/** Spacing between the main page column and its complementary aside. */
export type MlvPageContentGap = 's' | 'm' | 'l';

/** Responsive main-content and complementary-aside grid. */
@Component({
  selector: 'mlv-page-content',
  templateUrl: './page-content.html',
  styleUrl: './page-content.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-page-content',
    'data-slot': 'page-content',
    '[class.mlv-page-content--aside-sticky]': 'asideSticky()',
    '[class.mlv-page-content--gap-s]': 'gap() === "s"',
    '[class.mlv-page-content--gap-m]': 'gap() === "m"',
    '[class.mlv-page-content--gap-l]': 'gap() === "l"',
    '[class.mlv-page-content--stacked]': '_stacked()',
    '[class.mlv-page-content--has-aside]': '_hasAside()',
    '[style.--mlv-page-aside-width]': 'asideWidth()',
  },
})
export class MlvPageContent {
  /** Preferred width of the complementary column while rendered inline. */
  readonly asideWidth = input('20rem');

  /** Keeps the complementary column visible while the page scrolls. */
  readonly asideSticky = input<boolean, BooleanInput>(true, {
    transform: coerceBooleanProperty,
  });

  /** Selects the spacing between the main and complementary columns. */
  readonly gap = input<MlvPageContentGap>('m');

  /** Container width in CSS pixels below which the columns stack. */
  readonly stackBelow = input(1024);

  /** @private The projected complementary column, if the consumer wrote one. */
  private readonly _asideRef = contentChild(MlvPageAside);

  /**
   * @protected Whether complementary content is actually projected.
   *
   * A real content query, not a `:has()` and not an opt-in input: the grid
   * reserves the aside track only while this is `true`, so a consumer without
   * an aside keeps the whole inline size for its main column instead of
   * silently losing `asideWidth` to an empty track.
   */
  protected readonly _hasAside = computed(() => !!this._asideRef());

  /** @private Host element observed so responsiveness follows available content width. */
  private readonly _elementRef = inject(ElementRef<HTMLElement>);

  /** @private Shared observer used to measure the page-content container. */
  private readonly _resizeObserver = inject(MlvResizeObserverService);

  /** @private Destroy scope for the resize-observer subscription. */
  private readonly _destroyRef = inject(DestroyRef);

  /** @private Latest measured inline size in CSS pixels. */
  private readonly _containerWidth = signal(0);

  /** @protected Whether the current container is narrower than `stackBelow`. */
  protected readonly _stacked = computed(() => {
    const width = this._containerWidth();
    return width > 0 && width < this.stackBelow();
  });

  constructor() {
    this._resizeObserver
      .observe(this._elementRef)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe((entries) => {
        const width = entries[entries.length - 1]?.contentRect.width;
        if (width !== undefined) this._containerWidth.set(width);
      });
  }
}
