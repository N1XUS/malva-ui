import { Overlay } from '@angular/cdk/overlay';
import type {
  ConnectedPosition,
  FlexibleConnectedPositionStrategy,
  OverlayRef,
} from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  afterNextRender,
  afterRenderEffect,
  DestroyRef,
  Directive,
  effect,
  inject,
  input,
  PLATFORM_ID,
  signal,
  TemplateRef,
  untracked,
  ViewContainerRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  mlvMirrorInlineOffsets,
  MlvResizeObserverService,
  MlvRtlService,
} from '@malva-ui/cdk/utils';
import { posToDOMRect } from '@tiptap/core';
import type { Editor } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { Selection } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import { delay, fromEvent, merge, take } from 'rxjs';
import type { Observable, Subscription } from 'rxjs';
import {
  MLV_EDITOR_OVERLAY_REGISTRY,
  MLV_EDITOR_TOOLBAR_CONTEXT,
  MLV_EDITOR_TOOLBAR_REVISION,
  MLV_EDITOR_TOOLBAR_ROVING,
} from '../editor-toolbar-context';
import {
  mlvEditorBubblePlacement,
  mlvEditorVisibleRect,
  type MlvEditorRect,
} from './editor-layout';

/** @internal Gap between the selection and the bubble, in px. */
const MLV_EDITOR_BUBBLE_GAP = 8;

/** @internal Closest the bubble comes to a window edge, in px. */
const MLV_EDITOR_BUBBLE_VIEWPORT_MARGIN = 8;

/** @internal Pane class; the bubble's BEM block. */
const MLV_EDITOR_BUBBLE_CLASS = 'mlv-editor-bubble';

/** @internal Pane modifier while the bubble is off screen. */
const MLV_EDITOR_BUBBLE_HIDDEN_CLASS = 'mlv-editor-bubble--hidden';

/** @internal Pane modifier while CDK resolved the below position. */
const MLV_EDITOR_BUBBLE_BELOW_CLASS = 'mlv-editor-bubble--below';

/** @internal Centred above the selection. */
const MLV_EDITOR_BUBBLE_ABOVE: ConnectedPosition = {
  originX: 'center',
  originY: 'top',
  overlayX: 'center',
  overlayY: 'bottom',
  offsetY: -MLV_EDITOR_BUBBLE_GAP,
};

/** @internal Centred below the selection. */
const MLV_EDITOR_BUBBLE_BELOW: ConnectedPosition = {
  originX: 'center',
  originY: 'bottom',
  overlayX: 'center',
  overlayY: 'top',
  offsetY: MLV_EDITOR_BUBBLE_GAP,
};

/** @internal Above first; CDK falls back below on a window edge. */
const MLV_EDITOR_BUBBLE_ABOVE_FIRST = [
  MLV_EDITOR_BUBBLE_ABOVE,
  MLV_EDITOR_BUBBLE_BELOW,
];

/** @internal Below first, once above would cross the boundary. */
const MLV_EDITOR_BUBBLE_BELOW_FIRST = [
  MLV_EDITOR_BUBBLE_BELOW,
  MLV_EDITOR_BUBBLE_ABOVE,
];

/** @internal Elements a press may focus; a press anywhere else keeps the caret. */
const MLV_EDITOR_BUBBLE_FOCUSABLE =
  'button, a[href], input, select, textarea, [tabindex], [contenteditable="true"]';

/**
 * @internal Renders its template in a CDK overlay that floats over the
 * nearest `mlv-editor`'s selection: `toolbarAppearance="floating"`.
 *
 * The contents are whatever the template holds, so the same host can carry a
 * different set of controls later; `MlvEditor` stamps its toolbar template.
 * The overlay is created once and kept attached, hidden by a pane modifier,
 * so the controls keep their state and their narrow-mode measurement between
 * appearances instead of being re-created per selection.
 *
 * Shown only while all of these hold: focus is in the editor composite, the
 * selection is non-empty (or Alt+F10 summoned it at the caret), no pointer is
 * still selecting, no drag or IME composition is in progress, the editor is
 * enabled and not `readonly`, and the selection is visible inside the window
 * and, for a capped editor, inside its scrolling viewport. It prefers above
 * the selection and flips below only when above would cross that boundary's
 * top edge. Turning `readonly` on while it is shown hides it and closes every
 * popup the editor owns; focus inside either returns to the content.
 *
 * Keyboard: Alt+F10 in the content shows it and moves focus to its first
 * control through the toolbar's roving registry; Escape dismisses it and
 * returns focus to the content with the selection intact; Tab leaves it back
 * into the content rather than for the end of the document, where the portal
 * sits. Appearing never moves focus.
 *
 * Escape and Alt+F10 in the content go through a ProseMirror plugin, not a DOM
 * listener: ProseMirror cancels every Escape it sees, so a listener behind it
 * would find each one already `defaultPrevented`, and one in front of it
 * would take Escape from a content popup. The plugin offers both keys to
 * every plugin registered after it and acts only when none claims them, so a
 * consumer's `@tiptap/suggestion` list or an AI stream still gets Escape
 * first. A dismissing Escape stops propagating, so a dialog or drawer around
 * the editor stays open; the next one reaches it. While `readonly` the bubble
 * claims neither key.
 */
@Directive({
  selector: 'ng-template[mlvEditorBubble]',
})
export class MlvEditorBubble {
  /** The editor's content viewport: the listener scope and the capped boundary. */
  readonly viewport = input.required<HTMLElement>();

  /** Whether the viewport is the editor's scroll container, bounding where the selection counts as visible. */
  readonly capped = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /** @private Template rendered into the overlay pane. */
  private readonly _templateRef = inject(TemplateRef);

  /** @private Container the template view is created in, so it keeps the editor's injector. */
  private readonly _viewContainerRef = inject(ViewContainerRef);

  /** @private CDK overlay factory. */
  private readonly _overlay = inject(Overlay);

  /** @private Injected document; never the ambient global. */
  private readonly _document = inject(DOCUMENT);

  /** @private Directive lifetime; owns every listener below. */
  private readonly _destroyRef = inject(DestroyRef);

  /** @private Editor state: instance, focus, disabled and zoom. */
  private readonly _context = inject(MLV_EDITOR_TOOLBAR_CONTEXT);

  /** @private Bumped after every Tiptap transaction or selection update. */
  private readonly _revision = inject(MLV_EDITOR_TOOLBAR_REVISION, {
    optional: true,
  });

  /** @private The toolbar's roving focus; Alt+F10 enters through it. */
  private readonly _roving = inject(MLV_EDITOR_TOOLBAR_ROVING);

  /** @private Makes the pane part of the editor's composite focus while shown. */
  private readonly _overlays = inject(MLV_EDITOR_OVERLAY_REGISTRY);

  /** @private Scoped direction for the pane. */
  private readonly _rtl = inject(MlvRtlService);

  /** @private Pane size changes reposition the bubble. */
  private readonly _resizeObserver = inject(MlvResizeObserverService);

  /** @private Invalidates the render effect from DOM events. */
  private readonly _tick = signal(0);

  /** @private Identifies this instance's content-key plugin in the editor state. */
  private readonly _keyPluginKey = new PluginKey('mlvEditorBubbleKeys');

  /** @private The overlay, created after the first render in the browser. */
  private _overlayRef: OverlayRef | null = null;

  /** @private The overlay's position strategy, re-pointed at the selection. */
  private _strategy: FlexibleConnectedPositionStrategy | null = null;

  /** @private The position list last handed to the strategy. */
  private _positions: ConnectedPosition[] | null = null;

  /** @private Whether the bubble is on screen. */
  private _shown = false;

  /** @private Releases the pane's composite-focus registration. */
  private _unregister: (() => void) | null = null;

  /** @private Alt+F10 showed it at a bare caret; cleared when focus returns to the content. */
  private _summoned = false;

  /** @private Escape dismissed it for this selection; any other selection clears it. */
  private _dismissed: Selection | null = null;

  /** @private A primary pointer is down in the content, still selecting. */
  private _pointerSelecting = false;

  /** @private A pointer is down on the bubble; covers browsers that blur on a button press. */
  private _pressing = false;

  /** @private A native drag (block handle or text) is in progress. */
  private _dragging = false;

  /** @private An IME composition is in progress. */
  private _composing = false;

  /** @private Per-gesture listeners, replaced by the next gesture of the same kind. */
  private readonly _gestures: Record<
    'select' | 'press' | 'drag',
    Subscription | null
  > = { select: null, press: null, drag: null };

  constructor() {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;

    afterNextRender(() => this._create());

    // Registered once per editor instance and removed with this directive,
    // e.g. when `toolbarAppearance` returns to `'bar'`: left behind, it would
    // keep claiming Escape and Alt+F10 for a bubble that no longer exists.
    effect((onCleanup) => {
      const editor = this._context.editor();
      if (!editor || editor.isDestroyed) return;
      untracked(() => editor.registerPlugin(this._createKeyPlugin()));
      onCleanup(() => {
        if (!editor.isDestroyed) editor.unregisterPlugin(this._keyPluginKey);
      });
    });

    // Before the render effect below would hide the bubble, so focus in a
    // popup moves to the content while that popup still exists.
    effect(() => {
      if (!this._context.readonly()) return;
      untracked(() => this._closeForReadonly());
    });

    afterRenderEffect(() => {
      this._tick();
      this._context.editor();
      this._context.disabled();
      this._context.readonly();
      this._context.focused();
      this._context.zoom();
      this._revision?.();
      this.capped();
      untracked(() => this._sync());
    });

    this._destroyRef.onDestroy(() => {
      for (const gesture of Object.values(this._gestures)) {
        gesture?.unsubscribe();
      }
      // Nothing is on screen once the overlay is gone.
      this._shown = false;
      this._unregister?.();
      this._unregister = null;
      this._overlayRef?.dispose();
      this._overlayRef = null;
    });
  }

  /** @private Creates the overlay and binds every listener, once. */
  private _create(): void {
    const viewport = this.viewport();
    const direction = this._rtl.resolveDirection(viewport);
    const strategy = this._overlay
      .position()
      .flexibleConnectedTo({ x: 0, y: 0 })
      .withPositions(
        mlvMirrorInlineOffsets(MLV_EDITOR_BUBBLE_ABOVE_FIRST, direction),
      )
      .withFlexibleDimensions(false)
      .withPush(true)
      .withViewportMargin(MLV_EDITOR_BUBBLE_VIEWPORT_MARGIN);
    const ref = this._overlay.create({
      positionStrategy: strategy,
      // Repositioned by `_sync()` from a document-level scroll listener, which
      // also sees the capped viewport's own scrolling; CDK's reposition
      // strategy only knows registered `cdkScrollable`s.
      scrollStrategy: this._overlay.scrollStrategies.noop(),
      direction,
      panelClass: [MLV_EDITOR_BUBBLE_CLASS, MLV_EDITOR_BUBBLE_HIDDEN_CLASS],
      hasBackdrop: false,
    });
    ref.attach(new TemplatePortal(this._templateRef, this._viewContainerRef));
    this._overlayRef = ref;
    this._strategy = strategy;
    this._positions = MLV_EDITOR_BUBBLE_ABOVE_FIRST;

    const pane = ref.overlayElement;

    strategy.positionChanges
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe((change) =>
        pane.classList.toggle(
          MLV_EDITOR_BUBBLE_BELOW_CLASS,
          change.connectionPair.overlayY === 'top',
        ),
      );

    // Nothing re-parents an open pane, so a `[dir]` flip above the editor
    // re-mirrors it here.
    this._destroyRef.onDestroy(
      this._rtl.watchDirection(viewport, (next) => {
        ref.setDirection(next);
        this._positions = null;
        this._invalidate();
      }),
    );

    this._resizeObserver
      .observe(pane)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe(() => this._invalidate());

    this._bindViewportListeners(viewport);
    this._bindPaneListeners(pane);

    const window = this._document.defaultView;
    // Passive and capture: every scroll container's `scroll` reaches the
    // document in the capture phase, the capped viewport's included.
    fromEvent(this._document, 'scroll', { capture: true, passive: true })
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe(() => this._invalidateOnLayout());
    if (window) {
      fromEvent(window, 'resize', { passive: true })
        .pipe(takeUntilDestroyed(this._destroyRef))
        .subscribe(() => this._invalidateOnLayout());
    }

    this._sync();
  }

  /** @private Content-side gestures and keys. */
  private _bindViewportListeners(viewport: HTMLElement): void {
    // Fallback behind the key plugin for ProseMirror's composition window: it
    // skips every key handler while it still counts as composing, and in
    // Safari for 500ms after `compositionend`, by when the bubble may already
    // be back. It cancels every key it does handle, so only a key it never
    // processed arrives here uncancelled. (A read-only view also skips them,
    // but the bubble claims no key there.)
    fromEvent<KeyboardEvent>(viewport, 'keydown')
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe((event) => {
        if (event.defaultPrevented) return;
        if (this._onContentKey(event)) event.preventDefault();
      });

    fromEvent<FocusEvent>(viewport, 'focusin')
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe((event) => {
        if (!this._inContent(event.target)) return;
        this._summoned = false;
        this._invalidate();
      });

    fromEvent<PointerEvent>(viewport, 'pointerdown')
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe((event) => {
        if (
          event.button !== 0 ||
          event.isPrimary === false ||
          !this._inContent(event.target)
        ) {
          return;
        }
        this._pointerSelecting = true;
        this._summoned = false;
        this._invalidate();
        this._gesture(
          'select',
          merge(
            fromEvent(this._document, 'pointerup', { capture: true }),
            fromEvent(this._document, 'pointercancel', { capture: true }),
          ).pipe(take(1)),
          () => {
            this._pointerSelecting = false;
            this._invalidate();
          },
        );
      });

    fromEvent(viewport, 'compositionstart')
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe(() => {
        this._composing = true;
        this._invalidate();
      });
    fromEvent(viewport, 'compositionend')
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe(() => {
        this._composing = false;
        this._invalidate();
      });

    // Capture, so a drag source that stops `dragstart` still counts.
    fromEvent(viewport, 'dragstart', { capture: true })
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe(() => {
        this._dragging = true;
        this._invalidate();
        // `dragend` never reaches the document when the source left the DOM
        // mid-drag; the next press ends the wait instead.
        this._gesture(
          'drag',
          merge(
            fromEvent(this._document, 'dragend', { capture: true }),
            fromEvent(this._document, 'drop', { capture: true }),
            fromEvent(this._document, 'pointerdown', { capture: true }),
          ).pipe(take(1)),
          () => {
            this._dragging = false;
            this._invalidate();
          },
        );
      });
  }

  /** @private Bubble-side keys and presses. */
  private _bindPaneListeners(pane: HTMLElement): void {
    fromEvent<KeyboardEvent>(pane, 'keydown')
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe((event) => {
        if (event.defaultPrevented) return;
        if (event.key === 'Escape') {
          event.preventDefault();
          // Kept from the page and any dialog around the editor: this Escape
          // belongs to the bubble.
          event.stopPropagation();
          this._dismiss();
        } else if (event.key === 'Tab') {
          // The pane is portaled to the end of the document; the next tab
          // stop after it is not the editor's.
          event.preventDefault();
          this._context.editor()?.view.focus();
        }
      });

    fromEvent(pane, 'pointerdown', { capture: true })
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe(() => {
        this._pressing = true;
        // Released a task after `pointerup`, so the `click` that follows
        // still finds the bubble on screen.
        this._gesture(
          'press',
          merge(
            fromEvent(this._document, 'pointerup', { capture: true }),
            fromEvent(this._document, 'pointercancel', { capture: true }),
          ).pipe(take(1), delay(0)),
          () => {
            this._pressing = false;
            this._invalidate();
          },
        );
      });

    // A press on the bubble's own padding keeps the caret and the selection
    // in the content; controls still take focus as usual.
    fromEvent<MouseEvent>(pane, 'mousedown')
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe((event) => {
        const target = event.target;
        if (
          target instanceof Element &&
          target.closest(MLV_EDITOR_BUBBLE_FOCUSABLE)
        ) {
          return;
        }
        event.preventDefault();
      });
  }

  /**
   * @private The plugin carrying content-side Escape and Alt+F10. The loop is
   * what makes it the lowest-priority key handler, not its place in the list:
   * plugins before it run first anyway, and it offers each of those keys to
   * every plugin after it (an AI stream session registers its Escape claim
   * later) before acting. Once it has offered the key it acts and returns
   * `true` unconditionally, even if a declining later handler changed the
   * bubble's state meanwhile; returning `false` there would make ProseMirror
   * run those handlers a second time. Returning `true` makes ProseMirror
   * cancel the event.
   */
  private _createKeyPlugin(): Plugin {
    const key = this._keyPluginKey;
    return new Plugin({
      key,
      props: {
        handleKeyDown: (view: EditorView, event: KeyboardEvent) => {
          if (!this._ownsContentKey(event)) return false;
          const plugins = view.state.plugins;
          const own = key.get(view.state);
          for (
            let index = own ? plugins.indexOf(own) + 1 : plugins.length;
            index < plugins.length;
            index++
          ) {
            const plugin = plugins[index];
            if (plugin.props.handleKeyDown?.call(plugin, view, event)) {
              return true;
            }
          }
          this._act(event);
          return true;
        },
      },
    });
  }

  /**
   * @private Whether `event` is a key the bubble acts on right now: never
   * while disabled or `readonly`, where it cannot show.
   */
  private _ownsContentKey(event: KeyboardEvent): boolean {
    if (this._context.disabled() || this._context.readonly()) return false;
    return (
      (event.key === 'Escape' && this._shown) ||
      (event.key === 'F10' &&
        event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.shiftKey)
    );
  }

  /**
   * @private The DOM fallback's entry: acts only on a key the bubble owns.
   * Returns whether it acted; the caller cancels the event.
   */
  private _onContentKey(event: KeyboardEvent): boolean {
    if (!this._ownsContentKey(event)) return false;
    this._act(event);
    return true;
  }

  /**
   * @private Alt+F10 summons; Escape dismisses and stops there, so a dialog or
   * drawer around the editor does not close with it. Unchecked: callers
   * establish that the bubble owns the key.
   */
  private _act(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.stopPropagation();
      this._dismiss();
    } else {
      this._summon();
    }
  }

  /** @private Shows the bubble at the caret or selection and focuses its first control. */
  private _summon(): void {
    const ref = this._overlayRef;
    if (!ref || this._context.disabled() || !this._context.editor()) return;
    this._summoned = true;
    this._dismissed = null;
    this._sync();
    if (!this._shown) {
      this._summoned = false;
      return;
    }
    this._roving.focusBoundary('start');
    if (!ref.overlayElement.contains(this._document.activeElement)) {
      this._summoned = false;
      this._sync();
    }
  }

  /** @private Hides the bubble for the current selection; focus returns to the content. */
  private _dismiss(): void {
    this._dismissed = this._context.editor()?.state.selection ?? null;
    this._summoned = false;
    this._sync();
  }

  /** @private Shows, repositions or hides the bubble for the current state. */
  private _sync(): void {
    const ref = this._overlayRef;
    const editor = this._context.editor();
    if (!ref || !editor || editor.isDestroyed || !this._wanted(editor)) {
      this._hide();
      return;
    }
    const windowRect = this._windowRect();
    const boundary = this.capped()
      ? mlvEditorVisibleRect(
          this.viewport().getBoundingClientRect(),
          windowRect,
        )
      : windowRect;
    const selection = this._selectionRect(editor);
    const visible = boundary ? mlvEditorVisibleRect(selection, boundary) : null;
    // Focus in the bubble (or a popup it opened) keeps it on screen when the
    // selection scrolls away, pushed to the window edge; hiding it would drop
    // that focus.
    const pinned = this._summoned || !editor.view.hasFocus();
    const anchor = visible ?? (pinned ? selection : null);
    if (!anchor) {
      this._hide();
      return;
    }
    this._show(ref, anchor, boundary ?? windowRect);
  }

  /** @private Whether every visibility condition except the anchor holds. */
  private _wanted(editor: Editor): boolean {
    if (this._context.disabled() || this._context.readonly()) return false;
    if (!this._context.focused() && !this._pressing) return false;
    if (this._pointerSelecting || this._dragging || this._composing) {
      return false;
    }
    const selection = editor.state.selection;
    if (this._dismissed) {
      if (selection.eq(this._dismissed)) return false;
      this._dismissed = null;
    }
    return this._summoned || !selection.empty;
  }

  /** @private Places and reveals the bubble at `anchor`. */
  private _show(
    ref: OverlayRef,
    anchor: MlvEditorRect,
    boundary: MlvEditorRect,
  ): void {
    const strategy = this._strategy;
    if (!strategy) return;
    const pane = ref.overlayElement;
    const positions =
      mlvEditorBubblePlacement(
        anchor,
        boundary,
        pane.getBoundingClientRect().height,
        MLV_EDITOR_BUBBLE_GAP,
      ) === 'above'
        ? MLV_EDITOR_BUBBLE_ABOVE_FIRST
        : MLV_EDITOR_BUBBLE_BELOW_FIRST;
    if (positions !== this._positions) {
      this._positions = positions;
      strategy.withPositions(
        mlvMirrorInlineOffsets(positions, ref.getDirection()),
      );
    }
    strategy.setOrigin({
      x: anchor.left,
      y: anchor.top,
      width: anchor.right - anchor.left,
      height: anchor.bottom - anchor.top,
    });
    if (!this._shown) {
      this._shown = true;
      pane.classList.remove(MLV_EDITOR_BUBBLE_HIDDEN_CLASS);
      this._unregister = this._overlays.register(pane, () => {
        // The registry drops the entry itself after calling this.
        this._unregister = null;
        this._hide();
      });
    }
    ref.updatePosition();
  }

  /** @private Takes the bubble off screen, handing focus back to the content first. */
  private _hide(): void {
    const ref = this._overlayRef;
    if (!ref || !this._shown) return;
    this._shown = false;
    const pane = ref.overlayElement;
    if (pane.contains(this._document.activeElement)) this._focusContent();
    pane.classList.add(MLV_EDITOR_BUBBLE_HIDDEN_CLASS);
    this._unregister?.();
    this._unregister = null;
  }

  /**
   * @private `readonly` just turned on. While the bubble is shown, every popup
   * the editor owns closes (their controls no longer apply, and the ones the
   * bubble opened would float beside a hidden pane), and focus in the bubble
   * or in such a popup returns to the content before either goes away.
   */
  private _closeForReadonly(): void {
    const ref = this._overlayRef;
    const editor = this._context.editor();
    if (!ref || !this._shown || !editor || editor.isDestroyed) return;
    const pane = ref.overlayElement;
    const active = this._document.activeElement;
    // A popup is a registered root portaled into an overlay pane of its own,
    // which the content does not share (it does inside a dialog).
    const inPopup =
      active instanceof Element &&
      !pane.contains(active) &&
      this._overlays.contains(active) &&
      !(active.closest('.cdk-overlay-pane')?.contains(editor.view.dom) ?? true);
    if (inPopup) this._focusContent();
    this._overlays.closeOthers(pane);
    this._sync();
  }

  /**
   * @private Focuses the content with its selection. `view.focus()` alone
   * moves no DOM focus while the view is not editable (`readonly`).
   */
  private _focusContent(): void {
    const editor = this._context.editor();
    if (!editor || editor.isDestroyed || this._context.disabled()) return;
    if (!editor.view.editable) {
      (editor.view.dom as HTMLElement).focus({ preventScroll: true });
    }
    editor.view.focus();
  }

  /** @private The selection's client rect; a caret is zero-width. */
  private _selectionRect(editor: Editor): MlvEditorRect {
    const { from, to } = editor.state.selection;
    try {
      const { top, bottom, left, right } = posToDOMRect(editor.view, from, to);
      return { top, bottom, left, right };
    } catch {
      // `coordsAtPos` throws where nothing is laid out; fall back to the
      // content's top edge.
      const rect = editor.view.dom.getBoundingClientRect();
      return {
        top: rect.top,
        bottom: rect.top,
        left: rect.left,
        right: rect.right,
      };
    }
  }

  /** @private The window's client rect. */
  private _windowRect(): MlvEditorRect {
    const window = this._document.defaultView;
    return {
      top: 0,
      left: 0,
      bottom: window?.innerHeight ?? 0,
      right: window?.innerWidth ?? 0,
    };
  }

  /** @private Whether `target` is inside the ProseMirror content. */
  private _inContent(target: EventTarget | null): boolean {
    const dom = this._context.editor()?.view.dom;
    return !!dom && target instanceof Node && dom.contains(target);
  }

  /**
   * @private Runs `done` on the first emission of `end`, replacing any wait
   * of the same kind still open. Per gesture, so released here and at
   * destroy rather than by `takeUntilDestroyed`, which would keep every
   * earlier generation alive.
   */
  private _gesture(
    kind: 'select' | 'press' | 'drag',
    end: Observable<unknown>,
    done: () => void,
  ): void {
    this._gestures[kind]?.unsubscribe();
    this._gestures[kind] = end.subscribe(() => {
      this._gestures[kind] = null;
      done();
    });
  }

  /** @private Schedules `_sync()` for the next render. */
  private _invalidate(): void {
    this._tick.update((tick) => tick + 1);
  }

  /**
   * @private Scroll and resize only matter while the bubble is shown or could
   * show: summoned, or a non-empty selection that may scroll back into view.
   * A focused bare caret, and a disabled or `readonly` editor, skip the render
   * these events would schedule.
   */
  private _invalidateOnLayout(): void {
    if (this._shown) {
      this._invalidate();
      return;
    }
    if (
      !untracked(this._context.focused) ||
      untracked(this._context.disabled) ||
      untracked(this._context.readonly)
    ) {
      return;
    }
    const editor = untracked(this._context.editor);
    if (
      this._summoned ||
      (editor && !editor.isDestroyed && !editor.state.selection.empty)
    ) {
      this._invalidate();
    }
  }
}
