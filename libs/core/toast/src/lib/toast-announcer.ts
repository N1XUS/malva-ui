import { inject, Injectable } from '@angular/core';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import type { MlvToastPoliteness } from './toast.types';
import { joinAnnouncementParts } from './toast.types';

/** @internal One item's announcement, waiting for `LiveAnnouncer` to write it. */
interface MlvPendingToastAnnouncement {
  /** The text resolved for the item. */
  readonly message: string;
  /** The politeness resolved for the item. */
  readonly politeness: MlvToastPoliteness;
}

/**
 * Announces toast and notification items so that items shown together are all
 * heard, application-wide.
 *
 * `LiveAnnouncer` holds one pending message: `announce()` cancels any message
 * it has not yet written (it writes 100 ms after the call), so two items shown
 * in the same tick — an error and a success from one upload handler — used to
 * announce only the second. Chaining the second call on the promise the first
 * returns does not help: that promise resolves in the task that writes the
 * first text, and the next `announce()` clears the region synchronously, so the
 * first text is gone before any rendering opportunity and no screen reader can
 * read it.
 *
 * Instead, every item whose announcement is still waiting joins one batch, and
 * each new item re-announces the whole batch, which `LiveAnnouncer` writes
 * once. Assertive items lead, in the order shown, then polite ones; the batch
 * is assertive when any item in it is, since that item interrupts the user
 * anyway, and polite otherwise. A batch of one is announced verbatim; a larger
 * one is joined with `joinAnnouncementParts()`. The batch closes when its text
 * is written, so an item shown after that point is announced on its own. It is
 * not withdrawn when an item in it closes: an item closed before the write is
 * still read, as part of the batch.
 *
 * Root-provided so `MlvToastService`, `MlvNotificationService` and any other
 * `MlvAbstractToastService` subclass share one batch — they share the one root
 * `LiveAnnouncer`, and a notification shown beside a toast would otherwise
 * cancel it. Another caller of `LiveAnnouncer` (the editor, page route focus)
 * still replaces a batch it lands beside; that is `LiveAnnouncer`'s own
 * contract.
 *
 * Internal to `@malva-ui/core/toast`; not part of the public barrel.
 */
@Injectable({ providedIn: 'root' })
export class MlvToastAnnouncer {
  /** @private The CDK service owning the one persistent live region. */
  private readonly _liveAnnouncer = inject(LiveAnnouncer);

  /** @private Items whose announcement `LiveAnnouncer` has not written yet. */
  private _pending: MlvPendingToastAnnouncement[] = [];

  /**
   * Adds one item's announcement to the waiting batch and re-announces the
   * batch.
   *
   * @param message - The text resolved for the item.
   * @param politeness - The politeness resolved for the item.
   */
  announce(message: string, politeness: MlvToastPoliteness): void {
    const batch = this._pending;
    batch.push({ message, politeness });

    const ordered = [
      ...batch.filter((item) => item.politeness === 'assertive'),
      ...batch.filter((item) => item.politeness !== 'assertive'),
    ];
    const text =
      ordered.length === 1
        ? ordered[0].message
        : joinAnnouncementParts(ordered.map((item) => item.message));

    // `LiveAnnouncer` resolves one shared promise when it writes, and this
    // reaction runs in that same task, before any later task can show an item
    // — so the batch closes exactly at the write. Every item in the batch
    // registered a reaction on that promise; the identity check makes all but
    // the first a no-op. `Promise.resolve` hands back that same native promise,
    // so the timing is unchanged; it is there for a test double whose
    // `announce()` returns `undefined`, on which `.then` would throw out of
    // `show()` after its item was already rendered. Behind such a double the
    // batch closes on the next microtask, so items shown in one synchronous
    // run still arrive as one call.
    void Promise.resolve(
      this._liveAnnouncer.announce(text, ordered[0].politeness),
    ).then(() => {
      if (this._pending === batch) {
        this._pending = [];
      }
    });
  }
}
