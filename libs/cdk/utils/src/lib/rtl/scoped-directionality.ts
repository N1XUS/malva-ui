import { Directionality, type Direction } from '@angular/cdk/bidi';
import {
  DestroyRef,
  effect,
  ElementRef,
  EventEmitter,
  inject,
  Injector,
  linkedSignal,
  type Provider,
} from '@angular/core';
import { MlvRtlService } from './rtl.service';

/**
 * @internal Provides a CDK `Directionality` that reports the direction applying
 * to **the providing element** — the nearest `[dir]` above it — rather than the
 * document's.
 *
 * `@angular/aria` patterns (`TabList`, `Toolbar`, `Tree`, `Listbox`, `Grid`,
 * `GridCell`, …) inject `Directionality` to decide which horizontal arrow key
 * means _next_ (or, in a tree, _expand_). The root-provided instance reports
 * only the document direction, so inside a `[dir="rtl"]` wrapper on an
 * otherwise-LTR page the component's logical CSS mirrors while aria's keys do
 * not: one component, two directions. Put this in the `providers` /
 * `viewProviders` of the Malva host that renders the pattern and the two agree.
 *
 * This is the only sanctioned way a library component touches the CDK token:
 * it **provides** it, never injects it, and `MlvRtlService` — which this reads —
 * still owns the document `dir` and the global CDK sync.
 * `.claude/rules/rtl.md` § _Sanctioned `Directionality` providers_ lists every
 * host and the rules for adding one.
 *
 * - `value` / `valueSignal` follow `MlvRtlService.elementDirection(host)`: a
 *   scoped `[dir]` above the host, else the global direction, re-resolved when
 *   any `dir` attribute changes. They read **through** to it rather than being
 *   fed by an effect, so a key pressed right after a flip — before any change
 *   detection has run — already sees the new direction.
 * - Nothing reads the direction while the provider is constructed. A host in
 *   an embedded view (`@if`, `@for`, a template) is built before its nodes are
 *   inserted, and a read then would cache the document direction under a
 *   static `[dir]` scope that never changes. Aria 22.1.8 reads
 *   `valueSignal` only in the computeds its keyboard handlers consult, which
 *   run after insertion.
 * - `change` emits on each change after the first reading — taken by an
 *   effect during the first change detection — for CDK consumers that
 *   subscribe rather than read (drag-drop).
 * - `change` completes when the providing node is destroyed. A factory
 *   provider's own `ngOnDestroy` is never called by Angular (destroy hooks are
 *   registered for class providers only), so the teardown hangs off the node's
 *   `DestroyRef` instead.
 *
 * ### Placement
 *
 * - Prefer `viewProviders` when the aria pattern sits in the component's own
 *   template: consumer content projected into the component then keeps
 *   whatever `Directionality` it resolved before.
 * - A pattern applied as a **host directive** resolves against the node's
 *   `providers` only — `viewProviders` are invisible to directives on the host
 *   node itself — so there it has to be `providers`, which projected content
 *   also sees. It reports the host's direction; a projected descendant under
 *   its own `dir` island needs its own provider or CDK `Dir`.
 *
 * ### Why not CDK's `Dir` directive
 *
 * `@angular/cdk/bidi` ships `Dir`, which provides `Directionality` for a
 * `[dir]` subtree, so "just import `Dir`" looks like the smaller move. It is
 * not available here:
 *
 * - `Dir` is selector-driven (`[dir]`) and standalone, so it only exists where
 *   a **consumer's** component both writes `dir` and imports it. A `dir="rtl"`
 *   written on a plain wrapper — or by the host page, outside Angular entirely
 *   — creates no `Dir` and provides nothing. The `dir` attribute is this
 *   library's direction API (`.claude/rules/rtl.md` → _Public API_), so it has
 *   to work without the consumer opting into a CDK directive.
 * - `Dir` reads only its own `dir` **input**; it does not observe an ancestor's
 *   attribute changing. `MlvRtlService.elementDirection()` does, which is what
 *   lets a host re-mirror its keys on a live flip.
 * - Putting `dir` on the host to summon `Dir` would mean the component knowing
 *   its direction and re-emitting it — a `direction` input, which the same
 *   rule forbids.
 *
 * A consumer who _has_ imported `Dir` on a wrapper ends up with two providers
 * in the chain. They agree (both resolve the same nearest `dir`), and the
 * nearer one — this — wins, so the extra provider is inert.
 *
 * @example
 * ```ts
 * @Component({
 *   // `@angular/aria`'s `TabList`, in this template, injects `Directionality`.
 *   viewProviders: [provideMlvScopedDirectionality()],
 * })
 * ```
 */
export function provideMlvScopedDirectionality(): Provider {
  return { provide: Directionality, useFactory: scopedDirectionality };
}

/**
 * @private Factory behind {@link provideMlvScopedDirectionality}. Runs in the
 * providing node's injection context, so `ElementRef` is that node's host.
 */
function scopedDirectionality(): Directionality {
  const injector = inject(Injector);
  const direction = inject(MlvRtlService).elementDirection(
    inject(ElementRef<HTMLElement>),
  );
  // A `linkedSignal`, not a `computed`: `Listbox` calls
  // `valueSignal.asReadonly()`, which only a writable signal has. Nothing here
  // writes it, so it stays a read-through of `direction`.
  const valueSignal = linkedSignal<Direction>(() => direction());
  const change = new EventEmitter<Direction>();
  // Deliberately not read here. A host inside an embedded view (`@if`,
  // `@for`, a template) is constructed before its nodes are inserted, so a
  // read now would resolve a detached node: the document direction, cached
  // until some `dir` attribute changes — and nothing changes under a static
  // `[dir]` scope. The effect's first run happens during change detection,
  // after insertion, and only records the baseline.
  let previous: Direction | undefined;

  effect(
    () => {
      const next = valueSignal();
      if (previous === undefined) {
        previous = next;
        return;
      }
      if (next === previous) return;
      previous = next;
      change.emit(next);
    },
    { injector },
  );

  const complete = (): void => change.complete();
  inject(DestroyRef).onDestroy(complete);

  return {
    get value(): Direction {
      return valueSignal();
    },
    valueSignal,
    change,
    ngOnDestroy: complete,
  };
}
