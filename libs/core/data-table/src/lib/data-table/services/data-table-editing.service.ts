import { Injectable, signal } from '@angular/core';

/** One row's edit session. */
export interface MlvDataTableEditSession<T> {
  /**
   * Working copy handed to the row's templates while it is edited, and emitted
   * as the event `row`. A **shallow** clone: edit templates may assign its
   * top-level properties freely, but a nested object is the consumer's own
   * and mutating it in place writes through (see {@link shallowCloneRow}).
   */
  readonly draft: T;
  /** Shallow clone taken when editing started, emitted as `originalRow`. */
  readonly snapshot: T;
}

/**
 * Shallow clone of a row that keeps the row's prototype, so a class-instance
 * row keeps its getters and methods in edit mode — a `{ ...row }` spread
 * would hand edit templates a plain object on which `row.fullName` reads
 * `undefined` and `row.isActive()` throws. For a plain-object row the result
 * is the same as the spread.
 *
 * It **reads** exactly what a spread reads — own enumerable string and symbol
 * keys, in `Reflect.ownKeys` order, each value through `[[Get]]` (so an own
 * getter is invoked and its result copied) — and **defines** each one on the
 * prototype-linked clone as a plain writable, enumerable, configurable data
 * property. Defining rather than assigning matters twice:
 * - an assignment (`Object.assign`) consults the prototype chain, so an own
 *   property shadowing a getter-only prototype accessor threw `TypeError:
 *   Cannot set property … which has only a getter`, and a prototype setter
 *   swallowed the value instead of creating the own property;
 * - the source's own descriptors are not copied (`Object.create(proto,
 *   descriptors)` would copy them), so a row the consumer froze (an NgRx store
 *   in dev mode freezes its state) still yields a draft the templates can
 *   write to, and an own getter is read once rather than copied live.
 *
 * The trade-offs, documented in the library `CLAUDE.md`:
 * - nested objects are shared with the source, not copied;
 * - ECMAScript `#private` fields and built-in internal slots are not copied,
 *   so a member reading a `#private` field throws on the clone, and so does an
 *   inherited method of a `Date`, `Map` or `Set` subclass row.
 */
function shallowCloneRow<T extends object>(row: T): T {
  const clone = Object.create(Object.getPrototypeOf(row)) as T;
  for (const key of Reflect.ownKeys(row)) {
    if (!Object.getOwnPropertyDescriptor(row, key)?.enumerable) continue;
    Object.defineProperty(clone, key, {
      value: Reflect.get(row, key),
      writable: true,
      enumerable: true,
      configurable: true,
    });
  }
  return clone;
}

/**
 * Component-scoped editing state for `mlv-data-table`.
 *
 * Sessions are keyed by the consumer's **row object**, never by the row's view
 * index: sorting, filtering, searching, paging or expanding a tree node moves
 * rows between positions, and an index-keyed session then put a different row
 * into edit mode and paired the save with the wrong `originalRow` (#297). A
 * session therefore follows its row wherever it renders, survives the row being
 * filtered or paged out of view, and ends only on save or cancel. A row
 * replaced by a new object (a refetch that rebuilds its rows) no longer renders
 * in edit mode, because it is no longer the row that was being edited. A row
 * object listed at two positions is one row: both positions edit together.
 *
 * Starting an edit clones the row twice, both shallow: the `draft` the
 * templates write to and the `snapshot` reported as `originalRow`. Cancelling
 * therefore needs no rollback for top-level properties — the draft is simply
 * dropped and the row renders its own values again.
 *
 * Provided per-component via `providers: [MlvDataTableEditingService]` so each
 * `mlv-data-table` instance has its own isolated editing state.
 */
@Injectable()
export class MlvDataTableEditingService<
  T extends object = Record<string, unknown>,
> {
  /** @private Open edit sessions, keyed by the consumer's row object. */
  private readonly _sessions = signal<
    ReadonlyMap<T, MlvDataTableEditSession<T>>
  >(new Map());

  /**
   * @private Draft → the row it was cloned from, for every open session. Lets a
   * draft that a template passes back in (a consumer edit template calling
   * `saveEdit(row, index)`) resolve to the row that keys its session. Entries
   * are removed when the session ends: a saved draft the consumer writes back
   * into its data becomes an ordinary row of its own.
   */
  private readonly _sources = new WeakMap<T, T>();

  /**
   * Resolves a row reference to the consumer row that keys selection,
   * expansion and edit state: the draft of an open session maps back to its
   * row, and any other object is returned unchanged.
   */
  source(row: T): T {
    return this._sources.get(row) ?? row;
  }

  /** Whether the given row (or the draft of it) is currently being edited. */
  isEditing(row: T): boolean {
    return this._sessions().has(this.source(row));
  }

  /** Whether at least one row is currently being edited. */
  hasActiveEdit(): boolean {
    return this._sessions().size > 0;
  }

  /** The open session for the given row (or its draft), if any. */
  session(row: T): MlvDataTableEditSession<T> | undefined {
    return this._sessions().get(this.source(row));
  }

  /**
   * Begin editing the given row: clones a draft for the templates and a
   * snapshot for `originalRow`. Starting a row that is already being edited
   * keeps its session, so an in-progress draft is never discarded.
   */
  start(row: T): MlvDataTableEditSession<T> {
    const source = this.source(row);
    const open = this._sessions().get(source);
    if (open) return open;

    const session: MlvDataTableEditSession<T> = {
      draft: shallowCloneRow(source),
      snapshot: shallowCloneRow(source),
    };
    this._sources.set(session.draft, source);
    const sessions = new Map(this._sessions());
    sessions.set(source, session);
    this._sessions.set(sessions);
    return session;
  }

  /**
   * Confirm edits for the given row. Ends its session and returns it, or
   * `undefined` when the row was not being edited.
   */
  save(row: T): MlvDataTableEditSession<T> | undefined {
    return this._end(row);
  }

  /**
   * Cancel editing the given row. Ends its session and returns it, or
   * `undefined` when the row was not being edited. The draft is discarded;
   * the table never assigned a property of the consumer's row, so there is
   * nothing to restore — except what a template mutated inside a nested
   * object the draft shares with the row.
   */
  cancel(row: T): MlvDataTableEditSession<T> | undefined {
    return this._end(row);
  }

  /** @private Removes the row's session and its draft mapping. */
  private _end(row: T): MlvDataTableEditSession<T> | undefined {
    const source = this.source(row);
    const session = this._sessions().get(source);
    if (!session) return undefined;
    this._sources.delete(session.draft);
    const sessions = new Map(this._sessions());
    sessions.delete(source);
    this._sessions.set(sessions);
    return session;
  }
}
