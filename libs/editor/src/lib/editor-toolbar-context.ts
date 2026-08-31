import { Injectable, InjectionToken, signal } from '@angular/core';
import type { Signal, WritableSignal } from '@angular/core';
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

  /** @internal Resolves the single effective tab stop, even during DOM mutations. */
  isActive(widget: HTMLElement): boolean {
    this._domStateRevision();
    const active = this._active();
    const effectiveActive =
      active && this._enabled(active)
        ? active
        : (this._enabledWidgets()[0] ?? null);
    return (
      !this._disabled() && effectiveActive === widget && this._enabled(widget)
    );
  }

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

  private _enabledWidgets(): readonly HTMLElement[] {
    return this._widgets()
      .filter((widget) => this._enabled(widget))
      .sort((left, right) => {
        const position = left.compareDocumentPosition(right);
        return position & 4 ? -1 : position & 2 ? 1 : 0;
      });
  }

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

  private _synchronizeActiveWidget(): void {
    const active = this._active();
    if (active && this._enabled(active)) return;
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
  readonly onFocusIn: (event: FocusEvent) => void;
  readonly onFocusOut: (event: FocusEvent) => void;
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
    const onFocusIn = (event: FocusEvent) => this._onFocusIn?.(event);
    const onFocusOut = (event: FocusEvent) => this._onFocusOut?.(event);
    const entry: MlvEditorOverlayEntry = { root, close, onFocusIn, onFocusOut };
    this._entries.set(root, entry);
    root.addEventListener('focusin', onFocusIn, true);
    root.addEventListener('focusout', onFocusOut, true);
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
    entry.root.removeEventListener('focusin', entry.onFocusIn, true);
    entry.root.removeEventListener('focusout', entry.onFocusOut, true);
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
