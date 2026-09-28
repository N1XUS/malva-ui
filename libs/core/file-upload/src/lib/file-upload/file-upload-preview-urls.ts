import type { AfterRenderRef } from '@angular/core';
import {
  afterNextRender,
  EnvironmentInjector,
  inject,
  Injectable,
} from '@angular/core';

/**
 * Tracks, application-wide, the preview object URLs `mlv-file-upload` creates
 * for picked and dropped images, and revokes each one once no mounted upload
 * holds it in its value any more.
 *
 * Ownership follows the URL string, not the instance that created it nor the
 * entry object carrying it. The value an upload shows outlives the upload in
 * the consumer's hands — a form, a signal, a dialog result — so an upload
 * destroyed while its value still holds a preview releases it **without**
 * revoking it, and the next upload mounted with that value takes it over. What
 * revokes a URL is a mounted upload seeing it leave its value (`removeFile`, a
 * single-file replace, an external write) while no other mounted upload still
 * holds it.
 *
 * That revoke is deferred to the end of the next render and re-checked there.
 * Uploads reconcile from constructor effects that run in view order, so a file
 * moved between two mounted uploads in one tick — `a.set([]); b.set(moved)`,
 * or a copy into `b` followed by `a.removeFile()` — briefly has no holder:
 * the source releases it before the target retains it. Revoking at that zero
 * would hand the target a dead URL (a new `<img>` on a revoked `blob:` URL
 * fails to load). By the end of the render every mounted upload has
 * reconciled, so a count still at zero is a real drop.
 *
 * A `previewUrl` the consumer supplies is never registered, so it is never
 * revoked.
 *
 * Server rendering: `afterNextRender` never runs there, so a pending revoke
 * would never flush — but nothing is pending on the server, because a URL is
 * created only from a browser `change` / `drop` event, so none is ever
 * registered, retained or released.
 *
 * Application teardown: `ApplicationRef.destroy()` marks the root injector
 * destroyed before it destroys the views, so an upload destroyed there that
 * drops a URL cannot schedule a render hook (`afterNextRender` on a destroyed
 * injector throws NG0205, which would escape the teardown and skip every later
 * destroy hook). No upload can mount any more, so the pending URLs are revoked
 * at once.
 *
 * Root-provided so ownership crosses instances (an upload inside an `@if` that
 * is re-created with the same value). Internal to `@malva-ui/core/file-upload`;
 * not part of the public barrel.
 */
@Injectable({ providedIn: 'root' })
export class MlvFileUploadPreviewUrls {
  /**
   * @private Root injector the deferred flush is registered against; this is
   * a root service, so there is no view to scope the render hook to. Its
   * `destroyed` flag tells an application teardown apart.
   */
  private readonly _injector = inject(EnvironmentInjector);

  /**
   * @private Every preview URL created here and not yet revoked, mapped to the
   * number of mounted uploads whose value references it. `0` is either a URL
   * a destroyed upload handed on, waiting for an upload mounted with it, or a
   * dropped URL waiting in {@link _pendingRevoke}. A handed-on entry stays
   * until an upload holds it and drops it; a consumer that revokes the URL
   * itself leaves only the string behind.
   */
  private readonly _holders = new Map<string, number>();

  /**
   * @private URLs whose count a drop took to zero since the last flush. The
   * flush revokes the ones still at zero; one an upload retained in between
   * is skipped. A URL handed on at destroy is never added.
   */
  private readonly _pendingRevoke = new Set<string>();

  /** @private The scheduled flush of {@link _pendingRevoke}, if any. */
  private _flushRef: AfterRenderRef | null = null;

  /**
   * Creates and registers a preview URL for `file`. No upload holds it until
   * one retains it.
   *
   * @param file - The picked or dropped image.
   * @returns The new `blob:` URL.
   */
  create(file: File): string {
    const url = URL.createObjectURL(file);
    this._holders.set(url, 0);
    return url;
  }

  /**
   * Whether `url` was created here and is not yet revoked — including a URL
   * whose revoke is pending, so an upload that receives it in the same tick
   * can still retain it.
   *
   * @param url - A `previewUrl` read from an upload's value.
   */
  owns(url: string): boolean {
    return this._holders.has(url);
  }

  /**
   * Records one more mounted upload whose value references `url`. A URL whose
   * revoke is pending is then kept by the flush.
   *
   * @param url - A URL for which {@link owns} is `true`.
   */
  retain(url: string): void {
    const count = this._holders.get(url);
    if (count !== undefined) this._holders.set(url, count + 1);
  }

  /**
   * Records one mounted upload no longer referencing `url`.
   *
   * @param url - A URL the caller retained.
   * @param revoke - `true` when the URL left the upload's value: once no
   *   mounted upload holds it, it is revoked at the end of the next render
   *   unless an upload retains it before then. `false` when the upload is
   *   destroyed with the URL still in its value: it is kept for the next
   *   upload mounted with that value.
   */
  release(url: string, revoke: boolean): void {
    const count = this._holders.get(url);
    if (count === undefined) return;
    const remaining = Math.max(0, count - 1);
    this._holders.set(url, remaining);
    if (remaining === 0 && revoke) {
      this._pendingRevoke.add(url);
      this._scheduleFlush();
    }
  }

  /**
   * @private Schedules one flush of {@link _pendingRevoke} after the next
   * render. `afterNextRender` also notifies the zoneless scheduler, so a
   * release outside change detection (a `removeFile` call from a click
   * handler) still gets a render to flush after.
   *
   * During an application teardown the root injector is already destroyed
   * (the views are destroyed after it is marked), so no hook can be registered
   * and no upload can mount to retain a URL: flush at once instead. Checked
   * before the scheduled-flush guard, because a flush scheduled before the
   * teardown never runs — the injector destroys its render hooks after the
   * views.
   */
  private _scheduleFlush(): void {
    if (this._injector.destroyed) {
      this._flushPendingRevokes();
      return;
    }
    if (this._flushRef) return;
    this._flushRef = afterNextRender(() => this._flushPendingRevokes(), {
      injector: this._injector,
    });
  }

  /**
   * @private Revokes every pending URL still held by no mounted upload once
   * the render has let every mounted upload reconcile; skips one an upload
   * retained since it was dropped.
   */
  private _flushPendingRevokes(): void {
    this._flushRef = null;
    for (const url of this._pendingRevoke) {
      if (this._holders.get(url) !== 0) continue;
      this._holders.delete(url);
      URL.revokeObjectURL(url);
    }
    this._pendingRevoke.clear();
  }
}
