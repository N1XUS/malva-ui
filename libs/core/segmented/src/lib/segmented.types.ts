import type { MlvTone } from '@malva-ui/cdk/utils';

/**
 * Colour of the active pill. `'neutral'` is the boxed-tabs look (raised white
 * pill, primary text); every other tone uses the matching *pale* background and
 * semantic text colour.
 */
export type MlvSegmentedTone = 'neutral' | 'accent' | MlvTone;

/** Layout axis of the segmented track. */
export type MlvSegmentedOrientation = 'horizontal' | 'vertical';
