import { applyMlvTaskboardMove } from '../taskboard-state';
import type {
  MlvTaskboardState,
  MlvTaskboardBeforeMove,
  MlvTaskboardMoveCancelReason,
  MlvTaskboardMoveCancelledEvent,
  MlvTaskboardMoveRequest,
  MlvTaskboardMoveResult,
} from '../taskboard.types';

/** Board-owned callbacks the guarded move flow drives. */
export interface MlvTaskboardMoveControllerConfig<TItem> {
  /**
   * The board a move applies against, read fresh at commit time — the very
   * snapshot a drag session is built from, so a request that names a different
   * one describes a board that has since been replaced.
   */
  board(): MlvTaskboardState<TItem>;
  /** The application guard to consult, when one is bound. */
  beforeMove(): MlvTaskboardBeforeMove<TItem> | undefined;
  /** Writes the single immutable replacement collection and emits `moved`. */
  apply(result: MlvTaskboardMoveResult<TItem>): void;
  /** Emits `moveCancelled` for a move that never changed the board. */
  cancelled(event: MlvTaskboardMoveCancelledEvent<TItem>): void;
  /** Toggles the board's pending state and its drag-blocking side effects. */
  setPending(pending: boolean): void;
}

/**
 * Package-private commit/cancel flow for one released pointer drop.
 *
 * Every terminal outcome except a successful commit leaves the controlled
 * `items` collection referentially unchanged: the controller either calls
 * `apply` exactly once, or reports one concrete cancellation reason.
 */
export class MlvTaskboardMoveController<TItem> {
  /** @private Identifies the newest pending move; older settlers are stale. */
  private _token = 0;

  constructor(
    private readonly _config: MlvTaskboardMoveControllerConfig<TItem>,
  ) {}

  /** Reports a drag that ended without reaching the guard at all. */
  cancel(
    reason: MlvTaskboardMoveCancelReason,
    request?: MlvTaskboardMoveRequest<TItem>,
  ): void {
    this._config.cancelled(
      request === undefined ? { reason } : { reason, request },
    );
  }

  /** Runs the guard, then applies the move if it is still the current one. */
  commit(request: MlvTaskboardMoveRequest<TItem>): void {
    const guard = this._config.beforeMove();
    if (guard === undefined) {
      this._finish(request);
      return;
    }

    let decision: boolean | Promise<boolean>;
    try {
      decision = guard(request);
    } catch {
      this.cancel('before-move-error', request);
      return;
    }
    if (decision === true) {
      this._finish(request);
      return;
    }
    if (decision === false) {
      this.cancel('before-move-rejected', request);
      return;
    }

    const token = ++this._token;
    this._config.setPending(true);
    void Promise.resolve(decision).then(
      (accepted) => {
        if (!this._settle(token)) return;
        if (!accepted) {
          this.cancel('before-move-rejected', request);
          return;
        }
        // The staleness check lives in `_finish`, so a move waiting on a guard
        // and one committing straight away are invalidated by the same read.
        this._finish(request);
      },
      () => {
        if (!this._settle(token)) return;
        this.cancel('before-move-error', request);
      },
    );
  }

  /**
   * @private Clears the pending state for the newest move only. A superseded
   * move settles silently: its successor owns both the state and the outcome.
   */
  private _settle(token: number): boolean {
    if (token !== this._token) return false;
    this._config.setPending(false);
    return true;
  }

  /** @private Applies the accepted request, or reports why it no longer fits. */
  private _finish(request: MlvTaskboardMoveRequest<TItem>): void {
    const board = this._config.board();
    // A request names the board its session enumerated. Anything that replaced
    // `items` or `columns` since — an application write, an undo, a settled
    // sibling move — left that board behind, so the move is reported stale
    // rather than applied to a board it never saw. Checked here rather than
    // left to `applyMlvTaskboardMove`, whose `null` cannot say which of the
    // two reasons it means.
    if (request.board !== board) {
      this.cancel('stale', request);
      return;
    }
    const result = applyMlvTaskboardMove(board, request);
    if (!result) {
      this.cancel('invalid-drop', request);
      return;
    }
    this._config.apply(result);
  }
}
