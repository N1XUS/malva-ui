import {
  DestroyRef,
  Directive,
  type EmbeddedViewRef,
  Renderer2,
  TemplateRef,
  ViewContainerRef,
  effect,
  inject,
  input,
} from '@angular/core';

/**
 * Structural directive that plays enter/leave animations on conditionally
 * rendered content, solving the Angular limitation where `@if` destroys
 * the DOM immediately — cutting off leave animations.
 *
 * The leave animation completes before the DOM node is removed.
 * Respects `prefers-reduced-motion`: when the OS reduces motion,
 * no animation fires and the element appears/disappears immediately.
 *
 * @example
 * ```html
 * <!-- Default fade+scale animations -->
 * <div *mlvAnimatedPresence="isVisible()" class="my-card">
 *   Card content
 * </div>
 *
 * <!-- Custom animation classes from @malva-ui/styles -->
 * <div *mlvAnimatedPresence="isOpen();
 *       enterClass: 'mlv-popup--enter'; leaveClass: 'mlv-popup--leave'">
 *   Popup content
 * </div>
 * ```
 */
@Directive({
  selector: '[mlvAnimatedPresence]',
})
export class MlvAnimatedPresence {
  /**
   * The condition controlling whether the content is rendered.
   * When truthy, the content mounts with the enter animation.
   * When falsy, the leave animation plays before the content is removed.
   */
  readonly mlvAnimatedPresence = input<unknown>(null);

  /**
   * CSS class applied to the root element on mount.
   * Should reference a `@keyframes`-backed class from `@malva-ui/styles`.
   * Defaults to `'mlv-presence--enter'`.
   */
  readonly mlvAnimatedPresenceEnterClass = input<string>('mlv-presence--enter');

  /**
   * CSS class applied to the root element on unmount.
   * Should reference a `@keyframes`-backed class from `@malva-ui/styles`.
   * Defaults to `'mlv-presence--leave'`.
   */
  readonly mlvAnimatedPresenceLeaveClass = input<string>('mlv-presence--leave');

  /** @private TemplateRef for the content to conditionally render. */
  private readonly _templateRef = inject(TemplateRef);
  /** @private ViewContainerRef for creating/destroying the embedded view. */
  private readonly _vcr = inject(ViewContainerRef);
  /** @private Renderer2 for safe class manipulation. */
  private readonly _renderer = inject(Renderer2);
  /** @private DestroyRef for immediate cleanup on directive destroy. */
  private readonly _destroyRef = inject(DestroyRef);

  /** @private Currently rendered embedded view, or null when unmounted. */
  private _viewRef: EmbeddedViewRef<unknown> | null = null;
  /** @private Whether a leave animation is currently in progress. */
  private _leavePending = false;
  /** @private Cancels the current leave listener and removes the leave class. */
  private _cancelLeaveCleanup: (() => void) | null = null;

  constructor() {
    effect(() => {
      const show = this.mlvAnimatedPresence();
      const enterClass = this.mlvAnimatedPresenceEnterClass();
      const leaveClass = this.mlvAnimatedPresenceLeaveClass();

      if (show) {
        this._enter(enterClass, leaveClass);
      } else {
        this._leave(leaveClass);
      }
    });

    this._destroyRef.onDestroy(() => this._forceDestroy());
  }

  /** @private Mount the template and play the enter animation. */
  private _enter(enterClass: string, leaveClass: string): void {
    if (this._leavePending) {
      // Intercept mid-leave: remove the leave class and keep the existing view.
      this._abortLeave(leaveClass);
      const el = this._rootElement();
      if (el) this._playEnter(el, enterClass);
      return;
    }

    if (this._viewRef) return; // Already mounted.

    this._viewRef = this._vcr.createEmbeddedView(this._templateRef);
    this._viewRef.detectChanges();

    const el = this._rootElement();
    if (el) this._playEnter(el, enterClass);
  }

  /**
   * @private Apply the enter CSS class and remove it when the animation ends.
   * Falls back to immediate removal when no `@keyframes` match (e.g. reduced-motion).
   */
  private _playEnter(el: HTMLElement, enterClass: string): void {
    this._renderer.addClass(el, enterClass);

    requestAnimationFrame(() => {
      if (!this._viewRef) return;
      const animName = getComputedStyle(el).animationName;
      if (!animName || animName === 'none') {
        this._renderer.removeClass(el, enterClass);
      } else {
        // Target-guarded (#231): `animationend` bubbles, so projected content
        // finishing its own finite animation mid-enter would otherwise strip
        // the enter class and cut the root's enter short. Only the root's own
        // keyframes may clear it.
        const onEnterEnd = (event: Event) => {
          if (event.target !== el) return;
          el.removeEventListener('animationend', onEnterEnd);
          this._renderer.removeClass(el, enterClass);
        };
        // Kept raw (issue #76 triage): one listener per enter animation, so
        // the lifetime is the animation's, not the directive's —
        // `takeUntilDestroyed` fires only at destroy and would retain every
        // earlier generation. Not `once: true`: an ignored descendant event
        // would spend it and latch the enter class. The handler removes itself
        // on the root's own event instead, and the element is dropped with the
        // embedded view regardless.
        el.addEventListener('animationend', onEnterEnd);
      }
    });
  }

  /** @private Play the leave animation and destroy the view when it ends. */
  private _leave(leaveClass: string): void {
    if (!this._viewRef || this._leavePending) return;

    const el = this._rootElement();
    if (!el) {
      this._destroyView();
      return;
    }

    this._leavePending = true;
    this._renderer.addClass(el, leaveClass);

    const destroy = () => {
      this._cancelLeaveCleanup = null;
      this._leavePending = false;
      this._renderer.removeClass(el, leaveClass);
      this._destroyView();
    };

    requestAnimationFrame(() => {
      if (!this._leavePending) return; // Cancelled before rAF fired.

      const animName = getComputedStyle(el).animationName;
      if (!animName || animName === 'none') {
        // No animation running (reduced-motion or class has no @keyframes).
        destroy();
      } else {
        // Target-guarded (#231): a descendant's finite animation ending inside
        // the leave window would otherwise destroy the view mid-leave. The
        // listener is removed on the root's own event whether or not the leave
        // is still pending, so a generation orphaned by a double rAF drains
        // there too.
        const onEnd = (event: Event) => {
          if (event.target !== el) return;
          el.removeEventListener('animationend', onEnd);
          if (this._leavePending) destroy();
        };
        // Kept raw (issue #76 triage): same per-animation lifetime as the
        // enter listener above, plus this one must be revocable at a specific
        // moment — `_cancelLeaveCleanup` detaches it when an enter interrupts
        // the leave mid-flight or the directive is destroyed. Not `once: true`,
        // for the same reason as the enter listener: an ignored descendant
        // event would spend it and strand the leave.
        //
        // There is no fallback timer: a leave whose own `animationend` never
        // arrives (a throttled background tab, an ancestor's `display: none`
        // cancelling the animation) keeps the view mounted — tracked in #278.
        el.addEventListener('animationend', onEnd);
        this._cancelLeaveCleanup = () => {
          el.removeEventListener('animationend', onEnd);
          this._renderer.removeClass(el, leaveClass);
          this._leavePending = false;
          this._cancelLeaveCleanup = null;
        };
      }
    });
  }

  /**
   * @private Cancel an in-progress leave: remove the leave class and
   * prevent the deferred destroy from firing.
   */
  private _abortLeave(leaveClass: string): void {
    if (this._cancelLeaveCleanup) {
      this._cancelLeaveCleanup();
    } else if (this._leavePending) {
      // rAF hasn't fired yet — clear the flag so it no-ops.
      this._leavePending = false;
      const el = this._rootElement();
      if (el) this._renderer.removeClass(el, leaveClass);
    }
  }

  /**
   * @private Immediately destroy the view without animations.
   * Called by DestroyRef when the directive itself is torn down.
   */
  private _forceDestroy(): void {
    this._cancelLeaveCleanup?.();
    this._cancelLeaveCleanup = null;
    this._leavePending = false;
    this._destroyView();
  }

  /** @private Return the first element node of the current embedded view. */
  private _rootElement(): HTMLElement | null {
    if (!this._viewRef) return null;
    return (
      ((this._viewRef.rootNodes as Node[]).find(
        (n) => n.nodeType === Node.ELEMENT_NODE,
      ) as HTMLElement | undefined) ?? null
    );
  }

  /** @private Clear the view container and null the reference. */
  private _destroyView(): void {
    if (this._viewRef) {
      this._vcr.clear();
      this._viewRef = null;
    }
  }
}
