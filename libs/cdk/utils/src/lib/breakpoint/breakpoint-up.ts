import {
  computed,
  Directive,
  effect,
  type EmbeddedViewRef,
  inject,
  input,
  TemplateRef,
  ViewContainerRef,
} from '@angular/core';
import { BREAKPOINT_ORDER, type MlvBreakpoint } from './breakpoint.config';
import { MlvBreakpointService } from './breakpoint.service';

/**
 * Structural directive that renders its template when the viewport
 * is at or above the given breakpoint.
 *
 * Content is created/destroyed — not hidden via CSS.
 *
 * @example
 * <mlv-sidebar *mlvBreakpointUp="'md'" />
 */
@Directive({ selector: '[mlvBreakpointUp]' })
export class MlvBreakpointUp {
  /** The minimum breakpoint at which to render the content. */
  readonly mlvBreakpointUp = input.required<MlvBreakpoint>();

  /** @private Template reference to stamp. */
  private readonly _templateRef = inject(TemplateRef);
  /** @private View container for creating/clearing views. */
  private readonly _vcr = inject(ViewContainerRef);
  /** @private Breakpoint service for current viewport state. */
  private readonly _bp = inject(MlvBreakpointService);
  /** @private Reference to the currently rendered embedded view, if any. */
  private _viewRef: EmbeddedViewRef<void> | null = null;

  constructor() {
    const shouldRender = computed(() => {
      const current = BREAKPOINT_ORDER.indexOf(this._bp.breakpoint());
      const target = BREAKPOINT_ORDER.indexOf(this.mlvBreakpointUp());
      return current >= target;
    });

    effect(() => {
      if (shouldRender()) {
        if (!this._viewRef) {
          this._viewRef = this._vcr.createEmbeddedView(this._templateRef);
        }
      } else if (this._viewRef) {
        this._vcr.clear();
        this._viewRef = null;
      }
    });
  }
}
