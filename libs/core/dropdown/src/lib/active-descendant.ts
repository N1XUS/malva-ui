import { signal } from '@angular/core';
import type { Signal } from '@angular/core';

/**
 * Builds the deterministic DOM `id` for the option row at `index` within a
 * listbox, matching the id `mlv-dropdown-panel` stamps on each option. An
 * owning combobox / autocomplete computes the same id to point its input's
 * `aria-activedescendant` at the active row.
 *
 * This is the single source of truth for the activedescendant option-id format
 * (`<listboxId>-option-<index>`), shared by `mlv-dropdown-panel`,
 * `mlv-combobox`, and `[mlvAutocomplete]` so the id the panel renders and the
 * id the trigger references can never drift.
 *
 * @param listboxId - The id of the listbox that owns the option.
 * @param index - The option's flat index within the listbox.
 * @returns The option's DOM id, e.g. `"my-listbox-option-3"`.
 */
export function optionId(listboxId: string, index: number): string {
  return `${listboxId}-option-${index}`;
}

/**
 * Signal-backed bookkeeping for the "active option" index of a WAI-ARIA
 * activedescendant keyboard model — the shared engine behind `mlv-combobox`
 * and `[mlvAutocomplete]`, where DOM focus stays on the text input and the
 * highlighted option is tracked purely by index (mirrored into the input's
 * `aria-activedescendant`).
 *
 * The active index is `-1` when no option is active. {@link move} advances it
 * with wrap-around, treating a first move from `-1` as landing on the first
 * (forward) or last (backward) option; {@link first} / {@link last} jump to the
 * ends; {@link reset} clears it back to `-1`. The current option count is read
 * lazily through the accessor supplied at construction, so the owner can back it
 * with any signal / computed (e.g. a filtered-options length) without pushing
 * the count on every keystroke.
 */
export class MlvActiveDescendant {
  /** @private The active option index; `-1` = no active option. */
  private readonly _index = signal(-1);

  /**
   * The active option index as a read-only signal; `-1` when no option is
   * active. Read it reactively (template / effect) or imperatively (call it in
   * an event handler) — both track the same underlying state.
   */
  readonly index: Signal<number> = this._index.asReadonly();

  /**
   * @param _count Accessor returning the current number of navigable options.
   * Read lazily on each {@link move} / {@link first} / {@link last} call, so it
   * always reflects the live count (e.g. after the options are filtered).
   */
  constructor(private readonly _count: () => number) {}

  /**
   * Advances the active option by `delta` with wrap-around. With no option
   * active (`-1`), a forward move (`delta > 0`) lands on the first option and a
   * backward move (`delta < 0`) on the last; otherwise the index wraps modulo
   * the option count. Resets to `-1` when there are no options.
   *
   * @param delta Step to move by (`+1` next, `-1` previous).
   */
  move(delta: number): void {
    const count = this._count();
    if (count === 0) {
      this._index.set(-1);
      return;
    }
    const current = this._index();
    const next =
      current < 0
        ? delta > 0
          ? 0
          : count - 1
        : (current + delta + count) % count;
    this._index.set(next);
  }

  /** Activates the first option. No-op when there are no options. */
  first(): void {
    if (this._count() > 0) this._index.set(0);
  }

  /** Activates the last option. No-op when there are no options. */
  last(): void {
    const count = this._count();
    if (count > 0) this._index.set(count - 1);
  }

  /** Clears the active option back to `-1` (nothing active). */
  reset(): void {
    this._index.set(-1);
  }
}
