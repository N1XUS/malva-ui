export interface MlvSelectOption<T = unknown> {
  label: string;
  value: T;
  /**
   * Optional group label. When one or more options in an array carry a
   * (non-empty) `group`, the dropdown panel clusters consecutive options that
   * share the same `group` value under a sticky, **non-selectable** section
   * header bearing this text (APG listbox grouping: `role="group"` +
   * `aria-labelledby`).
   *
   * Group headers are purely presentational. They are:
   * - skipped by keyboard navigation and type-ahead (they are not aria options);
   * - excluded from a combobox's filtered result set — a header shows only when
   *   at least one of its options matches the current filter;
   * - never part of the control's value (a header is not a `MlvSelectOption`).
   *
   * Only honoured for `MlvSelectOption`-shaped options. Plain primitive arrays go
   * through {@link defaultOptionTransform}, never carry a `group`, and therefore
   * render exactly as an ungrouped list. Options without a `group` (or with an
   * empty string) render ungrouped.
   */
  group?: string;
  /**
   * Whether the option is unavailable for selection. Rendered as
   * `aria-disabled` on the option row and skipped by keyboard navigation
   * (the dropdown panel pins `[softDisabled]="false"`). Clicking a disabled
   * row does not change the selection.
   */
  disabled?: boolean;
}

export type MlvSelectOptionTransform<T> = (item: T) => MlvSelectOption<T>;

export function defaultOptionTransform<T>(item: T): MlvSelectOption<T> {
  return isSelectOption<T>(item) ? item : { label: String(item), value: item };
}

export function isSelectOption<T>(value: unknown): value is MlvSelectOption<T> {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<MlvSelectOption<T>>;
  return !!candidate.label && !!candidate.value;
}

/**
 * Type-guard predicate: whether an array of resolved options is "grouped",
 * i.e. at least one option carries a non-empty {@link MlvSelectOption.group} label.
 *
 * The dropdown panel uses this to decide whether to render sticky group headers.
 * Returns `false` for empty arrays and for arrays where no option declares a
 * group, so ungrouped `MlvSelectOption` arrays (and plain primitive arrays) render
 * exactly as before.
 */
export function hasOptionGroups<T>(
  options: readonly MlvSelectOption<T>[],
): boolean {
  return options.some((option) => !!option.group);
}

export function resolveOptions<T>(
  items: T[],
  transform: MlvSelectOptionTransform<T>,
): MlvSelectOption<T>[] {
  return items.map(transform);
}
