import type { MlvTone } from '@malva-ui/cdk/utils';

/**
 * Semantic tone for a timeline item.
 * Drives the icon node accent color and status indicator.
 *
 * Extends the shared {@link MlvTone} vocabulary
 * (`'info' | 'success' | 'warning' | 'danger'`) with:
 *
 * - `'default'` — neutral/gray (no semantic meaning)
 */
export type MlvTimelineItemTone = MlvTone | 'default';

/**
 * MlvLayout direction for a timeline item.
 *
 * - `'right'` — node on the left, content on the right (default)
 * - `'left'` — node on the right, content on the left
 */
export type MlvTimelineItemDirection = 'left' | 'right';
