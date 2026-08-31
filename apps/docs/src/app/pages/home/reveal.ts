import {
  DestroyRef,
  Directive,
  ElementRef,
  inject,
  input,
  numberAttribute,
  signal,
} from '@angular/core';

/**
 * Scroll-reveal helper for the landing page. Fades and rises the host into
 * view the first time it enters the viewport, honouring
 * `prefers-reduced-motion` by revealing instantly without any animation.
 *
 * The directive drives inline styles instead of stylesheet classes so it can
 * be reused across the home page and its child components regardless of view
 * encapsulation.
 */
@Directive({
  selector: '[docsReveal]',
  host: {
    '[style.opacity]': '_hidden() ? 0 : 1',
    '[style.transform]': '_hidden() ? "translateY(1.25rem)" : "none"',
    '[style.transition]': '_transition()',
    '[style.transition-delay.ms]': 'docsRevealDelay()',
  },
})
export class DocsReveal {
  /** Extra transition delay in milliseconds, for staggering sibling reveals. */
  readonly docsRevealDelay = input(0, { transform: numberAttribute });

  /** @private True when reveal styling should keep the host hidden. */
  protected readonly _hidden = signal(false);

  /** @private Transition applied only while animating into view. */
  protected readonly _transition = signal('none');

  /** @private Host element observed for viewport intersection. */
  private readonly _elementRef = inject(ElementRef<HTMLElement>);

  /** @private Cleans up the IntersectionObserver on destroy. */
  private readonly _destroyRef = inject(DestroyRef);

  constructor() {
    const canAnimate =
      typeof IntersectionObserver !== 'undefined' &&
      typeof matchMedia !== 'undefined' &&
      !matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!canAnimate) {
      return;
    }

    this._hidden.set(true);
    this._transition.set(
      'opacity 640ms var(--mlv-ease-out-strong), transform 640ms var(--mlv-ease-out-strong)',
    );

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          this._hidden.set(false);
          observer.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    );
    observer.observe(this._elementRef.nativeElement);
    this._destroyRef.onDestroy(() => observer.disconnect());
  }
}
