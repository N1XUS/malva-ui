import { NgTemplateOutlet } from '@angular/common';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  effect,
  inject,
  Injector,
  input,
  model,
  output,
  ViewEncapsulation,
} from '@angular/core';
import type { MlvOverlayInitialFocus } from '@malva-ui/cdk/overlay';
import type { MlvBreakpoint } from '@malva-ui/cdk/utils';
import { MlvBreakpointService, mlvNextId } from '@malva-ui/cdk/utils';
import { MlvDrawer, MlvDrawerContent } from '@malva-ui/core/drawer';
import { MlvPageEndPaneContent } from './page-end-pane-content';

/**
 * Responsive trailing Page pane that renders one content template inline or
 * in a modal Drawer while preserving one logical open and focus lifecycle.
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

  /** Emitted once for each logical false-to-true open transition. */
  readonly afterOpened = output<void>();

  /** Emitted once after a logical close's active renderer is gone. */
  readonly afterClosed = output<void>();

  /** Stable id referenced by every Page end-pane trigger. */
  readonly panelId = mlvNextId('mlv-page-end-pane');

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

  /** @private Shared viewport breakpoint state. */
  private readonly _breakpoints = inject(MlvBreakpointService);

  /** @private Injector used to finish inline closes after the renderer is removed. */
  private readonly _injector = inject(Injector);

  /** @private Logical state observed during the preceding effect pass. */
  private _previousOpened = false;

  /** @private Element focused immediately before the current logical open. */
  private _restoreTarget: HTMLElement | null = null;

  /** @private Whether a real logical close is waiting for renderer disposal. */
  private _closePending = false;

  constructor() {
    effect(() => {
      const opened = this.opened();
      if (opened === this._previousOpened) {
        return;
      }

      this._previousOpened = opened;
      if (opened) {
        this._closePending = false;
        this._restoreTarget = document.activeElement as HTMLElement | null;
        this.afterOpened.emit();
        return;
      }

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
