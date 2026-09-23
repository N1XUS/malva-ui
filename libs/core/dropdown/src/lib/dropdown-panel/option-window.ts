import type { MlvSelectOption } from '../select-option';

/**
 * @internal Rows `mlv-dropdown-panel` renders before the list is scrolled or
 * navigated, and the step its window grows by. Not exported from the package
 * barrel.
 *
 * Each rendered row hosts `@angular/aria`'s `Option`, and aria's
 * `SortedCollection` copies its whole `Set` per registration, so mounting `n`
 * rows is O(n²) (#318). A hundred rows is several screens of any panel height
 * the library ships (40% of the viewport by default), so the window is never
 * the reason a panel looks short, and it keeps first render flat in `n`.
 */
export const DROPDOWN_WINDOW_PAGE = 100;

/**
 * @internal The `@angular/aria` `Listbox` configuration the panel's key mirror
 * (`MlvDropdownPanel._onKeydownCapture`) is written against: arrow keys on the
 * vertical axis only, navigation wrapping at both ends, arrows that move
 * without committing, disabled options skipped, and aria's typeahead window.
 * The panel binds `selectionMode` and `softDisabled` itself; the other three
 * are aria's defaults, which `mlv-list` leaves alone.
 *
 * The mirror encodes this as behaviour rather than reading it, so a spec reads
 * the live `Listbox` off the rendered panel and asserts it still matches — an
 * upstream default change, or a template edit, then goes red instead of
 * silently pre-rendering a row aria no longer moves to.
 */
export const MIRRORED_LISTBOX_CONFIG = {
  orientation: 'vertical',
  wrap: true,
  selectionMode: 'explicit',
  softDisabled: false,
  typeaheadDelay: 500,
} as const;

/**
 * @internal The option `@angular/aria`'s listbox makes its tab stop until it
 * is first interacted with (`ListboxPattern.setDefaultState`): the first
 * checked option it can focus, else the first option it can focus, else `-1`.
 * aria picks only among the rows it has registered, so a roving panel renders
 * this row to keep Tab landing where it did with every row rendered.
 *
 * `checked` is aligned index-for-index with the options; `focusable(i)` is
 * aria's `isFocusable` with the panel's `softDisabled` off — not disabled.
 */
export function ariaDefaultTabStop(
  checked: readonly boolean[],
  focusable: (index: number) => boolean,
): number {
  let first = -1;
  for (let i = 0; i < checked.length; i++) {
    if (!focusable(i)) continue;
    if (first === -1) first = i;
    if (checked[i]) return i;
  }
  return first;
}

/**
 * @internal The smallest window, in whole pages, that renders the row at
 * `index`. `-1` (nothing required) needs no rows.
 */
export function windowLimitFor(index: number): number {
  return (
    Math.ceil(Math.max(index + 1, 0) / DROPDOWN_WINDOW_PAGE) *
    DROPDOWN_WINDOW_PAGE
  );
}

/**
 * @internal How much of a window grown over `previous` still stands over
 * `next`, judged over the `limit` positions it rendered:
 *
 * - `'views'` — every rendered row keeps its view. Each position holds the
 *   same `value`, the key both of the panel's `@for`s track rows by (compared
 *   with `Object.is`), and has the same place in the group runs: whether it
 *   starts a run, and whether its run is labelled. Nothing re-mounts. True for
 *   the same array, for a next page appended behind the rendered rows, and for
 *   a group renamed in place, which changes only a header's text.
 * - `'rows'` — the same values in the same places, but a rendered row changes
 *   run. The grouped template tracks runs by position and renders a labelled
 *   run and a headerless one in different blocks, so it re-creates that row's
 *   view although the list is the list it was.
 * - `'none'` — a rendered position holds a different `value`: a new query, a
 *   cleared query, a re-sort — exactly when the rows are re-created anyway and
 *   one page is all that needs to be.
 *
 * Two changes swap the block every row renders in and are the panel's to
 * compare, because neither is a property of the rendered positions: the list
 * turning grouped or flat (decided over every option, so a group past the
 * window counts) and the panel's `scrollMode`.
 */
export type DropdownWindowSurvival = 'views' | 'rows' | 'none';

/** @internal Computes {@link DropdownWindowSurvival} for one option change. */
export function windowSurvival<T>(
  previous: readonly MlvSelectOption<T>[],
  next: readonly MlvSelectOption<T>[],
  limit: number,
): DropdownWindowSurvival {
  if (previous === next) return 'views';
  const shared = Math.min(limit, previous.length, next.length);
  let survival: DropdownWindowSurvival = 'views';
  for (let i = 0; i < shared; i++) {
    if (!Object.is(previous[i].value, next[i].value)) return 'none';
    if (survival === 'views' && !sameRunPlace(previous, next, i)) {
      survival = 'rows';
    }
  }
  return survival;
}

/**
 * @internal The run the panel groups an option under — `null` for a missing or
 * empty `group`, the normalisation `MlvDropdownPanel._groups` applies.
 */
function groupRunLabel<T>(option: MlvSelectOption<T>): string | null {
  return option.group ? option.group : null;
}

/**
 * @internal Whether position `index` has the same place in the group runs of
 * `previous` and `next`: labelled in both or in neither, and starting a run in
 * both or in neither. Equal at every position of a prefix, the prefix splits
 * into the same runs with the same labelled-ness — all the grouped template's
 * blocks depend on.
 */
function sameRunPlace<T>(
  previous: readonly MlvSelectOption<T>[],
  next: readonly MlvSelectOption<T>[],
  index: number,
): boolean {
  const labelledBefore = groupRunLabel(previous[index]) !== null;
  const labelledNow = groupRunLabel(next[index]) !== null;
  if (labelledBefore !== labelledNow) return false;
  if (index === 0) return true;
  const startedBefore =
    groupRunLabel(previous[index]) !== groupRunLabel(previous[index - 1]);
  const startsNow =
    groupRunLabel(next[index]) !== groupRunLabel(next[index - 1]);
  return startedBefore === startsNow;
}

/**
 * @internal `aria-posinset` / `aria-setsize` for every option, as a browser
 * would compute them over the fully rendered list. The panel writes them only
 * while its window is truncated, so assistive tech still reads "3 of 5,000"
 * with 100 rows in the DOM; a complete list carries none and the browser
 * computes the same numbers itself.
 *
 * The set is the option's container: a labelled group (consecutive options
 * sharing `group`, rendered as `role="group"`) numbers its own options; the
 * options of every headerless run are direct children of the listbox and
 * number together, across any groups between them. An ungrouped list is one
 * set of `options.length`.
 */
export interface DropdownOptionSetPositions {
  /** 1-based position of the option at `index` within its set. */
  readonly posInSet: (index: number) => number;
  /** Size of the set holding the option at `index`. */
  readonly setSize: (index: number) => number;
}

/** @internal Builds {@link DropdownOptionSetPositions} in one pass over `options`. */
export function optionSetPositions<T>(
  options: readonly MlvSelectOption<T>[],
  grouped: boolean,
): DropdownOptionSetPositions {
  const total = options.length;
  if (!grouped) {
    return { posInSet: (index) => index + 1, setSize: () => total };
  }
  const posInSet = new Array<number>(total);
  const setSize = new Array<number>(total);
  /** Flat indices of the current labelled run, sized when the run ends. */
  let run: number[] = [];
  /** Flat indices of every headerless option, sized at the end. */
  const listboxLevel: number[] = [];
  let runLabel: string | null = null;
  const closeRun = (): void => {
    for (const index of run) setSize[index] = run.length;
    run = [];
  };
  options.forEach((option, index) => {
    const label = option.group ? option.group : null;
    if (label !== runLabel) {
      closeRun();
      runLabel = label;
    }
    if (label === null) {
      listboxLevel.push(index);
      posInSet[index] = listboxLevel.length;
    } else {
      run.push(index);
      posInSet[index] = run.length;
    }
  });
  closeRun();
  for (const index of listboxLevel) setSize[index] = listboxLevel.length;
  return {
    posInSet: (index) => posInSet[index],
    setSize: (index) => setSize[index],
  };
}
