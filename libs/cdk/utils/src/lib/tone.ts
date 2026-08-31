/**
 * The shared semantic tone vocabulary for Malva UI display surfaces.
 *
 * A "tone" expresses the semantic meaning of a piece of visual feedback:
 * informational, positive, cautionary, or negative. It is the single source of
 * truth for the `tone` input exposed by display components such as
 * `mlv-alert`, `mlv-toast-item`, `mlv-notification-item`, `mlv-timeline`,
 * `mlv-tile`, `mlv-loader`, `mlv-progress`, `mlv-badge`, `mlv-chip`, and
 * `mlv-tooltip`.
 *
 * Components that need additional, non-semantic options (e.g. a neutral
 * `'default'`, brand `'primary'`, or surface `'neutral'`/`'surface'`) extend this
 * union locally rather than redefining the semantic members, keeping the core
 * `info | success | warning | danger` vocabulary consistent everywhere.
 *
 * @example
 * // Exact match — use MlvTone directly:
 * readonly tone = input<MlvTone>('info');
 *
 * @example
 * // Component-level extension:
 * export type MlvBadgeTone = MlvTone | 'default' | 'primary' | 'secondary' | 'accent';
 */
export type MlvTone = 'info' | 'success' | 'warning' | 'danger';
