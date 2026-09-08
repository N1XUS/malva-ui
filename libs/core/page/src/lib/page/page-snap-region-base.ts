import {
  computed,
  DestroyRef,
  Directive,
  ElementRef,
  inject,
  signal,
} from '@angular/core';
import type { Signal } from '@angular/core';
import { MlvPageSnapController } from './page-snap-controller';
import type {
  MlvPageSnapCoordinator,
  MlvPageSnapRegion,
} from './page-snap-state';

/**
 * Shared focus contract for page chrome that the scroll timeline collapses —
 * `MlvPageSnap` regions and `MlvPageSummary`.
 *
 * A fully collapsed region is `visibility: hidden` so it leaves the
 * accessibility tree and, crucially, the tab order: a control nobody can see
 * must not be an invisible tab stop. The state is driven by **scrolling**
 * though, not by a user action, so hiding it unconditionally would let a
 * scroll blur whatever the user had focused — the browser drops that focus to
 * `<body>`, destroying the user's place in the tab order.
 *
 * Two exceptions therefore lift the hide:
 * - **Focus inside the region** ({@link _revealed}) — the region steps off the
 *   timeline and renders fully expanded for as long as it holds focus. Focus
 *   is never relocated implicitly, and the focused control stays visible.
 * - **`MlvPageSnapController.expand()`** — reveals every registered region up
 *   front (see {@link reveal}) so a consumer can move focus into chrome the
 *   scroll had collapsed.
 *
 * Subclasses supply {@link _elapsed} (their own end-of-window test) and bind
 * {@link _hidden} / {@link _revealed} plus the two focus listeners in their
 * own `host` object — the class names differ per block.
 */
@Directive()
export abstract class MlvPageSnapRegionBase implements MlvPageSnapRegion {
  /**
   * @protected Snap state of the owning page, when rendered inside one.
   * Absent outside `main[mlvPage]`, where nothing collapses.
   */
  protected readonly _snapController: MlvPageSnapCoordinator | null = inject(
    MlvPageSnapController,
    { optional: true },
  );

  /** @private Host element, for the eager reveal and the focus containment test. */
  private readonly _regionHost = inject<ElementRef<HTMLElement>>(ElementRef);

  /** @private True while this region contains the active element. */
  private readonly _focusWithin = signal(false);

  /**
   * @protected True once the timeline has fully elapsed this region's own
   * window — the collapse the exceptions above opt out of.
   */
  protected abstract readonly _elapsed: Signal<boolean>;

  /**
   * @protected Holds the region at its expanded state while it has focus:
   * a focused control has to stay visible, and a region that stays visible
   * cannot have its focus dropped by the next scroll event.
   */
  protected readonly _revealed = computed(() => this._focusWithin());

  /**
   * @protected Takes the collapsed region out of the accessibility tree and
   * the tab order — unless it holds focus, or the controller is revealing it
   * for one.
   */
  protected readonly _hidden = computed(
    () =>
      this._elapsed() &&
      !this._focusWithin() &&
      !(this._snapController?.revealing() ?? false),
  );

  constructor() {
    const unregister = this._snapController?.registerRegion(this);
    inject(DestroyRef).onDestroy(() => unregister?.());
  }

  /**
   * Reveals the region immediately, ahead of the controller's expand tween.
   * Host bindings only flush on the next change detection pass, so the inline
   * hide is cleared eagerly — otherwise a `focus()` issued in the same task
   * would still be refused on a `visibility: hidden` element. The controller's
   * `revealing` flag keeps the binding in agreement until the progress has
   * left this region's window.
   */
  reveal(): void {
    this._regionHost.nativeElement.style.visibility = '';
  }

  /**
   * Re-applies the hidden state after the controller's reveal window closes.
   * A reveal that opens and closes without a render in between leaves the
   * `[style.visibility]` binding holding a value it never rewrote, so the
   * region would stay visible — and its controls would become invisible tab
   * stops — until something else changed.
   */
  syncHiddenState(): void {
    this._regionHost.nativeElement.style.visibility = this._hidden()
      ? 'hidden'
      : '';
  }

  /** @protected Records that focus entered this region. */
  protected _onRegionFocusIn(): void {
    this._focusWithin.set(true);
  }

  /**
   * @protected Releases the focus reveal only when focus actually left the
   * region — moving between two controls inside it also fires `focusout`.
   */
  protected _onRegionFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget;
    this._focusWithin.set(
      next instanceof Node && this._regionHost.nativeElement.contains(next),
    );
  }
}
