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
 * Side of the spine a timeline item's content sits on.
 *
 * A **logical alias** that mirrors in RTL: the item is a grid whose tracks
 * follow the inline axis, so `'right'` means the inline-end side and `'left'`
 * the inline-start side. Under a `[dir="rtl"]` ancestor a `'right'` item
 * renders its content on the left. The names predate RTL support and are kept
 * for compatibility.
 *
 * - `'right'` — node at inline-start, content at inline-end (default)
 * - `'left'` — content at inline-start, node at inline-end
 */
export type MlvTimelineItemDirection = 'left' | 'right';
