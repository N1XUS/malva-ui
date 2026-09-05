import { computed, signal, type Signal } from '@angular/core';
import type { MlvTaskboardI18n } from '@malva-ui/i18n';
import type { MlvTaskboardDragSession } from '../taskboard-drag-session';
import { sameMlvTaskboardKey as sameKey } from '../taskboard-keys';
import type {
  MlvTaskboardDenialReason,
  MlvTaskboardKey,
  MlvTaskboardMoveCancelReason,
  MlvTaskboardMoveRequest,
} from '../taskboard.types';
import type { MlvTaskboardDropPreview } from './taskboard-sortable';

/** The card keyboard focus currently rests on. */
export interface MlvTaskboardKeyboardFocus {
  readonly columnId: MlvTaskboardKey;
  readonly swimlaneId: MlvTaskboardKey | undefined;
  readonly itemId: MlvTaskboardKey;
}

/**
 * The slot a keyboard grab currently aims at. `index` counts the target
 * cell's cards with the grabbed card removed, exactly like a pointer drag's
 * drop target, so the source cell offers one slot fewer than every other.
 */
export interface MlvTaskboardKeyboardTarget {
  readonly columnId: MlvTaskboardKey;
  readonly swimlaneId: MlvTaskboardKey | undefined;
  readonly index: number;
}

/**
 * One logical navigation command. The board resolves a physical arrow key to
 * one of these through `MlvRtlService.normalizeArrowKey`, so the controller
 * never sees a direction that has to be mirrored.
 */
export type MlvTaskboardKeyboardStep =
  | 'previous-column'
  | 'next-column'
  | 'previous-card'
  | 'next-card'
  | 'first-card'
  | 'last-card';

/** Board-owned geometry and services the keyboard state machine drives. */
export interface MlvTaskboardKeyboardHost<TItem> {
  /** Navigable column ids in rendered order; collapsed columns are omitted. */
  columnIds(): readonly MlvTaskboardKey[];
  /**
   * Navigable lane ids in rendered order, collapsed lanes omitted. A board
   * without swimlanes reports the single unlaned row as `[undefined]`.
   */
  swimlaneIds(): readonly (MlvTaskboardKey | undefined)[];
  /** Rendered card keys of one column/lane cell, in render order. */
  cardsIn(
    columnId: MlvTaskboardKey,
    swimlaneId: MlvTaskboardKey | undefined,
  ): readonly MlvTaskboardKey[];
  /**
   * Builds the same drag session a pointer drag builds, or `null` when the
   * card cannot be grabbed at all.
   */
  createSession(itemId: MlvTaskboardKey): MlvTaskboardDragSession<TItem> | null;
  /** Publishes the slot the board renders its drop indicator at. */
  setDropPreview(preview: MlvTaskboardDropPreview<TItem> | null): void;
  /** Runs the guarded commit flow the pointer path also enters. */
  commitMove(request: MlvTaskboardMoveRequest<TItem>): void;
  /**
   * Reports a grab that ended without a replacement collection. The grabbed
   * card travels with it because an abandoned grab has no authorised request
   * to name the card from.
   */
  cancelMove(
    reason: MlvTaskboardMoveCancelReason,
    itemId: MlvTaskboardKey,
  ): void;
  /** Replaces the polite live-region text with one localized message. */
  announce(
    key: keyof MlvTaskboardI18n,
    params?: Record<string, string | number>,
  ): void;
  /** Human column label used in announcements. */
  columnLabel(columnId: MlvTaskboardKey): string;
  /**
   * Localized lane qualifier for announcements, or `''` on a board without
   * swimlanes — the announcement strings collapse the empty slot away.
   */
  laneLabel(swimlaneId: MlvTaskboardKey | undefined): string;
  /** Human card label used in announcements. */
  cardLabel(itemId: MlvTaskboardKey): string;
  /**
   * The localized phrase for a reason the drag session recorded while it
   * enumerated the board. The controller never derives a reason of its own:
   * it reads the one the session refused with, so an announcement cannot
   * contradict the refusal it describes.
   */
  denialReason(reason: MlvTaskboardDenialReason): string;
  /** Scrolls a newly focused card into view and moves DOM focus onto it. */
  focusCard(focus: MlvTaskboardKeyboardFocus): void;
}

/** @private One live keyboard grab: its session and its current target slot. */
interface MlvTaskboardKeyboardGrab<TItem> {
  readonly session: MlvTaskboardDragSession<TItem>;
  readonly target: MlvTaskboardKeyboardTarget;
}

/**
 * Package-private roving-focus and keyboard-grab state machine.
 *
 * It owns no DOM and no board data: every geometry question goes to the host,
 * so it can be unit-tested against a fake board. A grab builds the very drag
 * session a pointer drag builds and commits through the same guarded flow, so
 * the two input paths cannot drift apart.
 */
export class MlvTaskboardKeyboardController<TItem> {
  /** @private Where logical focus sits, independent of the focused element. */
  private readonly _focus = signal<MlvTaskboardKeyboardFocus | null>(null);

  /** @private The live grab, or `null` when nothing is picked up. */
  private readonly _grab = signal<MlvTaskboardKeyboardGrab<TItem> | null>(null);

  constructor(private readonly _host: MlvTaskboardKeyboardHost<TItem>) {}

  /** The card that owns the board's single tab stop. */
  readonly focus: Signal<MlvTaskboardKeyboardFocus | null> =
    this._focus.asReadonly();

  /** Whether a card is currently picked up. */
  readonly grabbed = computed(() => this._grab() !== null);

  /** The slot a live grab aims at, or `null` when nothing is grabbed. */
  readonly target = computed<MlvTaskboardKeyboardTarget | null>(
    () => this._grab()?.target ?? null,
  );

  /** Records focus arriving on a card, without moving the DOM focus again. */
  noteFocus(focus: MlvTaskboardKeyboardFocus): void {
    if (this._grab() !== null) return;
    this._focus.set(focus);
  }

  /**
   * Moves the grab target when a card is picked up, and the roving focus
   * otherwise. Returns whether anything moved, so the board only calls
   * `preventDefault()` for a key it actually consumed.
   */
  step(step: MlvTaskboardKeyboardStep): boolean {
    return this._grab() === null
      ? this._stepFocus(step)
      : this._stepTarget(step);
  }

  /** Picks the focused card up, or commits the slot a live grab aims at. */
  toggleGrab(): boolean {
    const grab = this._grab();
    if (grab === null) return this._beginGrab();
    if (this._isSourceSlot(grab, grab.target)) {
      // The card is aimed at the slot it already fills. That is not a refusal
      // and not a cancellation: the grab simply ends, the board is untouched,
      // and nothing is committed.
      this._grab.set(null);
      this._host.setDropPreview(null);
      this._host.announce('releasedInPlace', {
        label: this._host.cardLabel(grab.session.card.id),
      });
      return true;
    }
    const request = grab.session.requestFor(
      grab.target.columnId,
      grab.target.swimlaneId,
      grab.target.index,
    );
    if (request === undefined) {
      // A denied slot keeps the card in hand: dropping it back where it came
      // from would look like a completed move the user never asked for.
      this._host.announce('moveRejected', {
        label: this._host.cardLabel(grab.session.card.id),
        reason: this._denialReason(grab, grab.target),
      });
      return true;
    }
    // The grab ends before the guard runs: the board announces the outcome
    // from the single place that knows it, whether the guard settles now or
    // several turns later.
    this._host.setDropPreview(null);
    this._grab.set(null);
    this._host.commitMove(request);
    return true;
  }

  /** Abandons a live grab, leaving the controlled collections unchanged. */
  cancel(): boolean {
    const grab = this._grab();
    if (grab === null) return false;
    this._grab.set(null);
    this._host.setDropPreview(null);
    this._host.cancelMove('cancelled', grab.session.card.id);
    return true;
  }

  /** Cancels a grab the user walked away from; plain focus loss is ignored. */
  releaseFocus(): void {
    this.cancel();
  }

  /** @private Picks up the focused card and aims at the slot it already fills. */
  private _beginGrab(): boolean {
    const focus = this._focus();
    if (focus === null) return false;
    const session = this._host.createSession(focus.itemId);
    if (session === null) return false;
    const source = session.card.source;
    this._grab.set({
      session,
      target: {
        columnId: source.columnId,
        swimlaneId: source.swimlaneId,
        index: source.index,
      },
    });
    this._publishTarget();
    this._host.announce('grabbed', {
      label: this._host.cardLabel(session.card.id),
    });
    return true;
  }

  /** @private Moves the roving focus one step through the rendered cards. */
  private _stepFocus(step: MlvTaskboardKeyboardStep): boolean {
    const focus = this._focus();
    if (focus === null) return false;
    const cards = this._host.cardsIn(focus.columnId, focus.swimlaneId);
    const cardIndex = cards.findIndex((id) => sameKey(id, focus.itemId));
    switch (step) {
      case 'first-card':
      case 'last-card': {
        const itemId =
          step === 'first-card' ? cards[0] : cards[cards.length - 1];
        if (itemId === undefined || sameKey(itemId, focus.itemId)) return false;
        return this._moveFocus({ ...focus, itemId });
      }
      case 'previous-column':
      case 'next-column':
        return this._focusNeighbourColumn(
          focus,
          Math.max(cardIndex, 0),
          step === 'next-column' ? 1 : -1,
        );
      default: {
        const delta = step === 'next-card' ? 1 : -1;
        const next = cardIndex + delta;
        if (cardIndex !== -1 && next >= 0 && next < cards.length) {
          return this._moveFocus({
            ...focus,
            itemId: cards[next] as MlvTaskboardKey,
          });
        }
        return this._focusNeighbourLane(focus, delta);
      }
    }
  }

  /**
   * @private Focuses the nearest card of the next non-empty cell along the
   * inline axis. An empty or collapsed cell owns no tab stop, so the scan
   * continues past it rather than stranding focus in a cell with no card.
   */
  private _focusNeighbourColumn(
    focus: MlvTaskboardKeyboardFocus,
    cardIndex: number,
    delta: number,
  ): boolean {
    const columns = this._host.columnIds();
    const start = columns.findIndex((id) => sameKey(id, focus.columnId));
    if (start === -1) return false;
    for (let i = start + delta; i >= 0 && i < columns.length; i += delta) {
      const columnId = columns[i] as MlvTaskboardKey;
      const cards = this._host.cardsIn(columnId, focus.swimlaneId);
      if (cards.length === 0) continue;
      const itemId = cards[Math.min(cardIndex, cards.length - 1)];
      return this._moveFocus({
        columnId,
        swimlaneId: focus.swimlaneId,
        itemId: itemId as MlvTaskboardKey,
      });
    }
    return false;
  }

  /** @private Continues past a cell's end into the neighbouring lane's cell. */
  private _focusNeighbourLane(
    focus: MlvTaskboardKeyboardFocus,
    delta: number,
  ): boolean {
    const lanes = this._host.swimlaneIds();
    const start = lanes.findIndex((id) => sameKey(id, focus.swimlaneId));
    if (start === -1) return false;
    for (let i = start + delta; i >= 0 && i < lanes.length; i += delta) {
      const swimlaneId = lanes[i];
      const cards = this._host.cardsIn(focus.columnId, swimlaneId);
      if (cards.length === 0) continue;
      const itemId = delta > 0 ? cards[0] : cards[cards.length - 1];
      return this._moveFocus({
        columnId: focus.columnId,
        swimlaneId,
        itemId: itemId as MlvTaskboardKey,
      });
    }
    return false;
  }

  /** @private Commits a new logical focus and pulls the DOM focus after it. */
  private _moveFocus(focus: MlvTaskboardKeyboardFocus): boolean {
    this._focus.set(focus);
    this._host.focusCard(focus);
    return true;
  }

  /** @private Moves the grab's target slot one step through the board. */
  private _stepTarget(step: MlvTaskboardKeyboardStep): boolean {
    const grab = this._grab();
    if (grab === null) return false;
    const { target } = grab;
    switch (step) {
      case 'first-card':
        return this._moveTarget({ ...target, index: 0 });
      case 'last-card':
        return this._moveTarget({
          ...target,
          index: this._slotCount(grab, target.columnId, target.swimlaneId),
        });
      case 'previous-column':
      case 'next-column': {
        const columns = this._host.columnIds();
        const start = columns.findIndex((id) => sameKey(id, target.columnId));
        const next = start + (step === 'next-column' ? 1 : -1);
        if (start === -1 || next < 0 || next >= columns.length) return false;
        const columnId = columns[next] as MlvTaskboardKey;
        return this._moveTarget({
          columnId,
          swimlaneId: target.swimlaneId,
          index: Math.min(
            target.index,
            this._slotCount(grab, columnId, target.swimlaneId),
          ),
        });
      }
      default: {
        const delta = step === 'next-card' ? 1 : -1;
        const next = target.index + delta;
        if (
          next >= 0 &&
          next <= this._slotCount(grab, target.columnId, target.swimlaneId)
        ) {
          return this._moveTarget({ ...target, index: next });
        }
        const lanes = this._host.swimlaneIds();
        const start = lanes.findIndex((id) => sameKey(id, target.swimlaneId));
        const lane = start + delta;
        if (start === -1 || lane < 0 || lane >= lanes.length) return false;
        const swimlaneId = lanes[lane];
        return this._moveTarget({
          columnId: target.columnId,
          swimlaneId,
          index:
            delta > 0 ? 0 : this._slotCount(grab, target.columnId, swimlaneId),
        });
      }
    }
  }

  /**
   * @private Highest slot index a cell offers. Slots count the cell's cards
   * with the grabbed card removed, so the cell the card came from offers one
   * slot fewer than any other cell holding the same number of cards.
   */
  private _slotCount(
    grab: MlvTaskboardKeyboardGrab<TItem>,
    columnId: MlvTaskboardKey,
    swimlaneId: MlvTaskboardKey | undefined,
  ): number {
    const source = grab.session.card.source;
    const isSourceCell =
      sameKey(columnId, source.columnId) &&
      sameKey(swimlaneId, source.swimlaneId);
    const cards = this._host.cardsIn(columnId, swimlaneId).length;
    return isSourceCell ? Math.max(cards - 1, 0) : cards;
  }

  /** @private Commits a new target slot, then previews and announces it. */
  private _moveTarget(target: MlvTaskboardKeyboardTarget): boolean {
    const grab = this._grab();
    if (grab === null) return false;
    if (
      sameKey(target.columnId, grab.target.columnId) &&
      sameKey(target.swimlaneId, grab.target.swimlaneId) &&
      target.index === grab.target.index
    ) {
      return false;
    }
    this._grab.set({ session: grab.session, target });
    this._publishTarget();
    this._announceTarget();
    return true;
  }

  /**
   * @private Whether a slot is the one the grabbed card already fills. The
   * session never enumerates it, so it is neither an authorised request nor a
   * recorded denial — every branch that asks "would this slot take the card?"
   * has to answer it separately.
   */
  private _isSourceSlot(
    grab: MlvTaskboardKeyboardGrab<TItem>,
    target: MlvTaskboardKeyboardTarget,
  ): boolean {
    const source = grab.session.card.source;
    return (
      sameKey(target.columnId, source.columnId) &&
      sameKey(target.swimlaneId, source.swimlaneId) &&
      target.index === source.index
    );
  }

  /**
   * @private The localized phrase for the reason the session recorded against
   * one slot. A slot with no recorded reason is one the session never
   * enumerated, which only the board's own policy can explain.
   */
  private _denialReason(
    grab: MlvTaskboardKeyboardGrab<TItem>,
    target: MlvTaskboardKeyboardTarget,
  ): string {
    return this._host.denialReason(
      grab.session.denialFor(
        target.columnId,
        target.swimlaneId,
        target.index,
      ) ?? 'policy',
    );
  }

  /** @private Renders the board's drop indicator at the current target slot. */
  private _publishTarget(): void {
    const grab = this._grab();
    if (grab === null) return;
    const { session, target } = grab;
    const request = session.requestFor(
      target.columnId,
      target.swimlaneId,
      target.index,
    );
    const isSourceSlot = this._isSourceSlot(grab, target);
    this._host.setDropPreview({
      columnId: target.columnId,
      swimlaneId: target.swimlaneId,
      index: target.index,
      itemId: session.card.id,
      // The source slot carries no request — the session skips it — but it
      // does take the card back, so the indicator does not paint it refused.
      allowed: request !== undefined || isSourceSlot,
      isSourceSlot,
      request,
    });
  }

  /** @private States whether the newly aimed-at slot would accept the card. */
  private _announceTarget(): void {
    const grab = this._grab();
    if (grab === null) return;
    const { session, target } = grab;
    const column = this._host.columnLabel(target.columnId);
    const lane = this._host.laneLabel(target.swimlaneId);
    const allowed =
      this._isSourceSlot(grab, target) ||
      session.requestFor(target.columnId, target.swimlaneId, target.index) !==
        undefined;
    if (!allowed) {
      this._host.announce('targetInvalid', {
        column,
        lane,
        reason: this._denialReason(grab, target),
      });
      return;
    }
    this._host.announce('targetValid', {
      column,
      lane,
      position: target.index + 1,
      count: this._slotCount(grab, target.columnId, target.swimlaneId) + 1,
    });
  }
}
