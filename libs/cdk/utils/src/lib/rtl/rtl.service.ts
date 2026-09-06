import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Directionality } from '@angular/cdk/bidi';
import {
  DOWN_ARROW,
  LEFT_ARROW,
  RIGHT_ARROW,
  UP_ARROW,
} from '@angular/cdk/keycodes';
import {
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injectable,
  Injector,
  PLATFORM_ID,
  signal,
  untracked,
} from '@angular/core';
import type { Signal } from '@angular/core';

export type MlvDirection = 'ltr' | 'rtl';

/** Anything the direction helpers accept as a DOM target. */
export type MlvDirectionTarget =
  | Element
  | ElementRef<Element>
  | null
  | undefined;

export type MlvArrowKey =
  | typeof LEFT_ARROW
  | typeof RIGHT_ARROW
  | typeof UP_ARROW
  | typeof DOWN_ARROW;

/**
 * Owns the app direction and adapts arrow-key events to logical movement.
 *
 * Manual keyboard handlers can switch on Angular CDK key-code constants after
 * calling `normalizeArrowKey`. Horizontal keys are mirrored in RTL; vertical
 * keys retain their meaning in both directions.
 */
@Injectable({ providedIn: 'root' })
export class MlvRtlService {
  private readonly _document = inject(DOCUMENT);
  private readonly _directionality = inject(Directionality);

  /** @private Whether this service is running in a browser, not on the server. */
  private readonly _isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly _direction = signal<MlvDirection>(
    this._directionality.value,
  );
  readonly direction = this._direction.asReadonly();
  readonly rtl = computed(() => this.direction() === 'rtl');

  constructor() {
    this._syncDirection(this.direction());
  }

  setDirection(direction: MlvDirection): void {
    if (this.direction() === direction) return;
    this._direction.set(direction);
    this._syncDirection(direction);
  }

  setRtl(rtl: boolean): void {
    this.setDirection(rtl ? 'rtl' : 'ltr');
  }

  toggle(): void {
    this.setRtl(!this.rtl());
  }

  /**
   * Converts DOM/legacy arrow events to CDK key-code constants and mirrors
   * only the horizontal axis when `direction` is RTL.
   *
   * The parameter is a *resolved* direction rather than an element on purpose.
   * Direction is scoped — a handler inside a `dir="rtl"` subtree (or inside a
   * CDK overlay pane, which is stamped with its own `dir`) must mirror even
   * while the document is LTR — but resolving that scope means walking
   * `parentElement` to the nearest explicit `dir`, and a keydown handler runs
   * on every keystroke. So the caller resolves once, in a field initializer:
   *
   * ```ts
   * private readonly _direction = this._rtlService.elementDirection(
   *   inject(ElementRef<HTMLElement>),
   * );
   * // …
   * const key = this._rtlService.normalizeArrowKey(event, this._direction());
   * ```
   *
   * {@link elementDirection} caches that walk behind one shared `dir`
   * `MutationObserver` and re-runs it only when a `dir` attribute actually
   * changes; taking an element here instead would re-walk the DOM per
   * keystroke, and per component would duplicate a signal most of them already
   * hold for a horizontal `FocusKeyManager` or for measured geometry.
   *
   * Omitting `direction` keeps the global {@link rtl} reading. That is correct
   * only for a handler that never branches on `ArrowLeft`/`ArrowRight` — a
   * vertical-only group — where mirroring is a no-op either way.
   */
  normalizeArrowKey(
    event: KeyboardEvent,
    direction?: MlvDirection,
  ): MlvArrowKey | null {
    const key = this._getArrowKeyCode(event);
    if (key === null) return null;
    if (key !== LEFT_ARROW && key !== RIGHT_ARROW) return key;

    const rtl = direction === undefined ? this.rtl() : direction === 'rtl';

    if (key === LEFT_ARROW) return rtl ? RIGHT_ARROW : LEFT_ARROW;
    return rtl ? LEFT_ARROW : RIGHT_ARROW;
  }

  /**
   * Resolves the direction that actually applies to `target`.
   *
   * Direction can be scoped: an element inside a `[dir="rtl"]` subtree is RTL
   * even while the document is LTR. Overlays are the reason this matters most
   * — a CDK overlay is portaled to `<body>`, outside the scope its trigger sits
   * in, so it must be told the trigger's direction explicitly.
   *
   * Walks to the nearest ancestor carrying an explicit `dir="ltr"`/`dir="rtl"`
   * (`dir="auto"` is transparent and the walk continues past it) and falls back
   * to the global {@link direction} when nothing scopes the element.
   */
  resolveDirection(target: MlvDirectionTarget): MlvDirection {
    const element = this._toElement(target);

    for (
      let node: Element | null = element;
      node;
      node =
        node.parentElement ?? (node.getRootNode() as ShadowRoot).host ?? null
    ) {
      const dir = node.getAttribute?.('dir')?.toLowerCase();
      if (dir === 'rtl' || dir === 'ltr') return dir;
    }

    return this.direction();
  }

  /**
   * A signal of the direction applying to `target`, recomputed whenever the
   * global direction changes or a `dir` attribute changes anywhere in the
   * document.
   *
   * Use it for anything that must be re-derived on a direction flip — most
   * importantly JS-measured geometry (sliding indicators, pills, thumbs), which
   * no `ResizeObserver` reports because a mirrored element keeps its size, and
   * the direction handed to {@link normalizeArrowKey} or to a horizontal
   * `FocusKeyManager`, where re-walking the DOM per keystroke is the
   * alternative.
   */
  elementDirection(target: MlvDirectionTarget): Signal<MlvDirection> {
    this._observeDirAttributes();
    return computed(() => {
      this._revision();
      return this.resolveDirection(target);
    });
  }

  /**
   * Calls `onChange` whenever the direction applying to `target` changes, and
   * returns a teardown that stops the watch.
   *
   * {@link elementDirection} gives a signal; this pushes, so it works from an
   * imperative API with no reactive consumer — the case it exists for is a CDK
   * overlay, created inside a service method and living until it is disposed.
   * An open overlay is portaled outside its trigger's `[dir]` scope, so nothing
   * re-mirrors it when the direction flips underneath: the pane keeps its stale
   * `dir` and a connected position strategy keeps resolving `start`/`end`
   * against the direction the overlay was opened with.
   *
   * The current direction is not reported — only changes from it.
   */
  watchDirection(
    target: MlvDirectionTarget,
    onChange: (direction: MlvDirection) => void,
  ): () => void {
    const scoped = this.elementDirection(target);
    let previous = untracked(scoped);

    // Callers are imperative APIs that may themselves be driven from an effect
    // (a popup trigger opening its overlay from one), and `effect()` refuses to
    // be created inside a reactive context.
    const ref = untracked(() =>
      effect(
        () => {
          const next = scoped();
          if (next === previous) return;
          previous = next;
          onChange(next);
        },
        { injector: this._injector },
      ),
    );

    return () => ref.destroy();
  }

  /**
   * @private Root injector, used to own the effects {@link watchDirection}
   * creates outside any component's injection context.
   */
  private readonly _injector = inject(Injector);

  /**
   * @private This service's own lifetime — the root environment injector's,
   * since it is `providedIn: 'root'`. Owns the shared `dir` observer so no
   * single caller's destruction can tear it down for the others.
   */
  private readonly _destroyRef = inject(DestroyRef);

  /**
   * @private Bumped by the shared `dir` `MutationObserver`; the dependency that
   * makes {@link elementDirection} recompute on a scoped direction change.
   */
  private readonly _revision = signal(0);

  /** @private Whether the shared `dir` observer is already running. */
  private _dirObserver: MutationObserver | null = null;

  /**
   * @private Starts one document-wide observer for `dir` attribute mutations,
   * shared by every {@link elementDirection} caller. No-op outside a browser or
   * once already started.
   *
   * Teardown hangs off this service's own {@link DestroyRef} — the root
   * environment injector's, because the service is `providedIn: 'root'` — not
   * off whichever caller happened to start it. Injecting the `DestroyRef` here
   * would resolve the *first* caller's, so destroying that one component would
   * disconnect the observer every other `elementDirection` signal still depends
   * on and leave them stale on a scoped `dir` change.
   *
   * The platform check is the load-bearing one. `typeof MutationObserver` alone
   * is not enough: an SSR process that has a DOM shim loaded (a jsdom-hosted
   * render, a server that polyfills for a dependency) passes that test, and
   * `observe()` then rejects the server document's element because it is not a
   * browser `Node` — taking the whole server render down with it.
   */
  private _observeDirAttributes(): void {
    if (!this._isBrowser) return;
    if (this._dirObserver || typeof MutationObserver === 'undefined') return;

    const root = this._document.documentElement;
    if (!root) return;

    const observer = new MutationObserver(() =>
      this._revision.update((revision) => revision + 1),
    );
    observer.observe(root, {
      attributes: true,
      attributeFilter: ['dir'],
      subtree: true,
    });
    this._dirObserver = observer;

    this._destroyRef.onDestroy(() => {
      observer.disconnect();
      this._dirObserver = null;
    });
  }

  /** @private Narrows a direction target to its DOM element, if any. */
  private _toElement(target: MlvDirectionTarget): Element | null {
    if (!target) return null;
    return target instanceof ElementRef ? target.nativeElement : target;
  }

  private _syncDirection(direction: MlvDirection): void {
    this._document.documentElement.dir = direction;
    this._revision.update((revision) => revision + 1);

    if (this._directionality.value !== direction) {
      this._directionality.valueSignal.set(direction);
      this._directionality.change.emit(direction);
    }
  }

  private _getArrowKeyCode(event: KeyboardEvent): MlvArrowKey | null {
    switch (event.key) {
      case 'ArrowLeft':
        return LEFT_ARROW;
      case 'ArrowRight':
        return RIGHT_ARROW;
      case 'ArrowUp':
        return UP_ARROW;
      case 'ArrowDown':
        return DOWN_ARROW;
    }

    switch (event.keyCode) {
      case LEFT_ARROW:
        return LEFT_ARROW;
      case RIGHT_ARROW:
        return RIGHT_ARROW;
      case UP_ARROW:
        return UP_ARROW;
      case DOWN_ARROW:
        return DOWN_ARROW;
      default:
        return null;
    }
  }
}
