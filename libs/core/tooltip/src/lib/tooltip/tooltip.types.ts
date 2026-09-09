import type { MlvTone } from '@malva-ui/cdk/utils';

/**
 * Tone variant for the tooltip panel.
 *
 * Extends the shared {@link MlvTone} semantic vocabulary
 * (`'info' | 'success' | 'warning' | 'danger'`) with neutral, surface, and brand options:
 *
 * - `'neutral'` — fixed neutral-900 background with a light foreground (default)
 * - `'surface'` — theme-aware base surface with primary text
 * - `'primary'` — primary accent color
 */
export type MlvTooltipTone = MlvTone | 'neutral' | 'surface' | 'primary';

/**
 * Preferred placement of the tooltip relative to the trigger element.
 * CDK will use the first placement that fits in the viewport.
 *
 * `'left'` and `'right'` are **logical aliases**, not physical edges: they map
 * to `originX: 'start'` / `'end'`, so a `'left'` tooltip renders to the
 * trigger's right in RTL, arrow and 6px clearance included. `'top'` and
 * `'bottom'` are the block axis and never mirror. See `.claude/rules/rtl.md`
 * § Public API.
 */
export type MlvTooltipPlacement = 'top' | 'bottom' | 'left' | 'right';
