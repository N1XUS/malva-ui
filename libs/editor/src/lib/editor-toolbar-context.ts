import {
  DestroyRef,
  Injectable,
  InjectionToken,
  computed,
  inject,
  signal,
} from '@angular/core';
import type { Signal, WritableSignal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription, fromEvent } from 'rxjs';
import type { Editor } from '@tiptap/core';
import type {
  MlvEditorError,
  MlvEditorFormat,
  MlvEditorImageUploadControl,
} from './editor.types';

/**
 * Editor-scoped command state made available to toolbar and projected controls.
 *
 * Commands are deliberately supplied as callbacks so Malva does not conceal
 * Tiptap's API or constrain third-party extensions.
 */
export interface MlvEditorToolbarContext {
  /** The editor instance owned by the nearest editor shell. */
  readonly editor: Signal<Editor | null>;
  /** Whether every interactive command surface is disabled. */
  readonly disabled: Signal<boolean>;
  /** Whether document mutation commands are unavailable. */
  readonly readonly: Signal<boolean>;
  /** Whether focus is currently inside the editor composite. */
  readonly focused: Signal<boolean>;
  /** Whether the owner has an editor and permits document mutation. */
  readonly editable: Signal<boolean>;
  /** The current serialization format. */
  readonly format: Signal<MlvEditorFormat>;
  /** View-only editor zoom percentage. */
  readonly zoom: WritableSignal<number>;
  /** Optional editor-owned image upload capability for standalone toolbars. */
  readonly imageUpload?: MlvEditorImageUploadControl;
  /** Runs a mutation command without allowing unavailable commands to throw. */
  run(command: (editor: Editor) => boolean): boolean;
  /** Checks a command without allowing unavailable commands to throw. */
  can(command: (editor: Editor) => boolean): boolean;
  /** Safely reads a Tiptap active state. */
  isActive(name: string, attributes?: Record<string, unknown>): boolean;
  /** Reports a typed recoverable error through the owning editor. */
  reportError(error: MlvEditorError): void;
}

/** Injects the command state belonging to the nearest `mlv-editor`. */
export const MLV_EDITOR_TOOLBAR_CONTEXT =
  new InjectionToken<MlvEditorToolbarContext>('MLV_EDITOR_TOOLBAR_CONTEXT');

/** @internal Per-editor invalidation state for built-in toolbar rendering. */
@Injectable()
export class MlvEditorToolbarRevision {
  /** @internal Increments after every Tiptap transaction or selection update. */
  readonly revision = signal(0);
}

/** @internal Supplies the built-in toolbar's per-editor invalidation signal. */
export const MLV_EDITOR_TOOLBAR_REVISION = new InjectionToken<Signal<number>>(
  'MLV_EDITOR_TOOLBAR_REVISION',
);

/** @internal Projected editor-toolbar widgets share this editor-scoped roving registry. */
@Injectable()
export class MlvEditorToolbarRovingRegistry {
  private readonly _widgets = signal<readonly HTMLElement[]>([]);
  private readonly _active = signal<HTMLElement | null>(null);
  private readonly _disabled = signal(false);
  private readonly _domStateRevision = signal(0);
  private _observer: MutationObserver | undefined;
  private _root: HTMLElement | undefined;
  private _hasInteracted = false;

  register(widget: HTMLElement): () => void {
    this._widgets.update((widgets) => [...widgets, widget]);
    this._observeStateChanges();
    if (!this._active()) this._active.set(widget);
    queueMicrotask(() => {
      if (!this._hasInteracted) this._focusFirstWidget();
    });
    return () => {
      this._widgets.update((widgets) =>
        widgets.filter((item) => item !== widget),
      );
      if (this._active() === widget) {
        this._focusFirstWidget();
      }
      if (!this._widgets().length) this._disconnectObserver();
    };
  }

  /**
   * @internal Resolves the single effective tab stop, even during DOM mutations.
   *
   * Called once per registered widget on every invalidation, so it does no DOM
   * work of its own: the enabled set and its order come from
   * `_enabledWidgets()`, which is derived once per generation and carries the
   * `_domStateRevision` dependency that keeps this reactive.
   */
  isActive(widget: HTMLElement): boolean {
    const enabled = this._enabledWidgets();
    const active = this._active();
    const effectiveActive =
      active && enabled.includes(active) ? active : (enabled[0] ?? null);
    return (
      !this._disabled() &&
      effectiveActive === widget &&
      enabled.includes(widget)
    );
  }

  /**
   * @internal Promotes a widget to the tab stop, gated on a **live** DOM read
   * rather than on `_enabledWidgets()`.
   *
   * Deliberate, and the only place the two readings differ. `activate()` runs
   * from a `focus` / `pointerdown` handler, so the question it has to answer is
   * "is this widget interactive at this instant" — the live read is that
   * question, and it is never wrong. The memo can only lag the DOM inside the
   * window between a DOM write and the observer's microtask, and no input event
   * is dispatched in that window, so the two agree today; keeping the live read
   * means they still agree if some future code writes an attribute and calls
   * `activate()` in the same turn, where the memo would be a generation behind
   * and would refuse a widget the user can see is enabled.
   *
   * `move()` and `focusBoundary()` take the memo instead because they need the
   * *order* of the enabled set, and an order assembled from N independent live
   * reads is exactly what the memo exists to prevent. Do not "harmonise" the
   * two: they are asking different questions.
   */
  activate(widget: HTMLElement): void {
    if (this._widgets().includes(widget) && this._enabled(widget)) {
      this._hasInteracted = true;
      this._active.set(widget);
    }
  }

  connect(root: HTMLElement): () => void {
    this._root = root;
    this._observeStateChanges();
    return () => {
      if (this._root === root) {
        this._root = undefined;
        this._disconnectObserver();
      }
    };
  }

  setDisabled(disabled: boolean): void {
    this._disabled.set(disabled);
    if (!disabled) this._synchronizeActiveWidget();
  }

  focusBoundary(boundary: 'start' | 'end'): void {
    if (this._disabled()) return;
    const widgets = this._enabledWidgets();
    const target =
      boundary === 'start' ? widgets[0] : widgets[widgets.length - 1];
    if (!target) return;
    this.activate(target);
    target.focus();
  }

  move(current: HTMLElement, direction: -1 | 1, wrap: boolean): void {
    if (this._disabled()) return;
    const widgets = this._enabledWidgets();
    if (!widgets.length) return;
    const index = Math.max(0, widgets.indexOf(current));
    const nextIndex = index + direction;
    const target = wrap
      ? widgets[(nextIndex + widgets.length) % widgets.length]
      : widgets[Math.min(Math.max(nextIndex, 0), widgets.length - 1)];
    if (!target) return;
    this.activate(target);
    target.focus();
  }

  private _enabled(widget: HTMLElement): boolean {
    return (
      !widget.closest('[hidden]') &&
      !widget.hasAttribute('disabled') &&
      widget.getAttribute('aria-disabled') !== 'true'
    );
  }

  /**
   * @private Registered widgets that are currently interactive, in DOM order.
   *
   * Derived once per invalidation generation rather than once per widget.
   * `isActive()` runs for every registered widget — 21 on the built-in
   * toolbar — and Angular settles one `disabled` transition in about two
   * change-detection passes, so the enabled order was assembled roughly
   * `2N + 2` times, each assembly walking the DOM with `closest('[hidden]')`
   * once per widget. The shape is therefore `(≈2N + c) derivations × N walks`,
   * not the plain `N^2` an earlier draft of this comment claimed — `N^2` at
   * N=21 is 441, and the measured cost is about twice that.
   *
   * Measured on the built-in toolbar at N=21, over `disabled` false → true:
   * the code this replaced took 39 derivations / 841 walks; this file with only
   * the `computed()` removed takes 44 / 924; as written it takes 1 / 21. The
   * two pre-fix figures differ because the old `isActive()` short-circuited on
   * a still-enabled `_active` and paid single `_enabled()` reads outside the
   * derivations. 924 is the one the spec's guard is written against, since that
   * ablation isolates this `computed()` and changes nothing else.
   *
   * `_domStateRevision` is what makes the memo correct. The enabled set is a
   * DOM read, and the `MutationObserver` that bumps that signal is the only
   * thing that tells the graph the DOM moved — the same dependency `isActive()`
   * already relied on. Every consumer now shares one snapshot per generation
   * instead of each re-reading the DOM at a different point in the same pass.
   */
  private readonly _enabledWidgets = computed<readonly HTMLElement[]>(() => {
    this._domStateRevision();
    return this._widgets()
      .filter((widget) => this._enabled(widget))
      .sort((left, right) => {
        const position = left.compareDocumentPosition(right);
        return position & 4 ? -1 : position & 2 ? 1 : 0;
      });
  });

  private _observeStateChanges(): void {
    if (
      this._observer ||
      typeof MutationObserver === 'undefined' ||
      !this._root ||
      typeof Node === 'undefined' ||
      !(this._root instanceof Node)
    ) {
      return;
    }
    // No debounce, deliberately, and the durable reason is the memo below, not
    // the batching: after it, a redundant invalidation costs exactly one
    // derivation — 21 `closest('[hidden]')` walks on the built-in toolbar — so
    // even a coalescer that did merge something would be buying ~nothing, and
    // would pay for it by leaving the tab stop a turn stale.
    //
    // A `queueMicrotask` coalescer also merges nothing here, in either
    // direction. Mutations written in one turn are already one callback:
    // `MutationObserver` delivers once per microtask checkpoint carrying every
    // record accumulated since the last delivery, so disabling the editor
    // writes 22 attributes and lands here once ("coalesces a whole batch of
    // observed mutations into one invalidation" pins that). Mutations spread
    // across separate microtasks are not merged either — each already lands in
    // its own turn, which is precisely where a per-turn debounce flushes.
    // The cost that was worth removing was the fan-out below.
    this._observer = new MutationObserver(() => {
      this._domStateRevision.update((revision) => revision + 1);
      this._synchronizeActiveWidget();
    });
    this._observer.observe(this._root, {
      attributes: true,
      attributeFilter: ['aria-disabled', 'disabled', 'hidden'],
      childList: true,
      subtree: true,
    });
  }

  /**
   * @private Re-resolves `_active` when the widget holding the tab stop is no
   * longer part of the enabled set.
   *
   * Reactive-graph note: this reads `_enabledWidgets()`, where it used to read
   * a non-reactive `_enabled(active)`, so `MlvEditorToolbarRoot`'s effect —
   * which reaches here through `setDisabled()` — now tracks `_widgets` and
   * `_domStateRevision` on *both* branches, not just on the fall-through into
   * `_focusFirstWidget()`. The effect therefore re-runs on every widget
   * registration and every observed mutation. That is deliberate and cheap
   * post-memo (a re-run costs one cached memo read), and it does not loop:
   * `_active` converges in at most two runs, and the effect already both read
   * and wrote `_active` before this change.
   */
  private _synchronizeActiveWidget(): void {
    const active = this._active();
    if (active && this._enabledWidgets().includes(active)) return;
    this._focusFirstWidget();
  }

  private _focusFirstWidget(): void {
    this._active.set(this._enabledWidgets()[0] ?? null);
  }

  private _disconnectObserver(): void {
    this._observer?.disconnect();
    this._observer = undefined;
  }
}

/** @internal Resolves the nearest editor's projected-toolbar roving registry. */
export const MLV_EDITOR_TOOLBAR_ROVING =
  new InjectionToken<MlvEditorToolbarRovingRegistry>(
    'MLV_EDITOR_TOOLBAR_ROVING',
  );

interface MlvEditorOverlayEntry {
  readonly root: HTMLElement;
  close: () => void;
  /** Focus listeners for this one overlay root, released when it is removed. */
  readonly listeners: Subscription;
}

/**
 * Internal per-editor registry for CDK overlay roots owned by toolbar controls.
 * It is intentionally excluded from the public barrel: public controls use it
 * only to preserve the editor's composite focus boundary.
 */
@Injectable()
export class MlvEditorOverlayRegistry {
  private readonly _entries = new Map<HTMLElement, MlvEditorOverlayEntry>();
  private _onFocusIn: ((event: FocusEvent) => void) | undefined;
  private _onFocusOut: ((event: FocusEvent) => void) | undefined;

  /**
   * @private Net for the whole registry. Each entry is released the moment its
   * overlay is removed — a destroy-scoped lifetime alone would hold every
   * overlay ever opened — but this guarantees release even if a consumer never
   * calls `destroy()` or `closeAll()`. The registry is provided by the editor
   * component, so this ref is the editor's.
   */
  private readonly _destroyRef = inject(DestroyRef);

  /** @internal Wires the nearest editor's composite focus handlers. */
  setFocusHandlers(
    onFocusIn: (event: FocusEvent) => void,
    onFocusOut: (event: FocusEvent) => void,
  ): void {
    this._onFocusIn = onFocusIn;
    this._onFocusOut = onFocusOut;
  }

  /** @internal Registers a rendered overlay root and returns its teardown. */
  register(root: HTMLElement, close: () => void): () => void {
    const existing = this._entries.get(root);
    if (existing) {
      existing.close = close;
      return () => this._remove(root);
    }
    // Capture phase, matching the editor host's own boundary listeners: an
    // overlay's content may stop focus events on its way back up, and the
    // composite has to see the crossing regardless.
    const listeners = new Subscription();
    listeners.add(
      fromEvent<FocusEvent>(root, 'focusin', { capture: true })
        .pipe(takeUntilDestroyed(this._destroyRef))
        .subscribe((event) => this._onFocusIn?.(event)),
    );
    listeners.add(
      fromEvent<FocusEvent>(root, 'focusout', { capture: true })
        .pipe(takeUntilDestroyed(this._destroyRef))
        .subscribe((event) => this._onFocusOut?.(event)),
    );
    this._entries.set(root, { root, close, listeners });
    return () => this._remove(root);
  }

  /** @internal Whether a node is rendered in an editor-owned overlay. */
  contains(node: Node | null): boolean {
    if (!node) return false;
    return [...this._entries.values()].some((entry) =>
      entry.root.contains(node),
    );
  }

  /** @internal Closes all owned overlays and removes their listeners. */
  closeAll(): void {
    for (const entry of [...this._entries.values()]) {
      try {
        entry.close();
      } catch {
        // A third-party overlay must not prevent remaining editor cleanup.
      } finally {
        this._remove(entry.root);
      }
    }
  }

  /** @internal Removes listener resources without invoking overlay close callbacks. */
  destroy(): void {
    for (const entry of [...this._entries.values()]) this._remove(entry.root);
  }

  private _remove(root: HTMLElement): void {
    const entry = this._entries.get(root);
    if (!entry) return;
    this._entries.delete(root);
    entry.listeners.unsubscribe();
  }
}

/** @internal Injection token for editor-owned overlay registration. */
export const MLV_EDITOR_OVERLAY_REGISTRY =
  new InjectionToken<MlvEditorOverlayRegistry>('MLV_EDITOR_OVERLAY_REGISTRY');

/**
 * Internal per-editor abort registry for uploads that outlive an interaction.
 * It remains non-public until the upload coordinator consumes it in Task 11.
 */
@Injectable()
export class MlvEditorUploadAbortRegistry {
  private readonly _aborters = new Set<() => void>();

  /** @internal Registers one in-flight upload abort callback. */
  register(abort: () => void): () => void {
    this._aborters.add(abort);
    return () => this._aborters.delete(abort);
  }

  /** @internal Aborts every registered upload without allowing one failure to stop cleanup. */
  abortAll(): void {
    for (const abort of [...this._aborters]) {
      this._aborters.delete(abort);
      try {
        abort();
      } catch {
        // A transport abort is best effort; all remaining uploads still stop.
      }
    }
  }
}

/** @internal Injection token for the editor-owned upload abort registry. */
export const MLV_EDITOR_UPLOAD_ABORT_REGISTRY =
  new InjectionToken<MlvEditorUploadAbortRegistry>(
    'MLV_EDITOR_UPLOAD_ABORT_REGISTRY',
  );
