/**
 * Explicit rhythm override for `form[mlvForm]` / `fieldset[mlvFieldset]`.
 * Maps onto the spacing scale: `xs` 0.5rem, `s` 0.75rem, `m` 1rem, `l` 1.25rem,
 * `xl` 1.5rem. Unset = density-scaled default.
 */
export type MlvFormGap = 'xs' | 's' | 'm' | 'l' | 'xl';

/**
 * Column mode of `fieldset[mlvFieldset]`: `'auto'` = responsive auto-fit,
 * a number = maximum column count (still collapses when narrow).
 */
export type MlvFieldsetColumns = 'auto' | number;

/** Horizontal distribution of `[mlvFormActions]` children. */
export type MlvFormActionsAlign = 'start' | 'end' | 'center' | 'between';
