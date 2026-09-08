import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  model,
  output,
  ViewEncapsulation,
} from '@angular/core';
import type { MlvOverlayInitialFocus } from '@malva-ui/cdk/overlay';
import type { MlvBreakpoint } from '@malva-ui/cdk/utils';
import type { MlvDrawerPosition } from '@malva-ui/core/drawer';
import {
  MlvBreakpointService,
  MlvRtlService,
  mlvNextId,
} from '@malva-ui/cdk/utils';
import { MlvDrawer, MlvDrawerContent } from '@malva-ui/core/drawer';
import { MlvPageEndPaneContent } from './page-end-pane-content';

/** Which surface `mlv-page-end-pane` is rendering on right now. */
export type MlvPageEndPaneRenderer = 'inline' | 'drawer';

/**
 * Responsive trailing Page pane that renders one content template inline or
 * in a modal Drawer while preserving one logical open and focus lifecycle.
 *
 * **Lifetime contract: crossing the breakpoint recreates the content.** The
 * inline `<aside>` and the Drawer are two different outlets, and the projected
 * template is instantiated into whichever one is live, so a resize past
 * `collapseBelow` destroys one view and builds the other. What survives is the
 * *logical* state this component owns — `opened`, the focus-restore target,
 * the event sequence. What does not survive is anything the view itself holds:
 * a half-typed input, a scroll offset, a component's internal signal, an open
 * popup.
 *
 * That is stated rather than hidden because it is not free to fix: preserving
 * the view means detaching one `ViewRef` and re-inserting it into a container
 * that only exists while the overlay is attached, and then transferring focus
 * across the move. Keep state a resize must survive in the consumer — a form
 * group, a signal on the host component, a store — and read {@link renderer}
 * when the pane needs to know which surface it is on.
 */
@Component({
  selector: 'mlv-page-end-pane',
  imports: [NgTemplateOutlet, MlvDrawer, MlvDrawerContent],
  templateUrl: './page-end-pane.html',
  styleUrl: './page-end-pane.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-page-end-pane',
    'data-slot': 'page-end-pane',
    '[class.mlv-page-end-pane--overlay]': '_compact()',
    '[attr.id]': 'panelId',
    '[style.--mlv-page-end-pane-width]': '_hostWidth()',
  },
})
export class MlvPageEndPane {
  /** Two-way bindable logical open state shared by both renderers. */
  readonly opened = model(false);

  /** Inline pane width and compact Drawer size. */
  readonly width = input('20rem');

  /** Breakpoint below which the pane renders in a modal Drawer. */
  readonly collapseBelow = input<MlvBreakpoint | null>(null);

  /** Accessible name applied to the active aside or dialog surface. */
  readonly ariaLabel = input.required<string>();

  /** Whether a compact Drawer's backdrop click closes the logical pane. */
  readonly closeOnBackdropClick = input<boolean, BooleanInput>(true, {
    transform: coerceBooleanProperty,
  });

  /** Whether Escape closes the logical pane in compact Drawer mode. */
  readonly closeOnEscape = input<boolean, BooleanInput>(true, {
    transform: coerceBooleanProperty,
  });

  /** Initial focus strategy used by the compact Drawer renderer. */
  readonly initialFocus = input<MlvOverlayInitialFocus>('auto');

  /**
   * Emitted once per logical open, **after the active renderer exists** — the
   * inline `<aside>` has rendered, or the Drawer's overlay is attached and has
   * taken its initial focus. It used to fire from the logical-state effect,
   * one render earlier, so a handler that focused something inside the pane
   * was focusing a surface that was not there yet.
   */
  readonly afterOpened = output<void>();

  /** Emitted once after a logical close's active renderer is gone. */
  readonly afterClosed = output<void>();

  /** Stable id referenced by every Page end-pane trigger. */
  readonly panelId = mlvNextId('mlv-page-end-pane');

  /**
   * Which surface the pane is currently rendered on.
   *
   * `'inline'` is the reserved track inside the shell; `'drawer'` is the modal
   * overlay used below `collapseBelow`. A change here is exactly the moment
   * the projected content is recreated — see the lifetime contract above — so
   * a consumer that needs to snapshot something before the swap reads it.
   */
  readonly renderer = computed<MlvPageEndPaneRenderer>(() =>
    this._compact() ? 'drawer' : 'inline',
  );

  /** @protected Single content template shared by both renderers. */
  protected readonly _content = contentChild.required(MlvPageEndPaneContent);

  /** @protected Whether the configured breakpoint currently selects Drawer rendering. */
  protected readonly _compact = computed(() => {
    const breakpoint = this.collapseBelow();
    return breakpoint !== null && this._breakpoints.isDown(breakpoint)();
  });

  /** @protected Width reserved in Page Shell only for an open inline pane. */
  protected readonly _hostWidth = computed(() =>
    this.opened() && !this._compact() ? this.width() : '0px',
  );

  /**
   * @protected Physical viewport edge the compact Drawer opens from.
   *
   * `MlvDrawerPosition` names a **viewport edge**, not a logical side — the
   * drawer's own stylesheet says so, and its overlay strategy anchors to
   * `.left('0')` / `.right('0')`. An end pane is logically at the *end* of the
   * reading direction, so the mapping happens here, against this host's own
   * `[dir]` scope. The alternative would be a direction input on the pane,
   * which would let a consumer set a direction that disagrees with the one
   * their own layout mirrors against.
   */
  protected readonly _drawerPosition = computed<MlvDrawerPosition>(() =>
    this._direction() === 'rtl' ? 'left' : 'right',
  );

  /** @private Shared viewport breakpoint state. */
  private readonly _breakpoints = inject(MlvBreakpointService);

  /** @private Host element; the scope the inline axis is resolved against. */
  private readonly _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  /**
   * @private Direction applying to this host, cached behind the shared `dir`
   * observer rather than re-resolved on every breakpoint change.
   */
  private readonly _direction = inject(MlvRtlService).elementDirection(
    this._elementRef,
  );

  /**
   * @private Owning document. Never the ambient global: under server rendering
   * the two are different objects and the global is defined, so reading
   * `document.activeElement` there silently answers about a document nothing
   * in this application ever rendered into.
   */
  private readonly _document = inject(DOCUMENT);

  /** @private Injector used to finish inline closes after the renderer is removed. */
  private readonly _injector = inject(Injector);

  /** @private Logical state observed during the preceding effect pass. */
  private _previousOpened = false;

  /** @private Element focused immediately before the current logical open. */
  private _restoreTarget: HTMLElement | null = null;

  /** @private Whether a real logical close is waiting for renderer disposal. */
  private _closePending = false;

  /**
   * @private Whether a real logical open is waiting for its renderer.
   *
   * Both renderers signal readiness with an event that also fires when an
   * already-open pane migrates across the breakpoint. A migration is not an
   * open, so the flag — set only on a false-to-true transition and cleared by
   * the first readiness signal — is what separates them.
   */
  private _openPending = false;

  constructor() {
    effect(() => {
      const opened = this.opened();
      if (opened === this._previousOpened) {
        return;
      }

      this._previousOpened = opened;
      if (opened) {
        this._closePending = false;
        // Captured synchronously, before anything moves focus — but the event
        // itself waits for the renderer, which is a different moment.
        this._restoreTarget = this._document
          .activeElement as HTMLElement | null;
        this._openPending = true;
        if (!this._compact()) {
          afterNextRender(() => this._completeOpen(), {
            injector: this._injector,
          });
        }
        return;
      }

      this._openPending = false;
      this._closePending = true;
      if (!this._compact()) {
        this._scheduleInlineCloseCompletion();
      }
    });
  }

  /** Opens the logical pane. */
  open(): void {
    this.opened.set(true);
  }

  /** Closes the logical pane and waits for its active renderer to disappear. */
  close(): void {
    if (!this.opened()) {
      return;
    }
    this._closePending = true;
    this.opened.set(false);
  }

  /** Toggles the logical pane open state. */
  toggle(): void {
    if (this.opened()) {
      this.close();
    } else {
      this.open();
    }
  }

  /** @protected Synchronizes internal Drawer dismissal with the logical model. */
  protected _onDrawerOpenedChange(opened: boolean): void {
    if (!opened && this.opened()) {
      this.close();
    }
  }

  /** @protected Completes a pending logical close after the Drawer is disposed. */
  protected _onDrawerDisposed(): void {
    this._completeClose();
  }

  /** @protected Emits the logical open event once the Drawer's overlay exists. */
  protected _onDrawerOpened(): void {
    this._completeOpen();
  }

  /** @private Emits one open event for a real logical open, never a migration. */
  private _completeOpen(): void {
    if (!this._openPending) {
      return;
    }
    this._openPending = false;
    this.afterOpened.emit();
  }

  /** @private Defers inline completion until Angular removes the aside view. */
  private _scheduleInlineCloseCompletion(): void {
    afterNextRender(() => this._completeClose(), {
      injector: this._injector,
    });
  }

  /** @private Restores focus and emits one close event for a real logical close. */
  private _completeClose(): void {
    if (!this._closePending) {
      return;
    }

    this._closePending = false;
    const restoreTarget = this._restoreTarget;
    this._restoreTarget = null;
    if (restoreTarget?.isConnected) {
      restoreTarget.focus();
    }
    this.afterClosed.emit();
  }
}
