import {
  type AfterContentInit,
  ChangeDetectionStrategy,
  Component,
  contentChildren,
  DestroyRef,
  ElementRef,
  inject,
  input,
  NgZone,
  Renderer2,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter, finalize, fromEvent, map, switchMap, takeUntil } from 'rxjs';
import {
  LEFT_ARROW,
  RIGHT_ARROW,
  UP_ARROW,
  DOWN_ARROW,
} from '@angular/cdk/keycodes';
import {
  MlvRtlService,
  clamp,
  mlvPointerGestureEnd,
} from '@malva-ui/cdk/utils';
import type { MlvSplitPaneOrientation } from './split-pane.types';
import { MlvSplitPanePanel } from './split-pane-panel';

/**
 * Split pane container that divides space into two or more resizable panels.
 *
 * Panels are declared as `<mlv-split-pane-panel>` children. The component
 * automatically inserts a drag handle between each adjacent pair. Sizes are
 * managed via CSS `grid-template-columns` (horizontal) or
 * `grid-template-rows` (vertical), ensuring the DOM always reflects the true
 * rendered widths/heights.
 *
 * @example Basic 2-panel
 * ```html
 * <mlv-split-pane style="height: 300px;">
 *   <mlv-split-pane-panel [size]="30">Sidebar</mlv-split-pane-panel>
 *   <mlv-split-pane-panel>Main</mlv-split-pane-panel>
 * </mlv-split-pane>
 * ```
 *
 * @example 3-panel
 * ```html
 * <mlv-split-pane style="height: 300px;">
 *   <mlv-split-pane-panel [size]="20">Nav</mlv-split-pane-panel>
 *   <mlv-split-pane-panel>Editor</mlv-split-pane-panel>
 *   <mlv-split-pane-panel [size]="25">Properties</mlv-split-pane-panel>
 * </mlv-split-pane>
 * ```
 */
@Component({
  selector: 'mlv-split-pane',
  template: `<ng-content />`,
  styleUrl: './split-pane.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-split-pane',
    '[class.mlv-split-pane--horizontal]': 'orientation() === "horizontal"',
    '[class.mlv-split-pane--vertical]': 'orientation() === "vertical"',
    '[class.mlv-split-pane--dragging]': '_isDragging()',
  },
})
export class MlvSplitPane implements AfterContentInit {
  /**
   * Orientation of the split. `'horizontal'` places panels side-by-side;
   * `'vertical'` stacks them top to bottom.
   */
  readonly orientation = input<MlvSplitPaneOrientation>('horizontal');

  /** @protected Whether a drag is currently in progress. Drives the `--dragging` modifier class. */
  protected readonly _isDragging = signal(false);

  /** @private Queried panel children. */
  private readonly _panels = contentChildren(MlvSplitPanePanel);

  /** @private Current sizes of each panel in `fr` units (≈ percentage). */
  private readonly _sizes = signal<number[]>([]);

  /**
   * @private Latest sizes produced during an active pointer drag. The drag
   * stream runs outside Angular and mutates the grid template imperatively; this
   * buffer holds the running value so it can be committed to the `_sizes` signal
   * exactly once, when the gesture ends (`pointerup`, `pointercancel`, lost
   * capture or destroy), inside the zone.
   */
  private _dragSizes: number[] | null = null;

  /** @private The inserted drag-handle elements, indexed by the pair they split. */
  private readonly _handles: HTMLElement[] = [];

  /**
   * @private Host element. Both direction-aware halves of this component — the
   * drag geometry and the handle's arrow-key stepping — resolve against it, so
   * they can never disagree about which direction applies.
   */
  private readonly _elementRef = inject(ElementRef<HTMLElement>);

  /** @private Angular Renderer2 for all DOM mutations. */
  private readonly _renderer = inject(Renderer2);

  /**
   * @private The document whose root element carries the page-wide resize
   * cursor and `user-select: none` while a handle is dragged. Injected rather
   * than the ambient global, which under server rendering is a different,
   * process-wide object.
   */
  private readonly _document = inject(DOCUMENT);

  /** @private DestroyRef for observable cleanup. */
  private readonly _destroyRef = inject(DestroyRef);

  /** @private Angular zone — the drag stream runs outside it to avoid a change-detection pass per pointermove. */
  private readonly _ngZone = inject(NgZone);
  private readonly _rtlService = inject(MlvRtlService);

  /**
   * @private Effective direction of this split pane, tracking the global
   * direction and any `[dir]` scope above the host. Mirrors drag geometry:
   * panel[0] is the inline-first panel, which sits on the right in RTL.
   */
  private readonly _direction = this._rtlService.elementDirection(
    this._elementRef,
  );

  ngAfterContentInit(): void {
    const panels = this._panels();
    if (panels.length < 2) return;

    const sizes = this._computeInitialSizes(panels);
    this._sizes.set(sizes);
    this._applyGridTemplate(sizes);

    // Insert a drag handle between each adjacent pair of panels.
    panels.forEach((panel, i) => {
      if (i >= panels.length - 1) return;
      const handle = this._createHandle(i);
      this._handles[i] = handle;
      this._renderer.insertBefore(
        this._elementRef.nativeElement,
        handle,
        panel._elementRef.nativeElement.nextSibling,
      );
      this._initDragForHandle(handle, i);
    });

    // Handles exist now — publish their initial ARIA window-splitter values.
    this._updateHandleAria(sizes);
  }

  /**
   * @private Calculates the initial size for each panel.
   * Panels with an explicit `size` input use that value.
   * Panels without one share the remaining percentage equally.
   */
  private _computeInitialSizes(panels: readonly MlvSplitPanePanel[]): number[] {
    const explicit = panels.map((p) => p.size());
    const fixedTotal = explicit.reduce<number>((sum, s) => sum + (s ?? 0), 0);
    const autoCount = explicit.filter((s) => s === undefined).length;
    const autoSize = autoCount > 0 ? (100 - fixedTotal) / autoCount : 0;
    return explicit.map((s) => s ?? autoSize);
  }

  /**
   * @private Updates `grid-template-columns` (horizontal) or `grid-template-rows`
   * (vertical) so each panel occupies its current `fr` share. Handles always
   * occupy a fixed `0.125rem` track, so they never eat into panel space.
   */
  private _applyGridTemplate(sizes: number[]): void {
    const isHorizontal = this.orientation() === 'horizontal';
    const tracks: string[] = [];
    sizes.forEach((size, i) => {
      tracks.push(`${size}fr`);
      if (i < sizes.length - 1) tracks.push('0.125rem');
    });
    const prop = isHorizontal ? 'grid-template-columns' : 'grid-template-rows';
    this._renderer.setStyle(
      this._elementRef.nativeElement,
      prop,
      tracks.join(' '),
    );
    // Keep each separator's ARIA value in sync with the rendered sizes.
    this._updateHandleAria(sizes);
  }

  /**
   * @private Syncs the ARIA window-splitter values on every drag handle.
   * A focusable `role="separator"` is a window splitter and therefore requires
   * `aria-valuenow` (with `aria-valuemin`/`aria-valuemax`). `aria-valuenow`
   * tracks the leading panel's size (%), bounded by the two adjacent panels'
   * `minSize` values.
   */
  private _updateHandleAria(sizes: number[]): void {
    const panels = this._panels();
    this._handles.forEach((handle, i) => {
      if (!handle) return;
      const leadMin = panels[i]?.minSize() ?? 0;
      const trailMin = panels[i + 1]?.minSize() ?? 0;
      this._renderer.setAttribute(
        handle,
        'aria-valuenow',
        String(Math.round(sizes[i] ?? 0)),
      );
      this._renderer.setAttribute(
        handle,
        'aria-valuemin',
        String(Math.round(leadMin)),
      );
      this._renderer.setAttribute(
        handle,
        'aria-valuemax',
        String(Math.round(100 - trailMin)),
      );
    });
  }

  /**
   * @private Creates and returns a drag handle DOM element for the given handle index.
   * The grip visual is drawn entirely with CSS — no Angular directives required.
   */
  private _createHandle(handleIndex: number): HTMLElement {
    const isHorizontal = this.orientation() === 'horizontal';
    const handle = this._renderer.createElement('div') as HTMLElement;
    this._renderer.addClass(handle, 'mlv-split-pane__handle');
    this._renderer.setAttribute(handle, 'role', 'separator');
    this._renderer.setAttribute(handle, 'tabindex', '0');
    this._renderer.setAttribute(
      handle,
      'aria-label',
      isHorizontal ? 'Resize panels horizontally' : 'Resize panels vertically',
    );
    this._renderer.setAttribute(
      handle,
      'aria-orientation',
      isHorizontal ? 'vertical' : 'horizontal',
    );

    const grip = this._renderer.createElement('span') as HTMLElement;
    this._renderer.addClass(grip, 'mlv-split-pane__handle-grip');
    this._renderer.addClass(
      grip,
      isHorizontal
        ? 'mlv-split-pane__handle-grip--vertical'
        : 'mlv-split-pane__handle-grip--horizontal',
    );
    this._renderer.setAttribute(grip, 'aria-hidden', 'true');
    this._renderer.appendChild(handle, grip);

    const dispose = this._renderer.listen(
      handle,
      'keydown',
      (e: KeyboardEvent) => {
        this._onHandleKeydown(e, handleIndex);
      },
    );
    // Renderer2.listen returns a disposer — register it so the keydown
    // listener does not outlive this component instance.
    this._destroyRef.onDestroy(dispose);

    return handle;
  }

  /**
   * @private Wires pointer-capture drag behavior for a single handle.
   * Only the two panels adjacent to the handle change size during drag;
   * all other panels remain fixed.
   *
   * The gesture ends on `pointerup`, `pointercancel` or the handle losing
   * capture (`mlvPointerGestureEnd`), and on destroy. Every one of those runs
   * `_endDrag()` from `finalize`, so the page-wide cursor, `user-select` and the
   * `--dragging` class never outlive the gesture, and the size the drag reached
   * is committed either way — a cancelled touch drag keeps the layout the user
   * last saw rather than snapping back.
   */
  private _initDragForHandle(handleEl: HTMLElement, handleIndex: number): void {
    const containerEl = this._elementRef.nativeElement as HTMLElement;
    const isHorizontal = () => this.orientation() === 'horizontal';

    // The drag stream runs OUTSIDE Angular: each pointermove writes the grid
    // template imperatively (Renderer2) and never touches a signal, so a fast
    // drag no longer schedules an OnPush change-detection pass per move. Only
    // the `_isDragging` host-class flag and the single final `_sizes` commit
    // re-enter the zone. Split-pane exposes no per-move output, so there is no
    // emission-timing contract to preserve.
    this._ngZone.runOutsideAngular(() => {
      fromEvent<PointerEvent>(handleEl, 'pointerdown')
        .pipe(
          // A second pointer pressing any handle mid-drag would restyle the
          // page and then clear the first drag's state when it ends.
          filter((e) => e.button === 0 && !this._isDragging()),
          switchMap((startEvent: PointerEvent) => {
            startEvent.preventDefault();
            const pointerId = startEvent.pointerId;
            try {
              handleEl.setPointerCapture(pointerId);
            } catch {
              // An inactive pointer (a synthetic event) cannot be captured.
              // Throwing here would error the stream and leave the handle
              // dead; the gesture still ends on pointerup / pointercancel.
            }

            const containerRect = containerEl.getBoundingClientRect();
            const containerSize = isHorizontal()
              ? containerRect.width
              : containerRect.height;
            const resizeCursor = isHorizontal() ? 'col-resize' : 'row-resize';
            const root = this._document.documentElement;

            // `_isDragging` drives a host-class binding — flip it in the zone.
            this._ngZone.run(() => this._isDragging.set(true));
            this._renderer.setStyle(root, 'cursor', resizeCursor);
            this._renderer.setStyle(root, 'user-select', 'none');

            const panels = this._panels();
            const panelI = panels[handleIndex];
            const panelI1 = panels[handleIndex + 1];
            const sizes = [...this._sizes()];
            const pairTotal = sizes[handleIndex] + sizes[handleIndex + 1];
            // Seed the drag buffer so a press/release with no move still commits
            // a well-defined (unchanged) size array on pointerup.
            this._dragSizes = sizes;

            // Capture panel[i]'s start position in the viewport at drag start.
            // Since only panel[i] and panel[i+1] will change, all panels before [i]
            // remain fixed, so this reference stays valid throughout the drag.
            const panelIEl = panelI._elementRef.nativeElement;
            const panelIRect = panelIEl.getBoundingClientRect();
            // Panel[i]'s inline-start edge is its right edge in RTL, and the
            // pointer then travels away from it as the panel grows.
            const mirrored = isHorizontal() && this._direction() === 'rtl';
            const panelIStart = isHorizontal()
              ? mirrored
                ? panelIRect.right
                : panelIRect.left
              : panelIRect.top;

            return fromEvent<PointerEvent>(handleEl, 'pointermove').pipe(
              filter((moveEvent) => moveEvent.pointerId === pointerId),
              takeUntil(mlvPointerGestureEnd(handleEl, pointerId, handleEl)),
              map((moveEvent: PointerEvent) => {
                const pointerPos = isHorizontal()
                  ? moveEvent.clientX
                  : moveEvent.clientY;
                // Pixel distance from panel[i]'s inline-start edge to the pointer
                const newPanelI_px = mirrored
                  ? panelIStart - pointerPos
                  : pointerPos - panelIStart;
                // Convert to the same fr-unit space (fr ≈ % of container)
                const newPanelI_fr = (newPanelI_px / containerSize) * 100;
                // Clamp: both adjacent panels must respect their minSize
                const minI = panelI.minSize();
                const minI1 = panelI1.minSize();
                const clampedI = clamp(newPanelI_fr, minI, pairTotal - minI1);

                const newSizes = [...this._sizes()];
                newSizes[handleIndex] = clampedI;
                newSizes[handleIndex + 1] = pairTotal - clampedI;
                return newSizes;
              }),
              // Runs however the drag stops: the gesture ending, or a destroy
              // mid-drag unsubscribing this inner stream.
              finalize(() => this._endDrag(root)),
            );
          }),
          // Last, so a destroy mid-drag tears down the active inner stream and
          // runs its `finalize`; placed before `switchMap` it would not.
          takeUntilDestroyed(this._destroyRef),
        )
        .subscribe((sizes) => {
          // Per move (outside the zone): buffer the value and apply the grid
          // template imperatively — no signal writes, so no CD pass.
          this._dragSizes = sizes;
          this._applyGridTemplate(sizes);
        });
    });
  }

  /**
   * @private Ends a drag however it ended — release, `pointercancel`, lost
   * capture or destroy: clears the page-wide cursor and `user-select`, drops
   * the `--dragging` flag and commits the buffered drag sizes once, in the zone,
   * so OnPush change detection runs a single time per drag.
   *
   * @param root — The document element the drag styled.
   */
  private _endDrag(root: HTMLElement): void {
    this._renderer.removeStyle(root, 'cursor');
    this._renderer.removeStyle(root, 'user-select');
    this._ngZone.run(() => {
      this._isDragging.set(false);
      if (this._dragSizes) this._sizes.set(this._dragSizes);
      this._dragSizes = null;
    });
  }

  /**
   * @protected Keyboard handler on each dynamically created handle.
   * Arrow keys move by 1%, Home/End jump to the adjacent panel's minSize.
   */
  private _onHandleKeydown(event: KeyboardEvent, handleIndex: number): void {
    const isHorizontal = this.orientation() === 'horizontal';
    const key = this._rtlService.normalizeArrowKey(event, this._direction());
    const shouldDecrease =
      (isHorizontal && key === LEFT_ARROW) ||
      (!isHorizontal && key === UP_ARROW);
    const shouldIncrease =
      (isHorizontal && key === RIGHT_ARROW) ||
      (!isHorizontal && key === DOWN_ARROW);

    if (
      !shouldDecrease &&
      !shouldIncrease &&
      event.key !== 'Home' &&
      event.key !== 'End'
    )
      return;
    event.preventDefault();

    const panels = this._panels();
    const sizes = [...this._sizes()];
    const pairTotal = sizes[handleIndex] + sizes[handleIndex + 1];
    const minI = panels[handleIndex].minSize();
    const minI1 = panels[handleIndex + 1].minSize();

    let newI: number;
    if (event.key === 'Home') {
      newI = minI;
    } else if (event.key === 'End') {
      newI = pairTotal - minI1;
    } else {
      newI = sizes[handleIndex] + (shouldDecrease ? -1 : 1);
    }

    newI = clamp(newI, minI, pairTotal - minI1);
    sizes[handleIndex] = newI;
    sizes[handleIndex + 1] = pairTotal - newI;
    this._sizes.set(sizes);
    this._applyGridTemplate(sizes);
  }
}
