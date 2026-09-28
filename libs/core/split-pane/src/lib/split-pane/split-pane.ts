import {
  ChangeDetectionStrategy,
  Component,
  contentChildren,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  NgZone,
  Renderer2,
  signal,
  untracked,
  ViewEncapsulation,
} from '@angular/core';
import type { AfterContentChecked } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  filter,
  finalize,
  fromEvent,
  map,
  merge,
  Subject,
  Subscription,
  switchMap,
  takeUntil,
} from 'rxjs';
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
import { mlvCarrySplitPaneSizes } from './split-pane-sizes';

/** @private Grip modifier drawn in a horizontal split (a vertical handle). */
const GRIP_VERTICAL = 'mlv-split-pane__handle-grip--vertical';

/** @private Grip modifier drawn in a vertical split (a horizontal handle). */
const GRIP_HORIZONTAL = 'mlv-split-pane__handle-grip--horizontal';

/** @private The inline grid property that carries the panel tracks. */
type MlvSplitPaneTemplateProperty =
  | 'grid-template-columns'
  | 'grid-template-rows';

/**
 * @private One inserted drag handle. The pair it splits is never stored: it
 * is the handle's position in `_handles`, read when an event arrives, so a
 * handle that survives a change to the panel list resizes its new pair.
 */
interface MlvSplitPaneHandle {
  /** The `role="separator"` element. */
  readonly element: HTMLElement;
  /** Its decorative grip, whose modifier follows the orientation. */
  readonly grip: HTMLElement;
  /** The handle's keydown and drag listeners, released when it is removed. */
  readonly listeners: Subscription;
}

/**
 * Split pane container that divides space into two or more resizable panels.
 *
 * Panels are declared as `<mlv-split-pane-panel>` children. The component
 * automatically inserts a drag handle between each adjacent pair. Sizes are
 * managed via CSS `grid-template-columns` (horizontal) or
 * `grid-template-rows` (vertical), ensuring the DOM always reflects the true
 * rendered widths/heights.
 *
 * The handles, their ARIA and the grid template follow `orientation` and the
 * panel list for the component's whole life, not only at init: a panel added
 * or removed at runtime (`@if`, `@for`) gets or loses its handle, and a panel
 * that survives keeps its size — see {@link mlvCarrySplitPaneSizes} for where
 * a removed panel's size goes and where an added panel's comes from.
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
export class MlvSplitPane implements AfterContentChecked {
  /**
   * Orientation of the split. `'horizontal'` places panels side-by-side;
   * `'vertical'` stacks them top to bottom. May change at runtime: the grid
   * template moves to the other axis and the handles are re-labelled.
   */
  readonly orientation = input<MlvSplitPaneOrientation>('horizontal');

  /** @protected Whether a drag is currently in progress. Drives the `--dragging` modifier class. */
  protected readonly _isDragging = signal(false);

  /** @private Queried panel children. */
  private readonly _panels = contentChildren(MlvSplitPanePanel);

  /**
   * @private Current sizes of each panel in `fr` units (≈ percentage), index
   * for index with `_laidOutPanels`.
   */
  private readonly _sizes = signal<number[]>([]);

  /**
   * @private The panel list `_sizes` and `_handles` were last laid out for.
   * Resizes read panels from here rather than from `_panels()`, so the three
   * can never be read against different lists.
   */
  private _laidOutPanels: readonly MlvSplitPanePanel[] = [];

  /**
   * @private The orientation the structure was last laid out for, or `null`
   * before the first layout. Paired with `_laidOutPanels` so a sync that
   * finds both unchanged does nothing.
   */
  private _laidOutOrientation: MlvSplitPaneOrientation | null = null;

  /**
   * @private Whether the declaring view's content hook has run once. Until it
   * has, the structure effect lays nothing out and leaves the first layout to
   * that hook — see {@link _syncStructure}.
   */
  private _contentChecked = false;

  /**
   * @private Latest sizes produced during an active pointer drag. The drag
   * stream runs outside Angular and mutates the grid template imperatively; this
   * buffer holds the running value so it can be committed to the `_sizes` signal
   * exactly once, when the gesture ends (`pointerup`, `pointercancel`, lost
   * capture, a rebuild or destroy), inside the zone.
   */
  private _dragSizes: number[] | null = null;

  /**
   * @private Ends an active drag when the structure is rebuilt under it — the
   * drag measured the old panel list and the old axis, so it cannot go on.
   */
  private readonly _dragInterrupted = new Subject<void>();

  /** @private The inserted drag handles, in order: handle `i` splits panels `i` and `i + 1`. */
  private _handles: MlvSplitPaneHandle[] = [];

  /**
   * @private The inline grid property last written to the host, or `null`
   * while none is. An orientation flip removes it before writing the other
   * one, so the host never carries both.
   */
  private _templateProperty: MlvSplitPaneTemplateProperty | null = null;

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

  constructor() {
    // Re-runs whenever the panel list or the orientation changes, or a panel
    // not yet laid out has its `_bound` flag flip, whichever view the change
    // came from — see `_syncStructure()` for why the content hook below runs
    // it as well.
    effect(() => this._syncStructure(true));
  }

  /**
   * @internal Lifecycle hook, not for consumer calls. Takes the first layout —
   * at the point the former one-shot `ngAfterContentInit` took it — and lays
   * out every later change a refresh of the declaring view brings. See
   * {@link _syncStructure}.
   */
  ngAfterContentChecked(): void {
    this._contentChecked = true;
    this._syncStructure(false);
  }

  /**
   * @private Lays the structure out when the panel list or the orientation
   * differs from what was last laid out. Runs during change detection, on the
   * server too. Nothing else is tracked: a panel's `size` is its initial size
   * only, and resizes write `_sizes` themselves.
   *
   * Two callers, because neither sees every case alone:
   *
   * - **`ngAfterContentChecked`** runs after the declaring view's embedded
   *   views, so every panel an `@if`, a `@for` or a structural directive has
   *   stamped is there and bound. It takes the **first** layout, from the
   *   whole list at once and at the point the former `ngAfterContentInit`
   *   took it, so the first layout, the handles by the host's
   *   `ngAfterViewInit` and the server payload are what they were; and it
   *   lays out every later change a refresh of that view brings. It lays out
   *   whatever it finds: a panel whose embedded view is detached from change
   *   detection never binds, and is laid out with its input defaults, as
   *   before.
   * - **The effect** runs in the declaring view's refresh after that view's
   *   own bindings but before its embedded views. A panel nested in
   *   `@if { @for }`, or stamped by a directive's own effect, is not there
   *   yet; a panel an `@if` / `@for` has just stamped is there with its
   *   `[size]` not yet bound (`undefined` is a valid bound value, so `size()`
   *   cannot tell). So the effect leaves the first layout to the hook, and
   *   after it waits for every panel it has not laid out yet to be bound — the
   *   flip of that panel's `_bound` re-runs it. A panel already laid out is
   *   never waited for, so a detached one cannot hold a later change back.
   *   The effect is the only caller that sees a list change made while the
   *   declaring view is not refreshed (`*mlvBreakpointUp` under an OnPush
   *   host).
   *
   * The second of the two to see a change finds it laid out and does nothing.
   *
   * @param fromEffect — Whether the structure effect is the caller.
   */
  private _syncStructure(fromEffect: boolean): void {
    const panels = this._panels();
    const orientation = this.orientation();
    if (
      panels === this._laidOutPanels &&
      orientation === this._laidOutOrientation
    ) {
      return;
    }
    if (fromEffect) {
      const laidOut = new Set(this._laidOutPanels);
      if (!panels.every((panel) => laidOut.has(panel) || panel._bound())) {
        return;
      }
      // After every signal read, so a run that stops here still tracks what
      // the next one depends on.
      if (!this._contentChecked) return;
    }
    untracked(() => this._layout(panels));
  }

  /**
   * @private Lays the structure out for `panels` and the current orientation:
   * ends a drag in flight, carries the sizes of the panels that survive
   * ({@link mlvCarrySplitPaneSizes}), reconciles the handles and writes the
   * grid template on the current axis. With fewer than two panels nothing is
   * split: every handle and the inline template are removed, and a later
   * second panel starts over from the panels' `size` inputs.
   */
  private _layout(panels: readonly MlvSplitPanePanel[]): void {
    // Commits the size the drag reached against the list it was measured for.
    if (this._isDragging()) this._dragInterrupted.next();

    const sizes =
      panels.length < 2
        ? []
        : mlvCarrySplitPaneSizes(this._laidOutPanels, this._sizes(), panels);
    this._laidOutPanels = panels;
    this._laidOutOrientation = this.orientation();
    this._sizes.set(sizes);
    this._reconcileHandles(panels);
    this._applyGridTemplate(sizes);
  }

  /**
   * @private Brings the handles in line with `panels`: exactly one between
   * each adjacent pair, labelled for the current orientation.
   *
   * Handles are matched to pairs by where they sit in the DOM, which Angular
   * has already updated. A pair that has handles keeps one — the focused one
   * when there is one, else the first — so a handle is never moved (moving a
   * node blurs it) and one that stays keeps focus and listeners. A pair with
   * none gets a new one, inserted right after its first panel. Every other
   * handle — before the first panel, after the last, or a second one in a pair
   * whose panel between them was removed — is removed with its listeners.
   *
   * Focus on a removed handle moves to the nearest kept one (the first when it
   * sat before the first panel, else the last) before it is removed, so it
   * never drops to `<body>`. With fewer than two panels no handle is left and
   * nothing in the split pane can take focus, so there it does drop.
   */
  private _reconcileHandles(panels: readonly MlvSplitPanePanel[]): void {
    const host = this._elementRef.nativeElement as HTMLElement;
    const pairs = Math.max(panels.length - 1, 0);
    const panelIndex = new Map<Element, number>(
      panels.map((panel, i) => [panel._elementRef.nativeElement, i]),
    );
    const unseen = new Map<Element, MlvSplitPaneHandle>(
      this._handles.map((handle) => [handle.element, handle]),
    );
    const byPair: MlvSplitPaneHandle[][] = Array.from(
      { length: pairs },
      () => [],
    );
    const leading: MlvSplitPaneHandle[] = [];
    const removed: MlvSplitPaneHandle[] = [];

    let lastPanel = -1;
    for (const child of Array.from(host.children)) {
      const index = panelIndex.get(child);
      if (index !== undefined) {
        lastPanel = index;
        continue;
      }
      const handle = unseen.get(child);
      if (!handle) continue;
      unseen.delete(child);
      if (lastPanel < 0) leading.push(handle);
      else if (lastPanel < pairs) byPair[lastPanel].push(handle);
      else removed.push(handle);
    }
    removed.push(...leading, ...unseen.values());

    const kept = byPair.map((candidates, i) => {
      const handle =
        candidates.find((c) => this._isFocused(c.element)) ??
        candidates[0] ??
        this._createHandle(panels[i]);
      removed.push(...candidates.filter((c) => c !== handle));
      return handle;
    });
    this._handles = kept;
    kept.forEach((handle) => this._applyHandleOrientation(handle));

    const focused = removed.find((handle) => this._isFocused(handle.element));
    const heir =
      focused && leading.includes(focused) ? kept[0] : kept[kept.length - 1];
    if (focused && heir) heir.element.focus();

    for (const handle of removed) {
      handle.listeners.unsubscribe();
      this._renderer.removeChild(host, handle.element);
    }
  }

  /**
   * @private Whether `element` holds focus, read from its own root — a shadow
   * root when the split pane is rendered inside one — rather than the ambient
   * `document`. The server DOM has no `getRootNode` and focuses nothing.
   */
  private _isFocused(element: HTMLElement): boolean {
    const root = (element.getRootNode?.() ?? element.ownerDocument) as
      | Partial<DocumentOrShadowRoot>
      | undefined;
    return root?.activeElement === element;
  }

  /**
   * @private Updates `grid-template-columns` (horizontal) or `grid-template-rows`
   * (vertical) so each panel occupies its current `fr` share. Handles always
   * occupy a fixed `0.125rem` track, so they never eat into panel space.
   * Fewer than two sizes write no template at all; a property written on the
   * other axis before is removed first.
   */
  private _applyGridTemplate(sizes: number[]): void {
    const host = this._elementRef.nativeElement;
    const property: MlvSplitPaneTemplateProperty | null =
      sizes.length < 2
        ? null
        : this.orientation() === 'horizontal'
          ? 'grid-template-columns'
          : 'grid-template-rows';
    if (this._templateProperty && this._templateProperty !== property) {
      this._renderer.removeStyle(host, this._templateProperty);
    }
    this._templateProperty = property;

    if (property) {
      const tracks: string[] = [];
      sizes.forEach((size, i) => {
        tracks.push(`${size}fr`);
        if (i < sizes.length - 1) tracks.push('0.125rem');
      });
      this._renderer.setStyle(host, property, tracks.join(' '));
    }
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
    const panels = this._laidOutPanels;
    this._handles.forEach(({ element }, i) => {
      const leadMin = panels[i]?.minSize() ?? 0;
      const trailMin = panels[i + 1]?.minSize() ?? 0;
      this._renderer.setAttribute(
        element,
        'aria-valuenow',
        String(Math.round(sizes[i] ?? 0)),
      );
      this._renderer.setAttribute(
        element,
        'aria-valuemin',
        String(Math.round(leadMin)),
      );
      this._renderer.setAttribute(
        element,
        'aria-valuemax',
        String(Math.round(100 - trailMin)),
      );
    });
  }

  /**
   * @private Creates a drag handle, inserts it right after `leadingPanel` and
   * wires its listeners. The grip visual is drawn entirely with CSS — no
   * Angular directives required. Its orientation-dependent ARIA and grip
   * modifier are written by {@link _applyHandleOrientation}.
   */
  private _createHandle(leadingPanel: MlvSplitPanePanel): MlvSplitPaneHandle {
    const handle = this._renderer.createElement('div') as HTMLElement;
    this._renderer.addClass(handle, 'mlv-split-pane__handle');
    this._renderer.setAttribute(handle, 'role', 'separator');
    this._renderer.setAttribute(handle, 'tabindex', '0');

    const grip = this._renderer.createElement('span') as HTMLElement;
    this._renderer.addClass(grip, 'mlv-split-pane__handle-grip');
    this._renderer.setAttribute(grip, 'aria-hidden', 'true');
    this._renderer.appendChild(handle, grip);

    const leadingEl = leadingPanel._elementRef.nativeElement as HTMLElement;
    this._renderer.insertBefore(
      this._elementRef.nativeElement,
      handle,
      leadingEl.nextSibling,
    );

    const record: MlvSplitPaneHandle = {
      element: handle,
      grip,
      listeners: new Subscription(),
    };
    record.listeners.add(
      fromEvent<KeyboardEvent>(handle, 'keydown')
        .pipe(takeUntilDestroyed(this._destroyRef))
        .subscribe((event) => this._onHandleKeydown(event, record)),
    );
    this._initDragForHandle(record);
    return record;
  }

  /**
   * @private Writes the orientation-dependent half of a handle: its
   * `aria-label`, its `aria-orientation` (the axis being split, so a
   * horizontal split has vertical separators) and its grip modifier.
   */
  private _applyHandleOrientation({ element, grip }: MlvSplitPaneHandle): void {
    const isHorizontal = this.orientation() === 'horizontal';
    this._renderer.setAttribute(
      element,
      'aria-label',
      isHorizontal ? 'Resize panels horizontally' : 'Resize panels vertically',
    );
    this._renderer.setAttribute(
      element,
      'aria-orientation',
      isHorizontal ? 'vertical' : 'horizontal',
    );
    this._renderer.removeClass(
      grip,
      isHorizontal ? GRIP_HORIZONTAL : GRIP_VERTICAL,
    );
    this._renderer.addClass(
      grip,
      isHorizontal ? GRIP_VERTICAL : GRIP_HORIZONTAL,
    );
  }

  /**
   * @private Wires pointer-capture drag behavior for a single handle.
   * Only the two panels adjacent to the handle change size during drag;
   * all other panels remain fixed.
   *
   * The gesture ends on `pointerup`, `pointercancel` or the handle losing
   * capture (`mlvPointerGestureEnd`), on a rebuild of the structure and on
   * destroy. Every one of those runs `_endDrag()` from `finalize`, so the
   * page-wide cursor, `user-select` and the `--dragging` class never outlive
   * the gesture, and the size the drag reached is committed either way — a
   * cancelled touch drag keeps the layout the user last saw rather than
   * snapping back. The subscription belongs to `handle.listeners`, so removing
   * the handle releases it too.
   */
  private _initDragForHandle(handle: MlvSplitPaneHandle): void {
    const handleEl = handle.element;
    const containerEl = this._elementRef.nativeElement as HTMLElement;
    const isHorizontal = () => this.orientation() === 'horizontal';

    // The drag stream runs OUTSIDE Angular: each pointermove writes the grid
    // template imperatively (Renderer2) and never touches a signal, so a fast
    // drag no longer schedules an OnPush change-detection pass per move. Only
    // the `_isDragging` host-class flag and the single final `_sizes` commit
    // re-enter the zone. Split-pane exposes no per-move output, so there is no
    // emission-timing contract to preserve.
    this._ngZone.runOutsideAngular(() => {
      handle.listeners.add(
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

              // The pair this handle splits right now — not the one it split
              // when it was created.
              const handleIndex = this._handles.indexOf(handle);
              const panels = this._laidOutPanels;
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
                takeUntil(
                  merge(
                    mlvPointerGestureEnd(handleEl, pointerId, handleEl),
                    this._dragInterrupted,
                  ),
                ),
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
                // Runs however the drag stops: the gesture ending, a rebuild,
                // or a destroy / handle removal unsubscribing this inner stream.
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
          }),
      );
    });
  }

  /**
   * @private Ends a drag however it ended — release, `pointercancel`, lost
   * capture, a rebuild or destroy: clears the page-wide cursor and
   * `user-select`, drops the `--dragging` flag and commits the buffered drag
   * sizes once, in the zone, so OnPush change detection runs a single time per
   * drag.
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
   * @private Keyboard handler on each dynamically created handle.
   * Arrow keys move by 1%, Home/End jump to the adjacent panel's minSize.
   * The pair is the one `handle` splits when the key arrives.
   */
  private _onHandleKeydown(
    event: KeyboardEvent,
    handle: MlvSplitPaneHandle,
  ): void {
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

    const handleIndex = this._handles.indexOf(handle);
    const panels = this._laidOutPanels;
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
